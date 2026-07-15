"use strict";

(() => {
  const extensionApi = typeof browser !== "undefined" ? browser : chrome;
  const settingsApi = globalThis.GHDNSettings;
  const DEVICE_URL = "https://github.com/login/device";
  let settings;
  let saveTimer;
  let authPollTimer;
  let authState = { connected: false, pending: null };

  const dictionaries = {
    ru: {
      subtitle: "Настройка рекомендаций, интерфейса и фоновой проверки обновлений.", general: "Общие настройки", language: "Язык", showOn: "Где показывать кнопку",
      all: "На всех страницах репозитория", mainReleases: "На главной и в Releases", main: "Только на главной",
      buttonStyle: "Стиль кнопки", accent: "Зелёная акцентная", native: "Нативная GitHub", compact: "Компактная",
      primaryAction: "Нажатие основной кнопки", download: "Скачать рекомендацию", menu: "Всегда открыть меню", release: "Открыть страницу Releases",
      installGuidance: "Подсказки по установке", guidanceBeginner: "Показывать после загрузки и в меню", guidanceCompact: "Только по запросу в меню", guidanceOff: "Не показывать",
      enabled: "Расширение включено", subtitleToggle: "Показывать ОС и архитектуру", otherPlatforms: "Показывать другие платформы",
      sourceCode: "Показывать исходный код", reasons: "Объяснять рекомендацию", system: "Система и архитектура",
      systemNote: "Оставьте автоопределение, если расширение правильно распознаёт ваше устройство.", os: "Операционная система", arch: "Архитектура",
      auto: "Автоматически", browserLanguage: "Как в браузере", formats: "Предпочитаемые форматы", archive: "Архив", releases: "Релизы", channel: "Какой релиз использовать",
      stable: "Последний стабильный", newest: "Самый новый, включая prerelease", stale: "Предупреждать, если релиз старше", never: "Не предупреждать",
      months: "месяцев", saved: "Сохранено", reset: "Сбросить настройки", resetDone: "Настройки сброшены",
      updatesTitle: "История и обновления", updatesNote: "История и список отслеживания хранятся локально на этом устройстве.",
      afterDownload: "После загрузки", ask: "Спрашивать о слежении", always: "Всегда начинать слежение", neverAsk: "Никогда не предлагать",
      interval: "Проверять обновления", manual: "Только вручную", h6: "Каждые 6 часов", h24: "Раз в день", h72: "Раз в 3 дня", h168: "Раз в неделю",
      historyEnabled: "Записывать загрузки через расширение", notifications: "Показывать системные уведомления", badge: "Показывать счётчик на иконке",
      checkNow: "Проверить обновления", clearHistory: "Очистить историю", clearTracking: "Удалить все подписки", checking: "Проверка…", permissionDenied: "Разрешение на уведомления не выдано",
      checkSummary: (found, failed, checked, total) => `Найдено: ${found} · Ошибок: ${failed}${total ? ` · Проверено: ${checked} из ${total}` : ""}`, rateLimited: (time) => time ? `Лимит GitHub API исчерпан до ${time}` : "Лимит GitHub API исчерпан",
      authTitle: "Подключение GitHub", authNote: "Необязательно. Официальная авторизация GitHub повышает API-лимит и делает поиск связанных инструкций и проверку обновлений стабильнее.",
      authBenefitLimit: "До 5 000 API-запросов в час вместо общего анонимного лимита.",
      authBenefitDiscovery: "Надёжнее находит инструкции в связанных README и проверяет отслеживаемые репозитории.",
      authBenefitPrivacy: "Без пароля и cookies. Приватные репозитории не читаются; токен хранится локально и не синхронизируется. Отключение удаляет локальную копию.",
      authOptional: "Необязательно", authConnected: "Подключено", authWaiting: "Ожидает подтверждения",
      authConnect: "Подключить GitHub", authDisconnect: "Отключить на этом устройстве", authOpen: "Открыть GitHub",
      authCodeLabel: "Одноразовый код", authPendingNote: "Введите код на официальной странице GitHub. Расширение проверит подключение автоматически.",
      authAccount: "GitHub подключён", authRate: (remaining, limit) => Number.isFinite(remaining) && Number.isFinite(limit) ? `GitHub API: ${remaining.toLocaleString("ru-RU")} из ${limit.toLocaleString("ru-RU")} осталось` : "GitHub API подключён",
      authStarting: "Запрашиваем одноразовый код…", authChecking: "Ожидаем подтверждения на GitHub…", authDone: "GitHub успешно подключён.", authRemoved: "Подключение GitHub удалено с этого устройства.",
      authError: "Не удалось подключить GitHub. Повторите попытку.", authDenied: "Подключение отменено на GitHub.", authExpired: "Одноразовый код истёк. Начните подключение заново.", authConsentDenied: "Без разрешения на передачу данных авторизации GitHub подключение не выполняется."
    },
    en: {
      subtitle: "Configure recommendations, interface and background update checks.", general: "General", language: "Language", showOn: "Where to show the button",
      all: "All repository pages", mainReleases: "Repository home and Releases", main: "Repository home only",
      buttonStyle: "Button style", accent: "Green accent", native: "Native GitHub", compact: "Compact",
      primaryAction: "Main button action", download: "Download recommendation", menu: "Always open menu", release: "Open Releases page",
      installGuidance: "Installation guidance", guidanceBeginner: "Show after download and in the menu", guidanceCompact: "Only on request in the menu", guidanceOff: "Do not show",
      enabled: "Extension enabled", subtitleToggle: "Show OS and architecture", otherPlatforms: "Show other platforms",
      sourceCode: "Show source code", reasons: "Explain recommendations", system: "System and architecture",
      systemNote: "Keep automatic detection unless the extension identifies your device incorrectly.", os: "Operating system", arch: "Architecture",
      auto: "Automatic", browserLanguage: "Browser language", formats: "Preferred formats", archive: "Archive", releases: "Releases", channel: "Release selection",
      stable: "Latest stable", newest: "Newest, including prerelease", stale: "Warn when release is older than", never: "Never warn",
      months: "months", saved: "Saved", reset: "Reset settings", resetDone: "Settings reset",
      updatesTitle: "History and updates", updatesNote: "Download history and watched repositories are stored locally on this device.",
      afterDownload: "After a download", ask: "Ask whether to watch", always: "Always start watching", neverAsk: "Never ask",
      interval: "Check for updates", manual: "Manual only", h6: "Every 6 hours", h24: "Once a day", h72: "Every 3 days", h168: "Once a week",
      historyEnabled: "Record downloads made through the extension", notifications: "Show system notifications", badge: "Show toolbar badge",
      checkNow: "Check for updates", clearHistory: "Clear history", clearTracking: "Remove all watches", checking: "Checking…", permissionDenied: "Notification permission was not granted",
      checkSummary: (found, failed, checked, total) => `Found: ${found} · Failed: ${failed}${total ? ` · Checked: ${checked} of ${total}` : ""}`, rateLimited: (time) => time ? `GitHub API limit reached until ${time}` : "GitHub API limit reached",
      authTitle: "Connect GitHub", authNote: "Optional. Official GitHub authorization raises the API limit and makes linked-instruction discovery and update checks more reliable.",
      authBenefitLimit: "Up to 5,000 API requests per hour instead of the shared anonymous limit.",
      authBenefitDiscovery: "More reliable discovery of instructions in linked READMEs and checks for watched repositories.",
      authBenefitPrivacy: "No password or cookies. Private repositories are not read; the token stays local and is not synced. Disconnect removes the local copy.",
      authOptional: "Optional", authConnected: "Connected", authWaiting: "Waiting for approval",
      authConnect: "Connect GitHub", authDisconnect: "Disconnect on this device", authOpen: "Open GitHub",
      authCodeLabel: "One-time code", authPendingNote: "Enter the code on the official GitHub page. The extension will detect approval automatically.",
      authAccount: "GitHub connected", authRate: (remaining, limit) => Number.isFinite(remaining) && Number.isFinite(limit) ? `GitHub API: ${remaining.toLocaleString("en-US")} of ${limit.toLocaleString("en-US")} remaining` : "GitHub API connected",
      authStarting: "Requesting a one-time code…", authChecking: "Waiting for approval on GitHub…", authDone: "GitHub connected successfully.", authRemoved: "The GitHub connection was removed from this device.",
      authError: "GitHub could not be connected. Please try again.", authDenied: "Connection was cancelled on GitHub.", authExpired: "The one-time code expired. Start the connection again.", authConsentDenied: "GitHub cannot be connected without permission to transmit authentication information."
    }
  };

  const fields = ["enabled","language","osOverride","archOverride","preferredLinux","preferredWindows","preferredMacos","preferredAndroid","primaryAction","installGuidance","buttonStyle","showSubtitle","showOtherPlatforms","showSourceCode","showRecommendationReason","releaseChannel","staleReleaseMonths","showOn","historyEnabled","afterDownload","updateCheckInterval","notificationsEnabled","badgeEnabled"];

  function locale() {
    if (settings && settings.language === "ru") return "ru";
    if (settings && settings.language === "en") return "en";
    return /^(ru|uk|be|kk)(-|$)/i.test(navigator.language || "") ? "ru" : "en";
  }

  function setText(id, value) { document.getElementById(id).textContent = value; }
  function optionText(selectId, value, text) { const node = document.querySelector(`#${selectId} option[value="${value}"]`); if (node) node.textContent = text; }

  function translate() {
    const t = dictionaries[locale()];
    document.documentElement.lang = locale();
    document.title = `GitHub Download Now — ${locale() === "ru" ? "Настройки" : "Settings"}`;
    const labels = {
      subtitle:t.subtitle,generalTitle:t.general,languageLabel:t.language,showOnLabel:t.showOn,buttonStyleLabel:t.buttonStyle,primaryActionLabel:t.primaryAction,installGuidanceLabel:t.installGuidance,
      enabledLabel:t.enabled,showSubtitleLabel:t.subtitleToggle,showOtherPlatformsLabel:t.otherPlatforms,showSourceCodeLabel:t.sourceCode,showRecommendationReasonLabel:t.reasons,
      systemTitle:t.system,systemNote:t.systemNote,osOverrideLabel:t.os,archOverrideLabel:t.arch,formatsTitle:t.formats,releasesTitle:t.releases,releaseChannelLabel:t.channel,staleReleaseLabel:t.stale,
      updatesSettingsTitle:t.updatesTitle,updatesSettingsNote:t.updatesNote,afterDownloadLabel:t.afterDownload,updateCheckIntervalLabel:t.interval,historyEnabledLabel:t.historyEnabled,
      notificationsEnabledLabel:t.notifications,badgeEnabledLabel:t.badge,checkUpdatesNow:t.checkNow,clearHistory:t.clearHistory,clearTracking:t.clearTracking,reset:t.reset,
      githubAuthTitle:t.authTitle,githubAuthNote:t.authNote,githubAuthBenefitLimit:t.authBenefitLimit,githubAuthBenefitDiscovery:t.authBenefitDiscovery,githubAuthBenefitPrivacy:t.authBenefitPrivacy,
      githubAuthConnect:t.authConnect,githubAuthDisconnect:t.authDisconnect,githubAuthOpenDevice:t.authOpen,githubAuthCodeLabel:t.authCodeLabel,githubAuthPendingNote:t.authPendingNote
    };
    for (const [id,value] of Object.entries(labels)) setText(id,value);
    optionText("showOn","all",t.all); optionText("showOn","main_releases",t.mainReleases); optionText("showOn","main",t.main);
    optionText("buttonStyle","accent",t.accent); optionText("buttonStyle","native",t.native); optionText("buttonStyle","compact",t.compact);
    optionText("primaryAction","download",t.download); optionText("primaryAction","menu",t.menu); optionText("primaryAction","release",t.release);
    optionText("installGuidance","beginner",t.guidanceBeginner); optionText("installGuidance","compact",t.guidanceCompact); optionText("installGuidance","off",t.guidanceOff);
    optionText("releaseChannel","stable",t.stable); optionText("releaseChannel","newest",t.newest); optionText("language","auto",t.browserLanguage);
    for (const id of ["osOverride","archOverride","preferredLinux","preferredWindows","preferredMacos","preferredAndroid"]) optionText(id,"auto",t.auto);
    optionText("preferredLinux","archive",t.archive); optionText("staleReleaseMonths","0",t.never);
    for (const value of ["3","6","12","24","36"]) optionText("staleReleaseMonths",value,`${value} ${t.months}`);
    optionText("afterDownload","ask",t.ask); optionText("afterDownload","always",t.always); optionText("afterDownload","never",t.neverAsk);
    optionText("updateCheckInterval","manual",t.manual); optionText("updateCheckInterval","6h",t.h6); optionText("updateCheckInterval","24h",t.h24); optionText("updateCheckInterval","72h",t.h72); optionText("updateCheckInterval","168h",t.h168);
    renderAuth(authState);
  }

  function fill() {
    for (const key of fields) {
      const node = document.getElementById(key);
      if (node.type === "checkbox") node.checked = Boolean(settings[key]);
      else node.value = String(settings[key]);
    }
  }

  function collect() {
    const patch = {};
    for (const key of fields) {
      const node = document.getElementById(key);
      patch[key] = node.type === "checkbox" ? node.checked : node.value;
    }
    patch.staleReleaseMonths = Number(patch.staleReleaseMonths);
    return patch;
  }

  function status(message) {
    setText("status", message);
    clearTimeout(status.timer);
    status.timer = setTimeout(() => setText("status", ""), 1800);
  }

  function send(message) {
    if (typeof browser !== "undefined") return extensionApi.runtime.sendMessage(message);
    return new Promise((resolve,reject) => {
      extensionApi.runtime.sendMessage(message, (response) => {
        const error = extensionApi.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(response);
      });
    });
  }

  async function requestNotifications() {
    if (!extensionApi.permissions || !extensionApi.permissions.request) return false;
    if (typeof browser !== "undefined") return extensionApi.permissions.request({permissions:["notifications"]});
    return new Promise((resolve) => { extensionApi.permissions.request({permissions:["notifications"]}, resolve); });
  }

  async function requestGitHubAuthConsent() {
    if (!extensionApi.permissions || !extensionApi.permissions.getAll || !extensionApi.permissions.request) return true;
    let current;
    if (typeof browser !== "undefined") current = await extensionApi.permissions.getAll();
    else current = await new Promise((resolve) => {
      extensionApi.permissions.getAll(resolve);
    });
    if (!current || !Array.isArray(current.data_collection)) return true;
    if (current.data_collection.includes("authenticationInfo")) return true;
    if (typeof browser !== "undefined") return extensionApi.permissions.request({ data_collection: ["authenticationInfo"] });
    return new Promise((resolve) => {
      extensionApi.permissions.request(
        { data_collection: ["authenticationInfo"] },
        resolve
      );
    });
  }

  async function save() {
    settings = await settingsApi.set(collect());
    translate();
    status(dictionaries[locale()].saved);
  }

  function authMessage(message, error = false) {
    const node = document.getElementById("githubAuthMessage");
    node.textContent = message || "";
    node.classList.toggle("error", Boolean(error));
  }

  function renderAuth(value) {
    authState = value && typeof value === "object" ? value : { connected: false, pending: null };
    const t = dictionaries[locale()];
    const connected = Boolean(authState.connected);
    const pending = !connected && authState.pending;
    document.getElementById("githubAuthDisconnected").hidden = connected || Boolean(pending);
    document.getElementById("githubAuthPending").hidden = !pending;
    document.getElementById("githubAuthConnected").hidden = !connected;
    setText("githubAuthBadge", connected ? t.authConnected : pending ? t.authWaiting : t.authOptional);
    if (pending) setText("githubAuthCode", pending.userCode || "—");
    if (connected) {
      setText("githubAuthAccount", t.authAccount);
      const rate = authState.rateLimit || {};
      setText("githubAuthRate", t.authRate(Number(rate.remaining), Number(rate.limit)));
    }
  }

  function authErrorText(error) {
    const t = dictionaries[locale()];
    if (error === "access_denied") return t.authDenied;
    if (error === "expired_token" || error === "no_pending_authorization") return t.authExpired;
    return t.authError;
  }

  function stopAuthPolling() {
    clearTimeout(authPollTimer);
    authPollTimer = null;
  }

  function scheduleAuthPoll(delay = 2000) {
    stopAuthPolling();
    authPollTimer = setTimeout(() => pollAuthorization().catch(console.error), Math.max(1000, delay));
  }

  async function pollAuthorization() {
    const result = await send({ type: "GHDN_AUTH_POLL" });
    if (!result || !result.ok) {
      stopAuthPolling();
      authMessage(authErrorText(result && result.error), true);
      renderAuth({ connected: false, pending: null });
      return;
    }
    renderAuth(result);
    if (result.connected) {
      stopAuthPolling();
      authMessage(dictionaries[locale()].authDone);
      return;
    }
    authMessage(dictionaries[locale()].authChecking);
    scheduleAuthPoll(Number(result.retryAfterMs) || 2000);
  }

  async function loadAuthStatus(refresh = false) {
    const result = await send({ type: "GHDN_AUTH_STATUS", refresh });
    if (!result || !result.ok) {
      authMessage(authErrorText(result && result.error), true);
      return;
    }
    renderAuth(result);
    if (result.pending) {
      authMessage(dictionaries[locale()].authChecking);
      scheduleAuthPoll(1000);
    }
  }

  async function init() {
    settings = await settingsApi.get();
    translate();
    fill();
    for (const key of fields) {
      const node = document.getElementById(key);
      node.addEventListener("change", async () => {
        if (key === "notificationsEnabled" && node.checked && !(await requestNotifications())) {
          node.checked = false;
          status(dictionaries[locale()].permissionDenied);
        }
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => save().catch(console.error), 120);
      });
    }

    document.getElementById("githubAuthConnect").addEventListener("click", async () => {
      const button = document.getElementById("githubAuthConnect");
      button.disabled = true;
      authMessage(dictionaries[locale()].authStarting);
      try {
        if (!(await requestGitHubAuthConsent())) {
          authMessage(dictionaries[locale()].authConsentDenied, true);
          return;
        }
        const result = await send({ type: "GHDN_AUTH_START" });
        if (!result || !result.ok) {
          authMessage(authErrorText(result && result.error), true);
          return;
        }
        renderAuth(result);
        authMessage(dictionaries[locale()].authChecking);
        scheduleAuthPoll(1000);
      } finally {
        button.disabled = false;
      }
    });

    document.getElementById("githubAuthOpenDevice").addEventListener("click", () => {
      window.open(DEVICE_URL, "_blank", "noopener,noreferrer");
    });

    document.getElementById("githubAuthDisconnect").addEventListener("click", async () => {
      const result = await send({ type: "GHDN_AUTH_DISCONNECT" });
      stopAuthPolling();
      renderAuth(result && result.ok ? result : { connected: false, pending: null });
      authMessage(result && result.ok ? dictionaries[locale()].authRemoved : authErrorText(result && result.error), !(result && result.ok));
    });

    document.getElementById("checkUpdatesNow").addEventListener("click", async () => {
      const button = document.getElementById("checkUpdatesNow");
      button.disabled = true;
      button.textContent = dictionaries[locale()].checking;
      try {
        const result = await send({type:"GHDN_CHECK_UPDATES"});
        const errors = result && Array.isArray(result.errors) ? result.errors : [];
        const limited = errors.find((item) => item && item.error === "rate_limited");
        if (limited) {
          const time = limited.resetAt ? new Date(limited.resetAt).toLocaleTimeString(locale() === "ru" ? "ru-RU" : "en-US", {hour:"2-digit",minute:"2-digit"}) : "";
          status(dictionaries[locale()].rateLimited(time));
        } else {
          const found = result && Array.isArray(result.detected) ? result.detected.length : 0;
          status(dictionaries[locale()].checkSummary(found, errors.length, Number(result.checked) || 0, Number(result.total) || 0));
        }
      } finally {
        button.disabled = false;
        button.textContent = dictionaries[locale()].checkNow;
      }
    });
    document.getElementById("clearHistory").addEventListener("click", async () => { await send({type:"GHDN_CLEAR_HISTORY"}); status(dictionaries[locale()].saved); });
    document.getElementById("clearTracking").addEventListener("click", async () => { await send({type:"GHDN_CLEAR_TRACKING"}); status(dictionaries[locale()].saved); });
    document.getElementById("reset").addEventListener("click", async () => { settings = await settingsApi.reset(); translate(); fill(); status(dictionaries[locale()].resetDone); });

    await loadAuthStatus(true);
  }

  window.addEventListener("pagehide", stopAuthPolling);
  init().catch(console.error);
})();
