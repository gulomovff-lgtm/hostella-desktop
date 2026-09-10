// Поиск дубликатов клиентов и расчёт слияния.
//
// Кассиры заводят одного и того же гостя по нескольку раз, причём паспорт каждый
// раз пишут по-разному (классика: AC против AS). Поэтому паспорт как признак
// совпадения не годится — группируем по дате рождения и похожему ФИО, а какой
// паспорт настоящий, решает проверка в госбазе e-mehmon (кнопка «Проверить»).
//
// Чистые функции без Firestore и React — чтобы покрыть тестами: слияние трогает
// баланс клиента, то есть деньги, и ошибаться тут нельзя.

/** Приводит имя к виду, устойчивому к регистру, лишним пробелам и Ё/Е. */
export const normalizeName = (s = '') =>
    String(s)
        .toUpperCase()
        .replace(/Ё/g, 'Е')
        .replace(/[^0-9A-ZА-Я]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');

/**
 * ФИО из госбазы → «ФАМИЛИЯ ИМЯ» для карточки.
 *
 * Портал отдаёт три части, и отчество оказывается в середине:
 * «ABJALILOV ABDULXAKIM O‘G‘LI JAMSHID». В карточке нужны фамилия и имя —
 * так их пишут кассиры и так ищет подсказка по имени. Отчество узнаём по
 * узбекским маркерам O‘G‘LI / QIZI (в любых апострофах и кириллице) — тогда
 * выбрасываем маркер вместе со словом перед ним — и по русским окончаниям
 * -ОВИЧ/-ЕВИЧ/-ОВНА/-ЕВНА (только если слов три и больше, чтобы не задеть
 * фамилию вроде ПЕТРОВИЧ). Порядок оставшихся слов — как у портала.
 * Если после чистки осталось меньше двух слов — возвращаем как было.
 */
export const officialShortName = (s = '') => {
    const words = String(s || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (words.length < 3) return words.join(' ');
    const norm = (w) => w.toUpperCase().replace(/[’‘'`ʻʼ]/g, '');
    const MARK = /^(OGLI|UGLI|QIZI|KIZI|ЎҒЛИ|УГЛИ|ҚИЗИ|КИЗИ)$/;
    const PATR = /(OVICH|EVICH|OVNA|EVNA|ОВИЧ|ЕВИЧ|ОВНА|ЕВНА)$/;
    const out = [];
    for (const w of words) {
        if (MARK.test(norm(w))) { out.pop(); continue; }   // «ABDULXAKIM O‘G‘LI» — оба слова прочь
        out.push(w);
    }
    const res = out.length >= 3 ? out.filter(w => !PATR.test(norm(w))) : out;
    return res.length >= 2 ? res.join(' ') : words.join(' ');
};

/** Слова имени, отсортированные: «ИВАНОВ ИВАН» и «ИВАН ИВАНОВ» — одно и то же. */
const nameTokens = (s = '') => normalizeName(s).split(' ').filter(Boolean).sort();

/** Расстояние Левенштейна (сколько правок нужно, чтобы получить b из a). */
export const editDistance = (a = '', b = '') => {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(
                prev[j] + 1,
                cur[j - 1] + 1,
                prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
            );
        }
        prev = cur;
    }
    return prev[b.length];
};

/**
 * Похожи ли имена. Считаем похожими, если после нормализации они совпадают,
 * либо отличаются мелкой опечаткой (порог зависит от длины: у коротких имён
 * одна правка — это уже другое имя).
 */
export const namesSimilar = (a = '', b = '') => {
    const ta = nameTokens(a), tb = nameTokens(b);
    if (!ta.length || !tb.length) return false;
    const sa = ta.join(' '), sb = tb.join(' ');
    if (sa === sb) return true;
    // Одна фамилия могла потеряться (ввели без отчества) — сравниваем по общей части.
    const short = ta.length < tb.length ? ta : tb;
    const long  = ta.length < tb.length ? tb : ta;
    if (short.length >= 2 && short.every(w => long.includes(w))) return true;
    const limit = Math.min(sa.length, sb.length) >= 10 ? 2 : 1;
    return editDistance(sa, sb) <= limit;
};

/** Дата рождения в едином виде YYYY-MM-DD; пустая — значит сравнивать нечем. */
const birthKey = (c) => String(c?.birthDate || '').trim().slice(0, 10);

/**
 * Группирует клиентов в кандидаты на слияние: одинаковая дата рождения плюс
 * похожее ФИО. Записи без даты рождения пропускаем — по одному имени сливать
 * опасно (полные тёзки встречаются).
 *
 * @returns {Array<{key:string, clients:object[]}>} группы от 2 записей, крупные — первыми
 */
export const findDuplicateGroups = (clients = []) => {
    const byBirth = new Map();
    for (const c of clients) {
        const bd = birthKey(c);
        if (!bd) continue;
        if (!byBirth.has(bd)) byBirth.set(bd, []);
        byBirth.get(bd).push(c);
    }

    const groups = [];
    for (const [bd, list] of byBirth) {
        if (list.length < 2) continue;
        const used = new Set();
        for (let i = 0; i < list.length; i++) {
            if (used.has(list[i].id)) continue;
            const bucket = [list[i]];
            used.add(list[i].id);
            for (let j = i + 1; j < list.length; j++) {
                if (used.has(list[j].id)) continue;
                if (namesSimilar(list[i].fullName, list[j].fullName)) {
                    bucket.push(list[j]);
                    used.add(list[j].id);
                }
            }
            // Пара с одинаковым паспортом — не разночтение, а честный дубль:
            // такие тоже показываем, их сливать безопаснее всего.
            if (bucket.length >= 2) groups.push({ key: `${bd}|${normalizeName(list[i].fullName)}`, clients: bucket });
        }
    }
    // Сначала самые крупные группы — с них разбор идёт быстрее.
    return groups.sort((a, b) => b.clients.length - a.clients.length);
};

const num = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
};

/**
 * Какую запись сделать главной, когда госбаза не подтвердила ни одну.
 * Берём самую «живую»: больше визитов → позже последний визит → есть паспорт →
 * заполнен телефон. Порядок в массиве на выбор не влияет, иначе результат зависел
 * бы от того, как Firestore вернул документы.
 */
export const pickFallbackMain = (list = []) => {
    const score = (c) => [
        num(c?.visits),
        String(c?.lastVisit || ''),
        c?.passport ? 1 : 0,
        c?.phone ? 1 : 0,
    ];
    return list.reduce((best, c) => {
        if (!best) return c;
        const a = score(c), b = score(best);
        for (let i = 0; i < a.length; i++) {
            if (a[i] > b[i]) return c;
            if (a[i] < b[i]) return best;
        }
        return best;
    }, null) || null;
};

/**
 * Считает итоговые поля главной записи при слиянии.
 * Деньги и визиты складываем со всех записей группы, дату последнего визита
 * берём самую позднюю. Паспорт/ФИО/дату рождения оставляем у главной — именно
 * её подтвердила госбаза.
 *
 * @param {object} main      запись, признанная главной (зелёная)
 * @param {object[]} others  сливаемые записи
 */
export const computeMergedClient = (main, others = []) => {
    const all = [main, ...others];
    const balance = all.reduce((s, c) => s + num(c?.balance), 0);
    const visits  = all.reduce((s, c) => s + num(c?.visits), 0);
    const lastVisit = all
        .map(c => c?.lastVisit)
        .filter(Boolean)
        .sort()
        .pop() || main?.lastVisit || null;

    // Телефон/страна могли заполнить только в одной из записей — не теряем.
    const phone   = main?.phone   || others.find(c => c?.phone)?.phone     || '';
    const country = main?.country || others.find(c => c?.country)?.country || '';

    // Статус берём самый строгий: чёрный список важнее VIP и обычного.
    const rank = { blacklist: 3, warning: 2, vip: 1, normal: 0 };
    const clientStatus = all
        .map(c => c?.clientStatus || 'normal')
        .sort((a, b) => (rank[b] ?? 0) - (rank[a] ?? 0))[0];

    return { balance, visits, lastVisit, phone, country, clientStatus };
};
