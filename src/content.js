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
  const actionsApi = globalThis.GHDNContentActions;
  const mountControllerApi = globalThis.GHDNContentMountController;
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
  let settingsReady = refreshSettings();
  let actions;
  let mountController;

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
    getPlatform: () => actions.getDetectedPlatform(),
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
    mount: () => mountController.mount(),
    refreshLayout: (options) => mountController.refresh(options),
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
    loadBuildInstructions: (release) => actions.loadBuildInstructions(release),
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
    startDownload: (...args) => actions.startDownload(...args),
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
    requestOpenOptions: () => actions.requestOpenOptions(),
    showResponseError: notices.showResponseError,
    showToast: notices.showToast,
    rootId: ROOT_ID,
    maxVisibleAssets: MAX_VISIBLE_ASSETS
  });
  actions = actionsApi.create({
    documentObject: document,
    windowObject: window,
    extensionApi,
    runtime: browserApi.runtime,
    messages,
    selector,
    urlPolicy,
    repositoryContext,
    versionController,
    releaseMenu,
    menuShell,
    notices,
    installGuidance,
    contentState,
    platform,
    getSettings,
    getStrings
  });
  mountController = mountControllerApi.create({
    documentObject: document,
    repositoryContext,
    placement,
    versionController,
    menuShell,
    downloadButton,
    lifecycle,
    actions,
    contentState,
    getSettings,
    waitForSettings: () => settingsReady,
    rootId: ROOT_ID
  });

  function createStrings(language) {
    return stringsApi.create(i18n, language, navigator.language || "");
  }

  async function refreshSettings() {
    settings = settingsApi ? await settingsApi.get() : settings;
    strings = createStrings(settings.language);
    return settings;
  }

  if (settingsApi) {
    settingsApi.onChanged((next) => {
      settings = next;
      strings = createStrings(settings.language);
      settingsReady = Promise.resolve(settings);
      versionController.resetAll();
      mountController.resetToolbarRejection();
      document.getElementById(ROOT_ID)?.remove();
      menuShell.setOpen(false);
      lifecycle.scheduleMount();
    });
  }

  lifecycle.start();
})();
