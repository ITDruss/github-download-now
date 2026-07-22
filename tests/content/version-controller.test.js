"use strict";

const assert = require("node:assert/strict");
const stateApi = require("../../src/content/state.js");
const controllerApi = require("../../src/content/release/version-controller.js");

(async () => {
  const state = stateApi.create();
  const repo = { owner: "owner", repo: "repo", key: "owner/repo" };
  const calls = [];
  const loading = [];
  const loaded = [];
  let releaseResolver;
  const firstResponse = new Promise((resolve) => { releaseResolver = resolve; });
  let callNumber = 0;

  const controller = controllerApi.create({
    state,
    getRepository: () => repo,
    getPlatform: async () => ({ os: "linux", arch: "x64" }),
    getReleaseChannel: () => "stable",
    getMountedReleaseTag: () => "v2",
    releaseLoader: {
      getReleaseTags: async () => ["v2", "v1"],
      async load(options) {
        calls.push(options);
        callNumber += 1;
        if (callNumber === 1) return firstResponse;
        return { ok: true, release: { tag_name: options.requestedTag } };
      }
    },
    onLoading: (value) => loading.push(value),
    onLoaded: (response, platform) => loaded.push({ response, platform })
  });

  assert.equal(controller.setContext("owner/repo:v2", ""), true);
  const one = controller.load();
  const two = controller.load();
  await Promise.resolve();
  assert.equal(calls.length, 1, "concurrent loads share one request");
  releaseResolver({ ok: true, release: { tag_name: "v2" } });
  const [first, second] = await Promise.all([one, two]);
  assert.deepEqual(second, first);
  assert.equal(first.response.release.tag_name, "v2");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].requestedTag, "v2");
  assert.deepEqual(loading, [true, false]);
  assert.equal(loaded.length, 1);

  assert.deepEqual(await controller.getReleaseTags(repo), ["v2", "v1"]);
  const selected = await controller.select("v1");
  assert.equal(selected.response.release.tag_name, "v1");
  assert.equal(controller.selectedTag(), "v1");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].requestedTag, "v1");

  controller.resetAll();
  assert.equal(controller.selectedTag(), "");
  assert.equal(state.releaseState, null);

  const raceState = stateApi.create();
  raceState.resetContext("owner/repo:latest", "v1");
  const pending = [];
  const raceLoaded = [];
  const raceController = controllerApi.create({
    state: raceState,
    getRepository: () => repo,
    getPlatform: async () => ({ os: "linux" }),
    getMountedReleaseTag: () => "",
    releaseLoader: {
      getReleaseTags: async () => [],
      load(options) {
        return new Promise((resolve) => {
          pending.push({ options, resolve });
        });
      }
    },
    onLoaded: (response) => raceLoaded.push(response.release.tag_name)
  });

  const staleLoad = raceController.load();
  await Promise.resolve();
  const currentLoad = raceController.select("v2");
  await Promise.resolve();
  assert.equal(pending.length, 2);
  pending[0].resolve({ ok: true, release: { tag_name: "v1" } });
  pending[1].resolve({ ok: true, release: { tag_name: "v2" } });
  const [, currentResult] = await Promise.all([staleLoad, currentLoad]);
  assert.equal(currentResult.response.release.tag_name, "v2");
  assert.equal(raceState.releaseState.response.release.tag_name, "v2");
  assert.deepEqual(raceLoaded, ["v2"], "superseded loads must not update presentation state");

  console.log("version controller tests: OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
