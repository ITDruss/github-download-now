(function initPopupDashboardController(root, factory) {
  const api = factory();
  root.GHDNPopupDashboardController = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPopupDashboardControllerApi() {
  "use strict";

  function summarizeCheck(result, formatting, translator, strings) {
    const detected = result && Array.isArray(result.detected) ? result.detected.length : 0;
    const errors = result && Array.isArray(result.errors) ? result.errors : [];
    const limited = errors.find((item) => item && item.error === "rate_limited");
    if (limited) {
      const time = limited.resetAt ? formatting.time(limited.resetAt, translator.tag) : "";
      return { message: strings.rateLimited(time), error: true };
    }
    const checked = Number(result && (result.checked ?? result.meta?.lastCheckChecked));
    const total = Number(result && (result.total ?? result.meta?.lastCheckTotal));
    const summary = strings.checkSummary(detected, errors.length);
    const progress = Number.isFinite(checked) && Number.isFinite(total) && total > 0
      ? ` · ${strings.checkProgress(checked, total)}`
      : "";
    return { message: `${summary}${progress}`, error: errors.length > 0 };
  }

  function create(options = {}) {
    const document = options.document;
    const messages = options.messages;
    const formatting = options.formatting;
    const translator = options.translator;
    const strings = options.strings;
    const view = options.view;
    const send = options.send;
    const openUrl = options.openUrl;
    if (!document || !messages || !formatting || !translator || !strings || !view || !send || !openUrl) {
      throw new Error("Popup dashboard dependencies are incomplete");
    }

    let dashboard = { history: [], watches: [], updates: [], meta: {} };

    function renderUpdates() {
      const list = document.getElementById("updatesList");
      list.replaceChildren();
      const count = dashboard.updates.length;
      const countNode = document.getElementById("updatesCount");
      countNode.hidden = !count;
      countNode.textContent = String(count);
      const last = dashboard.meta && dashboard.meta.lastCheckAt;
      const checked = Number(dashboard.meta && dashboard.meta.lastCheckChecked);
      const total = Number(dashboard.meta && dashboard.meta.lastCheckTotal);
      const progress = Number.isFinite(checked) && Number.isFinite(total) && total > 0
        ? ` · ${strings.checkProgress(checked, total)}`
        : "";
      document.getElementById("lastChecked").textContent = last
        ? `${strings.lastChecked(view.formatDate(last, true))}${progress}`
        : strings.neverChecked;
      if (!count) {
        list.append(view.element("div", "empty", strings.noUpdates));
        return;
      }
      for (const update of dashboard.updates) {
        const item = view.element("article", "item");
        const top = view.element("div", "item-top");
        top.append(
          view.element("div", "item-title", `${update.owner}/${update.repo}`),
          view.element("span", "item-tag", update.releaseTag || "new")
        );
        item.append(
          top,
          view.element("div", "item-meta", `${update.fromTag || "—"} → ${update.releaseTag || "—"} · ${view.formatDate(update.releasePublishedAt)}`)
        );
        const assetText = update.compatibleAssetFound
          ? `${update.assetName}${update.assetSize ? ` · ${view.formatBytes(update.assetSize)}` : ""}`
          : strings.noAsset;
        item.append(view.element("div", "item-file", assetText));
        const actions = view.element("div", "item-actions");
        if (update.assetUrl) {
          actions.append(view.actionButton(strings.download, async () => {
            await send({ type: messages.TYPES.DOWNLOAD_UPDATE, key: update.key });
            await refresh();
          }, "primary"));
        }
        actions.append(
          view.actionButton(strings.release, () => openUrl(update.releaseUrl)),
          view.actionButton(strings.skip, async () => {
            await send({ type: messages.TYPES.DISMISS_UPDATE, key: update.key });
            await refresh();
          })
        );
        item.append(actions);
        list.append(item);
      }
    }

    function renderTracking() {
      const list = document.getElementById("trackingList");
      list.replaceChildren();
      const count = dashboard.watches.length;
      const countNode = document.getElementById("trackingCount");
      countNode.hidden = !count;
      countNode.textContent = String(count);
      if (!count) {
        list.append(view.element("div", "empty", strings.noTracking));
        return;
      }
      for (const watch of dashboard.watches) {
        const item = view.element("article", "item");
        const top = view.element("div", "item-top");
        top.append(
          view.element("div", "item-title", `${watch.owner}/${watch.repo}`),
          view.element("span", "item-tag", watch.currentTag || "—")
        );
        item.append(
          top,
          view.element("div", "item-meta", `${strings.checked}: ${watch.lastCheckedAt ? view.formatDate(watch.lastCheckedAt, true) : "—"} · ${watch.platform.os} ${watch.platform.arch}`)
        );
        if (watch.currentAssetName) item.append(view.element("div", "item-file", watch.currentAssetName));
        const actions = view.element("div", "item-actions");
        actions.append(
          view.actionButton(strings.release, () => openUrl(`https://github.com/${watch.owner}/${watch.repo}/releases`)),
          view.actionButton(strings.stop, async () => {
            await send({ type: messages.TYPES.UNWATCH_REPOSITORY, key: watch.key });
            await refresh();
          }, "danger")
        );
        item.append(actions);
        list.append(item);
      }
    }

    function renderHistory() {
      const list = document.getElementById("historyList");
      list.replaceChildren();
      if (!dashboard.history.length) {
        list.append(view.element("div", "empty", strings.noHistory));
        return;
      }
      for (const entry of dashboard.history.slice(0, 20)) {
        const item = view.element("article", "item");
        const top = view.element("div", "item-top");
        top.append(
          view.element("div", "item-title", `${entry.owner}/${entry.repo}`),
          view.element("span", "item-tag", entry.releaseTag || "—")
        );
        item.append(
          top,
          view.element("div", "item-meta", `${view.formatDate(entry.downloadedAt, true)} · ${entry.platform.os} ${entry.platform.arch}`),
          view.element("div", "item-file", entry.assetName)
        );
        const actions = view.element("div", "item-actions");
        actions.append(view.actionButton(strings.release, () => openUrl(entry.releaseUrl)));
        item.append(actions);
        list.append(item);
      }
    }

    function render() {
      renderUpdates();
      renderTracking();
      renderHistory();
    }

    async function refresh() {
      const result = await send({ type: messages.TYPES.GET_DASHBOARD });
      if (result && result.ok) dashboard = result;
      render();
      return dashboard;
    }

    function bind() {
      document.getElementById("checkNow").addEventListener("click", async () => {
        const button = document.getElementById("checkNow");
        button.disabled = true;
        button.textContent = strings.checking;
        try {
          const result = await send({ type: messages.TYPES.CHECK_UPDATES });
          await refresh();
          const summary = summarizeCheck(result, formatting, translator, strings);
          view.status(summary.message, summary.error);
        } catch (_error) {
          view.status(strings.error, true);
        } finally {
          button.disabled = false;
          button.textContent = strings.checkNow;
        }
      });
      document.getElementById("clearHistory").addEventListener("click", async () => {
        await send({ type: messages.TYPES.CLEAR_HISTORY });
        await refresh();
      });
      document.getElementById("openOptions").addEventListener("click", async () => {
        const result = await send({ type: messages.TYPES.OPEN_OPTIONS });
        if (!result || !result.ok) view.status(strings.error, true);
      });
    }

    return Object.freeze({ bind, refresh, render, summarizeCheck: (result) => summarizeCheck(result, formatting, translator, strings) });
  }

  return Object.freeze({ create, summarizeCheck });
});
