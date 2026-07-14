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
], 5);

assert.deepEqual(
  candidates.map((candidate) => candidate.path),
  ["BUILDING.md", "docs/INSTALL.md", "docs/CONTRIBUTING.md"]
);
assert.ok(candidates.every((candidate) => candidate.score >= 90));
assert.equal(build.normalizePath("/docs/BUILDING.md/"), "docs/BUILDING.md");
assert.ok(
  build.candidateScore({ type: "file", path: "docs/BUILDING.md" }) >
  build.candidateScore({ type: "file", path: "README.md" })
);
assert.equal(
  build.candidateScore({ type: "file", path: "SECURITY.md" }),
  Number.NEGATIVE_INFINITY
);

const readmeFallback = build.chooseCandidates([
  { type: "file", name: "README.md", path: "README.md" },
  { type: "file", name: "README.rst", path: "docs/README.rst" },
  { type: "file", name: "SECURITY.md", path: "SECURITY.md" }
], 5);
assert.deepEqual(
  readmeFallback.map((candidate) => candidate.path),
  ["docs/README.rst", "README.md"]
);

console.log("build documentation discovery tests: OK");
