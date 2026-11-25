CREATE TABLE IF NOT EXISTS clients (
  organization_id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'annual_member',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_events (
  id BIGSERIAL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  organization_id UUID NOT NULL,
  instance_code TEXT NOT NULL,
  user_id UUID NOT NULL,
  user_label TEXT NOT NULL,
  user_role TEXT NOT NULL,
  page TEXT NOT NULL,
  session_id TEXT,
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE IF NOT EXISTS usage_events_default PARTITION OF usage_events DEFAULT;

CREATE TABLE IF NOT EXISTS usage_daily (
  day DATE NOT NULL,
  organization_id UUID NOT NULL REFERENCES clients (organization_id),
  page_views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, organization_id)
);

CREATE TABLE IF NOT EXISTS usage_daily_user (
  day DATE NOT NULL,
  organization_id UUID NOT NULL REFERENCES clients (organization_id),
  user_id UUID NOT NULL,
  user_label TEXT NOT NULL,
  user_role TEXT NOT NULL,
  page_views INTEGER NOT NULL DEFAULT 0,
  last_page TEXT NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (day, organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS usage_daily_page (
  day DATE NOT NULL,
  organization_id UUID NOT NULL REFERENCES clients (organization_id),
  page TEXT NOT NULL,
  page_views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, organization_id, page)
);

CREATE TABLE IF NOT EXISTS usage_daily_session (
  day DATE NOT NULL,
  organization_id UUID NOT NULL REFERENCES clients (organization_id),
  session_id TEXT NOT NULL,
  PRIMARY KEY (day, organization_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_usage_daily_user_org_day
  ON usage_daily_user (organization_id, day);
CREATE INDEX IF NOT EXISTS idx_usage_daily_page_org_day
  ON usage_daily_page (organization_id, day);
