/**
 * roomBeds.js — состояние мест в комнате. Один расчёт для экрана «Номера»
 * и дашборда (владелец 2026-09-28: дашборд показывал неверное число
 * свободных мест — не учитывал брони на сегодня и считал по-своему).
 *
 * Статусы места: occupied / timeout (просрочил выезд, но < 28 ч) / booking
 * (бронь на сегодня, место занято) / free_limited (свободно N дн. до брони) /
 * free / rented_out (комната в аренде). Доп. места (bedId вне 1..capacity)
 * — isExtra.
 */
import { chargeOf } from './shop.js';

export const parseDate = d => {
    if (!d) return null;
    const dt = new Date(d);
    if (typeof d === 'string' && !d.includes('T')) dt.setHours(12, 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
};
const getTotalPaid = g =>
    typeof g.amountPaid === 'number'
        ? g.amountPaid
        : (g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0);
const getDaysDiff = (a, b) => (!a || !b) ? 0 : Math.ceil((b - a) / 864e5);
export const isRegularBedId = (bedId, capacity) => {
    const n = Number(bedId);
    return Number.isInteger(n) && n >= 1 && n <= capacity;
};

export const buildBedsData = (room, guests, now = new Date()) => {
    // Конец сегодняшнего дня. Гость со статусом active считается уже присутствующим,
    // если дата заезда — сегодня или раньше (даже если расчётный час 14:00 ещё не настал
    // при раннем заезде утром). Будущие заезды в системе всегда имеют статус booking.
    const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
    const isArrived = (g) => new Date(g.checkInDate) <= endOfToday;
    const cap = parseInt(room.capacity) || 0;
    // Если комната сдана в аренду — все места считаются занятыми
    if (room.rental?.active) {
        return Array.from({ length: cap }, (_, i) => ({
            id: i + 1,
            status: 'rented_out',
            guest: null,
            debt: 0,
            isTimeout: false,
            isBonus: false,
            freeForDays: null,
            incomingGuest: null,
            incomingDays: null,
        }));
    }
    const byBed = {};
    guests.forEach(g => {
        const rawBedId = g?.bedId == null ? '' : String(g.bedId);
        const k = rawBedId || `extra-${g.id}`;
        if (!byBed[k]) byBed[k] = [];
        byBed[k].push(g);
    });
    const beds = [];
    for (let i = 1; i <= cap; i++) {
        const bg = byBed[String(i)] || [];
        // Активный гость — статус active И заезд сегодня или раньше
        const activeGuest = bg.find(g => g.status === 'active' && isArrived(g));
        const nextBooking = bg
            .filter(g => (g.status === 'booking' ||
                (g.status === 'active' && !isArrived(g))) &&
                g !== activeGuest)
            .sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate))[0];
        let status = 'free', displayGuest = null, debt = 0, isTimeout = false, isBonus = false, freeForDays = null;
        let incomingGuest = null, incomingDays = null;
        if (activeGuest) {
            const co      = parseDate(activeGuest.checkOutDate);
            const bonusCo = activeGuest.bonusCheckOutDate ? parseDate(activeGuest.bonusCheckOutDate) : null;
            // Use the later of the two dates (bonus may be outdated after an extension)
            const effectiveCo = (bonusCo && co && bonusCo > co) ? bonusCo : (co || bonusCo);
            const expired = effectiveCo && now > effectiveCo;
            isBonus = !!(bonusCo && co && now > co && now <= bonusCo);
            if (expired && (now - effectiveCo) / 3_600_000 > 28) {
                status = 'free';
            } else {
                displayGuest = activeGuest;
                debt = Math.max(0, chargeOf(activeGuest) - getTotalPaid(activeGuest));
                isTimeout = !!expired;
                status = isTimeout ? 'timeout' : 'occupied';
                // Входящее бронирование даже при занятой ячейке
                if (nextBooking) {
                    const du = getDaysDiff(now, parseDate(nextBooking.checkInDate));
                    incomingGuest = nextBooking;
                    incomingDays = Math.max(0, du);
                }
            }
        } else if (nextBooking) {
            const du = getDaysDiff(now, parseDate(nextBooking.checkInDate));
            if (du <= 0) { status = 'booking'; displayGuest = nextBooking; }
            else { status = 'free_limited'; displayGuest = nextBooking; freeForDays = du; }
        }
        beds.push({ id: i, status, guest: displayGuest, debt, isTimeout, isBonus, freeForDays, incomingGuest, incomingDays });
    }

    const extraBedIds = Object.keys(byBed).filter(k => !isRegularBedId(k, cap));
    extraBedIds.forEach(extraBedId => {
        const bg = byBed[extraBedId] || [];
        const activeGuest = bg
            .filter(g => g.status === 'active' && isArrived(g))
            .sort((a, b) => new Date(b.checkInDate || 0) - new Date(a.checkInDate || 0))[0];
        const nextBooking = bg
            .filter(g => (g.status === 'booking' || (g.status === 'active' && !isArrived(g))) && g !== activeGuest)
            .sort((a, b) => new Date(a.checkInDate || 0) - new Date(b.checkInDate || 0))[0];

        const showGuest = activeGuest || nextBooking;
        if (!showGuest) return;

        let status = nextBooking && !activeGuest ? 'booking' : 'occupied';
        let debt = 0;
        let isTimeout = false;
        let isBonus = false;

        if (activeGuest) {
            const co = parseDate(activeGuest.checkOutDate);
            const bonusCo = activeGuest.bonusCheckOutDate ? parseDate(activeGuest.bonusCheckOutDate) : null;
            const effectiveCo = (bonusCo && co && bonusCo > co) ? bonusCo : (co || bonusCo);
            const expired = effectiveCo && now > effectiveCo;
            isBonus = !!(bonusCo && co && now > co && now <= bonusCo);
            debt = Math.max(0, chargeOf(activeGuest) - getTotalPaid(activeGuest));
            isTimeout = !!expired;
            status = isTimeout ? 'timeout' : 'occupied';
        }

        beds.push({
            id: extraBedId,
            status,
            guest: showGuest,
            debt,
            isTimeout,
            isBonus,
            freeForDays: null,
            incomingGuest: null,
            incomingDays: null,
            isExtra: true,
        });
    });

    return beds;
};

/** Сводка по местам (как у строки комнаты на экране «Номера»). */
export const bedStats = (beds = []) => beds.reduce((a, b) => {
    if (b.status === 'occupied' || b.isTimeout || b.status === 'rented_out') a.occ++;
    if (b.status === 'free' || b.status === 'free_limited') a.free++;
    if (b.status === 'free_limited') a.freeLimited++;
    if (b.status === 'booking') a.booking++;
    if (b.status === 'rented_out') a.rented++;
    if (b.isTimeout) a.timeout++;
    return a;
}, { occ: 0, free: 0, freeLimited: 0, booking: 0, rented: 0, timeout: 0 });
