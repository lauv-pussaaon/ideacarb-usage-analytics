const PAGE_SIZE_MAX = 100

export class AnalyticsApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

function baseUrl(): string {
  const url = process.env.ANALYTICS_API_URL?.trim()
  const secret = process.env.ANALYTICS_API_SECRET?.trim()
  if (!url || !secret) {
    throw new AnalyticsApiError('Analytics API is not configured', 503)
  }
  return url.replace(/\/$/, '')
}

export async function readAnalytics<T>(path: string): Promise<T> {
  const secret = process.env.ANALYTICS_API_SECRET?.trim()
  if (!secret) {
    throw new AnalyticsApiError('Analytics API is not configured', 503)
  }
  let response: Response
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    })
  } catch {
    throw new AnalyticsApiError('Analytics API is unavailable', 502)
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const message = typeof body.error === 'string' ? body.error : 'Analytics request failed'
    throw new AnalyticsApiError(message, response.status)
  }
  return response.json() as Promise<T>
}

export function clampPageSize(value: string | null): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return 25
  return Math.min(parsed, PAGE_SIZE_MAX)
}

export function apiErrorResponse(error: unknown): { message: string; status: number } {
  const status = error instanceof AnalyticsApiError ? error.status : 502
  const message = error instanceof Error ? error.message : 'Analytics request failed'
  return { message, status }
}
