import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { enqueueTelegram } from './offlineQueue';
import { reportError } from './errorLog';

// API токен не хранится на фронте — всё через Cloud Functions

/**
 * Экранирование пользовательских данных для Telegram parse_mode:HTML.
 * Имя гостя/комментарий/получатель перевода задаются людьми (в т.ч. через
 * ПУБЛИЧНЫЙ виджет брони), поэтому значение вида `<a href="evil">…</a>` без
 * экранирования отрисовалось бы как фишинг-ссылка в доверенном канале персонала,
 * а неподдерживаемый тег (`<script>`) вызвал бы HTTP 400 и потерю уведомления.
 * Экранируем только эти три символа — Telegram HTML требует ровно этого.
 */
export const escapeTg = (s = '') =>
    String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Send a Telegram notification.
 * @param {string} text  - Message text (HTML)
 * @param {string} [notificationType] - Type key from NOTIFICATION_TYPES (e.g. 'checkin')
 *        If omitted, sends to all active recipients.
 * @param {string[]} [chatIds] - Override: send to specific chat IDs only.
 */
export const sendTelegramMessage = async (text, notificationType = null, chatIds = null, throwOnError = false) => {
    if (!text) return;

    // Решает сама отправка, а не флаг isOnline программы: флаг мог застрять в
    // «нет сети» при живом интернете, и уведомления о расходах одной кассы
    // молча копились в очереди до перезапуска (жалоба 25.10.2026). Теперь
    // пробуем всегда; явно нет сети — сразу в очередь, без минутного ожидания.
    if (!chatIds && !throwOnError && typeof navigator !== 'undefined' && navigator.onLine === false) {
        enqueueTelegram(text, notificationType);
        return null;
    }

    try {
        const sendMessage = httpsCallable(functions, 'sendTelegramMessage');
        const payload = { text };
        if (notificationType) payload.notificationType = notificationType;
        if (chatIds) payload.chatIds = chatIds;

        const result = await sendMessage(payload);
        return result.data;
    } catch (error) {
        if (throwOnError) throw error;
        // Сеть пропала (программа ещё думала, что связь есть) — не теряем: в
        // очередь, уйдёт при восстановлении (useOfflineQueue). Раньше такое
        // уведомление о расходе или возврате просто писалось в консоль.
        if (!chatIds && isNetworkFailure(error)) {
            enqueueTelegram(text, notificationType);
            return null;
        }
        // Ошибку не пробрасываем — фоновые уведомления не должны ломать UX
        console.error('Telegram notification failed:', error?.message);
        reportError('telegram', 'telegram.send', error?.code || error?.message || error,
            { type: notificationType || (chatIds ? 'direct' : 'manual'), message: String(error?.message || '').slice(0, 200) });
        return null;
    }
};

/** Ошибка связи (а не отказ сервера по существу): нет сети, таймаут, сервис недоступен. */
export const isNetworkFailure = (error) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    const code = String(error?.code || '').replace(/^functions\//, '');
    const msg = String(error?.message || '');
    // Обрыв запроса Firebase отдаёт как code 'internal' с текстом ровно 'internal'
    // (строчными). 08.11.2026 так потерялись 3 уведомления об оплате: функция в это
    // время вообще не запускалась. Сбой самой функции приходит как 'INTERNAL' —
    // его по-прежнему пишем в журнал, а не в очередь.
    return code === 'unavailable' || code === 'deadline-exceeded' ||
        (code === 'internal' && (/^internal( \[\d+\])?$/.test(msg) || /network|fetch|failed to fetch|timeout/i.test(msg)));
};

