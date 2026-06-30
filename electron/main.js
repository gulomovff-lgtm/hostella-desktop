const electron = require('electron');
const { app, BrowserWindow, ipcMain, powerMonitor } = electron;
const path = require('path');
const fs = require('fs');
const https = require('https');
const http  = require('http');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const { buildAutofillScript, buildDepartureAutoScript, buildDepartureCheckScript, buildListFetchScript, buildDepartureBulkScript } = require('./emehmonAutofill');

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

let mainWindow;
let emehmonWindow = null;
let arrivalPayload = null; // текущий payload окна прибытия (для авто-галочки на нужного гостя)
let departureWindow = null;
let isDownloading = false;
let isUpdateDownloaded = false;
let isInstallingUpdate = false;
let idleInstallInterval = null;

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
      webSecurity: false,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
    },
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
    // Повторно каждые 2 часа (только если не идёт скачивание)
    setInterval(() => {
      if (!isDownloading) autoUpdater.checkForUpdates();
    }, 2 * 60 * 60 * 1000);
  }
}

// ─── e-mehmon: встроенное окно регистрации иностранцев ──────────────────────
// Открывает дочернее окно с порталом e-mehmon в отдельной постоянной сессии
// (логин/капча сохраняются) и инжектит автозаполнение. Логин/пароль приходят
// в payload из облака (Firebase, выбор по филиалу гостя) — см. src/utils/emehmon.js.
ipcMain.handle('open-emehmon', (_event, guest) => {
  try {
    arrivalPayload = guest || {};
    const payload = arrivalPayload;

    if (emehmonWindow && !emehmonWindow.isDestroyed()) {
      emehmonWindow.focus();
      // окно переиспользуется — обновляем данные/кнопку под нового гостя
      emehmonWindow.webContents.executeJavaScript(buildAutofillScript(payload)).catch(() => {});
      return true;
    }
    emehmonWindow = new BrowserWindow({
      width: 1200,
      height: 860,
      parent: mainWindow,
      title: 'e-mehmon — регистрация иностранцев',
      autoHideMenuBar: true,
      webPreferences: {
        partition: 'persist:emehmon', // отдельная сессия с сохранением логина
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    });
    emehmonWindow.setMenuBarVisibility(false);
    // Прибытие → create-page, убытие → /listok. Если не залогинен, портал уведёт
    // на /login, после входа скрипт авто-редиректит на нужную страницу.
    emehmonWindow.loadURL('https://emehmon.uz' + (payload.path || '/listok/create-page'));

    const inject = () => {
      emehmonWindow.webContents
        .executeJavaScript(buildAutofillScript(arrivalPayload || payload))
        .catch((err) => log.error('[emehmon] inject failed:', err.message));
    };
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
function ensureDepartureWindow() {
  if (departureWindow && !departureWindow.isDestroyed()) return departureWindow;
  departureWindow = new BrowserWindow({
    width: 1200,
    height: 860,
    parent: mainWindow,
    show: false,
    title: 'e-mehmon — убытие',
    autoHideMenuBar: true,
    webPreferences: {
      partition: 'persist:emehmon', // та же сессия, что и окно прибытия
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  departureWindow.setMenuBarVisibility(false);
  departureWindow.on('closed', () => { departureWindow = null; });
  // e-mehmon при печати открывает лист убытия отдельным окном — показываем его.
  departureWindow.webContents.setWindowOpenHandler(() => ({
    action: 'allow',
    overrideBrowserWindowOptions: {
      parent: mainWindow,
      autoHideMenuBar: true,
      webPreferences: { partition: 'persist:emehmon' },
    },
  }));
  return departureWindow;
}

ipcMain.handle('emehmon-departure', async (_event, guest) => {
  const payload = guest || {};
  const wantVisible = !!payload.print;
  try {
    const win = ensureDepartureWindow();
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
      win.webContents.executeJavaScript(buildAutofillScript(payload)).catch(() => {});
    } else if (status === 'done' && !wantVisible) {
      win.hide(); // успех в фоне — прячем (окно переиспользуется при след. выселении)
    }

    return result || { status };
  } catch (e) {
    log.error('[emehmon] departure failed:', e.message);
    if (departureWindow && !departureWindow.isDestroyed()) { departureWindow.show(); }
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
    const win = ensureDepartureWindow();
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
      win.webContents.executeJavaScript(buildAutofillScript(payload)).catch(() => {});
    } else {
      win.hide(); // проверка всегда фоновая
    }
    return result || { status };
  } catch (e) {
    log.error('[emehmon] check failed:', e.message);
    return { status: 'error', message: e.message };
  }
});

// ─── e-mehmon: массовое выселение ────────────────────────────────────────────
// Выделяет все совпавшие строки /listok и выселяет одной модалкой Chiqish.
// print:true → окно показываем (диалог печати); иначе фон. Проблема → окно всплывает.
ipcMain.handle('emehmon-departure-bulk', async (_event, payload) => {
  const data = payload || {};
  const wantVisible = !!data.print;
  try {
    const win = ensureDepartureWindow();
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
      win.webContents.executeJavaScript(buildAutofillScript({ mode: 'departure' })).catch(() => {});
    } else if (status === 'done' && !wantVisible) {
      win.hide();
    }
    return result || { status };
  } catch (e) {
    log.error('[emehmon] bulk departure failed:', e.message);
    if (departureWindow && !departureWindow.isDestroyed()) { departureWindow.show(); }
    return { status: 'error', message: e.message };
  }
});

// ─── e-mehmon: список зарегистрированных (фоновая синхронизация статусов) ─────
// Загружает /listok текущего аккаунта и возвращает все строки. Окно показываем
// только при необходимости входа; иначе всё в фоне.
ipcMain.handle('emehmon-list', async (_event, payload) => {
  const data = payload || {};
  try {
    const win = ensureDepartureWindow();
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

// IPC Handlers for window control
ipcMain.handle('window-minimize', () => {
  mainWindow.minimize();
});

// ─── Pending payments file (offline safety net) ───────────────────────────────
ipcMain.handle('save-pending-payments', (_event, data) => {
  try {
    const file = PENDING_FILE();
    if (!data || !data.length) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } else {
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    }
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
    return JSON.parse(raw);
  } catch (e) {
    log.error('load-pending-payments error:', e.message);
    return [];
  }
});


ipcMain.handle('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.restore();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.handle('window-restore', () => {
  mainWindow.restore();
});

ipcMain.handle('window-close', () => {
  mainWindow.close();
});

ipcMain.handle('window-isMaximized', () => {
  return mainWindow.isMaximized();
});

// ─── Booking.com iCal fetch (bypasses CORS from renderer) ───────────────────
ipcMain.handle('fetch-ical', (event, url) => {
    return new Promise((resolve, reject) => {
        const MAX_REDIRECTS = 5;
        const doGet = (target, redirectsLeft) => {
            if (redirectsLeft <= 0) { reject('Too many redirects'); return; }
            const lib = target.startsWith('https') ? https : http;
            lib.get(target, { headers: { 'User-Agent': 'Hostella/1.0' } }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    doGet(res.headers.location, redirectsLeft - 1);
                    return;
                }
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => resolve(data));
            }).on('error', e => reject(e.message));
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