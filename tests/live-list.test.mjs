import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveList, newestFirst, alphabetical, timeKey } from '../src/utils/liveList.js';

const add = (id, data) => ({ type: 'added', id, data });

test('живой список: неизменённые документы сохраняют объект, порядок — новые сверху', () => {
  const apply = createLiveList({ order: newestFirst('checkInDate') });
  const l1 = apply([add('a', { checkInDate: '2026-10-01T12:00:00Z' }), add('b', { checkInDate: '2026-10-05T12:00:00Z' })]);
  assert.deepEqual(l1.map(x => x.id), ['b', 'a']);
  const l2 = apply([{ type: 'modified', id: 'a', data: { checkInDate: '2026-10-01T12:00:00Z', paid: 1 } }]);
  assert.notEqual(l2, l1, 'новый массив');
  assert.equal(l2.find(x => x.id === 'b'), l1.find(x => x.id === 'b'), 'b тот же объект — кэши экранов живы');
  assert.equal(l2.find(x => x.id === 'a').paid, 1);
  assert.equal(apply([]), null, 'снимок без изменений — без перерисовки');
  assert.deepEqual(apply([{ type: 'removed', id: 'b' }]).map(x => x.id), ['a']);
});

test('живой список: первый пустой снимок даёт пустой массив; плохая дата — в конец', () => {
  assert.deepEqual(createLiveList()([]), []);
  const apply = createLiveList({ order: newestFirst('d') });
  assert.deepEqual(apply([add('x', { d: 'мусор' }), add('y', { d: '2026-01-01' })]).map(o => o.id), ['y', 'x']);
  assert.equal(timeKey(null), 0);
});

test('живой список: алфавит без падения на пустом ФИО, extra добавляется', () => {
  const apply = createLiveList({ order: alphabetical('fullName'), extra: { _col: 'auditLog' } });
  const l = apply([add('1', { fullName: 'Борис' }), add('2', {}), add('3', { fullName: 'Анна' })]);
  assert.deepEqual(l.map(o => o.id), ['2', '3', '1']);
  assert.equal(l[0]._col, 'auditLog');
});
