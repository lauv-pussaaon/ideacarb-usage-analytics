# Deployment

IdeaCarb usage analytics is deployed in place from this checkout with [`deploy/deploy.sh`](../deploy/deploy.sh). It is one Next.js site plus a private FastAPI process. It is not the anlt snapshot app and it is not part of `ideacarb-deployment` `deploy.sh`.

On the fleet host the checkout is `~/ideacarb/stacks/ideacarb-usage-analytics`, next to the client stacks and `ideacarb-deployment`.

```bash
cd ~/ideacarb/stacks/ideacarb-usage-analytics
./deploy/deploy.sh new
./deploy/deploy.sh update
./deploy/deploy.sh teardown
```

The script attaches to the PM2 daemon that already runs the client apps. It will not start a new daemon, and it will not `pm2 save` unless other apps are in that daemon.

| Setting | Value |
| --- | --- |
| Public host | `https://analytics.ideacarb.com` |
| Next.js | PM2 `ideacarb-usage`, `127.0.0.1:8792` |
| FastAPI | PM2 `ideacarb-usage-api`, `127.0.0.1:8791` |
| Database | role and database `ideacarb_usage` |
| Staff login | `STAFF_USERNAME` / `STAFF_PASSWORD` from `deploy.env` |

`new` creates the role and database, writes `.env.local`, installs the API and the Next app, builds, starts both processes, writes nginx, and runs certbot unless `--skip-domain`.

`new` and `update` deploy `origin/master` when this checkout is a git repo. `update` keeps `DATABASE_URL`, `AUTH_SECRET`, and `ANALYTICS_API_SECRET`. It rebuilds and reloads only these two PM2 processes. Schema is applied when the API process starts. Existing usage rows stay.

`teardown` removes only these two PM2 processes and the nginx site. Pass `--drop-db` to drop the database and role. Pass `--delete-cert` to delete the certificate. Without those flags the data and certificate stay.

The browser posts signed-in page views to `https://analytics.ideacarb.com/api/usage`. That route forwards to FastAPI. FastAPI stores the event when `organization_id` matches a `clients` row, and it stores that row's instance code. Fleet deploy still upserts clients with `ANALYTICS_API_SECRET` to `http://127.0.0.1:8791/v1/clients`.

Signed-in rows already in the admin console table `app_usage_tracking` can be copied once, after this app is installed:

```bash
cd ~/ideacarb/stacks/ideacarb-usage-analytics
./scripts/import-supabase-usage.py \
  --supabase-env ~/ideacarb/stacks/ideacarb-deployment/deploy.env
```

The script reads `DATABASE_URL` from `.env.local`. It prefers `SUPABASE_SERVICE_ROLE_KEY` in the fleet `deploy.env`. A row is stored when it has a user id and its domain is `{code}.ideacarb.com` for an organization with that code. The display name is the user id, because the old table has no name. Rows with no user id, and domains that are not a tenant, are skipped. IP address, user agent, screen, language, and referrer are not copied. Running it again does not double the counts. The anlt snapshot database is not read.
