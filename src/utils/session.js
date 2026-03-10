/**
 * session.js — управление пользовательскими сессиями в Firestore.
 * Каждая сессия — документ в коллекции `sessions`.
 * При логине создаётся сессия, при logout — закрывается.
 * Хартбит каждые 30с обновляет lastSeen.
 */
import { addDoc, updateDoc, doc, collection } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';

const SESSION_KEY  = 'hostella_session_id';
export const LOGIN_AT_KEY = 'hostella_login_at';

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
 * @param {object} user — текущий пользователь приложения
 */
export const createSession = async (user) => {
  const loginAt = new Date().toISOString();
  sessionStorage.setItem(LOGIN_AT_KEY, loginAt);
  try {
    const ref = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'sessions'), {
      userId:     user.id || user.login || 'unknown',
      userName:   user.name  || user.login || 'unknown',
      hostelId:   user.hostelId || null,
      role:       user.role  || 'unknown',
      deviceInfo: getDeviceInfo(),
      loginAt,
      lastSeen:   loginAt,
      active:     true,
    });
    sessionStorage.setItem(SESSION_KEY, ref.id);
  } catch (e) {
    console.warn('[session] createSession failed:', e.message);
  }
};

/**
 * Закрывает текущую сессию в Firestore и удаляет ключи из sessionStorage.
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
  }
  sessionStorage.removeItem(LOGIN_AT_KEY);
};

/**
 * Обновляет lastSeen текущей сессии (вызывается по таймеру).
 */
export const heartbeatSession = async () => {
  const sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) return;
  try {
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'sessions', sessionId), {
      lastSeen: new Date().toISOString(),
    });
  } catch { /* silent */ }
};

/** Возвращает ISO-строку времени входа из sessionStorage. */
export const getLoginAt = () => sessionStorage.getItem(LOGIN_AT_KEY);
