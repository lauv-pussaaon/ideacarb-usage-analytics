'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  ListSubheader,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { FileDownload, Groups, Visibility, Business } from '@mui/icons-material'
import { DataGrid, type GridColDef, type GridPaginationModel, type GridSortModel } from '@mui/x-data-grid'
import { getUsageOverview } from '@/lib/api'
import { downloadAnalyticsExport } from '@/lib/download'
import { formatDateTime } from '@/lib/datetime'
import { ACCOUNT_TYPES, accountTypeColor, accountTypeLabel } from '@/lib/labels'
import { cardSx, codeBadgeSx, dataGridPaperSx, dataGridProps, dataGridSx, filterControlSx, pageShellSx, pageTitleSx, pillGroupSx, quietChipSx, searchFieldSx } from '@/lib/ui'
import { ACTIVE_CLIENTS, DEFAULT_PRIMARY, DEFAULT_SECONDARY } from '@/theme/tokens'
import type { UsageOverview } from '@/types/analytics'
import UsageChart from '@/components/UsageChart'
import MetricCard from '@/components/MetricCard'
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
  const [exporting, setExporting] = useState(false)
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
        <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', lineHeight: 1.3 }}>
          {params.row.name}
        </Typography>
      ),
    },
    {
      field: 'code',
      headerName: 'รหัส',
      flex: 0.7,
      minWidth: 160,
      sortable: false,
      renderCell: (params) => <Chip label={params.row.code} sx={codeBadgeSx} />,
    },
    {
      field: 'account_type',
      headerName: 'ประเภท',
      flex: 0.8,
      minWidth: 170,
      sortable: false,
      renderCell: (params) => {
        const color = accountTypeColor(params.row.account_type)
        return (
          <Chip
            label={accountTypeLabel(params.row.account_type)}
            sx={{ ...quietChipSx, height: 36, color, bgcolor: `${color}22`, border: 'none' }}
          />
        )
      },
    },
    { field: 'unique_users', headerName: 'ผู้ใช้ไม่นับซ้ำ', flex: 0.8, minWidth: 190, type: 'number' },
    { field: 'page_views', headerName: 'เข้าใช้แพลตฟอร์ม', flex: 0.9, minWidth: 230, type: 'number' },
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
  const clientCount = data?.kpis.client_count ?? 0
  const activeClients = data?.kpis.active_clients ?? 0
  const activeShare = clientCount > 0 ? Math.round((activeClients / clientCount) * 100) : 0

  async function exportExcel() {
    setExporting(true)
    const query = new URLSearchParams({
      from: range.from,
      to: range.to,
      sort,
    })
    if (accountTypes.length) query.set('account_types', accountTypes.join(','))
    if (organizationIds.length) query.set('organization_ids', organizationIds.join(','))
    if (appliedSearch) query.set('q', appliedSearch)
    try {
      await downloadAnalyticsExport(`/api/analytics/export?${query.toString()}`)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งออก Excel ไม่สำเร็จ')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Box sx={pageShellSx}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1 }}>
        <Typography variant="h4" sx={pageTitleSx}>วิเคราะห์การใช้งานลูกค้า</Typography>
        <Button
          variant="contained"
          startIcon={exporting ? <CircularProgress size={18} color="inherit" /> : <FileDownload />}
          disabled={loading || exporting}
          onClick={() => { void exportExcel() }}
          sx={{ flexShrink: 0 }}
        >
          ส่งออก Excel
        </Button>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        ตัวกรองมีผลกับตัวเลข กราฟ และตารางทั้งหน้า
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Paper elevation={0} sx={{ ...cardSx, p: 3, mb: 3, width: '100%', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box>
          <Typography color="text.secondary" sx={{ mb: 1.5 }}>ช่วงเวลา</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
            <ToggleButtonGroup
              exclusive
              value={preset}
              onChange={(_event, value: Preset | null) => {
                if (!value) return
                setPreset(value)
                setPage(1)
              }}
              sx={pillGroupSx}
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
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <Autocomplete
            multiple
            options={data?.directory ?? []}
            value={selectedClients}
            getOptionLabel={(option) => `${option.name} (${option.code})`}
            isOptionEqualToValue={(option, value) => option.organization_id === value.organization_id}
            groupBy={(option) => option.page_views > 0 ? 'มีการใช้งานในช่วงที่เลือก' : 'ไม่มีการใช้งานในช่วงที่เลือก'}
            componentsProps={{
              popper: {
                placement: 'bottom-start',
                sx: { width: 'auto !important', minWidth: 'min(760px, calc(100vw - 32px))' },
              },
            }}
            renderGroup={(params) => {
              const active = params.group === 'มีการใช้งานในช่วงที่เลือก'
              return (
                <li key={params.key}>
                  <ListSubheader
                    component="div"
                    sx={{
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      lineHeight: 1.4,
                      whiteSpace: 'nowrap',
                      color: active ? '#047857' : '#475569',
                      bgcolor: active ? '#d1fae5' : '#e2e8f0',
                    }}
                  >
                    {params.group}
                  </ListSubheader>
                  <ul style={{ padding: 0 }}>{params.children}</ul>
                </li>
              )
            }}
            renderOption={(props, option) => (
              <li {...props}>
                <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 2, minWidth: 0 }}>
                  <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {option.name} ({option.code})
                  </Box>
                  <Typography component="span" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {option.page_views.toLocaleString('en-US')}
                  </Typography>
                </Box>
              </li>
            )}
            onChange={(_event, value) => {
              setOrganizationIds(value.map((entry) => entry.organization_id))
              setPage(1)
            }}
            sx={{
              ...filterControlSx,
              '& .MuiChip-root': {
                height: 'auto',
                fontSize: '1.05rem',
                fontWeight: 600,
                borderRadius: 1.5,
                '& .MuiChip-label': { fontSize: '1.05rem', lineHeight: 1.4, py: 0.65, px: 1.25 },
                '& .MuiChip-deleteIcon': { fontSize: '1.4rem' },
              },
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="ลูกค้า"
                placeholder={selectedClients.length === 0 ? 'ทุกลูกค้าในกลุ่ม' : ''}
              />
            )}
          />
          <TextField
            label="ค้นหา"
            placeholder="ค้นหารหัสหรือชื่อ"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={searchFieldSx}
          />
        </Box>
        <Box>
          <Typography color="text.secondary" sx={{ mb: 1.5 }}>กลุ่มประเภท</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
            <Chip
              label="ทั้งหมด"
              variant={accountTypes.length === 0 ? 'filled' : 'outlined'}
              color={accountTypes.length === 0 ? 'primary' : 'default'}
              onClick={() => { setAccountTypes([]); setPage(1) }}
              sx={quietChipSx}
            />
            {ACCOUNT_TYPES.map((value) => {
              const selected = accountTypes.includes(value)
              const color = accountTypeColor(value)
              return (
                <Chip
                  key={value}
                  label={accountTypeLabel(value)}
                  onClick={() => {
                    setAccountTypes((current) => selected ? current.filter((item) => item !== value) : [...current, value])
                    setPage(1)
                  }}
                  sx={{
                    ...quietChipSx,
                    color: selected ? '#fff' : color,
                    bgcolor: selected ? color : `${color}18`,
                    border: 'none',
                    '&:hover': { bgcolor: selected ? color : `${color}28` },
                  }}
                />
              )
            })}
          </Box>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ ...cardSx, p: 3, mb: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'auto 1fr' }, gap: 3, alignItems: 'center' }}>
        <Box>
          <Typography color="text.secondary">เข้าใช้แพลตฟอร์ม</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: '4.25rem', lineHeight: 1, letterSpacing: '-0.04em', color: DEFAULT_PRIMARY.main, my: 1 }}>
            {loading && !data ? '—' : Number(data?.kpis.page_views ?? 0).toLocaleString('en-US')}
          </Typography>
          <Typography sx={{ fontWeight: 700, color: ACTIVE_CLIENTS }}>
            {loading && !data ? '—' : `${activeClients.toLocaleString('en-US')} จาก ${clientCount.toLocaleString('en-US')} ลูกค้าที่ใช้งาน`}
          </Typography>
        </Box>
        <Box sx={{ height: 22, borderRadius: 999, bgcolor: 'grey.100', overflow: 'hidden', alignSelf: 'center' }}>
          <Box
            sx={{
              width: `${activeShare}%`,
              height: '100%',
              borderRadius: 999,
              background: 'linear-gradient(90deg, #fb7185 0%, #fbbf24 48%, #34d399 100%)',
            }}
          />
        </Box>
      </Paper>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, mb: 3 }}>
        <MetricCard
          label="ลูกค้าที่ใช้งาน"
          value={data?.kpis.active_clients}
          note={`จาก ${clientCount.toLocaleString('en-US')} ลูกค้าในกลุ่ม`}
          color={ACTIVE_CLIENTS}
          icon={<Business />}
          loading={loading && !data}
        />
        <MetricCard
          label="ผู้ใช้ไม่นับซ้ำ"
          value={data?.kpis.unique_users}
          note="ผู้ใช้ที่เข้าสู่ระบบ"
          color={DEFAULT_SECONDARY}
          icon={<Groups />}
          loading={loading && !data}
        />
        <MetricCard
          label="เข้าใช้แพลตฟอร์ม"
          value={data?.kpis.page_views}
          note="รวมทุกหน้าของลูกค้าในกลุ่ม"
          color={DEFAULT_PRIMARY.main}
          icon={<Visibility />}
          loading={loading && !data}
        />
      </Box>

      <Paper elevation={0} sx={{ ...cardSx, p: 2.5, mb: 3, width: '100%' }}>
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
          getRowClassName={(params) => (params.row.page_views === 0 ? 'quiet-row' : '')}
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
