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

export function accountTypeLabel(value: string): string {
  return ACCOUNT_TYPE_LABELS[value] ?? value
}

export function tenantRoleLabel(value: string): string {
  return TENANT_ROLE_LABELS[value] ?? value
}
