# MicroInvest implementation plan and status

This repository implements the confirmed plan from `Course/PROJECT_PLAN.md` and the SC6113 assignment. The user confirmed this existing repository as the target. The final implementation request excludes the PDF report and screenshots.

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
| P5 Deployment | Tooling complete; live deployments pending student account/wallet actions | Browser/CLI Sepolia deployment, local runner and `render.yaml` |
| P6 Handoff | Source/documentation complete; PDF/screenshots excluded | README, test/evaluation notes, CI and `USER_ACTIONS.md` |

No live Sepolia address or Render URL is available yet. The wallet setup page makes the deployment reviewable without exporting a key. Student actions and live acceptance are explicitly pending, not marked as completed deployments.

## Assignment coverage

| Requirement | Implementation / evidence |
| --- | --- |
| Financial problem and objectives | README and architecture: beginner's fractional contribution, transparent shares and principal exit |
| Solidity business logic | Caller ledger, total shares, ETH custody, events, strict validation, guarded withdrawals |
| MetaMask and transactions | Browser signer with network/account checks; submission/receipt lifecycle; actual extension/Sepolia check still required |
| Frontend UI | English responsive overview, clear amount controls, fixed ratio/gas explanation, position and activity |
| Required backend integration | Frontend actively uses Flask public configuration, pool, position, history and receipt APIs |
| History/confirmation | Chain events and receipts; same-block-safe pagination; latest operation recovery |
| Error handling | Invalid amounts, wallet rejection, excess exit, mismatched network/code, RPC timeout/failure |
| Security/evaluation | Meaningful adversarial contract tests, precise amounts, key boundary, gas evidence and stated limits |
| Source and README | Complete code, lockfile, public build artifacts, setup/deploy/testing instructions |
| Sepolia and Render | Complete deploy/config workflows; student must supply accounts, funds and settings |
| PDF report and screenshots | Excluded by user; requirements and checklist preserved for student's completion |
| Database | Not used, as selected; restart recovery reads chain |

Keep the scope simple. No additional investment product, earnings feature or administrator has been introduced. Service plan, account credentials, GitHub visibility and course submission details remain student choices.
