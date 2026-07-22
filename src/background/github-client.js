(function initBackgroundGitHubClient(root, factory) {
  const api = factory();
  root.GHDNBackgroundGitHubClient = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBackgroundGitHubClientApi() {
  "use strict";

  const DEFAULT_MAX_JSON_CHARS = 8_000_000;
  const DEFAULT_MAX_TEXT_CHARS = 2_000_000;
  const VALID_REF_CONTROL = /[\u0000-\u001f\u007f]/;

  function numericHeader(response, name) {
    const raw = response.headers.get(name);
    if (raw === null || raw === "") return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function rateLimitDetails(response) {
    const limit = numericHeader(response, "x-ratelimit-limit");
    const remaining = numericHeader(response, "x-ratelimit-remaining");
    const used = numericHeader(response, "x-ratelimit-used");
    const resetRaw = numericHeader(response, "x-ratelimit-reset");
    const resetAt = Number.isFinite(resetRaw) && resetRaw > 0
      ? new Date(resetRaw * 1000).toISOString()
      : null;
    return { limit, remaining, used, resetAt };
  }

  function validGitRef(value) {
    const ref = String(value || "").trim();
    if (!ref) return "";
    if (ref.length > 240 || VALID_REF_CONTROL.test(ref)) return null;
    return ref;
  }

  function create(options = {}) {
    const storage = options.storage;
    const urlPolicy = options.urlPolicy;
    const githubAuth = options.githubAuth;
    const fetchFn = options.fetchFn || globalThis.fetch;
    const maxJsonChars = options.maxJsonChars || DEFAULT_MAX_JSON_CHARS;
    const maxTextChars = options.maxTextChars || DEFAULT_MAX_TEXT_CHARS;
    let githubAuthCache;

    if (!storage || !urlPolicy || typeof fetchFn !== "function") {
      throw new Error("GitHub client dependencies are incomplete");
    }

    async function getStoredGitHubAuth() {
      if (!githubAuth) return null;
      if (githubAuthCache !== undefined) return githubAuthCache;
      const stored = await storage.localGet({ [githubAuth.STORAGE_KEY]: null });
      githubAuthCache = githubAuth.normalizeStoredAuth(stored[githubAuth.STORAGE_KEY]);
      return githubAuthCache;
    }

    async function clearStoredGitHubAuth() {
      githubAuthCache = null;
      if (!githubAuth) return;
      await storage.localRemove([githubAuth.STORAGE_KEY]);
    }

    async function saveStoredGitHubAuth(value) {
      const clean = githubAuth && githubAuth.normalizeStoredAuth(value);
      if (!clean) throw new Error("Invalid GitHub authorization state");
      githubAuthCache = clean;
      await storage.localSet({ [githubAuth.STORAGE_KEY]: clean });
      return clean;
    }

    function invalidateAuthCache() {
      githubAuthCache = undefined;
    }

    function setAuthCache(value) {
      githubAuthCache = value;
    }

    async function githubApiHeaders(headerOptions = {}) {
      const headers = {
        Accept: headerOptions.accept || "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      };
      const auth = headerOptions.token
        ? { token: String(headerOptions.token) }
        : headerOptions.skipAuth ? null : await getStoredGitHubAuth();
      if (auth && githubAuth && githubAuth.TOKEN_PATTERN.test(auth.token)) {
        headers.Authorization = `Bearer ${auth.token}`;
      }
      if (headerOptions.etag) headers["If-None-Match"] = headerOptions.etag;
      return headers;
    }

    async function fetchJson(url, requestOptions = {}) {
      const trusted = urlPolicy.apiUrl(url);
      if (!trusted) return { ok: false, error: "untrusted_url" };
      const headers = await githubApiHeaders(requestOptions);
      const usedStoredAuth = Boolean(headers.Authorization && !requestOptions.token && !requestOptions.skipAuth);

      const response = await fetchFn(trusted.href, {
        method: "GET",
        headers,
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer"
      });
      if (!urlPolicy.apiUrl(response.url || trusted.href)) return { ok: false, error: "untrusted_redirect" };
      const rateLimit = rateLimitDetails(response);
      if (response.status === 304) {
        return {
          ok: true,
          notModified: true,
          etag: requestOptions.etag || response.headers.get("etag") || "",
          rateLimit
        };
      }

      if (response.status === 401 && usedStoredAuth) {
        await clearStoredGitHubAuth();
        if (requestOptions.allowAnonymousFallback !== false) {
          return fetchJson(trusted.href, { ...requestOptions, skipAuth: true, etag: "" });
        }
      }

      if (!response.ok) {
        if (response.status === 401) return { ok: false, error: "invalid_token", status: 401, rateLimit };
        if (response.status === 404) return { ok: false, error: "no_release", status: 404, rateLimit };
        if ((response.status === 403 || response.status === 429) && (rateLimit.remaining === 0 || response.status === 429)) {
          return { ok: false, error: "rate_limited", status: response.status, resetAt: rateLimit.resetAt, rateLimit };
        }
        return { ok: false, error: "github_api_error", status: response.status, rateLimit };
      }

      const contentLength = numericHeader(response, "content-length");
      if (contentLength !== null && contentLength > maxJsonChars) {
        return { ok: false, error: "response_too_large", status: 413, rateLimit };
      }
      const text = await response.text();
      if (text.length > maxJsonChars) {
        return { ok: false, error: "response_too_large", status: 413, rateLimit };
      }
      try {
        return {
          ok: true,
          data: JSON.parse(text),
          etag: response.headers.get("etag") || "",
          rateLimit
        };
      } catch (_error) {
        return { ok: false, error: "invalid_response", status: 502, rateLimit };
      }
    }

    async function fetchText(url, requestOptions = {}) {
      const trusted = urlPolicy.apiUrl(url);
      if (!trusted) return { ok: false, error: "untrusted_url" };
      const headers = await githubApiHeaders({ ...requestOptions, accept: "application/vnd.github.raw+json" });
      const usedStoredAuth = Boolean(headers.Authorization && !requestOptions.token && !requestOptions.skipAuth);
      const response = await fetchFn(trusted.href, {
        method: "GET",
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        headers
      });
      if (!urlPolicy.apiUrl(response.url || trusted.href)) return { ok: false, error: "untrusted_redirect" };
      const rateLimit = rateLimitDetails(response);

      if (response.status === 401 && usedStoredAuth) {
        await clearStoredGitHubAuth();
        return fetchText(trusted.href, { ...requestOptions, skipAuth: true });
      }
      if (!response.ok) {
        if (response.status === 401) return { ok: false, error: "invalid_token", status: 401, rateLimit };
        if (response.status === 404) return { ok: false, error: "not_found", status: 404, rateLimit };
        if ((response.status === 403 || response.status === 429) && (rateLimit.remaining === 0 || response.status === 429)) {
          return { ok: false, error: "rate_limited", status: response.status, resetAt: rateLimit.resetAt, rateLimit };
        }
        return { ok: false, error: "github_api_error", status: response.status, rateLimit };
      }

      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > maxTextChars) {
        return { ok: false, error: "document_too_large", status: 413, rateLimit };
      }
      const text = await response.text();
      if (text.length > maxTextChars) {
        return { ok: false, error: "document_too_large", status: 413, rateLimit };
      }
      return { ok: true, text, rateLimit };
    }

    return Object.freeze({
      numericHeader,
      rateLimitDetails,
      validGitRef,
      getStoredGitHubAuth,
      clearStoredGitHubAuth,
      saveStoredGitHubAuth,
      invalidateAuthCache,
      setAuthCache,
      githubApiHeaders,
      fetchJson,
      fetchText
    });
  }

  return Object.freeze({
    DEFAULT_MAX_JSON_CHARS,
    DEFAULT_MAX_TEXT_CHARS,
    numericHeader,
    rateLimitDetails,
    validGitRef,
    create
  });
});
