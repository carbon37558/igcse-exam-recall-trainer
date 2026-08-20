# Exam Recall Trainer

A mobile-first recall trainer for Cambridge IGCSE Chemistry definitions and short-answer marking points.

## Run locally

```bash
npm install
npm run dev
```

## Update the question bank

The Excel workbook at `data/question-bank.xlsx` is the source of truth. Keep the existing column names, replace or edit the workbook, then run:

```bash
npm run data:sync
```

This regenerates the app data from the Excel file. Question wording and each non-empty `answer_*` marking point are preserved; no question content needs to be copied into the app code.

For chemical notation, enter Unicode characters directly or use `_` for subscripts and `^` for superscripts in question and answer cells. For example, `H_2O`, `Mg^2+`, and `SO_4^2-` are imported as `H₂O`, `Mg²⁺`, and `SO₄²⁻`. Existing Excel subscript and superscript formatting is also converted during import.

## Verify

```bash
npm test
```

## Cloudflare Pages

- Production URL: https://igcse-exam-recall-trainer.pages.dev
- Production branch: `main`
- Build command: `npm run build:pages`
- Output directory: `dist/client`

Every push to `main` is deployed automatically by Cloudflare Pages.
