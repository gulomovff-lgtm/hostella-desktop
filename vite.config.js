import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

const buildTs = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '')

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TS__:    JSON.stringify(buildTs),
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ['**/package.json', '**/package-lock.json'],
    },
  },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main:    './index.html',
        booking: './booking.html',
        beta:    './beta.html',
      },
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions', 'firebase/storage'],
          'vendor-icons':    ['lucide-react'],
        },
      },
    },
  },
})