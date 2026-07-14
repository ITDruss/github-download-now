"use strict";

const assert = require("node:assert/strict");
const guides = require("../src/install-guides.js");

{
  const guide = guides.createGuide({
    assetName: "Local Send's App.AppImage",
    extension: ".appimage",
    platform: "linux",
    language: "ru"
  });
  assert.equal(guide.id, "appimage");
  assert.equal(guide.commands.length, 2);
  assert.match(guide.commands[0], /^chmod \+x -- /);
  assert.ok(guide.commands[0].includes("'\"'\"'"));
  assert.equal(guide.copyAll, true);
}

{
  const guide = guides.createGuide({ assetName: "app.deb", platform: "linux", language: "en" });
  assert.equal(guide.id, "deb");
  assert.equal(guide.commands[0], "sudo apt install './app.deb'");
}

{
  const guide = guides.createGuide({ assetName: "app.rpm", platform: "linux", language: "ru" });
  assert.equal(guide.id, "rpm");
  assert.equal(guide.steps.length, 2);
  assert.ok(guide.steps.every((step) => step.alternative));
  assert.equal(guide.copyAll, false);
}

{
  const guide = guides.createGuide({ assetName: "app.snap", platform: "linux", language: "en" });
  assert.equal(guide.id, "snap");
  assert.match(guide.commands[0], /--dangerous/);
  assert.match(guide.warning, /signature validation/i);
}

{
  const guide = guides.createGuide({ assetName: "bundle.aab", platform: "android", language: "ru" });
  assert.equal(guide.commands.length, 0);
  assert.match(guide.summary, /не для прямой установки/i);
}

assert.equal(guides.createGuide({ assetName: "checksums.txt", language: "en" }), null);
assert.equal(guides.normalizedExtension("demo.tar.xz"), ".tar.xz");
assert.equal(guides.commandText({ commands: ["one", "two"] }), "one\ntwo");

console.log("install guides tests: OK");
