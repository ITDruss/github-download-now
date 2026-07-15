"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const syncStore = {
  afterDownload: "always",
  historyEnabled: true,
  notificationsEnabled: false,
  badgeEnabled: true,
  updateCheckInterval: "24h",
  enabled: true
};
const localStore = {};
const listeners = {};
const openedTabs = [];
let badgeText = "";
let currentRelease = 17;
let alarmInfo = null;
let optionsOpened = 0;
let apiRemaining = 60;
let oauthPolls = 0;

function area(store) {
  return {
    get(defaults, callback) { callback({ ...defaults, ...store }); },
    set(values, callback) { Object.assign(store, values); if (callback) callback(); },
    remove(keys, callback) { for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key]; if (callback) callback(); },
    clear(callback) { for (const key of Object.keys(store)) delete store[key]; if (callback) callback(); }
  };
}

global.chrome = {
  runtime: {
    id: "test-extension-id",
    lastError: null,
    getURL: (value) => `chrome-extension://test/${value}`,
    openOptionsPage: () => { optionsOpened += 1; return Promise.resolve(); },
    onMessage: { addListener(fn) { listeners.message = fn; } },
    onInstalled: { addListener(fn) { listeners.installed = fn; } },
    onStartup: { addListener(fn) { listeners.startup = fn; } }
  },
  storage: {
    sync: area(syncStore),
    local: area(localStore),
    onChanged: { addListener(fn) { listeners.storageChanged = fn; } }
  },
  alarms: {
    create(_name, info) { alarmInfo = { name: _name, ...info }; },
    get(_name, callback) { callback(alarmInfo && alarmInfo.name === _name ? alarmInfo : undefined); },
    clear(_name, callback) { const existed = Boolean(alarmInfo && alarmInfo.name === _name); alarmInfo = null; if (callback) callback(existed); },
    onAlarm: { addListener(fn) { listeners.alarm = fn; } }
  },
  action: {
    setBadgeText({ text }) { badgeText = text; return Promise.resolve(); },
    setBadgeBackgroundColor() { return Promise.resolve(); },
    setTitle() { return Promise.resolve(); }
  },
  permissions: { contains(_value, callback) { callback(false); } },
  notifications: {
    create(_id, _options, callback) { if (callback) callback(); },
    onClicked: { addListener(fn) { listeners.notification = fn; } }
  },
  tabs: { create({ url }, callback) { openedTabs.push(url); if (callback) callback({ id: openedTabs.length }); } }
};

global.GHDNSettings = require("../src/settings.js");
global.GHDNUrlPolicy = require("../src/url-policy.js");
global.GHDNAssetSelector = require("../src/asset-selector.js");
global.GHDNTracker = require("../src/tracker.js");
global.GHDNBuildInstructions = require("../src/build-instructions.js");
global.GHDNGitHubAuth = require("../src/github-auth.js");

function response(body, status = 200, extraHeaders = {}) {
  apiRemaining = Math.max(0, apiRemaining - 1);
  return new Response(body, {
    status,
    headers: {
      "content-type": typeof body === "string" && !body.trim().startsWith("{") && !body.trim().startsWith("[")
        ? "text/plain"
        : "application/json",
      "x-ratelimit-limit": "60",
      "x-ratelimit-remaining": String(apiRemaining),
      "x-ratelimit-used": String(60 - apiRemaining),
      "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
      ...extraHeaders
    }
  });
}

global.fetch = async (url, options = {}) => {
  const requestUrl = String(url);
  const apiMatch = requestUrl.match(/\/repos\/([^/]+)\/([^/?#]+)/);
  const owner = apiMatch ? decodeURIComponent(apiMatch[1]) : "example";
  const repo = apiMatch ? decodeURIComponent(apiMatch[2]) : "app";
  const accept = String(options.headers && (options.headers.Accept || options.headers.accept) || "");

  if (requestUrl === "https://github.com/login/device/code") {
    return new Response(JSON.stringify({
      device_code: "dc_abcdefghijklmnopqrstuvwxyz123456",
      user_code: "ABCD-EFGH",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5
    }), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (requestUrl === "https://github.com/login/oauth/access_token") {
    oauthPolls += 1;
    const data = oauthPolls === 1
      ? { error: "authorization_pending" }
      : { access_token: "gho_abcdefghijklmnopqrstuvwxyz1234567890", token_type: "bearer", scope: "" };
    return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
  }
  if (requestUrl === "https://api.github.com/rate_limit") {
    return response(JSON.stringify({ resources: { core: { limit: 5000, remaining: 4998, reset: Math.floor(Date.now() / 1000) + 3600 } } }), 200, { "x-ratelimit-limit": "5000", "x-ratelimit-remaining": "4998" });
  }

  if (owner === "OHF-Voice" && repo === "piper1-gpl" && requestUrl.includes("/contents/libpiper/README.md") && accept.includes("raw")) {
    return response("# Piper C/C++ API\n\n## Building\n\n```sh\ncmake -Bbuild\n```\n");
  }
  if (owner === "OHF-Voice" && repo === "piper1-gpl" && /\/contents\/libpiper(?:\?|$)/.test(requestUrl)) {
    return response(JSON.stringify([{
      type: "file", name: "README.md", path: "libpiper/README.md",
      html_url: "https://github.com/OHF-Voice/piper1-gpl/blob/v1.4.2/libpiper/README.md"
    }]));
  }
  if (owner === "OHF-Voice" && repo === "piper1-gpl" && requestUrl.includes("/contents/README.md") && accept.includes("raw")) {
    return response("# Piper\n\n* [C/C++ API][libpiper]\n* [Building manually][building]\n\n[libpiper]: https://github.com/OHF-Voice/piper1-gpl/tree/main/libpiper\n[building]: https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/BUILDING.md\n");
  }
  if (owner === "OHF-Voice" && repo === "piper1-gpl" && /\/contents(?:\?|$)/.test(requestUrl)) {
    return response(JSON.stringify([{
      type: "file", name: "README.md", path: "README.md",
      html_url: "https://github.com/OHF-Voice/piper1-gpl/blob/v1.4.2/README.md"
    }]));
  }

  if (owner === "malformed") {
    return new Response("not-json", { status: 200, headers: { "content-type": "application/json" } });
  }
  if (owner === "badrelease") {
    return new Response(JSON.stringify({ id: 9, assets: [] }), { status: 200, headers: { "content-type": "application/json" } });
  }

  if (requestUrl.includes("/contents/README.md") && accept.includes("raw")) {
    return response(`# ${repo}\n\n## Getting Started\nInstall prerequisites.\n\n## Building\n\n### Linux\nBuild for Linux.\n\n### Android\nBuild for Android.\n`);
  }
  if (requestUrl.includes("/contents/docs")) {
    return response(JSON.stringify([
      {
        type: "file",
        name: "INSTALL.md",
        path: "docs/INSTALL.md",
        html_url: `https://github.com/${owner}/${repo}/blob/v1.17.0/docs/INSTALL.md`
      }
    ]));
  }
  if (requestUrl.includes("/contents")) {
    return response(JSON.stringify([
      {
        type: "file",
        name: "README.md",
        path: "README.md",
        html_url: `https://github.com/${owner}/${repo}/blob/v1.17.0/README.md`
      },
      {
        type: "file",
        name: "CONTRIBUTING.md",
        path: "CONTRIBUTING.md",
        html_url: `https://github.com/${owner}/${repo}/blob/v1.17.0/CONTRIBUTING.md`
      },
      { type: "dir", name: "docs", path: "docs" }
    ]));
  }

  const tagMatch = requestUrl.match(/\/releases\/tags\/([^?#]+)/);
  const tag = tagMatch ? decodeURIComponent(tagMatch[1]) : `v1.${currentRelease}.0`;
  const releaseNumber = Number((tag.match(/(\d+)(?!.*\d)/) || [])[1]) || currentRelease;
  const release = {
    id: releaseNumber,
    tag_name: tag,
    name: `Release ${tag}`,
    html_url: `https://github.com/${owner}/${repo}/releases/tag/${tag}`,
    published_at: "2026-07-13T00:00:00Z",
    created_at: "2026-07-13T00:00:00Z",
    draft: false,
    prerelease: false,
    assets: [{
      id: releaseNumber * 10,
      name: `${repo}-${tag}-linux-x86_64.AppImage`,
      size: 1000,
      state: "uploaded",
      content_type: "application/octet-stream",
      download_count: 100,
      browser_download_url: `https://github.com/${owner}/${repo}/releases/download/${tag}/${repo}.AppImage`,
      created_at: "2026-07-13T00:00:00Z",
      updated_at: "2026-07-13T00:00:00Z"
    }],
    zipball_url: `https://api.github.com/repos/${owner}/${repo}/zipball/${tag}`,
    tarball_url: `https://api.github.com/repos/${owner}/${repo}/tarball/${tag}`
  };
  if (owner === "crosstag") {
    release.assets[0].browser_download_url = `https://github.com/${owner}/${repo}/releases/download/v9.9.9/${repo}.AppImage`;
  }
  if (owner === "missingheaders") {
    return new Response(JSON.stringify(release), {
      status: 200,
      headers: { "content-type": "application/json", etag: `"${owner}-${repo}-${tag}"` }
    });
  }
  return response(JSON.stringify(release), 200, { etag: `"${owner}-${repo}-${tag}"` });
};

require(path.join("..", "src", "background.js"));

function message(payload, sender = { tab: { incognito: false } }) {
  return new Promise((resolve, reject) => {
    const keepAlive = listeners.message(payload, sender, resolve);
    if (!keepAlive && !String(payload.type).startsWith("GHDN_AUTH_")) reject(new Error(`Message not handled: ${payload.type}`));
  });
}

const extensionSender = { id: "test-extension-id", url: "chrome-extension://test/options.html" };

function download(owner = "example", repo = "app", release = 17) {
  const tag = `v1.${release}.0`;
  return {
    owner, repo, releaseId: release, releaseTag: tag, releaseName: `Release ${tag}`,
    releaseUrl: `https://github.com/${owner}/${repo}/releases/tag/${tag}`,
    releasePublishedAt: "2026-07-12T00:00:00Z",
    assetId: release * 10, assetName: `${repo}-${tag}-linux-x86_64.AppImage`,
    assetUrl: `https://github.com/${owner}/${repo}/releases/download/${tag}/${repo}.AppImage`,
    assetExtension: ".appimage", assetSize: 1000,
    platform: { os: "linux", arch: "x64", preferredFormat: "appimage" }, releaseChannel: "stable"
  };
}

(async () => {
  const buildResult = await message({
    type: "GHDN_GET_BUILD_INSTRUCTIONS",
    owner: "example",
    repo: "app",
    ref: "v1.17.0",
    platform: { os: "linux" }
  });
  assert.equal(buildResult.ok, true);
  assert.equal(buildResult.found, true);
  assert.equal(buildResult.recommended.title, "Building → Linux");
  assert.equal(buildResult.recommended.htmlUrl, "https://github.com/example/app/blob/v1.17.0/README.md#linux");
  assert.ok(buildResult.documents.some((document) => document.path === "docs/INSTALL.md"));
  assert.equal("instructions" in buildResult, false);

  const piperBuild = await message({
    type: "GHDN_GET_BUILD_INSTRUCTIONS",
    owner: "OHF-Voice",
    repo: "piper1-gpl",
    ref: "v1.4.2",
    platform: { os: "linux" }
  });
  assert.equal(piperBuild.ok, true);
  assert.ok(piperBuild.documents.some((document) => document.path === "libpiper/README.md" && document.title.includes("Building")));
  assert.ok(piperBuild.checked.includes("libpiper/README.md"));
  assert.equal(piperBuild.guidedDiscovery.directoriesChecked, 1);

  const taggedRelease = await message({
    type: "GHDN_GET_RELEASE_BY_TAG",
    owner: "example",
    repo: "app",
    tag: "v1.16.0",
    platform: { os: "linux", arch: "x64", preferredFormat: "appimage" }
  });
  assert.equal(taggedRelease.ok, true);
  assert.equal(taggedRelease.release.tag_name, "v1.16.0");

  const noHeaders = await message({
    type: "GHDN_GET_LATEST_RELEASE",
    owner: "missingheaders",
    repo: "app",
    platform: { os: "linux", arch: "x64", preferredFormat: "appimage" },
    releaseChannel: "stable"
  });
  assert.equal(noHeaders.ok, true);
  assert.equal(noHeaders.rateLimit.limit, null);
  assert.equal(noHeaders.rateLimit.remaining, null);

  const malformed = await message({
    type: "GHDN_GET_LATEST_RELEASE",
    owner: "malformed",
    repo: "app",
    platform: { os: "linux", arch: "x64" },
    releaseChannel: "stable"
  });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.error, "invalid_response");

  const badRelease = await message({
    type: "GHDN_GET_LATEST_RELEASE",
    owner: "badrelease",
    repo: "app",
    platform: { os: "linux", arch: "x64" },
    releaseChannel: "stable"
  });
  assert.equal(badRelease.ok, false);
  assert.equal(badRelease.error, "invalid_response");

  const crossTag = await message({
    type: "GHDN_GET_RELEASE_BY_TAG",
    owner: "crosstag",
    repo: "app",
    tag: "v1.16.0",
    platform: { os: "linux", arch: "x64", preferredFormat: "appimage" }
  });
  assert.equal(crossTag.ok, true);
  assert.equal(crossTag.release.assets.length, 0);
  assert.equal(crossTag.recommendation.best, null);

  const rejectedAuth = await message({ type: "GHDN_AUTH_STATUS" });
  assert.equal(rejectedAuth.ok, false);
  assert.equal(rejectedAuth.error, "unauthorized_sender");

  const authStart = await message({ type: "GHDN_AUTH_START" }, extensionSender);
  assert.equal(authStart.ok, true);
  assert.equal(authStart.pending.userCode, "ABCD-EFGH");
  assert.ok(openedTabs.includes("https://github.com/login/device"));
  const waiting = await message({ type: "GHDN_AUTH_POLL" }, extensionSender);
  assert.equal(waiting.ok, true);
  assert.equal(waiting.connected, false);
  localStore.ghdnGithubAuthPendingV1.nextPollAt = 0;
  const connected = await message({ type: "GHDN_AUTH_POLL" }, extensionSender);
  assert.equal(connected.ok, true);
  assert.equal(connected.connected, true);
  assert.equal("token" in connected, false);
  assert.ok(localStore.ghdnGithubAuthV1.token.startsWith("gho_"));
  const disconnected = await message({ type: "GHDN_AUTH_DISCONNECT" }, extensionSender);
  assert.equal(disconnected.connected, false);
  assert.equal(localStore.ghdnGithubAuthV1, undefined);

  const optionsResult = await message({ type: "GHDN_OPEN_OPTIONS" });
  assert.equal(optionsResult.ok, true);
  assert.equal(optionsOpened, 1);

  const rejected = await message({
    type: "GHDN_RECORD_DOWNLOAD",
    download: { ...download(), assetUrl: "https://evil.example/example/app/releases/download/v1.17.0/evil.AppImage" }
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error, "invalid_download");

  const wrongReleaseTag = await message({
    type: "GHDN_RECORD_DOWNLOAD",
    download: { ...download(), releaseUrl: "https://github.com/example/app/releases/tag/v9.9.9" }
  });
  assert.equal(wrongReleaseTag.ok, false);
  assert.equal(wrongReleaseTag.error, "invalid_download");

  const wrongAssetTag = await message({
    type: "GHDN_RECORD_DOWNLOAD",
    download: { ...download(), assetUrl: "https://github.com/example/app/releases/download/v9.9.9/app.AppImage" }
  });
  assert.equal(wrongAssetTag.ok, false);
  assert.equal(wrongAssetTag.error, "invalid_download");

  for (let index = 0; index < 10; index += 1) {
    const recorded = await message({
      type: "GHDN_RECORD_DOWNLOAD",
      download: download(`owner${index}`, `app${index}`)
    });
    assert.equal(recorded.ok, true);
  }

  let dashboard = await message({ type: "GHDN_GET_DASHBOARD" });
  assert.equal(dashboard.watches.length, 10);
  currentRelease = 18;
  const checked = await message({ type: "GHDN_CHECK_UPDATES" });
  assert.equal(checked.checked, 8);
  assert.equal(checked.total, 10);
  assert.equal(checked.meta.lastCheckChecked, 8);
  assert.equal(checked.meta.watchCursor, 8);
  assert.ok(checked.meta.apiRateLimitRemaining < 60);

  dashboard = await message({ type: "GHDN_GET_DASHBOARD" });
  assert.equal(dashboard.updates.length, 8);
  assert.equal(badgeText, "8");

  const key = dashboard.updates[0].key;
  const downloaded = await message({ type: "GHDN_DOWNLOAD_UPDATE", key });
  assert.equal(downloaded.ok, true);
  assert.ok(openedTabs[0].startsWith("https://github.com/"));

  const badOpen = await message({ type: "GHDN_OPEN_URL", url: "https://evil.example/" });
  assert.equal(badOpen.ok, false);
  assert.equal(badOpen.error, "untrusted_url");

  console.log("background update flow tests: OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
