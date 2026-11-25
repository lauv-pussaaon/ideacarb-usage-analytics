import type { UsageClientDetail, UsageOverview, UsageUsersPage } from '@/types/analytics'

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof body.error === 'string' ? body.error : 'โหลดข้อมูลการใช้งานไม่สำเร็จ'
    throw new Error(message)
  }
  return body as T
}

export async function getUsageOverview(query: URLSearchParams): Promise<UsageOverview> {
  const response = await fetch(`/api/analytics/overview?${query.toString()}`)
  return readJson(response)
}

export async function getUsageClient(organizationId: string, query: URLSearchParams): Promise<UsageClientDetail> {
  const response = await fetch(`/api/analytics/clients/${encodeURIComponent(organizationId)}?${query.toString()}`)
  return readJson(response)
}

export async function getUsageUsers(organizationId: string, query: URLSearchParams): Promise<UsageUsersPage> {
  const response = await fetch(`/api/analytics/clients/${encodeURIComponent(organizationId)}/users?${query.toString()}`)
  return readJson(response)
}
