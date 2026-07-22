(function initOptionsAuthPanel(root, factory) {
  const api = factory();
  root.GHDNOptionsAuthPanel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createOptionsAuthPanelApi() {
  "use strict";

  const DEVICE_URL = "https://github.com/login/device";

  function errorText(strings, error) {
    if (error === "access_denied") return strings.authDenied;
    if (error === "expired_token" || error === "no_pending_authorization") return strings.authExpired;
    return strings.authError;
  }

  function create(options = {}) {
    const document = options.document;
    const window = options.window;
    const browserApi = options.browserApi;
    const messages = options.messages;
    const send = options.send;
    const getStrings = options.getStrings;
    if (!document || !window || !browserApi || !messages || !send || !getStrings) {
      throw new Error("Options auth-panel dependencies are incomplete");
    }

    let pollTimer = null;
    let state = { connected: false, pending: null };

    function authMessage(message, error = false) {
      const node = document.getElementById("githubAuthMessage");
      node.textContent = message || "";
      node.classList.toggle("error", Boolean(error));
    }

    function render(value = state) {
      state = value && typeof value === "object" ? value : { connected: false, pending: null };
      const strings = getStrings();
      const connected = Boolean(state.connected);
      const pending = !connected && state.pending;
      document.getElementById("githubAuthDisconnected").hidden = connected || Boolean(pending);
      document.getElementById("githubAuthPending").hidden = !pending;
      document.getElementById("githubAuthConnected").hidden = !connected;
      document.getElementById("githubAuthBadge").textContent = connected
        ? strings.authConnected
        : pending ? strings.authWaiting : strings.authOptional;
      if (pending) document.getElementById("githubAuthCode").textContent = pending.userCode || "—";
      if (connected) {
        document.getElementById("githubAuthAccount").textContent = strings.authAccount;
        const rate = state.rateLimit || {};
        document.getElementById("githubAuthRate").textContent = strings.authRate(Number(rate.remaining), Number(rate.limit));
      }
    }

    async function requestConsent() {
      const current = await browserApi.permissions.getAll();
      if (!current || !Array.isArray(current.data_collection)) return true;
      if (current.data_collection.includes("authenticationInfo")) return true;
      return browserApi.permissions.request({ data_collection: ["authenticationInfo"] });
    }

    function stop() {
      clearTimeout(pollTimer);
      pollTimer = null;
    }

    function schedule(delay = 2000) {
      stop();
      pollTimer = setTimeout(() => poll().catch(console.error), Math.max(1000, delay));
    }

    async function poll() {
      const result = await send({ type: messages.TYPES.AUTH_POLL });
      if (!result || !result.ok) {
        stop();
        authMessage(errorText(getStrings(), result && result.error), true);
        render({ connected: false, pending: null });
        return;
      }
      render(result);
      if (result.connected) {
        stop();
        authMessage(getStrings().authDone);
        return;
      }
      authMessage(getStrings().authChecking);
      schedule(Number(result.retryAfterMs) || 2000);
    }

    async function loadStatus(refresh = false) {
      const result = await send({ type: messages.TYPES.AUTH_STATUS, refresh });
      if (!result || !result.ok) {
        authMessage(errorText(getStrings(), result && result.error), true);
        return;
      }
      render(result);
      if (result.pending) {
        authMessage(getStrings().authChecking);
        schedule(1000);
      }
    }

    function bind() {
      document.getElementById("githubAuthConnect").addEventListener("click", async () => {
        const button = document.getElementById("githubAuthConnect");
        button.disabled = true;
        authMessage(getStrings().authStarting);
        try {
          if (!(await requestConsent())) {
            authMessage(getStrings().authConsentDenied, true);
            return;
          }
          const result = await send({ type: messages.TYPES.AUTH_START });
          if (!result || !result.ok) {
            authMessage(errorText(getStrings(), result && result.error), true);
            return;
          }
          render(result);
          authMessage(getStrings().authChecking);
          schedule(1000);
        } finally {
          button.disabled = false;
        }
      });
      document.getElementById("githubAuthOpenDevice").addEventListener("click", () => {
        window.open(DEVICE_URL, "_blank", "noopener,noreferrer");
      });
      document.getElementById("githubAuthDisconnect").addEventListener("click", async () => {
        const result = await send({ type: messages.TYPES.AUTH_DISCONNECT });
        stop();
        render(result && result.ok ? result : { connected: false, pending: null });
        authMessage(
          result && result.ok ? getStrings().authRemoved : errorText(getStrings(), result && result.error),
          !(result && result.ok)
        );
      });
    }

    return Object.freeze({ bind, loadStatus, render, stop });
  }

  return Object.freeze({ create, DEVICE_URL, errorText });
});
