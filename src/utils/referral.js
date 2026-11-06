/**
 * referral.js (приложение) — реферальная программа: поиск пригласившего по
 * коду или телефону при заселении. Серверная часть — functions/referral.js
 * (начисление, кабинет бота). Правила владельца 2026-09-28: только новые
 * клиенты; бонус за каждые сутки приглашённого — на баланс после выезда без долга.
 */
const normPass = (p) => String(p || '').replace(/\s/g, '').toUpperCase();
export const normRefCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
export const normPhone9 = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length >= 9 ? d.slice(-9) : ''; };

/**
 * Найти пригласившего по введённому: код (6 знаков) или телефон.
 * Вернёт { state: 'empty' | 'ok' | 'bad' | 'self' | 'ambiguous', client? }.
 */
export function findReferrer(input, clients = [], guestPassport = '') {
  const raw = String(input || '').trim();
  if (!raw) return { state: 'empty' };
  const phone = /\d{9,}/.test(raw.replace(/\D/g, '')) && !/[A-Za-z]/.test(raw) ? normPhone9(raw) : '';
  let hits;
  if (phone) hits = clients.filter(c => c && normPhone9(c.phone) === phone);
  else { const code = normRefCode(raw); hits = code ? clients.filter(c => c && normRefCode(c.refCode) === code) : []; }
  if (!hits.length) return { state: 'bad' };
  if (hits.length > 1) return { state: 'ambiguous' };
  const c = hits[0];
  if (guestPassport && c.passport && normPass(c.passport) === normPass(guestPassport)) return { state: 'self', client: c };
  return { state: 'ok', client: c };
}

/** Кто пригласил гостя при заселении: уже приглашённый клиент — навсегда тот же; новый — по коду. */
export function referrerForCheckin(existingClient, formReferrerId, clients = [], guestPassport = '') {
  if (existingClient) return existingClient.referredBy || null;           // только новые клиенты
  if (!formReferrerId) return null;
  const r = clients.find(c => c.id === formReferrerId);
  if (!r) return null;
  if (guestPassport && r.passport && normPass(r.passport) === normPass(guestPassport)) return null;
  return r.id;
}

// ── Подсчёт как на сервере (functions/referral.js) — для экрана «Бонусы» ──
const DAY = 86400000;
const num = (v) => Number(v) || 0;
const paidOf = (g) => (typeof g.amountPaid === 'number' ? g.amountPaid : num(g.paidCash) + num(g.paidCard) + num(g.paidQR) + num(g.paidTransfer));
export const refDebtOf = (g) => num(g.totalPrice) + num(g.servicesTotal) - paidOf(g);
export function refNightsOf(g, now = Date.now()) {
  if (!g) return 0;
  const days = Math.max(0, Math.round(num(g.days)));
  if (g.status === 'checked_out') return days;
  if (g.status !== 'active') return 0;
  const ci = new Date(g.checkInDate || 0).getTime();
  if (!ci) return 0;
  return Math.min(days, Math.max(0, Math.ceil((now - ci) / DAY)));
}
export function refBonusFor(nights, settings = {}) {
  const rate = Math.max(0, Math.round(num(settings.ratePerNight)));
  const cap = Math.max(0, Math.round(num(settings.maxNightsPerStay)));
  const n = Math.max(0, Math.round(num(nights)));
  const counted = cap > 0 ? Math.min(n, cap) : n;
  return { nights: counted, amount: counted * rate, rate };
}
/** Состояние проживания приглашённого: credited / living / debt / pending. */
export function refStayState(g) {
  if (g.refBonusCredited != null) return 'credited';
  if (g.status === 'active') return 'living';
  return refDebtOf(g) > 0 ? 'debt' : 'pending';
}
const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** Новый код, которого нет у других клиентов. */
export function newRefCode(clients = [], rand = Math.random) {
  const used = new Set(clients.map(c => normRefCode(c?.refCode)).filter(Boolean));
  for (let i = 0; i < 50; i++) {
    let s = '';
    for (let j = 0; j < 6; j++) s += REF_ALPHABET[Math.floor(rand() * REF_ALPHABET.length)];
    if (!used.has(s)) return s;
  }
  return null;
}
