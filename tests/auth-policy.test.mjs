/**
 * Политика защиты входа от перебора: пороги, блокировки, сброс.
 * Часы не трогаем — «сейчас» передаётся аргументом.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const policy = require('../functions/lib/authPolicy.js');

const T0 = 1_700_000_000_000; // фиксированный «сейчас»
const MIN = 60_000;

/** Прогоняет n неудач подряд, возвращает последнее состояние и последний результат. */
const failTimes = (n, startState = null, now = T0) => {
  let state = startState;
  let last = null;
  for (let i = 0; i < n; i++) {
    last = policy.registerFailure(state, now);
    state = last.state;
  }
  return { state, last };
};

test('первые попытки не блокируют', () => {
  const { last } = failTimes(4);
  assert.equal(last.locked, false);
  assert.equal(policy.checkAttempt(last.state, T0).allowed, true);
});

test('5 неудач — блокировка на минуту', () => {
  const { state } = failTimes(5);
  const check = policy.checkAttempt(state, T0);
  assert.equal(check.allowed, false);
  assert.equal(check.retryAfterSec, 60);
});

test('блокировка истекает — попытки снова разрешены, счётчик обнулён', () => {
  const { state } = failTimes(5);
  const check = policy.checkAttempt(state, T0 + MIN + 1);
  assert.equal(check.allowed, true);
  assert.equal(check.state.fails, 0);
});

test('упорный перебор получает всё более длинные паузы', () => {
  // 10 неудач подряд (с учётом истечения предыдущих блокировок)
  let state = null;
  let now = T0;
  for (let i = 1; i <= 10; i++) {
    const res = policy.registerFailure(state, now);
    state = res.state;
    if (res.locked) now += 1; // время идёт, но блокировку не пережидаем
  }
  const check = policy.checkAttempt(state, now);
  assert.equal(check.allowed, false);
  assert.ok(check.retryAfterSec > 60, `ожидалась пауза длиннее минуты, получено ${check.retryAfterSec}`);
});

test('успешный вход обнуляет счётчик', () => {
  const { state } = failTimes(4);
  assert.equal(state.fails, 4);
  const reset = policy.registerSuccess();
  assert.equal(reset.fails, 0);
  assert.equal(policy.checkAttempt(reset, T0).allowed, true);
});

test('окно закрывается — старые неудачи не копятся', () => {
  const { state } = failTimes(4);
  const later = T0 + policy.WINDOW_MS + 1;
  const res = policy.registerFailure(state, later);
  assert.equal(res.state.fails, 1, 'после окна счёт начинается заново');
  assert.equal(res.locked, false);
});

test('текст блокировки понятен кассиру', () => {
  assert.match(policy.lockMessage(900), /15 мин/);
  assert.match(policy.lockMessage(30), /30 с/);
});
