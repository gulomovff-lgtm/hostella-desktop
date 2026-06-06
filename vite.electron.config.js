import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

const buildTs = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '')

// Конфиг для Electron-сборки: base './' чтобы file:// пути работали правильно
const removeCrossorigin = () => ({
  name: 'remove-crossorigin',
  transformIndexHtml(html) {
    return html
      .replace(/ crossorigin(?:="[^"]*")?/g, '')
      .replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />');
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), removeCrossorigin()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TS__:    JSON.stringify(buildTs),
  },
  build: {
    emptyOutDir: true,
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
