/**
 * Окно заселения — бланк в три графы.
 *
 * Шагов было три: койка, гость, оплата. Высота окна одна на все три,
 * под самый длинный, — и на коротких шагах пустовала треть экрана.
 * Плюс два нажатия «Далее» на каждое заселение: при сорока за смену это
 * восемьдесят нажатий, а цена становилась видна только на третьем шаге.
 *
 * Проверки ниже держат не оформление, а решения: что кассир видит сразу
 * и чего он не увидит, если разметку когда-нибудь перекроят обратно.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(
  new URL('../src/components/Modals/CheckInModal.jsx', import.meta.url), 'utf8');
// Комментарий начинается только после пробела или `{`. Иначе строка
// `accept="image/*"` открывает мнимый комментарий, который съедает восемь
// тысяч символов кода, — и проверки молча перестают видеть половину окна.
const code = SRC.replace(/(^|[\s{])\/\*[\s\S]*?\*\//g, '$1')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

const CSS = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');

test('шагов больше нет', () => {
  assert.ok(!/StepIndicator/.test(code), 'вернулась полоска шагов');
  assert.ok(!/setStep\(/.test(code), 'вернулось состояние шага');
  assert.ok(!/const initialStep/.test(code), 'вернулся начальный шаг');
});

test('проверки полей собраны в одно место', () => {
  // Они висели на кнопке «Далее». Кнопки нет — проверять по-прежнему надо,
  // и все ошибки показываются разом.
  assert.match(code, /const validate = \(\) => \{/);
  assert.match(code, /const errs = validate\(\);/);
});

test('граф ровно три', () => {
  assert.match(code, /className="ci-sheet3/);
  for (const c of ['ci-col ci-col-a', 'ci-col ci-col-b', 'ci-col ci-col-c']) {
    assert.ok(code.includes(c), `нет графы ${c}`);
  }
});

test('графа расчёта отделена плоскостью, а не только линией', () => {
  // Три колонки одной фактуры читаются как одно серое поле.
  assert.match(CSS, /\.ci-col-c \{[^}]*background: var\(--ci-surface-2\)/);
});

test('бланк не зависит от списка утилит с !important', () => {
  // Тёмная тема здесь построена на двухстах правилах вида
  // `[data-theme="dark"] .bg-white { … !important }`. Писать бланк
  // утилитами значит зависеть от того, попала ли очередная в этот список.
  assert.match(CSS, /\.ci-card \{[\s\S]{0,400}--ci-surface:/);
  assert.match(CSS, /\[data-theme="dark"\] \.ci-card \{[\s\S]{0,400}--ci-surface:/);
});

test('поле бланка в тёмной теме не превращается в коробку', () => {
  // Общее правило красит ВСЕ поля подложкой — и для обычного поля это
  // верно. У поля бланка рамка — это линейка строки.
  assert.match(CSS,
    /\[data-theme="dark"\] \.ci-sheet3 input:not\(\[type="checkbox"\]\)[\s\S]{0,400}background-color: transparent !important/);
});

test('место — строка, а не шаг', () => {
  assert.match(code, /const \[bedPickerOpen, setBedPickerOpen\] = useState\(!preSelectedBedId\);/);
  const hits = (code.match(/setBedPickerOpen\(false\)/g) || []).length;
  assert.ok(hits >= 2, `сворачивание стоит в ${hits} местах из двух (койка и «на полу»)`);
  assert.ok(code.indexOf('className="ci-bed ') < code.indexOf('className="ci-sheet3'),
    'выбор места снова внутри сетки граф');
});

test('полоса места идёт от края до края', () => {
  // Полоса — кнопка, а общее правило `button` даёт скругление и рамку:
  // на всю ширину окна это плашка с зазором, а не полоса бланка.
  assert.match(CSS, /\.ci-bed \{[\s\S]{0,200}border: 0;[\s\S]{0,60}border-radius: 0;/);
});

test('у каждого способа оплаты своя строка и свой магнит', () => {
  assert.match(code, /const PAY_METHODS = \[/);
  assert.match(code, /PAY_METHODS\.map\(m => \{/);
  assert.match(code, /onClick=\{\(\) => handleMagnet\(m\.key\)\}/);
  assert.match(code, /className="ci-mag"/);
});

test('суммы показываются с разрядами', () => {
  // «1000» и «10000» на глаз различаются только длиной, и ошибиться
  // разрядом в кассе стоит ровно один ноль.
  assert.match(code, /value=\{fmtSum\(formData\.pricePerNight\)\}/);
  assert.match(code, /fmtSum\(formData\[m\.key\]\)/);
  assert.match(code, /parseSum\(e\.target\.value\)/);
});

test('окно показывает то, что база знает о госте', () => {
  // Раньше из карточки брался только баланс: касса не отличала
  // постоянного гостя от впервые зашедшего, а «нет в чёрном списке»
  // приходилось выводить из отсутствия предупреждения, то есть из молчания.
  assert.match(code, /const \[clientCard, setClientCard\] = useState\(null\);/);
  assert.match(code, /setClientCard\(found \|\| null\);/);
  const at = code.indexOf("{t('marksTitle')}</div>");
  assert.ok(at > 0, 'блок отметок не найден');
  const block = code.slice(at, at + 3200);
  assert.match(block, /regularGuest/);
  assert.match(block, /clientCard\.lastVisit/);
  assert.match(block, /inBlacklistLine/);
  assert.match(block, /noClientCardNew/);
});

test('склонения не выдают ошибку системы', () => {
  // «31 лет» и «6 заезд» подрывают доверие к соседним числам — тем,
  // что про деньги. В узбекском склонений нет, и там формы совпадают.
  assert.match(code, /const plural = \(n, one, few, many\) => \{/);
  assert.match(code, /plural\(guestAge, t\('yearsOne'\)/);
  assert.match(code, /plural\(visitCount, t\('staysOne'\)/);
});

test('предел срока виден у поля, а не только полосой', () => {
  assert.match(code, /selectedBed\?\.maxFreeDays != null && \(/);
  assert.ok(code.indexOf('const availableBeds = useMemo') < code.indexOf('const selectedBed = availableBeds'),
    'selectedBed объявлен до availableBeds — окно не откроется вовсе');
});

test('снимок паспорта и сканер никуда не делись', () => {
  // Их легко потерять при перекладке разметки, а вернуть — только заново.
  assert.match(code, /photoInputRef\.current\?\.click\(\)/);
  assert.match(code, /onChange=\{handlePhotoChange\}/);
  assert.match(code, /setScanMode\('usb'\)/);
});

test('оплата по-прежнему скрыта от администратора', () => {
  assert.match(code, /\{currentUser\?\.role !== 'admin' && \(/);
});

test('весь текст идёт через словарь', () => {
  // Приложение двуязычное: строка, вписанная кириллицей в разметку,
  // останется русской и для узбекского кассира.
  const sheet = code.slice(code.indexOf('className="ci-sheet3'), code.indexOf('ci-foot shrink-0'));
  const literals = sheet.match(/>[^<>{}\n]*[А-Яа-яЁё]{3,}[^<>{}\n]*</g) || [];
  assert.deepEqual(literals, [], `в разметке остались русские строки: ${literals.join(' | ')}`);
});
