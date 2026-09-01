const electron = require('electron');
const { app, BrowserWindow, ipcMain, powerMonitor, shell } = electron;
const path = require('path');
const fs = require('fs');
const https = require('https');
const dns = require('dns');
const net = require('net');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const { buildAutofillScript, buildDepartureAutoScript, buildDepartureCheckScript, buildPassportCheckScript, buildListFetchScript, buildTursborFetchScript, buildDepartureBulkScript, buildAutoArrivalScript, buildRecalcScript } = require('./emehmonAutofill');

// ─── Фикс «залипания» ввода на Windows ───────────────────────────────────────
// Известный баг Electron/Chromium: окно перестаёт принимать ввод, пока не
// переключиться на другое приложение и обратно. Отключаем расчёт перекрытия окон.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

// ─── Одиночный экземпляр ─────────────────────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Направляем логи обновлятора в файл
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
// Автоустановка при выходе приложения (fallback)
autoUpdater.autoInstallOnAppQuit = true;

const UPDATE_IDLE_INSTALL_SECONDS = 180; // 3 мин простоя
const UPDATE_IDLE_CHECK_INTERVAL_MS = 60 * 1000;

const PENDING_FILE = () => path.join(app.getPath('userData'), 'pending_payments.json');

// ─── Немедленные уведомления о сбоях главного процесса ────────────────────────
// Раньше падения main-процесса (автоматика e-mehmon, авто-обновление, IPC)
// уходили только в файл лога, и владелец о них не узнавал. Теперь ошибка сразу
// передаётся в интерфейс, а он шлёт алерт в Telegram уже настроенным путём.
// Если окно мертво (краш рендерера) — складываем в файл и отправим при следующем
// запуске: иначе именно самые тяжёлые сбои и терялись бы.
const ERRORS_FILE = () => path.join(app.getPath('userData'), 'pending_errors.json');

function queuePendingError(payload) {
  try {
    const file = ERRORS_FILE();
    const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8') || '[]') : [];
    const next = Array.isArray(prev) ? prev : [];
    next.push(payload);
    fs.writeFileSync(file, JSON.stringify(next.slice(-20), null, 2), 'utf8'); // не копим бесконечно
  } catch (e) {
    log.error('[error-report] не смог сохранить:', e.message);
  }
}

function reportMainError(context, err, extra = {}) {
  const message = (err && err.message) ? err.message : String(err);
  const stack = (err && err.stack) ? String(err.stack).slice(0, 600) : '';
  log.error(`[${context}]`, message, stack);
  const payload = { context, message, stack, at: new Date().toISOString(), ...extra };
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('main-error', payload);
      return;
    }
  } catch (e) { /* окно недоступно — уходим в файл */ }
  queuePendingError(payload);
}

process.on('uncaughtException', (err) => reportMainError('electron.uncaughtException', err));
process.on('unhandledRejection', (reason) => reportMainError('electron.unhandledRejection', reason));
app.on('render-process-gone', (_e, _wc, details) => {
  reportMainError('electron.render-process-gone', new Error(details && details.reason ? details.reason : 'unknown'),
    { exitCode: details && details.exitCode });
});
app.on('child-process-gone', (_e, details) => {
  reportMainError('electron.child-process-gone', new Error(details && details.reason ? details.reason : 'unknown'),
    { type: details && details.type });
});

// Интерфейс забирает накопленные ошибки при старте и сам их отправляет
ipcMain.handle('take-pending-errors', () => {
  try {
    const file = ERRORS_FILE();
    if (!fs.existsSync(file)) return [];
    const data = JSON.parse(fs.readFileSync(file, 'utf8') || '[]');
    fs.unlinkSync(file);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    log.error('[error-report] не смог прочитать:', e.message);
    return [];
  }
});

let mainWindow;
let emehmonWindow = null;
let arrivalPayload = null; // текущий payload окна прибытия (для авто-галочки на нужного гостя)
const departureWindows = {};   // partition -> скрытое окно убытия/списков
const autoArrivalWindows = {}; // partition -> скрытое окно авто-регистрации
let emehmonWindowPartition = null; // партиция открытого окна прибытия
let autoArrivalChain = Promise.resolve(); // сериализация авто-регистраций (по одной за раз)
let isDownloading = false;
let isUpdateDownloaded = false;
let isInstallingUpdate = false;
let idleInstallInterval = null;
let updateCheckInterval = null;

function sendToWindow(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

function stopIdleInstallWatcher() {
  if (idleInstallInterval) {
    clearInterval(idleInstallInterval);
    idleInstallInterval = null;
  }
}

function tryInstallOnIdle(reason = 'periodic-check') {
  if (!isUpdateDownloaded || isInstallingUpdate) return;
  const idleSeconds = powerMonitor.getSystemIdleTime();
  log.info(`[Updater] idle check (${reason}): ${idleSeconds}s`);
  if (idleSeconds < UPDATE_IDLE_INSTALL_SECONDS) return;

  isInstallingUpdate = true;
  stopIdleInstallWatcher();
  log.info(`[Updater] Installing update silently after idle ${idleSeconds}s`);
  sendToWindow('update-auto-installing', { idleSeconds });

  // Даем рендереру короткое окно завершить локальные записи перед перезапуском.
  setTimeout(() => {
    try {
      autoUpdater.quitAndInstall(true, true);
    } catch (e) {
      log.error('[Updater] quitAndInstall failed:', e.message);
      isInstallingUpdate = false;
    }
  }, 1500);
}

function startIdleInstallWatcher() {
  stopIdleInstallWatcher();
  idleInstallInterval = setInterval(() => {
    tryInstallOnIdle('interval');
  }, UPDATE_IDLE_CHECK_INTERVAL_MS);
}

const isDev = !app.isPackaged;

// Disable HTTP cache in dev so stale responses from Vite never cause MIME errors
if (isDev) {
  app.commandLine.appendSwitch('disable-http-cache');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // ─── Блокировка внешней навигации главного окна ─────────────────────────────
  // Приложение живёт по фикс. origin (localhost в dev / file:// в prod). Любые
  // попытки увести окно на внешний URL блокируем; ссылки открываем в системном
  // браузере, а не внутри приложения (защита от фишинга/подмены UI).
  const isInternalUrl = (url) => {
    try {
      const u = new URL(url);
      if (isDev) return u.host === 'localhost:5173';
      return u.protocol === 'file:';
    } catch { return false; }
  };
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isInternalUrl(url)) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url).catch(() => {});
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.webContents.session.clearCache().then(() => {
      mainWindow.loadURL('http://localhost:5173');
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Проверяем обновления через 3 секунды после запуска (только в production)
  if (!isDev) {
    // Тихая проверка/скачивание без пользовательских действий.
    setTimeout(() => autoUpdater.checkForUpdates(), 3000);
    // Повторно каждые 2 часа (только если не идёт скачивание).
    // Старый интервал гасим: createWindow() вызывается и на 'ready', и на 'activate',
    // иначе при пересоздании окна интервалы копились бы.
    if (updateCheckInterval) clearInterval(updateCheckInterval);
    updateCheckInterval = setInterval(() => {
      if (!isDownloading) autoUpdater.checkForUpdates();
    }, 2 * 60 * 60 * 1000);
  }
}

// ─── e-mehmon: сессия НА КАЖДЫЙ ФИЛИАЛ ────────────────────────────────────────
// У каждого филиала свой аккаунт e-mehmon, а сессия в Electron — это одна «банка
// с cookie». Раньше все окна жили в общей persist:emehmon, поэтому одновременно
// мог быть залогинен только ОДИН аккаунт: кассир этого не замечал (он всегда в
// своём филиале), а админ при переключении филиалов получал списки того хостела,
// под которым портал залогинен последним. Отдельная партиция на филиал решает
// это: оба аккаунта живут параллельно, переключение не требует перелогина.
const emehmonPartition = (hostelId) => {
  const id = String(hostelId || '').trim();
  // Только известный формат идентификатора — имя партиции не должно зависеть
  // от произвольной строки, пришедшей из рендерера.
  return /^[a-zA-Z0-9_-]{1,32}$/.test(id) ? `persist:emehmon-${id}` : 'persist:emehmon';
};

// ─── e-mehmon: безопасное построение URL и защита инжекции учётных данных ─────
// Портал открывается ТОЛЬКО на своём origin, а автозаполнение (в нём — логин,
// пароль и PII гостя) инжектится ТОЛЬКО когда окно реально стоит на emehmon.uz.
const EMEHMON_ORIGIN = 'https://emehmon.uz';

// Строим URL портала как фикс. origin + безопасный относительный путь. Строку
// пути из рендерера НИКОГДА не конкатенируем к хосту напрямую: 'path' вида
// '@evil.com/' превратил бы 'https://emehmon.uz'+path в userinfo-трюк и увёл
// окно на чужой домен, куда затем инжектятся учётные данные.
const buildEmehmonUrl = (rawPath) => {
  const fallback = EMEHMON_ORIGIN + '/listok/create-page';
  const p = String(rawPath || '/listok/create-page');
  if (!/^\/[A-Za-z0-9/_.\-?=&%]*$/.test(p) || p.indexOf('//') === 0) return fallback;
  try {
    const u = new URL(p, EMEHMON_ORIGIN);
    return u.origin === EMEHMON_ORIGIN ? u.toString() : fallback;
  } catch { return fallback; }
};

// true только для https emehmon.uz (и поддоменов) — гейт для любой инжекции.
const isEmehmonUrl = (url) => {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    return h === 'emehmon.uz' || h.endsWith('.emehmon.uz');
  } catch { return false; }
};

// Инжектим автозаполнение (логин/пароль/PII) ТОЛЬКО если окно на emehmon.uz.
// Если портал/редирект/MITM увёл на чужой origin — молча пропускаем.
const safeInjectAutofill = (win, payload) => {
  try {
    if (!win || win.isDestroyed()) return;
    const wc = win.webContents;
    if (!wc || wc.isDestroyed()) return;
    if (!isEmehmonUrl(wc.getURL())) {
      log.warn('[emehmon] inject skipped: окно не на emehmon.uz →', wc.getURL());
      return;
    }
    wc.executeJavaScript(buildAutofillScript(payload)).catch((err) =>
      log.error('[emehmon] inject failed:', err.message));
  } catch (e) { log.error('[emehmon] safeInject error:', e.message); }
};

// Запираем окно портала на emehmon.uz: любую навигацию на чужой origin
// отменяем, всплывающие окна (лист печати) разрешаем только на emehmon.uz и с
// полным hardening в webPreferences (иначе дочернее окно наследует defaults).
const hardenEmehmonWindow = (win, part) => {
  const blockOffOrigin = (event, url) => {
    if (!isEmehmonUrl(url)) {
      event.preventDefault();
      log.warn('[emehmon] заблокирован переход на', url);
    }
  };
  win.webContents.on('will-navigate', blockOffOrigin);
  // will-redirect ловит HTTP 3xx / meta-refresh, которые will-navigate пропускает.
  win.webContents.on('will-redirect', blockOffOrigin);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isEmehmonUrl(url)) return { action: 'deny' };
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        parent: mainWindow,
        autoHideMenuBar: true,
        webPreferences: {
          partition: part,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          webSecurity: true,
        },
      },
    };
  });
};

// ─── e-mehmon: встроенное окно регистрации иностранцев ──────────────────────
// Открывает дочернее окно с порталом e-mehmon в отдельной постоянной сессии
// (логин/капча сохраняются) и инжектит автозаполнение. Логин/пароль приходят
// в payload из облака (Firebase, выбор по филиалу гостя) — см. src/utils/emehmon.js.
ipcMain.handle('open-emehmon', (_event, guest) => {
  try {
    arrivalPayload = guest || {};
    const payload = arrivalPayload;

    const part = emehmonPartition(payload.hostelId);
    // Партиция задаётся при создании окна: если гость из другого филиала —
    // старое окно пересоздаём, иначе попадём в чужую сессию.
    if (emehmonWindow && !emehmonWindow.isDestroyed() && emehmonWindowPartition !== part) {
      try { emehmonWindow.destroy(); } catch (_) {}
      emehmonWindow = null;
    }
    if (emehmonWindow && !emehmonWindow.isDestroyed()) {
      emehmonWindow.focus();
      // окно переиспользуется — обновляем данные/кнопку под нового гостя
      safeInjectAutofill(emehmonWindow, payload);
      return true;
    }
    emehmonWindowPartition = part;
    emehmonWindow = new BrowserWindow({
      width: 1200,
      height: 860,
      parent: mainWindow,
      title: 'e-mehmon — регистрация иностранцев',
      autoHideMenuBar: true,
      webPreferences: {
        partition: part, // сессия своего филиала (логин сохраняется отдельно)
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    });
    emehmonWindow.setMenuBarVisibility(false);
    hardenEmehmonWindow(emehmonWindow, part);
    // Прибытие → create-page, убытие → /listok. Если не залогинен, портал уведёт
    // на /login, после входа скрипт авто-редиректит на нужную страницу.
    // URL строится безопасно (фикс. origin + валидированный путь), см. buildEmehmonUrl.
    emehmonWindow.loadURL(buildEmehmonUrl(payload.path));

    const inject = () => safeInjectAutofill(emehmonWindow, arrivalPayload || payload);
    emehmonWindow.webContents.on('did-finish-load', inject);
    emehmonWindow.webContents.on('did-navigate', inject);
    emehmonWindow.webContents.on('did-navigate-in-page', inject);
    // Закрытие окна после успешной регистрации + авто-галочка «Зарегистрирован».
    const finishArrival = () => {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('emehmon-registered', {
            guestId: (arrivalPayload && arrivalPayload.guestId) || '',
            passport: (arrivalPayload && arrivalPayload.passport) || '',
          });
        }
      } catch (e) { /* ignore */ }
      if (emehmonWindow && !emehmonWindow.isDestroyed()) emehmonWindow.close();
    };
    // (1) сигнал из страницы (title-сентинел)
    emehmonWindow.webContents.on('page-title-updated', (_e, title) => {
      if (title && title.indexOf('__HOSTELLA_REG_DONE__') !== -1) finishArrival();
    });
    // (2) НАДЁЖНЫЙ путь: main сам опрашивает окно на модалку успеха swal2 и закрывает.
    const SUCCESS_CHECK = "(function(){try{var ic=document.querySelector('.swal2-popup .swal2-icon.swal2-success')||document.querySelector('.swal2-success.swal2-icon-show');var t=document.querySelector('.swal2-title');var ok=t&&/saqland|muvaffaqiyat|success|\\u0441\\u043e\\u0445\\u0440\\u0430\\u043d/i.test(t.textContent||'');return !!(ic&&ok);}catch(e){return false;}})()";
    const arrivalTimer = setInterval(() => {
      if (!emehmonWindow || emehmonWindow.isDestroyed()) { clearInterval(arrivalTimer); return; }
      if (((arrivalPayload && arrivalPayload.mode) || '') === 'departure') return; // только прибытие
      emehmonWindow.webContents.executeJavaScript(SUCCESS_CHECK, true)
        .then((done) => { if (done) { clearInterval(arrivalTimer); finishArrival(); } })
        .catch(() => {});
    }, 500);
    emehmonWindow.on('closed', () => { clearInterval(arrivalTimer); emehmonWindow = null; });
    return true;
  } catch (e) {
    log.error('[emehmon] open failed:', e.message);
    return false;
  }
});

// ─── e-mehmon: фоновое выселение ────────────────────────────────────────────
// Гонит весь процесс убытия в СКРЫТОМ окне (та же сессия persist:emehmon, логин
// сохранён): находит гостя, открывает модалку «Chiqish», заполняет TO‘LOV/тип/
// печать и жмёт «Check-Out». Возвращает статус в рендер (см. emehmonAutofill.js).
//  • print:true  → окно показывается, чтобы был виден диалог печати листа убытия;
//  • проблема (вход/не найден/неоднозначно) → окно всплывает для ручного завершения.
// Создаёт (или переиспользует) скрытое окно убытия в сессии persist:emehmon.
// По одному скрытому окну на филиал — каждое в своей сессии, поэтому оба
// аккаунта e-mehmon остаются залогинены и переключение филиала ничего не рвёт.
function ensureDepartureWindow(hostelId) {
  const part = emehmonPartition(hostelId);
  const cur = departureWindows[part];
  if (cur && !cur.isDestroyed()) return cur;
  const win = new BrowserWindow({
    width: 1200,
    height: 860,
    parent: mainWindow,
    show: false,
    title: 'e-mehmon — убытие',
    autoHideMenuBar: true,
    webPreferences: {
      partition: part, // сессия своего филиала
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.on('closed', () => { delete departureWindows[part]; });
  // Запираем окно на emehmon.uz. Лист печати (window.open с портала) — только на
  // emehmon.uz и с полным hardening в дочернем окне, см. hardenEmehmonWindow.
  hardenEmehmonWindow(win, part);
  departureWindows[part] = win;
  return win;
}

ipcMain.handle('emehmon-departure', async (_event, guest) => {
  const payload = guest || {};
  const wantVisible = !!payload.print;
  try {
    const win = ensureDepartureWindow(payload.hostelId);
    // Свежая загрузка списка (фолбэк на /login, если не залогинен)
    await win.loadURL('https://emehmon.uz/listok');
    if (wantVisible) { win.show(); win.focus(); }

    let result;
    try {
      result = await win.webContents.executeJavaScript(buildDepartureAutoScript(payload), true);
    } catch (e) {
      result = { status: 'error', message: e.message };
    }
    const status = (result && result.status) || 'error';

    const needsHuman = ['need_login', 'not_found', 'multiple', 'no_table',
      'no_modal', 'no_button', 'no_checkout_btn', 'error'].includes(status);
    if (needsHuman) {
      // Показать окно и подмешать ручную панель убытия / автозаполнение логина.
      win.show(); win.focus();
      safeInjectAutofill(win, payload);
    } else if (status === 'done' && !wantVisible) {
      win.hide(); // успех в фоне — прячем (окно переиспользуется при след. выселении)
    }

    return result || { status };
  } catch (e) {
    log.error('[emehmon] departure failed:', e.message);
    const w = departureWindows[emehmonPartition(payload.hostelId)];
    if (w && !w.isDestroyed()) { w.show(); }
    return { status: 'error', message: e.message };
  }
});

// ─── e-mehmon: проверка, выселен ли гость ────────────────────────────────────
// «Готово» в плашке не должно ставиться «просто так»: проверяем в /listok (там
// только активные). present → ещё не выселен; absent → уже в /listokout.
// Всегда в фоне; окно показываем только если нужен вход.
ipcMain.handle('emehmon-check', async (_event, guest) => {
  const payload = guest || {};
  try {
    const win = ensureDepartureWindow(payload.hostelId);
    await win.loadURL('https://emehmon.uz/listok');
    let result;
    try {
      result = await win.webContents.executeJavaScript(buildDepartureCheckScript(payload), true);
    } catch (e) {
      result = { status: 'error', message: e.message };
    }
    const status = (result && result.status) || 'error';
    if (status === 'need_login') {
      win.show(); win.focus();
      safeInjectAutofill(win, payload);
    } else {
      win.hide(); // проверка всегда фоновая
    }
    return result || { status };
  } catch (e) {
    log.error('[emehmon] check failed:', e.message);
    return { status: 'error', message: e.message };
  }
});

// ─── e-mehmon: полная авто-регистрация прибытия (граждане Узбекистана) ────────
// Скрытое окно, полный прогон мастера. Успех → прячем + возвращаем done.
// Любой сбой → показываем окно кассиру с ручным автозаполнением. Регистрации
// сериализованы (autoArrivalChain), чтобы не гонять несколько сразу.
function ensureAutoArrivalWindow(hostelId) {
  const part = emehmonPartition(hostelId);
  const cur = autoArrivalWindows[part];
  if (cur && !cur.isDestroyed()) return cur;
  const win = new BrowserWindow({
    width: 1200, height: 860, parent: mainWindow, show: false,
    title: 'e-mehmon — авто-регистрация',
    autoHideMenuBar: true,
    webPreferences: {
      partition: part, // сессия своего филиала
      contextIsolation: true, nodeIntegration: false, webSecurity: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.on('closed', () => { delete autoArrivalWindows[part]; });
  hardenEmehmonWindow(win, part);
  autoArrivalWindows[part] = win;
  return win;
}

async function runAutoArrival(payload) {
  const win = ensureAutoArrivalWindow(payload && payload.hostelId);
  await win.loadURL('https://emehmon.uz/listok/create-page');
  let result;
  try {
    result = await win.webContents.executeJavaScript(buildAutoArrivalScript(payload), true);
  } catch (e) {
    result = { status: 'error', message: e.message };
  }
  const status = (result && result.status) || 'error';
  if (status === 'done') {
    win.hide();
  } else if (payload.silent) {
    // Тихая фоновая попытка (авто-добор «забытых» местных) — окно НЕ показываем,
    // статус вернётся рендеру, он поставит пометку об ошибке на госте.
    win.hide();
  } else {
    // Проблема — окно кассиру + привычная ручная кнопка «Заполнить из Hostella».
    win.show(); win.focus();
    safeInjectAutofill(win, payload);
  }
  return result || { status };
}

ipcMain.handle('emehmon-arrival-auto', (_event, guest) => {
  const payload = guest || {};
  const run = autoArrivalChain.then(() => runAutoArrival(payload).catch((e) => {
    log.error('[emehmon] auto-arrival failed:', e.message);
    const w = autoArrivalWindows[emehmonPartition(payload.hostelId)];
    if (w && !w.isDestroyed()) w.show();
    return { status: 'error', message: e.message };
  }));
  autoArrivalChain = run.catch(() => {}); // не рвём цепочку на ошибке
  return run;
});

// ─── e-mehmon: проверка паспортных данных (разбор дубликатов клиентов) ───────
// Прогоняет ТОЛЬКО первый шаг мастера прибытия и возвращает вердикт:
//   valid     — портал пустил на следующий шаг, данные есть в госбазе (+officialName)
//   not_found — «topilmadi», такого паспорта/даты рождения в госбазе нет
//   need_login — нужен вход в портал: показываем окно, вход и капчу делает кассир
// Ничего не сохраняет: до кнопки submitForm поток не доходит.
// Проверки сериализованы общей цепочкой с авто-регистрацией — чтобы не гонять
// несколько окон портала разом (владелец просил ручной режим, по одной).
ipcMain.handle('emehmon-passport-check', (_event, payload) => {
  const data = payload || {};
  const run = autoArrivalChain.then(async () => {
    try {
      const win = ensureAutoArrivalWindow(data.hostelId);
      await win.loadURL('https://emehmon.uz/listok/create-page');
      let result;
      try {
        result = await win.webContents.executeJavaScript(buildPassportCheckScript(data), true);
      } catch (e) {
        result = { status: 'error', message: e.message };
      }
      const status = (result && result.status) || 'error';
      if (status === 'need_login') {
        win.show(); win.focus();
        safeInjectAutofill(win, data);
      } else {
        win.hide();
      }
      return result || { status };
    } catch (e) {
      log.error('[emehmon] passport-check failed:', e.message);
      return { status: 'error', message: e.message };
    }
  });
  autoArrivalChain = run.catch(() => {}); // не рвём цепочку на ошибке
  return run;
});

// ─── e-mehmon: массовое выселение ────────────────────────────────────────────
// Выделяет все совпавшие строки /listok и выселяет одной модалкой Chiqish.
// print:true → окно показываем (диалог печати); иначе фон. Проблема → окно всплывает.
ipcMain.handle('emehmon-departure-bulk', async (_event, payload) => {
  const data = payload || {};
  const wantVisible = !!data.print;
  try {
    const win = ensureDepartureWindow(data.hostelId);
    await win.loadURL('https://emehmon.uz/listok');
    if (wantVisible) { win.show(); win.focus(); }
    let result;
    try {
      result = await win.webContents.executeJavaScript(buildDepartureBulkScript(data), true);
    } catch (e) {
      result = { status: 'error', message: e.message };
    }
    const status = (result && result.status) || 'error';
    const needsHuman = ['need_login', 'not_found', 'no_table', 'no_modal',
      'no_button', 'no_checkout_btn', 'error'].includes(status);
    if (needsHuman) {
      win.show(); win.focus();
      safeInjectAutofill(win, { mode: 'departure' });
    } else if (status === 'done' && !wantVisible) {
      win.hide();
    }
    return result || { status };
  } catch (e) {
    log.error('[emehmon] bulk departure failed:', e.message);
    const w = departureWindows[emehmonPartition(data.hostelId)];
    if (w && !w.isDestroyed()) { w.show(); }
    return { status: 'error', message: e.message };
  }
});

// ─── e-mehmon: список зарегистрированных (фоновая синхронизация статусов) ─────
// Загружает /listok текущего аккаунта и возвращает все строки. Окно показываем
// только при необходимости входа; иначе всё в фоне.
ipcMain.handle('emehmon-list', async (_event, payload) => {
  const data = payload || {};
  try {
    const win = ensureDepartureWindow(data.hostelId);
    await win.loadURL('https://emehmon.uz/listok');
    let result;
    try {
      result = await win.webContents.executeJavaScript(buildListFetchScript(), true);
    } catch (e) {
      result = { status: 'error', message: e.message };
    }
    // Список — всегда фоновый: окно не показываем даже при need_login (вход
    // выполняется через окна прибытия/убытия; сессия persist:emehmon общая).
    win.hide();
    return result || { status: (result && result.status) || 'error' };
  } catch (e) {
    log.error('[emehmon] list failed:', e.message);
    return { status: 'error', message: e.message };
  }
});

// Пересчёт стоимости услуг в листках прибытия (фоново, как и список).
// payload: { hostelId, items: [{ passport, name, amount }], paymentStatus }
ipcMain.handle('emehmon-recalc', async (_event, payload) => {
  const data = payload || {};
  try {
    const win = ensureDepartureWindow(data.hostelId);
    await win.loadURL('https://emehmon.uz/listok');
    let result;
    try {
      result = await win.webContents.executeJavaScript(buildRecalcScript(data), true);
    } catch (e) {
      result = { status: 'error', message: e.message };
    }
    win.hide();
    return result || { status: 'error' };
  } catch (e) {
    log.error('[emehmon] recalc failed:', e.message);
    return { status: 'error', message: e.message };
  }
});

// Турсбор: отчёт с /tursborpays за период (фоново, как и список листков).
// payload: { range: 'YYYY-MM-DD ~ YYYY-MM-DD', hostelId }
ipcMain.handle('emehmon-tursbor', async (_event, payload) => {
  const data = payload || {};
  try {
    const win = ensureDepartureWindow(data.hostelId);
    await win.loadURL('https://emehmon.uz/tursborpays');
    let result;
    try {
      result = await win.webContents.executeJavaScript(buildTursborFetchScript(data), true);
    } catch (e) {
      result = { status: 'error', message: e.message };
    }
    win.hide();
    return result || { status: 'error' };
  } catch (e) {
    log.error('[emehmon] tursbor failed:', e.message);
    return { status: 'error', message: e.message };
  }
});

// IPC Handlers for window control
const liveWin = () => (mainWindow && !mainWindow.isDestroyed()) ? mainWindow : null;

ipcMain.handle('window-minimize', () => {
  liveWin()?.minimize();
});

// ─── Pending payments file (offline safety net) ───────────────────────────────
ipcMain.handle('save-pending-payments', (_event, data) => {
  try {
    const file = PENDING_FILE();
    // Пишем только массив и с ограничением размера — не даём рендереру складывать
    // на диск произвольный/огромный объект, который потом читается и доверяется.
    if (!Array.isArray(data) || data.length === 0) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
      return true;
    }
    const serialized = JSON.stringify(data.slice(0, 500), null, 2);
    if (serialized.length > 5 * 1024 * 1024) {
      log.error('save-pending-payments: payload too large, skipped');
      return false;
    }
    fs.writeFileSync(file, serialized, 'utf8');
    return true;
  } catch (e) {
    log.error('save-pending-payments error:', e.message);
    return false;
  }
});

ipcMain.handle('load-pending-payments', () => {
  try {
    const file = PENDING_FILE();
    if (!fs.existsSync(file)) return [];
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    log.error('load-pending-payments error:', e.message);
    return [];
  }
});


ipcMain.handle('window-maximize', () => {
  const w = liveWin();
  if (!w) return;
  if (w.isMaximized()) w.restore(); else w.maximize();
});

ipcMain.handle('window-restore', () => {
  liveWin()?.restore();
});

ipcMain.handle('window-close', () => {
  liveWin()?.close();
});

ipcMain.handle('window-isMaximized', () => {
  return liveWin()?.isMaximized() ?? false;
});

// ─── Booking.com iCal fetch (bypasses CORS from renderer) ───────────────────
// SSRF-защита: только https, запрет обращений на localhost/приватные диапазоны
// (иначе рендерер мог бы заставить main-процесс сканировать локальную сеть).
// Приватный/непубличный IP? Проверяем сам адрес (IPv4 и IPv6), а не строку.
const isPrivateIp = (ip) => {
    const a = String(ip || '').toLowerCase();
    if (!a) return true;
    if (a.includes(':')) { // IPv6
        if (a === '::1' || a === '::') return true;
        if (a.startsWith('fe80') || a.startsWith('fc') || a.startsWith('fd')) return true; // link-local, ULA
        if (a.startsWith('64:ff9b:') || a.startsWith('64:ff9b:1:')) return true;           // NAT64 → внутр. IPv4
        if (a.startsWith('2001:db8:')) return true;                                        // документационный
        const m6 = a.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/); // IPv4-mapped
        if (m6) return isPrivateIp(m6[1]);
        const mHex = a.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);    // IPv4-mapped в hex
        if (mHex) {
            const n = (parseInt(mHex[1], 16) << 16) | parseInt(mHex[2], 16);
            return isPrivateIp(`${(n>>>24)&255}.${(n>>>16)&255}.${(n>>>8)&255}.${n&255}`);
        }
        const mCompat = a.match(/^::(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/); // IPv4-compatible ::x.x.x.x
        if (mCompat) return isPrivateIp(mCompat[1]);
        return false;
    }
    const m = a.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (!m) return true; // после lookup сюда приходит валидный IP; иначе — блок
    const [x, y] = [parseInt(m[1], 10), parseInt(m[2], 10)];
    if (x === 127 || x === 10 || x === 0) return true;
    if (x === 169 && y === 254) return true;               // link-local
    if (x === 192 && y === 168) return true;
    if (x === 172 && y >= 16 && y <= 31) return true;
    if (x === 100 && y >= 64 && y <= 127) return true;     // CGNAT
    if (x >= 224) return true;                             // multicast/reserved
    return false;
};

const isBlockedIcalHost = (hostname) => {
    const h = (hostname || '').toLowerCase();
    if (!h) return true;
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
    // Нестандартные записи IP (integer/hex) минуют dotted-quad проверку — блокируем явно.
    if (/^\d+$/.test(h)) return true;                      // напр. 2130706433 = 127.0.0.1
    if (/^0x[0-9a-f.]+$/i.test(h)) return true;            // напр. 0x7f000001
    // isPrivateIp зовём ТОЛЬКО для литеральных IP: раньше он возвращал true для
    // любого доменного имени (не-IP → true), из-за чего блокировались ВСЕ реальные
    // хосты и фича iCal переставала работать. Домены пропускаем — реальный барьер
    // ставит safeLookup на этапе резолва.
    const bare = h.replace(/^\[|\]$/g, '');                // снять скобки IPv6-литерала
    if (net.isIP(bare) && isPrivateIp(bare)) return true;
    return false;
};

const validateIcalUrl = (raw) => {
    let u;
    try { u = new URL(raw); } catch { return null; }
    if (u.protocol !== 'https:') return null;                  // только https
    if (isBlockedIcalHost(u.hostname)) return null;
    return u;
};

// Пин к проверенному адресу: node подставляет в соединение ровно тот IP, что
// вернул наш lookup, а мы валидируем его здесь → закрывается DNS-rebinding
// (когда attacker.com резолвится в 169.254.169.254 между проверкой и коннектом).
const safeLookup = (hostname, options, callback) => {
    dns.lookup(hostname, options, (err, address, family) => {
        if (err) return callback(err);
        if (Array.isArray(address)) {
            if (address.some((a) => isPrivateIp(a.address))) {
                return callback(new Error('Blocked private address'));
            }
        } else if (isPrivateIp(address)) {
            return callback(new Error('Blocked private address'));
        }
        callback(null, address, family);
    });
};

const ICAL_MAX_BYTES = 5 * 1024 * 1024;   // 5 МБ — календарь не бывает больше
const ICAL_TIMEOUT_MS = 15000;

ipcMain.handle('fetch-ical', (event, url) => {
    return new Promise((resolve, reject) => {
        const MAX_REDIRECTS = 5;
        const doGet = (target, redirectsLeft) => {
            if (redirectsLeft <= 0) { reject('Too many redirects'); return; }
            const u = validateIcalUrl(target);
            if (!u) { reject('Blocked or invalid iCal URL'); return; }
            const req = https.get({
                protocol: u.protocol,
                hostname: u.hostname,
                path: u.pathname + u.search,
                lookup: safeLookup,                    // резолв + блок приватных + пин
                headers: { 'User-Agent': 'Hostella/1.0' },
                timeout: ICAL_TIMEOUT_MS,
            }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    res.resume(); // освобождаем сокет
                    // Резолвим относительный Location и снова валидируем хост.
                    const next = new URL(res.headers.location, u).toString();
                    doGet(next, redirectsLeft - 1);
                    return;
                }
                let data = '';
                let size = 0;
                res.on('data', (chunk) => {
                    size += chunk.length;
                    if (size > ICAL_MAX_BYTES) {
                        req.destroy();
                        reject('iCal response too large');
                        return;
                    }
                    data += chunk;
                });
                res.on('end', () => resolve(data));
            });
            req.on('timeout', () => { req.destroy(); reject('iCal request timeout'); });
            req.on('error', (e) => reject(e.message));
        };
        doGet(url, MAX_REDIRECTS);
    });
});

// ─── Auto-updater events ─────────────────────────────────────────────────────
autoUpdater.on('checking-for-update', () => {
  log.info('Проверка обновлений...');
});

autoUpdater.on('update-available', (info) => {
  log.info('Доступно обновление:', info.version);
  isDownloading = true;
  isUpdateDownloaded = false;
  sendToWindow('update-available', info);
});

autoUpdater.on('update-not-available', () => {
  log.info('Обновлений нет.');
});

autoUpdater.on('download-progress', (progress) => {
  sendToWindow('update-progress', progress);
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Обновление загружено:', info.version);
  isDownloading = false;
  isUpdateDownloaded = true;
  sendToWindow('update-downloaded', info);
  // Сразу пробуем установить, если ПК уже простаивает.
  tryInstallOnIdle('downloaded');
  // И продолжаем проверять раз в минуту, пока не появится простой.
  startIdleInstallWatcher();
});

autoUpdater.on('update-not-available', () => {
  isDownloading = false;
  isUpdateDownloaded = false;
  stopIdleInstallWatcher();
});

autoUpdater.on('error', (err) => {
  log.error('Ошибка обновления:', err.message);
  isDownloading = false;
  stopIdleInstallWatcher();
  sendToWindow('update-error', err.message);
});

// IPC: renderer просит установить обновление
ipcMain.handle('install-update', () => {
  stopIdleInstallWatcher();
  // isSilent=true - без окна NSIS "Далее/Далее/Установить"
  // isForceRunAfter=true - автоматически перезапустить приложение после установки
  autoUpdater.quitAndInstall(true, true);
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  stopIdleInstallWatcher();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});