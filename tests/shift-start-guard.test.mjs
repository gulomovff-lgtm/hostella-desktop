// Смены (14.11.2026): с 06.11 при каждом входе и обновлении кассиру
// открывалась новая смена — список смен сначала приходил с диска без
// открытых. Сторож: перед открытием — проверка на сервере, свой замок не
// даёт второй смены, без связи — только тогда открываем без транзакции.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/hooks/useShiftActions.js', import.meta.url), 'utf8');
const start = src.slice(src.indexOf('const handleStartShift'), src.indexOf('const handleEndShift'));

test('открытие смены: сначала спрашиваем сервер, нет ли своей открытой', () => {
  assert.match(start, /getDocsFromServer\(q\)/);
  assert.match(start, /where\('endTime', '==', null\)/);
  assert.ok(start.indexOf('getDocsFromServer') < start.indexOf('runTransaction'), 'проверка — до транзакции');
});

test('свой замок на открытую смену — вторую не создаём', () => {
  assert.match(start, /isSameStaff\(lock, me\(\)\)\) \{\s*const mineSnap/);
  assert.match(start, /SHIFT_ALREADY_OPEN/);
});

test('без транзакции смену открываем только без связи', () => {
  assert.match(start, /const offline = /);
  assert.ok(start.indexOf('if (!offline)') < start.indexOf('addDoc(collection(db, ...PUBLIC_DATA_PATH, \'shifts\')'));
});
