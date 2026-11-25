import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse, clampPageSize, readAnalytics } from '@/lib/fleet'
import type { UsageUsersPage } from '@/types/analytics'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await context.params
  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
  }
  const query = new URLSearchParams({
    from,
    to,
    page: searchParams.get('page') || '1',
    page_size: String(clampPageSize(searchParams.get('page_size'))),
  })
  try {
    const data = await readAnalytics<UsageUsersPage>(
      `/v1/usage/clients/${encodeURIComponent(organizationId)}/users?${query.toString()}`
    )
    return NextResponse.json(data)
  } catch (error) {
    const { message, status } = apiErrorResponse(error)
    return NextResponse.json({ error: message }, { status })
  }
}
