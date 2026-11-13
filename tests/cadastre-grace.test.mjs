// Кадастр кончился и 18 часов не продлён → запись завершается сама, гость
// идёт в e-mehmon (решение владельца 13.11.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CADASTRE_GRACE_HOURS, cadastreGraceEnd, cadastreGraceOver, cadastreBlocksAuto,
  autoRegisterAllowed, cadastreAutoFinishDue, stayStartAfterCadastre, hasRegistration,
} from '../src/utils/registrationStatus.js';

const g = { id: 'g1', passport: 'AA1234567', fullName: 'Karimov Bobur', status: 'active', checkInDate: '2026-11-01T14:00:00' };
// Кадастр по 15-е включительно
const cad = { id: 'c1', guestId: 'g1', passport: 'AA1234567', startDate: '2026-11-06', endDate: '2026-11-15', status: 'active', hostelId: 'hostel1' };
const T = (s) => new Date(s);   // местное время

test('18 часов отсчитываются с полуночи после последнего дня', () => {
  assert.equal(CADASTRE_GRACE_HOURS, 18);
  const e = cadastreGraceEnd(cad);
  assert.equal(e.getTime(), T('2026-11-16T18:00:00').getTime());
  assert.equal(cadastreGraceEnd({ endDate: '' }), null);
});

test('по часам: последний день, ожидание продления, автоматическая регистрация', () => {
  const steps = [
    ['2026-11-15T12:00:00', true,  false, 'последний день — кадастр действует'],
    ['2026-11-15T23:59:00', true,  false, 'конец последнего дня'],
    ['2026-11-16T00:01:00', true,  false, 'кончился, ждём продления'],
    ['2026-11-16T17:59:00', true,  false, 'за минуту до 18 часов'],
    ['2026-11-16T18:00:00', false, true,  '18 часов — завершаем и регистрируем'],
    ['2026-11-17T09:00:00', false, true,  'на следующий день — тоже'],
  ];
  for (const [when, blocks, finish, why] of steps) {
    assert.equal(cadastreBlocksAuto(g, [cad], T(when)), blocks, why + ' (блок)');
    assert.equal(autoRegisterAllowed(g, [cad], T(when)), !blocks, why + ' (автомат)');
    assert.equal(cadastreAutoFinishDue(cad, T(when)), finish, why + ' (завершение)');
  }
});

test('продлили в течение 18 часов — ни завершения, ни регистрации', () => {
  const ext = { ...cad, endDate: '2026-11-25' };
  for (const when of ['2026-11-16T10:00:00', '2026-11-16T18:00:00', '2026-11-20T12:00:00']) {
    assert.equal(autoRegisterAllowed(g, [ext], T(when)), false, when);
    assert.equal(cadastreAutoFinishDue(ext, T(when)), false, when);
  }
  assert.equal(autoRegisterAllowed(g, [ext], T('2026-11-26T18:00:00')), true, 'новый срок + 18 часов');
});

test('после автозавершения (removed) запись автомату не мешает и не завершается повторно', () => {
  const done = { ...cad, status: 'removed', removedAt: '2026-11-16T13:00:00.000Z', removedBy: 'auto_cadastre_end' };
  assert.equal(cadastreAutoFinishDue(done, T('2026-11-17T10:00:00')), false);
  assert.equal(autoRegisterAllowed(g, [done], T('2026-11-16T18:05:00')), true);
  assert.equal(hasRegistration(g, [done], T('2026-11-16T18:05:00')), false, 'гость снова в «Оформить»');
});

test('уже зарегистрирован в e-mehmon или «без регистрации» — автомат не трогает', () => {
  assert.equal(autoRegisterAllowed({ ...g, emehmonReg: true }, [cad], T('2026-11-17T10:00:00')), false);
  assert.equal(autoRegisterAllowed({ ...g, emehmonSkip: true }, [cad], T('2026-11-17T10:00:00')), false);
});

test('перевод кнопкой «В кадастр» возвращается сразу после конца, а запись завершается через 18 часов', () => {
  const tr = { ...cad, backToEmehmon: true };
  assert.equal(autoRegisterAllowed(g, [tr], T('2026-11-16T00:01:00')), true);
  assert.equal(cadastreAutoFinishDue(tr, T('2026-11-16T10:00:00')), false);
  assert.equal(cadastreAutoFinishDue(tr, T('2026-11-16T18:00:00')), true);
});

test('сутки в e-mehmon после кадастра считаются со дня после его конца', () => {
  const now = T('2026-11-16T18:30:00');
  const s = stayStartAfterCadastre(g, [cad], now);
  assert.equal(new Date(s).getTime(), T('2026-11-16T00:00:00').getTime());
  // и после автозавершения
  const done = { ...cad, status: 'removed', removedAt: T('2026-11-16T18:00:00').toISOString(), removedBy: 'auto_cadastre_end' };
  assert.equal(new Date(stayStartAfterCadastre(g, [done], now)).getTime(), T('2026-11-16T00:00:00').getTime());
  // сняли вручную раньше срока — с дня после снятия
  const early = { ...cad, status: 'removed', removedAt: T('2026-11-10T12:00:00').toISOString() };
  assert.equal(new Date(stayStartAfterCadastre(g, [early], now)).getTime(), T('2026-11-11T00:00:00').getTime());
  // кадастр до заезда, кадастра нет, кадастр ещё идёт — как обычно (null)
  assert.equal(stayStartAfterCadastre(g, [{ ...cad, endDate: '2026-10-20' }], now), null);
  assert.equal(stayStartAfterCadastre(g, [], now), null);
  assert.equal(stayStartAfterCadastre(g, [{ ...cad, endDate: '2026-11-30' }], now), null);
});

test('сверка завершает просроченные кадастры своего филиала, добор их больше не держит', () => {
  const src = readFileSync(new URL('../src/hooks/useEmehmonAutomation.js', import.meta.url), 'utf8');
  assert.match(src, /cadastreAutoFinishDue\(r\)/);
  assert.match(src, /removedBy: 'auto_cadastre_end'/);
  assert.match(src, /const inCad = \(g\) => cadastreBlocksAuto\(g, cadastreRegs\)/);
  assert.match(src, /emehmonStayStart: stayStartAfterCadastre\(guest, cadRegsRef\.current\) \|\| emehmonStayStartOf\(guest\)/);
  // завершение идёт до добора (добор вызывается в конце сверки)
  assert.ok(src.indexOf("removedBy: 'auto_cadastre_end'") < src.indexOf('await runEmehmonCatchup(hostelId, true'));
});
