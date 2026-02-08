/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // <--- ЭТА СТРОКА САМАЯ ВАЖНАЯ
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}