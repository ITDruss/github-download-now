import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALLOWED_SOURCE_FILES } from "./build-files.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const javascriptFiles = ALLOWED_SOURCE_FILES.filter((file) => file.endsWith(".js"));

for (const relative of javascriptFiles) {
  const result = spawnSync(process.execPath, ["--check", path.join("src", relative)], {
    cwd: root,
    stdio: "inherit",
    env: process.env
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`JavaScript syntax: OK (${javascriptFiles.length} files)`);
