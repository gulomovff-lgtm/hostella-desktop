import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BUILD_TS } from './constants/config.js'

// eslint-disable-next-line no-console
console.info('[Hostella] build:', BUILD_TS)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)