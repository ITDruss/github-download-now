"use strict";

const assert = require("node:assert/strict");
const loaderApi = require("../../src/content/release/release-loader.js");

const repo = { owner: "Acme", repo: "Tool", key: "acme/tool" };
const messages = {
  TYPES: {
    GET_LATEST_RELEASE: "GHDN_GET_LATEST_RELEASE",
    GET_RELEASE_BY_TAG: "GHDN_GET_RELEASE_BY_TAG"
  }
};

function successfulParser() {
  return {
    collectReleaseTags: () => ["v2", "v1"],
    latestReleaseTagFromDocument: () => "v2",
    releaseSectionByTag: () => ({ id: "section" }),
    releaseAssetsFromDocument: () => [{ id: 1, name: "tool.AppImage" }],
    releaseFromPage: (_repo, tag, assets) => ({ tag_name: tag, assets }),
    encodeGitHubPath: encodeURIComponent
  };
}

(async () => {
  let recommendationCalls = 0;
  const loader = loaderApi.create({
    documentObject: { id: "current" },
    pageParser: successfulParser(),
    pageClient: { fetchDocument: async () => { throw new Error("not expected"); } },
    selector: {
      recommendation(assets) {
        recommendationCalls += 1;
        return { ranked: assets, best: assets[0], confidence: "high", gap: 7 };
      }
    },
    urlPolicy: {},
    githubDom: { isVisibleElement: () => true },
    runtime: { sendMessage: async () => { throw new Error("not expected"); } },
    messages
  });

  const pageResponse = await loader.load({ repo, platform: { os: "linux" }, releaseChannel: "stable" });
  assert.equal(pageResponse.ok, true);
  assert.equal(pageResponse.fromPage, true);
  assert.equal(pageResponse.release.tag_name, "v2");
  assert.equal(pageResponse.recommendation.best.name, "tool.AppImage");
  assert.equal(recommendationCalls, 1);

  await loader.loadFromPage(repo, "v2", { os: "linux" });
  assert.equal(recommendationCalls, 2, "release data is cached but recommendation is platform-specific");
  assert.deepEqual(await loader.getReleaseTags(repo), ["v2", "v1"]);

  const sent = [];
  const fallbackParser = {
    collectReleaseTags: () => [],
    latestReleaseTagFromDocument: () => "",
    releaseSectionByTag: () => null,
    releaseAssetsFromDocument: () => [],
    releaseFromPage: () => { throw new Error("not expected"); },
    encodeGitHubPath: encodeURIComponent
  };
  const fallback = loaderApi.create({
    documentObject: {},
    pageParser: fallbackParser,
    pageClient: { fetchDocument: async () => { throw new Error("offline"); } },
    selector: { recommendation: () => ({ ranked: [], best: null, confidence: "low", gap: null }) },
    urlPolicy: {},
    githubDom: { isVisibleElement: () => true },
    runtime: {
      async sendMessage(message) {
        sent.push(message);
        return { ok: true, source: "background" };
      }
    },
    messages
  });

  assert.deepEqual(
    await fallback.load({ repo, platform: { os: "linux" }, releaseChannel: "prerelease" }),
    { ok: true, source: "background" }
  );
  assert.equal(sent[0].type, messages.TYPES.GET_LATEST_RELEASE);
  assert.equal(sent[0].releaseChannel, "prerelease");

  await fallback.load({ repo, requestedTag: "v1.0.0", platform: { os: "windows" } });
  assert.equal(sent[1].type, messages.TYPES.GET_RELEASE_BY_TAG);
  assert.equal(sent[1].tag, "v1.0.0");

  console.log("release loader tests: OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
