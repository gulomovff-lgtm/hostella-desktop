import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../functions/referral.js');

const S = { active: true, ratePerNight: 5000, maxNightsPerStay: 0 };
const DAY = 86400000;

test('коды и телефоны', () => {
    const c = R.genRefCode(() => 0.5);
    assert.equal(c.length, 6);
    assert.ok([...c].every(ch => R.REF_ALPHABET.includes(ch)));
    assert.equal(R.normCode(' r7k-4p '), 'R7K4P');
    assert.equal(R.normPhone('+998 90 123-45-67'), '901234567');
    assert.equal(R.normPhone('901234567'), '901234567');
    assert.equal(R.normPhone('12345'), '');
});

test('имя в боте скрыто: «Ivan I.»', () => {
    assert.equal(R.maskName('IVANOV IVAN IVANOVICH'), 'Ivan I.');
    assert.equal(R.maskName('KARIMOV JASUR'), 'Jasur K.');
    assert.equal(R.maskName('MADONNA'), 'Madonna');
    assert.equal(R.maskName(''), '—');
});

test('ночи: живёт — сколько прошло (не больше оплаченных дней), выехал — по счёту', () => {
    const now = Date.UTC(2026, 8, 28, 12);
    const ci = new Date(now - 2.5 * DAY).toISOString();
    assert.equal(R.nightsOf({ status: 'active', checkInDate: ci, days: 10 }, now), 3);
    assert.equal(R.nightsOf({ status: 'active', checkInDate: ci, days: 2 }, now), 2);
    assert.equal(R.nightsOf({ status: 'checked_out', days: 7 }, now), 7);
    assert.equal(R.nightsOf({ status: 'booking', days: 7 }, now), 0);
});

test('бонус: ставка × ночи, потолок ночей', () => {
    assert.deepEqual(R.bonusFor(7, S), { nights: 7, amount: 35000, rate: 5000 });
    assert.deepEqual(R.bonusFor(40, { ...S, maxNightsPerStay: 30 }), { nights: 30, amount: 150000, rate: 5000 });
});

test('начисление: только выехал, без долга, один раз, программа включена', () => {
    const g = { referrerClientId: 'c1', status: 'checked_out', days: 4, totalPrice: 200000, amountPaid: 200000 };
    assert.deepEqual(R.creditDecision(g, S), { nights: 4, amount: 20000, rate: 5000 });
    assert.equal(R.creditDecision({ ...g, amountPaid: 150000 }, S), null, 'долг');
    assert.equal(R.creditDecision({ ...g, servicesTotal: 30000 }, S), null, 'долг за услуги');
    assert.equal(R.creditDecision({ ...g, status: 'active' }, S), null, 'ещё живёт');
    assert.equal(R.creditDecision({ ...g, refBonusCredited: 20000 }, S), null, 'уже начислено');
    assert.equal(R.creditDecision({ ...g, referrerClientId: null }, S), null);
    assert.equal(R.creditDecision(g, { ...S, active: false }), null);
    assert.equal(R.creditDecision({ ...g, refBonusCredited: 0 }, S), null, '0 — тоже «уже решено»');
});

test('кабинет: состояния, суммы, скрытые имена', () => {
    const now = Date.UTC(2026, 8, 28, 12);
    const cab = R.buildCabinet({
        client: { fullName: 'ALIEV ALI', refCode: 'R7K4PA', balance: 45000 },
        referees: [
            { fullName: 'IVANOV IVAN', status: 'checked_out', days: 4, refBonusCredited: 20000, checkInDate: '2026-09-01' },
            { fullName: 'KARIMOV JASUR', status: 'active', days: 10, checkInDate: new Date(now - 1.5 * DAY).toISOString() },
            { fullName: 'SMITH JOHN', status: 'checked_out', days: 3, totalPrice: 150000, amountPaid: 100000, checkInDate: '2026-09-10' },
            { fullName: 'BOOKED ONE', status: 'booking', days: 3, checkInDate: '2026-10-01' },
        ],
        ledger: [{ date: '2026-09-05', amount: 20000, type: 'accrual', guestName: 'Ivan I.' }],
        settings: S, now,
    });
    assert.equal(cab.referees.length, 3, 'бронь не показываем');
    const by = Object.fromEntries(cab.referees.map(r => [r.name, r]));
    assert.equal(by['Ivan I.'].state, 'credited');
    assert.equal(by['Jasur K.'].state, 'living');
    assert.equal(by['Jasur K.'].nights, 2);
    assert.equal(by['Jasur K.'].amount, 10000);
    assert.equal(by['John S.'].state, 'debt');
    assert.equal(cab.totals.credited, 20000);
    assert.equal(cab.totals.pending, 10000 + 15000);
    assert.equal(cab.balance, 45000);
    assert.equal(cab.ledger[0].amount, 20000);
});
