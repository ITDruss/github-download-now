"use strict";

const assert = require("node:assert/strict");
require("../src/i18n-catalogs.js");
const i18n = require("../src/i18n.js");

assert.deepEqual(i18n.availableLocales().map((item) => item.code), ["en", "ru"]);
assert.equal(i18n.resolveLocale("auto", "ru-RU"), "ru");
assert.equal(i18n.resolveLocale("auto", "en-US"), "en");
assert.equal(i18n.resolveLocale("auto", "uk-UA"), "en");
assert.equal(i18n.resolveLocale("ru", "en-US"), "ru");
assert.equal(i18n.resolveLocale("de", "ru-RU"), "en");

const english = i18n.create("en");
const russian = i18n.create("ru");
assert.equal(english.t("contentDownloadFormat", ["AppImage"]), "Download AppImage");
assert.equal(russian.t("contentDownloadFormat", ["AppImage"]), "Скачать AppImage");
assert.equal(english.t("optionsAuthRate", ["4,999", "5,000"]), "GitHub API: 4,999 of 5,000 remaining");
assert.equal(russian.t("contentWatchQuestion", ["owner/repo"]), "Следить за обновлениями owner/repo?");
assert.equal(english.t("missingMessage"), "");
assert.equal(english.pluralCategory(1), "one");
assert.equal(english.pluralCategory(2), "other");

console.log("i18n tests: OK");
