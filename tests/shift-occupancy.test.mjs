import test from 'node:test';
import assert from 'node:assert/strict';
import { findBlockingShift, blockingOwnerName } from '../src/utils/shiftOccupancy.js';

const users = [
    { id: 'u1', login: 'aziz',  name: 'Азиз' },
    { id: 'u2', login: 'bobur', name: 'Бобур' },
];

test('находит открытую смену другого кассира в том же хостеле', () => {
    const shifts = [{ id: 's1', hostelId: 'hostel1', endTime: null, staffId: 'u2', staffLogin: 'bobur' }];
    const found = findBlockingShift(shifts, users, { hostelId: 'hostel1', userId: 'u1', userLogin: 'aziz' });
    assert.equal(found?.id, 's1');
});

test('своя открытая смена не блокирует (по id)', () => {
    const shifts = [{ id: 's1', hostelId: 'hostel1', endTime: null, staffId: 'u1', staffLogin: 'aziz' }];
    assert.equal(findBlockingShift(shifts, users, { hostelId: 'hostel1', userId: 'u1', userLogin: 'aziz' }), null);
});

test('своя смена не блокирует и когда id документа сменился (сверка по логину)', () => {
    const shifts = [{ id: 's1', hostelId: 'hostel1', endTime: null, staffId: 'СТАРЫЙ_ID', staffLogin: 'aziz' }];
    assert.equal(findBlockingShift(shifts, users, { hostelId: 'hostel1', userId: 'u1', userLogin: 'aziz' }), null);
});

test('закрытая смена не блокирует', () => {
    const shifts = [{ id: 's1', hostelId: 'hostel1', endTime: '2026-09-01T10:00:00Z', staffId: 'u2', staffLogin: 'bobur' }];
    assert.equal(findBlockingShift(shifts, users, { hostelId: 'hostel1', userId: 'u1' }), null);
});

test('смена в другом хостеле не блокирует', () => {
    const shifts = [{ id: 's1', hostelId: 'hostel2', endTime: null, staffId: 'u2', staffLogin: 'bobur' }];
    assert.equal(findBlockingShift(shifts, users, { hostelId: 'hostel1', userId: 'u1' }), null);
});

test('призрачная смена удалённого сотрудника не блокирует вход остальным', () => {
    const shifts = [{ id: 's1', hostelId: 'hostel1', endTime: null, staffId: 'УДАЛЁН', staffLogin: 'ghost' }];
    assert.equal(findBlockingShift(shifts, users, { hostelId: 'hostel1', userId: 'u1' }), null);
});

test('без hostelId ничего не блокирует', () => {
    const shifts = [{ id: 's1', hostelId: 'hostel1', endTime: null, staffId: 'u2', staffLogin: 'bobur' }];
    assert.equal(findBlockingShift(shifts, users, { userId: 'u1' }), null);
});

test('пустые входные данные не ломают', () => {
    assert.equal(findBlockingShift(), null);
    assert.equal(findBlockingShift([], [], { hostelId: 'hostel1' }), null);
});

test('blockingOwnerName: берёт имя из списка сотрудников', () => {
    const shift = { staffId: 'u2', staffLogin: 'bobur' };
    assert.equal(blockingOwnerName(shift, users), 'Бобур');
});

test('blockingOwnerName: откатывается на имя из смены, потом на логин', () => {
    assert.equal(blockingOwnerName({ staffId: 'x', staffName: 'Из смены' }, users), 'Из смены');
    assert.equal(blockingOwnerName({ staffId: 'x', staffLogin: 'kassir' }, users), 'kassir');
    assert.equal(blockingOwnerName(null, users), '');
});
