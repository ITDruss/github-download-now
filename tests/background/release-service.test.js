"use strict";

const assert = require("node:assert/strict");
const releaseServiceModule = require("../../src/background/release-service.js");
const urlPolicy = require("../../src/url-policy.js");
const selector = require("../../src/asset-selector.js");

let calls = 0;
const githubClient = {
  validGitRef(value) { return String(value || "").trim(); },
  async fetchJson(url) {
    calls += 1;
    const tagMatch = String(url).match(/\/tags\/([^?#]+)/);
    const tag = tagMatch ? decodeURIComponent(tagMatch[1]) : "v2.0.0";
    return {
      ok: true,
      etag: '"release"',
      rateLimit: { limit: 60, remaining: 59, used: 1, resetAt: null },
      data: {
        id: 2,
        tag_name: tag,
        name: `Release ${tag}`,
        html_url: `https://github.com/example/app/releases/tag/${tag}`,
        published_at: "2026-07-22T00:00:00Z",
        assets: [{
          id: 20,
          name: "app-linux-x86_64.AppImage",
          size: 1000,
          state: "uploaded",
          browser_download_url: `https://github.com/example/app/releases/download/${tag}/app-linux-x86_64.AppImage`
        }],
        zipball_url: `https://api.github.com/repos/example/app/zipball/${tag}`,
        tarball_url: `https://api.github.com/repos/example/app/tarball/${tag}`
      }
    };
  }
};

(async () => {
  const service = releaseServiceModule.create({ githubClient, urlPolicy, selector, now: () => 1000 });
  const first = await service.getRelease("example", "app", { os: "linux", arch: "x64" }, "stable");
  assert.equal(first.ok, true);
  assert.equal(first.release.tag_name, "v2.0.0");
  assert.equal(first.recommendation.best.name, "app-linux-x86_64.AppImage");
  const cached = await service.getRelease("example", "app", { os: "linux", arch: "x64" }, "stable");
  assert.equal(cached.fromCache, true);
  assert.equal(calls, 1);
  const tagged = await service.getReleaseByTag("example", "app", "v1.9.0", { os: "linux", arch: "x64" });
  assert.equal(tagged.release.tag_name, "v1.9.0");
  assert.equal((await service.getRelease("bad/name", "app", {}, "stable")).error, "invalid_repository");
  service.clearCache();
  console.log("background release service tests: OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
