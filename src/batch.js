"use strict";
(async () => {
  const browserApi = globalThis.GHDNBrowser;
  const settings = await globalThis.GHDNSettings.get();
  const strings = globalThis.GHDNBatchStrings.create(globalThis.GHDNI18n, settings.language, navigator.language);
  const batchAssets = globalThis.GHDNBatchAssets;
  const view = globalThis.GHDNBatchView.create({ documentObject: document, strings, batchAssets, formatting: globalThis.GHDNFormatting });
  const controller = globalThis.GHDNBatchController.create({ browserApi, messages: globalThis.GHDNMessages,
    view, batchAssets, urlPolicy: globalThis.GHDNUrlPolicy, strings, locationObject: location,
    navigatorObject: navigator, windowObject: window, settings, formatting: globalThis.GHDNFormatting });
  controller.start();
})();
