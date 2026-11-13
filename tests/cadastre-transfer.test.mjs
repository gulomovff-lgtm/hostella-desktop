import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cadastreBlocksAuto, autoRegisterAllowed, cadastreTransferDue,
  cadastreEndFor, cadastreDaysFor, cadastreHouseFor,
} from '../src/utils/registrationStatus.js';
import { registrationDue, guestRegistrationDue, autoRegisterDay } from '../src/utils/kppRules.js';

const at = (ymd) => new Date(ymd + 'T10:00:00');
const g = { id: 'g1', passport: 'FA1234567', fullName: 'Rahimov Ali', status: 'active' };
const transfer = { guestId: 'g1', passport: 'FA1234567', startDate: '2026-11-11', endDate: '2026-11-20', status: 'active', backToEmehmon: true };
const plain = { ...transfer, backToEmehmon: undefined };

test('перевод кнопкой: пока кадастр действует — автомат не регистрирует', () => {
  assert.equal(cadastreBlocksAuto(g, [transfer], at('2026-11-15')), true);
  assert.equal(autoRegisterAllowed(g, [transfer], at('2026-11-20')), false, 'последний день включительно');
});

test('перевод кнопкой: на следующий день после конца — обратно в e-mehmon', () => {
  assert.equal(cadastreBlocksAuto(g, [transfer], at('2026-11-21')), false);
  assert.equal(autoRegisterAllowed(g, [transfer], at('2026-11-21')), true);
});

test('обычный кадастр: после конца ждём продления 18 часов, потом — в e-mehmon', () => {
  assert.equal(autoRegisterAllowed(g, [plain], at('2026-11-21')), false, '21-го в 10:00 ещё ждём');
  assert.equal(autoRegisterAllowed(g, [plain], at('2026-11-25')), true);
});

test('снятый кадастр не мешает', () => {
  assert.equal(autoRegisterAllowed(g, [{ ...plain, status: 'removed' }], at('2026-11-15')), true);
});

test('вывод из портала — с дня начала и пока кадастр действует', () => {
  const later = { ...transfer, startDate: '2026-11-13' };
  assert.equal(cadastreTransferDue(g, [later], at('2026-11-12')), null, 'начнётся завтра — ещё не выводим');
  assert.ok(cadastreTransferDue(g, [later], at('2026-11-13')));
  assert.equal(cadastreTransferDue(g, [later], at('2026-11-21')), null, 'кончился — не выводим');
  assert.equal(cadastreTransferDue(g, [plain], at('2026-11-15')), null, 'обычный кадастр — не трогаем портал');
});

test('дни и конец кадастра: день начала — первый', () => {
  assert.equal(cadastreEndFor('2026-11-11', 10), '2026-11-20');
  assert.equal(cadastreEndFor('2026-11-30', 2), '2026-12-01');
  assert.equal(cadastreEndFor('2026-11-11', 0), '');
  assert.equal(cadastreDaysFor('2026-11-11', '2026-11-20'), 10);
  assert.equal(cadastreDaysFor('2026-11-11', '2026-11-11'), 1);
  assert.equal(cadastreDaysFor('2026-11-11', '2026-11-10'), 0);
});

test('дом-кадастр: свой филиал, иначе любой действующий', () => {
  const houses = [{ id: 'a', hostelId: 'hostel1' }, { id: 'b', hostelId: 'hostel2' }, { id: 'c', hostelId: 'hostel2', active: false }];
  assert.equal(cadastreHouseFor('hostel2', houses).id, 'b');
  assert.equal(cadastreHouseFor('hostel1', houses).id, 'a');
  assert.equal(cadastreHouseFor('hostel3', houses).id, 'a');
  assert.equal(cadastreHouseFor('hostel1', []), null);
});

test('Таджикистан — авто-регистрация на 8-й день от КПП', () => {
  assert.equal(autoRegisterDay('Таджикистан'), 8);
  assert.equal(registrationDue({ country: 'Таджикистан', kppDate: '2026-11-01', today: '2026-11-07' }), false); // 7-й
  assert.equal(registrationDue({ country: 'Таджикистан', kppDate: '2026-11-01', today: '2026-11-08' }), true);  // 8-й
  assert.equal(registrationDue({ country: 'Таджикистан', kppDate: '2026-10-01', today: '2026-11-08' }), true);  // давно пора
  // остальные — как раньше, предпоследний день окна
  assert.equal(autoRegisterDay('Казахстан'), 29);
  assert.equal(autoRegisterDay('Китай'), 2);
});

test('Таджикистан без даты КПП — считаем от заезда, остальные без КПП — сразу', () => {
  const tj = { country: 'Таджикистан', checkInDate: '2026-11-01T14:00:00.000Z' };
  assert.equal(guestRegistrationDue(tj, '2026-11-05'), false);
  assert.equal(guestRegistrationDue(tj, '2026-11-08'), true);
  assert.equal(guestRegistrationDue({ ...tj, kppDate: '2026-10-25' }, '2026-11-01'), true, 'дата КПП главнее заезда');
  assert.equal(guestRegistrationDue({ country: 'Китай' }, '2026-11-05'), true);
  assert.equal(guestRegistrationDue({ country: 'Казахстан', kppDate: '2026-11-01' }, '2026-11-05'), false);
});
