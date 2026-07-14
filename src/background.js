"use strict";

if (typeof importScripts === "function") {
  if (!globalThis.GHDNSettings) importScripts("settings.js");
  if (!globalThis.GHDNAssetSelector) importScripts("asset-selector.js");
  if (!globalThis.GHDNTracker) importScripts("tracker.js");
  if (!globalThis.GHDNUrlPolicy) importScripts("url-policy.js");
  if (!globalThis.GHDNBuildInstructions) importScripts("build-instructions.js");
}

const extensionApi = typeof browser !== "undefined" ? browser : chrome;
const settingsApi = globalThis.GHDNSettings;
const selector = globalThis.GHDNAssetSelector;
const tracker = globalThis.GHDNTracker;
const buildInstructions = globalThis.GHDNBuildInstructions;
const urlPolicy = globalThis.GHDNUrlPolicy;
const CACHE_TTL_MS = 5 * 60 * 1000;
const BUILD_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 50;
const UPDATE_BATCH_SIZE = 8;
const MAX_RELEASE_ASSETS = 500;
const MAX_API_RESPONSE_CHARS = 8_000_000;
const MAX_BUILD_DOCUMENT_CHARS = 2_000_000;
const releaseCache = new Map();
const buildInstructionsCache = new Map();
const VALID_PART = /^[A-Za-z0-9_.-]{1,100}$/;
const UPDATE_ALARM = "ghdn-update-check";
const NOTIFICATION_PREFIX = "ghdn-update:";
const SUMMARY_NOTIFICATION = "ghdn-updates-summary";
const INTERVAL_MINUTES = Object.freeze({ "6h": 360, "24h": 1440, "72h": 4320, "168h": 10080 });

function setLimitedCache(cache, key, value) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
}

function sanitizeAsset(asset, owner, repo, expectedTag) {
  if (!asset || typeof asset !== "object") return null;
  if (asset.state && asset.state !== "uploaded") return null;
  const trusted = urlPolicy && urlPolicy.releaseAsset(
    asset.browser_download_url,
    owner,
    repo,
    expectedTag
  );
  if (!trusted) return null;
  return {
    id: Number(asset.id) || null,
    name: trusted.name.slice(0, 300),
    size: Math.max(0, Number(asset.size) || 0),
    state: "uploaded",
    content_type: String(asset.content_type || "application/octet-stream").slice(0, 200),
    download_count: Math.max(0, Number(asset.download_count) || 0),
    browser_download_url: trusted.href,
    created_at: String(asset.created_at || "").slice(0, 80),
    updated_at: String(asset.updated_at || "").slice(0, 80)
  };
}

function sanitizeRelease(release, owner, repo) {
  if (!release || typeof release !== "object" || !urlPolicy) return null;
  const tag = validGitRef(release.tag_name);
  if (tag === null || !tag) return null;
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  const encodedTag = encodeURIComponent(tag);
  const releaseUrl = urlPolicy.releaseTag(release.html_url, owner, repo);
  const trustedReleaseUrl = releaseUrl && releaseUrl.tag === tag
    ? releaseUrl.href
    : `https://github.com/${encodedOwner}/${encodedRepo}/releases/tag/${encodedTag}`;
  const zipUrl = urlPolicy.apiArchive(release.zipball_url, owner, repo);
  const tarUrl = urlPolicy.apiArchive(release.tarball_url, owner, repo);
  return {
    id: Number(release.id) || null,
    tag_name: tag,
    name: String(release.name || tag).slice(0, 300),
    html_url: trustedReleaseUrl,
    published_at: String(release.published_at || "").slice(0, 80),
    created_at: String(release.created_at || "").slice(0, 80),
    draft: Boolean(release.draft),
    prerelease: Boolean(release.prerelease),
    assets: Array.isArray(release.assets)
      ? release.assets.slice(0, MAX_RELEASE_ASSETS).map((asset) => sanitizeAsset(asset, owner, repo, tag)).filter(Boolean)
      : [],
    zipball_url: zipUrl ? zipUrl.href : `https://api.github.com/repos/${encodedOwner}/${encodedRepo}/zipball/${encodedTag}`,
    tarball_url: tarUrl ? tarUrl.href : `https://api.github.com/repos/${encodedOwner}/${encodedRepo}/tarball/${encodedTag}`
  };
}

function numericHeader(response, name) {
  const raw = response.headers.get(name);
  if (raw === null || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function rateLimitDetails(response) {
  const limit = numericHeader(response, "x-ratelimit-limit");
  const remaining = numericHeader(response, "x-ratelimit-remaining");
  const used = numericHeader(response, "x-ratelimit-used");
  const resetRaw = numericHeader(response, "x-ratelimit-reset");
  const resetAt = Number.isFinite(resetRaw) && resetRaw > 0
    ? new Date(resetRaw * 1000).toISOString()
    : null;
  return {
    limit,
    remaining,
    used,
    resetAt
  };
}

async function fetchJson(url, options = {}) {
  const trusted = urlPolicy && urlPolicy.apiUrl(url);
  if (!trusted) return { ok: false, error: "untrusted_url" };
  const headers = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (options.etag) headers["If-None-Match"] = options.etag;

  const response = await fetch(trusted.href, {
    method: "GET",
    headers,
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer"
  });
  if (!urlPolicy.apiUrl(response.url || trusted.href)) return { ok: false, error: "untrusted_redirect" };
  const rateLimit = rateLimitDetails(response);
  if (response.status === 304) {
    return {
      ok: true,
      notModified: true,
      etag: options.etag || response.headers.get("etag") || "",
      rateLimit
    };
  }

  if (!response.ok) {
    if (response.status === 404) return { ok: false, error: "no_release", status: 404, rateLimit };
    if ((response.status === 403 || response.status === 429) && (rateLimit.remaining === 0 || response.status === 429)) {
      return { ok: false, error: "rate_limited", status: response.status, resetAt: rateLimit.resetAt, rateLimit };
    }
    return { ok: false, error: "github_api_error", status: response.status, rateLimit };
  }

  const contentLength = numericHeader(response, "content-length");
  if (contentLength !== null && contentLength > MAX_API_RESPONSE_CHARS) {
    return { ok: false, error: "response_too_large", status: 413, rateLimit };
  }
  const text = await response.text();
  if (text.length > MAX_API_RESPONSE_CHARS) {
    return { ok: false, error: "response_too_large", status: 413, rateLimit };
  }
  try {
    return {
      ok: true,
      data: JSON.parse(text),
      etag: response.headers.get("etag") || "",
      rateLimit
    };
  } catch (_error) {
    return { ok: false, error: "invalid_response", status: 502, rateLimit };
  }
}

async function getRelease(owner, repo, platform, releaseChannel, options = {}) {
  if (!VALID_PART.test(owner) || !VALID_PART.test(repo)) return { ok: false, error: "invalid_repository" };

  const channel = releaseChannel === "newest" ? "newest" : "stable";
  const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}:${channel}`;
  const cached = releaseCache.get(cacheKey);
  if (!options.force && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return buildResponse(cached.release, platform, true, cached.etag, null);
  }

  const encoded = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const url = channel === "newest"
    ? `https://api.github.com/repos/${encoded}/releases?per_page=20`
    : `https://api.github.com/repos/${encoded}/releases/latest`;
  const result = await fetchJson(url, { etag: options.etag });
  if (!result.ok || result.notModified) return result;

  let release;
  if (channel === "newest") {
    const candidates = Array.isArray(result.data) ? result.data.filter((item) => item && !item.draft) : [];
    if (!candidates.length) return { ok: false, error: "no_release", status: 404 };
    release = sanitizeRelease(candidates[0], owner, repo);
  } else {
    release = sanitizeRelease(result.data, owner, repo);
  }
  if (!release) return { ok: false, error: "invalid_response", status: 502, rateLimit: result.rateLimit || null };

  setLimitedCache(releaseCache, cacheKey, { timestamp: Date.now(), release, etag: result.etag || "" });
  return buildResponse(release, platform, false, result.etag || "", result.rateLimit);
}

async function getReleaseByTag(owner, repo, requestedTag, platform, options = {}) {
  if (!VALID_PART.test(owner) || !VALID_PART.test(repo)) {
    return { ok: false, error: "invalid_repository" };
  }

  const tag = validGitRef(requestedTag);
  if (tag === null || !tag) return { ok: false, error: "invalid_ref" };

  const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}:tag:${tag}`;
  const cached = releaseCache.get(cacheKey);
  if (!options.force && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return buildResponse(cached.release, platform, true, cached.etag, null);
  }

  const encoded = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const url = `https://api.github.com/repos/${encoded}/releases/tags/${encodeURIComponent(tag)}`;
  const result = await fetchJson(url, { etag: options.etag });
  if (!result.ok || result.notModified) return result;

  const release = sanitizeRelease(result.data, owner, repo);
  if (!release) return { ok: false, error: "invalid_response", status: 502, rateLimit: result.rateLimit || null };
  setLimitedCache(releaseCache, cacheKey, { timestamp: Date.now(), release, etag: result.etag || "" });
  return buildResponse(release, platform, false, result.etag || "", result.rateLimit);
}

function buildResponse(release, platform, fromCache, etag = "", rateLimit = null) {
  const selection = selector.recommendation(release.assets, platform || {});
  return {
    ok: true,
    release,
    rankedAssets: selection.ranked,
    recommendation: {
      best: selection.best,
      confidence: selection.confidence,
      gap: Number.isFinite(selection.gap) ? selection.gap : null
    },
    fromCache,
    etag,
    rateLimit
  };
}


async function fetchText(url) {
  const trusted = urlPolicy && urlPolicy.apiUrl(url);
  if (!trusted) return { ok: false, error: "untrusted_url" };
  const response = await fetch(trusted.href, {
    method: "GET",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    headers: {
      "Accept": "application/vnd.github.raw+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (!urlPolicy.apiUrl(response.url || trusted.href)) return { ok: false, error: "untrusted_redirect" };
  const rateLimit = rateLimitDetails(response);

  if (!response.ok) {
    if (response.status === 404) return { ok: false, error: "not_found", status: 404, rateLimit };
    if ((response.status === 403 || response.status === 429) && (rateLimit.remaining === 0 || response.status === 429)) {
      return { ok: false, error: "rate_limited", status: response.status, resetAt: rateLimit.resetAt, rateLimit };
    }
    return { ok: false, error: "github_api_error", status: response.status, rateLimit };
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BUILD_DOCUMENT_CHARS) {
    return { ok: false, error: "document_too_large", status: 413, rateLimit };
  }
  const text = await response.text();
  if (text.length > MAX_BUILD_DOCUMENT_CHARS) {
    return { ok: false, error: "document_too_large", status: 413, rateLimit };
  }
  return { ok: true, text, rateLimit };
}

function validGitRef(value) {
  const ref = String(value || "").trim();
  if (!ref) return "";
  if (ref.length > 240 || /[\u0000-\u001f\u007f]/.test(ref)) return null;
  return ref;
}

function contentsUrl(owner, repo, path = "", ref = "") {
  const encodedRepository = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const encodedPath = String(path || "")
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");
  const suffix = encodedPath ? `/contents/${encodedPath}` : "/contents";
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  return `https://api.github.com/repos/${encodedRepository}${suffix}${query}`;
}

function sanitizeContentEntry(entry, owner, repo) {
  if (!entry || typeof entry !== "object") return null;
  const type = entry.type === "dir" ? "dir" : entry.type === "file" ? "file" : "";
  const path = String(entry.path || entry.name || "").replace(/^\/+|\/+$/g, "");
  const pathParts = path.split("/");
  if (
    !type ||
    !path ||
    path.length > 500 ||
    path.includes("\0") ||
    path.includes("\\") ||
    pathParts.some((part) => !part || part === "." || part === "..")
  ) return null;
  const htmlUrl = urlPolicy && urlPolicy.repositoryWebUrl(entry.html_url, owner, repo);
  return {
    type,
    name: String(entry.name || path.split("/").pop() || "").slice(0, 240),
    path,
    html_url: htmlUrl ? htmlUrl.href : ""
  };
}

async function getContentDirectory(owner, repo, path, ref) {
  const result = await fetchJson(contentsUrl(owner, repo, path, ref));
  if (!result.ok) return result;
  const entries = Array.isArray(result.data)
    ? result.data.map((entry) => sanitizeContentEntry(entry, owner, repo)).filter(Boolean)
    : [];
  return { ok: true, entries, rateLimit: result.rateLimit || null };
}

async function getBuildInstructions(owner, repo, requestedRef = "", platformInput = {}) {
  if (!VALID_PART.test(owner) || !VALID_PART.test(repo)) return { ok: false, error: "invalid_repository" };
  if (!buildInstructions || !urlPolicy) return { ok: false, error: "internal_error" };

  const ref = validGitRef(requestedRef);
  if (ref === null) return { ok: false, error: "invalid_ref" };
  const platform = String(platformInput && platformInput.os || "unknown").toLowerCase();
  const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}:${ref || "default"}:${platform}`;
  const cached = buildInstructionsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < BUILD_CACHE_TTL_MS) return { ...cached.value, fromCache: true };

  let refUsed = ref;
  let rootResult = await getContentDirectory(owner, repo, "", refUsed);
  let usedDefaultBranchFallback = false;
  if (!rootResult.ok && rootResult.status === 404 && refUsed) {
    refUsed = "";
    usedDefaultBranchFallback = true;
    rootResult = await getContentDirectory(owner, repo, "", "");
  }
  if (!rootResult.ok) return rootResult;

  const entries = [...rootResult.entries];
  const docsDirectories = rootResult.entries.filter((entry) => entry.type === "dir" && /^(docs?|documentation)$/i.test(entry.name));
  for (const directory of docsDirectories.slice(0, 2)) {
    const docsResult = await getContentDirectory(owner, repo, directory.path, refUsed);
    if (!docsResult.ok) {
      if (docsResult.error === "rate_limited") break;
      continue;
    }
    entries.push(...docsResult.entries);
  }

  const candidates = buildInstructions.chooseCandidates(entries, 10);
  const discovered = [];
  for (const candidate of candidates) {
    const trusted = urlPolicy.repositoryWebUrl(candidate.html_url, owner, repo);
    if (!trusted) continue;
    if (!buildInstructions.isReadme(candidate.path)) {
      discovered.push({
        type: "file",
        path: candidate.path,
        title: candidate.path,
        htmlUrl: trusted.href,
        score: candidate.score
      });
      continue;
    }

    const raw = await fetchText(contentsUrl(owner, repo, candidate.path, refUsed));
    if (raw.ok) {
      const sections = buildInstructions.chooseReadmeSections(raw.text, platform, 5);
      for (const section of sections) {
        discovered.push({
          type: "section",
          path: candidate.path,
          title: section.context || section.title,
          htmlUrl: `${trusted.href}#${section.anchor}`,
          score: section.score + Math.min(20, candidate.score / 5)
        });
      }
    }
    discovered.push({
      type: "file",
      path: candidate.path,
      title: candidate.path,
      htmlUrl: trusted.href,
      score: candidate.score - 12
    });
  }

  const documents = buildInstructions.rankDocuments(discovered, 6).map(({ type, path, title, htmlUrl }) => ({ type, path, title, htmlUrl }));
  const repositoryUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const value = {
    ok: true,
    found: documents.length > 0,
    documents,
    recommended: documents[0] || null,
    repositoryUrl,
    platform,
    refRequested: ref,
    refUsed: refUsed || "default",
    usedDefaultBranchFallback,
    checked: candidates.map((candidate) => candidate.path)
  };
  setLimitedCache(buildInstructionsCache, cacheKey, { timestamp: Date.now(), value });
  return value;
}

function chromeStorageGet(area, defaults) {
  return new Promise((resolve, reject) => {
    area.get(defaults, (items) => {
      const error = extensionApi.runtime && extensionApi.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(items);
    });
  });
}

function chromeStorageSet(area, values) {
  return new Promise((resolve, reject) => {
    area.set(values, () => {
      const error = extensionApi.runtime && extensionApi.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

async function localGet(defaults) {
  if (typeof browser !== "undefined") return extensionApi.storage.local.get(defaults);
  return chromeStorageGet(extensionApi.storage.local, defaults);
}

async function localSet(values) {
  if (typeof browser !== "undefined") return extensionApi.storage.local.set(values);
  return chromeStorageSet(extensionApi.storage.local, values);
}

function trustedReleasePage(value, owner, repo, expectedTag) {
  const release = urlPolicy && urlPolicy.releaseTag(value, owner, repo);
  return release && (!expectedTag || release.tag === expectedTag) ? release : null;
}

function trustedReleaseAsset(value, owner, repo, expectedTag) {
  return urlPolicy && urlPolicy.releaseAsset(value, owner, repo, expectedTag || "");
}

function trustedDownload(entry) {
  const clean = tracker.sanitizeDownload(entry);
  if (!clean || !urlPolicy || !clean.releaseTag) return null;
  const asset = urlPolicy.download(clean.assetUrl, clean.owner, clean.repo);
  const release = trustedReleasePage(clean.releaseUrl, clean.owner, clean.repo, clean.releaseTag);
  if (!asset || !release) return null;
  if (asset.tag && asset.tag !== clean.releaseTag) return null;
  return { ...clean, assetUrl: asset.href, releaseUrl: release.href };
}

function trustedWatch(entry) {
  const clean = tracker.sanitizeWatch(entry);
  if (!clean || !urlPolicy) return null;
  const currentAsset = clean.currentAssetUrl
    ? trustedReleaseAsset(clean.currentAssetUrl, clean.owner, clean.repo, clean.currentTag)
    : null;
  if (clean.currentAssetUrl && !currentAsset) return null;
  return { ...clean, currentAssetUrl: currentAsset ? currentAsset.href : "" };
}

function trustedUpdate(entry) {
  const clean = tracker.sanitizeUpdate(entry);
  if (!clean || !urlPolicy || !clean.releaseTag) return null;
  const release = trustedReleasePage(clean.releaseUrl, clean.owner, clean.repo, clean.releaseTag);
  const asset = clean.assetUrl
    ? trustedReleaseAsset(clean.assetUrl, clean.owner, clean.repo, clean.releaseTag)
    : null;
  if (!release || (clean.assetUrl && !asset)) return null;
  return {
    ...clean,
    releaseUrl: release.href,
    assetUrl: asset ? asset.href : ""
  };
}

function normalizedTrackerMeta(value) {
  const source = value && typeof value === "object" ? value : {};
  const cursor = Math.max(0, Number(source.watchCursor) || 0);
  const remaining = Number(source.apiRateLimitRemaining);
  const limit = Number(source.apiRateLimitLimit);
  return {
    ...source,
    watchCursor: cursor,
    apiRateLimitRemaining: Number.isFinite(remaining) ? remaining : null,
    apiRateLimitLimit: Number.isFinite(limit) ? limit : null,
    apiRateLimitResetAt: typeof source.apiRateLimitResetAt === "string" ? source.apiRateLimitResetAt : null
  };
}

async function readTrackerState() {
  const data = await localGet({
    [tracker.HISTORY_KEY]: [],
    [tracker.WATCHES_KEY]: [],
    [tracker.UPDATES_KEY]: [],
    [tracker.META_KEY]: {}
  });
  return {
    history: Array.isArray(data[tracker.HISTORY_KEY]) ? data[tracker.HISTORY_KEY].map(trustedDownload).filter(Boolean) : [],
    watches: Array.isArray(data[tracker.WATCHES_KEY]) ? data[tracker.WATCHES_KEY].map(trustedWatch).filter(Boolean) : [],
    updates: Array.isArray(data[tracker.UPDATES_KEY]) ? data[tracker.UPDATES_KEY].map(trustedUpdate).filter(Boolean) : [],
    meta: normalizedTrackerMeta(data[tracker.META_KEY])
  };
}

async function writeTrackerState(patch) {
  const values = {};
  if (patch.history) values[tracker.HISTORY_KEY] = patch.history;
  if (patch.watches) values[tracker.WATCHES_KEY] = patch.watches;
  if (patch.updates) values[tracker.UPDATES_KEY] = patch.updates;
  if (patch.meta) values[tracker.META_KEY] = patch.meta;
  if (Object.keys(values).length) await localSet(values);
}

function downloadFromPayload(payload) {
  return trustedDownload({
    ...payload,
    downloadedAt: payload && payload.downloadedAt || new Date().toISOString()
  });
}

async function recordDownload(payload, sender = null) {
  if (sender && sender.tab && sender.tab.incognito) return { ok: true, incognito: true, watchState: "none" };
  const download = downloadFromPayload(payload);
  if (!download) return { ok: false, error: "invalid_download" };

  const settings = await settingsApi.get();
  const state = await readTrackerState();
  let history = state.history;
  let watches = state.watches;
  let updates = state.updates;
  if (settings.historyEnabled) history = tracker.addHistory(history, download);

  const existing = watches.find((item) => item.key === download.key);
  let watchState = "none";
  if (existing || settings.afterDownload === "always") {
    const watch = tracker.watchFromDownload(download, existing);
    watches = tracker.upsertWatch(watches, watch);
    updates = tracker.removeUpdate(updates, download.key);
    watchState = "watching";
  } else if (settings.afterDownload === "ask") {
    watchState = "prompt";
  }

  await writeTrackerState({ history, watches, updates });
  await updateBadge(updates, settings);
  return { ok: true, watchState, download };
}

async function watchRepository(payload) {
  const download = downloadFromPayload(payload);
  if (!download) return { ok: false, error: "invalid_repository" };
  const state = await readTrackerState();
  const existing = state.watches.find((item) => item.key === download.key);
  const watch = tracker.watchFromDownload(download, existing);
  const watches = tracker.upsertWatch(state.watches, watch);
  const updates = tracker.removeUpdate(state.updates, download.key);
  await writeTrackerState({ watches, updates });
  await updateBadge(updates);
  await ensureUpdateAlarm();
  return { ok: true, watch };
}

async function unwatchRepository(key) {
  const state = await readTrackerState();
  const watches = tracker.removeWatch(state.watches, key);
  const updates = tracker.removeUpdate(state.updates, key);
  await writeTrackerState({ watches, updates });
  await updateBadge(updates);
  return { ok: true };
}

function updateFromRelease(watch, response) {
  const release = response.release;
  const best = response.recommendation && response.recommendation.best;
  const compatible = Boolean(best && response.recommendation.confidence !== "low");
  return tracker.sanitizeUpdate({
    key: watch.key,
    owner: watch.owner,
    repo: watch.repo,
    fromReleaseId: watch.currentReleaseId,
    fromTag: watch.currentTag,
    releaseId: release.id,
    releaseTag: release.tag_name,
    releaseName: release.name,
    releaseUrl: release.html_url,
    releasePublishedAt: release.published_at,
    releasePrerelease: release.prerelease,
    assetId: compatible ? best.id : null,
    assetName: compatible ? best.name : "",
    assetUrl: compatible ? best.browser_download_url : "",
    assetExtension: compatible ? (best.extension || selector.detectExtension(best.name)) : "",
    assetSize: compatible ? best.size : 0,
    compatibleAssetFound: compatible,
    detectedAt: new Date().toISOString()
  });
}

async function checkAllUpdates(options = {}) {
  const state = await readTrackerState();
  const settings = await settingsApi.get();
  if (!settings.enabled) {
    return { ok: true, disabled: true, detected: [], errors: [], watches: state.watches, updates: state.updates, meta: state.meta };
  }

  const now = Date.now();
  const resetTime = Date.parse(state.meta.apiRateLimitResetAt || "");
  if (state.meta.apiRateLimitRemaining === 0 && Number.isFinite(resetTime) && resetTime > now) {
    return {
      ok: true,
      rateLimited: true,
      detected: [],
      errors: [{ error: "rate_limited", resetAt: state.meta.apiRateLimitResetAt }],
      watches: state.watches,
      updates: state.updates,
      meta: state.meta
    };
  }

  let watches = state.watches.slice();
  let updates = state.updates.slice();
  const detected = [];
  const errors = [];
  const total = watches.length;
  const startCursor = total ? Math.min(state.meta.watchCursor % total, total - 1) : 0;
  const targetCount = Math.min(UPDATE_BATCH_SIZE, total);
  let processed = 0;
  let lastRateLimit = null;

  for (let offset = 0; offset < targetCount; offset += 1) {
    const index = (startCursor + offset) % total;
    const watch = watches[index];
    let response;
    try {
      response = await getRelease(watch.owner, watch.repo, watch.platform, watch.releaseChannel, {
        force: true,
        etag: watch.etag
      });
    } catch (_error) {
      errors.push({ key: watch.key, error: "network_error" });
      processed += 1;
      continue;
    }

    processed += 1;
    if (response.rateLimit) lastRateLimit = response.rateLimit;
    const checkedAt = new Date().toISOString();

    if (response.notModified) {
      watches[index] = trustedWatch({ ...watch, lastCheckedAt: checkedAt }) || watch;
    } else if (!response.ok) {
      errors.push({ key: watch.key, error: response.error, resetAt: response.resetAt || null });
      watches[index] = trustedWatch({ ...watch, lastCheckedAt: checkedAt }) || watch;
      if (response.error === "rate_limited") break;
    } else {
      const release = response.release;
      const oldPending = updates.find((item) => item.key === watch.key);
      const isDifferentFromCurrent = Number(release.id) !== Number(watch.currentReleaseId);
      const isNewDetection = isDifferentFromCurrent && (!oldPending || Number(oldPending.releaseId) !== Number(release.id));

      watches[index] = trustedWatch({
        ...watch,
        lastCheckedReleaseId: release.id,
        lastCheckedTag: release.tag_name,
        lastCheckedAt: checkedAt,
        etag: response.etag || watch.etag || "",
        lastNotifiedReleaseId: isNewDetection ? release.id : watch.lastNotifiedReleaseId,
        updatedAt: checkedAt
      }) || watch;

      if (isDifferentFromCurrent) {
        const pending = trustedUpdate(updateFromRelease(watch, response));
        if (pending) {
          updates = tracker.upsertUpdate(updates, pending);
          if (isNewDetection) detected.push(pending);
        }
      } else {
        updates = tracker.removeUpdate(updates, watch.key);
      }
    }

    if (lastRateLimit && Number.isFinite(lastRateLimit.remaining) && lastRateLimit.remaining <= 1) break;
  }

  const nextCursor = total ? (startCursor + processed) % total : 0;
  const completedCycle = total === 0 || processed >= total;
  const meta = normalizedTrackerMeta({
    ...state.meta,
    watchCursor: nextCursor,
    lastCheckAt: new Date().toISOString(),
    lastCheckSource: options.manual ? "manual" : "alarm",
    lastCheckErrors: errors.length,
    lastCheckErrorDetails: errors.slice(0, 10),
    lastCheckChecked: processed,
    lastCheckTotal: total,
    lastCheckComplete: completedCycle,
    apiRateLimitLimit: lastRateLimit && lastRateLimit.limit,
    apiRateLimitRemaining: lastRateLimit && lastRateLimit.remaining,
    apiRateLimitResetAt: lastRateLimit && lastRateLimit.resetAt
  });

  await writeTrackerState({ watches, updates, meta });
  await updateBadge(updates, settings);
  if (detected.length) await notifyUpdates(detected, settings);
  return { ok: true, detected, errors, watches, updates, meta, checked: processed, total };
}

async function dismissUpdate(key) {
  const state = await readTrackerState();
  const update = state.updates.find((item) => item.key === key);
  if (!update) return { ok: false, error: "update_not_found" };
  const watches = state.watches.map((item) => item.key === key ? tracker.sanitizeWatch({
    ...item,
    currentReleaseId: update.releaseId,
    currentTag: update.releaseTag,
    currentPublishedAt: update.releasePublishedAt,
    lastCheckedReleaseId: update.releaseId,
    lastCheckedTag: update.releaseTag,
    updatedAt: new Date().toISOString()
  }) : item);
  const updates = tracker.removeUpdate(state.updates, key);
  await writeTrackerState({ watches, updates });
  await updateBadge(updates);
  return { ok: true };
}

async function downloadUpdate(key) {
  const state = await readTrackerState();
  const update = state.updates.find((item) => item.key === key);
  const watch = state.watches.find((item) => item.key === key);
  if (!update || !watch || !update.assetUrl) return { ok: false, error: "asset_not_found" };

  const download = trustedDownload({
    owner: update.owner,
    repo: update.repo,
    releaseId: update.releaseId,
    releaseTag: update.releaseTag,
    releaseName: update.releaseName,
    releaseUrl: update.releaseUrl,
    releasePublishedAt: update.releasePublishedAt,
    releasePrerelease: update.releasePrerelease,
    assetId: update.assetId,
    assetName: update.assetName,
    assetUrl: update.assetUrl,
    assetExtension: update.assetExtension,
    assetSize: update.assetSize,
    platform: watch.platform,
    releaseChannel: watch.releaseChannel,
    downloadedAt: new Date().toISOString()
  });

  if (!download) return { ok: false, error: "untrusted_url" };
  const settings = await settingsApi.get();
  const history = settings.historyEnabled ? tracker.addHistory(state.history, download) : state.history;
  const watches = tracker.upsertWatch(state.watches, tracker.watchFromDownload(download, watch));
  const updates = tracker.removeUpdate(state.updates, key);
  await writeTrackerState({ history, watches, updates });
  await updateBadge(updates, settings);
  const trustedAsset = urlPolicy.download(update.assetUrl, update.owner, update.repo);
  if (!trustedAsset) return { ok: false, error: "untrusted_url" };
  await openTab(trustedAsset.href);
  return { ok: true };
}

async function getDashboard() {
  const state = await readTrackerState();
  return {
    ok: true,
    history: state.history,
    watches: state.watches,
    updates: state.updates,
    meta: state.meta,
    limits: { history: tracker.MAX_HISTORY, watches: tracker.MAX_WATCHES }
  };
}

async function clearHistory() {
  await writeTrackerState({ history: [] });
  return { ok: true };
}

async function clearTracking() {
  await writeTrackerState({ watches: [], updates: [] });
  await updateBadge([]);
  return { ok: true };
}

async function hasNotificationPermission() {
  if (!extensionApi.permissions || !extensionApi.permissions.contains) return false;
  if (typeof browser !== "undefined") return extensionApi.permissions.contains({ permissions: ["notifications"] });
  return new Promise((resolve) => { extensionApi.permissions.contains({ permissions: ["notifications"] }, resolve); });
}

async function createNotification(id, options) {
  if (!extensionApi.notifications || !extensionApi.notifications.create) return;
  if (typeof browser !== "undefined") await extensionApi.notifications.create(id, options);
  else await new Promise((resolve) => { extensionApi.notifications.create(id, options, resolve); });
}

async function notifyUpdates(updates, settings) {
  if (!settings.notificationsEnabled || !updates.length || !(await hasNotificationPermission())) return;
  const iconUrl = extensionApi.runtime.getURL("icons/icon-128.png");
  if (updates.length === 1) {
    const update = updates[0];
    const assetText = update.compatibleAssetFound ? update.assetName : "No matching asset found";
    await createNotification(`${NOTIFICATION_PREFIX}${encodeURIComponent(update.key)}`, {
      type: "basic",
      iconUrl,
      title: `${update.repo} ${update.releaseTag || "new release"}`,
      message: `${update.fromTag || "Previous release"} → ${update.releaseTag || "New release"}\n${assetText}`
    });
    return;
  }
  const names = updates.slice(0, 3).map((item) => item.repo).join(", ");
  const extra = updates.length > 3 ? ` +${updates.length - 3}` : "";
  await createNotification(SUMMARY_NOTIFICATION, {
    type: "basic",
    iconUrl,
    title: `${updates.length} GitHub updates available`,
    message: `${names}${extra}`
  });
}

async function updateBadge(updatesArg = null, settingsArg = null) {
  const action = extensionApi.action || extensionApi.browserAction;
  if (!action || !action.setBadgeText) return;
  const settings = settingsArg || await settingsApi.get();
  const updates = updatesArg || (await readTrackerState()).updates;
  const text = settings.enabled && settings.badgeEnabled && updates.length ? String(Math.min(updates.length, 99)) : "";
  const title = updates.length ? `${updates.length} update${updates.length === 1 ? "" : "s"} available` : "GitHub Download Now";
  try {
    await action.setBadgeText({ text });
    if (action.setBadgeBackgroundColor) await action.setBadgeBackgroundColor({ color: "#1f883d" });
    if (action.setTitle) await action.setTitle({ title });
  } catch (_error) {}
}


async function openOptionsPage() {
  if (extensionApi.runtime && typeof extensionApi.runtime.openOptionsPage === "function") {
    try {
      await extensionApi.runtime.openOptionsPage();
      return { ok: true };
    } catch (_error) {}
  }
  const url = extensionApi.runtime.getURL("options.html");
  if (extensionApi.tabs && extensionApi.tabs.create) {
    if (typeof browser !== "undefined") await extensionApi.tabs.create({ url });
    else await new Promise((resolve) => { extensionApi.tabs.create({ url }, resolve); });
    return { ok: true, fallback: true };
  }
  return { ok: false, error: "options_unavailable" };
}

async function openTab(value) {
  const trusted = urlPolicy && urlPolicy.repositoryWebUrl(value);
  if (!trusted) return { ok: false, error: "untrusted_url" };
  if (typeof browser !== "undefined") await extensionApi.tabs.create({ url: trusted.href });
  else await new Promise((resolve) => { extensionApi.tabs.create({ url: trusted.href }, resolve); });
  return { ok: true };
}

async function getAlarm(name) {
  if (!extensionApi.alarms || !extensionApi.alarms.get) return null;
  if (typeof browser !== "undefined") return extensionApi.alarms.get(name);
  return new Promise((resolve) => { extensionApi.alarms.get(name, resolve); });
}

async function clearAlarm(name) {
  if (!extensionApi.alarms || !extensionApi.alarms.clear) return false;
  if (typeof browser !== "undefined") return extensionApi.alarms.clear(name);
  return new Promise((resolve) => { extensionApi.alarms.clear(name, resolve); });
}

async function createAlarm(name, alarmInfo) {
  if (!extensionApi.alarms || !extensionApi.alarms.create) return;
  extensionApi.alarms.create(name, alarmInfo);
}

async function ensureUpdateAlarm() {
  if (!extensionApi.alarms || !extensionApi.alarms.create) return;
  const settings = await settingsApi.get();
  const periodInMinutes = settings.enabled ? INTERVAL_MINUTES[settings.updateCheckInterval] : 0;
  const existing = await getAlarm(UPDATE_ALARM);

  if (!periodInMinutes) {
    if (existing) await clearAlarm(UPDATE_ALARM);
    return;
  }

  if (existing && Number(existing.periodInMinutes) === periodInMinutes) return;
  if (existing) await clearAlarm(UPDATE_ALARM);
  await createAlarm(UPDATE_ALARM, { delayInMinutes: Math.min(5, periodInMinutes), periodInMinutes });
}

async function initializeBackground() {
  await ensureUpdateAlarm();
  await updateBadge();
}

extensionApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return false;
  let operation;
  switch (message.type) {
    case "GHDN_GET_LATEST_RELEASE":
      operation = getRelease(message.owner, message.repo, message.platform, message.releaseChannel);
      break;
    case "GHDN_GET_RELEASE_BY_TAG":
      operation = getReleaseByTag(message.owner, message.repo, message.tag, message.platform);
      break;
    case "GHDN_GET_BUILD_INSTRUCTIONS":
      operation = getBuildInstructions(message.owner, message.repo, message.ref, message.platform);
      break;
    case "GHDN_RECORD_DOWNLOAD":
      operation = recordDownload(message.download, sender);
      break;
    case "GHDN_WATCH_REPOSITORY":
      operation = watchRepository(message.download);
      break;
    case "GHDN_UNWATCH_REPOSITORY":
      operation = unwatchRepository(message.key);
      break;
    case "GHDN_GET_DASHBOARD":
      operation = getDashboard();
      break;
    case "GHDN_CHECK_UPDATES":
      operation = checkAllUpdates({ manual: true });
      break;
    case "GHDN_DISMISS_UPDATE":
      operation = dismissUpdate(message.key);
      break;
    case "GHDN_DOWNLOAD_UPDATE":
      operation = downloadUpdate(message.key);
      break;
    case "GHDN_OPEN_URL":
      operation = openTab(message.url);
      break;
    case "GHDN_OPEN_OPTIONS":
      operation = openOptionsPage();
      break;
    case "GHDN_CLEAR_HISTORY":
      operation = clearHistory();
      break;
    case "GHDN_CLEAR_TRACKING":
      operation = clearTracking();
      break;
    default:
      return false;
  }

  Promise.resolve(operation)
    .then(sendResponse)
    .catch((error) => {
      console.error("GitHub Download Now:", error);
      sendResponse({ ok: false, error: "internal_error" });
    });
  return true;
});

if (extensionApi.alarms && extensionApi.alarms.onAlarm) {
  extensionApi.alarms.onAlarm.addListener((alarm) => {
    if (alarm && alarm.name === UPDATE_ALARM) checkAllUpdates({ manual: false }).catch(console.error);
  });
}

if (extensionApi.runtime.onInstalled) extensionApi.runtime.onInstalled.addListener(() => initializeBackground().catch(console.error));
if (extensionApi.runtime.onStartup) extensionApi.runtime.onStartup.addListener(() => initializeBackground().catch(console.error));

if (extensionApi.storage && extensionApi.storage.onChanged) {
  extensionApi.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") return;
    if (changes.updateCheckInterval || changes.enabled) ensureUpdateAlarm().catch(console.error);
    if (changes.badgeEnabled || changes.enabled) updateBadge().catch(console.error);
  });
}

if (extensionApi.notifications && extensionApi.notifications.onClicked) {
  extensionApi.notifications.onClicked.addListener((notificationId) => {
    if (notificationId === SUMMARY_NOTIFICATION) {
      const url = extensionApi.runtime.getURL("popup.html#updates");
      if (typeof browser !== "undefined") extensionApi.tabs.create({ url });
      else extensionApi.tabs.create({ url });
      return;
    }
    if (!notificationId.startsWith(NOTIFICATION_PREFIX)) return;
    const key = decodeURIComponent(notificationId.slice(NOTIFICATION_PREFIX.length));
    readTrackerState().then((state) => {
      const update = state.updates.find((item) => item.key === key);
      if (update) return openTab(update.releaseUrl);
    }).catch(console.error);
  });
}

initializeBackground().catch(console.error);
