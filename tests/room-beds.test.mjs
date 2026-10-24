import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBedsData, bedStats } from '../src/utils/roomBeds.js';

const NOW = new Date(2026, 8, 28, 15, 0);
const at = (d, h = 12) => new Date(2026, 8, d, h, 0).toISOString();

test('места: гость, бронь на сегодня, бронь позже, свободно', () => {
    const room = { id: 'r', capacity: 4 };
    const guests = [
        { id: 'a', bedId: '1', status: 'active', checkInDate: at(26, 14), checkOutDate: at(30) },       // живёт
        { id: 'b', bedId: '2', status: 'booking', checkInDate: at(28, 14), checkOutDate: at(30) },      // бронь сегодня
        { id: 'c', bedId: '3', status: 'booking', checkInDate: at(30, 14), checkOutDate: at(31) },      // бронь через 2 дня
    ];
    const beds = buildBedsData(room, guests, NOW);
    assert.deepEqual(beds.map(b => b.status), ['occupied', 'booking', 'free_limited', 'free']);
    const s = bedStats(beds);
    assert.equal(s.free, 2, 'бронь на сегодня место занимает, бронь позже — нет');
    assert.equal(s.booking, 1);
    assert.equal(s.freeLimited, 1);
    assert.equal(s.occ, 1);
});

test('места: просрочка < 28 ч занимает место, дольше — нет; аренда — всё занято; доп. место', () => {
    const room = { id: 'r', capacity: 3 };
    const beds = buildBedsData(room, [
        { id: 'a', bedId: '1', status: 'active', checkInDate: at(25, 14), checkOutDate: at(28, 12) },  // просрочил на 3 ч
        { id: 'b', bedId: '2', status: 'active', checkInDate: at(20, 14), checkOutDate: at(26, 12) },  // просрочил на 2+ суток
        { id: 'x', bedId: 'extra', status: 'active', checkInDate: at(27, 14), checkOutDate: at(30) },  // доп. место
    ], NOW);
    const s = bedStats(beds);
    assert.equal(beds[0].status, 'timeout');
    assert.equal(beds[1].status, 'free');
    assert.equal(s.free, 2);
    assert.equal(s.occ, 2, 'просрочка + доп. место');
    assert.equal(bedStats(buildBedsData({ id: 'r', capacity: 4, rental: { active: true } }, [], NOW)).rented, 4);
    assert.equal(bedStats(buildBedsData({ id: 'r', capacity: 4, rental: { active: true } }, [], NOW)).free, 0);
});
