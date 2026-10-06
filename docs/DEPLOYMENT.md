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

Public metadata is committed in `deployments/sepolia.json`; local Flask configuration is in ignored `.env`. The initial zero share value is only a point-in-time observation, not a permanent assertion about current holdings. A successful deployment does not by itself prove a deposit/redemption flow or a public Render deployment. Those live checks remain pending in `USER_ACTIONS.md` and `docs/TESTING.md`.

After configuration and restart, the local Flask application's `/api/config`, `/api/pool`, `/api/position/<deployer>` and `/api/history/<deployer>` were checked successfully against the live Sepolia pool. Configuration returned the expected chain/address/block; pool principal and holder shares were zero, solvency was true, and confirmed business history was empty. These are read-only integration checks; the student still needs to sign the first deposit/redemption transactions.
