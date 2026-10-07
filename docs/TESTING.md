# Testing and evaluation

## Observed results: 7 October 2026

The multi-investment update passed **54 backend cases, 9 frontend amount/history tests and 24 browser integration checks** on Windows with Python 3.12, Node.js 24.19.0 and the pinned Solidity 0.8.30/Hardhat 3.18.1 artifact. Browser integration uses installed Edge, a real local chain, real Flask/Web3.py and an automated EIP-1193 wallet simulation.

The PostgreSQL integration case was **skipped locally** because no disposable PostgreSQL server was configured. CI now provisions PostgreSQL 16 and TEST_DATABASE_URL. This is planned dedicated CI validation, not an observed passing PostgreSQL integration test. Updated student acceptance and independent public Render checks are recorded separately below. The unchanged business contract's previous 12-test result remains from 6 October 2026.

| Suite | Observed result | Source |
| --- | --- | --- |
| Backend and metadata directory | 54 passed | tests/test_backend.py, tests/test_catalog.py |
| Actual PostgreSQL integration | 1 skipped locally; configured in CI | tests/test_postgres.py |
| Frontend amounts/history | 9 passed | tests/frontend.test.mjs |
| Browser integration | 24 checks passed | tests/browser.mjs; docs/evidence/browser-history-index-2026-10-07.json |
| Business contract | 12 passed on 6 October; unchanged | test/MicroInvest.ts |

Run commands are in README. Backend unit tests mock the RPC boundary; the browser supplies real contract/RPC execution. Local SQLite persistence is tested by recreating the service/database connection. Actual PostgreSQL testing, updated Render acceptance and MetaMask extension behavior remain distinct verification boundaries.

Third-party Web3.py dependencies emit a websockets deprecation warning. It does not change test assertions. The browser writes QA screenshots to ignored test-results/ for layout inspection; these are not student live evidence.

## Backend and directory coverage

The original 17 cases cover valid configuration, no credential disclosure, missing setup, amount formatting, malformed wallets/hashes/cursors, network/runtime mismatch, unsupported mainnet/local configuration, event pagination, empty older ranges and distinct unrelated/not-found/pending/failed/success receipts.

Additional directory coverage verifies:

- Successful deployer-signed registration and immutable idempotent retry.
- Name/description/hash tampering and origin/network/wrong-wallet signatures cannot register a project.
- Missing/malformed signatures, including invalid ECDSA data, fail without catalog insertion.
- Only successful direct creation using the exact supported creation/runtime code is accepted; pending/reverted/transfer/wrong-code transactions are rejected.
- Another name cannot replace registered metadata. Unknown IDs never fall back to the original contract.
- Text/length/control-character validation happens before RPC access.
- Case folding, Chinese keywords, literal % characters, duplicate names, multiword matching, exact numeric ID ranking, pagination and network isolation.
- File-backed directory rows survive disposal/reopening; SQL errors return safe messages without credentials.
- Render refuses missing or SQLite database URLs before writing directory data.

The optional PostgreSQL case checks table creation, concurrent original-pool seeding, insert/uniqueness rollback, idempotence, Unicode/literal search, paging/network isolation and metadata recovery after reconnecting. It requires a dedicated database ending in _test and uses an isolated generated schema. It must not be pointed at the coursework database.

The history update adds a block-zero cursor boundary case and six database-index cases: old-range backfill, file-backed restart recovery, incremental new-block synchronization, idempotent same-block events, pool/wallet isolation, canonical checkpoint replacement and preserving data on failed synchronization. A changed block hash during a scan must abort the write. Five frontend tests cover filling across empty/partial pages, true exhaustion, account-change cancellation, upstream failure and non-advancing cursors. The optional PostgreSQL case now also exercises actual event upserts and checkpoint persistence.

## Browser coverage

All 24 recorded checks are preserved in the evidence JSON. The complete local flow covers:

- Wallet connection/menu permissions, keyboard behavior, rejected permissions, preferred-account reload and correct signing by a non-first authorized account.
- Valid deposits, exact shares, excess redemption rejection, partial/full exit, rejected transactions and wrong-network recovery.
- Five newest overview rows and all 21 records through cursor paging without skipped/duplicate rows; account/context updates and mobile layout.
- After 6,000 inactive local blocks, a fresh page reconnect still displays those five latest events and the complete-history page loads the original records from the persisted index.
- A named independently deployed contract, actual successful creation and signed registration.
- A second account's separate project, rejected registration signature, refresh recovery and retry of the same contract/hash.
- Matching title/description keywords, filtering projects by creator and a 390px search viewport without horizontal overflow.
- One participant investing 0.005 local ETH in one pool and 0.002 in another; pool positions and deposit/history requests stay distinct.
- Redeeming the first pool while the second still holds 0.002 ETH.
- Database-backed names/IDs/addresses surviving a Flask restart, and chain-backed positions/history recovery.
- Explicit RPC outage errors, disabled writes and no uncaught browser script exceptions.

Local testing cannot verify MetaMask extension permission/popup behavior, Sepolia delays or the hosted PostgreSQL connection. Student acceptance and current hosted read-only checks are recorded below; docs/RENDER_UPDATE.md retains the live acceptance procedure.

## Contract invariants and earlier gas evidence

The unchanged 12 contract tests cover one-wei/repeated deposits, separate investors, zero/empty/excess redemption, exact partial/full exits, no deployer privilege, rollback on transfer failure, reentrancy protection, forced ETH accounting, absence of owner/transfer/pause/upgrade and a deterministic 40-operation sequence checking accounting after every operation.

Earlier local receipt gas: first deposit 71,884, partial redemption 50,282 and full redemption 50,272. Independently verified original Sepolia receipts used 245,994 gas for a 0.003 ETH deposit, 53,700 for a 0.001 ETH partial redemption and 50,912 for the 0.002 ETH full exit. Original receipt values are in docs/DEPLOYMENT.md and docs/evidence/. These are historical version 1 observations, not measurements of new project creation/registration or a controlled cross-environment comparison. Actual gas cost is gasUsed × effectiveGasPrice; metadata signatures spend no chain gas.

State reads are constant-sized. Chain history remains bounded by configured block/chunk limits. Confirmed history now has a persistent event index and synchronization checkpoints; it is not a continuously running full-chain indexer. Search uses paged literal matching; no load test, throughput benchmark, actual PostgreSQL latency result or user-study finding is claimed.

## Usability and authorization

The UI explains Sepolia, fixed shares, no returns/platform fee and separate gas. Named projects improve discovery while retaining straightforward deposit/redemption. Forms are labelled, feedback uses live regions and tables scroll inside narrow layouts. This is functional/heuristic testing, not research with novice participants or a complete accessibility audit.

Security boundaries include caller-owned redemption, guarded transfers, exact amounts, explicit wallet signer, deployer-authorized metadata, confirmed creation verification, selected contract/account scope, escaped text, parameterized search and sanitized errors. Project explanations are creator-supplied. Public addresses/activity are public data. One confirmation is not finality; commercial audit/moderation/real-money operation remain outside scope.

## Original and updated live acceptance

The student reported successful actual MetaMask tests on the original Render site on 7 October 2026. Separate hosted API and original Sepolia receipt checks remain in `docs/evidence/live-validation-2026-10-07.json`; seven original student screenshots are retained with provenance.

The student subsequently redeployed the history-index version and confirmed updated testing succeeded. Independent read-only checks in `docs/evidence/live-multi-investment-2026-10-07.json` recorded nine HTTP 200 responses: process liveness, directory, keyword search, project detail API, two scoped pool reads, five-event/complete history and the updated browser module. The directory contains ID 1 (original pool) and ID 2 (`test1`) with distinct addresses. Both observed entries were created by the same wallet; the two-creator claim remains local browser evidence.

The current original-pool history returns `source: database`, the latest five records and ten records in the larger request. The confirmed 0.04 ETH redemption in block 11857372, hash `0xb5fc592ccafcfbc8a5724b5384df947e7083c11028f2d01aadaa6d50962bafec`, has been recovered. Earlier empty recent-block ranges did not mean the on-chain transaction was deleted. The new preview/full-history UI traverses empty ranges and uses the persistent event/range index.

During the update, a dashboard Live status for b6941a7 initially differed from the files served publicly. After the student cleared the build cache and redeployed, the public browser module matched that commit and the database history endpoint worked. The specific hosting cause was not established; liveness alone was not used as application readiness evidence.

Current public-site screenshots and the student's updated Render image are included in the revised eight-page report. Its creation-form capture was illustrative and submitted no deployment. The collector made no wallet requests, direct database connection, load test or hosted stop/restart experiment. Dedicated PostgreSQL integration remains skipped locally; no successful CI execution is invented. The final application-data export was subsequently obtained over a read-only PostgreSQL/TLS connection on 8 October 2026: 2 projects, 10 stored events and 9 scan ranges (docs/evidence/database-export-2026-10-08.json). This export success is separate from the dedicated PostgreSQL test suite and hosted restart validation.
