(function initBuildInstructions(root, factory) {
  const api = factory();
  root.GHDNBuildInstructions = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBuildInstructions() {
  "use strict";

  const FILE_SCORES = new Map([
    ["building.md", 150], ["building.rst", 148],
    ["build.md", 146], ["build.rst", 144],
    ["compiling.md", 142], ["compile.md", 140],
    ["development.md", 132], ["developing.md", 130], ["developer.md", 128],
    ["hacking.md", 124], ["install.md", 120], ["installation.md", 118],
    ["contributing.md", 92],
    ["readme.md", 76], ["readme.rst", 74], ["readme", 72]
  ]);

  const HEADING_PATTERNS = [
    { pattern: /\b(build(?:ing)?(?:\s+from\s+source)?|compile|compilation|сборк[аи]|компиляц)/i, score: 145 },
    { pattern: /\b(development\s+(?:setup|environment)|developer\s+setup|local\s+development|разработк[аи])/i, score: 125 },
    { pattern: /\b(getting\s+started|quick\s+start|начало\s+работы|быстрый\s+старт)/i, score: 92 },
    { pattern: /\b(install(?:ation)?\s+from\s+source|установка\s+из\s+исход)/i, score: 136 }
  ];

  const PLATFORM_ALIASES = {
    linux: ["linux", "ubuntu", "debian", "fedora", "arch", "unix", "gnu/linux"],
    windows: ["windows", "win32", "win64"],
    macos: ["macos", "mac os", "osx", "darwin"],
    android: ["android"]
  };

  function normalizePath(value) {
    return String(value || "").replace(/^\/+|\/+$/g, "");
  }

  function basename(path) {
    const normalized = normalizePath(path);
    return normalized.split("/").pop() || "";
  }

  function isReadme(path) {
    return /^readme(?:\.|$)/i.test(basename(path));
  }

  function candidateScore(entry) {
    if (!entry || entry.type !== "file") return Number.NEGATIVE_INFINITY;
    const path = normalizePath(entry.path || entry.name).toLowerCase();
    const name = basename(path);
    let score = FILE_SCORES.get(name) || 0;

    if (!score) {
      if (/^(build|building|compile|compiling|development|developer|install|installation|contributing)(\.|$)/i.test(name)) score = 104;
      else if (/^readme(?:\.|$)/i.test(name)) score = 68;
    }
    if (!score) return Number.NEGATIVE_INFINITY;

    const depth = path.split("/").length - 1;
    if (/^(docs?|documentation)\//i.test(path)) score += 10;
    if (/(^|\/)(build|building|compile|compiling|install|installation)([-_.]|\/|$)/i.test(path)) score += 8;
    score -= depth * 2;
    return score;
  }

  function chooseCandidates(entries, limit = 8) {
    const unique = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
      const path = normalizePath(entry && (entry.path || entry.name));
      if (!path || !entry || entry.type !== "file") continue;
      const score = candidateScore({ ...entry, path });
      if (!Number.isFinite(score)) continue;
      const key = path.toLowerCase();
      const current = unique.get(key);
      if (!current || score > current.score) unique.set(key, { ...entry, path, score });
    }

    const ranked = [...unique.values()].sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
    const dedicated = ranked.filter((candidate) => !isReadme(candidate.path));
    const readmes = ranked.filter((candidate) => isReadme(candidate.path));
    return [...dedicated, ...readmes].slice(0, Math.max(1, Number(limit) || 8));
  }

  function stripHtmlTags(value) {
    let output = "";
    let insideTag = false;

    for (const character of String(value || "")) {
      if (character === "<") {
        insideTag = true;
        continue;
      }
      if (character === ">") {
        insideTag = false;
        continue;
      }
      if (!insideTag) output += character;
    }

    return output;
  }

  function githubAnchor(text) {
    return stripHtmlTags(text)
      .trim()
      .toLowerCase()
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function headingBaseScore(title) {
    for (const entry of HEADING_PATTERNS) {
      if (entry.pattern.test(title)) return entry.score;
    }
    return Number.NEGATIVE_INFINITY;
  }

  function platformScore(title, platform) {
    const aliases = PLATFORM_ALIASES[String(platform || "").toLowerCase()] || [];
    const normalized = String(title || "").toLowerCase();
    return aliases.some((alias) => normalized.includes(alias)) ? 42 : 0;
  }

  function parseMarkdownHeadings(markdown) {
    const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
    const headings = [];
    const stack = [];
    const anchorCounts = new Map();
    let fenced = false;

    function push(level, title) {
      const clean = String(title || "")
        .replace(/\s+#+\s*$/, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[*_`~]/g, "")
        .trim();
      if (!clean) return;
      stack.length = Math.max(0, level - 1);
      stack[level - 1] = clean;
      let anchor = githubAnchor(clean);
      const count = anchorCounts.get(anchor) || 0;
      anchorCounts.set(anchor, count + 1);
      if (count) anchor = `${anchor}-${count}`;
      headings.push({ level, title: clean, anchor, parents: stack.slice(0, level - 1).filter(Boolean) });
    }

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
      if (fenced) continue;
      const atx = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/);
      if (atx) { push(atx[1].length, atx[2]); continue; }
      if (index + 1 < lines.length && /^\s{0,3}(=+|-+)\s*$/.test(lines[index + 1]) && line.trim()) {
        push(lines[index + 1].trim().startsWith("=") ? 1 : 2, line.trim());
        index += 1;
      }
    }
    return headings;
  }

  function chooseReadmeSections(markdown, platform = "unknown", limit = 4) {
    const headings = parseMarkdownHeadings(markdown);
    const results = [];
    for (const heading of headings) {
      const contextParents = [...heading.parents];
      if (
        contextParents.length > 1 &&
        !Number.isFinite(headingBaseScore(contextParents[0]))
      ) {
        contextParents.shift();
      }
      const context = [...contextParents, heading.title].join(" → ");
      let score = Math.max(headingBaseScore(heading.title), headingBaseScore(context));
      if (!Number.isFinite(score)) continue;
      score += platformScore(heading.title, platform);
      score += platformScore(context, platform) * 0.5;
      score -= Math.max(0, heading.level - 2) * 2;
      results.push({ ...heading, context, score });
    }
    return results
      .sort((a, b) => b.score - a.score || a.level - b.level || a.title.localeCompare(b.title))
      .slice(0, Math.max(1, Number(limit) || 4));
  }

  const GUIDED_LINK_PATTERNS = [
    { pattern: /\b(c\s*\/\s*c\+\+|c\+\+|python|java|javascript|typescript|rust|go)\s+api\b/i, score: 155 },
    { pattern: /\b(api|sdk|library|libraries|bindings?|native)\b/i, score: 132 },
    { pattern: /\b(build(?:ing)?|compile|compilation|development|developer|source)\b/i, score: 118 },
    { pattern: /\b(docs?|documentation|guide)\b/i, score: 82 }
  ];

  function safeRepositoryPath(value) {
    const decoded = String(value || "").trim().replace(/^\/+|\/+$/g, "");
    if (!decoded || decoded.length > 500 || decoded.includes("\\") || decoded.includes("\0")) return "";
    const parts = decoded.split("/");
    if (parts.some((part) => !part || part === "." || part === "..")) return "";
    return parts.join("/");
  }

  function markdownLinks(markdown) {
    const text = String(markdown || "").replace(/\r\n?/g, "\n");
    const definitions = new Map();
    const links = [];
    let fenced = false;
    const visible = [];

    for (const line of text.split("\n")) {
      if (/^\s*(```|~~~)/.test(line)) { fenced = !fenced; continue; }
      if (fenced) continue;
      const definition = line.match(/^\s{0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))(?:\s+.*)?$/);
      if (definition) {
        definitions.set(definition[1].trim().toLowerCase(), String(definition[2] || definition[3] || "").trim());
        continue;
      }
      visible.push(line);
    }

    const body = visible.join("\n");
    for (const match of body.matchAll(/(?<!!)\[([^\]]+)\]\((?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\)/g)) {
      links.push({ label: match[1].trim(), target: String(match[2] || match[3] || "").trim() });
    }
    for (const match of body.matchAll(/(?<!!)\[([^\]]+)\]\[([^\]]*)\]/g)) {
      const label = match[1].trim();
      const key = String(match[2] || label).trim().toLowerCase();
      const target = definitions.get(key);
      if (target) links.push({ label, target });
    }
    return links;
  }

  function decodePathname(value) {
    try { return decodeURIComponent(value); } catch (_error) { return value; }
  }

  function resolveGuidedTarget(target, currentPath, owner, repo) {
    const raw = String(target || "").trim();
    if (!raw || raw.startsWith("#") || /^(?:mailto|javascript|data):/i.test(raw)) return null;
    let path = "";
    let typeHint = "";

    try {
      const url = new URL(raw, "https://github.com/");
      const absoluteRepositoryPath = raw.startsWith(`/${owner}/${repo}/`);
      if (/^https?:/i.test(raw) || absoluteRepositoryPath) {
        if (url.protocol !== "https:" || url.hostname !== "github.com") return null;
        const parts = url.pathname.split("/").filter(Boolean).map(decodePathname);
        if (parts.length < 5) return null;
        if (parts[0].toLowerCase() !== String(owner || "").toLowerCase()) return null;
        if (parts[1].toLowerCase() !== String(repo || "").toLowerCase()) return null;
        if (parts[2] !== "blob" && parts[2] !== "tree") return null;
        typeHint = parts[2] === "tree" ? "dir" : "file";
        path = parts.slice(4).join("/");
      } else {
        const withoutFragment = raw.split("#", 1)[0].split("?", 1)[0];
        const baseParts = normalizePath(currentPath).split("/").filter(Boolean);
        if (baseParts.length) baseParts.pop();
        const relativeParts = withoutFragment.split("/").filter(Boolean);
        const combined = withoutFragment.startsWith("/") ? relativeParts : [...baseParts, ...relativeParts];
        const stack = [];
        for (const part of combined) {
          const decoded = decodePathname(part);
          if (!decoded || decoded === ".") continue;
          if (decoded === "..") { if (!stack.length) return null; stack.pop(); continue; }
          stack.push(decoded);
        }
        path = stack.join("/");
      }
    } catch (_error) {
      return null;
    }

    path = safeRepositoryPath(path);
    if (!path) return null;
    const extension = basename(path).toLowerCase();
    const isDocument = /^(?:readme|build|building|compile|compiling|development|developer|install|installation|contributing)(?:\.|$)/i.test(extension) || /\.(?:md|markdown|rst|adoc|txt)$/i.test(extension);
    return { path, type: typeHint || (isDocument ? "file" : "dir") };
  }

  function guidedLinkScore(label, path, type) {
    const context = `${String(label || "")} ${String(path || "")}`;
    let score = Number.NEGATIVE_INFINITY;
    for (const entry of GUIDED_LINK_PATTERNS) {
      if (entry.pattern.test(context)) score = Math.max(score, entry.score);
    }
    if (!Number.isFinite(score)) return score;
    if (type === "dir") score += 28;
    if (type === "file" && isReadme(path)) score += 18;
    if (/(^|\/)(lib|libs|library|libraries|sdk|api|bindings?|native)([-_.\/]|$)/i.test(path)) score += 22;
    const depth = path.split("/").length - 1;
    score -= Math.max(0, depth - 1) * 3;
    return score;
  }

  function chooseGuidedLinks(markdown, currentPath, owner, repo, limit = 3) {
    const unique = new Map();
    for (const link of markdownLinks(markdown)) {
      const resolved = resolveGuidedTarget(link.target, currentPath, owner, repo);
      if (!resolved) continue;
      const score = guidedLinkScore(link.label, resolved.path, resolved.type);
      if (!Number.isFinite(score)) continue;
      const key = `${resolved.type}:${resolved.path.toLowerCase()}`;
      const candidate = { ...resolved, label: link.label.slice(0, 160), score };
      const current = unique.get(key);
      if (!current || candidate.score > current.score) unique.set(key, candidate);
    }
    return [...unique.values()]
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
      .slice(0, Math.max(1, Math.min(3, Number(limit) || 3)));
  }

  function rankDocuments(documents, limit = 6) {
    const seen = new Set();
    return (Array.isArray(documents) ? documents : [])
      .filter((document) => document && document.htmlUrl)
      .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0) || String(a.path).localeCompare(String(b.path)))
      .filter((document) => {
        const key = String(document.htmlUrl).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, Math.max(1, Number(limit) || 6));
  }

  return {
    chooseCandidates,
    candidateScore,
    normalizePath,
    isReadme,
    githubAnchor,
    parseMarkdownHeadings,
    chooseReadmeSections,
    markdownLinks,
    resolveGuidedTarget,
    chooseGuidedLinks,
    rankDocuments
  };
});
