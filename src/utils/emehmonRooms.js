/**
 * emehmonRooms.js — кто в какой комнате по данным портала и что с этим делать.
 *
 * Портал отказывает в регистрации, когда комната у него «переполнена». Это
 * почти всегда стало, а не факт: гость выехал в Hostella, но в e-mehmon его
 * не вывели (регистрировали вручную, без отметки), или гость переехал в
 * другую комнату, а в портале остался в старой. Перед регистрацией сверяем
 * строки /listok по комнате с гостями Hostella и раскладываем их на:
 *   keep    — активный гость этой же комнаты (законно занимает место);
 *   depart  — гость выехал в Hostella → вывести из портала;
 *   move    — гость активен, но в Hostella живёт в ДРУГОЙ комнате →
 *             сменить комнату в портале (а не выводить и регистрировать заново);
 *   unknown — человек, которого в Hostella нет вовсе → решает кассир.
 * Заодно ловим обратное: гость переехал В эту комнату, а в портале числится
 * в старой — тоже move (в эту комнату).
 *
 * Без React и Firestore — покрыто тестами.
 */

export const normP = (s = '') => String(s || '').replace(/\s/g, '').toUpperCase();
export const normN = (s = '') => String(s || '').replace(/\s+/g, ' ').trim().toUpperCase();

/** Номер комнаты как ключ: «3», «3-xona», «№3», «03» → '3'; нечисловое — как есть в верхнем регистре. */
export const roomKey = (v) => {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const m = s.match(/\d+/);
  if (m) return String(parseInt(m[0], 10));
  return s.toUpperCase();
};

/** Гость Hostella по строке портала: паспорт сильнее ФИО; из нескольких — активный, затем самый свежий. */
export const matchRowToGuest = (row, guests = []) => {
  const rp = normP(row?.passport), rn = normN(row?.displayName || row?.name);
  const byP = rp ? guests.filter(g => g.passport && normP(g.passport) === rp) : [];
  const pool = byP.length ? byP : (rn ? guests.filter(g => g.fullName && normN(g.fullName) === rn) : []);
  if (!pool.length) return null;
  const rank = (g) => (g.status === 'active' ? 2 : g.status === 'checked_out' ? 1 : 0);
  return [...pool].sort((a, b) => rank(b) - rank(a) || String(b.checkInDate || '').localeCompare(String(a.checkInDate || '')))[0];
};

/**
 * План приведения комнаты портала к Hostella.
 * @param {{room:string|number, rows:Array, guests:Array, capacity?:number, hostelId?:string}} p
 */
export function planRoomReconcile({ room, rows = [], guests = [], capacity = 0, hostelId = '' } = {}) {
  const key = roomKey(room);
  const scope = hostelId ? guests.filter(g => (g.hostelId || 'hostel1') === hostelId) : guests;
  const keep = [], depart = [], move = [], unknown = [];
  const seen = new Set();
  for (const row of rows) {
    const inRoom = roomKey(row?.room) === key;
    const g = matchRowToGuest(row, scope);
    if (inRoom) {
      if (!g) { unknown.push(row); continue; }
      if (seen.has(g.id)) continue;
      seen.add(g.id);
      if (g.status === 'checked_out') depart.push({ guest: g, row });
      else if (g.status === 'active' && roomKey(g.roomNumber) && roomKey(g.roomNumber) !== key) move.push({ guest: g, row, fromRoom: row.room, toRoom: g.roomNumber });
      else keep.push({ guest: g, row });
    } else if (g && g.status === 'active' && roomKey(g.roomNumber) === key && !seen.has(g.id)) {
      // числится в другой комнате портала, а живёт здесь — переселить сюда
      seen.add(g.id);
      move.push({ guest: g, row, fromRoom: row.room, toRoom: g.roomNumber });
    }
  }
  const cap = Number(capacity) || 0;
  // после вывода/переезда в комнате останутся keep + те, кто переедет сюда
  const movingIn = move.filter(m => roomKey(m.toRoom) === key).length;
  const occupiedAfter = keep.length + movingIn;
  const occupiedNow = keep.length + depart.length + unknown.length + move.filter(m => roomKey(m.row?.room) === key).length;
  return {
    room: key, capacity: cap, keep, depart, move, unknown,
    occupiedNow, occupiedAfter,
    fullNow: cap > 0 && occupiedNow >= cap,
    fullAfter: cap > 0 && occupiedAfter + unknown.length >= cap,
  };
}

/** Имена для сообщения кассиру: «IVANOV I., PETROV P.» (до n, остальное «+k»). */
export const namesOf = (items = [], n = 3) => {
  const names = items.map(x => (x?.guest?.fullName || x?.displayName || x?.row?.displayName || x?.name || '—')).filter(Boolean);
  const head = names.slice(0, n).join(', ');
  return names.length > n ? `${head} +${names.length - n}` : head;
};

/** Тексты портала об отказе: комната переполнена / гость уже зарегистрирован. */
export const ROOM_FULL_RX = /xona|room|комнат|joy\s*yo|to['‘’`]?lgan|sig['‘’`]?m|band|переполн|мест\s*нет|нет\s*мест|занят/i;
export const ALREADY_ACTIVE_RX = /allaqachon|ro['‘’`]?yxat(dan|ga)|faol|mavjud|already|зарегистр|уже/i;
export const classifyPortalError = (msg = '') => {
  const s = String(msg || '');
  if (!s.trim()) return 'unknown';
  if (ALREADY_ACTIVE_RX.test(s) && !ROOM_FULL_RX.test(s)) return 'already_active';
  if (ROOM_FULL_RX.test(s)) return 'room_full';
  return 'unknown';
};
