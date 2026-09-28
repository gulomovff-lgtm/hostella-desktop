import test from 'node:test';
import assert from 'node:assert/strict';
import { findReferrer, referrerForCheckin } from '../src/utils/referral.js';

const clients = [
    { id: 'a', fullName: 'ALIEV ALI', refCode: 'R7K4PA', phone: '+998 90 123 45 67', passport: 'AA1111111' },
    { id: 'b', fullName: 'BEKOV BEK', refCode: 'Q2W3E4', phone: '998901112233', passport: 'AB2222222' },
    { id: 'c', fullName: 'DUP ONE', phone: '933334455' },
    { id: 'd', fullName: 'DUP TWO', phone: '+998 93 333 44 55' },
];

test('поиск пригласившего: код, телефон, чужой/свой/неоднозначный', () => {
    assert.equal(findReferrer('', clients).state, 'empty');
    assert.equal(findReferrer('r7k4pa', clients).client.id, 'a');
    assert.equal(findReferrer(' R7K-4PA ', clients).client.id, 'a');
    assert.equal(findReferrer('90 123 45 67', clients).client.id, 'a');
    assert.equal(findReferrer('+998901112233', clients).client.id, 'b');
    assert.equal(findReferrer('ZZZZZZ', clients).state, 'bad');
    assert.equal(findReferrer('933334455', clients).state, 'ambiguous');
    assert.equal(findReferrer('R7K4PA', clients, 'AA 1111111').state, 'self');
});

test('пригласивший при заселении: только новый клиент; у приглашённого — навсегда тот же', () => {
    assert.equal(referrerForCheckin(null, 'a', clients, 'XX0000000'), 'a');
    assert.equal(referrerForCheckin(null, 'a', clients, 'AA1111111'), null, 'сам себя');
    assert.equal(referrerForCheckin(null, 'zzz', clients, 'XX'), null);
    assert.equal(referrerForCheckin({ id: 'x', referredBy: null }, 'a', clients, 'XX'), null, 'старый клиент — нельзя');
    assert.equal(referrerForCheckin({ id: 'x', referredBy: 'b' }, 'a', clients, 'XX'), 'b', 'уже приглашённый — прежний пригласивший');
});
