"use strict";

const assert = require("node:assert/strict");
const build = require("../src/build-instructions.js");

const candidates = build.chooseCandidates([
  { type: "file", name: "README.md", path: "README.md" },
  { type: "file", name: "BUILDING.md", path: "BUILDING.md" },
  { type: "file", name: "CONTRIBUTING.md", path: "docs/CONTRIBUTING.md" },
  { type: "file", name: "INSTALL.md", path: "docs/INSTALL.md" },
  { type: "file", name: "building.md", path: "/BUILDING.md" },
  { type: "dir", name: "docs", path: "docs" }
], 8);

assert.deepEqual(candidates.map((candidate) => candidate.path), [
  "BUILDING.md",
  "docs/INSTALL.md",
  "docs/CONTRIBUTING.md",
  "README.md"
]);
assert.equal(build.normalizePath("/docs/BUILDING.md/"), "docs/BUILDING.md");
assert.ok(build.candidateScore({ type: "file", path: "docs/BUILDING.md" }) > build.candidateScore({ type: "file", path: "README.md" }));
assert.equal(build.candidateScore({ type: "file", path: "SECURITY.md" }), Number.NEGATIVE_INFINITY);

const localSendReadme = `
# LocalSend

## Getting Started
Install Flutter and the platform tooling.

## Building

### Android
Run the Android build.

### Linux
Install Linux dependencies and build the bundle.

### Windows
Build the Windows application.
`;

const headings = build.parseMarkdownHeadings(localSendReadme);
assert.deepEqual(headings.map((heading) => heading.title), ["LocalSend", "Getting Started", "Building", "Android", "Linux", "Windows"]);
assert.equal(headings.find((heading) => heading.title === "Linux").anchor, "linux");

const linuxSections = build.chooseReadmeSections(localSendReadme, "linux", 4);
assert.equal(linuxSections[0].title, "Linux");
assert.equal(linuxSections[0].context, "Building → Linux");
assert.ok(linuxSections.some((section) => section.title === "Building"));

const androidSections = build.chooseReadmeSections(localSendReadme, "android", 2);
assert.equal(androidSections[0].title, "Android");

const ranked = build.rankDocuments([
  { path: "CONTRIBUTING.md", htmlUrl: "https://github.com/example/app/blob/v1/CONTRIBUTING.md", score: 92 },
  { path: "README.md", title: "Building → Linux", htmlUrl: "https://github.com/example/app/blob/v1/README.md#linux", score: 180 }
]);
assert.equal(ranked[0].title, "Building → Linux");

assert.equal(build.githubAnchor("<span>Building</span>"), "building");
assert.equal(build.githubAnchor("<<span>Building</span>"), "building");
assert.equal(
  build.githubAnchor("<span><em>Build Linux</em></span>"),
  "build-linux"
);

console.log("build documentation discovery tests: OK");
