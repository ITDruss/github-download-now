"use strict";

(() => {
  const extensionApi = typeof browser !== "undefined" ? browser : chrome;
  const selector = globalThis.GHDNAssetSelector;
  const settingsApi = globalThis.GHDNSettings;
  const ROOT_ID = "ghdn-root";
  const MAX_VISIBLE_ASSETS = 18;
  const RESERVED_ROOTS = new Set([
    "about", "account", "apps", "codespaces", "collections", "contact", "customer-stories",
    "enterprise", "enterprises", "events", "explore", "features", "gist", "issues", "login",
    "marketplace", "new", "notifications", "orgs", "organizations", "pricing", "pulls", "search",
    "security", "settings", "site", "sponsors", "stars", "topics", "trending"
  ]);

  let settings = { ...(settingsApi ? settingsApi.DEFAULT_SETTINGS : {}) };
  let strings = createStrings(settings.language);
  let activeRepoKey = "";
  let releaseState = null;
  let loadingPromise = null;
  let detectedPlatformPromise = null;
  let mountTimer = null;
  let prefetchTimer = null;
  let closeListenerInstalled = false;
  let settingsReady = refreshSettings();

  function createStrings(language) {
    const russian = language === "ru" || (language !== "en" && /^(ru|uk|be|kk)(-|$)/i.test(navigator.language || ""));
    return russian ? {
      downloadNow: "Скачать сейчас",
      downloadFormat: (format) => `Скачать ${format}`,
      chooseDownload: "Выбрать файл",
      detecting: "Определяю систему…",
      loading: "Ищу релиз…",
      recommended: "Рекомендуется",
      preferred: "Ваш выбор",
      suitable: "Подходит для вашего устройства",
      otherPlatforms: "Другие платформы",
      sourceCode: "Исходный код",
      openRelease: "Открыть страницу релиза",
      openSettings: "Настройки расширения",
      moreOnRelease: (count) => `Ещё ${count} файлов на странице релиза`,
      sourceZip: "Исходный код (ZIP)",
      sourceTar: "Исходный код (TAR.GZ)",
      noRelease: "У репозитория нет подходящего опубликованного релиза.",
      noAssets: "В релизе нет готовых файлов. Можно скачать исходный код.",
      apiError: "GitHub API временно недоступен.",
      networkError: "Не удалось получить данные о релизе.",
      rateLimited: (time) => time ? `Лимит GitHub API исчерпан. Повторите после ${time}.` : "Лимит GitHub API исчерпан.",
      release: "Релиз",
      prerelease: "Предварительная версия",
      published: "Опубликовано",
      downloads: "скачиваний",
      universal: "универсальная",
      unknownPlatform: "другая платформа",
      copyLink: "Скопировать прямую ссылку",
      copied: "Ссылка скопирована",
      watchQuestion: (repo) => `Следить за обновлениями ${repo}?`,
      watchText: "Расширение будет локально проверять новые GitHub Releases.",
      watchEnable: "Следить",
      watchLater: "Не сейчас",
      watchingEnabled: "Отслеживание обновлений включено",
      watchingUpdated: "Загрузка записана, отслеживание обновлено",
      staleTitle: "Релиз может быть устаревшим",
      staleText: (date) => `Он опубликован ${date}. Проверьте, поддерживается ли проект, прежде чем скачивать.`,
      whyRecommended: "Почему выбран этот файл",
      reasonOs: (os) => `Совпадает с вашей системой: ${os}`,
      reasonArch: (arch) => `Совпадает с архитектурой: ${arch}`,
      reasonFormat: (format) => `Подходящий формат: ${format}`,
      reasonPreference: (format) => `Совпадает с вашим предпочтением: ${format}`,
      reasonUniversal: "Универсальная сборка",
      reasonPopularity: "Популярный вариант среди пользователей",
      formatHints: {
        ".appimage": "Универсальный запуск без установки",
        ".flatpakref": "Установка через Flatpak",
        ".deb": "Пакет для Debian, Ubuntu и производных",
        ".rpm": "Пакет для Fedora, RHEL и производных",
        ".snap": "Пакет Snap",
        ".tar.gz": "Архив для ручной установки",
        ".tar.xz": "Архив для ручной установки",
        ".tgz": "Архив для ручной установки",
        ".exe": "Приложение или установщик Windows",
        ".msi": "Установочный пакет Windows",
        ".msix": "Современный пакет Windows",
        ".msixbundle": "Пакет Windows для нескольких архитектур",
        ".dmg": "Образ приложения macOS",
        ".pkg": "Установочный пакет macOS",
        ".apk": "Приложение Android",
        ".apks": "Набор APK для Android",
        ".aab": "Android App Bundle",
        ".xpi": "Расширение Firefox",
        ".crx": "Расширение Chromium",
        ".vsix": "Расширение VS Code",
        ".jar": "Java-приложение",
        ".zip": "ZIP-архив",
        ".7z": "7-Zip архив"
      }
    } : {
      downloadNow: "Download now",
      downloadFormat: (format) => `Download ${format}`,
      chooseDownload: "Choose a file",
      detecting: "Detecting your system…",
      loading: "Finding a release…",
      recommended: "Recommended",
      preferred: "Your choice",
      suitable: "Suitable for your device",
      otherPlatforms: "Other platforms",
      sourceCode: "Source code",
      openRelease: "Open release page",
      openSettings: "Extension settings",
      moreOnRelease: (count) => `${count} more files on the release page`,
      sourceZip: "Source code (ZIP)",
      sourceTar: "Source code (TAR.GZ)",
      noRelease: "This repository has no suitable published release.",
      noAssets: "The release has no uploaded binaries. You can download its source code.",
      apiError: "GitHub API is temporarily unavailable.",
      networkError: "Could not load release information.",
      rateLimited: (time) => time ? `GitHub API rate limit reached. Try again after ${time}.` : "GitHub API rate limit reached.",
      release: "Release",
      prerelease: "Pre-release",
      published: "Published",
      downloads: "downloads",
      universal: "universal",
      unknownPlatform: "other platform",
      copyLink: "Copy direct link",
      copied: "Link copied",
      watchQuestion: (repo) => `Watch ${repo} for updates?`,
      watchText: "The extension will check new GitHub Releases locally.",
      watchEnable: "Watch",
      watchLater: "Not now",
      watchingEnabled: "Update tracking enabled",
      watchingUpdated: "Download recorded and tracking updated",
      staleTitle: "This release may be outdated",
      staleText: (date) => `It was published ${date}. Check whether the project is still maintained before downloading.`,
      whyRecommended: "Why this file was selected",
      reasonOs: (os) => `Matches your system: ${os}`,
      reasonArch: (arch) => `Matches your architecture: ${arch}`,
      reasonFormat: (format) => `Suitable format: ${format}`,
      reasonPreference: (format) => `Matches your preference: ${format}`,
      reasonUniversal: "Universal build",
      reasonPopularity: "Popular choice among users",
      formatHints: {
        ".appimage": "Portable Linux app without installation",
        ".flatpakref": "Install with Flatpak",
        ".deb": "Package for Debian, Ubuntu and derivatives",
        ".rpm": "Package for Fedora, RHEL and derivatives",
        ".snap": "Snap package",
        ".tar.gz": "Archive for manual installation",
        ".tar.xz": "Archive for manual installation",
        ".tgz": "Archive for manual installation",
        ".exe": "Windows application or installer",
        ".msi": "Windows installer package",
        ".msix": "Modern Windows package",
        ".msixbundle": "Multi-architecture Windows package",
        ".dmg": "macOS application image",
        ".pkg": "macOS installer package",
        ".apk": "Android application",
        ".apks": "Android split APK set",
        ".aab": "Android App Bundle",
        ".xpi": "Firefox extension",
        ".crx": "Chromium extension",
        ".vsix": "VS Code extension",
        ".jar": "Java application",
        ".zip": "ZIP archive",
        ".7z": "7-Zip archive"
      }
    };
  }

  async function refreshSettings() {
    settings = settingsApi ? await settingsApi.get() : settings;
    strings = createStrings(settings.language);
    return settings;
  }

  function parseRepository() {
    const testRepository = globalThis.__GHDN_TEST_REPOSITORY__;
    if (testRepository && document.querySelector("#repository-container-header")) {
      const owner = String(testRepository.owner || "test-owner");
      const repo = String(testRepository.repo || "test-repository");
      return { owner, repo, key: `${owner.toLowerCase()}/${repo.toLowerCase()}`, parts: [owner, repo] };
    }

    const parts = location.pathname.split("/").filter(Boolean);
    if (parts.length < 2 || RESERVED_ROOTS.has(parts[0].toLowerCase())) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null;
    if (!document.querySelector("#repository-container-header")) return null;
    return { owner, repo, key: `${owner.toLowerCase()}/${repo.toLowerCase()}`, parts };
  }

  function shouldShow(repo) {
    if (!settings.enabled) return false;
    if (settings.showOn === "main") return repo.parts.length === 2;
    if (settings.showOn === "main_releases") return repo.parts.length === 2 || repo.parts[2] === "releases";
    return true;
  }

  function findMountTarget() {
    const header = document.querySelector("#repository-container-header");
    if (!header) return null;
    const legacyActions = header.querySelector("ul.pagehead-actions");
    if (legacyActions) return { element: legacyActions, listMode: true, floating: false };
    const starLink = header.querySelector('a[href$="/stargazers"], a[href*="/stargazers?"]');
    const actionRow = starLink && starLink.closest("ul, .d-flex, [class*='ButtonGroup']");
    if (actionRow) return { element: actionRow, listMode: actionRow.tagName === "UL", floating: false };
    const candidate = header.querySelector(":scope > div") || header;
    return { element: candidate, listMode: false, floating: true };
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function createSvgNode(markup) {
    const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
    if (parsed.querySelector("parsererror")) return document.createTextNode("");
    const svg = parsed.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== "svg") return document.createTextNode("");
    return document.importNode(svg, true);
  }

  function svgIcon(name) {
    const icons = {
      download: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M7.25 1.75a.75.75 0 0 1 1.5 0v7.19l2.72-2.72a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 1.06-1.06l2.72 2.72V1.75Z"/><path fill="currentColor" d="M2.5 12.25a.75.75 0 0 1 .75.75v.25h9.5V13a.75.75 0 0 1 1.5 0v1a.75.75 0 0 1-.75.75h-11A.75.75 0 0 1 1.75 14v-1a.75.75 0 0 1 .75-.75Z"/></svg>',
      chevron: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z"/></svg>',
      linux: '<svg viewBox="0 0 827 1001" aria-hidden="true"><path fill="currentColor" transform="matrix(1 0 0 -1 -24.856 875)" d="M431 634C433 633 435 631 437 631C439 631 443 632 443 634C443 637 440 638 437 639C434 640 429 642 426 640C425 640 425 639 425 638C426 635 429 635 431 634ZM388 631C390 631 392 633 394 634C396 635 400 635 401 637C401 638 401 639 400 639C397 641 392 640 389 639C386 638 383 637 383 634C383 632 386 631 388 631ZM820 86C813 94 810 109 806 125C802 141 799 158 786 169C783 171 781 172 778 174C775 176 773 177 770 178C788 231 781 285 763 333C741 392 702 443 672 478C639 520 606 560 607 619C608 709 617 875 459 875C259 875 308 673 306 611C303 565 294 530 263 485C226 441 174 370 149 296C137 261 132 226 137 192C124 181 114 163 104 152C96 144 84 141 71 136C58 131 44 125 35 108C31 100 30 91 30 83C30 75 31 68 32 60C34 44 37 30 34 20C24 -8 22 -28 29 -42C36 -56 52 -62 69 -66C103 -73 148 -72 184 -91C223 -111 263 -118 294 -111C317 -106 335 -92 344 -71C368 -71 395 -61 438 -59C467 -57 504 -69 546 -67C547 -71 549 -76 551 -80C567 -113 598 -128 630 -125C662 -122 696 -103 724 -70C751 -38 794 -25 823 -7C837 2 850 12 851 28C852 44 842 62 820 86ZM437 704C456 747 504 747 523 705C536 677 529 645 514 626C511 628 503 632 490 636C492 638 495 641 497 645C506 668 497 697 480 698C466 699 453 677 457 653C449 657 438 660 431 662C429 675 431 690 437 704ZM357 727C377 727 398 700 395 662C388 660 381 657 375 653C377 670 368 692 356 691C340 690 337 649 353 636C355 634 356 636 341 625C311 654 320 727 357 727ZM331 608C343 617 357 628 358 629C367 638 385 657 413 657C427 657 443 652 463 639C475 631 486 631 508 621C524 614 534 603 528 586C523 572 507 557 484 550C462 543 445 519 409 521C401 521 395 523 390 525C374 532 366 545 351 554C334 563 326 574 323 584C320 594 323 602 331 608ZM337 -44C332 -113 251 -111 190 -79C132 -48 56 -66 41 -36C36 -27 36 -12 46 15V16C51 31 47 47 45 62C43 77 41 91 46 101C53 114 63 119 75 123C95 130 99 130 114 143C125 154 133 168 142 178C152 189 161 193 176 191C192 189 206 178 219 160L257 91C276 52 341 -4 337 -44ZM335 7C327 20 315 33 306 45C320 45 334 49 339 62C343 74 339 91 325 111C299 147 250 174 250 174C224 190 209 211 202 233C195 255 196 279 201 302C211 347 237 390 254 417C258 420 256 411 237 377C220 346 189 273 232 216C233 256 243 298 259 336C282 390 332 482 336 556C338 554 345 550 348 548C357 543 364 535 373 528C397 508 428 509 455 525C467 532 478 540 487 543C506 549 521 559 530 572C545 513 581 427 603 385C615 363 639 316 649 259C655 259 662 258 670 256C697 326 648 401 625 422C616 431 616 435 620 435C645 413 676 369 688 320C693 297 695 273 689 250C721 237 759 215 749 182H741C747 202 733 216 696 233C658 250 625 250 621 209C597 201 586 180 580 155C575 133 573 107 571 77C570 62 564 42 558 21C495 -24 408 -43 335 7ZM837 29C835 -4 757 -10 714 -62C688 -93 657 -110 629 -112C601 -114 577 -102 563 -74C554 -52 558 -29 565 -3C572 25 583 53 584 76C586 106 588 132 593 152C598 172 605 185 619 193C620 193 620 194 621 194C623 168 636 143 658 137C683 131 718 151 733 168C751 169 764 170 777 158C796 141 791 99 811 77C832 54 838 39 837 29ZM338 585C342 581 348 576 354 571C367 561 385 550 407 550C430 550 452 561 470 571C480 576 490 584 498 591C506 598 509 603 504 604C499 605 500 599 493 594C484 588 474 580 466 575C452 567 427 555 407 555C387 555 371 564 359 574C353 579 348 584 344 588C341 591 340 596 335 597C332 597 331 590 338 585Z"/></svg>',
      windows: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M1.75 2.45 7.3 1.7v5.55H1.75v-4.8Zm6.55-.88 5.95-.82v6.5H8.3V1.57ZM1.75 8.25H7.3v5.55l-5.55-.76V8.25Zm6.55 0h5.95v6.5l-5.95-.82V8.25Z"/></svg>',
      macos: '<svg viewBox="0 0 735 874" aria-hidden="true"><path fill="currentColor" transform="matrix(1 0 0 -1 -8 812)" d="M622 350C622 422 654 476 720 516C683 569 628 597 555 603C486 608 410 562 382 562C353 562 286 601 233 601C124 599 8 514 8 341C8 290 17 237 36 182C61 110 151 -65 245 -62C294 -61 329 -27 393 -27C455 -27 488 -62 543 -62C638 -61 719 99 743 171C616 231 622 346 622 350ZM512 671C565 734 561 791 559 812C512 809 457 780 426 744C392 705 372 658 376 604C427 600 474 626 512 671Z"/></svg>',
      android: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="m5.24 3.22-.72-1.08a.5.5 0 1 1 .83-.55l.76 1.14A5.4 5.4 0 0 1 8 2.4c.67 0 1.31.12 1.9.34l.75-1.14a.5.5 0 1 1 .84.55l-.72 1.08A4.45 4.45 0 0 1 12.45 5H3.55a4.45 4.45 0 0 1 1.69-1.78ZM5.5 4.25a.65.65 0 1 0 0-1.3.65.65 0 0 0 0 1.3Zm5 0a.65.65 0 1 0 0-1.3.65.65 0 0 0 0 1.3ZM3.25 6h9.5v5.25c0 .69-.56 1.25-1.25 1.25H11v1.25a.75.75 0 0 1-1.5 0V12.5h-3v1.25a.75.75 0 0 1-1.5 0V12.5h-.5a1.25 1.25 0 0 1-1.25-1.25V6Z"/></svg>',
      browser: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2.75 1.75h10.5c.83 0 1.5.67 1.5 1.5v9.5c0 .83-.67 1.5-1.5 1.5H2.75c-.83 0-1.5-.67-1.5-1.5v-9.5c0-.83.67-1.5 1.5-1.5Zm0 1.5v1.5h10.5v-1.5H2.75Zm0 3v6.5h10.5v-6.5H2.75Z"/></svg>',
      package: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="m8 1.25 6.25 3.13v7.24L8 14.75l-6.25-3.13V4.38L8 1.25Zm0 1.68L4.05 4.9 8 6.88l3.95-1.98L8 2.93ZM3.25 6.12v4.57l4 2V8.12l-4-2Zm5.5 6.57 4-2V6.12l-4 2v4.57Z"/></svg>',
      source: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5.28 3.22a.75.75 0 0 1 0 1.06L1.56 8l3.72 3.72a.75.75 0 0 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Zm5.44 0a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 1 1-1.06-1.06L14.44 8l-3.72-3.72a.75.75 0 0 1 0-1.06ZM9.64 1.79a.75.75 0 0 1 .53.92l-3 11a.75.75 0 1 1-1.44-.4l3-11a.75.75 0 0 1 .91-.52Z"/></svg>',
      external: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M9.75 1.75a.75.75 0 0 1 .75-.75h4.25c.41 0 .75.34.75.75V6a.75.75 0 0 1-1.5 0V3.56L8.53 9.03a.75.75 0 0 1-1.06-1.06L12.94 2.5H10.5a.75.75 0 0 1-.75-.75Z"/><path fill="currentColor" d="M3.25 2.25h3a.75.75 0 0 1 0 1.5h-3v9h9v-3a.75.75 0 0 1 1.5 0v3.25c0 .69-.56 1.25-1.25 1.25H3A1.25 1.25 0 0 1 1.75 13V3.5c0-.69.56-1.25 1.25-1.25h.25Z"/></svg>'
    };
    const extraIcons = {
      copy: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M5.75 1.75h7A1.25 1.25 0 0 1 14 3v7a1.25 1.25 0 0 1-1.25 1.25h-1V12.5A1.5 1.5 0 0 1 10.25 14h-7a1.5 1.5 0 0 1-1.5-1.5v-7A1.5 1.5 0 0 1 3.25 4h1.25V3a1.25 1.25 0 0 1 1.25-1.25Zm0 2.25h4.5a1.5 1.5 0 0 1 1.5 1.5v4.25h1V3.25h-7V4Zm-2.5 1.5v7h7v-7h-7Z"/></svg>',
      warning: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M7.17 1.55a.96.96 0 0 1 1.66 0l6.04 10.5a.96.96 0 0 1-.83 1.45H1.96a.96.96 0 0 1-.83-1.45l6.04-10.5ZM8 5a.75.75 0 0 0-.75.75v3a.75.75 0 0 0 1.5 0v-3A.75.75 0 0 0 8 5Zm0 6a.88.88 0 1 0 0 1.75A.88.88 0 0 0 8 11Z"/></svg>',
      info: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.25a6.75 6.75 0 1 1 0 13.5 6.75 6.75 0 0 1 0-13.5Zm0 1.5a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5Zm0 4a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 6.75Zm0-2.5a.88.88 0 1 1 0 1.75.88.88 0 0 1 0-1.75Z"/></svg>',
      settings: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M6.9 1.3h2.2l.36 1.43c.36.14.7.33 1.01.56l1.4-.43 1.1 1.9-1.04 1.01c.05.24.07.48.07.73s-.02.5-.07.73l1.04 1.01-1.1 1.9-1.4-.43c-.31.23-.65.42-1.01.56L9.1 11.7H6.9l-.36-1.43a5.1 5.1 0 0 1-1.01-.56l-1.4.43-1.1-1.9 1.04-1.01A3.6 3.6 0 0 1 4 6.5c0-.25.02-.49.07-.73L3.03 4.76l1.1-1.9 1.4.43c.31-.23.65-.42 1.01-.56L6.9 1.3ZM8 4.25a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/></svg>'
    };
    return icons[name] || extraIcons[name] || icons.package;
  }

  function createIcon(name, className = "ghdn-icon") {
    const icon = createElement("span", className);
    icon.replaceChildren(createSvgNode(svgIcon(name)));
    return icon;
  }

  function createRoot(listMode, floating) {
    const root = createElement(listMode ? "li" : "div", "ghdn-root");
    root.id = ROOT_ID;
    if (floating) root.classList.add("ghdn-floating");
    root.classList.add(`ghdn-style-${settings.buttonStyle}`);
    if (!settings.showSubtitle) root.classList.add("ghdn-hide-subtitle");

    const group = createElement("div", "ghdn-button-group");
    const primary = createElement("button", "ghdn-primary");
    primary.type = "button";
    primary.dataset.role = "primary";
    primary.append(createIcon("download", "ghdn-primary-icon"), createElement("span", "ghdn-primary-copy"));
    const copy = primary.querySelector(".ghdn-primary-copy");
    copy.append(createElement("span", "ghdn-primary-title", strings.downloadNow), createElement("span", "ghdn-primary-subtitle", strings.detecting));

    const arrow = createElement("button", "ghdn-arrow");
    arrow.type = "button";
    arrow.dataset.role = "menu";
    arrow.append(createIcon("chevron", "ghdn-arrow-icon"));
    arrow.setAttribute("aria-label", strings.chooseDownload);
    arrow.setAttribute("aria-haspopup", "menu");
    arrow.setAttribute("aria-expanded", "false");

    const menu = createElement("div", "ghdn-menu");
    menu.hidden = true;
    menu.setAttribute("role", "menu");

    primary.addEventListener("click", handlePrimaryClick);
    arrow.addEventListener("click", handleMenuClick);
    group.addEventListener("mouseenter", schedulePrefetch);
    group.addEventListener("mouseleave", cancelPrefetch);
    group.addEventListener("focusin", schedulePrefetch);
    group.append(primary, arrow);
    root.append(group, menu);
    return root;
  }

  async function mount() {
    await settingsReady;
    const repo = parseRepository();
    const existing = document.getElementById(ROOT_ID);

    if (!repo || !shouldShow(repo)) {
      if (existing) existing.remove();
      activeRepoKey = "";
      releaseState = null;
      loadingPromise = null;
      detectedPlatformPromise = null;
      return;
    }

    if (activeRepoKey !== repo.key) {
      activeRepoKey = repo.key;
      releaseState = null;
      loadingPromise = null;
      detectedPlatformPromise = null;
      if (existing) existing.remove();
    } else if (existing && existing.isConnected) {
      return;
    }

    const target = findMountTarget();
    if (!target) return;
    target.element.append(createRoot(target.listMode, target.floating));
    installCloseListeners();
    getDetectedPlatform().then((platform) => updatePrimaryPresentation(null, platform));
  }

  function scheduleMount() {
    clearTimeout(mountTimer);
    mountTimer = setTimeout(() => { mount().catch(() => {}); }, 80);
  }

  function schedulePrefetch() {
    clearTimeout(prefetchTimer);
    prefetchTimer = setTimeout(() => { loadRelease().catch(() => {}); }, 140);
  }

  function cancelPrefetch() {
    clearTimeout(prefetchTimer);
  }

  async function detectPlatform() {
    const ua = navigator.userAgent || "";
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
    else if (/brave/i.test(uaLower) || (navigator.brave && typeof navigator.brave.isBrave === "function")) browserName = "brave";
    else if (/chrome\//i.test(ua)) browserName = "chrome";
    else if (/chromium\//i.test(ua)) browserName = "chromium";

    try {
      if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
        const data = await navigator.userAgentData.getHighEntropyValues(["architecture", "bitness", "platform"]);
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

    if (settings.osOverride !== "auto") os = settings.osOverride;
    if (settings.archOverride !== "auto") arch = settings.archOverride;
    const preferredFormat = settingsApi ? settingsApi.preferredFormatForOs(settings, os) : "auto";
    return { os, arch, browser: browserName, preferredFormat };
  }

  function getDetectedPlatform() {
    if (!detectedPlatformPromise) detectedPlatformPromise = detectPlatform();
    return detectedPlatformPromise;
  }

  function osDisplayName(os) {
    return { windows: "Windows", linux: "Linux", macos: "macOS", android: "Android", browser: "Browser" }[os] || strings.unknownPlatform;
  }

  function archDisplayName(arch) {
    return { x64: "x64", x86: "x86", arm64: "ARM64", arm: "ARM", universal: strings.universal }[arch] || "";
  }

  function platformMetaText(platform) {
    const parts = [];
    if (platform && platform.os && platform.os !== "unknown") parts.push(osDisplayName(platform.os));
    if (platform && platform.arch && platform.arch !== "unknown") parts.push(archDisplayName(platform.arch));
    return parts.join(" · ");
  }

  function setPrimaryText(title, subtitle, iconName = "download") {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const primary = root.querySelector('[data-role="primary"]');
    const titleNode = primary.querySelector(".ghdn-primary-title");
    const subtitleNode = primary.querySelector(".ghdn-primary-subtitle");
    const iconNode = primary.querySelector(".ghdn-primary-icon");
    titleNode.textContent = title;
    subtitleNode.textContent = subtitle || "";
    subtitleNode.hidden = !subtitle || !settings.showSubtitle || settings.buttonStyle === "compact";
    iconNode.replaceChildren(createSvgNode(svgIcon(iconName)));
  }

  async function loadRelease() {
    if (releaseState) return releaseState;
    if (loadingPromise) return loadingPromise;
    const repo = parseRepository();
    if (!repo) throw new Error("Repository not found");
    setLoading(true);

    loadingPromise = (async () => {
      const platform = await getDetectedPlatform();
      const response = await extensionApi.runtime.sendMessage({
        type: "GHDN_GET_LATEST_RELEASE",
        owner: repo.owner,
        repo: repo.repo,
        platform,
        releaseChannel: settings.releaseChannel
      });
      releaseState = { response, platform };
      updatePrimaryPresentation(response, platform);
      return releaseState;
    })().finally(() => {
      loadingPromise = null;
      setLoading(false);
    });
    return loadingPromise;
  }

  function setLoading(isLoading) {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.classList.toggle("ghdn-is-loading", isLoading);
    if (isLoading) setPrimaryText(strings.downloadNow, strings.loading);
  }

  function updatePrimaryPresentation(response, platform) {
    const meta = platformMetaText(platform);
    if (!response || !response.ok) {
      setPrimaryText(strings.downloadNow, meta || strings.detecting);
      return;
    }
    const recommendation = response.recommendation;
    if (recommendation && recommendation.best && recommendation.confidence !== "low") {
      const best = recommendation.best;
      const format = formatDisplayName(best.extension || selector.detectExtension(best.name));
      const preferred = Array.isArray(best.reasons) && best.reasons.some((reason) => reason.startsWith("preference:"));
      const subtitle = [meta, preferred ? strings.preferred : strings.recommended].filter(Boolean).join(" · ");
      setPrimaryText(strings.downloadFormat(format), subtitle, platformIconName(assetPlatform(best)));
      const root = document.getElementById(ROOT_ID);
      if (root) root.querySelector('[data-role="primary"]').title = best.name;
    } else {
      setPrimaryText(strings.chooseDownload, meta);
    }
  }

  async function handlePrimaryClick(event) {
    event.stopPropagation();
    try {
      const state = await loadRelease();
      const response = state.response;
      if (!response.ok) return showResponseError(response);
      if (settings.primaryAction === "release") return openExternal(response.release.html_url);
      if (settings.primaryAction === "menu" || isReleaseStale(response.release)) {
        renderMenu(state); setMenuOpen(true); return;
      }
      const recommended = response.recommendation && response.recommendation.best;
      const confidence = response.recommendation && response.recommendation.confidence;
      if (recommended && confidence !== "low") return startDownload(recommended.browser_download_url, recommended, response.release, state.platform);
      if (!response.release.assets.length && response.release.zipball_url) return startDownload(response.release.zipball_url);
      renderMenu(state); setMenuOpen(true);
    } catch (_error) {
      showToast(strings.networkError, "error");
    }
  }

  async function handleMenuClick(event) {
    event.stopPropagation();
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const menu = root.querySelector(".ghdn-menu");
    if (!menu.hidden) return setMenuOpen(false);
    try {
      const state = await loadRelease();
      if (!state.response.ok) return showResponseError(state.response);
      renderMenu(state); setMenuOpen(true);
    } catch (_error) {
      showToast(strings.networkError, "error");
    }
  }

  function renderMenu(state) {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const menu = root.querySelector(".ghdn-menu");
    menu.replaceChildren();
    const release = state.response.release;
    const ranked = state.response.rankedAssets || [];
    const best = state.response.recommendation && state.response.recommendation.best;
    const bestId = best ? best.id : null;

    const header = createElement("div", "ghdn-menu-header");
    const headerCopy = createElement("div", "ghdn-menu-header-copy");
    const title = createElement("div", "ghdn-release-title", release.name || `${strings.release} ${release.tag_name}`);
    const meta = [release.tag_name || "latest", release.prerelease ? strings.prerelease : "", releaseDateText(release)].filter(Boolean).join(" · ");
    headerCopy.append(title, createElement("div", "ghdn-release-tag", meta));
    header.append(createIcon("download", "ghdn-menu-header-icon"), headerCopy);
    menu.append(header);

    if (isReleaseStale(release)) menu.append(createStaleWarning(release));
    if (settings.showRecommendationReason && best) menu.append(createRecommendationExplanation(best, state.platform));

    if (ranked.length) {
      const compatible = ranked.filter((asset) => isCompatibleAsset(asset, state.platform));
      const compatibleIds = new Set(compatible.map((asset) => asset.id));
      const others = ranked.filter((asset) => !compatibleIds.has(asset.id));
      let rendered = 0;
      if (compatible.length) {
        menu.append(createSectionHeading(strings.suitable, state.platform.os));
        compatible.slice(0, MAX_VISIBLE_ASSETS).forEach((asset) => { menu.append(createAssetRow(asset, asset.id === bestId, state.platform, release)); rendered += 1; });
      }
      if (settings.showOtherPlatforms && others.length && rendered < MAX_VISIBLE_ASSETS) {
        menu.append(createSectionHeading(strings.otherPlatforms, "package"));
        others.slice(0, MAX_VISIBLE_ASSETS - rendered).forEach((asset) => { menu.append(createAssetRow(asset, asset.id === bestId, state.platform, release)); rendered += 1; });
      }
      if (ranked.length > rendered) {
        const more = createElement("a", "ghdn-more-link", strings.moreOnRelease(ranked.length - rendered));
        more.href = release.html_url; more.target = "_blank"; more.rel = "noopener noreferrer";
        more.prepend(createIcon("external", "ghdn-inline-icon")); menu.append(more);
      }
    } else {
      menu.append(createElement("div", "ghdn-empty", strings.noAssets));
    }

    if (settings.showSourceCode) {
      const sourceSection = createElement("div", "ghdn-source-section");
      sourceSection.append(createSectionHeading(strings.sourceCode, "source"));
      if (release.zipball_url) sourceSection.append(createLinkButton(strings.sourceZip, release.zipball_url, "source"));
      if (release.tarball_url) sourceSection.append(createLinkButton(strings.sourceTar, release.tarball_url, "source"));
      if (sourceSection.childElementCount > 1) menu.append(sourceSection);
    }

    const footer = createElement("div", "ghdn-menu-footer");
    const releaseLink = createElement("a", "ghdn-release-link", strings.openRelease);
    releaseLink.href = release.html_url; releaseLink.target = "_blank"; releaseLink.rel = "noopener noreferrer";
    releaseLink.prepend(createIcon("external", "ghdn-inline-icon"));
    const settingsButton = createElement("button", "ghdn-settings-link", strings.openSettings);
    settingsButton.type = "button"; settingsButton.prepend(createIcon("settings", "ghdn-inline-icon"));
    settingsButton.addEventListener("click", () => extensionApi.runtime.openOptionsPage());
    footer.append(releaseLink, settingsButton); menu.append(footer);
  }

  function createStaleWarning(release) {
    const box = createElement("div", "ghdn-stale-warning");
    const icon = createIcon("warning", "ghdn-warning-icon");
    const copy = createElement("div", "ghdn-warning-copy");
    copy.append(createElement("strong", "", strings.staleTitle), createElement("span", "", strings.staleText(formatReleaseDate(release.published_at))));
    box.append(icon, copy); return box;
  }

  function createRecommendationExplanation(asset, platform) {
    const details = createElement("details", "ghdn-reason-box");
    const summary = createElement("summary", "ghdn-reason-summary");
    summary.append(createIcon("info", "ghdn-inline-icon"), createElement("span", "", strings.whyRecommended));
    details.append(summary);
    const list = createElement("ul", "ghdn-reason-list");
    const reasons = Array.isArray(asset.reasons) ? asset.reasons : [];
    const extension = asset.extension || selector.detectExtension(asset.name);
    const added = new Set();
    const add = (key, text) => { if (text && !added.has(key)) { added.add(key); list.append(createElement("li", "", text)); } };
    if (reasons.some((r) => r === `os:${platform.os}` || r === "os:inferred")) add("os", strings.reasonOs(osDisplayName(platform.os)));
    if (reasons.some((r) => r === `arch:${platform.arch}`)) add("arch", strings.reasonArch(archDisplayName(platform.arch)));
    if (reasons.includes("arch:universal")) add("universal", strings.reasonUniversal);
    const pref = reasons.find((r) => r.startsWith("preference:"));
    if (pref) add("preference", strings.reasonPreference(formatDisplayName(extension)));
    add("format", strings.reasonFormat(formatDisplayName(extension)));
    if (Number(asset.download_count) > 1000) add("popular", strings.reasonPopularity);
    details.append(list); return details;
  }

  function createSectionHeading(label, iconName) {
    const heading = createElement("div", "ghdn-section-heading");
    heading.append(createIcon(platformIconName(iconName), "ghdn-section-icon"), createElement("span", "", label));
    return heading;
  }

  function createAssetRow(asset, recommended, currentPlatform, release) {
    const row = createElement("div", "ghdn-asset-row");
    const button = createElement("button", "ghdn-asset");
    button.type = "button"; button.setAttribute("role", "menuitem"); button.title = asset.name;
    const detectedOs = assetPlatform(asset);
    const iconWrap = createElement("span", `ghdn-platform-icon ghdn-platform-${detectedOs}`);
    iconWrap.append(createIcon(platformIconName(detectedOs), "ghdn-platform-svg"));
    const details = createElement("span", "ghdn-asset-details");
    const extension = asset.extension || selector.detectExtension(asset.name);
    const name = createElement("span", "ghdn-asset-name", asset.name);
    const metaParts = [formatDisplayName(extension), osDisplayName(detectedOs), assetArchitecture(asset, currentPlatform), formatBytes(asset.size)].filter(Boolean);
    const meta = createElement("span", "ghdn-asset-meta", metaParts.join(" · "));
    const hint = createElement("span", "ghdn-asset-hint", strings.formatHints[extension] || `${Number(asset.download_count || 0).toLocaleString()} ${strings.downloads}`);
    details.append(name, meta, hint);
    const side = createElement("span", "ghdn-asset-side");
    if (recommended) {
      row.classList.add("ghdn-recommended-row"); button.classList.add("ghdn-recommended");
      const preferred = Array.isArray(asset.reasons) && asset.reasons.some((reason) => reason.startsWith("preference:"));
      side.append(createElement("span", "ghdn-badge", preferred ? strings.preferred : strings.recommended));
    }
    side.append(createIcon("download", "ghdn-row-download"));
    button.append(iconWrap, details, side);
    button.addEventListener("click", () => startDownload(asset.browser_download_url, asset, release, currentPlatform));

    const copyButton = createElement("button", "ghdn-copy-link");
    copyButton.type = "button"; copyButton.title = strings.copyLink; copyButton.setAttribute("aria-label", strings.copyLink);
    copyButton.append(createIcon("copy", "ghdn-copy-icon"));
    copyButton.addEventListener("click", (event) => { event.stopPropagation(); copyText(asset.browser_download_url); });
    row.append(button, copyButton); return row;
  }

  function createLinkButton(label, url, iconName) {
    const link = createElement("a", "ghdn-source-link", label);
    link.href = url; link.prepend(createIcon(iconName, "ghdn-inline-icon"));
    link.addEventListener("click", () => setMenuOpen(false)); return link;
  }

  function isCompatibleAsset(asset, platform) {
    const reasons = Array.isArray(asset.reasons) ? asset.reasons : [];
    if (reasons.includes("os:mismatch") || reasons.includes("format:mismatch") || reasons.includes("arch:mismatch")) return false;
    const detectedOs = assetPlatform(asset);
    if (platform.os !== "unknown" && detectedOs !== "unknown" && detectedOs !== "browser" && detectedOs !== platform.os) return false;
    return Number(asset.score) >= 20;
  }

  function assetPlatform(asset) {
    const name = typeof asset === "string" ? asset : asset && asset.name;
    const extension = typeof asset === "object" && asset.extension ? asset.extension : selector.detectExtension(name);
    const markers = selector.detectOsMarkers(name || "");
    if (markers.length) return markers[0];
    const extensionOs = {
      ".exe": "windows", ".msi": "windows", ".msix": "windows", ".msixbundle": "windows", ".appx": "windows", ".appxbundle": "windows",
      ".appimage": "linux", ".flatpakref": "linux", ".deb": "linux", ".rpm": "linux", ".snap": "linux",
      ".dmg": "macos", ".pkg": "macos", ".apk": "android", ".apks": "android", ".aab": "android",
      ".xpi": "browser", ".crx": "browser", ".vsix": "browser"
    };
    return extensionOs[extension] || "unknown";
  }

  function assetArchitecture(asset, currentPlatform) {
    const markers = selector.detectArchMarkers(asset.name || "");
    if (markers.length) return markers.map(archDisplayName).filter(Boolean).join("/");
    if (isCompatibleAsset(asset, currentPlatform) && currentPlatform.arch !== "unknown") return archDisplayName(currentPlatform.arch);
    return "";
  }

  function platformIconName(platform) {
    return ["linux", "windows", "macos", "android", "browser", "source", "package"].includes(platform) ? platform : "package";
  }

  function formatDisplayName(extension) {
    const names = {
      ".appimage": "AppImage", ".flatpakref": "Flatpak", ".deb": "DEB", ".rpm": "RPM", ".snap": "Snap",
      ".tar.gz": "TAR.GZ", ".tar.xz": "TAR.XZ", ".tgz": "TGZ", ".zip": "ZIP", ".7z": "7Z",
      ".exe": "EXE", ".msi": "MSI", ".msix": "MSIX", ".msixbundle": "MSIX Bundle", ".appx": "APPX", ".appxbundle": "APPX Bundle",
      ".dmg": "DMG", ".pkg": "PKG", ".apk": "APK", ".apks": "APKS", ".aab": "AAB", ".xpi": "XPI", ".crx": "CRX", ".vsix": "VSIX", ".jar": "JAR"
    };
    return names[extension] || (extension ? extension.replace(/^\./, "").toUpperCase() : "file");
  }

  function isReleaseStale(release) {
    const threshold = Number(settings.staleReleaseMonths) || 0;
    if (!threshold || !release || !release.published_at) return false;
    const published = new Date(release.published_at).getTime();
    if (!Number.isFinite(published)) return false;
    return Date.now() - published > threshold * 30.4375 * 24 * 60 * 60 * 1000;
  }

  function formatReleaseDate(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return date.toLocaleDateString(settings.language === "ru" ? "ru-RU" : settings.language === "en" ? "en-US" : undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function releaseDateText(release) {
    const date = formatReleaseDate(release && release.published_at);
    return date ? `${strings.published} ${date}` : "";
  }

  async function startDownload(url, asset = null, release = null, platform = null) {
    if (!url || !/^https:\/\//i.test(url)) return showToast(strings.networkError, "error");
    setMenuOpen(false);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.rel = "noopener noreferrer"; document.body.append(anchor); anchor.click(); anchor.remove();

    if (!asset || !release || !platform) return;
    const repo = parseRepository();
    if (!repo) return;
    const download = {
      owner: repo.owner,
      repo: repo.repo,
      releaseId: release.id,
      releaseTag: release.tag_name,
      releaseName: release.name,
      releaseUrl: release.html_url,
      releasePublishedAt: release.published_at,
      releasePrerelease: Boolean(release.prerelease),
      assetId: asset.id,
      assetName: asset.name,
      assetUrl: asset.browser_download_url,
      assetExtension: asset.extension || selector.detectExtension(asset.name),
      assetSize: asset.size,
      platform,
      releaseChannel: settings.releaseChannel,
      downloadedAt: new Date().toISOString()
    };

    try {
      const result = await extensionApi.runtime.sendMessage({ type: "GHDN_RECORD_DOWNLOAD", download });
      if (!result || !result.ok || result.incognito) return;
      if (result.watchState === "prompt") showWatchPrompt(download);
      else if (result.watchState === "watching") showToast(strings.watchingUpdated, "success");
    } catch (_error) {}
  }

  function showWatchPrompt(download) {
    let prompt = document.getElementById("ghdn-watch-prompt");
    if (prompt) prompt.remove();
    prompt = createElement("div", "ghdn-watch-prompt");
    prompt.id = "ghdn-watch-prompt";
    const copy = createElement("div", "ghdn-watch-copy");
    copy.append(
      createElement("strong", "", strings.watchQuestion(`${download.owner}/${download.repo}`)),
      createElement("span", "", strings.watchText)
    );
    const actions = createElement("div", "ghdn-watch-actions");
    const enable = createElement("button", "ghdn-watch-enable", strings.watchEnable);
    const later = createElement("button", "ghdn-watch-later", strings.watchLater);
    enable.type = "button";
    later.type = "button";
    enable.addEventListener("click", async () => {
      enable.disabled = true;
      try {
        const result = await extensionApi.runtime.sendMessage({ type: "GHDN_WATCH_REPOSITORY", download });
        if (result && result.ok) showToast(strings.watchingEnabled, "success");
      } catch (_error) {}
      prompt.remove();
    });
    later.addEventListener("click", () => prompt.remove());
    actions.append(enable, later);
    prompt.append(createIcon("info", "ghdn-watch-icon"), copy, actions);
    document.body.append(prompt);
    clearTimeout(showWatchPrompt.timer);
    showWatchPrompt.timer = setTimeout(() => { if (prompt.isConnected) prompt.remove(); }, 12000);
  }

  function openExternal(url) {
    if (!url || !/^https:\/\//i.test(url)) return showToast(strings.networkError, "error");
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
      else {
        const area = createElement("textarea"); area.value = text; area.style.position = "fixed"; area.style.opacity = "0";
        document.body.append(area); area.select(); document.execCommand("copy"); area.remove();
      }
      showToast(strings.copied, "success");
    } catch (_error) { showToast(strings.networkError, "error"); }
  }

  function setMenuOpen(open) {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const menu = root.querySelector(".ghdn-menu");
    const arrow = root.querySelector('[data-role="menu"]');
    menu.hidden = !open; root.classList.toggle("ghdn-menu-open", open); arrow.setAttribute("aria-expanded", String(open));
  }

  function installCloseListeners() {
    if (closeListenerInstalled) return;
    closeListenerInstalled = true;
    document.addEventListener("click", (event) => { const root = document.getElementById(ROOT_ID); if (root && !root.contains(event.target)) setMenuOpen(false); });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") setMenuOpen(false); });
  }

  function showResponseError(response) {
    if (response.error === "no_release") showToast(strings.noRelease, "warning");
    else if (response.error === "rate_limited") {
      const time = response.resetAt ? new Date(response.resetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
      showToast(strings.rateLimited(time), "warning");
    } else if (response.error === "network_error") showToast(strings.networkError, "error");
    else showToast(strings.apiError, "error");
  }

  function showToast(message, type) {
    let toast = document.getElementById("ghdn-toast");
    if (!toast) { toast = createElement("div", "ghdn-toast"); toast.id = "ghdn-toast"; document.body.append(toast); }
    toast.className = `ghdn-toast ghdn-toast-${type}`; toast.textContent = message; toast.hidden = false;
    clearTimeout(showToast.timer); showToast.timer = setTimeout(() => { toast.hidden = true; }, 3500);
  }

  function formatBytes(value) {
    const bytes = Number(value) || 0;
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let amount = bytes / 1024; let index = 0;
    while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index += 1; }
    return `${amount >= 10 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
  }

  if (settingsApi) {
    settingsApi.onChanged((next) => {
      settings = next; strings = createStrings(settings.language); settingsReady = Promise.resolve(settings);
      activeRepoKey = ""; releaseState = null; loadingPromise = null; detectedPlatformPromise = null;
      const root = document.getElementById(ROOT_ID); if (root) root.remove(); scheduleMount();
    });
  }

  document.addEventListener("turbo:load", scheduleMount);
  document.addEventListener("pjax:end", scheduleMount);
  window.addEventListener("popstate", scheduleMount);
  new MutationObserver(scheduleMount).observe(document.documentElement, { childList: true, subtree: true });
  scheduleMount();
})();
