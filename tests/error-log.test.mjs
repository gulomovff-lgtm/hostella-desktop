import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dayKey, normalizeMessage, errorDocId } from '../src/utils/errorKey.js';

const require = createRequire(import.meta.url);
const server = require('../functions/lib/errorLog.js');

test('журнал ошибок: числа в тексте не делят одну ошибку на разные строки', () => {
  const d = new Date(2026, 9, 29, 12);
  assert.equal(errorDocId('emehmon', 'emehmon.arrival', 'portal_error: гость 12 в комнате 5', d),
               errorDocId('emehmon', 'emehmon.arrival', 'portal_error: гость 15 в комнате 7', d));
  assert.notEqual(errorDocId('emehmon', 'emehmon.arrival', 'portal_error', d),
                  errorDocId('emehmon', 'emehmon.depart', 'portal_error', d));
  assert.ok(errorDocId('sync', 'x', 'y', d).startsWith('2026-10-29_sync_'));
  assert.equal(normalizeMessage('  «Ошибка»   400 '), 'Ошибка #');
});

test('журнал ошибок: программа и сервер считают ключ строки одинаково', () => {
  const d = new Date(2026, 9, 29, 12);
  const day = dayKey(d);
  for (const [k, c, m] of [['telegram', 'telegram.recipient', '400 — Bad Request: chat not found'], ['function', 'backup', 'PERMISSION_DENIED']]) {
    assert.equal(server.errorDocId(k, c, m, day), errorDocId(k, c, m, d));
  }
});

test('журнал ошибок: день сервера — по Ташкенту', () => {
  assert.equal(server.dayKeyTashkent(new Date('2026-10-29T18:59:00Z')), '2026-10-29');
  assert.equal(server.dayKeyTashkent(new Date('2026-10-29T19:01:00Z')), '2026-10-30');
});

test('вечерняя сводка: пусто — без сообщения; виды по порядку, повторы суммируются', () => {
  assert.equal(server.digestText([], '2026-10-29', server.ERROR_KINDS), null);
  const text = server.digestText([
    { kind: 'telegram', message: '400 — chat not found', count: 5 },
    { kind: 'emehmon', message: 'portal_error: x', count: 3 },
    { kind: 'emehmon', message: 'timeout', count: 1 },
  ], '2026-10-29', server.ERROR_KINDS);
  assert.match(text, /9 раз, 3 видов/);
  assert.ok(text.indexOf('e-mehmon') < text.indexOf('Telegram'));
  assert.match(text, /<b>e-mehmon<\/b> · 4/);
});
