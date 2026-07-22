"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  const root = path.join(__dirname, "..");
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const structure = await import(pathToFileURL(path.join(root, "scripts", "project-structure.mjs")).href);
  const backgroundEntry = fs.readFileSync(path.join(root, "src", "background.js"), "utf8");

  for (const backgroundModule of structure.BACKGROUND_IMPORTS) {
    assert.ok(backgroundEntry.includes(`"${backgroundModule}"`));
  }

  for (const file of ["manifest.chromium.json", "manifest.firefox.json"]) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "src", file), "utf8"));
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.version, packageJson.version, `${file} version must match package.json`);
    assert.deepEqual(manifest.host_permissions, ["https://api.github.com/*", "https://github.com/*"]);
    assert.ok(manifest.content_scripts[0].matches.includes("https://github.com/*"));
    assert.deepEqual(manifest.permissions, ["storage", "alarms"]);
    assert.deepEqual(manifest.optional_permissions, ["notifications"]);
    assert.equal(manifest.action.default_popup, "popup.html");
    assert.equal(manifest.options_ui.page, "options.html");
    assert.equal(manifest.default_locale, "en");
    assert.equal(manifest.name, "__MSG_extensionName__");
    assert.equal(manifest.description, "__MSG_extensionDescription__");
    assert.deepEqual(manifest.content_scripts[0].js, structure.CONTENT_SCRIPTS);
    assert.deepEqual(manifest.content_scripts[0].css, structure.CONTENT_STYLES);
    assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'none'");
    assert.ok(!manifest.permissions.includes("tabs"));
    assert.ok(!manifest.permissions.includes("cookies"));
    assert.ok(!manifest.permissions.includes("downloads"));

    if (file === "manifest.firefox.json") {
      assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, "140.0");
      assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, ["browsingActivity"]);
      assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.optional, ["authenticationInfo"]);
      assert.equal(manifest.browser_specific_settings.gecko_android.strict_min_version, "142.0");
      assert.deepEqual(manifest.background.scripts, structure.FIREFOX_BACKGROUND_SCRIPTS);
    } else {
      assert.equal(manifest.background.service_worker, "background.js");
    }
  }

  for (const [file, expectedScripts] of [
    ["popup.html", structure.POPUP_SCRIPTS],
    ["options.html", structure.OPTIONS_SCRIPTS]
  ]) {
    const html = fs.readFileSync(path.join(root, "src", file), "utf8");
    const scripts = [...html.matchAll(/<script\s+[^>]*src="([^"]+)"[^>]*><\/script>/gi)]
      .map((match) => match[1]);
    assert.deepEqual(scripts, expectedScripts, `${file} script order must match project-structure.mjs`);
  }

  for (const [entry, limit] of Object.entries(structure.ENTRY_LINE_LIMITS)) {
    const text = fs.readFileSync(path.join(root, "src", entry), "utf8");
    assert.ok(text.split(/\r?\n/).length <= limit, `${entry} must remain within ${limit} lines`);
  }

  console.log(`manifest tests: OK (v${packageJson.version})`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
