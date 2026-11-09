/**
 * Чистые помощники журнала ошибок и сторожа «здоровья» — без зависимостей,
 * чтобы их проверял tests/error-safety.test.mjs.
 */

/**
 * Подробности для записи: Firestore отказывается принять undefined (и бросает
 * сразу, а не промисом) — 07.11.2026 из-за `details.exitCode: undefined`
 * журнал сам породил «падение программы». Пустое выкидываем, сложное — строкой.
 */
export function cleanDetails(details) {
  const out = {};
  if (!details || typeof details !== 'object') return out;
  for (const [k, v] of Object.entries(details)) {
    if (v === undefined || typeof v === 'function') continue;
    if (v === null || typeof v === 'string' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'number') out[k] = Number.isFinite(v) ? v : String(v);
    else { try { out[k] = JSON.stringify(v).slice(0, 500); } catch { out[k] = String(v); } }
  }
  return out;
}

/**
 * Обрыв интернета у кассы, а не сбой портала: Chromium-коды загрузки страницы
 * (ERR_INTERNET_DISCONNECTED, ERR_NAME_NOT_RESOLVED, ERR_NETWORK_CHANGED, (-101)…).
 * 08.11.2026 касса без интернета 20 минут копила «сбои» e-mehmon и слала
 * критичные тревоги — а чинить надо было связь, не e-mehmon.
 */
const NETWORK_RX = /ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|NAME_RESOLUTION_FAILED|NETWORK_CHANGED|NETWORK_IO_SUSPENDED|CONNECTION_(RESET|CLOSED|REFUSED|ABORTED|FAILED|TIMED_OUT)|ADDRESS_UNREACHABLE|TIMED_OUT|PROXY_CONNECTION_FAILED|EMPTY_RESPONSE)|\((-10[0-9]|-21|-118|-130|-137|-324)\)/;
export const isNetworkFailure = (res) =>
  String(res?.status) === 'network' || NETWORK_RX.test(String(res?.message || res?.code || ''));

/**
 * «INTERNAL ASSERTION FAILED» — Firestore в окне умер насовсем: подписки молчат,
 * записи копятся и не уходят, «пинки» сторожа связи не помогают (08.11.2026:
 * касса 20 минут работала вхолостую после обрыва интернета). Лечится только
 * перезапуском окна.
 */
export const isFirestoreDead = (reason) =>
  /FIRESTORE \([\d.]+\) INTERNAL ASSERTION FAILED/.test(String(reason?.message || reason || ''));
