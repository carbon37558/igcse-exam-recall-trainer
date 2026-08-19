import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html", host: "localhost" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Exam Recall Trainer", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Exam Recall Trainer · CIE Chemistry<\/title>/i);
  assert.match(html, /Recall the words/);
  assert.match(html, /Set up your session/);
  assert.match(html, /Select all/);
  assert.match(html, /Clear all/);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 15);
  assert.match(html, />ALL</);
  assert.match(html, /10(?:<!-- -->)? questions selected from (?:<!-- -->)?183(?:<!-- -->)? available/);
  assert.match(html, /183/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("question data is generated from the complete Excel bank", async () => {
  const data = JSON.parse(await readFile(new URL("../app/data/question-bank.json", import.meta.url), "utf8"));
  assert.equal(data.length, 183);
  assert.equal(data[0].id, "CIE001");
  assert.equal(data.at(-1).id, "CIE183");
  assert.deepEqual(new Set(data.map((item) => item.paper)), new Set(["4", "6"]));
  assert.ok(data.every((item) => item.topic && item.question && item.answers.length));
});

test("Cloudflare Pages output includes the app shell and refresh fallback", async () => {
  const html = await readFile(new URL("../dist/client/index.html", import.meta.url), "utf8");
  const redirects = await readFile(new URL("../dist/client/_redirects", import.meta.url), "utf8");
  assert.match(html, /Exam Recall Trainer/);
  assert.match(html, /183/);
  assert.equal(redirects, "/* /index.html 200\n");
});
