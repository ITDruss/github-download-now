"use strict";

const assert = require("node:assert/strict");
const parser = require("../../src/content/release/page-parser.js");
const urlPolicy = require("../../src/url-policy.js");

function link(href, text = "") {
  return {
    textContent: text,
    parentElement: null,
    getAttribute(name) { return name === "href" ? href : null; },
    closest() { return this.context || null; }
  };
}

const repo = { owner: "Acme", repo: "Tool", key: "acme/tool" };
const assetParent = { textContent: "Tool Linux 1.5 MiB", parentElement: null };
const validAsset = link("/Acme/Tool/releases/download/v1.2.3/tool-linux.zip");
validAsset.parentElement = assetParent;
const duplicateAsset = link("https://github.com/Acme/Tool/releases/download/v1.2.3/tool-linux.zip");
duplicateAsset.parentElement = assetParent;
const evilAsset = link("https://evil.example/Acme/Tool/releases/download/v1.2.3/evil.zip");
evilAsset.parentElement = assetParent;
const tagOne = link("/Acme/Tool/releases/tag/v1.2.3");
tagOne.context = { textContent: "Latest release" };
const tagTwo = link("/Acme/Tool/releases/tag/v1.1.0");
tagTwo.context = { textContent: "Older releases" };
const doc = {
  querySelectorAll(selector) {
    if (selector.includes("releases/download")) return [validAsset, duplicateAsset, evilAsset];
    if (selector.includes("releases/tag")) return [tagOne, tagTwo, tagOne];
    return [];
  }
};

const assets = parser.releaseAssetsFromDocument(doc, repo, "v1.2.3", { urlPolicy });
assert.equal(assets.length, 1);
assert.equal(assets[0].name, "tool-linux.zip");
assert.equal(assets[0].size, Math.round(1.5 * 1024 ** 2));
assert.equal(assets[0].content_type, "application/zip");
assert.deepEqual(parser.collectReleaseTags(doc, repo, { urlPolicy }), ["v1.2.3", "v1.1.0"]);
assert.equal(parser.latestReleaseTagFromDocument(doc, repo, { urlPolicy }), "v1.2.3");
assert.equal(parser.parseHumanSize("file 12.4 MB"), 12_400_000);
assert.equal(parser.assetContentType("app.apk"), "application/vnd.android.package-archive");

const heading = { textContent: "Tool v1.2.3" };
const time = { getAttribute: () => "2026-07-22T10:00:00Z" };
const section = {
  textContent: "Pre-release Tool v1.2.3",
  querySelectorAll(selector) { return selector === "h1, h2, h3" ? [heading] : []; },
  querySelector() { return time; }
};
const release = parser.releaseFromPage(repo, "v1.2.3", assets, section);
assert.equal(release.name, "Tool v1.2.3");
assert.equal(release.prerelease, true);
assert.equal(release.published_at, "2026-07-22T10:00:00Z");
assert.equal(release.html_url, "https://github.com/Acme/Tool/releases/tag/v1.2.3");

console.log("release page parser tests: OK");
