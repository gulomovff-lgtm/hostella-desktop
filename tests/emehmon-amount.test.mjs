/**
 * Сумма для e-mehmon: сутки считаются формулой самого портала,
 * стоимость = ставка × прожитые сутки.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { emehmonStayDays, emehmonAmountForStay, needsAmountUpdate } from '../src/utils/emehmonAmount.js';

const at = (s) => new Date(s).getTime();
const CHECK_IN = '2026-08-17T14:00:00.000Z';

test('в день заезда — одни сутки', () => {
  assert.equal(emehmonStayDays(CHECK_IN, null, at('2026-08-17T15:00:00.000Z')), 1);
  assert.equal(emehmonStayDays(CHECK_IN, null, at('2026-08-17T23:59:00.000Z')), 1);
});

test('ровно через 24 часа портал считает ещё одни сутки', () => {
  // round(24/24 + 0.35) = round(1.35) = 1 — вторые сутки начинаются позже
  assert.equal(emehmonStayDays(CHECK_IN, null, at('2026-08-18T14:00:00.000Z')), 1);
});

test('вторые сутки — с 27ч36м после заезда (правило портала)', () => {
  assert.equal(emehmonStayDays(CHECK_IN, null, at('2026-08-18T17:35:00.000Z')), 1);
  assert.equal(emehmonStayDays(CHECK_IN, null, at('2026-08-18T17:36:00.000Z')), 2);
});

test('после выезда счётчик не растёт', () => {
  const out = '2026-08-20T12:00:00.000Z';
  const atCheckout = emehmonStayDays(CHECK_IN, out, at(out));
  assert.equal(emehmonStayDays(CHECK_IN, out, at('2026-09-01T12:00:00.000Z')), atCheckout);
});

test('10 суток местному — 300 000', () => {
  const guest = { checkInDate: CHECK_IN };
  const now = at('2026-08-27T14:00:00.000Z'); // ровно 10 суток
  assert.equal(emehmonStayDays(guest.checkInDate, null, now), 10);
  assert.equal(emehmonAmountForStay(guest, 30000, now), 300000);
});

test('иностранцу: одни сутки — 50 000, двое — 100 000', () => {
  const guest = { checkInDate: CHECK_IN };
  assert.equal(emehmonAmountForStay(guest, 50000, at('2026-08-17T20:00:00.000Z')), 50000);
  assert.equal(emehmonAmountForStay(guest, 50000, at('2026-08-18T18:00:00.000Z')), 100000);
});

test('без даты заезда и с нулевой ставкой сумма не считается', () => {
  assert.equal(emehmonStayDays(null, null, Date.now()), 0);
  assert.equal(emehmonAmountForStay({ checkInDate: CHECK_IN }, 0), 0);
  assert.equal(emehmonAmountForStay({ checkInDate: 'мусор' }, 30000), 0);
});

test('обновляем портал только при реальном изменении суммы', () => {
  assert.equal(needsAmountUpdate(300000, 300000), false);
  assert.equal(needsAmountUpdate(300000, 330000), true);
  assert.equal(needsAmountUpdate(undefined, 30000), true, 'суммы ещё не было — отправляем');
  assert.equal(needsAmountUpdate('30000.00', 30000), false, 'портал отдаёт строку с копейками');
  assert.equal(needsAmountUpdate(30000, 0), false, 'нулевую сумму не шлём');
});
