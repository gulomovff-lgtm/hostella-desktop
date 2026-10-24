/**
 * Срок годности отложенных Telegram-уведомлений: из-за его отсутствия
 * старые сообщения уходили «задним числом» при восстановлении сети.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isFreshTelegram, TELEGRAM_MAX_AGE_MS } from '../src/utils/offlineQueue.js';

const NOW = new Date('2026-08-17T12:00:00.000Z').getTime();
const entry = (agoMs, over = {}) => ({
  _type: 'telegram',
  text: 'Новое заселение',
  _queuedAt: new Date(NOW - agoMs).toISOString(),
  ...over,
});

test('свежее уведомление отправляем', () => {
  assert.equal(isFreshTelegram(entry(60_000), NOW), true);
});

test('на границе срока годности ещё отправляем, после — нет', () => {
  assert.equal(isFreshTelegram(entry(TELEGRAM_MAX_AGE_MS), NOW), true);
  assert.equal(isFreshTelegram(entry(TELEGRAM_MAX_AGE_MS + 1000), NOW), false);
});

test('уведомление недельной давности выбрасываем', () => {
  assert.equal(isFreshTelegram(entry(7 * 24 * 3600_000), NOW), false);
});

test('запись без метки времени считаем протухшей', () => {
  assert.equal(isFreshTelegram({ _type: 'telegram', text: 'x' }, NOW), false);
  assert.equal(isFreshTelegram(entry(0, { _queuedAt: 'мусор' }), NOW), false);
});

test('платежи в очереди срок годности не ограничивает', () => {
  const payment = { amount: 100000, _queuedAt: new Date(NOW - 30 * 86400000).toISOString() };
  assert.equal(isFreshTelegram(payment, NOW), true);
});

test('расход и возврат без сети уходят и через несколько дней — с пометкой о задержке', async () => {
  const { MONEY_TELEGRAM_MAX_AGE_MS, delayedTelegramText } = await import('../src/utils/offlineQueue.js');
  for (const notifType of ['expenseAdded', 'refund']) {
    assert.equal(isFreshTelegram(entry(3 * 24 * 3600_000, { notifType }), NOW), true, notifType);
    assert.equal(isFreshTelegram(entry(MONEY_TELEGRAM_MAX_AGE_MS + 1000, { notifType }), NOW), false);
  }
  assert.equal(isFreshTelegram(entry(TELEGRAM_MAX_AGE_MS + 1000, { notifType: 'checkin' }), NOW), false, 'заселение — по-прежнему 12 ч');
  const late = delayedTelegramText(entry(3 * 3600_000, { text: 'Расход 50 000' }), NOW);
  assert.match(late, /с задержкой/);
  assert.match(late, /Расход 50 000$/);
  assert.equal(delayedTelegramText(entry(30_000, { text: 'Расход' }), NOW), 'Расход', 'ушло почти сразу — без пометки');
});
