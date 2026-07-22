"use strict";

const assert = require("node:assert/strict");
const mountControllerApi = require("../../src/content/mount-controller.js");

(async () => {
  let existing = null;
  const observed = [];
  const inserted = [];
  const settings = { enabled: false };
  const repo = { owner: "owner", repo: "repo", key: "owner/repo" };
  const targets = [];
  const documentObject = { getElementById: () => existing };
  const repositoryContext = {
    parse: () => repo,
    shouldShow: (_repo, current) => Boolean(current.enabled)
  };
  const placement = {
    findMountTarget() { return targets.shift() || null; },
    insertRoot(root, target) { inserted.push({ root, target }); existing = root; }
  };
  const versionController = {
    resetCount: 0,
    resetAll() { this.resetCount += 1; },
    setContext() { return false; }
  };
  const menuShell = {
    open: false,
    setOpen(value) { this.open = value; },
    installCloseListeners() {},
    ensure: () => ({ hidden: true }),
    position() {}
  };
  const lifecycle = { observeLayoutHost: (value) => observed.push(value) };
  const downloadButton = {
    createRoot(target) {
      return {
        dataset: { placement: target.mode, releaseTag: target.releaseTag || "" },
        __ghdnLayoutHost: target.element,
        isConnected: true,
        classList: { add() {}, remove() {} },
        remove() { this.removed = true; if (existing === this) existing = null; }
      };
    },
    updatePresentation() {},
    waitForLayout: async () => {},
    applyToolbarDensity: () => false
  };
  const contentState = { releaseState: null };
  const controller = mountControllerApi.create({
    documentObject,
    repositoryContext,
    placement,
    versionController,
    menuShell,
    downloadButton,
    lifecycle,
    actions: {
      getDetectedPlatform: async () => ({ os: "linux" }),
      handlePrimaryClick() {},
      handleMenuClick() {}
    },
    contentState,
    getSettings: () => settings,
    waitForSettings: async () => {},
    rootId: "ghdn-root"
  });

  existing = { remove() { this.removed = true; existing = null; } };
  await controller.refresh();
  assert.equal(existing, null);
  assert.equal(versionController.resetCount, 1);
  assert.equal(observed.at(-1), null);

  settings.enabled = true;
  const toolbarHost = { clientWidth: 500 };
  targets.push({ mode: "toolbar", element: toolbarHost, releaseTag: "" });
  await controller.refresh();
  assert.equal(inserted.length, 1);
  assert.equal(observed.at(-1), null, "missing flow fallback must fail safely");

  const flowHost = {};
  targets.push({ mode: "flow", element: flowHost, releaseTag: "v1" });
  await controller.refresh();
  assert.equal(inserted.at(-1).target.element, flowHost);
  assert.equal(observed.at(-1), flowHost);

  controller.resetToolbarRejection();
  console.log("content mount-controller tests: OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
