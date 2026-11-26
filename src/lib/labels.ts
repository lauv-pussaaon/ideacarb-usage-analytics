export const ACCOUNT_TYPES = [
  'annual_member',
  'trial',
  'demo',
  'internal',
  'employee',
  'project',
] as const

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  annual_member: 'สมาชิกรายปี',
  trial: 'ทดลองใช้งาน',
  demo: 'เดโม',
  internal: 'ภายใน',
  employee: 'พนักงาน',
  project: 'โปรเจกต์',
}

export const TENANT_ROLE_LABELS: Record<string, string> = {
  'Factory Admin': 'ผู้ดูแลโรงงาน',
  User: 'ผู้ใช้',
  'Internal Audit': 'ผู้ตรวจภายใน',
  Sub: 'ผู้รับเหมา',
  Consult: 'ที่ปรึกษา',
  Audit: 'ผู้ทวนสอบ',
}

export const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  annual_member: '#10b981',
  trial: '#f59e0b',
  demo: '#3b82f6',
  internal: '#8b5cf6',
  employee: '#0ea5e9',
  project: '#f43f5e',
}

export function accountTypeLabel(value: string): string {
  return ACCOUNT_TYPE_LABELS[value] ?? value
}

export function accountTypeColor(value: string): string {
  return ACCOUNT_TYPE_COLORS[value] ?? '#64748b'
}

export function tenantRoleLabel(value: string): string {
  return TENANT_ROLE_LABELS[value] ?? value
}
