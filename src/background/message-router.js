(function initBackgroundMessageRouter(root, factory) {
  const api = factory();
  root.GHDNBackgroundMessageRouter = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBackgroundMessageRouterApi() {
  "use strict";

  function create(options = {}) {
    const messages = options.messages;
    const authService = options.authService;
    const releaseService = options.releaseService;
    const buildService = options.buildService;
    const trackingService = options.trackingService;
    const navigation = options.navigation;
    if (!messages || !authService || !releaseService || !buildService || !trackingService || !navigation) {
      throw new Error("Message-router dependencies are incomplete");
    }

    function route(message, sender) {
      if (!message || typeof message.type !== "string") return null;
      if (messages.isAuthType(message.type) && !authService.trustedExtensionSender(sender)) {
        return Promise.resolve({ ok: false, error: "unauthorized_sender" });
      }

      switch (message.type) {
        case messages.TYPES.GET_LATEST_RELEASE:
          return releaseService.getRelease(message.owner, message.repo, message.platform, message.releaseChannel);
        case messages.TYPES.GET_RELEASE_BY_TAG:
          return releaseService.getReleaseByTag(message.owner, message.repo, message.tag, message.platform);
        case messages.TYPES.GET_BUILD_INSTRUCTIONS:
          return buildService.getBuildInstructions(message.owner, message.repo, message.ref, message.platform);
        case messages.TYPES.AUTH_STATUS:
          return authService.publicGitHubAuthStatus({ refresh: Boolean(message.refresh) });
        case messages.TYPES.AUTH_START:
          return authService.startGitHubAuthorization();
        case messages.TYPES.AUTH_POLL:
          return authService.pollGitHubAuthorization();
        case messages.TYPES.AUTH_DISCONNECT:
          return authService.disconnectGitHubAuthorization();
        case messages.TYPES.RECORD_DOWNLOAD:
          return trackingService.recordDownload(message.download, sender);
        case messages.TYPES.WATCH_REPOSITORY:
          return trackingService.watchRepository(message.download);
        case messages.TYPES.UNWATCH_REPOSITORY:
          return trackingService.unwatchRepository(message.key);
        case messages.TYPES.GET_DASHBOARD:
          return trackingService.getDashboard();
        case messages.TYPES.CHECK_UPDATES:
          return trackingService.checkAllUpdates({ manual: true });
        case messages.TYPES.DISMISS_UPDATE:
          return trackingService.dismissUpdate(message.key);
        case messages.TYPES.DOWNLOAD_UPDATE:
          return trackingService.downloadUpdate(message.key);
        case messages.TYPES.OPEN_URL:
          return navigation.openTab(message.url);
        case messages.TYPES.OPEN_OPTIONS:
          return navigation.openOptionsPage();
        case messages.TYPES.CLEAR_HISTORY:
          return trackingService.clearHistory();
        case messages.TYPES.CLEAR_TRACKING:
          return trackingService.clearTracking();
        default:
          return null;
      }
    }

    return Object.freeze({ route });
  }

  return Object.freeze({ create });
});
