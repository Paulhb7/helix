import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/extract': 'http://localhost:8003',
      '/verify': 'http://localhost:8003',
      '/check': 'http://localhost:8003',
      '/preview': 'http://localhost:8003',
      '/healthz': 'http://localhost:8003',
    },
  },
})
