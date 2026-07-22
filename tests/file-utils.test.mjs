import assert from "node:assert/strict";
import { scriptsFromHtml } from "../scripts/file-utils.mjs";

const html = `
  <script defer src="shared/a.js"></script >
  <script src='content/b.js' async></script data-invalid>
  <script type="module">ignored()</script>
`;

assert.deepEqual(
  scriptsFromHtml(html),
  ["shared/a.js", "content/b.js"]
);

console.log("file utility tests: OK");
