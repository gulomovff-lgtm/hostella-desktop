/**
 * guestSource.js — откуда пришёл гость.
 *
 * ── ЗАЧЕМ ───────────────────────────────────────────────────────────────
 *
 * Владелец не знает, какой канал ему выгоден: Booking приводит гостей и
 * берёт комиссию, сайт не берёт ничего, но и приводит меньше, а половина
 * заселений — люди с улицы. Пока у заселения нет пометки «откуда», решение
 * «отключить Booking» или «вложиться в рекламу» принимается на ощупь.
 * Одно поле у заселения даёт главный управленческий ответ.
 *
 * ── ПОЧЕМУ СПИСОК ЗАКРЫТЫЙ, НО РЕДАКТИРУЕМЫЙ ────────────────────────────
 *
 * Свободная строка превращается в «букинг», «Booking», «booking.com» и
 * «бук» — четыре канала вместо одного, и отчёт по ним бесполезен. Поэтому
 * кассир выбирает из списка. Но каналы у хостела меняются (появился
 * Instagram, ушёл Hostelworld), поэтому список правится из настроек:
 * встроенные источники можно переименовать и скрыть, свои — добавить и
 * удалить. Идентификатор источника при этом не меняется никогда — на нём
 * держится статистика за прошлые периоды.
 *
 * ── ПОЧЕМУ ЕСТЬ УГАДЫВАНИЕ ──────────────────────────────────────────────
 *
 * В базе тысячи заселений без этого поля. Ставить им всем «прочее» —
 * получить отчёт, где прочее составляет 90% и не значит ничего. Поэтому
 * источник ВЫВОДИТСЯ из того, что уже записано: бронь с сайта или бота
 * несёт `fromWebsite`/`channel`. Догадки молчат, как только поле выбрано
 * руками.
 */

/** Встроенные источники. Порядок — как в списке у кассира и в отчёте. */
export const BUILTIN_SOURCES = ['walk_in', 'site', 'phone', 'booking', 'hostelworld', 'repeat', 'other'];

/** Подписи встроенных источников по языкам (переопределяются в настройках). */
export const BUILTIN_LABELS = {
    ru: {
        walk_in: 'С улицы',
        site: 'Сайт и бот',
        phone: 'По телефону',
        booking: 'Booking.com',
        hostelworld: 'Hostelworld',
        repeat: 'Постоянный гость',
        other: 'Прочее',
    },
    uz: {
        walk_in: 'Ko‘chadan',
        site: 'Sayt va bot',
        phone: 'Telefon orqali',
        booking: 'Booking.com',
        hostelworld: 'Hostelworld',
        repeat: 'Doimiy mehmon',
        other: 'Boshqa',
    },
};

/**
 * Умолчание — «с улицы», а не «прочее»: в хостеле большинство заселений
 * именно такие, и умолчание должно совпадать с самым частым случаем.
 * Иначе кассир меняет его при каждом заселении, устаёт и перестаёт.
 */
export const DEFAULT_SOURCE = 'walk_in';

/** Эти два нельзя ни скрыть, ни удалить: на них опираются умолчание и «всё остальное». */
const PINNED = new Set(['walk_in', 'other']);

const isBuiltin = (id) => BUILTIN_SOURCES.includes(id);

/**
 * Привести список из настроек к рабочему виду: убрать мусор, добавить
 * встроенные источники, которых в списке ещё нет (появились позже, чем
 * настройки сохранялись), закрепить обязательные.
 *
 * Пустой/отсутствующий список = только встроенные — так работает база,
 * в которой настройку ни разу не открывали.
 *
 * @param {Array<{id:string,label?:string,labelUz?:string,enabled?:boolean}>} list
 * @returns {Array<{id:string,label:string,labelUz:string,enabled:boolean,builtin:boolean}>}
 */
export function normalizeSources(list) {
    const seen = new Set();
    const out = [];
    for (const raw of Array.isArray(list) ? list : []) {
        const id = String(raw?.id || '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push({
            id,
            label: String(raw.label || '').trim(),
            labelUz: String(raw.labelUz || '').trim(),
            enabled: PINNED.has(id) ? true : raw.enabled !== false,
            builtin: isBuiltin(id),
        });
    }
    for (const id of BUILTIN_SOURCES) {
        if (seen.has(id)) continue;
        out.push({ id, label: '', labelUz: '', enabled: true, builtin: true });
    }
    return out;
}

/** Идентификатор для своего источника: латиница из подписи + защита от совпадений. */
export function makeSourceId(label, existing = []) {
    const taken = new Set(normalizeSources(existing).map(s => s.id));
    const base = String(label || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 24) || 'src';
    let id = `c_${base}`;
    let n = 2;
    while (taken.has(id) || isBuiltin(id)) { id = `c_${base}_${n++}`; }
    return id;
}

/** Подпись источника на языке интерфейса: из настроек, иначе встроенная, иначе сам id. */
export function sourceLabel(id, list, lang = 'ru') {
    const s = normalizeSources(list).find(x => x.id === id);
    const custom = lang === 'uz' ? (s?.labelUz || s?.label) : (s?.label || s?.labelUz);
    if (custom) return custom;
    return BUILTIN_LABELS[lang]?.[id] || BUILTIN_LABELS.ru[id] || id || '';
}

/**
 * Что кассир видит в списке: только включённые источники, в порядке
 * настроек. Значение `keep` (уже записанный у гостя источник) остаётся
 * в списке, даже если его потом скрыли — иначе при правке карточки оно
 * молча подменится на первый пункт.
 */
export function sourceOptions(list, lang = 'ru', keep = '') {
    const all = normalizeSources(list);
    return all
        .filter(s => s.enabled || s.id === keep)
        .map(s => ({ id: s.id, label: sourceLabel(s.id, all, lang) }));
}

export const isKnownSource = (id, list) => !!id && normalizeSources(list).some(s => s.id === id);

/**
 * Источник заселения. Явно выбранное значение сильнее любых догадок;
 * догадки идут от самой надёжной приметы к самой слабой.
 */
export function sourceOf(guest, list) {
    const g = guest || {};
    if (isKnownSource(g.source, list)) return g.source;

    // Бронь с сайта или из бота: поле ставит само заселение по брони.
    if (g.fromWebsite === true) return 'site';
    if (g.channel === 'site' || g.channel === 'telegram') return 'site';

    // Названия площадок в поле канала — на случай будущего менеджера каналов.
    if (typeof g.channel === 'string') {
        const c = g.channel.toLowerCase();
        if (c.includes('booking')) return 'booking';
        if (c.includes('hostelworld')) return 'hostelworld';
    }
    return DEFAULT_SOURCE;
}

const toMs = (v) => { const t = new Date(v).getTime(); return Number.isFinite(t) ? t : NaN; };

/**
 * Сводка по источникам за период.
 *
 * Гость считается один раз — по заезду в период. Выручка берётся из
 * платежей периода по гостю (так же считает остальная аналитика), поэтому
 * продление, оплаченное в этом месяце за заезд прошлого, попадает сюда,
 * а не теряется. Доля — от выручки, не от числа заселений: десять человек
 * по одной ночи и двое на месяц — разные деньги, и владельца интересуют
 * они, а не головы.
 *
 * @returns {Array<{source,label,guests,nights,revenue,share}>} по убыванию выручки
 */
export function summarizeSources({ guests = [], payments = [], from, to } = {}, list, lang = 'ru') {
    const fromMs = from ? toMs(from) : -Infinity;
    const toMsV  = to   ? toMs(to)   :  Infinity;
    const inRange = (v) => { const t = toMs(v); return Number.isFinite(t) && t >= fromMs && t <= toMsV; };

    const all = normalizeSources(list);
    const acc = new Map();
    const bucket = (id) => {
        const key = isKnownSource(id, all) ? id : 'other';
        if (!acc.has(key)) acc.set(key, { source: key, guests: 0, nights: 0, revenue: 0 });
        return acc.get(key);
    };

    const srcByGuest = new Map();
    for (const g of guests) {
        if (!g || g.status === 'cancelled' || g.deleted === true) continue;
        const src = sourceOf(g, all);
        srcByGuest.set(g.id, src);
        if (!inRange(g.checkInDate)) continue;
        const b = bucket(src);
        b.guests += 1;
        b.nights += Math.max(0, parseInt(g.days) || 0);
    }

    let total = 0;
    for (const p of payments) {
        if (!p || !inRange(p.date)) continue;
        const src = srcByGuest.get(p.guestId);
        if (!src) continue;             // платёж не за проживание гостя — не наш
        const amt = Number(p.amount) || 0;
        bucket(src).revenue += amt;
        total += amt;
    }

    return [...acc.values()]
        .filter(x => x.guests > 0 || x.revenue !== 0)
        .map(x => ({
            ...x,
            revenue: Math.round(x.revenue),
            label: sourceLabel(x.source, all, lang),
            // Доля в целых процентах: десятые здесь не решают ничего.
            share: total > 0 ? Math.round((x.revenue / total) * 100) : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue || b.guests - a.guests);
}
