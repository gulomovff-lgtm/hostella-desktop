import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { nextResetAt, isNoVacancy, noVacancyNight, noVacancyEntry } from '../src/utils/noVacancy.js';

const server = createRequire(import.meta.url)('../functions/lib/noVacancy.js');
// Время по Ташкенту (UTC+5) → мс
const tash = (s) => Date.parse(s + '+05:00');

test('отметка до ближайших 9:00 по Ташкенту', () => {
  assert.equal(nextResetAt(tash('2026-11-07T20:00:00')), tash('2026-11-08T09:00:00'));
  assert.equal(nextResetAt(tash('2026-11-08T02:30:00')), tash('2026-11-08T09:00:00'));
  assert.equal(nextResetAt(tash('2026-11-08T08:59:59')), tash('2026-11-08T09:00:00'));
  assert.equal(nextResetAt(tash('2026-11-08T09:00:00')), tash('2026-11-09T09:00:00'));
  assert.equal(nextResetAt(tash('2026-12-31T23:00:00')), tash('2027-01-01T09:00:00'));
});

test('после 9:00 отметка сама недействительна', () => {
  const e = noVacancyEntry({ id: 'u1', name: 'Кассир' }, tash('2026-11-07T20:00:00'));
  assert.equal(e.byName, 'Кассир');
  assert.equal(isNoVacancy(e, tash('2026-11-08T08:59:00')), true);
  assert.equal(isNoVacancy(e, tash('2026-11-08T09:00:00')), false);
  assert.equal(isNoVacancy(null), false);
  assert.equal(isNoVacancy({ until: 0 }), false);
});

test('закрытая ночь — дата заезда перед утром снятия', () => {
  assert.equal(noVacancyNight(noVacancyEntry(null, tash('2026-11-07T20:00:00'))), '2026-11-07');
  assert.equal(noVacancyNight(noVacancyEntry(null, tash('2026-11-08T02:00:00'))), '2026-11-07');
  assert.equal(noVacancyNight(noVacancyEntry(null, tash('2026-11-08T10:00:00'))), '2026-11-08');
  assert.equal(noVacancyNight({}), null);
});

test('сервер считает так же, как программа', () => {
  for (const at of ['2026-11-07T20:00:00', '2026-11-08T02:00:00', '2026-11-08T10:00:00']) {
    const e = noVacancyEntry(null, tash(at));
    assert.equal(server.noVacancyNight(e), noVacancyNight(e));
    for (const now of [tash(at), e.until - 1, e.until]) assert.equal(server.isNoVacancy(e, now), isNoVacancy(e, now));
  }
});

test('сервер отдаёт только действующие отметки', async () => {
  const now = tash('2026-11-07T21:00:00');
  const data = { hostel1: noVacancyEntry(null, tash('2026-11-07T20:00:00')), hostel2: { until: tash('2026-11-07T09:00:00') } };
  const db = { doc: () => ({ get: async () => ({ exists: true, data: () => data }) }) };
  const out = await server.readNoVacancy(db, 'x', now);
  assert.deepEqual(Object.keys(out), ['hostel1']);
  assert.equal(out.hostel1.night, '2026-11-07');
  const broken = { doc: () => ({ get: async () => { throw new Error('нет связи'); } }) };
  assert.deepEqual(await server.readNoVacancy(broken, 'x', now), {});
});
