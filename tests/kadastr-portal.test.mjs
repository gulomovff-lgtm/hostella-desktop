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
  assert.ok(kp.EIMZO_PS.includes("-like '*\\E-IMZO\\*'"), 'только процесс из папки E-IMZO');
  assert.match(kp.EIMZO_PS, /\[Console\]::In\.ReadLine\(\)/);
  assert.match(kp.EIMZO_PS, /if \(\$pids -contains \$fp\)/, 'перед вводом впереди окно E-IMZO');
  const fn = kp.typeEimzoPassword.toString();
  assert.match(fn, /ps\.stdin\.write\(String\(password\)/);
  assert.doesNotMatch(fn, /'-Command'/);
});

test('секреты кадастра — в главном процессе, рендереру только маски', () => {
  assert.match(mainSrc, /electron\.safeStorage\.encryptString/);
  assert.match(mainSrc, /const kadastrPublic = \(st\) => \(\{\s*hasPassword: !!st\.eimzoPassword/);
  assert.doesNotMatch(mainSrc, /kadastrPublic[\s\S]{0,400}eimzoPassword: st\.eimzoPassword/);
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

test('цепочка входа OneID пропускается целиком (sso.egov.uz и http-возврат), чужое — нет', () => {
  assert.ok(kp.isKadastrUrl('https://sso.egov.uz/sso/oauth/Authorization.do?client_id=e_mehmon'));
  assert.ok(kp.isKadastrUrl('http://reg.emehmon.uz/user/autosocialize/egov?code=x'));
  assert.ok(!kp.isKadastrUrl('http://reg.emehmon.uz/listovka'));
  assert.ok(!kp.isKadastrUrl('https://evil.egov.uz/'));
});
