import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*ideacarb\.com$/i

function corsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get('origin') || ''
  const local = process.env.NODE_ENV !== 'production' && /^http:\/\/localhost(:\d+)?$/.test(origin)
  if (!ALLOWED_ORIGIN.test(origin) && !local) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

async function forward(request: NextRequest): Promise<NextResponse> {
  const base = (process.env.ANALYTICS_API_URL || 'http://127.0.0.1:8791').replace(/\/$/, '')
  const body = await request.text()
  let upstream: Response
  try {
    upstream = await fetch(`${base}/api/usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    })
  } catch {
    return NextResponse.json({ error: 'Analytics API is unavailable' }, { status: 502, headers: corsHeaders(request) })
  }
  const payload = await upstream.text()
  return new NextResponse(payload, {
    status: upstream.status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request),
    },
  })
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function POST(request: NextRequest) {
  return forward(request)
}
