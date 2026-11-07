import test from 'node:test';
import assert from 'node:assert/strict';
import { ORNAMENTS, pickOrnament, buildOrnament } from '../src/components/LoginScreen/ornaments.js';

test('семь орнаментов, у каждого своё появление', () => {
  assert.equal(ORNAMENTS.length, 7);
  assert.equal(new Set(ORNAMENTS.map(o => o.reveal)).size, 7);
});

test('каждый узор строится и умещается в несколько путей (а не сотни элементов)', () => {
  for (const { id } of ORNAMENTS) {
    const p = buildOrnament(id);
    const lines = [p.ln, p.c, p.k, ...p.rings.flatMap(r => [r.ln, r.c, r.k])].filter(Boolean);
    assert.ok(lines.length >= 2, id + ': линии');
    assert.ok(p.tl || p.t, id + ': плитки');
    const total = Object.values(p).reduce((n, v) => n + (typeof v === 'string' ? v.length : 0), 0)
      + p.rings.reduce((n, r) => n + r.ln.length + r.c.length + r.k.length, 0);
    assert.ok(total < 400_000, `${id}: объём путей ${total}`);
    if (id === 'girih') assert.equal(p.rings.length, 8, 'гирих рисуется восемью кольцами');
    else assert.equal(p.rings.length, 0);
    assert.ok(!/NaN|undefined/.test(JSON.stringify(p)), id + ': без NaN');
  }
});

test('сюзане облегчён: кругов меньше 500', () => {
  const p = buildOrnament('suzani');
  const circles = (p.ln + p.c + p.k + p.tl + p.t).split('a').length;
  assert.ok(circles / 2 < 500, 'кругов ' + circles / 2);
});

test('случайный выбор: тот же узор два раза подряд не выпадает', () => {
  for (let i = 0; i < 200; i++) {
    const prev = ORNAMENTS[i % 7].id;
    assert.notEqual(pickOrnament(prev, Math.random).id, prev);
  }
  assert.equal(pickOrnament('', () => 0).id, ORNAMENTS[0].id);
  assert.equal(pickOrnament('', () => 0.9999).id, ORNAMENTS[6].id);
});
