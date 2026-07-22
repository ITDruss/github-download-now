(function initBackgroundTrackerState(root, factory) {
  const api = factory();
  root.GHDNBackgroundTrackerState = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBackgroundTrackerStateApi() {
  "use strict";

  function create(options = {}) {
    const storage = options.storage;
    const tracker = options.tracker;
    const urlPolicy = options.urlPolicy;
    if (!storage || !tracker || !urlPolicy) throw new Error("Tracker-state dependencies are incomplete");

    function trustedReleasePage(value, owner, repo, expectedTag) {
      const release = urlPolicy.releaseTag(value, owner, repo);
      return release && (!expectedTag || release.tag === expectedTag) ? release : null;
    }

    function trustedReleaseAsset(value, owner, repo, expectedTag) {
      return urlPolicy.releaseAsset(value, owner, repo, expectedTag || "");
    }

    function trustedDownload(entry) {
      const clean = tracker.sanitizeDownload(entry);
      if (!clean || !clean.releaseTag) return null;
      const asset = urlPolicy.download(clean.assetUrl, clean.owner, clean.repo);
      const release = trustedReleasePage(clean.releaseUrl, clean.owner, clean.repo, clean.releaseTag);
      if (!asset || !release) return null;
      if (asset.tag && asset.tag !== clean.releaseTag) return null;
      return { ...clean, assetUrl: asset.href, releaseUrl: release.href };
    }

    function trustedWatch(entry) {
      const clean = tracker.sanitizeWatch(entry);
      if (!clean) return null;
      const currentAsset = clean.currentAssetUrl
        ? trustedReleaseAsset(clean.currentAssetUrl, clean.owner, clean.repo, clean.currentTag)
        : null;
      if (clean.currentAssetUrl && !currentAsset) return null;
      return { ...clean, currentAssetUrl: currentAsset ? currentAsset.href : "" };
    }

    function trustedUpdate(entry) {
      const clean = tracker.sanitizeUpdate(entry);
      if (!clean || !clean.releaseTag) return null;
      const release = trustedReleasePage(clean.releaseUrl, clean.owner, clean.repo, clean.releaseTag);
      const asset = clean.assetUrl
        ? trustedReleaseAsset(clean.assetUrl, clean.owner, clean.repo, clean.releaseTag)
        : null;
      if (!release || (clean.assetUrl && !asset)) return null;
      return {
        ...clean,
        releaseUrl: release.href,
        assetUrl: asset ? asset.href : ""
      };
    }

    function normalizedTrackerMeta(value) {
      const source = value && typeof value === "object" ? value : {};
      const cursor = Math.max(0, Number(source.watchCursor) || 0);
      const remaining = Number(source.apiRateLimitRemaining);
      const limit = Number(source.apiRateLimitLimit);
      return {
        ...source,
        watchCursor: cursor,
        apiRateLimitRemaining: Number.isFinite(remaining) ? remaining : null,
        apiRateLimitLimit: Number.isFinite(limit) ? limit : null,
        apiRateLimitResetAt: typeof source.apiRateLimitResetAt === "string" ? source.apiRateLimitResetAt : null
      };
    }

    async function readTrackerState() {
      const data = await storage.localGet({
        [tracker.HISTORY_KEY]: [],
        [tracker.WATCHES_KEY]: [],
        [tracker.UPDATES_KEY]: [],
        [tracker.META_KEY]: {}
      });
      return {
        history: Array.isArray(data[tracker.HISTORY_KEY]) ? data[tracker.HISTORY_KEY].map(trustedDownload).filter(Boolean) : [],
        watches: Array.isArray(data[tracker.WATCHES_KEY]) ? data[tracker.WATCHES_KEY].map(trustedWatch).filter(Boolean) : [],
        updates: Array.isArray(data[tracker.UPDATES_KEY]) ? data[tracker.UPDATES_KEY].map(trustedUpdate).filter(Boolean) : [],
        meta: normalizedTrackerMeta(data[tracker.META_KEY])
      };
    }

    async function writeTrackerState(patch) {
      const values = {};
      if (patch.history) values[tracker.HISTORY_KEY] = patch.history;
      if (patch.watches) values[tracker.WATCHES_KEY] = patch.watches;
      if (patch.updates) values[tracker.UPDATES_KEY] = patch.updates;
      if (patch.meta) values[tracker.META_KEY] = patch.meta;
      if (Object.keys(values).length) await storage.localSet(values);
    }

    function downloadFromPayload(payload) {
      return trustedDownload({
        ...payload,
        downloadedAt: payload && payload.downloadedAt || new Date().toISOString()
      });
    }

    return Object.freeze({
      trustedReleasePage,
      trustedReleaseAsset,
      trustedDownload,
      trustedWatch,
      trustedUpdate,
      normalizedTrackerMeta,
      readTrackerState,
      writeTrackerState,
      downloadFromPayload
    });
  }

  return Object.freeze({ create });
});
