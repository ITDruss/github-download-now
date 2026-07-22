"use strict";

function createStorageArea(store = {}, runtime = null) {
  return {
    get(defaults, callback) {
      const value = { ...(defaults || {}), ...store };
      if (callback) callback(value);
      else return Promise.resolve(value);
    },
    set(values, callback) {
      Object.assign(store, values || {});
      if (callback) callback();
      else return Promise.resolve();
    },
    remove(keys, callback) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key];
      if (callback) callback();
      else return Promise.resolve();
    },
    clear(callback) {
      for (const key of Object.keys(store)) delete store[key];
      if (callback) callback();
      else return Promise.resolve();
    },
    setAccessLevel(_options, callback) {
      if (runtime) runtime.localAccessRestricted = true;
      if (callback) callback();
      else return Promise.resolve();
    }
  };
}

module.exports = { createStorageArea };
