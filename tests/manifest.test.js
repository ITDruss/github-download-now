"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const backgroundModules = [
  "background/storage.js",
  "background/github-client.js",
  "background/release-service.js",
  "background/build-service.js",
  "background/navigation.js",
  "background/auth-service.js",
  "background/tracker-state.js",
  "background/alarms.js",
  "background/notifications.js",
  "background/tracking-service.js",
  "background/message-router.js",
];

const backgroundEntry = fs.readFileSync(path.join(root, "src", "background.js"), "utf8");
for (const backgroundModule of backgroundModules) assert.ok(backgroundEntry.includes(`"${backgroundModule}"`));

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
  assert.deepEqual(manifest.content_scripts[0].js.slice(0, 6), [
    "shared/messages.js", "shared/browser-api.js", "shared/formatting.js",
    "i18n-catalogs.js", "i18n.js", "settings.js"
  ]);
  assert.ok(manifest.content_scripts[0].js.indexOf("url-policy.js") < manifest.content_scripts[0].js.indexOf("content.js"));
  assert.ok(manifest.content_scripts[0].js.indexOf("install-guides.js") < manifest.content_scripts[0].js.indexOf("content.js"));
  assert.deepEqual(
    manifest.content_scripts[0].js.slice(-21),
    [
      "content/strings.js",
      "content/platform.js",
      "content/repository-context.js",
      "content/github-dom.js",
      "content/placement.js",
      "content/state.js",
      "content/page-client.js",
      "content/release/page-parser.js",
      "content/release/release-loader.js",
      "content/release/version-controller.js",
      "content/lifecycle.js",
      "content/ui/icons.js",
      "content/ui/elements.js",
      "content/ui/download-button.js",
      "content/ui/menu-shell.js",
      "content/ui/notices.js",
      "content/ui/install-guidance.js",
      "content/ui/build-documents.js",
      "content/ui/asset-list.js",
      "content/ui/release-menu.js",
      "content.js"
    ]
  );
  assert.deepEqual(manifest.content_scripts[0].css, [
    "styles/content-base.css",
    "styles/download-menu.css",
    "styles/asset-list.css",
    "styles/notices.css",
    "styles/install-guidance.css",
    "styles/build-documents.css",
    "styles/version-selector.css"
  ]);
  assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'none'");
  assert.ok(!manifest.permissions.includes("tabs"));
  assert.ok(!manifest.permissions.includes("cookies"));
  assert.ok(!manifest.permissions.includes("downloads"));
  if (file === "manifest.firefox.json") {
    assert.equal(manifest.browser_specific_settings.gecko.strict_min_version, "140.0");
    assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required, ["browsingActivity"]);
    assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.optional, ["authenticationInfo"]);
    assert.equal(manifest.browser_specific_settings.gecko_android.strict_min_version, "142.0");
    assert.deepEqual(manifest.background.scripts.slice(0, 5), [
      "shared/messages.js", "shared/browser-api.js",
      "i18n-catalogs.js", "i18n.js", "settings.js"
    ]);
    assert.ok(manifest.background.scripts.indexOf("build-instructions.js") < manifest.background.scripts.indexOf("background.js"));
    assert.ok(manifest.background.scripts.indexOf("github-auth.js") < manifest.background.scripts.indexOf("background.js"));
    assert.deepEqual(manifest.background.scripts.slice(-(backgroundModules.length + 1)), [
      ...backgroundModules,
      "background.js"
    ]);
  } else {
    assert.equal(manifest.background.service_worker, "background.js");
  }
}

console.log(`manifest tests: OK (v${packageJson.version})`);
