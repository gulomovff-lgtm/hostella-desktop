// Рабочие по договору (решения владельца 20.11.2026): календарные сутки по
// Ташкенту, продление в 00:00, ставка — только с даты изменения.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  tashkentYmd, workerDays, nextTashkentMidnightIso, rateOn, workerCharge,
  rateHistoryWithChange, workerCheckoutPatch, workerExtendPatch,
} from '../src/utils/contractWorkers.js';
import { computeContractFinancials } from '../src/utils/contractFinancials.js';

const require = createRequire(import.meta.url);
const server = require('../functions/contractWorkers.js');

// 20.11 23:00 по Ташкенту = 18:00 UTC
const IN = '2026-11-20T18:00:00.000Z';
const at = (s) => new Date(s);

test('сутки — календарные дни: заехал 20.11 в 23:00, выселили 21.11 в 10:00 — 2 суток', () => {
  assert.equal(tashkentYmd(IN), '2026-11-20');
  const g = { contractWorker: true, contractGroupId: 'c1', status: 'active', checkInDate: IN };
  assert.equal(workerDays(g, at('2026-11-20T18:30:00Z')), 1, 'в день заезда — сутки');
  assert.equal(workerDays(g, at('2026-11-20T19:00:00Z')), 2, 'после полуночи по Ташкенту — 2');
  const out = workerCheckoutPatch(g, at('2026-11-21T05:00:00Z'));
  assert.equal(out.days, 2);
  assert.equal(workerDays({ ...g, ...out }, at('2026-12-01T00:00:00Z')), 2, 'выселенный не растёт');
});

test('продление: следующая полночь по Ташкенту; сервер считает так же, как экран', () => {
  const now = at('2026-11-22T10:00:00Z'); // 22.11 15:00 Ташкент
  assert.equal(nextTashkentMidnightIso(now), '2026-11-22T19:00:00.000Z');
  const g = { contractWorker: true, contractGroupId: 'c1', status: 'active', checkInDate: IN, days: 1 };
  const p = workerExtendPatch(g, now);
  assert.deepEqual(server.extendPatch(g, now), p);
  assert.equal(p.days, 3);
  assert.equal(server.extendPatch({ ...g, ...p }, now), null, 'повтор ничего не меняет');
  assert.equal(server.extendPatch({ ...g, status: 'checked_out' }, now), null, 'выселенных не трогает');
  assert.equal(server.extendPatch({ ...g, contractWorker: false }, now), null, 'обычных гостей не трогает');
});

test('ставка меняется только с даты изменения', () => {
  const group = { id: 'c1', contractRate: 50000 };
  const hist = rateHistoryWithChange(group, 60000, at('2026-11-22T10:00:00Z'));
  assert.deepEqual(hist, [{ from: '0000-01-01', rate: 50000 }, { from: '2026-11-22', rate: 60000 }]);
  const g2 = { ...group, contractRate: 60000, rateHistory: hist };
  assert.equal(rateOn(g2, '2026-11-21'), 50000);
  assert.equal(rateOn(g2, '2026-11-22'), 60000);
  const w = { contractWorker: true, contractGroupId: 'c1', status: 'active', checkInDate: IN };
  // 20, 21 — по 50 000, 22 — 60 000
  assert.equal(workerCharge(w, g2, at('2026-11-22T10:00:00Z')), 160000);
  // Та же ставка, что была, — история не растёт
  assert.deepEqual(rateHistoryWithChange(g2, 60000, at('2026-11-23T10:00:00Z')), hist);
});

test('рабочего не выселить, не продлить и не оплатить из общих окон; автоматика его не трогает', async () => {
  const { readFileSync } = await import('node:fs');
  const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  const ga = src('src/hooks/useGuestActions.js');
  assert.match(ga, /const handleCheckOut = async \(guest, final\) => \{\s*\/\/[^\n]*\n\s*if \(isContractWorker\(guest\)\) \{ showNotification\(t\('cwCheckoutInContract'\)/);
  assert.match(ga, /if \(isContractWorker\(xg\)\) \{ showNotification\(t\('cwAutoExtend'\)/, 'продление');
  assert.match(ga, /if \(isContractWorker\(guests\.find\(x => x\.id === guestId\)\)\) \{ showNotification\(t\('cwPayByContract'\)/, 'оплата');
  assert.match(ga, /if \(isContractWorker\(guest\)\) continue; \/\/ продлевается сам/, 'массовое продление');
  assert.match(ga, /newPriceCandidates\(guests\.filter\(g => !isContractWorker\(g\)\)/, 'новые цены');
  assert.match(ga, /const handleCheckOutWorkers = async/, 'выселение — отдельным действием договора');
  assert.match(src('src/hooks/useAutoCheckout.js'), /if \(isContractWorker\(guest\)\) continue;/, 'авто-выселение');
  assert.match(src('src/utils/roomBeds.js'), /now > effectiveCo && !activeGuest\.contractWorker/, 'не «просрочен» на койке');
  assert.match(src('src/hooks/useEmehmonAutomation.js'), /const paidOf = \(g\) => \(isContractWorker\(g\) \? 1/, 'e-mehmon: платит договор');
  const gdm = src('src/components/Modals/GuestDetailsModal.jsx');
  assert.match(gdm, /\(!isCheckedOut && isWorker\) \? \(/, 'в карточке вместо кнопок — пометка договора');
  const rooms = src('src/components/Views/RoomsView.jsx');
  assert.match(rooms, /guest\.specialty && <span/, 'в номерах — специальность');
  assert.match(rooms, /\(status === 'occupied' \|\| isTimeout\) && !worker && \(/, 'в номерах нет «Продлить»');
  const ci = src('src/components/Modals/CheckInModal.jsx');
  assert.match(ci, /contractWorker: true,\s*contractGroupId: workerContract\.id,/);
  assert.match(ci, /checkOutDate: nextTashkentMidnightIso\(now\)/);
  assert.match(ci, /if \(!specialty\.trim\(\)\) errs\.specialty/, 'специальность обязательна');
  const fn = src('functions/index.js');
  assert.match(fn, /exports\.contractWorkersMidnight = functions[\s\S]{0,200}schedule\("1 \* \* \* \*"\)\s*\.timeZone\("Asia\/Tashkent"\)/);
  const ws = src('src/components/Views/ManualStay/WorkersSection.jsx');
  assert.match(ws, /\{byRoom\(living\)\.map\(\(\[roomNo, list\]\) =>/, 'в договоре живущие — по своим комнатам');
  assert.match(ws, /actions\.updateWorkers\(specEdit\.ids, \{ specialty: value \}\)/, 'кассир меняет специальность');
  assert.match(ws, /ids: list\.map\(w => w\.id\)/, 'и сразу у всей комнаты');
  assert.match(src('src/components/Views/ManualStayView.jsx'), /updateWorkers: async \(ids, patch\) => \{[\s\S]{0,300}allowed\.specialty = patch\.specialty\.trim\(\)/, 'меняется только специальность');
  const app = src('src/hooks/useAppData.js');
  assert.match(app, /where\('contractGroupId', 'in', ids\)\)\), setGuestsWorkers\)/, 'рабочие договора любой давности');
});

test('долг рабочего — только в договоре: цена от старой кассы не делает его должником', async () => {
  const { chargeOf } = await import('../src/utils/shop.js');
  const { newPriceCandidates, buildPlanSwitch, repricedPrepaidCandidates } = await import('../src/utils/stayPlans.js');
  // Так записала касса на старой версии 20.11.2026
  const g = { id: 'w', contractWorker: true, contractGroupId: 'c1', hostelId: 'hostel2', status: 'active',
    checkInDate: IN, checkOutDate: '2026-11-21T19:00:00.000Z', days: 1, pricePerNight: 80000, totalPrice: 80000, plan: 'room', priceBefore: 0 };
  assert.equal(chargeOf(g), 0, 'гость-рабочий ничего не должен');
  assert.equal(chargeOf({ ...g, contractWorker: false }), 80000, 'обычный гость — как раньше');
  const cfg = { stayPlans: { hostel2: { enabled: true, from: '2026-10-01' } } };
  assert.deepEqual(newPriceCandidates([{ ...g, plan: null, pricePerNight: 0, totalPrice: 0 }], 'hostel2', cfg), []);
  assert.equal(buildPlanSwitch(g, { plan: 'room', price: 80000, at: new Date() }).mode, 'none');
  assert.deepEqual(repricedPrepaidCandidates([{ ...g, priceBefore: 50000, amountPaid: 1 }], 'hostel2'), []);
  // Сервер раз в час обнуляет цену и тариф
  const p = server.extendPatch(g, at('2026-11-20T18:00:00Z'));
  assert.equal(p.pricePerNight, 0); assert.equal(p.totalPrice, 0); assert.equal(p.plan, null);
  assert.equal(server.extendPatch({ ...g, ...p }, at('2026-11-20T18:00:00Z')), null, 'повтор ничего не меняет');
  const { readFileSync } = await import('node:fs');
  assert.match(readFileSync(new URL('../functions/index.js', import.meta.url), 'utf8'), /contractWorkersMidnight[\s\S]{0,200}schedule\("1 \* \* \* \*"\)/, 'каждый час');
});

test('договор: сутки рабочих в «Начислено», без двойного счёта по ФИО', () => {
  const group = { id: 'c1', contractRate: 50000, memberKeys: ['ALIYEV VALI'] };
  const guests = [
    { id: 'w1', fullName: 'ALIYEV VALI', contractWorker: true, contractGroupId: 'c1', status: 'active', checkInDate: IN, days: 1 },
    { id: 'w2', fullName: 'KARIMOV ALI', contractWorker: true, contractGroupId: 'other', status: 'active', checkInDate: IN },
  ];
  const fin = computeContractFinancials(group, guests, [{ contractGroupId: 'c1', cash: 30000 }], at('2026-11-21T05:00:00Z'));
  assert.equal(fin.workerNights, 2);
  assert.equal(fin.autoPersonNights, 0, 'рабочий не считается ещё раз по ФИО');
  assert.equal(fin.contractTotal, 100000);
  assert.equal(fin.debt, 70000);
  assert.equal(fin.workersActive, 1);
});
