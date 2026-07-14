"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

for (const file of ["manifest.chromium.json", "manifest.firefox.json"]) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "src", file), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, packageJson.version, `${file} version must match package.json`);
  assert.deepEqual(manifest.host_permissions, ["https://api.github.com/*"]);
  assert.ok(manifest.content_scripts[0].matches.includes("https://github.com/*"));
  assert.deepEqual(manifest.permissions, ["storage", "alarms"]);
  assert.deepEqual(manifest.optional_permissions, ["notifications"]);
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.equal(manifest.options_ui.page, "options.html");
  assert.equal(manifest.content_scripts[0].js[0], "settings.js");
  assert.ok(manifest.content_scripts[0].js.indexOf("install-guides.js") < manifest.content_scripts[0].js.indexOf("content.js"));
  assert.ok(!manifest.permissions.includes("tabs"));
  assert.ok(!manifest.permissions.includes("cookies"));
  assert.ok(!manifest.permissions.includes("downloads"));
  if (file === "manifest.firefox.json") {
    assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, "140.0");
    assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, ["browsingActivity"]);
    assert.equal(manifest.browser_specific_settings.gecko_android.strict_min_version, "142.0");
  }
}

console.log(`manifest tests: OK (v${packageJson.version})`);
