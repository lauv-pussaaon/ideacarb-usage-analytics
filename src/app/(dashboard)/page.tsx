'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Alert,
  Autocomplete,
  Box,
  Chip,
  CircularProgress,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { DataGrid, type GridColDef, type GridPaginationModel, type GridSortModel } from '@mui/x-data-grid'
import { getUsageOverview } from '@/lib/api'
import { formatDateTime } from '@/lib/datetime'
import { ACCOUNT_TYPES, accountTypeLabel } from '@/lib/labels'
import { dataGridPaperSx, dataGridProps, dataGridSx, filterControlSx, kpiValueSx, pageShellSx, pageTitleSx, quietChipSx, searchFieldSx } from '@/lib/ui'
import type { UsageOverview } from '@/types/analytics'
import UsageChart from '@/components/UsageChart'
import Sparkline from '@/components/Sparkline'

type Preset = 'today' | '7' | '30' | 'custom'

function localDate(offsetDays = 0): string {
  const date = new Date()
  date.setDate(date.getDate() - offsetDays)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function rangeFor(preset: Preset, customFrom: string, customTo: string): { from: string; to: string } {
  const today = localDate(0)
  if (preset === 'today') return { from: today, to: today }
  if (preset === '7') return { from: localDate(6), to: today }
  if (preset === '30') return { from: localDate(29), to: today }
  return { from: customFrom, to: customTo }
}

export default function AnalyticsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialFrom = searchParams.get('from')
  const initialTo = searchParams.get('to')
  const [preset, setPreset] = useState<Preset>(initialFrom && initialTo ? 'custom' : '7')
  const [customFrom, setCustomFrom] = useState(initialFrom || localDate(6))
  const [customTo, setCustomTo] = useState(initialTo || localDate(0))
  const [accountTypes, setAccountTypes] = useState<string[]>([])
  const [organizationIds, setOrganizationIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState('page_views')
  const [data, setData] = useState<UsageOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const range = rangeFor(preset, customFrom, customTo)

  useEffect(() => {
    const handle = setTimeout(() => {
      setAppliedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(handle)
  }, [search])

  useEffect(() => {
    let cancelled = false
    const query = new URLSearchParams({
      from: range.from,
      to: range.to,
      sort,
      page: String(page),
      page_size: '25',
    })
    if (accountTypes.length) query.set('account_types', accountTypes.join(','))
    if (organizationIds.length) query.set('organization_ids', organizationIds.join(','))
    if (appliedSearch) query.set('q', appliedSearch)

    setLoading(true)
    getUsageOverview(query)
      .then((payload) => {
        if (!cancelled) {
          setData(payload)
          setError(null)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [range.from, range.to, accountTypes, organizationIds, appliedSearch, page, sort])

  const columns = useMemo<GridColDef[]>(() => [
    {
      field: 'name',
      headerName: 'ลูกค้า',
      flex: 1.6,
      minWidth: 280,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{params.row.name}</Typography>
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{params.row.code}</Typography>
        </Box>
      ),
    },
    {
      field: 'account_type',
      headerName: 'ประเภท',
      flex: 0.8,
      minWidth: 160,
      sortable: false,
      valueGetter: (_value, row) => accountTypeLabel(row.account_type),
    },
    { field: 'unique_users', headerName: 'ผู้ใช้ไม่ซ้ำ', flex: 0.7, minWidth: 150, type: 'number' },
    { field: 'page_views', headerName: 'เข้าชมหน้า', flex: 0.7, minWidth: 150, type: 'number' },
    {
      field: 'last_seen',
      headerName: 'เห็นล่าสุด',
      flex: 0.9,
      minWidth: 200,
      valueFormatter: (value) => (value ? formatDateTime(String(value)) : '—'),
    },
    {
      field: 'sparkline',
      headerName: '7 วันล่าสุด',
      flex: 0.7,
      minWidth: 160,
      sortable: false,
      renderCell: (params) => <Sparkline values={params.row.sparkline ?? []} />,
    },
  ], [])

  const selectedClients = (data?.directory ?? []).filter((entry) => organizationIds.includes(entry.organization_id))

  return (
    <Box sx={pageShellSx}>
      <Typography variant="h4" sx={pageTitleSx}>วิเคราะห์การใช้งานลูกค้า</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        ตัวกรองมีผลกับตัวเลข กราฟ และตารางทั้งหน้า
      </Typography>

      <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 3, alignItems: 'start' }}>
          <Box>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 1.5 }}>ช่วงเวลา</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
              <ToggleButtonGroup
                exclusive
                value={preset}
                onChange={(_event, value: Preset | null) => {
                  if (!value) return
                  setPreset(value)
                  setPage(1)
                }}
              >
                <ToggleButton value="today">วันนี้</ToggleButton>
                <ToggleButton value="7">7 วัน</ToggleButton>
                <ToggleButton value="30">30 วัน</ToggleButton>
                <ToggleButton value="custom">กำหนดเอง</ToggleButton>
              </ToggleButtonGroup>
              {preset === 'custom' && (
                <>
                  <TextField type="date" value={customFrom} onChange={(event) => { setCustomFrom(event.target.value); setPage(1) }} sx={filterControlSx} />
                  <TextField type="date" value={customTo} onChange={(event) => { setCustomTo(event.target.value); setPage(1) }} sx={filterControlSx} />
                </>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Autocomplete
              multiple
              options={data?.directory ?? []}
              value={selectedClients}
              getOptionLabel={(option) => `${option.name} (${option.code})`}
              isOptionEqualToValue={(option, value) => option.organization_id === value.organization_id}
              onChange={(_event, value) => {
                setOrganizationIds(value.map((entry) => entry.organization_id))
                setPage(1)
              }}
              sx={filterControlSx}
              renderInput={(params) => <TextField {...params} label="ลูกค้า" placeholder="ทุกลูกค้าในกลุ่ม" />}
            />
            <TextField
              label="ค้นหา"
              placeholder="ค้นหารหัสหรือชื่อ"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={searchFieldSx}
            />
          </Box>
        </Box>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 3, mb: 1.5 }}>กลุ่มประเภท</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
          <Chip
            label="ทั้งหมด"
            color={accountTypes.length === 0 ? 'primary' : 'default'}
            variant={accountTypes.length === 0 ? 'filled' : 'outlined'}
            onClick={() => { setAccountTypes([]); setPage(1) }}
            sx={quietChipSx}
          />
          {ACCOUNT_TYPES.map((value) => {
            const selected = accountTypes.includes(value)
            return (
              <Chip
                key={value}
                label={accountTypeLabel(value)}
                color={selected ? 'primary' : 'default'}
                variant={selected ? 'filled' : 'outlined'}
                onClick={() => {
                  setAccountTypes((current) => selected ? current.filter((item) => item !== value) : [...current, value])
                  setPage(1)
                }}
                sx={quietChipSx}
              />
            )
          })}
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
        {[
          ['ลูกค้าที่ใช้งาน', data?.kpis.active_clients, `จาก ${data?.kpis.client_count ?? 0} ลูกค้าในกลุ่ม`],
          ['ผู้ใช้ไม่ซ้ำ', data?.kpis.unique_users, 'ผู้ใช้ที่เข้าสู่ระบบ'],
          ['เข้าชมหน้า', data?.kpis.page_views, 'รวมทุกหน้าของลูกค้าในกลุ่ม'],
        ].map(([label, value, note]) => (
          <Paper key={String(label)} elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Typography variant="body1" color="text.secondary">{label}</Typography>
            <Typography sx={kpiValueSx}>
              {loading && !data ? '—' : Number(value ?? 0).toLocaleString('en-US')}
            </Typography>
            <Typography variant="body1" color="text.secondary">{note}</Typography>
          </Paper>
        ))}
      </Box>

      <Paper elevation={0} sx={{ p: 2.5, mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>การใช้งานรายวัน</Typography>
        {loading && !data ? <CircularProgress size={28} /> : data?.series.length ? <UsageChart series={data.series} /> : <Alert severity="info">ไม่มีข้อมูลในช่วงนี้</Alert>}
      </Paper>

      <Paper elevation={0} sx={dataGridPaperSx}>
        <DataGrid
          {...dataGridProps}
          rows={data?.clients.rows ?? []}
          columns={columns}
          getRowId={(row) => row.organization_id}
          loading={loading}
          rowCount={data?.clients.total ?? 0}
          paginationMode="server"
          sortingMode="server"
          paginationModel={{ page: page - 1, pageSize: 25 }}
          onPaginationModelChange={(model: GridPaginationModel) => setPage(model.page + 1)}
          sortModel={[{ field: sort, sort: 'desc' }]}
          onSortModelChange={(model: GridSortModel) => {
            const field = model[0]?.field
            if (field === 'page_views' || field === 'unique_users' || field === 'last_seen') {
              setSort(field)
              setPage(1)
            }
          }}
          pageSizeOptions={[25]}
          disableRowSelectionOnClick
          onRowClick={(params) => {
            router.push(`/clients/${params.row.organization_id}?from=${range.from}&to=${range.to}`)
          }}
          sx={{ ...dataGridSx, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
          localeText={{
            noRowsLabel: 'ไม่มีข้อมูลในช่วงนี้',
            paginationDisplayedRows: ({ from, to, count }) => `แสดง ${from}–${to} จาก ${count}`,
          }}
        />
      </Paper>
    </Box>
  )
}
