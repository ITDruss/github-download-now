"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");

const syncStore = { afterDownload: "always", historyEnabled: true, notificationsEnabled: false, badgeEnabled: true, updateCheckInterval: "24h" };
const localStore = {};
const listeners = {};
const openedTabs = [];
let badgeText = "";
let currentRelease = 17;
let alarmInfo = null;

function area(store) {
  return {
    get(defaults, callback) { callback({ ...defaults, ...store }); },
    set(values, callback) { Object.assign(store, values); if (callback) callback(); },
    clear(callback) { for (const key of Object.keys(store)) delete store[key]; if (callback) callback(); }
  };
}

global.chrome = {
  runtime: {
    lastError: null,
    getURL: (value) => `chrome-extension://test/${value}`,
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
global.GHDNAssetSelector = require("../src/asset-selector.js");
global.GHDNTracker = require("../src/tracker.js");

global.fetch = async () => {
  const tag = `v1.${currentRelease}.0`;
  const release = {
    id: currentRelease,
    tag_name: tag,
    name: `Release ${tag}`,
    html_url: `https://github.com/example/app/releases/tag/${tag}`,
    published_at: "2026-07-13T00:00:00Z",
    created_at: "2026-07-13T00:00:00Z",
    draft: false,
    prerelease: false,
    assets: [{
      id: currentRelease * 10,
      name: `Example-${tag}-linux-x86_64.AppImage`,
      size: 1000,
      state: "uploaded",
      content_type: "application/octet-stream",
      download_count: 100,
      browser_download_url: `https://github.com/example/app/releases/download/${tag}/Example.AppImage`,
      created_at: "2026-07-13T00:00:00Z",
      updated_at: "2026-07-13T00:00:00Z"
    }],
    zipball_url: "https://api.github.com/source.zip",
    tarball_url: "https://api.github.com/source.tar.gz"
  };
  return new Response(JSON.stringify(release), { status: 200, headers: { "content-type": "application/json", "etag": `\"${currentRelease}\"` } });
};

require(path.join("..", "src", "background.js"));

function message(payload) {
  return new Promise((resolve, reject) => {
    const keepAlive = listeners.message(payload, { tab: { incognito: false } }, resolve);
    if (!keepAlive) reject(new Error(`Message not handled: ${payload.type}`));
  });
}

(async () => {
  const first = {
    owner: "example", repo: "app", releaseId: 17, releaseTag: "v1.17.0", releaseName: "Release v1.17.0",
    releaseUrl: "https://github.com/example/app/releases/tag/v1.17.0", releasePublishedAt: "2026-07-12T00:00:00Z",
    assetId: 170, assetName: "Example-v1.17.0-linux-x86_64.AppImage",
    assetUrl: "https://github.com/example/app/releases/download/v1.17.0/Example.AppImage", assetExtension: ".appimage", assetSize: 1000,
    platform: { os: "linux", arch: "x64", preferredFormat: "appimage" }, releaseChannel: "stable"
  };

  const recorded = await message({ type: "GHDN_RECORD_DOWNLOAD", download: first });
  assert.equal(recorded.ok, true);
  assert.equal(recorded.watchState, "watching");

  let dashboard = await message({ type: "GHDN_GET_DASHBOARD" });
  assert.equal(dashboard.history.length, 1);
  assert.equal(dashboard.watches.length, 1);
  assert.equal(dashboard.updates.length, 0);

  currentRelease = 18;
  const checked = await message({ type: "GHDN_CHECK_UPDATES" });
  assert.equal(checked.detected.length, 1);
  dashboard = await message({ type: "GHDN_GET_DASHBOARD" });
  assert.equal(dashboard.updates.length, 1);
  assert.equal(dashboard.updates[0].releaseTag, "v1.18.0");
  assert.equal(badgeText, "1");

  const downloaded = await message({ type: "GHDN_DOWNLOAD_UPDATE", key: "example/app" });
  assert.equal(downloaded.ok, true);
  dashboard = await message({ type: "GHDN_GET_DASHBOARD" });
  assert.equal(dashboard.history.length, 2);
  assert.equal(dashboard.updates.length, 0);
  assert.equal(dashboard.watches[0].currentReleaseId, 18);
  assert.ok(openedTabs[0].includes("v1.18.0"));
  assert.equal(badgeText, "");

  console.log("background update flow tests: OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
