/**
 * Иностранцы в первом филиале (решение владельца 14.11.2026):
 *  • посуточно — не меньше 100 000 за сутки;
 *  • пакет от 5 суток — 90 000 за сутки;
 *  • регистрация в e-mehmon — не ниже 90 000 за сутки.
 * Живущим — с 14.11.2026 12:00: прожитые сутки по старой цене, оставшиеся по
 * новой (деление проживания, utils/stayPlans.js → buildPlanSwitch).
 * Переопределяется в appConfig.pricing.foreign[hostelId].
 *
 * Без импортов — модуль покрыт тестами на node (tests/pricing-foreign.test.mjs).
 */

export const LOCAL_COUNTRY = 'Узбекистан';
const isLocal = (country) => { const c = String(country || '').trim(); return !c || c === LOCAL_COUNTRY; };
const two = (n) => String(n).padStart(2, '0');

export const DEFAULT_FOREIGN_RULES = {
  hostel1: { from: '2026-11-14', daily: 100000, package: 90000, packageMinDays: 5, emehmonMin: 90000 },
};

/** Правило иностранцев филиала на дату или null (местный гость, другой филиал, до даты начала). */
export function foreignRule(hostelId, country, date = new Date(), cfg = null) {
  if (!hostelId || !country || isLocal(country)) return null;
  const r = (cfg?.pricing?.foreign || DEFAULT_FOREIGN_RULES)[hostelId];
  if (!r || r.enabled === false) return null;
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const day = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
  if (r.from && day < r.from) return null;
  return {
    daily: Number(r.daily) || 0,
    package: Number(r.package) || 0,
    packageMinDays: Number(r.packageMinDays) || 0,
    emehmonMin: Number(r.emehmonMin) || 0,
  };
}

/** Минимум за сутки по правилу: от packageMinDays суток — цена пакета, иначе посуточная. */
export function foreignNightFloor(rule, days) {
  if (!rule) return 0;
  const d = Number(days) || 0;
  return rule.package > 0 && rule.packageMinDays > 0 && d >= rule.packageMinDays ? rule.package : rule.daily;
}
