# Промт: интеграция сайт/бот ↔ приложение Hostella

> Скопируй этот промт в новую сессию Claude Code (рабочая папка — hostella-app,
> сайт лежит в C:\Users\user\site). Выполнять поэтапно, после каждого этапа — сборка и проверка.

## Контекст

- Сайт hostella.uz: PHP + MySQL (shared hosting). Ключевые файлы: `booking.php` (форма брони,
  AJAX `create_booking`, пуш в CRM через `push_booking_to_crm()`), `tg-bot.php` (Telegram-бот:
  ИИ-менеджер, Telegram Business, создание брони с `tg_chat_id`), `check.php` (проверка/правка
  брони по коду HS-XXXXXX), `includes/secrets.php` (TG_BOT_TOKEN, TG_WEBHOOK_SECRET, ключи).
- Приложение: Electron + React + Firestore (`artifacts/hostella-multi-v4/public/data/guests`).
  Брони с сайта: `status:'booking', source:'website', channel:'site'|'telegram'`, есть
  `mysqlId`, `bookingCode`, `tgChatId`. UI: `src/components/Views/BookingsView.jsx`,
  обработчики: `handleActivateBooking` / `handleRejectBooking` в `src/hooks/useGuestActions.js`.
- Разрыв: связь односторонняя (сайт → приложение). Подтверждение/отказ/заселение не уходят
  обратно в MySQL и гостю.

## Этап 1 — Обратная связь (приоритет)

1. На сайте создать `crm-callback.php`: POST JSON `{key, code, action, reason?}`,
   `key` сверять `hash_equals` с `TG_WEBHOOK_SECRET`. Действия:
   - `confirmed` → `UPDATE bookings SET payment_status='confirmed'`; если есть `tg_chat_id` —
     отправить гостю через бота «✅ Бронь подтверждена» (3 языка, определять по `lang` брони, если есть).
   - `cancelled` → `payment_status='cancelled'` (место освобождается в подсчёте доступности);
     гостю — вежливый отказ + предложение связаться.
   - `checked_in` → пометка `checked_in_at=NOW()`; гостю — «Добро пожаловать» + реферальный код.
2. В приложении `src/utils/siteCallback.js`: `notifySite(booking, action)` — fetch на
   `https://hostella.uz/crm-callback.php`, ключ хранить в Firestore-настройках
   (`settings/hostelConfig.siteCallbackKey`), не в коде. Ошибки — тихо в очередь
   (`offlineQueue`), повтор при синке.
3. Встроить вызовы: `handleActivateBooking` → `confirmed`; `handleRejectBooking` → `cancelled`
   (и НЕ удалять документ, а ставить `status:'booking_rejected'` для истории);
   check-in принятой брони → `checked_in`.
4. `check.php`: показывать статус `confirmed` («Бронь подтверждена ✅»).

## Этап 2 — Видимость источника

1. `BookingsView.jsx`: бейдж канала — 🌐 «Сайт» / ✈️ «Telegram» (поле `channel`),
   показать `bookingCode`, комментарий, согласованную цену от бота (если отличается от базовой).
2. В карточке гостя после заселения сохранить `bookingCode` и `channel` — для аналитики
   «откуда приходят гости» (отчёт в AnalyticsView: разрез по каналам за месяц).

## Этап 3 — Единая доступность

1. Сайт при `check_availability` дополнительно дергает Cloud Function `getFreeBeds`
   (живые данные приложения) и берёт МИНИМУМ из двух источников.
2. Продажа места ботом/сайтом сразу видна в приложении (уже есть), а заселение живого гостя
   в приложении уменьшает доступность сайта (появится после п.1).

## Этап 4 — Автоматизация жизненного цикла гостя (бот)

- За день до заезда: «Ждём вас завтра! Адрес, как добраться, время заезда».
- Не пришёл в день заезда к 20:00 → спросить «Планы в силе?» + алерт владельцу.
- После выезда: попросить отзыв (Google Maps / 2GIS ссылка) + реферальный код со скидкой.
- Продление: за день до выезда бот спрашивает «Продлить?» → кнопка → заявка в приложение.

## Этап 5 — Платежи

- Payme/Click уже заведены на сайте (`payment.php`) — довести до конца: оплата онлайн
  меняет `payment_status='paid'` → пуш в приложение (`paidCard`/статус предоплаты у брони).
- Предоплата = гарантированная бронь; неоплаченные авто-отменять через N часов (бот напоминает).

## Правила

- Никаких новых секретов в коде — только `includes/secrets.php` (сайт) и Firestore-настройки (приложение).
- Обратная совместимость: старые брони без `bookingCode`/`mysqlId` не должны ломать UI.
- После каждого этапа: `npx vite build`, релиз по схеме package.json → `npm run dist`,
  публикация GitHub-релиза (см. историю: релизы v0.12.x).
