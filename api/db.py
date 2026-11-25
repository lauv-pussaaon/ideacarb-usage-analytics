from __future__ import annotations

import os
from datetime import date, timedelta
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

SCHEMA_PATH = Path(__file__).with_name("schema.sql")
ZONE = "Asia/Bangkok"


def database_url() -> str:
    configured = os.environ.get("DATABASE_URL", "").strip() or os.environ.get("ANALYTICS_DATABASE_URL", "").strip()
    if configured:
        return configured
    password = os.environ.get("ANALYTICS_DB_PASSWORD", "")
    return f"postgresql://ideacarb_usage:{password}@127.0.0.1:5432/ideacarb_usage"


def connect():
    return psycopg.connect(database_url(), row_factory=dict_row)


def ensure_schema(conn) -> None:
    conn.execute(SCHEMA_PATH.read_text(encoding="utf-8"))
    today = date.today()
    start = date(today.year, today.month, 1) - timedelta(days=32)
    start = date(start.year, start.month, 1)
    for _ in range(4):
        nxt = date(start.year + (start.month == 12), 1 if start.month == 12 else start.month + 1, 1)
        name = f"usage_events_{start:%Y_%m}"
        conn.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {name}
            PARTITION OF usage_events
            FOR VALUES FROM (%s) TO (%s)
            """,
            (start, nxt),
        )
        start = nxt
    conn.commit()
