process.stdout.on("error", (error) => {
  if (error && error.code === "EPIPE") process.exit(0);
  throw error;
});

import { readFile } from "node:fs/promises";

const version = String(process.argv[2] || "").replace(/^v/, "");
if (!version) throw new Error("Usage: node scripts/release-notes.mjs <version>");

const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const lines = changelog.replace(/\r\n?/g, "\n").split("\n");
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const headingPattern = new RegExp(`^## \\[${escaped}\\](?:\\s+-\\s+.*)?\\s*$`);
const start = lines.findIndex((line) => headingPattern.test(line));
if (start < 0) throw new Error(`No CHANGELOG section found for ${version}`);

let end = lines.length;
for (let index = start + 1; index < lines.length; index += 1) {
  if (/^## \[[^\]]+\]/.test(lines[index])) {
    end = index;
    break;
  }
}

const notes = lines.slice(start + 1, end).join("\n").trim();
if (!notes) throw new Error(`CHANGELOG section for ${version} is empty`);
process.stdout.write(`${notes}\n`);
