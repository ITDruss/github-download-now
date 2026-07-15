"use strict";

const assert = require("node:assert/strict");
const policy = require("../src/url-policy.js");

assert.ok(policy.releaseAsset(
  "https://github.com/LocalSend/LocalSend/releases/download/v1.17.0/LocalSend.AppImage",
  "localsend",
  "localsend",
  "v1.17.0"
));
assert.equal(policy.releaseAsset(
  "https://example.org/localsend/localsend/releases/download/v1.17.0/evil.AppImage",
  "localsend",
  "localsend"
), null);
assert.equal(policy.releaseAsset(
  "https://github.com/other/project/releases/download/v1.17.0/evil.AppImage",
  "localsend",
  "localsend"
), null);
assert.equal(policy.releaseAsset(
  "https://github.com/localsend/localsend/releases/download/v1.17.0/folder/evil.AppImage",
  "localsend",
  "localsend"
), null);
assert.equal(policy.releaseAsset(
  "https://github.com/localsend/localsend/releases/download/v1.17.0/evil%2Fname.AppImage",
  "localsend",
  "localsend"
), null);
assert.ok(policy.releaseTag(
  "https://github.com/localsend/localsend/releases/tag/release%2Fv1.17.0",
  "localsend",
  "localsend"
));
assert.ok(policy.releaseTag(
  "https://github.com/localsend/localsend/releases/tag/v1.17.0",
  "localsend",
  "localsend"
));
assert.equal(policy.releaseTag(
  "https://github.com/localsend/localsend/releases/tag/v1.17.0/extra",
  "localsend",
  "localsend"
), null);
assert.equal(policy.releaseTag(
  "https://example.org/localsend/localsend/releases/tag/v1.17.0",
  "localsend",
  "localsend"
), null);
assert.ok(policy.download(
  "https://github.com/localsend/localsend/archive/refs/tags/v1.17.0.zip",
  "localsend",
  "localsend"
));
assert.ok(policy.download(
  "https://api.github.com/repos/localsend/localsend/zipball/v1.17.0",
  "localsend",
  "localsend"
));
assert.equal(policy.download("https://evil.example/file.zip", "localsend", "localsend"), null);
assert.equal(policy.parse("http://github.com/owner/repo"), null);
assert.equal(policy.parse("https://user:pass@github.com/owner/repo"), null);

assert.equal(policy.releaseAsset(
  "https://github.com/localsend/localsend/releases/download/v1.17.0/LocalSend.AppImage?source=evil",
  "localsend",
  "localsend"
), null);
assert.equal(policy.releaseTag(
  "https://github.com/localsend/localsend/releases/tag/v1.17.0#fragment",
  "localsend",
  "localsend"
), null);
assert.equal(policy.oauthEndpoint("https://github.com/login/device/code").href, "https://github.com/login/device/code");
assert.equal(policy.oauthEndpoint("https://github.com/login/oauth/access_token").href, "https://github.com/login/oauth/access_token");
assert.equal(policy.oauthEndpoint("https://github.com/login/device"), null);
assert.equal(policy.oauthEndpoint("https://evil.example/login/device/code"), null);
assert.equal(policy.deviceVerification("https://github.com/login/device").href, "https://github.com/login/device");
assert.equal(policy.deviceVerification("https://github.com/login/device?x=1"), null);

console.log("URL policy tests: OK");
