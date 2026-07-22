(function initReleaseMenu(root, factory) {
  const api = factory();
  root.GHDNReleaseMenu = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createReleaseMenuApi() {
  "use strict";

  function create(options = {}) {
    const documentObject = options.documentObject || globalThis.document;
    const elements = options.elements;
    const menuShell = options.menuShell;
    const assetList = options.assetList;
    const buildDocuments = options.buildDocuments;
    const platform = options.platform;
    const contentState = options.contentState;
    const repositoryContext = options.repositoryContext;
    const versionController = options.versionController;
    const getSettings = options.getSettings || (() => ({}));
    const getStrings = options.getStrings || (() => ({}));
    const requestOpenOptions = options.requestOpenOptions;
    const showResponseError = options.showResponseError;
    const showToast = options.showToast;
    const rootId = options.rootId || "ghdn-root";
    const maxVisibleAssets = options.maxVisibleAssets || 18;

    if (!documentObject || !elements || !menuShell || !assetList || !buildDocuments || !platform || !contentState || !repositoryContext || !versionController) {
      throw new Error("Release menu dependencies are incomplete");
    }
    const { createElement, createIcon } = elements;

    function createVersionSelector(release) {
      const strings = getStrings();
      const repo = repositoryContext.parse();
      if (!repo) return null;
      const row = createElement("label", "ghdn-version-row");
      const label = createElement("span", "ghdn-version-label", strings.versionLabel);
      const select = createElement("select", "ghdn-version-select");
      select.setAttribute("aria-label", strings.selectVersion);
      const currentTag = String(release?.tag_name || contentState.selectedReleaseTag || "");
      const initial = createElement("option", "", currentTag || strings.latestVersion);
      initial.value = currentTag;
      select.append(initial);
      row.append(label, select);

      versionController.getReleaseTags(repo).then((tags) => {
        if (!row.isConnected) return;
        const unique = [...new Set([currentTag, ...tags].filter(Boolean))];
        select.replaceChildren();
        const latestTag = tags[0] || currentTag;
        unique.forEach((tag) => {
          const option = createElement("option", "", tag === latestTag ? `${tag} · ${strings.latestVersion}` : tag);
          option.value = tag;
          option.selected = tag === currentTag;
          select.append(option);
        });
      }).catch(() => {});

      select.addEventListener("change", async () => {
        const nextTag = String(select.value || "");
        try {
          const state = await versionController.select(nextTag);
          if (!state?.response?.ok) return showResponseError(state?.response || {});
          render(state);
          menuShell.setOpen(true);
        } catch (_error) {
          showToast(getStrings().networkError, "error");
        }
      });
      return row;
    }

    function render(state) {
      const settings = getSettings();
      const strings = getStrings();
      const root = documentObject.getElementById(rootId);
      if (!root) return;
      const menu = menuShell.ensure();
      menu.replaceChildren();
      const release = state.response.release;
      const ranked = state.response.rankedAssets || [];
      const best = state.response.recommendation?.best;
      const bestId = best?.id ?? null;

      const header = createElement("div", "ghdn-menu-header");
      const headerCopy = createElement("div", "ghdn-menu-header-copy");
      const title = createElement("div", "ghdn-release-title", release.name || `${strings.release} ${release.tag_name}`);
      const meta = [release.tag_name || "latest", release.prerelease ? strings.prerelease : "", platform.releaseDateText(release)].filter(Boolean).join(" · ");
      headerCopy.append(title, createElement("div", "ghdn-release-tag", meta));
      header.append(createIcon("download", "ghdn-menu-header-icon"), headerCopy);
      menu.append(header);
      const versionSelector = createVersionSelector(release);
      if (versionSelector) menu.append(versionSelector);

      if (platform.isReleaseStale(release)) menu.append(assetList.createStaleWarning(release));
      if (settings.showRecommendationReason && best) menu.append(assetList.createRecommendationExplanation(best, state.platform));

      if (ranked.length) {
        const compatible = ranked.filter((asset) => assetList.isCompatibleAsset(asset, state.platform));
        const compatibleIds = new Set(compatible.map((asset) => asset.id));
        const others = ranked.filter((asset) => !compatibleIds.has(asset.id));
        let rendered = 0;
        if (compatible.length) {
          menu.append(assetList.createSectionHeading(strings.suitable, state.platform.os));
          compatible.slice(0, maxVisibleAssets).forEach((asset) => {
            menu.append(assetList.createAssetRow(asset, asset.id === bestId, state.platform, release));
            rendered += 1;
          });
        }
        if (settings.showOtherPlatforms && others.length && rendered < maxVisibleAssets) {
          menu.append(assetList.createSectionHeading(strings.otherPlatforms, "package"));
          others.slice(0, maxVisibleAssets - rendered).forEach((asset) => {
            menu.append(assetList.createAssetRow(asset, asset.id === bestId, state.platform, release));
            rendered += 1;
          });
        }
        if (ranked.length > rendered) {
          const more = createElement("a", "ghdn-more-link", strings.moreOnRelease(ranked.length - rendered));
          more.href = release.html_url;
          more.target = "_blank";
          more.rel = "noopener noreferrer";
          more.prepend(createIcon("external", "ghdn-inline-icon"));
          menu.append(more);
        }
      } else {
        menu.append(createElement("div", "ghdn-empty", strings.noAssets));
      }

      if (settings.showSourceCode) {
        const sourceSection = createElement("div", "ghdn-source-section");
        sourceSection.append(assetList.createSectionHeading(strings.sourceCode, "source"));
        const sourceActions = createElement("div", "ghdn-source-actions");
        if (release.zipball_url) sourceActions.append(assetList.createLinkButton(strings.sourceZip, release.zipball_url, "source"));
        if (release.tarball_url) sourceActions.append(assetList.createLinkButton(strings.sourceTar, release.tarball_url, "source"));
        sourceSection.append(sourceActions, buildDocuments.createControl(release));
        menu.append(sourceSection);
      }

      const footer = createElement("div", "ghdn-menu-footer");
      const releaseLink = createElement("a", "ghdn-release-link", strings.openRelease);
      releaseLink.href = release.html_url;
      releaseLink.target = "_blank";
      releaseLink.rel = "noopener noreferrer";
      releaseLink.prepend(createIcon("external", "ghdn-inline-icon"));
      const settingsButton = createElement("button", "ghdn-settings-link", strings.openSettings);
      settingsButton.type = "button";
      settingsButton.prepend(createIcon("settings", "ghdn-inline-icon"));
      settingsButton.addEventListener("click", requestOpenOptions);
      footer.append(releaseLink, settingsButton);
      menu.append(footer);
    }

    return Object.freeze({ render, createVersionSelector });
  }

  return Object.freeze({ create });
});
