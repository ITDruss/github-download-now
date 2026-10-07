(function initBackgroundNavigation(root, factory) {
  const api = factory();
  root.GHDNBackgroundNavigation = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBackgroundNavigationApi() {
  "use strict";

  function create(options = {}) {
    const browserApi = options.browserApi;
    const extensionApi = options.extensionApi;
    const urlPolicy = options.urlPolicy;
    if (!browserApi || !extensionApi || !urlPolicy) throw new Error("Navigation dependencies are incomplete");

    async function openOptionsPage() {
      try {
        await browserApi.runtime.openOptionsPage();
        return { ok: true };
      } catch (_error) {}
      const url = extensionApi.runtime.getURL("options.html");
      try {
        await browserApi.tabs.create(url);
        return { ok: true, fallback: true };
      } catch (_error) {
        return { ok: false, error: "options_unavailable" };
      }
    }

    async function openTab(value) {
      const trusted = urlPolicy.repositoryWebUrl(value);
      if (!trusted) return { ok: false, error: "untrusted_url" };
      await browserApi.tabs.create(trusted.href);
      return { ok: true };
    }

    async function openExtensionPage(path) {
      const url = extensionApi.runtime.getURL(String(path || ""));
      await browserApi.tabs.create(url);
      return { ok: true };
    }

    async function openBatchPage(owner, repoName, tag, sender) {
      const repo = urlPolicy.repository(owner, repoName);
      if (!repo || typeof tag !== "string" || !tag || tag.length > 240) return { ok: false, error: "invalid_repository" };
      if (sender?.tab?.incognito || extensionApi.extension?.inIncognitoContext) return { ok: false, error: "incognito_unsupported" };
      const params = new URLSearchParams({ owner: repo.owner, repo: repo.repo, tag });
      return openExtensionPage(`batch.html?${params}`);
    }

    return Object.freeze({ openOptionsPage, openTab, openExtensionPage, openBatchPage });
  }

  return Object.freeze({ create });
});
