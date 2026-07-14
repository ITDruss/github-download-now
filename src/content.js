"use strict";

(() => {
  const extensionApi = typeof browser !== "undefined" ? browser : chrome;
  const selector = globalThis.GHDNAssetSelector;
  const settingsApi = globalThis.GHDNSettings;
  const installGuides = globalThis.GHDNInstallGuides;
  const ROOT_ID = "ghdn-root";
  const MENU_ID = "ghdn-menu";
  const NOTICE_STACK_ID = "ghdn-notice-stack";
  const TOOLBAR_BREAKPOINT = 760;
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
  let buildInstructionsState = null;
  let buildInstructionsPromise = null;
  let loadingPromise = null;
  let detectedPlatformPromise = null;
  let mountTimer = null;
  let prefetchTimer = null;
  let closeListenerInstalled = false;
  let layoutFrame = null;
  let resizeObserver = null;
  let observedLayoutHost = null;
  let placementBusy = false;
  let rejectedToolbarHost = null;
  let rejectedToolbarWidth = 0;
  let settingsReady = refreshSettings();

  function createStrings(language) {
    const russian = language === "ru" || (language !== "en" && /^(ru|uk|be|kk)(-|$)/i.test(navigator.language || ""));
    return russian ? {
      downloadNow: "Скачать сейчас",
      downloadCompact: "Скачать",
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
      buildFromSource: "Документация по сборке",
      buildLoading: "Ищу документы по сборке…",
      buildNotFound: "Документы по сборке не найдены.",
      buildError: "Не удалось получить документы по сборке.",
      buildFallbackNotice: "Ссылки ведут на основную ветку: документация для тега релиза недоступна.",
      installHelp: "Как установить или запустить",
      installAfterDownload: "Файл скачивается — что делать дальше",
      installCopyCommand: "Копировать команду",
      installCopyAll: "Копировать все команды",
      installCopied: "Команда скопирована",
      installClose: "Закрыть",
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
        ".flatpak": "Локальный пакет Flatpak",
        ".deb": "Пакет для Debian, Ubuntu и производных",
        ".rpm": "Пакет для Fedora, RHEL и производных",
        ".snap": "Пакет Snap",
        ".run": "Исполняемый установщик Linux",
        ".sh": "Shell-скрипт — проверьте перед запуском",
        ".tar.gz": "Архив для ручной установки",
        ".tar.xz": "Архив для ручной установки",
        ".tar.zst": "Архив для ручной установки",
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
      downloadCompact: "Download",
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
      buildFromSource: "Build documentation",
      buildLoading: "Looking for build documentation…",
      buildNotFound: "No build documentation was found.",
      buildError: "Could not load build documentation.",
      buildFallbackNotice: "Links point to the default branch because documentation for the release tag is unavailable.",
      installHelp: "How to install or run",
      installAfterDownload: "The file is downloading — what to do next",
      installCopyCommand: "Copy command",
      installCopyAll: "Copy all commands",
      installCopied: "Command copied",
      installClose: "Close",
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
        ".flatpak": "Local Flatpak bundle",
        ".deb": "Package for Debian, Ubuntu and derivatives",
        ".rpm": "Package for Fedora, RHEL and derivatives",
        ".snap": "Snap package",
        ".run": "Executable Linux installer",
        ".sh": "Shell script — review before running",
        ".tar.gz": "Archive for manual installation",
        ".tar.xz": "Archive for manual installation",
        ".tar.zst": "Archive for manual installation",
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
    if (testRepository) {
      const owner = String(testRepository.owner || "test-owner");
      const repo = String(testRepository.repo || "test-repository");
      const parts = Array.isArray(testRepository.parts) && testRepository.parts.length >= 2
        ? testRepository.parts.map((part) => String(part))
        : [owner, repo];
      return { owner, repo, key: `${owner.toLowerCase()}/${repo.toLowerCase()}`, parts };
    }

    const parts = location.pathname.split("/").filter(Boolean);
    if (parts.length < 2 || RESERVED_ROOTS.has(parts[0].toLowerCase())) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) return null;
    const repositoryNwo = document
      .querySelector('meta[name="octolytics-dimension-repository_nwo"]')
      ?.getAttribute("content");

    if (
      repositoryNwo &&
      repositoryNwo.toLowerCase() !== `${owner}/${repo}`.toLowerCase()
    ) {
      return null;
    }

    if (
      !repositoryNwo &&
      !document.querySelector("#repository-container-header")
    ) {
      return null;
    }
    return { owner, repo, key: `${owner.toLowerCase()}/${repo.toLowerCase()}`, parts };
  }

  function shouldShow(repo) {
    if (!settings.enabled) return false;
    if (settings.showOn === "main") return repo.parts.length === 2;
    if (settings.showOn === "main_releases") return repo.parts.length === 2 || repo.parts[2] === "releases";
    return true;
  }

  function isVisibleElement(element) {
    if (!element || !element.isConnected || element.closest(`#${ROOT_ID}`)) return false;

    const style = getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      Number(style.opacity) === 0
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function normalizedActionText(element) {
    return [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.textContent
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function actionKind(element) {
    if (!element) return "";
    const label = normalizedActionText(element);
    const aria = element.getAttribute("aria-label") || "";
    const href = element.getAttribute("href") || "";

    if (/\/stargazers(?:[/?#]|$)/i.test(href) || /(^|\s)Star(?:\s|$)/i.test(label) || /star/i.test(aria)) {
      return "star";
    }
    if (/\/forks(?:[/?#]|$)/i.test(href) || /(^|\s)Fork(?:\s|$)/i.test(label) || /fork/i.test(aria)) {
      return "fork";
    }
    if (/(^|\s)Watch(?:\s|$)/i.test(label) || /watch/i.test(aria)) {
      return "watch";
    }
    if (/(^|\s)Sponsor(?:\s|$)/i.test(label) || /sponsor/i.test(aria)) {
      return "sponsor";
    }
    return "";
  }

  function isStarActionControl(element) {
    return actionKind(element) === "star";
  }

  function collectVisibleActionControls() {
    const selectors = [
      'a[href$="/stargazers"]',
      'a[href*="/stargazers?"]',
      'a[href$="/forks"]',
      'a[href*="/forks?"]',
      'button[aria-label*="Star" i]',
      'button[aria-label*="Fork" i]',
      'button[aria-label*="Watch" i]',
      'summary[aria-label*="Star" i]',
      'summary[aria-label*="Fork" i]',
      'summary[aria-label*="Watch" i]',
      'a[aria-label*="Sponsor" i]'
    ];

    const controls = new Set();
    for (const element of document.querySelectorAll(selectors.join(","))) {
      if (isVisibleElement(element) && actionKind(element)) controls.add(element);
    }

    for (const element of document.querySelectorAll("a, button, summary")) {
      if (!isVisibleElement(element)) continue;
      if (actionKind(element)) controls.add(element);
    }

    return [...controls];
  }

  function directChildWithin(container, descendant) {
    let node = descendant;
    while (node && node.parentElement !== container) node = node.parentElement;
    return node && node.parentElement === container ? node : null;
  }

  function actionKindsWithin(container, controls) {
    return new Set(
      controls
        .filter((control) => container.contains(control))
        .map(actionKind)
        .filter(Boolean)
    );
  }

  function findCompleteActionGroup(control, controls) {
    const kind = actionKind(control);
    if (!kind) return null;

    let node = control;
    let best = control;
    let depth = 0;

    while (node.parentElement && node.parentElement !== document.body && depth < 8) {
      const parent = node.parentElement;
      if (!isVisibleElement(parent)) break;

      const rect = parent.getBoundingClientRect();
      if (rect.height < 20 || rect.height > 88) break;

      const kinds = actionKindsWithin(parent, controls);
      if (kinds.size !== 1 || !kinds.has(kind)) break;

      best = parent;
      node = parent;
      depth += 1;
    }

    return best;
  }

  function findToolbarForActionGroup(group, controls) {
    let node = group && group.parentElement;
    let depth = 0;

    while (node && node !== document.body && depth < 6) {
      if (isVisibleElement(node)) {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const layout = style.display;
        const groupChild = directChildWithin(node, group);
        const kinds = actionKindsWithin(node, controls);

        if (
          groupChild &&
          kinds.size >= 2 &&
          ["flex", "inline-flex", "grid", "inline-grid"].includes(layout) &&
          rect.height >= 24 &&
          rect.height <= 88 &&
          rect.width >= 120
        ) {
          return { element: node, group: groupChild, depth };
        }
      }

      node = node.parentElement;
      depth += 1;
    }

    return null;
  }

  function findToolbarTarget() {
    const controls = collectVisibleActionControls();
    if (controls.length < 2) return null;

    const seenGroups = new Set();
    const candidates = [];

    for (const starControl of controls.filter(isStarActionControl)) {
      const completeGroup = findCompleteActionGroup(starControl, controls);
      if (!completeGroup || seenGroups.has(completeGroup)) continue;
      seenGroups.add(completeGroup);

      const toolbar = findToolbarForActionGroup(completeGroup, controls);
      if (!toolbar) continue;

      const hostRect = toolbar.element.getBoundingClientRect();
      const groupRect = toolbar.group.getBoundingClientRect();
      const flexDirection = getComputedStyle(toolbar.element).flexDirection || "row";

      candidates.push({
        mode: "toolbar",
        element: toolbar.element,
        insertBefore: /-reverse$/.test(flexDirection),
        anchor: toolbar.group,
        listMode: toolbar.element.tagName === "UL",
        score:
          toolbar.depth * -40 -
          hostRect.height * 0.2 -
          hostRect.width * 0.001 +
          groupRect.right * 0.0001
      });
    }

    if (!candidates.length) return null;
    return candidates.sort((a, b) => b.score - a.score)[0];
  }

  function isFlowEligibleRoute(repo) {
    if (!repo || repo.parts.length === 2) return true;
    const section = String(repo.parts[2] || "").toLowerCase();
    return section === "releases" || section === "tags";
  }

  function findFlowTarget(repo) {
    if (!isFlowEligibleRoute(repo)) return null;

    const candidates = [
      document.querySelector("#repo-content-pjax-container"),
      document.querySelector("main#js-repo-pjax-container"),
      document.querySelector("main .Layout-main"),
      document.querySelector("main")
    ];

    const element = candidates.find((candidate) => candidate && isVisibleElement(candidate));
    if (!element) return null;
    return { mode: "flow", element, prepend: true, listMode: false };
  }

  function findMountTarget(repo, options = {}) {
    if (!options.preferFlow && window.innerWidth >= TOOLBAR_BREAKPOINT) {
      const toolbar = findToolbarTarget();
      if (toolbar) {
        const currentWidth = toolbar.element.clientWidth;
        const stillRejected =
          rejectedToolbarHost === toolbar.element &&
          Math.abs(rejectedToolbarWidth - currentWidth) < 4;
        if (!stillRejected) return toolbar;
      }
    }

    const flow = findFlowTarget(repo);
    if (flow) return flow;

    return {
      mode: "floating",
      element: document.body,
      listMode: false
    };
  }

  function insertRoot(root, target) {
    if (target.anchor && target.anchor.parentElement === target.element) {
      if (target.insertBefore) {
        target.element.insertBefore(root, target.anchor);
      } else {
        target.element.insertBefore(root, target.anchor.nextSibling);
      }
    } else if (target.prepend) {
      target.element.prepend(root);
    } else {
      target.element.append(root);
    }
    root.__ghdnLayoutHost = target.element;
  }

  function observeLayoutHost(element) {
    if (observedLayoutHost === element) return;
    if (resizeObserver) resizeObserver.disconnect();
    observedLayoutHost = element || null;
    if (!element || typeof ResizeObserver === "undefined") return;
    resizeObserver = new ResizeObserver(scheduleLayoutRefresh);
    resizeObserver.observe(element);
  }

  function toolbarFits(root) {
    if (!root || !root.isConnected) return false;
    const host = root.__ghdnLayoutHost || root.parentElement;
    if (!host || !isVisibleElement(host)) return false;

    const rootRect = root.getBoundingClientRect();
    if (rootRect.width <= 0 || rootRect.height <= 0) return false;
    if (rootRect.right > window.innerWidth - 8) return false;
    if (host.scrollWidth > host.clientWidth + 3) return false;

    const sibling = [...host.children].find((child) => child !== root && isVisibleElement(child));
    if (sibling) {
      const siblingRect = sibling.getBoundingClientRect();
      if (Math.abs(rootRect.top - siblingRect.top) > 10) return false;
    }
    return true;
  }

  function applyToolbarDensity(root) {
    if (!root || root.dataset.placement !== "toolbar") return true;
    root.classList.remove("ghdn-density-compact");
    root.classList.add("ghdn-density-full");
    if (toolbarFits(root)) return true;

    root.classList.remove("ghdn-density-full");
    root.classList.add("ghdn-density-compact");
    return toolbarFits(root);
  }

  function scheduleLayoutRefresh() {
    if (layoutFrame) cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = null;
      refreshPlacement().catch((error) => {
        console.warn("[GHDN] layout refresh failed", error);
      });
    });
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

  function createSvgNode(markup) {
    const source = markup.replace(
      /^<svg\b(?![^>]*\bxmlns=)/,
      `<svg xmlns="${SVG_NAMESPACE}"`
    );
    const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
    if (parsed.querySelector("parsererror")) return document.createTextNode("");
    const svg = parsed.documentElement;
    if (
      !svg ||
      svg.nodeName.toLowerCase() !== "svg" ||
      svg.namespaceURI !== SVG_NAMESPACE
    ) {
      return document.createTextNode("");
    }
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

  function createRoot(target) {
    const root = createElement(target.listMode ? "li" : "div", "ghdn-root");
    root.id = ROOT_ID;
    root.dataset.placement = target.mode;
    root.classList.add(`ghdn-placement-${target.mode}`, "ghdn-density-full");
    root.classList.add(`ghdn-style-${settings.buttonStyle}`);
    if (!settings.showSubtitle) root.classList.add("ghdn-hide-subtitle");

    const group = createElement("div", "ghdn-button-group");
    const primary = createElement("button", "ghdn-primary");
    primary.type = "button";
    primary.dataset.role = "primary";
    primary.append(createIcon("download", "ghdn-primary-icon"), createElement("span", "ghdn-primary-copy"));
    const copy = primary.querySelector(".ghdn-primary-copy");
    const title = createElement("span", "ghdn-primary-title");
    title.append(
      createElement("span", "ghdn-primary-title-full", strings.downloadNow),
      createElement("span", "ghdn-primary-title-compact", strings.downloadCompact)
    );
    copy.append(title, createElement("span", "ghdn-primary-subtitle", strings.detecting));

    const arrow = createElement("button", "ghdn-arrow");
    arrow.type = "button";
    arrow.dataset.role = "menu";
    arrow.append(createIcon("chevron", "ghdn-arrow-icon"));
    arrow.setAttribute("aria-label", strings.chooseDownload);
    arrow.setAttribute("aria-haspopup", "menu");
    arrow.setAttribute("aria-controls", MENU_ID);
    arrow.setAttribute("aria-expanded", "false");

    primary.addEventListener("click", handlePrimaryClick);
    arrow.addEventListener("click", handleMenuClick);
    group.addEventListener("mouseenter", schedulePrefetch);
    group.addEventListener("mouseleave", cancelPrefetch);
    group.addEventListener("focusin", schedulePrefetch);
    group.append(primary, arrow);
    root.append(group);
    return root;
  }

  function ensureMenu() {
    let menu = document.getElementById(MENU_ID);
    if (menu) return menu;
    menu = createElement("div", "ghdn-menu");
    menu.id = MENU_ID;
    menu.hidden = true;
    menu.setAttribute("role", "menu");
    document.body.append(menu);
    return menu;
  }

  async function refreshPlacement(options = {}) {
    if (placementBusy) return;
    placementBusy = true;
    try {
      await settingsReady;
      const repo = parseRepository();
      let existing = document.getElementById(ROOT_ID);

      if (!repo || !shouldShow(repo)) {
        if (existing) existing.remove();
        setMenuOpen(false);
        activeRepoKey = "";
        releaseState = null;
        buildInstructionsState = null;
        buildInstructionsPromise = null;
        loadingPromise = null;
        detectedPlatformPromise = null;
        observeLayoutHost(null);
        return;
      }

      if (activeRepoKey !== repo.key) {
        activeRepoKey = repo.key;
        releaseState = null;
        buildInstructionsState = null;
        buildInstructionsPromise = null;
        loadingPromise = null;
        detectedPlatformPromise = null;
        if (existing) existing.remove();
        existing = null;
        setMenuOpen(false);
      }

      const target = findMountTarget(repo, options);
      if (!target) return;
      const sameTarget =
        existing &&
        existing.dataset.placement === target.mode &&
        existing.__ghdnLayoutHost === target.element &&
        existing.isConnected;

      if (!sameTarget) {
        if (existing) existing.remove();
        existing = createRoot(target);
        insertRoot(existing, target);
        installCloseListeners();
        getDetectedPlatform().then((platform) => updatePrimaryPresentation(releaseState && releaseState.response, platform));
      }

      observeLayoutHost(target.element);

      if (target.mode === "toolbar") {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (!applyToolbarDensity(existing)) {
          rejectedToolbarHost = target.element;
          rejectedToolbarWidth = target.element.clientWidth;
          existing.remove();
          existing = null;
          const fallback = findMountTarget(repo, { preferFlow: true });
          const flowRoot = createRoot(fallback);
          insertRoot(flowRoot, fallback);
          observeLayoutHost(fallback.element);
          getDetectedPlatform().then((platform) => updatePrimaryPresentation(releaseState && releaseState.response, platform));
        } else {
          rejectedToolbarHost = null;
          rejectedToolbarWidth = 0;
        }
      } else if (target.mode === "floating") {
        existing.classList.remove("ghdn-density-full");
        existing.classList.add("ghdn-density-compact");
      }

      if (!ensureMenu().hidden) positionMenu();
    } finally {
      placementBusy = false;
    }
  }

  async function mount() {
    await refreshPlacement();
  }

  function scheduleMount() {
    clearTimeout(mountTimer);
    mountTimer = setTimeout(() => {
      mount().catch((error) => {
        console.warn("[GHDN] mount failed", error);
      });
    }, 80);
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
    const fullTitleNode = primary.querySelector(".ghdn-primary-title-full");
    const compactTitleNode = primary.querySelector(".ghdn-primary-title-compact");
    const subtitleNode = primary.querySelector(".ghdn-primary-subtitle");
    const iconNode = primary.querySelector(".ghdn-primary-icon");
    fullTitleNode.textContent = title;
    compactTitleNode.textContent = strings.downloadCompact;
    subtitleNode.textContent = subtitle || "";
    subtitleNode.hidden =
      !subtitle ||
      !settings.showSubtitle ||
      settings.buttonStyle === "compact" ||
      root.dataset.placement === "toolbar";
    iconNode.replaceChildren(createSvgNode(svgIcon(iconName)));
    scheduleLayoutRefresh();
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
    const menu = ensureMenu();
    if (!menu.hidden) return setMenuOpen(false);
    try {
      const state = await loadRelease();
      if (!state.response.ok) return showResponseError(state.response);
      renderMenu(state); setMenuOpen(true);
    } catch (_error) {
      showToast(strings.networkError, "error");
    }
  }

  async function loadBuildInstructions(release) {
    const repo = parseRepository();
    if (!repo) throw new Error("Repository not found");
    const ref = String(release && release.tag_name || "");
    const key = `${repo.key}:${ref || "default"}`;
    if (buildInstructionsState && buildInstructionsState.key === key) {
      return buildInstructionsState.response;
    }
    if (buildInstructionsPromise && buildInstructionsPromise.key === key) {
      return buildInstructionsPromise.promise;
    }

    const promise = extensionApi.runtime.sendMessage({
      type: "GHDN_GET_BUILD_INSTRUCTIONS",
      owner: repo.owner,
      repo: repo.repo,
      ref
    }).then((response) => {
      buildInstructionsState = { key, response };
      return response;
    }).finally(() => {
      if (buildInstructionsPromise && buildInstructionsPromise.key === key) {
        buildInstructionsPromise = null;
      }
    });

    buildInstructionsPromise = { key, promise };
    return promise;
  }

  function createBuildDocumentationControl(release) {
    const container = createElement("div", "ghdn-build-docs");
    const heading = createElement("div", "ghdn-build-docs-heading");
    heading.append(
      createIcon("source", "ghdn-inline-icon"),
      createElement("span", "", strings.buildFromSource)
    );

    const links = createElement("div", "ghdn-build-docs-links");
    links.append(createBuildStatus(strings.buildLoading, "loading"));
    container.append(heading, links);

    loadBuildInstructions(release)
      .then((response) => {
        renderBuildDocumentationLinks(container, links, response);
        requestAnimationFrame(positionMenu);
      })
      .catch(() => {
        links.replaceChildren(createBuildStatus(strings.buildError, "error"));
        requestAnimationFrame(positionMenu);
      });

    return container;
  }

  function createBuildStatus(message, type) {
    const status = createElement("div", `ghdn-build-status ghdn-build-status-${type}`);
    status.append(
      createIcon(type === "error" ? "warning" : "info", "ghdn-inline-icon"),
      createElement("span", "", message)
    );
    return status;
  }

  function renderBuildDocumentationLinks(container, links, response) {
    links.replaceChildren();

    if (!response || !response.ok) {
      if (response && response.error === "rate_limited") {
        const time = response.resetAt
          ? new Date(response.resetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : null;
        links.append(createBuildStatus(strings.rateLimited(time), "error"));
      } else {
        links.append(createBuildStatus(strings.buildError, "error"));
      }
      return;
    }

    const documents = Array.isArray(response.documents) ? response.documents : [];
    if (!documents.length) {
      container.hidden = true;
      return;
    }

    if (response.usedDefaultBranchFallback) {
      links.append(createBuildStatus(strings.buildFallbackNotice, "warning"));
    }

    for (const documentLink of documents) {
      if (!documentLink || !documentLink.htmlUrl) continue;
      const link = createElement("a", "ghdn-build-doc-link");
      link.href = documentLink.htmlUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.append(
        createIcon("external", "ghdn-inline-icon"),
        createElement("span", "", documentLink.path || strings.buildFromSource)
      );
      links.append(link);
    }

    if (!links.querySelector(".ghdn-build-doc-link")) {
      container.hidden = true;
    }
  }

  function renderMenu(state) {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const menu = ensureMenu();
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
      const sourceActions = createElement("div", "ghdn-source-actions");
      if (release.zipball_url) sourceActions.append(createLinkButton(strings.sourceZip, release.zipball_url, "source"));
      if (release.tarball_url) sourceActions.append(createLinkButton(strings.sourceTar, release.tarball_url, "source"));
      sourceSection.append(sourceActions, createBuildDocumentationControl(release));
      menu.append(sourceSection);
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

  function currentLanguageCode() {
    if (settings.language === "ru") return "ru";
    if (settings.language === "en") return "en";
    return /^(ru|uk|be|kk)(-|$)/i.test(navigator.language || "") ? "ru" : "en";
  }

  function installGuideForAsset(asset, platform) {
    if (!installGuides || !asset || settings.installGuidance === "off") return null;
    const extension = asset.extension || selector.detectExtension(asset.name);
    return installGuides.createGuide({
      assetName: asset.name,
      extension,
      platform: assetPlatform(asset) || (platform && platform.os) || "unknown",
      language: currentLanguageCode()
    });
  }

  function createInstallGuideCard(guide, options = {}) {
    const card = createElement("div", `ghdn-install-guide${options.prompt ? " ghdn-install-guide-prompt" : ""}`);
    const header = createElement("div", "ghdn-install-guide-header");
    const heading = createElement("div", "ghdn-install-guide-heading");
    heading.append(createIcon("info", "ghdn-install-guide-icon"), createElement("strong", "", options.prompt ? strings.installAfterDownload : guide.title));
    header.append(heading);

    if (options.prompt) {
      const close = createElement("button", "ghdn-install-guide-close");
      close.type = "button";
      close.title = strings.installClose;
      close.setAttribute("aria-label", strings.installClose);
      close.textContent = "×";
      close.addEventListener("click", () => card.remove());
      header.append(close);
    }

    card.append(header);
    if (options.prompt) card.append(createElement("div", "ghdn-install-guide-title", guide.title));
    if (guide.summary) card.append(createElement("div", "ghdn-install-guide-summary", guide.summary));

    const steps = createElement("div", "ghdn-install-guide-steps");
    guide.steps.forEach((step, index) => {
      const item = createElement("div", "ghdn-install-guide-step");
      const label = createElement("div", "ghdn-install-guide-step-label", `${index + 1}. ${step.label}`);
      item.append(label);
      if (step.command) {
        const commandRow = createElement("div", "ghdn-install-command-row");
        const code = createElement("code", "ghdn-install-command", step.command);
        const copy = createElement("button", "ghdn-install-command-copy");
        copy.type = "button";
        copy.title = strings.installCopyCommand;
        copy.setAttribute("aria-label", strings.installCopyCommand);
        copy.append(createIcon("copy", "ghdn-copy-icon"));
        copy.addEventListener("click", () => copyText(step.command, strings.installCopied));
        commandRow.append(code, copy);
        item.append(commandRow);
      }
      steps.append(item);
    });
    card.append(steps);

    if (guide.warning) {
      const warning = createElement("div", "ghdn-install-guide-warning");
      warning.append(createIcon("warning", "ghdn-inline-icon"), createElement("span", "", guide.warning));
      card.append(warning);
    }

    if (guide.copyAll && guide.commands.length > 1) {
      const copyAll = createElement("button", "ghdn-install-copy-all", strings.installCopyAll);
      copyAll.type = "button";
      copyAll.prepend(createIcon("copy", "ghdn-inline-icon"));
      copyAll.addEventListener("click", () => copyText(installGuides.commandText(guide), strings.installCopied));
      card.append(copyAll);
    }

    return card;
  }

  function ensureNoticeStack() {
    let stack = document.getElementById(NOTICE_STACK_ID);
    if (!stack) {
      stack = createElement("div", "ghdn-notice-stack");
      stack.id = NOTICE_STACK_ID;
      document.body.append(stack);
    }
    return stack;
  }

  function showInstallPrompt(guide) {
    if (!guide) return;
    let prompt = document.getElementById("ghdn-install-prompt");
    if (prompt) prompt.remove();
    prompt = createInstallGuideCard(guide, { prompt: true });
    prompt.id = "ghdn-install-prompt";
    ensureNoticeStack().append(prompt);
    clearTimeout(showInstallPrompt.timer);
    showInstallPrompt.timer = setTimeout(() => {
      if (prompt.isConnected) prompt.remove();
    }, 30000);
  }

  function createAssetRow(asset, recommended, currentPlatform, release) {
    const entry = createElement("div", "ghdn-asset-entry");
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

    const actions = createElement("div", "ghdn-asset-actions");
    const guide = installGuideForAsset(asset, currentPlatform);
    let guidePanel = null;
    if (guide) {
      guidePanel = createInstallGuideCard(guide);
      guidePanel.hidden = true;
      const guideButton = createElement("button", "ghdn-guide-toggle");
      guideButton.type = "button";
      guideButton.title = strings.installHelp;
      guideButton.setAttribute("aria-label", strings.installHelp);
      guideButton.setAttribute("aria-expanded", "false");
      guideButton.append(createIcon("info", "ghdn-guide-icon"));
      guideButton.addEventListener("click", (event) => {
        event.stopPropagation();
        guidePanel.hidden = !guidePanel.hidden;
        guideButton.setAttribute("aria-expanded", String(!guidePanel.hidden));
        requestAnimationFrame(positionMenu);
      });
      actions.append(guideButton);
    }

    const copyButton = createElement("button", "ghdn-copy-link");
    copyButton.type = "button"; copyButton.title = strings.copyLink; copyButton.setAttribute("aria-label", strings.copyLink);
    copyButton.append(createIcon("copy", "ghdn-copy-icon"));
    copyButton.addEventListener("click", (event) => { event.stopPropagation(); copyText(asset.browser_download_url); });
    actions.append(copyButton);
    row.append(button, actions);
    entry.append(row);
    if (guidePanel) entry.append(guidePanel);
    return entry;
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
      ".appimage": "linux", ".flatpakref": "linux", ".flatpak": "linux", ".deb": "linux", ".rpm": "linux", ".snap": "linux", ".run": "linux", ".sh": "linux",
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
      ".appimage": "AppImage", ".flatpakref": "Flatpak Ref", ".flatpak": "Flatpak", ".deb": "DEB", ".rpm": "RPM", ".snap": "Snap", ".run": "RUN", ".sh": "SH",
      ".tar.gz": "TAR.GZ", ".tar.xz": "TAR.XZ", ".tar.zst": "TAR.ZST", ".tar.bz2": "TAR.BZ2", ".tgz": "TGZ", ".tbz2": "TBZ2", ".zip": "ZIP", ".7z": "7Z",
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

    if (asset && platform && settings.installGuidance === "beginner") {
      const guide = installGuideForAsset(asset, platform);
      if (guide) showInstallPrompt(guide);
    }

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
    ensureNoticeStack().append(prompt);
    clearTimeout(showWatchPrompt.timer);
    showWatchPrompt.timer = setTimeout(() => { if (prompt.isConnected) prompt.remove(); }, 12000);
  }

  function openExternal(url) {
    if (!url || !/^https:\/\//i.test(url)) return showToast(strings.networkError, "error");
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyText(text, successMessage = strings.copied) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(text);
      else {
        const area = createElement("textarea"); area.value = text; area.style.position = "fixed"; area.style.opacity = "0";
        document.body.append(area); area.select(); document.execCommand("copy"); area.remove();
      }
      showToast(successMessage, "success");
    } catch (_error) { showToast(strings.networkError, "error"); }
  }

  function positionMenu() {
    const root = document.getElementById(ROOT_ID);
    const menu = document.getElementById(MENU_ID);
    if (!root || !menu || menu.hidden) return;

    const margin = 12;
    const mobile = window.innerWidth <= TOOLBAR_BREAKPOINT;
    menu.classList.toggle("ghdn-menu-sheet", mobile);
    menu.style.top = "";
    menu.style.right = "";
    menu.style.bottom = "";
    menu.style.left = "";

    if (mobile) {
      menu.style.left = `${margin}px`;
      menu.style.right = `${margin}px`;
      menu.style.bottom = `${margin}px`;
      return;
    }

    const anchor = root.querySelector(".ghdn-button-group") || root;
    const anchorRect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const width = Math.min(470, window.innerWidth - margin * 2);
    const estimatedHeight = Math.min(menuRect.height || 650, window.innerHeight - margin * 2);
    let left = anchorRect.right - width;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

    const below = anchorRect.bottom + 8;
    const above = anchorRect.top - 8 - estimatedHeight;
    const top = below + estimatedHeight <= window.innerHeight - margin || above < margin
      ? Math.min(below, window.innerHeight - estimatedHeight - margin)
      : above;

    menu.style.width = `${width}px`;
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.max(margin, Math.round(top))}px`;
  }

  function setMenuOpen(open) {
    const root = document.getElementById(ROOT_ID);
    const menu = ensureMenu();
    if (!root && open) return;
    const arrow = root && root.querySelector('[data-role="menu"]');
    menu.hidden = !open;
    if (root) root.classList.toggle("ghdn-menu-open", open);
    if (arrow) arrow.setAttribute("aria-expanded", String(open));
    if (open) requestAnimationFrame(positionMenu);
  }

  function installCloseListeners() {
    if (closeListenerInstalled) return;
    closeListenerInstalled = true;
    document.addEventListener("click", (event) => {
      const root = document.getElementById(ROOT_ID);
      const menu = document.getElementById(MENU_ID);
      const insideRoot = root && root.contains(event.target);
      const insideMenu = menu && menu.contains(event.target);
      if (!insideRoot && !insideMenu) setMenuOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    });
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
    if (!toast) { toast = createElement("div", "ghdn-toast"); toast.id = "ghdn-toast"; ensureNoticeStack().append(toast); }
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
      activeRepoKey = ""; releaseState = null; buildInstructionsState = null; buildInstructionsPromise = null; loadingPromise = null; detectedPlatformPromise = null;
      const root = document.getElementById(ROOT_ID); if (root) root.remove();
      setMenuOpen(false); scheduleMount();
    });
  }

  document.addEventListener("turbo:load", scheduleMount);
  document.addEventListener("pjax:end", scheduleMount);
  window.addEventListener("popstate", scheduleMount);
  window.addEventListener("resize", scheduleLayoutRefresh, { passive: true });
  window.addEventListener("scroll", () => {
    const menu = document.getElementById(MENU_ID);
    if (menu && !menu.hidden) requestAnimationFrame(positionMenu);
  }, { passive: true, capture: true });
  new MutationObserver(scheduleMount).observe(document.documentElement, { childList: true, subtree: true });
  scheduleMount();
})();
