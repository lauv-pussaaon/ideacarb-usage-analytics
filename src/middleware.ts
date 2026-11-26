import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, staffSessionToken } from '@/lib/session'

function redirect(request: NextRequest, pathname: string) {
  return NextResponse.redirect(new URL(pathname, process.env.APP_URL || request.url))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const secret = process.env.AUTH_SECRET || ''
  const expected = await staffSessionToken(secret)
  const cookie = request.cookies.get(SESSION_COOKIE)?.value || ''
  const signedIn = Boolean(secret && expected && cookie === expected)

  if (pathname === '/login') {
    if (signedIn) {
      return redirect(request, '/')
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
  return redirect(request, '/login')
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
