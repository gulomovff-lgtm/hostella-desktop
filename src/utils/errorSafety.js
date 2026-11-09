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
 * «INTERNAL ASSERTION FAILED» — Firestore в окне умер насовсем: подписки молчат,
 * записи копятся и не уходят, «пинки» сторожа связи не помогают (08.11.2026:
 * касса 20 минут работала вхолостую после обрыва интернета). Лечится только
 * перезапуском окна.
 */
export const isFirestoreDead = (reason) =>
  /FIRESTORE \([\d.]+\) INTERNAL ASSERTION FAILED/.test(String(reason?.message || reason || ''));
