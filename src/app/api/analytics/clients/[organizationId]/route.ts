import { NextRequest, NextResponse } from 'next/server'
import { apiErrorResponse, readAnalytics } from '@/lib/fleet'
import type { UsageClientDetail } from '@/types/analytics'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await context.params
  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')
  if (!from || !to) {
    return NextResponse.json({ error: 'from and to are required' }, { status: 400 })
  }
  try {
    const data = await readAnalytics<UsageClientDetail>(
      `/v1/usage/clients/${encodeURIComponent(organizationId)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    )
    return NextResponse.json(data)
  } catch (error) {
    const { message, status } = apiErrorResponse(error)
    return NextResponse.json({ error: message }, { status })
  }
}
