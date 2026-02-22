import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

// API токен не хранится на фронте — всё через Cloud Functions

/**
 * Send a Telegram notification.
 * @param {string} text  - Message text (HTML)
 * @param {string} [notificationType] - Type key from NOTIFICATION_TYPES (e.g. 'checkin')
 *        If omitted, sends to all active recipients.
 * @param {string[]} [chatIds] - Override: send to specific chat IDs only.
 */
export const sendTelegramMessage = async (text, notificationType = null, chatIds = null, throwOnError = false) => {
    if (!text) return;

    try {
        const sendMessage = httpsCallable(functions, 'sendTelegramMessage');
        const payload = { text };
        if (notificationType) payload.notificationType = notificationType;
        if (chatIds) payload.chatIds = chatIds;

        const result = await sendMessage(payload);
        return result.data;
    } catch (error) {
        if (throwOnError) throw error;
        // Ошибку не пробрасываем — фоновые уведомления не должны ломать UX
        console.error('Telegram notification failed:', error?.message);
        return null;
    }
};

