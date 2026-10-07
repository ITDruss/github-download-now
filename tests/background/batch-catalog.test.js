"use strict";
const assert = require("node:assert/strict");
const catalogApi = require("../../src/background/batch-catalog.js");
const releaseApi = require("../../src/background/release-service.js");
const urlPolicy = require("../../src/url-policy.js");
const selector = require("../../src/asset-selector.js");
const batchAssets = require("../../src/batch-assets.js");
let count = 205;
let visibility = "public";
let brokenPage = false;
const calls = [];
const client = { validGitRef: value => String(value || ""), async fetchJson(url, options) {
  calls.push({ url, options });
  if (url.endsWith("/Acme/Tool")) return { ok: true, data: { private: visibility !== "public", visibility } };
  if (url.includes("/tags/")) return { ok: true, data: { id: 22, tag_name: "v1", assets: [] } };
  const page = Number(new URL(url).searchParams.get("page"));
  if (brokenPage && page === 2) return { ok: false, error: "rate_limited" };
  return { ok: true, data: Array.from({ length: Math.max(0, Math.min(100, count - (page - 1) * 100)) }, (_, i) => ({
    id: (page - 1) * 100 + i + 1, state: "uploaded", size: 12,
    browser_download_url: `https://github.com/Acme/Tool/releases/download/v1/${(page - 1) * 100 + i}.zip`
  })) };
} };
const releaseService = releaseApi.create({ githubClient: client, urlPolicy, selector });
const catalog = catalogApi.create({ githubClient: client, urlPolicy, releaseService, batchAssets });
(async () => {
  const full = await catalog.load("Acme", "Tool", "v1");
  assert.equal(full.complete, true); assert.equal(full.release.assets.length, 205);
  assert.ok(calls.every(call => call.options.skipAuth === true), "the entire catalog stays anonymous even when GitHub is connected");
  assert.equal((await catalog.load("Acme", "Tool", "v2")).error, "invalid_response");
  visibility = "private"; assert.equal((await catalog.load("Acme", "Tool", "v1")).error, "public_only");
  visibility = undefined; assert.equal((await catalog.load("Acme", "Tool", "v1")).error, "public_only");
  visibility = "public"; brokenPage = true;
  assert.equal((await catalog.load("Acme", "Tool", "v1")).error, "rate_limited", "partial lists never become downloadable catalogs");
  brokenPage = false; count = 500;
  assert.equal((await catalog.load("Acme", "Tool", "v1")).release.assets.length, 500);
  count = 501; assert.equal((await catalog.load("Acme", "Tool", "v1")).error, "asset_limit");
  console.log("complete batch catalog tests: OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
