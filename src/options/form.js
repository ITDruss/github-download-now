(function initOptionsForm(root, factory) {
  const api = factory();
  root.GHDNOptionsForm = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createOptionsFormApi() {
  "use strict";

  const FIELDS = Object.freeze([
    "enabled", "language", "osOverride", "archOverride", "preferredLinux", "preferredWindows",
    "preferredMacos", "preferredAndroid", "primaryAction", "installGuidance", "buttonStyle",
    "showSubtitle", "showOtherPlatforms", "showSourceCode", "showRecommendationReason",
    "releaseChannel", "staleReleaseMonths", "showOn", "historyEnabled", "afterDownload",
    "updateCheckInterval", "notificationsEnabled", "badgeEnabled"
  ]);

  function create(options = {}) {
    const document = options.document;
    const browserApi = options.browserApi;
    const settingsApi = options.settingsApi;
    if (!document || !browserApi || !settingsApi) throw new Error("Options form dependencies are incomplete");
    let saveTimer = null;

    function fill(settings) {
      for (const key of FIELDS) {
        const node = document.getElementById(key);
        if (node.type === "checkbox") node.checked = Boolean(settings[key]);
        else node.value = String(settings[key]);
      }
    }

    function collect() {
      const patch = {};
      for (const key of FIELDS) {
        const node = document.getElementById(key);
        patch[key] = node.type === "checkbox" ? node.checked : node.value;
      }
      patch.staleReleaseMonths = Number(patch.staleReleaseMonths);
      return patch;
    }

    function requestNotifications() {
      return browserApi.permissions.request({ permissions: ["notifications"] });
    }

    function bind(callbacks = {}) {
      const onSaved = callbacks.onSaved || (() => {});
      const onPermissionDenied = callbacks.onPermissionDenied || (() => {});
      for (const key of FIELDS) {
        const node = document.getElementById(key);
        node.addEventListener("change", async () => {
          if (key === "notificationsEnabled" && node.checked && !(await requestNotifications())) {
            node.checked = false;
            onPermissionDenied();
          }
          clearTimeout(saveTimer);
          saveTimer = setTimeout(() => {
            settingsApi.set(collect())
              .then((settings) => onSaved(settings))
              .catch(console.error);
          }, 120);
        });
      }
    }

    async function reset() {
      const settings = await settingsApi.reset();
      fill(settings);
      return settings;
    }

    function stop() {
      clearTimeout(saveTimer);
      saveTimer = null;
    }

    return Object.freeze({ bind, collect, fill, reset, stop });
  }

  return Object.freeze({ create, FIELDS });
});
