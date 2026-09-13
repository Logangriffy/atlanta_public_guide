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

### 1. Create D1

Cloudflare Dashboard → D1 SQL Database → Create Database

Use:
- Database name: `atlanta-local-guide`
- Location hint: Eastern North America (`enam`) if the dashboard offers a location hint

Create the database.

### 2. Bind D1 to the existing Worker

Cloudflare Dashboard → Workers & Pages → `atlanta-public-guide` → Bindings → Add binding → D1 database → Add binding

Use:
- Variable name: `DB`
- D1 database: `atlanta-local-guide`

Add the binding.

### 3. Git/Build settings

Cloudflare Dashboard → Workers & Pages → `atlanta-public-guide` → Settings → Builds

The Git repository should be:
- `Logangriffy/atlanta_public_guide`
- Production branch: `main`

Use the repository root as the root directory.

Recommended commands:
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

The Worker name in Cloudflare must remain `atlanta-public-guide`, matching `wrangler.jsonc`.

### 4. Put the database ID into wrangler.jsonc if Cloudflare does not auto-provision/update it

Cloudflare can auto-provision draft bindings on deployment, but when the database is created manually the safest final configuration is to add its UUID to `wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "atlanta-local-guide",
    "database_id": "PASTE-D1-DATABASE-UUID-HERE"
  }
]
```

The database UUID is available from the D1 database details page or through `npx wrangler d1 info atlanta-local-guide`.

## Import the schema and current website data

From a terminal in the cloned repository:

```bash
npm install
python scripts/generate_d1_seed.py
npx wrangler login
npx wrangler d1 execute atlanta-local-guide --remote --file=./database/schema.sql
npx wrangler d1 execute atlanta-local-guide --remote --file=./database/seed.sql
```

The seed generator intentionally imports only website-safe fields. It does not migrate private notes, client notes, community mapping, Pulte proximity fields, or other internal/admin-only columns.

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
