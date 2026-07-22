"use strict";

const assert = require("node:assert/strict");
const githubClientModule = require("../../src/background/github-client.js");
const urlPolicy = require("../../src/url-policy.js");
const githubAuth = require("../../src/github-auth.js");

const local = {};
const storage = {
  async localGet(defaults) { return { ...defaults, ...local }; },
  async localSet(values) { Object.assign(local, values); },
  async localRemove(keys) { for (const key of keys) delete local[key]; }
};

let mode = "ok";
let requests = [];
async function fetchFn(url, options) {
  requests.push({ url: String(url), options });
  if (mode === "invalid") return new Response("not-json", { status: 200 });
  if (mode === "unauthorized") return new Response("{}", { status: 401 });
  if (mode === "large") return new Response("123456", { status: 200, headers: { "content-length": "6" } });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      etag: '"test"',
      "x-ratelimit-limit": "60",
      "x-ratelimit-remaining": "59",
      "x-ratelimit-used": "1",
      "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600)
    }
  });
}

(async () => {
  const client = githubClientModule.create({ storage, urlPolicy, githubAuth, fetchFn, maxJsonChars: 100 });
  assert.equal(client.validGitRef("v1.0.0"), "v1.0.0");
  assert.equal(client.validGitRef("bad\nref"), null);
  assert.equal((await client.fetchJson("https://evil.example/test")).error, "untrusted_url");

  mode = "ok";
  const ok = await client.fetchJson("https://api.github.com/rate_limit");
  assert.equal(ok.ok, true);
  assert.equal(ok.etag, '"test"');
  assert.equal(ok.rateLimit.remaining, 59);
  assert.equal(requests.at(-1).options.credentials, "omit");

  mode = "invalid";
  const invalid = await client.fetchJson("https://api.github.com/rate_limit");
  assert.equal(invalid.error, "invalid_response");

  mode = "large";
  const smallClient = githubClientModule.create({ storage, urlPolicy, githubAuth, fetchFn, maxJsonChars: 5 });
  const large = await smallClient.fetchJson("https://api.github.com/rate_limit");
  assert.equal(large.error, "response_too_large");

  const auth = await client.saveStoredGitHubAuth({
    token: "gho_abcdefghijklmnopqrstuvwxyz1234567890",
    tokenType: "bearer",
    scope: "",
    connectedAt: new Date().toISOString()
  });
  assert.ok(auth.token.startsWith("gho_"));
  assert.equal((await client.githubApiHeaders()).Authorization.startsWith("Bearer "), true);
  await client.clearStoredGitHubAuth();
  assert.equal(local[githubAuth.STORAGE_KEY], undefined);
  console.log("background GitHub client tests: OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
