/**
 * Рабочие по договору (решения владельца 20.11.2026).
 *
 * Рабочий — запись в guests с contractWorker: true и contractGroupId (договор
 * из «Ручного проживания»). Своей цены и оплаты у него нет: сутки идут в
 * «Начислено» договора по ставке договора.
 *  • сутки — календарные дни по Ташкенту: день заезда — целые сутки, каждая
 *    полночь, пока не выселили, — ещё сутки (заехал 20.11 в 23:00, выселили
 *    21.11 в 10:00 — 2 суток);
 *  • продлевает сервер в 00:00 (functions/contractWorkers.js), а экран считает
 *    то же самое сам — если функция опоздала, цифры всё равно верные;
 *  • ставка меняется только с даты изменения: rateHistory [{ from, rate }],
 *    прошедшие сутки остаются по старой ставке;
 *  • выселить, продлить и принять оплату из обычных окон нельзя — только во
 *    вкладке договора «Рабочие» (кассир и админ).
 *
 * ВАЖНО: те же правила суток — в functions/contractWorkers.js (сервер).
 */

const TZ_MS = 5 * 3600 * 1000; // Ташкент, UTC+5 без перехода на летнее время

/** Календарный день по Ташкенту: 'YYYY-MM-DD'. */
export const tashkentYmd = (d) => {
  const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
  if (!Number.isFinite(t)) return '';
  return new Date(t + TZ_MS).toISOString().slice(0, 10);
};

const ymdToUtc = (ymd) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
const addDaysYmd = (ymd, n) => new Date(ymdToUtc(ymd) + n * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((ymdToUtc(b) - ymdToUtc(a)) / 86400000);

/** Ближайшая полночь по Ташкенту после момента now — ISO (UTC). */
export const nextTashkentMidnightIso = (now = new Date()) => {
  const tomorrow = addDaysYmd(tashkentYmd(now), 1);
  return new Date(ymdToUtc(tomorrow) - TZ_MS).toISOString();
};

export const isContractWorker = (g) => !!(g && g.contractWorker && g.contractGroupId);

/** Последний учтённый день рабочего: живёт — сегодня, выселен — день выселения. */
const lastDayOf = (g, now) => {
  if (g.status === 'active') return tashkentYmd(now);
  const out = g.checkedOutAt || g.checkOutDate;
  return out ? tashkentYmd(out) : tashkentYmd(g.checkInDate);
};

/** Сутки рабочего: календарные дни от заезда до последнего дня включительно. */
export const workerDays = (g, now = new Date()) => {
  if (!g?.checkInDate) return 0;
  const from = tashkentYmd(g.checkInDate);
  const to = lastDayOf(g, now);
  if (!from || !to) return 0;
  return Math.max(1, daysBetween(from, to) + 1);
};

/** История ставки договора по возрастанию даты; без истории — одна ставка. */
export const rateSteps = (group) => {
  const hist = Array.isArray(group?.rateHistory) ? group.rateHistory : [];
  const steps = hist
    .map(s => ({ from: String(s.from || ''), rate: parseInt(s.rate, 10) || 0 }))
    .filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.from))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
  if (!steps.length) return [{ from: '0000-01-01', rate: parseInt(group?.contractRate, 10) || 0 }];
  return steps;
};

/** Ставка договора на день ymd. */
export const rateOn = (group, ymd) => {
  const steps = rateSteps(group);
  let rate = steps[0].rate;
  for (const s of steps) { if (s.from <= ymd) rate = s.rate; else break; }
  return rate;
};

/** Начислено за рабочего: каждый его день — по ставке, действовавшей в тот день. */
export const workerCharge = (g, group, now = new Date()) => {
  const days = workerDays(g, now);
  if (!days) return 0;
  const from = tashkentYmd(g.checkInDate);
  const steps = rateSteps(group);
  if (steps.length === 1) return steps[0].rate * days;
  let sum = 0;
  for (let i = 0; i < days; i++) sum += rateOn(group, addDaysYmd(from, i));
  return sum;
};

/** Рабочие договора (без броней). */
export const workersOf = (group, guests = []) =>
  (guests || []).filter(g => isContractWorker(g) && g.contractGroupId === group?.id && g.status !== 'booking');

/**
 * Новая ставка договора — с сегодняшнего дня. Возвращает rateHistory для записи:
 * прежняя ставка остаётся на прошедшие дни.
 */
export const rateHistoryWithChange = (group, newRate, now = new Date()) => {
  const today = tashkentYmd(now);
  const rate = parseInt(newRate, 10) || 0;
  const hist = Array.isArray(group?.rateHistory) && group.rateHistory.length
    ? group.rateHistory.map(s => ({ from: String(s.from), rate: parseInt(s.rate, 10) || 0 }))
    : [{ from: '0000-01-01', rate: parseInt(group?.contractRate, 10) || 0 }];
  const rest = hist.filter(s => s.from !== today);
  const last = rest.sort((a, b) => (a.from < b.from ? -1 : 1))[rest.length - 1];
  if (last && last.rate === rate) return rest;
  return [...rest, { from: today, rate }];
};

/** Поля записи рабочего при выселении: сутки фиксируются на момент выселения. */
export const workerCheckoutPatch = (g, now = new Date()) => ({
  status: 'checked_out',
  checkedOutAt: now.toISOString(),
  checkOutDate: now.toISOString(),
  days: workerDays({ ...g, status: 'active' }, now),
});

/** Поля продления в полночь (то же считает сервер). */
export const workerExtendPatch = (g, now = new Date()) => ({
  days: workerDays({ ...g, status: 'active' }, now),
  checkOutDate: nextTashkentMidnightIso(now),
});
