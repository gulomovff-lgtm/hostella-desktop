import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDebtReport, expectedProfit, guestPaid, hostelOf } from '../src/utils/debtReport.js';

const guests = [
    // Должник с двумя заселениями: 300 000 начислено, 100 000 оплачено → долг 200 000
    { id: 'g1', fullName: 'Иванов И.', passport: 'AA1', hostelId: 'hostel1', totalPrice: 200000, amountPaid: 50000, roomNumber: '5' },
    { id: 'g2', fullName: 'Иванов И.', passport: 'AA1', hostelId: 'hostel1', totalPrice: 100000, amountPaid: 50000, roomNumber: '5' },
    // Оплачен полностью — в отчёт не попадает
    { id: 'g3', fullName: 'Петров П.', passport: 'BB2', hostelId: 'hostel1', totalPrice: 100000, amountPaid: 100000 },
    // Бронь не считается долгом
    { id: 'g4', fullName: 'Бронь', passport: 'CC3', hostelId: 'hostel1', totalPrice: 100000, amountPaid: 0, status: 'booking' },
    // Второй филиал
    { id: 'g5', fullName: 'Сидоров С.', passport: 'DD4', hostelId: 'hostel2', totalPrice: 80000, paidCash: 30000 },
];

const rooms = [
    { id: 'r1', number: '12', hostelId: 'hostel2', rental: { active: true, tenantName: 'ООО «Тест»', totalAmount: 1000000, paidTransfer: 400000 } },
    { id: 'r2', number: '13', hostelId: 'hostel1', rental: { active: false, totalAmount: 500000 } },
];

const contractGroups = [
    { id: 'c1', name: 'Бригада А', hostelId: 'hostel1', contractRate: '50000', manualEntries: [{ id: 'e', people: 2, nights: 5 }] },
    { id: 'c2', name: 'Бригада Б', hostelId: 'hostel2', contractRate: '40000', manualEntries: [{ id: 'e', people: 1, nights: 2 }] },
];

const payments = [
    { id: 'p1', contractGroupId: 'c1', transfer: 200000, transferTo: 'YATT SOBIROVA' },
    { id: 'p2', contractGroupId: 'c2', cash: 30000 },
    { id: 'p3', guestId: 'g1', cash: 50000 },
];

test('собирает долги из трёх источников', () => {
    const r = buildDebtReport({ guests, rooms, contractGroups, payments });
    const ids = r.rows.map(x => x.source);
    assert.equal(ids.filter(s => s === 'guest').length, 2);    // Иванов + Сидоров
    assert.equal(ids.filter(s => s === 'rental').length, 1);   // только активная аренда
    assert.equal(ids.filter(s => s === 'contract').length, 2);
});

test('заселения одного должника складываются в одну строку', () => {
    const r = buildDebtReport({ guests, rooms: [], contractGroups: [], payments });
    const ivanov = r.rows.find(x => x.name === 'Иванов И.');
    assert.equal(ivanov.charged, 300000);
    assert.equal(ivanov.paid, 100000);
    assert.equal(ivanov.debt, 200000);
    assert.equal(ivanov.records, 2);
});

test('способ оплаты выводится из истории платежей', () => {
    const r = buildDebtReport({ guests, rooms, contractGroups, payments });
    const brigA = r.rows.find(x => x.name === 'Бригада А');   // платили перечислением
    const brigB = r.rows.find(x => x.name === 'Бригада Б');   // платили наличными
    assert.equal(brigA.method, 'transfer');
    assert.deepEqual(brigA.entities, ['YATT SOBIROVA']);
    assert.equal(brigB.method, 'regular');
    assert.equal(r.rows.find(x => x.name === 'Иванов И.').method, 'regular');
});

test('аренда с оплатой перечислением попадает в перечисления', () => {
    const r = buildDebtReport({ guests: [], rooms, contractGroups: [], payments: [] });
    assert.equal(r.rows[0].method, 'transfer');
    assert.equal(r.rows[0].debt, 600000);
    assert.equal(r.totals.transfer, 600000);
    assert.equal(r.totals.regular, 0);
});

test('итоги: всего = перечисление + обычные', () => {
    const r = buildDebtReport({ guests, rooms, contractGroups, payments });
    assert.equal(r.totals.transfer + r.totals.regular, r.totals.debt);
    // 200 000 (Иванов) + 50 000 (Сидоров) + 600 000 (аренда) + 300 000 (А) + 50 000 (Б)
    assert.equal(r.totals.debt, 1200000);
    assert.equal(r.totals.count, 5);
});

test('разбивка по филиалам и источникам', () => {
    const r = buildDebtReport({ guests, rooms, contractGroups, payments });
    const h1 = r.byHostel.find(h => h.hostelId === 'hostel1');
    const h2 = r.byHostel.find(h => h.hostelId === 'hostel2');
    assert.equal(h1.guest, 200000);
    assert.equal(h1.contract, 300000);
    assert.equal(h1.debt, 500000);
    assert.equal(h2.rental, 600000);
    assert.equal(h2.debt, 700000);
    assert.equal(r.bySource.contract.debt, 350000);
    assert.equal(r.bySource.guest.debt, 250000);
});

test('фильтр по филиалу оставляет только его долги', () => {
    const r = buildDebtReport({ guests, rooms, contractGroups, payments, hostelId: 'hostel2' });
    assert.equal(r.totals.debt, 700000);
    assert.equal(r.byHostel.length, 1);
    assert.ok(r.rows.every(x => x.hostelId === 'hostel2'));
});

test('долги по юрлицам сгруппированы', () => {
    const r = buildDebtReport({ guests, rooms, contractGroups, payments });
    const sob = r.byEntity.find(e => e.entity === 'YATT SOBIROVA');
    assert.equal(sob.debt, 300000);
});

test('списание долга по договору уменьшает отчёт', () => {
    const withWriteOff = [{ ...contractGroups[0], extraCharges: [{ id: 'w', amount: -100000, writeOff: true }] }];
    const r = buildDebtReport({ guests: [], rooms: [], contractGroups: withWriteOff, payments });
    assert.equal(r.totals.debt, 200000); // было 300 000
});

test('филиал по умолчанию и ожидаемая прибыль', () => {
    assert.equal(hostelOf({}), 'hostel1');
    assert.equal(hostelOf({ hostelId: 'hostel2' }), 'hostel2');
    assert.equal(guestPaid({ paidCash: 10, paidCard: 5, paidQR: 1 }), 16);
    assert.equal(guestPaid({ amountPaid: 0, paidCash: 999 }), 0); // явный ноль сильнее старых полей
    assert.equal(expectedProfit(500000, 1200000), 1700000);
    assert.equal(expectedProfit(-50000, 100000), 50000);
});

test('пустые данные не ломают отчёт', () => {
    const r = buildDebtReport();
    assert.deepEqual(r.rows, []);
    assert.equal(r.totals.debt, 0);
    assert.deepEqual(r.byHostel, []);
});
