(function initVersionController(root, factory) {
  const api = factory();
  root.GHDNVersionController = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createVersionControllerApi() {
  "use strict";

  function create(options = {}) {
    const state = options.state;
    const getRepository = options.getRepository;
    const getPlatform = options.getPlatform;
    const getReleaseChannel = options.getReleaseChannel || (() => "stable");
    const getMountedReleaseTag = options.getMountedReleaseTag || (() => "");
    const releaseLoader = options.releaseLoader;
    const onLoading = options.onLoading || (() => {});
    const onLoaded = options.onLoaded || (() => {});

    if (!state || !getRepository || !getPlatform || !releaseLoader) {
      throw new Error("Version controller dependencies are incomplete");
    }

    function selectedTag() {
      return String(state.selectedReleaseTag || "");
    }

    function setContext(contextKey, releaseTag = "") {
      return state.resetContext(contextKey, releaseTag);
    }

    function resetAll() {
      state.resetAll();
    }

    async function load() {
      if (state.releaseState) return state.releaseState;
      if (state.releasePromise) return state.releasePromise;

      const repo = getRepository();
      if (!repo) throw new Error("Repository not found");
      onLoading(true);

      const revision = state.revision;
      let trackedPromise;
      const request = (async () => {
        const platform = await getPlatform();
        const requestedTag = String(selectedTag() || getMountedReleaseTag() || "");
        const response = await releaseLoader.load({
          repo,
          requestedTag,
          platform,
          releaseChannel: getReleaseChannel()
        });
        if (state.revision !== revision) {
          if (state.releasePromise && state.releasePromise !== trackedPromise) {
            return state.releasePromise;
          }
          return state.releaseState || { response, platform };
        }
        state.releaseState = { response, platform };
        onLoaded(response, platform);
        return state.releaseState;
      })();
      trackedPromise = request.finally(() => {
        if (state.releasePromise !== trackedPromise) return;
        state.releasePromise = null;
        onLoading(false);
      });
      state.releasePromise = trackedPromise;
      return trackedPromise;
    }

    async function select(releaseTag) {
      const nextTag = String(releaseTag || "");
      const currentTag = selectedTag();
      const loadedTag = String(state.releaseState?.response?.release?.tag_name || "");
      if (!nextTag || nextTag === currentTag && loadedTag === nextTag) {
        return state.releaseState || load();
      }
      state.selectReleaseTag(nextTag);
      return load();
    }

    function getReleaseTags(repo) {
      return releaseLoader.getReleaseTags(repo);
    }

    return Object.freeze({
      selectedTag,
      setContext,
      resetAll,
      load,
      select,
      getReleaseTags
    });
  }

  return Object.freeze({ create });
});
