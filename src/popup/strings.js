(function initPopupStrings(root, factory) {
  const api = factory();
  root.GHDNPopupStrings = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPopupStringsApi() {
  "use strict";

  function create(i18n, language, browserLanguage = "") {
    if (!i18n || typeof i18n.create !== "function") {
      throw new Error("Popup strings require the i18n API");
    }
    const translator = i18n.create(language, browserLanguage);
    const message = translator.t;
    const strings = Object.freeze({
      error: message("commonError"),
      updates: message("popupUpdates"),
      tracking: message("popupTracking"),
      history: message("popupHistory"),
      settings: message("popupSettings"),
      updatesTitle: message("popupUpdatesTitle"),
      trackingTitle: message("popupTrackingTitle"),
      historyTitle: message("popupHistoryTitle"),
      trackingNote: message("popupTrackingNote"),
      historyNote: message("popupHistoryNote"),
      checkNow: message("popupCheckNow"),
      checking: message("popupChecking"),
      neverChecked: message("popupNeverChecked"),
      lastChecked: (value) => message("popupLastChecked", [value]),
      noUpdates: message("popupNoUpdates"),
      noTracking: message("popupNoTracking"),
      noHistory: message("popupNoHistory"),
      download: message("popupDownload"),
      release: message("popupRelease"),
      skip: message("popupSkip"),
      stop: message("popupStop"),
      clear: message("popupClear"),
      checked: message("popupChecked"),
      detected: message("popupDetected"),
      format: message("popupFormat"),
      action: message("popupAction"),
      downloadAction: message("popupDownloadAction"),
      menuAction: message("popupMenuAction"),
      releaseAction: message("popupReleaseAction"),
      afterDownload: message("popupAfterDownload"),
      ask: message("popupAsk"),
      always: message("popupAlways"),
      never: message("popupNever"),
      interval: message("popupInterval"),
      manual: message("popupManual"),
      every6h: message("popupEvery6Hours"),
      daily: message("popupDaily"),
      every3d: message("popupEvery3Days"),
      weekly: message("popupWeekly"),
      notifications: message("popupNotifications"),
      badge: message("popupBadge"),
      historyEnabled: message("popupHistoryEnabled"),
      enabledLabel: message("popupEnabledLabel"),
      options: message("popupOptions"),
      saved: message("commonSaved"),
      permissionDenied: message("popupPermissionDenied"),
      updateFound: (count) => message(
        translator.pluralCategory(count) === "one" ? "popupUpdateFoundOne" : "popupUpdateFoundOther",
        [count]
      ),
      checkSummary: (found, failed) => message("popupCheckSummary", [found, failed]),
      checkProgress: (checked, total) => message("popupCheckProgress", [checked, total]),
      rateLimited: (time) => time ? message("popupRateLimitedUntil", [time]) : message("popupRateLimited"),
      auto: message("commonAutomatic"),
      archive: message("commonArchive"),
      noAsset: message("popupNoAsset"),
      current: message("popupCurrent"),
      published: message("popupPublished"),
      justNow: message("popupJustNow"),
      minutesAgo: (count) => message("popupMinutesAgo", [count]),
      hoursAgo: (count) => message("popupHoursAgo", [count]),
      daysAgo: (count) => message("popupDaysAgo", [count])
    });

    function formatOptions() {
      return Object.freeze({
        linux: Object.freeze([["auto", strings.auto], ["appimage", "AppImage"], ["deb", "DEB"], ["rpm", "RPM"], ["flatpak", "Flatpak"], ["snap", "Snap"], ["archive", strings.archive]]),
        windows: Object.freeze([["auto", strings.auto], ["exe", "EXE"], ["msi", "MSI"], ["msix", "MSIX"], ["portable", "Portable"]]),
        macos: Object.freeze([["auto", strings.auto], ["dmg", "DMG"], ["pkg", "PKG"], ["zip", "ZIP"]]),
        android: Object.freeze([["auto", strings.auto], ["apk", "APK"], ["apks", "APKS"]])
      });
    }

    return Object.freeze({ translator, strings, formatOptions });
  }

  return Object.freeze({ create });
});
