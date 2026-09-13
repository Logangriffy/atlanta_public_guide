# Cloudflare D1 setup for Atlanta Local

This repository is prepared to run the existing static site and a D1-backed API from the same Cloudflare Worker.

## Names used by the code

- Worker: `atlanta-public-guide`
- D1 database: `atlanta-local-guide`
- D1 binding variable: `DB`
- Worker entry point: `worker.js`
- Static build output: `dist/`
- API health endpoint: `/api/health`
- Places endpoint: `/api/places`
- Cities endpoint: `/api/cities`

Do not change the D1 binding variable from `DB` unless `worker.js` is changed too.

## Safety during migration

`data-feed.js` tries `/api/places` first. If D1 is missing, empty, or unavailable, it automatically falls back to the existing Google Sheets feed. This makes the migration zero-downtime.

## Cloudflare dashboard setup

### 1. Create D1 manually

Cloudflare Dashboard → D1 SQL Database → Create Database

Use:
- Database name: `atlanta-local-guide`
- Location hint: Eastern North America (`enam`) if the dashboard offers a location hint

Create the database, then copy its Database ID / UUID.

IMPORTANT: because this repository already contains a draft D1 binding, put the real database UUID into `wrangler.jsonc` before the first new Git deployment. Otherwise Wrangler's automatic provisioning can create a separate D1 resource.

Final binding block:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "atlanta-local-guide",
    "database_id": "PASTE-D1-DATABASE-UUID-HERE"
  }
]
```

The database UUID is available on the D1 database details page. You can also retrieve it with:

```bash
npx wrangler d1 info atlanta-local-guide
```

### 2. Deploy/bind the existing Worker

Once `wrangler.jsonc` contains the real Database ID, deploying the repository will create the Worker binding from configuration.

After deployment, verify it in:

Cloudflare Dashboard → Workers & Pages → `atlanta-public-guide` → Bindings

You should see:
- Binding type: D1 database
- Variable name: `DB`
- Database: `atlanta-local-guide`

If it is missing, use:

Bindings → Add binding → D1 database → Add binding

and choose:
- Variable name: `DB`
- D1 database: `atlanta-local-guide`

### 3. Git/Build settings

Cloudflare Dashboard → Workers & Pages → `atlanta-public-guide` → Settings → Builds

Use:
- Git repository: `Logangriffy/atlanta_public_guide`
- Production branch: `main`
- Root directory: repository root
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

The Worker name in Cloudflare must remain `atlanta-public-guide`, matching `wrangler.jsonc`.

## Import the schema and current website data

From a terminal in the cloned repository:

```bash
npm install
python scripts/generate_d1_seed.py
npx wrangler login
npx wrangler d1 execute atlanta-local-guide --remote --file=./database/schema.sql
npx wrangler d1 execute atlanta-local-guide --remote --file=./database/seed.sql
```

Cloudflare's D1 importer accepts SQL files through `wrangler d1 execute --remote --file`. The generated seed uses individual SQLite-compatible statements and intentionally does not include explicit `BEGIN TRANSACTION` / `COMMIT` wrappers.

The seed generator imports only website-safe fields. It does not migrate private notes, client notes, community mapping, Pulte proximity fields, or other internal/admin-only columns.

## Verify before relying on D1

Open:

- `https://atlanta-public-guide.atlanta-guide.workers.dev/api/health`
- `https://atlanta-public-guide.atlanta-guide.workers.dev/api/places?limit=3`
- `https://atlanta-public-guide.atlanta-guide.workers.dev/api/cities`

`/api/health` should return JSON similar to:

```json
{
  "ok": true,
  "source": "d1",
  "places": 200,
  "cities": 20,
  "images": 0
}
```

The exact counts will depend on the current data.

After that, open `/health` on the website and several city/place pages. Because the front-end loader prefers D1, successful pages confirm the cutover.

## Rollback

If D1 has a problem, the front end automatically falls back to Google Sheets. You can also remove the D1 binding or revert the D1/data-feed commits without deleting the database.
