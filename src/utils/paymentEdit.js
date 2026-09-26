/**
 * paymentEdit.js — ручная оплата от имени супера: добавить или исправить
 * запись кассы за любой день, любому кассиру и проживающему.
 *
 * Решение владельца (2026-09-25): запись должна быть «как обычный платёж» —
 * тот же формат документа, что пишет касса при приёме оплаты
 * (useGuestActions.logTransaction), без пометок «добавлено супером». Поэтому
 * здесь нет ни одного служебного поля: отчёт, смена кассира и долг гостя
 * видят её ровно как оплату, принятую этим кассиром в этот момент.
 *
 * Добавленная запись деньги гостя НЕ меняет (решение владельца 2026-09-25):
 * это поправка отчёта и смены кассира, а оплаченное у гостя уже стоит как
 * есть. Такая запись несёт невидимое в интерфейсе поле reportOnly — по нему
 * удаление и исправление тоже не трогают гостя. У обычной оплаты кассы
 * (без reportOnly) исправление по-прежнему двигает деньги гостя: старое
 * снять, новое положить, в т.ч. если сменился гость.
 *
 * Без React и Firestore — покрыто тестами.
 */

export const METHODS = ['cash', 'card', 'qr', 'transfer'];

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/**
 * Разложение записи по способам. Касса пишет два вида документов:
 *   • оплата из карточки — { amount, method } (logTransaction);
 *   • оплата при заселении — { amount, cash, card, qr, transfer, balance, method:'split'|… }.
 * Раньше удаление читало только второй вид, и у первого снимало amountPaid,
 * но не paidCash/paidCard — сумма по способам у гостя расходилась с итогом.
 */
export function paymentSplit(p = {}) {
  const hasParts = ['cash', 'card', 'qr', 'transfer', 'balance'].some(k => p[k] !== undefined && p[k] !== null && p[k] !== '');
  if (hasParts) {
    return { cash: num(p.cash), card: num(p.card), qr: num(p.qr), transfer: num(p.transfer), balance: num(p.balance) };
  }
  const amount = num(p.amount);
  const out = { cash: 0, card: 0, qr: 0, transfer: 0, balance: 0 };
  const m = METHODS.includes(p.method) ? p.method : 'cash';
  out[m] = amount;
  return out;
}

export const splitTotal = (s) => num(s.cash) + num(s.card) + num(s.qr) + num(s.transfer) + num(s.balance);

/** Можно ли исправлять запись этим окном. */
export function editableReason(p = {}) {
  if (p.type === 'cash_to_terminal') return 'ctt';
  if (p.category === 'registration' || p.registrationId) return 'registration';
  if (p.category === 'service' || p.saleId) return 'service';            // продажа — отменяется в «Услугах и товарах»
  if (num(p.balance) > 0 || p.method === 'balance') return 'balance';   // оплата с баланса клиента — удалить и внести заново
  return '';
}

/**
 * Поля записи кассы для сохранения — формат обычной оплаты из карточки гостя.
 * У исправляемой записи с разложением по способам разложение переписываем
 * под новый способ, чтобы старые поля не противоречили сумме.
 */
export function buildPaymentFields({ guestId, staffId, amount, method, date, hostelId }, existing = null) {
  const m = METHODS.includes(method) ? method : 'cash';
  const a = Math.round(num(amount));
  const fields = { guestId: guestId || '', staffId: staffId || '', amount: a, method: m, date, hostelId: hostelId || '' };
  // Новая запись — только в отчёт: деньги гостя не трогает ни она, ни её удаление.
  if (!existing) fields.reportOnly = true;
  if (existing) {
    const hadParts = ['cash', 'card', 'qr', 'transfer'].some(k => existing[k] !== undefined);
    if (hadParts) {
      for (const k of METHODS) fields[k] = k === m ? a : 0;
      if (existing.balance !== undefined) fields.balance = 0;
    }
  }
  return fields;
}

/** Инкременты денег гостя: { [guestId]: { paidCash, paidCard, paidQR, paidTransfer, amountPaid } }. */
export function guestDeltas(oldP = null, newP = null) {
  const acc = {};
  const add = (p, sign) => {
    if (!p || !p.guestId || p.reportOnly) return;   // поправка отчёта — деньги гостя не двигает
    const s = paymentSplit(p);
    const d = acc[p.guestId] || (acc[p.guestId] = { paidCash: 0, paidCard: 0, paidQR: 0, paidTransfer: 0, amountPaid: 0 });
    d.paidCash += sign * s.cash;
    d.paidCard += sign * s.card;
    d.paidQR += sign * s.qr;
    d.paidTransfer += sign * s.transfer;
    d.amountPaid += sign * (num(p.amount) || splitTotal(s));
  };
  add(oldP, -1);
  add(newP, +1);
  // нулевые поля убираем: paidTransfer не заводим гостю, у которого его не было
  for (const id of Object.keys(acc)) {
    const d = acc[id];
    for (const k of Object.keys(d)) if (!d[k]) delete d[k];
    if (!Object.keys(d).length) delete acc[id];
  }
  return acc;
}

/** Проверка ввода: вернёт ключ ошибки или ''. */
export function validatePaymentInput({ guestId, staffId, amount, date, hostelId } = {}) {
  if (!guestId) return 'guest';
  if (!staffId) return 'staff';
  if (!hostelId) return 'hostel';
  if (!(Math.round(num(amount)) > 0)) return 'amount';
  const t = new Date(date || '').getTime();
  if (!Number.isFinite(t)) return 'date';
  if (t > Date.now() + 5 * 60 * 1000) return 'future';
  return '';
}

/** Поиск проживающего: ФИО, паспорт или номер комнаты; активные выше, свежие выше. */
export function searchGuests(guests = [], q = '', { hostelId = '', limit = 30 } = {}) {
  const s = String(q || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const pass = s.replace(/\s/g, '');
  const pool = (guests || []).filter(g => g && g.roomId !== 'DEBT_ONLY' && (!hostelId || (g.hostelId || 'hostel1') === hostelId));
  // 1–3 цифры — это номер комнаты, а не кусок паспорта
  const roomOnly = /^\d{1,3}$/.test(s);
  const hit = !s ? pool : roomOnly ? pool.filter(g => String(g.roomNumber || '') === s) : pool.filter(g =>
    String(g.fullName || '').toUpperCase().includes(s) ||
    (pass && String(g.passport || '').replace(/\s/g, '').toUpperCase().includes(pass)) ||
    String(g.roomNumber || '') === s);
  const rank = (g) => (g.status === 'active' ? 2 : g.status === 'checked_out' ? 1 : 0);
  return [...hit].sort((a, b) => rank(b) - rank(a) || String(b.checkInDate || '').localeCompare(String(a.checkInDate || ''))).slice(0, limit);
}
