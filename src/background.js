"use strict";

(function initializeBackgroundEntry(root) {
  function loadDependency(globalName, browserPath, nodePath) {
    if (root[globalName]) return root[globalName];
    if (typeof importScripts === "function") {
      importScripts(browserPath);
      return root[globalName];
    }
    if (typeof module !== "undefined" && typeof module.require === "function") {
      const loaded = module.require(nodePath);
      root[globalName] = loaded;
      return loaded;
    }
    return null;
  }

  const messages = loadDependency("GHDNMessages", "shared/messages.js", "./shared/messages.js");
  const browserApi = loadDependency("GHDNBrowser", "shared/browser-api.js", "./shared/browser-api.js");
  loadDependency("GHDNLocaleCatalogs", "i18n-catalogs.js", "./i18n-catalogs.js");
  const i18n = loadDependency("GHDNI18n", "i18n.js", "./i18n.js");
  const settingsApi = loadDependency("GHDNSettings", "settings.js", "./settings.js");
  const urlPolicy = loadDependency("GHDNUrlPolicy", "url-policy.js", "./url-policy.js");
  const selector = loadDependency("GHDNAssetSelector", "asset-selector.js", "./asset-selector.js");
  const tracker = loadDependency("GHDNTracker", "tracker.js", "./tracker.js");
  const buildInstructions = loadDependency("GHDNBuildInstructions", "build-instructions.js", "./build-instructions.js");
  const githubAuth = loadDependency("GHDNGitHubAuth", "github-auth.js", "./github-auth.js");

  const storageModule = loadDependency("GHDNBackgroundStorage", "background/storage.js", "./background/storage.js");
  const githubClientModule = loadDependency("GHDNBackgroundGitHubClient", "background/github-client.js", "./background/github-client.js");
  const releaseServiceModule = loadDependency("GHDNBackgroundReleaseService", "background/release-service.js", "./background/release-service.js");
  const buildServiceModule = loadDependency("GHDNBackgroundBuildService", "background/build-service.js", "./background/build-service.js");
  const navigationModule = loadDependency("GHDNBackgroundNavigation", "background/navigation.js", "./background/navigation.js");
  const authServiceModule = loadDependency("GHDNBackgroundAuthService", "background/auth-service.js", "./background/auth-service.js");
  const trackerStateModule = loadDependency("GHDNBackgroundTrackerState", "background/tracker-state.js", "./background/tracker-state.js");
  const alarmsModule = loadDependency("GHDNBackgroundAlarms", "background/alarms.js", "./background/alarms.js");
  const notificationsModule = loadDependency("GHDNBackgroundNotifications", "background/notifications.js", "./background/notifications.js");
  const trackingServiceModule = loadDependency("GHDNBackgroundTrackingService", "background/tracking-service.js", "./background/tracking-service.js");
  const messageRouterModule = loadDependency("GHDNBackgroundMessageRouter", "background/message-router.js", "./background/message-router.js");

  if (!messages || !browserApi || !i18n || !settingsApi || !urlPolicy || !selector || !tracker || !buildInstructions) {
    throw new Error("Background entry dependencies are incomplete");
  }

  const extensionApi = browserApi.api;
  const storage = storageModule.create({ browserApi });
  const githubClient = githubClientModule.create({ storage, urlPolicy, githubAuth });
  const releaseService = releaseServiceModule.create({ githubClient, urlPolicy, selector });
  const buildService = buildServiceModule.create({ githubClient, urlPolicy, buildInstructions });
  const navigation = navigationModule.create({ browserApi, extensionApi, urlPolicy });
  const authService = authServiceModule.create({
    storage,
    githubClient,
    urlPolicy,
    githubAuth,
    browserApi,
    extensionApi,
    clearCaches() {
      releaseService.clearCache();
      buildService.clearCache();
    }
  });
  const trackerState = trackerStateModule.create({ storage, tracker, urlPolicy });
  const alarms = alarmsModule.create({ browserApi, extensionApi, settingsApi });
  const notifications = notificationsModule.create({
    browserApi,
    extensionApi,
    i18n,
    settingsApi,
    trackerState,
    navigation
  });
  const trackingService = trackingServiceModule.create({
    settingsApi,
    tracker,
    selector,
    urlPolicy,
    trackerState,
    releaseService,
    notifications,
    alarms,
    navigation
  });
  const messageRouter = messageRouterModule.create({
    messages,
    authService,
    releaseService,
    buildService,
    trackingService,
    navigation
  });

  async function initializeBackground() {
    await storage.restrictLocalStorageToTrustedContexts();
    await alarms.ensureUpdateAlarm();
    await notifications.updateBadge();
  }

  extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const operation = messageRouter.route(message, sender);
    if (!operation) return false;
    Promise.resolve(operation)
      .then(sendResponse)
      .catch((error) => {
        console.error("GitHub Download Now:", error);
        sendResponse({ ok: false, error: "internal_error" });
      });
    return true;
  });

  if (extensionApi.alarms?.onAlarm) {
    extensionApi.alarms.onAlarm.addListener((alarm) => {
      if (alarms.isUpdateAlarm(alarm)) trackingService.checkAllUpdates({ manual: false }).catch(console.error);
    });
  }

  if (extensionApi.runtime.onInstalled) {
    extensionApi.runtime.onInstalled.addListener(() => initializeBackground().catch(console.error));
  }
  if (extensionApi.runtime.onStartup) {
    extensionApi.runtime.onStartup.addListener(() => initializeBackground().catch(console.error));
  }

  if (extensionApi.storage?.onChanged) {
    extensionApi.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && githubAuth && changes[githubAuth.STORAGE_KEY]) githubClient.invalidateAuthCache();
      if (areaName !== "sync") return;
      if (changes.updateCheckInterval || changes.enabled) alarms.ensureUpdateAlarm().catch(console.error);
      if (changes.badgeEnabled || changes.enabled) notifications.updateBadge().catch(console.error);
    });
  }

  if (extensionApi.notifications?.onClicked) {
    extensionApi.notifications.onClicked.addListener((notificationId) => {
      notifications.handleNotificationClick(notificationId).catch(console.error);
    });
  }

  const app = Object.freeze({
    storage,
    githubClient,
    releaseService,
    buildService,
    navigation,
    authService,
    trackerState,
    alarms,
    notifications,
    trackingService,
    messageRouter,
    initializeBackground
  });
  root.GHDNBackgroundApp = app;
  if (typeof module !== "undefined" && module.exports) module.exports = app;

  initializeBackground().catch(console.error);
})(typeof globalThis !== "undefined" ? globalThis : this);
