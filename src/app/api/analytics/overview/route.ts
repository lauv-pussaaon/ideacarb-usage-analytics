import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse, clampPageSize, readAnalytics } from '@/lib/fleet'
import type { UsageOverview } from '@/types/analytics'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
  }
  const query = new URLSearchParams({
    from,
    to,
    sort: searchParams.get('sort') || 'page_views',
    page: searchParams.get('page') || '1',
    page_size: String(clampPageSize(searchParams.get('page_size'))),
  })
  const accountTypes = searchParams.get('account_types')
  const organizationIds = searchParams.get('organization_ids')
  const q = searchParams.get('q')
  if (accountTypes) query.set('account_types', accountTypes)
  if (organizationIds) query.set('organization_ids', organizationIds)
  if (q) query.set('q', q)
  try {
    const data = await readAnalytics<UsageOverview>(`/v1/usage/overview?${query.toString()}`)
    return NextResponse.json(data)
  } catch (error) {
    const { message, status } = apiErrorResponse(error)
    return NextResponse.json({ error: message }, { status })
  }
}
