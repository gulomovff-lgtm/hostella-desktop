/**
 * stayPlans.js — тарифы «без завтрака» / «с завтраком» и всё, что из них следует.
 *
 * ── РЕШЕНИЯ ВЛАДЕЛЬЦА (2026-09-30) ──────────────────────────────────────
 *
 *  • Второй хостел с 01.10.2026: местные (Узбекистан) — 80 000 койка,
 *    100 000 с завтраком, глажкой и стиркой; иностранцы — 105 000 и 125 000.
 *    Первый хостел — прежние цены по комнатам (planConfig → null).
 *  • Новая цена с 1-го (уточнение владельца 2026-10-01): у кого есть оплата —
 *    не трогать, оплаченные дни по старой цене; продление (и продление после
 *    окончания) — уже по новому тарифу, новым проживанием с конца оплаченных
 *    дней. Сам пересчитывается только тот, кто ничего не платил.
 *  • Пакетного тарифа там, где действуют эти тарифы, нет.
 *  • Смена тарифа посреди проживания — с сегодняшнего дня: прожитые сутки
 *    по старой цене, оставшиеся по новой (деление проживания, как переезд).
 *  • С завтраком: стирка — одна в сутки бесплатно, дальше платно (сколько
 *    в сутки — на позиции справочника, planIncludedPerDay).
 *  • Завтрак расходует продукты склада по рецепту — это списание, а не
 *    продажа: остаток уменьшается, выручки нет, себестоимость видна.
 *  • Ночной заезд (только второй хостел, граждане Узбекистана): пришёл с
 *    23:00 до 07:00 — место 50 000 до 07:00 утра. Остаётся дальше — это
 *    новое проживание с 07:00 по обычной цене тарифа (продолжение записи).
 *
 * Без React и Firestore — покрыто тестами (tests/stay-plans.test.mjs).
 */

export const PLAN_ROOM = 'room';
export const PLAN_FULL = 'full';
export const LOCAL_COUNTRY = 'Узбекистан';

/** Схема по умолчанию — действует, пока админ не сохранил свою в «Ценах». */
export const DEFAULT_PLANS = {
  hostel2: {
    enabled: true,
    from: '2026-10-01',
    local:   { room: 80000,  full: 100000 },
    foreign: { room: 105000, full: 125000 },
    night:   { enabled: true, price: 50000, fromHour: 23, toHour: 7, localOnly: true },
  },
};

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const two = (n) => String(n).padStart(2, '0');
const toDate = (d) => (d instanceof Date ? d : (d ? new Date(d) : new Date()));

/** Календарный день (местное время кассы) → 'YYYY-MM-DD'. */
export const ymd = (d) => { const x = toDate(d); return `${x.getFullYear()}-${two(x.getMonth() + 1)}-${two(x.getDate())}`; };
export const addDays = (d, n) => { const x = new Date(toDate(d)); x.setDate(x.getDate() + n); return x; };

/** Местный гость — гражданин Узбекистана; страна не указана — тоже местный. */
export const isLocal = (country) => { const c = String(country || '').trim(); return !c || c === LOCAL_COUNTRY; };

export const planOf = (g) => (g?.plan === PLAN_FULL ? PLAN_FULL : PLAN_ROOM);

export const plansOf = (cfg) => cfg?.pricing?.plans || DEFAULT_PLANS;

/** Схема тарифов филиала на дату или null (филиал без неё / до даты начала). */
export function planConfig(hostelId, date, cfg) {
  const h = plansOf(cfg)?.[hostelId];
  if (!h || !h.enabled) return null;
  if (h.from && ymd(date) < h.from) return null;
  return h;
}

/** Цена суток по тарифу и стране или null, если у филиала нет тарифов. */
export function planPrice(hostelId, plan, country, date, cfg) {
  const h = planConfig(hostelId, date, cfg);
  if (!h) return null;
  const side = isLocal(country) ? h.local : h.foreign;
  const v = num(side?.[plan === PLAN_FULL ? PLAN_FULL : PLAN_ROOM]);
  return v > 0 ? v : null;
}

// ── Завтраки ──────────────────────────────────────────────────────────────

/**
 * Кому готовить завтрак утром дня `day`: гости тарифа «с завтраком» этого
 * филиала, ночевавшие в ночь перед этим днём (заезд не позже вчера, выезд
 * не раньше этого дня). На сегодня — только живущие (active); на будущий
 * день — ещё и брони, которые к тому времени заедут.
 */
export function breakfastGuests(guests = [], hostelId, day = new Date(), now = new Date()) {
  const d = ymd(day);
  const eve = ymd(addDays(day, -1));
  const future = d > ymd(now);
  return (guests || []).filter((g) => {
    if (!g || g.hostelId !== hostelId || planOf(g) !== PLAN_FULL) return false;
    if (!(g.status === 'active' || (future && g.status === 'booking'))) return false;
    if (!g.checkInDate || !g.checkOutDate) return false;
    return ymd(g.checkInDate) <= eve && ymd(g.checkOutDate) >= d;
  }).sort((a, b) => String(a.roomNumber || '').localeCompare(String(b.roomNumber || ''), 'ru', { numeric: true })
    || String(a.bedId || '').localeCompare(String(b.bedId || ''), 'ru', { numeric: true }));
}

/** Рецепт завтрака филиала: [{ itemId, qty }] (qty — на одну порцию, может быть дробным). */
export const recipeOf = (cfg, hostelId) =>
  ((cfg?.breakfastRecipe?.[hostelId]) || []).filter((r) => r && r.itemId && num(r.qty) > 0);

/**
 * Списание продуктов на `count` завтраков: [{ itemId, name, qty, unitCost, cost, have }]
 * и общая себестоимость. Количество округляется вверх до целых (яйцо не делится
 * на складе): 0,5 хлеба × 3 порции = 2 шт.
 */
export function breakfastWriteOff(recipe = [], count = 0, catalog = [], hostelId) {
  const byId = new Map((catalog || []).map((i) => [i.id, i]));
  const n = Math.max(0, Math.round(num(count)));
  const lines = [];
  for (const r of recipe || []) {
    const it = byId.get(r.itemId);
    if (!it) continue;
    const qty = Math.ceil(num(r.qty) * n - 1e-9);
    if (qty <= 0) continue;
    const unitCost = Math.round(num(it.costPrice));
    lines.push({ itemId: it.id, name: String(it.name || ''), qty, unitCost, cost: unitCost * qty, have: num(it.stock?.[hostelId]) });
  }
  return { lines, cost: lines.reduce((s, l) => s + l.cost, 0) };
}

/** Разница между прежним и новым списанием за день (повторная отметка — поправка, не второе списание). */
export function writeOffDelta(prevLines = [], nextLines = []) {
  const m = new Map();
  for (const l of prevLines || []) m.set(l.itemId, { itemId: l.itemId, name: l.name, delta: -num(l.qty) });
  for (const l of nextLines || []) {
    const cur = m.get(l.itemId) || { itemId: l.itemId, name: l.name, delta: 0 };
    cur.delta += num(l.qty); cur.name = l.name || cur.name;
    m.set(l.itemId, cur);
  }
  return [...m.values()].filter((x) => x.delta !== 0);
}

// ── Услуги, входящие в тариф ─────────────────────────────────────────────

/** Сколько раз позиция уже взята гостем бесплатно в день `day`. */
export function includedUsed(sales = [], guestId, itemId, day = new Date()) {
  const d = ymd(day);
  let used = 0;
  for (const s of sales || []) {
    if (!s || s.guestId !== guestId || s.status === 'cancelled' || !s.date || ymd(s.date) !== d) continue;
    for (const l of s.items || []) if (l.itemId === itemId) used += num(l.included);
  }
  return used;
}

/**
 * Строки продажи с учётом тарифа гостя: у гостя «с завтраком» позиции с
 * planIncludedPerDay идут бесплатно в пределах суточного лимита
 * (line.included — сколько бесплатно, sum — только платная часть).
 */
export function applyPlanAllowance(lines = [], guest, sales = [], catalog = [], day = new Date()) {
  if (!guest || planOf(guest) !== PLAN_FULL || guest.status !== 'active') return lines;
  const byId = new Map((catalog || []).map((i) => [i.id, i]));
  const left = new Map();
  return (lines || []).map((l) => {
    const it = l.itemId ? byId.get(l.itemId) : null;
    const perDay = Math.max(0, Math.round(num(it?.planIncludedPerDay)));
    if (!it || !perDay) return l;
    if (!left.has(it.id)) left.set(it.id, Math.max(0, perDay - includedUsed(sales, guest.id, it.id, day)));
    const free = Math.min(num(l.qty), left.get(it.id));
    if (!free) return l;
    left.set(it.id, left.get(it.id) - free);
    return { ...l, included: free, sum: (num(l.qty) - free) * num(l.price) };
  });
}

// ── Деление проживания (смена тарифа с сегодняшнего дня, новые цены с даты) ──

/**
 * Сутки, прожитые до границы `at` (полдень дня смены), и оставшиеся.
 * Заезд в тот же день или позже — делить нечего (passed = 0).
 */
export function stayNightsBefore(g, at) {
  const total = Math.max(0, Math.round(num(g?.days)));
  const ci = new Date(g?.checkInDate);
  if (!String(g?.checkInDate || '').includes('T')) ci.setHours(12, 0, 0, 0);
  const b = toDate(at);
  const ciDay = new Date(ci.getFullYear(), ci.getMonth(), ci.getDate());
  const bDay = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  const passed = Math.max(0, Math.min(total, Math.round((bDay - ciDay) / 86400000)));
  return { passed, remaining: total - passed, total };
}

const PAY_FIELDS = ['paidCash', 'paidCard', 'paidQR', 'paidTransfer', 'paidBalance'];

/**
 * Деньги при делении: оплата закрывает сначала первую часть (её стоимость
 * firstCost), остаток — на вторую. Ни одна сумма не теряется: вторая часть получает
 * ровно то, что не ушло в первую, по каждому способу оплаты.
 */
export function splitPaid(g, firstCost) {
  const parts = Object.fromEntries(PAY_FIELDS.map((k) => [k, num(g?.[k])]));
  const methods = PAY_FIELDS.reduce((s, k) => s + parts[k], 0);
  const totalPaid = Math.max(num(g?.amountPaid), methods);
  const firstPaid = Math.min(totalPaid, Math.max(0, num(firstCost)));
  const r = totalPaid > 0 ? firstPaid / totalPaid : 1;
  const first = {}, second = {};
  for (const k of PAY_FIELDS) { first[k] = Math.round(parts[k] * r); second[k] = parts[k] - first[k]; }
  first.amountPaid = Math.round(totalPaid * r);
  second.amountPaid = totalPaid - first.amountPaid;
  return { first, second };
}

const EMEHMON_OUT_KEYS = ['emehmonOut', 'emehmonOutAt', 'emehmonOutAuto'];

/**
 * Перевод гостя на тариф/цену с момента `at` (полдень дня границы).
 *  • бронь или граница не позже заезда — пересчёт всего проживания (mode 'reprice');
 *  • иначе деление, как при переезде (mode 'split'): прожитые сутки остаются
 *    на прежней записи по старой цене (она закрывается на границе), оставшиеся
 *    уходят в новую запись по новой цене на том же месте.
 * Услуги «в счёт» переходят в новую запись (servicesTotal), уже оплаченная их
 * часть — в servicesPaidCarry, чтобы долг по ним не считался дважды.
 * Регистрация e-mehmon продолжается: гость тот же и на том же месте.
 */
export function buildPlanSwitch(g, { plan, price, at, servicesPaid = 0 } = {}) {
  const newPrice = Math.round(num(price));
  if (!g || newPrice <= 0) return { mode: 'none' };
  const base = { plan: plan === PLAN_FULL ? PLAN_FULL : PLAN_ROOM, tariff: 'standard', nonRefundable: false, priceReductionAllowed: false, approvedPrice: 0 };
  const { passed, remaining, total } = stayNightsBefore(g, at);
  if (g.status === 'booking' || passed === 0) {
    const before = Math.round(num(g.pricePerNight)) || (total > 0 ? Math.round(num(g.totalPrice) / total) : 0);
    return { mode: 'reprice', patch: { ...base, pricePerNight: newPrice, totalPrice: newPrice * total, priceBefore: before } };
  }
  if (remaining <= 0) return { mode: 'none' };
  const oldPrice = Math.round(num(g.pricePerNight)) || (total > 0 ? Math.round(num(g.totalPrice) / total) : 0);
  const boundary = new Date(toDate(at)); boundary.setHours(12, 0, 0, 0);
  const firstCost = passed * oldPrice;
  const { first, second } = splitPaid(g, firstCost);
  const oldPatch = {
    days: passed, totalPrice: firstCost, checkOutDate: boundary.toISOString(),
    ...first, servicesTotal: 0, status: 'checked_out', planSwitchedOut: true,
    bonusCheckOutDate: null, bonusDaysAdded: null,
    ...(g.emehmonReg ? { emehmonOut: true, emehmonOutAt: boundary.toISOString(), emehmonMovedOut: true } : {}),
  };
  const end = (g.bonusCheckOutDate && new Date(g.bonusCheckOutDate) > new Date(g.checkOutDate)) ? g.bonusCheckOutDate : g.checkOutDate;
  const newGuest = {
    ...g, ...base, ...second,
    checkInDate: boundary.toISOString(), checkOutDate: end,
    days: remaining, pricePerNight: newPrice, totalPrice: remaining * newPrice,
    servicesTotal: num(g.servicesTotal),
    servicesPaidCarry: num(g.servicesPaidCarry) + Math.max(0, num(servicesPaid)),
    status: 'active', checkInDateTime: null, movedWithin: true,
    planSwitchedFrom: { guestId: g.id || '', plan: g.plan || null, price: oldPrice },
  };
  delete newGuest.id;
  delete newGuest.refBonusCredited;
  delete newGuest.planSwitchedOut;
  ['emehmonRegError', 'emehmonRegErrorAt', ...EMEHMON_OUT_KEYS].forEach((k) => { delete newGuest[k]; });
  if (g.emehmonReg) newGuest.emehmonRoomSkip = true;
  return { mode: 'split', passed, remaining, oldPrice, oldPatch, newGuest };
}

/**
 * Кого перевести на новые цены с даты начала тарифов: живущие и брони
 * филиала, у которых проживание заходит за дату начала, а тариф ещё не
 * выставлен (поле plan отсутствует — заселены по старым ценам).
 * [{ guest, plan, oldPrice, newPrice, passed, remaining, extra }]
 */
export function newPriceCandidates(guests = [], hostelId, cfg) {
  const h = plansOf(cfg)?.[hostelId];
  if (!h || !h.enabled || !h.from) return [];
  const from = new Date(h.from + 'T12:00:00');
  const out = [];
  for (const g of guests || []) {
    if (!g || g.hostelId !== hostelId || g.plan || g.oldPriceKept || g.nightPromo) continue;
    if (!(g.status === 'active' || g.status === 'booking')) continue;
    if (paidOf(g) > 0) continue; // есть оплата — не трогаем, новый тариф с продления
    if (!g.checkOutDate || ymd(g.checkOutDate) <= h.from) continue;
    const newPrice = planPrice(hostelId, PLAN_ROOM, g.country, from, cfg);
    if (!newPrice) continue;
    const { passed, remaining, total } = stayNightsBefore(g, from);
    const oldPrice = Math.round(num(g.pricePerNight)) || (total > 0 ? Math.round(num(g.totalPrice) / total) : 0);
    const nights = (g.status === 'booking' || passed === 0) ? total : remaining;
    if (nights <= 0) continue;
    out.push({ guest: g, plan: PLAN_ROOM, oldPrice, newPrice, passed: nights === total ? 0 : passed, remaining: nights, extra: (newPrice - oldPrice) * nights });
  }
  return out.sort((a, b) => String(a.guest.roomNumber || '').localeCompare(String(b.guest.roomNumber || ''), 'ru', { numeric: true }));
}

// ── Ночной заезд ──────────────────────────────────────────────────────────

/**
 * Предложение ночного заезда для гостя, пришедшего `now`: { price, end } —
 * цена места и конец (07:00 ближайшего утра), либо null (не тот филиал,
 * не то время, иностранец).
 */
export function nightPromoOffer(hostelId, country, now = new Date(), cfg) {
  const h = planConfig(hostelId, now, cfg);
  const n = h?.night;
  if (!n || n.enabled === false || !(num(n.price) > 0)) return null;
  if (n.localOnly !== false && !isLocal(country)) return null;
  const from = Number.isFinite(Number(n.fromHour)) ? Number(n.fromHour) : 23;
  const to = Number.isFinite(Number(n.toHour)) ? Number(n.toHour) : 7;
  const x = toDate(now);
  const hr = x.getHours();
  const inside = from > to ? (hr >= from || hr < to) : (hr >= from && hr < to);
  if (!inside) return null;
  const end = new Date(x);
  if (from > to && hr >= from) end.setDate(end.getDate() + 1);
  end.setHours(to, 0, 0, 0);
  return { price: Math.round(num(n.price)), end };
}

/**
 * Гость ночного заезда остаётся: его запись (50 000 до 07:00) закрывается,
 * с 07:00 начинается новая — `days` суток по цене тарифа, выезд в обычный
 * час. Деньги: сначала оплачивается ночь, остальное — в новую запись; услуги
 * «в счёт» и регистрация e-mehmon переходят, как при переезде.
 */
export function buildPromoContinuation(g, opts = {}) {
  return buildContinuation(g, opts);
}

/** Оплачено гостем: amountPaid или сумма способов, что больше. */
export const paidOf = (g) => Math.max(num(g?.amountPaid), PAY_FIELDS.reduce((s, k) => s + num(g?.[k]), 0));

/**
 * Продлевается ли гость новым проживанием по тарифу: у филиала действуют
 * тарифы, а гость живёт по старой цене (нет plan или цена сохранена) или
 * пришёл ночным заездом.
 */
export const extendsToNewTariff = (g, now = new Date(), cfg) =>
  !!g && !!planConfig(g.hostelId, now, cfg) && (!!g.nightPromo || !g.plan || !!g.oldPriceKept);

/**
 * Продолжение проживания с конца оплаченных дней: `days` суток по цене
 * тарифа, выезд в обычный час. Прежняя запись остаётся со своими днями и
 * ценой; оплата сверх её стоимости, услуги «в счёт» и регистрация e-mehmon
 * переходят в продолжение. Если конец ещё не наступил — продолжение ждёт
 * бронью, прежняя запись живёт до своего выезда (закрывает и открывает их
 * автопроверка, continuationsDue).
 */
export function buildContinuation(g, { days, price, plan, servicesPaid = 0, checkOutHour = 12, now = new Date() } = {}) {
  const n = Math.max(0, Math.round(num(days)));
  const p = Math.round(num(price));
  if (!g || !n || p <= 0 || !g.checkOutDate) return null;
  const co = new Date(g.checkOutDate);
  const bonus = g.bonusCheckOutDate ? new Date(g.bonusCheckOutDate) : null;
  const start = (bonus && bonus > co) ? bonus : co;
  const end = new Date(start); end.setDate(end.getDate() + n); end.setHours(checkOutHour, 0, 0, 0);
  const begun = start <= toDate(now);
  const firstCost = Math.round(num(g.totalPrice)) || Math.round(num(g.pricePerNight)) * Math.max(1, Math.round(num(g.days)));
  const { first, second } = splitPaid(g, firstCost);
  const closeOld = {
    status: 'checked_out',
    ...(g.emehmonReg ? { emehmonOut: true, emehmonOutAt: start.toISOString(), emehmonMovedOut: true } : {}),
  };
  const oldPatch = { ...first, servicesTotal: 0, ...(begun ? closeOld : {}) };
  const newGuest = {
    ...g, ...second,
    checkInDate: start.toISOString(), checkOutDate: end.toISOString(),
    days: n, pricePerNight: p, totalPrice: p * n,
    plan: plan === PLAN_FULL ? PLAN_FULL : PLAN_ROOM, tariff: 'standard', nonRefundable: false,
    priceReductionAllowed: false, approvedPrice: 0,
    servicesTotal: num(g.servicesTotal),
    servicesPaidCarry: num(g.servicesPaidCarry) + Math.max(0, num(servicesPaid)),
    status: begun ? 'active' : 'booking', checkInDateTime: null, movedWithin: true, continuedFrom: g.id || '',
  };
  delete newGuest.id;
  ['nightPromo', 'refBonusCredited', 'oldPriceKept', 'continuedBy', 'planSwitchedFrom', 'priceBefore', 'bonusCheckOutDate', 'bonusDaysAdded']
    .forEach((k) => { delete newGuest[k]; });
  ['emehmonRegError', 'emehmonRegErrorAt', ...EMEHMON_OUT_KEYS].forEach((k) => { delete newGuest[k]; });
  if (g.emehmonReg) newGuest.emehmonRoomSkip = true;
  return { oldPatch, newGuest, begun, closeOld };
}

/**
 * Что пора сделать с продолжениями: закрыть прежние записи, чьи дни
 * кончились (close), и открыть продолжения-брони, чьё время пришло (activate).
 */
export function continuationsDue(guests = [], now = new Date()) {
  const t = toDate(now);
  const close = [], activate = [];
  for (const g of guests || []) {
    if (!g) continue;
    if (g.continuedBy && g.status === 'active' && g.checkOutDate && new Date(g.checkOutDate) <= t) close.push(g);
    if (g.continuedFrom && g.status === 'booking' && g.checkInDate && new Date(g.checkInDate) <= t) activate.push(g);
  }
  return { close, activate };
}

/**
 * Откат автопересчёта для гостей с оплатой (уточнение владельца 2026-10-01):
 * продолжения `<гость>_np`, созданные пересчётом, возвращаются на прежнюю
 * цену, если у гостя была оплата. Цена берётся из planSwitchedFrom.price.
 */
export function oldPriceRevertCandidates(guests = [], hostelId) {
  const byId = new Map((guests || []).map((g) => [g.id, g]));
  const out = [];
  for (const g of guests || []) {
    if (!g || g.hostelId !== hostelId || !String(g.id || '').endsWith('_np')) continue;
    if (g.oldPriceKept || g.plan !== PLAN_ROOM || !(g.status === 'active' || g.status === 'booking')) continue;
    const from = g.planSwitchedFrom;
    if (!from || from.plan || !(num(from.price) > 0)) continue;
    const orig = byId.get(from.guestId);
    if (!orig || paidOf(orig) <= 0) continue;
    const price = Math.round(num(from.price));
    out.push({ guest: g, patch: { pricePerNight: price, totalPrice: price * Math.round(num(g.days)), plan: null, oldPriceKept: true } });
  }
  return out;
}

/**
 * Пересчитанные целиком (бронь или заезд с 1-го) гости с оплатой: прежняя
 * цена записана в priceBefore — возвращаем её.
 */
export function repricedPrepaidCandidates(guests = [], hostelId) {
  const out = [];
  for (const g of guests || []) {
    if (!g || g.hostelId !== hostelId || g.oldPriceKept || !(num(g.priceBefore) > 0)) continue;
    if (!(g.status === 'active' || g.status === 'booking') || paidOf(g) <= 0) continue;
    const price = Math.round(num(g.priceBefore));
    out.push({ guest: g, patch: { pricePerNight: price, totalPrice: price * Math.round(num(g.days)), plan: null, oldPriceKept: true } });
  }
  return out;
}
