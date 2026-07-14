"use strict";

const assert = require("node:assert/strict");
const settingsApi = require("../src/settings.js");

{
  const normalized = settingsApi.normalize({
    enabled: false,
    preferredLinux: "deb",
    primaryAction: "menu",
    staleReleaseMonths: 999,
    buttonStyle: "invalid",
    afterDownload: "always",
    updateCheckInterval: "6h",
    historyEnabled: false,
    installGuidance: "compact"
  });
  assert.equal(normalized.enabled, false);
  assert.equal(normalized.preferredLinux, "deb");
  assert.equal(normalized.primaryAction, "menu");
  assert.equal(normalized.staleReleaseMonths, 120);
  assert.equal(normalized.buttonStyle, "accent");
  assert.equal(normalized.afterDownload, "always");
  assert.equal(normalized.updateCheckInterval, "6h");
  assert.equal(normalized.historyEnabled, false);
  assert.equal(normalized.installGuidance, "compact");
}

{
  assert.equal(settingsApi.preferredFormatForOs({ preferredLinux: "rpm" }, "linux"), "rpm");
  assert.equal(settingsApi.preferredFormatForOs({ preferredWindows: "msi" }, "windows"), "msi");
  assert.equal(settingsApi.preferredFormatForOs({}, "unknown"), "auto");
}

console.log("settings tests: OK");
