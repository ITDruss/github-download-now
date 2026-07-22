import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listFiles } from "./file-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testsRoot = path.join(root, "tests");
const testFiles = (await listFiles(testsRoot))
  .filter((file) => /\.test\.(?:js|mjs)$/.test(file));

if (!testFiles.length) throw new Error("No Node test files were discovered");

for (const relative of testFiles) {
  const result = spawnSync(process.execPath, [path.join("tests", relative)], {
    cwd: root,
    stdio: "inherit",
    env: process.env
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`Node test files: OK (${testFiles.length})`);
