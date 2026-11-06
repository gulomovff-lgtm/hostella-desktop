/**
 * Учёт обрывов связи с базой для журнала ошибок (utils/errorLog.js).
 *
 * Связь видна по метаданным подписки на комнаты (useAppData): fromCache —
 * сервер не отвечает, данные из локальной базы. Отличаем, чей обрыв:
 * пропал интернет на кассе (navigator.onLine === false) или интернет есть,
 * а сервер не отвечает. Обрыв дольше минуты — строка в журнал с
 * длительностью; дольше 5 минут — важная (сразу в Telegram, как только
 * сообщение сможет уйти).
 */
import { reportError } from './errorLog';

const MIN_MS = 60 * 1000;
const CRITICAL_MS = 5 * 60 * 1000;

let downSince = 0;
let cause = '';        // 'internet' | 'server'
let alerted = false;

const offlineNow = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** Подписка на комнаты сообщает: есть ли связь с сервером. */
export function noteServerLink(connected, now = Date.now()) {
  if (!connected) {
    if (!downSince) { downSince = now; cause = offlineNow() ? 'internet' : 'server'; alerted = false; }
    else if (cause === 'internet' && !offlineNow()) cause = 'server';
    return;
  }
  if (!downSince) return;
  const ms = now - downSince;
  const was = cause;
  downSince = 0; cause = ''; const hadAlert = alerted; alerted = false;
  if (ms < MIN_MS) return;
  const min = Math.round(ms / MIN_MS);
  reportError('server', was === 'internet' ? 'internet.offline' : 'firestore.unreachable',
    was === 'internet' ? `Нет интернета на кассе ${min} мин` : `Сервер не отвечал ${min} мин при работающем интернете`,
    { minutes: min, from: new Date(now - ms).toISOString(), to: new Date(now).toISOString() },
    // Важная — если тревогу ещё не слали во время обрыва
    { severity: ms >= CRITICAL_MS && !hadAlert && was === 'server' ? 'critical' : 'warning' });
}

/** Раз в 10 с из сторожа: обрыв сервера тянется 5 минут — тревога сразу, не дожидаясь конца. */
export function serverLinkTick(now = Date.now()) {
  if (!downSince || alerted || cause !== 'server') return;
  if (now - downSince < CRITICAL_MS) return;
  alerted = true;
  reportError('server', 'firestore.unreachable', 'Сервер не отвечает больше 5 минут при работающем интернете',
    { since: new Date(downSince).toISOString() }, { severity: 'critical' });
}

/** Для тестов. */
export function _resetServerLink() { downSince = 0; cause = ''; alerted = false; }
