"use strict";

const assert = require("node:assert/strict");
const selector = require("../src/asset-selector.js");

function asset(name, downloads = 0, size = 1000) {
  return {
    id: name,
    name,
    size,
    state: "uploaded",
    download_count: downloads,
    browser_download_url: `https://example.test/${encodeURIComponent(name)}`
  };
}

{
  const result = selector.recommendation([
    asset("app-linux-x86_64.AppImage"),
    asset("app-windows-x64-setup.exe"),
    asset("checksums-sha256.txt")
  ], { os: "windows", arch: "x64" });
  assert.equal(result.best.name, "app-windows-x64-setup.exe");
  assert.equal(result.confidence, "high");
}

{
  const result = selector.recommendation([
    asset("app-linux-x86_64.tar.gz"),
    asset("app-linux-x86_64.deb"),
    asset("app-linux-x86_64.AppImage")
  ], { os: "linux", arch: "x64" });
  assert.equal(result.best.name, "app-linux-x86_64.AppImage");
}

{
  const result = selector.recommendation([
    asset("app-macos-x64.dmg"),
    asset("app-macos-arm64.dmg"),
    asset("app-macos-universal2.zip")
  ], { os: "macos", arch: "arm64" });
  assert.equal(result.best.name, "app-macos-arm64.dmg");
}

{
  const ranked = selector.rankAssets([
    asset("product-x64.exe"),
    asset("product-x64.exe.sha256"),
    asset("product-SBOM.json"),
    asset("source-code.zip")
  ], { os: "windows", arch: "x64" });
  assert.deepEqual(ranked.map((item) => item.name), ["product-x64.exe"]);
}

{
  const firefoxResult = selector.recommendation([
    asset("extension.xpi"),
    asset("extension.crx")
  ], { os: "linux", arch: "x64", browser: "firefox" });
  assert.equal(firefoxResult.best.name, "extension.xpi");

  const chromeResult = selector.recommendation([
    asset("extension.xpi"),
    asset("extension.crx")
  ], { os: "linux", arch: "x64", browser: "chrome" });
  assert.equal(chromeResult.best.name, "extension.crx");
}

{
  const result = selector.recommendation([
    asset("app-linux-x86_64.AppImage"),
    asset("app-linux-x86_64.deb")
  ], { os: "linux", arch: "x64", preferredFormat: "deb" });
  assert.equal(result.best.name, "app-linux-x86_64.deb");
  assert.ok(result.best.reasons.includes("preference:deb"));
}

{
  const result = selector.recommendation([
    asset("product-windows-x64-setup.exe"),
    asset("product-windows-x64-portable.zip")
  ], { os: "windows", arch: "x64", preferredFormat: "portable" });
  assert.equal(result.best.name, "product-windows-x64-portable.zip");
}

console.log("asset-selector tests: OK");
