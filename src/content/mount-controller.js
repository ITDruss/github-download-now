(function initContentMountController(root, factory) {
  const api = factory();
  root.GHDNContentMountController = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createContentMountControllerApi() {
  "use strict";

  function create(options = {}) {
    const documentObject = options.documentObject || globalThis.document;
    const repositoryContext = options.repositoryContext;
    const placement = options.placement;
    const versionController = options.versionController;
    const menuShell = options.menuShell;
    const downloadButton = options.downloadButton;
    const lifecycle = options.lifecycle;
    const actions = options.actions;
    const contentState = options.contentState;
    const getSettings = options.getSettings;
    const waitForSettings = options.waitForSettings || (() => Promise.resolve());
    const rootId = options.rootId || "ghdn-root";
    let busy = false;
    let rejectedToolbarHost = null;
    let rejectedToolbarWidth = 0;

    if (
      !documentObject || !repositoryContext || !placement || !versionController || !menuShell ||
      !downloadButton || !lifecycle || !actions || !contentState || typeof getSettings !== "function"
    ) {
      throw new Error("Mount-controller dependencies are incomplete");
    }

    function updatePresentation() {
      Promise.resolve(actions.getDetectedPlatform())
        .then((detectedPlatform) => {
          downloadButton.updatePresentation(contentState.releaseState?.response, detectedPlatform);
        })
        .catch(() => {});
    }

    function createRoot(target) {
      return downloadButton.createRoot(target, {
        onPrimaryClick: actions.handlePrimaryClick,
        onMenuClick: (event) => actions.handleMenuClick(event, rootId)
      });
    }

    function removeCurrent(existing) {
      existing?.remove();
      menuShell.setOpen(false);
    }

    async function refresh(refreshOptions = {}) {
      if (busy) return;
      busy = true;
      try {
        await waitForSettings();
        const settings = getSettings();
        const repo = repositoryContext.parse();
        let existing = documentObject.getElementById(rootId);

        if (!repo || !repositoryContext.shouldShow(repo, settings)) {
          removeCurrent(existing);
          versionController.resetAll();
          lifecycle.observeLayoutHost(null);
          return;
        }

        const target = placement.findMountTarget(repo, {
          ...refreshOptions,
          rejectedToolbarHost,
          rejectedToolbarWidth
        });
        if (!target) {
          removeCurrent(existing);
          lifecycle.observeLayoutHost(null);
          return;
        }

        const contextKey = `${repo.key}:${target.releaseTag || "latest"}`;
        if (versionController.setContext(contextKey, target.releaseTag || "")) {
          removeCurrent(existing);
          existing = null;
        }

        const sameTarget = existing &&
          existing.dataset.placement === target.mode &&
          String(existing.dataset.releaseTag || "") === String(target.releaseTag || "") &&
          existing.__ghdnLayoutHost === target.element &&
          existing.isConnected;

        if (!sameTarget) {
          existing?.remove();
          existing = createRoot(target);
          placement.insertRoot(existing, target);
          menuShell.installCloseListeners();
          updatePresentation();
        }

        lifecycle.observeLayoutHost(target.element);
        if (target.mode === "toolbar") {
          await downloadButton.waitForLayout();
          if (!downloadButton.applyToolbarDensity(existing)) {
            rejectedToolbarHost = target.element;
            rejectedToolbarWidth = target.element.clientWidth;
            existing.remove();
            const fallback = placement.findMountTarget(repo, {
              preferFlow: true,
              rejectedToolbarHost,
              rejectedToolbarWidth
            });
            if (!fallback) {
              lifecycle.observeLayoutHost(null);
              return;
            }
            const flowRoot = createRoot(fallback);
            placement.insertRoot(flowRoot, fallback);
            lifecycle.observeLayoutHost(fallback.element);
            updatePresentation();
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
        busy = false;
      }
    }

    function mount() {
      return refresh();
    }

    function resetToolbarRejection() {
      rejectedToolbarHost = null;
      rejectedToolbarWidth = 0;
    }

    return Object.freeze({ refresh, mount, resetToolbarRejection });
  }

  return Object.freeze({ create });
});
