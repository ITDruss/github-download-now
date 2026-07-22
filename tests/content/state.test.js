"use strict";

const assert = require("node:assert/strict");
const stateApi = require("../../src/content/state.js");

const state = stateApi.create();
assert.equal(state.revision, 0);
state.releaseState = { response: { ok: true } };
state.releasePromise = Promise.resolve();
state.buildInstructionsState = { key: "old" };
state.buildInstructionsPromise = { key: "old" };
state.detectedPlatformPromise = Promise.resolve({ os: "linux" });

assert.equal(state.resetContext("owner/repo:latest", "v1"), true);
assert.equal(state.activeContextKey, "owner/repo:latest");
assert.equal(state.selectedReleaseTag, "v1");
assert.equal(state.releaseState, null);
assert.equal(state.releasePromise, null);
assert.equal(state.buildInstructionsState, null);
assert.equal(state.buildInstructionsPromise, null);
assert.equal(state.detectedPlatformPromise, null);
assert.equal(state.revision, 1);
assert.equal(state.resetContext("owner/repo:latest", "v2"), false);
assert.equal(state.selectedReleaseTag, "v1");

state.releaseState = { response: { ok: true } };
state.buildInstructionsState = { key: "v1" };
state.detectedPlatformPromise = Promise.resolve({ os: "linux" });
assert.equal(state.selectReleaseTag("v2"), true);
assert.equal(state.selectedReleaseTag, "v2");
assert.equal(state.releaseState, null);
assert.equal(state.buildInstructionsState, null);
assert.ok(state.detectedPlatformPromise);
assert.equal(state.revision, 2);
assert.equal(state.selectReleaseTag("v2"), false);

state.resetAll();
assert.equal(state.activeContextKey, "");
assert.equal(state.selectedReleaseTag, "");
assert.equal(state.detectedPlatformPromise, null);

console.log("content state tests: OK");
