(function initOptionsView(root, factory) {
  const api = factory();
  root.GHDNOptionsView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createOptionsViewApi() {
  "use strict";

  function create(options = {}) {
    const document = options.document;
    const i18n = options.i18n;
    if (!document || !i18n) throw new Error("Options view dependencies are incomplete");
    let statusTimer = null;

    function setText(id, value) {
      document.getElementById(id).textContent = value;
    }

    function optionText(selectId, value, text) {
      const node = document.querySelector(`#${selectId} option[value="${value}"]`);
      if (node) node.textContent = text;
    }

    function populateLanguageOptions(strings, settings) {
      const select = document.getElementById("language");
      const selected = settings?.language || "auto";
      const options = [{ code: "auto", name: strings.browserLanguage }, ...i18n.availableLocales()];
      select.replaceChildren(...options.map(({ code, name }) => {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = name;
        return option;
      }));
      select.value = options.some((item) => item.code === selected) ? selected : "auto";
    }

    function translate(strings, settings) {
      document.documentElement.lang = strings.localeTag;
      document.title = strings.pageTitle;
      populateLanguageOptions(strings, settings);
      const labels = {
        subtitle: strings.subtitle,
        generalTitle: strings.general,
        languageLabel: strings.language,
        showOnLabel: strings.showOn,
        buttonStyleLabel: strings.buttonStyle,
        primaryActionLabel: strings.primaryAction,
        installGuidanceLabel: strings.installGuidance,
        enabledLabel: strings.enabled,
        showSubtitleLabel: strings.subtitleToggle,
        showOtherPlatformsLabel: strings.otherPlatforms,
        showSourceCodeLabel: strings.sourceCode,
        showRecommendationReasonLabel: strings.reasons,
        systemTitle: strings.system,
        systemNote: strings.systemNote,
        osOverrideLabel: strings.os,
        archOverrideLabel: strings.arch,
        formatsTitle: strings.formats,
        releasesTitle: strings.releases,
        releaseChannelLabel: strings.channel,
        staleReleaseLabel: strings.stale,
        updatesSettingsTitle: strings.updatesTitle,
        updatesSettingsNote: strings.updatesNote,
        afterDownloadLabel: strings.afterDownload,
        updateCheckIntervalLabel: strings.interval,
        historyEnabledLabel: strings.historyEnabled,
        notificationsEnabledLabel: strings.notifications,
        badgeEnabledLabel: strings.badge,
        checkUpdatesNow: strings.checkNow,
        clearHistory: strings.clearHistory,
        clearTracking: strings.clearTracking,
        reset: strings.reset,
        githubAuthTitle: strings.authTitle,
        githubAuthNote: strings.authNote,
        githubAuthBenefitLimit: strings.authBenefitLimit,
        githubAuthBenefitDiscovery: strings.authBenefitDiscovery,
        githubAuthBenefitPrivacy: strings.authBenefitPrivacy,
        githubAuthConnect: strings.authConnect,
        githubAuthDisconnect: strings.authDisconnect,
        githubAuthOpenDevice: strings.authOpen,
        githubAuthCodeLabel: strings.authCodeLabel,
        githubAuthPendingNote: strings.authPendingNote
      };
      for (const [id, value] of Object.entries(labels)) setText(id, value);
      optionText("showOn", "all", strings.all);
      optionText("showOn", "main_releases", strings.mainReleases);
      optionText("showOn", "main", strings.main);
      optionText("buttonStyle", "accent", strings.accent);
      optionText("buttonStyle", "native", strings.native);
      optionText("buttonStyle", "compact", strings.compact);
      optionText("primaryAction", "download", strings.download);
      optionText("primaryAction", "menu", strings.menu);
      optionText("primaryAction", "release", strings.release);
      optionText("installGuidance", "beginner", strings.guidanceBeginner);
      optionText("installGuidance", "compact", strings.guidanceCompact);
      optionText("installGuidance", "off", strings.guidanceOff);
      optionText("releaseChannel", "stable", strings.stable);
      optionText("releaseChannel", "newest", strings.newest);
      for (const id of ["osOverride", "archOverride", "preferredLinux", "preferredWindows", "preferredMacos", "preferredAndroid"]) {
        optionText(id, "auto", strings.auto);
      }
      optionText("preferredLinux", "archive", strings.archive);
      optionText("staleReleaseMonths", "0", strings.never);
      for (const value of ["3", "6", "12", "24", "36"]) optionText("staleReleaseMonths", value, strings.months(value));
      optionText("afterDownload", "ask", strings.ask);
      optionText("afterDownload", "always", strings.always);
      optionText("afterDownload", "never", strings.neverAsk);
      optionText("updateCheckInterval", "manual", strings.manual);
      optionText("updateCheckInterval", "6h", strings.h6);
      optionText("updateCheckInterval", "24h", strings.h24);
      optionText("updateCheckInterval", "72h", strings.h72);
      optionText("updateCheckInterval", "168h", strings.h168);
    }

    function status(message, error = false) {
      const node = document.getElementById("status");
      node.textContent = message;
      node.classList.toggle("error", Boolean(error));
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => {
        node.textContent = "";
        node.classList.remove("error");
      }, 1800);
    }

    return Object.freeze({ optionText, setText, status, translate });
  }

  return Object.freeze({ create });
});
