(function initInstallGuides(root, factory) {
  const api = factory();
  root.GHDNInstallGuides = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createInstallGuides() {
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

  function locale(language) {
    return String(language || "").toLowerCase().startsWith("ru") ? "ru" : "en";
  }

  function createGuide(input) {
    const fileName = basename(input && (input.assetName || input.name));
    const extension = String(input && input.extension || normalizedExtension(fileName)).toLowerCase();
    const platform = String(input && input.platform || "unknown").toLowerCase();
    const lang = locale(input && input.language);
    const ru = lang === "ru";
    const localPath = `./${fileName}`;
    const shellFile = shellQuote(fileName);
    const shellPath = shellQuote(localPath);

    const common = {
      fileName,
      extension,
      platform,
      language: lang,
      commands: [],
      steps: [],
      warning: "",
      copyAll: false
    };

    const guide = (id, title, summary, steps, options = {}) => ({
      ...common,
      id,
      title,
      summary,
      steps,
      warning: options.warning || "",
      copyAll: Boolean(options.copyAll),
      commands: steps.map((step) => step.command).filter(Boolean)
    });

    switch (extension) {
      case ".appimage":
        return guide(
          "appimage",
          ru ? "Как запустить AppImage" : "How to run the AppImage",
          ru ? "AppImage не требует установки, но файлу нужно разрешить выполнение." : "An AppImage does not need installation, but the file must be executable.",
          [
            { label: ru ? "Сделайте файл исполняемым" : "Make the file executable", command: `chmod +x -- ${shellFile}` },
            { label: ru ? "Запустите его из папки загрузок" : "Run it from the download folder", command: `${shellPath}` }
          ],
          { copyAll: true }
        );

      case ".deb":
        return guide(
          "deb",
          ru ? "Как установить DEB" : "How to install the DEB package",
          ru ? "Команда подходит для Debian, Ubuntu, Linux Mint и большинства производных." : "This command is suitable for Debian, Ubuntu, Linux Mint and most derivatives.",
          [{ label: ru ? "Установите локальный пакет вместе с зависимостями" : "Install the local package and its dependencies", command: `sudo apt install ${shellPath}` }],
          { copyAll: true }
        );

      case ".rpm":
        return guide(
          "rpm",
          ru ? "Как установить RPM" : "How to install the RPM package",
          ru ? "Выберите команду для своего дистрибутива." : "Choose the command for your distribution.",
          [
            { label: "Fedora / RHEL / Rocky / AlmaLinux", command: `sudo dnf install ${shellPath}`, alternative: true },
            { label: "openSUSE / SLES", command: `sudo zypper install ${shellPath}`, alternative: true }
          ]
        );

      case ".flatpakref":
      case ".flatpak":
        return guide(
          "flatpak",
          ru ? "Как установить Flatpak" : "How to install the Flatpak",
          ru ? "Для команды должен быть установлен Flatpak." : "Flatpak must already be installed.",
          [{ label: ru ? "Установите загруженный файл" : "Install the downloaded file", command: `flatpak install ${shellFile}` }],
          { copyAll: true }
        );

      case ".snap":
        return guide(
          "snap",
          ru ? "Как установить локальный Snap" : "How to install the local Snap",
          ru ? "Локальные Snap-файлы с GitHub обычно не имеют утверждения из Snap Store." : "Local Snap files from GitHub usually do not include a Snap Store assertion.",
          [{ label: ru ? "Устанавливайте только файл от доверенного автора" : "Install only a file from a publisher you trust", command: `sudo snap install --dangerous ${shellPath}` }],
          {
            copyAll: true,
            warning: ru
              ? "Параметр --dangerous отключает проверку утверждений и подписи Snap Store."
              : "The --dangerous option disables Snap Store assertion and signature validation."
          }
        );

      case ".run":
      case ".sh":
        return guide(
          extension === ".run" ? "run" : "shell",
          ru ? "Как запустить файл" : "How to run the file",
          ru ? "Сначала просмотрите содержимое и убедитесь, что доверяете проекту." : "Review the file first and make sure you trust the project.",
          [
            { label: ru ? "Разрешите выполнение" : "Allow execution", command: `chmod +x -- ${shellFile}` },
            { label: ru ? "Запустите без sudo" : "Run it without sudo", command: `${shellPath}` }
          ],
          {
            copyAll: true,
            warning: ru
              ? "Скрипт может изменять файлы и настройки системы. Не добавляйте sudo без явной инструкции проекта."
              : "A script can change files and system settings. Do not add sudo unless the project explicitly requires it."
          }
        );

      case ".jar":
        return guide(
          "jar",
          ru ? "Как запустить JAR" : "How to run the JAR",
          ru ? "Нужна установленная совместимая Java Runtime Environment." : "A compatible Java Runtime Environment must be installed.",
          [{ label: ru ? "Запустите приложение через Java" : "Run the application with Java", command: `java -jar ${shellFile}` }],
          { copyAll: true }
        );

      case ".zip":
        if (platform === "windows") {
          return guide("zip-windows", ru ? "Как открыть ZIP" : "How to use the ZIP archive", ru ? "Распакуйте архив, затем найдите EXE-файл или README." : "Extract the archive, then look for an EXE file or README.", [
            { label: ru ? "В Проводнике выберите «Извлечь всё»" : "In File Explorer, choose Extract all" },
            { label: ru ? "Запускайте только файлы от доверенного проекта" : "Run files only from a project you trust" }
          ]);
        }
        return guide("zip", ru ? "Как распаковать ZIP" : "How to extract the ZIP archive", ru ? "После распаковки прочитайте README или INSTALL внутри архива." : "After extracting, read README or INSTALL inside the archive.", [
          { label: ru ? "Распакуйте архив" : "Extract the archive", command: `unzip ${shellFile}` }
        ], { copyAll: true });

      case ".tar.gz":
      case ".tgz":
        return guide("tar-gz", ru ? "Как распаковать TAR.GZ" : "How to extract the TAR.GZ archive", ru ? "Это архив, а не универсальный установщик. После распаковки прочитайте документацию проекта." : "This is an archive, not a universal installer. Read the project documentation after extracting it.", [
          { label: ru ? "Распакуйте архив" : "Extract the archive", command: `tar -xzf ${shellFile}` }
        ], { copyAll: true });

      case ".tar.xz":
        return guide("tar-xz", ru ? "Как распаковать TAR.XZ" : "How to extract the TAR.XZ archive", ru ? "Это архив, а не универсальный установщик. После распаковки прочитайте документацию проекта." : "This is an archive, not a universal installer. Read the project documentation after extracting it.", [
          { label: ru ? "Распакуйте архив" : "Extract the archive", command: `tar -xJf ${shellFile}` }
        ], { copyAll: true });

      case ".tar.bz2":
      case ".tbz2":
        return guide("tar-bz2", ru ? "Как распаковать TAR.BZ2" : "How to extract the TAR.BZ2 archive", ru ? "После распаковки прочитайте README или INSTALL." : "Read README or INSTALL after extracting it.", [
          { label: ru ? "Распакуйте архив" : "Extract the archive", command: `tar -xjf ${shellFile}` }
        ], { copyAll: true });


      case ".tar.zst":
        return guide("tar-zst", ru ? "Как распаковать TAR.ZST" : "How to extract the TAR.ZST archive", ru ? "После распаковки прочитайте README или INSTALL." : "Read README or INSTALL after extracting it.", [
          { label: ru ? "Распакуйте архив" : "Extract the archive", command: `tar --zstd -xf ${shellFile}` }
        ], { copyAll: true });

      case ".7z":
        return guide("7z", ru ? "Как распаковать 7Z" : "How to extract the 7Z archive", ru ? "Нужна утилита 7-Zip или p7zip." : "7-Zip or p7zip is required.", [
          { label: ru ? "Распакуйте архив" : "Extract the archive", command: `7z x ${shellFile}` }
        ], { copyAll: true });

      case ".exe":
        return guide("exe", ru ? "Как запустить EXE" : "How to run the EXE", ru ? "Откройте скачанный файл и следуйте инструкциям установщика. Для portable-сборки установка может не требоваться." : "Open the downloaded file and follow the installer. Portable builds may not require installation.", [
          { label: ru ? "Проверьте имя проекта и издателя в предупреждении Windows" : "Check the project and publisher shown by Windows" }
        ]);

      case ".msi":
        return guide("msi", ru ? "Как установить MSI" : "How to install the MSI package", ru ? "Обычно достаточно открыть файл двойным щелчком." : "Normally, double-clicking the file is sufficient.", [
          { label: ru ? "Альтернативный запуск через Windows Installer" : "Alternative Windows Installer command", command: `msiexec /i ${windowsQuote(fileName)}` }
        ], { copyAll: true });

      case ".msix":
      case ".msixbundle":
      case ".appx":
      case ".appxbundle":
        return guide("app-package", ru ? "Как установить пакет Windows" : "How to install the Windows package", ru ? "Откройте файл в App Installer и проверьте сведения об издателе перед установкой." : "Open the file in App Installer and check the publisher details before installing.", [
          { label: ru ? "Следуйте инструкциям системного установщика" : "Follow the system installer prompts" }
        ]);

      case ".dmg":
        return guide("dmg", ru ? "Как установить приложение из DMG" : "How to install from the DMG", ru ? "Откройте образ. Обычно приложение нужно перетащить в папку Applications." : "Open the disk image. Usually, drag the application into the Applications folder.", [
          { label: ru ? "После установки извлеките образ в Finder" : "Eject the disk image in Finder after installation" }
        ]);

      case ".pkg":
        return guide("pkg", ru ? "Как установить PKG" : "How to install the PKG", ru ? "Откройте пакет двойным щелчком и следуйте указаниям установщика macOS." : "Double-click the package and follow the macOS installer prompts.", [
          { label: ru ? "Проверьте имя разработчика перед подтверждением" : "Check the developer name before confirming" }
        ]);

      case ".apk":
        return guide("apk", ru ? "Как установить APK" : "How to install the APK", ru ? "Откройте файл на Android. Система может попросить разрешить установку из этого приложения-источника." : "Open the file on Android. The system may ask you to allow installs from the source app.", [
          { label: ru ? "Проверьте название приложения, разрешения и источник" : "Check the app name, permissions and source" }
        ], {
          warning: ru
            ? "Установка приложений вне Google Play повышает риск вредоносного ПО."
            : "Installing apps outside Google Play increases malware risk."
        });

      case ".apks":
        return guide("apks", ru ? "Как установить APKS" : "How to install the APKS bundle", ru ? "Это набор split APK, который нельзя установить как обычный APK. Нужен совместимый установщик наборов APK." : "This is a split-APK bundle and cannot be installed like a normal APK. A compatible split-APK installer is required.", [
          { label: ru ? "Проверьте документацию проекта и используйте доверенный установщик" : "Check the project documentation and use a trusted installer" }
        ]);

      case ".aab":
        return guide("aab", ru ? "Android App Bundle" : "Android App Bundle", ru ? "AAB предназначен для публикации и сборочных инструментов, а не для прямой установки на телефон." : "An AAB is intended for publishing and build tools, not direct installation on a phone.", [
          { label: ru ? "Для обычной установки найдите APK или APKS этого релиза" : "For normal installation, look for an APK or APKS asset in this release" }
        ]);

      case ".xpi":
        return guide("xpi", ru ? "Как установить XPI" : "How to install the XPI", ru ? "Откройте файл в Firefox и подтвердите установку дополнения." : "Open the file in Firefox and confirm the add-on installation.", [
          { label: ru ? "Устанавливайте расширения только из доверенных источников" : "Install extensions only from trusted sources" }
        ]);

      case ".vsix":
        return guide("vsix", ru ? "Как установить VSIX" : "How to install the VSIX", ru ? "Пакет предназначен для Visual Studio Code и совместимых редакторов." : "The package is intended for Visual Studio Code and compatible editors.", [
          { label: ru ? "Установите через командную строку VS Code" : "Install with the VS Code command line", command: `code --install-extension ${windowsQuote(fileName)}` }
        ], { copyAll: true });

      case ".crx":
        return guide("crx", ru ? "Расширение Chromium" : "Chromium extension", ru ? "Chrome обычно не устанавливает CRX напрямую с произвольных сайтов. Используйте официальный магазин или распакованную версию в режиме разработчика." : "Chrome normally blocks direct CRX installation from arbitrary sites. Use the official store or an unpacked build in developer mode.", [
          { label: ru ? "Не отключайте защиту браузера ради неизвестного CRX" : "Do not disable browser protections for an unknown CRX" }
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
