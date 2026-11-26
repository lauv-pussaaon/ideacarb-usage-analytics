import { NextRequest, NextResponse } from 'next/server'
import { overviewFilename, overviewWorkbook, workbookResponse } from '@/lib/excel'
import { apiErrorResponse, readAnalytics } from '@/lib/fleet'
import type { UsageOverviewExport } from '@/types/analytics'

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
  })
  const accountTypes = searchParams.get('account_types')
  const organizationIds = searchParams.get('organization_ids')
  const q = searchParams.get('q')
  if (accountTypes) query.set('account_types', accountTypes)
  if (organizationIds) query.set('organization_ids', organizationIds)
  if (q) query.set('q', q)
  try {
    const data = await readAnalytics<UsageOverviewExport>(`/v1/usage/export?${query.toString()}`)
    const body = await overviewWorkbook(data)
    return workbookResponse(body, overviewFilename(from, to))
  } catch (error) {
    const { message, status } = apiErrorResponse(error)
    return NextResponse.json({ error: message }, { status })
  }
}
