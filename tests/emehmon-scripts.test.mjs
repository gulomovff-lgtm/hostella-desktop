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

test('ФИО из госбазы собирается как фамилия → имя → отчество, заглушка XXX отбрасывается', () => {
  const src = m.buildPassportCheckScript(FOREIGN);
  const i = (k) => src.indexOf(`'${k}'`, src.indexOf('var order = ['));
  assert.ok(i('surname') < i('firstname') && i('firstname') < i('lastname'), 'lastname в портале — отчество, идёт последним');
  assert.ok(src.includes('xxx|x|-'), 'заглушка XXX не попадает в ФИО');
});

test('проверка паспорта заглядывает на третью вкладку и отдаёт список всех полей, включая пустые', () => {
  const src = m.buildPassportCheckScript(FOREIGN);
  const iH = src.indexOf("harvestWizard('general-info')");
  const i3 = src.indexOf("harvestWizard('additional-info')");
  assert.ok(iH > 0 && i3 > iH, 'сначала вторая вкладка, затем третья');
  assert.ok(!src.includes("byId('submitForm')"), 'проверка ничего не сохраняет');
  assert.ok(src.includes('keys:keys'), 'ключи пустых полей — для поиска названия даты КПП');
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
  for (const st of ["status:'step2_failed', probe: probe", "status:'no_room', probe: mergeProbe(probe", "'submit_unconfirmed', probe: probe"]) {
    assert.ok(src.includes(st), st);
  }
});

test('отказ портала словами не теряется как таймаут: portal_error с текстом на проверке и на сохранении', () => {
  const src = m.buildAutoArrivalScript(FOREIGN);
  assert.ok(src.includes('function popupText'), 'общий помощник чтения сообщений портала');
  assert.ok(src.includes("status:'portal_error', stage:'check'"), 'отказ на первом шаге');
  assert.ok(src.includes("status:'portal_error', stage:'submit'"), 'отказ после «Сохранить»');
  assert.ok(src.includes('roomOptions: opts0'), 'при «нет комнаты» отдаём список комнат портала');
  assert.ok(m.buildPassportCheckScript(FOREIGN).includes("status:'portal_error', stage:'check'"), 'проверка паспорта — тоже');
});

test('смена комнаты: скрипт компилируется, ищет строку гостя, кнопку правки и select комнаты, отдаёт дамп кнопок', () => {
  const src = m.buildRoomChangeScript({ ...FOREIGN, guestName: 'WANG LI', room: '5' });
  assert.doesNotThrow(() => new vm.Script(src));
  assert.ok(src.includes("$('#listok-table').DataTable()"), 'та же таблица, что у выселения');
  assert.ok(src.includes("vis(byId('propiska'))"), 'select комнаты — как в мастере');
  assert.ok(src.includes("status:'no_edit', probe: probe") && src.includes('rowControls'), 'без кнопки правки — статус и дамп');
  assert.ok(src.indexOf("save.click()") > src.indexOf("setSelect('propiska'"), 'сначала комната, потом сохранить');
  assert.ok(!src.includes('Chiqish'), 'кнопку выселения не трогаем');
});

test('поведение для местных не изменилось: без gateStays сохраняем сразу', () => {
  const src = m.buildAutoArrivalScript({ citizenCode: 'UZB', passport: 'AA1', birthDate: '01.01.1990', room: '1', days: 1, amount: '30000' });
  assert.ok(src.includes("setSelect('id_visittype', '5')") && src.includes("setSelect('payed', '2')") && src.includes("setSelect('id_guest', '4')"));
  assert.ok(src.includes('sub.click()'), 'кнопка «Сохранить» нажимается');
});

test('скрипты убытия глушат печать со стороны родителя, когда лист снимает автомат', () => {
  for (const f of [m.buildDepartureAutoScript, m.buildDepartureBulkScript]) {
    const src = f({ ...FOREIGN, guestName: 'X', sheet: true, print: true, list: [] });
    assert.doesNotThrow(() => new vm.Script(src));
    assert.ok(src.includes('__hostellaOpenWrapped') && src.includes('__hostellaPrintWanted'), 'заглушки печати нет');
    assert.ok(src.includes('__hostellaSheetOff'), 'после снятия листа печать должна вернуться кассиру');
  }
  const sheet = require('../electron/emehmonSheet.js');
  for (const k of ['installWindowOpenHandler', 'armSheetCapture', 'isCapturing', 'sheetFileName']) {
    assert.equal(typeof sheet[k], 'function', k);
  }
  assert.equal(sheet.sheetFileName({ passport: 'AB 1234567', at: new Date(2026, 8, 11, 14, 5) }), 'AB1234567_20260911_1405.pdf');
});

test('окна с вопросами при выводе больше нет: выселение уходит с итогом, типом оплаты и листом', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
  assert.equal(fs.existsSync(path.join(root, 'src/components/Modals/EmehmonDepartureModal.jsx')), false);
  const hook = fs.readFileSync(path.join(root, 'src/hooks/useEmehmonAutomation.js'), 'utf8');
  assert.ok(hook.includes('departureExtras(') && hook.includes('departureMarks('), 'хук не пользуется emehmonDeparture.js');
  assert.ok(!hook.includes('handleEmehmonDepartConfirm'), 'осталось подтверждение из удалённого окна');
  const mainSrc = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
  assert.ok(mainSrc.includes('armSheetCapture(') && mainSrc.includes("ipcMain.handle('emehmon-sheet-open'"));
  assert.ok(!mainSrc.includes("'emehmon-departure-bulk'"), 'массовое выселение одной модалкой убрано: список идёт по одному');
  const rules = fs.readFileSync(path.join(root, 'storage.rules'), 'utf8');
  assert.ok(rules.includes('match /sheets/{file=**}'), 'правила Storage не знают каталог листов');
});

test('лист заново: скрипт страницы выехавших компилируется, ищет строку гостя и кнопку печати портала', () => {
  const src = m.buildSheetPrintScript({ guestName: "O'RINOV `${x}`", passport: 'AB1234567', sheet: true });
  assert.doesNotThrow(() => new vm.Script(src));
  // «multiple» здесь больше нет: на странице выехавших гость встречается много раз, берётся нужная строка.
  for (const s of ['custom-print-btn', 'isDataTable', "status: 'not_found'", "status: 'no_print_btn'", "status: 'printed'", '__hostellaOpenWrapped']) {
    assert.ok(src.includes(s), `в скрипте нет ${s}`);
  }
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
  const mainSrc = fs.readFileSync(path.join(root, 'electron/main.js'), 'utf8');
  assert.ok(mainSrc.includes("ipcMain.handle('emehmon-sheet-fetch'") && mainSrc.includes('/listokout'), 'в main нет листа заново');
  assert.ok(fs.readFileSync(path.join(root, 'electron/preload.js'), 'utf8').includes('emehmonSheetFetch'));
});

test('дамп последней вкладки несёт строки проживаний и не режет блоки до 300 знаков', () => {
  const src = m.buildAutoArrivalScript({ ...FOREIGN, gateStays: true });
  assert.ok(src.includes('stayLines'), 'строки проживаний не снимаются');
  assert.ok(src.includes('slice(0,1500)'), 'блоки по-прежнему режутся до 300 знаков');
  assert.ok(src.includes('lastActivity'));
  assert.doesNotThrow(() => new vm.Script(src));
});

test('лист убытия: скрипты перехватывают печать портала на уровне $.ajax и отдают HTML листа', () => {
  for (const [f, arg] of [[m.buildDepartureAutoScript, { ...FOREIGN, sheet: true, print: true }], [m.buildDepartureBulkScript, { list: [], sheet: true }], [m.buildSheetPrintScript, { ...FOREIGN, sheet: true, checkOutDay: '12.09.2026' }]]) {
    const src = f(arg);
    assert.doesNotThrow(() => new vm.Script(src));
    assert.ok(src.includes('__hostellaSheetHook') && src.includes('listok\\/print'), 'нет перехвата $.ajax /listok/print');
    assert.ok(src.includes('sheetHtml'), 'HTML листа не возвращается');
  }
  const sheetSrc = m.buildSheetPrintScript({ ...FOREIGN, sheet: true });
  assert.ok(sheetSrc.includes('checkOutDay') && sheetSrc.includes('cands.sort'), 'среди повторов гостя не выбирается нужная строка');
  assert.ok(!sheetSrc.includes("status: 'multiple'"), 'лист заново не должен падать на повторах гостя');
  const sheet = require('../electron/emehmonSheet.js');
  assert.equal(typeof sheet.renderSheetHtml, 'function');
  assert.equal(typeof sheet.windowWebPreferences, 'function');
  const fs = require('node:fs');
  assert.ok(fs.existsSync(sheet.PRELOAD), 'preload заглушки печати не на месте');
});
