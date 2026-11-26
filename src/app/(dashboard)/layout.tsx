'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Box, Button, Typography } from '@mui/material'
import { Insights, Logout } from '@mui/icons-material'

const SIDEBAR_WIDTH = 280

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const overviewSelected = pathname === '/' || pathname.startsWith('/clients')

  async function logout() {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box
        component="nav"
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflow: 'auto',
          px: 2,
          pt: 3,
          pb: 2,
          boxShadow: '8px 0 30px rgba(15, 23, 42, 0.04)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1, mb: 4 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              fontSize: '1rem',
            }}
          >
            IC
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: '1.2rem' }}>IdeaCarb</Typography>
        </Box>
        <Button
          component={Link}
          href="/"
          startIcon={<Insights />}
          sx={{
            justifyContent: 'flex-start',
            borderRadius: 2,
            px: 2,
            py: 1.25,
            color: overviewSelected ? 'primary.dark' : 'text.secondary',
            bgcolor: overviewSelected ? 'rgba(16, 185, 129, 0.14)' : 'transparent',
            '&:hover': { bgcolor: overviewSelected ? 'rgba(16, 185, 129, 0.2)' : 'action.hover' },
          }}
        >
          ภาพรวม
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          startIcon={<Logout />}
          onClick={logout}
          sx={{ justifyContent: 'flex-start', color: 'text.secondary', borderRadius: 2, px: 2, py: 1.25 }}
        >
          ออกจากระบบ
        </Button>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Suspense fallback={null}>{children}</Suspense>
      </Box>
    </Box>
  )
}
