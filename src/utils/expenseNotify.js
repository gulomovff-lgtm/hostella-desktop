import TRANSLATIONS from '../constants/translations';
import { sendTelegramMessage, escapeTg } from './telegram';

/**
 * Уведомление «Расход» в группу — одно для всех мест, где кассир тратит из кассы.
 *
 * Раньше его слало только окно «Расход». Расход из регистрации в кадастре и
 * аванс попадали в кассу и отчёт молча — владелец не видел их в группе
 * (25.10.2026: «Регистрация» 32 000 у кассира). «Возврат», записанный через
 * окно «Расход», не уходил вовсе — теперь он идёт уведомлением о возврате.
 *
 * Не шлём: расход админа/супера, «мимо кассы» (skipCashbox), нулевую сумму.
 */
export function notifyExpense({ currentUser, lang = 'ru', hostelId, category, amount, comment, skipCashbox = false }) {
  const role = currentUser?.role;
  const sum = Number(amount) || 0;
  if (!currentUser || role === 'admin' || role === 'super') return null;
  if (skipCashbox || sum <= 0) return null;
  const t = (k) => TRANSLATIONS[lang]?.[k] || TRANSLATIONS.ru?.[k] || k;
  const isRefund = category === 'Возврат';
  const hostelLabel = hostelId === 'hostel1' ? t('expHostel1') : hostelId === 'hostel2' ? t('expHostel2') : hostelId || '—';
  const text = (isRefund ? `💸 <b>${t('gaTgRefundTitle')}</b>` : `💳 <b>${t('expense')}</b>`)
    + `\n🏨 ${hostelLabel}`
    + (isRefund ? '' : `\n📂 ${escapeTg(category)}`)
    + `\n💰 ${sum.toLocaleString()} ${t('sum')}`
    + (comment ? `\n💬 ${escapeTg(comment)}` : '')
    + `\n👤 ${t('cashier')}: ${escapeTg(currentUser.name || currentUser.login)}`;
  return sendTelegramMessage(text, isRefund ? 'refund' : 'expenseAdded');
}
