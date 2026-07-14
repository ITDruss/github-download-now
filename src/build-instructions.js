(function initBuildInstructions(root, factory) {
  const api = factory();
  root.GHDNBuildInstructions = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createBuildInstructions() {
  "use strict";

  const MAX_SOURCE_LENGTH = 220000;
  const MAX_SUMMARY_LENGTH = 1200;
  const MAX_COMMAND_BLOCKS = 6;
  const MAX_COMMAND_LENGTH = 1400;

  const FILE_SCORES = new Map([
    ["building.md", 120],
    ["building.rst", 118],
    ["build.md", 116],
    ["build.rst", 114],
    ["compiling.md", 112],
    ["compile.md", 110],
    ["development.md", 104],
    ["developing.md", 102],
    ["developer.md", 100],
    ["hacking.md", 98],
    ["install.md", 92],
    ["installation.md", 90],
    ["contributing.md", 84],
    ["readme.md", 70],
    ["readme.rst", 68],
    ["readme", 66]
  ]);

  const HEADING_PATTERNS = [
    /\bbuild(?:ing)?(?:\s+from\s+source)?\b/i,
    /\bcompile|compiling|compilation\b/i,
    /\bdevelopment\s+(?:setup|environment)\b/i,
    /\bdeveloper\s+(?:setup|guide|environment)\b/i,
    /\binstall(?:ation)?\s+from\s+source\b/i,
    /\bfrom\s+source\b/i,
    /\bprerequisites?\b/i,
    /\bсборк[аиу]?\b/i,
    /\bкомпиляц(?:ия|ии|ию)\b/i,
    /\bсборк[аи]\s+из\s+исходник/i,
    /\bнастройк[аи]\s+(?:окружения|среды)\s+разработ/i,
    /\bразработк[аи]\b/i
  ];

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
        score = 78;
      } else if (/^readme(?:\.|$)/i.test(name)) {
        score = 62;
      }
    }

    if (!score) return Number.NEGATIVE_INFINITY;
    const depth = path.split("/").length - 1;
    if (path.startsWith("docs/")) score += 8;
    if (path.startsWith("doc/")) score += 6;
    score -= depth * 2;
    return score;
  }

  function chooseCandidates(entries, limit = 2) {
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

    return [...unique.values()]
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
      .slice(0, Math.max(1, Number(limit) || 2));
  }

  function stripInlineMarkdown(value) {
    return String(value || "")
      .replace(/<!--[^]*?-->/g, " ")
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[>*_~]/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isRelevantHeading(title) {
    const normalized = stripInlineMarkdown(title);
    return HEADING_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  function parseSections(markdown) {
    const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
    const headings = [];
    let fenced = false;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^\s*(```|~~~)/.test(line)) {
        fenced = !fenced;
        continue;
      }
      if (fenced) continue;
      const match = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (!match) continue;
      headings.push({ index, level: match[1].length, title: stripInlineMarkdown(match[2]) });
    }

    return { lines, headings };
  }

  function selectSection(markdown, sourcePath) {
    const { lines, headings } = parseSections(markdown);
    const relevant = headings
      .filter((heading) => isRelevantHeading(heading.title))
      .sort((a, b) => {
        const aBuild = /build|compile|сбор|компил/i.test(a.title) ? 1 : 0;
        const bBuild = /build|compile|сбор|компил/i.test(b.title) ? 1 : 0;
        return bBuild - aBuild || a.index - b.index;
      });

    if (relevant.length) {
      const heading = relevant[0];
      let end = lines.length;
      for (const next of headings) {
        if (next.index > heading.index && next.level <= heading.level) {
          end = next.index;
          break;
        }
      }
      return {
        title: heading.title,
        text: lines.slice(heading.index + 1, end).join("\n").trim(),
        confidence: "high"
      };
    }

    const fileName = basename(sourcePath).toLowerCase();
    const dedicated = !/^readme(?:\.|$)/.test(fileName) && candidateScore({ type: "file", path: sourcePath }) >= 78;
    if (dedicated) {
      return {
        title: basename(sourcePath),
        text: lines.slice(0, 220).join("\n").trim(),
        confidence: "medium"
      };
    }

    return null;
  }

  function extractCodeBlocks(text) {
    const blocks = [];
    const pattern = /(?:^|\n)\s*(```|~~~)\s*([^\n]*)\n([\s\S]*?)\n\s*\1(?=\n|$)/g;
    let match;
    while ((match = pattern.exec(String(text || ""))) && blocks.length < MAX_COMMAND_BLOCKS) {
      const language = String(match[2] || "").trim().split(/\s+/)[0].slice(0, 30);
      const code = String(match[3] || "").trim().slice(0, MAX_COMMAND_LENGTH);
      if (!code) continue;
      blocks.push({ language, code });
    }
    return blocks;
  }

  function proseSummary(text) {
    const withoutFences = String(text || "")
      .replace(/(?:^|\n)\s*(```|~~~)\s*[^\n]*\n[\s\S]*?\n\s*\1(?=\n|$)/g, "\n")
      .replace(/^\s*[-+*]\s+/gm, "")
      .replace(/^\s*\d+[.)]\s+/gm, "")
      .replace(/^\s*#{1,6}\s+/gm, "")
      .replace(/^\s*>\s?/gm, "");
    return stripInlineMarkdown(withoutFences).slice(0, MAX_SUMMARY_LENGTH);
  }

  function extractFromMarkdown(markdown, source = {}) {
    const sourceText = String(markdown || "").slice(0, MAX_SOURCE_LENGTH);
    const path = normalizePath(source.path || source.name || "README.md");
    const section = selectSection(sourceText, path);
    if (!section) {
      return {
        found: false,
        source: {
          path,
          htmlUrl: String(source.htmlUrl || source.html_url || "")
        }
      };
    }

    const commands = extractCodeBlocks(section.text);
    const summary = proseSummary(section.text);
    if (!commands.length && summary.length < 40) {
      return {
        found: false,
        source: {
          path,
          htmlUrl: String(source.htmlUrl || source.html_url || "")
        }
      };
    }

    return {
      found: true,
      title: section.title,
      summary,
      commands,
      confidence: section.confidence,
      source: {
        path,
        htmlUrl: String(source.htmlUrl || source.html_url || "")
      }
    };
  }

  return {
    chooseCandidates,
    extractFromMarkdown,
    isRelevantHeading
  };
});
