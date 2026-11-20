// Сайт кадастра (reg.emehmon.uz): данные гостя, ссылки, скрипты страницы,
// хранение секретов только в главном процессе.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { toDmySlash, kadastrPayload, kadastrMissing, portalFromResult, portalPayOpen } from '../src/utils/kadastrPortal.js';

const require = createRequire(import.meta.url);
const kp = require('../electron/kadastrPortal.js');
const mainSrc = readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8');
const preloadSrc = readFileSync(new URL('../electron/preload.js', import.meta.url), 'utf8');

test('данные гостя → поля сайта (даты dd/mm/yyyy, ISO3, паспорт без пробелов)', () => {
  assert.equal(toDmySlash('2001-03-09'), '09/03/2001');
  assert.equal(toDmySlash(''), '');
  const p = kadastrPayload({ country: 'Таджикистан', birthDate: '1990-01-02', passport: '40 545 9377', passportIssueDate: '2020-05-06' }, 5, 'default');
  assert.deepEqual(p, { iso3: 'TJK', birth: '02/01/1990', passport: '405459377', pspDate: '06/05/2020', issuedBy: '', days: 5, card: 'default' });
  assert.deepEqual(kadastrMissing(p), []);
  assert.deepEqual(kadastrMissing(kadastrPayload({ country: 'Таджикистан', passport: 'X' }, 1)), ['birthDate', 'passportIssueDate']);
});

test('ответ сайта → отметка на записи кадастра; оплата открыта сутки', () => {
  const now = new Date('2026-11-13T10:00:00Z');
  const ok = portalFromResult({ status: 'saved', amount: 44000, payUrl: 'https://reg.emehmon.uz/listovka/payTS/a1', pay: 'otp' }, now);
  assert.equal(ok.status, 'saved'); assert.equal(ok.amount, 44000);
  assert.equal(portalPayOpen(ok, now.getTime() + 23 * 3600e3), true);
  assert.equal(portalPayOpen(ok, now.getTime() + 25 * 3600e3), false, 'через сутки сайт листок удаляет');
  assert.equal(portalPayOpen({ ...ok, paidAt: 'x' }, now.getTime()), false);
  const bad = portalFromResult({ status: 'not_found', message: 'topilmadi' }, now);
  assert.equal(bad.status, 'error'); assert.equal(bad.error, 'not_found');
});

test('окно кадастра ходит только на reg.emehmon.uz и OneID; ссылка оплаты — только payTS своего сайта', () => {
  assert.ok(kp.isKadastrUrl('https://reg.emehmon.uz/listovka'));
  assert.ok(kp.isKadastrUrl('https://id.egov.uz/oz?client_id=e_mehmon'));
  assert.ok(!kp.isKadastrUrl('http://reg.emehmon.uz/'));
  assert.ok(!kp.isKadastrUrl('https://evil.com/?reg.emehmon.uz'));
  assert.equal(kp.safePayUrl('https://reg.emehmon.uz/listovka/payTS/3kFsn-bmNhk'), 'https://reg.emehmon.uz/listovka/payTS/3kFsn-bmNhk');
  assert.equal(kp.safePayUrl('https://evil.com/listovka/payTS/x'), '');
  assert.equal(kp.safePayUrl('https://reg.emehmon.uz/listovka/delete'), '');
});

test('скрипты страницы собираются и не тащат данные мимо JSON', () => {
  for (const s of [kp.buildOneIdLoginScript({ cert: '79326482' }), kp.buildListovkaScript({ passport: "X');alert(1);//" }), kp.buildPayFillScript({ number: '8600' })]) {
    assert.doesNotThrow(() => new Function(s));
  }
  const l = kp.buildListovkaScript({ cadMatch: '117.75' });
  assert.match(l, /id_cad/); assert.match(l, /wdays/); assert.match(l, /id_visittype/); assert.match(l, /id_guest/);
  assert.match(l, /gi-summary-cell-value-total/, 'сумма из итога 5-го шага');
  assert.match(l, /window\.showResponse = function/, 'ответ сохранения ловим подменой обработчика');
});

test('пароль ЭЦП печатается только в окно E-IMZO и не идёт в командную строку', () => {
  assert.match(kp.EIMZO_PS, /exe\.Contains\("e-imzo"\)/, 'процесс E-IMZO — по пути');
  assert.match(kp.EIMZO_PS, /\(name == "java" \|\| name == "javaw"\) && PwTitle\.IsMatch/, 'Java — только с окном E-IMZO/пароля');
  assert.doesNotMatch(kp.EIMZO_PS, /diag[^\n]*\$pw/i, 'пароль не попадает в подробности');
  assert.match(kp.EIMZO_PS, /-OutputAssembly \$dll/, 'помощник собирается один раз и кэшируется');
  assert.match(kp.EIMZO_PS, /\[Console\]::In\.ReadLine\(\)/);
  assert.match(kp.EIMZO_PS, /if \(\[HWin\]::Mine\(\)\)/, 'перед вводом впереди окно E-IMZO');
  assert.match(kp.EIMZO_PS, /if \(!Mine\(\)\) return "focus_lost"/, 'перед каждой клавишей — окно E-IMZO');
  const fn = kp.startEimzoHelper.toString();
  assert.match(fn, /ps\.stdin\.write\(String\(password\)/);
  assert.doesNotMatch(fn, /'-Command'/);
});

test('окно пароля E-IMZO прозрачное на время ввода, помощник готов заранее (20.11.2026)', () => {
  assert.match(kp.EIMZO_PS, /if \(\$hide\) \{ \[HWin\]::Hide\(\$h\) \}/);
  assert.match(kp.EIMZO_PS, /SetLayeredWindowAttributes\(h, 0, 0, 2\)/, 'альфа 0');
  // Не вышло вперёд / не напечатали / окно осталось — снова видно, ввести руками
  const loop = kp.EIMZO_PS.slice(kp.EIMZO_PS.indexOf('while ((Get-Date)'));
  assert.equal((loop.match(/\[HWin\]::Reveal\(\$h\)/g) || []).length, 3);
  assert.match(kp.EIMZO_PS, /\$go = \[Console\]::In\.ReadLine\(\)\s+if \(\$go -ne 'go'\)/, 'ищет окно только после «Kirish»');
  const run = mainSrc.slice(mainSrc.indexOf('async function kadastrLoginRun'), mainSrc.indexOf('async function kadastrLoginRun') + 4000);
  assert.ok(run.indexOf('startEimzoHelper(') < run.indexOf('buildOneIdLoginScript('), 'помощник запущен до выбора ключа');
  assert.match(run, /if \(!r \|\| r\.status !== 'clicked'\) helper\.cancel\(\)/);
  assert.match(run, /const typed = await helper\.go\(\)/);
});

test('e-mehmon ответил 502/503 — окно не мешает работать (20.11.2026)', () => {
  const lock = mainSrc.slice(mainSrc.indexOf('const lockUntilLogin'), mainSrc.indexOf('const hardenEmehmonWindow'));
  assert.match(lock, /const portalDown = \(\) => lastCode >= 500 \|\| lastCode === -1/);
  assert.match(lock, /'did-navigate', \(_e, _url, code\) => \{ lastCode = Number\(code\) \|\| 0/);
  // Сбой проверяется раньше, чем «не страница входа — значит вошли»
  assert.ok(lock.indexOf('if (portalDown())') < lock.indexOf('const onLogin = isPortalLogin(win)'));
  const down = lock.slice(lock.indexOf('if (portalDown())'), lock.indexOf('const onLogin = isPortalLogin(win)'));
  assert.match(down, /win\.setAlwaysOnTop\(false\); win\.setClosable\(true\); win\.setMinimizable\(true\)/, 'замок снят');
  assert.match(down, /if \(after === 'hide'\) \{ try \{ win\.hide\(\)/, 'фоновое окно прячется');
  assert.match(down, /win\.loadURL\(url\)/, 'тихий повтор');
  // Автоматика не вытаскивает окно на экран, пока сайт не отвечает
  assert.match(lock, /win\.show = \(\) => \{ if \(portalDown\(\)\) \{/);
  assert.match(lock, /isPortalLogin\(win\) && !portalDown\(\)\) \{\s*e\.preventDefault\(\)/, 'крестик на странице ошибки закрывает');
});

test('секреты кадастра — на сервере по филиалам; рендереру только маски', () => {
  const vaultSrc = readFileSync(new URL('../functions/kadastrVault.js', import.meta.url), 'utf8');
  // Сервер: шифрование, кассир — только свой филиал, менять — только админ
  assert.match(vaultSrc, /aes-256-gcm/);
  assert.match(vaultSrc, /role === 'cashier' && String\(tok\.hostellaHostel \|\| ''\) !== hostelId/);
  assert.match(vaultSrc, /if \(!ADMINS\.includes\(role\)\) throw fail\('permission-denied'/);
  assert.match(vaultSrc, /'kadastr_vault_read'/, 'каждая выдача секретов — в журнал');
  const pub = vaultSrc.slice(vaultSrc.indexOf('function publicView'), vaultSrc.indexOf('function applyPatch'));
  assert.doesNotMatch(pub, /eimzoPassword: st\.eimzoPassword|number: c\.number|phone: c\.phone/, 'маски без открытых значений');
  // Открытые значения забирает главный процесс, не рендерер
  assert.match(mainSrc, /action: 'secrets'/);
  assert.match(mainSrc, /const VAULT_URL_RX = \/\^https:\\\/\\\/us-central1-/, 'секреты — только с функции проекта');
  assert.doesNotMatch(preloadSrc, /kadastrSettingsGet|kadastr-settings-get/, 'прежние локальные настройки убраны');
  const vaultUi = readFileSync(new URL('../src/utils/kadastrVault.js', import.meta.url), 'utf8');
  assert.doesNotMatch(vaultUi, /action: 'secrets'/, 'интерфейс секреты не запрашивает');
  assert.match(preloadSrc, /kadastrRegister: \(payload\) => ipcRenderer\.invoke\('kadastr-register'/);
  // E-IMZO-сертификат признаём только для окна кадастра
  assert.match(mainSrc, /u\.hostname === '127\.0\.0\.1' && u\.port === '64443' && kadastrWindow/);
});

test('вход в кадастр — в фоне: окно не показывается, касса держит вход сама', () => {
  const login = mainSrc.slice(mainSrc.indexOf('async function kadastrLogin'), mainSrc.indexOf('async function kadastrFillPayment'));
  assert.doesNotMatch(login, /win\.show\(\)/);
  assert.ok(mainSrc.includes("ipcMain.handle('kadastr-list'"), 'вход держит сверка: список берётся после фонового входа');
  assert.match(mainSrc, /backgroundThrottling: false/);
});

test('оплата с картой — в скрытом окне, SMS-код вводится в программе', () => {
  const fill = mainSrc.slice(mainSrc.indexOf('async function kadastrFillPayment'), mainSrc.indexOf('// Список листков сайта для сверки'));
  assert.match(fill, /\} else \{ win\.show\(\); win\.focus\(\); \}/, 'окно сайта — только когда карту вводят на сайте');
  assert.ok(mainSrc.includes("ipcMain.handle('kadastr-pay-otp'"));
  assert.match(preloadSrc, /kadastrPayOtp: \(code\) => ipcRenderer\.invoke\('kadastr-pay-otp'/);
  const s = kp.buildOtpSubmitScript("12'34;56");
  assert.doesNotThrow(() => new Function(s));
  assert.match(s, /var code = "123456"/, 'в страницу уходят только цифры');
  assert.match(s, /confirmNumber/); assert.match(s, /otpInputs/);
});

test('очередь кадастра не встаёт навсегда: у шагов и операций есть предел времени', () => {
  // kadastrChain трогает только kadQueue — все операции идут через неё
  assert.equal((mainSrc.match(/kadastrChain/g) || []).length, 3);
  for (const op of ['list', 'register', 'login', 'open-pay', 'pay-otp']) assert.ok(mainSrc.includes(`kadQueue('${op}',`), op);
  const sec = mainSrc.slice(mainSrc.indexOf('function kadQueue'), mainSrc.indexOf("ipcMain.handle('emehmon-tursbor'"));
  assert.doesNotMatch(sec, /\bwin\.loadURL\(|kadastrWindow\.webContents\.executeJavaScript\(/, 'страницы сайта — только через kadLoad/kadJs');
});

test('цепочка входа OneID пропускается целиком (sso.egov.uz и http-возврат), чужое — нет', () => {
  assert.ok(kp.isKadastrUrl('https://sso.egov.uz/sso/oauth/Authorization.do?client_id=e_mehmon'));
  assert.ok(kp.isKadastrUrl('http://reg.emehmon.uz/user/autosocialize/egov?code=x'));
  assert.ok(!kp.isKadastrUrl('http://reg.emehmon.uz/listovka'));
  assert.ok(!kp.isKadastrUrl('https://evil.egov.uz/'));
});
