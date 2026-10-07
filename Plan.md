# MicroInvest implementation plan and status

This repository is the user-confirmed target inside Course. It implements the SC6113 assignment and Course/PROJECT_PLAN.md. Version 1 was deployed and accepted on Render; the user subsequently requested the multi-investment update below on 7 October 2026.

## Current confirmed scope

Investing beginners; any authorized wallet can create its own independent Investment contract and supply a title/explanation. Search by name or related words, open a project-specific detail page and participate in that contract. PostgreSQL stores the online directory and an index of confirmed events; local SQLite is a development fallback.

Each contract retains the agreed rules: Sepolia test ETH, fixed fractional 1 ETH = 1 internal share, positive valid amounts without a business threshold, no yield/platform fee/share transfer, anytime partial/full principal redemption, no administrator and no special creator withdrawal privilege.

Backend remains Flask, frontend vanilla English HTML/CSS/JS; Hardhat and VS Code for development, Render for hosting. Node.js remains tooling. Metadata registration requires the deploying wallet's signature and a verified successful creation of the supported contract.

## Implementation and delivery stages

| Stage | Current status | Deliverable |
| --- | --- | --- |
| P0 Requirements | Complete | User confirmed existing contract rules, independent detail pages and PostgreSQL |
| P1 Design | Complete | Separate metadata/chain responsibilities; project/account scope; docs/ARCHITECTURE.md |
| P2 Contract | Complete; business code unchanged | Existing artifact reused per user deployment; original contract remains valid |
| P3 Backend/database | Implemented; 54 local cases pass | Catalog, signed registration, scoped blockchain APIs, persistent event/range index, schema/export |
| P4 UI/integration | Implemented; 24 local browser checks and 9 frontend tests pass | Create, registration retry, discovery, creator filter, independent position/activity and shared wallet menu |
| P5 Updated online deployment | Complete: history-index version redeployed; directory, search, pool, database history and static source independently checked | docs/evidence/live-multi-investment-2026-10-07.json |
| P5 Actual updated acceptance | Student reported successful updated MetaMask/Render tests on 7 October | Independent reads supplement student acceptance; hosted restart/two-creator checks not independently repeated |
| P6 Updated report/submission | Report and final PostgreSQL export/package complete; course upload pending | Revised 8-page PDF including references, 13 sections, current captures and editable LaTeX ZIP |

Local browser tests use a real Hardhat chain, real Flask and a simulated wallet. SQLite restart recovery has passed. Real PostgreSQL integration is configured in CI with a disposable database; it was skipped locally because no PostgreSQL server is available. Updated Render/MetaMask acceptance is student-reported and the current public API evidence is independently recorded; neither establishes a dedicated PostgreSQL test or hosted restart experiment.

## Requirement coverage

| Requirement | Current implementation / evidence |
| --- | --- |
| Financial problem/objectives | Beginner-friendly project discovery, exact shares and transparent principal exit |
| Solidity transactions | Independent copies of the same tested caller ledger, custody, events and guarded withdrawals |
| Wallet integration | Explicit selected signer for creation, registration message, deposit and redemption |
| Frontend | English dark responsive discovery/create/detail/history pages and latest five records with automatic older-range synchronization |
| Backend integration | Used directory APIs and actual scoped pool/position/history/receipt APIs |
| Metadata/database | PostgreSQL catalog storing ID/name/description/address/deployment/creator; docs/schema.sql and public export tool |
| Input/error handling | Invalid text/amounts, rejected wallet requests, wrong signer/network/code, conflicting registration, RPC/database errors |
| Tests/evaluation | 54 local backend tests, 9 frontend tests, 24 browser checks; earlier 12 unchanged contract tests; CI PostgreSQL check awaits execution |
| Source/README | Dependencies, lockfile/artifact, setup, database and Render commands, CI and handoff |
| Deployment/evidence | Original receipts retained; updated acceptance and nine successful public checks recorded |
| Report/screenshots | Revised eight-page report with current architecture, PostgreSQL/index and live captures; original screenshot provenance retained |

## Preserved version 1 evidence

Original contract: 0xE560121978f80c390f6B0d091E9579A2812Cb3DD; deployment block 11856501. Existing website: https://sc6113-developemnt-coursework.onrender.com/.

The student previously confirmed successful real MetaMask testing on Render; original public API and deposit/partial/full redemption receipts remain in docs/evidence/. The revised English report for Ji Chengyu, G2608005K keeps valid unchanged-contract evidence and adds current directory/create/detail/history/Render captures. It has eight pages including references, all 13 sections and nine screenshot sources. The PDF and LaTeX ZIP now describe the updated version.

The final PostgreSQL data was exported read-only on 8 October 2026: 2 investments, 10 confirmed events and 9 stored scan ranges. The submission package includes JSON and SQL data with the schema. Next: upload source/database material/README/screenshots/PDF using course instructions. No new screenshot or video is required. Database/service plans, credentials and course submission details remain student choices.
