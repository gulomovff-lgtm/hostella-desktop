import test from 'node:test';
import assert from 'node:assert/strict';
import {
    paymentSplit, splitTotal, editableReason, buildPaymentFields,
    guestDeltas, validatePaymentInput, searchGuests,
} from '../src/utils/paymentEdit.js';

test('paymentSplit: запись из карточки раскладывается по способу, запись заселения — по своим полям', () => {
    assert.deepEqual(paymentSplit({ amount: 70000, method: 'card' }), { cash: 0, card: 70000, qr: 0, transfer: 0, balance: 0 });
    assert.deepEqual(paymentSplit({ amount: 100000, method: 'split', cash: 60000, card: 40000 }), { cash: 60000, card: 40000, qr: 0, transfer: 0, balance: 0 });
    assert.equal(paymentSplit({ amount: 5, method: 'нечто' }).cash, 5, 'неизвестный способ — наличные');
    assert.equal(splitTotal(paymentSplit({ amount: 100000, cash: 60000, qr: 40000 })), 100000);
});

test('buildPaymentFields: формат обычной оплаты; видимых пометок нет, только скрытый reportOnly у новой записи', () => {
    const f = buildPaymentFields({ guestId: 'g1', staffId: 'u1', amount: '70000', method: 'qr', date: '2026-09-20T10:00:00.000Z', hostelId: 'hostel1' });
    assert.deepEqual(Object.keys(f).sort(), ['amount', 'date', 'guestId', 'hostelId', 'method', 'reportOnly', 'staffId']);
    assert.equal(f.reportOnly, true);
    assert.equal(buildPaymentFields({ guestId: 'g1', staffId: 'u1', amount: 1, method: 'cash', date: 'x', hostelId: 'h' }, { amount: 1 }).reportOnly, undefined,
        'исправление записи кассы не превращает её в поправку отчёта');
    assert.equal(f.amount, 70000);
    for (const k of Object.keys(f)) assert.ok(!/super|manual|edited|admin|mark/i.test(k), `поле-пометка ${k}`);
});

test('buildPaymentFields: у записи заселения разложение переписывается под новый способ', () => {
    const f = buildPaymentFields({ guestId: 'g1', staffId: 'u1', amount: 90000, method: 'card', date: 'x', hostelId: 'h' },
        { cash: 60000, card: 40000, qr: 0, transfer: 0, balance: 0 });
    assert.deepEqual([f.cash, f.card, f.qr, f.transfer, f.balance], [0, 90000, 0, 0, 0]);
});

test('guestDeltas: добавленная супером запись (reportOnly) деньги гостя не двигает — ни при добавлении, ни при правке', () => {
    const added = buildPaymentFields({ guestId: 'g1', staffId: 'u1', amount: 70000, method: 'cash', date: 'x', hostelId: 'h' });
    assert.deepEqual(guestDeltas(null, added), {});
    assert.deepEqual(guestDeltas(added, { ...added, amount: 90000, guestId: 'g2' }), {});
});

test('guestDeltas: исправление обычной оплаты кассы — сумма и способ, перенос на другого гостя', () => {
    assert.deepEqual(guestDeltas(null, { guestId: 'g1', amount: 70000, method: 'cash' }), { g1: { paidCash: 70000, amountPaid: 70000 } });
    assert.deepEqual(guestDeltas({ guestId: 'g1', amount: 70000, method: 'cash' }, { guestId: 'g1', amount: 50000, method: 'card' }),
        { g1: { paidCash: -70000, paidCard: 50000, amountPaid: -20000 } });
    assert.deepEqual(guestDeltas({ guestId: 'g1', amount: 70000, method: 'cash' }, { guestId: 'g2', amount: 70000, method: 'cash' }),
        { g1: { paidCash: -70000, amountPaid: -70000 }, g2: { paidCash: 70000, amountPaid: 70000 } });
    assert.deepEqual(guestDeltas({ guestId: 'g1', amount: 70000, method: 'cash' }, { guestId: 'g1', amount: 70000, method: 'cash' }), {}, 'без изменений — гостя не трогаем');
});

test('удаление записи-поправки (reportOnly) не снимает деньги с гостя', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../src/hooks/useExpenseActions.js', import.meta.url), 'utf8');
    const line = src.split(/\r?\n/).find(l => l.includes('const touchesGuest ='));
    assert.ok(line && line.includes('!p.reportOnly'), 'удаление должно пропускать гостя у reportOnly');
    assert.ok(line.includes("p.category !== 'service'"), 'продажа «сразу» тоже не трогает деньги гостя за проживание');
});

test('editableReason: инкассация, регистрация и оплата с баланса этим окном не правятся', () => {
    assert.equal(editableReason({ type: 'cash_to_terminal' }), 'ctt');
    assert.equal(editableReason({ category: 'registration' }), 'registration');
    assert.equal(editableReason({ balance: 5000 }), 'balance');
    assert.equal(editableReason({ amount: 1, method: 'cash', guestId: 'g' }), '');
});

test('validatePaymentInput: обязательные поля и запрет будущего', () => {
    const ok = { guestId: 'g', staffId: 'u', amount: 1000, date: '2026-09-20T10:00', hostelId: 'hostel1' };
    assert.equal(validatePaymentInput(ok), '');
    assert.equal(validatePaymentInput({ ...ok, guestId: '' }), 'guest');
    assert.equal(validatePaymentInput({ ...ok, staffId: '' }), 'staff');
    assert.equal(validatePaymentInput({ ...ok, amount: 0 }), 'amount');
    assert.equal(validatePaymentInput({ ...ok, date: 'x' }), 'date');
    assert.equal(validatePaymentInput({ ...ok, date: new Date(Date.now() + 86400000).toISOString() }), 'future');
});

test('searchGuests: по ФИО, паспорту с пробелами и комнате; активные выше; филиал и долговые записи отсекаются', () => {
    const gs = [
        { id: 'a', fullName: 'IVANOV IVAN', passport: 'AB1234567', roomNumber: '3', status: 'checked_out', checkInDate: '2026-09-01', hostelId: 'hostel1' },
        { id: 'b', fullName: 'IVANOVA ANNA', passport: 'AC7654321', roomNumber: '5', status: 'active', checkInDate: '2026-09-10', hostelId: 'hostel1' },
        { id: 'c', fullName: 'IVANOV OLEG', passport: 'X1', roomNumber: '3', status: 'active', hostelId: 'hostel2' },
        { id: 'd', fullName: 'IVANOV DEBT', roomId: 'DEBT_ONLY', status: 'active', hostelId: 'hostel1' },
    ];
    assert.deepEqual(searchGuests(gs, 'ivanov', { hostelId: 'hostel1' }).map(g => g.id), ['b', 'a']);
    assert.deepEqual(searchGuests(gs, 'AB 123', { hostelId: 'hostel1' }).map(g => g.id), ['a']);
    assert.deepEqual(searchGuests(gs, '3').map(g => g.id), ['c', 'a']);
});
