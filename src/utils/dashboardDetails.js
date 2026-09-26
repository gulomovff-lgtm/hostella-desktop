/**
 * dashboardDetails.js — расчёты для окон «подробно» у плиток дашборда
 * (владелец 2026-09-25: «блоки на дашборде активными — нажать и подробно всё»).
 * Суммы групп сходятся с цифрой на плитке: плитка «Доход» — сумма amount,
 * поэтому часть, не разложенная по способам (баланс и т.п.), идёт в «Прочее».
 */
import { paymentMethods } from './cashierTimeline.js';

export const METHOD_ORDER = ['cash', 'card', 'qr', 'transfer', 'balance', 'other'];

const amt = (p) => parseInt(p?.amount) || 0;
const byDateAsc = (a, b) => String(a.p?.date || a.date || '').localeCompare(String(b.p?.date || b.date || ''));

/** Оплаты → группы по способам [{ p, amount }], сумма всех групп = Σ amount. */
export function groupByMethod(payments = []) {
  const groups = Object.fromEntries(METHOD_ORDER.map(k => [k, []]));
  for (const p of payments) {
    const total = amt(p);
    if (!total) continue;
    const m = paymentMethods(p);
    let used = 0;
    for (const k of ['cash', 'card', 'qr', 'transfer', 'balance']) {
      if (m[k]) { groups[k].push({ p, amount: m[k] }); used += m[k]; }
    }
    if (total - used) groups.other.push({ p, amount: total - used });
  }
  for (const k of METHOD_ORDER) groups[k].sort(byDateAsc);
  const totals = Object.fromEntries(METHOD_ORDER.map(k => [k, groups[k].reduce((s, x) => s + x.amount, 0)]));
  return { groups, totals };
}

/** Сумма по кассирам: [{ staffId, total, count }] по убыванию. */
export function byStaff(payments = []) {
  const m = new Map();
  for (const p of payments) {
    const k = String(p.staffId || '—');
    const r = m.get(k) || { staffId: k, total: 0, count: 0 };
    r.total += amt(p); r.count++;
    m.set(k, r);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

/** По дням: [{ ds, total, cash, card, qr, transfer, other, payments }] — свежие сверху. */
export function byDay(payments = [], dayOf) {
  const m = new Map();
  for (const p of payments) {
    const ds = dayOf(p.date);
    if (!ds) continue;
    const r = m.get(ds) || { ds, total: 0, cash: 0, card: 0, qr: 0, transfer: 0, other: 0, payments: [] };
    const mm = paymentMethods(p);
    const total = amt(p);
    r.total += total;
    r.cash += mm.cash; r.card += mm.card; r.qr += mm.qr; r.transfer += mm.transfer;
    r.other += total - mm.cash - mm.card - mm.qr - mm.transfer;
    r.payments.push(p);
    m.set(ds, r);
  }
  const out = [...m.values()].sort((a, b) => b.ds.localeCompare(a.ds));
  for (const r of out) r.payments.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return out;
}

/** Расходы по статьям: [{ category, total, items }] по убыванию. */
export function expensesByCategory(expenses = []) {
  const m = new Map();
  for (const e of expenses) {
    const k = e.category || '—';
    const r = m.get(k) || { category: k, total: 0, items: [] };
    r.total += amt(e); r.items.push(e);
    m.set(k, r);
  }
  const out = [...m.values()].sort((a, b) => b.total - a.total);
  for (const r of out) r.items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return out;
}

/** Свободные места комнаты: номера коек 1..capacity, не занятые активными гостями. */
export function freeBedsOf(room, activeGuests = []) {
  const cap = parseInt(room?.capacity) || 0;
  if (!cap || room?.rental?.active) return [];
  const taken = new Set(activeGuests.filter(g => g.roomId === room.id).map(g => String(g.bedId)));
  const out = [];
  for (let i = 1; i <= cap; i++) if (!taken.has(String(i))) out.push(i);
  // Гостей больше, чем коек, или места названы не числами — считаем по количеству
  const occupied = activeGuests.filter(g => g.roomId === room.id).length;
  return out.slice(0, Math.max(0, cap - occupied));
}
