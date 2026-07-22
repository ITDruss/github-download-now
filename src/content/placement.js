(function initPlacement(root, factory) {
  const api = factory();
  root.GHDNPlacement = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPlacementModule() {
  "use strict";

  function create(options = {}) {
    const documentObject = options.documentObject || globalThis.document;
    const windowObject = options.windowObject || globalThis.window;
    const getComputedStyle = options.getComputedStyle || globalThis.getComputedStyle;
    const repositoryContext = options.repositoryContext || globalThis.GHDNRepositoryContext;
    const dom = options.dom || globalThis.GHDNGitHubDom;
    const urlPolicy = options.urlPolicy || globalThis.GHDNUrlPolicy;
    const rootId = options.rootId || "ghdn-root";
    const toolbarBreakpoint = Number(options.toolbarBreakpoint) || 760;
    const domOptions = { documentObject, getComputedStyle, rootId, urlPolicy };
    const visible = (element) => dom.isVisibleElement(element, domOptions);

    function findToolbarTarget() {
      const controls = dom.collectVisibleActionControls(documentObject, domOptions);
      if (controls.length < 2) return null;
      const seenGroups = new Set();
      const candidates = [];

      for (const starControl of controls.filter((control) => dom.actionKind(control) === "star")) {
        const completeGroup = dom.findCompleteActionGroup(starControl, controls, domOptions);
        if (!completeGroup || seenGroups.has(completeGroup)) continue;
        seenGroups.add(completeGroup);
        const toolbar = dom.findToolbarForActionGroup(completeGroup, controls, domOptions);
        if (!toolbar) continue;

        const hostRect = toolbar.element.getBoundingClientRect();
        const groupRect = toolbar.group.getBoundingClientRect();
        const flexDirection = getComputedStyle(toolbar.element).flexDirection || "row";
        candidates.push({
          mode: "toolbar",
          element: toolbar.element,
          insertBefore: /-reverse$/.test(flexDirection),
          anchor: toolbar.group,
          listMode: toolbar.element.tagName === "UL",
          score: toolbar.depth * -40 - hostRect.height * 0.2 - hostRect.width * 0.001 + groupRect.right * 0.0001
        });
      }
      return candidates.length ? candidates.sort((a, b) => b.score - a.score)[0] : null;
    }

    function findReleaseTarget(repo) {
      if (!repositoryContext.isReleasesRoute(repo)) return null;
      const explicitTag = repositoryContext.releaseTagFromRoute(repo);
      const sections = [...documentObject.querySelectorAll('section[data-release-anchor], section[id^="release-"]')]
        .filter(visible);
      const candidates = [];

      for (const section of sections) {
        const tag = dom.releaseTagForSection(section, repo, { ...domOptions, isVisible: visible });
        if (!tag || (explicitTag && tag !== explicitTag)) continue;
        const title = dom.findReleaseTitleGroup(section, repo, tag, { ...domOptions, isVisible: visible });
        if (!title) continue;
        const rect = section.getBoundingClientRect();
        const viewportAnchor = Math.min(180, windowObject.innerHeight * 0.25);
        const isInViewport = rect.bottom > 80 && rect.top < windowObject.innerHeight - 40;
        candidates.push({
          mode: "release",
          element: title.element,
          anchor: title.anchor,
          insertBefore: false,
          releaseTag: title.tag,
          listMode: false,
          score: explicitTag ? 100000 : (isInViewport ? 10000 : 0) - Math.abs(rect.top - viewportAnchor)
        });
      }
      if (candidates.length) return candidates.sort((a, b) => b.score - a.score)[0];

      const main = documentObject.querySelector("main");
      if (!main || !visible(main)) return null;
      const title = dom.findReleaseTitleGroup(main, repo, explicitTag, { ...domOptions, isVisible: visible });
      if (!title) return null;
      return {
        mode: "release",
        element: title.element,
        anchor: title.anchor,
        insertBefore: false,
        releaseTag: title.tag,
        listMode: false
      };
    }

    function findFlowTarget(repo) {
      if (!repositoryContext.isFlowEligibleRoute(repo)) return null;
      const candidates = [
        documentObject.querySelector("#repo-content-pjax-container"),
        documentObject.querySelector("main#js-repo-pjax-container"),
        documentObject.querySelector("main .Layout-main"),
        documentObject.querySelector("main")
      ];
      const element = candidates.find((candidate) => candidate && visible(candidate));
      return element ? { mode: "flow", element, prepend: true, listMode: false } : null;
    }

    function findMountTarget(repo, targetOptions = {}) {
      if (repositoryContext.isReleasesRoute(repo)) return findReleaseTarget(repo);
      if (!targetOptions.preferFlow && windowObject.innerWidth >= toolbarBreakpoint) {
        const toolbar = findToolbarTarget();
        if (toolbar) {
          const currentWidth = toolbar.element.clientWidth;
          const stillRejected =
            targetOptions.rejectedToolbarHost === toolbar.element &&
            Math.abs(Number(targetOptions.rejectedToolbarWidth || 0) - currentWidth) < 4;
          if (!stillRejected) return toolbar;
        }
      }
      return findFlowTarget(repo) || { mode: "floating", element: documentObject.body, listMode: false };
    }

    function insertRoot(root, target) {
      if (target.anchor && target.anchor.parentElement === target.element) {
        if (target.insertBefore) target.element.insertBefore(root, target.anchor);
        else target.element.insertBefore(root, target.anchor.nextSibling);
      } else if (target.prepend) {
        target.element.prepend(root);
      } else {
        target.element.append(root);
      }
      root.__ghdnLayoutHost = target.element;
    }

    return Object.freeze({ findToolbarTarget, findReleaseTarget, findFlowTarget, findMountTarget, insertRoot });
  }

  return Object.freeze({ create });
});
