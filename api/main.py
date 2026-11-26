from __future__ import annotations

import os
import secrets
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from uuid import UUID

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from db import connect, ensure_schema
from store import (
    ACCOUNT_TYPES,
    client_detail,
    client_export,
    client_users,
    overview,
    overview_export,
    record_event,
    upsert_client,
)

ROOT = Path(__file__).resolve().parent.parent


def load_deploy_env(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        if not key:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ.setdefault(key, value)


load_deploy_env(ROOT / ".env.local")
load_deploy_env(ROOT / "deploy" / "deploy.env")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    with connect() as conn:
        ensure_schema(conn)
    yield


app = FastAPI(title="IdeaCarb analytics", version="1.0.0", lifespan=lifespan)


@app.exception_handler(HTTPException)
async def http_error(_request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


def require_secret(
    authorization: str | None = Header(default=None),
    x_analytics_secret: str | None = Header(default=None),
) -> None:
    secret = os.environ.get("ANALYTICS_API_SECRET", "")
    if not secret:
        raise HTTPException(status_code=503, detail="ANALYTICS_API_SECRET is not set")
    token = ""
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not secrets.compare_digest(token, secret) and not (
        x_analytics_secret and secrets.compare_digest(x_analytics_secret, secret)
    ):
        raise HTTPException(status_code=401, detail="Unauthorized")


class ClientBody(BaseModel):
    organization_id: UUID
    code: str = Field(min_length=1, max_length=80)
    name: str | None = Field(default=None, max_length=200)
    account_type: str | None = None


class UsageBody(BaseModel):
    organization_id: UUID
    user_id: UUID
    user_label: str = Field(min_length=1, max_length=200)
    user_role: str = Field(min_length=1, max_length=80)
    page: str = Field(min_length=1, max_length=500)
    session_id: str | None = Field(default=None, max_length=80)


def parse_day(value: str, name: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{name} must be YYYY-MM-DD") from exc


def date_range(start_value: str, end_value: str) -> tuple[date, date]:
    start = parse_day(start_value, "from")
    end = parse_day(end_value, "to")
    if end < start:
        raise HTTPException(status_code=400, detail="to is before from")
    if (end - start).days > 366:
        raise HTTPException(status_code=400, detail="range is longer than 366 days")
    return start, end


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/v1/clients")
def post_client(body: ClientBody, _: None = Depends(require_secret)) -> dict:
    if body.account_type and body.account_type not in ACCOUNT_TYPES:
        raise HTTPException(status_code=400, detail="unknown account_type")
    with connect() as conn:
        upsert_client(
            conn,
            str(body.organization_id),
            body.code.strip(),
            body.name.strip() if body.name else None,
            body.account_type,
        )
        conn.commit()
    return {"ok": True}


@app.post("/api/usage")
def post_usage(body: UsageBody) -> dict:
    event = {
        "organization_id": str(body.organization_id),
        "user_id": str(body.user_id),
        "user_label": body.user_label.strip(),
        "user_role": body.user_role.strip(),
        "page": body.page.strip(),
        "session_id": body.session_id.strip() if body.session_id else None,
    }
    with connect() as conn:
        accepted = record_event(conn, event)
        if not accepted:
            conn.rollback()
            raise HTTPException(status_code=404, detail="unknown client")
        conn.commit()
    return {"ok": True}


def usage_filters(
    from_: str | None,
    to: str | None,
    account_types: str | None,
    organization_ids: str | None,
    q: str | None,
) -> tuple[date, date, list[str] | None, list[str] | None, str | None]:
    if not from_ or not to:
        raise HTTPException(status_code=400, detail="from and to are required")
    start, end = date_range(from_, to)
    types = [part.strip() for part in (account_types or "").split(",") if part.strip()]
    if any(part not in ACCOUNT_TYPES for part in types):
        raise HTTPException(status_code=400, detail="unknown account_type")
    org_ids = [part.strip() for part in (organization_ids or "").split(",") if part.strip()]
    for org_id in org_ids:
        parse_uuid(org_id)
    return start, end, types or None, org_ids or None, (q or "").strip() or None


@app.get("/v1/usage/overview")
def get_overview(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    account_types: str | None = None,
    organization_ids: str | None = None,
    q: str | None = None,
    sort: str = "page_views",
    page: int = 1,
    page_size: int = 25,
    _: None = Depends(require_secret),
) -> dict:
    start, end, types, org_ids, query = usage_filters(from_, to, account_types, organization_ids, q)
    if page < 1 or page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="invalid page")
    with connect() as conn:
        return overview(conn, start, end, types, org_ids, query, sort, page, page_size)


@app.get("/v1/usage/export")
def get_overview_export(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    account_types: str | None = None,
    organization_ids: str | None = None,
    q: str | None = None,
    sort: str = "page_views",
    _: None = Depends(require_secret),
) -> dict:
    start, end, types, org_ids, query = usage_filters(from_, to, account_types, organization_ids, q)
    with connect() as conn:
        return overview_export(conn, start, end, types, org_ids, query, sort)


@app.get("/v1/usage/clients/{organization_id}")
def get_client(
    organization_id: str,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    _: None = Depends(require_secret),
) -> dict:
    parse_uuid(organization_id)
    if not from_ or not to:
        raise HTTPException(status_code=400, detail="from and to are required")
    start, end = date_range(from_, to)
    with connect() as conn:
        payload = client_detail(conn, organization_id, start, end)
    if not payload:
        raise HTTPException(status_code=404, detail="unknown client")
    return payload


@app.get("/v1/usage/clients/{organization_id}/users")
def get_client_users(
    organization_id: str,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    page: int = 1,
    page_size: int = 25,
    _: None = Depends(require_secret),
) -> dict:
    parse_uuid(organization_id)
    if not from_ or not to:
        raise HTTPException(status_code=400, detail="from and to are required")
    start, end = date_range(from_, to)
    if page < 1 or page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="invalid page")
    with connect() as conn:
        payload = client_users(conn, organization_id, start, end, page, page_size)
    if not payload:
        raise HTTPException(status_code=404, detail="unknown client")
    return payload


@app.get("/v1/usage/clients/{organization_id}/export")
def get_client_export(
    organization_id: str,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = None,
    _: None = Depends(require_secret),
) -> dict:
    parse_uuid(organization_id)
    if not from_ or not to:
        raise HTTPException(status_code=400, detail="from and to are required")
    start, end = date_range(from_, to)
    with connect() as conn:
        payload = client_export(conn, organization_id, start, end)
    if not payload:
        raise HTTPException(status_code=404, detail="unknown client")
    return payload


def parse_uuid(value: str) -> None:
    try:
        UUID(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="organization_id must be a UUID") from exc
