/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Proxies /api requests to the Signup.Api backend during local dev so the
    // frontend can be run on its own Vite port (5173) without needing CORS
    // configured on the backend. Override with VITE_API_BASE_URL if the
    // backend is running elsewhere (see src/api/signup.ts).
    proxy: {
      '/api': {
        target: 'http://localhost:5231',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
