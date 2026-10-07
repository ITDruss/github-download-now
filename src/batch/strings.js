(function initBatchStrings(root, factory) {
  const api = factory();
  root.GHDNBatchStrings = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBatchStringsApi() {
  "use strict";
  function create(i18n, language, browserLanguage) {
    const tr = i18n.create(language, browserLanguage);
    const keys = ["title", "subtitle", "search", "formats", "allFormats", "noExtension", "selectAll", "clearSelection",
      "download", "copyLinks", "selection", "loading", "empty", "noMatch", "queue", "cancel", "retry", "clearQueue",
      "permission", "permissionDenied", "unsupported", "private", "busy", "failed", "limit", "publicOnly", "savedIn",
      "queued", "starting", "in_progress", "complete", "interrupted", "canceled", "copied", "refresh", "count", "summary", "watch", "watching"];
    const result = { tag: tr.tag };
    for (const key of keys) result[key] = tr.t(`batch${key[0].toUpperCase()}${key.slice(1)}`);
    return Object.freeze(result);
  }
  return Object.freeze({ create });
});
