"use strict";

const assert = require("node:assert/strict");
const actionsApi = require("../../src/options/update-actions.js");

const formatting = { time: (value, locale) => `${locale}:${value}` };
const strings = {
  localeTag: "ru-RU",
  rateLimited: (time) => `limited:${time}`,
  checkSummary: (found, failed, checked, total) => `${found}/${failed}/${checked}/${total}`
};
assert.equal(
  actionsApi.summarize({ detected: [{}, {}], errors: [], checked: 4, total: 9 }, formatting, strings),
  "2/0/4/9"
);
assert.equal(
  actionsApi.summarize({ errors: [{ error: "rate_limited", resetAt: "later" }] }, formatting, strings),
  "limited:ru-RU:later"
);

console.log("options update-actions tests: OK");
