import test from 'node:test';
import assert from 'node:assert/strict';
import {
    chargeOf, stockOf, buildLines, linesTotal, stockShortages, linesComment,
    validateSale, canCancelSale, guestSales, accountTotal, validateItem, salesSummary, CASHIER_CANCEL_MS,
    PAY_METHODS, splitError, salePaymentFields,
} from '../src/utils/shop.js';

const catalog = [
    { id: 'wash', name: 'Стирка', kind: 'service', price: 20000 },
    { id: 'cola', name: 'Кола 0,5', kind: 'product', price: 8000, stock: { hostel1: 5, hostel2: 0 } },
    { id: 'old', name: 'Старое', kind: 'service', price: 1000, active: false },
];

test('chargeOf: проживание + услуги в счёт; пустые поля — ноль', () => {
    assert.equal(chargeOf({ totalPrice: 350000, servicesTotal: 28000 }), 378000);
    assert.equal(chargeOf({ totalPrice: 350000 }), 350000);
    assert.equal(chargeOf(null), 0);
});

test('buildLines: цена из справочника, ручная услуга со своей ценой, мусор и неактивные отбрасываются', () => {
    const lines = buildLines([
        { itemId: 'wash', qty: 1, price: 1 },          // подменённая цена игнорируется
        { itemId: 'cola', qty: 2 },
        { itemId: 'old', qty: 1 },                      // неактивна
        { itemId: 'nope', qty: 1 },
        { name: ' Глажка ', price: 15000, qty: 1 },
        { name: '', price: 5000, qty: 1 },
        { name: 'Бесплатно', price: 0, qty: 1 },
        { itemId: 'wash', qty: 0 },
    ], catalog);
    assert.deepEqual(lines.map(l => [l.name, l.qty, l.price, l.sum, l.kind]), [
        ['Стирка', 1, 20000, 20000, 'service'],
        ['Кола 0,5', 2, 8000, 16000, 'product'],
        ['Глажка', 1, 15000, 15000, 'service'],
    ]);
    assert.equal(lines[2].manual, true);
    assert.equal(linesTotal(lines), 51000);
    assert.equal(linesComment(lines), 'Стирка, Кола 0,5 ×2, Глажка');
});

test('stockShortages / stockOf: остаток по филиалу, повторы позиции суммируются', () => {
    assert.equal(stockOf(catalog[1], 'hostel1'), 5);
    assert.equal(stockOf(catalog[1], 'hostel3'), 0);
    const lines = buildLines([{ itemId: 'cola', qty: 4 }, { itemId: 'cola', qty: 2 }], catalog);
    assert.deepEqual(stockShortages(lines, catalog, 'hostel1'), [{ itemId: 'cola', name: 'Кола 0,5', need: 6, have: 5 }]);
    assert.deepEqual(stockShortages(buildLines([{ itemId: 'cola', qty: 5 }], catalog), catalog, 'hostel1'), []);
    assert.equal(stockShortages(buildLines([{ itemId: 'cola', qty: 1 }], catalog), catalog, 'hostel2').length, 1);
});

test('validateSale: пусто, филиал, «в счёт» без гостя, способ оплаты, нехватка', () => {
    const lines = buildLines([{ itemId: 'wash', qty: 1 }], catalog);
    const ok = { lines, hostelId: 'hostel1', guestId: 'g1', mode: 'account', catalog };
    assert.equal(validateSale(ok), '');
    assert.equal(validateSale({ ...ok, lines: [] }), 'empty');
    assert.equal(validateSale({ ...ok, hostelId: 'all' }), 'hostel');
    assert.equal(validateSale({ ...ok, guestId: '' }), 'walkin_account');
    assert.equal(validateSale({ ...ok, guestId: '', mode: 'paid' }), 'method');
    assert.equal(validateSale({ ...ok, guestId: '', mode: 'paid', method: 'cash' }), '', 'с улицы — только сразу');
    assert.equal(validateSale({ ...ok, lines: buildLines([{ itemId: 'cola', qty: 9 }], catalog) }), 'stock');
});

test('canCancelSale: админ и супер всегда; кассир — свою и в течение двух часов', () => {
    const now = Date.parse('2026-09-25T12:00:00Z');
    const sale = { staffId: 'u1', date: '2026-09-25T11:00:00Z', status: 'active' };
    assert.equal(canCancelSale(sale, { role: 'cashier', id: 'u1' }, now), true);
    assert.equal(canCancelSale(sale, { role: 'cashier', id: 'u2' }, now), false);
    assert.equal(canCancelSale({ ...sale, date: new Date(now - CASHIER_CANCEL_MS - 1000).toISOString() }, { role: 'cashier', id: 'u1' }, now), false);
    assert.equal(canCancelSale({ ...sale, staffId: 'x' }, { role: 'admin' }, now), true);
    assert.equal(canCancelSale({ ...sale, status: 'cancelled' }, { role: 'super' }, now), false);
});

test('guestSales / accountTotal / salesSummary: отменённые не считаются', () => {
    const sales = [
        { guestId: 'g1', mode: 'account', total: 20000, date: '2026-09-24', status: 'active', items: [{ itemId: 'wash', name: 'Стирка', qty: 1, sum: 20000 }] },
        { guestId: 'g1', mode: 'paid', total: 16000, date: '2026-09-25', status: 'active', items: [{ itemId: 'cola', name: 'Кола', qty: 2, sum: 16000 }] },
        { guestId: 'g1', mode: 'account', total: 9999, date: '2026-09-25', status: 'cancelled', items: [] },
        { guestId: null, mode: 'paid', total: 8000, date: '2026-09-25', status: 'active', items: [{ itemId: 'cola', name: 'Кола', qty: 1, sum: 8000 }] },
    ];
    assert.deepEqual(guestSales(sales, 'g1').map(s => s.total), [16000, 20000]);
    assert.equal(accountTotal(guestSales(sales, 'g1')), 20000);
    const sum = salesSummary(sales);
    assert.deepEqual([sum.paid, sum.account, sum.total, sum.count], [24000, 20000, 44000, 3]);
    assert.deepEqual(sum.items.map(i => [i.name, i.qty, i.sum]), [['Кола', 3, 24000], ['Стирка', 1, 20000]]);
});

test('способы оплаты продажи: без перевода, с миксом', () => {
    assert.deepEqual(PAY_METHODS, ['cash', 'card', 'qr', 'mix']);
});

test('микс: части должны сойтись с итогом, частей — не меньше двух', () => {
    assert.equal(splitError({ cash: 30000, card: 20000 }, 50000), '');
    assert.equal(splitError({ cash: 30000, card: 10000 }, 50000), 'split_sum');
    assert.equal(splitError({ cash: 50000 }, 50000), 'split_parts');
    assert.equal(splitError({ cash: -1, card: 50001 }, 50000), 'split_sum');
    const lines = buildLines([{ itemId: 'wash', qty: 1 }], catalog);
    assert.equal(validateSale({ lines, hostelId: 'hostel1', mode: 'paid', method: 'mix', split: { cash: 10000, qr: 5000 }, catalog }), 'split_sum');
    assert.equal(validateSale({ lines, hostelId: 'hostel1', mode: 'paid', method: 'mix', split: { cash: 10000, qr: 10000 }, catalog }), '');
});

test('salePaymentFields: касса получает разложение как у оплат заселения', () => {
    assert.deepEqual(salePaymentFields(50000, 'mix', { cash: 30000, card: 20000 }), { amount: 50000, cash: 30000, card: 20000, qr: 0, method: 'split' });
    assert.deepEqual(salePaymentFields(8000, 'qr'), { amount: 8000, cash: 0, card: 0, qr: 8000, method: 'qr' });
});

test('validateItem: название, вид, цена', () => {
    assert.equal(validateItem({ name: 'Завтрак', kind: 'service', price: 25000 }), '');
    assert.equal(validateItem({ name: ' ', kind: 'service', price: 1 }), 'name');
    assert.equal(validateItem({ name: 'X', kind: 'other', price: 1 }), 'kind');
    assert.equal(validateItem({ name: 'X', kind: 'product', price: 0 }), 'price');
});
