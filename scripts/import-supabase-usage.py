#!/usr/bin/env python3
"""Import signed-in page views from Supabase app_usage_tracking."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

ROOT = Path(__file__).resolve().parent.parent
ZONE = "Asia/Bangkok"
PAGE_SIZE = 1000
ACCOUNT_TYPES = {
    "annual_member",
    "trial",
    "demo",
    "internal",
    "employee",
    "project",
}


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        if key:
            values[key] = value
    return values


def tenant_code(domain: str) -> str | None:
    host = domain.strip().lower()
    if "://" in host:
        host = host.split("://", 1)[1]
    host = host.split("/", 1)[0].split(":", 1)[0]
    suffix = ".ideacarb.com"
    if not host.endswith(suffix):
        return None
    code = host[: -len(suffix)]
    if not code or "." in code:
        return None
    return code


def parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def fetch_all(base: str, key: str, table: str, select: str) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    while True:
        query = urllib.parse.urlencode({"select": select, "order": "id.asc"})
        request = urllib.request.Request(
            f"{base}/rest/v1/{table}?{query}",
            headers={
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Accept": "application/json",
                "Range-Unit": "items",
                "Range": f"{offset}-{offset + PAGE_SIZE - 1}",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                page = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise SystemExit(f"Supabase {table} returned {exc.code}: {body}") from exc
        if not isinstance(page, list):
            raise SystemExit(f"Supabase {table} did not return a list")
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            return rows
        offset += PAGE_SIZE


def use_venv_python() -> None:
    try:
        import psycopg  # noqa: F401
    except ImportError:
        python = ROOT / "api" / ".venv" / "bin" / "python"
        if python.is_file() and Path(sys.executable) != python:
            os.execv(str(python), [str(python), *sys.argv])
        raise SystemExit("psycopg is required. Run ./deploy/deploy.sh new first, then retry.")


def count_sources(conn, source_ids: list[str]) -> int:
    total = 0
    for start in range(0, len(source_ids), 5000):
        chunk = source_ids[start : start + 5000]
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM usage_events WHERE source_id = ANY(%s::uuid[])",
            (chunk,),
        ).fetchone()
        total += int(row["n"])
    return total


def rebuild_daily(conn) -> None:
    conn.execute(
        """
        TRUNCATE usage_daily, usage_daily_user, usage_daily_page, usage_daily_session
        """
    )
    conn.execute(
        f"""
        INSERT INTO usage_daily (day, organization_id, page_views)
        SELECT (occurred_at AT TIME ZONE '{ZONE}')::date, organization_id, COUNT(*)::int
        FROM usage_events
        GROUP BY 1, 2
        """
    )
    conn.execute(
        f"""
        INSERT INTO usage_daily_user (
          day, organization_id, user_id, user_label, user_role, page_views, last_page, last_seen
        )
        SELECT
          (occurred_at AT TIME ZONE '{ZONE}')::date,
          organization_id,
          user_id,
          (ARRAY_AGG(user_label ORDER BY occurred_at DESC))[1],
          (ARRAY_AGG(user_role ORDER BY occurred_at DESC))[1],
          COUNT(*)::int,
          (ARRAY_AGG(page ORDER BY occurred_at DESC))[1],
          MAX(occurred_at)
        FROM usage_events
        GROUP BY 1, 2, 3
        """
    )
    conn.execute(
        f"""
        INSERT INTO usage_daily_page (day, organization_id, page, page_views)
        SELECT (occurred_at AT TIME ZONE '{ZONE}')::date, organization_id, page, COUNT(*)::int
        FROM usage_events
        GROUP BY 1, 2, 3
        """
    )
    conn.execute(
        f"""
        INSERT INTO usage_daily_session (day, organization_id, session_id)
        SELECT DISTINCT (occurred_at AT TIME ZONE '{ZONE}')::date, organization_id, session_id
        FROM usage_events
        WHERE session_id IS NOT NULL AND btrim(session_id) <> ''
        """
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Import signed-in page views from Supabase.")
    parser.add_argument("--supabase-env", required=True, type=Path)
    parser.add_argument("--env-file", type=Path, default=ROOT / ".env.local")
    args = parser.parse_args()

    local = load_env(args.env_file)
    database_url = local.get("DATABASE_URL", "").strip()
    if not database_url:
        raise SystemExit(f"Error: DATABASE_URL is missing from {args.env_file}")
    os.environ["DATABASE_URL"] = database_url

    supabase = load_env(args.supabase_env)
    base = supabase.get("NEXT_PUBLIC_SUPABASE_URL", "").strip().rstrip("/")
    service_key = supabase.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    anon_key = supabase.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "").strip()
    key = service_key or anon_key
    if not base or not key:
        raise SystemExit("Error: NEXT_PUBLIC_SUPABASE_URL and a Supabase key are required in --supabase-env")
    if not service_key:
        print("Warning: using the anon key. RLS may block the read.", file=sys.stderr)

    use_venv_python()
    sys.path.insert(0, str(ROOT / "api"))
    from db import connect, ensure_schema

    organizations = fetch_all(base, key, "organizations", "id,code,name,account_type")
    tracking = fetch_all(base, key, "app_usage_tracking", "id,domain,page,user_role,user_id,session_id,created_at")
    orgs_by_code = {row["code"]: row for row in organizations if row.get("code")}

    skipped_no_user = 0
    skipped_domain = 0
    skipped_unknown = 0
    skipped_invalid = 0
    prepared: list[tuple] = []
    needed_codes: set[str] = set()

    for row in tracking:
        if not row.get("user_id"):
            skipped_no_user += 1
            continue
        code = tenant_code(str(row.get("domain") or ""))
        if not code:
            skipped_domain += 1
            continue
        if code not in orgs_by_code:
            skipped_unknown += 1
            continue
        page = str(row.get("page") or "").strip()
        if not page or not row.get("id") or not row.get("created_at"):
            skipped_invalid += 1
            continue
        try:
            user_id = str(UUID(str(row["user_id"])))
            source_id = str(UUID(str(row["id"])))
            occurred_at = parse_time(str(row["created_at"]))
        except (ValueError, TypeError):
            skipped_invalid += 1
            continue
        role = str(row.get("user_role") or "")
        session_id = row.get("session_id") or None
        org = orgs_by_code[code]
        prepared.append(
            (
                str(UUID(str(org["id"]))),
                code,
                user_id,
                user_id,
                role,
                page,
                session_id,
                occurred_at,
                source_id,
            )
        )
        needed_codes.add(code)

    with connect() as conn:
        ensure_schema(conn)
        clients_added = 0
        skipped_code_conflict = 0
        blocked_codes: set[str] = set()
        for code in sorted(needed_codes):
            org = orgs_by_code[code]
            organization_id = str(UUID(str(org["id"])))
            existing = conn.execute(
                "SELECT organization_id::text AS organization_id FROM clients WHERE code = %s",
                (code,),
            ).fetchone()
            if existing and existing["organization_id"] != organization_id:
                skipped_code_conflict += 1
                blocked_codes.add(code)
                print(f"Skip {code}: code belongs to {existing['organization_id']}, not {organization_id}")
                continue
            account_type = org.get("account_type") if org.get("account_type") in ACCOUNT_TYPES else "annual_member"
            name = str(org.get("name") or code)
            inserted = conn.execute(
                """
                INSERT INTO clients (organization_id, code, name, account_type)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (organization_id) DO NOTHING
                """,
                (organization_id, code, name, account_type),
            )
            clients_added += inserted.rowcount

        events = [row for row in prepared if row[1] not in blocked_codes]
        source_ids = [row[-1] for row in events]
        before = count_sources(conn, source_ids)
        with conn.cursor() as cur:
            for start in range(0, len(events), 500):
                cur.executemany(
                    """
                    INSERT INTO usage_events (
                      organization_id, instance_code, user_id, user_label, user_role,
                      page, session_id, occurred_at, source_id
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (source_id, occurred_at) DO NOTHING
                    """,
                    events[start : start + 500],
                )
        imported = count_sources(conn, source_ids) - before
        rebuild_daily(conn)
        conn.commit()

    already = len(events) - imported
    print(f"Read {len(tracking)} tracking row(s)")
    print(f"Imported {imported} new event(s); {already} already present")
    print(f"Clients added: {clients_added}")
    print(f"Skipped no user: {skipped_no_user}")
    print(f"Skipped unmapped domain: {skipped_domain}")
    print(f"Skipped unknown organization: {skipped_unknown}")
    print(f"Skipped invalid: {skipped_invalid}")
    print(f"Skipped code conflict: {len(prepared) - len(events)} event(s) on {skipped_code_conflict} code(s)")


if __name__ == "__main__":
    main()
