// Сторож: каждая часть Firebase — ровно в одной версии.
// 09.11.2026: после отката firebase 13.2 → 13.1 в сборку попали две копии
// @firebase/app (0.16.4 и 0.16.5). Части регистрировались в одной копии, а
// программа искала их в другой → «Service functions is not available» и белый
// экран в 0.15.58–0.15.59. Лечится "overrides" в package.json (версии из
// зависимостей firebase); этот тест не даёт им разойтись снова.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('в package-lock каждая часть @firebase/* — одной версии', () => {
  const versions = new Map();
  for (const [path, info] of Object.entries(lock.packages || {})) {
    const m = path.match(/node_modules\/(@firebase\/[^/]+)$/);
    if (!m || !info.version) continue;
    if (!versions.has(m[1])) versions.set(m[1], new Set());
    versions.get(m[1]).add(info.version);
  }
  const split = [...versions].filter(([, v]) => v.size > 1).map(([n, v]) => `${n}: ${[...v].join(', ')}`);
  assert.deepEqual(split, [], 'две копии одной части Firebase: ' + split.join('; '));
});

test('firebase закреплён точной версией, и overrides совпадают с её зависимостями', () => {
  const want = pkg.dependencies.firebase;
  assert.match(want, /^\d+\.\d+\.\d+$/, 'firebase — только точная версия');
  const fb = lock.packages['node_modules/firebase'];
  assert.equal(fb.version, want);
  for (const [name, ver] of Object.entries(fb.dependencies || {})) {
    if (!name.startsWith('@firebase/')) continue;
    assert.equal(pkg.overrides?.[name], ver, `overrides["${name}"] должен быть ${ver} (как у firebase ${want})`);
  }
});
