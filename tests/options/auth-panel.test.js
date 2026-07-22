"use strict";

const assert = require("node:assert/strict");
const authApi = require("../../src/options/auth-panel.js");

const strings = { authDenied: "denied", authExpired: "expired", authError: "error" };
assert.equal(authApi.errorText(strings, "access_denied"), "denied");
assert.equal(authApi.errorText(strings, "expired_token"), "expired");
assert.equal(authApi.errorText(strings, "no_pending_authorization"), "expired");
assert.equal(authApi.errorText(strings, "network"), "error");
assert.equal(authApi.DEVICE_URL, "https://github.com/login/device");

console.log("options auth-panel tests: OK");
