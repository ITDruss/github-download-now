"use strict";
const assert = require("node:assert/strict");
const loaderApi = require("../../src/content/release/release-loader.js");
const repo = { owner: "Acme", repo: "Tool", key: "acme/tool" };
const sent = [];
const fetched = [];
const parser = {
  latestReleaseTagFromDocument(doc, _repo, options) {
    return options.releaseChannel === "stable" ? (doc.stable ? "v2" : "") : "v3-beta";
  },
  collectReleaseTags: () => ["v3-beta", "v2"],
  releaseSectionByTag: () => null,
  releaseAssetsFromDocument: doc => doc.full ? [{ id: 1 }, { id: 2 }] : [{ id: 1 }],
  releaseFromPage: (_repo, tag, assets) => ({ tag_name: tag, assets }),
  encodeGitHubPath: encodeURIComponent
};
function loader(offline = false) {
  return loaderApi.create({
    documentObject: { partial: true }, pageParser: parser,
    pageClient: { async fetchDocument(path) {
      fetched.push(path);
      if (offline) throw new Error("offline");
      return { full: path.includes("expanded_assets"), stable: true };
    } },
    selector: { recommendation: assets => ({ ranked: assets, best: assets[0], confidence: "high" }) },
    urlPolicy: {}, githubDom: { isVisibleElement: () => true },
    runtime: { async sendMessage(message) { sent.push(message); return { ok: true, source: "API" }; } },
    messages: { TYPES: { GET_LATEST_RELEASE: "latest", GET_RELEASE_BY_TAG: "tag" } }
  });
}
(async () => {
  const service = loader();
  assert.equal((await service.load({ repo, releaseChannel: "stable" })).release.tag_name, "v2");
  assert.equal((await service.load({ repo, releaseChannel: "newest" })).release.tag_name, "v3-beta");
  const explicit = await service.load({ repo, releaseChannel: "stable", requestedTag: "v3-beta" });
  assert.equal(explicit.release.tag_name, "v3-beta");
  assert.equal(explicit.release.assets.length, 2, "the full expanded list replaces a partial page list");
  assert.ok(fetched.includes("/Acme/Tool/releases/expanded_assets/v3-beta"));
  await loader(true).load({ repo, releaseChannel: "stable" });
  assert.equal(sent.at(-1).releaseChannel, "stable");
  console.log("release channel regression tests: OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
