/**
 * Выселение без окна: поля и отметки по результату (src/utils/emehmonDeparture.js).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { departureExtras, departureMarks, normalizePayType, PAY_TYPES } from '../src/utils/emehmonDeparture.js';

const inAt = Date.parse('2026-09-01T12:00:00Z');
const guest = { checkInDate: new Date(inAt).toISOString() };

test('сумма — итог за проживание по формуле портала', () => {
  assert.deepEqual(departureExtras(guest, { rate: 70000, payType: '2', now: inAt + 3 * 86400e3 }), { amount: '210000', payType: '2' });
});

test('гость без даты заезда — хотя бы ставка за сутки, а не ноль и не пусто', () => {
  assert.equal(departureExtras({}, { rate: 30000 }).amount, '30000');
  assert.equal(departureExtras(null, { rate: 50000 }).amount, '50000');
  assert.equal(departureExtras({}, { rate: 0 }).amount, '0');
});

test('после выезда сумма не растёт: считается до checkOutDate', () => {
  const g = { ...guest, checkOutDate: new Date(inAt + 2 * 86400e3).toISOString() };
  assert.equal(departureExtras(g, { rate: 30000, now: inAt + 30 * 86400e3 }).amount, '60000');
});

test('тип оплаты — только из шести кодов портала, иначе «Другое»', () => {
  assert.equal(PAY_TYPES.length, 6);
  assert.equal(normalizePayType('4'), '4');
  assert.equal(normalizePayType(4), '4');
  for (const bad of ['', '0', '7', 'cash', undefined, null]) assert.equal(normalizePayType(bad), '1', String(bad));
});

test('отметки: лист на диске и/или в облаке — emehmonSheet; нет — emehmonSheetError; вывод отмечен всегда', () => {
  const now = new Date('2026-09-11T09:32:00.000Z');
  const res = { status: 'done', sheet: { file: 'C:\\x\\AB_1.pdf', name: 'AB_1.pdf', bytes: 48211, at: '2026-09-11T09:31:50.000Z', source: 'child' } };
  const local = departureMarks(res, { now });
  assert.equal(local.emehmonOut, true);
  assert.equal(local.emehmonOutAt, '2026-09-11T09:32:00.000Z');
  assert.equal(local.emehmonSheet.file, 'C:\\x\\AB_1.pdf');
  assert.equal(local.emehmonSheet.url, '');
  const cloud = departureMarks(res, { now, uploaded: { path: 'sheets/h1/g1/AB_1.pdf', url: 'https://x/AB_1.pdf' } });
  assert.equal(cloud.emehmonSheet.url, 'https://x/AB_1.pdf');
  assert.equal(cloud.emehmonSheet.path, 'sheets/h1/g1/AB_1.pdf');
  // диск не записался, но облако есть — лист всё равно доступен
  const onlyCloud = departureMarks({ status: 'done', sheet: { name: 'a.pdf', bytes: 10 } }, { now, uploaded: { path: 'p', url: 'u' } });
  assert.equal(onlyCloud.emehmonSheet.url, 'u');

  const bad = departureMarks({ status: 'submitted', sheetError: { code: 'no_sheet', message: 'x'.repeat(300) } }, { now });
  assert.equal(bad.emehmonOut, true);
  assert.equal(bad.emehmonSheet, undefined);
  assert.equal(bad.emehmonSheetError.code, 'no_sheet');
  assert.equal(bad.emehmonSheetError.message.length, 200);
  assert.deepEqual(Object.keys(departureMarks({ status: 'absent' }, { now })).sort(), ['emehmonOut', 'emehmonOutAt']);
});
