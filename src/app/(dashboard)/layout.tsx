'use client'

import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { Box, Button } from '@mui/material'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  async function logout() {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', width: '80%', mx: 'auto', pt: 2 }}>
        <Button color="inherit" onClick={logout}>ออกจากระบบ</Button>
      </Box>
      <Suspense fallback={null}>{children}</Suspense>
    </Box>
  )
}
