(function initGitHubDom(root, factory) {
  const api = factory();
  root.GHDNGitHubDom = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createGitHubDomApi() {
  "use strict";

  const ACTION_CONTROL_SELECTORS = Object.freeze([
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
  ]);

  function styleReader(options = {}) {
    return options.getComputedStyle || globalThis.getComputedStyle;
  }

  function isVisibleElement(element, options = {}) {
    const rootId = options.rootId || "ghdn-root";
    if (!element || !element.isConnected || element.closest?.(`#${rootId}`)) return false;

    const getStyle = styleReader(options);
    const style = typeof getStyle === "function" ? getStyle(element) : {};
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      Number(style.opacity) === 0
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect?.() || { width: 0, height: 0 };
    return rect.width > 0 && rect.height > 0;
  }

  function normalizedActionText(element) {
    if (!element) return "";
    return [
      element.getAttribute?.("aria-label"),
      element.getAttribute?.("title"),
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
    const aria = element.getAttribute?.("aria-label") || "";
    const href = element.getAttribute?.("href") || "";

    if (/\/stargazers(?:[/?#]|$)/i.test(href) || /(^|\s)Star(?:\s|$)/i.test(label) || /star/i.test(aria)) return "star";
    if (/\/forks(?:[/?#]|$)/i.test(href) || /(^|\s)Fork(?:\s|$)/i.test(label) || /fork/i.test(aria)) return "fork";
    if (/(^|\s)Watch(?:\s|$)/i.test(label) || /watch/i.test(aria)) return "watch";
    if (/(^|\s)Sponsor(?:\s|$)/i.test(label) || /sponsor/i.test(aria)) return "sponsor";
    return "";
  }

  function collectVisibleActionControls(documentObject = globalThis.document, options = {}) {
    const controls = new Set();
    const visible = (element) => isVisibleElement(element, options);
    for (const element of documentObject?.querySelectorAll?.(ACTION_CONTROL_SELECTORS.join(",")) || []) {
      if (visible(element) && actionKind(element)) controls.add(element);
    }
    for (const element of documentObject?.querySelectorAll?.("a, button, summary") || []) {
      if (visible(element) && actionKind(element)) controls.add(element);
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
        .filter((control) => container.contains?.(control))
        .map(actionKind)
        .filter(Boolean)
    );
  }

  function findCompleteActionGroup(control, controls, options = {}) {
    const kind = actionKind(control);
    if (!kind) return null;
    let node = control;
    let best = control;
    let depth = 0;

    while (node.parentElement && node.parentElement !== options.documentObject?.body && depth < 8) {
      const parent = node.parentElement;
      if (!isVisibleElement(parent, options)) break;
      const rect = parent.getBoundingClientRect?.() || { height: 0 };
      if (rect.height < 20 || rect.height > 88) break;
      const kinds = actionKindsWithin(parent, controls);
      if (kinds.size !== 1 || !kinds.has(kind)) break;
      best = parent;
      node = parent;
      depth += 1;
    }
    return best;
  }

  function findToolbarForActionGroup(group, controls, options = {}) {
    let node = group && group.parentElement;
    let depth = 0;
    while (node && node !== options.documentObject?.body && depth < 6) {
      if (isVisibleElement(node, options)) {
        const getStyle = styleReader(options);
        const style = typeof getStyle === "function" ? getStyle(node) : {};
        const rect = node.getBoundingClientRect?.() || { width: 0, height: 0 };
        const groupChild = directChildWithin(node, group);
        const kinds = actionKindsWithin(node, controls);
        if (
          groupChild &&
          kinds.size >= 2 &&
          ["flex", "inline-flex", "grid", "inline-grid"].includes(style.display) &&
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

  function releaseTagFromLink(link, repo, urlPolicy = globalThis.GHDNUrlPolicy) {
    if (!link || !repo || !urlPolicy) return "";
    const parsed = urlPolicy.releaseTag(link.getAttribute?.("href") || "", repo.owner, repo.repo);
    return parsed ? parsed.tag : "";
  }

  function releaseTagForSection(section, repo, options = {}) {
    if (!section) return "";
    const visible = options.isVisible || ((element) => isVisibleElement(element, options));
    const link = [...(section.querySelectorAll?.('a[href*="/releases/tag/"]') || [])]
      .find((candidate) => visible(candidate) && releaseTagFromLink(candidate, repo, options.urlPolicy));
    return link ? releaseTagFromLink(link, repo, options.urlPolicy) : "";
  }

  function findReleaseTitleGroup(section, repo, preferredTag = "", options = {}) {
    if (!section) return null;
    const visible = options.isVisible || ((element) => isVisibleElement(element, options));
    const links = [...(section.querySelectorAll?.('a[href*="/releases/tag/"]') || [])]
      .filter(visible)
      .map((link) => ({ link, tag: releaseTagFromLink(link, repo, options.urlPolicy) }))
      .filter((entry) => entry.tag);
    const selected = links.find((entry) => !preferredTag || entry.tag === preferredTag) || links[0];
    if (!selected) return null;

    const wrapper = selected.link.closest?.("span, h1, h2, h3") || selected.link.parentElement;
    if (!wrapper || !section.contains?.(wrapper) || wrapper === section) return null;
    const containsCompare = [...(wrapper.querySelectorAll?.("button, summary") || [])]
      .some((element) => /compare/i.test(normalizedActionText(element)));
    if (containsCompare) return null;

    return { element: wrapper, anchor: selected.link, insertBefore: false, tag: selected.tag };
  }

  return Object.freeze({
    ACTION_CONTROL_SELECTORS,
    isVisibleElement,
    normalizedActionText,
    actionKind,
    collectVisibleActionControls,
    directChildWithin,
    actionKindsWithin,
    findCompleteActionGroup,
    findToolbarForActionGroup,
    releaseTagFromLink,
    releaseTagForSection,
    findReleaseTitleGroup
  });
});
