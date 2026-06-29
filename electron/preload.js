const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimize:     () => ipcRenderer.invoke('window-minimize'),
  maximize:     () => ipcRenderer.invoke('window-maximize'),
  restore:      () => ipcRenderer.invoke('window-restore'),
  close:        () => ipcRenderer.invoke('window-close'),
  isMaximized:  () => ipcRenderer.invoke('window-isMaximized'),
  fetchIcal:    (url) => ipcRenderer.invoke('fetch-ical', url),

  // e-mehmon: открыть окно регистрации иностранца с автозаполнением
  // (логин/пароль приходят в guest из облака; выбор по филиалу гостя)
  openEmehmon:  (guest) => ipcRenderer.invoke('open-emehmon', guest),
  // e-mehmon: фоновое выселение (возвращает статус: done/need_login/not_found/…)
  emehmonDeparture: (guest) => ipcRenderer.invoke('emehmon-departure', guest),
  // e-mehmon: проверка, активен ли гость в /listok (present/absent/need_login/…)
  emehmonCheck: (guest) => ipcRenderer.invoke('emehmon-check', guest),
  // e-mehmon: весь список /listok для синхронизации статусов регистрации
  emehmonList: (payload) => ipcRenderer.invoke('emehmon-list', payload),

  // Pending payments (offline safety net)
  savePendingPayments: (data) => ipcRenderer.invoke('save-pending-payments', data),
  loadPendingPayments: ()     => ipcRenderer.invoke('load-pending-payments'),

  // Auto-updater
  onUpdateAvailable:  (cb) => ipcRenderer.on('update-available',  (_e, info) => cb(info)),
  onUpdateProgress:   (cb) => ipcRenderer.on('update-progress',   (_e, p)    => cb(p)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_e, info) => cb(info)),
  onUpdateError:      (cb) => ipcRenderer.on('update-error',      (_e, msg)  => cb(msg)),
  installUpdate:      () => ipcRenderer.invoke('install-update'),
});
