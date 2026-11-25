const path = require('path')

const root = __dirname
const apiPort = process.env.API_PORT || '8791'
const webPort = process.env.PORT || '8792'

module.exports = {
  apps: [
    {
      name: 'ideacarb-usage-api',
      cwd: path.join(root, 'api'),
      script: path.join(root, 'api/.venv/bin/uvicorn'),
      args: `main:app --host 127.0.0.1 --port ${apiPort}`,
      interpreter: 'none',
      autorestart: true,
      watch: false,
    },
    {
      name: 'ideacarb-usage',
      cwd: root,
      script: 'pnpm',
      args: 'start',
      interpreter: 'none',
      env: {
        PORT: webPort,
        NODE_ENV: 'production',
      },
      autorestart: true,
      watch: false,
    },
  ],
}
