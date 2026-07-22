"use strict";

(() => {
  const extensionApi = typeof browser !== "undefined" ? browser : chrome;
  const settingsApi = globalThis.GHDNSettings;
  const i18n = globalThis.GHDNI18n;
  const DEVICE_URL = "https://github.com/login/device";
  let settings;
  let saveTimer;
  let authPollTimer;
  let authState = { connected: false, pending: null };

  function translator() {
    return i18n.create(settings?.language || "auto", navigator.language || "");
  }

  function strings() {
    const tr = translator();
    const t = tr.t;
    return {
      locale: tr.locale,
      localeTag: tr.tag,
      pageTitle: t("optionsPageTitle"),
      subtitle: t("optionsSubtitle"), general: t("optionsGeneral"), language: t("optionsLanguage"), showOn: t("optionsShowOn"),
      all: t("optionsShowOnAll"), mainReleases: t("optionsShowOnMainReleases"), main: t("optionsShowOnMain"),
      buttonStyle: t("optionsButtonStyle"), accent: t("optionsButtonAccent"), native: t("optionsButtonNative"), compact: t("optionsButtonCompact"),
      primaryAction: t("optionsPrimaryAction"), download: t("optionsActionDownload"), menu: t("optionsActionMenu"), release: t("optionsActionRelease"),
      installGuidance: t("optionsInstallGuidance"), guidanceBeginner: t("optionsGuidanceBeginner"), guidanceCompact: t("optionsGuidanceCompact"), guidanceOff: t("optionsGuidanceOff"),
      enabled: t("optionsEnabled"), subtitleToggle: t("optionsShowSubtitle"), otherPlatforms: t("optionsOtherPlatforms"),
      sourceCode: t("optionsSourceCode"), reasons: t("optionsReasons"), system: t("optionsSystem"),
      systemNote: t("optionsSystemNote"), os: t("optionsOs"), arch: t("optionsArch"),
      auto: t("commonAutomatic"), browserLanguage: t("optionsBrowserLanguage"), formats: t("optionsFormats"), archive: t("commonArchive"), releases: t("optionsReleases"), channel: t("optionsChannel"),
      stable: t("optionsStable"), newest: t("optionsNewest"), stale: t("optionsStale"), never: t("optionsNever"),
      months: (count) => t(`optionsMonths${({ one: "One", few: "Few", many: "Many", other: "Other" })[tr.pluralCategory(count)] || "Other"}`, [count]), saved: t("commonSaved"), reset: t("optionsReset"), resetDone: t("optionsResetDone"),
      updatesTitle: t("optionsUpdatesTitle"), updatesNote: t("optionsUpdatesNote"),
      afterDownload: t("optionsAfterDownload"), ask: t("optionsAsk"), always: t("optionsAlways"), neverAsk: t("optionsNeverAsk"),
      interval: t("optionsInterval"), manual: t("optionsManual"), h6: t("optionsEvery6Hours"), h24: t("optionsDaily"), h72: t("optionsEvery3Days"), h168: t("optionsWeekly"),
      historyEnabled: t("optionsHistoryEnabled"), notifications: t("optionsNotifications"), badge: t("optionsBadge"),
      checkNow: t("optionsCheckNow"), clearHistory: t("optionsClearHistory"), clearTracking: t("optionsClearTracking"), checking: t("optionsChecking"), permissionDenied: t("optionsPermissionDenied"),
      checkSummary: (found, failed, checked, total) => t("optionsCheckSummary", [found, failed]) + (total ? t("optionsCheckProgress", [checked, total]) : ""),
      rateLimited: (time) => time ? t("optionsRateLimitedUntil", [time]) : t("optionsRateLimited"),
      authTitle: t("optionsAuthTitle"), authNote: t("optionsAuthNote"),
      authBenefitLimit: t("optionsAuthBenefitLimit"), authBenefitDiscovery: t("optionsAuthBenefitDiscovery"), authBenefitPrivacy: t("optionsAuthBenefitPrivacy"),
      authOptional: t("optionsAuthOptional"), authConnected: t("optionsAuthConnected"), authWaiting: t("optionsAuthWaiting"),
      authConnect: t("optionsAuthConnect"), authDisconnect: t("optionsAuthDisconnect"), authOpen: t("optionsAuthOpen"),
      authCodeLabel: t("optionsAuthCodeLabel"), authPendingNote: t("optionsAuthPendingNote"), authAccount: t("optionsAuthAccount"),
      authRate: (remaining, limit) => Number.isFinite(remaining) && Number.isFinite(limit)
        ? t("optionsAuthRate", [tr.number(remaining), tr.number(limit)])
        : t("optionsAuthRateFallback"),
      authStarting: t("optionsAuthStarting"), authChecking: t("optionsAuthChecking"), authDone: t("optionsAuthDone"), authRemoved: t("optionsAuthRemoved"),
      authError: t("optionsAuthError"), authDenied: t("optionsAuthDenied"), authExpired: t("optionsAuthExpired"), authConsentDenied: t("optionsAuthConsentDenied")
    };
  }

  const fields = ["enabled","language","osOverride","archOverride","preferredLinux","preferredWindows","preferredMacos","preferredAndroid","primaryAction","installGuidance","buttonStyle","showSubtitle","showOtherPlatforms","showSourceCode","showRecommendationReason","releaseChannel","staleReleaseMonths","showOn","historyEnabled","afterDownload","updateCheckInterval","notificationsEnabled","badgeEnabled"];

  function setText(id, value) { document.getElementById(id).textContent = value; }
  function optionText(selectId, value, text) { const node = document.querySelector(`#${selectId} option[value="${value}"]`); if (node) node.textContent = text; }

  function populateLanguageOptions(t) {
    const select = document.getElementById("language");
    const selected = settings?.language || "auto";
    const options = [{ code: "auto", name: t.browserLanguage }, ...i18n.availableLocales()];
    select.replaceChildren(...options.map(({ code, name }) => {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = name;
      return option;
    }));
    select.value = options.some((item) => item.code === selected) ? selected : "auto";
  }

  function translate() {
    const t = strings();
    document.documentElement.lang = t.localeTag;
    document.title = t.pageTitle;
    populateLanguageOptions(t);
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
    optionText("releaseChannel","stable",t.stable); optionText("releaseChannel","newest",t.newest);
    for (const id of ["osOverride","archOverride","preferredLinux","preferredWindows","preferredMacos","preferredAndroid"]) optionText(id,"auto",t.auto);
    optionText("preferredLinux","archive",t.archive); optionText("staleReleaseMonths","0",t.never);
    for (const value of ["3","6","12","24","36"]) optionText("staleReleaseMonths",value,t.months(value));
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
    status(strings().saved);
  }

  function authMessage(message, error = false) {
    const node = document.getElementById("githubAuthMessage");
    node.textContent = message || "";
    node.classList.toggle("error", Boolean(error));
  }

  function renderAuth(value) {
    authState = value && typeof value === "object" ? value : { connected: false, pending: null };
    const t = strings();
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
    const t = strings();
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
      authMessage(strings().authDone);
      return;
    }
    authMessage(strings().authChecking);
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
      authMessage(strings().authChecking);
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
          status(strings().permissionDenied);
        }
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => save().catch(console.error), 120);
      });
    }

    document.getElementById("githubAuthConnect").addEventListener("click", async () => {
      const button = document.getElementById("githubAuthConnect");
      button.disabled = true;
      authMessage(strings().authStarting);
      try {
        if (!(await requestGitHubAuthConsent())) {
          authMessage(strings().authConsentDenied, true);
          return;
        }
        const result = await send({ type: "GHDN_AUTH_START" });
        if (!result || !result.ok) {
          authMessage(authErrorText(result && result.error), true);
          return;
        }
        renderAuth(result);
        authMessage(strings().authChecking);
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
      authMessage(result && result.ok ? strings().authRemoved : authErrorText(result && result.error), !(result && result.ok));
    });

    document.getElementById("checkUpdatesNow").addEventListener("click", async () => {
      const button = document.getElementById("checkUpdatesNow");
      button.disabled = true;
      button.textContent = strings().checking;
      try {
        const result = await send({type:"GHDN_CHECK_UPDATES"});
        const errors = result && Array.isArray(result.errors) ? result.errors : [];
        const limited = errors.find((item) => item && item.error === "rate_limited");
        if (limited) {
          const time = limited.resetAt ? new Date(limited.resetAt).toLocaleTimeString(strings().localeTag, {hour:"2-digit",minute:"2-digit"}) : "";
          status(strings().rateLimited(time));
        } else {
          const found = result && Array.isArray(result.detected) ? result.detected.length : 0;
          status(strings().checkSummary(found, errors.length, Number(result.checked) || 0, Number(result.total) || 0));
        }
      } finally {
        button.disabled = false;
        button.textContent = strings().checkNow;
      }
    });
    document.getElementById("clearHistory").addEventListener("click", async () => { await send({type:"GHDN_CLEAR_HISTORY"}); status(strings().saved); });
    document.getElementById("clearTracking").addEventListener("click", async () => { await send({type:"GHDN_CLEAR_TRACKING"}); status(strings().saved); });
    document.getElementById("reset").addEventListener("click", async () => { settings = await settingsApi.reset(); translate(); fill(); status(strings().resetDone); });

    await loadAuthStatus(true);
  }

  window.addEventListener("pagehide", stopAuthPolling);
  init().catch(console.error);
})();
