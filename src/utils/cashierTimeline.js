/**
 * cashierTimeline.js — «за что оплата» и лента действий кассира.
 *
 * Владелец (2026-09-25): «таймлайн всех действий кассира в отдельной вкладке,
 * и в кассе подробно — что за что оплаты, на сколько дней продлил».
 *
 * Раньше оплата при продлении/доплате/погашении долга писалась в кассу без
 * пояснения (только гость и сумма), а продление не попадало в журнал вовсе.
 * С 0.15.27 оплаты несут `purpose` (+ сутки, «до какого числа», комнату, имя),
 * а журнал — записи extend / payment / debt_pay / move со ссылками на оплаты
 * (`paymentIds`). Для старых записей назначение угадывается аккуратно:
 * заселение — по категории, продление — по следу lastExtendedAt у гостя.
 *
 * Модуль без React и словаря: текст собирается функцией t(), которую передаёт
 * экран (тесты подставляют свою).
 */

const num = (v) => Number(v) || 0;
const ms = (d) => { const x = new Date(d || 0).getTime(); return Number.isFinite(x) ? x : 0; };

/** Сумма оплаты по способам — одинаково для обоих форматов записи. */
export function paymentMethods(p) {
  if (!p) return { cash: 0, card: 0, qr: 0, transfer: 0, balance: 0 };
  const hasSplit = ['cash', 'card', 'qr', 'transfer', 'balance'].some(k => p[k] !== undefined);
  if (hasSplit) return { cash: num(p.cash), card: num(p.card), qr: num(p.qr), transfer: num(p.transfer), balance: num(p.balance) };
  const m = ['cash', 'card', 'qr', 'transfer', 'balance'].includes(p.method) ? p.method : 'cash';
  return { cash: 0, card: 0, qr: 0, transfer: 0, balance: 0, [m]: num(p.amount) };
}

/** Старая оплата рядом с продлением того же кассира (±3 мин) — это продление. */
const LEGACY_EXTEND_WINDOW_MS = 3 * 60 * 1000;

/**
 * Назначение оплаты → { kind, days, toDate, guestName, room, note, approx }.
 * kind: checkin | booking | extend | payment | debt | service | registration |
 *       balance | ctt | report | other
 */
export function describePayment(p, guest = null) {
  const base = {
    guestName: p?.guestName || p?.clientName || guest?.fullName || '',
    room: p?.roomNumber || guest?.roomNumber || '',
    days: num(p?.extendDays || p?.days) || 0,
    toDate: p?.untilDate || '',
    note: '',
    approx: false,
  };
  if (!p) return { kind: 'other', ...base };
  if (p.type === 'cash_to_terminal') return { kind: 'ctt', ...base, note: p.comment || '' };
  if (p.type === 'balance_topup') return { kind: 'balance', ...base };
  if (p.reportOnly) return { kind: 'report', ...base, note: p.comment || '' };
  if (p.category === 'service') return { kind: 'service', ...base, note: p.comment || '' };
  if (p.category === 'registration') return { kind: 'registration', ...base };
  if (p.purpose) return { kind: p.purpose, ...base };
  if (p.category === 'accommodation') return { kind: 'checkin', ...base, days: base.days || num(guest?.days) || 0, approx: !base.days };
  if (p.category && p.category !== 'accommodation') return { kind: 'other', ...base, note: p.comment || p.category };
  // Старая запись без назначения: продление угадываем по следу у гостя.
  if (guest?.lastExtendedAt && Math.abs(ms(guest.lastExtendedAt) - ms(p.date)) <= LEGACY_EXTEND_WINDOW_MS &&
      (!guest.lastExtendedBy || !p.staffId || guest.lastExtendedBy === p.staffId)) {
    const ppn = num(guest.pricePerNight);
    const days = ppn > 0 && num(guest.lastExtensionPrice) > 0 ? Math.round(num(guest.lastExtensionPrice) / ppn) : 0;
    return { kind: 'extend', ...base, days, toDate: guest.checkOutDate || '', approx: true };
  }
  if (guest && guest.status === 'checked_out' && ms(guest.checkOutDate) && ms(p.date) > ms(guest.checkOutDate)) {
    return { kind: 'debt', ...base, approx: true };
  }
  return { kind: 'payment', ...base };
}

const shortDate = (d) => {
  const x = new Date(d || 0);
  if (!Number.isFinite(x.getTime()) || !ms(d)) return '';
  return `${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')}`;
};

/** Словарные ключи назначений (ru/uz в translations.js). */
export const PURPOSE_KEYS = {
  checkin: 'ptCheckin', booking: 'ptBooking', extend: 'ptExtend', payment: 'ptPayment',
  debt: 'ptDebt', service: 'ptService', registration: 'ptRegistration', balance: 'ptBalance',
  ctt: 'ptCtt', report: 'ptReport', other: 'ptOther',
};

/**
 * Короткий текст «за что»: «Продление +3 сут. до 28.09».
 * withGuest — добавить «· Иванов · комн. 12».
 */
export function purposeText(d, t, { withGuest = true } = {}) {
  if (!d) return '';
  let s = t(PURPOSE_KEYS[d.kind] || 'ptOther');
  if ((d.kind === 'extend' || d.kind === 'checkin' || d.kind === 'booking') && d.days > 0) {
    s += ' ' + t(d.kind === 'extend' ? 'ptPlusDays' : 'ptDays').replace('{n}', d.days);
  }
  if ((d.kind === 'extend' || d.kind === 'checkin' || d.kind === 'booking') && shortDate(d.toDate)) {
    s += ' ' + t('ptUntil').replace('{date}', shortDate(d.toDate));
  }
  if (d.note && (d.kind === 'service' || d.kind === 'other' || d.kind === 'report' || d.kind === 'ctt')) s += ': ' + d.note;
  if (withGuest) {
    if (d.guestName) s += ' · ' + d.guestName;
    if (d.room) s += ' · ' + t('ptRoom').replace('{n}', d.room);
  }
  if (d.approx) s += ' ' + t('ptApprox');
  return s;
}

// ── Лента ─────────────────────────────────────────────────────────────────

/** Действия журнала, которые лента берёт из других источников (без дублей). */
const SKIP_AUDIT = new Set(['expense_add', 'cash_to_terminal', 'version_check', 'error', 'system_error']);

/** Ключи кассира: id и логин (оплаты пишут staffId = id || login). */
export function staffKeysOf(user) {
  return new Set([user?.id, user?.login].filter(Boolean).map(String));
}

/**
 * Собрать ленту за [from, to) по одному кассиру (keys) или по всем (keys = null).
 * Возвращает события по времени (раньше → позже):
 *   { id, at, source: 'audit'|'payment'|'expense'|'shift', action, entry?, payments: [],
 *     expense?, shift?, staffId, staffName, moneyIn, moneyOut }
 */
export function buildTimeline({ audit = [], payments = [], expenses = [], shifts = [], keys = null, from, to, guestsById = null } = {}) {
  const lo = ms(from), hi = to ? ms(to) : Infinity;
  const inRange = (d) => { const x = ms(d); return x >= lo && x < hi; };
  const mine = (k) => !keys || (k != null && keys.has(String(k)));

  const pays = payments.filter(p => inRange(p.date) && mine(p.staffId) && num(p.amount) !== 0);
  const payById = new Map(pays.map(p => [p.id, p]));
  const used = new Set();
  const events = [];

  const entries = audit.filter(e => inRange(e.timestamp) && mine(e.userId) && !SKIP_AUDIT.has(e.action));
  for (const e of entries) {
    const d = e.details || {};
    const attached = [];
    for (const pid of Array.isArray(d.paymentIds) ? d.paymentIds : []) {
      const p = payById.get(pid);
      if (p && !used.has(pid)) { used.add(pid); attached.push(p); }
    }
    if (e.action === 'shop_sale' && d.saleId) {
      const p = pays.find(x => x.saleId === d.saleId && !used.has(x.id));
      if (p) { used.add(p.id); attached.push(p); }
    }
    // Старое заселение без paymentIds: оплата того же кассира рядом по времени и имени
    if (!attached.length && (e.action === 'checkin' || e.action === 'booking_add') && num(d.amount) > 0) {
      const at = ms(e.timestamp);
      const p = pays.find(x => !used.has(x.id) && x.category === 'accommodation' &&
        (x.guestName || '') === (d.guestName || '') && Math.abs(ms(x.date) - at) <= 120000);
      if (p) { used.add(p.id); attached.push(p); }
    }
    events.push({
      id: 'a_' + (e.id || e.timestamp), at: ms(e.timestamp), source: 'audit', action: e.action, entry: e,
      payments: attached, staffId: e.userId, staffName: e.userName || '',
      moneyIn: attached.reduce((s, p) => s + num(p.amount), 0), moneyOut: 0,
    });
  }
  for (const p of pays) {
    if (used.has(p.id)) continue;
    const isCtt = p.type === 'cash_to_terminal';
    events.push({
      id: 'p_' + p.id, at: ms(p.date), source: 'payment', action: isCtt ? 'cash_to_terminal' : 'payment_row',
      payments: [p], staffId: p.staffId, staffName: p.staffName || '',
      guest: guestsById?.get?.(p.guestId) || null,
      moneyIn: isCtt ? 0 : num(p.amount), moneyOut: 0,
    });
  }
  for (const x of expenses) {
    if (!inRange(x.date) || !mine(x.staffId) || !num(x.amount)) continue;
    events.push({
      id: 'e_' + x.id, at: ms(x.date), source: 'expense', action: x.category === 'Возврат' ? 'refund' : 'expense',
      payments: [], expense: x, staffId: x.staffId, staffName: '', moneyIn: 0, moneyOut: num(x.amount),
    });
  }
  for (const s of shifts) {
    if (!mine(s.staffId) && !mine(s.staffLogin)) continue;
    if (inRange(s.startTime)) events.push({ id: 's_' + s.id, at: ms(s.startTime), source: 'shift', action: 'shift_start', shift: s, payments: [], staffId: s.staffId, staffName: s.staffName || '', moneyIn: 0, moneyOut: 0 });
    if (s.endTime && inRange(s.endTime)) events.push({ id: 'se_' + s.id, at: ms(s.endTime), source: 'shift', action: 'shift_end', shift: s, payments: [], staffId: s.staffId, staffName: s.staffName || '', moneyIn: 0, moneyOut: 0 });
  }
  return events.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
}

/** Итоги ленты: заселения, продления (+сутки), приход по способам, расходы. */
export function summarizeTimeline(events = []) {
  const s = { checkins: 0, extends: 0, extendDays: 0, checkouts: 0, sales: 0, moneyIn: 0, moneyOut: 0,
    byMethod: { cash: 0, card: 0, qr: 0, transfer: 0, balance: 0 } };
  for (const e of events) {
    const d = e.entry?.details || {};
    if (e.action === 'checkin') s.checkins++;
    if (e.action === 'checkout') s.checkouts++;
    if (e.action === 'shop_sale') s.sales++;
    if (e.action === 'extend') { s.extends++; s.extendDays += num(d.days); }
    if (e.action === 'extend_bulk') { s.extends += num(d.count); s.extendDays += num(d.days) * num(d.count); }
    for (const p of e.payments) {
      if (p.type === 'cash_to_terminal') continue;
      const m = paymentMethods(p);
      for (const k of Object.keys(s.byMethod)) s.byMethod[k] += m[k];
    }
    s.moneyIn += e.moneyIn;
    s.moneyOut += e.moneyOut;
  }
  return s;
}

/** Границы суток по местному времени для «YYYY-MM-DD». */
export function dayRange(ymd) {
  const [y, m, d] = String(ymd || '').split('-').map(Number);
  if (!y || !m || !d) return { from: 0, to: 0 };
  return { from: new Date(y, m - 1, d, 0, 0, 0, 0).getTime(), to: new Date(y, m - 1, d + 1, 0, 0, 0, 0).getTime() };
}
