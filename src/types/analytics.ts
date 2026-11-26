export interface UsageSeriesPoint {
  date: string
  page_views: number
  unique_users: number
}

export interface UsageClientRow {
  organization_id: string
  code: string
  name: string
  account_type: string
  unique_users: number
  page_views: number
  last_seen: string | null
  sparkline: number[]
}

export interface UsageDirectoryEntry {
  organization_id: string
  code: string
  name: string
  account_type: string
  page_views: number
}

export interface UsageOverview {
  from: string
  to: string
  kpis: {
    active_clients: number
    unique_users: number
    page_views: number
    client_count: number
  }
  series: UsageSeriesPoint[]
  directory: UsageDirectoryEntry[]
  clients: {
    page: number
    page_size: number
    total: number
    rows: UsageClientRow[]
  }
}

export interface UsageClientDetail {
  from: string
  to: string
  client: UsageDirectoryEntry
  kpis: {
    unique_users: number
    page_views: number
    sessions: number
    last_seen: string | null
  }
  series: UsageSeriesPoint[]
  pages: { page: string; page_views: number }[]
}

export interface UsageUserRow {
  user_id: string
  user_label: string
  user_role: string
  page_views: number
  last_seen: string | null
  last_page: string
}

export interface UsageUsersPage {
  page: number
  page_size: number
  total: number
  rows: UsageUserRow[]
}

export interface UsageOverviewUserRow {
  code: string
  name: string
  user_id: string
  user_label: string
  user_role: string
  page_views: number
  last_seen: string | null
  last_page: string
}

export interface UsageOverviewExport {
  from: string
  to: string
  filters: {
    account_types: string[]
    q: string
    clients: { code: string; name: string }[]
  }
  kpis: UsageOverview['kpis']
  series: UsageSeriesPoint[]
  clients: Omit<UsageClientRow, 'sparkline'>[]
  users: UsageOverviewUserRow[]
}

export interface UsageClientExport extends UsageClientDetail {
  users: UsageUserRow[]
}
