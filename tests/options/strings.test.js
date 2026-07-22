"use strict";

const assert = require("node:assert/strict");
const stringsApi = require("../../src/options/strings.js");

const i18n = {
  create(language, browserLanguage) {
    assert.equal(language, "en");
    assert.equal(browserLanguage, "en-US");
    return {
      locale: "en",
      tag: "en-US",
      pluralCategory: (count) => count === 1 ? "one" : "other",
      number: (value) => `#${value}`,
      t: (key, substitutions = []) => substitutions.length ? `${key}:${substitutions.join("|")}` : key
    };
  }
};

const localized = stringsApi.create(i18n, "en", "en-US");
assert.equal(localized.strings.pageTitle, "optionsPageTitle");
assert.equal(localized.strings.months(1), "optionsMonthsOne:1");
assert.equal(localized.strings.months(3), "optionsMonthsOther:3");
assert.equal(localized.strings.authRate(10, 60), "optionsAuthRate:#10|#60");
assert.equal(localized.strings.rateLimited(""), "optionsRateLimited");
assert.ok(Object.isFrozen(localized.strings));

console.log("options strings tests: OK");
