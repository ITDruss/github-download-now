import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALLOWED_SOURCE_FILES } from "./build-files.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "src");

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
const chromium = JSON.parse(await readFile(path.join(source, "manifest.chromium.json"), "utf8"));
const firefox = JSON.parse(await readFile(path.join(source, "manifest.firefox.json"), "utf8"));

for (const [name, version] of [
  ["package-lock.json", lock.version],
  ["package-lock root package", lock.packages?.[""]?.version],
  ["Chromium manifest", chromium.version],
  ["Firefox manifest", firefox.version]
]) {
  assert(version === packageJson.version, `${name} version ${version} does not match ${packageJson.version}`);
}
assert(packageJson.private === true, "The npm package must remain private");
assert(packageJson.devDependencies?.["web-ext"] === "10.5.0", "web-ext must be pinned exactly");
assert(packageJson.devDependencies?.eslint === "10.7.0", "ESLint must be pinned exactly");
assert(packageJson.devDependencies?.globals === "17.7.0", "ESLint globals must be pinned exactly");
assert(packageJson.scripts?.["lint:firefox"], "Firefox lint script is required");
assert(packageJson.scripts?.["verify:reproducible"], "Reproducible-build verification is required");
assert(packageJson.scripts?.verify, "Combined verification script is required");
assert(packageJson.scripts?.["i18n:generate"], "Locale generation script is required");
assert(packageJson.scripts?.["i18n:check"], "Locale validation script is required");

const lockText = await readFile(path.join(root, "package-lock.json"), "utf8");
assert(!lockText.includes("applied-caas-gateway"), "package-lock.json contains an environment-specific npm registry");
for (const match of lockText.matchAll(/"resolved"\s*:\s*"(https:[^"]+)"/g)) {
  const resolved = new URL(match[1]);
  assert(resolved.hostname === "registry.npmjs.org", `package-lock.json contains a non-public npm registry: ${resolved.hostname}`);
}

const actual = await listFiles(source);
assert(JSON.stringify(actual) === JSON.stringify([...ALLOWED_SOURCE_FILES].sort()), "src/ contains unexpected or missing files");

for (const manifest of [chromium, firefox]) {
  assert(manifest.manifest_version === 3, "Manifest V3 is required");
  assert(manifest.default_locale === "en", "English must remain the default locale");
  assert(manifest.name === "__MSG_extensionName__", "Manifest name must use the locale catalog");
  assert(manifest.description === "__MSG_extensionDescription__", "Manifest description must use the locale catalog");
  assert(manifest.action?.default_title === "__MSG_extensionName__", "Action title must use the locale catalog");
  assert(JSON.stringify(manifest.permissions) === JSON.stringify(["storage", "alarms"]), "Unexpected required permissions");
  assert(JSON.stringify(manifest.optional_permissions) === JSON.stringify(["notifications"]), "Unexpected optional permissions");
  assert(JSON.stringify(manifest.host_permissions) === JSON.stringify(["https://api.github.com/*", "https://github.com/*"]), "Unexpected host permissions");
  assert(manifest.content_security_policy?.extension_pages === "script-src 'self'; object-src 'none'", "Strict extension CSP is required");
  const scripts = manifest.content_scripts?.[0]?.js || [];
  assert(JSON.stringify(scripts.slice(0, 6)) === JSON.stringify([
    "shared/messages.js", "shared/browser-api.js", "shared/formatting.js",
    "i18n-catalogs.js", "i18n.js", "settings.js"
  ]), "Shared contracts, browser adapter, formatting, locales and settings must load first in content scripts");
  assert(scripts.includes("url-policy.js") && scripts.indexOf("url-policy.js") < scripts.indexOf("content.js"), "URL policy must load before content.js");
  const contentModules = [
    "content/repository-context.js",
    "content/github-dom.js",
    "content/placement.js",
    "content/state.js",
    "content/page-client.js",
    "content/release/page-parser.js",
    "content/release/release-loader.js",
    "content/release/version-controller.js",
    "content/lifecycle.js"
  ];
  for (const contentModule of contentModules) {
    assert(scripts.includes(contentModule), `${contentModule} must be included in content scripts`);
    assert(scripts.indexOf(contentModule) < scripts.indexOf("content.js"), `${contentModule} must load before content.js`);
  }
  if (manifest.background?.scripts) {
    assert(JSON.stringify(manifest.background.scripts.slice(0, 5)) === JSON.stringify([
      "shared/messages.js", "shared/browser-api.js",
      "i18n-catalogs.js", "i18n.js", "settings.js"
    ]), "Shared contracts, browser adapter, locales and settings must load first in Firefox background scripts");
    assert(manifest.background.scripts.indexOf("github-auth.js") < manifest.background.scripts.indexOf("background.js"), "GitHub auth helpers must load before background.js");
  }
}

assert(JSON.stringify(firefox.browser_specific_settings?.gecko?.data_collection_permissions?.required) === JSON.stringify(["browsingActivity"]), "Firefox required data collection disclosure is incorrect");
assert(JSON.stringify(firefox.browser_specific_settings?.gecko?.data_collection_permissions?.optional) === JSON.stringify(["authenticationInfo"]), "Firefox optional authentication disclosure is incorrect");

const forbidden = [
  { pattern: /\beval\s*\(/, label: "eval" },
  { pattern: /\bnew\s+Function\s*\(/, label: "new Function" },
  { pattern: /importScripts\s*\(\s*["']https?:/i, label: "remote importScripts" },
  { pattern: /import\s*\(\s*["']https?:/i, label: "remote dynamic import" }
];
for (const relative of actual.filter((file) => file.endsWith(".js"))) {
  const text = await readFile(path.join(source, relative), "utf8");
  for (const item of forbidden) assert(!item.pattern.test(text), `${relative} contains forbidden ${item.label}`);
}

for (const relative of actual.filter((file) => file.endsWith(".html"))) {
  const text = await readFile(path.join(source, relative), "utf8");
  assert(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(text), `${relative} contains inline script`);
  assert(!/\son\w+\s*=/i.test(text), `${relative} contains inline event handler`);
}
for (const relative of ["popup.html", "options.html"]) {
  const text = await readFile(path.join(source, relative), "utf8");
  const orderedScripts = [
    "shared/messages.js", "shared/browser-api.js", "shared/formatting.js",
    "i18n-catalogs.js", "i18n.js", "settings.js"
  ];
  let previous = -1;
  for (const script of orderedScripts) {
    const current = text.indexOf(`src="${script}"`);
    assert(current > previous, `${relative} must load ${script} in the documented order`);
    previous = current;
  }
}

const privacy = await readFile(path.join(root, "PRIVACY.md"), "utf8");
const privacyPage = await readFile(path.join(root, "docs", "index.html"), "utf8");
assert(privacy.includes("Public repositories only"), "Privacy policy must state public-only support");
assert(privacy.includes("fails closed"), "Privacy policy must describe fail-closed visibility handling");
assert(privacyPage.includes("Public repositories only"), "Published privacy page is stale");
assert(privacyPage.includes("fails closed"), "Published privacy page must describe fail-closed visibility handling");
assert(privacy.includes("credentials: omit"), "Privacy policy must disclose anonymous GitHub page requests");
assert(privacyPage.includes("credentials: omit"), "Published privacy page must disclose anonymous GitHub page requests");
assert(privacyPage.includes("https://github.com/ITDruss/github-download-now/blob/main/PRIVACY.md"), "Published privacy page must link to the canonical policy");
assert(privacy.includes("OAuth Device Flow"), "Privacy policy must explain optional GitHub authorization");
assert(privacy.includes("not an encrypted credential vault"), "Privacy policy must disclose local token storage limitations");
assert(privacy.includes("requests no OAuth scopes"), "Privacy policy must disclose the scope-free authorization model");
assert(privacyPage.includes("OAuth Device Flow"), "Published privacy page must explain optional GitHub authorization");
assert(privacyPage.includes("not an encrypted credential vault"), "Published privacy page must disclose local token storage limitations");

const requirements = (await readFile(path.join(root, "requirements-dev.txt"), "utf8")).trim();
assert(requirements === "playwright==1.61.0", "Playwright must be pinned exactly");
const gitignore = await readFile(path.join(root, ".gitignore"), "utf8");
assert(gitignore.includes(".venv-ui/") && gitignore.includes("test-results/"), "Test environments and UI outputs must be ignored");

const workflowDirectory = path.join(root, ".github", "workflows");
const workflowNames = (await readdir(workflowDirectory)).filter((name) => /\.ya?ml$/i.test(name));
assert(workflowNames.includes("ci.yml"), "CI workflow is required");
assert(workflowNames.includes("release.yml"), "Release workflow is required");
assert(workflowNames.includes("codeql.yml"), "CodeQL workflow is required");
for (const workflowName of workflowNames) {
  const workflow = await readFile(path.join(workflowDirectory, workflowName), "utf8");
  for (const match of workflow.matchAll(/^\s*uses:\s*([^\s#]+).*$/gm)) {
    const reference = match[1];
    if (reference.startsWith("./")) continue;
    assert(/@[0-9a-f]{40}$/i.test(reference), `${workflowName} contains an unpinned action: ${reference}`);
  }
}
const ciWorkflow = await readFile(path.join(workflowDirectory, "ci.yml"), "utf8");
assert(ciWorkflow.includes("npm run test:ui"), "CI must run browser UI tests");
assert(ciWorkflow.includes("npm run lint:firefox"), "CI must run Firefox lint");
assert(ciWorkflow.includes("npm run verify:reproducible"), "CI must verify reproducible packages");
assert(ciWorkflow.includes("npm ci --ignore-scripts"), "CI must disable dependency lifecycle scripts");
assert(ciWorkflow.includes("persist-credentials: false"), "CI checkout credentials must not persist");
assert(ciWorkflow.includes("timeout-minutes:"), "CI jobs must have timeouts");
const releaseWorkflow = await readFile(path.join(workflowDirectory, "release.yml"), "utf8");
assert(releaseWorkflow.includes('Tag ${GITHUB_REF_NAME} does not match package version'), "Release workflow must verify the tag");
assert(releaseWorkflow.includes("actions/attest@"), "Release workflow must attest artifacts");
assert(releaseWorkflow.includes("github-download-now-source-v${VERSION}.zip"), "Release workflow must publish source code");
assert(releaseWorkflow.includes("--verify-tag"), "Release workflow must verify that the tag exists");
assert(releaseWorkflow.includes("test -s release-notes.md"), "Release workflow must reject empty release notes");
assert(releaseWorkflow.includes("persist-credentials: false"), "Release checkout credentials must not persist");
assert(releaseWorkflow.includes("npm ci --ignore-scripts"), "Release installs must disable dependency lifecycle scripts");

console.log(`Project validation: OK (v${packageJson.version})`);
