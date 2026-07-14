import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALLOWED_SOURCE_FILES, EXTENSION_FILES } from "./build-files.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "src");
const dist = path.join(root, "dist");

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(absolute, relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files.sort();
}

const actual = await listFiles(source);
const allowed = new Set(ALLOWED_SOURCE_FILES);
const unknown = actual.filter((file) => !allowed.has(file));
const missing = ALLOWED_SOURCE_FILES.filter((file) => !actual.includes(file));
if (unknown.length || missing.length) {
  throw new Error([
    unknown.length ? `Unexpected src files: ${unknown.join(", ")}` : "",
    missing.length ? `Missing src files: ${missing.join(", ")}` : ""
  ].filter(Boolean).join("\n"));
}

await rm(dist, { recursive: true, force: true });

for (const target of ["chromium", "firefox"]) {
  const output = path.join(dist, target);
  await mkdir(output, { recursive: true });

  for (const relative of EXTENSION_FILES) {
    const destination = path.join(output, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(path.join(source, relative), destination);
  }

  const manifestName = target === "chromium" ? "manifest.chromium.json" : "manifest.firefox.json";
  const manifest = await readFile(path.join(source, manifestName), "utf8");
  await writeFile(path.join(output, "manifest.json"), manifest);
  await cp(path.join(root, "README.md"), path.join(output, "README.md"));
  await cp(path.join(root, "LICENSE"), path.join(output, "LICENSE"));
  await cp(path.join(root, "THIRD_PARTY_NOTICES.md"), path.join(output, "THIRD_PARTY_NOTICES.md"));
}

console.log("Built allowlisted dist/chromium and dist/firefox");
