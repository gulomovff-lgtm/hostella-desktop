import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'flag-icons/css/flag-icons.min.css'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { BUILD_TS } from './constants/config.js'

// eslint-disable-next-line no-console
console.info('[Hostella] build:', BUILD_TS)

// ── Telegram-окружение ──
// Внутри Telegram (Mini App или встроенный браузер) сверху плавает шапка
// «Закрыть / ⌄ / …». Помечаем <html class="tg">, чтобы CSS добавил верхний
// отступ только там, а в обычном браузере его не было (иначе большой пробел).
try {
  const ua = navigator.userAgent || ''
  const tgWebApp = window.Telegram && window.Telegram.WebApp
  const inTelegram =
    !!(tgWebApp && (tgWebApp.initData || (tgWebApp.platform && tgWebApp.platform !== 'unknown'))) ||
    /Telegram/i.test(ua)
  if (inTelegram) document.documentElement.classList.add('tg')
} catch { /* no-op */ }

// ── Sentry (спящий) ──
// Активируется только если задан VITE_SENTRY_DSN. Грузится динамически,
// поэтому без ключа не попадает в основной бандл.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn: sentryDsn,
        environment: import.meta.env.MODE,
        release: BUILD_TS ? `hostella@${BUILD_TS}` : undefined,
        tracesSampleRate: 0.1,
      })
    })
    .catch(() => { /* не блокируем приложение, если Sentry не загрузился */ })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
