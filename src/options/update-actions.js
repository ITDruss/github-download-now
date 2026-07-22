(function initOptionsUpdateActions(root, factory) {
  const api = factory();
  root.GHDNOptionsUpdateActions = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createOptionsUpdateActionsApi() {
  "use strict";

  function summarize(result, formatting, strings) {
    const errors = result && Array.isArray(result.errors) ? result.errors : [];
    const limited = errors.find((item) => item && item.error === "rate_limited");
    if (limited) {
      const time = limited.resetAt ? formatting.time(limited.resetAt, strings.localeTag) : "";
      return strings.rateLimited(time);
    }
    const found = result && Array.isArray(result.detected) ? result.detected.length : 0;
    return strings.checkSummary(found, errors.length, Number(result?.checked) || 0, Number(result?.total) || 0);
  }

  function create(options = {}) {
    const document = options.document;
    const messages = options.messages;
    const formatting = options.formatting;
    const send = options.send;
    const getStrings = options.getStrings;
    const status = options.status;
    if (!document || !messages || !formatting || !send || !getStrings || !status) {
      throw new Error("Options update-action dependencies are incomplete");
    }

    function bind() {
      document.getElementById("checkUpdatesNow").addEventListener("click", async () => {
        const button = document.getElementById("checkUpdatesNow");
        button.disabled = true;
        button.textContent = getStrings().checking;
        try {
          const result = await send({ type: messages.TYPES.CHECK_UPDATES });
          status(summarize(result, formatting, getStrings()));
        } finally {
          button.disabled = false;
          button.textContent = getStrings().checkNow;
        }
      });
      document.getElementById("clearHistory").addEventListener("click", async () => {
        await send({ type: messages.TYPES.CLEAR_HISTORY });
        status(getStrings().saved);
      });
      document.getElementById("clearTracking").addEventListener("click", async () => {
        await send({ type: messages.TYPES.CLEAR_TRACKING });
        status(getStrings().saved);
      });
    }

    return Object.freeze({ bind, summarize: (result) => summarize(result, formatting, getStrings()) });
  }

  return Object.freeze({ create, summarize });
});
