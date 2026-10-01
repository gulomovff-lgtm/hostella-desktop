import test from 'node:test';
import assert from 'node:assert/strict';
import { passportKey, stayNights, stayNightPrice, recentStays } from '../src/utils/guestStayHistory.js';

test('passportKey: пробелы и регистр не мешают сверке', () => {
    assert.equal(passportKey(' ac 123 45 67 '), 'AC1234567');
    assert.equal(passportKey(''), '');
    assert.equal(passportKey(undefined), '');
});

test('stayNights: считает ночи по календарным суткам', () => {
    // заезд 14:00, выезд 12:00 через двое суток — это 2 ночи, а не 1.9
    assert.equal(stayNights({
        checkInDate:  '2026-08-01T14:00:00.000Z',
        checkOutDate: '2026-08-03T12:00:00.000Z',
    }), 2);
});

test('stayNights: заезд и выезд в один день — всё равно сутки', () => {
    assert.equal(stayNights({
        checkInDate:  '2026-08-01T14:00:00.000Z',
        checkOutDate: '2026-08-01T20:00:00.000Z',
    }), 1);
});

test('stayNights: без дат откатывается на оформленное количество', () => {
    assert.equal(stayNights({ days: 5 }), 5);
    assert.equal(stayNights({ days: '3' }), 3);
});

test('stayNights: нечего считать — null, а не ноль', () => {
    assert.equal(stayNights({}), null);
    assert.equal(stayNights({ days: 0 }), null);
    assert.equal(stayNights({ checkInDate: 'мусор', checkOutDate: 'мусор' }), null);
});

test('stayNights: фактический выезд важнее оформленного срока', () => {
    // оформили на 10 суток, съехал через 2 — показываем 2
    assert.equal(stayNights({
        days: 10,
        checkInDate:  '2026-08-01T14:00:00.000Z',
        checkOutDate: '2026-08-03T12:00:00.000Z',
    }), 2);
});

const guests = [
    { id: 'g1', passport: 'AC1234567', status: 'checked_out', checkInDate: '2026-01-10T14:00:00Z', checkOutDate: '2026-01-13T12:00:00Z' },
    { id: 'g2', passport: 'ac 123 4567', status: 'checked_out', checkInDate: '2026-05-01T14:00:00Z', checkOutDate: '2026-05-06T12:00:00Z' },
    { id: 'g3', passport: 'AC1234567', status: 'booking',     checkInDate: '2026-09-01T14:00:00Z' },
    { id: 'g4', passport: 'AC1234567', status: 'active',      checkInDate: '2026-08-20T14:00:00Z' },
    { id: 'g5', passport: 'XX9999999', status: 'checked_out', checkInDate: '2026-06-01T14:00:00Z', checkOutDate: '2026-06-02T12:00:00Z' },
];

test('recentStays: только завершённые заезды этого гостя, свежие первыми', () => {
    const r = recentStays(guests, { passport: 'AC1234567' });
    assert.deepEqual(r.map(x => x.id), ['g2', 'g1']);
    assert.deepEqual(r.map(x => x.nights), [5, 3]);
});

test('recentStays: бронь и текущий заезд не считаются прошлыми', () => {
    const ids = recentStays(guests, { passport: 'AC1234567' }).map(x => x.id);
    assert.ok(!ids.includes('g3'));
    assert.ok(!ids.includes('g4'));
});

test('recentStays: паспорт сверяется без учёта пробелов и регистра', () => {
    const ids = recentStays(guests, { passport: 'ac1234567' }).map(x => x.id);
    assert.deepEqual(ids, ['g2', 'g1']);
});

test('recentStays: своя запись в собственную историю не попадает', () => {
    const ids = recentStays(guests, { passport: 'AC1234567', excludeId: 'g2' }).map(x => x.id);
    assert.deepEqual(ids, ['g1']);
});

test('recentStays:ограничение количества работает', () => {
    assert.equal(recentStays(guests, { passport: 'AC1234567', limit: 1 }).length, 1);
});

test('recentStays: без паспорта истории нет', () => {
    assert.deepEqual(recentStays(guests, { passport: '' }), []);
    assert.deepEqual(recentStays(guests, {}), []);
});

test('recentStays: пустой список не ломает', () => {
    assert.deepEqual(recentStays([], { passport: 'AC1234567' }), []);
    assert.deepEqual(recentStays(undefined, { passport: 'AC1234567' }), []);
});

// ── цена ночи в прошлые заезды ───────────────────────────────────────────────
test('stayNightPrice: берёт оформленную цену за ночь', () => {
    assert.equal(stayNightPrice({ pricePerNight: 70000, totalPrice: 350000 }, 5), 70000);
});

test('stayNightPrice: без цены за ночь выводит её из суммы и числа ночей', () => {
    // пакетная цена: 300 000 за 5 ночей — это 60 000 за ночь
    assert.equal(stayNightPrice({ totalPrice: 300000 }, 5), 60000);
});

test('stayNightPrice: нечего вывести — null, а не ноль', () => {
    assert.equal(stayNightPrice({}, 5), null);
    assert.equal(stayNightPrice({ totalPrice: 300000 }, 0), null);
    assert.equal(stayNightPrice({ pricePerNight: 0, totalPrice: 0 }, 5), null);
});

test('recentStays: отдаёт цену ночи и общую сумму по каждому заезду', () => {
    const r = recentStays([
        { id: 'a', passport: 'AC1', status: 'checked_out',
          checkInDate: '2026-05-01T14:00:00Z', checkOutDate: '2026-05-06T12:00:00Z',
          pricePerNight: 70000, totalPrice: 350000 },
        { id: 'b', passport: 'AC1', status: 'checked_out',
          checkInDate: '2026-01-10T14:00:00Z', checkOutDate: '2026-01-13T12:00:00Z',
          totalPrice: 180000 },
    ], { passport: 'AC1' });
    assert.deepEqual(r.map(x => x.nights), [5, 3]);
    assert.deepEqual(r.map(x => x.nightPrice), [70000, 60000]);
    assert.deepEqual(r.map(x => x.total), [350000, 180000]);
});
