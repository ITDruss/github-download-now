(function initAssetList(root, factory) {
  const api = factory();
  root.GHDNAssetList = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createAssetListApi() {
  "use strict";

  function create(options = {}) {
    const elements = options.elements;
    const selector = options.selector;
    const formatting = options.formatting;
    const platform = options.platform;
    const installGuidance = options.installGuidance;
    const notices = options.notices;
    const getStrings = options.getStrings || (() => ({}));
    const startDownload = options.startDownload;
    const setMenuOpen = options.setMenuOpen || (() => {});
    if (!elements || !selector || !formatting || !platform || !installGuidance || !notices || !startDownload) {
      throw new Error("Asset list dependencies are incomplete");
    }
    const { createElement, createIcon } = elements;

    function createSectionHeading(label, iconName) {
      const heading = createElement("div", "ghdn-section-heading");
      heading.append(createIcon(platform.iconName(iconName), "ghdn-section-icon"), createElement("span", "", label));
      return heading;
    }

    function createAssetRow(asset, recommended, currentPlatform, release) {
      const strings = getStrings();
      const entry = createElement("div", "ghdn-asset-entry");
      const row = createElement("div", "ghdn-asset-row");
      const button = createElement("button", "ghdn-asset");
      button.type = "button";
      button.title = asset.name;
      const detectedOs = platform.assetPlatform(asset);
      const iconWrap = createElement("span", `ghdn-platform-icon ghdn-platform-${detectedOs}`);
      iconWrap.append(createIcon(platform.iconName(detectedOs), "ghdn-platform-svg"));
      const details = createElement("span", "ghdn-asset-details");
      const extension = asset.extension || selector.detectExtension(asset.name);
      const name = createElement("span", "ghdn-asset-name", asset.name);
      const metaParts = [
        platform.formatDisplayName(extension),
        platform.osDisplayName(detectedOs),
        platform.assetArchitecture(asset, currentPlatform),
        formatting.bytes(asset.size)
      ].filter(Boolean);
      const meta = createElement("span", "ghdn-asset-meta", metaParts.join(" · "));
      const hint = createElement(
        "span",
        "ghdn-asset-hint",
        strings.formatHints[extension] || `${Number(asset.download_count || 0).toLocaleString()} ${strings.downloads}`
      );
      details.append(name, meta, hint);
      const side = createElement("span", "ghdn-asset-side");
      if (recommended) {
        row.classList.add("ghdn-recommended-row");
        button.classList.add("ghdn-recommended");
        const preferred = Array.isArray(asset.reasons) && asset.reasons.some((reason) => reason.startsWith("preference:"));
        side.append(createElement("span", "ghdn-badge", preferred ? strings.preferred : strings.recommended));
      }
      side.append(createIcon("download", "ghdn-row-download"));
      button.append(iconWrap, details, side);
      button.addEventListener("click", () => startDownload(asset.browser_download_url, asset, release, currentPlatform));

      const actions = createElement("div", "ghdn-asset-actions");
      const guideControl = installGuidance.createToggle(asset, currentPlatform);
      if (guideControl) actions.append(guideControl.button);
      const copyButton = createElement("button", "ghdn-copy-link");
      copyButton.type = "button";
      copyButton.title = strings.copyLink;
      copyButton.setAttribute("aria-label", strings.copyLink);
      copyButton.append(createIcon("copy", "ghdn-copy-icon"));
      copyButton.addEventListener("click", (event) => {
        event.stopPropagation();
        notices.copyText(asset.browser_download_url);
      });
      actions.append(copyButton);
      row.append(button, actions);
      entry.append(row);
      if (guideControl) entry.append(guideControl.panel);
      return entry;
    }

    function createLinkButton(label, url, iconName) {
      const link = createElement("a", "ghdn-source-link", label);
      link.href = url;
      link.prepend(createIcon(iconName, "ghdn-inline-icon"));
      link.addEventListener("click", () => setMenuOpen(false));
      return link;
    }

    function createStaleWarning(release) {
      const strings = getStrings();
      const box = createElement("div", "ghdn-stale-warning");
      const copy = createElement("div", "ghdn-warning-copy");
      copy.append(
        createElement("strong", "", strings.staleTitle),
        createElement("span", "", strings.staleText(platform.formatReleaseDate(release.published_at)))
      );
      box.append(createIcon("warning", "ghdn-warning-icon"), copy);
      return box;
    }

    function createRecommendationExplanation(asset, detectedPlatform) {
      const strings = getStrings();
      const details = createElement("details", "ghdn-reason-box");
      const summary = createElement("summary", "ghdn-reason-summary");
      summary.append(createIcon("info", "ghdn-inline-icon"), createElement("span", "", strings.whyRecommended));
      details.append(summary);
      const list = createElement("ul", "ghdn-reason-list");
      const reasons = Array.isArray(asset.reasons) ? asset.reasons : [];
      const extension = asset.extension || selector.detectExtension(asset.name);
      const added = new Set();
      const add = (key, text) => {
        if (text && !added.has(key)) {
          added.add(key);
          list.append(createElement("li", "", text));
        }
      };
      if (reasons.some((reason) => reason === `os:${detectedPlatform.os}` || reason === "os:inferred")) add("os", strings.reasonOs(platform.osDisplayName(detectedPlatform.os)));
      if (reasons.some((reason) => reason === `arch:${detectedPlatform.arch}`)) add("arch", strings.reasonArch(platform.archDisplayName(detectedPlatform.arch)));
      if (reasons.includes("arch:universal")) add("universal", strings.reasonUniversal);
      if (reasons.some((reason) => reason.startsWith("preference:"))) add("preference", strings.reasonPreference(platform.formatDisplayName(extension)));
      add("format", strings.reasonFormat(platform.formatDisplayName(extension)));
      if (Number(asset.download_count) > 1000) add("popular", strings.reasonPopularity);
      details.append(list);
      return details;
    }

    return Object.freeze({
      createSectionHeading,
      createAssetRow,
      createLinkButton,
      createStaleWarning,
      createRecommendationExplanation,
      isCompatibleAsset: platform.isCompatibleAsset
    });
  }

  return Object.freeze({ create });
});
