(function initReleasePageParser(root, factory) {
  const api = factory();
  root.GHDNReleasePageParser = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createReleasePageParserApi() {
  "use strict";

  const DEFAULT_MAX_ASSETS = 500;
  const DEFAULT_MAX_TAGS = 20;

  function encodeGitHubPath(value) {
    return encodeURIComponent(String(value || ""));
  }

  function assetContentType(name) {
    const lower = String(name || "").toLowerCase();
    if (lower.endsWith(".apk")) return "application/vnd.android.package-archive";
    if (lower.endsWith(".zip")) return "application/zip";
    if (lower.endsWith(".json")) return "application/json";
    return "application/octet-stream";
  }

  function parseHumanSize(text) {
    const matches = [...String(text || "").matchAll(/(\d+(?:[.,]\d+)?)\s*(B|KB|KiB|MB|MiB|GB|GiB)\b/gi)];
    if (!matches.length) return 0;
    const match = matches[matches.length - 1];
    const amount = Number(String(match[1]).replace(",", ".")) || 0;
    const unit = match[2].toLowerCase();
    const factors = { b: 1, kb: 1000, kib: 1024, mb: 1000 ** 2, mib: 1024 ** 2, gb: 1000 ** 3, gib: 1024 ** 3 };
    return Math.round(amount * (factors[unit] || 1));
  }

  function stableAssetId(url, index) {
    let hash = 2166136261;
    const value = String(url || "");
    for (let offset = 0; offset < value.length; offset += 1) {
      hash ^= value.charCodeAt(offset);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash || Number(index || 0) + 1);
  }

  function releaseTagFromLink(link, repo, urlPolicy = globalThis.GHDNUrlPolicy) {
    if (!link || !repo || !urlPolicy) return "";
    const parsed = urlPolicy.releaseTag(link.getAttribute?.("href") || "", repo.owner, repo.repo);
    return parsed ? parsed.tag : "";
  }

  function releaseTagForSection(section, repo, options = {}) {
    if (!section) return "";
    const isVisible = options.isVisible || (() => true);
    const link = [...(section.querySelectorAll?.('a[href*="/releases/tag/"]') || [])]
      .find((candidate) => isVisible(candidate) && releaseTagFromLink(candidate, repo, options.urlPolicy));
    return link ? releaseTagFromLink(link, repo, options.urlPolicy) : "";
  }

  function releaseAssetsFromDocument(doc, repo, tag, options = {}) {
    const urlPolicy = options.urlPolicy || globalThis.GHDNUrlPolicy;
    const maxAssets = Number(options.maxAssets) || DEFAULT_MAX_ASSETS;
    if (!doc || !urlPolicy) return [];
    const assets = [];
    const seen = new Set();

    for (const link of doc.querySelectorAll?.('a[href*="/releases/download/"]') || []) {
      const parsed = urlPolicy.releaseAsset(link.getAttribute?.("href") || "", repo.owner, repo.repo, tag || "");
      if (!parsed || seen.has(parsed.href)) continue;
      seen.add(parsed.href);
      let container = link;
      for (let depth = 0; depth < 4 && container.parentElement; depth += 1) {
        container = container.parentElement;
        if (/\b(B|KB|KiB|MB|MiB|GB|GiB)\b/i.test(container.textContent || "")) break;
      }
      if (assets.length >= maxAssets) break;
      assets.push({
        id: stableAssetId(parsed.href, assets.length),
        name: parsed.name,
        size: parseHumanSize(container.textContent || ""),
        state: "uploaded",
        content_type: assetContentType(parsed.name),
        download_count: 0,
        browser_download_url: parsed.href,
        created_at: "",
        updated_at: ""
      });
    }
    return assets;
  }

  function releaseSectionByTag(doc, tag, repo, options = {}) {
    if (!doc || !tag) return null;
    return [...(doc.querySelectorAll?.('section[data-release-anchor], section[id^="release-"]') || [])]
      .find((section) => releaseTagForSection(section, repo, options) === tag) || null;
  }

  function releaseNameFromSection(section, tag) {
    if (!section) return tag;
    const heading = [...(section.querySelectorAll?.("h1, h2, h3") || [])]
      .find((element) => String(element.textContent || "").includes(tag));
    return String(heading?.textContent || tag).replace(/\s+/g, " ").trim() || tag;
  }

  function releaseDateFromSection(section) {
    const time = section?.querySelector?.("relative-time[datetime], time[datetime]");
    return time ? String(time.getAttribute?.("datetime") || "") : "";
  }

  function releaseFromPage(repo, tag, assets, section = null) {
    const encodedTag = encodeGitHubPath(tag);
    const publishedAt = releaseDateFromSection(section);
    return {
      id: stableAssetId(`${repo.key}:${tag}`, 0),
      tag_name: tag,
      name: releaseNameFromSection(section, tag),
      html_url: `https://github.com/${repo.owner}/${repo.repo}/releases/tag/${encodedTag}`,
      published_at: publishedAt,
      created_at: publishedAt,
      draft: false,
      prerelease: Boolean(section && /pre-release/i.test(section.textContent || "")),
      assets,
      zipball_url: `https://github.com/${repo.owner}/${repo.repo}/archive/refs/tags/${encodedTag}.zip`,
      tarball_url: `https://github.com/${repo.owner}/${repo.repo}/archive/refs/tags/${encodedTag}.tar.gz`
    };
  }

  function collectReleaseTags(doc, repo, options = {}) {
    const urlPolicy = options.urlPolicy || globalThis.GHDNUrlPolicy;
    const maxTags = Number(options.maxTags) || DEFAULT_MAX_TAGS;
    const tags = [];
    const seen = new Set();
    if (!doc || !urlPolicy) return tags;

    for (const link of doc.querySelectorAll?.('a[href*="/releases/tag/"]') || []) {
      const tag = releaseTagFromLink(link, repo, urlPolicy);
      if (!tag || seen.has(tag)) continue;
      seen.add(tag);
      tags.push(tag);
      if (tags.length >= maxTags) break;
    }
    return tags;
  }

  function latestReleaseTagFromDocument(doc, repo, options = {}) {
    const urlPolicy = options.urlPolicy || globalThis.GHDNUrlPolicy;
    const links = [...(doc?.querySelectorAll?.('a[href*="/releases/tag/"]') || [])]
      .filter((link) => releaseTagFromLink(link, repo, urlPolicy));
    const preferred = links.find((link) => {
      const context = String(link.closest?.("aside, section, div")?.textContent || "");
      return /latest|releases?/i.test(context);
    }) || links[0];
    return preferred ? releaseTagFromLink(preferred, repo, urlPolicy) : "";
  }

  return Object.freeze({
    DEFAULT_MAX_ASSETS,
    DEFAULT_MAX_TAGS,
    encodeGitHubPath,
    assetContentType,
    parseHumanSize,
    stableAssetId,
    releaseTagFromLink,
    releaseTagForSection,
    releaseAssetsFromDocument,
    releaseSectionByTag,
    releaseNameFromSection,
    releaseDateFromSection,
    releaseFromPage,
    collectReleaseTags,
    latestReleaseTagFromDocument
  });
});
