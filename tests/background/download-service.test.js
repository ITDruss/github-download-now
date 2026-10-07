"use strict";
const assert = require("node:assert/strict");
const serviceApi = require("../../src/background/download-service.js");
const urlPolicy = require("../../src/url-policy.js");
const batchAssets = require("../../src/batch-assets.js");
const data = {};
const records = new Map();
const searches = [];
const canceled = [];
let nextId = 0;
let allowed = true;
let failing = false;
let starts = 0;
const assets = Array.from({ length: 5 }, (_, i) => ({ id: i, name: `file-${i}.zip`, size: 100,
  browser_download_url: `https://github.com/Acme/Tool/releases/download/v1/file-${i}.zip` }));
const storage = { async localGet(defaults) { return { ...defaults, ...JSON.parse(JSON.stringify(data)) }; },
  async localSet(values) { Object.assign(data, JSON.parse(JSON.stringify(values))); },
  async localRemove(keys) { for (const key of keys) delete data[key]; } };
const browserApi = { permissions: { contains: async () => allowed }, downloads: {
  async download(options) {
    starts++;
    if (failing) throw new Error("network");
    const id = nextId++; records.set(id, { ...options, id, filename: `C:/Downloads/${options.filename}`, state: "in_progress" }); return id;
  },
  async search(query) {
    searches.push(query);
    assert.ok(query.id !== undefined || query.filenameRegex, "never enumerate general download history");
    return [...records.values()].filter(item => query.id !== undefined ? item.id === query.id : new RegExp(query.filenameRegex).test(item.filename));
  },
  async cancel(id) { canceled.push(id); records.get(id).state = "interrupted"; }
} };
const options = { storage, browserApi, extensionApi: { downloads: { download() {} } }, urlPolicy, batchAssets,
  catalog: { load: async () => ({ ok: true, complete: true, release: { tag_name: "v1", assets } }) },
  randomId: () => "11111111-1111-1111-1111-111111111111" };
const message = { owner: "Acme", repo: "Tool", tag: "v1", urls: assets.map(asset => asset.browser_download_url) };
(async () => {
  const service = serviceApi.create(options);
  const privateService = serviceApi.create({ ...options,
    extensionApi: { extension: { inIncognitoContext: true } },
    storage: { localGet() { throw new Error("Private context must not read normal-profile storage"); } } });
  await privateService.initialize();
  assert.equal((await privateService.status()).error, "incognito_unsupported");
  assert.equal((await service.start({ ...message, urls: ["https://evil.example/file"] })).error, "invalid_selection");
  assert.equal((await service.start(message, { tab: { incognito: true } })).error, "incognito_unsupported");
  allowed = false; assert.equal((await service.start(message)).error, "permission_required"); allowed = true;
  const first = await service.start(message);
  assert.equal(starts, 3, "only three concurrent downloads");
  assert.equal(first.batch.items[0].downloadId, 0, "download ID zero is valid");
  assert.equal((await service.start(message)).error, "queue_busy");
  records.get(0).state = "complete";
  await service.changed({ id: 0, state: { current: "complete" } }); assert.equal(starts, 4);
  records.get(1).state = "interrupted";
  await service.changed({ id: 1, state: { current: "interrupted" }, error: { current: "NETWORK_FAILED" } }); assert.equal(starts, 5);
  const persisted = data[serviceApi.STORAGE_KEY];
  persisted.items[2].state = "starting"; persisted.items[2].downloadId = null;
  records.get(2).state = "complete";
  const restored = serviceApi.create(options); await restored.initialize();
  assert.equal((await restored.status()).batch.items[2].state, "complete", "recover an accepted download whose ID was not yet persisted");
  assert.equal(starts, 5, "worker recovery does not duplicate accepted files");
  await restored.retry(first.batch.id); assert.equal(starts, 6, "only the failed item is retried");
  assert.equal((await restored.clear()).error, "queue_busy");
  const result = await restored.cancel(first.batch.id);
  assert.ok(canceled.length > 0);
  assert.equal(result.batch.items[0].state, "complete", "cancel does not relabel successful downloads");
  assert.equal(batchAssets.active(result.batch), false);
  await restored.clear(); assert.equal(data[serviceApi.STORAGE_KEY], undefined);
  allowed = false;
  const optionalApi = {};
  const optionalService = serviceApi.create({ ...options, extensionApi: optionalApi });
  await optionalService.initialize();
  let eventHandler;
  let registrations = 0;
  optionalApi.downloads = { download() {}, onChanged: { addListener(handler) { eventHandler = handler; registrations++; } } };
  allowed = true;
  await optionalService.initialize(); await optionalService.initialize();
  assert.equal(registrations, 1, "register download events once after optional permission exposes the API");
  const optionalBatch = await optionalService.start(message);
  const started = starts;
  const completedId = optionalBatch.batch.items[0].downloadId;
  records.get(completedId).state = "complete";
  eventHandler({ id: completedId, state: { current: "complete" } });
  await optionalService.status();
  assert.equal(starts, started + 1, "events advance the queue after the manager page closes");
  allowed = false;
  assert.equal((await optionalService.cancel(optionalBatch.batch.id)).error, "permission_required");
  allowed = true;
  await optionalService.cancel(optionalBatch.batch.id); await optionalService.clear();
  failing = true;
  const failed = await restored.start(message);
  assert.equal(failed.batch.items.filter(item => item.state === "interrupted").length, 5);
  assert.equal(batchAssets.active(failed.batch), false);
  console.log("download queue, retry, permission, cancellation and recovery tests: OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
