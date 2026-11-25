export const SESSION_COOKIE = 'analytics_session'

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function staffSessionToken(secret: string): Promise<string> {
  if (!secret) return ''
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('analytics-staff'))
  return hex(signed)
}

export function cookieSecure(): boolean {
  return (process.env.APP_URL || '').startsWith('https://')
}
