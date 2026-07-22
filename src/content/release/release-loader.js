(function initReleaseLoader(root, factory) {
  const api = factory();
  root.GHDNReleaseLoader = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createReleaseLoaderApi() {
  "use strict";

  const DEFAULT_CACHE_ENTRIES = 40;
  const DEFAULT_TAG_CACHE_TTL_MS = 10 * 60 * 1000;

  function setLimitedCache(cache, key, value, limit) {
    if (cache.has(key)) cache.delete(key);
    cache.set(key, value);
    while (cache.size > limit) cache.delete(cache.keys().next().value);
  }

  function create(options = {}) {
    const documentObject = options.documentObject || globalThis.document;
    const pageParser = options.pageParser;
    const pageClient = options.pageClient;
    const selector = options.selector;
    const urlPolicy = options.urlPolicy;
    const githubDom = options.githubDom;
    const runtime = options.runtime;
    const messages = options.messages;
    const rootId = options.rootId || "ghdn-root";
    const getComputedStyleFn = options.getComputedStyleFn || globalThis.getComputedStyle;
    const now = options.now || Date.now;
    const maxCacheEntries = options.maxCacheEntries || DEFAULT_CACHE_ENTRIES;
    const tagCacheTtlMs = options.tagCacheTtlMs || DEFAULT_TAG_CACHE_TTL_MS;
    const pageReleaseCache = new Map();
    const releaseTagsCache = new Map();

    if (!pageParser || !pageClient || !selector || !urlPolicy || !githubDom) {
      throw new Error("Release loader dependencies are incomplete");
    }
    if (!runtime?.sendMessage || !messages?.TYPES) {
      throw new Error("Release loader requires runtime messaging contracts");
    }

    async function getReleaseTags(repo) {
      const cached = releaseTagsCache.get(repo.key);
      if (cached && now() - cached.timestamp < tagCacheTtlMs) return cached.tags;

      let tags = pageParser.collectReleaseTags(documentObject, repo, { urlPolicy });
      if (tags.length < 5) {
        try {
          const doc = await pageClient.fetchDocument(`/${repo.owner}/${repo.repo}/releases`, repo);
          tags = pageParser.collectReleaseTags(doc, repo, { urlPolicy });
        } catch (_error) {}
      }

      setLimitedCache(releaseTagsCache, repo.key, { timestamp: now(), tags }, maxCacheEntries);
      return tags;
    }

    async function loadFromPage(repo, requestedTag, platform) {
      let tag = String(requestedTag || "");
      if (!tag) tag = pageParser.latestReleaseTagFromDocument(documentObject, repo, { urlPolicy });
      if (!tag) {
        const tags = await getReleaseTags(repo);
        tag = tags[0] || "";
      }
      if (!tag) throw new Error("Release tag not found in GitHub page");

      const key = `${repo.key}:${tag}`;
      let release = pageReleaseCache.get(key);
      if (!release) {
        const section = pageParser.releaseSectionByTag(documentObject, tag, repo, {
          urlPolicy,
          isVisible: (element) => githubDom.isVisibleElement(element, {
            rootId,
            getComputedStyle: getComputedStyleFn
          })
        });
        let assets = pageParser.releaseAssetsFromDocument(section || documentObject, repo, tag, { urlPolicy });
        if (!assets.length) {
          const encodedTag = pageParser.encodeGitHubPath(tag);
          const path = `/${repo.owner}/${repo.repo}/releases/expanded_assets/${encodedTag}`;
          const doc = await pageClient.fetchDocument(path, repo);
          assets = pageParser.releaseAssetsFromDocument(doc, repo, tag, { urlPolicy });
        }
        release = pageParser.releaseFromPage(repo, tag, assets, section);
        setLimitedCache(pageReleaseCache, key, release, maxCacheEntries);
      }

      const selection = selector.recommendation(release.assets, platform || {});
      return {
        ok: true,
        release,
        rankedAssets: selection.ranked,
        recommendation: {
          best: selection.best,
          confidence: selection.confidence,
          gap: Number.isFinite(selection.gap) ? selection.gap : null
        },
        fromPage: true
      };
    }

    async function load(options = {}) {
      const repo = options.repo;
      const requestedTag = String(options.requestedTag || "");
      const platform = options.platform || {};
      try {
        return await loadFromPage(repo, requestedTag, platform);
      } catch (_pageError) {
        return runtime.sendMessage(requestedTag ? {
          type: messages.TYPES.GET_RELEASE_BY_TAG,
          owner: repo.owner,
          repo: repo.repo,
          tag: requestedTag,
          platform
        } : {
          type: messages.TYPES.GET_LATEST_RELEASE,
          owner: repo.owner,
          repo: repo.repo,
          platform,
          releaseChannel: options.releaseChannel
        });
      }
    }

    function clearCaches() {
      pageReleaseCache.clear();
      releaseTagsCache.clear();
    }

    return Object.freeze({ getReleaseTags, loadFromPage, load, clearCaches });
  }

  return Object.freeze({
    DEFAULT_CACHE_ENTRIES,
    DEFAULT_TAG_CACHE_TTL_MS,
    create
  });
});
