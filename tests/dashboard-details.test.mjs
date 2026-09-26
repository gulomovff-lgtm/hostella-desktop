import test from 'node:test';
import assert from 'node:assert/strict';
import { groupByMethod, byStaff, byDay, expensesByCategory, freeBedsOf } from '../src/utils/dashboardDetails.js';

const pays = [
    { id: 'a', staffId: 'u1', amount: 300, cash: 100, card: 200, method: 'split', date: '2026-09-25T09:00:00' },
    { id: 'b', staffId: 'u2', amount: 50, method: 'qr', date: '2026-09-25T08:00:00' },
    { id: 'c', staffId: 'u1', amount: 90, cash: 40, card: 0, qr: 0, transfer: 0, balance: 50, method: 'split', date: '2026-09-24T10:00:00' },
    { id: 'd', staffId: 'u1', amount: 70, method: 'weird', date: '2026-09-24T11:00:00' },
];

test('groupByMethod: сумма групп = Σ amount (как на плитке), микс по частям, остаток — «прочее»', () => {
    const { groups, totals } = groupByMethod(pays);
    assert.equal(Object.values(totals).reduce((s, v) => s + v, 0), 510);
    assert.deepEqual(totals, { cash: 140 + 70, card: 200, qr: 50, transfer: 0, balance: 50, other: 0 });
    assert.deepEqual(groups.cash.map(x => x.p.id), ['c', 'd', 'a'], 'по времени');
    const odd = groupByMethod([{ id: 'x', amount: 100, cash: 30, card: 0, qr: 0, transfer: 0, balance: 0 }]);
    assert.equal(odd.totals.other, 70, 'неразложенная часть не теряется');
});

test('byStaff и byDay', () => {
    assert.deepEqual(byStaff(pays).map(s => [s.staffId, s.total, s.count]), [['u1', 460, 3], ['u2', 50, 1]]);
    const days = byDay(pays, d => String(d).slice(0, 10));
    assert.deepEqual(days.map(d => [d.ds, d.total]), [['2026-09-25', 350], ['2026-09-24', 160]]);
    assert.equal(days[1].cash, 110);
    assert.equal(days[1].other, 50, 'баланс — в прочее по дню');
    assert.deepEqual(days[0].payments.map(p => p.id), ['b', 'a']);
});

test('expensesByCategory', () => {
    const r = expensesByCategory([{ id: 1, category: 'Зарплата', amount: 100, date: '2026-09-01' }, { id: 2, category: 'Хоз', amount: 30, date: '2026-09-02' }, { id: 3, category: 'Хоз', amount: 90, date: '2026-09-03' }]);
    assert.deepEqual(r.map(c => [c.category, c.total, c.items.length]), [['Хоз', 120, 2], ['Зарплата', 100, 1]]);
    assert.equal(r[0].items[0].id, 3, 'свежие сверху');
});

test('freeBedsOf: свободные номера коек; аренда — нет свободных; перебор гостей не даёт лишних мест', () => {
    const room = { id: 'r', capacity: 4 };
    assert.deepEqual(freeBedsOf(room, [{ roomId: 'r', bedId: '2' }, { roomId: 'x', bedId: '1' }]), [1, 3, 4]);
    assert.deepEqual(freeBedsOf({ ...room, rental: { active: true } }, []), []);
    assert.deepEqual(freeBedsOf({ id: 'r', capacity: 2 }, [{ roomId: 'r', bedId: 'A' }, { roomId: 'r', bedId: 'B' }]), []);
});
