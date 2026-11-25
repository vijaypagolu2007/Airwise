import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { phosphorWeights } from './tools/phosphorWeights.js'

// `vite preview` serves the same security headers as production, so the E2E run catches CSP breakage.
const vercelHeaders = Object.fromEntries(
  JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8')).headers[0].headers.map((h) => [h.key, h.value]),
)

export default defineConfig({
  plugins: [phosphorWeights(), react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  preview: { port: 4173, headers: vercelHeaders },
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: React and the icon set change far less often than app code.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
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
      include: ['src/lib/**', 'api/_core/**', 'tools/**', 'src/components/**', 'src/context/**'],
      exclude: ['src/lib/types.js'],
      thresholds: { lines: 85, branches: 75, functions: 85 },
    },
  },
})
