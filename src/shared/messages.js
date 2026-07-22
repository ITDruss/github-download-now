(function initMessages(root, factory) {
  const api = factory();
  root.GHDNMessages = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMessagesApi() {
  "use strict";

  const TYPES = Object.freeze({
    GET_LATEST_RELEASE: "GHDN_GET_LATEST_RELEASE",
    GET_RELEASE_BY_TAG: "GHDN_GET_RELEASE_BY_TAG",
    GET_BUILD_INSTRUCTIONS: "GHDN_GET_BUILD_INSTRUCTIONS",
    AUTH_STATUS: "GHDN_AUTH_STATUS",
    AUTH_START: "GHDN_AUTH_START",
    AUTH_POLL: "GHDN_AUTH_POLL",
    AUTH_DISCONNECT: "GHDN_AUTH_DISCONNECT",
    RECORD_DOWNLOAD: "GHDN_RECORD_DOWNLOAD",
    WATCH_REPOSITORY: "GHDN_WATCH_REPOSITORY",
    UNWATCH_REPOSITORY: "GHDN_UNWATCH_REPOSITORY",
    GET_DASHBOARD: "GHDN_GET_DASHBOARD",
    CHECK_UPDATES: "GHDN_CHECK_UPDATES",
    DISMISS_UPDATE: "GHDN_DISMISS_UPDATE",
    DOWNLOAD_UPDATE: "GHDN_DOWNLOAD_UPDATE",
    OPEN_URL: "GHDN_OPEN_URL",
    OPEN_OPTIONS: "GHDN_OPEN_OPTIONS",
    CLEAR_HISTORY: "GHDN_CLEAR_HISTORY",
    CLEAR_TRACKING: "GHDN_CLEAR_TRACKING"
  });

  const values = Object.freeze(Object.values(TYPES));
  const known = new Set(values);
  const AUTH_PREFIX = "GHDN_AUTH_";

  function isKnownType(value) {
    return typeof value === "string" && known.has(value);
  }

  function isAuthType(value) {
    return typeof value === "string" && value.startsWith(AUTH_PREFIX);
  }

  function create(type, payload = {}) {
    if (!isKnownType(type)) throw new TypeError(`Unknown runtime message type: ${String(type)}`);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new TypeError("Runtime message payload must be an object");
    }
    return { ...payload, type };
  }

  return Object.freeze({ TYPES, VALUES: values, AUTH_PREFIX, isKnownType, isAuthType, create });
});
