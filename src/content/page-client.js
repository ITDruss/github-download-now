(function initPageClient(root, factory) {
  const api = factory();
  root.GHDNPageClient = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPageClientApi() {
  "use strict";

  const DEFAULT_MAX_PAGE_CHARS = 8_000_000;

  function create(options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const Parser = options.DOMParserClass || globalThis.DOMParser;
    const urlPolicy = options.urlPolicy;
    const maxPageChars = Number.isFinite(options.maxPageChars)
      ? options.maxPageChars
      : DEFAULT_MAX_PAGE_CHARS;

    if (typeof fetchImpl !== "function") throw new Error("Page client requires fetch");
    if (typeof Parser !== "function") throw new Error("Page client requires DOMParser");
    if (!urlPolicy?.repositoryWebUrl) throw new Error("Page client requires URL policy");

    async function fetchDocument(path, repo) {
      const trusted = urlPolicy.repositoryWebUrl(path, repo?.owner, repo?.repo);
      if (!trusted) throw new Error("Untrusted GitHub page URL");

      const response = await fetchImpl(trusted.href, {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer"
      });
      const finalUrl = urlPolicy.repositoryWebUrl(
        response.url || trusted.href,
        repo?.owner,
        repo?.repo
      );
      if (!finalUrl) throw new Error("GitHub page redirected to an untrusted URL");
      if (!response.ok) throw new Error(`GitHub page request failed: ${response.status}`);

      const contentLength = Number(response.headers?.get?.("content-length"));
      if (Number.isFinite(contentLength) && contentLength > maxPageChars) {
        throw new Error("GitHub page response is too large");
      }

      const html = await response.text();
      if (html.length > maxPageChars) throw new Error("GitHub page response is too large");
      return new Parser().parseFromString(html, "text/html");
    }

    return Object.freeze({ fetchDocument });
  }

  return Object.freeze({ DEFAULT_MAX_PAGE_CHARS, create });
});
