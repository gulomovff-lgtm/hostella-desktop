import test from 'node:test';
import assert from 'node:assert/strict';
import {
    planConfig, planPrice, isLocal, planOf, breakfastGuests, breakfastWriteOff, writeOffDelta,
    includedUsed, applyPlanAllowance, stayNightsBefore, splitPaid, recipeOf, DEFAULT_PLANS, ymd,
    buildPlanSwitch, newPriceCandidates,
} from '../src/utils/stayPlans.js';

const cfg = { pricing: { plans: DEFAULT_PLANS } };
const d = (s) => new Date(s + 'T10:00:00');

test('цена: второй хостел с 01.10 — по стране и тарифу; до даты и в первом — нет тарифов', () => {
    assert.equal(planPrice('hostel2', 'room', 'Узбекистан', d('2026-10-01'), cfg), 80000);
    assert.equal(planPrice('hostel2', 'full', 'Узбекистан', d('2026-10-01'), cfg), 100000);
    assert.equal(planPrice('hostel2', 'room', 'Россия', d('2026-10-05'), cfg), 105000);
    assert.equal(planPrice('hostel2', 'full', 'Германия', d('2026-10-05'), cfg), 125000);
    assert.equal(planPrice('hostel2', 'full', 'Россия', d('2026-09-30'), cfg), null);
    assert.equal(planPrice('hostel1', 'room', 'Узбекистан', d('2026-10-05'), cfg), null);
    assert.equal(planConfig('hostel2', d('2026-09-30'), cfg), null);
    // конфиг без plans — берутся значения владельца по умолчанию
    assert.equal(planPrice('hostel2', 'full', 'Узбекистан', d('2026-10-02'), { pricing: {} }), 100000);
    // выключенная схема
    assert.equal(planPrice('hostel2', 'room', '', d('2026-10-02'), { pricing: { plans: { hostel2: { ...DEFAULT_PLANS.hostel2, enabled: false } } } }), null);
});

test('местный: Узбекистан или страна не указана', () => {
    assert.equal(isLocal('Узбекистан'), true);
    assert.equal(isLocal(''), true);
    assert.equal(isLocal(' Узбекистан '), true);
    assert.equal(isLocal('Казахстан'), false);
    assert.equal(planOf({ plan: 'full' }), 'full');
    assert.equal(planOf({}), 'room');
});

const g = (id, over) => ({ id, hostelId: 'hostel2', plan: 'full', status: 'active', roomNumber: '1', bedId: '1', ...over });

test('завтраки: кто ночевал накануне, только тариф с завтраком и свой филиал', () => {
    const now = d('2026-10-05');
    const list = [
        g('a', { checkInDate: '2026-10-03T09:00:00', checkOutDate: '2026-10-06T07:00:00' }),   // живёт — да
        g('b', { checkInDate: '2026-10-05T08:00:00', checkOutDate: '2026-10-07T07:00:00' }),   // заехал сегодня — завтрак завтра
        g('c', { checkInDate: '2026-10-01T09:00:00', checkOutDate: '2026-10-05T07:00:00' }),   // выезд сегодня — ночевал, да
        g('d', { plan: 'room', checkInDate: '2026-10-03T09:00:00', checkOutDate: '2026-10-08T07:00:00' }),
        g('e', { hostelId: 'hostel1', checkInDate: '2026-10-03T09:00:00', checkOutDate: '2026-10-08T07:00:00' }),
        g('f', { status: 'checked_out', checkInDate: '2026-10-03T09:00:00', checkOutDate: '2026-10-05T07:00:00' }),
        g('h', { status: 'booking', checkInDate: '2026-10-05T12:00:00', checkOutDate: '2026-10-08T07:00:00' }),
    ];
    assert.deepEqual(breakfastGuests(list, 'hostel2', now, now).map(x => x.id), ['a', 'c']);
    // завтра: a (выезд 06-го), b и бронь h
    assert.deepEqual(breakfastGuests(list, 'hostel2', d('2026-10-06'), now).map(x => x.id).sort(), ['a', 'b', 'h']);
});

const catalog = [
    { id: 'egg', name: 'Яйцо', kind: 'product', costPrice: 1500, stock: { hostel2: 30 } },
    { id: 'bread', name: 'Хлеб', kind: 'product', costPrice: 5000, stock: { hostel2: 2 } },
    { id: 'wash', name: 'Стирка', kind: 'service', price: 20000, planIncludedPerDay: 1 },
    { id: 'iron', name: 'Глажка', kind: 'service', price: 10000 },
];

test('списание на завтраки: по рецепту, дробное вверх, себестоимость', () => {
    const recipe = recipeOf({ breakfastRecipe: { hostel2: [{ itemId: 'egg', qty: 2 }, { itemId: 'bread', qty: 0.5 }, { itemId: 'x', qty: 0 }] } }, 'hostel2');
    assert.equal(recipe.length, 2);
    const w = breakfastWriteOff(recipe, 3, catalog, 'hostel2');
    assert.deepEqual(w.lines.map(l => [l.itemId, l.qty, l.cost, l.have]), [['egg', 6, 9000, 30], ['bread', 2, 10000, 2]]);
    assert.equal(w.cost, 19000);
    assert.equal(breakfastWriteOff(recipe, 0, catalog, 'hostel2').lines.length, 0);
});

test('повторная отметка завтраков — списывается только разница', () => {
    const prev = [{ itemId: 'egg', name: 'Яйцо', qty: 6 }, { itemId: 'bread', name: 'Хлеб', qty: 2 }];
    const next = [{ itemId: 'egg', name: 'Яйцо', qty: 8 }];
    assert.deepEqual(writeOffDelta(prev, next), [{ itemId: 'egg', name: 'Яйцо', delta: 2 }, { itemId: 'bread', name: 'Хлеб', delta: -2 }]);
    assert.deepEqual(writeOffDelta(prev, prev), []);
});

test('стирка в тарифе: одна в сутки бесплатно, дальше платно; без завтрака — платно', () => {
    const guest = { id: 'a', plan: 'full', status: 'active' };
    const lines = [{ itemId: 'wash', qty: 2, price: 20000, sum: 40000 }, { itemId: 'iron', qty: 1, price: 10000, sum: 10000 }];
    const day = d('2026-10-05');
    const r = applyPlanAllowance(lines, guest, [], catalog, day);
    assert.equal(r[0].included, 1);
    assert.equal(r[0].sum, 20000);
    assert.equal(r[1].included, undefined);
    // уже брал сегодня — бесплатного не осталось
    const sales = [{ guestId: 'a', date: '2026-10-05T09:00:00', status: 'active', items: [{ itemId: 'wash', qty: 1, included: 1 }] }];
    assert.equal(includedUsed(sales, 'a', 'wash', day), 1);
    assert.equal(applyPlanAllowance(lines, guest, sales, catalog, day)[0].sum, 40000);
    // вчерашняя не считается, отменённая — тоже
    assert.equal(includedUsed([{ ...sales[0], date: '2026-10-04T09:00:00' }], 'a', 'wash', day), 0);
    assert.equal(includedUsed([{ ...sales[0], status: 'cancelled' }], 'a', 'wash', day), 0);
    assert.equal(applyPlanAllowance(lines, { ...guest, plan: 'room' }, [], catalog, day)[0].sum, 40000);
});

test('деление проживания: сутки до границы и после', () => {
    const guest = { checkInDate: '2026-09-28T15:00:00', days: 7 };
    assert.deepEqual(stayNightsBefore(guest, new Date(2026, 9, 1, 12)), { passed: 3, remaining: 4, total: 7 });
    assert.deepEqual(stayNightsBefore(guest, new Date(2026, 8, 28, 20)), { passed: 0, remaining: 7, total: 7 });
    assert.deepEqual(stayNightsBefore(guest, new Date(2026, 9, 20, 12)), { passed: 7, remaining: 0, total: 7 });
    assert.equal(ymd(new Date(2026, 9, 1, 23, 30)), '2026-10-01');
});

test('деньги при делении: сначала первая часть, ни сумма не теряется', () => {
    const guest = { amountPaid: 500000, paidCash: 300000, paidCard: 100000, paidTransfer: 50000, paidBalance: 50000 };
    const { first, second } = splitPaid(guest, 195000);
    assert.equal(first.amountPaid, 195000);
    assert.equal(second.amountPaid, 305000);
    for (const k of ['paidCash', 'paidCard', 'paidQR', 'paidTransfer', 'paidBalance']) assert.equal(first[k] + second[k], guest[k] || 0);
    // оплачено меньше первой части — вся оплата на неё
    const s2 = splitPaid({ amountPaid: 100000, paidCash: 100000 }, 195000);
    assert.equal(s2.first.amountPaid, 100000);
    assert.equal(s2.second.amountPaid, 0);
});

test('смена тарифа посреди проживания: деление, деньги и услуги не двоятся', () => {
    const guest = {
        id: 'g1', hostelId: 'hostel2', status: 'active', country: 'Узбекистан', plan: 'room',
        checkInDate: '2026-10-02T14:00:00', checkOutDate: '2026-10-09T12:00:00', days: 7,
        pricePerNight: 80000, totalPrice: 560000, amountPaid: 400000, paidCash: 400000,
        servicesTotal: 30000, emehmonReg: true, emehmonOut: false,
    };
    const r = buildPlanSwitch(guest, { plan: 'full', price: 100000, at: new Date(2026, 9, 5, 9), servicesPaid: 20000 });
    assert.equal(r.mode, 'split');
    assert.equal(r.oldPatch.days, 3);
    assert.equal(r.oldPatch.totalPrice, 240000);
    assert.equal(r.oldPatch.amountPaid, 240000);
    assert.equal(r.oldPatch.servicesTotal, 0);
    assert.equal(r.oldPatch.status, 'checked_out');
    assert.equal(r.oldPatch.emehmonMovedOut, true);
    const n = r.newGuest;
    assert.equal(n.days, 4);
    assert.equal(n.pricePerNight, 100000);
    assert.equal(n.totalPrice, 400000);
    assert.equal(n.amountPaid, 160000);
    assert.equal(n.paidCash, 160000);
    assert.equal(n.plan, 'full');
    assert.equal(n.servicesTotal, 30000);
    assert.equal(n.servicesPaidCarry, 20000);
    assert.equal(n.emehmonReg, true);
    assert.equal('emehmonOut' in n, false);
    assert.equal(n.id, undefined);
    assert.equal(n.checkOutDate, guest.checkOutDate);
    assert.equal(new Date(n.checkInDate).getDate(), 5);
    // деньги сохранены целиком
    assert.equal(r.oldPatch.amountPaid + n.amountPaid, guest.amountPaid);
    // бронь и заезд сегодня — пересчёт без деления
    assert.equal(buildPlanSwitch({ ...guest, status: 'booking' }, { plan: 'full', price: 100000, at: new Date(2026, 9, 5) }).mode, 'reprice');
    const rp = buildPlanSwitch(guest, { plan: 'full', price: 100000, at: new Date(2026, 9, 2, 18) });
    assert.equal(rp.mode, 'reprice');
    assert.equal(rp.patch.totalPrice, 700000);
    // проживание кончилось — нечего менять
    assert.equal(buildPlanSwitch(guest, { plan: 'full', price: 100000, at: new Date(2026, 9, 12) }).mode, 'none');
});

test('новые цены с 01.10: живущие через дату и брони без тарифа', () => {
    const list = [
        { id: 'a', hostelId: 'hostel2', status: 'active', country: 'Узбекистан', checkInDate: '2026-09-28T14:00:00', checkOutDate: '2026-10-04T12:00:00', days: 6, pricePerNight: 65000 },
        { id: 'b', hostelId: 'hostel2', status: 'booking', country: 'Франция', checkInDate: '2026-10-03T14:00:00', checkOutDate: '2026-10-05T12:00:00', days: 2, pricePerNight: 70000 },
        { id: 'c', hostelId: 'hostel2', status: 'active', country: 'Узбекистан', checkInDate: '2026-09-25T14:00:00', checkOutDate: '2026-09-30T12:00:00', days: 5, pricePerNight: 65000 },
        { id: 'd', hostelId: 'hostel2', status: 'active', plan: 'room', checkInDate: '2026-10-01T14:00:00', checkOutDate: '2026-10-04T12:00:00', days: 3, pricePerNight: 80000 },
        { id: 'e', hostelId: 'hostel1', status: 'active', checkInDate: '2026-09-28T14:00:00', checkOutDate: '2026-10-04T12:00:00', days: 6, pricePerNight: 70000 },
        { id: 'f', hostelId: 'hostel2', status: 'active', country: 'Узбекистан', checkInDate: '2026-09-29T14:00:00', checkOutDate: '2026-10-01T12:00:00', days: 2, pricePerNight: 65000 },
    ];
    const c = newPriceCandidates(list, 'hostel2', cfg);
    assert.deepEqual(c.map(x => x.guest.id).sort(), ['a', 'b']);
    const a = c.find(x => x.guest.id === 'a');
    assert.deepEqual([a.passed, a.remaining, a.newPrice, a.extra], [3, 3, 80000, 45000]);
    const b = c.find(x => x.guest.id === 'b');
    assert.deepEqual([b.passed, b.remaining, b.newPrice, b.extra], [0, 2, 105000, 70000]);
});
