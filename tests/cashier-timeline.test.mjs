import test from 'node:test';
import assert from 'node:assert/strict';
import {
    describePayment, purposeText, paymentMethods, buildTimeline, summarizeTimeline, staffKeysOf,
} from '../src/utils/cashierTimeline.js';

const RU = {
    ptCheckin: 'Заселение', ptBooking: 'Предоплата брони', ptExtend: 'Продление', ptPayment: 'Доплата за проживание',
    ptDebt: 'Погашение долга', ptService: 'Услуги', ptRegistration: 'Регистрация e-mehmon', ptBalance: 'Пополнение баланса',
    ptCtt: 'Инкассация', ptReport: 'Запись супера', ptOther: 'Прочее',
    ptPlusDays: '+{n} сут.', ptDays: '{n} сут.', ptUntil: 'до {date}', ptRoom: 'комн. {n}', ptApprox: '(примерно)',
};
const t = (k) => RU[k] ?? k;
const iso = (s) => new Date(s).toISOString();

test('новая оплата продления: «Продление +3 сут. до 28.09 · гость · комната»', () => {
    const p = { amount: 150000, method: 'cash', purpose: 'extend', extendDays: 3, untilDate: iso('2026-09-28T12:00:00'), guestName: 'IVANOV IVAN', roomNumber: '12' };
    const d = describePayment(p);
    assert.equal(d.kind, 'extend');
    assert.equal(purposeText(d, t), 'Продление +3 сут. до 28.09 · IVANOV IVAN · комн. 12');
    assert.equal(purposeText(d, t, { withGuest: false }), 'Продление +3 сут. до 28.09');
});

test('заселение: по назначению и по старой категории accommodation', () => {
    const fresh = describePayment({ category: 'accommodation', purpose: 'checkin', days: 5, untilDate: iso('2026-09-30T12:00:00'), guestName: 'A', roomNumber: '3' });
    assert.equal(purposeText(fresh, t), 'Заселение 5 сут. до 30.09 · A · комн. 3');
    const old = describePayment({ category: 'accommodation', guestName: 'B' }, { days: 4, roomNumber: '7' });
    assert.equal(old.kind, 'checkin');
    assert.equal(old.approx, true, 'сутки взяты из гостя — могли измениться продлением');
    assert.equal(purposeText(old, t), 'Заселение 4 сут. · B · комн. 7 (примерно)');
});

test('старая оплата без назначения рядом с продлением того же кассира → продление (примерно)', () => {
    const guest = { fullName: 'C', roomNumber: '5', lastExtendedAt: iso('2026-09-20T10:00:30'), lastExtendedBy: 'u1',
        pricePerNight: 50000, lastExtensionPrice: 100000, checkOutDate: iso('2026-09-24T12:00:00'), status: 'active' };
    const d = describePayment({ amount: 100000, method: 'cash', staffId: 'u1', date: iso('2026-09-20T10:00:00') }, guest);
    assert.equal(d.kind, 'extend');
    assert.equal(d.days, 2);
    assert.equal(purposeText(d, t), 'Продление +2 сут. до 24.09 · C · комн. 5 (примерно)');
    // другой кассир или далеко по времени — просто доплата
    assert.equal(describePayment({ amount: 1, staffId: 'u2', date: iso('2026-09-20T10:00:00') }, guest).kind, 'payment');
    assert.equal(describePayment({ amount: 1, staffId: 'u1', date: iso('2026-09-20T11:00:00') }, guest).kind, 'payment');
});

test('прочие виды: услуги, регистрация, баланс, инкассация, запись супера, долг после выезда', () => {
    assert.equal(purposeText(describePayment({ category: 'service', comment: 'Кофе ×2', guestName: 'D' }), t), 'Услуги: Кофе ×2 · D');
    assert.equal(describePayment({ category: 'registration' }).kind, 'registration');
    assert.equal(describePayment({ type: 'balance_topup', clientName: 'E' }).kind, 'balance');
    assert.equal(describePayment({ type: 'cash_to_terminal' }).kind, 'ctt');
    assert.equal(describePayment({ reportOnly: true, purpose: 'payment' }).kind, 'report');
    const gone = { status: 'checked_out', checkOutDate: iso('2026-09-01T12:00:00') };
    assert.equal(describePayment({ date: iso('2026-09-05T12:00:00') }, gone).kind, 'debt');
    assert.equal(describePayment({ purpose: 'debt' }).kind, 'debt');
});

test('paymentMethods: запись по способам и одиночная', () => {
    assert.deepEqual(paymentMethods({ amount: 300, cash: 100, card: 200 }), { cash: 100, card: 200, qr: 0, transfer: 0, balance: 0 });
    assert.deepEqual(paymentMethods({ amount: 50, method: 'qr' }), { cash: 0, card: 0, qr: 50, transfer: 0, balance: 0 });
});

test('лента: оплаты прикрепляются к действию, без дублей; фильтр по кассиру и дню', () => {
    const from = new Date(2026, 8, 25).getTime(), to = new Date(2026, 8, 26).getTime();
    const at = (h, m = 0) => new Date(2026, 8, 25, h, m).toISOString();
    const audit = [
        { id: 'a1', action: 'extend', userId: 'u1', userName: 'Кассир', timestamp: at(10), details: { guestName: 'X', days: 3, paymentIds: ['p1', 'p2'] } },
        { id: 'a2', action: 'checkin', userId: 'u1', timestamp: at(9), details: { guestName: 'Y', amount: 100 } }, // старая запись без paymentIds
        { id: 'a3', action: 'expense_add', userId: 'u1', timestamp: at(11), details: {} },                     // берётся из расходов
        { id: 'a4', action: 'checkin', userId: 'u2', timestamp: at(9), details: { guestName: 'Z' } },           // чужой кассир
        { id: 'a5', action: 'login', userId: 'u1', timestamp: new Date(2026, 8, 24, 23).toISOString() },        // другой день
    ];
    const payments = [
        { id: 'p1', staffId: 'u1', amount: 100, method: 'cash', date: at(10) },
        { id: 'p2', staffId: 'login1', amount: 50, method: 'card', date: at(10) },
        { id: 'p3', staffId: 'u1', amount: 100, category: 'accommodation', guestName: 'Y', cash: 100, date: at(9, 1) },
        { id: 'p4', staffId: 'u1', amount: 70, method: 'qr', date: at(12) }, // без действия — отдельной строкой
    ];
    const expenses = [{ id: 'e1', staffId: 'u1', amount: 30, category: 'Хозтовары', date: at(11) }];
    const shifts = [{ id: 's1', staffId: 'u1', startTime: at(8), endTime: at(20) }];
    const keys = staffKeysOf({ id: 'u1', login: 'login1' });
    const ev = buildTimeline({ audit, payments, expenses, shifts, keys, from, to });
    assert.deepEqual(ev.map(e => e.action), ['shift_start', 'checkin', 'extend', 'expense', 'payment_row', 'shift_end']);
    const ext = ev.find(e => e.action === 'extend');
    assert.deepEqual(ext.payments.map(p => p.id), ['p1', 'p2']);
    assert.equal(ext.moneyIn, 150);
    assert.deepEqual(ev.find(e => e.action === 'checkin').payments.map(p => p.id), ['p3']);
    const s = summarizeTimeline(ev);
    assert.equal(s.checkins, 1);
    assert.equal(s.extends, 1);
    assert.equal(s.extendDays, 3);
    assert.equal(s.moneyIn, 320);
    assert.equal(s.moneyOut, 30);
    assert.deepEqual(s.byMethod, { cash: 200, card: 50, qr: 70, transfer: 0, balance: 0 });
    // все сотрудники: попадает и чужое заселение
    assert.equal(buildTimeline({ audit, payments, expenses, shifts, keys: null, from, to }).filter(e => e.action === 'checkin').length, 2);
});

test('лента смены: границы from/to по времени смены', () => {
    const at = (h) => new Date(2026, 8, 25, h).toISOString();
    const payments = [{ id: 'p', staffId: 'u1', amount: 10, date: at(7) }, { id: 'q', staffId: 'u1', amount: 20, date: at(9) }];
    const ev = buildTimeline({ payments, keys: new Set(['u1']), from: at(8), to: at(20) });
    assert.deepEqual(ev.map(e => e.payments[0].id), ['q']);
});

test('открытые смены: только текущая смена каждого кассира, закрытые не видны', async () => {
    const { openShiftTimeline } = await import('../src/utils/cashierTimeline.js');
    const at = (d, h) => new Date(2026, 8, d, h).toISOString();
    const shifts = [
        { id: 'old', staffId: 'u1', startTime: at(24, 8), endTime: at(24, 20) },  // вчерашняя закрытая
        { id: 'cur', staffId: 'u1', startTime: at(25, 8), endTime: null },
        { id: 'b', staffId: 'u2', startTime: at(25, 9), endTime: null },
    ];
    const payments = [
        { id: 'p0', staffId: 'u1', amount: 10, date: at(24, 10) },   // прошлая смена — не видно
        { id: 'p1', staffId: 'u1', amount: 20, date: at(25, 10) },
        { id: 'p2', staffId: 'login2', amount: 30, date: at(25, 11) },
    ];
    const users = [{ id: 'u1', login: 'l1' }, { id: 'u2', login: 'login2' }];
    const all = openShiftTimeline({ payments, shifts, users });
    assert.deepEqual(all.open.map(s => s.id), ['cur', 'b']);
    assert.deepEqual(all.events.filter(e => e.source === 'payment').map(e => e.payments[0].id), ['p1', 'p2']);
    assert.ok(!all.events.some(e => e.id === 's_old' || e.id === 'se_old'));
    const one = openShiftTimeline({ payments, shifts, users, staffKey: 'u2' });
    assert.deepEqual(one.events.filter(e => e.source === 'payment').map(e => e.payments[0].id), ['p2']);
    assert.equal(openShiftTimeline({ payments, shifts: [shifts[0]], users }).events.length, 0);
});

test('итоги без журнала: заселения и продления считаются по назначению оплат, нал+карта одной операции — один раз', () => {
    const d = new Date(2026, 8, 25, 10).toISOString();
    const payments = [
        { id: 'a', staffId: 'u1', amount: 100, method: 'cash', purpose: 'extend', extendDays: 2, guestId: 'g', date: d },
        { id: 'b', staffId: 'u1', amount: 50, method: 'card', purpose: 'extend', extendDays: 2, guestId: 'g', date: d },
        { id: 'c', staffId: 'u1', amount: 70, category: 'accommodation', purpose: 'checkin', guestId: 'h', date: d },
    ];
    const s = summarizeTimeline(buildTimeline({ payments, keys: new Set(['u1']), from: 0, to: null }));
    assert.equal(s.extends, 1);
    assert.equal(s.extendDays, 2);
    assert.equal(s.checkins, 1);
    assert.equal(s._seen, undefined);
});
