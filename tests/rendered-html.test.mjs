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
  assert.match(html, /<title>Exam Recall Trainer<\/title>/i);
  assert.match(html, /Recall the words/);
  assert.match(html, /Set up your session/);
  assert.match(html, /Select all/);
  assert.match(html, /Clear all/);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 16);
  assert.match(html, />ALL</);
  assert.match(html, /10(?:<!-- -->)? questions selected from (?:<!-- -->)?231(?:<!-- -->)? available/);
  assert.match(html, /231/);
  assert.match(html, /CIE IGCSE CHEM/);
  assert.match(html, /IB CHEM HL/);
  assert.match(html, /© 2026 Adam SUN/);
  assert.match(html, /Created by Adam SUN/);
  assert.match(html, /adam51538@hotmail\.com/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});

test("question data is generated from the complete Excel bank", async () => {
  const data = JSON.parse(await readFile(new URL("../app/data/question-bank.json", import.meta.url), "utf8"));
  assert.equal(data.length, 319);
  assert.equal(data[0].id, "CIE001");
  assert.equal(data[230].id, "CIE231");
  assert.equal(data[231].id, "IBHL001");
  assert.equal(data.at(-1).id, "IBHL088");
  assert.deepEqual(new Set(data.map((item) => item.course_id)), new Set(["CIE_IGCSE_CHEM", "IB_CHEM_HL"]));
  assert.deepEqual(new Set(data.filter((item) => item.course_id === "CIE_IGCSE_CHEM").map((item) => item.paper)), new Set(["4", "6"]));
  assert.deepEqual(new Set(data.filter((item) => item.course_id === "IB_CHEM_HL").map((item) => item.paper)), new Set(["1B", "2"]));
  assert.equal(data.filter((item) => item.course_id === "CIE_IGCSE_CHEM").length, 231);
  assert.equal(data.filter((item) => item.course_id === "IB_CHEM_HL").length, 88);
  assert.ok(data.every((item) => item.topic && item.question && item.answers.length));
  assert.ok(data.some((item) => item.answers.includes("Anode: 4OH⁻ → O₂ + 2H₂O + 4e⁻")));
  assert.ok(data.some((item) => item.answers.includes("Cathode: Al³⁺ + 3e⁻ → Al")));
  assert.deepEqual(data.find((item) => item.id === "CIE031")?.answers, ["Cu forms Cu²⁺, which goes into the solution"]);
  assert.ok(data.some((item) => item.course_id === "IB_CHEM_HL" && item.answers.some((answer) => answer.includes("Eₐ"))));
});

test("Cloudflare Pages output includes the app shell and refresh fallback", async () => {
  const html = await readFile(new URL("../dist/client/index.html", import.meta.url), "utf8");
  const redirects = await readFile(new URL("../dist/client/_redirects", import.meta.url), "utf8");
  assert.match(html, /Exam Recall Trainer/);
  assert.match(html, /CIE IGCSE CHEM/);
  assert.match(html, /IB CHEM HL/);
  assert.equal(redirects, "/* /index.html 200\n");
});
