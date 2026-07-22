(function initContentPlatform(root, factory) {
  const api = factory();
  root.GHDNContentPlatform = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createContentPlatformApi() {
  "use strict";

  const EXTENSION_OS = Object.freeze({
    ".exe": "windows", ".msi": "windows", ".msix": "windows", ".msixbundle": "windows", ".appx": "windows", ".appxbundle": "windows",
    ".appimage": "linux", ".flatpakref": "linux", ".flatpak": "linux", ".deb": "linux", ".rpm": "linux", ".snap": "linux", ".run": "linux", ".sh": "linux",
    ".dmg": "macos", ".pkg": "macos", ".apk": "android", ".apks": "android", ".aab": "android",
    ".xpi": "browser", ".crx": "browser", ".vsix": "browser"
  });
  const ICON_PLATFORMS = new Set(["linux", "windows", "macos", "android", "browser", "source", "package"]);

  function create(options = {}) {
    const navigatorObject = options.navigatorObject || globalThis.navigator || {};
    const selector = options.selector;
    const formatting = options.formatting;
    const settingsApi = options.settingsApi;
    const getSettings = options.getSettings || (() => ({}));
    const getStrings = options.getStrings || (() => ({}));
    const now = options.now || (() => Date.now());

    if (!selector || !formatting) throw new Error("Content platform dependencies are incomplete");

    async function detect() {
      const settings = getSettings();
      const ua = navigatorObject.userAgent || "";
      const uaLower = ua.toLowerCase();
      let os = "unknown";
      let arch = "unknown";
      let browserName = "unknown";

      if (/android/i.test(ua)) os = "android";
      else if (/windows/i.test(ua)) os = "windows";
      else if (/(macintosh|mac os x)/i.test(ua)) os = "macos";
      else if (/linux/i.test(ua)) os = "linux";

      if (/(aarch64|arm64)/i.test(ua)) arch = "arm64";
      else if (/(armv7|armv6|armhf)/i.test(ua)) arch = "arm";
      else if (/(x86_64|amd64|win64|x64)/i.test(ua)) arch = "x64";
      else if (/(i[3-6]86|x86|win32)/i.test(ua)) arch = "x86";

      if (/firefox\//i.test(ua)) browserName = "firefox";
      else if (/edg\//i.test(ua)) browserName = "edge";
      else if (/opr\//i.test(ua)) browserName = "opera";
      else if (/brave/i.test(uaLower) || (navigatorObject.brave && typeof navigatorObject.brave.isBrave === "function")) browserName = "brave";
      else if (/chrome\//i.test(ua)) browserName = "chrome";
      else if (/chromium\//i.test(ua)) browserName = "chromium";

      try {
        if (navigatorObject.userAgentData && navigatorObject.userAgentData.getHighEntropyValues) {
          const data = await navigatorObject.userAgentData.getHighEntropyValues(["architecture", "bitness", "platform"]);
          const uaPlatform = String(data.platform || "").toLowerCase();
          const uaArchitecture = String(data.architecture || "").toLowerCase();
          if (uaPlatform.includes("windows")) os = "windows";
          else if (uaPlatform.includes("mac")) os = "macos";
          else if (uaPlatform.includes("android")) os = "android";
          else if (uaPlatform.includes("linux")) os = "linux";
          if (uaArchitecture.includes("arm") && String(data.bitness) === "64") arch = "arm64";
          else if (uaArchitecture.includes("arm")) arch = "arm";
          else if (String(data.bitness) === "64") arch = "x64";
          else if (String(data.bitness) === "32") arch = "x86";
        }
      } catch (_error) {}

      if (settings.osOverride && settings.osOverride !== "auto") os = settings.osOverride;
      if (settings.archOverride && settings.archOverride !== "auto") arch = settings.archOverride;
      const preferredFormat = settingsApi ? settingsApi.preferredFormatForOs(settings, os) : "auto";
      return { os, arch, browser: browserName, preferredFormat };
    }

    function osDisplayName(os) {
      const strings = getStrings();
      return { windows: "Windows", linux: "Linux", macos: "macOS", android: "Android", browser: "Browser" }[os] || strings.unknownPlatform;
    }

    function archDisplayName(arch) {
      const strings = getStrings();
      return { x64: "x64", x86: "x86", arm64: "ARM64", arm: "ARM", universal: strings.universal }[arch] || "";
    }

    function metaText(platform) {
      const parts = [];
      if (platform?.os && platform.os !== "unknown") parts.push(osDisplayName(platform.os));
      if (platform?.arch && platform.arch !== "unknown") parts.push(archDisplayName(platform.arch));
      return parts.join(" · ");
    }

    function assetPlatform(asset) {
      const name = typeof asset === "string" ? asset : asset?.name;
      const extension = typeof asset === "object" && asset?.extension ? asset.extension : selector.detectExtension(name);
      const markers = selector.detectOsMarkers(name || "");
      if (markers.length) return markers[0];
      return EXTENSION_OS[extension] || "unknown";
    }

    function isCompatibleAsset(asset, platform) {
      const reasons = Array.isArray(asset?.reasons) ? asset.reasons : [];
      if (reasons.includes("os:mismatch") || reasons.includes("format:mismatch") || reasons.includes("arch:mismatch")) return false;
      const detectedOs = assetPlatform(asset);
      if (platform.os !== "unknown" && detectedOs !== "unknown" && detectedOs !== "browser" && detectedOs !== platform.os) return false;
      return Number(asset?.score) >= 20;
    }

    function assetArchitecture(asset, currentPlatform) {
      const markers = selector.detectArchMarkers(asset?.name || "");
      if (markers.length) return markers.map(archDisplayName).filter(Boolean).join("/");
      if (isCompatibleAsset(asset, currentPlatform) && currentPlatform.arch !== "unknown") return archDisplayName(currentPlatform.arch);
      return "";
    }

    function iconName(platform) {
      return ICON_PLATFORMS.has(platform) ? platform : "package";
    }

    function formatDisplayName(extension) {
      return formatting.formatName(extension);
    }

    function isReleaseStale(release) {
      const threshold = Number(getSettings().staleReleaseMonths) || 0;
      if (!threshold || !release?.published_at) return false;
      const published = new Date(release.published_at).getTime();
      if (!Number.isFinite(published)) return false;
      return now() - published > threshold * 30.4375 * 24 * 60 * 60 * 1000;
    }

    function formatReleaseDate(value) {
      return formatting.date(value, getStrings().localeTag);
    }

    function releaseDateText(release) {
      const strings = getStrings();
      const date = formatReleaseDate(release?.published_at);
      return date ? `${strings.published} ${date}` : "";
    }

    return Object.freeze({
      detect,
      osDisplayName,
      archDisplayName,
      metaText,
      assetPlatform,
      isCompatibleAsset,
      assetArchitecture,
      iconName,
      formatDisplayName,
      isReleaseStale,
      formatReleaseDate,
      releaseDateText
    });
  }

  return Object.freeze({ create, EXTENSION_OS });
});
