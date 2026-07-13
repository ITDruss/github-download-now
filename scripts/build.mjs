import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "src");
const dist = path.join(root, "dist");

await rm(dist, { recursive: true, force: true });

for (const target of ["chromium", "firefox"]) {
  const output = path.join(dist, target);
  await mkdir(output, { recursive: true });
  await cp(source, output, { recursive: true });
  await rm(path.join(output, "manifest.chromium.json"), { force: true });
  await rm(path.join(output, "manifest.firefox.json"), { force: true });

  const manifestName = target === "chromium" ? "manifest.chromium.json" : "manifest.firefox.json";
  const manifest = await readFile(path.join(source, manifestName), "utf8");
  await writeFile(path.join(output, "manifest.json"), manifest);
  await cp(path.join(root, "README.md"), path.join(output, "README.md"));
  await cp(path.join(root, "LICENSE"), path.join(output, "LICENSE"));
  await cp(path.join(root, "THIRD_PARTY_NOTICES.md"), path.join(output, "THIRD_PARTY_NOTICES.md"));
}

console.log("Built dist/chromium and dist/firefox");
