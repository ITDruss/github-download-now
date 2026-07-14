(function initTracker(root, factory) {
  const api = factory();
  root.GHDNTracker = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTrackerApi() {
  "use strict";

  const HISTORY_KEY = "ghdnDownloadHistory";
  const WATCHES_KEY = "ghdnWatchedRepositories";
  const UPDATES_KEY = "ghdnPendingUpdates";
  const META_KEY = "ghdnTrackerMeta";
  const MAX_HISTORY = 100;
  const MAX_WATCHES = 30;

  function text(value, max = 300) {
    return typeof value === "string" ? value.slice(0, max) : "";
  }

  function finiteNumber(value, fallback = null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function repositoryKey(owner, repo) {
    const cleanOwner = text(owner, 100).toLowerCase();
    const cleanRepo = text(repo, 100).toLowerCase();
    return cleanOwner && cleanRepo ? `${cleanOwner}/${cleanRepo}` : "";
  }

  function sanitizePlatform(platform) {
    const source = platform && typeof platform === "object" ? platform : {};
    const allowedOs = new Set(["windows", "linux", "macos", "android", "unknown"]);
    const allowedArch = new Set(["x64", "x86", "arm64", "arm", "universal", "unknown"]);
    return {
      os: allowedOs.has(source.os) ? source.os : "unknown",
      arch: allowedArch.has(source.arch) ? source.arch : "unknown",
      browser: text(source.browser, 40),
      preferredFormat: text(source.preferredFormat, 40)
    };
  }

  function sanitizeDownload(entry) {
    const source = entry && typeof entry === "object" ? entry : {};
    const owner = text(source.owner, 100);
    const repo = text(source.repo, 100);
    const key = repositoryKey(owner, repo);
    if (!key) return null;
    return {
      id: text(source.id, 180) || `${key}:${finiteNumber(source.releaseId, 0)}:${text(source.assetName, 180)}:${Date.now()}`,
      key,
      owner,
      repo,
      releaseId: finiteNumber(source.releaseId),
      releaseTag: text(source.releaseTag, 160),
      releaseName: text(source.releaseName, 240),
      releaseUrl: text(source.releaseUrl, 1200),
      releasePublishedAt: text(source.releasePublishedAt, 80),
      releasePrerelease: Boolean(source.releasePrerelease),
      assetId: finiteNumber(source.assetId),
      assetName: text(source.assetName, 300),
      assetUrl: text(source.assetUrl, 1600),
      assetExtension: text(source.assetExtension, 40),
      assetSize: finiteNumber(source.assetSize, 0),
      platform: sanitizePlatform(source.platform),
      releaseChannel: source.releaseChannel === "newest" ? "newest" : "stable",
      downloadedAt: text(source.downloadedAt, 80) || new Date().toISOString()
    };
  }

  function sanitizeWatch(entry) {
    const source = entry && typeof entry === "object" ? entry : {};
    const owner = text(source.owner, 100);
    const repo = text(source.repo, 100);
    const key = repositoryKey(owner, repo);
    if (!key) return null;
    return {
      key,
      owner,
      repo,
      platform: sanitizePlatform(source.platform),
      releaseChannel: source.releaseChannel === "newest" ? "newest" : "stable",
      currentReleaseId: finiteNumber(source.currentReleaseId),
      currentTag: text(source.currentTag, 160),
      currentPublishedAt: text(source.currentPublishedAt, 80),
      currentAssetName: text(source.currentAssetName, 300),
      currentAssetUrl: text(source.currentAssetUrl, 1600),
      currentAssetExtension: text(source.currentAssetExtension, 40),
      lastCheckedReleaseId: finiteNumber(source.lastCheckedReleaseId),
      lastCheckedTag: text(source.lastCheckedTag, 160),
      lastCheckedAt: text(source.lastCheckedAt, 80),
      lastNotifiedReleaseId: finiteNumber(source.lastNotifiedReleaseId),
      etag: text(source.etag, 300),
      createdAt: text(source.createdAt, 80) || new Date().toISOString(),
      updatedAt: text(source.updatedAt, 80) || new Date().toISOString()
    };
  }

  function sanitizeUpdate(entry) {
    const source = entry && typeof entry === "object" ? entry : {};
    const owner = text(source.owner, 100);
    const repo = text(source.repo, 100);
    const key = repositoryKey(owner, repo);
    if (!key) return null;
    return {
      key,
      owner,
      repo,
      fromReleaseId: finiteNumber(source.fromReleaseId),
      fromTag: text(source.fromTag, 160),
      releaseId: finiteNumber(source.releaseId),
      releaseTag: text(source.releaseTag, 160),
      releaseName: text(source.releaseName, 240),
      releaseUrl: text(source.releaseUrl, 1200),
      releasePublishedAt: text(source.releasePublishedAt, 80),
      releasePrerelease: Boolean(source.releasePrerelease),
      assetId: finiteNumber(source.assetId),
      assetName: text(source.assetName, 300),
      assetUrl: text(source.assetUrl, 1600),
      assetExtension: text(source.assetExtension, 40),
      assetSize: finiteNumber(source.assetSize, 0),
      compatibleAssetFound: Boolean(source.compatibleAssetFound),
      detectedAt: text(source.detectedAt, 80) || new Date().toISOString()
    };
  }

  function normalizeList(value, sanitizer) {
    return Array.isArray(value) ? value.map(sanitizer).filter(Boolean) : [];
  }

  function addHistory(history, entry, max = MAX_HISTORY) {
    const clean = sanitizeDownload(entry);
    if (!clean) return normalizeList(history, sanitizeDownload).slice(0, max);
    const existing = normalizeList(history, sanitizeDownload).filter((item) => item.id !== clean.id);
    return [clean, ...existing].slice(0, Math.max(1, max));
  }

  function upsertWatch(watches, entry, max = MAX_WATCHES) {
    const clean = sanitizeWatch(entry);
    if (!clean) return normalizeList(watches, sanitizeWatch).slice(0, max);
    const existing = normalizeList(watches, sanitizeWatch);
    const previous = existing.find((item) => item.key === clean.key);
    const merged = previous ? sanitizeWatch({ ...previous, ...clean, createdAt: previous.createdAt }) : clean;
    return [merged, ...existing.filter((item) => item.key !== clean.key)].slice(0, Math.max(1, max));
  }

  function upsertUpdate(updates, entry) {
    const clean = sanitizeUpdate(entry);
    if (!clean) return normalizeList(updates, sanitizeUpdate);
    return [clean, ...normalizeList(updates, sanitizeUpdate).filter((item) => item.key !== clean.key)];
  }

  function removeByKey(items, key, sanitizer) {
    return normalizeList(items, sanitizer).filter((item) => item.key !== key);
  }

  function isNewRelease(watch, release) {
    const cleanWatch = sanitizeWatch(watch);
    const releaseId = finiteNumber(release && release.id);
    return Boolean(cleanWatch && releaseId && releaseId !== cleanWatch.currentReleaseId);
  }

  function watchFromDownload(download, previous) {
    const clean = sanitizeDownload(download);
    if (!clean) return null;
    const prior = sanitizeWatch(previous);
    return sanitizeWatch({
      ...(prior || {}),
      key: clean.key,
      owner: clean.owner,
      repo: clean.repo,
      platform: clean.platform,
      releaseChannel: clean.releaseChannel,
      currentReleaseId: clean.releaseId,
      currentTag: clean.releaseTag,
      currentPublishedAt: clean.releasePublishedAt,
      currentAssetName: clean.assetName,
      currentAssetUrl: clean.assetUrl,
      currentAssetExtension: clean.assetExtension,
      lastCheckedReleaseId: clean.releaseId,
      lastCheckedTag: clean.releaseTag,
      updatedAt: new Date().toISOString()
    });
  }

  return {
    HISTORY_KEY,
    WATCHES_KEY,
    UPDATES_KEY,
    META_KEY,
    MAX_HISTORY,
    MAX_WATCHES,
    repositoryKey,
    sanitizePlatform,
    sanitizeDownload,
    sanitizeWatch,
    sanitizeUpdate,
    addHistory,
    upsertWatch,
    upsertUpdate,
    removeWatch: (items, key) => removeByKey(items, key, sanitizeWatch),
    removeUpdate: (items, key) => removeByKey(items, key, sanitizeUpdate),
    isNewRelease,
    watchFromDownload
  };
});
