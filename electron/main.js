const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Проверка: упаковано приложение или нет (вместо electron-is-dev)
const isDev = !app.isPackaged; 

// Логирование
const log = require('electron-log');
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
	autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, 
      webSecurity: false // Помогает, если локальные картинки не грузятся
    },
    // Убедитесь, что иконка существует, или удалите эту строку, если её нет
    // icon: path.join(__dirname, '../public/icon.ico') 
  });

  // В разработке - localhost, в сборке - файл index.html
  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.on('closed', () => (mainWindow = null));
  
  // Проверяем обновления только в готовом приложении
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
autoUpdater.on('update-available', () => {
  log.info('Обновление найдено. Скачиваем...');
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Доступно обновление',
    message: 'Новая версия скачана. Перезапустить и установить?',
    buttons: ['Да', 'Позже']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });
});

autoUpdater.on('error', (err) => {
  log.error('Ошибка обновления: ', err);
});