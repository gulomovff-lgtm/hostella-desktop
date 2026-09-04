import test from 'node:test';
import assert from 'node:assert/strict';
import {
    BUILTIN_SOURCES, DEFAULT_SOURCE, normalizeSources, makeSourceId,
    sourceLabel, sourceOptions, sourceOf, summarizeSources,
} from '../src/utils/guestSource.js';

test('normalizeSources: пустые настройки = все встроенные, включены', () => {
    const list = normalizeSources(undefined);
    assert.deepEqual(list.map(s => s.id), BUILTIN_SOURCES);
    assert.ok(list.every(s => s.enabled && s.builtin));
});

test('normalizeSources: добавляет встроенные, которых нет в сохранённом списке, и чистит мусор', () => {
    const list = normalizeSources([{ id: 'c_insta', label: 'Instagram' }, { id: '' }, null, { id: 'c_insta' }]);
    assert.equal(list[0].id, 'c_insta');
    assert.equal(list.filter(s => s.id === 'c_insta').length, 1);
    for (const id of BUILTIN_SOURCES) assert.ok(list.some(s => s.id === id), id);
});

test('normalizeSources: «с улицы» и «прочее» нельзя выключить', () => {
    const list = normalizeSources([{ id: 'walk_in', enabled: false }, { id: 'other', enabled: false }, { id: 'phone', enabled: false }]);
    const by = Object.fromEntries(list.map(s => [s.id, s.enabled]));
    assert.equal(by.walk_in, true);
    assert.equal(by.other, true);
    assert.equal(by.phone, false);
});

test('makeSourceId: латиница из подписи, без совпадений с существующими и встроенными', () => {
    assert.equal(makeSourceId('Instagram реклама'), 'c_instagram');
    assert.equal(makeSourceId('Instagram', [{ id: 'c_instagram' }]), 'c_instagram_2');
    assert.equal(makeSourceId('!!!'), 'c_src');
});

test('sourceLabel: подпись из настроек сильнее встроенной, узбекская — отдельно', () => {
    const cfg = [{ id: 'booking', label: 'Букинг', labelUz: 'Buking' }];
    assert.equal(sourceLabel('booking', cfg, 'ru'), 'Букинг');
    assert.equal(sourceLabel('booking', cfg, 'uz'), 'Buking');
    assert.equal(sourceLabel('walk_in', cfg, 'uz'), 'Ko‘chadan');
    assert.equal(sourceLabel('walk_in', cfg, 'ru'), 'С улицы');
});

test('sourceLabel: если узбекской подписи нет — берётся русская, а не встроенная', () => {
    assert.equal(sourceLabel('booking', [{ id: 'booking', label: 'Букинг' }], 'uz'), 'Букинг');
});

test('sourceOptions: скрытые не показываются, кроме уже записанного у гостя', () => {
    const cfg = [{ id: 'hostelworld', enabled: false }];
    assert.ok(!sourceOptions(cfg).some(o => o.id === 'hostelworld'));
    assert.ok(sourceOptions(cfg, 'ru', 'hostelworld').some(o => o.id === 'hostelworld'));
});

test('sourceOf: явный источник сильнее догадок, неизвестный — игнорируется', () => {
    assert.equal(sourceOf({ source: 'phone', fromWebsite: true }), 'phone');
    assert.equal(sourceOf({ source: 'nope', fromWebsite: true }), 'site');
});

test('sourceOf: догадки по записанному — сайт, бот, booking; иначе с улицы', () => {
    assert.equal(sourceOf({ fromWebsite: true }), 'site');
    assert.equal(sourceOf({ channel: 'telegram' }), 'site');
    assert.equal(sourceOf({ channel: 'Booking.com' }), 'booking');
    assert.equal(sourceOf({}), DEFAULT_SOURCE);
    assert.equal(sourceOf(null), DEFAULT_SOURCE);
});

test('summarizeSources: гости по заезду в период, выручка по платежам периода, доля от выручки', () => {
    const guests = [
        { id: 'a', source: 'booking', checkInDate: '2026-09-02T10:00:00Z', days: 3 },
        { id: 'b', checkInDate: '2026-09-03T10:00:00Z', days: 1 },              // с улицы
        { id: 'c', fromWebsite: true, checkInDate: '2026-08-20T10:00:00Z', days: 10 }, // заезд раньше периода
        { id: 'x', status: 'cancelled', checkInDate: '2026-09-02T10:00:00Z', days: 1 },
    ];
    const payments = [
        { guestId: 'a', amount: 300000, date: '2026-09-02T11:00:00Z' },
        { guestId: 'b', amount: 100000, date: '2026-09-03T11:00:00Z' },
        { guestId: 'c', amount: 100000, date: '2026-09-04T11:00:00Z' }, // продление старого заезда — в выручке
        { guestId: 'a', amount: 999999, date: '2026-08-01T11:00:00Z' }, // вне периода
        { guestId: 'zzz', amount: 5000, date: '2026-09-04T11:00:00Z' }, // не гость
    ];
    const rows = summarizeSources({ guests, payments, from: '2026-09-01T00:00:00Z', to: '2026-09-30T23:59:59Z' });
    const by = Object.fromEntries(rows.map(r => [r.source, r]));
    assert.equal(rows[0].source, 'booking');
    assert.deepEqual([by.booking.guests, by.booking.nights, by.booking.revenue, by.booking.share], [1, 3, 300000, 60]);
    assert.deepEqual([by.walk_in.guests, by.walk_in.nights, by.walk_in.revenue, by.walk_in.share], [1, 1, 100000, 20]);
    assert.deepEqual([by.site.guests, by.site.nights, by.site.revenue, by.site.share], [0, 0, 100000, 20]);
    assert.ok(!by.other);
});

test('summarizeSources: подписи на языке отчёта, без периода — всё', () => {
    const rows = summarizeSources({ guests: [{ id: 'a', checkInDate: '2020-01-01', days: 2 }], payments: [] }, undefined, 'uz');
    assert.equal(rows[0].label, 'Ko‘chadan');
    assert.equal(rows[0].share, 0);
});
