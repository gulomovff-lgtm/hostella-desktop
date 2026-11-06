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
export const CAT_COOLER = 'Вода для кулера';
export const CAT_OTHER = 'Другое';
export const CAT_REFUND = 'Возврат';
export const CAT_TOURSBOR = 'Турсбор';
export const CAT_GUARD = 'Охрана';
export const CAT_SERVICES = 'Сервисы';

// Слово начинается с этой основы (до неё — не буква). Порядок важен: первое
// совпадение побеждает, поэтому явные слова («завтрак», «зп») — выше состава.
const W = (stem) => new RegExp(`(?<!\\p{L})${stem}`, 'iu');
const RULES = [
  // Бухгалтер — зарплата с получателем «Бухгалтер» (решение владельца 02.11.2026)
  ['Зарплата',            [W('зарплат'), W('з\\/?п(?!\\p{L})'), W('оклад'), W('преми'), W('аванс'), W('ойлик'), W('maosh'), W('zp(?!\\p{L})'), W('z\\/p(?!\\p{L})'), W('zarplat'), W('avans'), W('oylik'), W('oklad'),
                           W('бухгалтер'), W('бу[гх]артер'), W('buxgalter'), W('buhgalter')]],
  [CAT_REFUND,            [W('[вb]о[зс]врат'), W('[вb]а[зс]врат'), W('vozvrat'), W('vazvrat'), W('bozvrat'), W('bozbrat'), W('бо[зс]брат'), W('qaytarib')]],
  [CAT_TOURSBOR,          [W('тур ?сбор'), W('tur ?sbor')]],
  [CAT_GUARD,             [W('милли[йи] ?гвард'), W('milliy ?gvard'), W('нацгвард'), W('охран')]],
  // Кассиры пишут и латиницей, и как слышат: «zaftrak», «yandeks ustalar»
  [CAT_BREAKFAST,         [W('завтрак'), W('зафтрак'), W('z[ao][vf]tr[ai]k'), W('nonushta'), W('нонушт')]],
  [CAT_TAXI,              [W('янд[еэ]кс'), W('yand[ea]ks'), W('yad[ea]ks'), W('yandek'), W('yandex'), W('такси'), W('taxi'), W('taksi')]],
  ['Регистрация',         [W('регистрац'), W('е-?мехмон'), W('[еe]-?mehmon'), W('прописк'), W('registras'), W('registrats'), W('кадаст'), W('kadast')]],
  ['Газ',                 [W('газ(?!ет)'), W('gaz(?!et)')]],
  ['Электричество',       [W('электр'), W('свет(а|у)?(?!\\p{L})')]],
  // Питьевая вода для кулера — отдельно от воды по счётчику (решение владельца 02.11.2026)
  [CAT_COOLER,            [W('kul+er'), W('кул+ер')]],
  ['Вода',                [W('вод(а|у|ы)(?!\\p{L})'), W('сув(?!\\p{L})'), W('suv')]],
  ['Коммунальные услуги', [W('mus[ou]rga'), W('вывоз мусор'), W('kommunal'), W('ком+унал')]],
  ['Интернет',            [W('интернет'), W('wi-?fi'), W('вай-?фай')]],
  ['Аренда',              [W('аренд'), W('ijara')]],
  // Банк, терминал и ККМ (ARCA) — к налогам (решение владельца 02.11.2026)
  ['Налоги',              [W('налог'), W('солиқ'), W('soliq'), W('банк'), W('bank'), W('терминал'), W('terminal'), W('arca'), W('ккм'), W('kkm')]],
  [CAT_SERVICES,          [W('github'), W('google'), W('гугл'), W('телефон'), W('38 код'), W('38 ятмф'), W('ятмф'), W('янги тех'), W('программ'), W('pr[ao]gram'), W('сервер')]],
  ['Реклама',             [W('реклам'), W('таргет'), W('instagram'), W('инстаграм')]],
  ['Ремонт',              [W('ремонт'), W('мастер'), W('сантех'), W('электрик'), W('краск'), W('цемент'), W('гвозд'), W('замок'), W('замк'), W('кран(?!\\p{L})'), W('смесител'), W('remont'),
                           W('кондиционер'), W('kondits'), W('elek?ti?rik'), W('santex'), W('вентил'), W('ventil'), W('лампоч'), W('lampoch'), W('кабел'), W('автомат'),
                           W('душ'), W('dush'), W('унитаз'), W('unitaz'), W('свирл'), W('sverl'), W('смент'), W('sment'), W('обогрев'),
                           W('устала[гр]а иш'), W('иш ха[кқ]'), W('ish ?ha[qk]'), W('usta ?xaq'), W('usta ?haq')]],
  [CAT_HOUSEHOLD,         [W('порош'), W('моющ'), W('мыл'), W('шампун'), W('туалетн'), W('бумаг'), W('салфет'), W('губк'), W('пакет'), W('хлорк'), W('отбел'), W('освежит'), W('перчат'), W('тряп'), W('швабр'), W('веник'), W('fairy'), W('ферри'), W('domestos'), W('доместос'), W('poroshok'), W('sovun'),
                           W('хоз'), W('xoz'), W('xostavar'), W('paket'), W('oqqog'), W("q[o'ʻ’]?g[o'ʻ’]?oz"), W('kir yuvish'), W('gel(?!\\p{L})'), W('spurg'),
                           W('курпач'), W('kurpach'), W('идиш'), W('посуд'), W('иссырык'), W('isiriq'), W('батаре'), W('batarey'), W('st[e]?pler'), W('конверт'), W('stirk'), W('стирк')]],
  // Состав завтрака — после всего остального: «хлеб» в описании ремонта не бывает,
  // а вот «газ» в описании завтрака — бывает редко, его правило выше.
  [CAT_BREAKFAST,         [W('яйц'), W('тухум'), W('хлеб'), W('лепешк'), W('нон(?!\\p{L})'), W('молок'), W('сут(?!\\p{L}|ки|ок)'), W('масл'), W('колбас'), W('сосиск'), W('сыр(?!\\p{L}|ок|ник)'), W('творог'), W('сметан'), W('каш'), W('овсян'), W('джем'), W('варень'), W('мед(?!\\p{L})'), W('чай'), W('кофе'), W('сахар'), W('печень'), W('йогурт'), W('кефир'), W('хлопь'), W('сок(?!\\p{L})'),
                           W('tuxum'), W('xleb'), W('non(ga|o|i)?(?!\\p{L})'), W('moloko'), W('sut(?!\\p{L})'), W('choy'), W('chay'), W('kofe'), W('shakar'), W('sahar'), W('sosis'), W('k[oa]lbas')]],
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
// «Уборка» в ExpensesView: уборщицы — не пользователи программы
export const CLEANING_STAFF = '__cleaning__';
export const ACCOUNTANT_STAFF = '__accountant__';

export function matchStaff(text, users = []) {
  const s = norm(text);
  if (!s) return null;
  if (/(?<!\p{L})(farrosh|уборщ|tozalovch)/iu.test(s)) return CLEANING_STAFF;
  if (/(?<!\p{L})(бухгалтер|бу[гх]артер|buxgalter|buhgalter)/iu.test(s)) return ACCOUNTANT_STAFF;
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
