"use strict";

const assert = require("node:assert/strict");
const messages = require("../src/shared/messages.js");

assert.equal(messages.TYPES.GET_LATEST_RELEASE, "GHDN_GET_LATEST_RELEASE");
assert.equal(messages.TYPES.AUTH_START, "GHDN_AUTH_START");
assert.equal(messages.VALUES.length, 18);
assert.equal(new Set(messages.VALUES).size, messages.VALUES.length);
assert.equal(messages.isKnownType(messages.TYPES.OPEN_OPTIONS), true);
assert.equal(messages.isKnownType("GHDN_UNKNOWN"), false);
assert.equal(messages.isAuthType(messages.TYPES.AUTH_POLL), true);
assert.equal(messages.isAuthType(messages.TYPES.GET_DASHBOARD), false);
assert.deepEqual(messages.create(messages.TYPES.OPEN_URL, { url: "https://github.com/" }), {
  type: messages.TYPES.OPEN_URL,
  url: "https://github.com/"
});
assert.throws(() => messages.create("GHDN_UNKNOWN"), /Unknown runtime message type/);

console.log("message contract tests: OK");
