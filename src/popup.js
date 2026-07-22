"use strict";

(() => {
  const browserApi = globalThis.GHDNBrowser;
  const extensionApi = browserApi.api;
  const messages = globalThis.GHDNMessages;
  const formatting = globalThis.GHDNFormatting;
  const settingsApi = globalThis.GHDNSettings;
  const i18n = globalThis.GHDNI18n;
  let settings;
  let dashboard = { history: [], watches: [], updates: [], meta: {} };
  let platform;

  let tr;
  let t;

  function createStrings(translator) {
    const message = translator.t;
    return {
      error: message("commonError"),
      updates: message("popupUpdates"), tracking: message("popupTracking"), history: message("popupHistory"), settings: message("popupSettings"),
      updatesTitle: message("popupUpdatesTitle"), trackingTitle: message("popupTrackingTitle"), historyTitle: message("popupHistoryTitle"),
      trackingNote: message("popupTrackingNote"), historyNote: message("popupHistoryNote"),
      checkNow: message("popupCheckNow"), checking: message("popupChecking"), neverChecked: message("popupNeverChecked"), lastChecked: (value) => message("popupLastChecked", [value]),
      noUpdates: message("popupNoUpdates"), noTracking: message("popupNoTracking"), noHistory: message("popupNoHistory"),
      download: message("popupDownload"), release: message("popupRelease"), skip: message("popupSkip"), stop: message("popupStop"), clear: message("popupClear"), checked: message("popupChecked"),
      detected: message("popupDetected"), format: message("popupFormat"), action: message("popupAction"),
      downloadAction: message("popupDownloadAction"), menuAction: message("popupMenuAction"), releaseAction: message("popupReleaseAction"),
      afterDownload: message("popupAfterDownload"), ask: message("popupAsk"), always: message("popupAlways"), never: message("popupNever"),
      interval: message("popupInterval"), manual: message("popupManual"), every6h: message("popupEvery6Hours"), daily: message("popupDaily"), every3d: message("popupEvery3Days"), weekly: message("popupWeekly"),
      notifications: message("popupNotifications"), badge: message("popupBadge"), historyEnabled: message("popupHistoryEnabled"), enabledLabel: message("popupEnabledLabel"),
      options: message("popupOptions"), saved: message("commonSaved"), permissionDenied: message("popupPermissionDenied"),
      updateFound: (count) => message(translator.pluralCategory(count) === "one" ? "popupUpdateFoundOne" : "popupUpdateFoundOther", [count]),
      checkSummary: (found, failed) => message("popupCheckSummary", [found, failed]),
      checkProgress: (checked, total) => message("popupCheckProgress", [checked, total]),
      rateLimited: (time) => time ? message("popupRateLimitedUntil", [time]) : message("popupRateLimited"),
      auto: message("commonAutomatic"), archive: message("commonArchive"), noAsset: message("popupNoAsset"), current: message("popupCurrent"), published: message("popupPublished"),
      justNow: message("popupJustNow"), minutesAgo: (count) => message("popupMinutesAgo", [count]), hoursAgo: (count) => message("popupHoursAgo", [count]), daysAgo: (count) => message("popupDaysAgo", [count])
    };
  }

  function formatOptions() {
    return {
      linux: [["auto", t.auto], ["appimage", "AppImage"], ["deb", "DEB"], ["rpm", "RPM"], ["flatpak", "Flatpak"], ["snap", "Snap"], ["archive", t.archive]],
      windows: [["auto", t.auto], ["exe", "EXE"], ["msi", "MSI"], ["msix", "MSIX"], ["portable", "Portable"]],
      macos: [["auto", t.auto], ["dmg", "DMG"], ["pkg", "PKG"], ["zip", "ZIP"]],
      android: [["auto", t.auto], ["apk", "APK"], ["apks", "APKS"]]
    };
  }

  function detectPlatform() { return formatting.platform(navigator.userAgent || ""); }
  function settingKey(os) { return formatting.platformSettingKey(os); }
  function el(tag, className = "", text = "") { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; }
  function send(message) { return browserApi.runtime.sendMessage(message); }
  function openUrl(url) { return send({ type: messages.TYPES.OPEN_URL, url }); }
  function formatDate(value, relative = false) {
    return relative
      ? formatting.relativeDate(value, t)
      : formatting.date(value, tr.tag, "—");
  }

  function formatBytes(value) {
    return formatting.bytes(value, { emptyForZero: true, minimumKilobytes: true });
  }

  function status(message, error = false) {
    const node = document.getElementById("status"); node.textContent = message; node.classList.toggle("error", error);
    clearTimeout(status.timer); status.timer = setTimeout(() => { node.textContent = ""; node.classList.remove("error"); }, 2200);
  }

  function checkStatus(result) {
    const detected = result && Array.isArray(result.detected) ? result.detected.length : 0;
    const errors = result && Array.isArray(result.errors) ? result.errors : [];
    const limited = errors.find((item) => item && item.error === "rate_limited");
    if (limited) {
      const time = limited.resetAt ? formatting.time(limited.resetAt, tr.tag) : "";
      return { message: t.rateLimited(time), error: true };
    }
    const checked = Number(result && (result.checked ?? result.meta?.lastCheckChecked));
    const total = Number(result && (result.total ?? result.meta?.lastCheckTotal));
    const summary = t.checkSummary(detected, errors.length);
    const progress = Number.isFinite(checked) && Number.isFinite(total) && total > 0
      ? ` · ${t.checkProgress(checked, total)}`
      : "";
    return { message: `${summary}${progress}`, error: errors.length > 0 };
  }

  function setLabels() {
    document.documentElement.lang = tr.tag;
    document.querySelector(".tabs").setAttribute("aria-label", tr.t("popupSectionsAria"));
    const enabledSwitch = document.getElementById("enabledSwitch");
    enabledSwitch.title = t.enabledLabel;
    document.getElementById("enabled").setAttribute("aria-label", t.enabledLabel);
    const labels = {
      updatesTabLabel: t.updates, trackingTabLabel: t.tracking, historyTabLabel: t.history, settingsTabLabel: t.settings,
      updatesTitle: t.updatesTitle, trackingTitle: t.trackingTitle, historyTitle: t.historyTitle, trackingNote: t.trackingNote, historyNote: t.historyNote,
      checkNow: t.checkNow, clearHistory: t.clear, detectedLabel: t.detected, formatLabel: t.format, actionLabel: t.action,
      afterDownloadLabel: t.afterDownload, intervalLabel: t.interval, notificationsLabel: t.notifications, badgeLabel: t.badge,
      historyEnabledLabel: t.historyEnabled, openOptions: t.options
    };
    for (const [id, value] of Object.entries(labels)) document.getElementById(id).textContent = value;
    const optionLabels = {
      primaryAction: { download: t.downloadAction, menu: t.menuAction, release: t.releaseAction },
      afterDownload: { ask: t.ask, always: t.always, never: t.never },
      updateCheckInterval: { manual: t.manual, "6h": t.every6h, "24h": t.daily, "72h": t.every3d, "168h": t.weekly }
    };
    for (const [selectId, values] of Object.entries(optionLabels)) {
      for (const [value, label] of Object.entries(values)) document.querySelector(`#${selectId} option[value="${value}"]`).textContent = label;
    }
  }

  function fillFormats() {
    const select = document.getElementById("preferredFormat");
    select.replaceChildren(...formatOptions()[platform.os].map(([value, label]) => { const option = el("option", "", label); option.value = value; return option; }));
    select.value = settings[settingKey(platform.os)];
  }

  function setTab(name, focus = false) {
    for (const node of document.querySelectorAll(".tab")) {
      const active = node.dataset.tab === name;
      node.classList.toggle("active", active);
      node.setAttribute("aria-selected", String(active));
      node.tabIndex = active ? 0 : -1;
      if (active && focus) node.focus();
    }
    for (const node of document.querySelectorAll(".panel")) {
      const active = node.dataset.panel === name;
      node.classList.toggle("active", active);
      node.hidden = !active;
    }
    if (location.hash !== `#${name}`) history.replaceState(null, "", `#${name}`);
  }

  function actionButton(label, handler, className = "") {
    const button = el("button", className, label); button.type = "button"; button.addEventListener("click", handler); return button;
  }

  function renderUpdates() {
    const list = document.getElementById("updatesList"); list.replaceChildren();
    const count = dashboard.updates.length;
    document.getElementById("updatesCount").hidden = !count; document.getElementById("updatesCount").textContent = String(count);
    const last = dashboard.meta && dashboard.meta.lastCheckAt;
    const checked = Number(dashboard.meta && dashboard.meta.lastCheckChecked);
    const total = Number(dashboard.meta && dashboard.meta.lastCheckTotal);
    const progress = Number.isFinite(checked) && Number.isFinite(total) && total > 0
      ? ` · ${t.checkProgress(checked, total)}`
      : "";
    document.getElementById("lastChecked").textContent = last ? `${t.lastChecked(formatDate(last, true))}${progress}` : t.neverChecked;
    if (!count) { list.append(el("div", "empty", t.noUpdates)); return; }
    for (const update of dashboard.updates) {
      const item = el("article", "item");
      const top = el("div", "item-top"); top.append(el("div", "item-title", `${update.owner}/${update.repo}`), el("span", "item-tag", update.releaseTag || "new"));
      item.append(top, el("div", "item-meta", `${update.fromTag || "—"} → ${update.releaseTag || "—"} · ${formatDate(update.releasePublishedAt)}`));
      item.append(el("div", "item-file", update.compatibleAssetFound ? `${update.assetName}${update.assetSize ? ` · ${formatBytes(update.assetSize)}` : ""}` : t.noAsset));
      const actions = el("div", "item-actions");
      if (update.assetUrl) actions.append(actionButton(t.download, async () => { await send({ type: messages.TYPES.DOWNLOAD_UPDATE, key: update.key }); await refresh(); }, "primary"));
      actions.append(actionButton(t.release, () => openUrl(update.releaseUrl)), actionButton(t.skip, async () => { await send({ type: messages.TYPES.DISMISS_UPDATE, key: update.key }); await refresh(); }));
      item.append(actions); list.append(item);
    }
  }

  function renderTracking() {
    const list = document.getElementById("trackingList"); list.replaceChildren();
    const count = dashboard.watches.length;
    document.getElementById("trackingCount").hidden = !count; document.getElementById("trackingCount").textContent = String(count);
    if (!count) { list.append(el("div", "empty", t.noTracking)); return; }
    for (const watch of dashboard.watches) {
      const item = el("article", "item");
      const top = el("div", "item-top"); top.append(el("div", "item-title", `${watch.owner}/${watch.repo}`), el("span", "item-tag", watch.currentTag || "—"));
      item.append(top, el("div", "item-meta", `${t.checked}: ${watch.lastCheckedAt ? formatDate(watch.lastCheckedAt, true) : "—"} · ${watch.platform.os} ${watch.platform.arch}`));
      if (watch.currentAssetName) item.append(el("div", "item-file", watch.currentAssetName));
      const actions = el("div", "item-actions");
      actions.append(actionButton(t.release, () => openUrl(`https://github.com/${watch.owner}/${watch.repo}/releases`)), actionButton(t.stop, async () => { await send({ type: messages.TYPES.UNWATCH_REPOSITORY, key: watch.key }); await refresh(); }, "danger"));
      item.append(actions); list.append(item);
    }
  }

  function renderHistory() {
    const list = document.getElementById("historyList"); list.replaceChildren();
    if (!dashboard.history.length) { list.append(el("div", "empty", t.noHistory)); return; }
    for (const entry of dashboard.history.slice(0, 20)) {
      const item = el("article", "item");
      const top = el("div", "item-top"); top.append(el("div", "item-title", `${entry.owner}/${entry.repo}`), el("span", "item-tag", entry.releaseTag || "—"));
      item.append(top, el("div", "item-meta", `${formatDate(entry.downloadedAt, true)} · ${entry.platform.os} ${entry.platform.arch}`), el("div", "item-file", entry.assetName));
      const actions = el("div", "item-actions"); actions.append(actionButton(t.release, () => openUrl(entry.releaseUrl))); item.append(actions); list.append(item);
    }
  }

  function renderAll() { renderUpdates(); renderTracking(); renderHistory(); }

  async function refresh() {
    const result = await send({ type: messages.TYPES.GET_DASHBOARD });
    if (result && result.ok) dashboard = result;
    renderAll();
  }

  function requestNotifications() {
    return browserApi.permissions.request({ permissions: ["notifications"] });
  }

  async function init() {
    settings = await settingsApi.get();
    tr = i18n.create(settings.language, navigator.language || "");
    t = createStrings(tr);
    setLabels();
    document.getElementById("version").textContent = `v${extensionApi.runtime.getManifest().version}`;
    platform = detectPlatform();
    document.getElementById("detectedPlatform").textContent = `${{ linux: "Linux", windows: "Windows", macos: "macOS", android: "Android" }[platform.os]} · ${platform.arch}`;
    document.getElementById("enabled").checked = settings.enabled;
    document.body.classList.toggle("disabled", !settings.enabled);
    fillFormats();
    for (const key of ["primaryAction", "afterDownload", "updateCheckInterval"]) document.getElementById(key).value = settings[key];
    for (const key of ["notificationsEnabled", "badgeEnabled", "historyEnabled"]) document.getElementById(key).checked = settings[key];

    const tabs = [...document.querySelectorAll(".tab")];
    for (const node of tabs) {
      node.addEventListener("click", () => setTab(node.dataset.tab));
      node.addEventListener("keydown", (event) => {
        if (!new Set(["ArrowLeft", "ArrowRight", "Home", "End"]).has(event.key)) return;
        event.preventDefault();
        const current = tabs.indexOf(node);
        const next = event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
        setTab(tabs[next].dataset.tab, true);
      });
    }
    setTab(["updates", "tracking", "history", "settings"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "updates");

    document.getElementById("enabled").addEventListener("change", async (event) => { settings = await settingsApi.set({ enabled: event.target.checked }); document.body.classList.toggle("disabled", !event.target.checked); status(t.saved); });
    document.getElementById("preferredFormat").addEventListener("change", async (event) => { settings = await settingsApi.set({ [settingKey(platform.os)]: event.target.value }); status(t.saved); });
    for (const key of ["primaryAction", "afterDownload", "updateCheckInterval"]) document.getElementById(key).addEventListener("change", async (event) => { settings = await settingsApi.set({ [key]: event.target.value }); status(t.saved); });
    for (const key of ["badgeEnabled", "historyEnabled"]) document.getElementById(key).addEventListener("change", async (event) => { settings = await settingsApi.set({ [key]: event.target.checked }); status(t.saved); });
    document.getElementById("notificationsEnabled").addEventListener("change", async (event) => {
      if (event.target.checked && !(await requestNotifications())) { event.target.checked = false; status(t.permissionDenied, true); }
      settings = await settingsApi.set({ notificationsEnabled: event.target.checked }); status(t.saved);
    });
    document.getElementById("checkNow").addEventListener("click", async () => {
      const button = document.getElementById("checkNow"); button.disabled = true; button.textContent = t.checking;
      try {
        const result = await send({ type: messages.TYPES.CHECK_UPDATES });
        await refresh();
        const summary = checkStatus(result);
        status(summary.message, summary.error);
      }
      catch (_error) { status(t.error, true); }
      finally { button.disabled = false; button.textContent = t.checkNow; }
    });
    document.getElementById("clearHistory").addEventListener("click", async () => { await send({ type: messages.TYPES.CLEAR_HISTORY }); await refresh(); });
    document.getElementById("openOptions").addEventListener("click", async () => {
      const result = await send({ type: messages.TYPES.OPEN_OPTIONS });
      if (!result || !result.ok) status(t.error, true);
    });
    await refresh();
  }

  init().catch((error) => { console.error(error); status(String(error.message || error), true); });
})();
