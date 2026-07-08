/**
 * Централизованное ценообразование: минимальная цена ночи по комнате/филиалу,
 * цена и минимум дней пакета, сезоны по датам.
 *
 * Конфиг живёт в appConfig.pricing (Настройки → Цены). Всё с fallback на старые
 * дефолты (минимум 70000, пакет 65000, 10 дней), чтобы ничего не ломалось, пока
 * админ не задал свою схему.
 */
import { getConfig } from './appConfig';

export const LEGACY_MIN_PRICE = 70000;
export const LEGACY_PACKAGE_PRICE = 65000;
export const LEGACY_PACKAGE_MIN_DAYS = 10;

const two = (n) => String(n).padStart(2, '0');
const mmdd = (d) => two(d.getMonth() + 1) + '-' + two(d.getDate());

// from/to в формате 'MM-DD'. Поддерживает переход через год (зима 12-01 → 02-28).
const inRange = (date, from, to) => {
    const cur = mmdd(date);
    if (!from || !to) return false;
    return from <= to ? (cur >= from && cur <= to) : (cur >= from || cur <= to);
};

const toDate = (d) => (d instanceof Date ? d : (d ? new Date(d) : new Date()));

/** Активный сезон на дату (или null). */
export function activeSeason(date = new Date(), cfg = getConfig()) {
    const seasons = cfg?.pricing?.seasons || [];
    const dt = toDate(date);
    return seasons.find((s) => s && inRange(dt, s.from, s.to)) || null;
}

const pick = (block, hostelId, roomNumber, fallback) => {
    const h = (block && block[hostelId]) || {};
    const rooms = h.rooms || {};
    const r = String(roomNumber == null ? '' : roomNumber).trim();
    const v = rooms[r];
    if (v != null && v !== '' && Number(v) > 0) return Number(v);
    if (h.default != null && h.default !== '' && Number(h.default) > 0) return Number(h.default);
    return fallback;
};

/**
 * Явно заданная в настройках цена комнаты (rooms[номер] или default филиала), либо
 * null — если для филиала вообще нет конфигурации. Используется как ПОДСТАВЛЯЕМАЯ
 * цена при заселении (в отличие от minNightPrice, который всегда что-то возвращает).
 */
export function configuredNightPrice(hostelId, roomNumber, date = new Date(), cfg = getConfig()) {
    const p = cfg?.pricing;
    if (!p) return null;
    const s = activeSeason(date, cfg);
    const base = (s && s.base) || p.base || {};
    const h = base[hostelId];
    if (!h) return null;
    const r = String(roomNumber == null ? '' : roomNumber).trim();
    const rv = h.rooms && h.rooms[r];
    if (rv != null && rv !== '' && Number(rv) > 0) return Number(rv);
    if (h.default != null && h.default !== '' && Number(h.default) > 0) return Number(h.default);
    return null;
}

/** Минимальная цена ночи (обычный тариф) для комнаты филиала на дату. */
export function minNightPrice(hostelId, roomNumber, date = new Date(), cfg = getConfig()) {
    const p = cfg?.pricing;
    if (!p) return LEGACY_MIN_PRICE;
    const s = activeSeason(date, cfg);
    const base = (s && s.base) || p.base || {};
    return pick(base, hostelId, roomNumber, LEGACY_MIN_PRICE);
}

/** Цена пакета за ночь для комнаты (0 в конфиге → общий packagePrice). */
export function packageNightPrice(hostelId, roomNumber, date = new Date(), cfg = getConfig()) {
    const p = cfg?.pricing;
    if (!p) return LEGACY_PACKAGE_PRICE;
    const s = activeSeason(date, cfg);
    const pkg = (s && s.package) || p.package || {};
    const common = Number((s && s.packagePrice) ?? p.packagePrice ?? LEGACY_PACKAGE_PRICE) || LEGACY_PACKAGE_PRICE;
    return pick(pkg, hostelId, roomNumber, common);
}

/** Минимум дней для пакетного тарифа. */
export function packageMinDays(date = new Date(), cfg = getConfig()) {
    const p = cfg?.pricing;
    if (!p) return LEGACY_PACKAGE_MIN_DAYS;
    const s = activeSeason(date, cfg);
    return Number((s && s.packageMinDays) ?? p.packageMinDays ?? LEGACY_PACKAGE_MIN_DAYS) || LEGACY_PACKAGE_MIN_DAYS;
}
