"use strict";

const assert = require("node:assert/strict");
const storageModule = require("../../src/background/storage.js");

const values = {};
let accessLevel = "";
const storage = storageModule.create({
  browserApi: {
    storage: {
      local: {
        async get(defaults) { return { ...defaults, ...values }; },
        async set(patch) { Object.assign(values, patch); },
        async remove(keys) { for (const key of keys) delete values[key]; },
        async setAccessLevel(value) { accessLevel = value; }
      }
    }
  }
});

(async () => {
  await storage.localSet({ one: 1 });
  assert.deepEqual(await storage.localGet({ one: 0, two: 2 }), { one: 1, two: 2 });
  await storage.localRemove(["one"]);
  assert.deepEqual(await storage.localGet({ one: 0 }), { one: 0 });
  await storage.restrictLocalStorageToTrustedContexts();
  assert.equal(accessLevel, "TRUSTED_CONTEXTS");
  console.log("background storage tests: OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
