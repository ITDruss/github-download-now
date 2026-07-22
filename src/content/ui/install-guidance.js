(function initInstallGuidance(root, factory) {
  const api = factory();
  root.GHDNInstallGuidance = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createInstallGuidanceApi() {
  "use strict";

  function create(options = {}) {
    const documentObject = options.documentObject || globalThis.document;
    const elements = options.elements;
    const installGuides = options.installGuides;
    const selector = options.selector;
    const platform = options.platform;
    const notices = options.notices;
    const getSettings = options.getSettings || (() => ({}));
    const getStrings = options.getStrings || (() => ({}));
    const positionMenu = options.positionMenu || (() => {});
    const requestFrame = options.requestAnimationFrameFn || globalThis.requestAnimationFrame;
    const setTimer = options.setTimeoutFn || globalThis.setTimeout;
    const clearTimer = options.clearTimeoutFn || globalThis.clearTimeout;
    let promptTimer = null;

    if (!documentObject || !elements || !installGuides || !selector || !platform || !notices) {
      throw new Error("Install guidance dependencies are incomplete");
    }
    const { createElement, createIcon } = elements;

    function guideForAsset(asset, detectedPlatform) {
      const settings = getSettings();
      if (!asset || settings.installGuidance === "off") return null;
      const extension = asset.extension || selector.detectExtension(asset.name);
      return installGuides.createGuide({
        assetName: asset.name,
        extension,
        platform: platform.assetPlatform(asset) || detectedPlatform?.os || "unknown",
        language: getStrings().locale
      });
    }

    function createCard(guide, options = {}) {
      const strings = getStrings();
      const card = createElement("div", `ghdn-install-guide${options.prompt ? " ghdn-install-guide-prompt" : ""}`);
      const header = createElement("div", "ghdn-install-guide-header");
      const heading = createElement("div", "ghdn-install-guide-heading");
      heading.append(createIcon("info", "ghdn-install-guide-icon"), createElement("strong", "", options.prompt ? strings.installAfterDownload : guide.title));
      header.append(heading);
      if (options.prompt) {
        const close = createElement("button", "ghdn-install-guide-close");
        close.type = "button";
        close.title = strings.installClose;
        close.setAttribute("aria-label", strings.installClose);
        close.textContent = "×";
        close.addEventListener("click", () => card.remove());
        header.append(close);
      }
      card.append(header);
      if (options.prompt) card.append(createElement("div", "ghdn-install-guide-title", guide.title));
      if (guide.summary) card.append(createElement("div", "ghdn-install-guide-summary", guide.summary));

      const steps = createElement("div", "ghdn-install-guide-steps");
      guide.steps.forEach((step, index) => {
        const item = createElement("div", "ghdn-install-guide-step");
        item.append(createElement("div", "ghdn-install-guide-step-label", `${index + 1}. ${step.label}`));
        if (step.command) {
          const commandRow = createElement("div", "ghdn-install-command-row");
          const code = createElement("code", "ghdn-install-command", step.command);
          const copy = createElement("button", "ghdn-install-command-copy");
          copy.type = "button";
          copy.title = strings.installCopyCommand;
          copy.setAttribute("aria-label", strings.installCopyCommand);
          copy.append(createIcon("copy", "ghdn-copy-icon"));
          copy.addEventListener("click", () => notices.copyText(step.command, strings.installCopied));
          commandRow.append(code, copy);
          item.append(commandRow);
        }
        steps.append(item);
      });
      card.append(steps);

      if (guide.warning) {
        const warning = createElement("div", "ghdn-install-guide-warning");
        warning.append(createIcon("warning", "ghdn-inline-icon"), createElement("span", "", guide.warning));
        card.append(warning);
      }
      if (guide.copyAll && guide.commands.length > 1) {
        const copyAll = createElement("button", "ghdn-install-copy-all", strings.installCopyAll);
        copyAll.type = "button";
        copyAll.prepend(createIcon("copy", "ghdn-inline-icon"));
        copyAll.addEventListener("click", () => notices.copyText(installGuides.commandText(guide), strings.installCopied));
        card.append(copyAll);
      }
      return card;
    }

    function showPrompt(guide) {
      if (!guide) return;
      let prompt = documentObject.getElementById("ghdn-install-prompt");
      if (prompt) prompt.remove();
      prompt = createCard(guide, { prompt: true });
      prompt.id = "ghdn-install-prompt";
      notices.ensureStack().append(prompt);
      if (promptTimer !== null) clearTimer(promptTimer);
      promptTimer = setTimer(() => {
        if (prompt.isConnected) prompt.remove();
        promptTimer = null;
      }, 30000);
    }

    function createToggle(asset, detectedPlatform) {
      const strings = getStrings();
      const guide = guideForAsset(asset, detectedPlatform);
      if (!guide) return null;
      const panel = createCard(guide);
      panel.hidden = true;
      const button = createElement("button", "ghdn-guide-toggle");
      button.type = "button";
      button.title = strings.installHelp;
      button.setAttribute("aria-label", strings.installHelp);
      button.setAttribute("aria-expanded", "false");
      button.append(createIcon("info", "ghdn-guide-icon"));
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        panel.hidden = !panel.hidden;
        button.setAttribute("aria-expanded", String(!panel.hidden));
        requestFrame(positionMenu);
      });
      return { guide, panel, button };
    }

    return Object.freeze({ guideForAsset, createCard, createToggle, showPrompt });
  }

  return Object.freeze({ create });
});
