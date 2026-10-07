"use strict";

const assert = require("node:assert/strict");
const { createStorageArea } = require("./helpers/extension-api-mock.js");

const runtimeState = { localAccessRestricted: false };
const syncStore = { enabled: true };
const localStore = {};
const opened = [];
let alarm = null;
let notification = null;
let optionsOpened = 0;

global.chrome = {
  runtime: {
    lastError: null,
    sendMessage(message, callback) { callback({ ok: true, echo: message }); },
    openOptionsPage() { optionsOpened += 1; return Promise.resolve(); }
  },
  storage: {
    sync: createStorageArea(syncStore),
    local: createStorageArea(localStore, runtimeState)
  },
  tabs: {
    create({ url }, callback) {
      opened.push(url);
      callback({ id: opened.length, url });
    }
  },
  permissions: {
    contains(_value, callback) { callback(true); },
    request(_value, callback) { callback(true); },
    getAll(callback) { callback({ permissions: ["storage"] }); }
  },
  notifications: {
    create(id, options, callback) { notification = { id, options }; callback(); }
  },
  downloads: {
    download(_options, callback) { callback(0); },
    search(query, callback) { callback([{ id: query.id, state: "complete" }]); },
    cancel(_id, callback) { callback(); }
  },
  alarms: {
    create(name, info) { alarm = { name, ...info }; },
    get(name, callback) { callback(alarm?.name === name ? alarm : undefined); },
    clear(name, callback) { const existed = alarm?.name === name; alarm = null; callback(Boolean(existed)); }
  }
};

const browserApi = require("../src/shared/browser-api.js");

(async () => {
  assert.equal(browserApi.api, global.chrome);
  assert.equal(browserApi.isPromiseApi, false);
  assert.deepEqual(await browserApi.runtime.sendMessage({ type: "TEST" }), { ok: true, echo: { type: "TEST" } });
  assert.deepEqual(await browserApi.storage.sync.get({ enabled: false }), { enabled: true });
  await browserApi.storage.local.set({ token: "value" });
  assert.deepEqual(await browserApi.storage.local.get({ token: null }), { token: "value" });
  await browserApi.storage.local.remove(["token"]);
  assert.deepEqual(await browserApi.storage.local.get({ token: null }), { token: null });
  await browserApi.storage.local.setAccessLevel("TRUSTED_CONTEXTS");
  assert.equal(runtimeState.localAccessRestricted, true);
  assert.deepEqual(await browserApi.tabs.create("https://github.com/"), { id: 1, url: "https://github.com/" });
  assert.deepEqual(opened, ["https://github.com/"]);
  await browserApi.runtime.openOptionsPage();
  assert.equal(optionsOpened, 1);
  assert.equal(await browserApi.permissions.contains({ permissions: ["notifications"] }), true);
  assert.equal(await browserApi.permissions.request({ permissions: ["notifications"] }), true);
  assert.deepEqual(await browserApi.permissions.getAll(), { permissions: ["storage"] });
  await browserApi.notifications.create("id", { title: "Title" });
  assert.deepEqual(notification, { id: "id", options: { title: "Title" } });
  browserApi.alarms.create("test", { periodInMinutes: 60 });
  assert.deepEqual(await browserApi.alarms.get("test"), { name: "test", periodInMinutes: 60 });
  assert.equal(await browserApi.alarms.clear("test"), true);
  assert.equal(await browserApi.downloads.download({ url: "https://github.com/" }), 0);
  assert.deepEqual(await browserApi.downloads.search({ id: 0 }), [{ id: 0, state: "complete" }]);
  assert.equal(await browserApi.downloads.cancel(0), undefined);
  global.chrome.downloads.download = (_options, callback) => {
    global.chrome.runtime.lastError = { message: "DOWNLOAD_FAILED" };
    callback();
    global.chrome.runtime.lastError = null;
  };
  await assert.rejects(browserApi.downloads.download({}), /DOWNLOAD_FAILED/);
  global.browser = { downloads: {
    async download(...args) { assert.equal(args.length, 1, "Firefox API takes no Chrome callback"); return 12; },
    async search(query) { return [{ id: query.id, state: "complete" }]; },
    async cancel() {}
  } };
  assert.equal(await browserApi.downloads.download({}), 12);
  assert.deepEqual(await browserApi.downloads.search({ id: 12 }), [{ id: 12, state: "complete" }]);
  assert.equal(await browserApi.downloads.cancel(12), undefined);
  console.log("browser API adapter tests: OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
