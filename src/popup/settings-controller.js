(function initPopupSettingsController(root, factory) {
  const api = factory();
  root.GHDNPopupSettingsController = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPopupSettingsControllerApi() {
  "use strict";

  function create(options = {}) {
    const document = options.document;
    const browserApi = options.browserApi;
    const settingsApi = options.settingsApi;
    const formatting = options.formatting;
    const strings = options.strings;
    const formatOptions = options.formatOptions;
    const view = options.view;
    if (!document || !browserApi || !settingsApi || !formatting || !strings || !formatOptions || !view) {
      throw new Error("Popup settings dependencies are incomplete");
    }

    let settings = null;
    let platform = null;
    let onSettings = () => {};

    function settingKey(os) {
      return formatting.platformSettingKey(os);
    }

    function fillFormats() {
      const select = document.getElementById("preferredFormat");
      const formats = formatOptions()[platform.os] || formatOptions().linux;
      select.replaceChildren(...formats.map(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        return option;
      }));
      select.value = settings[settingKey(platform.os)];
    }

    async function update(patch) {
      settings = await settingsApi.set(patch);
      onSettings(settings);
      view.status(strings.saved);
      return settings;
    }

    function initialize(initialSettings, detectedPlatform, callback = () => {}) {
      settings = initialSettings;
      platform = detectedPlatform;
      onSettings = callback;
      document.getElementById("detectedPlatform").textContent = `${{
        linux: "Linux",
        windows: "Windows",
        macos: "macOS",
        android: "Android"
      }[platform.os]} · ${platform.arch}`;
      document.getElementById("enabled").checked = settings.enabled;
      document.body.classList.toggle("disabled", !settings.enabled);
      fillFormats();
      for (const key of ["primaryAction", "afterDownload", "updateCheckInterval"]) {
        document.getElementById(key).value = settings[key];
      }
      for (const key of ["notificationsEnabled", "badgeEnabled", "historyEnabled"]) {
        document.getElementById(key).checked = settings[key];
      }
    }

    function requestNotifications() {
      return browserApi.permissions.request({ permissions: ["notifications"] });
    }

    function bind() {
      document.getElementById("enabled").addEventListener("change", async (event) => {
        await update({ enabled: event.target.checked });
        document.body.classList.toggle("disabled", !event.target.checked);
      });
      document.getElementById("preferredFormat").addEventListener("change", (event) => {
        update({ [settingKey(platform.os)]: event.target.value }).catch(console.error);
      });
      for (const key of ["primaryAction", "afterDownload", "updateCheckInterval"]) {
        document.getElementById(key).addEventListener("change", (event) => {
          update({ [key]: event.target.value }).catch(console.error);
        });
      }
      for (const key of ["badgeEnabled", "historyEnabled"]) {
        document.getElementById(key).addEventListener("change", (event) => {
          update({ [key]: event.target.checked }).catch(console.error);
        });
      }
      document.getElementById("notificationsEnabled").addEventListener("change", async (event) => {
        if (event.target.checked && !(await requestNotifications())) {
          event.target.checked = false;
          view.status(strings.permissionDenied, true);
        }
        await update({ notificationsEnabled: event.target.checked });
      });
    }

    return Object.freeze({ bind, initialize, settingKey });
  }

  return Object.freeze({ create });
});
