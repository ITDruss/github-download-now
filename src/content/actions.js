(function initContentActions(root, factory) {
  const api = factory();
  root.GHDNContentActions = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createContentActionsApi() {
  "use strict";

  function create(options = {}) {
    const documentObject = options.documentObject || globalThis.document;
    const windowObject = options.windowObject || globalThis.window;
    const extensionApi = options.extensionApi;
    const runtime = options.runtime;
    const messages = options.messages;
    const selector = options.selector;
    const urlPolicy = options.urlPolicy;
    const repositoryContext = options.repositoryContext;
    const versionController = options.versionController;
    const releaseMenu = options.releaseMenu;
    const menuShell = options.menuShell;
    const notices = options.notices;
    const installGuidance = options.installGuidance;
    const contentState = options.contentState;
    const platform = options.platform;
    const getSettings = options.getSettings;
    const getStrings = options.getStrings;

    if (
      !documentObject || !windowObject || !extensionApi || !runtime?.sendMessage || !messages?.TYPES ||
      !selector || !urlPolicy || !repositoryContext || !versionController || !releaseMenu ||
      !menuShell || !notices || !installGuidance || !contentState || !platform ||
      typeof getSettings !== "function" || typeof getStrings !== "function"
    ) {
      throw new Error("Content-action dependencies are incomplete");
    }

    function getDetectedPlatform() {
      if (!contentState.detectedPlatformPromise) contentState.detectedPlatformPromise = platform.detect();
      return contentState.detectedPlatformPromise;
    }

    async function loadBuildInstructions(release) {
      const repo = repositoryContext.parse();
      if (!repo) throw new Error("Repository not found");
      const ref = String(release?.tag_name || "");
      const detectedPlatform = await getDetectedPlatform();
      const key = `${repo.key}:${ref || "default"}:${detectedPlatform.os || "unknown"}`;
      if (contentState.buildInstructionsState?.key === key) return contentState.buildInstructionsState.response;
      if (contentState.buildInstructionsPromise?.key === key) return contentState.buildInstructionsPromise.promise;

      const promise = runtime.sendMessage({
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
      return runtime.sendMessage({ type: messages.TYPES.OPEN_OPTIONS })
        .catch(() => {
          const url = extensionApi.runtime.getURL("options.html");
          windowObject.open(url, "_blank", "noopener,noreferrer");
          return { ok: true, fallback: true };
        });
    }

    function openExternal(url) {
      const repo = repositoryContext.parse();
      const trusted = repo ? urlPolicy.repositoryWebUrl(url, repo.owner, repo.repo) : null;
      if (!trusted) return notices.showToast(getStrings().networkError, "error");
      windowObject.open(trusted.href, "_blank", "noopener,noreferrer");
      return trusted.href;
    }

    function createDownloadRecord(repo, asset, release, detectedPlatform, settings) {
      return {
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
    }

    async function startDownload(url, asset = null, release = null, detectedPlatform = null) {
      const repo = repositoryContext.parse();
      const trusted = repo
        ? asset && release?.tag_name
          ? urlPolicy.releaseAsset(url, repo.owner, repo.repo, release.tag_name)
          : urlPolicy.download(url, repo.owner, repo.repo)
        : null;
      if (!trusted) return notices.showToast(getStrings().networkError, "error");

      menuShell.setOpen(false);
      const anchor = documentObject.createElement("a");
      anchor.href = trusted.href;
      anchor.rel = "noopener noreferrer";
      documentObject.body.append(anchor);
      anchor.click();
      anchor.remove();

      const settings = getSettings();
      if (asset && detectedPlatform && settings.installGuidance === "beginner") {
        const guide = installGuidance.guideForAsset(asset, detectedPlatform);
        if (guide) installGuidance.showPrompt(guide);
      }
      if (!asset || !release || !detectedPlatform || !repo) return { ok: true, downloaded: true };

      const download = createDownloadRecord(repo, asset, release, detectedPlatform, settings);
      try {
        const result = await runtime.sendMessage({ type: messages.TYPES.RECORD_DOWNLOAD, download });
        if (!result?.ok || result.incognito) return result;
        if (result.watchState === "prompt") notices.showWatchPrompt(download);
        else if (result.watchState === "watching") notices.showToast(getStrings().watchingUpdated, "success");
        return result;
      } catch (_error) {
        return { ok: false, error: "record_download_failed" };
      }
    }

    async function handlePrimaryClick(event) {
      event.stopPropagation();
      const settings = getSettings();
      const strings = getStrings();
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

    async function handleMenuClick(event, rootId = "ghdn-root") {
      event.stopPropagation();
      if (!documentObject.getElementById(rootId)) return;
      const menu = menuShell.ensure();
      if (!menu.hidden) return menuShell.setOpen(false);
      try {
        const state = await versionController.load();
        if (!state.response.ok) return notices.showResponseError(state.response);
        releaseMenu.render(state);
        menuShell.setOpen(true);
      } catch (_error) {
        notices.showToast(getStrings().networkError, "error");
      }
    }

    return Object.freeze({
      getDetectedPlatform,
      loadBuildInstructions,
      requestOpenOptions,
      openExternal,
      createDownloadRecord,
      startDownload,
      handlePrimaryClick,
      handleMenuClick
    });
  }

  return Object.freeze({ create });
});
