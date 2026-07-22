"use strict";

(() => {
  const browserApi = globalThis.GHDNBrowser;
  const messages = globalThis.GHDNMessages;
  const formatting = globalThis.GHDNFormatting;
  const settingsApi = globalThis.GHDNSettings;
  const i18n = globalThis.GHDNI18n;
  const stringsApi = globalThis.GHDNOptionsStrings;
  const viewApi = globalThis.GHDNOptionsView;
  const formApi = globalThis.GHDNOptionsForm;
  const authPanelApi = globalThis.GHDNOptionsAuthPanel;
  const updateActionsApi = globalThis.GHDNOptionsUpdateActions;

  async function init() {
    let settings = await settingsApi.get();
    let localized = stringsApi.create(i18n, settings.language, navigator.language || "");
    const view = viewApi.create({ document, i18n });
    const send = (message) => browserApi.runtime.sendMessage(message);
    let authPanel = null;

    function refreshTranslation() {
      localized = stringsApi.create(i18n, settings.language, navigator.language || "");
      view.translate(localized.strings, settings);
      if (authPanel) authPanel.render();
    }

    refreshTranslation();

    const form = formApi.create({ document, browserApi, settingsApi });
    form.fill(settings);
    form.bind({
      onSaved(next) {
        settings = next;
        refreshTranslation();
        view.status(localized.strings.saved);
      },
      onPermissionDenied() {
        view.status(localized.strings.permissionDenied, true);
      }
    });

    authPanel = authPanelApi.create({
      document,
      window,
      browserApi,
      messages,
      send,
      getStrings: () => localized.strings
    });
    authPanel.bind();
    authPanel.render();

    const updateActions = updateActionsApi.create({
      document,
      messages,
      formatting,
      send,
      getStrings: () => localized.strings,
      status: view.status
    });
    updateActions.bind();

    document.getElementById("reset").addEventListener("click", async () => {
      settings = await form.reset();
      refreshTranslation();
      view.status(localized.strings.resetDone);
    });
    window.addEventListener("pagehide", () => {
      form.stop();
      authPanel.stop();
    });

    await authPanel.loadStatus(true);
  }

  init().catch(console.error);
})();
