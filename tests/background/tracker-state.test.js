"use strict";

const assert = require("node:assert/strict");
const trackerStateModule = require("../../src/background/tracker-state.js");
const tracker = require("../../src/tracker.js");
const urlPolicy = require("../../src/url-policy.js");

const local = {};
const storage = {
  async localGet(defaults) { return { ...defaults, ...local }; },
  async localSet(values) { Object.assign(local, values); }
};
const state = trackerStateModule.create({ storage, tracker, urlPolicy });

function payload() {
  return {
    owner: "example",
    repo: "app",
    releaseId: 1,
    releaseTag: "v1.0.0",
    releaseName: "Release v1.0.0",
    releaseUrl: "https://github.com/example/app/releases/tag/v1.0.0",
    assetId: 10,
    assetName: "app.AppImage",
    assetUrl: "https://github.com/example/app/releases/download/v1.0.0/app.AppImage",
    assetExtension: ".appimage",
    assetSize: 100,
    platform: { os: "linux", arch: "x64" },
    releaseChannel: "stable"
  };
}

(async () => {
  const download = state.downloadFromPayload(payload());
  assert.equal(download.owner, "example");
  assert.equal(state.downloadFromPayload({ ...payload(), assetUrl: "https://evil.example/a" }), null);
  const watch = tracker.watchFromDownload(download);
  await state.writeTrackerState({ history: [download], watches: [watch], updates: [], meta: { watchCursor: "2" } });
  const read = await state.readTrackerState();
  assert.equal(read.history.length, 1);
  assert.equal(read.watches.length, 1);
  assert.equal(read.meta.watchCursor, 2);
  assert.equal(state.trustedReleasePage("https://github.com/example/app/releases/tag/v2", "example", "app", "v1"), null);
  console.log("background tracker-state tests: OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
