import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The API allows CORS from this exact origin, so keep the port fixed.
    port: 5173,
    strictPort: true,
  },
});
