import test from 'node:test';
import assert from 'node:assert/strict';
import {
    passportKey, nameKey, clientMatchKey, findExistingClient, createPendingIndex,
} from '../src/utils/clientMatch.js';

test('passportKey: пробелы и регистр не создают нового человека', () => {
    assert.equal(passportKey('ac 123 4567'), 'AC1234567');
    assert.equal(passportKey('AC1234567'), 'AC1234567');
    assert.equal(passportKey(''), '');
});

test('nameKey: лишние пробелы и Ё сводятся к одному виду', () => {
    assert.equal(nameKey('  иванов   пётр '), 'ИВАНОВ ПЕТР');
    assert.equal(nameKey(undefined), '');
});

test('clientMatchKey: паспорт важнее имени', () => {
    assert.equal(clientMatchKey({ passport: 'ac1', fullName: 'Иванов' }), 'P:AC1');
    assert.equal(clientMatchKey({ fullName: 'Иванов Иван' }), 'N:ИВАНОВ ИВАН');
    assert.equal(clientMatchKey({}), '');
});

const clients = [
    { id: 'c1', passport: 'AC1234567', fullName: 'КАРИМОВ АЗИЗ' },
    { id: 'c2', passport: '',          fullName: 'ПЕТРОВ СЕРГЕЙ' },
];

test('findExistingClient: узнаёт по паспорту, несмотря на пробелы', () => {
    assert.equal(findExistingClient(clients, { passport: 'ac 123 4567' })?.id, 'c1');
});

test('findExistingClient: без паспорта узнаёт по имени', () => {
    assert.equal(findExistingClient(clients, { fullName: 'петров  сергей' })?.id, 'c2');
});

test('findExistingClient: человек без паспорта не прилипает к тёзке с паспортом', () => {
    // у c1 паспорт есть — значит это другой человек, а не запись без паспорта
    assert.equal(findExistingClient(clients, { fullName: 'КАРИМОВ АЗИЗ' }), null);
});

test('findExistingClient: новый паспорт — новый человек', () => {
    assert.equal(findExistingClient(clients, { passport: 'XX999', fullName: 'НОВЫЙ' }), null);
});

test('findExistingClient: пустые данные никого не находят', () => {
    assert.equal(findExistingClient(clients, {}), null);
    assert.equal(findExistingClient([], { passport: 'AC1' }), null);
});

// ── главное: защита пакетных циклов ──────────────────────────────────────────
test('pendingIndex: один и тот же человек не ставится в очередь дважды', () => {
    const pending = createPendingIndex();
    const stay1 = { passport: 'AC1234567', fullName: 'КАРИМОВ АЗИЗ' };
    const stay2 = { passport: 'ac 123 4567', fullName: 'КАРИМОВ АЗИЗ' }; // тот же, другое написание

    assert.equal(pending.has(stay1), false);
    pending.add(stay1);
    assert.equal(pending.has(stay2), true, 'второй заезд того же гостя создал бы дубликат');
    assert.equal(pending.size, 1);
});

test('pendingIndex: разные люди ставятся в очередь оба', () => {
    const pending = createPendingIndex();
    pending.add({ passport: 'AC1' });
    pending.add({ passport: 'AC2' });
    assert.equal(pending.size, 2);
});

test('pendingIndex: записи без паспорта и имени не занимают место', () => {
    const pending = createPendingIndex();
    pending.add({});
    assert.equal(pending.size, 0);
    assert.equal(pending.has({}), false);
});

test('пять заездов одного гостя дают одну запись клиента', () => {
    // Именно так и появлялись дубликаты с одинаковыми данными: у постоянного
    // гостя одна запись на каждый заезд, а синхронизация создавала клиента
    // на каждую из них.
    const stays = Array.from({ length: 5 }, (_, i) => ({
        passport: 'AC1234567', fullName: 'КАРИМОВ АЗИЗ', checkInDate: `2026-0${i + 1}-01`,
    }));
    const pending = createPendingIndex();
    let created = 0;
    for (const s of stays) {
        if (findExistingClient([], s) || pending.has(s)) continue;
        pending.add(s);
        created++;
    }
    assert.equal(created, 1);
});
