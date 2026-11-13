const electron = require('electron');
const { app, BrowserWindow, ipcMain, powerMonitor, shell } = electron;
const path = require('path');
const fs = require('fs');
const https = require('https');
const dns = require('dns');
const net = require('net');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const { buildAutofillScript, buildDepartureAutoScript, buildDepartureCheckScript, buildPassportCheckScript, buildListFetchScript, buildTursborFetchScript, buildAutoArrivalScript, buildRecalcScript, buildSheetPrintScript, buildRoomChangeScript } = require('./emehmonAutofill');
const emehmonSheet = require('./emehmonSheet');
const kadastrPortal = require('./kadastrPortal');

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
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;  // регулярная проверка обновлений
const UPDATE_CHECK_MIN_GAP_MS   = 5 * 60 * 1000;  // но не чаще раза в 5 минут
let lastUpdateCheckAt = 0;

/**
 * Проверка обновлений с защитой от частых вызовов. Дёргается из нескольких мест
 * (старт, интервал, фокус окна, пробуждение), поэтому нужен общий тормоз —
 * иначе на каждое переключение окна уходил бы запрос к GitHub.
 */
function checkForUpdatesThrottled(reason) {
  if (isDownloading || isInstallingUpdate) return;
  const now = Date.now();
  if (now - lastUpdateCheckAt < UPDATE_CHECK_MIN_GAP_MS) return;
  lastUpdateCheckAt = now;
  log.info(`[Updater] checking (${reason})`);
  autoUpdater.checkForUpdates().catch(e => log.error('[Updater] check failed:', e.message));
}

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
// Окно программы упало (нехватка памяти, сбой рендерера) — раньше оставался белый
// экран, пока кассир сам не перезапустит программу («не заходит», 07.11.2026).
// Поднимаем окно сами; не чаще 3 раз за 10 минут, чтобы не зациклиться.
const rendererRestarts = [];
function reviveMainWindow(reason) {
  const now = Date.now();
  while (rendererRestarts.length && now - rendererRestarts[0] > 10 * 60 * 1000) rendererRestarts.shift();
  if (rendererRestarts.length >= 3) { log.error('[revive] окно падает слишком часто — не перезапускаю:', reason); return; }
  rendererRestarts.push(now);
  setTimeout(() => {
    try { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload(); } catch (e) { log.error('[revive]', e.message); }
  }, 1000);
}

app.on('render-process-gone', (_e, wc, details) => {
  const reason = details && details.reason ? details.reason : 'unknown';
  reportMainError('electron.render-process-gone', new Error(reason),
    { exitCode: details && details.exitCode, mainWindow: !!(mainWindow && !mainWindow.isDestroyed() && wc === mainWindow.webContents) });
  if (reason !== 'clean-exit' && mainWindow && !mainWindow.isDestroyed() && wc === mainWindow.webContents) reviveMainWindow(reason);
});
app.on('child-process-gone', (_e, details) => {
  // name/serviceName — какой именно процесс (сеть, GPU, звук): без них сбой 07.11 не опознать.
  reportMainError('electron.child-process-gone', new Error(details && details.reason ? details.reason : 'unknown'),
    { type: details && details.type, name: details && details.name, serviceName: details && details.serviceName,
      exitCode: details && details.exitCode });
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
// Скрытые окна портала живут, пока ими пользуются: без дела дольше
// PORTAL_IDLE_MS (и невидимое кассиру) — закрываем. Каждое окно — отдельный
// процесс Chromium с загруженным порталом; до четырёх таких висели всю смену.
// Вход не теряется: куки в постоянной сессии филиала (persist:emehmon-…).
const PORTAL_IDLE_MS = 10 * 60 * 1000;
const portalLastUse = new WeakMap();
const touchPortal = (win) => { portalLastUse.set(win, Date.now()); return win; };

// Сетевой сбой загрузки портала (нет интернета, e-mehmon не отвечает).
const isNetworkError = (e) => /ERR_(CONNECTION|NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|TIMED_OUT|NETWORK|ADDRESS_UNREACHABLE|PROXY|SSL|CERT)/i
  .test(String((e && e.message) || e || ''));

// Окно портала, которое видел кассир, закрыли — возвращаем Hostella наверх.
// Windows отдаёт фокус не владельцу, а следующему окну в стопке: программа
// пряталась за другие окна, и кассиру казалось, что она закрылась (02.11.2026).
const returnFocusOnClose = (win) => {
  let wasVisible = false;
  win.on('close', () => { try { wasVisible = win.isVisible(); } catch (_) { wasVisible = false; } });
  win.on('closed', () => {
    if (!wasVisible || !mainWindow || mainWindow.isDestroyed()) return;
    try {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } catch (_) { /* программа закрывается */ }
  });
  return win;
};
setInterval(() => {
  const now = Date.now();
  for (const pool of [departureWindows, autoArrivalWindows]) {
    for (const part of Object.keys(pool)) {
      const w = pool[part];
      if (!w || w.isDestroyed() || w.isVisible()) continue;
      if (now - (portalLastUse.get(w) || 0) < PORTAL_IDLE_MS) continue;
      try { w.destroy(); } catch (_) { /* уже закрыто */ }
      delete pool[part];
    }
  }
}, 60 * 1000).unref?.();
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

// Без этого Windows не связывает окно с ярлыком установщика (appId в package.json),
// и в панели задач значок мог браться не из программы.
if (process.platform === 'win32' && !isDev) app.setAppUserModelId('com.hostella.app');

// Disable HTTP cache in dev so stale responses from Vite never cause MIME errors
if (isDev) {
  app.commandLine.appendSwitch('disable-http-cache');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    icon: path.join(__dirname, isDev ? '../public/ic.ico' : '../dist/ic.ico'),
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
    // Пустое окно (about:blank) — наши печатные формы: лист в бухгалтерию,
    // листок регистрации, долги — window.open('') + document.write + print().
    // Замок аудита (651fd4e) запрещал их вместе с внешними ссылками, и «Печатать
    // лист» молча не реагировал (window.open возвращал null). Пустое окно —
    // разрешаем, но закрытым: без Node, в песочнице и без права уйти на другой
    // адрес (см. did-create-window ниже). Внешние ссылки — в системный браузер.
    if (!url || url === 'about:blank') {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          parent: mainWindow, autoHideMenuBar: true,
          webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true },
        },
      };
    }
    if (/^https?:/i.test(url)) shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });
  // Окно печати живёт только с тем, что в него записали: любой переход — запрет.
  mainWindow.webContents.on('did-create-window', (child) => {
    try {
      child.setMenuBarVisibility(false);
      child.webContents.on('will-navigate', (e, url) => { if (url && url !== 'about:blank') e.preventDefault(); });
      child.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    } catch (_) { /* окно могло закрыться */ }
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

  // Закрывают программу — окна портала на входе не держат её (lockUntilLogin)
  mainWindow.on('close', () => { appQuitting = true; });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Проверяем обновления через 3 секунды после запуска (только в production)
  if (!isDev) {
    // Тихая проверка/скачивание без пользовательских действий.
    setTimeout(() => checkForUpdatesThrottled('startup'), 3000);
    // Повторно раз в полчаса. Раньше было раз в 2 часа: релиз, вышедший сразу
    // после проверки, ждал до двух часов, и выглядело это как «обновление не
    // приходит, пока не перезапустишь» (перезапуск проверяет через 3 секунды).
    // Старый интервал гасим: createWindow() вызывается и на 'ready', и на 'activate',
    // иначе при пересоздании окна интервалы копились бы.
    if (updateCheckInterval) clearInterval(updateCheckInterval);
    updateCheckInterval = setInterval(() => checkForUpdatesThrottled('interval'), UPDATE_CHECK_INTERVAL_MS);

    // Кассир вернулся к приложению или машина проснулась — хороший момент
    // проверить: именно тогда чаще всего и ждут свежую версию.
    mainWindow.on('focus', () => checkForUpdatesThrottled('focus'));
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
// Портал тянет картинки, шрифты и медиа, которые автоматике не нужны, а на
// слабой кассе два скрытых окна раз в пять минут заметно подвешивают
// интерфейс. Режем их на уровне сессии филиала, но только для СКРЫТЫХ окон и не
// на странице входа: с 29.09.2026 вход портала — белый текст на фоновой
// фотографии, без неё кассир видит белый экран. Капчу не режем никогда.
const portalPageForRequest = (details) => {
  try {
    const wc = details.webContents || (details.webContentsId && electron.webContents.fromId(details.webContentsId));
    if (!wc || wc.isDestroyed()) return { visible: false, login: false };
    const win = BrowserWindow.fromWebContents(wc);
    let login = false;
    try { login = /^\/login\b/i.test(new URL(wc.getURL()).pathname); } catch (_) {}
    return { visible: !!(win && !win.isDestroyed() && win.isVisible()), login };
  } catch (_) {
    return { visible: false, login: false };
  }
};
const lightPartitions = new Set();
const lightenEmehmonSession = (part) => {
  if (lightPartitions.has(part)) return;
  lightPartitions.add(part);
  try {
    electron.session.fromPartition(part).webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, cb) => {
      const t = details.resourceType;
      const heavy = t === 'font' || t === 'media' || (t === 'image' && !/captcha/i.test(details.url || ''));
      // Пока снимается лист убытия, картинки и шрифты нужны: они попадут в PDF.
      if (!heavy || emehmonSheet.isCapturing()) { cb({ cancel: false }); return; }
      const page = portalPageForRequest(details);
      cb({ cancel: !page.visible && !page.login });
    });
  } catch (e) {
    log.warn('[emehmon] не удалось облегчить сессию портала:', e.message);
  }
};

// ─── Вход в портал обязателен (решение владельца 13.11.2026) ────────────────
// Окно портала, которое кассир видит на странице входа, закрыть нельзя:
// крестик выключен, Alt+F4 не срабатывает, сверху подсказка «введите цифры с
// картинки». Вошёл — фоновое окно прячется само, окно кнопки «Вход» закрывается,
// окно ручной регистрации/убытия остаётся (кассир продолжает) с крестиком.
// Программа закрывается как обычно: замок только пока она работает.
let appQuitting = false;
app.on('before-quit', () => { appQuitting = true; });
const isPortalLogin = (win) => {
  try { return /^\/login\b/i.test(new URL(win.webContents.getURL()).pathname); } catch (_) { return false; }
};
const LOGIN_BANNER = "(function(){try{if(document.getElementById('__hostellaLoginLock'))return;var d=document.createElement('div');d.id='__hostellaLoginLock';d.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#e88c40;color:#fff;font:600 15px/1.35 Segoe UI,Arial,sans-serif;padding:10px 16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.25)';d.textContent='Введите цифры с картинки и нажмите «Kirish». Окно закроется само после входа  •  Rasmdagi raqamlarni kiriting va «Kirish» tugmasini bosing. Kirgandan so‘ng oyna o‘zi yopiladi';document.documentElement.appendChild(d);}catch(e){}})()";
const lockUntilLogin = (win) => {
  let locked = false;
  const sync = () => {
    if (win.isDestroyed()) return;
    const onLogin = isPortalLogin(win);
    if (onLogin) {
      locked = true;
      try { win.setClosable(false); } catch (_) {}
      win.webContents.executeJavaScript(LOGIN_BANNER, true).catch(() => {});
      return;
    }
    try { win.setClosable(true); } catch (_) {}
    if (!locked) return;
    locked = false;
    // Вход выполнен
    if (!win.isVisible()) return;
    const after = typeof win.__afterLogin === 'function' ? win.__afterLogin() : 'hide';
    if (after === 'close') { try { win.close(); } catch (_) {} }
    else if (after === 'hide') { try { win.hide(); } catch (_) {} }
  };
  win.webContents.on('did-finish-load', sync);
  win.webContents.on('did-navigate', sync);
  win.webContents.on('did-navigate-in-page', sync);
  win.on('show', sync);
  win.on('close', (e) => {
    if (appQuitting || !mainWindow || mainWindow.isDestroyed()) return;
    if (win.isVisible() && isPortalLogin(win)) {
      e.preventDefault();
      win.webContents.executeJavaScript(LOGIN_BANNER, true).catch(() => {});
      try { win.flashFrame(true); win.focus(); } catch (_) {}
    }
  });
};

const hardenEmehmonWindow = (win, part) => {
  lightenEmehmonSession(part);
  lockUntilLogin(win);
  const blockOffOrigin = (event, url) => {
    if (!isEmehmonUrl(url)) {
      event.preventDefault();
      log.warn('[emehmon] заблокирован переход на', url);
    }
  };
  win.webContents.on('will-navigate', blockOffOrigin);
  // will-redirect ловит HTTP 3xx / meta-refresh, которые will-navigate пропускает.
  win.webContents.on('will-redirect', blockOffOrigin);
  // Всплывающие окна — общий обработчик с мостом Hosti Cloud: только портал;
  // на время снятия листа убытия окно создаётся скрытым (emehmonSheet.js).
  emehmonSheet.installWindowOpenHandler(win, { isAllowedUrl: isEmehmonUrl, partition: part, parent: () => mainWindow, log });
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
    // После входа: окно кнопки «Вход» закрывается, окно регистрации/убытия — остаётся
    emehmonWindow.__afterLogin = () => (((arrivalPayload && arrivalPayload.mode) || '') === 'login' ? 'close' : 'keep');
    returnFocusOnClose(emehmonWindow);
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
      const mode = (arrivalPayload && arrivalPayload.mode) || '';
      if (mode === 'departure' || mode === 'login') return; // только прибытие
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
//  • лист убытия снимается в PDF скрытым окном (emehmonSheet.js) и сохраняется
//    в каталог листов; в рендер уходит base64 — копия в облако, ссылка гостю;
//  • проблема (вход/не найден/неоднозначно) → окно всплывает для ручного завершения.
// Создаёт (или переиспользует) скрытое окно убытия в сессии persist:emehmon.
// По одному скрытому окну на филиал — каждое в своей сессии, поэтому оба
// аккаунта e-mehmon остаются залогинены и переключение филиала ничего не рвёт.
function ensureDepartureWindow(hostelId) {
  const part = emehmonPartition(hostelId);
  const cur = departureWindows[part];
  if (cur && !cur.isDestroyed()) return touchPortal(cur);
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
      ...emehmonSheet.windowWebPreferences(), // заглушка печати до скриптов страницы, и во фреймах
    },
  });
  win.setMenuBarVisibility(false);
  win.on('closed', () => { delete departureWindows[part]; });
  returnFocusOnClose(win);
  // Запираем окно на emehmon.uz. Лист печати (window.open с портала) — только на
  // emehmon.uz и с полным hardening в дочернем окне, см. hardenEmehmonWindow.
  hardenEmehmonWindow(win, part);
  departureWindows[part] = win;
  return touchPortal(win);
}

// Лист убытия: PDF из скрытого окна → файл на этом компьютере (печать без
// сети) и base64 в рендер (копия в облако, ссылка гостю). Ошибка снятия —
// отдельным полем: убытие в госсистеме уже прошло.
const SHEETS_DIR = () => path.join(app.getPath('userData'), 'emehmon-sheets');
const safeSeg = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64) || 'x';
async function saveSheet(got, payload) {
  if (!got || !got.ok) return { sheetError: { code: (got && got.code) || 'no_sheet', message: (got && got.message) || '' } };
  const name = emehmonSheet.sheetFileName({ passport: payload.passport });
  const meta = { name, bytes: got.bytes, at: new Date().toISOString(), source: got.source };
  const sheetBase64 = got.pdf.toString('base64');
  try {
    const dir = path.join(SHEETS_DIR(), safeSeg(payload.hostelId));
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${safeSeg(payload.guestId)}_${name}`);
    fs.writeFileSync(file, got.pdf);
    return { sheet: { ...meta, file }, sheetBase64 };
  } catch (e) {
    log.warn('[emehmon] лист убытия не сохранён на диск:', e.message);
    return { sheet: meta, sheetBase64, sheetError: { code: 'sheet_save', message: e.message } };
  }
}

// Открыть сохранённый лист убытия системным просмотрщиком PDF (печать — оттуда).
// Только файлы из каталога листов: путь приходит из документа гостя.
ipcMain.handle('emehmon-sheet-open', async (_event, file) => {
  try {
    const full = path.resolve(String(file || ''));
    const root = path.resolve(SHEETS_DIR());
    if (!full.startsWith(root + path.sep) || !fs.existsSync(full)) return { ok: false, code: 'missing' };
    const err = await shell.openPath(full);
    return err ? { ok: false, code: 'open', message: err } : { ok: true };
  } catch (e) {
    return { ok: false, code: 'error', message: e.message };
  }
});

// Лист убытия заново — гостю, выведенному раньше или без листа: страница
// выехавших /listokout, строка гостя, кнопка печати портала; окно листа
// скрытое, как при убытии. Ответ — как у выселения: sheet / sheetBase64.
ipcMain.handle('emehmon-sheet-fetch', async (_event, guest) => {
  const payload = guest || {};
  try {
    const win = ensureDepartureWindow(payload.hostelId);
    await win.loadURL('https://emehmon.uz/listokout');
    const cap = emehmonSheet.armSheetCapture(win, { log });
    let result;
    try {
      result = await win.webContents.executeJavaScript(buildSheetPrintScript({ ...payload, sheet: true }), true);
    } catch (e) {
      result = { status: 'error', message: e.message };
    }
    try {
      if (result && result.status === 'printed') {
        const got = await cap.result(result.sheetHtml ? { sheetHtml: result.sheetHtml, sheetIds: result.sheetIds } : { graceMs: 8000 });
        const saved = await saveSheet(got, payload);
        result = saved.sheet ? { status: 'done', ...saved } : { status: 'no_sheet', ...saved };
      }
    } finally {
      cap.dispose();
      if (result) { delete result.sheetHtml; delete result.sheetIds; }
    }
    if (result && result.status === 'need_login') { win.show(); win.focus(); safeInjectAutofill(win, { ...payload, mode: 'departure' }); }
    else win.hide();
    return result || { status: 'error' };
  } catch (e) {
    log.error('[emehmon] sheet fetch failed:', e.message);
    return { status: 'error', message: e.message };
  }
});

ipcMain.handle('emehmon-departure', async (_event, guest) => {
  const payload = guest || {};
  try {
    const win = ensureDepartureWindow(payload.hostelId);
    // Свежая загрузка списка (фолбэк на /login, если не залогинен)
    await win.loadURL('https://emehmon.uz/listok');

    // Лист убытия: окно листа не показываем, печать глушим, лист снимаем в
    // PDF (emehmonSheet.js) — тот же модуль, что в мосте Hosti Cloud.
    const cap = emehmonSheet.armSheetCapture(win, { log });
    let result;
    try {
      result = await win.webContents.executeJavaScript(buildDepartureAutoScript({ ...payload, print: true, sheet: true }), true);
    } catch (e) {
      result = { status: 'error', message: e.message };
    }
    const status = (result && result.status) || 'error';
    try {
      if (status === 'done' || status === 'submitted') {
        // HTML листа приходит из скрипта (перехват $.ajax на /listok/print);
        // без него — прежние пути: окно-потомок, загрузка файла, печать страницы.
        const got = await cap.result(result.sheetHtml ? { sheetHtml: result.sheetHtml, sheetIds: result.sheetIds } : { graceMs: 8000 });
        result = { ...result, ...(await saveSheet(got, payload)) };
      }
    } finally {
      cap.dispose();
      if (result) { delete result.sheetHtml; delete result.sheetIds; }
    }

    const needsHuman = ['need_login', 'not_found', 'multiple', 'no_table',
      'no_modal', 'no_button', 'no_checkout_btn', 'error'].includes(status);
    if (needsHuman) {
      // Показать окно и подмешать ручную панель убытия / автозаполнение логина.
      win.show(); win.focus();
      safeInjectAutofill(win, payload);
    } else if (status === 'done') {
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
  if (cur && !cur.isDestroyed()) return touchPortal(cur);
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
  returnFocusOnClose(win);
  hardenEmehmonWindow(win, part);
  autoArrivalWindows[part] = win;
  return touchPortal(win);
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
  if (status === 'done' || status === 'needs_decision') {
    // needs_decision — мастер дошёл до «Сохранить», но список прошлых
    // проживаний требует решения человека; окно решения покажет рендерер.
    win.hide();
  } else if (payload.silent) {
    // Тихая фоновая попытка (авто-добор «забытых» местных) — окно НЕ показываем,
    // статус вернётся рендеру, он поставит пометку об ошибке на госте.
    win.hide();
  } else if (payload.quietFail && status !== 'need_login') {
    // У рендерера своё окно на этот случай («исправьте данные»/«ситуация») —
    // второе окно портала поверх него только путает кассира.
    win.hide();
  } else {
    // Проблема — окно кассиру + привычная ручная кнопка «Заполнить из Hostella».
    win.show(); win.focus();
    safeInjectAutofill(win, payload);
  }
  return result || { status };
}

// ─── e-mehmon: смена комнаты у активной регистрации ──────────────────────────
// Гость переехал внутри Hostella — в портале меняем комнату, а не выводим и
// регистрируем заново. Скрытое окно /listok, общая цепочка с регистрацией.
// DOM правки портала вживую не видели: при неудаче рендерер получит статус
// и дамп кнопок (probe) для уточнения селекторов.
ipcMain.handle('emehmon-room-change', (_event, payload) => {
  const data = payload || {};
  const run = autoArrivalChain.then(async () => {
    try {
      const win = ensureDepartureWindow(data.hostelId);
      await win.loadURL('https://emehmon.uz/listok');
      let result;
      try {
        result = await win.webContents.executeJavaScript(buildRoomChangeScript(data), true);
      } catch (e) {
        result = { status: 'error', message: e.message };
      }
      if (result && result.status === 'need_login') { win.show(); win.focus(); safeInjectAutofill(win, { ...data, mode: 'departure' }); }
      else win.hide();
      return result || { status: 'error' };
    } catch (e) {
      log.error('[emehmon] room change failed:', e.message);
      return { status: 'error', message: e.message };
    }
  });
  autoArrivalChain = run.catch(() => {}); // не рвём цепочку на ошибке
  return run;
});

ipcMain.handle('emehmon-arrival-auto', (_event, guest) => {
  const payload = guest || {};
  const run = autoArrivalChain.then(() => runAutoArrival(payload).catch((e) => {
    log.error('[emehmon] auto-arrival failed:', e.message);
    const w = autoArrivalWindows[emehmonPartition(payload.hostelId)];
    // Портал не открылся (нет связи) — кассиру в окне делать нечего: раньше
    // пустое окно всплывало на каждой попытке, раз в минуту (02.11.2026).
    if (isNetworkError(e)) {
      if (w && !w.isDestroyed()) w.hide();
      return { status: 'network', message: e.message };
    }
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

// ─── Сайт кадастра (reg.emehmon.uz): вход ЭЦП, листок, оплата ────────────────
// Решение владельца 13.11.2026. Пароль ключа ЭЦП, номер сертификата, кадастр
// и карта по умолчанию — только на этом компьютере, зашифрованы Windows
// (safeStorage/DPAPI). В рендерер уходят лишь «есть / нет» и маска карты.
const KADASTR_FILE = () => path.join(app.getPath('userData'), 'kadastr-settings.bin');
const KADASTR_DEFAULTS = { cert: '79326482', cadMatch: '117.75' };
function readKadastrSettings() {
  try {
    const buf = fs.readFileSync(KADASTR_FILE());
    const json = electron.safeStorage.isEncryptionAvailable() ? electron.safeStorage.decryptString(buf) : '';
    return { ...KADASTR_DEFAULTS, ...(json ? JSON.parse(json) : {}) };
  } catch (_) { return { ...KADASTR_DEFAULTS }; }
}
function writeKadastrSettings(obj) {
  if (!electron.safeStorage.isEncryptionAvailable()) throw new Error('encryption_unavailable');
  fs.writeFileSync(KADASTR_FILE(), electron.safeStorage.encryptString(JSON.stringify(obj)));
}
const digitsOnly = (v) => String(v || '').replace(/\D/g, '');
const cleanCard = (c) => {
  if (!c) return null;
  const number = digitsOnly(c.number), mm = digitsOnly(c.mm).padStart(2, '0').slice(-2), yy = digitsOnly(c.yy).slice(-2);
  let phone = digitsOnly(c.phone);
  if (phone.length === 9) phone = '998' + phone;
  if (number.length !== 16 || !/^(0[1-9]|1[0-2])$/.test(mm) || yy.length !== 2 || phone.length !== 12) return null;
  return { number, mm, yy, phone };
};
const kadastrPublic = (st) => ({
  hasPassword: !!st.eimzoPassword,
  cert: st.cert || '',
  cadMatch: st.cadMatch || '',
  hasCard: !!st.card,
  cardMask: st.card ? '•••• ' + String(st.card.number).slice(-4) : '',
  cardPhoneMask: st.card ? '+' + String(st.card.phone).slice(0, 5) + ' ••• •• ' + String(st.card.phone).slice(-2) : '',
});

ipcMain.handle('kadastr-settings-get', () => kadastrPublic(readKadastrSettings()));
ipcMain.handle('kadastr-settings-set', (_e, patch) => {
  const p = patch || {};
  const st = readKadastrSettings();
  if (typeof p.eimzoPassword === 'string' && p.eimzoPassword) st.eimzoPassword = p.eimzoPassword;
  if (p.clearPassword) delete st.eimzoPassword;
  if (typeof p.cert === 'string' && /^[0-9A-Za-z]{4,40}$/.test(p.cert.trim())) st.cert = p.cert.trim();
  if (typeof p.cadMatch === 'string' && p.cadMatch.trim() && p.cadMatch.length <= 60) st.cadMatch = p.cadMatch.trim();
  if (p.card) { const c = cleanCard(p.card); if (!c) return { ok: false, error: 'bad_card' }; st.card = c; }
  if (p.clearCard) delete st.card;
  try { writeKadastrSettings(st); } catch (e) { return { ok: false, error: e.message }; }
  return { ok: true, ...kadastrPublic(st) };
});

let kadastrWindow = null;
let kadastrChain = Promise.resolve();
let kadastrPayTimer = null;
function ensureKadastrWindow() {
  if (kadastrWindow && !kadastrWindow.isDestroyed()) return kadastrWindow;
  const win = new BrowserWindow({
    width: 1200, height: 900, parent: mainWindow, show: false,
    title: 'Кадастр — регистрация',
    autoHideMenuBar: true,
    webPreferences: { partition: 'persist:kadastr', contextIsolation: true, nodeIntegration: false, webSecurity: true, backgroundThrottling: false },
  });
  win.setMenuBarVisibility(false);
  const block = (event, url) => { if (!kadastrPortal.isKadastrUrl(url)) { event.preventDefault(); log.warn('[kadastr] заблокирован переход на', url); } };
  win.webContents.on('will-navigate', block);
  win.webContents.on('will-redirect', block);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.on('closed', () => { if (kadastrPayTimer) { clearInterval(kadastrPayTimer); kadastrPayTimer = null; } kadastrWindow = null; });
  returnFocusOnClose(win);
  kadastrWindow = win;
  return win;
}
// E-IMZO слушает wss://127.0.0.1:64443 со своим сертификатом — для страницы
// OneID в нашем окне признаём его, больше ничего.
app.on('certificate-error', (event, wc, url, _err, _cert, callback) => {
  try {
    const u = new URL(url);
    if (u.hostname === '127.0.0.1' && u.port === '64443' && kadastrWindow && !kadastrWindow.isDestroyed() && wc === kadastrWindow.webContents) {
      event.preventDefault(); callback(true); return;
    }
  } catch (_) {}
  callback(false);
});
const onListovka = (win) => {
  try { const u = new URL(win.webContents.getURL()); return u.hostname === 'reg.emehmon.uz' && u.pathname.indexOf('/listovka') === 0; } catch (_) { return false; }
};
const waitUntil = async (fn, ms, gap = 500) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { try { if (await fn()) return true; } catch (_) {} await new Promise(r => setTimeout(r, gap)); }
  return false;
};
// Вход: /listovka открылась — уже вошли. Иначе OneID → ключ → пароль E-IMZO.
async function kadastrLogin(win, st) {
  await win.loadURL(kadastrPortal.KADASTR_ORIGIN + '/listovka').catch(() => {});
  if (onListovka(win)) return 'ok';
  if (!st.eimzoPassword) return 'no_password';
  // Вход в фоне (просьба владельца 13.11.2026): окно сайта скрыто, на экране
  // мелькает только окно пароля E-IMZO, и его заполняет программа.
  await win.loadURL(kadastrPortal.KADASTR_ORIGIN + '/auth/oneid').catch(() => {});
  // OneID может помнить вход и сразу вернуть на сайт кадастра, минуя страницу
  // ключей (журнал 13.11.2026: «not_oneid» — ждали OneID, а были уже на сайте)
  const hostNow = () => { try { return new URL(win.webContents.getURL()).hostname; } catch (_) { return ''; } };
  const pathNow = () => { try { return new URL(win.webContents.getURL()).pathname; } catch (_) { return ''; } };
  await waitUntil(() => /id\.egov\.uz$/.test(hostNow()) ||
    (hostNow() === 'reg.emehmon.uz' && !/^\/(login|auth)/.test(pathNow())), 30000);
  if (hostNow() === 'reg.emehmon.uz') {
    if (!onListovka(win)) await win.loadURL(kadastrPortal.KADASTR_ORIGIN + '/listovka').catch(() => {});
    if (onListovka(win)) return 'ok';
  }
  if (!/id\.egov\.uz$/.test(hostNow())) return 'oneid_not_opened:' + hostNow() + pathNow();
  let r;
  try { r = await win.webContents.executeJavaScript(kadastrPortal.buildOneIdLoginScript({ cert: st.cert }), true); }
  catch (e) { r = { status: 'error', message: e.message }; }
  if (!r || r.status !== 'clicked') return (r && r.status) || 'oneid_error';
  const typed = await kadastrPortal.typeEimzoPassword(st.eimzoPassword, { waitSec: 45, log, scriptDir: app.getPath('userData') });
  if (typed !== 'typed') { log.warn('[kadastr] пароль ЭЦП:', typed); return 'eimzo_' + typed; }
  const back = await waitUntil(() => new URL(win.webContents.getURL()).hostname === 'reg.emehmon.uz', 60000);
  if (!back) return 'oneid_timeout';
  if (!onListovka(win)) await win.loadURL(kadastrPortal.KADASTR_ORIGIN + '/listovka').catch(() => {});
  return onListovka(win) ? 'ok' : 'login_failed';
}
// Оплата: карта вписана и «Оплатить» нажат — дальше SMS-код вводит кассир.
// Успех ловим по окну сайта и сообщаем рендереру.
async function kadastrFillPayment(win, card, payUrl) {
  win.show(); win.focus();
  let r = { status: 'manual' };
  if (card) {
    try { r = await win.webContents.executeJavaScript(kadastrPortal.buildPayFillScript(card), true); }
    catch (e) { r = { status: 'error', message: e.message }; }
  }
  if (kadastrPayTimer) clearInterval(kadastrPayTimer);
  const started = Date.now();
  kadastrPayTimer = setInterval(() => {
    if (!win || win.isDestroyed() || Date.now() - started > 30 * 60 * 1000) { clearInterval(kadastrPayTimer); kadastrPayTimer = null; return; }
    win.webContents.executeJavaScript(kadastrPortal.PAY_DONE_CHECK, true).then((done) => {
      if (!done) return;
      clearInterval(kadastrPayTimer); kadastrPayTimer = null;
      try { mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.send('kadastr-paid', { payUrl }); } catch (_) {}
      setTimeout(() => { try { if (win && !win.isDestroyed()) win.hide(); } catch (_) {} }, 2500);
    }).catch(() => {});
  }, 1000);
  return r;
}
// Список листков сайта для сверки с Hostella. Вход — в фоне, если нужно.
// Программа зовёт это после запуска и раз в час (useKadastrSync): так касса
// держит вход в кадастр и сама поправляет дни/недостающие записи.
ipcMain.handle('kadastr-list', (_e, payload) => {
  const data = payload || {};
  const run = kadastrChain.then(async () => {
    const st = readKadastrSettings();
    if (!st.eimzoPassword) return { status: 'no_password' };
    const win = ensureKadastrWindow();
    if (!onListovka(win)) {
      const login = await kadastrLogin(win, st);
      if (login !== 'ok') return { status: 'need_login', reason: login };
    }
    let r;
    try { r = await win.webContents.executeJavaScript(kadastrPortal.buildListFetchScript({ length: data.length }), true); }
    catch (e) { r = { status: 'error', message: e.message }; }
    if (r && r.status === 'need_login') {
      const login = await kadastrLogin(win, st);
      if (login !== 'ok') return { status: 'need_login', reason: login };
      try { r = await win.webContents.executeJavaScript(kadastrPortal.buildListFetchScript({ length: data.length }), true); }
      catch (e) { r = { status: 'error', message: e.message }; }
    }
    if (r && Array.isArray(r.rows)) r.rows = r.rows.map(x => ({ ...x, payUrl: kadastrPortal.safePayUrl(x.payUrl) }));
    return r || { status: 'error' };
  });
  kadastrChain = run.catch(() => {});
  return run;
});

const resolveCard = (req, st) => (req === 'default' ? (st.card || null) : cleanCard(req));

ipcMain.handle('kadastr-register', (_e, payload) => {
  const data = payload || {};
  const run = kadastrChain.then(async () => {
    const st = readKadastrSettings();
    const win = ensureKadastrWindow();
    try {
      const login = await kadastrLogin(win, st);
      if (login !== 'ok') return { status: 'need_login', reason: login };
      let r;
      try {
        r = await win.webContents.executeJavaScript(kadastrPortal.buildListovkaScript({
          iso3: data.iso3, birth: data.birth, passport: data.passport, pspDate: data.pspDate,
          issuedBy: data.issuedBy, days: Number(data.days) || 0, cadMatch: st.cadMatch, dryRun: !!data.dryRun, fitMax: true,
        }), true);
      } catch (e) { r = { status: 'error', message: e.message }; }
      if (!r || r.status !== 'saved') { win.show(); return r || { status: 'error' }; }
      const payUrl = kadastrPortal.safePayUrl(r.payUrl);
      const pay = await kadastrFillPayment(win, resolveCard(data.card, st), payUrl);
      return { ...r, payUrl, pay: pay && pay.status, payMessage: pay && pay.message, payAmount: pay && pay.amount };
    } catch (e) {
      log.error('[kadastr] register failed:', e.message);
      try { win.show(); } catch (_) {}
      return { status: 'error', message: e.message };
    }
  });
  kadastrChain = run.catch(() => {});
  return run;
});

// Вход в кадастр по кнопке и состояние входа для экрана кадастра.
// Пароль ЭЦП задан — вход в фоне; не задан — окно OneID кассиру (ключ и
// пароль E-IMZO вводит человек), после входа окно прячется.
ipcMain.handle('kadastr-status', () => {
  const st = readKadastrSettings();
  return { loggedIn: !!(kadastrWindow && !kadastrWindow.isDestroyed() && onListovka(kadastrWindow)), hasPassword: !!st.eimzoPassword };
});
ipcMain.handle('kadastr-login', () => {
  const run = kadastrChain.then(async () => {
    const st = readKadastrSettings();
    const win = ensureKadastrWindow();
    if (st.eimzoPassword) {
      const r = await kadastrLogin(win, st);
      return { status: r === 'ok' ? 'ok' : 'need_login', reason: r };
    }
    await win.loadURL(kadastrPortal.KADASTR_ORIGIN + '/listovka').catch(() => {});
    if (onListovka(win)) return { status: 'ok' };
    await win.loadURL(kadastrPortal.KADASTR_ORIGIN + '/auth/oneid').catch(() => {});
    win.show(); win.focus();
    const ok = await waitUntil(() => onListovka(win) || (() => { try { const u = new URL(win.webContents.getURL()); return u.hostname === 'reg.emehmon.uz' && !/^\/(login|auth)/.test(u.pathname); } catch (_) { return false; } })(), 5 * 60 * 1000, 1000);
    if (ok && !onListovka(win)) await win.loadURL(kadastrPortal.KADASTR_ORIGIN + '/listovka').catch(() => {});
    if (onListovka(win)) { win.hide(); return { status: 'ok' }; }
    return { status: 'need_login', reason: 'manual_timeout' };
  });
  kadastrChain = run.catch(() => {});
  return run;
});

// «Оплатить» позже (окно оплаты живёт 24 часа): открыть листок и вписать карту
ipcMain.handle('kadastr-open-pay', (_e, payload) => {
  const data = payload || {};
  const run = kadastrChain.then(async () => {
    const payUrl = kadastrPortal.safePayUrl(data.payUrl);
    if (!payUrl) return { status: 'bad_url' };
    const st = readKadastrSettings();
    const win = ensureKadastrWindow();
    const login = await kadastrLogin(win, st);
    if (login !== 'ok') return { status: 'need_login', reason: login };
    try { await win.webContents.executeJavaScript('JPView(' + JSON.stringify(payUrl) + ', "To`lash"); true', true); }
    catch (e) { return { status: 'error', message: e.message }; }
    const pay = await kadastrFillPayment(win, resolveCard(data.card, st), payUrl);
    return { status: 'opened', pay: pay && pay.status, payMessage: pay && pay.message, payAmount: pay && pay.amount };
  });
  kadastrChain = run.catch(() => {});
  return run;
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

// Машина проснулась после сна — за это время вполне мог выйти релиз.
powerMonitor.on('resume', () => {
  if (!isDev) setTimeout(() => checkForUpdatesThrottled('resume'), 5000);
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