import test from 'node:test';
import assert from 'node:assert/strict';
import { roomKey, matchRowToGuest, planRoomReconcile, namesOf, classifyPortalError } from '../src/utils/emehmonRooms.js';

const G = (id, o = {}) => ({ id, status: 'active', hostelId: 'hostel1', roomNumber: '3', fullName: 'GUEST ' + id, passport: 'P' + id, checkInDate: '2026-09-10', ...o });
const R = (passport, room, o = {}) => ({ passport, room, displayName: o.name || '', name: (o.name || '').toUpperCase(), ...o });

test('roomKey: «3», «3-xona», «№3», «03» — одна комната; нечисловое — как есть', () => {
    for (const v of ['3', ' 3 ', '3-xona', '№3', '03', 3]) assert.equal(roomKey(v), '3', String(v));
    assert.equal(roomKey('Lux'), 'LUX');
    assert.equal(roomKey(''), '');
});

test('matchRowToGuest: паспорт сильнее ФИО, активный сильнее выехавшего, свежий — старого', () => {
    const guests = [
        G('old', { status: 'checked_out', checkInDate: '2026-08-01' }),
        G('cur', { passport: 'Pold', checkInDate: '2026-09-10' }),
        G('byname', { passport: 'ZZ', fullName: 'IVANOV IVAN' }),
    ];
    assert.equal(matchRowToGuest(R('P old', '3'), guests).id, 'cur', 'паспорт с пробелом, активный');
    assert.equal(matchRowToGuest(R('', '3', { name: 'Ivanov Ivan' }), guests).id, 'byname', 'по имени без учёта регистра');
    assert.equal(matchRowToGuest(R('NOPE', '3', { name: 'Nobody' }), guests), null);
});

test('planRoomReconcile: выехавших — вывести, переехавших — переселить, чужих — на решение', () => {
    const guests = [
        G('a'),                                           // живёт в 3 — keep
        G('b', { status: 'checked_out' }),                // выехал — depart
        G('c', { roomNumber: '5' }),                      // в Hostella в 5-й — move из 3 в 5
        G('d', { roomNumber: '3' }),                      // живёт в 3, а в портале в 7-й — move в 3
        G('h2', { hostelId: 'hostel2' }),                 // чужой филиал — не учитывается
    ];
    const rows = [R('Pa', '3'), R('Pb', '3-xona'), R('Pc', '3'), R('Pd', '7'), R('PX', '3', { name: 'STRANGER' }), R('Ph2', '3')];
    const p = planRoomReconcile({ room: 3, rows, guests, capacity: 4, hostelId: 'hostel1' });
    assert.deepEqual(p.keep.map(x => x.guest.id), ['a']);
    assert.deepEqual(p.depart.map(x => x.guest.id), ['b']);
    assert.deepEqual(p.move.map(x => [x.guest.id, x.toRoom]), [['c', '5'], ['d', '3']]);
    assert.equal(p.unknown.length, 2, 'чужой и гость другого филиала — неизвестные для этого филиала');
    assert.equal(p.occupiedNow, 5);      // a, b, c, X, h2
    assert.equal(p.occupiedAfter, 2);    // a + d
    assert.equal(p.fullNow, true);
    assert.equal(p.fullAfter, true, 'двое неизвестных + двое своих при вместимости 4 — всё ещё полно');
});

test('planRoomReconcile: без вместимости «полно» не утверждаем; пустой список — пустой план', () => {
    const p = planRoomReconcile({ room: '3', rows: [R('Pa', '3')], guests: [G('a')], capacity: 0 });
    assert.equal(p.fullNow, false);
    const e = planRoomReconcile({ room: '3', rows: [], guests: [G('a')], capacity: 4 });
    assert.deepEqual([e.keep.length, e.depart.length, e.move.length, e.unknown.length], [0, 0, 0, 0]);
});

test('namesOf: до трёх имён и «+k»', () => {
    const items = [{ guest: { fullName: 'A' } }, { displayName: 'B' }, { row: { displayName: 'C' } }, { guest: { fullName: 'D' } }];
    assert.equal(namesOf(items), 'A, B, C +1');
    assert.equal(namesOf([]), '');
});

test('classifyPortalError: комната переполнена / уже зарегистрирован / прочее', () => {
    assert.equal(classifyPortalError("Xonada bo'sh joy yo'q"), 'room_full');
    assert.equal(classifyPortalError('Комната переполнена'), 'room_full');
    assert.equal(classifyPortalError('Mehmon allaqachon ro‘yxatdan o‘tgan'), 'already_active');
    assert.equal(classifyPortalError('Xatolik yuz berdi'), 'unknown');
    assert.equal(classifyPortalError(''), 'unknown');
});
