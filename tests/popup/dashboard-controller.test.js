"use strict";

const assert = require("node:assert/strict");
const dashboardApi = require("../../src/popup/dashboard-controller.js");

const formatting = { time: (value, locale) => `${locale}:${value}` };
const translator = { tag: "en-US" };
const strings = {
  rateLimited: (time) => time ? `limited:${time}` : "limited",
  checkSummary: (found, failed) => `summary:${found}:${failed}`,
  checkProgress: (checked, total) => `progress:${checked}:${total}`
};

assert.deepEqual(
  dashboardApi.summarizeCheck({ detected: [{}, {}], errors: [], checked: 3, total: 5 }, formatting, translator, strings),
  { message: "summary:2:0 · progress:3:5", error: false }
);
assert.deepEqual(
  dashboardApi.summarizeCheck({ errors: [{ error: "rate_limited", resetAt: "tomorrow" }] }, formatting, translator, strings),
  { message: "limited:en-US:tomorrow", error: true }
);
assert.deepEqual(
  dashboardApi.summarizeCheck({ errors: [{ error: "network" }] }, formatting, translator, strings),
  { message: "summary:0:1", error: true }
);

console.log("popup dashboard-controller tests: OK");
