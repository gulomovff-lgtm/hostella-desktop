/**
 * Ключ строки журнала ошибок — без зависимостей, чтобы его считали одинаково
 * программа (utils/errorLog.js) и сервер (functions/lib/errorLog.js);
 * совпадение проверяет tests/error-log.test.mjs.
 */
const two = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;

/** Текст для отпечатка: без чисел, кавычек и лишних пробелов. */
export const normalizeMessage = (m) => String(m || '')
  .replace(/\d+/g, '#').replace(/["'«»]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);

/** Короткий стабильный хэш строки (FNV-1a, 32 бита) → base36. */
export const hash = (s) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
};

export const errorDocId = (kind, context, message, d = new Date()) =>
  `${dayKey(d)}_${kind}_${hash(`${context}|${normalizeMessage(message)}`)}`;
