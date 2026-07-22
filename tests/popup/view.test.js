"use strict";

const assert = require("node:assert/strict");
const viewApi = require("../../src/popup/view.js");

function node(dataKey, value) {
  const classes = new Set();
  return {
    dataset: { [dataKey]: value },
    hidden: false,
    tabIndex: 0,
    focused: false,
    classList: {
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    setAttribute(name, next) { this[name] = next; },
    focus() { this.focused = true; }
  };
}

const tabs = [node("tab", "updates"), node("tab", "settings")];
const panels = [node("panel", "updates"), node("panel", "settings")];
const historyCalls = [];
const document = {
  querySelectorAll(selector) { return selector === ".tab" ? tabs : panels; },
  createElement() { throw new Error("not used"); },
  getElementById() { throw new Error("not used"); }
};
const location = { hash: "#updates" };
const history = { replaceState(_state, _title, hash) { historyCalls.push(hash); location.hash = hash; } };
const view = viewApi.create({
  document,
  location,
  history,
  translator: { tag: "en-US", t: (key) => key },
  strings: {},
  formatting: { date: () => "", relativeDate: () => "", bytes: () => "" }
});

view.setTab("settings", true);
assert.equal(tabs[0].classList.contains("active"), false);
assert.equal(tabs[1].classList.contains("active"), true);
assert.equal(tabs[1].focused, true);
assert.equal(panels[0].hidden, true);
assert.equal(panels[1].hidden, false);
assert.deepEqual(historyCalls, ["#settings"]);

console.log("popup view tests: OK");
