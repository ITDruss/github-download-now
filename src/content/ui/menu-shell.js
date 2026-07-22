(function initMenuShell(root, factory) {
  const api = factory();
  root.GHDNMenuShell = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMenuShellApi() {
  "use strict";

  function create(options = {}) {
    const documentObject = options.documentObject || globalThis.document;
    const windowObject = options.windowObject || globalThis.window;
    const requestFrame = options.requestAnimationFrameFn || globalThis.requestAnimationFrame;
    const elements = options.elements;
    const getStrings = options.getStrings || (() => ({}));
    const rootId = options.rootId || "ghdn-root";
    const menuId = options.menuId || "ghdn-menu";
    const breakpoint = options.breakpoint || 760;
    let closeListenersInstalled = false;

    if (!documentObject || !windowObject || !elements) throw new Error("Menu shell dependencies are incomplete");
    const { createElement } = elements;

    function ensure() {
      let menu = documentObject.getElementById(menuId);
      if (menu) return menu;
      menu = createElement("div", "ghdn-menu");
      menu.id = menuId;
      menu.hidden = true;
      menu.setAttribute("role", "dialog");
      menu.setAttribute("aria-label", getStrings().chooseDownload);
      menu.setAttribute("tabindex", "-1");
      documentObject.body.append(menu);
      return menu;
    }

    function position() {
      const root = documentObject.getElementById(rootId);
      const menu = documentObject.getElementById(menuId);
      if (!root || !menu || menu.hidden) return;
      const margin = 12;
      const mobile = windowObject.innerWidth <= breakpoint;
      menu.classList.toggle("ghdn-menu-sheet", mobile);
      menu.style.top = "";
      menu.style.right = "";
      menu.style.bottom = "";
      menu.style.left = "";
      menu.style.width = "";
      if (mobile) {
        menu.style.left = `${margin}px`;
        menu.style.right = `${margin}px`;
        menu.style.bottom = `${margin}px`;
        return;
      }
      const anchor = root.querySelector(".ghdn-button-group") || root;
      const anchorRect = anchor.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const width = Math.min(470, windowObject.innerWidth - margin * 2);
      const estimatedHeight = Math.min(menuRect.height || 650, windowObject.innerHeight - margin * 2);
      let left = anchorRect.right - width;
      left = Math.max(margin, Math.min(left, windowObject.innerWidth - width - margin));
      const below = anchorRect.bottom + 8;
      const above = anchorRect.top - 8 - estimatedHeight;
      const top = below + estimatedHeight <= windowObject.innerHeight - margin || above < margin
        ? Math.min(below, windowObject.innerHeight - estimatedHeight - margin)
        : above;
      menu.style.width = `${width}px`;
      menu.style.left = `${Math.round(left)}px`;
      menu.style.top = `${Math.max(margin, Math.round(top))}px`;
    }

    function setOpen(open) {
      const root = documentObject.getElementById(rootId);
      const menu = ensure();
      if (!root && open) return;
      const arrow = root?.querySelector('[data-role="menu"]');
      menu.hidden = !open;
      root?.classList.toggle("ghdn-menu-open", open);
      arrow?.setAttribute("aria-expanded", String(open));
      if (open) {
        position();
        requestFrame(() => {
          position();
          if (documentObject.activeElement === arrow) {
            const first = menu.querySelector("button:not([disabled]), a[href], select, [tabindex]:not([tabindex='-1'])");
            if (first) first.focus();
            else menu.focus();
          }
        });
      } else if (arrow && menu.contains(documentObject.activeElement)) {
        arrow.focus();
      }
    }

    function installCloseListeners() {
      if (closeListenersInstalled) return;
      closeListenersInstalled = true;
      documentObject.addEventListener("click", (event) => {
        const root = documentObject.getElementById(rootId);
        const menu = documentObject.getElementById(menuId);
        if (!root?.contains(event.target) && !menu?.contains(event.target)) setOpen(false);
      });
      documentObject.addEventListener("keydown", (event) => {
        if (event.key === "Escape") setOpen(false);
      });
    }

    return Object.freeze({ ensure, position, setOpen, installCloseListeners });
  }

  return Object.freeze({ create });
});
