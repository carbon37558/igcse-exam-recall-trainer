# Exam Recall Trainer

A mobile-first recall trainer for chemistry definitions and short-answer marking points. The current course packs are CIE IGCSE Chemistry and IB Chemistry HL.

## Run locally

```bash
npm install
npm run dev
```

## Update the question bank

The Excel workbook at `data/question-bank.xlsx` is the source of truth. Each course is maintained in its own sheet; the sheet name becomes the stable `course_id`. Keep the shared column names, replace or edit the workbook, then run:

```bash
npm run data:sync
```

This regenerates the app data from every worksheet in the Excel file. Question wording and each non-empty `answer_*` marking point are preserved; no question content needs to be copied into the app code. Fully blank formatted rows are ignored, while partially completed question rows still fail validation.

For chemical notation, enter Unicode characters directly or use `_` for subscripts and `^` for superscripts in question and answer cells. For example, `H_2O`, `Mg^2+`, and `SO_4^2-` are imported as `H₂O`, `Mg²⁺`, and `SO₄²⁻`. Existing Excel subscript and superscript formatting is also converted during import. Rich-text letters are converted only when Unicode provides a reliable equivalent; unsupported letters remain unchanged rather than being replaced incorrectly.

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
