import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanDetails, isFirestoreDead } from '../src/utils/errorSafety.js';

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
