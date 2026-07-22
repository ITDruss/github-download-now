"use strict";

const assert = require("node:assert/strict");
const actionsApi = require("../../src/content/actions.js");

(async () => {
  const messages = {
    TYPES: {
      GET_BUILD_INSTRUCTIONS: "BUILD",
      OPEN_OPTIONS: "OPTIONS",
      RECORD_DOWNLOAD: "RECORD"
    }
  };
  const repo = { owner: "owner", repo: "project", key: "owner/project" };
  const sent = [];
  let optionsFallbackOpened = "";
  const anchors = [];
  const notices = [];
  const contentState = {
    detectedPlatformPromise: null,
    buildInstructionsState: null,
    buildInstructionsPromise: null
  };
  let buildResolver;
  const buildResponse = new Promise((resolve) => { buildResolver = resolve; });
  const runtime = {
    sendMessage(message) {
      sent.push(message);
      if (message.type === messages.TYPES.OPEN_OPTIONS) return Promise.reject(new Error("background unavailable"));
      if (message.type === messages.TYPES.GET_BUILD_INSTRUCTIONS) return buildResponse;
      return Promise.resolve({ ok: true, watchState: "prompt" });
    }
  };
  const documentObject = {
    body: { append(node) { anchors.push(node); } },
    createElement() {
      return {
        href: "",
        rel: "",
        clicked: false,
        removed: false,
        click() { this.clicked = true; },
        remove() { this.removed = true; }
      };
    },
    getElementById() { return {}; }
  };
  const urlPolicy = {
    repositoryWebUrl(value) {
      return String(value).startsWith("https://github.com/owner/project") ? { href: String(value) } : null;
    },
    releaseAsset(value, owner, project, tag) {
      return owner === "owner" && project === "project" && tag === "v2" ? { href: String(value) } : null;
    },
    download(value) { return { href: String(value) }; }
  };
  const platform = {
    detect: async () => ({ os: "linux", arch: "x64" }),
    isReleaseStale: () => false
  };
  const settings = {
    releaseChannel: "stable",
    installGuidance: "beginner",
    primaryAction: "download"
  };
  const actions = actionsApi.create({
    documentObject,
    windowObject: {
      open(url) { optionsFallbackOpened = url; }
    },
    extensionApi: { runtime: { getURL: (path) => `chrome-extension://id/${path}` } },
    runtime,
    messages,
    selector: { detectExtension: () => "AppImage" },
    urlPolicy,
    repositoryContext: { parse: () => repo },
    versionController: { load: async () => ({ response: { ok: false }, platform: {} }) },
    releaseMenu: { render() {} },
    menuShell: { setOpen() {}, ensure: () => ({ hidden: true }) },
    notices: {
      showToast(message, type) { notices.push({ message, type }); },
      showWatchPrompt(download) { notices.push({ download, type: "watch" }); },
      showResponseError() {}
    },
    installGuidance: {
      guideForAsset: () => ({ id: "appimage" }),
      showPrompt(guide) { notices.push({ guide, type: "guide" }); }
    },
    contentState,
    platform,
    getSettings: () => settings,
    getStrings: () => ({ networkError: "Network error", watchingUpdated: "Watching" })
  });

  const record = actions.createDownloadRecord(
    repo,
    { id: 7, name: "App.AppImage", browser_download_url: "https://github.com/owner/project/releases/download/v2/App.AppImage", size: 12 },
    { id: 9, tag_name: "v2", name: "Version 2", html_url: "https://github.com/owner/project/releases/tag/v2", published_at: "2026-01-01", prerelease: false },
    { os: "linux", arch: "x64" },
    settings
  );
  assert.equal(record.assetExtension, "AppImage");
  assert.equal(record.releaseChannel, "stable");

  const asset = {
    id: 7,
    name: "App.AppImage",
    browser_download_url: "https://github.com/owner/project/releases/download/v2/App.AppImage",
    size: 12
  };
  const release = {
    id: 9,
    tag_name: "v2",
    name: "Version 2",
    html_url: "https://github.com/owner/project/releases/tag/v2",
    published_at: "2026-01-01",
    prerelease: false
  };
  await actions.startDownload(asset.browser_download_url, asset, release, { os: "linux", arch: "x64" });
  assert.equal(anchors.length, 1);
  assert.equal(anchors[0].clicked, true);
  assert.equal(anchors[0].removed, true);
  assert.equal(sent.at(-1).type, messages.TYPES.RECORD_DOWNLOAD);
  assert.ok(notices.some((entry) => entry.type === "guide"));
  assert.ok(notices.some((entry) => entry.type === "watch"));

  const buildCallsBefore = sent.filter((message) => message.type === messages.TYPES.GET_BUILD_INSTRUCTIONS).length;
  const firstBuild = actions.loadBuildInstructions(release);
  const secondBuild = actions.loadBuildInstructions(release);
  await Promise.resolve();
  await Promise.resolve();
  const buildCallsAfter = sent.filter((message) => message.type === messages.TYPES.GET_BUILD_INSTRUCTIONS).length;
  assert.equal(buildCallsAfter - buildCallsBefore, 1, "build-document loads must be deduplicated");
  buildResolver({ ok: true, found: true });
  assert.deepEqual(await firstBuild, { ok: true, found: true });
  assert.deepEqual(await secondBuild, { ok: true, found: true });
  assert.equal((await actions.loadBuildInstructions(release)).found, true);

  await actions.requestOpenOptions();
  assert.equal(optionsFallbackOpened, "chrome-extension://id/options.html");

  actions.openExternal("https://evil.example/file");
  assert.ok(notices.some((entry) => entry.type === "error"));

  console.log("content actions tests: OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
