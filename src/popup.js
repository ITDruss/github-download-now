"use strict";

(() => {
  const extensionApi = typeof browser !== "undefined" ? browser : chrome;
  const settingsApi = globalThis.GHDNSettings;
  const russian = /^(ru|uk|be|kk)(-|$)/i.test(navigator.language || "");
  let settings;
  let dashboard = { history: [], watches: [], updates: [], meta: {} };
  let platform;

  const t = russian ? {
    updates: "Обновления", tracking: "Слежение", history: "История", settings: "Настройки",
    updatesTitle: "Доступные обновления", trackingTitle: "Отслеживаемые проекты", historyTitle: "Недавние загрузки",
    trackingNote: "Проверяются только выбранные вами репозитории.", historyNote: "Только загрузки, начатые через расширение.",
    checkNow: "Проверить", checking: "Проверяю…", neverChecked: "Ещё не проверялось", lastChecked: (v) => `Проверено ${v}`,
    noUpdates: "Новых версий пока нет.", noTracking: "После загрузки разрешите следить за проектом — он появится здесь.", noHistory: "История загрузок пока пуста.",
    download: "Скачать", release: "Релиз", skip: "Пропустить", stop: "Не следить", clear: "Очистить", checked: "Проверено",
    detected: "Обнаружено", format: "Предпочитаемый формат", action: "Действие основной кнопки",
    downloadAction: "Скачать рекомендацию", menuAction: "Всегда открывать меню", releaseAction: "Открыть страницу Releases",
    afterDownload: "После загрузки", ask: "Спрашивать о слежении", always: "Всегда следить", never: "Никогда не предлагать",
    interval: "Проверка обновлений", manual: "Только вручную", every6h: "Каждые 6 часов", daily: "Раз в день", every3d: "Раз в 3 дня", weekly: "Раз в неделю",
    notifications: "Системные уведомления", badge: "Счётчик на иконке", historyEnabled: "Записывать историю загрузок", enabledLabel: "Включить расширение",
    options: "Открыть все настройки", saved: "Сохранено", permissionDenied: "Разрешение на уведомления не выдано",
    updateFound: (n) => `Найдено обновлений: ${n}`, checkSummary: (found, failed) => `Найдено: ${found} · Ошибок: ${failed}`,
    checkProgress: (checked, total) => `Проверено репозиториев: ${checked} из ${total}`,
    rateLimited: (time) => time ? `Лимит GitHub API исчерпан до ${time}` : "Лимит GitHub API исчерпан",
    auto: "Автоматически", noAsset: "Подходящий файл не найден", current: "Текущая", published: "выпущено"
  } : {
    updates: "Updates", tracking: "Tracking", history: "History", settings: "Settings",
    updatesTitle: "Available updates", trackingTitle: "Watched repositories", historyTitle: "Recent downloads",
    trackingNote: "Only repositories you explicitly watch are checked.", historyNote: "Only downloads started through this extension.",
    checkNow: "Check now", checking: "Checking…", neverChecked: "Not checked yet", lastChecked: (v) => `Checked ${v}`,
    noUpdates: "No new releases yet.", noTracking: "Allow tracking after a download and the project will appear here.", noHistory: "Download history is empty.",
    download: "Download", release: "Release", skip: "Skip", stop: "Unwatch", clear: "Clear", checked: "Checked",
    detected: "Detected", format: "Preferred format", action: "Main button action",
    downloadAction: "Download recommendation", menuAction: "Always open menu", releaseAction: "Open Releases page",
    afterDownload: "After a download", ask: "Ask whether to watch", always: "Always start watching", never: "Never ask",
    interval: "Update checks", manual: "Manual only", every6h: "Every 6 hours", daily: "Once a day", every3d: "Every 3 days", weekly: "Once a week",
    notifications: "System notifications", badge: "Toolbar badge", historyEnabled: "Keep download history", enabledLabel: "Enable extension",
    options: "Open all settings", saved: "Saved", permissionDenied: "Notification permission was not granted",
    updateFound: (n) => `${n} update${n === 1 ? "" : "s"} found`, checkSummary: (found, failed) => `Found: ${found} · Failed: ${failed}`,
    checkProgress: (checked, total) => `Repositories checked: ${checked} of ${total}`,
    rateLimited: (time) => time ? `GitHub API limit reached until ${time}` : "GitHub API limit reached",
    auto: "Automatic", noAsset: "No matching asset found", current: "Current", published: "published"
  };

  const formatOptions = {
    linux: [["auto", t.auto], ["appimage", "AppImage"], ["deb", "DEB"], ["rpm", "RPM"], ["flatpak", "Flatpak"], ["snap", "Snap"], ["archive", russian ? "Архив" : "Archive"]],
    windows: [["auto", t.auto], ["exe", "EXE"], ["msi", "MSI"], ["msix", "MSIX"], ["portable", "Portable"]],
    macos: [["auto", t.auto], ["dmg", "DMG"], ["pkg", "PKG"], ["zip", "ZIP"]],
    android: [["auto", t.auto], ["apk", "APK"], ["apks", "APKS"]]
  };

  function detectPlatform() {
    const ua = navigator.userAgent || "";
    const os = /android/i.test(ua) ? "android" : /windows/i.test(ua) ? "windows" : /(macintosh|mac os x)/i.test(ua) ? "macos" : /linux/i.test(ua) ? "linux" : "linux";
    const arch = /(aarch64|arm64)/i.test(ua) ? "ARM64" : /(armv7|armv6|armhf)/i.test(ua) ? "ARM" : /(x86_64|amd64|win64|x64)/i.test(ua) ? "x64" : /(i[3-6]86|x86|win32)/i.test(ua) ? "x86" : "x64";
    return { os, arch };
  }

  function settingKey(os) { return { linux: "preferredLinux", windows: "preferredWindows", macos: "preferredMacos", android: "preferredAndroid" }[os]; }
  function el(tag, className = "", text = "") { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; }

  function send(message) {
    if (typeof browser !== "undefined") return extensionApi.runtime.sendMessage(message);
    return new Promise((resolve, reject) => {
      extensionApi.runtime.sendMessage(message, (response) => {
        const error = extensionApi.runtime.lastError;
        if (error) reject(new Error(error.message)); else resolve(response);
      });
    });
  }

  function openUrl(url) { return send({ type: "GHDN_OPEN_URL", url }); }
  function formatDate(value, relative = false) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "—";
    if (relative) {
      const diff = Date.now() - date.getTime();
      const mins = Math.max(0, Math.round(diff / 60000));
      if (mins < 2) return russian ? "только что" : "just now";
      if (mins < 60) return russian ? `${mins} мин. назад` : `${mins}m ago`;
      const hours = Math.round(mins / 60);
      if (hours < 24) return russian ? `${hours} ч. назад` : `${hours}h ago`;
      const days = Math.round(hours / 24);
      return russian ? `${days} дн. назад` : `${days}d ago`;
    }
    return date.toLocaleDateString(russian ? "ru-RU" : "en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  function formatBytes(value) {
    const bytes = Number(value) || 0;
    if (!bytes) return "";
    const units = ["KB", "MB", "GB"]; let amount = bytes / 1024; let index = 0;
    while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index += 1; }
    return `${amount >= 10 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
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
      const time = limited.resetAt ? new Date(limited.resetAt).toLocaleTimeString(russian ? "ru-RU" : "en-US", { hour: "2-digit", minute: "2-digit" }) : "";
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
    document.documentElement.lang = russian ? "ru" : "en";
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
    select.replaceChildren(...formatOptions[platform.os].map(([value, label]) => { const option = el("option", "", label); option.value = value; return option; }));
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
      if (update.assetUrl) actions.append(actionButton(t.download, async () => { await send({ type: "GHDN_DOWNLOAD_UPDATE", key: update.key }); await refresh(); }, "primary"));
      actions.append(actionButton(t.release, () => openUrl(update.releaseUrl)), actionButton(t.skip, async () => { await send({ type: "GHDN_DISMISS_UPDATE", key: update.key }); await refresh(); }));
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
      actions.append(actionButton(t.release, () => openUrl(`https://github.com/${watch.owner}/${watch.repo}/releases`)), actionButton(t.stop, async () => { await send({ type: "GHDN_UNWATCH_REPOSITORY", key: watch.key }); await refresh(); }, "danger"));
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
    const result = await send({ type: "GHDN_GET_DASHBOARD" });
    if (result && result.ok) dashboard = result;
    renderAll();
  }

  async function requestNotifications() {
    if (!extensionApi.permissions || !extensionApi.permissions.request) return false;
    if (typeof browser !== "undefined") return extensionApi.permissions.request({ permissions: ["notifications"] });
    return new Promise((resolve) => { extensionApi.permissions.request({ permissions: ["notifications"] }, resolve); });
  }

  async function init() {
    setLabels();
    document.getElementById("version").textContent = `v${extensionApi.runtime.getManifest().version}`;
    platform = detectPlatform();
    document.getElementById("detectedPlatform").textContent = `${{ linux: "Linux", windows: "Windows", macos: "macOS", android: "Android" }[platform.os]} · ${platform.arch}`;
    settings = await settingsApi.get();
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
        const result = await send({ type: "GHDN_CHECK_UPDATES" });
        await refresh();
        const summary = checkStatus(result);
        status(summary.message, summary.error);
      }
      catch (_error) { status("Error", true); }
      finally { button.disabled = false; button.textContent = t.checkNow; }
    });
    document.getElementById("clearHistory").addEventListener("click", async () => { await send({ type: "GHDN_CLEAR_HISTORY" }); await refresh(); });
    document.getElementById("openOptions").addEventListener("click", async () => {
      const result = await send({ type: "GHDN_OPEN_OPTIONS" });
      if (!result || !result.ok) status("Error", true);
    });
    await refresh();
  }

  init().catch((error) => { console.error(error); status(String(error.message || error), true); });
})();
