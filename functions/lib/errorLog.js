/**
 * Журнал ошибок на сервере — та же коллекция и тот же ключ строки, что у
 * программы (src/utils/errorLog.js): <день>_<тип>_<отпечаток>, повторы за
 * день — счётчиком. День — по Ташкенту, как у касс.
 */
const two = (n) => String(n).padStart(2, '0');

/** YYYY-MM-DD по Ташкенту (UTC+5, без перехода на летнее время). */
function dayKeyTashkent(d = new Date()) {
  const t = new Date(d.getTime() + 5 * 60 * 60 * 1000);
  return `${t.getUTCFullYear()}-${two(t.getUTCMonth() + 1)}-${two(t.getUTCDate())}`;
}

const normalizeMessage = (m) => String(m || '')
  .replace(/\d+/g, '#').replace(/["'«»]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);

function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

const errorDocId = (kind, context, message, day) =>
  `${day}_${kind}_${hash(`${context}|${normalizeMessage(message)}`)}`;

/**
 * Записать ошибку сервера. Никогда не бросает.
 * @param {FirebaseFirestore.Firestore} db  — база 'hostella'
 * @param {string} base                     — artifacts/<app>/public/data
 */
async function logServerError(db, base, { kind = 'function', context = '', message = '', details = {}, severity = 'error' } = {}, FieldValue) {
  try {
    const now = new Date();
    const day = dayKeyTashkent(now);
    const msg = String(message || '—').slice(0, 500);
    const id = errorDocId(kind, context, msg, day);
    await db.doc(`${base}/errorLog/${id}`).set({
      kind, context, message: msg, severity, day,
      count: FieldValue.increment(1), lastAt: now.toISOString(),
      user: 'Сервер', userId: 'server', role: 'system', platform: 'server', version: '',
      details,
    }, { merge: true });
  } catch (e) {
    console.error('[errorLog]', e.message);
  }
}

/**
 * Вечерняя сводка: строки журнала за день → текст для Telegram (HTML) или
 * null, если ошибок не было. rows: [{ kind, context, message, count, severity, hostelId }]
 */
function digestText(rows, day, kinds) {
  const list = (rows || []).filter(Boolean);
  if (!list.length) return null;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const byKind = new Map();
  for (const r of list) {
    const k = kinds[r.kind] ? r.kind : 'other';
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k).push(r);
  }
  const total = list.reduce((s, r) => s + (Number(r.count) || 1), 0);
  const lines = [`📋 <b>Ошибки за ${esc(day.split('-').reverse().join('.'))}</b> — ${total} раз, ${list.length} видов`];
  for (const k of Object.keys(kinds)) {
    const rs = byKind.get(k);
    if (!rs) continue;
    const n = rs.reduce((s, r) => s + (Number(r.count) || 1), 0);
    lines.push('', `<b>${esc(kinds[k])}</b> · ${n}`);
    rs.sort((a, b) => (Number(b.count) || 1) - (Number(a.count) || 1)).slice(0, 4).forEach((r) => {
      const unresolved = r.resolved ? ' ✓' : '';
      lines.push(`• ${esc(String(r.message || '').slice(0, 120))} ×${Number(r.count) || 1}${unresolved}`);
    });
    if (rs.length > 4) lines.push(`• …ещё ${rs.length - 4}`);
  }
  return lines.join('\n');
}

const ERROR_KINDS = {
  crash: 'Падение программы', server: 'Нет связи с сервером', sync: 'Записи не дошли до сервера',
  write: 'Сервер не принял запись', emehmon: 'e-mehmon', telegram: 'Telegram',
  function: 'Серверная функция', other: 'Прочее',
};

module.exports = { dayKeyTashkent, normalizeMessage, hash, errorDocId, logServerError, digestText, ERROR_KINDS };
