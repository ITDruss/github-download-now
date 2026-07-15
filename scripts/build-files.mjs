export const EXTENSION_FILES = Object.freeze([
  "asset-selector.js",
  "background.js",
  "build-instructions.js",
  "content.js",
  "github-auth.js",
  "install-guides.js",
  "options.css",
  "options.html",
  "options.js",
  "popup.css",
  "popup.html",
  "popup.js",
  "settings.js",
  "styles.css",
  "tracker.js",
  "url-policy.js",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png"
]);

export const MANIFEST_FILES = Object.freeze([
  "manifest.chromium.json",
  "manifest.firefox.json"
]);

export const ALLOWED_SOURCE_FILES = Object.freeze([
  ...EXTENSION_FILES,
  ...MANIFEST_FILES
]);
