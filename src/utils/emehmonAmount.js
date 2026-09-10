/**
 * emehmonAmount — стоимость услуг, которую указываем в e-mehmon.
 *
 * Портал ждёт сумму за фактическое проживание, а не разовую ставку: прожил
 * 10 суток по 30 000 — значит 300 000. Поэтому сумму пересчитываем каждый день,
 * пока гость живёт, и после каждого продления.
 *
 * Сутки считаем ТОЙ ЖЕ формулой, что и сам портал (SmartService::calcDays,
 * продублирована в /listok на клиенте):
 *     round(секунды / 86400 + 0.35), минимум 1
 * В целых числах это floor((сек + 73440) / 86400) — так на границе суток не
 * возникает расхождения с порталом из-за округления дробных чисел.
 * Практически: +1 сутки, когда время выезда на 3 ч 36 мин позже времени заезда.
 *
 * Без JSX и импортов — модуль покрыт тестами и используется в приложении.
 */

/** Смещение округления портала: (1 − 0.35 + 0.5) × 86400. */
const DAYS_ROUNDING_OFFSET_SEC = 73440;

/**
 * Сколько суток проживания засчитывает портал на момент now.
 * @param {string} checkInDate  — ISO-дата заезда
 * @param {string} [checkOutDate] — ISO-дата выезда: после неё счётчик не растёт
 */
export const emehmonStayDays = (checkInDate, checkOutDate = null, now = Date.now()) => {
  const inMs = new Date(checkInDate || 0).getTime();
  if (!Number.isFinite(inMs) || inMs <= 0) return 0;

  // Гость уже уехал — считаем по факту выезда, а не по «сегодня»
  const outMs = checkOutDate ? new Date(checkOutDate).getTime() : NaN;
  const tillMs = Number.isFinite(outMs) ? Math.min(now, outMs) : now;

  const sec = Math.floor((tillMs - inMs) / 1000);
  if (!Number.isFinite(sec)) return 0;
  return Math.max(1, Math.floor((sec + DAYS_ROUNDING_OFFSET_SEC) / 86400));
};

/**
 * Сумма для портала: суточная ставка × прожитые сутки.
 * @param {object} guest — { checkInDate, checkOutDate }
 * @param {number} dailyRate — ставка за сутки (30 000 местным, 50 000 иностранцам)
 */
export const emehmonAmountForStay = (guest, dailyRate, now = Date.now()) => {
  const rate = Number(dailyRate);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  const days = emehmonStayDays(guest?.checkInDate, guest?.checkOutDate, now);
  return days * rate;
};

/**
 * Нужно ли отправлять новую сумму в портал.
 * Шлём только при реальном изменении: лишние запросы к порталу ни к чему.
 */
export const needsAmountUpdate = (currentAmount, targetAmount) => {
  const cur = Number(currentAmount);
  const tgt = Number(targetAmount);
  if (!Number.isFinite(tgt) || tgt <= 0) return false;
  if (!Number.isFinite(cur)) return true;
  return Math.round(cur) !== Math.round(tgt);
};
