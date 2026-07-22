"use strict";

(() => {
  const browserApi = globalThis.GHDNBrowser;
  const extensionApi = browserApi.api;
  const messages = globalThis.GHDNMessages;
  const formatting = globalThis.GHDNFormatting;
  const settingsApi = globalThis.GHDNSettings;
  const i18n = globalThis.GHDNI18n;
  const stringsApi = globalThis.GHDNPopupStrings;
  const viewApi = globalThis.GHDNPopupView;
  const settingsControllerApi = globalThis.GHDNPopupSettingsController;
  const dashboardControllerApi = globalThis.GHDNPopupDashboardController;

  async function init() {
    let settings = await settingsApi.get();
    const localized = stringsApi.create(i18n, settings.language, navigator.language || "");
    const platform = formatting.platform(navigator.userAgent || "");
    const view = viewApi.create({
      document,
      location,
      history,
      translator: localized.translator,
      strings: localized.strings,
      formatting
    });
    const send = (message) => browserApi.runtime.sendMessage(message);
    const openUrl = (url) => send({ type: messages.TYPES.OPEN_URL, url });

    view.setLabels();
    view.bindTabs();
    document.getElementById("version").textContent = `v${extensionApi.runtime.getManifest().version}`;

    const settingsController = settingsControllerApi.create({
      document,
      browserApi,
      settingsApi,
      formatting,
      strings: localized.strings,
      formatOptions: localized.formatOptions,
      view
    });
    settingsController.initialize(settings, platform, (next) => { settings = next; });
    settingsController.bind();

    const dashboardController = dashboardControllerApi.create({
      document,
      messages,
      formatting,
      translator: localized.translator,
      strings: localized.strings,
      view,
      send,
      openUrl
    });
    dashboardController.bind();
    await dashboardController.refresh();
  }

  init().catch((error) => {
    console.error(error);
    const node = document.getElementById("status");
    if (node) {
      node.textContent = String(error.message || error);
      node.classList.add("error");
    }
  });
})();
