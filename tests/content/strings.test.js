"use strict";

const assert = require("node:assert/strict");
const stringsApi = require("../../src/content/strings.js");

const calls = [];
const i18n = {
  create(language, browserLanguage) {
    assert.equal(language, "ru");
    assert.equal(browserLanguage, "ru-RU");
    return {
      locale: "ru",
      tag: "ru-RU",
      t(key, substitutions = []) {
        calls.push({ key, substitutions });
        return substitutions.length ? `${key}:${substitutions.join("|")}` : key;
      }
    };
  }
};

const strings = stringsApi.create(i18n, "ru", "ru-RU");
assert.equal(strings.locale, "ru");
assert.equal(strings.localeTag, "ru-RU");
assert.equal(strings.downloadNow, "contentDownloadNow");
assert.equal(strings.downloadFormat("DEB"), "contentDownloadFormat:DEB");
assert.equal(strings.rateLimited("12:30"), "contentRateLimitedUntil:12:30");
assert.equal(strings.rateLimited(""), "contentRateLimited");
assert.equal(strings.watchQuestion("owner/repo"), "contentWatchQuestion:owner/repo");
assert.equal(strings.formatHints[".appimage"], "contentFormatHintAppimage");
assert.ok(calls.some((entry) => entry.key === "contentWatchQuestion"));
assert.ok(Object.isFrozen(strings));
assert.ok(Object.isFrozen(strings.formatHints));

console.log("content strings tests: OK");
