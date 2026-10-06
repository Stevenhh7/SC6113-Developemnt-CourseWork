# Testing and evaluation

## Observed local results

On 2026-10-06 the implementation passed these suites on Windows, Node.js 24.19.0, Python 3.12, Solidity 0.8.30 and Hardhat 3.18.1. Browser integration used installed Microsoft Edge, real Flask/Web3.py queries and a real local Hardhat chain. Its EIP-1193 wallet is a simulation, not a real MetaMask extension. No Sepolia transaction or Render deployment is represented by these local results.

On 2026-10-07 the account-menu update passed 19 browser integration checks, all 17 backend tests and all 4 amount/error tests. The unchanged contract's 12-test result remains from 2026-10-06.

| Suite | Result | Evidence / command |
| --- | --- | --- |
| Contract | 12 passed | `test/MicroInvest.ts`; `pnpm run test:contract` |
| Flask/backend | 17 passed, including parametrized cases | `tests/test_backend.py`; `.venv/Scripts/python.exe -m pytest -p no:cacheprovider` |
| Exact amounts and safe errors | 4 passed | `tests/frontend.test.mjs`; `pnpm run test:frontend` |
| Browser integration | 19 checks passed (2026-10-07) | `tests/browser.mjs`; `pnpm run test:browser` |

Commands can be rerun from README. Browser/contract runs write `test-results/browser.json` and `test-results/contract-gas.json`, which are ignored runtime evidence; copies of the observed browser checks and local gas measurements are retained in `docs/evidence/` for the report. Automated suites produce no screenshots or final PDF. Third-party Web3.py dependencies may emit a deprecation warning; it does not change assertions. Solidity warns about `selfdestruct` in the **test-only forced-ETH helper**, not the business contract.

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
10. With 21 actual local-chain events, the overview shows exactly the newest five in the correct order.
11. View all activity preserves the wallet, displays 20 records then all 21 on the next page without missing/duplicate rows, and handles refresh, account changes and a narrow mobile viewport.
12. A 390px-wide overview viewport does not cause document-level horizontal overflow.
13. The wallet deployment page deploys a real local contract and displays confirmed address/block.
14. Stopping the RPC node produces an explicit error, unknown position display and disabled deposit.
15. The browser emits no uncaught script exceptions throughout the flow.
16. The wallet menu shows only exposed accounts, supports keyboard opening/Escape, switches its selected account, and preserves selection when permission approval is rejected.
17. Selecting an account from the full-activity menu replaces the records and updates the wallet in the URL.
18. The second authorized account deposits and redeems 17 wei while the first address remains first in `eth_accounts`; actual contract balances prove the selected signer is used. The mobile menu stays within a 390px viewport.
19. Reload restores an authorized account choice; when that address is no longer exposed, connection falls back to an exposed account rather than trusting browser storage.

The simulated provider supports controlled rejection/account/network changes but cannot verify MetaMask extension permissions, popup UI, provider-specific behavior or Sepolia latency. The student's separate live acceptance is described below.

## Gas and performance evaluation

Observed receipt gas in the pinned local compiler/optimizer configuration:

| Operation | Gas used | Scenario |
| --- | ---: | --- |
| Deposit | 71,884 | First deposit into a new pool, 0.01 ETH |
| Partial redemption | 50,282 | Redeem 333 of 1,000 wei |
| Full redemption | 50,272 | Redeem all 999 wei |

These local values come from `receipt.gasUsed`. Separately verified Sepolia receipts used 245,994 gas for a 0.003 ETH deposit, 53,700 for a 0.001 ETH partial redemption and 50,912 for the remaining 0.002 ETH exit. Actual costs were respectively 622855710866760, 132064592365200 and 127495073925600 wei. See `docs/DEPLOYMENT.md` and raw evidence. Local and Sepolia cases use different amounts and execution environments and are not one controlled comparison. Actual cost is `gasUsed × effectiveGasPrice`, in wei. Network gas is independent of the zero platform fee; redeeming principal does not reimburse gas.

State reads are constant-size contract calls. Each history request scans a bounded block window in bounded RPC chunks, defaults 5,000/1,000, and fetches timestamps only for returned records. This controls individual request size but repeated older pages still depend on activity age and RPC capacity. There is no database/indexer; no load test, production latency measurement or concurrent-user throughput claim is made. Compare actual Sepolia receipt gas/cost and Render read timings during live acceptance if discussing production performance in the report.

## Usability and security evaluation

The UI explains the fixed ratio, testnet, absence of returns and separate gas costs at the point of use. Deposit, partial exit and exit-all have separate visible controls; forms have labels, feedback is announced through live regions, and history scrolls within its table on narrow screens. The simulated browser completed the principal lifecycle with feedback for zero input, excess redemption, rejection and RPC failure. This is functional/heuristic evaluation, not a study with novice participants or a complete accessibility audit.

Security controls include wallet-side signing, no backend key, caller-bound withdrawals, no deployer privilege, reentrancy lock, rollback on ETH transfer failure, exact integer accounting, non-transferable shares, read-only validated APIs, runtime bytecode/network checks, safe provider errors and a restrictive Content Security Policy. Public chain addresses/activity are not private; no user identity/profile database is stored. One mined confirmation is not chain finality. External RPC failures and wallet extensions remain trust/availability dependencies.

## Live acceptance on 7 October 2026

The student confirmed completing the functional tests with actual MetaMask on the public Render site. Independent read-only checks verified hosted configuration, pool, position and history, as well as the successful deposit/partial/full redemption receipts. See `docs/DEPLOYMENT.md` and `docs/evidence/live-validation-2026-10-07.json`. These HTTPS/API checks do not independently reproduce every wallet popup or invalid-input interaction. Seven student-supplied original screenshots now support live UI acceptance and are stored with hashes in `report/screenshots/`.

The following scenarios remain the acceptance checklist for reproducibility. The student reports they passed; the report distinguishes that statement from automated local checks and available chain evidence.

| Step | Expected outcome |
| --- | --- |
| Deploy via `/deploy` | Successful Sepolia creation receipt; saved public address/block/hash |
| Render `/api/pool` | Sepolia chain and exact deployed contract accepted |
| Connect actual MetaMask | Correct account/network visible; refusal does not create activity |
| Deposit a small amount | Confirmed successful receipt, exact shares and event |
| Partial / full exit | Matching principal debit and exact remainder/zero; gas shown by wallet |
| Invalid input / excess exit | Clear rejection, no unintended chain change |
| Second wallet / network switch | Manage accounts in MetaMask authorizes an additional account; menu switching isolates position/history and signs from the selected address; wrong-network writes are disabled |
| Refresh / Render restart | Same confirmed chain-backed position/history |
| RPC outage / delayed confirmation | Error/unknown result remains retryable; no false success |

The seven screenshots cover deployment, connection, successful deposits/redemptions and full history, a rejected negative input, zero holdings after redemption, pool API data and Render Live deployment. The API image records 0.04 ETH at block 11857366; the redemption image records zero personal shares/principal at block 11857372. These are different snapshots. All originals are included in `report/MicroInvest_Report.tex` and the source ZIP; the final 8-page PDF has been compiled and visually checked at the student's request, with evidence in `docs/evidence/report-build-2026-10-07.json`. The remaining submission steps are in `report/`.
