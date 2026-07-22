(function initContentLifecycle(root, factory) {
  const api = factory();
  root.GHDNContentLifecycle = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createContentLifecycleApi() {
  "use strict";

  function create(options = {}) {
    const documentObject = options.documentObject || globalThis.document;
    const windowObject = options.windowObject || globalThis.window;
    const MutationObserverClass = options.MutationObserverClass || globalThis.MutationObserver;
    const ResizeObserverClass = options.ResizeObserverClass || globalThis.ResizeObserver;
    const requestFrame = options.requestAnimationFrameFn || globalThis.requestAnimationFrame;
    const cancelFrame = options.cancelAnimationFrameFn || globalThis.cancelAnimationFrame;
    const setTimer = options.setTimeoutFn || globalThis.setTimeout;
    const clearTimer = options.clearTimeoutFn || globalThis.clearTimeout;
    const repositoryContext = options.repositoryContext;
    const mount = options.mount;
    const refreshLayout = options.refreshLayout || mount;
    const loadRelease = options.loadRelease;
    const positionMenu = options.positionMenu || (() => {});
    const onError = options.onError || ((label, error) => console.warn(`[GHDN] ${label}`, error));
    const menuId = options.menuId || "ghdn-menu";
    const mountDelayMs = options.mountDelayMs ?? 80;
    const prefetchDelayMs = options.prefetchDelayMs ?? 140;

    let mountTimer = null;
    let prefetchTimer = null;
    let layoutFrame = null;
    let releaseScrollFrame = null;
    let resizeObserver = null;
    let observedLayoutHost = null;
    let pageObserver = null;
    let observedPageHost = null;
    let started = false;

    function observeLayoutHost(element) {
      if (observedLayoutHost === element) return;
      if (resizeObserver) resizeObserver.disconnect();
      resizeObserver = null;
      observedLayoutHost = element || null;
      if (!element || typeof ResizeObserverClass !== "function") return;
      resizeObserver = new ResizeObserverClass(scheduleLayoutRefresh);
      resizeObserver.observe(element);
    }

    function scheduleLayoutRefresh() {
      if (layoutFrame !== null) cancelFrame(layoutFrame);
      layoutFrame = requestFrame(() => {
        layoutFrame = null;
        Promise.resolve(refreshLayout()).catch((error) => onError("layout refresh failed", error));
      });
    }

    function configurePageObserver() {
      const repo = repositoryContext.parse();
      const nextHost = repo
        ? (documentObject.querySelector("main") || documentObject.querySelector("#js-repo-pjax-container") || documentObject.body)
        : null;

      if (nextHost === observedPageHost && pageObserver) return;
      if (pageObserver) pageObserver.disconnect();
      pageObserver = null;
      observedPageHost = nextHost;
      if (!nextHost || typeof MutationObserverClass !== "function") return;

      pageObserver = new MutationObserverClass(scheduleMount);
      pageObserver.observe(nextHost, { childList: true, subtree: true });
    }

    function scheduleMount() {
      if (mountTimer !== null) clearTimer(mountTimer);
      mountTimer = setTimer(() => {
        mountTimer = null;
        Promise.resolve(mount()).catch((error) => onError("mount failed", error));
      }, mountDelayMs);
    }

    function handleNavigation() {
      configurePageObserver();
      scheduleMount();
    }

    function schedulePrefetch() {
      if (prefetchTimer !== null) clearTimer(prefetchTimer);
      prefetchTimer = setTimer(() => {
        prefetchTimer = null;
        Promise.resolve(loadRelease()).catch(() => {});
      }, prefetchDelayMs);
    }

    function cancelPrefetch() {
      if (prefetchTimer !== null) clearTimer(prefetchTimer);
      prefetchTimer = null;
    }

    function handleScroll() {
      const menu = documentObject.getElementById(menuId);
      if (menu && !menu.hidden) requestFrame(positionMenu);
      if (!observedPageHost || releaseScrollFrame !== null) return;
      const repo = repositoryContext.parse();
      if (!repositoryContext.isReleasesRoute(repo)) return;
      releaseScrollFrame = requestFrame(() => {
        releaseScrollFrame = null;
        scheduleMount();
      });
    }

    function start() {
      if (started) return;
      started = true;
      documentObject.addEventListener("turbo:load", handleNavigation);
      documentObject.addEventListener("pjax:end", handleNavigation);
      windowObject.addEventListener("popstate", handleNavigation);
      windowObject.addEventListener("resize", scheduleLayoutRefresh, { passive: true });
      windowObject.addEventListener("scroll", handleScroll, { passive: true, capture: true });
      configurePageObserver();
      scheduleMount();
    }

    function stop() {
      if (!started) return;
      started = false;
      documentObject.removeEventListener("turbo:load", handleNavigation);
      documentObject.removeEventListener("pjax:end", handleNavigation);
      windowObject.removeEventListener("popstate", handleNavigation);
      windowObject.removeEventListener("resize", scheduleLayoutRefresh);
      windowObject.removeEventListener("scroll", handleScroll, true);
      if (pageObserver) pageObserver.disconnect();
      if (resizeObserver) resizeObserver.disconnect();
      if (mountTimer !== null) clearTimer(mountTimer);
      if (prefetchTimer !== null) clearTimer(prefetchTimer);
      if (layoutFrame !== null) cancelFrame(layoutFrame);
      if (releaseScrollFrame !== null) cancelFrame(releaseScrollFrame);
      pageObserver = null;
      resizeObserver = null;
      observedPageHost = null;
      observedLayoutHost = null;
      mountTimer = null;
      prefetchTimer = null;
      layoutFrame = null;
      releaseScrollFrame = null;
    }

    return Object.freeze({
      start,
      stop,
      observeLayoutHost,
      scheduleLayoutRefresh,
      scheduleMount,
      schedulePrefetch,
      cancelPrefetch,
      configurePageObserver
    });
  }

  return Object.freeze({ create });
});
