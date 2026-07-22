import { readdir } from "node:fs/promises";
import path from "node:path";

export async function listFiles(directory, prefix = "") {
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

export function lineCount(text) {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}
