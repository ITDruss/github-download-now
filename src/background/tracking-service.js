(function initBackgroundTrackingService(root, factory) {
  const api = factory();
  root.GHDNBackgroundTrackingService = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBackgroundTrackingServiceApi() {
  "use strict";

  const DEFAULT_UPDATE_BATCH_SIZE = 8;

  function create(options = {}) {
    const settingsApi = options.settingsApi;
    const tracker = options.tracker;
    const selector = options.selector;
    const urlPolicy = options.urlPolicy;
    const trackerState = options.trackerState;
    const releaseService = options.releaseService;
    const notifications = options.notifications;
    const alarms = options.alarms;
    const navigation = options.navigation;
    const updateBatchSize = options.updateBatchSize || DEFAULT_UPDATE_BATCH_SIZE;

    if (!settingsApi || !tracker || !selector || !urlPolicy || !trackerState || !releaseService || !notifications || !alarms || !navigation) {
      throw new Error("Tracking service dependencies are incomplete");
    }

    async function recordDownload(payload, sender = null) {
      if (sender && sender.tab && sender.tab.incognito) return { ok: true, incognito: true, watchState: "none" };
      const download = trackerState.downloadFromPayload(payload);
      if (!download) return { ok: false, error: "invalid_download" };

      const settings = await settingsApi.get();
      const state = await trackerState.readTrackerState();
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

      await trackerState.writeTrackerState({ history, watches, updates });
      await notifications.updateBadge(updates, settings);
      return { ok: true, watchState, download };
    }

    async function watchRepository(payload) {
      const download = trackerState.downloadFromPayload(payload);
      if (!download) return { ok: false, error: "invalid_repository" };
      const state = await trackerState.readTrackerState();
      const existing = state.watches.find((item) => item.key === download.key);
      const watch = tracker.watchFromDownload(download, existing);
      const watches = tracker.upsertWatch(state.watches, watch);
      const updates = tracker.removeUpdate(state.updates, download.key);
      await trackerState.writeTrackerState({ watches, updates });
      await notifications.updateBadge(updates);
      await alarms.ensureUpdateAlarm();
      return { ok: true, watch };
    }

    async function unwatchRepository(key) {
      const state = await trackerState.readTrackerState();
      const watches = tracker.removeWatch(state.watches, key);
      const updates = tracker.removeUpdate(state.updates, key);
      await trackerState.writeTrackerState({ watches, updates });
      await notifications.updateBadge(updates);
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

    async function checkAllUpdates(checkOptions = {}) {
      const state = await trackerState.readTrackerState();
      const settings = await settingsApi.get();
      if (!settings.enabled) {
        return { ok: true, disabled: true, detected: [], errors: [], watches: state.watches, updates: state.updates, meta: state.meta };
      }

      const now = Date.now();
      const resetTime = Date.parse(state.meta.apiRateLimitResetAt || "");
      if (state.meta.apiRateLimitRemaining === 0 && Number.isFinite(resetTime) && resetTime > now) {
        return {
          ok: true,
          rateLimited: true,
          detected: [],
          errors: [{ error: "rate_limited", resetAt: state.meta.apiRateLimitResetAt }],
          watches: state.watches,
          updates: state.updates,
          meta: state.meta
        };
      }

      const watches = state.watches.slice();
      let updates = state.updates.slice();
      const detected = [];
      const errors = [];
      const total = watches.length;
      const startCursor = total ? Math.min(state.meta.watchCursor % total, total - 1) : 0;
      const targetCount = Math.min(updateBatchSize, total);
      let processed = 0;
      let lastRateLimit = null;

      for (let offset = 0; offset < targetCount; offset += 1) {
        const index = (startCursor + offset) % total;
        const watch = watches[index];
        let response;
        try {
          response = await releaseService.getRelease(watch.owner, watch.repo, watch.platform, watch.releaseChannel, {
            force: true,
            etag: watch.etag
          });
        } catch (_error) {
          errors.push({ key: watch.key, error: "network_error" });
          processed += 1;
          continue;
        }

        processed += 1;
        if (response.rateLimit) lastRateLimit = response.rateLimit;
        const checkedAt = new Date().toISOString();

        if (response.notModified) {
          watches[index] = trackerState.trustedWatch({ ...watch, lastCheckedAt: checkedAt }) || watch;
        } else if (!response.ok) {
          errors.push({ key: watch.key, error: response.error, resetAt: response.resetAt || null });
          watches[index] = trackerState.trustedWatch({ ...watch, lastCheckedAt: checkedAt }) || watch;
          if (response.error === "rate_limited") break;
        } else {
          const release = response.release;
          const oldPending = updates.find((item) => item.key === watch.key);
          const isDifferentFromCurrent = Number(release.id) !== Number(watch.currentReleaseId);
          const isNewDetection = isDifferentFromCurrent && (!oldPending || Number(oldPending.releaseId) !== Number(release.id));

          watches[index] = trackerState.trustedWatch({
            ...watch,
            lastCheckedReleaseId: release.id,
            lastCheckedTag: release.tag_name,
            lastCheckedAt: checkedAt,
            etag: response.etag || watch.etag || "",
            lastNotifiedReleaseId: isNewDetection ? release.id : watch.lastNotifiedReleaseId,
            updatedAt: checkedAt
          }) || watch;

          if (isDifferentFromCurrent) {
            const pending = trackerState.trustedUpdate(updateFromRelease(watch, response));
            if (pending) {
              updates = tracker.upsertUpdate(updates, pending);
              if (isNewDetection) detected.push(pending);
            }
          } else {
            updates = tracker.removeUpdate(updates, watch.key);
          }
        }

        if (lastRateLimit && Number.isFinite(lastRateLimit.remaining) && lastRateLimit.remaining <= 1) break;
      }

      const nextCursor = total ? (startCursor + processed) % total : 0;
      const completedCycle = total === 0 || processed >= total;
      const meta = trackerState.normalizedTrackerMeta({
        ...state.meta,
        watchCursor: nextCursor,
        lastCheckAt: new Date().toISOString(),
        lastCheckSource: checkOptions.manual ? "manual" : "alarm",
        lastCheckErrors: errors.length,
        lastCheckErrorDetails: errors.slice(0, 10),
        lastCheckChecked: processed,
        lastCheckTotal: total,
        lastCheckComplete: completedCycle,
        apiRateLimitLimit: lastRateLimit && lastRateLimit.limit,
        apiRateLimitRemaining: lastRateLimit && lastRateLimit.remaining,
        apiRateLimitResetAt: lastRateLimit && lastRateLimit.resetAt
      });

      await trackerState.writeTrackerState({ watches, updates, meta });
      await notifications.updateBadge(updates, settings);
      if (detected.length) await notifications.notifyUpdates(detected, settings);
      return { ok: true, detected, errors, watches, updates, meta, checked: processed, total };
    }

    async function dismissUpdate(key) {
      const state = await trackerState.readTrackerState();
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
      await trackerState.writeTrackerState({ watches, updates });
      await notifications.updateBadge(updates);
      return { ok: true };
    }

    async function downloadUpdate(key) {
      const state = await trackerState.readTrackerState();
      const update = state.updates.find((item) => item.key === key);
      const watch = state.watches.find((item) => item.key === key);
      if (!update || !watch || !update.assetUrl) return { ok: false, error: "asset_not_found" };

      const download = trackerState.trustedDownload({
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

      if (!download) return { ok: false, error: "untrusted_url" };
      const settings = await settingsApi.get();
      const history = settings.historyEnabled ? tracker.addHistory(state.history, download) : state.history;
      const watches = tracker.upsertWatch(state.watches, tracker.watchFromDownload(download, watch));
      const updates = tracker.removeUpdate(state.updates, key);
      await trackerState.writeTrackerState({ history, watches, updates });
      await notifications.updateBadge(updates, settings);
      const trustedAsset = urlPolicy.download(update.assetUrl, update.owner, update.repo);
      if (!trustedAsset) return { ok: false, error: "untrusted_url" };
      await navigation.openTab(trustedAsset.href);
      return { ok: true };
    }

    async function getDashboard() {
      const state = await trackerState.readTrackerState();
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
      await trackerState.writeTrackerState({ history: [] });
      return { ok: true };
    }

    async function clearTracking() {
      await trackerState.writeTrackerState({ watches: [], updates: [] });
      await notifications.updateBadge([]);
      return { ok: true };
    }

    return Object.freeze({
      recordDownload,
      watchRepository,
      unwatchRepository,
      updateFromRelease,
      checkAllUpdates,
      dismissUpdate,
      downloadUpdate,
      getDashboard,
      clearHistory,
      clearTracking
    });
  }

  return Object.freeze({ DEFAULT_UPDATE_BATCH_SIZE, create });
});
