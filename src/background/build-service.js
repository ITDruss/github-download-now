(function initBackgroundBuildService(root, factory) {
  const api = factory();
  root.GHDNBackgroundBuildService = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBackgroundBuildServiceApi() {
  "use strict";

  const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
  const DEFAULT_MAX_CACHE_ENTRIES = 50;
  const GUIDED_LINK_LIMIT = 3;
  const GUIDED_DIRECTORY_LIMIT = 2;
  const GUIDED_DOCUMENT_LIMIT = 3;
  const RATE_LIMIT_RESERVE = 10;
  const VALID_REPOSITORY_PART = /^[A-Za-z0-9_.-]{1,100}$/;

  function setLimitedCache(cache, key, value, limit) {
    if (cache.has(key)) cache.delete(key);
    cache.set(key, value);
    while (cache.size > limit) cache.delete(cache.keys().next().value);
  }

  function contentsUrl(owner, repo, path = "", ref = "") {
    const encodedRepository = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const encodedPath = String(path || "")
      .split("/")
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join("/");
    const suffix = encodedPath ? `/contents/${encodedPath}` : "/contents";
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    return `https://api.github.com/repos/${encodedRepository}${suffix}${query}`;
  }

  function repositoryDocumentUrl(owner, repo, ref, path, type = "file") {
    const encodedPath = String(path || "")
      .split("/")
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join("/");
    if (!encodedPath) return "";
    const mode = type === "dir" ? "tree" : "blob";
    const encodedRef = encodeURIComponent(ref || "HEAD");
    return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${mode}/${encodedRef}/${encodedPath}`;
  }

  function discoveryReserveReached(rateLimit, reserve = RATE_LIMIT_RESERVE) {
    return Boolean(
      rateLimit &&
      Number.isFinite(rateLimit.remaining) &&
      rateLimit.remaining <= reserve
    );
  }

  function create(options = {}) {
    const githubClient = options.githubClient;
    const urlPolicy = options.urlPolicy;
    const buildInstructions = options.buildInstructions;
    const cacheTtlMs = options.cacheTtlMs || DEFAULT_CACHE_TTL_MS;
    const maxCacheEntries = options.maxCacheEntries || DEFAULT_MAX_CACHE_ENTRIES;
    const now = options.now || Date.now;
    const cache = new Map();

    if (!githubClient || !urlPolicy || !buildInstructions) {
      throw new Error("Build service dependencies are incomplete");
    }

    function sanitizeContentEntry(entry, owner, repo) {
      if (!entry || typeof entry !== "object") return null;
      const type = entry.type === "dir" ? "dir" : entry.type === "file" ? "file" : "";
      const path = String(entry.path || entry.name || "").replace(/^\/+|\/+$/g, "");
      const pathParts = path.split("/");
      if (
        !type ||
        !path ||
        path.length > 500 ||
        path.includes("\0") ||
        path.includes("\\") ||
        pathParts.some((part) => !part || part === "." || part === "..")
      ) return null;
      const htmlUrl = urlPolicy.repositoryWebUrl(entry.html_url, owner, repo);
      return {
        type,
        name: String(entry.name || path.split("/").pop() || "").slice(0, 240),
        path,
        html_url: htmlUrl ? htmlUrl.href : ""
      };
    }

    async function getContentDirectory(owner, repo, path, ref) {
      const result = await githubClient.fetchJson(contentsUrl(owner, repo, path, ref));
      if (!result.ok) return result;
      const entries = Array.isArray(result.data)
        ? result.data.map((entry) => sanitizeContentEntry(entry, owner, repo)).filter(Boolean)
        : [];
      return { ok: true, entries, rateLimit: result.rateLimit || null };
    }

    async function getBuildInstructions(owner, repo, requestedRef = "", platformInput = {}) {
      if (!VALID_REPOSITORY_PART.test(owner) || !VALID_REPOSITORY_PART.test(repo)) {
        return { ok: false, error: "invalid_repository" };
      }

      const ref = githubClient.validGitRef(requestedRef);
      if (ref === null) return { ok: false, error: "invalid_ref" };
      const platform = String(platformInput && platformInput.os || "unknown").toLowerCase();
      const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}:${ref || "default"}:${platform}`;
      const cached = cache.get(cacheKey);
      if (cached && now() - cached.timestamp < cacheTtlMs) return { ...cached.value, fromCache: true };

      let refUsed = ref;
      let rootResult = await getContentDirectory(owner, repo, "", refUsed);
      let usedDefaultBranchFallback = false;
      if (!rootResult.ok && rootResult.status === 404 && refUsed) {
        refUsed = "";
        usedDefaultBranchFallback = true;
        rootResult = await getContentDirectory(owner, repo, "", "");
      }
      if (!rootResult.ok) return rootResult;

      let lastRateLimit = rootResult.rateLimit || null;
      const entries = [...rootResult.entries];
      const checked = [];
      const docsDirectories = rootResult.entries.filter((entry) => entry.type === "dir" && /^(docs?|documentation)$/i.test(entry.name));
      for (const directory of docsDirectories.slice(0, 2)) {
        if (discoveryReserveReached(lastRateLimit)) break;
        const docsResult = await getContentDirectory(owner, repo, directory.path, refUsed);
        if (!docsResult.ok) {
          if (docsResult.error === "rate_limited") break;
          continue;
        }
        lastRateLimit = docsResult.rateLimit || lastRateLimit;
        entries.push(...docsResult.entries);
      }

      const candidates = buildInstructions.chooseCandidates(entries, 10);
      const discovered = [];
      const guidedLinks = [];
      const seenGuided = new Set();

      function addGuided(items) {
        for (const item of items) {
          const key = `${item.type}:${String(item.path).toLowerCase()}`;
          if (seenGuided.has(key)) continue;
          seenGuided.add(key);
          guidedLinks.push(item);
        }
      }

      function addFileDocument(candidate, trusted, scoreAdjustment = 0) {
        discovered.push({
          type: "file",
          path: candidate.path,
          title: candidate.path,
          htmlUrl: trusted.href,
          score: candidate.score + scoreAdjustment
        });
      }

      for (const candidate of candidates) {
        const trusted = urlPolicy.repositoryWebUrl(candidate.html_url, owner, repo);
        if (!trusted) continue;
        checked.push(candidate.path);
        if (!buildInstructions.isReadme(candidate.path)) {
          addFileDocument(candidate, trusted);
          continue;
        }

        if (discoveryReserveReached(lastRateLimit)) {
          addFileDocument(candidate, trusted, -12);
          continue;
        }
        const raw = await githubClient.fetchText(contentsUrl(owner, repo, candidate.path, refUsed));
        if (raw.ok) {
          lastRateLimit = raw.rateLimit || lastRateLimit;
          const sections = buildInstructions.chooseReadmeSections(raw.text, platform, 5);
          for (const section of sections) {
            discovered.push({
              type: "section",
              path: candidate.path,
              title: section.context || section.title,
              htmlUrl: `${trusted.href}#${section.anchor}`,
              score: section.score + Math.min(20, candidate.score / 5)
            });
          }
          if (candidate.path.split("/").length <= 2) {
            addGuided(buildInstructions.chooseGuidedLinks(
              raw.text,
              candidate.path,
              owner,
              repo,
              GUIDED_LINK_LIMIT
            ));
          }
        }
        addFileDocument(candidate, trusted, -12);
      }

      let guidedDirectories = 0;
      let guidedDocuments = 0;
      for (const link of guidedLinks.slice(0, GUIDED_LINK_LIMIT)) {
        if (guidedDocuments >= GUIDED_DOCUMENT_LIMIT || discoveryReserveReached(lastRateLimit)) break;
        let linkedCandidates = [];

        if (link.type === "dir") {
          if (guidedDirectories >= GUIDED_DIRECTORY_LIMIT) continue;
          guidedDirectories += 1;
          const directoryResult = await getContentDirectory(owner, repo, link.path, refUsed);
          if (!directoryResult.ok) {
            if (directoryResult.error === "rate_limited") break;
            continue;
          }
          lastRateLimit = directoryResult.rateLimit || lastRateLimit;
          linkedCandidates = buildInstructions.chooseCandidates(directoryResult.entries, 4);
        } else {
          linkedCandidates = [{
            type: "file",
            name: link.path.split("/").pop(),
            path: link.path,
            html_url: repositoryDocumentUrl(owner, repo, refUsed, link.path),
            score: link.score
          }];
        }

        for (const candidate of linkedCandidates) {
          if (guidedDocuments >= GUIDED_DOCUMENT_LIMIT || discoveryReserveReached(lastRateLimit)) break;
          if (checked.some((path) => path.toLowerCase() === candidate.path.toLowerCase())) continue;
          const htmlUrl = candidate.html_url || repositoryDocumentUrl(owner, repo, refUsed, candidate.path);
          const trusted = urlPolicy.repositoryWebUrl(htmlUrl, owner, repo);
          if (!trusted) continue;
          checked.push(candidate.path);
          guidedDocuments += 1;

          const raw = await githubClient.fetchText(contentsUrl(owner, repo, candidate.path, refUsed));
          if (raw.ok) {
            lastRateLimit = raw.rateLimit || lastRateLimit;
            const sections = buildInstructions.chooseReadmeSections(raw.text, platform, 5);
            for (const section of sections) {
              discovered.push({
                type: "section",
                path: candidate.path,
                title: section.context || section.title,
                htmlUrl: `${trusted.href}#${section.anchor}`,
                score: section.score + Math.min(28, (Number(link.score) || 0) / 6)
              });
            }
          }
          discovered.push({
            type: "file",
            path: candidate.path,
            title: `${link.label || candidate.path} — ${candidate.path}`,
            htmlUrl: trusted.href,
            score: (Number(candidate.score) || Number(link.score) || 70) - 10
          });
        }
      }

      const documents = buildInstructions.rankDocuments(discovered, 6)
        .map(({ type, path, title, htmlUrl }) => ({ type, path, title, htmlUrl }));
      const repositoryUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
      const value = {
        ok: true,
        found: documents.length > 0,
        documents,
        recommended: documents[0] || null,
        repositoryUrl,
        platform,
        refRequested: ref,
        refUsed: refUsed || "default",
        usedDefaultBranchFallback,
        guidedDiscovery: {
          followed: guidedLinks.slice(0, GUIDED_LINK_LIMIT).map(({ path, type, label }) => ({ path, type, label })),
          directoriesChecked: guidedDirectories,
          documentsChecked: guidedDocuments
        },
        rateLimit: lastRateLimit,
        checked
      };
      setLimitedCache(cache, cacheKey, { timestamp: now(), value }, maxCacheEntries);
      return value;
    }

    function clearCache() {
      cache.clear();
    }

    return Object.freeze({
      sanitizeContentEntry,
      getContentDirectory,
      getBuildInstructions,
      clearCache
    });
  }

  return Object.freeze({
    DEFAULT_CACHE_TTL_MS,
    DEFAULT_MAX_CACHE_ENTRIES,
    GUIDED_LINK_LIMIT,
    GUIDED_DIRECTORY_LIMIT,
    GUIDED_DOCUMENT_LIMIT,
    RATE_LIMIT_RESERVE,
    VALID_REPOSITORY_PART,
    contentsUrl,
    repositoryDocumentUrl,
    discoveryReserveReached,
    create
  });
});
