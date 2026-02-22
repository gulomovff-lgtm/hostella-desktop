import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Separate build config for the public booking widget only
export default defineConfig({
  base: './',
  plugins: [react()],
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
