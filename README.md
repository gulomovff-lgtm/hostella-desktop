# Hostella

Система управления хостелом: заселение, номера и календарь, долги, аренда комнат по договорам, расходы, отчёты, зарплаты, бонусная (реферальная) программа и уведомления в Telegram.

Приложение работает в трёх режимах из одной кодовой базы:

- 🌐 **Web** — Firebase Hosting: <https://hostella-app-a1e07.web.app>
- 🖥️ **Desktop** — Electron с авто-обновлением через GitHub Releases
- 📱 **Telegram** — как Mini App / встроенный браузер (адаптивная мобильная вёрстка)

Валюта — сум (Узбекистан). Языки интерфейса — русский и узбекский (договоры дополнительно на английском).

---

## Возможности

- **Номера и календарь** — занятость по койко-местам, заезды/выезды, drag-перенос, аренда целых комнат.
- **Гости и клиентская база** — карточки, история проживания, баланс счёта, дедупликация, договоры (3 языка, печать).
- **Аренда комнат** — пошаговый мастер, привязка к договору, продление, оплата (нал/карта/QR/перечисление), долги и их погашение, отмена действий.
- **Долги** — общая база долгов гостей и аренды, погашение, корректировки для админа.
- **Касса и смены** — учёт оплат по сотрудникам, передача смены.
- **Расходы** — категории, шаблоны регулярных расходов, зарплаты (включая уборку).
- **Отчёты** — выгрузка в Excel (договоры, периоды, специальности, оплаты) с подсветкой долга.
- **Бонусная программа** — реферальное дерево, тиры, начисление/списание бонусных дней.
- **Регистрации** — E-mehmon / кадастр: продление и редактирование.
- **Уведомления** — Telegram (через Cloud Functions): заселения, ошибки, события.

## Технологии

- **Frontend:** React 18, Vite, Tailwind CSS, lucide-react, ExcelJS/SheetJS
- **Backend:** Firebase — Firestore, Storage, Hosting, Cloud Functions, Auth (анонимный)
- **Desktop:** Electron + electron-builder (NSIS, авто-апдейт через GitHub)

## Требования

- Node.js 18+
- Аккаунт Firebase и установленный `firebase-tools` (для деплоя)
- Файл переменных окружения (см. ниже)

## Установка и запуск

```bash
npm install
npm run dev          # Electron + Vite (десктоп-режим разработки)
npm run react-start  # только web (Vite dev-server)
```

## Переменные окружения

Создайте `.env` (или `.env.development` / `.env.production`). В клиент попадают **только публичные** ключи с префиксом `VITE_`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_USE_EMULATOR=false
```

Секреты сервера (Telegram bot-token, пароли) хранятся **только** в окружении Cloud Functions, не во фронте. Файлы `.env*` в репозиторий не коммитятся (см. `.gitignore`).

## Сборка и деплой

**Web (Firebase Hosting):**
```bash
npm run build
firebase deploy --only hosting
# или одной командой:
npm run deploy
```

**Desktop (GitHub Release + авто-апдейт):**
```bash
# 1) поднять версию в package.json
# 2) собрать и опубликовать черновик релиза:
npm run dist          # требует GH_TOKEN в окружении
# 3) опубликовать черновик как latest (через GitHub UI или API)
```
Релиз и установщик публикуются в репозиторий `gulomovff-lgtm/hostella-desktop`. Клиенты подтягивают обновление автоматически при запуске.

## Структура проекта

```
src/
  components/   UI: Views (экраны), Modals (окна), Layout (навигация)
  hooks/        работа с данными (useAppData, useGuestActions, …)
  utils/        helpers, telegram, contractFinancials, appConfig, …
  constants/    переводы, конфиг
electron/       main-процесс и preload
functions/      Firebase Cloud Functions (Telegram, пароли, OCR)
public/         статика, иконки, логотипы
```

## Безопасность

Политика и детали — в [SECURITY.md](./SECURITY.md). Кратко: секреты не в клиенте, Telegram-токен в Cloud Functions, Electron с `contextIsolation`, доступ к данным разграничен ролями.

## Лицензия

Проприетарное ПО. © Fazliddin Gulomov. Все права защищены.
