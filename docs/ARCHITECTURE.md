# Architecture and API

MicroInvest is an educational directory of independent investment pools. Any user deploys the same fixed-rule Solidity contract and registers a title/explanation. Other users search for that project, open its page, deposit test ETH and redeem their own principal. There is no external asset strategy, yield, administrator or creator withdrawal privilege.

~~~mermaid
flowchart LR
    U[User] --> UI[HTML / CSS / JavaScript]
    UI -->|Deploy / deposit / redeem| M[MetaMask]
    M --> S[Sepolia: independent pool contracts]
    UI -->|Public reads and signed project registration| F[Flask on Render]
    F -->|Verify creation, read state / events / receipts| S
    F -->|Store / search project metadata| DB[PostgreSQL]
~~~

Flask holds no wallet signing key and sends no chain transaction. PostgreSQL is authoritative for the project directory; Solidity state/events are authoritative for principal, shares and confirmed business activity. Removing or losing directory data does not transfer on-chain funds, but makes project discovery/pages unavailable until metadata is restored.

## Business contract

Every project uses the unchanged MicroInvest contract and artifact:

| Entry | Behavior |
| --- | --- |
| deposit() payable | Positive msg.value; credit caller and total shares by exactly that wei; emit Deposited |
| withdraw(amountWei) | Positive amount within caller's shares; guard reentry; debit, transfer equal wei and emit Withdrawn; transfer failure rolls back |
| withdrawAll() | Redeem caller's complete nonzero position |
| shares(address), totalShares() | Exact internal smallest-unit shares |
| totalPrincipal(), accounting() | Recorded entitlement, actual ETH balance, excess and solvency |

One displayed share = 10^18 share units = 1 ETH principal. Fractional amounts never use floating point. No ERC-20 share transfers, fee, owner/pause/upgrade interface exists. Plain unaccounted sends are rejected; forced ETH creates neither shares nor yield. Each deployment has its own ledger, balance and events.

## Directory and trusted registration

The investments table stores ID, chain ID, lower-case unique contract address, deployment block/hash, creator address, name, description, case-folded search text and UTC creation time. See schema.sql. The address and creation hash are unique within a network; names need not be unique. PostgreSQL is required on Render; local SQLite is ignored development data.

Creation proceeds through a browser wallet deployment, receipt confirmation and EIP-191 message signature. The canonical message includes the exact normalized name/description, creation hash, network and HTTP origin. The server recovers the signing wallet and independently checks the actual transaction:

- Target network matches the configured chain.
- Transaction directly creates a contract and has a successful receipt.
- Creation input and current deployed runtime bytecode exactly match the supported artifact.
- Recovered signer equals the transaction's actual deployer.

Only server-derived address, block and creator are saved. An identical retry returns the same ID; different metadata for a registered contract returns 409. Registration changes no contract rights and sends no funds. A repeated identical signature cannot rename the immutable project. Smart-contract-wallet/factory deployments are outside this version's direct MetaMask deployment flow.

The original configured pool is imported as Original MicroInvest Pool on startup. Existing state and original public deployment evidence remain valid. Initialization runs once before Gunicorn workers start; workers subsequently reuse the existing table and row. Published names/explanations cannot be edited through the current API.

## Search and page scope

GET /api/investments accepts q, page, limit and optional creator. Literal case-folded matching covers name, description, address and creator. Whitespace-separated words must all match; a numeric query also matches the exact directory ID, ranked first. SQL binding/escaping prevents SQL input and wildcard characters from changing query structure. It is not semantic/fuzzy search.

Each detail page receives a validated project ID and appends investment=<id> to blockchain API requests. ChainService.for_pool creates a per-request service with that project's address/deployment block; it does not mutate the shared original-pool settings. Unknown IDs fail rather than falling back to the original contract. The wallet signer uses the address from that project's validated public configuration.

Browser pending-operation keys include chain, contract and wallet. A creation recovery record includes its deploying wallet, draft metadata and creation hash; rejected signing/server failure can retry the same contract. A hash is not proof of confirmation. Published IDs and metadata survive application restart through the database.

## Routes

All wei/share-unit values and display decimals are strings. IDs, blocks and timestamps are numbers. Public chain reads require no login.

| Route | Responsibility |
| --- | --- |
| / | Searchable Explore directory |
| /deploy | Named investment creation and registration |
| /investments/<id> | Selected project, pool, transaction controls and position |
| /investments/<id>/activity?wallet=... | Selected project's full confirmed activity for a public wallet |
| /healthz | Process liveness; does not prove RPC/database readiness |
| /api/investments?q=...&page=1&limit=12&creator=... | Directory items, total, page, nextPage |
| /api/investments/<id> | One project's public metadata |
| POST /api/investments/registration-message | Validate draft, return canonical wallet message |
| POST /api/investments | Verify signature/creation; register idempotently |
| /api/artifact | Public ABI/compiler/creation/runtime bytecode |
| /api/config?investment=<id> | Selected address/block, ABI, network, readiness and project metadata; no credentials |
| /api/pool?investment=<id> | Selected pool's snapshot shares/principal/balance/excess/solvency |
| /api/position/<wallet>?investment=<id> | Selected pool's shares/redeemable principal and wallet balance |
| /api/history/<wallet>?investment=<id>&limit=20&cursor=BLOCK:LOGINDEX | Selected pool events, exclusive cursor, scan bounds |
| /api/transactions/<hash>?investment=<id> | Receipt status and validation that transaction targets selected pool |

Without investment=<id>, original chain API routes and /activity still resolve the configured original pool for compatibility. New UI links always carry a specific project ID.

POST registration example body:

~~~json
{
  "name": "Community Solar Pool",
  "description": "Learn small contributions together.",
  "transactionHash": "0x...64 hexadecimal characters...",
  "signature": "0x...wallet message signature..."
}
~~~

The client obtains the exact message first, signs it with getSigner(selectedAddress).signMessage(message), and submits the same metadata with the signature. Field lengths: title 1–120, description 1–2000; control characters are rejected except newline/tab. No arbitrary creator/address/block field is trusted.

## Errors and history

Controlled failures use {"error":{"code":"...","message":"..."}}. Validation is 400, unsupported JSON media 415, wrong deployer 403, unknown project 404, pending creation/conflicting registration 409 and unavailable RPC/database 503. Exception class alone is logged; raw provider/database credential strings are not returned. Unavailable balances are never shown as zero.

Every chain read validates network and runtime code. State reads use a snapshot block. History scans bounded block windows and bounded eth_getLogs chunks, filters contract + indexed investor, and uses exclusive (blockNumber, logIndex) cursors so same-block events are not skipped. Empty ranges can still have older pages.

The detail overview caps recent rows at five. Full activity uses 20-row cursor pages and safely renders text. Refresh resets pagination; account/network changes clear stale state. Asynchronous generations prevent earlier responses from overwriting another wallet's current page.

## Wallet and deployment boundaries

The account menu exposes only addresses returned by MetaMask. A stored preference is valid only while still authorized. Before signing, the UI checks network and selected membership, then explicitly selects that signer. Creators can also participate in any pool and redeem only their own position. Other participants cannot register creator metadata or redeem another holder's principal.

Title/description are escaped by Jinja or rendered with textContent. Local script bundles and a restrictive Content Security Policy remain in place. Backend RPC/database secrets stay in environment settings. PostgreSQL stores public addresses and project text, not private keys, balances or identities.

Render uses Python/Gunicorn and PostgreSQL, with no Node backend or SQLite persistence. DATABASE_URL is mandatory PostgreSQL online. A directory outage blocks project lookup; RPC failure blocks chain-dependent controls. Single-confirmation status is not finality. Moderation, edit workflows, on-chain metadata anchoring, authentication profiles, yield strategies and production audit/load testing remain outside scope.
