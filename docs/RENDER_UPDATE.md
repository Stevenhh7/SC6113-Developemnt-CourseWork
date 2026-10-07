# Deploy the multi-investment update on Render

This update changes the home page from one pool to a searchable directory. Keep the existing Python service and original Sepolia contract. New contracts are created by users' MetaMask wallets and registered in PostgreSQL; no contract factory or backend signing key is needed.

The student has redeployed the history-index version and reported successful updated testing on 7 October 2026. Independent public checks verified two projects, keyword search, both pool reads, updated browser code and database-backed history. The eight-page report is revised; no additional screenshot is required. A read-only TLS connection exported the final PostgreSQL application data on 8 October 2026; see docs/evidence/database-export-2026-10-08.json. No independent hosted restart experiment is claimed. The steps below remain a reference for recreating/updating the deployment.

## 1. Create PostgreSQL

In Render choose **New → Postgres**, select your database name and plan, and use the same region as the existing web service (previous setup: Oregon). For the internal connection URL, keep both resources in the same account/region. Follow [Render's connection documentation](https://render.com/docs/postgresql-creating-connecting).

Once ready, copy the database's **Internal Database URL** into the existing web service's environment setting **DATABASE_URL**. Keep this URL private; it can include a database password. Do not put it in Git, screenshots or chat.

Plans are your choice. Render's [free-service documentation](https://render.com/docs/free) states that free PostgreSQL expires 30 days after creation; it should not be assumed to remain available for a later course deadline. Select availability to match your submission/demo date.

## 2. Configure the existing web service

Retain:

- RPC_URL: your Sepolia read RPC supporting eth_getLogs.
- CHAIN_ID=11155111.
- LOCAL_DEVELOPMENT=false.
- PYTHON_VERSION=3.12.10.
- CONTRACT_ADDRESS=0xE560121978f80c390f6B0d091E9579A2812Cb3DD.
- DEPLOYMENT_BLOCK=11856501.

The original address/block import that existing pool into the new directory. They are not a single global address for all new investments. Every new project is resolved by its database ID.

Build command:

~~~sh
pip install -r requirements.txt
~~~

Start command:

~~~sh
python scripts/init-catalog.py && gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 120
~~~

Keep Root Directory empty and health check /healthz. The initializer creates missing catalog/history tables and imports the original pool before Gunicorn workers start. If you previously entered the start command manually, update it in the Dashboard: committing render.yaml alone does not change a manually configured service.

The program refuses a blank or SQLite DATABASE_URL on Render. If initialization fails, check database availability, region and URL in Render settings. The error intentionally excludes the connection string.

## 3. Push and deploy

For the later history-index update, keep the PostgreSQL URL and existing start command. Startup creates the missing history_events and history_ranges tables automatically; existing project metadata is retained. Push/redeploy the changed code, then open the original project's overview and full activity to let bounded backfill populate confirmed records. No new contract or transaction is needed to restore old history.

Review changed files, commit and push them to the existing repository. Keep .env, instance/, test-results/ and wallet files out of Git. Redeploy the service after both DATABASE_URL and the new start command are set.

For this feature, do not replace the original deployed pool simply to make the site searchable. Its unchanged contract remains usable. Each new project will deploy a new independent copy through /deploy when its creator approves.

Check:

1. /healthz returns success for the running process.
2. /api/investments lists Original MicroInvest Pool.
3. Open that result and confirm its contract address.
4. /api/pool?investment=<the original ID> returns actual pool data.

Liveness alone does not verify database/RPC readiness. New project registration requires the actual successful creation receipt and runtime code.

## 4. Actual MetaMask acceptance

Using Sepolia and your chosen small test amounts:

1. Account A creates a named project with a searchable word in the explanation. Approve deployment and then the gas-free registration message.
2. Save its ID/address/hash or download the public JSON record. Open its detail page.
3. Account B creates another named project. Reject registration once, reload, reconnect that deploying account and use Retry registration; it should publish the same contract/hash.
4. Search by name and explanation keyword. Open each result and verify different IDs/addresses.
5. Account A participates in both projects. Partial/full redemption in one must leave the other unchanged.
6. Switch accounts: personal position and activity must change within the same project.
7. View all activity must stay inside the selected project and selected wallet.
8. Restart/redeploy the web service. Names, IDs, explanations and addresses must remain; chain positions/history must still match.

No one can withdraw other participants' money. Titles/explanations do not change the fixed 1:1 principal accounting or promise returns.

## 5. Updated report evidence (complete)

The revised eight-page report (including references) covers all 13 required sections, the multi-contract architecture, signed registration, PostgreSQL metadata/event indexing and current tests. Current public-site captures show the keyword filter/matching project, title/explanation form, independent detail and recovered activity. The student supplied updated Render status for b6941a7. No additional screenshot is required for this revision.

Earlier wallet, invalid-input, deployment and redemption captures remain valid unchanged-contract evidence and have explicit captions. The API illustration is labelled an excerpt rather than a screenshot. The complete updated read-only record is `docs/evidence/live-multi-investment-2026-10-07.json`. It verifies five recent and ten complete original-pool events with `source: database`, two contract addresses and the updated browser module.

The observed public projects share one creator; two-creator isolation is demonstrated by the local simulated-wallet suite. Dedicated PostgreSQL/hosted stop-restart tests are not independently recorded as passes.

For the database part of source submission, include docs/schema.sql and a reviewed public metadata export from scripts/export-catalog.py --include-history. Running that script locally with blank DATABASE_URL exports only the local catalog; use the final PostgreSQL connection to collect the hosted rows. Render's internal URL is for hosted connections; local access uses its external URL/settings. The export is public metadata, not a full backup.
