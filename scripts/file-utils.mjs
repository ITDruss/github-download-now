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

export function scriptsFromHtml(text) {
  const sources = [];

  for (const match of text.matchAll(/<script\b[^>]*>/gi)) {
    const sourceMatch = match[0].match(
      /\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/i
    );
    const source = sourceMatch?.[1] ?? sourceMatch?.[2];

    if (source) sources.push(source);
  }

  return sources;
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}
