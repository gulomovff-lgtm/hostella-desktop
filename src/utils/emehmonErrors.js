/**
 * Сбои e-mehmon → журнал ошибок (utils/errorLog.js).
 *
 * Различаем сбой портала или автоматики (форма не открылась, таймаут,
 * портал ответил ошибкой, комнаты нет в списке) и вопрос к данным гостя
 * (нет в госбазе, комната переполнена). Первые считаются подряд: три
 * сбоя без единой удачной регистрации — тревога в Telegram, не чаще раза
 * в час (решение владельца 29.10.2026: «e-mehmon не регистрирует подряд»).
 */
import { reportError } from './errorLog';

const ALERT_AFTER = 3;
const ALERT_EVERY_MS = 60 * 60 * 1000;
let streak = 0;
let lastAlertAt = 0;

/** Удачная операция с порталом — серия сбоев прервана. */
export function emehmonSuccess() { streak = 0; }

/**
 * @param {string} stage   — 'arrival' | 'depart' | 'sheet' | 'list' | 'recalc' | 'check'
 * @param {object} guest   — гость (или null для операций по филиалу)
 * @param {object} res     — ответ мастера { status, message }
 * @param {object} [opts]  — { system: false — вопрос к данным, в серию не идёт; hostelId }
 */
export function emehmonFailure(stage, guest, res, opts = {}) {
  const status = String(res?.status || 'error');
  const msg = String(res?.message || res?.code || '').slice(0, 200);
  const system = opts.system !== false;
  let critical = false;
  if (system) {
    streak += 1;
    if (streak >= ALERT_AFTER && Date.now() - lastAlertAt > ALERT_EVERY_MS) { critical = true; lastAlertAt = Date.now(); }
  }
  reportError('emehmon', `emehmon.${stage}`, msg ? `${status}: ${msg}` : status, {
    status, guestId: guest?.id || null, guest: guest?.fullName || null, room: guest?.roomNumber || null,
    ...(system ? { streak } : {}),
  }, {
    severity: critical ? 'critical' : system ? 'error' : 'warning',
    hostelId: guest?.hostelId || opts.hostelId || null,
    alertText: critical ? `e-mehmon: ${streak} сбоя подряд. Последний — ${guest?.fullName || stage}: ${status}${msg ? ' — ' + msg : ''}` : undefined,
  });
}
