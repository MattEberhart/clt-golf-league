---
name: clt-golf-db-migration
description: Apply pending Drizzle migrations to the clt-golf-league Turso database.
---

# clt-golf-league DB migration

Use this skill when asked to run, apply, or execute database migrations for the `MattEberhart/clt-golf-league` app.

## What it does

Runs `pnpm db:migrate` against the live Turso database using the org secrets saved for this project.

## Required secrets

- `secret:org:TURSO_DATABASE_URL` — the production `libsql://…` URL.
- `secret:org:TURSO_AUTH_TOKEN` — the Turso auth token.

## Steps

1. Make sure the repo is checked out at `repos/clt-golf-league` and dependencies are installed:
   ```bash
   cd /Users/runner/workspaces/bndr/repos/clt-golf-league
   pnpm install
   ```

2. Run migrations against the live database:
   ```bash
   pnpm db:migrate
   ```
   This must execute with `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` set from the org secrets. Do not rely on `.env.local`, which points at `file:./local.db`.

3. Verify the expected schema change is present:
   ```bash
   pnpm exec tsx -e "import { createClient } from '@libsql/client'; (async()=>{ const c=createClient({url:process.env.TURSO_DATABASE_URL!, authToken:process.env.TURSO_AUTH_TOKEN}); const r=await c.execute('PRAGMA table_info(results);'); console.log(r.rows.find((row:any)=>row.name==='is_tie')); c.close(); })();"
   ```

## Local dev note

For local-only verification, create `.env.local` with `TURSO_DATABASE_URL=file:./local.db` (no auth token required) and run `pnpm db:migrate`. This will create/update `local.db` in the repo root.
