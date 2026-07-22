"use strict";

(() => {
  const browserApi = globalThis.GHDNBrowser;
  const extensionApi = browserApi.api;
  const messages = globalThis.GHDNMessages;
  const formatting = globalThis.GHDNFormatting;
  const selector = globalThis.GHDNAssetSelector;
  const urlPolicy = globalThis.GHDNUrlPolicy;
  const settingsApi = globalThis.GHDNSettings;
  const i18n = globalThis.GHDNI18n;
  const installGuides = globalThis.GHDNInstallGuides;
  const repositoryContext = globalThis.GHDNRepositoryContext;
  const githubDom = globalThis.GHDNGitHubDom;
  const placementApi = globalThis.GHDNPlacement;
  const releasePageParser = globalThis.GHDNReleasePageParser;
  const contentStateApi = globalThis.GHDNContentState;
  const pageClientApi = globalThis.GHDNPageClient;
  const releaseLoaderApi = globalThis.GHDNReleaseLoader;
  const versionControllerApi = globalThis.GHDNVersionController;
  const lifecycleApi = globalThis.GHDNContentLifecycle;
  const stringsApi = globalThis.GHDNContentStrings;
  const platformApi = globalThis.GHDNContentPlatform;
  const iconsApi = globalThis.GHDNContentIcons;
  const elementsApi = globalThis.GHDNContentElements;
  const downloadButtonApi = globalThis.GHDNDownloadButton;
  const menuShellApi = globalThis.GHDNMenuShell;
  const noticesApi = globalThis.GHDNContentNotices;
  const installGuidanceApi = globalThis.GHDNInstallGuidance;
  const buildDocumentsApi = globalThis.GHDNBuildDocuments;
  const assetListApi = globalThis.GHDNAssetList;
  const releaseMenuApi = globalThis.GHDNReleaseMenu;

  const ROOT_ID = "ghdn-root";
  const MENU_ID = "ghdn-menu";
  const NOTICE_STACK_ID = "ghdn-notice-stack";
  const TOOLBAR_BREAKPOINT = 760;
  const MAX_VISIBLE_ASSETS = 18;

  let settings = { ...(settingsApi ? settingsApi.DEFAULT_SETTINGS : {}) };
  let strings = createStrings(settings.language);
  let placementBusy = false;
  let rejectedToolbarHost = null;
  let rejectedToolbarWidth = 0;
  let settingsReady = refreshSettings();

  const getSettings = () => settings;
  const getStrings = () => strings;
  const contentState = contentStateApi.create();
  const icons = iconsApi;
  const elements = elementsApi.create({ documentObject: document, DOMParserClass: DOMParser, icons });
  const platform = platformApi.create({
    navigatorObject: navigator,
    selector,
    formatting,
    settingsApi,
    getSettings,
    getStrings
  });
  const menuShell = menuShellApi.create({
    documentObject: document,
    windowObject: window,
    elements,
    getStrings,
    rootId: ROOT_ID,
    menuId: MENU_ID,
    breakpoint: TOOLBAR_BREAKPOINT
  });
  const placement = placementApi.create({
    documentObject: document,
    windowObject: window,
    getComputedStyle,
    rootId: ROOT_ID,
    toolbarBreakpoint: TOOLBAR_BREAKPOINT,
    repositoryContext,
    dom: githubDom,
    urlPolicy
  });
  const pageClient = pageClientApi.create({ fetchImpl: fetch, DOMParserClass: DOMParser, urlPolicy });
  const releaseLoader = releaseLoaderApi.create({
    documentObject: document,
    pageParser: releasePageParser,
    pageClient,
    selector,
    urlPolicy,
    githubDom,
    runtime: browserApi.runtime,
    messages,
    rootId: ROOT_ID,
    getComputedStyleFn: getComputedStyle
  });

  let downloadButton;
  let notices;
  let installGuidance;
  let buildDocuments;
  let assetList;
  let releaseMenu;

  const versionController = versionControllerApi.create({
    state: contentState,
    getRepository: () => repositoryContext.parse(),
    getPlatform: getDetectedPlatform,
    getReleaseChannel: () => settings.releaseChannel,
    getMountedReleaseTag: () => document.getElementById(ROOT_ID)?.dataset.releaseTag || "",
    releaseLoader,
    onLoading: (value) => downloadButton?.setLoading(value),
    onLoaded: (response, detectedPlatform) => downloadButton?.updatePresentation(response, detectedPlatform)
  });
  const lifecycle = lifecycleApi.create({
    documentObject: document,
    windowObject: window,
    repositoryContext,
    rootId: ROOT_ID,
    menuId: MENU_ID,
    mount,
    refreshLayout: refreshPlacement,
    loadRelease: () => versionController.load(),
    positionMenu: menuShell.position
  });

  downloadButton = downloadButtonApi.create({
    documentObject: document,
    windowObject: window,
    elements,
    icons,
    dom: githubDom,
    selector,
    platform,
    getStrings,
    getSettings,
    rootId: ROOT_ID,
    menuId: MENU_ID,
    scheduleLayoutRefresh: lifecycle.scheduleLayoutRefresh,
    schedulePrefetch: lifecycle.schedulePrefetch,
    cancelPrefetch: lifecycle.cancelPrefetch
  });
  notices = noticesApi.create({
    documentObject: document,
    navigatorObject: navigator,
    elements,
    runtime: browserApi.runtime,
    messages,
    formatting,
    getStrings,
    noticeStackId: NOTICE_STACK_ID
  });
  installGuidance = installGuidanceApi.create({
    documentObject: document,
    elements,
    installGuides,
    selector,
    platform,
    notices,
    getSettings,
    getStrings,
    positionMenu: menuShell.position
  });
  buildDocuments = buildDocumentsApi.create({
    elements,
    formatting,
    getStrings,
    loadBuildInstructions,
    positionMenu: menuShell.position
  });
  assetList = assetListApi.create({
    elements,
    selector,
    formatting,
    platform,
    installGuidance,
    notices,
    getStrings,
    startDownload,
    setMenuOpen: menuShell.setOpen
  });
  releaseMenu = releaseMenuApi.create({
    documentObject: document,
    elements,
    menuShell,
    assetList,
    buildDocuments,
    platform,
    contentState,
    repositoryContext,
    versionController,
    getSettings,
    getStrings,
    requestOpenOptions,
    showResponseError: notices.showResponseError,
    showToast: notices.showToast,
    rootId: ROOT_ID,
    maxVisibleAssets: MAX_VISIBLE_ASSETS
  });

  function createStrings(language) {
    return stringsApi.create(i18n, language, navigator.language || "");
  }

  async function refreshSettings() {
    settings = settingsApi ? await settingsApi.get() : settings;
    strings = createStrings(settings.language);
    return settings;
  }

  function getDetectedPlatform() {
    if (!contentState.detectedPlatformPromise) contentState.detectedPlatformPromise = platform.detect();
    return contentState.detectedPlatformPromise;
  }

  async function refreshPlacement(options = {}) {
    if (placementBusy) return;
    placementBusy = true;
    try {
      await settingsReady;
      const repo = repositoryContext.parse();
      let existing = document.getElementById(ROOT_ID);

      if (!repo || !repositoryContext.shouldShow(repo, settings)) {
        existing?.remove();
        menuShell.setOpen(false);
        versionController.resetAll();
        lifecycle.observeLayoutHost(null);
        return;
      }

      const target = placement.findMountTarget(repo, { ...options, rejectedToolbarHost, rejectedToolbarWidth });
      if (!target) {
        existing?.remove();
        menuShell.setOpen(false);
        lifecycle.observeLayoutHost(null);
        return;
      }

      const contextKey = `${repo.key}:${target.releaseTag || "latest"}`;
      if (versionController.setContext(contextKey, target.releaseTag || "")) {
        existing?.remove();
        existing = null;
        menuShell.setOpen(false);
      }

      const sameTarget = existing &&
        existing.dataset.placement === target.mode &&
        String(existing.dataset.releaseTag || "") === String(target.releaseTag || "") &&
        existing.__ghdnLayoutHost === target.element &&
        existing.isConnected;

      if (!sameTarget) {
        existing?.remove();
        existing = downloadButton.createRoot(target, {
          onPrimaryClick: handlePrimaryClick,
          onMenuClick: handleMenuClick
        });
        placement.insertRoot(existing, target);
        menuShell.installCloseListeners();
        getDetectedPlatform().then((detectedPlatform) => {
          downloadButton.updatePresentation(contentState.releaseState?.response, detectedPlatform);
        });
      }

      lifecycle.observeLayoutHost(target.element);
      if (target.mode === "toolbar") {
        await downloadButton.waitForLayout();
        if (!downloadButton.applyToolbarDensity(existing)) {
          rejectedToolbarHost = target.element;
          rejectedToolbarWidth = target.element.clientWidth;
          existing.remove();
          const fallback = placement.findMountTarget(repo, { preferFlow: true, rejectedToolbarHost, rejectedToolbarWidth });
          const flowRoot = downloadButton.createRoot(fallback, {
            onPrimaryClick: handlePrimaryClick,
            onMenuClick: handleMenuClick
          });
          placement.insertRoot(flowRoot, fallback);
          lifecycle.observeLayoutHost(fallback.element);
          getDetectedPlatform().then((detectedPlatform) => {
            downloadButton.updatePresentation(contentState.releaseState?.response, detectedPlatform);
          });
        } else {
          rejectedToolbarHost = null;
          rejectedToolbarWidth = 0;
        }
      } else if (target.mode === "floating") {
        existing.classList.remove("ghdn-density-full");
        existing.classList.add("ghdn-density-compact");
      }

      if (!menuShell.ensure().hidden) menuShell.position();
    } finally {
      placementBusy = false;
    }
  }

  async function mount() {
    await refreshPlacement();
  }

  async function handlePrimaryClick(event) {
    event.stopPropagation();
    try {
      const state = await versionController.load();
      const response = state.response;
      if (!response.ok) return notices.showResponseError(response);
      if (settings.primaryAction === "release") return openExternal(response.release.html_url);
      if (settings.primaryAction === "menu" || platform.isReleaseStale(response.release)) {
        releaseMenu.render(state);
        menuShell.setOpen(true);
        return;
      }
      const recommended = response.recommendation?.best;
      const confidence = response.recommendation?.confidence;
      if (recommended && confidence !== "low") {
        return startDownload(recommended.browser_download_url, recommended, response.release, state.platform);
      }
      if (!response.release.assets.length && response.release.zipball_url) return startDownload(response.release.zipball_url);
      releaseMenu.render(state);
      menuShell.setOpen(true);
    } catch (_error) {
      notices.showToast(strings.networkError, "error");
    }
  }

  async function handleMenuClick(event) {
    event.stopPropagation();
    if (!document.getElementById(ROOT_ID)) return;
    const menu = menuShell.ensure();
    if (!menu.hidden) return menuShell.setOpen(false);
    try {
      const state = await versionController.load();
      if (!state.response.ok) return notices.showResponseError(state.response);
      releaseMenu.render(state);
      menuShell.setOpen(true);
    } catch (_error) {
      notices.showToast(strings.networkError, "error");
    }
  }

  async function loadBuildInstructions(release) {
    const repo = repositoryContext.parse();
    if (!repo) throw new Error("Repository not found");
    const ref = String(release?.tag_name || "");
    const detectedPlatform = await getDetectedPlatform();
    const key = `${repo.key}:${ref || "default"}:${detectedPlatform.os || "unknown"}`;
    if (contentState.buildInstructionsState?.key === key) return contentState.buildInstructionsState.response;
    if (contentState.buildInstructionsPromise?.key === key) return contentState.buildInstructionsPromise.promise;

    const promise = browserApi.runtime.sendMessage({
      type: messages.TYPES.GET_BUILD_INSTRUCTIONS,
      owner: repo.owner,
      repo: repo.repo,
      ref,
      platform: detectedPlatform
    }).then((response) => {
      contentState.buildInstructionsState = { key, response };
      return response;
    }).finally(() => {
      if (contentState.buildInstructionsPromise?.key === key) contentState.buildInstructionsPromise = null;
    });
    contentState.buildInstructionsPromise = { key, promise };
    return promise;
  }

  function requestOpenOptions() {
    return browserApi.runtime.sendMessage({ type: messages.TYPES.OPEN_OPTIONS })
      .catch(() => openExternal(extensionApi.runtime.getURL("options.html")));
  }

  function openExternal(url) {
    const repo = repositoryContext.parse();
    const trusted = repo && urlPolicy ? urlPolicy.repositoryWebUrl(url, repo.owner, repo.repo) : null;
    if (!trusted) return notices.showToast(strings.networkError, "error");
    window.open(trusted.href, "_blank", "noopener,noreferrer");
  }

  async function startDownload(url, asset = null, release = null, detectedPlatform = null) {
    const repo = repositoryContext.parse();
    const trusted = repo && urlPolicy
      ? asset && release?.tag_name
        ? urlPolicy.releaseAsset(url, repo.owner, repo.repo, release.tag_name)
        : urlPolicy.download(url, repo.owner, repo.repo)
      : null;
    if (!trusted) return notices.showToast(strings.networkError, "error");
    menuShell.setOpen(false);
    const anchor = document.createElement("a");
    anchor.href = trusted.href;
    anchor.rel = "noopener noreferrer";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();

    if (asset && detectedPlatform && settings.installGuidance === "beginner") {
      const guide = installGuidance.guideForAsset(asset, detectedPlatform);
      if (guide) installGuidance.showPrompt(guide);
    }
    if (!asset || !release || !detectedPlatform || !repo) return;

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
      platform: detectedPlatform,
      releaseChannel: settings.releaseChannel,
      downloadedAt: new Date().toISOString()
    };

    try {
      const result = await browserApi.runtime.sendMessage({ type: messages.TYPES.RECORD_DOWNLOAD, download });
      if (!result?.ok || result.incognito) return;
      if (result.watchState === "prompt") notices.showWatchPrompt(download);
      else if (result.watchState === "watching") notices.showToast(strings.watchingUpdated, "success");
    } catch (_error) {}
  }

  if (settingsApi) {
    settingsApi.onChanged((next) => {
      settings = next;
      strings = createStrings(settings.language);
      settingsReady = Promise.resolve(settings);
      versionController.resetAll();
      document.getElementById(ROOT_ID)?.remove();
      menuShell.setOpen(false);
      lifecycle.scheduleMount();
    });
  }

  lifecycle.start();
})();
