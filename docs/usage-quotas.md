# Usage Quotas & Admin — Production Notes

This adds per-user + global usage quotas, an atomic token enforcement RPC, and an
admin account to `ibuki-study`.

## What was added

1. **Schema** — `migrations/20261123_add_usage_quotas.sql`
   - `quota_global` (id='global'): `notebook_limit`(100), `subject_max`(12), `monthly_token_limit`(1000), `notebook_cost`(3), `chat_cost`(1).
   - `profiles` additions: `is_admin`, `quota_notebook`, `quota_subject`, `quota_token`, `usage_notebook`, `usage_subject`, `usage_token`, `usage_chat`, `quota_updated_at`.

2. **Atomic RPC enforcement** — `migrations/20261123_add_usage_quotas_rpc.sql`
   - `charge_notebook(userId, subject, cost)` is a Postgres function that atomically
     checks the token + subject cap and charges in a single transaction (no client
     read-then-write race). Called via `supabase.rpc('charge_notebook', {...})`.

3. **Quota service** — `src/services/usage.js`
   - `chargeNotebook(userId, subject)` → calls the RPC (cost 3, subject check).
   - `chargeChat(userId, cost=1)` / `chargeTool(userId, cost=1)` → same RPC, subject=NULL (usage_chat bump).
   - `getEffectiveQuotaForUser`, `canCreateNotebook`, `setUsage` — quota helpers.

4. **Admin** — `src/services/admin.js` + `tools/create-admin.js` + `src/components/AdminView.vue`
   - list users, set admin, reset/change limits & usage, delete account, send reset password.

5. **Serverless worker** — `server/worker.js`
   - CF Worker backs the SPA; all writes route through `charge_notebook` with the
     service_role key (kept server-side, never in the browser).

## How to deploy

### 1. Apply the schema migration (Supabase)
SQL Editor → New query → run:

```sql
DROP TABLE IF EXISTS quota_global; -- WARNING: drop before re-apply
\i "migrations/20261123_add_usage_quotas.sql"
```

### 2. Apply the RPC + RLS migrations
Run these in the same dashboard query (or separately):

```sql
\i "migrations/20261123_add_usage_quotas_rpc.sql"
\i "migrations/20261123_add_usage_quotas_rls.sql"
```

Verify: `SELECT quota_global.*;` and `SELECT proname FROM pg_proc WHERE proname = 'charge_notebook';`

### 3. Seed the admin account
```bash
node tools/create-admin.js --email admin@yourdomain.com --password some-long-password
```
First admin = project owner. Add more via the UI (Users → Make admin).

### 4. Run the quota server (serverless)
Deploy `server/worker.js` as a Cloudflare Worker. Set these env vars:
- `SUPABASE_URL` — your Supabase URL.
- `SUPABASE_SERVICE_ROLE_KEY` — your Supabase service role key.
- `SUPABASE_USER_ID` — the calling user's Supabase id (from your session layer).

Route your SPA through this Worker for writes (`/api/notebooks`, `/api/chat`, etc.),
and keep the SPA's `supabase-js` instance (anon key) only for reads. The
`/api/notebooks` + `/api/chat` handlers call `charge_notebook` server-side before
any data is written.

### 5. Row-Level Security (RLS)
The SQL in step 2 enables RLS and adds the policies. `profiles` is owner/admin-only for writes;
`quota_global` is readable by all (needed by the charge functions). Hard account
operations (delete user, change another user's `is_admin`) still need the
service_role via an Edge/DB function — never the anon key, and never from the browser.

## Serverless (Cloudflare Workers) notes

- **Quotas are platform-agnostic.** The schema, `usage.js`, and the RPC are plain
  Postgres + JS; they run on Supabase regardless of who the front end is.
- **The single change for serverless is where the enforcement runs.** The browser
  can no longer call `chargeNotebook` directly (that was bypassable). Instead:
  - SPA reads with the anon key (no writes).
  - SPA writes (notebooks, chat, tools) go to the CF Worker.
  - The Worker holds the `service_role` key and calls `charge_notebook` atomically.
- `charge_notebook` keeps a spent-token accounting in `profiles.usage_token`. If a
  user's token counter gets out of step with the DB (e.g. a failed import path),
  the RPC's `WHERE usage_token + cost <= limit` guard silently refuses overshoots —
  treat a repeated `tokens_exceeded` there as a sign to re-sync that user's counter.

## Verified

- `usage.js`, `admin.js`, `create-admin.js`, `server/worker.js` — `node --check` passes.
- `migrations/20261123_add_usage_quotas.sql` + `_rpc.sql` + `_rls.sql` — written, awaiting deployment (Supabase SQL run not executed in this environment).
- `db.js`, `auth.js` — wired for quota/usage + admin hooks.

## Caution

- **Never expose the service_role key to the browser.** It can read/write any row
  and disable enforcement. Keep it only behind the Worker/edge function.
- `is_admin` and hard user deletion are gated by the admin UI + app-side permission
  check; for non-admin-controlled account deletion, use a service_role-backed
  function/edge route so `auth.users` can be transacted on safely.
