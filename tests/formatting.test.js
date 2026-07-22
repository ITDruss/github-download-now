"use strict";

const assert = require("node:assert/strict");
const formatting = require("../src/shared/formatting.js");

assert.equal(formatting.bytes(0), "0 B");
assert.equal(formatting.bytes(0, { emptyForZero: true, minimumKilobytes: true }), "");
assert.equal(formatting.bytes(1536), "1.5 KB");
assert.equal(formatting.formatName(".appimage"), "AppImage");
assert.equal(formatting.formatName(".unknown"), "UNKNOWN");
assert.deepEqual(formatting.platform("Mozilla/5.0 (X11; Linux x86_64)"), { os: "linux", arch: "x64" });
assert.deepEqual(formatting.platform("Mozilla/5.0 (Linux; Android 16; arm64)"), { os: "android", arch: "ARM64" });
assert.deepEqual(formatting.platform("Mozilla/5.0 (Windows NT 10.0; Win32; x86)"), { os: "windows", arch: "x86" });
assert.equal(formatting.platformSettingKey("macos"), "preferredMacos");
assert.equal(formatting.platformSettingKey("unknown"), "");

const labels = {
  justNow: "now",
  minutesAgo: (value) => `${value}m`,
  hoursAgo: (value) => `${value}h`,
  daysAgo: (value) => `${value}d`
};
const now = Date.parse("2026-07-22T12:00:00Z");
assert.equal(formatting.relativeDate("2026-07-22T11:59:30Z", labels, now), "now");
assert.equal(formatting.relativeDate("2026-07-22T11:30:00Z", labels, now), "30m");
assert.equal(formatting.relativeDate("invalid", labels, now), "—");

console.log("formatting tests: OK");
