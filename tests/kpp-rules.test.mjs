import test from 'node:test';
import assert from 'node:assert/strict';
import {
    toIsoDate, daysBetween, parseEmehmonProbe, assessKpp, registrationDue,
    trimProbe, shouldRetryNoRoom, getRegistrationWindow,
} from '../src/utils/kppRules.js';

test('toIsoDate: три формата портала, мусор — null', () => {
    assert.equal(toIsoDate('05.09.2026'), '2026-09-05');
    assert.equal(toIsoDate('05/09/2026'), '2026-09-05');
    assert.equal(toIsoDate('2026-09-05'), '2026-09-05');
    assert.equal(toIsoDate('  KPP: 05.09.2026 '), '2026-09-05');
    assert.equal(toIsoDate('12345'), null);
    assert.equal(toIsoDate('31.13.2026'), null);
    assert.equal(toIsoDate(''), null);
});

test('daysBetween: календарные сутки, битая дата — NaN', () => {
    assert.equal(daysBetween('2026-09-01', '2026-09-04'), 3);
    assert.equal(daysBetween('2026-09-04', '2026-09-01'), -3);
    assert.ok(Number.isNaN(daysBetween('x', '2026-09-01')));
});

test('parseEmehmonProbe: дата и номер КПП из полей по ключу', () => {
    const r = parseEmehmonProbe({ fields: { kpp_date: '05.09.2026', kpp_no: 'A-12', sex: 'Erkak' } }, { today: '2026-09-08' });
    assert.equal(r.kppDate, '2026-09-05');
    assert.equal(r.kppNumber, 'A-12');
});

test('parseEmehmonProbe: по подписи, дата рождения и выдачи паспорта не принимаются за КПП', () => {
    const r = parseEmehmonProbe(
        { fields: { datebirth: '01.01.1990', datePassport: '10.10.2020' },
          labels: { 'Chegara orqali kirish sanasi': '06.09.2026', 'Tug‘ilgan sana': '01.01.1990' } },
        { birthDate: '1990-01-01', passportIssueDate: '2020-10-10', today: '2026-09-08' });
    assert.equal(r.kppDate, '2026-09-06');
});

test('parseEmehmonProbe: дата из будущего или равная дате рождения не годится', () => {
    const r = parseEmehmonProbe({ fields: { kpp_date: '01.01.1990' } }, { birthDate: '1990-01-01', today: '2026-09-08' });
    assert.equal(r.kppDate, null);
    const f = parseEmehmonProbe({ fields: { kpp_date: '01.10.2026' } }, { today: '2026-09-08' });
    assert.equal(f.kppDate, null);
});

test('parseEmehmonProbe: таблица проживаний — несортированные строки, последний выезд', () => {
    const r = parseEmehmonProbe({
        tables: [
            { headers: ['#', 'Hujjat'], rows: [['1', 'AB1234567']] },   // не про отели
            { headers: ['Mehmonxona', 'Kirish sanasi', 'Chiqish sanasi'],
              rows: [['Hotel Uzbekistan', '03.09.2026', '06.09.2026'], ['Samarkand Plaza', '25.08.2026', '01.09.2026']] },
        ],
    }, { today: '2026-09-08' });
    assert.equal(r.stays.length, 2);
    assert.equal(r.stays[0].hotel, 'Samarkand Plaza');
    assert.equal(r.stays[1].to, '2026-09-06');
    assert.equal(r.lastCheckout, '2026-09-06');
});

test('parseEmehmonProbe: выезд в будущем не считается последним', () => {
    const r = parseEmehmonProbe({
        tables: [{ headers: ['Hotel', 'Date in', 'Date out'], rows: [['X', '01.09.2026', '20.09.2026'], ['Y', '20.08.2026', '30.08.2026']] }],
    }, { today: '2026-09-08' });
    assert.equal(r.lastCheckout, '2026-08-30');
});

test('parseEmehmonProbe: запасной разбор по текстовым блокам', () => {
    const r = parseEmehmonProbe({ blocks: ['Hotel Tashkent 01.09.2026 - 04.09.2026\nBoshqa matn'] }, { today: '2026-09-08' });
    assert.equal(r.stays.length, 1);
    assert.equal(r.stays[0].hotel, 'Hotel Tashkent');
    assert.equal(r.lastCheckout, '2026-09-04');
});

test('parseEmehmonProbe: пусто — всё null, без исключений', () => {
    const r = parseEmehmonProbe({}, {});
    assert.deepEqual([r.kppDate, r.kppNumber, r.stays, r.lastCheckout], [null, null, [], null]);
    const r2 = parseEmehmonProbe(null);
    assert.equal(r2.kppDate, null);
});

test('assessKpp: в окне — ок; без даты — no_kpp', () => {
    assert.equal(assessKpp({ country: 'Китай', kppDate: '2026-09-06', today: '2026-09-08' }).reason, 'within_window'); // день 3 из 3
    assert.equal(assessKpp({ country: 'Китай', today: '2026-09-08' }).reason, 'no_kpp');
});

test('assessKpp: день 4 из 3 без отелей — разрыв после КПП', () => {
    const r = assessKpp({ country: 'Китай', kppDate: '2026-09-05', today: '2026-09-08' });
    assert.deepEqual([r.ok, r.reason, r.dayNumber, r.window, r.gapDays], [false, 'gap_after_kpp', 4, 3, 1]);
});

test('assessKpp: выехал из другого отеля вчера — ок; три дня назад — нарушение', () => {
    const ok = assessKpp({ country: 'Китай', kppDate: '2026-08-20', lastCheckout: '2026-09-07', today: '2026-09-08' });
    assert.deepEqual([ok.ok, ok.reason, ok.gapDays], [true, 'after_hotel', 1]);
    const bad = assessKpp({ country: 'Китай', kppDate: '2026-08-20', lastCheckout: '2026-09-05', today: '2026-09-08' });
    assert.deepEqual([bad.ok, bad.reason, bad.gapDays], [false, 'gap_after_hotel', 3]);
});

test('assessKpp: окно по стране — Казахстан день 20 ещё в окне; явное окно 3 сильнее', () => {
    assert.equal(assessKpp({ country: 'Казахстан', kppDate: '2026-08-20', today: '2026-09-08' }).reason, 'within_window');
    assert.equal(assessKpp({ country: 'Казахстан', kppDate: '2026-08-20', today: '2026-09-08', windowDays: 3 }).ok, false);
    assert.equal(getRegistrationWindow('Россия'), 15);
});

test('registrationDue: предпоследний день окна, опоздавшие — сразу', () => {
    assert.equal(registrationDue({ country: 'Китай', kppDate: '2026-09-08', today: '2026-09-08' }), false); // день 1 из 3
    assert.equal(registrationDue({ country: 'Китай', kppDate: '2026-09-07', today: '2026-09-08' }), true);  // день 2 из 3
    assert.equal(registrationDue({ country: 'Китай', kppDate: '2026-09-01', today: '2026-09-08' }), true);  // день 8 — давно пора
    assert.equal(registrationDue({ country: 'Казахстан', kppDate: '2026-08-11', today: '2026-09-08' }), true);  // день 29 из 30
    assert.equal(registrationDue({ country: 'Казахстан', kppDate: '2026-08-12', today: '2026-09-08' }), false); // день 28
    assert.equal(registrationDue({ country: 'Китай', today: '2026-09-08' }), false);
});

test('trimProbe: укладывается в лимит, сначала жертвует блоками и строками', () => {
    const big = {
        fields: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`f${i}`, 'x'.repeat(100)])),
        labels: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`l${i}`, 'y'.repeat(100)])),
        tables: [{ headers: ['a', 'b'], rows: Array.from({ length: 40 }, () => ['z'.repeat(60), 'w'.repeat(60)]) }],
        blocks: ['b'.repeat(3000)],
    };
    const p = trimProbe(big, 8000);
    assert.ok(JSON.stringify(p).length <= 8000);
    assert.equal(p.blocks.length, 0);
    assert.ok(p.tables[0].rows.length >= 5);
    assert.ok(Object.keys(p.fields).length > 0, 'поля — самое ценное, режутся последними');
});

test('shouldRetryNoRoom: без метки — да; свежая метка — нет; старше 6 часов — да', () => {
    const now = Date.parse('2026-09-08T12:00:00Z');
    assert.equal(shouldRetryNoRoom({}, now), true);
    assert.equal(shouldRetryNoRoom({ emehmonNoRoomAt: '2026-09-08T10:00:00Z' }, now), false);
    assert.equal(shouldRetryNoRoom({ emehmonNoRoomAt: '2026-09-08T05:00:00Z' }, now), true);
});
