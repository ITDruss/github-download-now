(function initBackgroundReleaseService(root, factory) {
  const api = factory();
  root.GHDNBackgroundReleaseService = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBackgroundReleaseServiceApi() {
  "use strict";

  const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
  const DEFAULT_MAX_CACHE_ENTRIES = 50;
  const DEFAULT_MAX_RELEASE_ASSETS = 500;
  const VALID_REPOSITORY_PART = /^[A-Za-z0-9_.-]{1,100}$/;

  function setLimitedCache(cache, key, value, limit) {
    if (cache.has(key)) cache.delete(key);
    cache.set(key, value);
    while (cache.size > limit) cache.delete(cache.keys().next().value);
  }

  function create(options = {}) {
    const githubClient = options.githubClient;
    const urlPolicy = options.urlPolicy;
    const selector = options.selector;
    const cacheTtlMs = options.cacheTtlMs || DEFAULT_CACHE_TTL_MS;
    const maxCacheEntries = options.maxCacheEntries || DEFAULT_MAX_CACHE_ENTRIES;
    const maxReleaseAssets = options.maxReleaseAssets || DEFAULT_MAX_RELEASE_ASSETS;
    const now = options.now || Date.now;
    const releaseCache = new Map();

    if (!githubClient || !urlPolicy || !selector) {
      throw new Error("Release service dependencies are incomplete");
    }

    function sanitizeAsset(asset, owner, repo, expectedTag) {
      if (!asset || typeof asset !== "object") return null;
      if (asset.state && asset.state !== "uploaded") return null;
      const trusted = urlPolicy.releaseAsset(asset.browser_download_url, owner, repo, expectedTag);
      if (!trusted) return null;
      return {
        id: Number(asset.id) || null,
        name: trusted.name.slice(0, 300),
        size: Math.max(0, Number(asset.size) || 0),
        state: "uploaded",
        content_type: String(asset.content_type || "application/octet-stream").slice(0, 200),
        download_count: Math.max(0, Number(asset.download_count) || 0),
        browser_download_url: trusted.href,
        created_at: String(asset.created_at || "").slice(0, 80),
        updated_at: String(asset.updated_at || "").slice(0, 80)
      };
    }

    function sanitizeRelease(release, owner, repo) {
      if (!release || typeof release !== "object") return null;
      const tag = githubClient.validGitRef(release.tag_name);
      if (tag === null || !tag) return null;
      const encodedOwner = encodeURIComponent(owner);
      const encodedRepo = encodeURIComponent(repo);
      const encodedTag = encodeURIComponent(tag);
      const releaseUrl = urlPolicy.releaseTag(release.html_url, owner, repo);
      const trustedReleaseUrl = releaseUrl && releaseUrl.tag === tag
        ? releaseUrl.href
        : `https://github.com/${encodedOwner}/${encodedRepo}/releases/tag/${encodedTag}`;
      const zipUrl = urlPolicy.apiArchive(release.zipball_url, owner, repo);
      const tarUrl = urlPolicy.apiArchive(release.tarball_url, owner, repo);
      return {
        id: Number(release.id) || null,
        tag_name: tag,
        name: String(release.name || tag).slice(0, 300),
        html_url: trustedReleaseUrl,
        published_at: String(release.published_at || "").slice(0, 80),
        created_at: String(release.created_at || "").slice(0, 80),
        draft: Boolean(release.draft),
        prerelease: Boolean(release.prerelease),
        assets: Array.isArray(release.assets)
          ? release.assets.slice(0, maxReleaseAssets).map((asset) => sanitizeAsset(asset, owner, repo, tag)).filter(Boolean)
          : [],
        zipball_url: zipUrl ? zipUrl.href : `https://api.github.com/repos/${encodedOwner}/${encodedRepo}/zipball/${encodedTag}`,
        tarball_url: tarUrl ? tarUrl.href : `https://api.github.com/repos/${encodedOwner}/${encodedRepo}/tarball/${encodedTag}`
      };
    }

    function buildResponse(release, platform, fromCache, etag = "", rateLimit = null) {
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
        fromCache,
        etag,
        rateLimit
      };
    }

    async function getRelease(owner, repo, platform, releaseChannel, requestOptions = {}) {
      if (!VALID_REPOSITORY_PART.test(owner) || !VALID_REPOSITORY_PART.test(repo)) {
        return { ok: false, error: "invalid_repository" };
      }

      const channel = releaseChannel === "newest" ? "newest" : "stable";
      const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}:${channel}`;
      const cached = releaseCache.get(cacheKey);
      if (!requestOptions.force && cached && now() - cached.timestamp < cacheTtlMs) {
        return buildResponse(cached.release, platform, true, cached.etag, null);
      }

      const encoded = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
      const url = channel === "newest"
        ? `https://api.github.com/repos/${encoded}/releases?per_page=20`
        : `https://api.github.com/repos/${encoded}/releases/latest`;
      const result = await githubClient.fetchJson(url, { etag: requestOptions.etag });
      if (!result.ok || result.notModified) return result;

      let release;
      if (channel === "newest") {
        const candidates = Array.isArray(result.data) ? result.data.filter((item) => item && !item.draft) : [];
        if (!candidates.length) return { ok: false, error: "no_release", status: 404 };
        release = sanitizeRelease(candidates[0], owner, repo);
      } else {
        release = sanitizeRelease(result.data, owner, repo);
      }
      if (!release) return { ok: false, error: "invalid_response", status: 502, rateLimit: result.rateLimit || null };

      setLimitedCache(releaseCache, cacheKey, { timestamp: now(), release, etag: result.etag || "" }, maxCacheEntries);
      return buildResponse(release, platform, false, result.etag || "", result.rateLimit);
    }

    async function getReleaseByTag(owner, repo, requestedTag, platform, requestOptions = {}) {
      if (!VALID_REPOSITORY_PART.test(owner) || !VALID_REPOSITORY_PART.test(repo)) {
        return { ok: false, error: "invalid_repository" };
      }

      const tag = githubClient.validGitRef(requestedTag);
      if (tag === null || !tag) return { ok: false, error: "invalid_ref" };

      const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}:tag:${tag}`;
      const cached = releaseCache.get(cacheKey);
      if (!requestOptions.force && cached && now() - cached.timestamp < cacheTtlMs) {
        return buildResponse(cached.release, platform, true, cached.etag, null);
      }

      const encoded = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
      const url = `https://api.github.com/repos/${encoded}/releases/tags/${encodeURIComponent(tag)}`;
      const result = await githubClient.fetchJson(url, { etag: requestOptions.etag });
      if (!result.ok || result.notModified) return result;

      const release = sanitizeRelease(result.data, owner, repo);
      if (!release) return { ok: false, error: "invalid_response", status: 502, rateLimit: result.rateLimit || null };
      setLimitedCache(releaseCache, cacheKey, { timestamp: now(), release, etag: result.etag || "" }, maxCacheEntries);
      return buildResponse(release, platform, false, result.etag || "", result.rateLimit);
    }

    function clearCache() {
      releaseCache.clear();
    }

    return Object.freeze({
      sanitizeAsset,
      sanitizeRelease,
      buildResponse,
      getRelease,
      getReleaseByTag,
      clearCache
    });
  }

  return Object.freeze({
    DEFAULT_CACHE_TTL_MS,
    DEFAULT_MAX_CACHE_ENTRIES,
    DEFAULT_MAX_RELEASE_ASSETS,
    VALID_REPOSITORY_PART,
    create
  });
});
