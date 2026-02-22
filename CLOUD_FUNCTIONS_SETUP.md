# ☁️ Cloud Functions Setup

## 1️⃣ Установка зависимостей функций

```bash
cd functions
npm install
```

## 2️⃣ Локальная разработка

Используйте файл `functions/.env.local` для локального токена.

Тестируйте локально:
```bash
cd functions
npm run serve
```

## 3️⃣ Деплой на Firebase

Когда готовы к продакшну:

```bash
# Настройка переменной окружения на Firebase (замените токен на реальный)
firebase functions:config:set telegram.bot_token="ВАШ_РЕАЛЬНЫЙ_TELEGRAM_BOT_TOKEN"

# Деплой функций
firebase deploy --only functions
```

## 4️⃣ API изменился

Вместо:
```javascript
await sendTelegramMessage("Текст");
```

Теперь используется Cloud Function:
```javascript
const result = await sendTelegramMessage("Текст");
// результат: { success: true, sent: 3, total: 3 }
```

## ✅ Преимущества

- ✅ API токен **защищен** на сервере
- ✅ Не светится в коде фронтенда
- ✅ Не попадает в Git репо
- ✅ Защита от подделки токена

