(function initBackgroundStorage(root, factory) {
  const api = factory();
  root.GHDNBackgroundStorage = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBackgroundStorageApi() {
  "use strict";

  function create(options = {}) {
    const browserApi = options.browserApi;
    if (!browserApi?.storage?.local) throw new Error("Background storage requires browserApi.storage.local");

    function localGet(defaults) {
      return browserApi.storage.local.get(defaults);
    }

    function localSet(values) {
      return browserApi.storage.local.set(values);
    }

    function localRemove(keys) {
      return browserApi.storage.local.remove(keys);
    }

    async function restrictLocalStorageToTrustedContexts() {
      try {
        await browserApi.storage.local.setAccessLevel("TRUSTED_CONTEXTS");
      } catch (_error) {}
    }

    return Object.freeze({
      localGet,
      localSet,
      localRemove,
      restrictLocalStorageToTrustedContexts
    });
  }

  return Object.freeze({ create });
});
