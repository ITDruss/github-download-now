"use strict";

const assert = require("node:assert/strict");
const platformApi = require("../../src/content/platform.js");

const selector = {
  detectExtension(name = "") {
    const lower = String(name).toLowerCase();
    if (lower.endsWith(".appimage")) return ".appimage";
    if (lower.endsWith(".exe")) return ".exe";
    return "";
  },
  detectOsMarkers(name = "") {
    const lower = String(name).toLowerCase();
    return lower.includes("windows") ? ["windows"] : lower.includes("linux") ? ["linux"] : [];
  },
  detectArchMarkers(name = "") {
    return /arm64/i.test(name) ? ["arm64"] : /x64|x86-64/i.test(name) ? ["x64"] : [];
  }
};
const formatting = {
  formatName: (extension) => extension.toUpperCase(),
  date: (value, locale) => `${locale}:${value}`
};
let settings = {
  osOverride: "auto",
  archOverride: "auto",
  staleReleaseMonths: 6
};
const strings = {
  unknownPlatform: "Unknown",
  universal: "Universal",
  localeTag: "en-US",
  published: "Published"
};
const api = platformApi.create({
  navigatorObject: { userAgent: "Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0" },
  selector,
  formatting,
  settingsApi: { preferredFormatForOs: (_settings, os) => os === "linux" ? ".appimage" : "auto" },
  getSettings: () => settings,
  getStrings: () => strings,
  now: () => Date.UTC(2026, 6, 22)
});

(async () => {
  assert.deepEqual(await api.detect(), {
    os: "linux",
    arch: "x64",
    browser: "firefox",
    preferredFormat: ".appimage"
  });
  settings = { ...settings, osOverride: "windows", archOverride: "arm64" };
  assert.deepEqual(await api.detect(), {
    os: "windows",
    arch: "arm64",
    browser: "firefox",
    preferredFormat: "auto"
  });
  assert.equal(api.assetPlatform({ name: "tool-linux-arm64.AppImage" }), "linux");
  assert.equal(api.assetPlatform({ name: "tool.exe" }), "windows");
  assert.equal(api.assetArchitecture({ name: "tool-linux-arm64.AppImage", score: 50, reasons: [] }, { os: "linux", arch: "x64" }), "ARM64");
  assert.equal(api.isCompatibleAsset({ name: "tool.exe", score: 80, reasons: [] }, { os: "linux", arch: "x64" }), false);
  assert.equal(api.isCompatibleAsset({ name: "tool.AppImage", score: 80, reasons: [] }, { os: "linux", arch: "x64" }), true);
  assert.equal(api.iconName("unknown"), "package");
  assert.equal(api.metaText({ os: "linux", arch: "arm64" }), "Linux · ARM64");
  settings = { ...settings, staleReleaseMonths: 3 };
  assert.equal(api.isReleaseStale({ published_at: "2025-01-01T00:00:00Z" }), true);
  assert.equal(api.releaseDateText({ published_at: "2026-07-01" }), "Published en-US:2026-07-01");
  console.log("content platform tests: OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
