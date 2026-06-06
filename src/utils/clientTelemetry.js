import { doc, setDoc } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { APP_VERSION } from '../constants/config';

const BUILD_TS = typeof __BUILD_TS__ !== 'undefined' ? __BUILD_TS__ : '';
const DEVICE_ID_KEY = 'hostella_device_id';

// Стабильный идентификатор устройства — генерируется один раз и хранится локально.
// Позволяет видеть каждую установку отдельно, даже если один логин используется на нескольких ПК.
export const getDeviceId = () => {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = (crypto?.randomUUID?.() || `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return `dev-${Date.now()}`;
  }
};

const isElectron = () =>
  typeof window !== 'undefined' && (
    typeof window.electronAPI !== 'undefined' ||
    /electron/i.test(navigator.userAgent || '')
  );

/**
 * Записывает текущую версию клиента в Firestore (upsert по deviceId).
 * Тихо — не бросает исключений, не блокирует UI.
 * Используется для удалённого контроля: кто на какой версии и когда последний раз заходил.
 */
export const reportClientVersion = async (user) => {
  try {
    const deviceId = getDeviceId();
    await setDoc(
      doc(db, ...PUBLIC_DATA_PATH, 'clientVersions', deviceId),
      {
        deviceId,
        appVersion: APP_VERSION,
        buildTs:    BUILD_TS,
        platform:   isElectron() ? 'desktop' : 'web',
        os:         (navigator.platform || '').slice(0, 40),
        login:      user?.login || 'unknown',
        name:       user?.name  || user?.login || 'unknown',
        role:       user?.role  || 'unknown',
        hostelId:   user?.hostelId || null,
        lastSeenAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('[telemetry] reportClientVersion failed:', e.message);
  }
};
