import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ignoreKey, isEmehmonHidden } from '../src/utils/emehmonHidden.js';

const doc = {
  hostel1: { AB1234567: { name: 'Ivanov' }, 'N:ALIEVVALI': { name: 'Aliev Vali' } },
  hostel2: { CD7654321: { name: 'Petrov' } },
};

test('ключ: паспорт без пробелов в верхнем регистре, без паспорта — имя', () => {
  assert.equal(ignoreKey({ passport: 'ab 1234567', fullName: 'X' }), 'AB1234567');
  assert.equal(ignoreKey({ name: 'Aliev  Vali' }), 'N:ALIEVVALI');
  assert.equal(ignoreKey({}), '');
});

test('скрыт по паспорту — гость программы и строка портала одинаково', () => {
  assert.equal(isEmehmonHidden(doc, 'hostel1', { passport: 'AB 1234567', fullName: 'Ivanov I' }), true);
  assert.equal(isEmehmonHidden(doc, 'hostel1', { passport: 'ab1234567', name: 'IVANOV' }), true);
});

test('скрытая строка без паспорта находит гостя по имени', () => {
  assert.equal(isEmehmonHidden(doc, 'hostel1', { passport: 'ZZ0000001', fullName: 'Aliev Vali' }), true);
});

test('скрыт только в своём филиале', () => {
  assert.equal(isEmehmonHidden(doc, 'hostel2', { passport: 'AB1234567' }), false);
  assert.equal(isEmehmonHidden(doc, 'hostel2', { passport: 'CD7654321' }), true);
  assert.equal(isEmehmonHidden(doc, undefined, { passport: 'AB1234567' }), true, 'без филиала — первый');
});

test('пустой документ и пустой гость — не скрыт', () => {
  assert.equal(isEmehmonHidden(null, 'hostel1', { passport: 'AB1234567' }), false);
  assert.equal(isEmehmonHidden({}, 'hostel1', { passport: 'AB1234567' }), false);
  assert.equal(isEmehmonHidden(doc, 'hostel1', null), false);
  assert.equal(isEmehmonHidden(doc, 'hostel1', { passport: 'XX1' }), false);
});
