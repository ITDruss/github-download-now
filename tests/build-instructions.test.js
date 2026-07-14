"use strict";

const assert = require("node:assert/strict");
const build = require("../src/build-instructions.js");

const candidates = build.chooseCandidates([
  { type: "file", name: "README.md", path: "README.md" },
  { type: "file", name: "BUILDING.md", path: "BUILDING.md" },
  { type: "file", name: "CONTRIBUTING.md", path: "docs/CONTRIBUTING.md" },
  { type: "dir", name: "docs", path: "docs" }
], 2);

assert.equal(candidates[0].path, "BUILDING.md");
assert.equal(candidates[1].path, "docs/CONTRIBUTING.md");

const markdown = `# Example

General description.

## Build from source

Install dependencies and run the build command.

\`\`\`bash
npm ci
npm run build
\`\`\`

## Usage

Run the app.
`;

const extracted = build.extractFromMarkdown(markdown, {
  path: "README.md",
  htmlUrl: "https://github.com/example/app/blob/v1/README.md"
});
assert.equal(extracted.found, true);
assert.equal(extracted.title, "Build from source");
assert.equal(extracted.commands.length, 1);
assert.ok(extracted.commands[0].code.includes("npm run build"));
assert.ok(extracted.summary.includes("Install dependencies"));
assert.equal(extracted.source.path, "README.md");

const dedicated = build.extractFromMarkdown(`Prerequisites\n\n\`\`\`sh\nmake release\n\`\`\``, {
  path: "BUILDING.md"
});
assert.equal(dedicated.found, true);
assert.equal(dedicated.confidence, "medium");
assert.equal(dedicated.commands[0].code, "make release");

const missing = build.extractFromMarkdown("# Example\n\nNothing about compilation here.", {
  path: "README.md"
});
assert.equal(missing.found, false);

console.log("build instructions tests: OK");
