(function initUrlPolicy(root, factory) {
  const api = factory();
  root.GHDNUrlPolicy = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createUrlPolicy() {
  "use strict";

  const GITHUB_ORIGIN = "https://github.com";
  const GITHUB_API_ORIGIN = "https://api.github.com";
  const VALID_PART = /^[A-Za-z0-9_.-]{1,100}$/;

  function repository(owner, repo) {
    const cleanOwner = String(owner || "").trim();
    const cleanRepo = String(repo || "").trim().replace(/\.git$/i, "");
    if (!VALID_PART.test(cleanOwner) || !VALID_PART.test(cleanRepo)) return null;
    return {
      owner: cleanOwner,
      repo: cleanRepo,
      key: `${cleanOwner.toLowerCase()}/${cleanRepo.toLowerCase()}`
    };
  }

  function parse(value, base = GITHUB_ORIGIN) {
    try {
      const url = new URL(String(value || ""), base);
      if (url.protocol !== "https:") return null;
      if (url.username || url.password) return null;
      return url;
    } catch (_error) {
      return null;
    }
  }

  function pathParts(url) {
    return String(url && url.pathname || "")
      .split("/")
      .filter(Boolean)
      .map((part) => {
        try { return decodeURIComponent(part); } catch (_error) { return part; }
      });
  }

  function hasNoQueryOrFragment(url) {
    return Boolean(url && !url.search && !url.hash);
  }

  function sameRepository(parts, repoInfo) {
    return Boolean(
      repoInfo &&
      parts.length >= 2 &&
      parts[0].toLowerCase() === repoInfo.owner.toLowerCase() &&
      parts[1].toLowerCase() === repoInfo.repo.toLowerCase()
    );
  }

  function releaseAsset(value, owner, repo, expectedTag = "") {
    const repoInfo = repository(owner, repo);
    const url = parse(value);
    if (!repoInfo || !url || url.origin !== GITHUB_ORIGIN || !hasNoQueryOrFragment(url)) return null;
    const parts = pathParts(url);
    if (!sameRepository(parts, repoInfo)) return null;
    if (parts[2] !== "releases" || parts[3] !== "download" || parts.length !== 6) return null;
    const tag = parts[4];
    const name = parts[5];
    if (!tag || !name || /[\/\\\u0000]/.test(name)) return null;
    if (expectedTag && tag !== String(expectedTag)) return null;
    return { url, href: url.href, tag, name, repository: repoInfo };
  }

  function releaseTag(value, owner, repo) {
    const repoInfo = repository(owner, repo);
    const url = parse(value);
    if (!repoInfo || !url || url.origin !== GITHUB_ORIGIN || !hasNoQueryOrFragment(url)) return null;
    const parts = pathParts(url);
    if (!sameRepository(parts, repoInfo)) return null;
    if (parts[2] !== "releases" || parts[3] !== "tag" || parts.length !== 5) return null;
    const tag = parts[4];
    return tag ? { url, href: url.href, tag, repository: repoInfo } : null;
  }

  function webArchive(value, owner, repo) {
    const repoInfo = repository(owner, repo);
    const url = parse(value);
    if (!repoInfo || !url || url.origin !== GITHUB_ORIGIN || !hasNoQueryOrFragment(url)) return null;
    const parts = pathParts(url);
    if (!sameRepository(parts, repoInfo)) return null;
    if (parts[2] !== "archive" || parts[3] !== "refs" || parts[4] !== "tags" || parts.length < 6) return null;
    if (!/\.(?:zip|tar\.gz)$/i.test(parts[parts.length - 1])) return null;
    return { url, href: url.href, repository: repoInfo };
  }

  function apiArchive(value, owner, repo) {
    const repoInfo = repository(owner, repo);
    const url = parse(value, GITHUB_API_ORIGIN);
    if (!repoInfo || !url || url.origin !== GITHUB_API_ORIGIN || !hasNoQueryOrFragment(url)) return null;
    const parts = pathParts(url);
    if (parts[0] !== "repos" || parts.length !== 5 || !parts[4]) return null;
    if (parts[1].toLowerCase() !== repoInfo.owner.toLowerCase() || parts[2].toLowerCase() !== repoInfo.repo.toLowerCase()) return null;
    if (!new Set(["zipball", "tarball"]).has(parts[3])) return null;
    return { url, href: url.href, repository: repoInfo };
  }

  function download(value, owner, repo) {
    return releaseAsset(value, owner, repo) || webArchive(value, owner, repo) || apiArchive(value, owner, repo);
  }

  function repositoryWebUrl(value, owner = "", repo = "") {
    const url = parse(value);
    if (!url || url.origin !== GITHUB_ORIGIN) return null;
    if (!owner && !repo) return { url, href: url.href };
    const repoInfo = repository(owner, repo);
    const parts = pathParts(url);
    return repoInfo && sameRepository(parts, repoInfo) ? { url, href: url.href, repository: repoInfo } : null;
  }

  function apiUrl(value) {
    const url = parse(value, GITHUB_API_ORIGIN);
    return url && url.origin === GITHUB_API_ORIGIN ? { url, href: url.href } : null;
  }

  return {
    GITHUB_ORIGIN,
    GITHUB_API_ORIGIN,
    VALID_PART,
    repository,
    parse,
    releaseAsset,
    releaseTag,
    webArchive,
    apiArchive,
    download,
    repositoryWebUrl,
    apiUrl
  };
});
