/**
 * Скрипты, которые инжектятся в скрытое окно e-mehmon. Портал недоступен в
 * тестах, поэтому проверяем сам текст скрипта: что он компилируется, какие
 * селекторы использует и где останавливается.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const m = require('../electron/emehmonAutofill.js');

const FOREIGN = { citizenCode: 'CHN', passport: 'E12345678', birthDate: '01.01.1990', passportIssueDate: '10.10.2020', room: '3', days: 5, amount: '50000', hostelId: 'hostel1' };

test('оба скрытых скрипта компилируются с любыми данными гостя (кавычки, теги)', () => {
  const nasty = { ...FOREIGN, passport: "AB'12\"</script>", guestName: '`${x}`' };
  for (const f of [m.buildPassportCheckScript, m.buildAutoArrivalScript]) {
    assert.doesNotThrow(() => new vm.Script(f(nasty)));
  }
});

test('гражданство выбирается по коду гостя, 173 — только запасной вариант для UZB', () => {
  const src = m.buildPassportCheckScript(FOREIGN);
  assert.ok(src.includes('selectCitizen(G.citizenCode)'), 'проверка паспорта — по коду');
  assert.ok(m.buildAutoArrivalScript(FOREIGN).includes('selectCitizen(G.citizenCode)'), 'прибытие — по коду');
  const helper = src.slice(src.indexOf('function selectCitizen'), src.indexOf('function activeTab'));
  assert.match(helper, /code==='UZB'\) return setSelect\('id_citizen','173'\)/);
  assert.equal((src.match(/'173'/g) || []).length, 1, '173 больше нигде не зашит');
  assert.ok(src.includes("status:'no_citizen'"), 'страны нет в списке — отдельный статус');
});

test('иностранцу на шаге 2 дописываются дата выдачи, страна и «кем выдан», портальные поля не трогаются', () => {
  const src = m.buildAutoArrivalScript(FOREIGN);
  const step2 = src.slice(src.indexOf("var foreign ="), src.indexOf("var probe = harvestWizard('general-info')"));
  assert.ok(step2.includes("setInput('datePassport'"), 'дата выдачи');
  assert.ok(step2.includes("setSelectByCode('id_country'"), 'страна по коду');
  assert.ok(step2.includes("setInput('passportissuedby'"), 'кем выдан');
  for (const portalField of ['sex', 'kpp', 'datecross']) {
    assert.ok(!new RegExp(`setInput\\('${portalField}`).test(step2), `${portalField} ставит портал`);
  }
});

test('дамп мастера: поля, подписи, таблицы и блоки — в обоих скриптах', () => {
  for (const f of [m.buildPassportCheckScript, m.buildAutoArrivalScript]) {
    const src = f(FOREIGN);
    assert.ok(src.includes('function harvestWizard'), 'harvestWizard');
    assert.ok(src.includes('function labelFor'), 'подписи полей');
    assert.ok(src.includes("querySelectorAll('table')"), 'таблицы');
    assert.ok(src.includes('tables:tables') && src.includes('labels:labels') && src.includes('blocks:blocks'), 'дамп отдаётся целиком');
  }
  const chk = m.buildPassportCheckScript(FOREIGN);
  assert.ok(chk.includes("status:'valid', officialName: h.officialName, fields: h.fields, labels: h.labels, tables: h.tables"), 'проверка паспорта отдаёт дамп');
  assert.ok(chk.includes("notFoundText: notFoundText()"), 'текст «не найден» — для окна «исправьте данные»');
});

test('за пределами окна мастер останавливается ПЕРЕД «Сохранить», force — сохраняет', () => {
  const src = m.buildAutoArrivalScript({ ...FOREIGN, gateStays: true });
  const iSub = src.indexOf("var sub = byId('submitForm')");
  const iGate = src.indexOf("if (G.gateStays && !G.force) return { status:'needs_decision'");
  const iLast = src.indexOf("harvestWizard('guest-info')");
  assert.ok(iLast > 0 && iGate > iLast && iSub > iGate, 'порядок: дамп последнего шага → остановка → submit');
  assert.ok(src.includes("last: last"), 'список отелей уходит в рендерер');
});

test('итоги мастера несут дамп шага 2 — дата КПП попадает в карточку и при регистрации', () => {
  const src = m.buildAutoArrivalScript(FOREIGN);
  for (const st of ["status:'step2_failed', probe: probe", "status:'no_room', probe: probe", "'submit_unconfirmed', probe: probe"]) {
    assert.ok(src.includes(st), st);
  }
});

test('поведение для местных не изменилось: без gateStays сохраняем сразу', () => {
  const src = m.buildAutoArrivalScript({ citizenCode: 'UZB', passport: 'AA1', birthDate: '01.01.1990', room: '1', days: 1, amount: '30000' });
  assert.ok(src.includes("setSelect('id_visittype', '5')") && src.includes("setSelect('payed', '2')") && src.includes("setSelect('id_guest', '4')"));
  assert.ok(src.includes('sub.click()'), 'кнопка «Сохранить» нажимается');
});
