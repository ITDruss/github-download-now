(function initBuildInstructions(root, factory) {
  const api = factory();
  root.GHDNBuildInstructions = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createBuildInstructions() {
  "use strict";

  const FILE_SCORES = new Map([
    ["building.md", 140],
    ["building.rst", 138],
    ["build.md", 136],
    ["build.rst", 134],
    ["compiling.md", 132],
    ["compile.md", 130],
    ["development.md", 124],
    ["developing.md", 122],
    ["developer.md", 120],
    ["hacking.md", 118],
    ["install.md", 112],
    ["installation.md", 110],
    ["contributing.md", 104],
    ["readme.md", 70],
    ["readme.rst", 68],
    ["readme", 66]
  ]);

  function normalizePath(value) {
    return String(value || "").replace(/^\/+|\/+$/g, "");
  }

  function basename(path) {
    const normalized = normalizePath(path);
    return normalized.split("/").pop() || "";
  }

  function candidateScore(entry) {
    if (!entry || entry.type !== "file") return Number.NEGATIVE_INFINITY;

    const path = normalizePath(entry.path || entry.name).toLowerCase();
    const name = basename(path);
    let score = FILE_SCORES.get(name) || 0;

    if (!score) {
      if (/^(build|building|compile|compiling|development|developer|install|installation|contributing)(\.|$)/i.test(name)) {
        score = 96;
      } else if (/^readme(?:\.|$)/i.test(name)) {
        score = 62;
      }
    }

    if (!score) return Number.NEGATIVE_INFINITY;

    const depth = path.split("/").length - 1;
    if (/^(docs?|documentation)\//i.test(path)) score += 10;
    if (/(^|\/)(build|building|compile|compiling|install|installation)([-_.]|\/|$)/i.test(path)) score += 8;
    score -= depth * 2;

    return score;
  }

  function chooseCandidates(entries, limit = 5) {
    const unique = new Map();

    for (const entry of Array.isArray(entries) ? entries : []) {
      const path = normalizePath(entry && (entry.path || entry.name));
      if (!path || !entry || entry.type !== "file") continue;

      const score = candidateScore({ ...entry, path });
      if (!Number.isFinite(score)) continue;

      const key = path.toLowerCase();
      const current = unique.get(key);
      if (!current || score > current.score) {
        unique.set(key, { ...entry, path, score });
      }
    }

    const ranked = [...unique.values()]
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
    const dedicated = ranked.filter((candidate) => candidate.score >= 90);
    const selected = dedicated.length ? dedicated : ranked;

    return selected.slice(0, Math.max(1, Number(limit) || 5));
  }

  return {
    chooseCandidates,
    candidateScore,
    normalizePath
  };
});
