'use client'

import { Box } from '@mui/material'

export default function Sparkline({ values }: { values: number[] }) {
  const peak = Math.max(...values, 1)
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: 28, width: 88 }}>
      {values.map((value, index) => (
        <Box
          key={index}
          sx={{
            flex: 1,
            height: `${Math.max(value === 0 ? 0 : 12, (value / peak) * 100)}%`,
            bgcolor: 'primary.main',
            opacity: value > peak * 0.45 ? 1 : 0.4,
            borderRadius: 0.5,
          }}
        />
      ))}
    </Box>
  )
}
