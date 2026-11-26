from __future__ import annotations

from datetime import date, timedelta

from db import ZONE

ACCOUNT_TYPES = (
    "annual_member",
    "trial",
    "demo",
    "internal",
    "employee",
    "project",
)
SORTS = {
    "page_views": "page_views",
    "unique_users": "unique_users",
    "last_seen": "last_seen",
}


def spark_start(end: date) -> date:
    return end - timedelta(days=6)


def _filters(account_types: list[str] | None, organization_ids: list[str] | None, query: str | None):
    clauses = ["TRUE"]
    params: list = []
    if account_types:
        clauses.append("c.account_type = ANY(%s)")
        params.append(account_types)
    if organization_ids:
        clauses.append("c.organization_id = ANY(%s::uuid[])")
        params.append(organization_ids)
    if query:
        clauses.append("(c.name ILIKE %s OR c.code ILIKE %s)")
        like = f"%{query}%"
        params.extend([like, like])
    return " AND ".join(clauses), params


def upsert_client(conn, organization_id: str, code: str, name: str | None, account_type: str | None) -> None:
    conn.execute(
        """
        INSERT INTO clients (organization_id, code, name, account_type)
        VALUES (%s, %s, COALESCE(%s, %s), COALESCE(%s, 'annual_member'))
        ON CONFLICT (organization_id) DO UPDATE
        SET code = EXCLUDED.code,
            name = COALESCE(%s, clients.name),
            account_type = COALESCE(%s, clients.account_type),
            updated_at = NOW()
        """,
        (organization_id, code, name, code, account_type, name, account_type),
    )


def record_event(conn, event: dict) -> bool:
    row = conn.execute(
        """
        SELECT code FROM clients WHERE organization_id = %s
        """,
        (event["organization_id"],),
    ).fetchone()
    if not row:
        return False
    event = {**event, "instance_code": row["code"]}

    conn.execute(
        """
        INSERT INTO usage_events (
          organization_id, instance_code, user_id, user_label, user_role, page, session_id
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (
            event["organization_id"],
            event["instance_code"],
            event["user_id"],
            event["user_label"],
            event["user_role"],
            event["page"],
            event["session_id"],
        ),
    )
    conn.execute(
        f"""
        INSERT INTO usage_daily (day, organization_id, page_views)
        VALUES ((NOW() AT TIME ZONE '{ZONE}')::date, %s, 1)
        ON CONFLICT (day, organization_id) DO UPDATE
        SET page_views = usage_daily.page_views + 1
        """,
        (event["organization_id"],),
    )
    conn.execute(
        f"""
        INSERT INTO usage_daily_user (
          day, organization_id, user_id, user_label, user_role, page_views, last_page, last_seen
        )
        VALUES ((NOW() AT TIME ZONE '{ZONE}')::date, %s, %s, %s, %s, 1, %s, NOW())
        ON CONFLICT (day, organization_id, user_id) DO UPDATE
        SET page_views = usage_daily_user.page_views + 1,
            user_label = EXCLUDED.user_label,
            user_role = EXCLUDED.user_role,
            last_page = EXCLUDED.last_page,
            last_seen = EXCLUDED.last_seen
        """,
        (
            event["organization_id"],
            event["user_id"],
            event["user_label"],
            event["user_role"],
            event["page"],
        ),
    )
    conn.execute(
        f"""
        INSERT INTO usage_daily_page (day, organization_id, page, page_views)
        VALUES ((NOW() AT TIME ZONE '{ZONE}')::date, %s, %s, 1)
        ON CONFLICT (day, organization_id, page) DO UPDATE
        SET page_views = usage_daily_page.page_views + 1
        """,
        (event["organization_id"], event["page"]),
    )
    if event["session_id"]:
        conn.execute(
            f"""
            INSERT INTO usage_daily_session (day, organization_id, session_id)
            VALUES ((NOW() AT TIME ZONE '{ZONE}')::date, %s, %s)
            ON CONFLICT DO NOTHING
            """,
            (event["organization_id"], event["session_id"]),
        )
    return True


def overview(
    conn,
    start: date,
    end: date,
    account_types: list[str] | None,
    organization_ids: list[str] | None,
    query: str | None,
    sort: str,
    page: int,
    page_size: int,
) -> dict:
    where, params = _filters(account_types, organization_ids, query)
    order = SORTS.get(sort, "page_views")
    spark_from = spark_start(end)
    base_params = [start, end, *params]

    kpis = conn.execute(
        f"""
        WITH filtered AS (
          SELECT c.organization_id FROM clients c WHERE {where}
        )
        SELECT
          (SELECT COUNT(*) FROM filtered) AS client_count,
          (
            SELECT COUNT(DISTINCT d.organization_id)
            FROM usage_daily d
            JOIN filtered f ON f.organization_id = d.organization_id
            WHERE d.day BETWEEN %s AND %s AND d.page_views > 0
          ) AS active_clients,
          (
            SELECT COUNT(DISTINCT u.user_id)
            FROM usage_daily_user u
            JOIN filtered f ON f.organization_id = u.organization_id
            WHERE u.day BETWEEN %s AND %s
          ) AS unique_users,
          (
            SELECT COALESCE(SUM(d.page_views), 0)
            FROM usage_daily d
            JOIN filtered f ON f.organization_id = d.organization_id
            WHERE d.day BETWEEN %s AND %s
          ) AS page_views
        """,
        [*params, start, end, start, end, start, end],
    ).fetchone()

    series_rows = conn.execute(
        f"""
        WITH filtered AS (
          SELECT c.organization_id FROM clients c WHERE {where}
        ),
        days AS (
          SELECT generate_series(%s::date, %s::date, '1 day')::date AS day
        )
        SELECT
          days.day,
          COALESCE((
            SELECT SUM(d.page_views)
            FROM usage_daily d
            JOIN filtered f ON f.organization_id = d.organization_id
            WHERE d.day = days.day
          ), 0) AS page_views,
          COALESCE((
            SELECT COUNT(DISTINCT u.user_id)
            FROM usage_daily_user u
            JOIN filtered f ON f.organization_id = u.organization_id
            WHERE u.day = days.day
          ), 0) AS unique_users
        FROM days
        ORDER BY days.day
        """,
        [*params, start, end],
    ).fetchall()

    directory_where, directory_params = _filters(account_types, None, None)
    directory = conn.execute(
        f"""
        SELECT organization_id::text, code, name, account_type
        FROM clients c
        WHERE {directory_where}
        ORDER BY name
        """,
        directory_params,
    ).fetchall()

    total = conn.execute(
        f"SELECT COUNT(*) AS total FROM clients c WHERE {where}",
        params,
    ).fetchone()["total"]

    offset = (page - 1) * page_size
    rows = conn.execute(
        f"""
        SELECT
          c.organization_id::text AS organization_id,
          c.code,
          c.name,
          c.account_type,
          COALESCE(SUM(d.page_views), 0) AS page_views,
          (
            SELECT COUNT(DISTINCT u.user_id)
            FROM usage_daily_user u
            WHERE u.organization_id = c.organization_id
              AND u.day BETWEEN %s AND %s
          ) AS unique_users,
          (
            SELECT MAX(u.last_seen)
            FROM usage_daily_user u
            WHERE u.organization_id = c.organization_id
              AND u.day BETWEEN %s AND %s
          ) AS last_seen,
          (
            SELECT COALESCE(json_agg(s.page_views ORDER BY s.day), '[]'::json)
            FROM (
              SELECT days.day, COALESCE(ud.page_views, 0) AS page_views
              FROM generate_series(%s::date, %s::date, '1 day') AS days(day)
              LEFT JOIN usage_daily ud
                ON ud.organization_id = c.organization_id AND ud.day = days.day
            ) s
          ) AS sparkline
        FROM clients c
        LEFT JOIN usage_daily d
          ON d.organization_id = c.organization_id
         AND d.day BETWEEN %s AND %s
        WHERE {where}
        GROUP BY c.organization_id, c.code, c.name, c.account_type
        ORDER BY {order} DESC NULLS LAST, c.name
        LIMIT %s OFFSET %s
        """,
        [start, end, start, end, spark_from, end, start, end, *params, page_size, offset],
    ).fetchall()

    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "kpis": {
            "active_clients": int(kpis["active_clients"] or 0),
            "unique_users": int(kpis["unique_users"] or 0),
            "page_views": int(kpis["page_views"] or 0),
            "client_count": int(kpis["client_count"] or 0),
        },
        "series": [
            {
                "date": row["day"].isoformat(),
                "page_views": int(row["page_views"]),
                "unique_users": int(row["unique_users"]),
            }
            for row in series_rows
        ],
        "directory": directory,
        "clients": {
            "page": page,
            "page_size": page_size,
            "total": int(total),
            "rows": [
                {
                    **row,
                    "page_views": int(row["page_views"]),
                    "unique_users": int(row["unique_users"]),
                    "last_seen": row["last_seen"].isoformat() if row["last_seen"] else None,
                    "sparkline": [int(value) for value in row["sparkline"]],
                }
                for row in rows
            ],
        },
    }


def client_detail(conn, organization_id: str, start: date, end: date) -> dict | None:
    client = conn.execute(
        """
        SELECT organization_id::text, code, name, account_type
        FROM clients WHERE organization_id = %s
        """,
        (organization_id,),
    ).fetchone()
    if not client:
        return None

    kpis = conn.execute(
        """
        SELECT
          (
            SELECT COUNT(DISTINCT user_id)
            FROM usage_daily_user
            WHERE organization_id = %s AND day BETWEEN %s AND %s
          ) AS unique_users,
          (
            SELECT COALESCE(SUM(page_views), 0)
            FROM usage_daily
            WHERE organization_id = %s AND day BETWEEN %s AND %s
          ) AS page_views,
          (
            SELECT COUNT(*)
            FROM usage_daily_session
            WHERE organization_id = %s AND day BETWEEN %s AND %s
          ) AS sessions,
          (
            SELECT MAX(last_seen)
            FROM usage_daily_user
            WHERE organization_id = %s AND day BETWEEN %s AND %s
          ) AS last_seen
        """,
        (
            organization_id, start, end,
            organization_id, start, end,
            organization_id, start, end,
            organization_id, start, end,
        ),
    ).fetchone()

    series_rows = conn.execute(
        """
        SELECT
          days.day,
          COALESCE(d.page_views, 0) AS page_views,
          COALESCE((
            SELECT COUNT(DISTINCT u.user_id)
            FROM usage_daily_user u
            WHERE u.organization_id = %s AND u.day = days.day
          ), 0) AS unique_users
        FROM generate_series(%s::date, %s::date, '1 day') AS days(day)
        LEFT JOIN usage_daily d
          ON d.organization_id = %s AND d.day = days.day
        ORDER BY days.day
        """,
        (organization_id, start, end, organization_id),
    ).fetchall()

    pages = conn.execute(
        """
        SELECT page, SUM(page_views) AS page_views
        FROM usage_daily_page
        WHERE organization_id = %s AND day BETWEEN %s AND %s
        GROUP BY page
        ORDER BY page_views DESC, page
        LIMIT 8
        """,
        (organization_id, start, end),
    ).fetchall()

    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "client": client,
        "kpis": {
            "unique_users": int(kpis["unique_users"] or 0),
            "page_views": int(kpis["page_views"] or 0),
            "sessions": int(kpis["sessions"] or 0),
            "last_seen": kpis["last_seen"].isoformat() if kpis["last_seen"] else None,
        },
        "series": [
            {
                "date": row["day"].isoformat(),
                "page_views": int(row["page_views"]),
                "unique_users": int(row["unique_users"]),
            }
            for row in series_rows
        ],
        "pages": [{"page": row["page"], "page_views": int(row["page_views"])} for row in pages],
    }


def overview_export(
    conn,
    start: date,
    end: date,
    account_types: list[str] | None,
    organization_ids: list[str] | None,
    query: str | None,
    sort: str,
) -> dict:
    where, params = _filters(account_types, organization_ids, query)
    order = SORTS.get(sort, "page_views")

    kpis = conn.execute(
        f"""
        WITH filtered AS (
          SELECT c.organization_id FROM clients c WHERE {where}
        )
        SELECT
          (SELECT COUNT(*) FROM filtered) AS client_count,
          (
            SELECT COUNT(DISTINCT d.organization_id)
            FROM usage_daily d
            JOIN filtered f ON f.organization_id = d.organization_id
            WHERE d.day BETWEEN %s AND %s AND d.page_views > 0
          ) AS active_clients,
          (
            SELECT COUNT(DISTINCT u.user_id)
            FROM usage_daily_user u
            JOIN filtered f ON f.organization_id = u.organization_id
            WHERE u.day BETWEEN %s AND %s
          ) AS unique_users,
          (
            SELECT COALESCE(SUM(d.page_views), 0)
            FROM usage_daily d
            JOIN filtered f ON f.organization_id = d.organization_id
            WHERE d.day BETWEEN %s AND %s
          ) AS page_views
        """,
        [*params, start, end, start, end, start, end],
    ).fetchone()

    series_rows = conn.execute(
        f"""
        WITH filtered AS (
          SELECT c.organization_id FROM clients c WHERE {where}
        ),
        days AS (
          SELECT generate_series(%s::date, %s::date, '1 day')::date AS day
        )
        SELECT
          days.day,
          COALESCE((
            SELECT SUM(d.page_views)
            FROM usage_daily d
            JOIN filtered f ON f.organization_id = d.organization_id
            WHERE d.day = days.day
          ), 0) AS page_views,
          COALESCE((
            SELECT COUNT(DISTINCT u.user_id)
            FROM usage_daily_user u
            JOIN filtered f ON f.organization_id = u.organization_id
            WHERE u.day = days.day
          ), 0) AS unique_users
        FROM days
        ORDER BY days.day
        """,
        [*params, start, end],
    ).fetchall()

    selected: list = []
    if organization_ids:
        selected = conn.execute(
            """
            SELECT code, name
            FROM clients
            WHERE organization_id = ANY(%s::uuid[])
            ORDER BY name
            """,
            (organization_ids,),
        ).fetchall()

    rows = conn.execute(
        f"""
        SELECT
          c.organization_id::text AS organization_id,
          c.code,
          c.name,
          c.account_type,
          COALESCE(SUM(d.page_views), 0) AS page_views,
          (
            SELECT COUNT(DISTINCT u.user_id)
            FROM usage_daily_user u
            WHERE u.organization_id = c.organization_id
              AND u.day BETWEEN %s AND %s
          ) AS unique_users,
          (
            SELECT MAX(u.last_seen)
            FROM usage_daily_user u
            WHERE u.organization_id = c.organization_id
              AND u.day BETWEEN %s AND %s
          ) AS last_seen
        FROM clients c
        LEFT JOIN usage_daily d
          ON d.organization_id = c.organization_id
         AND d.day BETWEEN %s AND %s
        WHERE {where}
        GROUP BY c.organization_id, c.code, c.name, c.account_type
        ORDER BY {order} DESC NULLS LAST, c.name
        """,
        [start, end, start, end, start, end, *params],
    ).fetchall()

    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "filters": {
            "account_types": account_types or [],
            "q": query or "",
            "clients": [{"code": row["code"], "name": row["name"]} for row in selected],
        },
        "kpis": {
            "active_clients": int(kpis["active_clients"] or 0),
            "unique_users": int(kpis["unique_users"] or 0),
            "page_views": int(kpis["page_views"] or 0),
            "client_count": int(kpis["client_count"] or 0),
        },
        "series": [
            {
                "date": row["day"].isoformat(),
                "page_views": int(row["page_views"]),
                "unique_users": int(row["unique_users"]),
            }
            for row in series_rows
        ],
        "clients": [
            {
                **row,
                "page_views": int(row["page_views"]),
                "unique_users": int(row["unique_users"]),
                "last_seen": row["last_seen"].isoformat() if row["last_seen"] else None,
            }
            for row in rows
        ],
    }


def client_export(conn, organization_id: str, start: date, end: date) -> dict | None:
    detail = client_detail(conn, organization_id, start, end)
    if not detail:
        return None
    pages = conn.execute(
        """
        SELECT page, SUM(page_views) AS page_views
        FROM usage_daily_page
        WHERE organization_id = %s AND day BETWEEN %s AND %s
        GROUP BY page
        ORDER BY page_views DESC, page
        """,
        (organization_id, start, end),
    ).fetchall()
    rows = conn.execute(
        """
        SELECT
          user_id::text,
          (array_agg(user_label ORDER BY last_seen DESC))[1] AS user_label,
          (array_agg(user_role ORDER BY last_seen DESC))[1] AS user_role,
          SUM(page_views) AS page_views,
          MAX(last_seen) AS last_seen,
          (array_agg(last_page ORDER BY last_seen DESC))[1] AS last_page
        FROM usage_daily_user
        WHERE organization_id = %s AND day BETWEEN %s AND %s
        GROUP BY user_id
        ORDER BY page_views DESC, user_label
        """,
        (organization_id, start, end),
    ).fetchall()
    return {
        **detail,
        "pages": [{"page": row["page"], "page_views": int(row["page_views"])} for row in pages],
        "users": [
            {
                **row,
                "page_views": int(row["page_views"]),
                "last_seen": row["last_seen"].isoformat() if row["last_seen"] else None,
            }
            for row in rows
        ],
    }


def client_users(conn, organization_id: str, start: date, end: date, page: int, page_size: int) -> dict | None:
    exists = conn.execute(
        "SELECT 1 FROM clients WHERE organization_id = %s",
        (organization_id,),
    ).fetchone()
    if not exists:
        return None
    total = conn.execute(
        """
        SELECT COUNT(DISTINCT user_id) AS total
        FROM usage_daily_user
        WHERE organization_id = %s AND day BETWEEN %s AND %s
        """,
        (organization_id, start, end),
    ).fetchone()["total"]
    offset = (page - 1) * page_size
    rows = conn.execute(
        """
        SELECT
          user_id::text,
          (array_agg(user_label ORDER BY last_seen DESC))[1] AS user_label,
          (array_agg(user_role ORDER BY last_seen DESC))[1] AS user_role,
          SUM(page_views) AS page_views,
          MAX(last_seen) AS last_seen,
          (array_agg(last_page ORDER BY last_seen DESC))[1] AS last_page
        FROM usage_daily_user
        WHERE organization_id = %s AND day BETWEEN %s AND %s
        GROUP BY user_id
        ORDER BY page_views DESC, user_label
        LIMIT %s OFFSET %s
        """,
        (organization_id, start, end, page_size, offset),
    ).fetchall()
    return {
        "page": page,
        "page_size": page_size,
        "total": int(total),
        "rows": [
            {
                **row,
                "page_views": int(row["page_views"]),
                "last_seen": row["last_seen"].isoformat() if row["last_seen"] else None,
            }
            for row in rows
        ],
    }
