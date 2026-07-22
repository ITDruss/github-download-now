(function initOptionsStrings(root, factory) {
  const api = factory();
  root.GHDNOptionsStrings = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createOptionsStringsApi() {
  "use strict";

  function create(i18n, language, browserLanguage = "") {
    if (!i18n || typeof i18n.create !== "function") {
      throw new Error("Options strings require the i18n API");
    }
    const translator = i18n.create(language || "auto", browserLanguage);
    const t = translator.t;
    const strings = Object.freeze({
      locale: translator.locale,
      localeTag: translator.tag,
      pageTitle: t("optionsPageTitle"),
      subtitle: t("optionsSubtitle"),
      general: t("optionsGeneral"),
      language: t("optionsLanguage"),
      showOn: t("optionsShowOn"),
      all: t("optionsShowOnAll"),
      mainReleases: t("optionsShowOnMainReleases"),
      main: t("optionsShowOnMain"),
      buttonStyle: t("optionsButtonStyle"),
      accent: t("optionsButtonAccent"),
      native: t("optionsButtonNative"),
      compact: t("optionsButtonCompact"),
      primaryAction: t("optionsPrimaryAction"),
      download: t("optionsActionDownload"),
      menu: t("optionsActionMenu"),
      release: t("optionsActionRelease"),
      installGuidance: t("optionsInstallGuidance"),
      guidanceBeginner: t("optionsGuidanceBeginner"),
      guidanceCompact: t("optionsGuidanceCompact"),
      guidanceOff: t("optionsGuidanceOff"),
      enabled: t("optionsEnabled"),
      subtitleToggle: t("optionsShowSubtitle"),
      otherPlatforms: t("optionsOtherPlatforms"),
      sourceCode: t("optionsSourceCode"),
      reasons: t("optionsReasons"),
      system: t("optionsSystem"),
      systemNote: t("optionsSystemNote"),
      os: t("optionsOs"),
      arch: t("optionsArch"),
      auto: t("commonAutomatic"),
      browserLanguage: t("optionsBrowserLanguage"),
      formats: t("optionsFormats"),
      archive: t("commonArchive"),
      releases: t("optionsReleases"),
      channel: t("optionsChannel"),
      stable: t("optionsStable"),
      newest: t("optionsNewest"),
      stale: t("optionsStale"),
      never: t("optionsNever"),
      months: (count) => t(`optionsMonths${({
        one: "One",
        few: "Few",
        many: "Many",
        other: "Other"
      })[translator.pluralCategory(count)] || "Other"}`, [count]),
      saved: t("commonSaved"),
      reset: t("optionsReset"),
      resetDone: t("optionsResetDone"),
      updatesTitle: t("optionsUpdatesTitle"),
      updatesNote: t("optionsUpdatesNote"),
      afterDownload: t("optionsAfterDownload"),
      ask: t("optionsAsk"),
      always: t("optionsAlways"),
      neverAsk: t("optionsNeverAsk"),
      interval: t("optionsInterval"),
      manual: t("optionsManual"),
      h6: t("optionsEvery6Hours"),
      h24: t("optionsDaily"),
      h72: t("optionsEvery3Days"),
      h168: t("optionsWeekly"),
      historyEnabled: t("optionsHistoryEnabled"),
      notifications: t("optionsNotifications"),
      badge: t("optionsBadge"),
      checkNow: t("optionsCheckNow"),
      clearHistory: t("optionsClearHistory"),
      clearTracking: t("optionsClearTracking"),
      checking: t("optionsChecking"),
      permissionDenied: t("optionsPermissionDenied"),
      checkSummary: (found, failed, checked, total) => t("optionsCheckSummary", [found, failed]) + (total ? t("optionsCheckProgress", [checked, total]) : ""),
      rateLimited: (time) => time ? t("optionsRateLimitedUntil", [time]) : t("optionsRateLimited"),
      authTitle: t("optionsAuthTitle"),
      authNote: t("optionsAuthNote"),
      authBenefitLimit: t("optionsAuthBenefitLimit"),
      authBenefitDiscovery: t("optionsAuthBenefitDiscovery"),
      authBenefitPrivacy: t("optionsAuthBenefitPrivacy"),
      authOptional: t("optionsAuthOptional"),
      authConnected: t("optionsAuthConnected"),
      authWaiting: t("optionsAuthWaiting"),
      authConnect: t("optionsAuthConnect"),
      authDisconnect: t("optionsAuthDisconnect"),
      authOpen: t("optionsAuthOpen"),
      authCodeLabel: t("optionsAuthCodeLabel"),
      authPendingNote: t("optionsAuthPendingNote"),
      authAccount: t("optionsAuthAccount"),
      authRate: (remaining, limit) => Number.isFinite(remaining) && Number.isFinite(limit)
        ? t("optionsAuthRate", [translator.number(remaining), translator.number(limit)])
        : t("optionsAuthRateFallback"),
      authStarting: t("optionsAuthStarting"),
      authChecking: t("optionsAuthChecking"),
      authDone: t("optionsAuthDone"),
      authRemoved: t("optionsAuthRemoved"),
      authError: t("optionsAuthError"),
      authDenied: t("optionsAuthDenied"),
      authExpired: t("optionsAuthExpired"),
      authConsentDenied: t("optionsAuthConsentDenied")
    });
    return Object.freeze({ translator, strings });
  }

  return Object.freeze({ create });
});
