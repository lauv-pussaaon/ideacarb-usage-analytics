import { Box, Paper, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { cardSx, kpiValueSx } from '@/lib/ui'

export default function MetricCard({
  label,
  value,
  note,
  color,
  icon,
  loading,
}: {
  label: string
  value: number | undefined
  note: string
  color: string
  icon: ReactNode
  loading: boolean
}) {
  return (
    <Paper elevation={0} sx={{ ...cardSx, p: 2.5, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            bgcolor: `${color}22`,
            color,
          }}
        >
          {icon}
        </Box>
        <Typography color="text.secondary">{label}</Typography>
      </Box>
      <Typography sx={{ ...kpiValueSx, color }}>
        {loading ? '—' : Number(value ?? 0).toLocaleString('en-US')}
      </Typography>
      <Typography color="text.secondary">{note}</Typography>
    </Paper>
  )
}
