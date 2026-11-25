#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/deploy.env"
APP_ENV_FILE="${ROOT}/.env.local"

PM2_WEB="ideacarb-usage"
PM2_API="ideacarb-usage-api"
DB_ROLE="ideacarb_usage"
DB_NAME="ideacarb_usage"

usage() {
  cat <<'EOF'
Usage:
  ./deploy/deploy.sh new      [--force] [--skip-domain]
  ./deploy/deploy.sh update   [--force] [--skip-domain]
  ./deploy/deploy.sh teardown [--drop-db] [--delete-cert]

Runs in-place against this checkout (no extra clone).
Attaches to the existing PM2 daemon. Does not start a new daemon.
Does not pm2 save unless other apps are already in that daemon.

Modes:
  new       Create the dedicated Postgres role and database, write .env.local,
            install the API and the Next app, build, start both PM2 processes,
            write nginx, and run certbot
  update    fetch origin master, keep DATABASE_URL / AUTH_SECRET /
            ANALYTICS_API_SECRET, rebuild, reload only these two PM2
            processes, refresh nginx
  teardown  Delete only these two PM2 processes and the nginx site.
            The database and certificate stay unless the flags below are set.

Options:
  --force        Recreate PM2 and rewrite nginx. Does not drop the database.
  --skip-domain  Skip GoDaddy DNS and certbot (still writes nginx HTTP)
  --drop-db      teardown only: drop ideacarb_usage and its role
  --delete-cert  teardown only: delete the Let's Encrypt certificate

Copy deploy/deploy.env.example to deploy/deploy.env and fill secrets first.
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Error: required command not found: $1" >&2
    exit 1
  fi
}

load_deploy_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: missing ${ENV_FILE}" >&2
    echo "Copy deploy/deploy.env.example to deploy/deploy.env and fill secrets." >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
}

parse_env_key_from_file() {
  local env_file="$1"
  local key="$2"
  local raw value
  if [[ ! -f "$env_file" ]]; then
    echo "Error: env file not found: ${env_file}" >&2
    return 1
  fi
  raw="$(grep -E "^${key}=" "$env_file" | head -1 | cut -d= -f2- | tr -d '\r' || true)"
  value="$(printf '%s' "$raw" | sed -e 's/^["'\'' ]*//' -e 's/["'\'' ]*$//')"
  if [[ -z "$value" ]]; then
    echo "Error: ${key} is empty in ${env_file}" >&2
    return 1
  fi
  printf '%s' "$value"
}

sql_escape() {
  printf '%s' "$1" | sed "s/'/''/g"
}

urlencode() {
  python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
}

godaddy_subdomain() {
  local domain="$1"
  local apex="${2:-ideacarb.com}"
  if [[ "$domain" == *".${apex}" ]]; then
    echo "${domain%.${apex}}"
  else
    echo "${domain%%.*}"
  fi
}

godaddy_upsert_a_record() {
  local subdomain="$1"
  local apex="${2:-$APEX_DOMAIN}"
  local server_ip="$3"
  local api_key="${GODADDY_API_KEY:-}"
  local api_secret="${GODADDY_API_SECRET:-}"
  local api_base="${GODADDY_API_BASE:-https://api.godaddy.com}"

  if [[ -z "$api_key" || -z "$api_secret" ]]; then
    echo "==> GoDaddy: keys not set, skipping"
    return 0
  fi
  if [[ -z "$server_ip" ]]; then
    echo "Warning: GODADDY keys are set but SERVER_IP is empty; skipping DNS" >&2
    return 0
  fi
  api_base="${api_base%/}"
  local url="${api_base}/v1/domains/${apex}/records/A/${subdomain}"
  local payload="[{\"type\":\"A\",\"name\":\"${subdomain}\",\"data\":\"${server_ip}\",\"ttl\":600}]"
  if curl -sS -f -X PUT "$url" \
    -H "Authorization: sso-key ${api_key}:${api_secret}" \
    -H "Content-Type: application/json" \
    -d "$payload" >/dev/null; then
    echo "OK ${subdomain}.${apex} -> ${server_ip}"
    return 0
  fi
  echo "Error: failed to set GoDaddy A record for ${subdomain}.${apex}" >&2
  return 1
}

pm2_daemon_up() {
  local pid_file="${PM2_HOME:-$HOME/.pm2}/pm2.pid"
  local pid
  [[ -f "$pid_file" ]] || return 1
  pid="$(tr -d '[:space:]' < "$pid_file")"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

other_pm2_apps() {
  pm2 jlist | python3 -c '
import json, sys
names = {"ideacarb-usage", "ideacarb-usage-api"}
apps = json.load(sys.stdin)
print(sum(1 for app in apps if app.get("name") not in names))
'
}

pm2_save_if_fleet() {
  local others
  others="$(other_pm2_apps)"
  if [[ "$others" =~ ^[0-9]+$ ]] && (( others >= 1 )); then
    pm2 save
  else
    echo "Warning: no other PM2 apps in this daemon. Not saving." >&2
  fi
}

require_fleet_pm2() {
  if ! pm2_daemon_up; then
    echo "Error: PM2 daemon is not running. Do not start this app first." >&2
    echo "    Recover the fleet, then re-run." >&2
    exit 1
  fi
  local others
  others="$(other_pm2_apps)"
  if [[ ! "$others" =~ ^[0-9]+$ ]] || (( others < 1 )); then
    echo "Error: PM2 has no other apps. Starting analytics here would own an empty daemon." >&2
    exit 1
  fi
}

write_nginx_http() {
  local domain="$1"
  local port="$2"
  local nginx_available="/etc/nginx/sites-available/${domain}"
  local nginx_enabled="/etc/nginx/sites-enabled/${domain}"
  local tmp_nginx
  echo "==> Writing nginx HTTP site ${domain} -> 127.0.0.1:${port}"
  if [[ -f "$nginx_available" ]]; then
    sudo cp "$nginx_available" "${nginx_available}.bak.$(date +%Y%m%d%H%M%S)"
  fi
  tmp_nginx="$(mktemp)"
  cat > "$tmp_nginx" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
  sudo cp "$tmp_nginx" "$nginx_available"
  sudo chown root:root "$nginx_available"
  sudo chmod 644 "$nginx_available"
  rm -f "$tmp_nginx"
  sudo ln -sf "$nginx_available" "$nginx_enabled"
  sudo nginx -t
  sudo systemctl reload nginx
}

refresh_nginx_proxy() {
  local domain="$1"
  local port="$2"
  local force_rewrite="$3"
  local nginx_available="/etc/nginx/sites-available/${domain}"

  if [[ "$force_rewrite" == "true" || ! -f "$nginx_available" ]] || ! sudo grep -q 'ssl_certificate' "$nginx_available"; then
    write_nginx_http "$domain" "$port"
    return 0
  fi

  echo "==> Refreshing nginx proxy_pass on ${domain} -> 127.0.0.1:${port}"
  sudo python3 - "$nginx_available" "$port" <<'PY'
import re, shutil, sys
from datetime import datetime
from pathlib import Path
path = Path(sys.argv[1])
port = sys.argv[2]
text = path.read_text(encoding="utf-8")
pattern = re.compile(r"(proxy_pass\s+http://127\.0\.0\.1:)\d+(;)")
if not pattern.search(text):
    raise SystemExit("no proxy_pass http://127.0.0.1:<port> found")
updated = pattern.sub(rf"\g<1>{port}\2", text)
if updated != text:
    shutil.copy2(path, f"{path}.bak.{datetime.now():%Y%m%d%H%M%S}")
    path.write_text(updated, encoding="utf-8")
PY
  sudo nginx -t
  sudo systemctl reload nginx
}

run_certbot() {
  local domain="$1"
  echo "==> Running certbot (HTTPS)"
  local certbot_ok=false
  if [[ -n "${CERTBOT_EMAIL:-}" ]]; then
    if sudo certbot --nginx -d "$domain" --non-interactive --agree-tos -m "$CERTBOT_EMAIL"; then
      certbot_ok=true
    fi
  elif sudo certbot --nginx -d "$domain"; then
    certbot_ok=true
  fi
  if [[ "$certbot_ok" == "true" ]]; then
    echo "    HTTPS certificate issued for ${domain}"
  else
    echo "Warning: certbot failed for ${domain} (DNS may still be propagating)." >&2
    echo "    Retry: sudo certbot --nginx -d ${domain}" >&2
  fi
}

ensure_postgres() {
  local password="$1"
  local escaped
  escaped="$(sql_escape "$password")"
  echo "==> Ensuring Postgres role ${DB_ROLE}"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_ROLE}') THEN
    CREATE ROLE ${DB_ROLE} LOGIN PASSWORD '${escaped}';
  ELSIF '${MODE}' = 'new' THEN
    ALTER ROLE ${DB_ROLE} WITH PASSWORD '${escaped}';
  END IF;
END
\$\$;
SQL
  echo "==> Ensuring database ${DB_NAME}"
  if [[ "$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'")" != "1" ]]; then
    sudo -u postgres createdb -O "$DB_ROLE" "$DB_NAME"
  fi
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$DB_NAME" <<SQL
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_ROLE};
GRANT ALL ON SCHEMA public TO ${DB_ROLE};
SQL
}

write_env_local() {
  local database_url="$1"
  local auth_secret="$2"
  local api_secret="$3"
  local app_url="$4"
  local port="$5"
  local api_port="$6"
  local tmp_env
  tmp_env="$(mktemp)"
  cat > "$tmp_env" <<EOF
NODE_ENV=production
APP_URL=${app_url}
PORT=${port}
API_PORT=${api_port}
DATABASE_URL=${database_url}
AUTH_SECRET=${auth_secret}
ANALYTICS_API_SECRET=${api_secret}
ANALYTICS_API_URL=http://127.0.0.1:${api_port}
STAFF_USERNAME=${STAFF_USERNAME}
STAFF_PASSWORD=${STAFF_PASSWORD}
EOF
  if [[ -f "$APP_ENV_FILE" ]]; then
    cp "$APP_ENV_FILE" "${APP_ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
  fi
  cp "$tmp_env" "$APP_ENV_FILE"
  chmod 600 "$APP_ENV_FILE"
  rm -f "$tmp_env"
}

install_api() {
  echo "==> Installing analytics API"
  python3 -m venv "${ROOT}/api/.venv"
  "${ROOT}/api/.venv/bin/pip" install -r "${ROOT}/api/requirements.txt"
}

install_web() {
  echo "==> Installing and building the Next app"
  cd "$ROOT"
  if [[ -f pnpm-lock.yaml ]]; then
    pnpm install --frozen-lockfile
  else
    pnpm install
  fi
  pnpm build
}

start_pm2() {
  echo "==> Starting PM2 ${PM2_WEB} and ${PM2_API}"
  cd "$ROOT"
  PORT="$PORT" API_PORT="$API_PORT" pm2 startOrReload ecosystem.config.cjs --update-env
  pm2_save_if_fleet
}

git_pull_if_repo() {
  if [[ ! -d "${ROOT}/.git" ]]; then
    echo "==> Not a git checkout; skipping pull"
    return 0
  fi
  echo "==> Deploying origin/master"
  git -C "$ROOT" fetch origin master
  git -C "$ROOT" checkout master
  git -C "$ROOT" pull --ff-only origin master
}

configure_domain() {
  local domain="$1"
  local port="$2"
  local rewrite="$3"
  if [[ "$SKIP_DOMAIN" != "true" && "$MODE" == "new" ]]; then
    echo "==> GoDaddy A record"
    godaddy_upsert_a_record "$(godaddy_subdomain "$domain" "$APEX_DOMAIN")" "$APEX_DOMAIN" "${SERVER_IP:-}"
  fi
  refresh_nginx_proxy "$domain" "$port" "$rewrite"
  if [[ "$SKIP_DOMAIN" != "true" ]]; then
    if [[ "$MODE" == "new" || "$FORCE" == "true" || ! -d "/etc/letsencrypt/live/${domain}" ]]; then
      run_certbot "$domain"
    fi
  fi
}

teardown_app() {
  require_cmd pm2
  require_cmd sudo
  if pm2_daemon_up; then
    pm2 delete "$PM2_WEB" >/dev/null 2>&1 || true
    pm2 delete "$PM2_API" >/dev/null 2>&1 || true
    pm2_save_if_fleet
  fi
  local domain="${DOMAIN:-analytics.ideacarb.com}"
  local nginx_available="/etc/nginx/sites-available/${domain}"
  local nginx_enabled="/etc/nginx/sites-enabled/${domain}"
  if [[ -e "$nginx_available" || -L "$nginx_enabled" ]]; then
    sudo rm -f "$nginx_enabled" "$nginx_available"
    sudo nginx -t
    sudo systemctl reload nginx
  fi
  if [[ "$DELETE_CERT" == "true" ]]; then
    sudo certbot delete --cert-name "$domain" --non-interactive || true
  fi
  if [[ "$DROP_DB" == "true" ]]; then
    sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 <<SQL
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
SQL
    sudo -u postgres psql -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
    sudo -u postgres psql -d postgres -c "DROP ROLE IF EXISTS ${DB_ROLE};"
  fi
  echo "Teardown completed for ${domain}"
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

MODE="${1:-}"
if [[ -z "$MODE" ]]; then
  echo "Error: missing mode (new|update|teardown)." >&2
  usage
  exit 1
fi
shift

FORCE=false
SKIP_DOMAIN=false
DROP_DB=false
DELETE_CERT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=true; shift ;;
    --skip-domain) SKIP_DOMAIN=true; shift ;;
    --drop-db) DROP_DB=true; shift ;;
    --delete-cert) DELETE_CERT=true; shift ;;
    *)
      echo "Error: unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$MODE" != "new" && "$MODE" != "update" && "$MODE" != "teardown" ]]; then
  echo "Error: mode must be new, update, or teardown." >&2
  usage
  exit 1
fi

if [[ "$MODE" == "teardown" ]]; then
  if [[ -f "$ENV_FILE" ]]; then
    load_deploy_env
  fi
  DOMAIN="${DOMAIN:-analytics.ideacarb.com}"
  teardown_app
  exit 0
fi

require_cmd sudo
require_cmd psql
require_cmd createdb
require_cmd pnpm
require_cmd pm2
require_cmd nginx
require_cmd openssl
require_cmd python3
if [[ "$SKIP_DOMAIN" != "true" ]]; then
  require_cmd curl
  require_cmd certbot
fi

load_deploy_env
require_fleet_pm2

DOMAIN="${DOMAIN:-analytics.ideacarb.com}"
PORT="${PORT:-8792}"
API_PORT="${API_PORT:-8791}"
APEX_DOMAIN="${APEX_DOMAIN:-ideacarb.com}"
STAFF_USERNAME="${STAFF_USERNAME:-admin}"

if [[ -z "${ANALYTICS_DB_PASSWORD:-}" || -z "${ANALYTICS_API_SECRET:-}" || -z "${STAFF_PASSWORD:-}" ]]; then
  echo "Error: ANALYTICS_DB_PASSWORD, ANALYTICS_API_SECRET, and STAFF_PASSWORD must be set in deploy.env." >&2
  exit 1
fi
if ! [[ "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1 || PORT > 65535 )); then
  echo "Error: PORT must be between 1 and 65535." >&2
  exit 1
fi

ENCODED_DB_PASSWORD="$(urlencode "$ANALYTICS_DB_PASSWORD")"
DATABASE_URL="postgresql://${DB_ROLE}:${ENCODED_DB_PASSWORD}@127.0.0.1:5432/${DB_NAME}"
AUTH_SECRET="${AUTH_SECRET:-}"
API_SECRET="${ANALYTICS_API_SECRET}"

if [[ "$MODE" == "new" && "$SKIP_DOMAIN" == "true" ]]; then
  APP_URL="http://${DOMAIN}"
else
  APP_URL="https://${DOMAIN}"
fi

if [[ "$MODE" == "update" ]]; then
  if [[ ! -f "$APP_ENV_FILE" ]]; then
    echo "Error: .env.local not found; run ./deploy/deploy.sh new first." >&2
    exit 1
  fi
  DATABASE_URL="$(parse_env_key_from_file "$APP_ENV_FILE" "DATABASE_URL")"
  AUTH_SECRET="$(parse_env_key_from_file "$APP_ENV_FILE" "AUTH_SECRET")"
  API_SECRET="$(parse_env_key_from_file "$APP_ENV_FILE" "ANALYTICS_API_SECRET")"
fi

if [[ -z "$AUTH_SECRET" ]]; then
  AUTH_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
  echo "==> Generated AUTH_SECRET (written to .env.local only)"
fi
if [[ ${#AUTH_SECRET} -lt 32 ]]; then
  echo "Error: AUTH_SECRET must be at least 32 characters." >&2
  exit 1
fi

echo "Mode: ${MODE}"
echo "Root: ${ROOT}"
echo "Domain: ${DOMAIN}"
echo "Web: 127.0.0.1:${PORT} (${PM2_WEB})"
echo "API: 127.0.0.1:${API_PORT} (${PM2_API})"
echo "Database: ${DB_NAME} (role ${DB_ROLE})"

ensure_postgres "$ANALYTICS_DB_PASSWORD"
write_env_local "$DATABASE_URL" "$AUTH_SECRET" "$API_SECRET" "$APP_URL" "$PORT" "$API_PORT"

git_pull_if_repo

install_api
install_web
start_pm2
configure_domain "$DOMAIN" "$PORT" "$FORCE"

echo
echo "Deploy completed: ${APP_URL} (PM2: ${PM2_WEB}, ${PM2_API})"
