# MicroInvest — SC6113 Financial DApp

MicroInvest helps investing beginners understand a small investment's full on-chain lifecycle: deposit test ETH into one pool, view fixed internal shares, and redeem part or all of their principal whenever they choose.

**Coursework prototype. Sepolia test ETH only.** One ETH corresponds to one share, including fractions. There is no yield, market investment strategy, platform fee, transferable token, administrator, upgrade or pause. Transactions still cost network gas. This project demonstrates the investment workflow and custody/accounting model; it does not generate returns.

## Implementation and delivery status

The Solidity contract, Flask APIs, English HTML/CSS/JavaScript UI, wallet deployment page, local developer runner, automated tests, documentation and Render configuration are implemented. The baseline suites passed on 2026-10-06: 12 contract tests, 17 backend tests, 4 amount/error tests and 15 browser integration checks. The account-menu update was checked on 2026-10-07 with 19 browser checks, 17 backend tests and 4 amount/error tests passing. See [testing and evaluation](docs/TESTING.md).

**The contract is now deployed on Sepolia.** The student signed the deployment through MetaMask; its successful creation receipt and exact runtime bytecode were independently checked through Sepolia RPC on 2026-10-06. Public metadata is in `deployments/sepolia.json`; see [deployment evidence](docs/DEPLOYMENT.md). The live deposit/redemption flow and public Render deployment still require the student's wallet/account actions. Follow the deployment steps below and [the student action checklist](USER_ACTIONS.md). PDF report and screenshots are excluded from this implementation request and remain the student's work.

## Technology and repository

- Solidity 0.8.30, Hardhat 3, ethers 6; integer wei accounting.
- Python 3.12, Flask and Web3.py; read-only blockchain queries, no database.
- Vanilla HTML/CSS/JavaScript; MetaMask signs transactions in the browser.
- Render serves Flask through Gunicorn. The committed contract artifact and local ethers bundle mean Render needs only Python.
- VS Code is the development IDE. Node.js is contract/test tooling, not the web backend.

```text
contracts/MicroInvest.sol        Business contract
contracts/test/                 Adversarial test helpers; not deployed by the app
contract/MicroInvest.json       Exported ABI, creation bytecode and runtime bytecode
test/MicroInvest.ts             Solidity integration/security tests
app.py, microinvest/chain.py    Flask routes and read-only blockchain service
templates/, static/             English responsive UI and vendored ethers + license
scripts/                       Build/export, wallet-free CLI deploy and local runner
tests/                         Backend, amount/error and browser tests
render.yaml                    Render web service blueprint
docs/                          Architecture, API, testing and evaluation
Plan.md, USER_ACTIONS.md        Implementation status and remaining student actions
```

## Prepare a clean development environment

Open **this repository root** in VS Code. Use Node.js 24 and Python 3.12. Install pnpm 11.19.0 (or prefix pnpm commands with `npx pnpm@11.19.0` if pnpm is not installed).

Windows PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
pnpm install --frozen-lockfile
pnpm run compile
pnpm run vendor
```

macOS/Linux:

```sh
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
pnpm install --frozen-lockfile
pnpm run compile
pnpm run vendor
```

Compile regenerates `contract/MicroInvest.json`. Vendor regenerates `static/vendor/ethers.umd.min.js` and its license. Commit both when updating their source/dependency. Solidity uses the pinned local `solc` package; no compiler download is needed after dependency installation. A fresh deployment is required after changing the contract: the backend verifies the deployed runtime bytecode matches this artifact.

## Run a local demo

```sh
pnpm run dev:local YOUR_PUBLIC_WALLET_ADDRESS
```

Replace the argument with the public address of the MetaMask account you want to test. The runner starts a fresh Hardhat chain, deploys the contract, gives that address **10 local test ETH** from a local unlocked account, and starts Flask at `http://127.0.0.1:5000`. No private key is needed. Omit the argument if funding is unnecessary. Funding is guarded to chain ID 31337.

In MetaMask, add a custom **local** network with RPC `http://127.0.0.1:8545`, chain ID `31337`, currency `ETH`. Select it, open the local application and connect the funded account. Deposit `0.003`, redeem `0.001`, then redeem all. This local network is separate from Sepolia. The browser test suite uses an automated wallet simulation; using the demo with MetaMask provides an additional real extension check.

Press Ctrl+C to stop. Ports 8545 and 5000 must be free. Each restart creates a fresh local chain and overwrites the ignored `deployments/localhost.json`; reset any stale local-network wallet activity if nonces are inconsistent. Sepolia state is unaffected. Existing `.env` Sepolia values are overridden only inside the local runner's child processes; the file is not modified.

Alternatively, use three terminals:

```sh
pnpm run node
pnpm run deploy:local
```

Then set `CHAIN_ID=31337`, `LOCAL_DEVELOPMENT=true` and `RPC_URL=http://127.0.0.1:8545` in `.env`, using the address and deployment block printed by deployment; run `.venv/Scripts/python.exe app.py` on Windows or `.venv/bin/python app.py` elsewhere.

## Choose a participating account

After connecting, click the wallet address in the header to open its account menu. Select a connected account to load that account's position and activity; deposits and redemptions request a signature from that selected account. Use **Manage accounts in MetaMask** to authorize other accounts. The list contains only addresses exposed by the wallet to this site, and an account choice cannot grant wallet permissions by itself. **Reconnect wallet** also restores the required network after a network change. The same menu is available on the full activity page. A saved selection is restored only if the wallet still exposes that account.

## Deploy the contract to Sepolia with MetaMask

The existing pool is already deployed and configured locally (see `deployments/sepolia.json`). Reuse it for the current demo. The steps below are for rebuilding setup or deliberately creating a new independent pool; do not deploy again simply to continue testing.

1. Enable Sepolia in MetaMask and obtain enough Sepolia test ETH for deployment, deposits and gas. Use a test wallet. Do not give its private key or recovery phrase to this project, Render or another person.
2. Copy `.env.example` to `.env`. Keep `CHAIN_ID=11155111`, `LOCAL_DEVELOPMENT=false`. Set `RPC_URL` to a Sepolia HTTPS JSON-RPC endpoint supporting `eth_getLogs`. Leave `CONTRACT_ADDRESS`, `DEPLOYMENT_BLOCK` and `DEPLOYER_PRIVATE_KEY` empty initially. The sample public RPC is a convenience fallback, not a guaranteed service.
3. Start Flask: `.venv/Scripts/python.exe app.py` (Windows). Open `http://127.0.0.1:5000/deploy`. The setup page works before a pool address is configured.
4. Connect MetaMask, confirm the target is **Sepolia**, choose **Deploy contract** and approve deployment. Wait for **Deployment confirmed**. A new click deploys a different independent pool; retain the existing transaction hash if confirmation is delayed.
5. Copy the displayed `CONTRACT_ADDRESS` and `DEPLOYMENT_BLOCK` into `.env`. Download deployment JSON; save it as `deployments/sepolia.json` if desired. It contains public metadata only. Restart Flask, open `/`, and verify `/api/pool` reads successfully.
6. Test deposit, partial redemption and full exit on Sepolia; check the transaction hashes on Sepolia Etherscan. Save the deployment address, block and hash for submission.

Deployment uses `contract/MicroInvest.json`, has no constructor arguments and gives the deploying wallet no special rights. `/deploy` never changes server configuration automatically; the deployer's confirmation and copied settings select the pool used by the app.

An optional CLI alternative is `pnpm run deploy:sepolia`. It uses `SEPOLIA_RPC_URL` and a locally configured `DEPLOYER_PRIVATE_KEY` from `.env`, writes public metadata to `deployments/sepolia.json`, and prints the address/block. The recommended wallet deployment above avoids exporting a private key entirely. **Never put `DEPLOYER_PRIVATE_KEY` on Render or commit `.env`.**

## Publish Flask on Render

1. Review and push these files to the existing GitHub repository `Stevenhh7/SC6113-Developemnt-CourseWork`. Select repository visibility and the Render service plan yourself. The app does not require a paid disk or database.
2. In Render, connect the repository and create a Blueprint using `render.yaml`, or manually create a Python Web Service with the settings below. This repository itself is the service root; do not set its parent `Course` directory as Root Directory.
3. Enter the actual Sepolia `RPC_URL`, `CONTRACT_ADDRESS` and `DEPLOYMENT_BLOCK` as service environment variables. Set `CHAIN_ID=11155111`, `LOCAL_DEVELOPMENT=false`, `PYTHON_VERSION=3.12.10`. Keep any RPC credentials in Render environment settings.
4. Deploy and open the assigned HTTPS site. Confirm `/healthz`, then `/api/pool`, then connect MetaMask on the home page. Health checks only confirm the web process is alive; `/api/pool` additionally validates the network and exact contract bytecode.
5. Repeat the small deposit/partial/full redemption flow from the public site. Refresh and restart/redeploy the service to confirm confirmed history and positions return from chain. No local database or server file stores user balances.

| Render field | Value |
| --- | --- |
| Runtime | Python |
| Build command | `pip install -r requirements.txt` |
| Start command | `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120` |
| Health check | `/healthz` |
| Service root | Repository root; leave Root Directory empty |

Render's assigned `$PORT` is used by Gunicorn. Do not use `python app.py` as the production start command because the development entry point binds to localhost. The Blueprint deliberately leaves plan selection to you. Provider limits or free-service cold starts can delay reads; retry without treating a timeout as a failed on-chain transaction.

## Environment settings

| Variable | Meaning |
| --- | --- |
| `CHAIN_ID` | `11155111` for Sepolia; only `31337` with explicit local development also accepted |
| `RPC_URL` | Backend read-only JSON-RPC URL; never returned in public API configuration |
| `CONTRACT_ADDRESS` | Address of this exact compiled MicroInvest contract |
| `DEPLOYMENT_BLOCK` | Actual deployment block; event history starts here |
| `LOCAL_DEVELOPMENT` | `false` in deployment; `true` only for a local chain |
| `PORT` | Local Flask port; Render supplies production port |
| `RPC_TIMEOUT` | Per-RPC HTTP timeout in seconds, default `10` |
| `LOG_CHUNK_SIZE` | Blocks per log request, default `1000`, range 1–1000 |
| `HISTORY_PAGE_BLOCKS` | Blocks scanned per history page, default `5000`, range 1–10000 |
| `SEPOLIA_RPC_URL` | Optional CLI deployment RPC; not used by Flask |
| `DEPLOYER_PRIVATE_KEY` | Optional local CLI signer only; unnecessary for wallet deployment |

An environment address/block takes precedence over matching deployment JSON. Private provider URLs and exception details are not exposed in API responses/log messages. No wallet credential belongs in any variable above.

## Tests

```sh
pnpm run compile
pnpm test
```

Windows backend:

```powershell
.\.venv\Scripts\python.exe -m pytest -p no:cacheprovider
```

Linux/macOS backend: `.venv/bin/python -m pytest -p no:cacheprovider`.

Browser integration needs Chromium or installed Windows Edge:

```sh
pnpm exec playwright install chromium
pnpm run test:browser
```

On Linux CI use `pnpm exec playwright install --with-deps chromium`. On Windows, installed Edge is used automatically when Playwright Chromium is absent, so the install command can be omitted. Set `BROWSER_CHANNEL` to another supported installed channel if needed. The browser suite starts/stops its own chain on 18545 and Flask on 5081; those ports must be free. It uses a simulated EIP-1193 wallet, actual contract execution and actual Flask queries. It creates JSON test evidence, **no screenshots**. `PYTHON_BIN` can override the `.venv` Python path.

`test-results/contract-gas.json` and `test-results/browser.json` are generated local evidence and ignored by Git. Detailed cases and evaluation limits are in [docs/TESTING.md](docs/TESTING.md). CI runs all four suites on a local chain; it never sends Sepolia transactions.

## Operational behavior and limits

Amounts stay as `BigInt`/integer wei. Fractional inputs support up to 18 decimals and reject zero, negative, exponent notation and overflow. Only the holder's shares can be redeemed. Failed outgoing transfers revert accounting. A reentrancy guard and checks/effects/interactions protect withdrawals; direct unaccounted sends are rejected. Forced ETH is distinguished from recorded principal and does not create shares or yield.

The frontend treats a hash as **submitted**, and a successful mined receipt as **confirmed**. Reverted, rejected, cancelled and unknown results remain distinct. The latest submitted operation is stored in browser local storage under network/pool/wallet so it can be rechecked after a refresh; confirmed activity is reconstructed from chain events. Rejected requests and failed receipts are not successful business events and are not permanent entries in the confirmed history table.

The overview displays at most the five newest records returned for the recent history range. **View all activity** opens `/activity?wallet=...` for the selected public wallet address. This read-only page starts with 20 records and lets you load older pages until the complete history is displayed; it also supports refresh and wallet account changes. Earlier inactive block ranges can be browsed there without expanding the overview.

One mined confirmation is used for this coursework. It is not an Ethereum finality guarantee. RPC reads can lag or be rate limited. Load older block ranges to retrieve earlier activity; pagination keeps block/log-index cursors so transactions in the same block are not skipped. No commercial audit or real-money suitability is claimed. Wallet addresses, values and activity are public on chain; read-only APIs intentionally require no login.

If the setup banner appears, check address/block/RPC configuration. If a wrong-contract error appears, ensure you deployed the artifact committed with this version. If history queries fail, try another RPC or reduce chunk/page limits. If a confirmation times out, retain the hash and use **Check status** or the explorer before trying again.

## Coursework handoff

See [Plan.md](Plan.md) for requirement coverage, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for design/API and [USER_ACTIONS.md](USER_ACTIONS.md) for the remaining account, live verification, PDF and screenshot tasks. Include source files, README, contract artifact, deployment metadata, tests and your final evidence when submitting. Exclude `.env`, `.venv`, `node_modules`, package caches and any wallet credentials.

Implementation tooling references: [Hardhat documentation](https://hardhat.org/docs/getting-started), [custom Solidity compiler](https://hardhat.org/docs/cookbook/custom-solidity-compiler), [Render Flask deployment](https://render.com/docs/deploy-flask).
