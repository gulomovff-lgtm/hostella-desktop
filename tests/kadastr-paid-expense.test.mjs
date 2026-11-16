// Кадастр (решения владельца 16.11.2026): расход — только после одобренной
// оплаты; в расходе и уведомлении — на сколько суток листок и чем платили
// (последние цифры карты и телефона); продление в окне кадастра оформляет
// листок на сайте сразу.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const body = (name, len = 2600) => app.slice(app.indexOf(name), app.indexOf(name) + len);

test('листок оформлен — расхода ещё нет; расход только при оплате', () => {
  const apply = body('const applyPortalResult = async');
  const tail = apply.slice(apply.indexOf("if (portal.status !== 'saved') return;"), apply.indexOf('const kadPaidDoneRef'));
  assert.doesNotMatch(tail, /handleAddRegToExpenses\(/, 'после листка расход не пишется');
  assert.match(tail, /r\?\.pay === 'paid'\) await kadastrPaidExpense/);
  const paid = body('const kadastrPaidExpense = async');
  assert.match(paid, /handleAddRegToExpenses\(\{ \.\.\.reg, amount, createdAt: nowIso, listokDays/);
  assert.match(paid, /p\.expensedAt/, 'дважды не пишется');
  assert.match(app, /kadPaidFnRef\.current\(reg\)/, 'событие «оплачено» пишет расход');
  assert.match(app, /onPaid=\{\(\) => \{ const u = kadOtp\?\.payUrl/, 'код SMS принят — расход');
});

test('в расходе и уведомлении — сутки, карта и телефон', () => {
  const ca = readFileSync(new URL('../src/hooks/useCadastreActions.js', import.meta.url), 'utf8');
  const fn = ca.slice(ca.indexOf('const handleAddRegToExpenses'), ca.indexOf('const handleAddRegToExpenses') + 2200);
  assert.match(fn, /reg\.listokDays/);
  assert.match(fn, /cdaPayCard/);
  assert.match(fn, /cdaPayPhone/);
  assert.match(fn, /notifyExpense\([^)]*period/s);
  const main = readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8');
  assert.match(main, /const cardTail = \(c\) => \(c \? \{ payCard: String\(c\.number \|\| ''\)\.slice\(-4\)/, 'наружу — только последние 4 цифры');
  assert.equal((main.match(/\.\.\.cardTail\(card\)/g) || []).length, 2);
});

test('продление в окне кадастра сразу оформляет листок на сайте', () => {
  assert.match(app, /onExtendReg=\{canPerformActions \? handleExtendCadastreRegNow : null\}/);
  const ext = body('const handleExtendCadastreRegNow = async');
  assert.match(ext, /runKadastrPortal\(guest, days, 'default', \{ progress: true/);
  assert.match(ext, /from > today\)\) return/, 'дни, что начнутся позже, — сверке');
});
