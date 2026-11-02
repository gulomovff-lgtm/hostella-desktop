/**
 * Раскладка расходов из «Другое» по разделам (просьба владельца 02.11.2026:
 * «в другом за месяц очень многое — и зп, и завтраки, и яндекс, всё в одной куче»).
 *
 * Раздел предлагается по описанию расхода; решает админ в окне разбора
 * (ExpensesView → «Разложить „Другое“») — здесь только подсказка.
 * Зарплата без получателя не переносится: получатель ищется по имени
 * сотрудника в описании, иначе админ выбирает сам.
 *
 * Без React и Firestore — покрыто тестами (tests/expense-sort.test.mjs).
 */

export const CAT_BREAKFAST = 'Завтрак';
export const CAT_TAXI = 'Яндекс (рабочие)';
export const CAT_HOUSEHOLD = 'Хозтовары';
export const CAT_OTHER = 'Другое';

// Слово начинается с этой основы (до неё — не буква). Порядок важен: первое
// совпадение побеждает, поэтому явные слова («завтрак», «зп») — выше состава.
const W = (stem) => new RegExp(`(?<!\\p{L})${stem}`, 'iu');
const RULES = [
  ['Зарплата',            [W('зарплат'), W('з\\/?п(?!\\p{L})'), W('оклад'), W('преми'), W('аванс'), W('ойлик'), W('maosh'), W('zp(?!\\p{L})')]],
  [CAT_BREAKFAST,         [W('завтрак'), W('nonushta'), W('нонушт')]],
  [CAT_TAXI,              [W('яндекс'), W('yandex'), W('такси'), W('taxi'), W('taksi')]],
  ['Регистрация',         [W('регистрац'), W('е-?мехмон'), W('e-?mehmon'), W('прописк')]],
  ['Газ',                 [W('газ(?!ет)')]],
  ['Электричество',       [W('электр'), W('свет(а|у)?(?!\\p{L})')]],
  ['Вода',                [W('вод(а|у|ы)(?!\\p{L})'), W('сув(?!\\p{L})')]],
  ['Интернет',            [W('интернет'), W('wi-?fi'), W('вай-?фай')]],
  ['Аренда',              [W('аренд'), W('ijara')]],
  ['Налоги',              [W('налог'), W('солиқ'), W('soliq')]],
  ['Реклама',             [W('реклам'), W('таргет'), W('instagram'), W('инстаграм')]],
  ['Ремонт',              [W('ремонт'), W('мастер'), W('сантех'), W('электрик'), W('краск'), W('цемент'), W('гвозд'), W('замок'), W('замк'), W('кран(?!\\p{L})'), W('смесител')]],
  [CAT_HOUSEHOLD,         [W('порош'), W('моющ'), W('мыл'), W('шампун'), W('туалетн'), W('бумаг'), W('салфет'), W('губк'), W('пакет'), W('хлорк'), W('отбел'), W('освежит'), W('перчат'), W('тряп'), W('швабр'), W('веник'), W('fairy'), W('ферри'), W('domestos'), W('доместос')]],
  // Состав завтрака — после всего остального: «хлеб» в описании ремонта не бывает,
  // а вот «газ» в описании завтрака — бывает редко, его правило выше.
  [CAT_BREAKFAST,         [W('яйц'), W('тухум'), W('хлеб'), W('лепешк'), W('нон(?!\\p{L})'), W('молок'), W('сут(?!\\p{L}|ки|ок)'), W('масл'), W('колбас'), W('сосиск'), W('сыр(?!\\p{L}|ок|ник)'), W('творог'), W('сметан'), W('каш'), W('овсян'), W('джем'), W('варень'), W('мед(?!\\p{L})'), W('чай'), W('кофе'), W('сахар'), W('печень'), W('йогурт'), W('кефир'), W('хлопь'), W('сок(?!\\p{L})')]],
];

const norm = (s) => String(s || '').toLowerCase().replace(/ё/g, 'е');

/** Раздел по описанию расхода или null (оставить в «Другое»). */
export function suggestCategory(text) {
  const s = norm(text);
  if (!s.trim()) return null;
  for (const [cat, patterns] of RULES) {
    if (patterns.some(rx => rx.test(s))) return cat;
  }
  return null;
}

/**
 * Получатель зарплаты по имени в описании: «зп Мухайё» → сотрудник «Мухайё …».
 * Сравнение по первому слову имени и по логину, от 3 букв. Двое подходят — null.
 */
export function matchStaff(text, users = []) {
  const s = norm(text);
  if (!s) return null;
  const hits = users.filter(u => {
    const keys = [String(u.name || '').trim().split(/\s+/)[0], u.login].map(norm).filter(k => k.length >= 3);
    return keys.some(k => new RegExp(`(?<!\\p{L})${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu').test(s));
  });
  return hits.length === 1 ? (hits[0].id || hits[0].login) : null;
}

/**
 * Предложение по каждому расходу «Другое»: { expense, category, staffId }.
 * category — null, если подсказки нет; staffId — только для «Зарплата».
 */
export function planOtherExpenses(expenses = [], users = []) {
  return expenses
    .filter(e => !e.category || e.category === CAT_OTHER)
    .map(e => {
      const text = [e.comment, e.description, e.note].filter(Boolean).join(' ');
      const category = suggestCategory(text);
      const staffId = category === 'Зарплата' ? matchStaff(text, users) : null;
      return { expense: e, category, staffId };
    });
}
