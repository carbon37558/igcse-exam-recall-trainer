import { writeFile } from "node:fs/promises";

const { default: worker } = await import("../dist/server/index.js");
const response = await worker.fetch(
  new Request("https://igcse-exam-recall-trainer.pages.dev/", {
    headers: { accept: "text/html", host: "igcse-exam-recall-trainer.pages.dev" },
  }),
  { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
  { waitUntil() {}, passThroughOnException() {} },
);

if (!response.ok) {
  throw new Error(`Static page export failed with status ${response.status}`);
}

await writeFile(new URL("../dist/client/index.html", import.meta.url), await response.text());
await writeFile(new URL("../dist/client/_redirects", import.meta.url), "/* /index.html 200\n");
