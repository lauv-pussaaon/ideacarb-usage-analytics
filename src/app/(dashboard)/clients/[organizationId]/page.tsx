'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Alert, Box, Button, Chip, CircularProgress, Paper, Typography } from '@mui/material'
import { DataGrid, type GridColDef, type GridPaginationModel } from '@mui/x-data-grid'
import Link from 'next/link'
import { ArrowBack, FileDownload, Groups, Timeline, Visibility } from '@mui/icons-material'
import UsageChart from '@/components/UsageChart'
import MetricCard from '@/components/MetricCard'
import { getUsageClient, getUsageUsers } from '@/lib/api'
import { downloadAnalyticsExport } from '@/lib/download'
import { formatDateTime } from '@/lib/datetime'
import { accountTypeColor, accountTypeLabel, tenantRoleLabel } from '@/lib/labels'
import { backButtonSx, cardSx, codeBadgeSx, dataGridPaperSx, dataGridProps, dataGridSx, pageShellSx, pageTitleSx } from '@/lib/ui'
import { DEFAULT_PRIMARY, DEFAULT_SECONDARY, SESSIONS } from '@/theme/tokens'
import type { UsageClientDetail, UsageUsersPage } from '@/types/analytics'

function defaultRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 6)
  const iso = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${month}-${day}`
  }
  return { from: iso(start), to: iso(end) }
}

export default function AnalyticsClientPage() {
  const params = useParams<{ organizationId: string }>()
  const searchParams = useSearchParams()
  const organizationId = params.organizationId
  const fallback = defaultRange()
  const from = searchParams.get('from') || fallback.from
  const to = searchParams.get('to') || fallback.to
  const [detail, setDetail] = useState<UsageClientDetail | null>(null)
  const [users, setUsers] = useState<UsageUsersPage | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!organizationId) return
    let cancelled = false
    setLoading(true)
    setMissing(false)
    Promise.all([
      getUsageClient(organizationId, new URLSearchParams({ from, to })),
      getUsageUsers(organizationId, new URLSearchParams({ from, to, page: String(page), page_size: '25' })),
    ])
      .then(([client, userPage]) => {
        if (cancelled) return
        setDetail(client)
        setUsers(userPage)
        setError(null)
      })
      .catch((err: Error) => {
        if (cancelled) return
        if (/unknown client/i.test(err.message)) setMissing(true)
        else setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [organizationId, from, to, page])

  const columns = useMemo<GridColDef[]>(() => [
    { field: 'user_label', headerName: 'ผู้ใช้', flex: 1.2, minWidth: 220 },
    {
      field: 'user_role',
      headerName: 'บทบาท',
      flex: 0.8,
      minWidth: 180,
      valueGetter: (_value, row) => tenantRoleLabel(row.user_role),
    },
    { field: 'page_views', headerName: 'เข้าใช้แพลตฟอร์ม', flex: 0.9, minWidth: 230, type: 'number' },
    {
      field: 'last_seen',
      headerName: 'เห็นล่าสุด',
      flex: 0.9,
      minWidth: 210,
      valueFormatter: (value) => (value ? formatDateTime(String(value)) : '—'),
    },
    { field: 'last_page', headerName: 'หน้าล่าสุด', flex: 1.2, minWidth: 220 },
  ], [])

  const maxPage = Math.max(...(detail?.pages.map((row) => row.page_views) ?? [1]), 1)

  async function exportExcel() {
    if (!organizationId) return
    setExporting(true)
    try {
      await downloadAnalyticsExport(
        `/api/analytics/clients/${encodeURIComponent(organizationId)}/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      )
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งออก Excel ไม่สำเร็จ')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Box sx={pageShellSx}>
      <Button component={Link} href={`/?from=${from}&to=${to}`} startIcon={<ArrowBack />} sx={backButtonSx}>
        กลับไปรายการลูกค้า
      </Button>
      {missing ? (
        <Alert severity="warning">ไม่พบลูกค้านี้ในข้อมูลการใช้งาน</Alert>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              <Typography variant="h4" sx={{ ...pageTitleSx, minWidth: 0 }}>{detail?.client.name ?? 'ลูกค้า'}</Typography>
              {detail?.client.code && <Chip label={detail.client.code} sx={{ ...codeBadgeSx, flexShrink: 0 }} />}
            </Box>
            <Button
              variant="contained"
              startIcon={exporting ? <CircularProgress size={18} color="inherit" /> : <FileDownload />}
              disabled={loading || exporting || !detail}
              onClick={() => { void exportExcel() }}
              sx={{ flexShrink: 0 }}
            >
              ส่งออก Excel
            </Button>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            {detail && (
              <Chip
                label={accountTypeLabel(detail.client.account_type)}
                sx={{
                  fontWeight: 700,
                  color: '#fff',
                  bgcolor: accountTypeColor(detail.client.account_type),
                }}
              />
            )}
            <Typography variant="body1" color="text.secondary">{`${from} – ${to}`}</Typography>
          </Box>
          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
            <MetricCard label="ผู้ใช้ไม่นับซ้ำ" value={detail?.kpis.unique_users} note="ผู้ใช้ที่เข้าสู่ระบบในช่วงนี้" color={DEFAULT_SECONDARY} icon={<Groups />} loading={loading && !detail} />
            <MetricCard label="เข้าใช้แพลตฟอร์ม" value={detail?.kpis.page_views} note="รวมทุกหน้าของลูกค้านี้" color={DEFAULT_PRIMARY.main} icon={<Visibility />} loading={loading && !detail} />
            <MetricCard label="เซสชัน" value={detail?.kpis.sessions} note="เซสชันหมดอายุเมื่อว่าง 30 นาที" color={SESSIONS} icon={<Timeline />} loading={loading && !detail} />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.4fr 0.8fr' }, gap: 2, mb: 3 }}>
            <Paper elevation={0} sx={{ ...cardSx, p: 2.5 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>การใช้งานรายวันของลูกค้านี้</Typography>
              {loading && !detail ? <CircularProgress size={28} /> : detail?.series.length ? <UsageChart series={detail.series} /> : <Alert severity="info">ไม่มีข้อมูลในช่วงนี้</Alert>}
            </Paper>
            <Paper elevation={0} sx={{ ...cardSx, p: 2.5 }}>
              <Typography variant="h6">หน้าที่มีคนเข้ามาก</Typography>
              <Typography variant="caption" color="text.secondary">
                รวม {Number(detail?.kpis.page_views ?? 0).toLocaleString('en-US')} ครั้ง
              </Typography>
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {(detail?.pages ?? []).map((row) => (
                  <Box key={row.page}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }} noWrap>{row.page}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.page_views.toLocaleString('en-US')}</Typography>
                    </Box>
                    <Box sx={{ mt: 0.5, height: 8, bgcolor: 'action.hover', borderRadius: 1 }}>
                      <Box sx={{ width: `${(row.page_views / maxPage) * 100}%`, height: '100%', bgcolor: 'primary.main', borderRadius: 1 }} />
                    </Box>
                  </Box>
                ))}
                {!loading && (detail?.pages.length ?? 0) === 0 && (
                  <Typography variant="body2" color="text.secondary">ไม่มีข้อมูลในช่วงนี้</Typography>
                )}
              </Box>
            </Paper>
          </Box>
          <Paper elevation={0} sx={dataGridPaperSx}>
            <DataGrid
              {...dataGridProps}
              rows={users?.rows ?? []}
              columns={columns}
              getRowId={(row) => row.user_id}
              loading={loading}
              rowCount={users?.total ?? 0}
              paginationMode="server"
              paginationModel={{ page: page - 1, pageSize: 25 }}
              onPaginationModelChange={(model: GridPaginationModel) => setPage(model.page + 1)}
              pageSizeOptions={[25]}
              disableRowSelectionOnClick
              sx={dataGridSx}
              localeText={{
                noRowsLabel: 'ไม่มีผู้ใช้ในช่วงนี้',
                paginationDisplayedRows: ({ from: start, to: end, count }) => `แสดง ${start}–${end} จาก ${count}`,
              }}
            />
          </Paper>
        </>
      )}
    </Box>
  )
}
