(function initBuildDocuments(root, factory) {
  const api = factory();
  root.GHDNBuildDocuments = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBuildDocumentsApi() {
  "use strict";

  function create(options = {}) {
    const elements = options.elements;
    const formatting = options.formatting;
    const getStrings = options.getStrings || (() => ({}));
    const loadBuildInstructions = options.loadBuildInstructions;
    const positionMenu = options.positionMenu || (() => {});
    const requestFrame = options.requestAnimationFrameFn || globalThis.requestAnimationFrame;
    if (!elements || !formatting || !loadBuildInstructions) throw new Error("Build document dependencies are incomplete");
    const { createElement, createIcon } = elements;

    function createStatus(message, type) {
      const status = createElement("div", `ghdn-build-status ghdn-build-status-${type}`);
      status.append(
        createIcon(type === "error" ? "warning" : "info", "ghdn-inline-icon"),
        createElement("span", "", message)
      );
      return status;
    }

    function renderLinks(container, links, response) {
      const strings = getStrings();
      links.replaceChildren();
      if (!response?.ok) {
        if (response?.error === "rate_limited") {
          const time = response.resetAt ? formatting.time(response.resetAt) : null;
          links.append(createStatus(strings.rateLimited(time), "error"));
        } else {
          links.append(createStatus(strings.buildError, "error"));
        }
        return;
      }
      const documents = Array.isArray(response.documents) ? response.documents : [];
      if (!documents.length) {
        container.hidden = true;
        return;
      }
      if (response.usedDefaultBranchFallback) links.append(createStatus(strings.buildFallbackNotice, "warning"));
      for (const documentLink of documents) {
        if (!documentLink?.htmlUrl) continue;
        const link = createElement("a", "ghdn-build-doc-link");
        link.href = documentLink.htmlUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.append(
          createIcon("external", "ghdn-inline-icon"),
          createElement("span", "", documentLink.title || documentLink.path || strings.buildFromSource)
        );
        links.append(link);
      }
      if (!links.querySelector(".ghdn-build-doc-link")) container.hidden = true;
    }

    function createControl(release) {
      const strings = getStrings();
      const details = createElement("details", "ghdn-build-docs");
      const summary = createElement("summary", "ghdn-build-docs-heading");
      summary.append(createIcon("source", "ghdn-inline-icon"), createElement("span", "", strings.buildLoadAction));
      const links = createElement("div", "ghdn-build-docs-links");
      details.append(summary, links);
      let loaded = false;
      details.addEventListener("toggle", () => {
        if (!details.open || loaded) return;
        loaded = true;
        links.replaceChildren(createStatus(strings.buildLoading, "loading"));
        loadBuildInstructions(release)
          .then((response) => {
            renderLinks(details, links, response);
            requestFrame(positionMenu);
          })
          .catch(() => {
            links.replaceChildren(createStatus(strings.buildError, "error"));
            requestFrame(positionMenu);
          });
      });
      return details;
    }

    return Object.freeze({ createControl, createStatus, renderLinks });
  }

  return Object.freeze({ create });
});
