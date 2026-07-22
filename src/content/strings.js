(function initContentStrings(root, factory) {
  const api = factory();
  root.GHDNContentStrings = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createContentStringsApi() {
  "use strict";

  function create(i18n, language, browserLanguage = "") {
    if (!i18n || typeof i18n.create !== "function") {
      throw new Error("Content strings require the i18n API");
    }
    const tr = i18n.create(language, browserLanguage);
    const t = tr.t;
    return Object.freeze({
      locale: tr.locale,
      localeTag: tr.tag,
      downloadNow: t("contentDownloadNow"),
      downloadCompact: t("contentDownloadCompact"),
      downloadFormat: (format) => t("contentDownloadFormat", [format]),
      chooseDownload: t("contentChooseDownload"),
      detecting: t("contentDetecting"),
      loading: t("contentLoading"),
      recommended: t("contentRecommended"),
      preferred: t("contentPreferred"),
      suitable: t("contentSuitable"),
      otherPlatforms: t("contentOtherPlatforms"),
      sourceCode: t("contentSourceCode"),
      openRelease: t("contentOpenRelease"),
      openSettings: t("contentOpenSettings"),
      moreOnRelease: (count) => t("contentMoreOnRelease", [count]),
      sourceZip: t("contentSourceZip"),
      sourceTar: t("contentSourceTar"),
      buildFromSource: t("contentBuildFromSource"),
      buildLoading: t("contentBuildLoading"),
      buildNotFound: t("contentBuildNotFound"),
      buildError: t("contentBuildError"),
      buildFallbackNotice: t("contentBuildFallbackNotice"),
      versionLabel: t("contentVersionLabel"),
      selectVersion: t("contentSelectVersion"),
      latestVersion: t("contentLatestVersion"),
      buildLoadAction: t("contentBuildLoadAction"),
      installHelp: t("contentInstallHelp"),
      installAfterDownload: t("contentInstallAfterDownload"),
      installCopyCommand: t("contentInstallCopyCommand"),
      installCopyAll: t("contentInstallCopyAll"),
      installCopied: t("contentInstallCopied"),
      installClose: t("contentInstallClose"),
      noRelease: t("contentNoRelease"),
      noAssets: t("contentNoAssets"),
      apiError: t("contentApiError"),
      networkError: t("contentNetworkError"),
      rateLimited: (time) => time ? t("contentRateLimitedUntil", [time]) : t("contentRateLimited"),
      release: t("commonRelease"),
      prerelease: t("contentPrerelease"),
      published: t("contentPublished"),
      downloads: t("contentDownloads"),
      universal: t("contentUniversal"),
      unknownPlatform: t("contentUnknownPlatform"),
      copyLink: t("contentCopyLink"),
      copied: t("contentCopied"),
      watchQuestion: (repository) => t("contentWatchQuestion", [repository]),
      watchText: t("contentWatchText"),
      watchEnable: t("contentWatchEnable"),
      watchLater: t("contentWatchLater"),
      watchingEnabled: t("contentWatchingEnabled"),
      watchingUpdated: t("contentWatchingUpdated"),
      staleTitle: t("contentStaleTitle"),
      staleText: (date) => t("contentStaleText", [date]),
      whyRecommended: t("contentWhyRecommended"),
      reasonOs: (os) => t("contentReasonOs", [os]),
      reasonArch: (arch) => t("contentReasonArch", [arch]),
      reasonFormat: (format) => t("contentReasonFormat", [format]),
      reasonPreference: (format) => t("contentReasonPreference", [format]),
      reasonUniversal: t("contentReasonUniversal"),
      reasonPopularity: t("contentReasonPopularity"),
      formatHints: Object.freeze({
        ".appimage": t("contentFormatHintAppimage"),
        ".flatpakref": t("contentFormatHintFlatpakref"),
        ".flatpak": t("contentFormatHintFlatpak"),
        ".deb": t("contentFormatHintDeb"),
        ".rpm": t("contentFormatHintRpm"),
        ".snap": t("contentFormatHintSnap"),
        ".run": t("contentFormatHintRun"),
        ".sh": t("contentFormatHintSh"),
        ".tar.gz": t("contentFormatHintTarGz"),
        ".tar.xz": t("contentFormatHintTarXz"),
        ".tar.zst": t("contentFormatHintTarZst"),
        ".tgz": t("contentFormatHintTgz"),
        ".exe": t("contentFormatHintExe"),
        ".msi": t("contentFormatHintMsi"),
        ".msix": t("contentFormatHintMsix"),
        ".msixbundle": t("contentFormatHintMsixbundle"),
        ".dmg": t("contentFormatHintDmg"),
        ".pkg": t("contentFormatHintPkg"),
        ".apk": t("contentFormatHintApk"),
        ".apks": t("contentFormatHintApks"),
        ".aab": t("contentFormatHintAab"),
        ".xpi": t("contentFormatHintXpi"),
        ".crx": t("contentFormatHintCrx"),
        ".vsix": t("contentFormatHintVsix"),
        ".jar": t("contentFormatHintJar"),
        ".zip": t("contentFormatHintZip"),
        ".7z": t("contentFormatHintSevenZip")
      })
    });
  }

  return Object.freeze({ create });
});
