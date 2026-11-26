import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    trustHostHeader: true,
  },
}

export default nextConfig
