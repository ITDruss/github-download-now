(function initFormatting(root, factory) {
  const api = factory();
  root.GHDNFormatting = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createFormattingApi() {
  "use strict";

  const FORMAT_NAMES = Object.freeze({
    ".appimage": "AppImage", ".flatpakref": "Flatpak Ref", ".flatpak": "Flatpak", ".deb": "DEB", ".rpm": "RPM", ".snap": "Snap", ".run": "RUN", ".sh": "SH",
    ".tar.gz": "TAR.GZ", ".tar.xz": "TAR.XZ", ".tar.zst": "TAR.ZST", ".tar.bz2": "TAR.BZ2", ".tgz": "TGZ", ".tbz2": "TBZ2", ".zip": "ZIP", ".7z": "7Z",
    ".exe": "EXE", ".msi": "MSI", ".msix": "MSIX", ".msixbundle": "MSIX Bundle", ".appx": "APPX", ".appxbundle": "APPX Bundle",
    ".dmg": "DMG", ".pkg": "PKG", ".apk": "APK", ".apks": "APKS", ".aab": "AAB", ".xpi": "XPI", ".crx": "CRX", ".vsix": "VSIX", ".jar": "JAR"
  });

  const PLATFORM_SETTING_KEYS = Object.freeze({
    linux: "preferredLinux",
    windows: "preferredWindows",
    macos: "preferredMacos",
    android: "preferredAndroid"
  });

  function bytes(value, options = {}) {
    const amountValue = Number(value) || 0;
    if (!amountValue && options.emptyForZero) return "";
    if (amountValue < 1024 && !options.minimumKilobytes) return `${amountValue} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let amount = amountValue / 1024;
    let index = 0;
    while (amount >= 1024 && index < units.length - 1) {
      amount /= 1024;
      index += 1;
    }
    return `${amount >= 10 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
  }

  function date(value, locale, empty = "") {
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return empty;
    return parsed.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  }

  function time(value, locale, empty = "") {
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return empty;
    return parsed.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }

  function relativeDate(value, labels, now = Date.now()) {
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) return "—";
    const minutes = Math.max(0, Math.round((now - parsed.getTime()) / 60000));
    if (minutes < 2) return labels.justNow;
    if (minutes < 60) return labels.minutesAgo(minutes);
    const hours = Math.round(minutes / 60);
    if (hours < 24) return labels.hoursAgo(hours);
    return labels.daysAgo(Math.round(hours / 24));
  }

  function platform(userAgent = "") {
    const ua = String(userAgent || "");
    const os = /android/i.test(ua) ? "android" : /windows/i.test(ua) ? "windows" : /(macintosh|mac os x)/i.test(ua) ? "macos" : "linux";
    const arch = /(aarch64|arm64)/i.test(ua)
      ? "ARM64"
      : /(armv7|armv6|armhf)/i.test(ua)
        ? "ARM"
        : /(x86_64|amd64|win64|x64)/i.test(ua)
          ? "x64"
          : /(i[3-6]86|x86|win32)/i.test(ua)
            ? "x86"
            : "x64";
    return { os, arch };
  }

  function platformSettingKey(os) {
    return PLATFORM_SETTING_KEYS[os] || "";
  }

  function formatName(extension) {
    return FORMAT_NAMES[extension] || (extension ? String(extension).replace(/^\./, "").toUpperCase() : "file");
  }

  return Object.freeze({ bytes, date, time, relativeDate, platform, platformSettingKey, formatName });
});
