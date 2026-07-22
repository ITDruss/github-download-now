(function initContentState(root, factory) {
  const api = factory();
  root.GHDNContentState = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createContentStateApi() {
  "use strict";

  function create() {
    const state = {
      activeContextKey: "",
      selectedReleaseTag: "",
      releaseState: null,
      releasePromise: null,
      buildInstructionsState: null,
      buildInstructionsPromise: null,
      detectedPlatformPromise: null,
      revision: 0
    };

    state.resetRelease = function resetRelease(options = {}) {
      state.revision += 1;
      state.releaseState = null;
      state.releasePromise = null;
      state.buildInstructionsState = null;
      state.buildInstructionsPromise = null;
      if (options.clearPlatform) state.detectedPlatformPromise = null;
    };

    state.resetContext = function resetContext(contextKey, releaseTag = "") {
      const nextKey = String(contextKey || "");
      if (state.activeContextKey === nextKey) return false;
      state.activeContextKey = nextKey;
      state.selectedReleaseTag = String(releaseTag || "");
      state.resetRelease({ clearPlatform: true });
      return true;
    };

    state.selectReleaseTag = function selectReleaseTag(releaseTag) {
      const nextTag = String(releaseTag || "");
      if (state.selectedReleaseTag === nextTag) return false;
      state.selectedReleaseTag = nextTag;
      state.resetRelease();
      return true;
    };

    state.resetAll = function resetAll() {
      state.activeContextKey = "";
      state.selectedReleaseTag = "";
      state.resetRelease({ clearPlatform: true });
    };

    return state;
  }

  return Object.freeze({ create });
});
