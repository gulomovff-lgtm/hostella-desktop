/**
 * Окно данных: что грузится всегда, а что — только по запросу.
 *
 * Раньше при каждом входе и на каждой кассе загружались ВСЕ гости, оплаты и
 * расходы за всё время — тысячи документов, которые разбирались и держались в
 * памяти, хотя кассиру для работы нужны живущие и последние недели.
 *
 * Всегда (на всех устройствах, сразу):
 *   • гости со статусом живёт / бронь / долговая запись — любой давности;
 *   • гости, оплаты и расходы за последние HISTORY_WINDOW_DAYS дней;
 *   • участники и оплаты открытых договоров — любой давности (их суммы
 *     считаются по всей длине договора, а договор виден в «Номерах»).
 * По запросу (вся коллекция): экраны HISTORY_TABS; админ и супер — фоном.
 *
 * Без Firestore и React — покрыто тестами (tests/history-window.test.mjs).
 */

export const HISTORY_WINDOW_DAYS = 62;

/** Гости этих статусов грузятся всегда, сколько бы им ни было лет. */
export const LIVE_GUEST_STATUSES = ['active', 'booking', 'debt'];

/**
 * Экраны, которым нужна полная история (отчёты за любой период, долги
 * давних гостей, история клиента, налоговые суммы прошлых месяцев…).
 */
export const HISTORY_TABS = new Set([
  'reports', 'analytics', 'shifts', 'debts', 'guesthistory', 'clients', 'clientdupes',
  'calendar', 'expenses', 'registrations', 'referrals', 'manualstay',
]);

/** Граница окна — ISO-строка (даты в базе — ISO, сравнение строк корректно). */
export function historyCutoffIso(now = new Date(), days = HISTORY_WINDOW_DAYS) {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Ключи открытых договоров: id (для оплат) и ФИО участников (для гостей). */
export function openContractKeys(groups = []) {
  const ids = [], names = new Set();
  for (const g of groups || []) {
    if (!g || g.closed) continue;
    if (g.id) ids.push(g.id);
    for (const k of g.memberKeys || []) if (k && String(k).trim()) names.add(String(k).trim());
  }
  return { ids: ids.sort(), names: [...names].sort() };
}

/**
 * Ключи поиска визитов одного человека: паспорт как введён и без пробелов
 * (в базе встречаются оба вида), иначе ФИО как записано. Короткий паспорт
 * (кассир ещё печатает) — не ключ.
 */
export function personQueryKeys(person = {}) {
  const raw = String(person?.passport || '').trim();
  const clean = raw.replace(/\s+/g, '').toUpperCase();
  const passports = clean.length >= 5 ? [...new Set([clean, raw, raw.toUpperCase()])].filter(Boolean) : [];
  const name = passports.length ? '' : String(person?.fullName || '').trim();
  return { passports, name };
}

/** Разбить на части (запрос «in» в Firestore — до 30 значений). */
export function chunk(arr = [], size = 30) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
