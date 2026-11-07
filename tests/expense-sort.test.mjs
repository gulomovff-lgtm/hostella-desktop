import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestCategory, matchStaff, planOtherExpenses, CAT_BREAKFAST, CAT_TAXI, CAT_HOUSEHOLD } from '../src/utils/expenseSort.js';

test('зарплата: зп, з/п, аванс, оклад', () => {
  for (const s of ['зп Мухайё', 'З/П за октябрь', 'аванс Дилноза', 'оклад уборщице', 'ZP Oybek']) {
    assert.equal(suggestCategory(s), 'Зарплата', s);
  }
});

test('завтрак: слово и состав', () => {
  for (const s of ['завтрак 12 чел', 'яйца 3 лотка', 'хлеб, лепешки', 'молоко и масло', 'чай кофе сахар', 'nonushta']) {
    assert.equal(suggestCategory(s), CAT_BREAKFAST, s);
  }
});

test('яндекс и такси для рабочих', () => {
  for (const s of ['Яндекс рабочим', 'yandex go', 'такси для мастера']) {
    assert.equal(suggestCategory(s), CAT_TAXI, s);
  }
});

test('латиницей и как слышится: zaftrak, yandeks ustalar', () => {
  assert.equal(suggestCategory('yandeks ustala'), CAT_TAXI);
  assert.equal(suggestCategory('Yandeks ustalarga'), CAT_TAXI);
  assert.equal(suggestCategory('яндэкс'), CAT_TAXI);
  assert.equal(suggestCategory('zaftrak'), CAT_BREAKFAST);
  assert.equal(suggestCategory('Zavtrak 10 kishi'), CAT_BREAKFAST);
  assert.equal(suggestCategory('зафтрак'), CAT_BREAKFAST);
  assert.equal(suggestCategory('tuxum, non'), CAT_BREAKFAST);
  assert.equal(suggestCategory('zp Dilnoza'), 'Зарплата');
  // «usta» — кому, а не на что: хлеб мастерам — завтрак, такси мастерам — яндекс
  assert.equal(suggestCategory('ustalaga non'), CAT_BREAKFAST);
  assert.equal(suggestCategory('ustalarga nono olindi'), CAT_BREAKFAST);
  assert.equal(suggestCategory('YADEKS USTALA'), CAT_TAXI);
  assert.equal(suggestCategory('Remontga ishlatildi'), 'Ремонт');
  assert.equal(suggestCategory('xoz tovar'), CAT_HOUSEHOLD);
  assert.equal(suggestCategory('XOSTAVAR'), CAT_HOUSEHOLD);
  assert.equal(suggestCategory('Kir yuvish uchun gel olindi'), CAT_HOUSEHOLD);
  assert.equal(suggestCategory('oqqogoz'), CAT_HOUSEHOLD);
  assert.equal(suggestCategory('GAZGA TULANDI'), 'Газ');
  assert.equal(suggestCategory('kuler suv'), 'Вода для кулера');
  assert.equal(suggestCategory('KULLERGA SUV'), 'Вода для кулера');
  assert.equal(suggestCategory('SUVGA TOLOV'), 'Вода');
  assert.equal(suggestCategory('MUSURGA'), 'Коммунальные услуги');
  assert.equal(suggestCategory('KADASTIR TOJIYLAGA'), 'Регистрация');
  assert.equal(suggestCategory('zavtrikga non olindi'), CAT_BREAKFAST);
});

test('прошлые месяцы: турсбор, охрана, банк→налоги, сервисы, возвраты, бухгалтер', () => {
  assert.equal(suggestCategory('ТУРСБОР ИНОСТРАНЦЫ'), 'Турсбор');
  assert.equal(suggestCategory('Тур сбор 01,02-28,2026'), 'Турсбор');
  assert.equal(suggestCategory('Миллий гвардия'), 'Охрана');
  assert.equal(suggestCategory('Е-mehmon депозит'), 'Регистрация');
  assert.equal(suggestCategory('3 TA URIS 8 KUN REGISTRASIYA'), 'Регистрация');
  assert.equal(suggestCategory('YANDEKIS'), CAT_TAXI);
  assert.equal(suggestCategory('2 ХОСТЕЛ УЧУН КОМУНАЛ ГА ОПЛАТА'), 'Коммунальные услуги');
  assert.equal(suggestCategory('банк услуги'), 'Налоги');
  assert.equal(suggestCategory('Терминал абонентский'), 'Налоги');
  assert.equal(suggestCategory('ккм ARCA GROUP" MCHJ'), 'Налоги');
  assert.equal(suggestCategory('Оплата GitHUB'), 'Сервисы');
  assert.equal(suggestCategory('google servis'), 'Сервисы');
  assert.equal(suggestCategory('Телефон номер'), 'Сервисы');
  assert.equal(suggestCategory('38 ЯТМФ'), 'Сервисы');
  assert.equal(suggestCategory('Янги техналогиялари'), 'Сервисы');
  assert.equal(suggestCategory('pragrama'), 'Сервисы');
  for (const s of ['VOZVRAT', 'BOZVRAT', 'BOZBRAT BOBUR OKA', 'возврат', 'Ayollar chiqib ketdi qaytarib berildi']) assert.equal(suggestCategory(s), 'Возврат', s);
  assert.equal(suggestCategory('Бухгалтерские услуги'), 'Зарплата');
  assert.equal(suggestCategory('НАЛОГ+БУГАРТЕР ОЙЛИК'), 'Зарплата');
  assert.equal(matchStaff('бухгалтер ойлик', []), '__accountant__');
  assert.equal(matchStaff('НАЛОГ+БУГАРТЕР ОЙЛИК', []), '__accountant__');
  for (const s of ['Кондиционер 18', 'ELEKTIRIK', 'santexnik', 'LAMPOCHKA', 'Кабели, короб, автоматы', 'усталага иш хаки', 'usta xaqqi berildi', 'unitazga kley', 'Обогреватель']) assert.equal(suggestCategory(s), 'Ремонт', s);
  for (const s of ['Курпача', 'Идиш тавок чойнай', 'Иссырык', '1-2 xostelga stirkaga gelga', 'PULTGA BATAREYGA']) assert.equal(suggestCategory(s), CAT_HOUSEHOLD, s);
  for (const s of ['Собирова карта', 'Азизака', 'Yolanma Hodim uchun', 'shtraf mib e mexmon']) assert.notEqual(suggestCategory(s), 'Налоги', s);
});

test('коммунальные, ремонт, хозтовары', () => {
  assert.equal(suggestCategory('за газ'), 'Газ');
  assert.equal(suggestCategory('свет за месяц'), 'Электричество');
  assert.equal(suggestCategory('вода'), 'Вода');
  assert.equal(suggestCategory('сантехник кран'), 'Ремонт');
  assert.equal(suggestCategory('порошок, туалетная бумага'), CAT_HOUSEHOLD);
});

test('похожие слова не путаются', () => {
  assert.equal(suggestCategory('газета'), null);
  assert.equal(suggestCategory('водитель'), null);
  assert.equal(suggestCategory('светильник'), null);
  assert.equal(suggestCategory('сутки доплата'), null);
  assert.equal(suggestCategory(''), null);
  assert.equal(suggestCategory('просто так'), null);
});

test('явное слово сильнее состава: «зп повару за завтраки» — зарплата', () => {
  assert.equal(suggestCategory('зп повару за завтраки'), 'Зарплата');
  assert.equal(suggestCategory('такси за хлебом'), CAT_TAXI);
});

test('получатель зарплаты по имени, двое подходят — никого', () => {
  const users = [{ id: 'u1', name: 'Мухайё Каримова', login: 'muhayo' }, { id: 'u2', name: 'Дилноза', login: 'dilnoza' }, { id: 'u3', name: 'Дилноза Б.', login: 'dil2' }];
  assert.equal(matchStaff('зп Мухайё', users), 'u1');
  assert.equal(matchStaff('аванс muhayo', users), 'u1');
  assert.equal(matchStaff('зп Дилноза', users), null);
  assert.equal(matchStaff('зп уборщице', users), '__cleaning__');
  assert.equal(matchStaff('Oylik farrosh opaga', users), '__cleaning__');
  assert.equal(matchStaff('зп кому-то', users), null);
});

test('план: только «Другое», зарплате — получатель', () => {
  const users = [{ id: 'u1', name: 'Мухайё', login: 'muhayo' }];
  const plan = planOtherExpenses([
    { id: 'a', category: 'Другое', comment: 'зп Мухайё' },
    { id: 'b', category: 'Другое', comment: 'яйца' },
    { id: 'c', category: 'Газ', comment: 'зп' },
    { id: 'd', category: '', comment: 'непонятно' },
  ], users);
  assert.deepEqual(plan.map(p => [p.expense.id, p.category, p.staffId]), [
    ['a', 'Зарплата', 'u1'], ['b', CAT_BREAKFAST, null], ['d', null, null],
  ]);
});
