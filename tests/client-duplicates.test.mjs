import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeName, editDistance, namesSimilar,
    findDuplicateGroups, computeMergedClient,
} from '../src/utils/clientDuplicates.js';

// ── нормализация имени ───────────────────────────────────────────────────────
test('normalizeName: регистр, лишние пробелы и Ё сводятся к одному виду', () => {
    assert.equal(normalizeName('  иванов   пётр '), 'ИВАНОВ ПЕТР');
    assert.equal(normalizeName('Иванов-Петров'), 'ИВАНОВ ПЕТРОВ');
    assert.equal(normalizeName(''), '');
    assert.equal(normalizeName(undefined), '');
});

// ── расстояние Левенштейна ───────────────────────────────────────────────────
test('editDistance: считает число правок', () => {
    assert.equal(editDistance('AC1234567', 'AS1234567'), 1);
    assert.equal(editDistance('', 'abc'), 3);
    assert.equal(editDistance('abc', 'abc'), 0);
});

// ── похожесть имён ───────────────────────────────────────────────────────────
test('namesSimilar: порядок слов не важен', () => {
    assert.ok(namesSimilar('ИВАНОВ ИВАН', 'ИВАН ИВАНОВ'));
});

test('namesSimilar: мелкая опечатка в длинном имени — это дубль', () => {
    assert.ok(namesSimilar('РАЗИКОВ АБДУЛЛА', 'РАЗИКОВ АБДУЛЛО'));
});

test('namesSimilar: потерянное отчество не мешает совпадению', () => {
    assert.ok(namesSimilar('ИВАНОВ ИВАН ИВАНОВИЧ', 'ИВАНОВ ИВАН'));
});

test('namesSimilar: разные люди не считаются дублями', () => {
    assert.ok(!namesSimilar('ИВАНОВ ИВАН', 'ПЕТРОВ СЕРГЕЙ'));
    assert.ok(!namesSimilar('ИВАНОВ ИВАН', ''));
});

// Кандидатов лучше показать лишних, чем пропустить: слияние всё равно ручное и
// только после проверки в госбазе. Поэтому одна опечатка в коротком имени —
// это кандидат (дата рождения у них уже совпала), а вот разные имена — нет.
test('namesSimilar: одна опечатка в коротком имени — кандидат на проверку', () => {
    assert.ok(namesSimilar('ОЛИМ', 'АЛИМ'));
});

test('namesSimilar: две правки в коротком имени — уже разные люди', () => {
    assert.ok(!namesSimilar('ОЛИМ', 'КАРИМ'));
});

// ── группировка дубликатов ───────────────────────────────────────────────────
test('findDuplicateGroups: ловит случай AC/AS — паспорта разные, человек один', () => {
    const groups = findDuplicateGroups([
        { id: '1', fullName: 'КАРИМОВ АЗИЗ', birthDate: '1990-05-14', passport: 'AC1234567' },
        { id: '2', fullName: 'КАРИМОВ АЗИЗ', birthDate: '1990-05-14', passport: 'AS1234567' },
    ]);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0].clients.map(c => c.id).sort(), ['1', '2']);
});

test('findDuplicateGroups: одна дата рождения, но разные люди — не группа', () => {
    const groups = findDuplicateGroups([
        { id: '1', fullName: 'КАРИМОВ АЗИЗ',  birthDate: '1990-05-14' },
        { id: '2', fullName: 'ПЕТРОВ СЕРГЕЙ', birthDate: '1990-05-14' },
    ]);
    assert.equal(groups.length, 0);
});

test('findDuplicateGroups: записи без даты рождения не сливаем (тёзки)', () => {
    const groups = findDuplicateGroups([
        { id: '1', fullName: 'КАРИМОВ АЗИЗ', birthDate: '' },
        { id: '2', fullName: 'КАРИМОВ АЗИЗ' },
    ]);
    assert.equal(groups.length, 0);
});

test('findDuplicateGroups: три записи одного человека попадают в одну группу', () => {
    const groups = findDuplicateGroups([
        { id: '1', fullName: 'КАРИМОВ АЗИЗ', birthDate: '1990-05-14', passport: 'AC1' },
        { id: '2', fullName: 'КАРИМОВ АЗИЗ', birthDate: '1990-05-14', passport: 'AS1' },
        { id: '3', fullName: 'КАРИМОВ АЗИЗ', birthDate: '1990-05-14', passport: 'AB1' },
    ]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].clients.length, 3);
});

test('findDuplicateGroups: каждый клиент попадает максимум в одну группу', () => {
    const groups = findDuplicateGroups([
        { id: '1', fullName: 'КАРИМОВ АЗИЗ',  birthDate: '1990-05-14' },
        { id: '2', fullName: 'КАРИМОВ АЗИЗ',  birthDate: '1990-05-14' },
        { id: '3', fullName: 'ПЕТРОВ СЕРГЕЙ', birthDate: '1990-05-14' },
        { id: '4', fullName: 'ПЕТРОВ СЕРГЕЙ', birthDate: '1990-05-14' },
    ]);
    assert.equal(groups.length, 2);
    const ids = groups.flatMap(g => g.clients.map(c => c.id));
    assert.equal(new Set(ids).size, ids.length);
});

test('findDuplicateGroups: пустой список не ломает', () => {
    assert.deepEqual(findDuplicateGroups([]), []);
    assert.deepEqual(findDuplicateGroups(), []);
});

// ── расчёт слияния (деньги!) ─────────────────────────────────────────────────
test('computeMergedClient: баланс складывается со всех записей', () => {
    const r = computeMergedClient(
        { balance: 50000, visits: 2 },
        [{ balance: 30000, visits: 1 }, { balance: 20000, visits: 3 }],
    );
    assert.equal(r.balance, 100000);
    assert.equal(r.visits, 6);
});

test('computeMergedClient: пустые и мусорные значения баланса не портят сумму', () => {
    const r = computeMergedClient(
        { balance: null, visits: undefined },
        [{ balance: '15000', visits: '2' }, { balance: 'ошибка', visits: null }],
    );
    assert.equal(r.balance, 15000);
    assert.equal(r.visits, 2);
});

test('computeMergedClient: берётся самая поздняя дата визита', () => {
    const r = computeMergedClient(
        { lastVisit: '2026-01-10' },
        [{ lastVisit: '2026-08-30' }, { lastVisit: '2025-12-01' }],
    );
    assert.equal(r.lastVisit, '2026-08-30');
});

test('computeMergedClient: телефон и страна подбираются из дубля, если у главной пусто', () => {
    const r = computeMergedClient(
        { phone: '', country: '' },
        [{ phone: '+998901234567', country: 'Узбекистан' }],
    );
    assert.equal(r.phone, '+998901234567');
    assert.equal(r.country, 'Узбекистан');
});

test('computeMergedClient: чёрный список побеждает обычный статус', () => {
    const r = computeMergedClient(
        { clientStatus: 'normal' },
        [{ clientStatus: 'blacklist' }, { clientStatus: 'vip' }],
    );
    assert.equal(r.clientStatus, 'blacklist');
});

test('computeMergedClient: слияние без дублей возвращает исходные суммы', () => {
    const r = computeMergedClient({ balance: 1000, visits: 1, lastVisit: '2026-02-02' }, []);
    assert.equal(r.balance, 1000);
    assert.equal(r.visits, 1);
    assert.equal(r.lastVisit, '2026-02-02');
});
