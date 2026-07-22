"use strict";

const assert = require("node:assert/strict");
const stringsApi = require("../../src/popup/strings.js");

const calls = [];
const i18n = {
  create(language, browserLanguage) {
    assert.equal(language, "ru");
    assert.equal(browserLanguage, "ru-RU");
    return {
      locale: "ru",
      tag: "ru-RU",
      pluralCategory: (count) => count === 1 ? "one" : "other",
      t(key, substitutions = []) {
        calls.push({ key, substitutions });
        return substitutions.length ? `${key}:${substitutions.join("|")}` : key;
      }
    };
  }
};

const localized = stringsApi.create(i18n, "ru", "ru-RU");
assert.equal(localized.translator.tag, "ru-RU");
assert.equal(localized.strings.updates, "popupUpdates");
assert.equal(localized.strings.updateFound(1), "popupUpdateFoundOne:1");
assert.equal(localized.strings.updateFound(2), "popupUpdateFoundOther:2");
assert.equal(localized.strings.rateLimited("12:30"), "popupRateLimitedUntil:12:30");
assert.equal(localized.formatOptions().linux.at(-1)[1], "commonArchive");
assert.ok(calls.some((entry) => entry.key === "popupUpdates"));
assert.ok(Object.isFrozen(localized.strings));

console.log("popup strings tests: OK");
