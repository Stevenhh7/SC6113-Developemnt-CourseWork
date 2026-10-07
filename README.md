# MicroInvest — SC6113 Financial DApp

MicroInvest lets investing beginners discover a named investment, contribute Sepolia test ETH, view fixed internal shares and redeem their own principal. Any connected user can create an independent investment contract with a name and description.

**Coursework prototype. Sepolia test ETH only.** Each pool uses 1 ETH = 1 internal share, including fractions. There is no yield, market strategy, platform fee, share transfer, administrator or upgrade. Creators have no right to withdraw participants' principal. Network transactions still cost gas.

## Current version and evidence

The multi-investment version adds wallet deployment and signed registration, a searchable directory, creator filtering and independent investment/activity pages. PostgreSQL stores project metadata and confirmed event history on Render; ignored SQLite files support local development. Principal and shares remain authoritative on-chain; confirmed history is indexed from canonical chain events. The original Sepolia pool is imported into the directory once.

The local update passed 54 backend cases, 9 frontend amount/history tests and 24 browser integration checks on 7 October 2026. The unchanged business contract previously passed 12 contract tests. Browser checks use a real local chain and a simulated wallet. A PostgreSQL integration check is configured in CI; it was not run locally because this host has no PostgreSQL server. See [testing](docs/TESTING.md).

The original [deployment evidence](docs/DEPLOYMENT.md) retains valid receipts from the unchanged contract. The [Render site](https://sc6113-developemnt-coursework.onrender.com/) now serves the updated multi-investment directory and persistent history. **The student redeployed the history-index version and reported successful updated testing on 7 October 2026.** Independent public checks verified two contracts, keyword search, pool reads, updated browser code and database-backed history; see [updated live evidence](docs/evidence/live-multi-investment-2026-10-07.json). The revised [report](report/README.md) has eight pages including references, all 13 required sections and current screenshots. Dedicated PostgreSQL integration and hosted stop/restart tests are not claimed as independently passed.

## Technology

- Solidity 0.8.30, Hardhat 3 and ethers 6; exact integer wei accounting.
- Python 3.12, Flask and Web3.py; SQLAlchemy 2.0 with psycopg 3 for PostgreSQL.
- Vanilla English HTML/CSS/JavaScript; MetaMask signs deployment, registration messages and user transactions.
- Render + Gunicorn for Flask. Node.js is for contract/test tooling, not the web backend.
- VS Code for development; committed ABI/bytecode and vendored ethers mean Render needs only Python.

Important files:

| Location | Purpose |
| --- | --- |
| contracts/MicroInvest.sol | Identical business rules for every independently deployed pool |
| contract/MicroInvest.json | ABI, creation bytecode and runtime bytecode |
| app.py, microinvest/chain.py | Flask routes, scoped blockchain reads and deployment verification |
| microinvest/catalog.py, microinvest/history.py | Project metadata, search and persistent confirmed-event index |
| templates/, static/ | Discovery, creation, investment, activity and account menu |
| scripts/init-catalog.py | Initialize directory before Gunicorn workers start |
| scripts/export-catalog.py, docs/schema.sql | Public metadata export and PostgreSQL schema for submission |
| tests/, test/, .github/workflows/ci.yml | Backend, real PostgreSQL CI, browser and contract checks |
| docs/RENDER_UPDATE.md, USER_ACTIONS.md | Updated deployment and student actions |

## Development setup

Open this repository root in VS Code. Use Python 3.12, Node.js 24 and pnpm 11.19.0. Windows PowerShell:

~~~powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
pnpm install --frozen-lockfile
pnpm run compile
pnpm run vendor
~~~

On macOS/Linux use python3.12 and .venv/bin/python. If needed, prefix pnpm commands with npx pnpm@11.19.0. Compile and vendor regenerate the committed contract artifact and local ethers bundle.

Copy .env.example to .env. For Sepolia set RPC_URL, CHAIN_ID=11155111 and LOCAL_DEVELOPMENT=false. Existing public deployment metadata can remain configured. With DATABASE_URL blank, local Flask creates instance/catalog.sqlite3; this file is ignored by Git. To use local PostgreSQL, set DATABASE_URL to your own connection URL. Then:

~~~powershell
.\.venv\Scripts\python.exe app.py
~~~

Open http://127.0.0.1:5000/. Search works without a connected wallet. A server RPC supporting eth_getLogs is required for chain reads and verification of newly deployed projects. Never configure a wallet private key on Render.

## Local chain demo

~~~sh
pnpm run dev:local YOUR_PUBLIC_WALLET_ADDRESS
~~~

This starts a fresh Hardhat chain, deploys an original pool, optionally sends 10 **local** test ETH to the supplied public address and starts Flask on port 5000. It uses a fresh local SQLite directory for each demo and overrides any hosted DATABASE_URL in its child process. No private key is needed.

In MetaMask add RPC http://127.0.0.1:8545, chain ID 31337 and currency ETH. Connect the funded account, find the original pool, and test deposit/partial/full redemption. You can also create additional projects. Ctrl+C stops the demo; each new demo resets the local chain and uses a new project directory. Old local-chain deployment recovery records in browser storage may become stale after a reset. Sepolia and hosted metadata are unaffected. Ports 8545 and 5000 must be free.

## Create and participate

1. Open **Create investment** (/deploy), connect MetaMask and choose an authorized account from the header menu.
2. Enter a name (1–120 characters) and explanation (1–2000 characters).
3. Approve contract deployment on the target network. Wait for a successful receipt.
4. Approve the registration message. This message binds the name, description, creation hash, network and site; it spends no gas and transfers no funds.
5. Flask verifies the signature against the actual deployer, successful creation receipt and exact supported bytecode. The directory assigns an investment ID and stores its public metadata.
6. Open the project page or search its name/description/ID/address from Explore. Each page shows the selected project's contract, pool, personal position and activity.
7. Deposit a positive amount, redeem part or use **Redeem all shares**. Every transaction uses the selected authorized wallet and selected project's contract.

A deployment hash is retained if confirmation or registration is interrupted. **Retry registration** reuses that deployment rather than deploying again. Browser recovery survives refresh on the same browser/site; download the public JSON record as an additional reference. Published metadata is immutable in this version. Duplicate names are allowed; ID and contract address distinguish projects. Project explanations are creator-supplied text, not a promise of investment returns.

The wallet menu lists only accounts MetaMask exposes to this site. **Manage accounts in MetaMask** authorizes additional accounts; menu selection cannot grant permission by itself. Other users can participate in a creator's pool, but each can redeem only their own position.

Each overview automatically reads older ranges until the latest five confirmed records are found or history is exhausted. Confirmed events and completed scan ranges are stored in PostgreSQL, and later requests synchronize new blocks rather than re-reading all old logs. **View all activity** opens /investments/<id>/activity?wallet=... with 20 records per displayed page; empty block ranges are skipped automatically. The contract address scopes balances, pending-operation storage and event queries. Unknown project IDs return an error instead of silently selecting another pool.

## Update Render

Follow [the complete Render update guide](docs/RENDER_UPDATE.md). Keep the existing Python web service, create PostgreSQL in the same region, set its internal connection URL as DATABASE_URL, push the updated source and redeploy.

| Setting | Value |
| --- | --- |
| Root Directory | Empty: repository root |
| Build | pip install -r requirements.txt |
| Start | python scripts/init-catalog.py && gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120 |
| Health | /healthz |
| Python | 3.12.10 |
| Network | CHAIN_ID=11155111; LOCAL_DEVELOPMENT=false |
| Database | DATABASE_URL with PostgreSQL connection URL |

Render startup refuses a missing/SQLite DATABASE_URL to avoid storing the online directory on an ephemeral file. The initializer creates tables and imports the original configured pool before multiple workers start. Keep RPC_URL server-side. Keep the original CONTRACT_ADDRESS and DEPLOYMENT_BLOCK for the initial import and legacy API links. **New projects require no environment change or server restart.**

Service and database plans remain your choice. Render's [free service documentation](https://render.com/docs/free) states that free PostgreSQL databases expire 30 days after creation. Choose a plan whose availability covers your submission/demo period. See [PostgreSQL connection instructions](https://render.com/docs/postgresql-creating-connecting).

## Configuration

| Variable | Meaning |
| --- | --- |
| DATABASE_URL | PostgreSQL URL online; blank uses ignored SQLite locally |
| CHAIN_ID | 11155111 for Sepolia; 31337 only with explicit local development |
| RPC_URL | Read-only backend JSON-RPC endpoint; never returned publicly |
| CONTRACT_ADDRESS, DEPLOYMENT_BLOCK | Original pool imported into the directory; optional when starting without one |
| LOCAL_DEVELOPMENT | false online; true only for a local chain |
| PORT | Local port; Render supplies production port |
| RPC_TIMEOUT | Per-RPC timeout seconds, default 10 |
| LOG_CHUNK_SIZE | Blocks per log request, default 1000, maximum 1000 |
| HISTORY_PAGE_BLOCKS | Scan window per page, default 5000, maximum 10000 |
| SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY | Optional local CLI deployment only; unnecessary for the recommended wallet flow |

An environment address/block takes precedence over deployment JSON. A mismatched RPC chain or runtime bytecode is rejected. Database and RPC credentials do not appear in public responses. There is no backend wallet signing key.

The optional pnpm run deploy:sepolia CLI still creates an unregistered original pool and writes public deployment metadata; the named project creation flow is /deploy. Never commit .env or use a participant's private key in deployment settings.

## Tests and submission

~~~sh
pnpm test
pnpm run test:browser
~~~

Windows backend: .venv/Scripts/python.exe -m pytest -p no:cacheprovider. Browser testing needs Playwright Chromium or installed Windows Edge; use pnpm exec playwright install chromium if absent. Tests start their own chain on 18545 and Flask on 5081 and use isolated SQLite. Test results and UI QA images go into ignored test-results/; QA images are not live report evidence.

CI supplies a disposable PostgreSQL 16 database for tests/test_postgres.py. To run it elsewhere, set TEST_DATABASE_URL to a dedicated database ending in _test; it is separate from the application DATABASE_URL. Do not use the live coursework database for tests.

The SQL schema is [docs/schema.sql](docs/schema.sql). To export public project rows from the configured database for submission:

~~~powershell
.\.venv\Scripts\python.exe scripts/export-catalog.py --include-history --output test-results/catalog-public.json
~~~

Run against the final database (Render Shell if available, or a local connection using Render's external URL) and review the exported rows. The export contains public project metadata, indexed transaction events and scan checkpoints, with no credentials; it is not a full PostgreSQL backup/restore utility. Do not submit the SQLite test/demo directories or database connection strings.

See [Plan.md](Plan.md), [architecture](docs/ARCHITECTURE.md), [testing](docs/TESTING.md) and [student actions](USER_ACTIONS.md). The final PDF/source ZIP now describes the current multi-investment/database design. The final database export was obtained read-only on 8 October 2026 (2 projects, 10 stored events, 9 scan ranges) and added to the submission ZIP as JSON and SQL; see docs/evidence/database-export-2026-10-08.json. Course upload remains the student task.

## Limits

All amounts use integer wei/BigInt; positive decimals support up to 18 decimal places. A successful mined receipt, rather than a hash, determines confirmation. Wallet rejection, revert, replacement, cancellation and unknown status remain distinct. The contract protects caller-owned principal with guarded withdrawals and rolls back failed transfers.

Search uses case-folded, parameterized literal matching across name, description, address and creator; multiple words must all match. It is bounded and paginated, but is not fuzzy/semantic search or a large-scale indexer. Metadata requires the deploying wallet's signature; there is no project editing, moderation or profile/login feature. PostgreSQL resolves project pages and stores history. RPC remains necessary for balances, incremental event synchronization and canonical checkpoint verification. Stored historical share snapshots are not a current balance source. One mined confirmation is a coursework choice, not Ethereum finality. No commercial audit, throughput benchmark or novice participant study is claimed.
