/**
 * shiftMath — сутки и доли смен для отчётов и зарплаты.
 *
 * Смену можно разделить между двумя кассирами: при передаче смены (подмена) и
 * когда админ делит уже отработанную смену. Обе части получают shareRatio = 0.5,
 * и тогда фактические часы не важны — каждому засчитывается ровно половина суток
 * и половина суточной ставки. Иначе подменивший 4 часа получил бы четверть ставки,
 * а сменивший его — три четверти.
 *
 * Без JSX — модуль импортируется и в компоненты, и в тесты на node.
 */

/** Активная смена засчитывается как отработанные сутки только после этого порога. */
export const ACTIVE_COUNT_AFTER_H = 3;

/**
 * Эффективный диапазон смены для подсчёта отработанного и начисления ЗП:
 *  • закрытая смена — её реальные времена (нормализованы при закрытии);
 *  • активная старше 3ч — виртуальные сутки 9:00 дня старта → +24ч;
 *  • активная младше 3ч — null (ещё не засчитывается).
 */
export const effShiftRange = (s, now = Date.now()) => {
    if (!s?.startTime) return null;
    if (s.endTime) return { start: s.startTime, end: s.endTime };
    const ageH = (now - new Date(s.startTime).getTime()) / 3600000;
    if (!(ageH > ACTIVE_COUNT_AFTER_H)) return null;
    const st = new Date(s.startTime); st.setHours(9, 0, 0, 0);
    const en = new Date(st); en.setDate(en.getDate() + 1);
    return { start: st.toISOString(), end: en.toISOString() };
};

/** Доля смены у сотрудника: 1 — целиком, 0.5 — половина. */
export const ratioOf = (s) => {
    const r = Number(s?.shareRatio);
    return Number.isFinite(r) && r > 0 && r <= 1 ? r : 1;
};

/** Смена разделена между двумя кассирами. */
export const isShared = (s) => !!s?.shareGroupId;

/** Сколько суток засчитывается сотруднику за смену. */
export const shiftDays = (s, now = Date.now()) => {
    const r = effShiftRange(s, now);
    if (!r) return 0;
    if (s.shareRatio) return ratioOf(s);
    return (new Date(r.end) - new Date(r.start)) / 86400000;
};

/** ЗП за смену: сутки × суточная ставка (у половинки — половина ставки). */
export const shiftSalary = (s, dailyRate, now = Date.now()) =>
    Math.round(shiftDays(s, now) * (Number(dailyRate) || 0));

/** «1», «0.5», «2.5» — без хвоста .0 у целых. */
export const fmtDays = (n) => (Number.isInteger(n) ? String(n) : Number(n).toFixed(1));
