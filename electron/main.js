const electron = require('electron');
const { app, BrowserWindow, ipcMain } = electron;
const path = require('path');
const https = require('https');
const http  = require('http');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Направляем логи обновлятора в файл
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
// Не устанавливаем автоматически — спрашиваем пользователя
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow;

function sendToWindow(channel, ...args) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, ...args);
  }
}

const isDev = !app.isPackaged;
const url = isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../dist/index.html')}`;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(url);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Проверяем обновления через 3 секунды после запуска (только в production)
  if (!isDev) {
    setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 3000);
    // Повторно каждые 2 часа
    setInterval(() => autoUpdater.checkForUpdates(), 2 * 60 * 60 * 1000);
  }
}

// IPC Handlers for window control
ipcMain.handle('window-minimize', () => {
  mainWindow.minimize();
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
        const lib = url.startsWith('https') ? https : http;
        const doGet = (target) => {
            lib.get(target, { headers: { 'User-Agent': 'Hostella/1.0' } }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    doGet(res.headers.location);
                    return;
                }
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => resolve(data));
            }).on('error', e => reject(e.message));
        };
        doGet(url);
    });
});

// ─── Auto-updater events ─────────────────────────────────────────────────────
autoUpdater.on('checking-for-update', () => {
  log.info('Проверка обновлений...');
});

autoUpdater.on('update-available', (info) => {
  log.info('Доступно обновление:', info.version);
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
  sendToWindow('update-downloaded', info);
});

autoUpdater.on('error', (err) => {
  log.error('Ошибка обновления:', err.message);
  sendToWindow('update-error', err.message);
});

// IPC: renderer просит установить обновление
ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});