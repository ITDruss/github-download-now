(function initBackgroundAuthService(root, factory) {
  const api = factory();
  root.GHDNBackgroundAuthService = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBackgroundAuthServiceApi() {
  "use strict";

  const MAX_OAUTH_RESPONSE_CHARS = 100_000;

  function create(options = {}) {
    const storage = options.storage;
    const githubClient = options.githubClient;
    const urlPolicy = options.urlPolicy;
    const githubAuth = options.githubAuth;
    const browserApi = options.browserApi;
    const extensionApi = options.extensionApi;
    const fetchFn = options.fetchFn || globalThis.fetch;
    const clearCaches = options.clearCaches || (() => {});

    if (!storage || !githubClient || !urlPolicy || !browserApi || !extensionApi || typeof fetchFn !== "function") {
      throw new Error("Auth service dependencies are incomplete");
    }

    async function oauthPost(endpoint, body) {
      const trusted = urlPolicy.oauthEndpoint(endpoint);
      if (!trusted) return { ok: false, error: "untrusted_url" };
      const response = await fetchFn(trusted.href, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body,
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer"
      });
      if (!urlPolicy.oauthEndpoint(response.url || trusted.href)) return { ok: false, error: "untrusted_redirect" };
      if (!response.ok) return { ok: false, error: "oauth_http_error", status: response.status };
      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_OAUTH_RESPONSE_CHARS) {
        return { ok: false, error: "oauth_response_too_large" };
      }
      const text = await response.text();
      if (text.length > MAX_OAUTH_RESPONSE_CHARS) return { ok: false, error: "oauth_response_too_large" };
      try {
        return { ok: true, data: JSON.parse(text) };
      } catch (_error) {
        return { ok: false, error: "invalid_oauth_response" };
      }
    }

    async function readGitHubAuthPending() {
      if (!githubAuth) return null;
      const stored = await storage.localGet({ [githubAuth.PENDING_KEY]: null });
      const pending = stored[githubAuth.PENDING_KEY];
      if (!pending || typeof pending !== "object") return null;
      const expiresAt = Date.parse(pending.expiresAt || "");
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        await storage.localRemove([githubAuth.PENDING_KEY]);
        return null;
      }
      if (!githubAuth.TOKEN_PATTERN.test(String(pending.deviceCode || ""))) return null;
      if (pending.verificationUri !== githubAuth.VERIFICATION_URI) return null;
      return pending;
    }

    async function publicGitHubAuthStatus(statusOptions = {}) {
      if (!githubAuth) return { ok: false, error: "auth_unavailable" };
      let auth = await githubClient.getStoredGitHubAuth();
      const pending = await readGitHubAuthPending();
      if (auth && statusOptions.refresh) {
        const rate = await githubClient.fetchJson("https://api.github.com/rate_limit", {
          token: auth.token,
          allowAnonymousFallback: false
        });
        if (!rate.ok && rate.error === "invalid_token") {
          await githubClient.clearStoredGitHubAuth();
          auth = null;
        } else if (rate.ok) {
          const rateLimit = githubAuth.normalizeRateLimit(rate.data);
          if (rateLimit) auth = await githubClient.saveStoredGitHubAuth({ ...auth, rateLimit });
        }
      }
      return { ok: true, ...githubAuth.publicStatus(auth, pending) };
    }

    async function openGitHubDeviceVerification(value) {
      const trusted = urlPolicy.deviceVerification(value);
      if (!trusted || !extensionApi.tabs || !extensionApi.tabs.create) {
        return { ok: false, error: "verification_unavailable" };
      }
      await browserApi.tabs.create(trusted.href);
      return { ok: true };
    }

    async function startGitHubAuthorization() {
      if (!githubAuth) return { ok: false, error: "auth_unavailable" };
      const existing = await githubClient.getStoredGitHubAuth();
      if (existing) return { ok: false, error: "already_connected", ...githubAuth.publicStatus(existing) };

      const request = await oauthPost(githubAuth.DEVICE_CODE_ENDPOINT, githubAuth.deviceCodeBody());
      if (!request.ok) return request;
      const pending = githubAuth.normalizeDeviceResponse(request.data);
      if (!pending) return { ok: false, error: "invalid_device_response" };
      await storage.localSet({ [githubAuth.PENDING_KEY]: pending });
      await openGitHubDeviceVerification(pending.verificationUri);
      return { ok: true, ...githubAuth.publicStatus(null, pending) };
    }

    async function pollGitHubAuthorization() {
      if (!githubAuth) return { ok: false, error: "auth_unavailable" };
      const existing = await githubClient.getStoredGitHubAuth();
      if (existing) return { ok: true, ...githubAuth.publicStatus(existing) };
      const pending = await readGitHubAuthPending();
      if (!pending) return { ok: false, error: "no_pending_authorization" };

      const now = Date.now();
      const nextPollAt = Math.max(0, Number(pending.nextPollAt) || 0);
      if (now < nextPollAt) {
        return {
          ok: true,
          ...githubAuth.publicStatus(null, pending),
          retryAfterMs: nextPollAt - now
        };
      }

      const locked = { ...pending, nextPollAt: now + Math.max(5, Number(pending.interval) || 5) * 1000 };
      await storage.localSet({ [githubAuth.PENDING_KEY]: locked });
      const request = await oauthPost(githubAuth.ACCESS_TOKEN_ENDPOINT, githubAuth.accessTokenBody(pending.deviceCode));
      if (!request.ok) return request;
      const tokenResult = githubAuth.normalizeTokenResponse(request.data);

      if (!tokenResult.ok) {
        if (tokenResult.error === "authorization_pending" || tokenResult.error === "slow_down") {
          const interval = Math.min(60, Math.max(5, Number(pending.interval) || 5) + (tokenResult.error === "slow_down" ? 5 : 0));
          const updated = { ...pending, interval, nextPollAt: Date.now() + interval * 1000 };
          await storage.localSet({ [githubAuth.PENDING_KEY]: updated });
          return { ok: true, ...githubAuth.publicStatus(null, updated), waiting: true };
        }
        await storage.localRemove([githubAuth.PENDING_KEY]);
        return tokenResult;
      }

      const rateResult = await githubClient.fetchJson("https://api.github.com/rate_limit", {
        token: tokenResult.token,
        allowAnonymousFallback: false
      });
      const rateLimit = rateResult.ok ? githubAuth.normalizeRateLimit(rateResult.data) : null;
      const auth = await githubClient.saveStoredGitHubAuth({
        token: tokenResult.token,
        tokenType: tokenResult.tokenType,
        scope: tokenResult.scope,
        connectedAt: new Date().toISOString(),
        rateLimit
      });
      await storage.localRemove([githubAuth.PENDING_KEY]);
      return { ok: true, ...githubAuth.publicStatus(auth) };
    }

    async function disconnectGitHubAuthorization() {
      if (!githubAuth) return { ok: false, error: "auth_unavailable" };
      await storage.localRemove([githubAuth.STORAGE_KEY, githubAuth.PENDING_KEY]);
      githubClient.setAuthCache(null);
      clearCaches();
      return { ok: true, ...githubAuth.publicStatus(null) };
    }

    function trustedExtensionSender(sender) {
      const origin = extensionApi.runtime?.getURL ? extensionApi.runtime.getURL("") : "";
      return Boolean(
        sender &&
        (!sender.id || sender.id === extensionApi.runtime.id) &&
        typeof sender.url === "string" &&
        origin && sender.url.startsWith(origin)
      );
    }

    return Object.freeze({
      oauthPost,
      readGitHubAuthPending,
      publicGitHubAuthStatus,
      openGitHubDeviceVerification,
      startGitHubAuthorization,
      pollGitHubAuthorization,
      disconnectGitHubAuthorization,
      trustedExtensionSender
    });
  }

  return Object.freeze({ MAX_OAUTH_RESPONSE_CHARS, create });
});
