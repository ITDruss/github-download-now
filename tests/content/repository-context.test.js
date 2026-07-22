"use strict";

const assert = require("node:assert/strict");
const context = require("../../src/content/repository-context.js");

function node(content = "") {
  return {
    textContent: content,
    getAttribute(name) {
      return this[name] ?? null;
    }
  };
}

function documentFixture({ nwo = "owner/repo", publicValue = "true", labels = [], header = true } = {}) {
  return {
    querySelector(selector) {
      if (selector.includes("repository_nwo")) return nwo === null ? null : Object.assign(node(), { content: nwo });
      if (selector.includes("repository_public")) return publicValue === null ? null : Object.assign(node(), { content: publicValue });
      if (selector === "#repository-container-header") return header ? node() : null;
      return null;
    },
    querySelectorAll() {
      return labels.map(node);
    }
  };
}

assert.deepEqual(
  context.parse({ testRepository: { owner: "Acme", repo: "Tool", parts: ["Acme", "Tool", "releases"] } }),
  { owner: "Acme", repo: "Tool", key: "acme/tool", parts: ["Acme", "Tool", "releases"] }
);
assert.equal(context.parse({ testRepository: { public: false } }), null);
assert.equal(context.parse({ locationObject: { pathname: "/settings/profile" }, documentObject: documentFixture() }), null);
assert.equal(context.parse({ locationObject: { pathname: "/owner/repo" }, documentObject: documentFixture({ publicValue: "false" }) }), null);
assert.equal(context.parse({ locationObject: { pathname: "/owner/repo" }, documentObject: documentFixture({ nwo: "other/repo" }) }), null);
assert.equal(context.parse({ locationObject: { pathname: "/owner/repo" }, documentObject: documentFixture({ nwo: null, publicValue: null, labels: ["Private"] }) }), null);
assert.deepEqual(
  context.parse({ locationObject: { pathname: "/Owner/Repo.git/releases/tag/v1.2.3" }, documentObject: documentFixture({ nwo: "Owner/Repo" }) }),
  { owner: "Owner", repo: "Repo", key: "owner/repo", parts: ["Owner", "Repo.git", "releases", "tag", "v1.2.3"] }
);

const repo = { parts: ["owner", "repo", "releases", "tag", "v1%2F2"] };
assert.equal(context.isReleasesRoute(repo), true);
assert.equal(context.releaseTagFromRoute(repo), "v1/2");
assert.equal(context.shouldShow({ parts: ["o", "r"] }, { enabled: true, showOn: "main" }), true);
assert.equal(context.shouldShow(repo, { enabled: true, showOn: "main" }), false);
assert.equal(context.shouldShow(repo, { enabled: true, showOn: "main_releases" }), true);
assert.equal(context.shouldShow(repo, { enabled: false, showOn: "all" }), false);

console.log("repository context tests: OK");
