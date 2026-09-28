/**
 * referral.js — реферальная программа (денежные бонусы за сутки приглашённого).
 *
 * Решения владельца (2026-09-28):
 *  - за каждые сутки проживания приглашённого пригласивший получает сумму
 *    из настроек (settings/referralProgram.ratePerNight), с потолком ночей
 *    за одно проживание (maxNightsPerStay, 0 — без потолка);
 *  - бонус становится доступен после выезда приглашённого БЕЗ долга и сразу
 *    зачисляется на баланс клиента (наличными не выплачивается);
 *  - считаются только НОВЫЕ клиенты (приглашённого нет в базе клиентов на
 *    момент первого заселения); дальше — все его проживания;
 *  - всё видно в боте @Hostellauzbot: кто приглашён, сколько прожил, сколько
 *    начислено, что ожидает.
 * Чистые функции — без Firestore, покрыты tests/referral-fn.test.mjs.
 */
const DAY = 86400000;
const num = (v) => Number(v) || 0;

// Без похожих символов (0/O, 1/I/L), чтобы код легко продиктовать
const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genRefCode(rand = Math.random) {
  let s = '';
  for (let i = 0; i < 6; i++) s += REF_ALPHABET[Math.floor(rand() * REF_ALPHABET.length)];
  return s;
}
const normCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

/** Телефон → последние 9 цифр (узбекский номер без 998), '' если коротко. */
function normPhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  return d.length >= 9 ? d.slice(-9) : '';
}

/** «IVANOV IVAN IVANOVICH» → «Ivan I.» — в боте чужие имена не раскрываем полностью. */
function maskName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  const first = parts[1] || parts[0];
  const initial = parts.length > 1 ? ` ${parts[0].charAt(0).toUpperCase()}.` : '';
  return cap(first) + initial;
}

const paidOf = (g) => (typeof g.amountPaid === 'number'
  ? g.amountPaid
  : num(g.paidCash) + num(g.paidCard) + num(g.paidQR) + num(g.paidTransfer));
const debtOf = (g) => num(g.totalPrice) + num(g.servicesTotal) - paidOf(g);

/** Сколько суток прожито: выехал — по счёту (days), живёт — сколько прошло, но не больше days. */
function nightsOf(g, now = Date.now()) {
  if (!g) return 0;
  const days = Math.max(0, Math.round(num(g.days)));
  if (g.status === 'checked_out') return days;
  if (g.status !== 'active') return 0;
  const ci = new Date(g.checkInDate || g.checkInDateTime || 0).getTime();
  if (!ci) return 0;
  const lived = Math.max(0, Math.ceil((now - ci) / DAY));
  return Math.min(days, lived);
}

/** Бонус за N ночей по настройкам (с потолком). */
function bonusFor(nights, settings = {}) {
  const rate = Math.max(0, Math.round(num(settings.ratePerNight)));
  const cap = Math.max(0, Math.round(num(settings.maxNightsPerStay)));
  const n = Math.max(0, Math.round(num(nights)));
  const counted = cap > 0 ? Math.min(n, cap) : n;
  return { nights: counted, amount: counted * rate, rate };
}

/**
 * Начислять ли бонус за это проживание сейчас: приглашённый выехал, долга нет,
 * за это проживание ещё не начисляли, программа включена. Иначе null.
 */
function creditDecision(guest, settings) {
  if (!settings || !settings.active) return null;
  if (!guest || !guest.referrerClientId) return null;
  if (guest.status !== 'checked_out') return null;
  if (guest.refBonusCredited != null) return null;
  if (debtOf(guest) > 0) return null;
  const b = bonusFor(num(guest.days), settings);
  return b.amount > 0 ? b : null;
}

/**
 * Данные личного кабинета для бота.
 * referees — проживания приглашённых (guest-доки с referrerClientId = client.id).
 */
function buildCabinet({ client, referees = [], ledger = [], settings = {}, now = Date.now() }) {
  const rows = referees
    .filter(g => g && (g.status === 'active' || g.status === 'checked_out'))
    .sort((a, b) => String(b.checkInDate || '').localeCompare(String(a.checkInDate || '')))
    .map(g => {
      const nights = nightsOf(g, now);
      const credited = g.refBonusCredited != null ? num(g.refBonusCredited) : null;
      const state = credited != null ? 'credited'
        : g.status === 'active' ? 'living'
        : debtOf(g) > 0 ? 'debt' : 'pending';
      const amount = credited != null ? credited : bonusFor(nights, settings).amount;
      return {
        name: maskName(g.fullName), nights, amount, state,
        checkIn: g.checkInDate || '', checkOut: g.checkOutDate || '',
      };
    });
  const credited = rows.filter(r => r.state === 'credited').reduce((s, r) => s + r.amount, 0);
  const pending = rows.filter(r => r.state !== 'credited').reduce((s, r) => s + r.amount, 0);
  return {
    name: String(client?.fullName || ''),
    refCode: client?.refCode || '',
    balance: num(client?.balance),
    active: !!settings.active,
    rate: Math.max(0, Math.round(num(settings.ratePerNight))),
    maxNights: Math.max(0, Math.round(num(settings.maxNightsPerStay))),
    referees: rows.slice(0, 30),
    invitedCount: new Set(referees.map(g => g.refereeClientId || g.passport || g.fullName)).size,
    totals: { credited, pending },
    ledger: [...ledger].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 10)
      .map(l => ({ date: l.date, amount: num(l.amount), type: l.type, note: l.note || l.guestName || '' })),
  };
}

module.exports = { genRefCode, normCode, normPhone, maskName, debtOf, nightsOf, bonusFor, creditDecision, buildCabinet, REF_ALPHABET };
