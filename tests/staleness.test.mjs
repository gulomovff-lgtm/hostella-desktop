/**
 * Отсечка «запись протухла» — из-за её отсутствия приходили напоминания
 * о регистрации гостей, которых давно нет.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isStaleSince, STALE_TASK_DAYS } from '../src/utils/staleness.js';

const NOW = new Date('2026-08-17T12:00:00.000Z').getTime();
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString().slice(0, 10);

test('вчерашняя запись — ещё живая задача', () => {
  assert.equal(isStaleSince(daysAgo(1), STALE_TASK_DAYS, NOW), false);
});

test('ровно на границе 30 дней ещё не протухла, на 32-й — да', () => {
  assert.equal(isStaleSince(daysAgo(30), STALE_TASK_DAYS, NOW), false);
  assert.equal(isStaleSince(daysAgo(32), STALE_TASK_DAYS, NOW), true);
});

test('короткая отсечка для просроченного выезда', () => {
  assert.equal(isStaleSince(daysAgo(1), 2, NOW), false);
  assert.equal(isStaleSince(daysAgo(3), 2, NOW), true);
});

test('дата в будущем никогда не протухшая', () => {
  const future = new Date(NOW + 5 * 86400000).toISOString().slice(0, 10);
  assert.equal(isStaleSince(future, STALE_TASK_DAYS, NOW), false);
});

test('пустое значение и мусор не считаются протухшими', () => {
  assert.equal(isStaleSince('', STALE_TASK_DAYS, NOW), false);
  assert.equal(isStaleSince(null, STALE_TASK_DAYS, NOW), false);
  assert.equal(isStaleSince('не дата', STALE_TASK_DAYS, NOW), false);
});

test('ISO-строка со временем обрабатывается так же, как дата', () => {
  const iso = new Date(NOW - 40 * 86400000).toISOString();
  assert.equal(isStaleSince(iso, STALE_TASK_DAYS, NOW), true);
});
