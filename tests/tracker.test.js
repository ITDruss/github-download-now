"use strict";

const assert = require("node:assert/strict");
const tracker = require("../src/tracker.js");

const base = {
  owner: "LocalSend",
  repo: "LocalSend",
  releaseId: 17,
  releaseTag: "v1.17.0",
  releaseUrl: "https://github.com/localsend/localsend/releases/tag/v1.17.0",
  assetId: 100,
  assetName: "LocalSend-linux-x86-64.AppImage",
  assetUrl: "https://github.com/localsend/localsend/releases/download/v1.17.0/app.AppImage",
  assetExtension: ".appimage",
  platform: { os: "linux", arch: "x64", preferredFormat: "appimage" }
};

{
  const item = tracker.sanitizeDownload(base);
  assert.equal(item.key, "localsend/localsend");
  assert.equal(item.platform.os, "linux");
  assert.equal(item.assetExtension, ".appimage");
}

{
  let history = [];
  history = tracker.addHistory(history, { ...base, id: "one" }, 2);
  history = tracker.addHistory(history, { ...base, id: "two", releaseId: 18 }, 2);
  history = tracker.addHistory(history, { ...base, id: "three", releaseId: 19 }, 2);
  assert.deepEqual(history.map((item) => item.id), ["three", "two"]);
}

{
  const download = tracker.sanitizeDownload(base);
  const watch = tracker.watchFromDownload(download);
  assert.equal(watch.currentReleaseId, 17);
  assert.equal(watch.currentTag, "v1.17.0");
  assert.equal(tracker.isNewRelease(watch, { id: 18 }), true);
  assert.equal(tracker.isNewRelease(watch, { id: 17 }), false);
}

{
  let watches = [];
  watches = tracker.upsertWatch(watches, tracker.watchFromDownload(base));
  watches = tracker.upsertWatch(watches, tracker.watchFromDownload({ ...base, releaseId: 18, releaseTag: "v1.18.0" }));
  assert.equal(watches.length, 1);
  assert.equal(watches[0].currentTag, "v1.18.0");
}

{
  const update = tracker.sanitizeUpdate({ owner: "LocalSend", repo: "LocalSend", releaseId: 18, releaseTag: "v1.18.0", compatibleAssetFound: true });
  const updates = tracker.upsertUpdate([], update);
  assert.equal(updates.length, 1);
  assert.equal(tracker.removeUpdate(updates, "localsend/localsend").length, 0);
}

console.log("tracker tests: OK");

{
  let watches = [];
  for (let index = 0; index < tracker.MAX_WATCHES + 5; index += 1) {
    watches = tracker.upsertWatch(watches, tracker.watchFromDownload({
      ...base,
      owner: `owner${index}`,
      repo: `repo${index}`
    }));
  }
  assert.equal(tracker.MAX_WATCHES, 30);
  assert.equal(watches.length, tracker.MAX_WATCHES);
}
