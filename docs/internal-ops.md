# Internal ops hub (`/internal`)

Staff roles: `super_admin`, `internal_admin`, `internal_viewer`. Factory customers use `/f/{factory}/login`.

## P2 deploy checklist

1. **Postgres** — run once on production:
   ```bash
   psql "$DATABASE_URL" -f backend/query-api/migrations/2026-internal-ops.sql
   ```
2. **Query API** — deploy `backend/` (admin health, audit filters, fleet search/stale filter).
3. **Frontend** — deploy `esp-iot-frontend`.
4. **Cloudflare Access** — protect staff hostname; set on frontend:
   ```bash
   INTERNAL_REQUIRE_CF_ACCESS=true
   ```
   Users must hit the app through Access so `cf-access-authenticated-user-email` is present.
5. **Disable public dev URLs** — turn off any public `*.workers.dev` or open staging URLs pointing at prod data.
6. **Owner + staff** — create staff under **Internal → Users**.

## Routes

| Path | Who |
|------|-----|
| `/internal/health` | All staff — Postgres ping, fleet counts, aggregator row |
| `/internal/devices` | Fleet search, server-side stale filter, CSV |
| `/internal/audit` | Owner — filters + CSV |
| `/internal/users` | Staff list; owner creates staff; password reset / disable where permitted |

Legacy `/settings` and `/internal/settings` redirect to `/internal/health`.

## Key APIs

| UI | API |
|---|---|
| Health | `GET /v1/admin/health` |
| Fleet | `GET /v1/admin/devices?factory_id&q&stale_only` |
| Audit | `GET /v1/admin/audit?action&actor&from&to` |
| Staff | `POST /v1/admin/staff`, `POST /v1/admin/users/:id/password`, `PATCH /v1/admin/users/:id` |

Legacy URLs (`/overview`, `/admin`, …) redirect via Next middleware to `/internal`.
