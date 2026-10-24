import test from 'node:test';
import assert from 'node:assert/strict';
import { historyCutoffIso, openContractKeys, chunk, HISTORY_TABS, LIVE_GUEST_STATUSES, HISTORY_WINDOW_DAYS } from '../src/utils/historyWindow.js';
import { mergeLists, newestFirst } from '../src/utils/liveList.js';
import { cadastrePersonGone } from '../src/utils/registrationStatus.js';

test('окно: граница — начало дня N дней назад, ISO-строка сравнима с датами базы', () => {
  const iso = historyCutoffIso(new Date('2026-10-24T15:30:00'));
  const d = new Date(iso);
  assert.equal(Math.round((new Date('2026-10-24T00:00:00') - d) / 86400000), HISTORY_WINDOW_DAYS);
  assert.ok('2026-10-01T09:00:00.000Z' >= iso && !('2026-01-01T09:00:00.000Z' >= iso));
});

test('живущие, брони и долговые записи грузятся всегда', () => {
  for (const s of ['active', 'booking', 'debt']) assert.ok(LIVE_GUEST_STATUSES.includes(s), s);
});

test('экраны отчётов, долгов и истории просят полную историю; «Номера» — нет', () => {
  for (const tab of ['reports', 'debts', 'guesthistory', 'analytics', 'shifts', 'registrations']) assert.ok(HISTORY_TABS.has(tab), tab);
  for (const tab of ['rooms', 'dashboard', 'shop']) assert.ok(!HISTORY_TABS.has(tab), tab);
});

test('открытые договоры: id и ФИО участников; закрытые не грузим; части по 30', () => {
  const k = openContractKeys([{ id: 'b', memberKeys: ['Ali ', 'Vali'] }, { id: 'a', closed: true, memberKeys: ['X'] }, { id: 'c' }]);
  assert.deepEqual(k.ids, ['b', 'c']);
  assert.deepEqual(k.names, ['Ali', 'Vali']);
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 30), []);
});

test('окно + договоры: без дублей, объекты те же, порядок — новые сверху', () => {
  const a = { id: '1', checkInDate: '2026-10-01' }, b = { id: '2', checkInDate: '2026-10-10' };
  const out = mergeLists([[a], [b, a]], newestFirst('checkInDate'));
  assert.deepEqual(out.map(o => o.id), ['2', '1']);
  assert.equal(out[1], a);
});

test('сводка кадастра: давний гость вне окна узнаётся по клиентам и не напоминается', () => {
  const reg = { status: 'active', passport: 'AB1234567', endDate: '2026-10-25' };
  const now = new Date('2026-10-24T12:00:00');
  assert.equal(cadastrePersonGone(reg, [], now, [{ id: 'c1', passport: 'AB 1234567', visits: 3 }]), true);
  assert.equal(cadastrePersonGone(reg, [], now, [{ id: 'c1', passport: 'AB1234567', visits: 0 }]), false, 'клиент без визитов — «с улицы»');
  assert.equal(cadastrePersonGone(reg, [{ id: 'g', passport: 'AB1234567', status: 'active', checkOutDate: '2026-10-30' }], now,
    [{ id: 'c1', passport: 'AB1234567', visits: 3 }]), false, 'живёт — напоминаем');
});

test('визиты одного человека: паспорт как введён и без пробелов; без паспорта — ФИО; недопечатанный — не ключ', async () => {
  const { personQueryKeys } = await import('../src/utils/historyWindow.js');
  assert.deepEqual(personQueryKeys({ passport: 'ac 1234567' }).passports.sort(), ['AC 1234567', 'AC1234567', 'ac 1234567'].sort());
  assert.deepEqual(personQueryKeys({ passport: 'AC1234567', fullName: 'X' }), { passports: ['AC1234567'], name: '' });
  assert.deepEqual(personQueryKeys({ passport: 'AC1', fullName: ' Ali Valiyev ' }), { passports: [], name: 'Ali Valiyev' });
  assert.deepEqual(personQueryKeys({}), { passports: [], name: '' });
});
