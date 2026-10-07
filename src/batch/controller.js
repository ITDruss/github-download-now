(function initBatchController(root, factory) {
  const api = factory();
  root.GHDNBatchController = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBatchControllerApi() {
  "use strict";
  function create({ browserApi, messages, view, batchAssets, urlPolicy, strings, locationObject, navigatorObject, windowObject, settings, formatting }) {
    const params = new URLSearchParams(locationObject.search);
    const repo = urlPolicy.repository(params.get("owner"), params.get("repo"));
    const tag = params.get("tag") || "";
    const selected = new Set();
    let assets = [];
    let release = null;
    let watching = false;
    let batch = null;
    let busy = false;
    let timer;
    let stopped = false;
    let statusPending = null;
    const send = (type, payload = {}) => browserApi.runtime.sendMessage({ type, ...payload });
    const { el } = view;
    function errorText(error) {
      return ({ permission_required: strings.permission, incognito_unsupported: strings.private,
        queue_busy: strings.busy, asset_limit: strings.limit, public_only: strings.publicOnly })[error] || strings.failed;
    }
    function visible() {
      const extensions = [...el("formats").querySelectorAll("input:checked")].map(input => input.value);
      return assets.filter(asset => batchAssets.matches(asset, el("search").value, extensions));
    }
    function updateSelection() {
      view.selection(assets, selected, visible().length, busy);
      const sameRelease = batch?.owner === repo?.owner && batch?.repo === repo?.repo && batch?.tag === tag;
      el("watch").disabled = busy || watching || !sameRelease || !release?.id || !batch.items.some(item => item.state === "complete");
    }
    function render() {
      const list = visible();
      view.list(list, selected, (url, checked) => { if (checked) selected.add(url); else selected.delete(url); updateSelection(); });
      updateSelection();
    }
    function filterChanged() { selected.clear(); render(); }
    function applyStatus(response) {
      if (!response?.ok) { view.notice(errorText(response?.error), true); return; }
      batch = response.batch;
      view.queue(batch);
      updateSelection();
    }
    async function refreshStatus() {
      if (statusPending || stopped) return statusPending;
      statusPending = send(messages.TYPES.GET_BATCH_STATUS).then(applyStatus).catch(() => view.notice(strings.failed, true));
      try { await statusPending; }
      finally {
        statusPending = null;
        clearTimeout(timer);
        if (!stopped) timer = setTimeout(refreshStatus, batchAssets.active(batch) ? 2000 : 10000);
      }
    }
    async function operation(type, payload = {}) {
      if (busy) return;
      busy = true; updateSelection();
      for (const id of ["cancel", "retry", "clear-queue"]) el(id).disabled = true;
      try {
        const response = await send(type, payload);
        if (response?.ok) { view.notice(""); applyStatus(response); }
        else view.notice(errorText(response?.error), true);
      } catch (_error) { view.notice(strings.failed, true); }
      finally { busy = false; view.queue(batch); updateSelection(); }
    }
    async function download() {
      if (busy || !selected.size) return;
      // Request directly in the click handler, before messaging or unrelated async work.
      busy = true; updateSelection();
      let granted;
      try { granted = await browserApi.permissions.request({ permissions: ["downloads"] }); }
      catch (_error) { granted = false; }
      busy = false; updateSelection();
      if (!granted) return view.notice(strings.permissionDenied, true);
      if (!browserApi.api?.downloads?.download) return view.notice(strings.unsupported, true);
      return operation(messages.TYPES.START_BATCH, { ...repo, tag, urls: [...selected] });
    }
    async function load() {
      if (!repo || !tag || tag.length > 240) return view.notice(strings.failed, true);
      view.context(repo, tag);
      view.notice(strings.loading);
      try {
        const result = await send(messages.TYPES.GET_BATCH_ASSETS, { ...repo, tag });
        if (!result?.ok || !result.complete) return view.notice(errorText(result?.error), true);
        release = result.release;
        assets = release.assets.filter(asset => urlPolicy.releaseAsset(asset.browser_download_url, repo.owner, repo.repo, tag));
        selected.clear(); view.context(repo, tag, result.release); view.formats(assets, filterChanged); render();
        view.notice(assets.length ? strings.permission : strings.empty);
      } catch (_error) { view.notice(strings.failed, true); }
    }
    function start() {
      view.labels();
      if (browserApi.api?.extension?.inIncognitoContext) { view.notice(strings.private, true); return; }
      el("search").addEventListener("input", filterChanged);
      el("select-all").addEventListener("click", () => { for (const asset of visible()) selected.add(asset.browser_download_url); render(); });
      el("clear-selection").addEventListener("click", () => { selected.clear(); render(); });
      el("download").addEventListener("click", download);
      el("refresh").addEventListener("click", () => { load(); refreshStatus(); });
      el("copy-links").addEventListener("click", async () => {
        try { await navigatorObject.clipboard.writeText([...selected].join("\n")); view.notice(strings.copied); }
        catch (_error) { view.notice(strings.failed, true); }
      });
      el("cancel").addEventListener("click", () => operation(messages.TYPES.CANCEL_BATCH, { id: batch?.id }));
      el("retry").addEventListener("click", () => operation(messages.TYPES.RETRY_BATCH, { id: batch?.id }));
      el("clear-queue").addEventListener("click", () => operation(messages.TYPES.CLEAR_BATCH));
      el("watch").addEventListener("click", async () => {
        if (busy || watching || !release || !batch) return;
        const item = batch.items.find(value => value.state === "complete");
        const asset = assets.find(value => value.browser_download_url === item?.url);
        if (!asset) return;
        const detected = formatting.platform(navigatorObject.userAgent);
        const platform = { ...detected, arch: detected.arch.toLowerCase(),
          preferredFormat: settings[formatting.platformSettingKey(detected.os)] };
        busy = true; updateSelection();
        try {
          const response = await send(messages.TYPES.WATCH_REPOSITORY, { download: {
            ...repo, releaseId: release.id, releaseTag: tag, releaseName: release.name,
            releaseUrl: release.html_url, releasePublishedAt: release.published_at, releasePrerelease: release.prerelease,
            assetId: asset.id, assetName: asset.name, assetUrl: asset.browser_download_url,
            assetExtension: batchAssets.extension(asset.name), assetSize: asset.size,
            platform, releaseChannel: settings.releaseChannel
          } });
          if (response?.ok) { watching = true; el("watch").textContent = strings.watching; view.notice(strings.watching); }
          else view.notice(errorText(response?.error), true);
        } catch (_error) { view.notice(strings.failed, true); }
        finally { busy = false; updateSelection(); }
      });
      windowObject.addEventListener("pagehide", () => { stopped = true; clearTimeout(timer); });
      render(); load(); refreshStatus();
    }
    return Object.freeze({ start, load, refreshStatus });
  }
  return Object.freeze({ create });
});
