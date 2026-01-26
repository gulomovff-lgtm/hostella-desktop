import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // <--- ВОТ ЭТА СТРОЧКА САМАЯ ВАЖНАЯ
  plugins: [react()],
  base: './', // <--- ДОБАВЬТЕ ЭТУ СТРОКУ
})