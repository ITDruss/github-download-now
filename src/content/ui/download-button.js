(function initDownloadButton(root, factory) {
  const api = factory();
  root.GHDNDownloadButton = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createDownloadButtonApi() {
  "use strict";

  function create(options = {}) {
    const documentObject = options.documentObject || globalThis.document;
    const windowObject = options.windowObject || globalThis.window;
    const requestFrame = options.requestAnimationFrameFn || globalThis.requestAnimationFrame;
    const elements = options.elements;
    const icons = options.icons;
    const dom = options.dom;
    const selector = options.selector;
    const platform = options.platform;
    const getStrings = options.getStrings || (() => ({}));
    const getSettings = options.getSettings || (() => ({}));
    const scheduleLayoutRefresh = options.scheduleLayoutRefresh || (() => {});
    const schedulePrefetch = options.schedulePrefetch || (() => {});
    const cancelPrefetch = options.cancelPrefetch || (() => {});
    const rootId = options.rootId || "ghdn-root";
    const menuId = options.menuId || "ghdn-menu";

    if (!documentObject || !elements || !icons || !dom || !selector || !platform) {
      throw new Error("Download button dependencies are incomplete");
    }

    const { createElement, createIcon, createSvgNode } = elements;

    function toolbarFits(root) {
      if (!root || !root.isConnected) return false;
      const host = root.__ghdnLayoutHost || root.parentElement;
      if (!host || !dom.isVisibleElement(host)) return false;
      const rootRect = root.getBoundingClientRect();
      if (rootRect.width <= 0 || rootRect.height <= 0) return false;
      if (rootRect.right > windowObject.innerWidth - 8) return false;
      if (host.scrollWidth > host.clientWidth + 3) return false;
      const sibling = [...host.children].find((child) => child !== root && dom.isVisibleElement(child));
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

    function createRoot(target, handlers = {}) {
      const settings = getSettings();
      const strings = getStrings();
      const rootTag = target.listMode ? "li" : target.mode === "release" ? "span" : "div";
      const root = createElement(rootTag, "ghdn-root");
      root.id = rootId;
      root.dataset.placement = target.mode;
      if (target.releaseTag) root.dataset.releaseTag = target.releaseTag;
      root.classList.add(`ghdn-placement-${target.mode}`, "ghdn-density-full", `ghdn-style-${settings.buttonStyle}`);
      if (!settings.showSubtitle) root.classList.add("ghdn-hide-subtitle");

      const group = createElement(target.mode === "release" ? "span" : "div", "ghdn-button-group");
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
      arrow.setAttribute("aria-haspopup", "dialog");
      arrow.setAttribute("aria-controls", menuId);
      arrow.setAttribute("aria-expanded", "false");

      primary.addEventListener("click", handlers.onPrimaryClick || (() => {}));
      arrow.addEventListener("click", handlers.onMenuClick || (() => {}));
      group.addEventListener("mouseenter", schedulePrefetch);
      group.addEventListener("mouseleave", cancelPrefetch);
      group.addEventListener("focusin", schedulePrefetch);
      group.append(primary, arrow);
      root.append(group);
      return root;
    }

    function setPrimaryText(title, subtitle, iconName = "download") {
      const settings = getSettings();
      const strings = getStrings();
      const root = documentObject.getElementById(rootId);
      if (!root) return;
      const primary = root.querySelector('[data-role="primary"]');
      if (!primary) return;
      primary.querySelector(".ghdn-primary-title-full").textContent = title;
      primary.querySelector(".ghdn-primary-title-compact").textContent = strings.downloadCompact;
      const subtitleNode = primary.querySelector(".ghdn-primary-subtitle");
      subtitleNode.textContent = subtitle || "";
      subtitleNode.hidden = !subtitle || !settings.showSubtitle || settings.buttonStyle === "compact" || ["toolbar", "release"].includes(root.dataset.placement);
      primary.querySelector(".ghdn-primary-icon").replaceChildren(createSvgNode(icons.svgIcon(iconName)));
      scheduleLayoutRefresh();
    }

    function setLoading(isLoading) {
      const strings = getStrings();
      const root = documentObject.getElementById(rootId);
      if (!root) return;
      root.classList.toggle("ghdn-is-loading", isLoading);
      if (isLoading) setPrimaryText(strings.downloadNow, strings.loading);
    }

    function updatePresentation(response, detectedPlatform) {
      const strings = getStrings();
      const meta = platform.metaText(detectedPlatform);
      if (!response?.ok) {
        setPrimaryText(strings.downloadNow, meta || strings.detecting);
        return;
      }
      const recommendation = response.recommendation;
      if (recommendation?.best && recommendation.confidence !== "low") {
        const best = recommendation.best;
        const format = platform.formatDisplayName(best.extension || selector.detectExtension(best.name));
        const preferred = Array.isArray(best.reasons) && best.reasons.some((reason) => reason.startsWith("preference:"));
        const subtitle = [meta, preferred ? strings.preferred : strings.recommended].filter(Boolean).join(" · ");
        setPrimaryText(strings.downloadFormat(format), subtitle, platform.iconName(platform.assetPlatform(best)));
        const root = documentObject.getElementById(rootId);
        const primary = root?.querySelector('[data-role="primary"]');
        if (primary) primary.title = best.name;
      } else {
        setPrimaryText(strings.chooseDownload, meta);
      }
    }

    function waitForLayout() {
      return new Promise((resolve) => {
        requestFrame(resolve);
      });
    }

    return Object.freeze({ createRoot, applyToolbarDensity, setPrimaryText, setLoading, updatePresentation, waitForLayout });
  }

  return Object.freeze({ create });
});
