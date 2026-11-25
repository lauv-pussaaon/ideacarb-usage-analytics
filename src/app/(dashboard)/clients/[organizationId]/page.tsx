'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Alert, Box, Button, CircularProgress, Paper, Typography } from '@mui/material'
import { DataGrid, type GridColDef, type GridPaginationModel } from '@mui/x-data-grid'
import Link from 'next/link'
import { ArrowBack } from '@mui/icons-material'
import UsageChart from '@/components/UsageChart'
import { getUsageClient, getUsageUsers } from '@/lib/api'
import { formatDateTime } from '@/lib/datetime'
import { accountTypeLabel, tenantRoleLabel } from '@/lib/labels'
import { backButtonSx, dataGridPaperSx, dataGridProps, dataGridSx, pageShellSx, pageTitleSx } from '@/lib/ui'
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
    { field: 'user_label', headerName: 'ผู้ใช้', flex: 1, minWidth: 180 },
    {
      field: 'user_role',
      headerName: 'บทบาท',
      width: 160,
      valueGetter: (_value, row) => tenantRoleLabel(row.user_role),
    },
    { field: 'page_views', headerName: 'เข้าชมหน้า', width: 130, type: 'number' },
    {
      field: 'last_seen',
      headerName: 'เห็นล่าสุด',
      width: 190,
      valueFormatter: (value) => (value ? formatDateTime(String(value)) : '—'),
    },
    { field: 'last_page', headerName: 'หน้าล่าสุด', flex: 1, minWidth: 180 },
  ], [])

  const maxPage = Math.max(...(detail?.pages.map((row) => row.page_views) ?? [1]), 1)

  return (
    <Box sx={pageShellSx}>
      <Button component={Link} href={`/?from=${from}&to=${to}`} startIcon={<ArrowBack />} sx={backButtonSx}>
        กลับไปรายการลูกค้า
      </Button>
      {missing ? (
        <Alert severity="warning">ไม่พบลูกค้านี้ในข้อมูลการใช้งาน</Alert>
      ) : (
        <>
          <Typography variant="h4" sx={pageTitleSx}>{detail?.client.name ?? 'ลูกค้า'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            <Box component="span" sx={{ fontFamily: 'monospace', mr: 1 }}>{detail?.client.code}</Box>
            {detail ? accountTypeLabel(detail.client.account_type) : ''}
            {` · ${from} – ${to}`}
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
            {[
              ['ผู้ใช้ไม่ซ้ำ', detail?.kpis.unique_users, 'ผู้ใช้ที่เข้าสู่ระบบในช่วงนี้'],
              ['เข้าชมหน้า', detail?.kpis.page_views, 'รวมทุกหน้าของลูกค้านี้'],
              ['เซสชัน', detail?.kpis.sessions, 'เซสชันหมดอายุเมื่อว่าง 30 นาที'],
            ].map(([label, value, note]) => (
              <Paper key={String(label)} elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="body2" color="text.secondary">{label}</Typography>
                <Typography variant="h4" sx={{ fontWeight: 600, my: 0.5 }}>
                  {loading && !detail ? '—' : Number(value ?? 0).toLocaleString('en-US')}
                </Typography>
                <Typography variant="caption" color="text.secondary">{note}</Typography>
              </Paper>
            ))}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.4fr 0.8fr' }, gap: 2, mb: 3 }}>
            <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>การใช้งานรายวันของลูกค้านี้</Typography>
              {loading && !detail ? <CircularProgress size={28} /> : detail?.series.length ? <UsageChart series={detail.series} /> : <Alert severity="info">ไม่มีข้อมูลในช่วงนี้</Alert>}
            </Paper>
            <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
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
