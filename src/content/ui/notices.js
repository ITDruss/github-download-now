(function initContentNotices(root, factory) {
  const api = factory();
  root.GHDNContentNotices = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createContentNoticesApi() {
  "use strict";

  function create(options = {}) {
    const documentObject = options.documentObject || globalThis.document;
    const navigatorObject = options.navigatorObject || globalThis.navigator || {};
    const elements = options.elements;
    const runtime = options.runtime;
    const messages = options.messages;
    const formatting = options.formatting;
    const getStrings = options.getStrings || (() => ({}));
    const noticeStackId = options.noticeStackId || "ghdn-notice-stack";
    const setTimer = options.setTimeoutFn || globalThis.setTimeout;
    const clearTimer = options.clearTimeoutFn || globalThis.clearTimeout;
    let toastTimer = null;
    let watchTimer = null;

    if (!documentObject || !elements || !runtime || !messages || !formatting) {
      throw new Error("Content notice dependencies are incomplete");
    }
    const { createElement, createIcon } = elements;

    function ensureStack() {
      let stack = documentObject.getElementById(noticeStackId);
      if (!stack) {
        stack = createElement("div", "ghdn-notice-stack");
        stack.id = noticeStackId;
        documentObject.body.append(stack);
      }
      return stack;
    }

    function showToast(message, type) {
      let toast = documentObject.getElementById("ghdn-toast");
      if (!toast) {
        toast = createElement("div", "ghdn-toast");
        toast.id = "ghdn-toast";
        ensureStack().append(toast);
      }
      toast.className = `ghdn-toast ghdn-toast-${type}`;
      toast.textContent = message;
      toast.hidden = false;
      if (toastTimer !== null) clearTimer(toastTimer);
      toastTimer = setTimer(() => {
        toast.hidden = true;
        toastTimer = null;
      }, 3500);
    }

    function showResponseError(response = {}) {
      const strings = getStrings();
      if (response.error === "no_release") showToast(strings.noRelease, "warning");
      else if (response.error === "rate_limited") {
        const time = response.resetAt ? formatting.time(response.resetAt) : null;
        showToast(strings.rateLimited(time), "warning");
      } else if (response.error === "network_error") showToast(strings.networkError, "error");
      else showToast(strings.apiError, "error");
    }

    async function copyText(text, successMessage) {
      const strings = getStrings();
      try {
        if (navigatorObject.clipboard?.writeText) await navigatorObject.clipboard.writeText(text);
        else {
          const area = createElement("textarea");
          area.value = text;
          area.style.position = "fixed";
          area.style.opacity = "0";
          documentObject.body.append(area);
          area.select();
          documentObject.execCommand("copy");
          area.remove();
        }
        showToast(successMessage || strings.copied, "success");
      } catch (_error) {
        showToast(strings.networkError, "error");
      }
    }

    function showWatchPrompt(download) {
      const strings = getStrings();
      let prompt = documentObject.getElementById("ghdn-watch-prompt");
      if (prompt) prompt.remove();
      prompt = createElement("div", "ghdn-watch-prompt");
      prompt.id = "ghdn-watch-prompt";
      const copy = createElement("div", "ghdn-watch-copy");
      copy.append(
        createElement("strong", "", strings.watchQuestion(`${download.owner}/${download.repo}`)),
        createElement("span", "", strings.watchText)
      );
      const actions = createElement("div", "ghdn-watch-actions");
      const enable = createElement("button", "ghdn-watch-enable", strings.watchEnable);
      const later = createElement("button", "ghdn-watch-later", strings.watchLater);
      enable.type = "button";
      later.type = "button";
      enable.addEventListener("click", async () => {
        enable.disabled = true;
        try {
          const result = await runtime.sendMessage({ type: messages.TYPES.WATCH_REPOSITORY, download });
          if (result?.ok) showToast(strings.watchingEnabled, "success");
        } catch (_error) {}
        prompt.remove();
      });
      later.addEventListener("click", () => prompt.remove());
      actions.append(enable, later);
      prompt.append(createIcon("info", "ghdn-watch-icon"), copy, actions);
      ensureStack().append(prompt);
      if (watchTimer !== null) clearTimer(watchTimer);
      watchTimer = setTimer(() => {
        if (prompt.isConnected) prompt.remove();
        watchTimer = null;
      }, 12000);
    }

    return Object.freeze({ ensureStack, showToast, showResponseError, copyText, showWatchPrompt });
  }

  return Object.freeze({ create });
});
