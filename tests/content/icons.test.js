"use strict";

const assert = require("node:assert/strict");
const icons = require("../../src/content/ui/icons.js");

for (const name of ["download", "chevron", "linux", "windows", "macos", "android", "browser", "package", "source", "external", "copy", "warning", "info", "settings"]) {
  const markup = icons.svgIcon(name);
  assert.ok(markup.startsWith("<svg"), `${name} must be local SVG markup`);
  assert.ok(markup.includes('aria-hidden="true"'), `${name} must be decorative`);
  assert.ok(!markup.includes("<script"), `${name} must not contain executable markup`);
}
assert.equal(icons.svgIcon("missing"), icons.svgIcon("package"));
assert.ok(Object.isFrozen(icons));

console.log("content icon tests: OK");
