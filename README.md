# Atlanta + North Georgia Local Guide

Responsive public directory deployed on Cloudflare Workers.

## Current architecture

The project is migrating from a Google Sheets browser feed to Cloudflare D1.

- Source/admin workbook: `Atlanta + North Georgia Food & Fun Guide`
- Temporary public-safe mirror: `Atlanta Public Guide - Website Data Feed`
- Production database target: Cloudflare D1 `atlanta-local-guide`
- D1 Worker binding: `DB`
- Worker/API entry point: `worker.js`
- Static source files: repository root
- Static build output: `dist/`
- Cloudflare Worker: `atlanta-public-guide`

## Zero-downtime migration

`data-feed.js` prefers the same-origin D1 API (`/api/places`). If D1 is not yet available or populated, it automatically falls back to the existing Google Sheets feed. This allows the database migration to be completed without taking the live guide offline.

See `D1_SETUP.md` for the exact Cloudflare dashboard and import steps.

## Build

```bash
npm install
npm run build
```

The build copies public website assets into `dist/`. Worker source, database files and migration tooling are not included in the public static asset directory.

## D1 schema and migration

- Schema: `database/schema.sql`
- Sheet-to-D1 seed generator: `scripts/generate_d1_seed.py`
- Generated seed file: `database/seed.sql`

The seed generator intentionally migrates only website-safe fields. It excludes internal/client notes and company/community mapping fields.

## API

- `/api/health`
- `/api/places`
- `/api/places/<slug-or-place-id>`
- `/api/cities`

The API returns a compatibility shape matching the existing site data model so the front end can move to D1 without a full rewrite.
