# Testing and evaluation

## Observed local results

On 2026-10-06 the implementation passed these suites on Windows, Node.js 24.19.0, Python 3.12, Solidity 0.8.30 and Hardhat 3.18.1. Browser integration used installed Microsoft Edge, real Flask/Web3.py queries and a real local Hardhat chain. Its EIP-1193 wallet is a simulation, not a real MetaMask extension. No Sepolia transaction or Render deployment is represented by these local results.

| Suite | Result | Evidence / command |
| --- | --- | --- |
| Contract | 12 passed | `test/MicroInvest.ts`; `pnpm run test:contract` |
| Flask/backend | 17 passed, including parametrized cases | `tests/test_backend.py`; `.venv/Scripts/python.exe -m pytest -p no:cacheprovider` |
| Exact amounts and safe errors | 4 passed | `tests/frontend.test.mjs`; `pnpm run test:frontend` |
| Browser integration | 13 checks passed | `tests/browser.mjs`; `pnpm run test:browser` |

Commands can be rerun from README. Browser/contract runs write `test-results/browser.json` and `test-results/contract-gas.json`, which are ignored local evidence. No screenshot or final PDF is produced. Third-party Web3.py dependencies may emit a deprecation warning; it does not change assertions. Solidity warns about `selfdestruct` in the **test-only forced-ETH helper**, not the business contract.

## Contract coverage

1. A one-wei deposit preserves exact shares and emits the expected investor/value.
2. Repeated deposits and two independent investors retain separate positions.
3. Zero deposit, zero redemption and empty full exit revert.
4. Partial exit debits exactly the selected amount; wallet receives the same amount after accounting separately for receipt gas.
5. Full exit clears shares, cannot be repeated while empty, and permits redeposit.
6. Another investor and the deploying wallet cannot spend someone else's shares.
7. Over-redemption reverts without changing recorded balances.
8. A receiver that rejects ETH causes all accounting changes to roll back.
9. An adversarial receiver's nested withdrawal is blocked; the ordinary outer redemption remains correct.
10. Forcibly delivered ETH creates no shares/yield and does not affect the holder's entitlement.
11. No owner/transfer/pause/upgrade interface exists; a plain native transfer is rejected.
12. A deterministic 40-operation multi-user sequence checks user balances, total shares and contract balance after each operation.

These tests inspect economic and authorization outcomes rather than relying only on whether a call returned. They cover reentrancy and transfer rollback, not all conceivable vulnerabilities or a commercial security audit.

## Backend and precision coverage

Tests validate public configuration without RPC credentials, unconfigured setup, malformed wallet/hash input before RPC access, limits/cursors, sanitized upstream failures, chain/bytecode mismatches, rejection of mainnet/accidental local configuration, unrelated transaction hashes and distinct unknown/pending/failed/success receipts. ABI-encoded event logs test same-block pagination without skipped records and an empty range that still permits reading older ranges. Exact decimal formatting, security headers and read-only methods are checked.

JavaScript tests exercise one wei, fractional decimal input, values exceeding Number's safe integer range, whitespace, and rejected zero/negative/exponent/nonnumeric/over-precision input. Wallet error messages distinguish rejection and insufficient gas balance without exposing raw provider messages. The implementation additionally bounds parsed amounts to uint256.

Backend unit tests mock the RPC boundary; the browser suite supplies complementary real contract/RPC/backend execution. A unit mock alone is not evidence of successful network deployment.

## Browser integration coverage

The automated browser runs the actual rendered application with no screenshots:

1. Flask validates deployed runtime bytecode and reads actual pool state.
2. Wallet connection displays a zero initial position.
3. Zero input is rejected; deposit 0.003 local ETH is mined and displays exactly 0.003 shares.
4. An excessive redemption is rejected; redeeming 0.001 leaves 0.002 shares.
5. Switching wallet isolates position and activity, then restores the first wallet's data.
6. Full exit leaves zero shares and three confirmed business events.
7. Wallet rejection produces declined feedback and leaves chain state unchanged.
8. Wrong network disables writes; reconnection restores them.
9. Restarting the Flask process reconstructs confirmed history from chain without a database.
10. A 390px-wide viewport does not cause document-level horizontal overflow.
11. The wallet deployment page deploys a real local contract and displays confirmed address/block.
12. Stopping the RPC node produces an explicit error, unknown position display and disabled deposit.
13. The browser emits no uncaught script exceptions throughout the flow.

The simulated provider supports controlled rejection/account/network changes but cannot verify MetaMask extension permissions, popup UI, provider-specific behavior or Sepolia latency. Those checks remain in the live acceptance list below.

## Gas and performance evaluation

Observed receipt gas in the pinned local compiler/optimizer configuration:

| Operation | Gas used | Scenario |
| --- | ---: | --- |
| Deposit | 71,884 | First deposit into a new pool, 0.01 ETH |
| Partial redemption | 50,282 | Redeem 333 of 1,000 wei |
| Full redemption | 50,272 | Redeem all 999 wei |

These values come from `receipt.gasUsed`, not estimates or invented Sepolia measurements. Actual cost is `gasUsed × effectiveGasPrice`, in wei. Later deposits, state changes, compiler changes and the target network can alter gas. Network gas is independent of the zero platform fee; redeeming principal does not reimburse gas.

State reads are constant-size contract calls. Each history request scans a bounded block window in bounded RPC chunks, defaults 5,000/1,000, and fetches timestamps only for returned records. This controls individual request size but repeated older pages still depend on activity age and RPC capacity. There is no database/indexer; no load test, production latency measurement or concurrent-user throughput claim is made. Compare actual Sepolia receipt gas/cost and Render read timings during live acceptance if discussing production performance in the report.

## Usability and security evaluation

The UI explains the fixed ratio, testnet, absence of returns and separate gas costs at the point of use. Deposit, partial exit and exit-all have separate visible controls; forms have labels, feedback is announced through live regions, and history scrolls within its table on narrow screens. The simulated browser completed the principal lifecycle with feedback for zero input, excess redemption, rejection and RPC failure. This is functional/heuristic evaluation, not a study with novice participants or a complete accessibility audit.

Security controls include wallet-side signing, no backend key, caller-bound withdrawals, no deployer privilege, reentrancy lock, rollback on ETH transfer failure, exact integer accounting, non-transferable shares, read-only validated APIs, runtime bytecode/network checks, safe provider errors and a restrictive Content Security Policy. Public chain addresses/activity are not private; no user identity/profile database is stored. One mined confirmation is not chain finality. External RPC failures and wallet extensions remain trust/availability dependencies.

## Live acceptance still required

Use a funded Sepolia MetaMask account and the actual public Render URL. Record real hashes/address/blocks; do not substitute local test evidence for these results.

| Step | Expected outcome |
| --- | --- |
| Deploy via `/deploy` | Successful Sepolia creation receipt; saved public address/block/hash |
| Render `/api/pool` | Sepolia chain and exact deployed contract accepted |
| Connect actual MetaMask | Correct account/network visible; refusal does not create activity |
| Deposit a small amount | Confirmed successful receipt, exact shares and event |
| Partial / full exit | Matching principal debit and exact remainder/zero; gas shown by wallet |
| Invalid input / excess exit | Clear rejection, no unintended chain change |
| Second wallet / network switch | Isolated position and disabled wrong-network writes |
| Refresh / Render restart | Same confirmed chain-backed position/history |
| RPC outage / delayed confirmation | Error/unknown result remains retryable; no false success |

The student's screenshots should capture the actual deployment, connection, success/invalid input, holdings, redemption, history and backend response. PDF report and image capture are outside this request. Consult the source assignment for final submission details.
