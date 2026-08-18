/**
 * Единый расчёт финансов договора (manualStayGroups).
 * ВАЖНО: формула должна совпадать с detailedGroups в ManualStayView,
 * иначе карточка договора и попап аренды покажут разные цифры.
 *
 * Начислено = ставка × человеко-ночи (авто-участники + ручные периоды)
 *             + доп. расходы (extraCharges: произвольные позиции с ценой)
 *             − списания (позиции с writeOff: true — см. ниже).
 * Оплачено  = сумма платежей по contractGroupId (фолбэк — group.amountPaid).
 * Долг      = начислено − оплачено (только если начислено > 0).
 *
 * СПИСАНИЕ ДОЛГА (writeOff). Админ может уменьшить долг договора, не проводя
 * денег: скидка, прощённый остаток, договорённость. Хранится в том же массиве
 * extraCharges с флагом writeOff и отрицательной суммой, но:
 *   - платёжная запись НЕ создаётся — кассовые отчёты и смены не искажаются;
 *   - в extraCharges функция возвращает только ВИДИМЫЕ позиции, поэтому ни один
 *     отчёт (бригадный, общий, попапы аренды) списание отдельной строкой не
 *     покажет — оно молча сидит внутри «Начислено».
 * Сами списания доступны отдельно: writeOffs / writeOffTotal — их показывает
 * только карточка договора у админа.
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

/** Сумма позиций (доп. расходов или списаний). */
export const sumCharges = (charges = []) =>
  charges.reduce((s, c) => s + (parseInt(c.amount, 10) || 0), 0);

/** Списание — служебная позиция, скрытая от всех отчётов. */
export const isWriteOff = (charge) => !!charge?.writeOff;

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
  const rateTotal = contractRate > 0 ? contractRate * totalPersonNights : 0;
  // Доп. расходы: произвольные позиции (стирка, транспорт, питание…) с ценами
  const allCharges = Array.isArray(group.extraCharges) ? group.extraCharges : [];
  const extraCharges = allCharges.filter(c => !c.writeOff);
  const writeOffs = allCharges.filter(c => c.writeOff);
  const extraTotal = sumCharges(extraCharges);
  // Списания хранятся отрицательными; writeOffTotal — положительная «сколько списано»
  const writeOffTotal = -sumCharges(writeOffs) || 0; // || 0 — чтобы не получить -0
  const contractTotal = rateTotal + extraTotal - writeOffTotal;

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
    contractRate, rateTotal, extraTotal, extraCharges, contractTotal,
    writeOffs, writeOffTotal,
    amountPaid, paidCash, paidTransfer, paidCard, paidQR,
    debt,
    memberCount: memberKeys.length,
    manualCount: manualEntries.length,
  };
};
