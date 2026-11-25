export function formatDateTime(date: string | Date | number): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  if (Number.isNaN(dateObj.getTime())) return '—'
  const day = dateObj.getDate().toString().padStart(2, '0')
  const month = dateObj.toLocaleString('th-TH', { month: 'short' })
  const year = dateObj.getFullYear()
  const hours = dateObj.getHours().toString().padStart(2, '0')
  const minutes = dateObj.getMinutes().toString().padStart(2, '0')
  return `${day} ${month} ${year} ${hours}:${minutes}`
}
