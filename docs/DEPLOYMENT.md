# Sepolia deployment evidence

The student deployed this pool through MetaMask using the project's wallet setup page. On 2026-10-06, the public Sepolia JSON-RPC endpoint independently returned chain ID 11155111, runtime bytecode matching `contract/MicroInvest.json`, and a successful creation receipt in the supplied deployment block. This was a read-only verification; no additional transaction was submitted by the verification process.

| Field | Actual value |
| --- | --- |
| Network | Ethereum Sepolia, chain ID 11155111 |
| Contract | `0xE560121978f80c390f6B0d091E9579A2812Cb3DD` |
| Deployment block | 11856501 |
| Creation transaction | `0x45dba804763f4d53c4da30957b3d4da0f02dd15eecb65762a904926f99efd2ea` |
| Receipt status | 1 (successful) |
| Deployer | `0xc63A507a39C37CB4C752BA56408138386D06146f` |
| Compiler | Solidity 0.8.30 |
| Actual deployment gas used | 1,814,581 |
| Initial observed total share units | 0 |

[Contract explorer](https://sepolia.etherscan.io/address/0xE560121978f80c390f6B0d091E9579A2812Cb3DD) · [Creation transaction](https://sepolia.etherscan.io/tx/0x45dba804763f4d53c4da30957b3d4da0f02dd15eecb65762a904926f99efd2ea)

Public metadata is committed in `deployments/sepolia.json`; local Flask configuration is in ignored `.env`. The initial zero share value is a point-in-time observation. The subsequent live flow and hosted validation are recorded below.

After initial configuration and restart, the local Flask application's `/api/config`, `/api/pool`, `/api/position/<deployer>` and `/api/history/<deployer>` were checked successfully against the live Sepolia pool. Configuration returned the expected chain/address/block; initially principal and holder shares were zero, solvency was true, and confirmed history was empty. Later signed transactions changed those values as described below.

## Render and live acceptance on 7 October 2026

The public application is [MicroInvest on Render](https://sc6113-developemnt-coursework.onrender.com/). The student reported completing all functional tests there with actual MetaMask. Separate read-only HTTPS checks returned HTTP 200 from the home page, `/healthz`, `/api/config`, `/api/pool`, the participant position, complete history and three transaction-receipt endpoints. The configuration identifies the expected Sepolia chain and contract. The hosted home page includes the account menu and full-activity link.

At the recorded snapshot, pool principal, contract balance and the checked participant's shares were zero following completed redemptions; solvency was true. Eight confirmed business events were returned for the participant. Raw responses, individual snapshot blocks and UTC query times are in `docs/evidence/live-validation-2026-10-07.json`. The report and filename date use Asia/Shanghai.

| Actual operation | Amount in ETH | Shares after | Block | Receipt gas used |
| --- | --- | --- | --- | --- |
| [Deposit](https://sepolia.etherscan.io/tx/0x0304792edcd32dc589e6e5c7756f86fdc33a283c295b78772a8e323b4d490798) | 0.003 | 0.003 | 11856700 | 245,994 |
| [Partial redemption](https://sepolia.etherscan.io/tx/0xcb3ebbe7044daf65d6129d01cb936cfaa9ccc8553b347ebccbe13a09b477804e) | 0.001 | 0.002 | 11856703 | 53,700 |
| [Full redemption](https://sepolia.etherscan.io/tx/0xe47ab65933833624b02fddd362fcce5ade0c734d1626790b3239831ff4f06e9a) | 0.002 | 0 | 11856705 | 50,912 |

These receipts are successful, and their event amounts match the principal lifecycle. Gas costs are stored as exact wei strings in the evidence JSON. No transaction was submitted by the evidence collector; the student signed the real operations. Invalid input and wallet behavior are supported by the student's live acceptance statement and supplied screenshots, not inferred solely from successful chain events.

## Student screenshot evidence

Seven originals are preserved in `report/screenshots/`, with dimensions, captions and SHA-256 in `manifest.json`. They show Sepolia deployment confirmation, two connected accounts, confirmed transaction history, negative-amount validation, zero holdings after confirmed redemption, pool API data and Render deployment logs. The API image is a later snapshot than the independent evidence file: it shows 0.04 ETH principal/balance at block 11857366 and solvency true. The redemption image subsequently shows zero personal shares and principal at block 11857372. Render reports Deploy succeeded / Live for commit `b65f9c3` on 7 October 2026 at 00:51:36 GMT+8, with Gunicorn startup and the public URL. The report distinguishes these observation times.
