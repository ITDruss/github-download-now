(function initSettings(root, factory) {
  const api = factory(root);
  root.GHDNSettings = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createSettingsApi(root) {
  "use strict";

  const browserApi = root.GHDNBrowser;
  const extensionApi = browserApi?.api || (typeof browser !== "undefined" ? browser : (typeof chrome !== "undefined" ? chrome : null));
  const i18n = root.GHDNI18n;

  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    language: "auto",
    osOverride: "auto",
    archOverride: "auto",
    preferredLinux: "auto",
    preferredWindows: "auto",
    preferredMacos: "auto",
    preferredAndroid: "auto",
    primaryAction: "download",
    buttonStyle: "accent",
    showSubtitle: true,
    showOtherPlatforms: true,
    showSourceCode: true,
    showRecommendationReason: true,
    releaseChannel: "stable",
    staleReleaseMonths: 12,
    showOn: "all",
    historyEnabled: true,
    afterDownload: "ask",
    installGuidance: "beginner",
    updateCheckInterval: "24h",
    notificationsEnabled: false,
    badgeEnabled: true
  });

  const ALLOWED = Object.freeze({
    osOverride: new Set(["auto", "windows", "linux", "macos", "android"]),
    archOverride: new Set(["auto", "x64", "arm64", "x86", "arm"]),
    preferredLinux: new Set(["auto", "appimage", "deb", "rpm", "flatpak", "snap", "archive"]),
    preferredWindows: new Set(["auto", "exe", "msi", "msix", "portable"]),
    preferredMacos: new Set(["auto", "dmg", "pkg", "zip"]),
    preferredAndroid: new Set(["auto", "apk", "apks"]),
    primaryAction: new Set(["download", "menu", "release"]),
    buttonStyle: new Set(["accent", "native", "compact"]),
    releaseChannel: new Set(["stable", "newest"]),
    showOn: new Set(["all", "main_releases", "main"]),
    afterDownload: new Set(["ask", "always", "never"]),
    installGuidance: new Set(["beginner", "compact", "off"]),
    updateCheckInterval: new Set(["manual", "6h", "24h", "72h", "168h"])
  });

  const BOOLEAN_KEYS = new Set([
    "enabled", "showSubtitle", "showOtherPlatforms", "showSourceCode", "showRecommendationReason",
    "historyEnabled", "notificationsEnabled", "badgeEnabled"
  ]);

  function normalize(input) {
    const result = { ...DEFAULT_SETTINGS };
    const source = input && typeof input === "object" ? input : {};

    for (const key of BOOLEAN_KEYS) {
      if (typeof source[key] === "boolean") result[key] = source[key];
    }

    for (const [key, values] of Object.entries(ALLOWED)) {
      if (values.has(source[key])) result[key] = source[key];
    }

    if (source.language === "auto") result.language = "auto";
    else {
      const supported = i18n?.supportedLocale?.(source.language) || (new Set(["en", "ru"]).has(source.language) ? source.language : "");
      if (supported) result.language = supported;
    }

    const months = Number(source.staleReleaseMonths);
    if (Number.isFinite(months)) {
      result.staleReleaseMonths = Math.max(0, Math.min(120, Math.round(months)));
    }

    return result;
  }

  async function get() {
    if (!browserApi?.storage?.sync) return { ...DEFAULT_SETTINGS };
    try {
      return normalize(await browserApi.storage.sync.get(DEFAULT_SETTINGS));
    } catch (_error) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async function set(patch) {
    const current = await get();
    const next = normalize({ ...current, ...(patch || {}) });
    if (browserApi?.storage?.sync) await browserApi.storage.sync.set(next);
    return next;
  }

  async function reset() {
    if (browserApi?.storage?.sync) await browserApi.storage.sync.clear();
    return { ...DEFAULT_SETTINGS };
  }

  function onChanged(listener) {
    if (!extensionApi || !extensionApi.storage || !extensionApi.storage.onChanged) return () => {};
    const handler = (changes, areaName) => {
      if (areaName !== "sync") return;
      get().then(listener);
    };
    extensionApi.storage.onChanged.addListener(handler);
    return () => extensionApi.storage.onChanged.removeListener(handler);
  }

  function preferredFormatForOs(settings, os) {
    const normalized = normalize(settings);
    if (os === "linux") return normalized.preferredLinux;
    if (os === "windows") return normalized.preferredWindows;
    if (os === "macos") return normalized.preferredMacos;
    if (os === "android") return normalized.preferredAndroid;
    return "auto";
  }

  return {
    DEFAULT_SETTINGS,
    normalize,
    get,
    set,
    reset,
    onChanged,
    preferredFormatForOs
  };
});
