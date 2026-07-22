(function initContentElements(root, factory) {
  const api = factory();
  root.GHDNContentElements = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createContentElementsApi() {
  "use strict";

  function create(options = {}) {
    const documentObject = options.documentObject || globalThis.document;
    const DOMParserClass = options.DOMParserClass || globalThis.DOMParser;
    const icons = options.icons;
    if (!documentObject || typeof DOMParserClass !== "function" || !icons) {
      throw new Error("Content element dependencies are incomplete");
    }

    function createElement(tag, className, text) {
      const element = documentObject.createElement(tag);
      if (className) element.className = className;
      if (text !== undefined) element.textContent = text;
      return element;
    }

    const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

    function createSvgNode(markup) {
      const source = markup.replace(
        /^<svg\b(?![^>]*\bxmlns=)/,
        `<svg xmlns="${SVG_NAMESPACE}"`
      );
      const parsed = new DOMParserClass().parseFromString(source, "image/svg+xml");
      if (parsed.querySelector("parsererror")) return documentObject.createTextNode("");
      const svg = parsed.documentElement;
      if (!svg || svg.nodeName.toLowerCase() !== "svg" || svg.namespaceURI !== SVG_NAMESPACE) {
        return documentObject.createTextNode("");
      }
      return documentObject.importNode(svg, true);
    }

    function createIcon(name, className = "ghdn-icon") {
      const icon = createElement("span", className);
      icon.replaceChildren(createSvgNode(icons.svgIcon(name)));
      return icon;
    }

    return Object.freeze({ createElement, createSvgNode, createIcon });
  }

  return Object.freeze({ create });
});
