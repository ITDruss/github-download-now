"use strict";

const assert = require("node:assert/strict");
const auth = require("../src/github-auth.js");

assert.equal(auth.CLIENT_ID, "Ov23liF54e9cVZTKyRqy");
assert.equal(auth.DEVICE_CODE_ENDPOINT, "https://github.com/login/device/code");

const pending = auth.normalizeDeviceResponse({
  device_code: "dc_abcdefghijklmnopqrstuvwxyz123456",
  user_code: "ABCD-EFGH",
  verification_uri: "https://github.com/login/device",
  expires_in: 900,
  interval: 5
}, 1_000);
assert.ok(pending);
assert.equal(pending.userCode, "ABCD-EFGH");
assert.equal(pending.nextPollAt, 1_000);
assert.equal(auth.normalizeDeviceResponse({
  device_code: "dc_abcdefghijklmnopqrstuvwxyz123456",
  user_code: "ABCD-EFGH",
  verification_uri: "https://evil.example/device"
}), null);

const token = auth.normalizeTokenResponse({
  access_token: "gho_abcdefghijklmnopqrstuvwxyz1234567890",
  token_type: "bearer",
  scope: ""
});
assert.equal(token.ok, true);
assert.equal(auth.normalizeTokenResponse({
  access_token: "gho_abcdefghijklmnopqrstuvwxyz1234567890",
  token_type: "bearer",
  scope: "repo"
}).error, "unexpected_scope");
assert.equal(auth.normalizeTokenResponse({ error: "authorization_pending" }).error, "authorization_pending");

const stored = auth.normalizeStoredAuth({
  token: token.token,
  connectedAt: "2026-07-14T00:00:00Z",
  rateLimit: { limit: 5000, remaining: 4999, resetAt: "2026-07-14T01:00:00Z" }
});
assert.ok(stored);
const status = auth.publicStatus(stored, pending);
assert.equal(status.connected, true);
assert.equal("token" in status, false);
assert.equal(status.pending.userCode, "ABCD-EFGH");
assert.equal(stored.rateLimit.resetAt, "2026-07-14T01:00:00.000Z");

console.log("GitHub auth tests: OK");
