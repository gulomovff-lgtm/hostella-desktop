/**
 * Единый расчёт финансов договора (manualStayGroups).
 * ВАЖНО: формула должна совпадать с detailedGroups в ManualStayView,
 * иначе карточка договора и попап аренды покажут разные цифры.
 *
 * Начислено = ставка × человеко-ночи (авто-участники + ручные периоды).
 * Оплачено  = сумма платежей по contractGroupId (фолбэк — group.amountPaid).
 * Долг      = начислено − оплачено (только если начислено > 0).
 */

const entryPersonNights = (entry) => {
  const people = parseInt(entry.people, 10) || 0;
  let nights = 0;
  if (entry.checkIn && entry.checkOut) {
    const ms = new Date(entry.checkOut) - new Date(entry.checkIn);
    nights = ms > 0 ? Math.round(ms / 86400000) : 0;
  }
  if (!nights) nights = parseInt(entry.nights, 10) || 0;
  return people * nights;
};

const stayNights = (stay) => {
  const d = parseInt(stay?.days, 10);
  if (d > 0) return d;
  if (!stay?.checkInDate || !stay?.checkOutDate) return 0;
  const ms = new Date(stay.checkOutDate) - new Date(stay.checkInDate);
  return ms > 0 ? Math.round(ms / 86400000) : 0;
};

export const computeContractFinancials = (group, guests = [], payments = []) => {
  if (!group) return null;

  // Авто-участники: группировка проживающих по ФИО, суммируем ночи по memberKeys
  const memberKeys = group.memberKeys || [];
  let autoPersonNights = 0;
  if (memberKeys.length) {
    const byName = new Map();
    guests.filter(g => g.status !== 'booking').forEach(g => {
      const key = (g.fullName || '—').trim();
      byName.set(key, (byName.get(key) || 0) + stayNights(g));
    });
    autoPersonNights = memberKeys.reduce((s, k) => s + (byName.get(k) || 0), 0);
  }

  const manualEntries = Array.isArray(group.manualEntries) ? group.manualEntries : [];
  const manualPersonNights = manualEntries.reduce((s, e) => s + entryPersonNights(e), 0);
  const totalPersonNights = autoPersonNights + manualPersonNights;

  const contractRate = parseInt(group.contractRate, 10) || 0;
  const contractTotal = contractRate > 0 ? contractRate * totalPersonNights : 0;

  const groupPayments = payments.filter(p => p.contractGroupId === group.id);
  const paidFromRecords = groupPayments.reduce((s, p) => {
    const pAmt = (parseInt(p.cash) || 0) + (parseInt(p.transfer) || 0) + (parseInt(p.card) || 0) + (parseInt(p.qr) || 0);
    return s + (pAmt || parseInt(p.amount) || 0);
  }, 0);
  const paidCash     = groupPayments.reduce((s, p) => s + (parseInt(p.cash) || 0), 0);
  const paidTransfer = groupPayments.reduce((s, p) => s + (parseInt(p.transfer) || 0), 0);
  const paidCard     = groupPayments.reduce((s, p) => s + (parseInt(p.card) || 0), 0);
  const paidQR       = groupPayments.reduce((s, p) => s + (parseInt(p.qr) || 0), 0);

  const amountPaid = paidFromRecords > 0 ? paidFromRecords : (parseInt(group.amountPaid, 10) || 0);
  const debt = contractTotal > 0 ? contractTotal - amountPaid : 0;

  return {
    autoPersonNights, manualPersonNights, totalPersonNights,
    contractRate, contractTotal,
    amountPaid, paidCash, paidTransfer, paidCard, paidQR,
    debt,
    memberCount: memberKeys.length,
    manualCount: manualEntries.length,
  };
};
