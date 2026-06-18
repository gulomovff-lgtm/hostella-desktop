/**
 * session.js — управление пользовательскими сессиями в Firestore.
 * Каждая сессия — документ в коллекции `sessions`.
 * При логине создаётся сессия, при logout — закрывается.
 * Хартбит каждые 30с обновляет lastSeen.
 *
 * Механизм борьбы с "зависшими" сессиями (закрытая вкладка/Electron без logout):
 *  - При каждом createSession в localStorage сохраняется { sessionId, userId }
 *  - При следующем createSession для того же юзера — предыдущая сессия закрывается
 *  - При closeSession localStorage-запись удаляется (нормальный logout)
 */
import { addDoc, updateDoc, doc, collection, writeBatch } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';

const SESSION_KEY  = 'hostella_session_id';
export const LOGIN_AT_KEY = 'hostella_login_at';

/**
 * Сессия считается "мёртвой", если хартбита (lastSeen) не было дольше этого порога.
 * Хартбит идёт каждые 30с, поэтому 15 мин — заведомо закрытая вкладка/выключенный ноут,
 * с запасом на кратковременный сон устройства и сетевые перебои.
 */
export const ABANDONED_SESSION_MS = 15 * 60 * 1000;

/** localStorage-ключ для восстановления sessionId после перезапуска вкладки/приложения */
const PREV_SESSION_LS_KEY = 'hostella_prev_session';

/**
 * Получает IP и геолокацию через ipwho.is (бесплатный API, без ключа, HTTPS).
 * Возвращает null при ошибке/офлайн — не блокирует создание сессии.
 */
export const getNetworkInfo = async () => {
  try {
    const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success) return null;
    return {
      ip:      data.ip      || null,
      city:    data.city    || null,
      region:  data.region  || null,
      country: data.country || null,
      countryCode: data.country_code || null,
    };
  } catch {
    return null;
  }
};

/** Определяет браузер и ОС из userAgent */
export const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  if (/Electron/.test(ua))     browser = 'Electron App';
  else if (/Edg/.test(ua))     browser = 'Edge';
  else if (/Chrome/.test(ua))  browser = 'Chrome';
  else if (/Firefox/.test(ua)) browser = 'Firefox';
  else if (/Safari/.test(ua))  browser = 'Safari';

  let os = 'Unknown';
  if (/Windows/.test(ua))                        os = 'Windows';
  else if (/Mac/.test(ua))                       os = 'macOS';
  else if (/Android/.test(ua))                   os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua))          os = 'iOS';
  else if (/Linux/.test(ua))                     os = 'Linux';

  return { browser, os, userAgent: ua.slice(0, 250) };
};

/**
 * Создаёт документ сессии в Firestore и сохраняет sessionId в sessionStorage.
 * Перед созданием закрывает предыдущую "зависшую" сессию этого же юзера (если есть).
 * @param {object} user — текущий пользователь приложения
 */
export const createSession = async (user) => {
  const loginAt = new Date().toISOString();
  sessionStorage.setItem(LOGIN_AT_KEY, loginAt);

  const userId = user.id || user.login || 'unknown';

  // Закрываем предыдущую сессию этого юзера (если вкладка закрылась без logout)
  try {
    const prevRaw = localStorage.getItem(PREV_SESSION_LS_KEY);
    if (prevRaw) {
      const { sessionId: prevId, userId: prevUserId } = JSON.parse(prevRaw);
      if (prevId && prevUserId === userId) {
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'sessions', prevId), {
          active:   false,
          logoutAt: loginAt,
        });
      }
    }
  } catch { /* silent — предыдущий документ может уже не существовать */ }

  // Запрашиваем IP/геолокацию параллельно — не блокируем создание сессии
  const networkInfo = await getNetworkInfo();

  try {
    const ref = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'sessions'), {
      userId,
      userName:    user.name  || user.login || 'unknown',
      hostelId:    user.hostelId || null,
      role:        user.role  || 'unknown',
      deviceInfo:  getDeviceInfo(),
      networkInfo: networkInfo || null,
      loginAt,
      lastSeen:    loginAt,
      active:      true,
    });
    sessionStorage.setItem(SESSION_KEY, ref.id);
    // Сохраняем в localStorage для очистки при следующем логине
    localStorage.setItem(PREV_SESSION_LS_KEY, JSON.stringify({ sessionId: ref.id, userId }));
  } catch (e) {
    console.warn('[session] createSession failed:', e.message);
  }
};

/**
 * Закрывает текущую сессию в Firestore и удаляет ключи из sessionStorage/localStorage.
 */
export const closeSession = async () => {
  const sessionId = sessionStorage.getItem(SESSION_KEY);
  if (sessionId) {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'sessions', sessionId), {
        active:   false,
        logoutAt: new Date().toISOString(),
      });
    } catch { /* silent */ }
    sessionStorage.removeItem(SESSION_KEY);
    // Нормальный logout — убираем localStorage-запись (сессия корректно закрыта)
    localStorage.removeItem(PREV_SESSION_LS_KEY);
  }
  sessionStorage.removeItem(LOGIN_AT_KEY);
};

/**
 * Обновляет lastSeen текущей сессии (вызывается по таймеру).
 * Заодно переподтверждает active:true — если сессию ошибочно закрыли авто-очисткой,
 * пока устройство спало, живой хартбит её "оживит".
 */
export const heartbeatSession = async () => {
  const sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) return;
  try {
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'sessions', sessionId), {
      lastSeen: new Date().toISOString(),
      active:   true,
    });
  } catch { /* silent */ }
};

// Сессии, для которых уже отправили закрытие — чтобы не писать повторно
// в окне до прихода свежего снапшота.
const _closeAttempted = new Set();

/**
 * Авто-закрывает "зависшие" сессии: active:true, но без хартбита дольше порога.
 * Нужно потому, что closeSession() при закрытии вкладки/выключении ноута часто
 * не успевает долететь до Firestore. logoutAt ставим = последней активности
 * (lastSeen), а не "сейчас" — так время выхода отражает реальный конец работы.
 * @param {Array} sessions — массив сессий из снапшота Firestore
 * @returns {Promise<number>} сколько сессий закрыто
 */
export const closeAbandonedSessions = async (sessions, { thresholdMs = ABANDONED_SESSION_MS } = {}) => {
  const ownId = sessionStorage.getItem(SESSION_KEY);
  const now = Date.now();
  const stale = (sessions || []).filter(s =>
    s.active &&
    s.id !== ownId &&                       // свою текущую сессию не трогаем
    !_closeAttempted.has(s.id) &&
    (!s.lastSeen || now - new Date(s.lastSeen).getTime() > thresholdMs)
  );
  if (!stale.length) return 0;
  stale.forEach(s => _closeAttempted.add(s.id));

  const nowIso = new Date().toISOString();
  let closed = 0;
  // Firestore batch: максимум 500 операций
  for (let i = 0; i < stale.length; i += 490) {
    const chunk = stale.slice(i, i + 490);
    const batch = writeBatch(db);
    for (const s of chunk) {
      batch.update(doc(db, ...PUBLIC_DATA_PATH, 'sessions', s.id), {
        active:   false,
        logoutAt: s.lastSeen || nowIso,
      });
    }
    try { await batch.commit(); closed += chunk.length; }
    catch (e) { console.warn('[session] closeAbandonedSessions batch failed:', e.message); }
  }
  return closed;
};

/** Возвращает ISO-строку времени входа из sessionStorage. */
export const getLoginAt = () => sessionStorage.getItem(LOGIN_AT_KEY);
