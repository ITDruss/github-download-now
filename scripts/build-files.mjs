import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localesRoot = path.join(root, "src", "_locales");

const localeDirectories = (await readdir(localesRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && /^[A-Za-z]{2,3}(?:_[A-Za-z]{2})?$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

export const LOCALE_FILES = Object.freeze(
  localeDirectories.map((locale) => `_locales/${locale}/messages.json`)
);

export const EXTENSION_FILES = Object.freeze([
  "shared/messages.js",
  "shared/browser-api.js",
  "shared/formatting.js",
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
  "asset-selector.js",
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
  "background.js",
  "build-instructions.js",
  "content.js",
  "github-auth.js",
  "i18n-catalogs.js",
  "i18n.js",
  "install-guides.js",
  "options.css",
  "options.html",
  "options.js",
  "popup.css",
  "popup.html",
  "popup.js",
  "settings.js",
  "styles/content-base.css",
  "styles/download-menu.css",
  "styles/asset-list.css",
  "styles/notices.css",
  "styles/install-guidance.css",
  "styles/build-documents.css",
  "styles/version-selector.css",
  "tracker.js",
  "url-policy.js",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
  ...LOCALE_FILES
]);

export const MANIFEST_FILES = Object.freeze([
  "manifest.chromium.json",
  "manifest.firefox.json"
]);

export const ALLOWED_SOURCE_FILES = Object.freeze([
  ...EXTENSION_FILES,
  ...MANIFEST_FILES
]);
