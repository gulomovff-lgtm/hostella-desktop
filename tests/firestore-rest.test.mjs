import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeValue, decodeDocument, matchesKeep, pageQuery, pageDocuments } from '../src/utils/firestoreRest.js';

test('значения REST разбираются в обычные', () => {
  assert.equal(decodeValue({ stringValue: 'а' }), 'а');
  assert.equal(decodeValue({ integerValue: '300000' }), 300000);
  assert.equal(decodeValue({ doubleValue: 1.5 }), 1.5);
  assert.equal(decodeValue({ booleanValue: false }), false);
  assert.equal(decodeValue({ nullValue: null }), null);
  assert.equal(decodeValue({ timestampValue: '2026-11-05T10:00:00Z' }), '2026-11-05T10:00:00Z');
  assert.deepEqual(decodeValue({ arrayValue: { values: [{ integerValue: '1' }, { stringValue: 'x' }] } }), [1, 'x']);
  assert.deepEqual(decodeValue({ arrayValue: {} }), []);
  assert.deepEqual(decodeValue({ mapValue: { fields: { a: { mapValue: { fields: { b: { booleanValue: true } } } } } } }), { a: { b: true } });
  assert.deepEqual(decodeValue({ mapValue: {} }), {});
});

test('документ: id из полного имени, поля разобраны', () => {
  const d = decodeDocument({ name: 'projects/p/databases/d/documents/a/b/guests/g1', fields: { fullName: { stringValue: 'Анна' }, totalPrice: { integerValue: '5' } } });
  assert.deepEqual(d, { id: 'g1', fullName: 'Анна', totalPrice: 5 });
  assert.deepEqual(decodeDocument({ name: 'x/y/z' }), { id: 'z' });
});

test('страница: порядок по имени, продолжение после последнего документа', () => {
  assert.equal(pageQuery('guests', 10).structuredQuery.startAt, undefined);
  const q = pageQuery('guests', 10, 'x/y/g9').structuredQuery;
  assert.deepEqual(q.from, [{ collectionId: 'guests' }]);
  assert.equal(q.limit, 10);
  assert.deepEqual(q.startAt, { values: [{ referenceValue: 'x/y/g9' }], before: false });
});

test('ответ: служебные строки пропускаются, ошибка сервера не молчит', () => {
  assert.deepEqual(pageDocuments([{ readTime: 't' }, { document: { name: 'a' } }]), [{ name: 'a' }]);
  assert.throws(() => pageDocuments({ error: { code: 403 } }), /403/);
});

test('отбор окна: подходит хотя бы одно условие', () => {
  const keep = [{ field: 'status', in: ['active'] }, { field: 'checkOutDate', gte: '2026-09-01' }];
  assert.equal(matchesKeep({ status: 'active', checkOutDate: '2026-01-01' }, keep), true);
  assert.equal(matchesKeep({ status: 'checked_out', checkOutDate: '2026-10-01' }, keep), true);
  assert.equal(matchesKeep({ status: 'checked_out', checkOutDate: '2026-01-01' }, keep), false);
  assert.equal(matchesKeep({ status: 'checked_out' }, keep), false);
  assert.equal(matchesKeep({ endTime: null }, [{ field: 'endTime', isNull: true }]), true);
  assert.equal(matchesKeep({}, [{ field: 'endTime', isNull: true }]), false);
  assert.equal(matchesKeep({ a: 1 }, null), true);
});
