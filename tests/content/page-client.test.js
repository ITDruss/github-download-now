"use strict";

const assert = require("node:assert/strict");
const pageClientApi = require("../../src/content/page-client.js");

class Parser {
  parseFromString(html, type) {
    return { html, type };
  }
}

function policy(url) {
  try {
    const parsed = new URL(url, "https://github.com");
    if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") return null;
    return parsed;
  } catch (_error) {
    return null;
  }
}

(async () => {
  const requests = [];
  const client = pageClientApi.create({
    DOMParserClass: Parser,
    maxPageChars: 100,
    urlPolicy: { repositoryWebUrl: policy },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => "15" },
        text: async () => "<main>ok</main>"
      };
    }
  });

  const document = await client.fetchDocument("/owner/repo/releases", { owner: "owner", repo: "repo" });
  assert.equal(document.html, "<main>ok</main>");
  assert.equal(document.type, "text/html");
  assert.equal(requests[0].options.credentials, "omit");
  assert.equal(requests[0].options.redirect, "error");
  assert.equal(requests[0].options.referrerPolicy, "no-referrer");

  await assert.rejects(
    pageClientApi.create({
      DOMParserClass: Parser,
      urlPolicy: { repositoryWebUrl: () => null },
      fetchImpl: async () => { throw new Error("must not fetch"); }
    }).fetchDocument("https://evil.example/file", { owner: "owner", repo: "repo" }),
    /Untrusted GitHub page URL/
  );

  await assert.rejects(
    pageClientApi.create({
      DOMParserClass: Parser,
      maxPageChars: 4,
      urlPolicy: { repositoryWebUrl: policy },
      fetchImpl: async (url) => ({
        ok: true,
        status: 200,
        url,
        headers: { get: () => "5" },
        text: async () => "12345"
      })
    }).fetchDocument("/owner/repo/releases", { owner: "owner", repo: "repo" }),
    /too large/
  );

  await assert.rejects(
    pageClientApi.create({
      DOMParserClass: Parser,
      urlPolicy: { repositoryWebUrl: (url) => url.includes("evil") ? null : policy(url) },
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        url: "https://evil.example/release",
        headers: { get: () => null },
        text: async () => "ok"
      })
    }).fetchDocument("/owner/repo/releases", { owner: "owner", repo: "repo" }),
    /redirected to an untrusted URL/
  );

  console.log("content page client tests: OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
