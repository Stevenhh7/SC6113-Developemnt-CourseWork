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
| P5 Updated online deployment | Multi-investment version deployed by student; public directory/pool checked; later history-index changes need push/redeploy | docs/RENDER_UPDATE.md and USER_ACTIONS.md |
| P5 Actual updated acceptance | Pending real MetaMask/Sepolia checks on the updated site | Two creators, two projects, cross-project participation and restart recovery |
| P6 Updated report/submission | Pending new live evidence and report revision | Existing 8-page report is version 1, not current multi-investment evidence |

Local browser tests use a real Hardhat chain, real Flask and a simulated wallet. SQLite restart recovery has passed. Real PostgreSQL integration is configured in CI with a disposable database; it was skipped locally because no PostgreSQL server is available. New-version PostgreSQL/Render/MetaMask success has not been claimed.

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
| Deployment/evidence | Original Sepolia/Render evidence retained; updated online acceptance pending |
| Report/screenshots | Version 1 originals/PDF retained; current architecture and new live evidence must replace outdated single-pool/no-database descriptions |

## Preserved version 1 evidence

Original contract: 0xE560121978f80c390f6B0d091E9579A2812Cb3DD; deployment block 11856501. Existing website: https://sc6113-developemnt-coursework.onrender.com/.

The student previously confirmed successful real MetaMask testing on Render; independent public API and deposit/partial/full redemption receipts are in docs/evidence/. The original 8-page English report for Ji Chengyu, G2608005K contains 13 required sections and seven original screenshots. Its PDF/source ZIP remain unchanged as historical version 1 artifacts. New code does not invalidate those actual transactions, but they do not establish deployment or acceptance of the new directory.

Next: follow USER_ACTIONS.md to configure PostgreSQL and redeploy, collect new live screenshots, then revise the report and submit source/database material/README/screenshots/PDF. No video is required. Database/service plans, credentials and course submission details remain student choices.
