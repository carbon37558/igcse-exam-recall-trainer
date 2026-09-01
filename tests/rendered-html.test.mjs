import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const valueText = (value) => typeof value === "string" ? value : value.text;
const scriptedSegments = (value) => typeof value === "string" ? [] : value.segments.filter((segment) => segment.script);

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
  assert.ok(data.every((item) => item.topic && valueText(item.question) && item.answers.length));

  const waterEquation = data.find((item) => item.id === "CIE037").answers[0];
  assert.equal(valueText(waterEquation), "Anode: 4OH- → O2 + 2H2O + 4e-");
  assert.deepEqual(scriptedSegments(waterEquation), [
    { text: "-", script: "sup" },
    { text: "2", script: "sub" },
    { text: "2", script: "sub" },
    { text: "-", script: "sup" },
  ]);

  const aluminiumEquation = data.find((item) => item.id === "CIE133").answers[1];
  assert.equal(valueText(aluminiumEquation), "Cathode: Al3+ + 3e- → Al");
  assert.deepEqual(scriptedSegments(aluminiumEquation), [
    { text: "3+", script: "sup" },
    { text: "-", script: "sup" },
  ]);

  assert.deepEqual(scriptedSegments(data.find((item) => item.id === "IBHL053").question), [{ text: "N", script: "sub" }]);
  assert.deepEqual(scriptedSegments(data.find((item) => item.id === "IBHL030").question), [{ text: "f", script: "sub" }]);
  assert.deepEqual(scriptedSegments(data.find((item) => item.id === "IBHL055").answers[1]), [{ text: "N", script: "sub" }]);
  assert.deepEqual(scriptedSegments(data.find((item) => item.id === "IBHL045").answers[1]), [{ text: "−", script: "sup" }]);
  assert.equal(valueText(data.find((item) => item.id === "CIE038").answers[0]), "2H2 + O2 → 2H2O");
});

test("Cloudflare Pages output includes the app shell and refresh fallback", async () => {
  const html = await readFile(new URL("../dist/client/index.html", import.meta.url), "utf8");
  const redirects = await readFile(new URL("../dist/client/_redirects", import.meta.url), "utf8");
  assert.match(html, /Exam Recall Trainer/);
  assert.match(html, /CIE IGCSE CHEM/);
  assert.match(html, /IB CHEM HL/);
  assert.equal(redirects, "/* /index.html 200\n");
});
