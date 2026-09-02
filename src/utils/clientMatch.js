// Сверка «это тот же клиент?» — одно правило на все места, где заводится клиент.
//
// Клиент создаётся из четырёх мест: заселение, синхронизация из гостей, импорт
// CSV и ручное добавление. Правило сверки было в каждом своё (где-то точное
// сравнение строк, где-то нормализованное), поэтому «AC 1234567» и «AC1234567»
// считались разными людьми.
//
// Отдельная и более грубая беда — пакетные циклы: поиск шёл по состоянию
// clients, а оно внутри цикла не меняется, ведь batch применяется в конце.
// У постоянного гостя одна запись на каждый заезд, поэтому синхронизация
// создавала человека столько раз, сколько раз он жил. Для этого есть
// pendingIndex: он помнит, кого уже поставили в очередь на создание.

/** Паспорт без пробелов и в верхнем регистре: «ac 123 4567» → «AC1234567». */
export const passportKey = (s = '') => String(s || '').replace(/\s+/g, '').toUpperCase();

/** ФИО без лишних пробелов, в верхнем регистре, Ё сведена к Е. */
export const nameKey = (s = '') =>
    String(s || '').toUpperCase().replace(/Ё/g, 'Е').replace(/\s+/g, ' ').trim();

/**
 * Ключ, по которому клиента узнают. Паспорт надёжнее имени, поэтому он в
 * приоритете; без паспорта опираемся на имя (с пометкой, чтобы имя случайно
 * не совпало с чьим-то паспортом).
 */
export const clientMatchKey = (data) => {
    const p = passportKey(data?.passport);
    if (p) return `P:${p}`;
    const n = nameKey(data?.fullName);
    return n ? `N:${n}` : '';
};

/**
 * Существующий клиент для этих данных.
 *
 * Сначала по паспорту. Если паспорта нет или по нему никто не нашёлся — по имени,
 * но только среди тех, у кого паспорт не заполнен: иначе новый человек без
 * паспорта прилипал бы к полному тёзке с паспортом.
 *
 * @param {object[]} clients существующие клиенты
 * @param {object} data      данные, которые собираются записать
 * @returns {object|null}
 */
export const findExistingClient = (clients = [], data = {}) => {
    const p = passportKey(data?.passport);
    if (p) {
        const byPassport = clients.find(c => passportKey(c?.passport) === p);
        if (byPassport) return byPassport;
    }
    const n = nameKey(data?.fullName);
    if (!n) return null;
    return clients.find(c => !passportKey(c?.passport) && nameKey(c?.fullName) === n) || null;
};

/**
 * Индекс уже поставленных в очередь созданий — для пакетных циклов.
 * Без него один и тот же человек, встреченный в цикле дважды, создавался дважды.
 */
export const createPendingIndex = () => {
    const seen = new Set();
    return {
        /** Уже поставлен в очередь? */
        has: (data) => {
            const k = clientMatchKey(data);
            return !!k && seen.has(k);
        },
        /** Запомнить, что поставили. */
        add: (data) => {
            const k = clientMatchKey(data);
            if (k) seen.add(k);
        },
        get size() { return seen.size; },
    };
};
