(function initBatchCatalog(root, factory) {
  const api = factory();
  root.GHDNBackgroundBatchCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBatchCatalogApi() {
  "use strict";
  function create({ githubClient, releaseService, urlPolicy, batchAssets }) {
    async function load(owner, repoName, requestedTag) {
      const repo = urlPolicy.repository(owner, repoName);
      const tag = githubClient.validGitRef(requestedTag);
      if (!repo || !tag) return { ok: false, error: "invalid_repository" };
      const base = `https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`;
      // Recheck public visibility in the privileged context; never rely on page-supplied assets.
      const visibility = await githubClient.fetchJson(base, { skipAuth: true });
      if (!visibility.ok) return visibility;
      if (visibility.data?.private !== false || visibility.data?.visibility !== "public") {
        return { ok: false, error: "public_only" };
      }
      const result = await githubClient.fetchJson(`${base}/releases/tags/${encodeURIComponent(tag)}`, { skipAuth: true });
      if (!result.ok) return result;
      const release = releaseService.sanitizeRelease(result.data, repo.owner, repo.repo);
      if (!release || release.tag_name !== tag || release.draft || !Number.isSafeInteger(release.id) || release.id <= 0) {
        return { ok: false, error: "invalid_response" };
      }
      const assets = [];
      const seen = new Set();
      // One extra page distinguishes exactly 500 files from a truncated list.
      for (let page = 1; page <= Math.floor(batchAssets.MAX_ASSETS / 100) + 1; page += 1) {
        const response = await githubClient.fetchJson(`${base}/releases/${release.id}/assets?per_page=100&page=${page}`, { skipAuth: true });
        if (!response.ok) return response;
        if (!Array.isArray(response.data) || response.data.length > 100) return { ok: false, error: "invalid_response" };
        if (page > batchAssets.MAX_ASSETS / 100 && response.data.length) return { ok: false, error: "asset_limit" };
        for (const raw of response.data) {
          const asset = releaseService.sanitizeAsset(raw, repo.owner, repo.repo, tag);
          if (asset && !seen.has(asset.browser_download_url)) {
            seen.add(asset.browser_download_url);
            assets.push(asset);
          }
        }
        if (response.data.length < 100) {
          return { ok: true, release: { ...release, assets }, complete: true };
        }
      }
      return { ok: false, error: "asset_limit" };
    }
    return Object.freeze({ load });
  }
  return Object.freeze({ create });
});
