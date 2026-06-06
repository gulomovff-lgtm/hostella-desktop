import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

const buildTs = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '')

// Separate build config for the public booking widget only
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TS__:    JSON.stringify(buildTs),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false, // don't wipe main app dist
    rollupOptions: {
      input: {
        booking: './booking.html',
      },
    },
  },
})
