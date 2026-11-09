import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanDetails, isFirestoreDead, isNetworkFailure } from '../src/utils/errorSafety.js';

test('isNetworkFailure: обрывы связи из журнала 08.11.2026 — не сбой e-mehmon', () => {
  for (const m of ["ERR_NAME_NOT_RESOLVED (-105) loading 'https://emehmon.uz/listok'",
    "ERR_NETWORK_CHANGED (-21) loading 'https://emehmon.uz/listok'",
    "ERR_INTERNET_DISCONNECTED (-106) loading 'https://emehmon.uz/listok'",
    " (-101) loading 'https://emehmon.uz/listok'"]) {
    assert.equal(isNetworkFailure({ status: 'error', message: m }), true, m);
  }
  assert.equal(isNetworkFailure({ status: 'network' }), true);
});

test('isNetworkFailure: ответы портала и наши статусы — не обрыв', () => {
  assert.equal(isNetworkFailure({ status: 'portal_error', message: 'Ushbu mehmonning allaqachon faol ro‘yxati mavjud' }), false);
  assert.equal(isNetworkFailure({ status: 'submit_unconfirmed' }), false);
  assert.equal(isNetworkFailure({ status: 'timeout', message: 'form did not open' }), false);
  assert.equal(isNetworkFailure(null), false);
});

test('cleanDetails: undefined и функции выкидываются (07.11.2026 — details.exitCode: undefined)', () => {
  assert.deepEqual(cleanDetails({ exitCode: undefined, type: 'crashed', fn: () => 1 }), { type: 'crashed' });
});

test('cleanDetails: числа, строки, null, булевы — как есть; NaN и объекты — строкой', () => {
  assert.deepEqual(cleanDetails({ a: 1, b: 's', c: null, d: false, e: NaN, f: { x: 1 } }),
    { a: 1, b: 's', c: null, d: false, e: 'NaN', f: '{"x":1}' });
});

test('cleanDetails: не объект — пустой объект', () => {
  assert.deepEqual(cleanDetails(undefined), {});
  assert.deepEqual(cleanDetails('text'), {});
});

test('isFirestoreDead: внутренний сбой Firestore узнаётся, прочее — нет', () => {
  const dead = new Error('FIRESTORE (13.2.0) INTERNAL ASSERTION FAILED: Unexpected state (ID: 3c6b) CONTEXT: {"code":"auth/network-request-failed"}');
  assert.equal(isFirestoreDead(dead), true);
  assert.equal(isFirestoreDead(dead.message), true);
  assert.equal(isFirestoreDead(new Error('auth/network-request-failed')), false);
  assert.equal(isFirestoreDead(null), false);
});
