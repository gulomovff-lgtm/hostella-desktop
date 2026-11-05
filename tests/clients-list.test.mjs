import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createClientsList, isClientsBaseStale, CLIENTS_REFRESH_MS } from '../src/utils/clientsList.js';

const names = (list) => list.map((c) => c.fullName);

test('база сортируется по алфавиту', () => {
  const s = createClientsList();
  assert.deepEqual(names(s.setBase([{ id: '1', fullName: 'Яков' }, { id: '2', fullName: 'Анна' }])), ['Анна', 'Яков']);
});

test('изменение сильнее базы и переживает её перечитывание', () => {
  const s = createClientsList();
  s.setBase([{ id: '1', fullName: 'Анна', balance: 0 }]);
  s.applyDelta([{ type: 'modified', id: '1', data: { fullName: 'Анна', balance: 500 } }]);
  assert.equal(s.list()[0].balance, 500);
  // база прочитана раньше, чем пришло изменение
  s.setBase([{ id: '1', fullName: 'Анна', balance: 0 }]);
  assert.equal(s.list()[0].balance, 500);
});

test('новый клиент с другой кассы появляется, удалённый исчезает', () => {
  const s = createClientsList();
  s.setBase([{ id: '1', fullName: 'Анна' }]);
  s.applyDelta([{ type: 'added', id: '2', data: { fullName: 'Борис' } }]);
  assert.deepEqual(names(s.list()), ['Анна', 'Борис']);
  s.applyDelta([{ type: 'removed', id: '2' }]);
  assert.deepEqual(names(s.list()), ['Анна']);
  // старая база не возвращает удалённого
  s.setBase([{ id: '1', fullName: 'Анна' }, { id: '2', fullName: 'Борис' }]);
  assert.deepEqual(names(s.list()), ['Анна']);
});

test('запись, которой нет в новой базе, исчезает', () => {
  const s = createClientsList();
  s.setBase([{ id: '1', fullName: 'Анна' }, { id: '2', fullName: 'Борис' }]);
  assert.deepEqual(names(s.setBase([{ id: '1', fullName: 'Анна' }])), ['Анна']);
});

test('неизменённая запись сохраняет объект при перечитывании', () => {
  const s = createClientsList();
  const before = s.setBase([{ id: '1', fullName: 'Анна' }, { id: '2', fullName: 'Борис' }]);
  const after = s.setBase([{ id: '1', fullName: 'Анна' }, { id: '2', fullName: 'Борис', phone: '1' }]);
  assert.equal(after[0], before[0]);
  assert.notEqual(after[1], before[1]);
});

test('пустой снимок изменений не даёт нового списка', () => {
  assert.equal(createClientsList().applyDelta([]), null);
});

test('база устаревает через сутки, отсутствие чтения — тоже устарела', () => {
  assert.equal(isClientsBaseStale(0), true);
  assert.equal(isClientsBaseStale(1000, 1000 + CLIENTS_REFRESH_MS - 1), false);
  assert.equal(isClientsBaseStale(1000, 1000 + CLIENTS_REFRESH_MS), true);
});

// Запись без clientStamp другие кассы увидят только через сутки — сторож на все места.
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : /\.jsx?$/.test(f) ? [p] : [];
});

test('каждая запись в клиента ставит clientStamp', () => {
  const missing = [];
  for (const file of walk('src')) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      const isWrite = /\b(updateDoc|addDoc|setDoc|\w+\.(update|set))\(.*'clients'/.test(line);
      if (isWrite && !lines.slice(i, i + 6).join(' ').includes('clientStamp()')) missing.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(missing, []);
});
