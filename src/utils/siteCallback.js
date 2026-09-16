/**
 * siteCallback — обратная связь приложения с сайтом hostella.uz.
 *
 * Когда кассир подтверждает/отклоняет/заселяет бронь с сайта или из Telegram-бота,
 * сообщаем сайту: он обновит статус в своей БД (страница «Проверка брони») и
 * отправит гостю уведомление в Telegram (если бронь создана через бота).
 *
 * Работает только для броней с bookingCode (HS-XXXXXX) — ручные брони пропускаются.
 * Сбой сети не должен ломать основную операцию: всегда резолвится объектом.
 */
import { getConfig } from './appConfig';

/**
 * @param {object} booking — документ брони (нужен bookingCode)
 * @param {'confirmed'|'cancelled'|'checked_in'} action
 * @returns {Promise<{status:string, notified?:boolean, message?:string}>}
 */
export async function notifySiteBooking(booking, action) {
  try {
    const code = booking?.bookingCode;
    if (!code) return { status: 'skipped' };
    const cfg = getConfig();
    const url = cfg.siteCallbackUrl || 'https://hostella.uz/crm-callback.php';
    const key = cfg.siteCallbackKey || 'hst-cb-a81f37c2d94e';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, code, action }),
    });
    const d = await res.json().catch(() => null);
    return d && typeof d === 'object' ? d : { status: res.ok ? 'ok' : 'error' };
  } catch (e) {
    return { status: 'error', message: e?.message || 'network' };
  }
}
