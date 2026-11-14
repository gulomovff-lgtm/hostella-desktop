// Сверка листков сайта кадастра с записями Hostella (13.11.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSiteDt, planKadastrSync } from '../src/utils/kadastrSync.js';

const now = new Date('2026-11-13T12:00:00');
const row = (o) => ({ id: '536108', name: 'ODINAEV AHLIDDIN XXX', passport: '405459377', dt: '13.11.2026 14:46', wdays: 5, paid: false, payUrl: 'https://reg.emehmon.uz/listovka/payTS/3kFsn-bmNhk', ...o });
const guest = { id: 'g1', status: 'active', roomId: 'r1', hostelId: 'hostel1', passport: '405459377', fullName: 'ODINAYEV AXLIDDIN', country: 'Таджикистан' };
const houses = [{ id: 'c1', hostelId: 'hostel1', address: 'Ниёзбек Йули 43', active: true }];

test('дата сайта dd.mm.yyyy HH:MM', () => {
  assert.equal(parseSiteDt('13.11.2026 14:46').ymd, '2026-11-13');
  assert.equal(parseSiteDt('мусор'), null);
});

test('неверные дни в Hostella — правим по сайту', () => {
  const reg = { id: 'r1', status: 'active', passport: '405459377', startDate: '2026-11-13', endDate: '2026-11-20', days: 8 };
  const p = planKadastrSync({ rows: [row()], regs: [reg], guests: [guest], cadastres: houses, now });
  assert.equal(p.fixes.length, 1);
  assert.equal(p.fixes[0].patch.endDate, '2026-11-17');
  assert.equal(p.fixes[0].patch.days, 5);
  assert.equal(p.fixes[0].patch.portal.listokId, '536108');
  assert.equal(p.creates.length, 0);
});

test('продление новым листком: начало остаётся раннее, конец и дни по сайту', () => {
  const reg = { id: 'r1', status: 'active', passport: '405459377', startDate: '2026-11-05', endDate: '2026-11-12', days: 8 };
  const p = planKadastrSync({ rows: [row()], regs: [reg], guests: [guest], cadastres: houses, now });
  assert.deepEqual({ s: p.fixes[0].patch.startDate, e: p.fixes[0].patch.endDate, d: p.fixes[0].patch.days }, { s: undefined, e: '2026-11-17', d: 13 });
});

test('всё совпадает — ничего не пишем', () => {
  const reg = { id: 'r1', status: 'active', passport: '405459377', startDate: '2026-11-13', endDate: '2026-11-17', days: 5,
    portal: { status: 'saved', listokId: '536108', payUrl: 'https://reg.emehmon.uz/listovka/payTS/3kFsn-bmNhk', savedAt: 'x' } };
  const p = planKadastrSync({ rows: [row()], regs: [reg], guests: [guest], cadastres: houses, now });
  assert.equal(p.fixes.length, 0);
});

test('на сайте есть, в Hostella не указан — создаём живущему, только касса его филиала', () => {
  const p = planKadastrSync({ rows: [row()], regs: [], guests: [guest], cadastres: houses, createHostelId: 'hostel1', now });
  assert.equal(p.creates.length, 1);
  const c = p.creates[0];
  assert.deepEqual([c.guestId, c.startDate, c.endDate, c.days, c.amount, c.addToExpenses, c.silent], ['g1', '2026-11-13', '2026-11-17', 5, 0, false, true]);
  assert.equal(c.cadastreId, 'c1');
  assert.equal(planKadastrSync({ rows: [row()], regs: [], guests: [guest], cadastres: houses, createHostelId: 'hostel2', now }).creates.length, 0, 'чужой филиал не создаёт');
  assert.equal(planKadastrSync({ rows: [row()], regs: [], guests: [guest], cadastres: houses, createHostelId: null, now }).creates.length, 0, 'супер только правит');
});

test('гостя нет среди живущих — не создаём; старые листки не трогаем; у человека берём последний листок', () => {
  const p = planKadastrSync({ rows: [row()], regs: [], guests: [], cadastres: houses, createHostelId: 'hostel1', now });
  assert.equal(p.creates.length, 0); assert.equal(p.unmatched.length, 1);
  const old = planKadastrSync({ rows: [row({ dt: '01.10.2026 10:00', wdays: 3 })], regs: [], guests: [guest], cadastres: houses, createHostelId: 'hostel1', now });
  assert.equal(old.creates.length + old.unmatched.length, 0);
  const two = planKadastrSync({ rows: [row(), row({ id: '528901', dt: '05.11.2026 18:16', wdays: 7 })], regs: [], guests: [guest], cadastres: houses, createHostelId: 'hostel1', now });
  assert.equal(two.creates.length, 1); assert.equal(two.creates[0].startDate, '2026-11-13');
});

test('оплачено на сайте — отметка paidAt', () => {
  const reg = { id: 'r1', status: 'active', passport: '405459377', startDate: '2026-11-13', endDate: '2026-11-17', days: 5, portal: { status: 'saved', listokId: '536108', payUrl: '' } };
  const p = planKadastrSync({ rows: [row({ paid: true, payUrl: '' })], regs: [reg], guests: [guest], cadastres: houses, now });
  assert.ok(p.fixes[0].patch.portal.paidAt);
});

test('программа запускает сверку после входа и раз в час', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /planKadastrSync\(\{ rows: r\.rows/);
  assert.match(app, /setTimeout\(run, 90 \* 1000\)/);
  assert.match(app, /setInterval\(run, 60 \* 60 \* 1000\)/);
});

test('продлили в Hostella после листка — конец не откатываем; когда листок кончился — оформить новый', () => {
  // листок 13.11 на 5 дней (по 17.11); в Hostella продлили до 22.11 позже листка
  const reg = { id: 'r1', status: 'active', hostelId: 'hostel1', guestId: 'g1', passport: '405459377', startDate: '2026-11-13', endDate: '2026-11-22', days: 10,
    extendedAt: '2026-11-14T08:00:00.000Z', portal: { status: 'saved', listokId: '536108', payUrl: 'https://reg.emehmon.uz/listovka/payTS/3kFsn-bmNhk', savedAt: '2026-11-13T09:46:00.000Z' } };
  const p = planKadastrSync({ rows: [row()], regs: [reg], guests: [guest], cadastres: houses, createHostelId: 'hostel1', now });
  assert.equal(p.fixes.length, 0, 'конец 22.11 не трогаем');
  assert.equal(p.toRegister.length, 0, 'пока действует листок по 17.11 — рано');
  const later = planKadastrSync({ rows: [row()], regs: [reg], guests: [guest], cadastres: houses, createHostelId: 'hostel1', now: new Date('2026-11-18T10:00:00') });
  assert.equal(later.toRegister.length, 1);
  assert.equal(later.toRegister[0].days, 5, '18–22 ноября');
});

test('листок не прошёл — сверка повторит сама; неисправимый отказ — не чаще раза в сутки; «оформляется» — не трогаем', () => {
  const base = { id: 'r1', status: 'active', hostelId: 'hostel1', guestId: 'g1', passport: '405459377', startDate: '2026-11-13', endDate: '2026-11-17', days: 5 };
  const run = (portal) => planKadastrSync({ rows: [], regs: [{ ...base, portal }], guests: [guest], cadastres: houses, createHostelId: 'hostel1', now }).toRegister.length;
  assert.equal(run(undefined), 1);
  assert.equal(run({ status: 'error', error: 'need_login', at: '2026-11-13T06:00:00.000Z' }), 1);
  assert.equal(run({ status: 'error', error: 'not_found', at: '2026-11-13T06:00:00.000Z' }), 0);
  assert.equal(run({ status: 'error', error: 'not_found', at: '2026-11-11T06:00:00.000Z' }), 1);
  assert.equal(run({ status: 'pending', at: new Date(now.getTime() - 30 * 60e3).toISOString() }), 0);
  assert.equal(planKadastrSync({ rows: [], regs: [{ ...base }], guests: [guest], cadastres: houses, createHostelId: 'hostel2', now }).toRegister.length, 0, 'чужой филиал');
});

test('лимит кадастра — 30 дней от КПП (или более позднего въезда с сайта)', async () => {
  const { cadastreLimitEnd, cadastreLimitFor } = await import('../src/utils/kadastrPortal.js');
  assert.equal(cadastreLimitEnd('2026-11-01'), '2026-11-30', 'въезд — 1-й день из 30');
  assert.equal(cadastreLimitFor({ kppDate: '2026-11-11' }, []), '2026-12-10');
  assert.equal(cadastreLimitFor({ kppDate: '2026-10-01' }, [{ portal: { maxEnd: '2026-11-30' } }]), '2026-11-30', 'сайт знает въезд позже');
  assert.equal(cadastreLimitFor({}, []), '');
});

test('30 дней от КПП прошли — сверка не оформляет и откатывает продление к листку', () => {
  const g = { ...guest, kppDate: '2026-10-10' };   // предел 08.11
  const reg = { id: 'r1', status: 'active', hostelId: 'hostel1', guestId: 'g1', passport: '405459377', startDate: '2026-11-05', endDate: '2026-11-15', days: 11, extendedAt: '2026-11-13T12:00:00.000Z' };
  const p = planKadastrSync({ rows: [row({ dt: '05.11.2026 18:45', wdays: 8 })], regs: [reg], guests: [g], cadastres: houses, createHostelId: 'hostel1', now });
  assert.equal(p.toRegister.length, 0);
  assert.ok(p.fixes.some(f => f.patch.endDate === '2026-11-12'), 'конец — по последнему листку');
  const ok = planKadastrSync({ rows: [row({ dt: '05.11.2026 18:45', wdays: 8 })], regs: [reg], guests: [{ ...guest, kppDate: '2026-11-11' }], cadastres: houses, createHostelId: 'hostel1', now });
  assert.equal(ok.toRegister.length, 1, 'КПП 11.11 — предел 10.12, продление оформляем');
  assert.equal(ok.toRegister[0].days, 3, '13–15 ноября');
});

test('админ/супер (\'*\') заводят записи гостям любого филиала, но листки не оформляют', () => {
  const now = new Date('2026-11-14T10:00:00');
  const g2 = { id: 'g2', status: 'active', roomId: 'r', passport: 'AB1234567', fullName: 'X', hostelId: 'hostel2', country: 'Таджикистан' };
  const rows = [{ id: '9', passport: 'AB1234567', dt: '12.11.2026 10:00', wdays: 10 }];
  const boss = planKadastrSync({ rows, regs: [], guests: [g2], cadastres: [], createHostelId: '*', now });
  assert.equal(boss.creates.length, 1, 'листок с сайта, оформленный до автоматики, — запись в Hostella');
  assert.equal(boss.creates[0].hostelId, 'hostel2');
  const cashier1 = planKadastrSync({ rows, regs: [], guests: [g2], cadastres: [], createHostelId: 'hostel1', now });
  assert.equal(cashier1.creates.length, 0, 'касса чужого филиала не заводит');
  const reg = { id: 'r1', status: 'active', passport: 'AB1234567', guestId: 'g2', hostelId: 'hostel2', startDate: '2026-11-10', endDate: '2026-11-20', days: 11 };
  assert.equal(planKadastrSync({ rows: [], regs: [reg], guests: [g2], createHostelId: '*', now }).toRegister.length, 0, 'оформлять листки — только своя касса');
});
