// Занятость смены в хостеле: одно правило на все места, где это проверяется.
//
// Проверка нужна в двух точках — на входе (до того, как кассир увидит рабочий
// экран) и в самом приложении как страховка, если смену открыли параллельно.
// Раньше правило было продублировано в App.jsx двумя разными местами и читало
// состояние shifts, которое до входа ещё не загружено, поэтому на логине оно
// фактически не срабатывало: кассир проходил внутрь и упирался в блокировку
// только после полной загрузки данных.
//
// Чистая функция без Firestore и React — чтобы покрыть тестами.

/**
 * Открытая смена другого сотрудника в этом хостеле, из-за которой нельзя начать свою.
 *
 * Не считаем блокирующими:
 *  - собственные смены (по id и по логину — id документа мог смениться);
 *  - «призрачные» смены удалённых сотрудников, иначе удаление кассира
 *    заблокировало бы вход всем остальным.
 *
 * @param {object[]} shifts  список смен
 * @param {object[]} users   актуальный список сотрудников
 * @param {{hostelId: string, userId?: string, userLogin?: string}} who
 * @returns {object|null} блокирующая смена либо null
 */
export const findBlockingShift = (shifts = [], users = [], who = {}) => {
    const { hostelId, userId, userLogin } = who;
    if (!hostelId) return null;
    return shifts.find(s =>
        s.hostelId === hostelId &&
        !s.endTime &&
        (userId ? s.staffId !== userId : true) &&
        (userLogin && s.staffLogin ? s.staffLogin !== userLogin : true) &&
        users.some(u => u.id === s.staffId || (s.staffLogin && u.login === s.staffLogin))
    ) || null;
};

/** Имя сотрудника, который держит смену — для сообщения кассиру. */
export const blockingOwnerName = (shift, users = [], fallback = '') => {
    if (!shift) return '';
    const owner = users.find(u => u.id === shift.staffId || (shift.staffLogin && u.login === shift.staffLogin));
    return owner?.name || shift.staffName || shift.staffLogin || fallback;
};
