'use client'

import { createTheme, ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { ReactNode, useEffect, useMemo } from 'react'
import { BASE_HTML_FONT_SIZE, DEFAULT_PRIMARY, DEFAULT_SECONDARY, FONT_FAMILY } from '@/theme/tokens'

type ThemeMode = 'light' | 'dark'

const createAppTheme = (mode: ThemeMode) => {
  const isDark = mode === 'dark'
  return createTheme({
    palette: {
      mode,
      primary: {
        main: DEFAULT_PRIMARY.main,
        light: DEFAULT_PRIMARY.light,
        dark: DEFAULT_PRIMARY.dark,
        contrastText: '#ffffff',
      },
      secondary: {
        main: DEFAULT_SECONDARY,
        light: isDark ? '#93c5fd' : '#60a5fa',
        dark: isDark ? '#3b82f6' : '#2563eb',
        contrastText: '#ffffff',
      },
      background: {
        default: isDark ? '#050B14' : '#f8fafc',
        paper: isDark ? '#0B1221' : '#ffffff',
      },
      text: {
        primary: isDark ? '#ffffff' : '#0f172a',
        secondary: isDark ? '#94a3b8' : '#64748b',
      },
      divider: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
      grey: {
        50: isDark ? '#0B1221' : '#f8fafc',
        100: isDark ? '#111827' : '#f1f5f9',
        200: isDark ? '#1f2937' : '#e2e8f0',
      },
    },
    shape: { borderRadius: 10 },
    typography: {
      htmlFontSize: BASE_HTML_FONT_SIZE,
      fontFamily: FONT_FAMILY,
      h4: { fontWeight: 600, fontSize: '1.75rem', lineHeight: 1.3, letterSpacing: '-0.02em' },
      h6: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.4 },
      body1: { fontSize: '1.125rem', lineHeight: 1.6 },
      body2: { fontSize: '1.05rem', lineHeight: 1.55 },
      button: { fontWeight: 600, letterSpacing: 0, fontSize: '1.05rem' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { fontSize: BASE_HTML_FONT_SIZE },
        },
      },
    },
  })
}

export default function AppTheme({ children }: { children: ReactNode }) {
  const theme = useMemo(() => createAppTheme('light'), [])
  useEffect(() => {
    document.documentElement.style.fontSize = `${BASE_HTML_FONT_SIZE}px`
  }, [])
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
