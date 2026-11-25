'use client'

import { useTheme } from '@mui/material/styles'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { UsageSeriesPoint } from '@/types/analytics'

function isWeekend(value: string): boolean {
  const day = new Date(`${value}T00:00:00`).getDay()
  return day === 0 || day === 6
}

function shortDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

export default function UsageChart({ series }: { series: UsageSeriesPoint[] }) {
  const theme = useTheme()
  const weekend = theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : theme.palette.grey[100]

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={theme.palette.divider} vertical={false} />
        {series.map((point, index) => {
          if (!isWeekend(point.date)) return null
          const next = series[index + 1]?.date
          if (!next) return null
          return (
            <ReferenceArea
              key={point.date}
              x1={point.date}
              x2={next}
              yAxisId="page_views"
              fill={weekend}
              fillOpacity={1}
              ifOverflow="hidden"
            />
          )
        })}
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
        <YAxis yAxisId="page_views" tick={{ fill: theme.palette.primary.main, fontSize: 12 }} width={48} />
        <YAxis yAxisId="unique_users" orientation="right" tick={{ fill: theme.palette.secondary.main, fontSize: 12 }} width={36} />
        <Tooltip
          labelFormatter={(value) => shortDate(String(value))}
          contentStyle={{
            background: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 10,
          }}
        />
        <Legend />
        <Line yAxisId="page_views" type="monotone" dataKey="page_views" name="เข้าชมหน้า" stroke={theme.palette.primary.main} strokeWidth={2} dot={false} />
        <Line yAxisId="unique_users" type="monotone" dataKey="unique_users" name="ผู้ใช้ไม่ซ้ำ" stroke={theme.palette.secondary.main} strokeWidth={2} strokeDasharray="5 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
