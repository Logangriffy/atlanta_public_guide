#!/usr/bin/env bash
set -euo pipefail

python scripts/generate_d1_seed.py
npx wrangler d1 execute atlanta-local-guide --remote --file=./database/schema.sql --yes
npx wrangler d1 execute atlanta-local-guide --remote --file=./database/seed.sql --yes
npx wrangler d1 execute atlanta-local-guide --remote --command="SELECT COUNT(*) AS places FROM places;" --yes
npx wrangler d1 execute atlanta-local-guide --remote --command="SELECT COUNT(*) AS cities FROM cities;" --yes
npm run build
npx wrangler deploy
