"use strict";

const assert = require("node:assert/strict");
const dom = require("../../src/content/github-dom.js");
const urlPolicy = require("../../src/url-policy.js");

function element(attributes = {}, textContent = "") {
  return {
    isConnected: true,
    textContent,
    parentElement: null,
    getAttribute(name) { return attributes[name] ?? null; },
    closest() { return null; },
    getBoundingClientRect() { return { width: 100, height: 32 }; }
  };
}

assert.equal(dom.actionKind(element({ href: "/owner/repo/stargazers" }, "12")), "star");
assert.equal(dom.actionKind(element({ "aria-label": "Fork repository" })), "fork");
assert.equal(dom.actionKind(element({ title: "Watch repository" })), "watch");
assert.equal(dom.actionKind(element({ "aria-label": "Sponsor owner" })), "sponsor");
assert.equal(dom.actionKind(element({}, "Issues")), "");
assert.equal(dom.normalizedActionText(element({ title: "  Star   repository " }, "  10 ")), "Star repository 10");
assert.equal(dom.isVisibleElement(element(), { getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }) }), true);
assert.equal(dom.isVisibleElement(element(), { getComputedStyle: () => ({ display: "none", visibility: "visible", opacity: "1" }) }), false);

const repo = { owner: "owner", repo: "repo" };
const link = element({ href: "/owner/repo/releases/tag/v1.2.3" }, "v1.2.3");
assert.equal(dom.releaseTagFromLink(link, repo, urlPolicy), "v1.2.3");
assert.equal(dom.releaseTagFromLink(element({ href: "https://evil.example/owner/repo/releases/tag/v1.2.3" }), repo, urlPolicy), "");

console.log("GitHub DOM tests: OK");
