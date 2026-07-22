"use strict";

const assert = require("node:assert/strict");
const placementModule = require("../../src/content/placement.js");

function host(name) {
  return {
    name,
    clientWidth: 800,
    children: [],
    append(node) { this.children.push(node); node.parentElement = this; },
    prepend(node) { this.children.unshift(node); node.parentElement = this; },
    insertBefore(node, anchor) {
      const index = this.children.indexOf(anchor);
      this.children.splice(index < 0 ? this.children.length : index, 0, node);
      node.parentElement = this;
    }
  };
}

const body = host("body");
const main = host("main");
const documentObject = {
  body,
  querySelector(selector) { return selector === "main" ? main : null; },
  querySelectorAll() { return []; }
};
const repositoryContext = {
  isReleasesRoute: (repo) => repo.route === "releases",
  isFlowEligibleRoute: (repo) => repo.parts.length === 2,
  releaseTagFromRoute: () => ""
};
const dom = {
  isVisibleElement: () => true,
  collectVisibleActionControls: () => [],
  actionKind: () => "",
  findCompleteActionGroup: () => null,
  findToolbarForActionGroup: () => null,
  releaseTagForSection: () => "",
  findReleaseTitleGroup: () => null
};
const placement = placementModule.create({
  documentObject,
  windowObject: { innerWidth: 600, innerHeight: 800 },
  getComputedStyle: () => ({}),
  repositoryContext,
  dom
});

assert.equal(placement.findMountTarget({ parts: ["owner", "repo"] }).mode, "flow");
assert.equal(placement.findMountTarget({ parts: ["owner", "repo", "issues"] }).mode, "floating");

const root = {};
placement.insertRoot(root, { element: main, prepend: true });
assert.equal(main.children[0], root);
assert.equal(root.__ghdnLayoutHost, main);

const anchor = {};
main.children = [anchor];
anchor.parentElement = main;
const nextRoot = {};
placement.insertRoot(nextRoot, { element: main, anchor, insertBefore: false });
assert.deepEqual(main.children, [anchor, nextRoot]);

console.log("content placement tests: OK");
