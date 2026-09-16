/**
 * Сверка смены: касса, выручка и передача кассы напарнику.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeShiftReport, buildShiftReportText, buildShiftTelegramMsg } from '../src/utils/shiftReport.js';

const USER = { id: 'u1', login: 'kassir', name: 'Кассир', lastShiftEnd: '2026-08-17T09:00:00.000Z' };
const pay = (over) => ({ staffId: 'u1', date: '2026-08-17T12:00:00.000Z', ...over });
const exp = (over) => ({ staffId: 'u1', date: '2026-08-17T12:30:00.000Z', amount: 0, ...over });

test('касса = наличные минус расходы', () => {
  const r = computeShiftReport(USER, [pay({ cash: 500000, card: 300000 })], [exp({ amount: 100000 })]);
  assert.equal(r.income.cash, 500000);
  assert.equal(r.cashInHand, 400000);
  assert.equal(r.totalRevenue, 800000);
});

test('принятая смена складывается со своей — сдаётся общий отчёт за сутки', () => {
  const opening = { cash: 70000, card: 330000, qr: 0, transfer: 0, refunds: 0, expenses: 0 };
  const r = computeShiftReport(USER, [pay({ cash: 200000, card: 50000 })], [], opening);
  assert.equal(r.income.cash, 270000, 'наличные обеих половин');
  assert.equal(r.income.card, 380000, 'терминал тоже переходит');
  assert.equal(r.totalRevenue, 650000, 'итого за сутки, а не за половину');
  assert.equal(r.cashInHand, 270000);
});

test('расходы принятой смены переходят вместе с ней', () => {
  const opening = { cash: 500000, card: 0, qr: 0, transfer: 0, refunds: 20000, expenses: 100000 };
  const r = computeShiftReport(USER, [pay({ cash: 200000 })], [exp({ amount: 50000 })], opening);
  assert.equal(r.cashboxExpenses, 150000, 'расходы обеих половин');
  assert.equal(r.totalRefunds, 20000);
  assert.equal(r.cashInHand, 550000, '700 000 наличных минус 150 000 расходов');
});

test('перечисления по контрагентам не теряются при передаче', () => {
  const opening = { cash: 0, card: 0, qr: 0, transfer: 100000, transferByEntity: { 'ООО Ромашка': 100000 } };
  const r = computeShiftReport(USER, [pay({ transfer: 50000, transferTo: 'ООО Ромашка' })], [], opening);
  assert.equal(r.income.transfer, 150000);
  assert.equal(r.income.transferByEntity['ООО Ромашка'], 150000);
});

test('ранний формат переноса (только число) продолжает работать', () => {
  const r = computeShiftReport(USER, [pay({ cash: 100000 })], [], 700000);
  assert.equal(r.income.cash, 800000);
  assert.equal(r.cashInHand, 800000);
});

test('платежи и расходы до начала смены не считаются', () => {
  const old = pay({ cash: 999999, date: '2026-08-17T08:00:00.000Z' });
  const r = computeShiftReport(USER, [old, pay({ cash: 100000 })], []);
  assert.equal(r.income.cash, 100000);
});

test('чужие платежи в смену не попадают', () => {
  const r = computeShiftReport(USER, [pay({ cash: 100000, staffId: 'u2' })], []);
  assert.equal(r.income.cash, 0);
});

test('отчёт не делит смену на «свою» и «принятую» — сдаётся как обычно', () => {
  const opening = { cash: 70000, card: 330000, qr: 0, transfer: 0, refunds: 0, expenses: 0 };
  const r = computeShiftReport(USER, [pay({ cash: 100000 })], [], opening);
  const text = buildShiftReportText(USER, r);
  const tg = buildShiftTelegramMsg(USER, r);
  for (const report of [text, tg]) {
    assert.ok(!/передач/i.test(report), 'передача в отчёте не упоминается');
  }
  const norm = (s) => s.replace(/[\s\u00a0\u202f]/g, '');   // ru-RU разделяет разряды неразрывными пробелами
  assert.ok(norm(tg).includes('170000'), 'наличные — общие 170 000');
  assert.ok(norm(tg).includes('330000'), 'терминал принятой смены на месте');
});

test('возвраты и расходы с skipCashbox считаются по-разному', () => {
  const r = computeShiftReport(USER, [pay({ cash: 500000 })], [
    exp({ amount: 100000, category: 'Возврат' }),
    exp({ amount: 50000, skipCashbox: true }),
  ]);
  assert.equal(r.totalRefunds, 100000);
  assert.equal(r.cashboxExpenses, 100000, 'skipCashbox из кассы не вычитается');
  assert.equal(r.cashInHand, 400000);
});
