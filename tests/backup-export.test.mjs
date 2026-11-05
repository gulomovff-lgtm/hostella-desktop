import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BACKUP_COLLS, BACKUP_VERSION, collectBackup, isCompleteBackup } from '../src/utils/backupExport.js';

const reader = (sizes = {}) => async (name) =>
  Array.from({ length: sizes[name] ?? 1 }, (_, i) => ({ id: `${name}${i}`, pass: 'hash' }));

test('копия содержит всё, что вернуло чтение, и отметку полноты', async () => {
  const b = await collectBackup(reader({ guests: 3640, payments: 8186 }), { exportedBy: 'admin', now: new Date('2026-11-05T10:00:00Z') });
  assert.equal(b.data.guests.length, 3640);
  assert.equal(b.data.payments.length, 8186);
  assert.equal(b.stats.payments, 8186);
  assert.deepEqual(Object.keys(b.data), BACKUP_COLLS);
  assert.equal(b.version, BACKUP_VERSION);
  assert.equal(b.exportedAt, '2026-11-05T10:00:00.000Z');
  assert.ok(isCompleteBackup(b));
});

test('сбой чтения любой коллекции отменяет копию: неполного файла нет', async () => {
  let progressCalls = 0;
  const failing = async (name) => {
    if (name === 'payments') throw new Error('unavailable');
    return [{ id: 'x' }];
  };
  await assert.rejects(collectBackup(failing, { onProgress: () => { progressCalls += 1; } }), /unavailable/);
  assert.equal(progressCalls, BACKUP_COLLS.indexOf('payments'));
});

test('прогресс идёт по коллекциям и показывает счётчики', async () => {
  const seen = [];
  await collectBackup(reader({ rooms: 5 }), { onProgress: p => seen.push(p) });
  assert.equal(seen.length, BACKUP_COLLS.length);
  assert.deepEqual(seen.map(p => p.done), BACKUP_COLLS.map((_, i) => i + 1));
  assert.ok(seen.every(p => p.total === BACKUP_COLLS.length && p.counts.rooms === 5));
});

test('пароли сотрудников в файл не попадают, у остальных поле не трогаем', async () => {
  const b = await collectBackup(reader());
  assert.equal(b.data.users[0].pass, '***');
  assert.equal(b.data.guests[0].pass, 'hash');
});

test('старая копия без отметки считается возможно неполной', () => {
  assert.equal(isCompleteBackup({ version: '1.0', data: {} }), false);
  assert.equal(isCompleteBackup({ guests: [] }), false);
  assert.equal(isCompleteBackup(null), false);
});

test('экран настроек читает базу с сервера, а не из списков-окна и не из кэша', () => {
  const src = readFileSync(new URL('../src/components/Views/HostelSettingsView.jsx', import.meta.url), 'utf8');
  assert.match(src, /from 'firebase\/firestore\/lite'/);
  assert.match(src, /await liteGetDocs\(/);
  assert.doesNotMatch(src, /[^e]getDocs\(|getDocsFromServer\(/);
  assert.doesNotMatch(src, /(payments|expenses|shifts)\s*\|\|\s*\[\]/);
});

test('восстановление: только дополнение по id, сотрудники и удаление исключены', () => {
  const src = readFileSync(new URL('../src/components/Views/HostelSettingsView.jsx', import.meta.url), 'utf8');
  const colls = src.match(/RESTORE_COLLS = \[([^\]]*)\]/)[1];
  assert.doesNotMatch(colls, /users/);
  assert.match(src, /batch\.set\([^\n]*\{ merge: true \}\)/);
  assert.doesNotMatch(src, /batch\.delete/);
});
