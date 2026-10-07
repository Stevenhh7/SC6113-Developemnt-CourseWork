# Updated report source and evidence

The final English report for **Ji Chengyu, G2608005K** now describes the multi-Investment application accepted by the student on Render on 7 October 2026. It includes independent named contracts, title/explanation search, creator-signed registration, scoped participation and PostgreSQL metadata/history persistence.

`MicroInvest_Report.tex` is the editable source. `MicroInvest_Report.pdf` contains **8 pages including references**, all **13 required sections**, six tables and eleven figures (nine screenshot captures, one architecture diagram and one clearly labelled API excerpt). All eight rendered pages were visually reviewed. The report retains the original contract rules and clearly separates earlier Sepolia evidence, local simulated-wallet tests, student acceptance and current independent public API checks.

## Compile

Use pdfLaTeX twice from this folder:

```sh
pdflatex -interaction=nonstopmode -halt-on-error MicroInvest_Report.tex
pdflatex -interaction=nonstopmode -halt-on-error MicroInvest_Report.tex
```

Common TeX Live packages are listed in the source. The diagram uses TikZ; no external diagram or BibTeX file is required. Keep `screenshots/` beside the source. The PDF was exported using the existing TeX Live 2024 installation, with no undefined references, LaTeX warnings or overfull boxes. Build details and hashes are recorded in `../docs/evidence/report-build-2026-10-07.json`.

`MicroInvest_LaTeX.zip` contains the source, report instructions, screenshot originals/crop, public evidence and database schema. Extract it and compile the source, or upload the ZIP to Overleaf with pdfLaTeX selected. It contains no application environment settings or database credentials.

## Screenshot provenance

Nine captures are used in the updated PDF:

| Capture | Content / origin |
| --- | --- |
| 01-deployment.png | Student's original successful Sepolia deployment; unchanged business contract |
| 02-wallet.png | Student's authorized MetaMask account menu on Sepolia |
| 04-invalid-input.png | Student's negative deposit validation |
| 06-redemption.png | Student's confirmed redemption and zero position at block 11857372 |
| 09-directory-search.jpg | Current hosted keyword filter and matching project `test1` |
| 10-create-form.jpg | Current hosted title/explanation form; illustrative draft, no deployment submitted |
| 11-project-detail.jpg | Current hosted Investment #2 detail and contract address |
| 12-current-history.jpg | Current hosted project-specific activity with recovered confirmed records |
| 13-render-updated.png | Student's updated Render Live status and commit b6941a7 |

The updated public-site captures were collected on 7 October 2026. The search figure uses two faithful crops of a single original image. Deployment and invalid-input figures use faithful crops for readability while their originals remain unchanged. Render uses `13-render-status.png`, a crop of the unchanged student original; crop bounds are recorded in the manifest. No screenshot content or transaction state was fabricated.

The earlier `03-history.png`, `07-backend.png` and `08-render.png` are retained as historical originals in the source package but are not displayed in the revised PDF. The old API snapshot predates the redemption and the old Render image shows b65f9c3; neither is presented as evidence of the updated index. `screenshots/manifest.json` records original dimensions, hashes, captions and PDF usage. Current screenshots are sufficient for this revision; no additional student capture is required.

## Testing and live evidence

Recorded local results: 54 backend cases, 9 frontend tests and 24 browser checks passed; the unchanged contract previously passed 12 tests. The dedicated PostgreSQL test was skipped locally and its configured CI execution is not reported as an observed pass. Local browser tests use a real chain and a simulated wallet. No hosted stop/restart persistence experiment or performance/user study is claimed.

`../docs/evidence/live-multi-investment-2026-10-07.json` records nine successful read-only public requests, two distinct live contracts, keyword matching, five recent/ten complete original-pool events with `source: database`, and the updated browser module matching b6941a7. The earlier `live-validation-2026-10-07.json` retains verified original receipts/gas. The ZIP places these public records under `evidence/`.

The collector is separate report tooling and never signs or submits transactions:

```sh
python scripts/collect-updated-report-evidence.py
```

Run it from the repository root only when another verification record is needed. The student separately confirmed successful updated MetaMask testing on Render. On 8 October 2026, the final PostgreSQL application data was exported using a read-only TLS connection (2 projects, 10 confirmed events, 9 scan ranges); export evidence is in `../docs/evidence/database-export-2026-10-08.json`. The main submission package includes the schema and the direct JSON/SQL data export. The report PDF remains the verified eight-page build. See `SCREENSHOT_CHECKLIST.md` and `SUBMISSION_CHECKLIST.md` for course upload details.
