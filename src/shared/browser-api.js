(function initBrowserApi(root, factory) {
  const api = factory(root);
  root.GHDNBrowser = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBrowserApi(root) {
  "use strict";

  function extensionApi() {
    if (typeof browser !== "undefined") return browser;
    if (typeof chrome !== "undefined") return chrome;
    return root.browser || root.chrome || null;
  }

  function usesPromiseApi() {
    return typeof browser !== "undefined" || Boolean(root.browser && !root.chrome);
  }

  function lastError(api = extensionApi()) {
    return api?.runtime?.lastError || null;
  }

  function callbackOperation(invoke, mapResult = (value) => value) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        const error = lastError();
        if (error) reject(new Error(error.message || String(error)));
        else resolve(mapResult(value));
      };
      try {
        const returned = invoke(finish);
        if (returned && typeof returned.then === "function") {
          returned.then(finish, reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  async function sendMessage(message) {
    const api = extensionApi();
    if (!api?.runtime?.sendMessage) throw new Error("Runtime messaging is unavailable");
    if (usesPromiseApi()) return api.runtime.sendMessage(message);
    return callbackOperation((done) => api.runtime.sendMessage(message, done));
  }

  function storageArea(name) {
    return extensionApi()?.storage?.[name] || null;
  }

  async function storageGet(name, defaults) {
    const area = storageArea(name);
    if (!area?.get) return { ...(defaults || {}) };
    if (usesPromiseApi()) return area.get(defaults);
    return callbackOperation((done) => area.get(defaults, done));
  }

  async function storageSet(name, values) {
    const area = storageArea(name);
    if (!area?.set) return;
    if (usesPromiseApi()) return area.set(values);
    return callbackOperation((done) => area.set(values, done), () => undefined);
  }

  async function storageRemove(name, keys) {
    const area = storageArea(name);
    if (!area?.remove) return;
    if (usesPromiseApi()) return area.remove(keys);
    return callbackOperation((done) => area.remove(keys, done), () => undefined);
  }

  async function storageClear(name) {
    const area = storageArea(name);
    if (!area?.clear) return;
    if (usesPromiseApi()) return area.clear();
    return callbackOperation((done) => area.clear(done), () => undefined);
  }

  async function setLocalAccessLevel(accessLevel) {
    const area = storageArea("local");
    if (!area?.setAccessLevel) return;
    if (usesPromiseApi()) return area.setAccessLevel({ accessLevel });
    return callbackOperation((done) => area.setAccessLevel({ accessLevel }, done), () => undefined);
  }

  async function createTab(url) {
    const api = extensionApi();
    if (!api?.tabs?.create) throw new Error("Tab creation is unavailable");
    if (usesPromiseApi()) return api.tabs.create({ url });
    return callbackOperation((done) => api.tabs.create({ url }, done));
  }

  async function openOptionsPage() {
    const api = extensionApi();
    if (!api?.runtime?.openOptionsPage) throw new Error("Options page is unavailable");
    if (usesPromiseApi()) return api.runtime.openOptionsPage();
    return callbackOperation((done) => api.runtime.openOptionsPage(done), () => undefined);
  }

  async function permissionContains(value) {
    const api = extensionApi();
    if (!api?.permissions?.contains) return false;
    if (usesPromiseApi()) return api.permissions.contains(value);
    return callbackOperation((done) => api.permissions.contains(value, done), Boolean);
  }

  async function permissionRequest(value) {
    const api = extensionApi();
    if (!api?.permissions?.request) return false;
    if (usesPromiseApi()) return api.permissions.request(value);
    return callbackOperation((done) => api.permissions.request(value, done), Boolean);
  }

  async function permissionGetAll() {
    const api = extensionApi();
    if (!api?.permissions?.getAll) return null;
    if (usesPromiseApi()) return api.permissions.getAll();
    return callbackOperation((done) => api.permissions.getAll(done));
  }

  async function createNotification(id, options) {
    const api = extensionApi();
    if (!api?.notifications?.create) return;
    if (usesPromiseApi()) return api.notifications.create(id, options);
    return callbackOperation((done) => api.notifications.create(id, options, done), () => undefined);
  }

  async function getAlarm(name) {
    const api = extensionApi();
    if (!api?.alarms?.get) return null;
    if (usesPromiseApi()) return api.alarms.get(name);
    return callbackOperation((done) => api.alarms.get(name, done), (value) => value || null);
  }

  async function clearAlarm(name) {
    const api = extensionApi();
    if (!api?.alarms?.clear) return false;
    if (usesPromiseApi()) return api.alarms.clear(name);
    return callbackOperation((done) => api.alarms.clear(name, done), Boolean);
  }

  function createAlarm(name, info) {
    const api = extensionApi();
    if (!api?.alarms?.create) return;
    return api.alarms.create(name, info);
  }

  const storage = Object.freeze({
    sync: Object.freeze({
      get: (defaults) => storageGet("sync", defaults),
      set: (values) => storageSet("sync", values),
      remove: (keys) => storageRemove("sync", keys),
      clear: () => storageClear("sync")
    }),
    local: Object.freeze({
      get: (defaults) => storageGet("local", defaults),
      set: (values) => storageSet("local", values),
      remove: (keys) => storageRemove("local", keys),
      clear: () => storageClear("local"),
      setAccessLevel: setLocalAccessLevel
    })
  });

  return Object.freeze({
    get api() { return extensionApi(); },
    get isPromiseApi() { return usesPromiseApi(); },
    runtime: Object.freeze({ sendMessage, openOptionsPage }),
    storage,
    tabs: Object.freeze({ create: createTab }),
    permissions: Object.freeze({ contains: permissionContains, request: permissionRequest, getAll: permissionGetAll }),
    notifications: Object.freeze({ create: createNotification }),
    alarms: Object.freeze({ get: getAlarm, clear: clearAlarm, create: createAlarm })
  });
});
