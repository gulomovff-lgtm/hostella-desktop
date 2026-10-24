import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cadastreRegFor, validCadastreFor, hasRegistration, autoRegisterAllowed,
  isLivingNow, cadastrePersonGone, NEW_STAY_RESET_KEYS,
} from '../src/utils/registrationStatus.js';
import { emehmonAmountForStay } from '../src/utils/emehmonAmount.js';

const now = new Date('2026-10-20T15:00:00');
const g = { id: 'g1', fullName: 'Ivanov Ivan', passport: 'AB 1234567', status: 'active', checkOutDate: '2026-10-25T12:00:00' };
const reg = (o) => ({ status: 'active', endDate: '2026-10-22', ...o });

test('кадастр — тоже регистрация: по guestId, паспорту, ФИО только без паспорта', () => {
  assert.ok(cadastreRegFor(g, [reg({ guestId: 'g1' })]));
  assert.ok(cadastreRegFor(g, [reg({ passport: 'AB1234567' })]), 'паспорт без пробелов');
  assert.ok(cadastreRegFor(g, [reg({ guestName: 'IVANOV  IVAN' })]), 'ФИО — когда паспорта нет');
  assert.equal(cadastreRegFor(g, [reg({ passport: 'XY0000000', guestName: 'Ivanov Ivan' })]), null, 'чужой паспорт сильнее ФИО');
  assert.equal(cadastreRegFor(g, [reg({ guestId: 'g1', status: 'removed' })]), null);
  assert.ok(hasRegistration(g, [reg({ guestId: 'g1' })], now), 'галочка «есть регистрация»');
});

test('истёкший кадастр — не регистрация, но автомат такого гостя в e-mehmon не ведёт', () => {
  const old = [reg({ guestId: 'g1', endDate: '2026-10-19' })];
  assert.equal(validCadastreFor(g, old, now), null);
  assert.equal(hasRegistration(g, old, now), false, 'снова в «Оформить»');
  assert.equal(autoRegisterAllowed(g, old), false, 'решает человек');
  assert.ok(validCadastreFor(g, [reg({ guestId: 'g1', endDate: '2026-10-20' })], now), 'последний день включительно');
  assert.equal(autoRegisterAllowed({ ...g, emehmonSkip: true }, []), false);
  assert.equal(autoRegisterAllowed(g, []), true);
});

test('живёт сейчас: срок вышел — уже не живёт, даже если не выселили', () => {
  assert.ok(isLivingNow(g, now));
  assert.equal(isLivingNow({ ...g, checkOutDate: '2026-10-19T12:00:00' }, now), false);
  assert.ok(isLivingNow({ ...g, checkOutDate: '2026-10-19T12:00:00', bonusCheckOutDate: '2026-10-21T12:00:00' }, now), 'бонусные сутки');
  assert.equal(isLivingNow({ ...g, roomId: 'DEBT_ONLY' }, now), false);
});

test('уведомление кадастра: уехавшему — нет, живущему и «с улицы» — да', () => {
  const r = reg({ passport: 'AB1234567' });
  assert.equal(cadastrePersonGone(r, [{ ...g, status: 'checked_out' }], now), true);
  assert.equal(cadastrePersonGone(r, [{ ...g, status: 'checked_out' }, { ...g, id: 'g2' }], now), false, 'живёт по новой записи');
  assert.equal(cadastrePersonGone(r, [], now), false, 'не наш гость — напоминаем');
});

test('новое проживание после паузы не несёт регистрацию и решения прошлого заезда', () => {
  for (const k of ['emehmonReg', 'kppRegistered', 'kppSituationDecision', 'emehmonSkip', 'emehmonClaimBy', 'emehmonSheet', 'emehmonStayStart']) {
    assert.ok(NEW_STAY_RESET_KEYS.includes(k), k);
  }
  assert.ok(!NEW_STAY_RESET_KEYS.includes('kppDate'), 'дата КПП — та же');
});

test('сумма в портале после переезда — с первого заезда, а не с переезда', () => {
  const moved = { checkInDate: '2026-10-18T12:00:00', emehmonStayStart: '2026-10-10T12:00:00' };
  const at = new Date('2026-10-20T13:00:00').getTime();
  assert.equal(emehmonAmountForStay(moved, 30000, at), 10 * 30000);
  assert.equal(emehmonAmountForStay({ checkInDate: moved.checkInDate }, 30000, at), 2 * 30000);
});
