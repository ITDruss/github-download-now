(function initPopupView(root, factory) {
  const api = factory();
  root.GHDNPopupView = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPopupViewApi() {
  "use strict";

  function create(options = {}) {
    const document = options.document;
    const location = options.location;
    const history = options.history;
    const translator = options.translator;
    const strings = options.strings;
    const formatting = options.formatting;
    if (!document || !translator || !strings || !formatting) {
      throw new Error("Popup view dependencies are incomplete");
    }

    let statusTimer = null;

    function element(tag, className = "", text = "") {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text) node.textContent = text;
      return node;
    }

    function actionButton(label, handler, className = "") {
      const button = element("button", className, label);
      button.type = "button";
      button.addEventListener("click", handler);
      return button;
    }

    function status(message, error = false) {
      const node = document.getElementById("status");
      node.textContent = message;
      node.classList.toggle("error", error);
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => {
        node.textContent = "";
        node.classList.remove("error");
      }, 2200);
    }

    function setLabels() {
      document.documentElement.lang = translator.tag;
      document.querySelector(".tabs").setAttribute("aria-label", translator.t("popupSectionsAria"));
      const enabledSwitch = document.getElementById("enabledSwitch");
      enabledSwitch.title = strings.enabledLabel;
      document.getElementById("enabled").setAttribute("aria-label", strings.enabledLabel);
      const labels = {
        updatesTabLabel: strings.updates,
        trackingTabLabel: strings.tracking,
        historyTabLabel: strings.history,
        settingsTabLabel: strings.settings,
        updatesTitle: strings.updatesTitle,
        trackingTitle: strings.trackingTitle,
        historyTitle: strings.historyTitle,
        trackingNote: strings.trackingNote,
        historyNote: strings.historyNote,
        checkNow: strings.checkNow,
        clearHistory: strings.clear,
        detectedLabel: strings.detected,
        formatLabel: strings.format,
        actionLabel: strings.action,
        afterDownloadLabel: strings.afterDownload,
        intervalLabel: strings.interval,
        notificationsLabel: strings.notifications,
        badgeLabel: strings.badge,
        historyEnabledLabel: strings.historyEnabled,
        openOptions: strings.options
      };
      for (const [id, value] of Object.entries(labels)) document.getElementById(id).textContent = value;

      const optionLabels = {
        primaryAction: { download: strings.downloadAction, menu: strings.menuAction, release: strings.releaseAction },
        afterDownload: { ask: strings.ask, always: strings.always, never: strings.never },
        updateCheckInterval: { manual: strings.manual, "6h": strings.every6h, "24h": strings.daily, "72h": strings.every3d, "168h": strings.weekly }
      };
      for (const [selectId, values] of Object.entries(optionLabels)) {
        for (const [value, label] of Object.entries(values)) {
          document.querySelector(`#${selectId} option[value="${value}"]`).textContent = label;
        }
      }
    }

    function setTab(name, focus = false) {
      for (const node of document.querySelectorAll(".tab")) {
        const active = node.dataset.tab === name;
        node.classList.toggle("active", active);
        node.setAttribute("aria-selected", String(active));
        node.tabIndex = active ? 0 : -1;
        if (active && focus) node.focus();
      }
      for (const node of document.querySelectorAll(".panel")) {
        const active = node.dataset.panel === name;
        node.classList.toggle("active", active);
        node.hidden = !active;
      }
      if (location && history && location.hash !== `#${name}`) history.replaceState(null, "", `#${name}`);
    }

    function bindTabs() {
      const tabs = [...document.querySelectorAll(".tab")];
      for (const node of tabs) {
        node.addEventListener("click", () => setTab(node.dataset.tab));
        node.addEventListener("keydown", (event) => {
          if (!new Set(["ArrowLeft", "ArrowRight", "Home", "End"]).has(event.key)) return;
          event.preventDefault();
          const current = tabs.indexOf(node);
          const next = event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
          setTab(tabs[next].dataset.tab, true);
        });
      }
      const requested = location ? location.hash.slice(1) : "";
      setTab(["updates", "tracking", "history", "settings"].includes(requested) ? requested : "updates");
    }

    function formatDate(value, relative = false) {
      return relative
        ? formatting.relativeDate(value, strings)
        : formatting.date(value, translator.tag, "—");
    }

    function formatBytes(value) {
      return formatting.bytes(value, { emptyForZero: true, minimumKilobytes: true });
    }

    return Object.freeze({
      actionButton,
      bindTabs,
      element,
      formatBytes,
      formatDate,
      setLabels,
      setTab,
      status
    });
  }

  return Object.freeze({ create });
});
