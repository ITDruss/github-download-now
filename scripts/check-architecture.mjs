import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALLOWED_SOURCE_FILES } from "./build-files.mjs";
import { assert, lineCount } from "./file-utils.mjs";
import {
  BACKGROUND_IMPORTS,
  CONTENT_SCRIPTS,
  CONTENT_STYLES,
  ENTRY_LINE_LIMITS,
  FIREFOX_BACKGROUND_SCRIPTS,
  GENERATED_SOURCE_FILES,
  OPTIONS_SCRIPTS,
  POPUP_SCRIPTS,
  SOURCE_LINE_LIMITS
} from "./project-structure.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "src");
const javascriptFiles = ALLOWED_SOURCE_FILES.filter((file) => file.endsWith(".js"));
const definitions = new Map();
const references = new Map();

function arraysEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function scriptsFromHtml(text) {
  return [...text.matchAll(/<script\s+[^>]*src="([^"]+)"[^>]*><\/script>/gi)].map((match) => match[1]);
}

function contextFor(relative) {
  if (relative === "content.js" || relative.startsWith("content/")) return "content";
  if (relative === "background.js" || relative.startsWith("background/")) return "background";
  if (relative === "popup.js" || relative.startsWith("popup/")) return "popup";
  if (relative === "options.js" || relative.startsWith("options/")) return "options";
  return "shared";
}

for (const relative of ALLOWED_SOURCE_FILES) {
  if (!/\.(?:js|css|html)$/.test(relative)) continue;
  const text = await readFile(path.join(source, relative), "utf8");
  const lines = lineCount(text);
  const entryLimit = ENTRY_LINE_LIMITS[relative];
  if (entryLimit) assert(lines <= entryLimit, `${relative} has ${lines} lines; entry limit is ${entryLimit}`);
  if (relative.endsWith(".js") && !GENERATED_SOURCE_FILES.has(relative) && !entryLimit) {
    assert(lines <= SOURCE_LINE_LIMITS.javascript, `${relative} has ${lines} lines; JavaScript limit is ${SOURCE_LINE_LIMITS.javascript}`);
  }
  if (relative.endsWith(".css")) {
    assert(lines <= SOURCE_LINE_LIMITS.css, `${relative} has ${lines} lines; CSS limit is ${SOURCE_LINE_LIMITS.css}`);
  }
  if (relative.endsWith(".html")) {
    assert(lines <= SOURCE_LINE_LIMITS.html, `${relative} has ${lines} lines; HTML limit is ${SOURCE_LINE_LIMITS.html}`);
  }
}

for (const relative of javascriptFiles) {
  const text = await readFile(path.join(source, relative), "utf8");
  if (relative !== "shared/messages.js") {
    assert(!/["']GHDN_[A-Z0-9_]+["']/.test(text), `${relative} contains a raw runtime-message type`);
  }

  const defined = [...text.matchAll(/\broot\.(GHDN[A-Za-z0-9_]+)\s*=\s*(?:api|app|Object\.freeze)/g)].map((match) => match[1]);
  const referenced = [...text.matchAll(/\bglobalThis\.(GHDN[A-Za-z0-9_]+)/g)].map((match) => match[1]);
  references.set(relative, referenced);
  for (const name of defined) {
    assert(!definitions.has(name), `${name} is defined by both ${definitions.get(name)} and ${relative}`);
    definitions.set(name, relative);
  }

  const expectedDefinitions = new Set(["content.js", "popup.js", "options.js"]);
  if (!expectedDefinitions.has(relative)) {
    assert(defined.length === 1, `${relative} must expose exactly one GHDN module API`);
    if (relative !== "i18n-catalogs.js") {
      assert(text.includes("module.exports"), `${relative} must expose its production API to Node tests`);
    }
  } else {
    assert(defined.length === 0, `${relative} must remain an entry script without a global module export`);
  }

  const directBrowserApi = /\b(?:browser|chrome)\.(?:runtime|storage|tabs|permissions|notifications|alarms)\b/.test(text);
  if (relative !== "shared/browser-api.js") {
    assert(!directBrowserApi, `${relative} bypasses shared/browser-api.js`);
  }

  const context = contextFor(relative);
  for (const name of referenced) {
    if (context === "content") assert(!/^GHDN(?:Background|Popup|Options)/.test(name), `${relative} depends on another runtime context: ${name}`);
    if (context === "background") assert(!/^GHDN(?:Content|Popup|Options)/.test(name), `${relative} depends on another runtime context: ${name}`);
    if (context === "popup") assert(!/^GHDN(?:Content|Background|Options)/.test(name), `${relative} depends on another runtime context: ${name}`);
    if (context === "options") assert(!/^GHDN(?:Content|Background|Popup)/.test(name), `${relative} depends on another runtime context: ${name}`);
    if (context === "shared") assert(!/^GHDN(?:Content|Background|Popup|Options)/.test(name), `${relative} makes shared code depend on a runtime context: ${name}`);
  }
}

for (const [relative, names] of references) {
  for (const name of names) assert(definitions.has(name), `${relative} references undefined global API ${name}`);
}

const dependencyGraph = new Map(javascriptFiles.map((relative) => [relative, new Set()]));
for (const [relative, names] of references) {
  for (const name of names) {
    const dependency = definitions.get(name);
    if (dependency && dependency !== relative) dependencyGraph.get(relative).add(dependency);
  }
}

const visiting = new Set();
const visited = new Set();
function visit(relative, stack = []) {
  if (visiting.has(relative)) {
    const cycleStart = stack.indexOf(relative);
    const cycle = [...stack.slice(cycleStart), relative].join(" -> ");
    throw new Error(`Architecture check failed: module dependency cycle: ${cycle}`);
  }
  if (visited.has(relative)) return;
  visiting.add(relative);
  for (const dependency of dependencyGraph.get(relative) || []) visit(dependency, [...stack, relative]);
  visiting.delete(relative);
  visited.add(relative);
}
for (const relative of javascriptFiles) visit(relative);

function assertDependencyOrder(label, orderedFiles) {
  const positions = new Map(orderedFiles.map((relative, index) => [relative, index]));
  for (const relative of orderedFiles) {
    for (const dependency of dependencyGraph.get(relative) || []) {
      if (!positions.has(dependency)) continue;
      assert(positions.get(dependency) < positions.get(relative), `${label} loads ${relative} before dependency ${dependency}`);
    }
  }
}

const chromium = JSON.parse(await readFile(path.join(source, "manifest.chromium.json"), "utf8"));
const firefox = JSON.parse(await readFile(path.join(source, "manifest.firefox.json"), "utf8"));
assert(arraysEqual(chromium.content_scripts?.[0]?.js || [], CONTENT_SCRIPTS), "Chromium content script order differs from project-structure.mjs");
assert(arraysEqual(firefox.content_scripts?.[0]?.js || [], CONTENT_SCRIPTS), "Firefox content script order differs from project-structure.mjs");
assert(arraysEqual(chromium.content_scripts?.[0]?.css || [], CONTENT_STYLES), "Chromium content style order differs from project-structure.mjs");
assert(arraysEqual(firefox.content_scripts?.[0]?.css || [], CONTENT_STYLES), "Firefox content style order differs from project-structure.mjs");
assert(arraysEqual(firefox.background?.scripts || [], FIREFOX_BACKGROUND_SCRIPTS), "Firefox background order differs from project-structure.mjs");
assertDependencyOrder("content scripts", CONTENT_SCRIPTS);
assertDependencyOrder("Firefox background scripts", FIREFOX_BACKGROUND_SCRIPTS);
assertDependencyOrder("popup scripts", POPUP_SCRIPTS);
assertDependencyOrder("options scripts", OPTIONS_SCRIPTS);

const backgroundEntry = await readFile(path.join(source, "background.js"), "utf8");
for (const relative of BACKGROUND_IMPORTS) {
  assert(backgroundEntry.includes(`"${relative}"`), `background.js does not load ${relative} for Chromium`);
}
assert(!/(?:async\s+)?function\s+(?:getRelease|checkAllUpdates|pollGitHubAuthorization|recordDownload)\b/.test(backgroundEntry), "background.js contains service implementation logic");

for (const [htmlFile, expected] of [["popup.html", POPUP_SCRIPTS], ["options.html", OPTIONS_SCRIPTS]]) {
  const html = await readFile(path.join(source, htmlFile), "utf8");
  assert(arraysEqual(scriptsFromHtml(html), expected), `${htmlFile} script order differs from project-structure.mjs`);
}

const contentEntry = await readFile(path.join(source, "content.js"), "utf8");
for (const forbiddenName of ["startDownload", "loadBuildInstructions", "handlePrimaryClick", "handleMenuClick", "refreshPlacement"]) {
  assert(!new RegExp(`(?:async\\s+)?function\\s+${forbiddenName}\\b`).test(contentEntry), `${forbiddenName} must not return to content.js`);
}

console.log(`Architecture audit: OK (${javascriptFiles.length} JavaScript files, ${definitions.size} module APIs)`);
