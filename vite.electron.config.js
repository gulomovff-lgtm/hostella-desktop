import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Конфиг для Electron-сборки: base './' чтобы file:// пути работали правильно
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    emptyOutDir: false,
    rollupOptions: {
      input: {
        main:    './index.html',
        booking: './booking.html',
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
