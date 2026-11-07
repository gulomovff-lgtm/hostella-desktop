/**
 * Сутки и доли смен: обычная смена, половинки 50/50, зарплата.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { shiftDays, shiftSalary, ratioOf, isShared, fmtDays, effShiftRange } from '../src/utils/shiftMath.js';

const RATE = 300000;
const full = { startTime: '2026-08-16T09:00:00.000Z', endTime: '2026-08-17T09:00:00.000Z' };
const half = (over) => ({ ...full, shareRatio: 0.5, shareGroupId: 'g1', ...over });

test('обычная смена 9→9 — это одни сутки и полная ставка', () => {
  assert.equal(shiftDays(full), 1);
  assert.equal(shiftSalary(full, RATE), RATE);
});

test('половинка даёт полсуток и половину ставки независимо от часов', () => {
  const short = half({ endTime: '2026-08-16T13:00:00.000Z' }); // отработал 4 часа
  const long = half({ endTime: '2026-08-17T09:00:00.000Z' });  // отработал 20 часов
  assert.equal(shiftDays(short), 0.5);
  assert.equal(shiftDays(long), 0.5);
  assert.equal(shiftSalary(short, RATE), RATE / 2);
  assert.equal(shiftSalary(long, RATE), RATE / 2);
});

test('две половинки одной смены складываются в сутки и полную ставку', () => {
  const parts = [half({ endTime: '2026-08-16T15:00:00.000Z' }), half({ startTime: '2026-08-16T15:00:00.000Z' })];
  const days = parts.reduce((s, p) => s + shiftDays(p), 0);
  const money = parts.reduce((s, p) => s + shiftSalary(p, RATE), 0);
  assert.equal(days, 1);
  assert.equal(money, RATE);
});

test('доля по умолчанию — целая смена; мусор в поле игнорируется', () => {
  assert.equal(ratioOf({}), 1);
  assert.equal(ratioOf({ shareRatio: 0 }), 1);
  assert.equal(ratioOf({ shareRatio: 5 }), 1);
  assert.equal(ratioOf({ shareRatio: 'нет' }), 1);
  assert.equal(ratioOf({ shareRatio: 0.5 }), 0.5);
});

test('разделённая смена помечена группой', () => {
  assert.equal(isShared(full), false);
  assert.equal(isShared(half()), true);
});

test('свежая активная смена ещё не засчитывается, а через 3+ часа — уже сутки', () => {
  const now = new Date('2026-08-17T12:00:00.000Z').getTime();
  const justStarted = { startTime: '2026-08-17T11:00:00.000Z' };
  const running = { startTime: '2026-08-17T06:00:00.000Z' };
  assert.equal(effShiftRange(justStarted, now), null);
  assert.equal(shiftDays(justStarted, now), 0);
  assert.equal(shiftDays(running, now), 1);
});

test('сутки печатаются без хвоста .0', () => {
  assert.equal(fmtDays(1), '1');
  assert.equal(fmtDays(0.5), '0.5');
  assert.equal(fmtDays(2.5), '2.5');
  assert.equal(fmtDays(12), '12');
});
