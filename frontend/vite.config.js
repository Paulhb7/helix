import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/check': 'http://localhost:8003',
      '/ingest': 'http://localhost:8003',
      '/preview': 'http://localhost:8003',
      '/health': 'http://localhost:8003',
      '/mode': 'http://localhost:8003',
    },
  },
})
