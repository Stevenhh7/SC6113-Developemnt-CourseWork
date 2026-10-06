# Report source and screenshots

The report is authored in English for Ji Chengyu, G2608005K. `MicroInvest_Report.tex` is the authoritative editable source. It contains all 13 sections specified by the assignment, two TikZ diagrams, actual automated results, Sepolia receipts and the public Render URL. At the student's subsequent request, `MicroInvest_Report.pdf` was compiled on 7 October 2026 using the installed TeX Live 2024 pdfLaTeX engine. The final report has 8 pages, all 13 sections and seven screenshots; all pages were visually reviewed. The LaTeX source remains editable.

## Compile

Use pdfLaTeX twice so citations and figure numbers resolve. From this `report` folder:

```sh
pdflatex -interaction=nonstopmode MicroInvest_Report.tex
pdflatex -interaction=nonstopmode MicroInvest_Report.tex
```

The source uses common TeX Live packages listed at its top. Diagrams are drawn in TikZ and require no additional images. No BibTeX file is needed. The final source was compiled twice, with no undefined-reference or overfull-box warnings. Page count and screenshot layout were checked. `docs/evidence/report-build-2026-10-07.json` records the PDF/source hashes and validation results. The built-in editor compiler could not start on this Windows host, so the existing TeX Live installation supplied the exported PDF.

## Included screenshots

All seven student-supplied originals are saved in `screenshots/` and included in the LaTeX source:

- `01-deployment.png`
- `02-wallet.png`
- `03-history.png`
- `04-invalid-input.png`
- `06-redemption.png`
- `07-backend.png`
- `08-render.png`

The first four cover the assignment's required deployment, wallet, successful transaction and invalid-input evidence. The last three show zero holdings after redemption, a real pool API response and Render's successful Live deployment. There is no separate image 05 because image 03 also covers complete history. Original dimensions and SHA-256 hashes are recorded in `screenshots/manifest.json`. Missing files generate a LaTeX warning. The macro also supports compilation from the repository root by looking for `report/screenshots/`.

The API image records 0.04 ETH principal at block 11857366. The redemption image records zero personal shares and principal at block 11857372. The report distinguishes these snapshots. The Render image shows commit `b65f9c3`, Gunicorn startup, Live status and the public URL.

`MicroInvest_LaTeX.zip` contains the source, these originals and the report instructions. Extract it and compile `MicroInvest_Report.tex`, or upload the ZIP to Overleaf with pdfLaTeX selected. Keep the `screenshots/` folder beside the source. No application dependencies are needed to compile the report.

The image macro keeps the original aspect ratio. Inspect screenshot text at normal PDF zoom after compilation. If a screenshot contains too much unrelated content, capture the relevant area again so the network, transaction status and amounts remain readable. Adjust figure size or shorten repetitive prose if necessary; preserve all required sections and the 5-8 page limit.

See `SCREENSHOT_CHECKLIST.md` for capture instructions and `SUBMISSION_CHECKLIST.md` for final delivery.

## Evidence

`docs/evidence/live-validation-2026-10-07.json` records read-only HTTPS responses from the public Render application and three successful Sepolia receipts. Dates in that file's raw response timestamps are UTC; the report date uses Asia/Shanghai. The student separately reported completing the actual MetaMask functional tests on Render. The automated browser provider is simulated and is described accordingly in the report.

The evidence collector is separate document tooling. It is not an application endpoint and never signs or submits a transaction:

```sh
python scripts/collect-report-evidence.py
```

Run that command from the repository root only when a new verification record is needed. Report authoring does not add a database or change the deployed application.
