(function initInstallGuides(root, factory) {
  if (!root.GHDNLocaleCatalogs && typeof module !== "undefined" && module.exports) module.require("./i18n-catalogs.js");
  if (!root.GHDNI18n && typeof module !== "undefined" && module.exports) root.GHDNI18n = module.require("./i18n.js");
  const api = factory(root.GHDNI18n);
  root.GHDNInstallGuides = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createInstallGuides(i18n) {
  "use strict";

  function basename(value) {
    const normalized = String(value || "").replace(/\\/g, "/");
    return normalized.split("/").pop() || "download";
  }

  function shellQuote(value) {
    return `'${String(value || "").replace(/'/g, `'"'"'`)}'`;
  }

  function windowsQuote(value) {
    return `"${String(value || "").replace(/"/g, '\\"')}"`;
  }

  function normalizedExtension(value) {
    const name = String(value || "").toLowerCase();
    const compound = [".tar.gz", ".tar.xz", ".tar.bz2", ".tar.zst", ".msixbundle", ".appxbundle"];
    return compound.find((extension) => name.endsWith(extension)) ||
      (/\.[a-z0-9]+$/i.exec(name) || [""])[0];
  }

  function createGuide(input) {
    const fileName = basename(input && (input.assetName || input.name));
    const extension = String(input && input.extension || normalizedExtension(fileName)).toLowerCase();
    const platform = String(input && input.platform || "unknown").toLowerCase();
    const tr = i18n.create(input && input.language || "auto", input && input.browserLanguage || "");
    const t = tr.t;
    const localPath = `./${fileName}`;
    const shellFile = shellQuote(fileName);
    const shellPath = shellQuote(localPath);

    const common = {
      fileName,
      extension,
      platform,
      language: tr.locale,
      commands: [],
      steps: [],
      warning: "",
      copyAll: false
    };

    const guide = (id, titleKey, summaryKey, steps, options = {}) => ({
      ...common,
      id,
      title: t(titleKey),
      summary: t(summaryKey),
      steps: steps.map((step) => ({ ...step, label: t(step.labelKey) })),
      warning: options.warningKey ? t(options.warningKey) : "",
      copyAll: Boolean(options.copyAll),
      commands: steps.map((step) => step.command).filter(Boolean)
    });

    switch (extension) {
      case ".appimage":
        return guide("appimage", "guideAppimageTitle", "guideAppimageSummary", [
          { labelKey: "guideMakeExecutable", command: `chmod +x -- ${shellFile}` },
          { labelKey: "guideRunFromDownloads", command: shellPath }
        ], { copyAll: true });
      case ".deb":
        return guide("deb", "guideDebTitle", "guideDebSummary", [
          { labelKey: "guideInstallLocalPackage", command: `sudo apt install ${shellPath}` }
        ], { copyAll: true });
      case ".rpm":
        return guide("rpm", "guideRpmTitle", "guideRpmSummary", [
          { labelKey: "guideRpmFedora", label: "Fedora / RHEL / Rocky / AlmaLinux", command: `sudo dnf install ${shellPath}`, alternative: true },
          { labelKey: "guideRpmOpenSuse", label: "openSUSE / SLES", command: `sudo zypper install ${shellPath}`, alternative: true }
        ].map((step) => ({ ...step, labelKey: step.labelKey })), {
          copyAll: false
        });
      case ".flatpakref":
      case ".flatpak":
        return guide("flatpak", "guideFlatpakTitle", "guideFlatpakSummary", [
          { labelKey: "guideInstallDownloadedFile", command: `flatpak install ${shellFile}` }
        ], { copyAll: true });
      case ".snap":
        return guide("snap", "guideSnapTitle", "guideSnapSummary", [
          { labelKey: "guideInstallTrustedFile", command: `sudo snap install --dangerous ${shellPath}` }
        ], { copyAll: true, warningKey: "guideSnapWarning" });
      case ".run":
      case ".sh":
        return guide(extension === ".run" ? "run" : "shell", "guideRunTitle", "guideRunSummary", [
          { labelKey: "guideAllowExecution", command: `chmod +x -- ${shellFile}` },
          { labelKey: "guideRunWithoutSudo", command: shellPath }
        ], { copyAll: true, warningKey: "guideScriptWarning" });
      case ".jar":
        return guide("jar", "guideJarTitle", "guideJarSummary", [
          { labelKey: "guideRunWithJava", command: `java -jar ${shellFile}` }
        ], { copyAll: true });
      case ".zip":
        if (platform === "windows") {
          return guide("zip-windows", "guideZipWindowsTitle", "guideZipWindowsSummary", [
            { labelKey: "guideExplorerExtractAll" },
            { labelKey: "guideRunTrustedOnly" }
          ]);
        }
        return guide("zip", "guideZipTitle", "guideZipSummary", [
          { labelKey: "guideExtractArchive", command: `unzip ${shellFile}` }
        ], { copyAll: true });
      case ".tar.gz":
      case ".tgz":
        return guide("tar-gz", "guideTarGzTitle", "guideArchiveSummary", [
          { labelKey: "guideExtractArchive", command: `tar -xzf ${shellFile}` }
        ], { copyAll: true });
      case ".tar.xz":
        return guide("tar-xz", "guideTarXzTitle", "guideArchiveSummary", [
          { labelKey: "guideExtractArchive", command: `tar -xJf ${shellFile}` }
        ], { copyAll: true });
      case ".tar.bz2":
      case ".tbz2":
        return guide("tar-bz2", "guideTarBz2Title", "guideReadAfterExtract", [
          { labelKey: "guideExtractArchive", command: `tar -xjf ${shellFile}` }
        ], { copyAll: true });
      case ".tar.zst":
        return guide("tar-zst", "guideTarZstTitle", "guideReadAfterExtract", [
          { labelKey: "guideExtractArchive", command: `tar --zstd -xf ${shellFile}` }
        ], { copyAll: true });
      case ".7z":
        return guide("7z", "guideSevenZipTitle", "guideSevenZipSummary", [
          { labelKey: "guideExtractArchive", command: `7z x ${shellFile}` }
        ], { copyAll: true });
      case ".exe":
        return guide("exe", "guideExeTitle", "guideExeSummary", [
          { labelKey: "guideCheckWindowsPublisher" }
        ]);
      case ".msi":
        return guide("msi", "guideMsiTitle", "guideMsiSummary", [
          { labelKey: "guideMsiAlternative", command: `msiexec /i ${windowsQuote(fileName)}` }
        ], { copyAll: true });
      case ".msix":
      case ".msixbundle":
      case ".appx":
      case ".appxbundle":
        return guide("app-package", "guideWindowsPackageTitle", "guideWindowsPackageSummary", [
          { labelKey: "guideFollowInstaller" }
        ]);
      case ".dmg":
        return guide("dmg", "guideDmgTitle", "guideDmgSummary", [
          { labelKey: "guideEjectDmg" }
        ]);
      case ".pkg":
        return guide("pkg", "guidePkgTitle", "guidePkgSummary", [
          { labelKey: "guideCheckDeveloper" }
        ]);
      case ".apk":
        return guide("apk", "guideApkTitle", "guideApkSummary", [
          { labelKey: "guideCheckAppSource" }
        ], { warningKey: "guideApkWarning" });
      case ".apks":
        return guide("apks", "guideApksTitle", "guideApksSummary", [
          { labelKey: "guideUseTrustedInstaller" }
        ]);
      case ".aab":
        return guide("aab", "guideAabTitle", "guideAabSummary", [
          { labelKey: "guideFindApk" }
        ]);
      case ".xpi":
        return guide("xpi", "guideXpiTitle", "guideXpiSummary", [
          { labelKey: "guideTrustedExtensions" }
        ]);
      case ".vsix":
        return guide("vsix", "guideVsixTitle", "guideVsixSummary", [
          { labelKey: "guideInstallVsix", command: `code --install-extension ${windowsQuote(fileName)}` }
        ], { copyAll: true });
      case ".crx":
        return guide("crx", "guideCrxTitle", "guideCrxSummary", [
          { labelKey: "guideCrxWarning" }
        ]);
      default:
        return null;
    }
  }

  function commandText(guide) {
    if (!guide || !Array.isArray(guide.commands)) return "";
    return guide.commands.join("\n");
  }

  return {
    basename,
    shellQuote,
    normalizedExtension,
    createGuide,
    commandText
  };
});
