/**
 * Сводка долгов для финансового отчёта.
 *
 * Собирает в одну картину три источника, которые в программе живут отдельно:
 *   - гости      (totalPrice − оплачено; та же формула, что на экране «Долги»,
 *                 иначе два экрана показывали бы разные суммы);
 *   - аренда     (rooms[].rental: totalAmount − оплачено);
 *   - договоры   (manualStayGroups через computeContractFinancials).
 *
 * Каждый долг помечается ожидаемым способом оплаты:
 *   'transfer' — по этому долгу уже платили перечислением (значит, и остаток
 *                придёт перечислением, обычно от юрлица);
 *   'regular'  — всё остальное: наличные, карта, QR.
 * Способ выводится из истории платежей, а не задаётся вручную: отдельного поля
 * «как будут платить» в базе нет, а история — единственный честный признак.
 */

import { computeContractFinancials } from './contractFinancials.js'; // .js — чтобы модуль грузился и в node --test
import TRANSLATIONS from '../constants/translations.js'; // .js — чтобы модуль грузился и в node --test

export const DEFAULT_HOSTEL = 'hostel1';

/** Филиал записи. Пусто = первый хостел (общая договорённость проекта). */
export const hostelOf = (item) => item?.hostelId || DEFAULT_HOSTEL;

const num = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };

/** Оплачено гостем — формула экрана «Долги», не менять в отрыве от него.
 *  Защита от NaN/Infinity: битое число в amountPaid раньше делало весь отчёт и
 *  Excel = NaN (любой аноним мог отравить одно поле и сломать всю сверку). */
export const guestPaid = (g) => {
  const p = Number(g?.amountPaid);
  return Number.isFinite(p) ? p : (num(g?.paidCash) + num(g?.paidCard) + num(g?.paidQR));
};

/** Платили ли по этим записям перечислением и от кого. */
const transferInfo = (pays = []) => {
  let transferred = 0;
  const entities = new Set();
  pays.forEach(p => {
    const t = num(p.transfer);
    if (t > 0) {
      transferred += t;
      if (p.transferTo) entities.add(p.transferTo);
    }
  });
  return { transferred, entities: [...entities] };
};

const emptyBucket = () => ({ debt: 0, count: 0, transfer: 0, regular: 0 });

const addTo = (bucket, row) => {
  bucket.debt += row.debt;
  bucket.count += 1;
  if (row.method === 'transfer') bucket.transfer += row.debt;
  else bucket.regular += row.debt;
};

/**
 * @param {object}   opts
 * @param {Array}    opts.guests          гости (уже отфильтрованные по правам)
 * @param {Array}    opts.rooms           комнаты (для аренды)
 * @param {Array}    opts.contractGroups  договоры/бригады
 * @param {Array}    opts.payments        платежи (для способа оплаты и сумм по договорам)
 * @param {string?}  opts.hostelId        оставить только этот филиал (null = все)
 */
export const buildDebtReport = ({
  guests = [], rooms = [], contractGroups = [], payments = [], hostelId = null, lang = 'ru',
} = {}) => {
  const t = k => TRANSLATIONS[lang]?.[k] || k;
  const inScope = (h) => !hostelId || h === hostelId;
  const rows = [];

  // ── Гости: группируем по должнику, как на экране «Долги» ──────────────────
  const byDebtor = new Map();
  guests.forEach(g => {
    if (g.status === 'booking') return;
    const debt = num(g.totalPrice) - guestPaid(g);
    if (debt <= 0) return;
    const h = hostelOf(g);
    if (!inScope(h)) return;
    const key = `${h}|${g.passport || g.fullName || g.id}`;
    if (!byDebtor.has(key)) {
      byDebtor.set(key, {
        source: 'guest', id: key, name: g.fullName || '—',
        detail: g.roomNumber ? `${t('roomWord')} ${g.roomNumber}` : (g.phone || ''),
        hostelId: h, charged: 0, paid: 0, debt: 0, records: 0, guestIds: [],
      });
    }
    const row = byDebtor.get(key);
    row.charged += num(g.totalPrice);
    row.paid += guestPaid(g);
    row.debt += debt;
    row.records += 1;
    row.guestIds.push(g.id);
  });
  byDebtor.forEach(row => {
    const pays = payments.filter(p => row.guestIds.includes(p.guestId));
    const { transferred, entities } = transferInfo(pays);
    rows.push({ ...row, method: transferred > 0 ? 'transfer' : 'regular', entities });
  });

  // ── Аренда комнат ─────────────────────────────────────────────────────────
  rooms.forEach(r => {
    const rt = r.rental;
    if (!rt?.active) return;
    const h = hostelOf(r);
    if (!inScope(h)) return;
    const paid = num(rt.paidCash) + num(rt.paidCard) + num(rt.paidQR) + num(rt.paidTransfer);
    const debt = num(rt.totalAmount) - paid;
    if (debt <= 0) return;
    const pays = payments.filter(p => p.roomId === r.id || p.rentalRoomId === r.id);
    const { entities } = transferInfo(pays);
    rows.push({
      source: 'rental', id: `rental|${r.id}`,
      name: rt.tenantName || `${t('roomWord')} ${r.number}`,
      detail: `${t('roomWord')} ${r.number}`,
      hostelId: h, charged: num(rt.totalAmount), paid, debt, records: 1,
      method: num(rt.paidTransfer) > 0 ? 'transfer' : 'regular', entities,
    });
  });

  // ── Договоры (бригады) ────────────────────────────────────────────────────
  contractGroups.forEach(gr => {
    const h = hostelOf(gr);
    if (!inScope(h)) return;
    const fin = computeContractFinancials(gr, guests, payments);
    if (!fin || fin.debt <= 0) return;
    const pays = payments.filter(p => p.contractGroupId === gr.id);
    const { transferred, entities } = transferInfo(pays);
    rows.push({
      source: 'contract', id: `contract|${gr.id}`,
      name: gr.name || t('brmUnnamed'),
      detail: fin.contractRate > 0 ? t('dbrRateLine').replace('{rate}', fin.contractRate.toLocaleString('ru')).replace('{n}', fin.totalPersonNights) : '',
      hostelId: h, charged: fin.contractTotal, paid: fin.amountPaid, debt: fin.debt,
      records: 1, method: transferred > 0 ? 'transfer' : 'regular', entities,
      closed: !!gr.closed, completed: !!gr.completed,
    });
  });

  rows.sort((a, b) => b.debt - a.debt);

  // ── Сводки ────────────────────────────────────────────────────────────────
  const totals = emptyBucket();
  const bySource = { guest: emptyBucket(), rental: emptyBucket(), contract: emptyBucket() };
  const hostelMap = new Map();
  const entityMap = new Map();

  rows.forEach(row => {
    addTo(totals, row);
    addTo(bySource[row.source], row);
    if (!hostelMap.has(row.hostelId)) {
      hostelMap.set(row.hostelId, { hostelId: row.hostelId, ...emptyBucket(), guest: 0, rental: 0, contract: 0 });
    }
    const h = hostelMap.get(row.hostelId);
    addTo(h, row);
    h[row.source] += row.debt;
    if (row.method === 'transfer') {
      const key = row.entities[0] || t('dbrReceiverNotSet');
      entityMap.set(key, (entityMap.get(key) || 0) + row.debt);
    }
  });

  return {
    rows,
    totals,
    bySource,
    byHostel: [...hostelMap.values()].sort((a, b) => b.debt - a.debt),
    byEntity: [...entityMap.entries()].map(([entity, debt]) => ({ entity, debt })).sort((a, b) => b.debt - a.debt),
  };
};

/** Ожидаемая прибыль: собранное за период плюс то, что ещё должны. */
export const expectedProfit = (periodNet, debtTotal) => (periodNet || 0) + (debtTotal || 0);
