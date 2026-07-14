import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = execFileSync(process.execPath, ["scripts/release-notes.mjs", "1.0.0"], {
  cwd: root,
  encoding: "utf8"
});

assert.match(output, /### Added/);
assert.match(output, /strict URL-origin/i);
assert.doesNotMatch(output, /## \[0\.4\.3\]/);
assert.throws(() => {
  execFileSync(process.execPath, ["scripts/release-notes.mjs", "999.0.0"], {
    cwd: root,
    stdio: "pipe"
  });
});

console.log("release notes tests: OK");
