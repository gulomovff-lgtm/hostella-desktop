import { useEffect, useState } from 'react';
import { logSystemError } from '../utils/auditLog';
import { reportClientVersion } from '../utils/clientTelemetry';
import { APP_VERSION, MIN_REQUIRED_VERSION } from '../constants/config';

/**
 * useSystemHealth — «здоровье» клиента: версия и ошибки.
 *
 * Собирает в одном месте четыре вещи, которые раньше были размазаны по App.jsx:
 *  1. Проверку минимальной версии при старте (устаревший клиент блокируется).
 *  2. Телеметрию: какая версия запущена у кассы и когда заходили.
 *  3. Глобальный перехват ошибок JS и необработанных промисов.
 *  4. Сбои главного процесса Electron — они приходят по IPC и уходят тем же
 *     путём, что и ошибки интерфейса: мгновенным алертом в Telegram.
 *
 * Всё, что сюда попадает, идёт в logSystemError → журнал + Telegram.
 *
 * @param {object|null} currentUser — вошедший пользователь (для телеметрии)
 * @param {function} versionLt — сравнение версий (из App: '0.13.4' < '0.14.0')
 * @returns {{ remoteVersionInfo: object|null, versionBlocked: boolean }}
 */
export function useSystemHealth({ currentUser, versionLt }) {
  const [remoteVersionInfo, setRemoteVersionInfo] = useState(null);
  const [versionBlocked, setVersionBlocked] = useState(false);

  // 1. Минимальная версия: сервер может потребовать обновиться
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`/version.json?_t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        setRemoteVersionInfo(data);
        const minVer = data.minVersion || MIN_REQUIRED_VERSION;
        if (versionLt(APP_VERSION, minVer)) {
          setVersionBlocked(true);
          logSystemError('version_check', `App ${APP_VERSION} < required ${minVer}`, {
            appVersion: APP_VERSION, minVersion: minVer,
          });
        }
      } catch (e) {
        // Сетевая ошибка — не блокируем приложение, просто предупреждаем
        console.warn('[version] check failed:', e.message);
      }
    };
    check();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Телеметрия версии: при входе и раз в 30 минут
  useEffect(() => {
    if (!currentUser?.login) return;
    reportClientVersion(currentUser);
    const id = setInterval(() => reportClientVersion(currentUser), 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [currentUser?.login, currentUser?.hostelId, currentUser?.role]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3. Ошибки JS и необработанные промисы
  useEffect(() => {
    const onError = (e) => {
      // Ошибки сторонних скриптов приходят без деталей (cross-origin) — толку ноль
      if (!e.filename || e.message === 'Script error.') return;
      logSystemError('window.onerror', e.error || new Error(e.message), {
        filename: e.filename, lineno: e.lineno, colno: e.colno,
      });
    };
    const onUnhandled = (e) => {
      if (!e.reason) return;
      logSystemError('unhandledrejection', e.reason, {});
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandled);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandled);
    };
  }, []);

  // 4. Сбои главного процесса Electron (+ накопленные, если окно тогда умерло)
  useEffect(() => {
    if (!window.electronAPI?.onMainError) return;

    const toError = (payload) => {
      const err = new Error(payload?.message || 'сбой главного процесса');
      if (payload?.stack) err.stack = payload.stack;
      return err;
    };

    window.electronAPI.onMainError((payload) => {
      if (!payload) return;
      logSystemError(payload.context || 'electron.main', toError(payload), {
        at: payload.at, exitCode: payload.exitCode, type: payload.type,
      });
    });

    window.electronAPI.takePendingErrors?.()
      .then(list => (list || []).forEach(p => {
        logSystemError(`${p.context || 'electron.main'} (прошлый запуск)`, toError(p), { at: p.at });
      }))
      .catch(() => { /* файла нет — нечего слать */ });
  }, []);

  return { remoteVersionInfo, versionBlocked };
}
