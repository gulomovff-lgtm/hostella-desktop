const electron = require('electron');
const { app, BrowserWindow, ipcMain, powerMonitor } = electron;
const path = require('path');
const fs = require('fs');
const https = require('https');
const http  = require('http');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

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