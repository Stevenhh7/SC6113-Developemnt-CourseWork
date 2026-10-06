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
| P5 Deployment | Sepolia contract deployed and verified; Render and live deposit/redemption checks pending | `deployments/sepolia.json`, browser/CLI deployment, local runner and `render.yaml` |
| P6 Handoff | Source/documentation complete; PDF/screenshots excluded | README, test/evaluation notes, CI and `USER_ACTIONS.md` |

The live Sepolia address is `0xE560121978f80c390f6B0d091E9579A2812Cb3DD`, deployment block `11856501`. The student's MetaMask deployment and exact runtime bytecode were independently verified through RPC. No Render URL is available yet. Live wallet deposits/redemptions, Render and final evidence remain pending.

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
| Sepolia and Render | Sepolia creation receipt/code and local API reads verified; live wallet flow and Render publication still pending |
| PDF report and screenshots | Excluded by user; requirements and checklist preserved for student's completion |
| Database | Not used, as selected; restart recovery reads chain |

Keep the scope simple. No additional investment product, earnings feature or administrator has been introduced. Service plan, account credentials, GitHub visibility and course submission details remain student choices.
