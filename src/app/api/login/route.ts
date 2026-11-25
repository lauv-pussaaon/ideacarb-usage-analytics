import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, cookieSecure, staffSessionToken } from '@/lib/session'

function same(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const username = typeof body?.username === 'string' ? body.username : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const expectedUser = process.env.STAFF_USERNAME || ''
  const expectedPassword = process.env.STAFF_PASSWORD || ''
  const secret = process.env.AUTH_SECRET || ''
  if (!expectedUser || !expectedPassword || !secret || !same(username, expectedUser) || !same(password, expectedPassword)) {
    return NextResponse.json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 })
  }
  const token = await staffSessionToken(secret)
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(),
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  })
  return response
}
