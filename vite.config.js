import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: React and the chart library change far less often than app code.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/recharts|d3-|victory-vendor/.test(id)) return 'charts'
          if (id.includes('@phosphor-icons')) return 'icons'
          if (/react-router|react-dom|scheduler|[\\/]react[\\/]/.test(id)) return 'react'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'api/_core/**', 'src/components/ChatBox.jsx', 'src/components/ProfileForm.jsx', 'src/components/SwapCard.jsx', 'src/components/CitySearch.jsx', 'src/components/ForecastChart.jsx', 'src/components/Layout.jsx'],
      exclude: ['src/lib/types.js'],
      thresholds: { lines: 85, branches: 75, functions: 85 },
    },
  },
})
