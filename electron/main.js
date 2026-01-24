const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const isDev = require('electron-is-dev');

// Логирование обновлений (опционально, полезно для отладки)
const log = require('electron-log');
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Упрощаем для примера, в проде лучше true + preload
    },
  });

  // В разработке грузим локальный сервер, в проде - файл index.html
  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.on('closed', () => (mainWindow = null));

  // Проверяем обновления сразу после запуска (только в продакшене)
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

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

// --- ЛОГИКА ОБНОВЛЕНИЙ ---

// Есть обновление
autoUpdater.on('update-available', () => {
  log.info('Обновление найдено. Скачиваем...');
});

// Обновление скачано
autoUpdater.on('update-downloaded', () => {
  log.info('Обновление скачано');

  // Спрашиваем пользователя
  dialog.showMessageBox({
    type: 'info',
    title: 'Доступно обновление',
    message: 'Новая версия программы скачана. Перезапустить сейчас для установки?',
    buttons: ['Да', 'Позже']
  }).then((result) => {
    if (result.response === 0) { // Если нажали "Да"
      autoUpdater.quitAndInstall(false, true);
    }
  });
});

autoUpdater.on('error', (err) => {
  log.error('Ошибка обновления: ', err);
});