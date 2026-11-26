import ExcelJS from 'exceljs'
import { formatDateTime } from '@/lib/datetime'
import { accountTypeLabel, tenantRoleLabel } from '@/lib/labels'
import type { UsageClientExport, UsageOverviewExport, UsageSeriesPoint } from '@/types/analytics'

const SHEET_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function addSheet(workbook: ExcelJS.Workbook, name: string, headers: string[], rows: (string | number)[][]) {
  const sheet = workbook.addWorksheet(name)
  sheet.addRow(headers)
  sheet.getRow(1).font = { bold: true }
  for (const row of rows) sheet.addRow(row)
  sheet.columns.forEach((column) => {
    let width = 14
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      width = Math.min(48, Math.max(width, String(cell.value ?? '').length + 2))
    })
    column.width = width
  })
}

function seriesRows(series: UsageSeriesPoint[]): (string | number)[][] {
  return series.map((point) => [point.date, point.page_views, point.unique_users])
}

function seen(value: string | null): string {
  return value ? formatDateTime(value) : '—'
}

export function overviewFilename(from: string, to: string): string {
  return `ideacarb-usage-${from}-${to}.xlsx`
}

export function clientFilename(code: string, from: string, to: string): string {
  const safe = code.replace(/[^a-zA-Z0-9_-]/g, '') || 'client'
  return `ideacarb-usage-${safe}-${from}-${to}.xlsx`
}

export async function overviewWorkbook(data: UsageOverviewExport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  addSheet(
    workbook,
    'ลูกค้า',
    ['รหัส', 'ชื่อ', 'ประเภท', 'เข้าใช้แพลตฟอร์ม', 'ผู้ใช้ไม่นับซ้ำ', 'เห็นล่าสุด'],
    data.clients.map((client) => [
      client.code,
      client.name,
      accountTypeLabel(client.account_type),
      client.page_views,
      client.unique_users,
      seen(client.last_seen),
    ])
  )
  addSheet(
    workbook,
    'ผู้ใช้',
    ['รหัส', 'ชื่อลูกค้า', 'ผู้ใช้', 'บทบาท', 'เข้าใช้แพลตฟอร์ม', 'เห็นล่าสุด', 'หน้าล่าสุด'],
    data.users.map((user) => [
      user.code,
      user.name,
      user.user_label,
      tenantRoleLabel(user.user_role),
      user.page_views,
      seen(user.last_seen),
      user.last_page,
    ])
  )
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

export async function clientWorkbook(data: UsageClientExport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  addSheet(workbook, 'รายวัน', ['วันที่', 'เข้าใช้แพลตฟอร์ม', 'ผู้ใช้ไม่นับซ้ำ'], seriesRows(data.series))
  addSheet(
    workbook,
    'หน้า',
    ['หน้า', 'เข้าใช้แพลตฟอร์ม'],
    data.pages.map((row) => [row.page, row.page_views])
  )
  addSheet(
    workbook,
    'ผู้ใช้',
    ['ผู้ใช้', 'บทบาท', 'เข้าใช้แพลตฟอร์ม', 'เห็นล่าสุด', 'หน้าล่าสุด'],
    data.users.map((user) => [
      user.user_label,
      tenantRoleLabel(user.user_role),
      user.page_views,
      seen(user.last_seen),
      user.last_page,
    ])
  )
  return Buffer.from(await workbook.xlsx.writeBuffer())
}

export function workbookResponse(body: Buffer, filename: string): Response {
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': SHEET_TYPE,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
