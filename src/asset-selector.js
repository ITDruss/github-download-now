(function initAssetSelector(root, factory) {
  const api = factory();
  root.GHDNAssetSelector = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createAssetSelector() {
  "use strict";

  const OS_MARKERS = {
    windows: ["windows", "win64", "win32", "win"],
    linux: ["linux", "gnu-linux", "gnu_linux"],
    macos: ["macos", "mac-os", "mac_os", "osx", "darwin"],
    android: ["android"]
  };

  const ARCH_MARKERS = {
    x64: ["x86_64", "x86-64", "amd64", "x64", "win64"],
    x86: ["i386", "i486", "i586", "i686", "x86", "win32", "32bit", "32-bit"],
    arm64: ["arm64", "aarch64", "armv8", "arm64-v8a"],
    arm: ["armv7", "armv7l", "armhf", "armeabi", "armeabi-v7a"],
    universal: ["universal", "universal2", "noarch", "any", "all"]
  };

  const EXTENSIONS = [
    ".flatpakref", ".flatpak", ".appimage", ".tar.bz2", ".tar.gz", ".tar.xz", ".tar.zst",
    ".msixbundle", ".appxbundle", ".msix", ".appx", ".tgz", ".tbz2",
    ".apk", ".apks", ".aab", ".dmg", ".pkg", ".exe", ".msi", ".deb",
    ".rpm", ".snap", ".run", ".sh", ".xpi", ".crx", ".vsix", ".jar", ".zip", ".7z",
    ".rar", ".gz", ".xz"
  ];

  const FORMAT_SCORES = {
    windows: {
      ".exe": 52, ".msi": 50, ".msixbundle": 48, ".msix": 47,
      ".appxbundle": 46, ".appx": 45, ".zip": 22, ".7z": 18
    },
    linux: {
      ".appimage": 54, ".flatpakref": 50, ".flatpak": 49, ".deb": 47, ".rpm": 44,
      ".snap": 41, ".tar.xz": 27, ".tar.zst": 26, ".tar.gz": 25, ".tgz": 23, ".run": 18, ".sh": 12,
      ".zip": 17, ".7z": 14
    },
    macos: {
      ".dmg": 54, ".pkg": 50, ".zip": 27, ".tar.gz": 22, ".tgz": 20
    },
    android: {
      ".apk": 55, ".apks": 50, ".aab": 28, ".zip": 12
    },
    unknown: {
      ".xpi": 45, ".crx": 45, ".vsix": 43, ".jar": 40,
      ".exe": 20, ".msi": 20, ".appimage": 20, ".deb": 19,
      ".rpm": 18, ".flatpak": 18, ".dmg": 20, ".pkg": 19, ".apk": 20,
      ".zip": 14, ".tar.gz": 13, ".tar.xz": 13, ".tar.zst": 13, ".run": 9, ".sh": 7, ".7z": 11
    }
  };

  const PLATFORM_NEUTRAL_EXTENSIONS = new Set([".xpi", ".crx", ".vsix", ".jar"]);

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function hasToken(text, token) {
    const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(token)}([^a-z0-9]|$)`, "i");
    return pattern.test(text);
  }

  function detectExtension(name) {
    const lower = normalizeText(name);
    return EXTENSIONS.find((extension) => lower.endsWith(extension)) || "";
  }

  function detectOsMarkers(name) {
    const lower = normalizeText(name);
    return Object.entries(OS_MARKERS)
      .filter(([, aliases]) => aliases.some((alias) => hasToken(lower, alias)))
      .map(([os]) => os);
  }

  function detectArchMarkers(name) {
    const lower = normalizeText(name);
    const found = [];

    if (ARCH_MARKERS.x64.some((alias) => hasToken(lower, alias))) {
      found.push("x64");
    }
    if (ARCH_MARKERS.arm64.some((alias) => hasToken(lower, alias))) {
      found.push("arm64");
    }
    if (ARCH_MARKERS.arm.some((alias) => hasToken(lower, alias))) {
      found.push("arm");
    }
    if (!found.includes("x64") && ARCH_MARKERS.x86.some((alias) => hasToken(lower, alias))) {
      found.push("x86");
    }
    if (ARCH_MARKERS.universal.some((alias) => hasToken(lower, alias))) {
      found.push("universal");
    }

    return found;
  }

  function isAuxiliaryAsset(name) {
    const lower = normalizeText(name);
    if (!lower) return true;

    const auxiliaryToken = /(^|[._\-])(checksums?|sha(?:1|224|256|384|512)?|md5|sums?|signature|signatures|sig|asc|sbom|provenance|attestation|symbols?|debug|pdb|dsym)([._\-]|$)/i;
    const sourceToken = /(^|[._\-])(source|sources|src)([._\-]|$)/i;

    return auxiliaryToken.test(lower)
      || sourceToken.test(lower)
      || lower.endsWith(".patch")
      || lower.endsWith(".diff")
      || lower.endsWith(".pem")
      || lower.endsWith(".minisig");
  }

  function formatScore(extension, os) {
    const table = FORMAT_SCORES[os] || FORMAT_SCORES.unknown;
    return table[extension] || FORMAT_SCORES.unknown[extension] || 0;
  }

  function extensionBelongsToOtherOs(extension, os) {
    const groups = {
      windows: new Set([".exe", ".msi", ".msix", ".msixbundle", ".appx", ".appxbundle"]),
      linux: new Set([".appimage", ".flatpakref", ".flatpak", ".deb", ".rpm", ".snap", ".run", ".sh"]),
      macos: new Set([".dmg", ".pkg"]),
      android: new Set([".apk", ".apks", ".aab"])
    };

    return Object.entries(groups).some(([groupOs, extensions]) => groupOs !== os && extensions.has(extension));
  }

  function preferredFormatScore(extension, name, preferredFormat) {
    const preferred = normalizeText(preferredFormat) || "auto";
    if (preferred === "auto") return 0;

    const groups = {
      appimage: new Set([".appimage"]),
      deb: new Set([".deb"]),
      rpm: new Set([".rpm"]),
      flatpak: new Set([".flatpakref", ".flatpak"]),
      snap: new Set([".snap"]),
      archive: new Set([".tar.xz", ".tar.zst", ".tar.gz", ".tgz", ".zip", ".7z"]),
      exe: new Set([".exe"]),
      msi: new Set([".msi"]),
      msix: new Set([".msix", ".msixbundle", ".appx", ".appxbundle"]),
      dmg: new Set([".dmg"]),
      pkg: new Set([".pkg"]),
      zip: new Set([".zip"]),
      apk: new Set([".apk"]),
      apks: new Set([".apks"])
    };

    if (preferred === "portable") {
      if (/(^|[._\-])portable([._\-]|$)/i.test(name)) return 38;
      if (/(^|[._\-])(setup|installer|install)([._\-]|$)/i.test(name)) return -10;
      if ([".zip", ".7z"].includes(extension)) return 20;
      return 0;
    }

    return groups[preferred] && groups[preferred].has(extension) ? 38 : 0;
  }

  function scoreAsset(asset, platformInput) {
    const platform = {
      os: normalizeText(platformInput && platformInput.os) || "unknown",
      arch: normalizeText(platformInput && platformInput.arch) || "unknown"
    };
    const name = String(asset && asset.name || "");
    const lower = normalizeText(name);
    const extension = detectExtension(name);
    const osMarkers = detectOsMarkers(name);
    const archMarkers = detectArchMarkers(name);
    const reasons = [];

    if (!name || isAuxiliaryAsset(name)) {
      return { score: Number.NEGATIVE_INFINITY, extension, reasons: ["auxiliary"] };
    }

    let score = 0;
    const neutral = PLATFORM_NEUTRAL_EXTENSIONS.has(extension);
    const selectedFormatScore = formatScore(extension, platform.os);
    score += selectedFormatScore;
    if (selectedFormatScore > 0) reasons.push(`format:${extension || "generic"}`);

    const preferenceScore = preferredFormatScore(extension, lower, platformInput && platformInput.preferredFormat);
    score += preferenceScore;
    if (preferenceScore > 0) reasons.push(`preference:${normalizeText(platformInput.preferredFormat)}`);

    if (platform.os !== "unknown" && !neutral) {
      if (osMarkers.includes(platform.os)) {
        score += 46;
        reasons.push(`os:${platform.os}`);
      } else if (osMarkers.length > 0) {
        score -= 125;
        reasons.push("os:mismatch");
      } else if (extensionBelongsToOtherOs(extension, platform.os)) {
        score -= 75;
        reasons.push("format:mismatch");
      } else if (selectedFormatScore > 0) {
        score += 12;
        reasons.push("os:inferred");
      }
    } else if (neutral) {
      score += 24;
      reasons.push("platform:neutral");
    } else if (osMarkers.length > 0) {
      score += 4;
    }

    if (platform.arch !== "unknown") {
      if (archMarkers.includes(platform.arch)) {
        score += 32;
        reasons.push(`arch:${platform.arch}`);
      } else if (archMarkers.includes("universal")) {
        score += 20;
        reasons.push("arch:universal");
      } else if (archMarkers.length > 0) {
        score -= 85;
        reasons.push("arch:mismatch");
      } else {
        score += 4;
      }
    } else if (archMarkers.includes("universal")) {
      score += 8;
    }

    const browserName = normalizeText(platformInput && platformInput.browser) || "unknown";
    if (extension === ".xpi") {
      if (browserName === "firefox") {
        score += 34;
        reasons.push("browser:firefox");
      } else if (browserName !== "unknown") {
        score -= 22;
        reasons.push("browser:mismatch");
      }
    } else if (extension === ".crx") {
      if (["chrome", "chromium", "edge", "opera", "brave"].includes(browserName)) {
        score += 34;
        reasons.push(`browser:${browserName}`);
      } else if (browserName !== "unknown") {
        score -= 22;
        reasons.push("browser:mismatch");
      }
    }

    if (platform.os === "windows") {
      if (/(^|[._\-])(setup|installer|install)([._\-]|$)/i.test(lower)) score += 7;
      if (/(^|[._\-])portable([._\-]|$)/i.test(lower)) score += 2;
    }

    if (platform.os === "macos" && hasToken(lower, "universal2")) score += 5;
    if (platform.os === "linux" && extension === ".appimage") score += 3;

    if (asset && asset.state && asset.state !== "uploaded") score -= 25;
    if (asset && Number(asset.size) === 0) score -= 15;
    if (!extension) score -= 8;

    const downloads = Math.max(0, Number(asset && asset.download_count) || 0);
    score += Math.min(5, Math.log10(downloads + 1));

    return { score, extension, reasons };
  }

  function rankAssets(assets, platform) {
    return (Array.isArray(assets) ? assets : [])
      .map((asset) => {
        const result = scoreAsset(asset, platform);
        return { ...asset, ...result };
      })
      .filter((asset) => Number.isFinite(asset.score))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const downloadsDifference = (Number(b.download_count) || 0) - (Number(a.download_count) || 0);
        if (downloadsDifference !== 0) return downloadsDifference;
        return String(a.name).localeCompare(String(b.name));
      });
  }

  function recommendation(assets, platform) {
    const ranked = rankAssets(assets, platform);
    const best = ranked[0] || null;
    const second = ranked[1] || null;
    const gap = best && second ? best.score - second.score : Number.POSITIVE_INFINITY;

    let confidence = "none";
    if (best) {
      if (best.score >= 65 && gap >= 5) confidence = "high";
      else if (best.score >= 30) confidence = "medium";
      else confidence = "low";
    }

    return { best, ranked, gap, confidence };
  }

  return {
    detectExtension,
    detectOsMarkers,
    detectArchMarkers,
    isAuxiliaryAsset,
    scoreAsset,
    rankAssets,
    recommendation
  };
});
