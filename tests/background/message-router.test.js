"use strict";

const assert = require("node:assert/strict");
const messages = require("../../src/shared/messages.js");
const routerModule = require("../../src/background/message-router.js");

const calls = [];
function service(name, methods) {
  const result = {};
  for (const method of methods) {
    result[method] = (...args) => { calls.push([name, method, ...args]); return Promise.resolve({ ok: true, method }); };
  }
  return result;
}
const authService = service("auth", ["publicGitHubAuthStatus", "startGitHubAuthorization", "pollGitHubAuthorization", "disconnectGitHubAuthorization"]);
authService.trustedExtensionSender = (sender) => Boolean(sender?.trusted);
const router = routerModule.create({
  messages,
  authService,
  releaseService: service("release", ["getRelease", "getReleaseByTag"]),
  buildService: service("build", ["getBuildInstructions"]),
  trackingService: service("tracking", [
    "recordDownload", "watchRepository", "unwatchRepository", "getDashboard", "checkAllUpdates",
    "dismissUpdate", "downloadUpdate", "clearHistory", "clearTracking"
  ]),
  navigation: service("navigation", ["openTab", "openOptionsPage"])
});

(async () => {
  assert.equal(router.route({ type: "UNKNOWN" }, {}), null);
  const rejected = await router.route({ type: messages.TYPES.AUTH_STATUS }, {});
  assert.equal(rejected.error, "unauthorized_sender");
  const auth = await router.route({ type: messages.TYPES.AUTH_STATUS, refresh: true }, { trusted: true });
  assert.equal(auth.method, "publicGitHubAuthStatus");
  const release = await router.route({
    type: messages.TYPES.GET_RELEASE_BY_TAG,
    owner: "example",
    repo: "app",
    tag: "v1",
    platform: { os: "linux" }
  }, {});
  assert.equal(release.method, "getReleaseByTag");
  const update = await router.route({ type: messages.TYPES.CHECK_UPDATES }, {});
  assert.equal(update.method, "checkAllUpdates");
  assert.ok(calls.some((entry) => entry[1] === "checkAllUpdates" && entry[2].manual === true));
  console.log("background message-router tests: OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
