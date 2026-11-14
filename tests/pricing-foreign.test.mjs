// Иностранцы в первом филиале (решение владельца 14.11.2026): посуточно не
// меньше 100 000, пакет от 5 суток — 90 000, регистрация e-mehmon не ниже 90 000.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { foreignRule, foreignNightFloor } from '../src/utils/foreignRule.js';

const day = new Date('2026-11-14T15:00:00');

test('иностранец в первом филиале: меньше 5 суток — от 100 000, от 5 суток — 90 000', () => {
  const r = foreignRule('hostel1', 'Таджикистан', day);
  assert.equal(foreignNightFloor(r, 3), 100000);
  assert.equal(foreignNightFloor(r, 5), 90000);
  assert.equal(foreignNightFloor(r, 0), 100000, 'дней не знаем — посуточно');
  assert.equal(r.emehmonMin, 90000, 'регистрация не ниже 90 000 за сутки');
});

test('местных и второй филиал правило не трогает; до 14.11 не действует; настройка перекрывает', () => {
  assert.equal(foreignRule('hostel1', 'Узбекистан', day), null);
  assert.equal(foreignRule('hostel1', '', day), null);
  assert.equal(foreignRule('hostel2', 'Таджикистан', day), null);
  assert.equal(foreignRule('hostel1', 'Таджикистан', new Date('2026-11-13T12:00:00')), null);
  const cfg = { pricing: { foreign: { hostel1: { daily: 110000, package: 95000, packageMinDays: 7 } } } };
  assert.equal(foreignNightFloor(foreignRule('hostel1', 'Казахстан', day, cfg), 7), 95000);
  assert.equal(foreignRule('hostel1', 'Казахстан', day, { pricing: { foreign: { hostel1: { enabled: false } } } }), null);
});

test('цены и регистрация берут правило', () => {
  const pricing = readFileSync(new URL('../src/utils/pricing.js', import.meta.url), 'utf8');
  for (const fn of ['minNightPrice', 'configuredNightPrice', 'packageNightPrice', 'packageMinDays']) {
    const body = pricing.slice(pricing.indexOf('export function ' + fn), pricing.indexOf('export function ' + fn) + 600);
    assert.match(body, /foreignRule\(/, fn);
  }
  const helpers = readFileSync(new URL('../src/utils/helpers.jsx', import.meta.url), 'utf8');
  assert.match(helpers, /emehmonAmountFor = \(country, hostelId\)/);
  assert.match(helpers, /foreignRule\(hostelId, country, new Date\(\), cfg\)\?\.emehmonMin/);
});
