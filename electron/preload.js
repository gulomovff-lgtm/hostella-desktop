const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize:     () => ipcRenderer.invoke('window-minimize'),
  maximize:     () => ipcRenderer.invoke('window-maximize'),
  restore:      () => ipcRenderer.invoke('window-restore'),
  close:        () => ipcRenderer.invoke('window-close'),
  isMaximized:  () => ipcRenderer.invoke('window-isMaximized'),
  fetchIcal:    (url) => ipcRenderer.invoke('fetch-ical', url),

  // Auto-updater
  onUpdateAvailable:  (cb) => ipcRenderer.on('update-available',  (_e, info) => cb(info)),
  onUpdateProgress:   (cb) => ipcRenderer.on('update-progress',   (_e, p)    => cb(p)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_e, info) => cb(info)),
  onUpdateError:      (cb) => ipcRenderer.on('update-error',      (_e, msg)  => cb(msg)),
  installUpdate:      () => ipcRenderer.invoke('install-update'),
});
