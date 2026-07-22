(function initRepositoryContext(root, factory) {
  const api = factory();
  root.GHDNRepositoryContext = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createRepositoryContextApi() {
  "use strict";

  const RESERVED_ROOTS = Object.freeze(new Set([
    "about", "account", "apps", "codespaces", "collections", "contact", "customer-stories",
    "enterprise", "enterprises", "events", "explore", "features", "gist", "issues", "login",
    "marketplace", "new", "notifications", "orgs", "organizations", "pricing", "pulls", "search",
    "security", "settings", "site", "sponsors", "stars", "topics", "trending"
  ]));
  const VALID_REPOSITORY_PART = /^[A-Za-z0-9_.-]+$/;

  function testContext(testRepository) {
    if (!testRepository) return null;
    if (testRepository.public === false) return null;
    const owner = String(testRepository.owner || "test-owner");
    const repo = String(testRepository.repo || "test-repository");
    const parts = Array.isArray(testRepository.parts) && testRepository.parts.length >= 2
      ? testRepository.parts.map((part) => String(part))
      : [owner, repo];
    return { owner, repo, key: `${owner.toLowerCase()}/${repo.toLowerCase()}`, parts };
  }

  function visibilityFromDocument(documentObject) {
    const repositoryPublic = documentObject
      ?.querySelector?.('meta[name="octolytics-dimension-repository_public"]')
      ?.getAttribute?.("content")
      ?.trim()
      .toLowerCase();
    if (repositoryPublic === "true" || repositoryPublic === "false") return repositoryPublic;

    const labels = [...(documentObject?.querySelectorAll?.(
      '[data-testid="repository-visibility-label"], #repository-container-header .Label, #repository-container-header span'
    ) || [])]
      .map((element) => String(element.textContent || "").trim().toLowerCase())
      .filter((value) => value === "public" || value === "private");

    if (labels.includes("private")) return "false";
    if (labels.includes("public")) return "true";
    return "";
  }

  function parse(options = {}) {
    const testRepository = Object.prototype.hasOwnProperty.call(options, "testRepository")
      ? options.testRepository
      : globalThis.__GHDN_TEST_REPOSITORY__;
    if (testRepository) return testContext(testRepository);

    const locationObject = options.locationObject || globalThis.location;
    const documentObject = options.documentObject || globalThis.document;
    const parts = String(locationObject?.pathname || "").split("/").filter(Boolean);
    if (parts.length < 2 || RESERVED_ROOTS.has(parts[0].toLowerCase())) return null;

    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    if (!VALID_REPOSITORY_PART.test(owner) || !VALID_REPOSITORY_PART.test(repo)) return null;

    const repositoryNwo = documentObject
      ?.querySelector?.('meta[name="octolytics-dimension-repository_nwo"]')
      ?.getAttribute?.("content");
    const visibility = visibilityFromDocument(documentObject);

    // Fail closed: without a positive public marker the content script stays inactive.
    if (visibility !== "true") return null;
    if (repositoryNwo && repositoryNwo.toLowerCase() !== `${owner}/${repo}`.toLowerCase()) return null;
    if (!repositoryNwo && !documentObject?.querySelector?.("#repository-container-header")) return null;

    return { owner, repo, key: `${owner.toLowerCase()}/${repo.toLowerCase()}`, parts };
  }

  function shouldShow(repo, settings = {}) {
    if (!repo || !settings.enabled) return false;
    if (settings.showOn === "main") return repo.parts.length === 2;
    if (settings.showOn === "main_releases") {
      return repo.parts.length === 2 || String(repo.parts[2] || "").toLowerCase() === "releases";
    }
    return true;
  }

  function isReleasesRoute(repo) {
    return Boolean(repo && String(repo.parts[2] || "").toLowerCase() === "releases");
  }

  function isFlowEligibleRoute(repo) {
    return Boolean(repo && repo.parts.length === 2);
  }

  function decodeReleaseTag(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      return decodeURIComponent(raw);
    } catch (_error) {
      return raw;
    }
  }

  function releaseTagFromRoute(repo) {
    if (!isReleasesRoute(repo) || String(repo.parts[3] || "").toLowerCase() !== "tag") return "";
    return decodeReleaseTag(repo.parts.slice(4).join("/"));
  }

  return Object.freeze({
    RESERVED_ROOTS,
    VALID_REPOSITORY_PART,
    parse,
    shouldShow,
    isReleasesRoute,
    isFlowEligibleRoute,
    decodeReleaseTag,
    releaseTagFromRoute
  });
});
