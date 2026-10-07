# Deploy the multi-investment update on Render

This update changes the home page from one pool to a searchable directory. Keep the existing Python service and original Sepolia contract. New contracts are created by users' MetaMask wallets and registered in PostgreSQL; no contract factory or backend signing key is needed.

The implementation and local tests are complete. The updated source has not been pushed/deployed by this task, and this host has not connected to your live PostgreSQL database.

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

Keep Root Directory empty and health check /healthz. The initializer creates the table and imports the original pool before Gunicorn workers start. If you previously entered the start command manually, update it in the Dashboard: committing render.yaml alone does not change a manually configured service.

The program refuses a blank or SQLite DATABASE_URL on Render. If initialization fails, check database availability, region and URL in Render settings. The error intentionally excludes the connection string.

## 3. Push and deploy

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

## 5. New report evidence

The existing 8-page report and seven screenshots describe version 1 (single pool, no database). After the new live checks, supply screenshots of:

- Explore with a keyword search and at least two separate project results.
- New creation success showing title, investment ID, contract address and deployment transaction.
- A project's detail page showing its name/description, contract, nonzero personal position and confirmed deposit.
- Confirmed redemption and that project's activity; another project's remaining position if demonstrating isolation.
- Render deployment success and the hosted project/catalog API response.

Do not include DATABASE_URL/RPC credentials. Existing wallet/invalid-input screenshots can remain as historical evidence if the revised captions identify the version. The PDF needs an updated architecture/database description and current test evidence.

For the database part of source submission, include docs/schema.sql and a reviewed public metadata export from scripts/export-catalog.py. Running that script locally with blank DATABASE_URL exports only the local catalog; use the final PostgreSQL connection to collect the hosted rows. Render's internal URL is for hosted connections; local access uses its external URL/settings. The export is public metadata, not a full backup.
