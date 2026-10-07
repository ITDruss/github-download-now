(function initDownloadService(root, factory) {
  const api = factory();
  root.GHDNBackgroundDownloadService = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createDownloadServiceApi() {
  "use strict";
  const STORAGE_KEY = "ghdnDownloadBatch";
  function create(options) {
    const { storage, browserApi, extensionApi, catalog, urlPolicy, batchAssets } = options;
    const randomId = options.randomId || (() => globalThis.crypto.randomUUID());
    let batch = null;
    let initialized = false;
    let serial = Promise.resolve();
    let lastSaved;
    let eventsRegistered = false;

    function registerEvents() {
      if (eventsRegistered || !extensionApi.downloads?.onChanged) return;
      extensionApi.downloads.onChanged.addListener(delta => changed(delta).catch(console.error));
      eventsRegistered = true;
    }

    function transact(operation) {
      const pending = serial.then(operation);
      serial = pending.catch(() => {});
      return pending;
    }
    function privateContext(sender) {
      return Boolean(sender?.tab?.incognito || extensionApi.extension?.inIncognitoContext);
    }
    async function permitted() {
      return Boolean(extensionApi.downloads?.download && await browserApi.permissions.contains({ permissions: ["downloads"] }));
    }
    async function persist() {
      const encoded = JSON.stringify(batch);
      if (encoded === lastSaved) return;
      if (batch) await storage.localSet({ [STORAGE_KEY]: batch });
      else await storage.localRemove([STORAGE_KEY]);
      lastSaved = encoded;
    }
    function snapshot() {
      return { ok: true, batch: batch ? JSON.parse(JSON.stringify(batch)) : null };
    }
    function updateItem(item, download) {
      if (!download) { item.state = "interrupted"; item.error = "download_missing"; return; }
      item.downloadId = download.id;
      item.state = download.state === "complete" ? "complete" : download.state === "interrupted" ? "interrupted" : "in_progress";
      item.error = item.state === "interrupted" ? String(download.error || "interrupted") : "";
    }
    async function lookup(item, index) {
      const ownFilename = batchAssets.filename(batch, item, index).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const results = await browserApi.downloads.search(item.downloadId !== null ? { id: item.downloadId } : {
        filenameRegex: `${ownFilename.replaceAll("/", "[/\\\\]")}$`, limit: 1, orderBy: ["-startTime"]
      });
      return results.find(value => value.url === item.url && !value.incognito);
    }
    async function restore() {
      if (initialized) return;
      // Private contexts never read or persist normal-profile batch metadata.
      if (privateContext()) { initialized = true; return; }
      const stored = await storage.localGet({ [STORAGE_KEY]: null });
      batch = batchAssets.normalizeBatch(stored[STORAGE_KEY], urlPolicy);
      if (batch && await permitted()) {
        for (const [index, item] of batch.items.entries()) {
          if (!["starting", "in_progress"].includes(item.state)) continue;
          try {
            updateItem(item, await lookup(item, index));
          } catch (_error) { item.state = "interrupted"; item.error = "recovery_failed"; }
        }
        await persist();
      }
      initialized = true;
    }
    async function pump() {
      if (!batch || batch.canceled || !await permitted()) return;
      let active = batch.items.filter(item => ["starting", "in_progress"].includes(item.state)).length;
      for (const [index, item] of batch.items.entries()) {
        if (active >= 3) break;
        if (item.state !== "queued") continue;
        if (!urlPolicy.releaseAsset(item.url, batch.owner, batch.repo, batch.tag)) {
          item.state = "interrupted"; item.error = "untrusted_url"; continue;
        }
        // Persist before starting. Recovery searches only this queue's unique filename.
        item.state = "starting";
        await persist();
        try {
          item.downloadId = await browserApi.downloads.download({ url: item.url,
            filename: batchAssets.filename(batch, item, index), conflictAction: "uniquify", saveAs: false });
          if (!Number.isInteger(item.downloadId) || item.downloadId < 0) throw new Error("Invalid download ID");
          item.state = "in_progress";
          active += 1;
        } catch (_error) {
          item.state = "interrupted"; item.error = "download_failed";
        }
        await persist();
      }
      await persist();
    }
    function initialize() {
      registerEvents();
      return transact(async () => { await restore(); await pump(); });
    }
    function status(sender) {
      return transact(async () => {
        if (privateContext(sender)) return { ok: false, error: "incognito_unsupported" };
        await restore();
        // Reconcile only IDs owned by this queue, including when permission was regranted.
        if (batch && await permitted()) {
          for (const [index, item] of batch.items.entries()) {
            if (!["starting", "in_progress"].includes(item.state)) continue;
            try { updateItem(item, await lookup(item, index)); }
            catch (_error) { /* A transient API failure must not manufacture a completed download. */ }
          }
          await persist(); await pump();
        }
        return snapshot();
      });
    }
    function start(message, sender) {
      return transact(async () => {
        if (privateContext(sender)) return { ok: false, error: "incognito_unsupported" };
        await restore();
        if (!await permitted()) return { ok: false, error: "permission_required" };
        registerEvents();
        if (batchAssets.active(batch)) return { ok: false, error: "queue_busy" };
        if (!Array.isArray(message.urls) || !message.urls.length || message.urls.length > batchAssets.MAX_ASSETS) {
          return { ok: false, error: "invalid_selection" };
        }
        const result = await catalog.load(message.owner, message.repo, message.tag);
        if (!result.ok) return result;
        const urls = [...new Set(message.urls)];
        const available = new Map(result.release.assets.map(asset => [asset.browser_download_url, asset]));
        if (urls.some(url => typeof url !== "string" || !available.has(url))) return { ok: false, error: "invalid_selection" };
        batch = { id: randomId(), owner: message.owner, repo: message.repo, tag: result.release.tag_name,
          createdAt: new Date().toISOString(), canceled: false,
          items: urls.map(url => ({ url, name: available.get(url).name, size: available.get(url).size,
            state: "queued", downloadId: null, error: "" })) };
        await persist(); await pump();
        return snapshot();
      });
    }
    function changed(delta) {
      // Ignore byte-progress events; terminal transitions are sufficient to advance the queue.
      if (!delta?.state?.current) return Promise.resolve();
      return transact(async () => {
        await restore();
        const item = batch?.items.find(value => value.downloadId === delta.id && value.state === "in_progress");
        if (!item || !["complete", "interrupted"].includes(delta.state.current)) return;
        item.state = delta.state.current; item.error = String(delta.error?.current || "").slice(0, 120);
        await persist(); await pump();
      });
    }
    function cancel(id, sender) {
      return transact(async () => {
        if (privateContext(sender)) return { ok: false, error: "incognito_unsupported" };
        await restore();
        if (!batch || batch.id !== id) return { ok: false, error: "batch_missing" };
        if (!await permitted()) return { ok: false, error: "permission_required" };
        batch.canceled = true;
        for (const item of batch.items) {
          if (!["queued", "starting", "in_progress"].includes(item.state)) continue;
          if (item.downloadId !== null && await permitted()) {
            try { await browserApi.downloads.cancel(item.downloadId); }
            catch (_error) { updateItem(item, (await browserApi.downloads.search({ id: item.downloadId }))[0]); }
          }
          if (item.state !== "complete") item.state = "canceled";
        }
        await persist(); return snapshot();
      });
    }
    function retry(id, sender) {
      return transact(async () => {
        if (privateContext(sender)) return { ok: false, error: "incognito_unsupported" };
        await restore();
        if (!batch || batch.id !== id) return { ok: false, error: "batch_missing" };
        if (!await permitted()) return { ok: false, error: "permission_required" };
        const result = await catalog.load(batch.owner, batch.repo, batch.tag);
        if (!result.ok) return result;
        const available = new Set(result.release.assets.map(asset => asset.browser_download_url));
        for (const [index, item] of batch.items.entries()) {
          if (item.state !== "interrupted") continue;
          // Reconcile a recovered ID before retrying to avoid duplicating a completed file.
          const found = await lookup(item, index);
          if (found && found.state !== "interrupted") { updateItem(item, found); continue; }
          if (!available.has(item.url)) { item.error = "asset_removed"; continue; }
          item.state = "queued"; item.downloadId = null; item.error = "";
        }
        batch.canceled = false;
        await persist(); await pump(); return snapshot();
      });
    }
    function clear(sender) {
      return transact(async () => {
        if (privateContext(sender)) return { ok: false, error: "incognito_unsupported" };
        await restore();
        if (batchAssets.active(batch)) return { ok: false, error: "queue_busy" };
        batch = null; await persist(); return snapshot();
      });
    }
    return Object.freeze({ initialize, status, start, changed, cancel, retry, clear });
  }
  return Object.freeze({ create, STORAGE_KEY });
});
