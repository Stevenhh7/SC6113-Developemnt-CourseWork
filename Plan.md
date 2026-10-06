# MicroInvest implementation plan and status

This repository implements the confirmed plan from `Course/PROJECT_PLAN.md` and the SC6113 assignment. The user confirmed this existing repository as the target. On 2026-10-07, after completing tests on Render, the user authorized the remaining report and handoff work. The report is supplied as editable LaTeX with all seven student screenshots and a compiled 8-page PDF, generated at the student's subsequent request.

## Confirmed scope

Investing beginners; single pool; Sepolia test ETH; fixed fractional 1 ETH = 1 internal share; positive amounts without additional business thresholds; no yield/fee/share transfers; anytime partial/full principal redemption; no administrator. Flask, vanilla HTML/CSS/JS, no database, Hardhat, VS Code, English dark UI, Render deployment.

## Stages

| Stage | Status | Deliverable |
| --- | --- | --- |
| P0 Requirements | Complete | Confirmed decisions and source requirement coverage |
| P1 System/business design | Complete | `docs/ARCHITECTURE.md`, contract invariants and public API |
| P2 Contract implementation | Complete; local tests pass | `contracts/MicroInvest.sol`, adversarial tests, artifact/export tooling |
| P3 Flask backend | Complete; local tests pass | Real state/event/receipt APIs, validation, bounded history, safe errors |
| P4 Frontend/integration | Complete; local browser checks pass | Wallet connection, deposit, position, partial/full exit, status/history, responsive English UI |
| P5 Deployment | Complete; student reports successful MetaMask tests on Render; public API and receipts verified | Public Render URL, `deployments/sepolia.json`, `docs/evidence/`, local runner and `render.yaml` |
| P6 Report and handoff | Complete: editable LaTeX, seven originals, compiled 8-page PDF and handoff bundle; course submission remains | `report/MicroInvest_Report.tex`, `report/MicroInvest_Report.pdf`, `report/MicroInvest_LaTeX.zip`, screenshot/submission checklists, README, evaluation notes and CI |

The live Sepolia address is `0xE560121978f80c390f6B0d091E9579A2812Cb3DD`, deployment block `11856501`. The public application is https://sc6113-developemnt-coursework.onrender.com/. On 2026-10-07, the student confirmed all functional tests passed on Render. Separate read-only checks verified the home page, configuration, health, pool, position, history and three successful business receipts. The report identifies Ji Chengyu, G2608005K; its 13 required sections include the existing security controls specified in Word. All seven originals are saved with hashes and accurate captions. The API's 0.04 ETH snapshot at block 11857366 precedes the zero-position redemption at block 11857372. The final PDF has 8 pages and passed page count, section/image coverage, citation, boundary and visual checks. Compilation evidence is in `docs/evidence/report-build-2026-10-07.json`. Only final student review and course submission remain.

## Assignment coverage

| Requirement | Implementation / evidence |
| --- | --- |
| Financial problem and objectives | README and architecture: beginner's fractional contribution, transparent shares and principal exit |
| Solidity business logic | Caller ledger, total shares, ETH custody, events, strict validation, guarded withdrawals |
| MetaMask and transactions | Selected authorized signer with network/account checks and receipt lifecycle; student confirms live Render/MetaMask acceptance |
| Frontend UI | English responsive overview, clear amount controls, fixed ratio/gas explanation, position and activity |
| Required backend integration | Frontend actively uses Flask public configuration, pool, position, history and receipt APIs |
| History/confirmation | Chain events and receipts; same-block-safe pagination; latest operation recovery |
| Error handling | Invalid amounts, wallet rejection, excess exit, mismatched network/code, RPC timeout/failure |
| Security/evaluation | Meaningful adversarial contract tests, precise amounts, key boundary, gas evidence and stated limits |
| Source and README | Complete code, lockfile, public build artifacts, setup/deploy/testing instructions |
| Sepolia and Render | Creation receipt/code verified; hosted API and successful deposit/partial/full redemption receipts recorded in `docs/evidence/` |
| Report and screenshots | All 13 sections and seven originals included; 8-page PDF compiled and visually checked; editable source ZIP provided |
| Database | Not used, as selected; restart recovery reads chain |

Keep the scope simple. No additional investment product, earnings feature or administrator has been introduced. Service plan, account credentials, GitHub visibility and course submission details remain student choices.
