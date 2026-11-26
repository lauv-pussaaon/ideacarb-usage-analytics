# IdeaCarb usage analytics

Signed-in page views for tenant apps. Not the anlt snapshot warehouse and not the admin console.

## What is stored

A view is stored when the browser is signed in and `organization_id` matches a `clients` row. The stored instance code comes from that row. Login, forgot-password, invite, and reset-password are not usage.

Keep: organization id, instance code, user id, display name, tenant role, page, session id, and the Bangkok day. Do not store IP, user agent, screen, language, or referrer.

Unique users are `COUNT DISTINCT user_id` over the selected range. The sparkline is the last 7 days ending on the filter end date. Filters apply to every number, including the chart. The client picker groups clients by whether they have page views in the selected range, highest traffic first. The dashboard Excel file has two sheets, clients and users, both highest page views first, using the on-screen filters.

Account types: annual_member, trial, demo, internal, employee, project.

## Deploy

Public host `https://analytics.ideacarb.com`. The signed-in shell is a sidebar plus a lilac main pane, and the root font size is 26px. Fleet checkout is `~/ideacarb/stacks/ideacarb-usage-analytics`. Next.js is PM2 `ideacarb-usage` on `127.0.0.1:8792`. FastAPI is PM2 `ideacarb-usage-api` on `127.0.0.1:8791`. Role and database are `ideacarb_usage`. Do not point this app at `ideacarb_analytics`.

`./deploy/deploy.sh new` and `update` deploy `origin/master`. `teardown` leaves the database unless `--drop-db` is passed. Do not start a PM2 daemon. `pm2 save` only when other fleet apps are already in the list. Signed-out redirects use `APP_URL`, so the browser stays on the public host instead of `localhost:8792`.

Staff login is `STAFF_USERNAME` / `STAFF_PASSWORD` in gitignored `deploy/deploy.env`. Local `.env.local` points `DATABASE_URL` at the fleet Postgres host. The Next app and API still run on this machine.

Historical signed-in page views are copied from Supabase `app_usage_tracking` with `scripts/import-supabase-usage.py`. That copy keeps user id, role, page, session, and the Bangkok day. It does not keep a display name, and it does not read the anlt snapshot database.
