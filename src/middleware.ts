import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, staffSessionToken } from '@/lib/session'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const secret = process.env.AUTH_SECRET || ''
  const expected = await staffSessionToken(secret)
  const cookie = request.cookies.get(SESSION_COOKIE)?.value || ''
  const signedIn = Boolean(secret && expected && cookie === expected)

  if (pathname === '/login') {
    if (signedIn) {
      return NextResponse.redirect(new URL('/', request.url))
    }
    return NextResponse.next()
  }

  if (
    pathname === '/api/login' ||
    pathname === '/api/usage' ||
    pathname === '/api/health'
  ) {
    return NextResponse.next()
  }

  if (signedIn) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
