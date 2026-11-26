export async function downloadAnalyticsExport(path: string): Promise<void> {
  const response = await fetch(path)
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const message = typeof body.error === 'string' ? body.error : 'ส่งออก Excel ไม่สำเร็จ'
    throw new Error(message)
  }
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const match = /filename="([^"]+)"/.exec(disposition)
  const filename = match?.[1] || 'ideacarb-usage.xlsx'
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
