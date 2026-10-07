(function initBatchAssets(root, factory) {
  const api = factory();
  root.GHDNBatchAssets = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBatchAssetsApi() {
  "use strict";
  const MAX_ASSETS = 500;
  const COMPOUND = [".tar.bz2", ".tar.gz", ".tar.xz", ".tar.zst"];

  function extension(name) {
    const lower = String(name || "").toLowerCase();
    const compound = COMPOUND.find(value => lower.endsWith(value));
    if (compound) return compound;
    const dot = lower.lastIndexOf(".");
    return dot > 0 && dot < lower.length - 1 ? lower.slice(dot) : "";
  }

  function matches(asset, query = "", extensions = []) {
    return String(asset.name || "").toLowerCase().includes(String(query).trim().toLowerCase()) &&
      (!extensions.length || extensions.includes(extension(asset.name)));
  }

  function safeName(value) {
    let clean = String(value || "").replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "_")
      .replace(/^[. ]+|[. ]+$/g, "").slice(0, 180).replace(/[. ]+$/g, "");
    if (!clean) clean = "asset";
    if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(clean)) clean = `_${clean}`;
    return clean;
  }

  function filename(batch, item, index) {
    return `GitHub-Download-Now/${safeName(batch.owner)}-${safeName(batch.repo)}/${batch.id}/${String(index + 1).padStart(3, "0")}-${safeName(item.name)}`;
  }

  function active(batch) {
    return Boolean(batch?.items?.some(item => ["queued", "starting", "in_progress"].includes(item.state)));
  }

  function normalizeBatch(raw, urlPolicy) {
    if (!raw || !/^[a-f0-9-]{36}$/i.test(String(raw.id || ""))) return null;
    const repo = urlPolicy.repository(raw.owner, raw.repo);
    if (!repo || !raw.tag || typeof raw.tag !== "string" || raw.tag.length > 240) return null;
    if (!Array.isArray(raw.items) || !raw.items.length || raw.items.length > MAX_ASSETS) return null;
    const states = new Set(["queued", "starting", "in_progress", "complete", "interrupted", "canceled"]);
    const batch = { id: raw.id, owner: repo.owner, repo: repo.repo, tag: raw.tag,
      canceled: Boolean(raw.canceled), createdAt: String(raw.createdAt || ""), items: [] };
    const seen = new Set();
    for (const item of raw.items) {
      const trusted = urlPolicy.releaseAsset(item?.url, repo.owner, repo.repo, batch.tag);
      if (!trusted || seen.has(trusted.href)) return null;
      seen.add(trusted.href);
      batch.items.push({ url: trusted.href, name: trusted.name, size: Math.max(0, Number(item.size) || 0),
        state: states.has(item.state) ? item.state : "interrupted",
        downloadId: Number.isInteger(item.downloadId) && item.downloadId >= 0 ? item.downloadId : null,
        error: String(item.error || "").slice(0, 120) });
    }
    return batch;
  }

  return Object.freeze({ MAX_ASSETS, extension, matches, safeName, filename, active, normalizeBatch });
});
