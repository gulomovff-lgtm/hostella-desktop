// Прошлые заезды гостя: по сколько он оставался в предыдущие разы.
//
// Кассиру при заселении полезно видеть не только «сколько раз жил», но и
// НА СКОЛЬКО: постоянный гость обычно берёт один и тот же срок, и это сразу
// подсказывает, сколько суток ставить.
//
// Длительность считаем по фактическим датам заезда/выезда, а не по полю days:
// days — это на сколько оформили, а гость мог съехать раньше. Вопрос был
// «по сколько оставался», значит важен факт.

/** Ключ сверки гостя и клиента: паспорт без пробелов, в верхнем регистре. */
export const passportKey = (s = '') => String(s || '').replace(/\s+/g, '').toUpperCase();

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Сколько ночей длился заезд. Считаем по календарным суткам (полночь к полуночи),
 * иначе заезд в 14:00 и выезд в 12:00 дали бы «0 ночей» вместо одной.
 * Если дат нет или они некорректны — откатываемся на оформленное значение days.
 */
export const stayNights = (g) => {
    const inMs = Date.parse(g?.checkInDate);
    const outMs = Date.parse(g?.checkOutDate);
    if (Number.isFinite(inMs) && Number.isFinite(outMs) && outMs >= inMs) {
        const day = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
        const nights = Math.round((day(outMs) - day(inMs)) / MS_PER_DAY);
        if (nights > 0) return nights;
        // Заехал и выехал в один календарный день — это всё равно сутки.
        return 1;
    }
    const days = parseInt(g?.days, 10);
    return Number.isFinite(days) && days > 0 ? days : null;
};

/**
 * Во сколько обошлась ночь в этом заезде.
 * Берём оформленную цену за ночь; если её нет — выводим из общей суммы и числа
 * ночей (так считается и пакетная цена, и заезд со скидкой).
 */
export const stayNightPrice = (g, nights) => {
    const per = parseInt(g?.pricePerNight, 10);
    if (Number.isFinite(per) && per > 0) return per;
    const total = parseInt(g?.totalPrice, 10);
    if (Number.isFinite(total) && total > 0 && nights > 0) return Math.round(total / nights);
    return null;
};

/**
 * Последние завершённые заезды этого гостя, свежие первыми.
 *
 * Берём только checked_out: booking — ещё не состоявшийся заезд, active — текущий,
 * а вопрос про прошлые разы. Свою же запись (ту, которую сейчас заселяют)
 * исключаем по id, иначе гость попал бы в собственную историю.
 *
 * @param {object[]} guests
 * @param {{passport?: string, excludeId?: string|null, limit?: number}} opts
 * @returns {Array<{id, nights, nightPrice, total, checkInDate}>}
 */
export const recentStays = (guests = [], opts = {}) => {
    const { passport, excludeId = null, limit = 3 } = opts;
    const key = passportKey(passport);
    if (!key) return [];
    return guests
        .filter(g => g
            && g.id !== excludeId
            && g.status === 'checked_out'
            && passportKey(g.passport) === key)
        .sort((a, b) => (Date.parse(b.checkInDate) || 0) - (Date.parse(a.checkInDate) || 0))
        .slice(0, limit)
        .map(g => {
            const nights = stayNights(g);
            const total = parseInt(g.totalPrice, 10);
            return {
                id: g.id,
                nights,
                nightPrice: stayNightPrice(g, nights),
                total: Number.isFinite(total) && total > 0 ? total : null,
                checkInDate: g.checkInDate,
            };
        });
};
