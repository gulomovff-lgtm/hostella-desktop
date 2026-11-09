/**
 * Журнал ошибок — единый учёт сбоев в работе (решение владельца 29.10.2026).
 *
 * Раньше в журнал попадали только падения программы, а сбои работы
 * (e-mehmon, отправка в Telegram, отказ сервера принять запись, залипшая
 * связь, сервер не отвечает) жили в тостах и консоли кассы — их никто не видел.
 *
 * Документ: PUBLIC_DATA_PATH/errorLog/<день>_<тип>_<отпечаток>
 *   kind, context, message, severity, day, count, lastAt, firstAt,
 *   hostelId, user, version, platform, device, details,
 *   resolved / resolvedAt / resolvedBy — отметка супера «разобрано».
 * Одинаковая ошибка за день — одна строка со счётчиком (числа в тексте не
 * различают ошибки: «гость 12» и «гость 15» — одна строка).
 *
 * Пишет пачкой раз в 15 с; до входа (нет пользователя) ждёт в памяти.
 * Сама никогда не бросает и не пишет через fsWrite — иначе отказ записи
 * журнала порождал бы новую ошибку журнала.
 *
 * Важные (severity 'critical') сразу уходят в Telegram — канал ошибок из
 * настроек; остальное — на экране «Ошибки» и в вечерней сводке.
 */
import { doc, setDoc, increment } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { APP_VERSION } from '../constants/config';
import { getDeviceId } from './clientTelemetry';
import { maybeAlertTelegram } from './auditLog';
import { dayKey, errorDocId } from './errorKey';
import { cleanDetails } from './errorSafety';

/** Типы ошибок — на экране и в сводке в этом порядке. */
export const ERROR_KINDS = {
  crash:    'Падение программы',
  server:   'Нет связи с сервером',
  sync:     'Записи не дошли до сервера',
  write:    'Сервер не принял запись',
  emehmon:  'e-mehmon',
  telegram: 'Telegram',
  function: 'Серверная функция',
  other:    'Прочее',
};

const FLUSH_MS = 15 * 1000;
const buffer = new Map();
const written = new Set();
let who = null;         // { id, name, role, hostelId } — ставит App после входа
let timer = null;

export { dayKey, normalizeMessage, hash, errorDocId } from './errorKey';

const toMessage = (e) => {
  if (e == null) return '';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message || String(e);
  return e.message || e.code || e.status || (() => { try { return JSON.stringify(e).slice(0, 300); } catch { return String(e); } })();
};

/** Кто работает — App вызывает после входа и при выходе (null). */
export function setErrorLogUser(user) {
  who = user ? {
    id: user.id || user.login || '', name: user.name || user.login || '',
    role: user.role || '', hostelId: user.hostelId || null,
  } : null;
  if (who) scheduleFlush();
}

const platform = () => (typeof window !== 'undefined' && window.electronAPI ? 'desktop' : 'web');

/**
 * Записать ошибку.
 * @param {string} kind     — ключ ERROR_KINDS
 * @param {string} context  — где именно (короткий ключ: 'emehmon.arrival', 'telegram.send'…)
 * @param {Error|string|object} error
 * @param {object} [details] — гость, комната, статус… (без паспортов и денег)
 * @param {object} [opts]   — { severity: 'critical'|'error'|'warning', hostelId, alertText }
 */
export function reportError(kind, context, error, details = {}, opts = {}) {
  try {
    const k = ERROR_KINDS[kind] ? kind : 'other';
    const message = toMessage(error).slice(0, 500) || '—';
    const severity = opts.severity || 'error';
    const now = new Date();
    const id = errorDocId(k, context, message, now);
    const cur = buffer.get(id);
    if (cur) {
      cur.n += 1; cur.lastAt = now.toISOString(); cur.details = details; cur.message = message;
    } else {
      buffer.set(id, { kind: k, context: String(context || ''), message, severity, day: dayKey(now),
        firstAt: now.toISOString(), lastAt: now.toISOString(), details, hostelId: opts.hostelId || null, n: 1 });
    }
    if (severity === 'critical') {
      maybeAlertTelegram(`${ERROR_KINDS[k]} · ${context}`, opts.alertText || message, details);
    }
    scheduleFlush();
  } catch { /* журнал ошибок не должен ломать работу */ }
}

function scheduleFlush() {
  if (timer || !buffer.size) return;
  timer = setTimeout(() => { timer = null; flushErrorLog(); }, FLUSH_MS);
}

/** Отправить накопленное. До входа — ждёт (правила пускают только сотрудников). */
export function flushErrorLog() {
  if (!who || !buffer.size) return;
  const items = [...buffer.entries()];
  buffer.clear();
  let device = '';
  try { device = getDeviceId().slice(0, 8); } catch { /* нет хранилища */ }
  for (const [id, e] of items) {
    const ref = doc(db, ...PUBLIC_DATA_PATH, 'errorLog', id);
    // Поля без firstAt/resolved: документ мог создать другой компьютер — merge
    // не перетирает его начало и отметку «разобрано».
    const data = {
      kind: e.kind, context: e.context, message: e.message, severity: e.severity, day: e.day,
      count: increment(e.n), lastAt: e.lastAt,
      hostelId: e.hostelId || who.hostelId || null,
      user: who.name, userId: who.id, role: who.role,
      version: APP_VERSION, platform: platform(), device,
      details: cleanDetails(e.details),
    };
    // firstAt — только с первой записью этой строки с этого компьютера.
    if (!written.has(id)) { data.firstAt = e.firstAt; written.add(id); }
    try {
      setDoc(ref, data, { merge: true }).catch(() => { /* сеть — Firestore дошлёт сам; отказ — молча */ });
    } catch { /* неверные данные бросают сразу — журнал не должен падать сам */ }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => { try { flushErrorLog(); } catch { /* выходим */ } });
}
