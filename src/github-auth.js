(function initGitHubAuth(root, factory) {
  const api = factory();
  root.GHDNGitHubAuth = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createGitHubAuth() {
  "use strict";

  const CLIENT_ID = "Ov23liF54e9cVZTKyRqy";
  const DEVICE_CODE_ENDPOINT = "https://github.com/login/device/code";
  const ACCESS_TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
  const VERIFICATION_URI = "https://github.com/login/device";
  const STORAGE_KEY = "ghdnGithubAuthV1";
  const PENDING_KEY = "ghdnGithubAuthPendingV1";
  const TOKEN_PATTERN = /^[A-Za-z0-9_]{20,255}$/;

  function boundedNumber(value, minimum, maximum, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(maximum, Math.max(minimum, numeric));
  }

  function normalizeDeviceResponse(value, now = Date.now()) {
    const source = value && typeof value === "object" ? value : {};
    const deviceCode = String(source.device_code || "").trim();
    const userCode = String(source.user_code || "").trim().toUpperCase();
    const verificationUri = String(source.verification_uri || source.verification_uri_complete || "").trim();
    const expiresIn = boundedNumber(source.expires_in, 60, 1800, 900);
    const interval = boundedNumber(source.interval, 5, 60, 5);
    if (!TOKEN_PATTERN.test(deviceCode)) return null;
    if (!/^[A-Z0-9-]{4,20}$/.test(userCode)) return null;
    if (verificationUri !== VERIFICATION_URI) return null;
    return {
      deviceCode,
      userCode,
      verificationUri,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + expiresIn * 1000).toISOString(),
      interval,
      nextPollAt: now
    };
  }

  function normalizeTokenResponse(value) {
    const source = value && typeof value === "object" ? value : {};
    if (source.error) {
      const error = String(source.error || "").slice(0, 80);
      const allowed = new Set([
        "authorization_pending",
        "slow_down",
        "expired_token",
        "access_denied",
        "incorrect_device_code",
        "incorrect_client_credentials",
        "device_flow_disabled"
      ]);
      return { ok: false, error: allowed.has(error) ? error : "oauth_error" };
    }
    const token = String(source.access_token || "").trim();
    const tokenType = String(source.token_type || "").trim().toLowerCase();
    const scope = String(source.scope || "").trim();
    if (!TOKEN_PATTERN.test(token) || tokenType !== "bearer") return { ok: false, error: "invalid_token_response" };
    if (scope) return { ok: false, error: "unexpected_scope" };
    return { ok: true, token, tokenType: "bearer", scope: "" };
  }


  function normalizeRateLimit(value) {
    const core = value && value.resources && value.resources.core;
    if (!core || typeof core !== "object") return null;
    const limit = Number(core.limit);
    const remaining = Number(core.remaining);
    const reset = Number(core.reset);
    const storedResetAt = String(core.resetAt || "").trim();
    const parsedStoredResetAt = Date.parse(storedResetAt);
    if (!Number.isFinite(limit) || !Number.isFinite(remaining)) return null;
    return {
      limit: Math.max(0, limit),
      remaining: Math.max(0, remaining),
      resetAt: Number.isFinite(reset) && reset > 0
        ? new Date(reset * 1000).toISOString()
        : (Number.isFinite(parsedStoredResetAt) ? new Date(parsedStoredResetAt).toISOString() : null)
    };
  }

  function normalizeStoredAuth(value) {
    const source = value && typeof value === "object" ? value : {};
    const token = String(source.token || "").trim();
    if (!TOKEN_PATTERN.test(token)) return null;
    return {
      token,
      tokenType: "bearer",
      scope: "",
      connectedAt: String(source.connectedAt || "").slice(0, 80),
      rateLimit: normalizeRateLimit({ resources: { core: source.rateLimit } }) || null
    };
  }

  function publicStatus(value, pending = null) {
    const auth = normalizeStoredAuth(value);
    const safePending = pending && typeof pending === "object" ? {
      userCode: String(pending.userCode || "").slice(0, 20),
      verificationUri: pending.verificationUri === VERIFICATION_URI ? VERIFICATION_URI : "",
      expiresAt: String(pending.expiresAt || "").slice(0, 80),
      interval: boundedNumber(pending.interval, 5, 60, 5),
      nextPollAt: Math.max(0, Number(pending.nextPollAt) || 0)
    } : null;
    return {
      connected: Boolean(auth),
      connectedAt: auth ? auth.connectedAt : "",
      rateLimit: auth ? auth.rateLimit : null,
      pending: safePending && safePending.verificationUri ? safePending : null
    };
  }

  function deviceCodeBody() {
    return new URLSearchParams({ client_id: CLIENT_ID }).toString();
  }

  function accessTokenBody(deviceCode) {
    return new URLSearchParams({
      client_id: CLIENT_ID,
      device_code: String(deviceCode || ""),
      grant_type: "urn:ietf:params:oauth:grant-type:device_code"
    }).toString();
  }

  return {
    CLIENT_ID,
    DEVICE_CODE_ENDPOINT,
    ACCESS_TOKEN_ENDPOINT,
    VERIFICATION_URI,
    STORAGE_KEY,
    PENDING_KEY,
    TOKEN_PATTERN,
    normalizeDeviceResponse,
    normalizeTokenResponse,
    normalizeRateLimit,
    normalizeStoredAuth,
    publicStatus,
    deviceCodeBody,
    accessTokenBody
  };
});
