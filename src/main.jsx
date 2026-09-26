import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'flag-icons/css/flag-icons.min.css'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { BUILD_TS } from './constants/config.js'

 
console.info('[Hostella] build:', BUILD_TS)

// ── Telegram-окружение ──
// Внутри Telegram (Mini App или встроенный браузер) сверху плавает шапка
// «Закрыть / ⌄ / …». Помечаем <html class="tg">, чтобы CSS добавил верхний
// отступ только там, а в обычном браузере его не было (иначе большой пробел).
//
// Признаки (любой): параметры tgWebApp… в адресе (мини-приложение), мост
// TelegramWebviewProxy (Android/десктоп), слово Telegram в user-agent
// (встроенный браузер). Раньше смотрели только user-agent — у мини-приложения
// его нет, класс не ставился, и окна уходили под шапку Telegram. Метку
// помним на сессию: после перехода внутри приложения адрес уже без параметров.
try {
  const ua = navigator.userAgent || ''
  const loc = (window.location.hash || '') + (window.location.search || '')
  let remembered = false
  try { remembered = sessionStorage.getItem('hostella_tg') === '1' } catch { /* приватный режим */ }
  const inTelegram =
    remembered ||
    /tgWebApp(Data|Platform|Version)/.test(loc) ||
    typeof window.TelegramWebviewProxy !== 'undefined' ||
    /Telegram/i.test(ua)
  if (inTelegram) {
    const root = document.documentElement
    root.classList.add('tg')
    try { sessionStorage.setItem('hostella_tg', '1') } catch { /* no-op */ }
    // Официальный скрипт Telegram — только внутри Telegram. Он разворачивает
    // мини-приложение на весь экран (иначе оно открывается на половину высоты
    // и окна сжимаются) и сообщает точные отступы шапки и низа.
    const s = document.createElement('script')
    s.src = 'https://telegram.org/js/telegram-web-app.js'
    s.async = true
    s.onload = () => {
      const w = window.Telegram && window.Telegram.WebApp
      if (!w) return
      try { w.ready(); w.expand() } catch { /* старый клиент */ }
      const apply = () => {
        const sa = w.safeAreaInset || {}, ca = w.contentSafeAreaInset || {}
        const top = (sa.top || 0) + (ca.top || 0)
        // 0 — шапка Telegram своя, над веб-вью: оставляем запас по умолчанию из CSS
        if (top > 0) root.style.setProperty('--tg-top', `${top + 8}px`)
        root.style.setProperty('--tg-bottom', `${(sa.bottom || 0) + (ca.bottom || 0)}px`)
      }
      apply()
      try {
        w.onEvent('safeAreaChanged', apply)
        w.onEvent('contentSafeAreaChanged', apply)
        w.onEvent('fullscreenChanged', apply)
      } catch { /* no-op */ }
    }
    document.head.appendChild(s)
  }
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
