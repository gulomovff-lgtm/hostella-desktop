const electron = require('electron');
const { app, BrowserWindow, ipcMain } = electron;
const path = require('path');
const https = require('https');
const http  = require('http');

let mainWindow;

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