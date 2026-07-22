"use strict";

const assert = require("node:assert/strict");
const formApi = require("../../src/options/form.js");

const nodes = {};
for (const key of formApi.FIELDS) {
  nodes[key] = {
    type: ["enabled", "showSubtitle", "showOtherPlatforms", "showSourceCode", "showRecommendationReason", "historyEnabled", "notificationsEnabled", "badgeEnabled"].includes(key)
      ? "checkbox"
      : "select-one",
    checked: false,
    value: "",
    addEventListener() {}
  };
}
const document = { getElementById: (id) => nodes[id] };
const form = formApi.create({
  document,
  browserApi: { permissions: { request: async () => true } },
  settingsApi: { set: async (value) => value, reset: async () => ({}) }
});
const settings = Object.fromEntries(formApi.FIELDS.map((key) => [key, nodes[key].type === "checkbox" ? true : "value"]));
settings.staleReleaseMonths = 12;
form.fill(settings);
assert.equal(nodes.enabled.checked, true);
assert.equal(nodes.language.value, "value");
assert.equal(nodes.staleReleaseMonths.value, "12");
nodes.enabled.checked = false;
nodes.staleReleaseMonths.value = "24";
const patch = form.collect();
assert.equal(patch.enabled, false);
assert.equal(patch.staleReleaseMonths, 24);
assert.ok(Object.isFrozen(formApi.FIELDS));

console.log("options form tests: OK");
