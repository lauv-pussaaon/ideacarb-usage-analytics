'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    setPending(false)
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setError(typeof body.error === 'string' ? body.error : 'เข้าสู่ระบบไม่สำเร็จ')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2 }}>
      <Paper component="form" onSubmit={onSubmit} elevation={0} sx={{ p: 4, width: '80%', maxWidth: 640, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>การใช้งานลูกค้า</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>เข้าสู่ระบบสำหรับทีม IdeaCarb</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="ชื่อผู้ใช้" value={username} onChange={(event) => setUsername(event.target.value)} fullWidth required sx={{ mb: 2 }} />
        <TextField label="รหัสผ่าน" type="password" value={password} onChange={(event) => setPassword(event.target.value)} fullWidth required sx={{ mb: 3 }} />
        <Button type="submit" variant="contained" fullWidth disabled={pending}>เข้าสู่ระบบ</Button>
      </Paper>
    </Box>
  )
}
