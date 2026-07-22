import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BACKGROUND_IMPORTS,
  CONTENT_SCRIPTS,
  CONTENT_STYLES,
  OPTIONS_SCRIPTS,
  POPUP_SCRIPTS
} from "./project-structure.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localesRoot = path.join(root, "src", "_locales");

const localeDirectories = (await readdir(localesRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && /^[A-Za-z]{2,3}(?:_[A-Za-z]{2})?$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

export const LOCALE_FILES = Object.freeze(
  localeDirectories.map((locale) => `_locales/${locale}/messages.json`)
);

function unique(items) {
  return [...new Set(items)];
}

export const EXTENSION_FILES = Object.freeze(unique([
  ...CONTENT_SCRIPTS,
  ...CONTENT_STYLES,
  ...BACKGROUND_IMPORTS,
  "background.js",
  ...POPUP_SCRIPTS,
  ...OPTIONS_SCRIPTS,
  "popup.css",
  "popup.html",
  "options.css",
  "options.html",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
  ...LOCALE_FILES
]));

export const MANIFEST_FILES = Object.freeze([
  "manifest.chromium.json",
  "manifest.firefox.json"
]);

export const ALLOWED_SOURCE_FILES = Object.freeze([
  ...EXTENSION_FILES,
  ...MANIFEST_FILES
]);
