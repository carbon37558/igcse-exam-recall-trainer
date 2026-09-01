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

For chemical notation, format characters directly as subscript or superscript in Excel. The importer preserves those runs as structured text and the app renders them with semantic `<sub>` / `<sup>` elements, including characters such as the `N` in S<sub>N</sub>1 and the `f` in ΔH<sub>f</sub> that do not have reliable Unicode subscript equivalents. No HTML needs to be entered in Excel.

Explicit `_` / `^` notation remains supported for plain-text input. For example, `H_2O`, `Mg^2+`, `SO_4^2-`, and `S_{N}1` are rendered with the requested script formatting. Unmarked text is never guessed or converted.

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
