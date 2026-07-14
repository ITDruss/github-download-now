"use strict";

if (typeof importScripts === "function") {
  if (!globalThis.GHDNSettings) importScripts("settings.js");
  if (!globalThis.GHDNAssetSelector) importScripts("asset-selector.js");
  if (!globalThis.GHDNTracker) importScripts("tracker.js");
  if (!globalThis.GHDNBuildInstructions) importScripts("build-instructions.js");
}

const extensionApi = typeof browser !== "undefined" ? browser : chrome;
const settingsApi = globalThis.GHDNSettings;
const selector = globalThis.GHDNAssetSelector;
const tracker = globalThis.GHDNTracker;
const buildInstructions = globalThis.GHDNBuildInstructions;
const CACHE_TTL_MS = 5 * 60 * 1000;
const releaseCache = new Map();
const buildInstructionsCache = new Map();
const BUILD_CACHE_TTL_MS = 60 * 60 * 1000;
const VALID_PART = /^[A-Za-z0-9_.-]{1,100}$/;
const UPDATE_ALARM = "ghdn-update-check";
const NOTIFICATION_PREFIX = "ghdn-update:";
const SUMMARY_NOTIFICATION = "ghdn-updates-summary";
const INTERVAL_MINUTES = Object.freeze({ "6h": 360, "24h": 1440, "72h": 4320, "168h": 10080 });

function sanitizeAsset(asset) {
  return {
    id: asset.id,
    name: asset.name,
    size: asset.size,
    state: asset.state,
    content_type: asset.content_type,
    download_count: asset.download_count,
    browser_download_url: asset.browser_download_url,
    created_at: asset.created_at,
    updated_at: asset.updated_at
  };
}

function sanitizeRelease(release) {
  return {
    id: release.id,
    tag_name: release.tag_name,
    name: release.name,
    html_url: release.html_url,
    published_at: release.published_at,
    created_at: release.created_at,
    draft: Boolean(release.draft),
    prerelease: Boolean(release.prerelease),
    assets: Array.isArray(release.assets) ? release.assets.map(sanitizeAsset) : [],
    zipball_url: release.zipball_url,
    tarball_url: release.tarball_url
  };
}

function rateLimitDetails(response) {
  const remaining = response.headers.get("x-ratelimit-remaining");
  const resetRaw = response.headers.get("x-ratelimit-reset");
  const resetAt = resetRaw ? new Date(Number(resetRaw) * 1000).toISOString() : null;
  return { remaining, resetAt };
}

async function fetchJson(url, options = {}) {
  const headers = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (options.etag) headers["If-None-Match"] = options.etag;

  const response = await fetch(url, { method: "GET", headers });
  if (response.status === 304) {
    return { ok: true, notModified: true, etag: options.etag || response.headers.get("etag") || "" };
  }

  if (!response.ok) {
    const limits = rateLimitDetails(response);
    if (response.status === 404) return { ok: false, error: "no_release", status: 404 };
    if ((response.status === 403 || response.status === 429) && (limits.remaining === "0" || response.status === 429)) {
      return { ok: false, error: "rate_limited", status: response.status, resetAt: limits.resetAt };
    }
    return { ok: false, error: "github_api_error", status: response.status };
  }

  return { ok: true, data: await response.json(), etag: response.headers.get("etag") || "" };
}

async function getRelease(owner, repo, platform, releaseChannel, options = {}) {
  if (!VALID_PART.test(owner) || !VALID_PART.test(repo)) return { ok: false, error: "invalid_repository" };

  const channel = releaseChannel === "newest" ? "newest" : "stable";
  const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}:${channel}`;
  const cached = releaseCache.get(cacheKey);
  if (!options.force && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return buildResponse(cached.release, platform, true, cached.etag);
  }

  const encoded = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const url = channel === "newest"
    ? `https://api.github.com/repos/${encoded}/releases?per_page=20`
    : `https://api.github.com/repos/${encoded}/releases/latest`;
  const result = await fetchJson(url, { etag: options.etag });
  if (!result.ok || result.notModified) return result;

  let release;
  if (channel === "newest") {
    const candidates = Array.isArray(result.data) ? result.data.filter((item) => item && !item.draft) : [];
    if (!candidates.length) return { ok: false, error: "no_release", status: 404 };
    release = sanitizeRelease(candidates[0]);
  } else {
    release = sanitizeRelease(result.data);
  }

  releaseCache.set(cacheKey, { timestamp: Date.now(), release, etag: result.etag || "" });
  return buildResponse(release, platform, false, result.etag || "");
}

function buildResponse(release, platform, fromCache, etag = "") {
  const selection = selector.recommendation(release.assets, platform || {});
  return {
    ok: true,
    release,
    rankedAssets: selection.ranked,
    recommendation: {
      best: selection.best,
      confidence: selection.confidence,
      gap: Number.isFinite(selection.gap) ? selection.gap : null
    },
    fromCache,
    etag
  };
}


async function fetchText(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Accept": "application/vnd.github.raw+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (!response.ok) {
    const limits = rateLimitDetails(response);
    if (response.status === 404) return { ok: false, error: "not_found", status: 404 };
    if ((response.status === 403 || response.status === 429) && (limits.remaining === "0" || response.status === 429)) {
      return { ok: false, error: "rate_limited", status: response.status, resetAt: limits.resetAt };
    }
    return { ok: false, error: "github_api_error", status: response.status };
  }

  return { ok: true, text: await response.text() };
}

function validGitRef(value) {
  const ref = String(value || "").trim();
  if (!ref) return "";
  if (ref.length > 240 || /[\u0000-\u001f\u007f]/.test(ref)) return null;
  return ref;
}

function contentsUrl(owner, repo, path = "", ref = "") {
  const encodedRepository = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const encodedPath = String(path || "")
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  const suffix = encodedPath ? `/contents/${encodedPath}` : "/contents";
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  return `https://api.github.com/repos/${encodedRepository}${suffix}${query}`;
}

function sanitizeContentEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const type = entry.type === "dir" ? "dir" : entry.type === "file" ? "file" : "";
  const path = String(entry.path || entry.name || "").replace(/^\/+|\/+$/g, "");
  if (!type || !path || path.length > 500) return null;
  return {
    type,
    name: String(entry.name || path.split("/").pop() || ""),
    path,
    html_url: /^https:\/\/github\.com\//i.test(String(entry.html_url || "")) ? String(entry.html_url) : ""
  };
}

async function getContentDirectory(owner, repo, path, ref) {
  const result = await fetchJson(contentsUrl(owner, repo, path, ref));
  if (!result.ok) return result;
  const entries = Array.isArray(result.data)
    ? result.data.map(sanitizeContentEntry).filter(Boolean)
    : [];
  return { ok: true, entries };
}

async function readInstructionCandidate(owner, repo, candidate, ref) {
  const result = await fetchText(contentsUrl(owner, repo, candidate.path, ref));
  if (!result.ok) return result;
  const extracted = buildInstructions.extractFromMarkdown(result.text, {
    path: candidate.path,
    htmlUrl: candidate.html_url
  });
  return { ok: true, extracted };
}

async function getBuildInstructions(owner, repo, requestedRef = "") {
  if (!VALID_PART.test(owner) || !VALID_PART.test(repo)) {
    return { ok: false, error: "invalid_repository" };
  }
  if (!buildInstructions) return { ok: false, error: "internal_error" };

  const ref = validGitRef(requestedRef);
  if (ref === null) return { ok: false, error: "invalid_ref" };
  const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}:${ref || "default"}`;
  const cached = buildInstructionsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < BUILD_CACHE_TTL_MS) {
    return { ...cached.value, fromCache: true };
  }

  let refUsed = ref;
  let rootResult = await getContentDirectory(owner, repo, "", refUsed);
  let usedDefaultBranchFallback = false;
  if (!rootResult.ok && rootResult.status === 404 && refUsed) {
    refUsed = "";
    usedDefaultBranchFallback = true;
    rootResult = await getContentDirectory(owner, repo, "", "");
  }
  if (!rootResult.ok) return rootResult;

  const checked = [];
  const rootCandidates = buildInstructions.chooseCandidates(rootResult.entries, 2);
  for (const candidate of rootCandidates) {
    checked.push(candidate.path);
    const result = await readInstructionCandidate(owner, repo, candidate, refUsed);
    if (!result.ok) {
      if (result.error === "rate_limited") return result;
      continue;
    }
    if (result.extracted && result.extracted.found) {
      const value = {
        ok: true,
        found: true,
        instructions: result.extracted,
        refRequested: ref,
        refUsed: refUsed || "default",
        usedDefaultBranchFallback,
        checked
      };
      buildInstructionsCache.set(cacheKey, { timestamp: Date.now(), value });
      return value;
    }
  }

  const docsDirectory = rootResult.entries.find((entry) =>
    entry.type === "dir" && /^(docs?|documentation)$/i.test(entry.name)
  );
  if (docsDirectory) {
    const docsResult = await getContentDirectory(owner, repo, docsDirectory.path, refUsed);
    if (docsResult.ok) {
      const docsCandidates = buildInstructions.chooseCandidates(docsResult.entries, 1);
      for (const candidate of docsCandidates) {
        checked.push(candidate.path);
        const result = await readInstructionCandidate(owner, repo, candidate, refUsed);
        if (!result.ok) {
          if (result.error === "rate_limited") return result;
          continue;
        }
        if (result.extracted && result.extracted.found) {
          const value = {
            ok: true,
            found: true,
            instructions: result.extracted,
            refRequested: ref,
            refUsed: refUsed || "default",
            usedDefaultBranchFallback,
            checked
          };
          buildInstructionsCache.set(cacheKey, { timestamp: Date.now(), value });
          return value;
        }
      }
    } else if (docsResult.error === "rate_limited") {
      return docsResult;
    }
  }

  const repositoryUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const value = {
    ok: true,
    found: false,
    repositoryUrl,
    refRequested: ref,
    refUsed: refUsed || "default",
    usedDefaultBranchFallback,
    checked
  };
  buildInstructionsCache.set(cacheKey, { timestamp: Date.now(), value });
  return value;
}

function chromeStorageGet(area, defaults) {
  return new Promise((resolve, reject) => {
    area.get(defaults, (items) => {
      const error = extensionApi.runtime && extensionApi.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(items);
    });
  });
}

function chromeStorageSet(area, values) {
  return new Promise((resolve, reject) => {
    area.set(values, () => {
      const error = extensionApi.runtime && extensionApi.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

async function localGet(defaults) {
  if (typeof browser !== "undefined") return extensionApi.storage.local.get(defaults);
  return chromeStorageGet(extensionApi.storage.local, defaults);
}

async function localSet(values) {
  if (typeof browser !== "undefined") return extensionApi.storage.local.set(values);
  return chromeStorageSet(extensionApi.storage.local, values);
}

async function readTrackerState() {
  const data = await localGet({
    [tracker.HISTORY_KEY]: [],
    [tracker.WATCHES_KEY]: [],
    [tracker.UPDATES_KEY]: [],
    [tracker.META_KEY]: {}
  });
  return {
    history: Array.isArray(data[tracker.HISTORY_KEY]) ? data[tracker.HISTORY_KEY].map(tracker.sanitizeDownload).filter(Boolean) : [],
    watches: Array.isArray(data[tracker.WATCHES_KEY]) ? data[tracker.WATCHES_KEY].map(tracker.sanitizeWatch).filter(Boolean) : [],
    updates: Array.isArray(data[tracker.UPDATES_KEY]) ? data[tracker.UPDATES_KEY].map(tracker.sanitizeUpdate).filter(Boolean) : [],
    meta: data[tracker.META_KEY] && typeof data[tracker.META_KEY] === "object" ? data[tracker.META_KEY] : {}
  };
}

async function writeTrackerState(patch) {
  const values = {};
  if (patch.history) values[tracker.HISTORY_KEY] = patch.history;
  if (patch.watches) values[tracker.WATCHES_KEY] = patch.watches;
  if (patch.updates) values[tracker.UPDATES_KEY] = patch.updates;
  if (patch.meta) values[tracker.META_KEY] = patch.meta;
  if (Object.keys(values).length) await localSet(values);
}

function downloadFromPayload(payload) {
  return tracker.sanitizeDownload({
    ...payload,
    downloadedAt: payload.downloadedAt || new Date().toISOString()
  });
}

async function recordDownload(payload, sender = null) {
  if (sender && sender.tab && sender.tab.incognito) return { ok: true, incognito: true, watchState: "none" };
  const download = downloadFromPayload(payload);
  if (!download) return { ok: false, error: "invalid_download" };

  const settings = await settingsApi.get();
  const state = await readTrackerState();
  let history = state.history;
  let watches = state.watches;
  let updates = state.updates;
  if (settings.historyEnabled) history = tracker.addHistory(history, download);

  const existing = watches.find((item) => item.key === download.key);
  let watchState = "none";
  if (existing || settings.afterDownload === "always") {
    const watch = tracker.watchFromDownload(download, existing);
    watches = tracker.upsertWatch(watches, watch);
    updates = tracker.removeUpdate(updates, download.key);
    watchState = "watching";
  } else if (settings.afterDownload === "ask") {
    watchState = "prompt";
  }

  await writeTrackerState({ history, watches, updates });
  await updateBadge(updates, settings);
  return { ok: true, watchState, download };
}

async function watchRepository(payload) {
  const download = downloadFromPayload(payload);
  if (!download) return { ok: false, error: "invalid_repository" };
  const state = await readTrackerState();
  const existing = state.watches.find((item) => item.key === download.key);
  const watch = tracker.watchFromDownload(download, existing);
  const watches = tracker.upsertWatch(state.watches, watch);
  const updates = tracker.removeUpdate(state.updates, download.key);
  await writeTrackerState({ watches, updates });
  await updateBadge(updates);
  await ensureUpdateAlarm();
  return { ok: true, watch };
}

async function unwatchRepository(key) {
  const state = await readTrackerState();
  const watches = tracker.removeWatch(state.watches, key);
  const updates = tracker.removeUpdate(state.updates, key);
  await writeTrackerState({ watches, updates });
  await updateBadge(updates);
  return { ok: true };
}

function updateFromRelease(watch, response) {
  const release = response.release;
  const best = response.recommendation && response.recommendation.best;
  const compatible = Boolean(best && response.recommendation.confidence !== "low");
  return tracker.sanitizeUpdate({
    key: watch.key,
    owner: watch.owner,
    repo: watch.repo,
    fromReleaseId: watch.currentReleaseId,
    fromTag: watch.currentTag,
    releaseId: release.id,
    releaseTag: release.tag_name,
    releaseName: release.name,
    releaseUrl: release.html_url,
    releasePublishedAt: release.published_at,
    releasePrerelease: release.prerelease,
    assetId: compatible ? best.id : null,
    assetName: compatible ? best.name : "",
    assetUrl: compatible ? best.browser_download_url : "",
    assetExtension: compatible ? (best.extension || selector.detectExtension(best.name)) : "",
    assetSize: compatible ? best.size : 0,
    compatibleAssetFound: compatible,
    detectedAt: new Date().toISOString()
  });
}

async function checkAllUpdates(options = {}) {
  const state = await readTrackerState();
  const settings = await settingsApi.get();
  if (!settings.enabled) {
    return { ok: true, disabled: true, detected: [], errors: [], watches: state.watches, updates: state.updates, meta: state.meta };
  }
  let watches = state.watches.slice();
  let updates = state.updates.slice();
  const detected = [];
  const errors = [];

  for (let index = 0; index < watches.length; index += 1) {
    const watch = watches[index];
    let response;
    try {
      response = await getRelease(watch.owner, watch.repo, watch.platform, watch.releaseChannel, { force: true, etag: watch.etag });
    } catch (_error) {
      errors.push({ key: watch.key, error: "network_error" });
      continue;
    }

    const checkedAt = new Date().toISOString();
    if (response.notModified) {
      watches[index] = tracker.sanitizeWatch({ ...watch, lastCheckedAt: checkedAt });
      continue;
    }
    if (!response.ok) {
      errors.push({ key: watch.key, error: response.error, resetAt: response.resetAt || null });
      watches[index] = tracker.sanitizeWatch({ ...watch, lastCheckedAt: checkedAt });
      if (response.error === "rate_limited") break;
      continue;
    }

    const release = response.release;
    const oldPending = updates.find((item) => item.key === watch.key);
    const isDifferentFromCurrent = Number(release.id) !== Number(watch.currentReleaseId);
    const isNewDetection = isDifferentFromCurrent && (!oldPending || Number(oldPending.releaseId) !== Number(release.id));

    watches[index] = tracker.sanitizeWatch({
      ...watch,
      lastCheckedReleaseId: release.id,
      lastCheckedTag: release.tag_name,
      lastCheckedAt: checkedAt,
      etag: response.etag || watch.etag || "",
      lastNotifiedReleaseId: isNewDetection ? release.id : watch.lastNotifiedReleaseId,
      updatedAt: checkedAt
    });

    if (isDifferentFromCurrent) {
      const pending = updateFromRelease(watch, response);
      updates = tracker.upsertUpdate(updates, pending);
      if (isNewDetection) detected.push(pending);
    } else {
      updates = tracker.removeUpdate(updates, watch.key);
    }
  }

  const meta = {
    ...state.meta,
    lastCheckAt: new Date().toISOString(),
    lastCheckSource: options.manual ? "manual" : "alarm",
    lastCheckErrors: errors.length,
    lastCheckErrorDetails: errors.slice(0, 10)
  };
  await writeTrackerState({ watches, updates, meta });
  await updateBadge(updates, settings);
  if (detected.length) await notifyUpdates(detected, settings);
  return { ok: true, detected, errors, watches, updates, meta };
}

async function dismissUpdate(key) {
  const state = await readTrackerState();
  const update = state.updates.find((item) => item.key === key);
  if (!update) return { ok: false, error: "update_not_found" };
  const watches = state.watches.map((item) => item.key === key ? tracker.sanitizeWatch({
    ...item,
    currentReleaseId: update.releaseId,
    currentTag: update.releaseTag,
    currentPublishedAt: update.releasePublishedAt,
    lastCheckedReleaseId: update.releaseId,
    lastCheckedTag: update.releaseTag,
    updatedAt: new Date().toISOString()
  }) : item);
  const updates = tracker.removeUpdate(state.updates, key);
  await writeTrackerState({ watches, updates });
  await updateBadge(updates);
  return { ok: true };
}

async function downloadUpdate(key) {
  const state = await readTrackerState();
  const update = state.updates.find((item) => item.key === key);
  const watch = state.watches.find((item) => item.key === key);
  if (!update || !watch || !update.assetUrl) return { ok: false, error: "asset_not_found" };

  const download = tracker.sanitizeDownload({
    owner: update.owner,
    repo: update.repo,
    releaseId: update.releaseId,
    releaseTag: update.releaseTag,
    releaseName: update.releaseName,
    releaseUrl: update.releaseUrl,
    releasePublishedAt: update.releasePublishedAt,
    releasePrerelease: update.releasePrerelease,
    assetId: update.assetId,
    assetName: update.assetName,
    assetUrl: update.assetUrl,
    assetExtension: update.assetExtension,
    assetSize: update.assetSize,
    platform: watch.platform,
    releaseChannel: watch.releaseChannel,
    downloadedAt: new Date().toISOString()
  });

  const settings = await settingsApi.get();
  const history = settings.historyEnabled ? tracker.addHistory(state.history, download) : state.history;
  const watches = tracker.upsertWatch(state.watches, tracker.watchFromDownload(download, watch));
  const updates = tracker.removeUpdate(state.updates, key);
  await writeTrackerState({ history, watches, updates });
  await updateBadge(updates, settings);
  await openTab(update.assetUrl);
  return { ok: true };
}

async function getDashboard() {
  const state = await readTrackerState();
  return {
    ok: true,
    history: state.history,
    watches: state.watches,
    updates: state.updates,
    meta: state.meta,
    limits: { history: tracker.MAX_HISTORY, watches: tracker.MAX_WATCHES }
  };
}

async function clearHistory() {
  await writeTrackerState({ history: [] });
  return { ok: true };
}

async function clearTracking() {
  await writeTrackerState({ watches: [], updates: [] });
  await updateBadge([]);
  return { ok: true };
}

async function hasNotificationPermission() {
  if (!extensionApi.permissions || !extensionApi.permissions.contains) return false;
  if (typeof browser !== "undefined") return extensionApi.permissions.contains({ permissions: ["notifications"] });
  return new Promise((resolve) => extensionApi.permissions.contains({ permissions: ["notifications"] }, resolve));
}

async function createNotification(id, options) {
  if (!extensionApi.notifications || !extensionApi.notifications.create) return;
  if (typeof browser !== "undefined") await extensionApi.notifications.create(id, options);
  else await new Promise((resolve) => extensionApi.notifications.create(id, options, resolve));
}

async function notifyUpdates(updates, settings) {
  if (!settings.notificationsEnabled || !updates.length || !(await hasNotificationPermission())) return;
  const iconUrl = extensionApi.runtime.getURL("icons/icon-128.png");
  if (updates.length === 1) {
    const update = updates[0];
    const assetText = update.compatibleAssetFound ? update.assetName : "No matching asset found";
    await createNotification(`${NOTIFICATION_PREFIX}${encodeURIComponent(update.key)}`, {
      type: "basic",
      iconUrl,
      title: `${update.repo} ${update.releaseTag || "new release"}`,
      message: `${update.fromTag || "Previous release"} → ${update.releaseTag || "New release"}\n${assetText}`
    });
    return;
  }
  const names = updates.slice(0, 3).map((item) => item.repo).join(", ");
  const extra = updates.length > 3 ? ` +${updates.length - 3}` : "";
  await createNotification(SUMMARY_NOTIFICATION, {
    type: "basic",
    iconUrl,
    title: `${updates.length} GitHub updates available`,
    message: `${names}${extra}`
  });
}

async function updateBadge(updatesArg = null, settingsArg = null) {
  const action = extensionApi.action || extensionApi.browserAction;
  if (!action || !action.setBadgeText) return;
  const settings = settingsArg || await settingsApi.get();
  const updates = updatesArg || (await readTrackerState()).updates;
  const text = settings.enabled && settings.badgeEnabled && updates.length ? String(Math.min(updates.length, 99)) : "";
  const title = updates.length ? `${updates.length} update${updates.length === 1 ? "" : "s"} available` : "GitHub Download Now";
  try {
    await action.setBadgeText({ text });
    if (action.setBadgeBackgroundColor) await action.setBadgeBackgroundColor({ color: "#1f883d" });
    if (action.setTitle) await action.setTitle({ title });
  } catch (_error) {}
}

async function openTab(url) {
  if (!url || !/^https?:\/\//i.test(url)) return;
  if (typeof browser !== "undefined") await extensionApi.tabs.create({ url });
  else await new Promise((resolve) => extensionApi.tabs.create({ url }, resolve));
}

async function getAlarm(name) {
  if (!extensionApi.alarms || !extensionApi.alarms.get) return null;
  if (typeof browser !== "undefined") return extensionApi.alarms.get(name);
  return new Promise((resolve) => extensionApi.alarms.get(name, resolve));
}

async function clearAlarm(name) {
  if (!extensionApi.alarms || !extensionApi.alarms.clear) return false;
  if (typeof browser !== "undefined") return extensionApi.alarms.clear(name);
  return new Promise((resolve) => extensionApi.alarms.clear(name, resolve));
}

async function createAlarm(name, alarmInfo) {
  if (!extensionApi.alarms || !extensionApi.alarms.create) return;
  extensionApi.alarms.create(name, alarmInfo);
}

async function ensureUpdateAlarm() {
  if (!extensionApi.alarms || !extensionApi.alarms.create) return;
  const settings = await settingsApi.get();
  const periodInMinutes = settings.enabled ? INTERVAL_MINUTES[settings.updateCheckInterval] : 0;
  const existing = await getAlarm(UPDATE_ALARM);

  if (!periodInMinutes) {
    if (existing) await clearAlarm(UPDATE_ALARM);
    return;
  }

  if (existing && Number(existing.periodInMinutes) === periodInMinutes) return;
  if (existing) await clearAlarm(UPDATE_ALARM);
  await createAlarm(UPDATE_ALARM, { delayInMinutes: Math.min(5, periodInMinutes), periodInMinutes });
}

async function initializeBackground() {
  await ensureUpdateAlarm();
  await updateBadge();
}

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return false;
  let operation;
  switch (message.type) {
    case "GHDN_GET_LATEST_RELEASE":
      operation = getRelease(message.owner, message.repo, message.platform, message.releaseChannel);
      break;
    case "GHDN_GET_BUILD_INSTRUCTIONS":
      operation = getBuildInstructions(message.owner, message.repo, message.ref);
      break;
    case "GHDN_RECORD_DOWNLOAD":
      operation = recordDownload(message.download, sender);
      break;
    case "GHDN_WATCH_REPOSITORY":
      operation = watchRepository(message.download);
      break;
    case "GHDN_UNWATCH_REPOSITORY":
      operation = unwatchRepository(message.key);
      break;
    case "GHDN_GET_DASHBOARD":
      operation = getDashboard();
      break;
    case "GHDN_CHECK_UPDATES":
      operation = checkAllUpdates({ manual: true });
      break;
    case "GHDN_DISMISS_UPDATE":
      operation = dismissUpdate(message.key);
      break;
    case "GHDN_DOWNLOAD_UPDATE":
      operation = downloadUpdate(message.key);
      break;
    case "GHDN_OPEN_URL":
      operation = openTab(message.url).then(() => ({ ok: true }));
      break;
    case "GHDN_CLEAR_HISTORY":
      operation = clearHistory();
      break;
    case "GHDN_CLEAR_TRACKING":
      operation = clearTracking();
      break;
    default:
      return false;
  }

  Promise.resolve(operation)
    .then(sendResponse)
    .catch((error) => {
      console.error("GitHub Download Now:", error);
      sendResponse({ ok: false, error: "internal_error" });
    });
  return true;
});

if (extensionApi.alarms && extensionApi.alarms.onAlarm) {
  extensionApi.alarms.onAlarm.addListener((alarm) => {
    if (alarm && alarm.name === UPDATE_ALARM) checkAllUpdates({ manual: false }).catch(console.error);
  });
}

if (extensionApi.runtime.onInstalled) extensionApi.runtime.onInstalled.addListener(() => initializeBackground().catch(console.error));
if (extensionApi.runtime.onStartup) extensionApi.runtime.onStartup.addListener(() => initializeBackground().catch(console.error));

if (extensionApi.storage && extensionApi.storage.onChanged) {
  extensionApi.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") return;
    if (changes.updateCheckInterval || changes.enabled) ensureUpdateAlarm().catch(console.error);
    if (changes.badgeEnabled || changes.enabled) updateBadge().catch(console.error);
  });
}

if (extensionApi.notifications && extensionApi.notifications.onClicked) {
  extensionApi.notifications.onClicked.addListener((notificationId) => {
    if (notificationId === SUMMARY_NOTIFICATION) {
      const url = extensionApi.runtime.getURL("popup.html#updates");
      if (typeof browser !== "undefined") extensionApi.tabs.create({ url });
      else extensionApi.tabs.create({ url });
      return;
    }
    if (!notificationId.startsWith(NOTIFICATION_PREFIX)) return;
    const key = decodeURIComponent(notificationId.slice(NOTIFICATION_PREFIX.length));
    readTrackerState().then((state) => {
      const update = state.updates.find((item) => item.key === key);
      if (update) return openTab(update.releaseUrl);
    }).catch(console.error);
  });
}

initializeBackground().catch(console.error);
