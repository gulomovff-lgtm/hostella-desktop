import { addDoc, collection } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { sendTelegramMessage } from './telegram';
import { APP_VERSION } from '../constants/config';
import { getDeviceId } from './clientTelemetry';
import { getConfig } from './appConfig';

/**
 * Write an audit log entry to Firestore.
 * Silent — never throws, never blocks UX.
 * @param {object} user    - current app user
 * @param {string} action  - action key (e.g. 'checkin', 'checkout', 'expense_add')
 * @param {object} details - optional extra details
 */
export const logAction = async (user, action, details = {}) => {
    try {
        // Журнал можно выключить в Настройках → Безопасность
        if (getConfig().auditEnabled === false) return;
        await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'auditLog'), {
            action,
            details,
            userId:   user?.id    || user?.login || 'unknown',
            userName: user?.name  || user?.login || 'unknown',
            userRole: user?.role  || 'unknown',
            hostelId: user?.hostelId || null,
            timestamp: new Date().toISOString(),
        });
    } catch (e) {
        console.error('[audit]', e.message);
    }
};

// ── Telegram-алерты об ошибках (с защитой от спама) ───────────────────────────
const ERROR_ALERT_CHAT_ID = '7029598539'; // алерты об ошибках шлём ТОЛЬКО на этот chatId
const _alertTimes = new Map();            // "context|message" → последний отправленный ts (мс)
const ALERT_COOLDOWN_MS = 10 * 60 * 1000; // одну и ту же ошибку шлём не чаще раза в 10 мин
const MAX_ALERTS_PER_SESSION = 20;        // и не больше 20 алертов за сессию
let _alertCount = 0;

const escapeHtml = (s = '') =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Шлёт алерт об ошибке в Telegram, если не превышены лимиты. Никогда не бросает. */
const maybeAlertTelegram = (context, message, details = {}) => {
    try {
        // В режиме разработки не спамим — только прод-сборка.
        if (!import.meta?.env?.PROD) return;
        // Можно выключить алерты в Настройках
        if (getConfig().errorAlertsEnabled === false) return;

        const key = `${context}|${message}`.slice(0, 200);
        const now = Date.now();
        if (now - (_alertTimes.get(key) || 0) < ALERT_COOLDOWN_MS) return;
        if (_alertCount >= MAX_ALERTS_PER_SESSION) return;
        _alertTimes.set(key, now);
        _alertCount++;

        let device = '';
        try { device = getDeviceId().slice(0, 8); } catch { /* ignore */ }
        const platform = typeof window !== 'undefined' && /electron/i.test(navigator.userAgent || '') ? 'desktop' : 'web';

        const text =
            `🛑 <b>Ошибка в приложении</b>\n` +
            `📍 ${escapeHtml(context)}\n` +
            `💬 ${escapeHtml(message).slice(0, 500)}\n` +
            (details.path ? `🔗 ${escapeHtml(details.path)}\n` : '') +
            `🔖 v${APP_VERSION} · ${platform}${device ? ' · ' + device : ''}`;

        // Шлём напрямую на chatId из настроек (минуя список получателей и фильтры типов)
        const chatId = getConfig().errorAlertChatId || ERROR_ALERT_CHAT_ID;
        sendTelegramMessage(text, null, [chatId]).catch(() => {});
    } catch { /* алерт никогда не должен ломать UX */ }
};

/**
 * Log a system-level error without user context.
 * Пишет в Firestore (auditLog) и шлёт Telegram-алерт (с дедупликацией).
 * @param {string} context  - where the error occurred (e.g. 'window.onerror')
 * @param {Error|string} error - error object or message string
 * @param {object} details  - extra context fields
 */
export const logSystemError = async (context, error, details = {}) => {
    const message = error instanceof Error ? error.message : String(error);
    const stack   = error instanceof Error ? (error.stack || '').slice(0, 600) : '';

    // Проактивный алерт — не дожидаясь записи в БД.
    maybeAlertTelegram(context, message, details);

    try {
        await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'auditLog'), {
            action:    'system_error',
            details:   { context, message, stack, ...details },
            userId:    'system',
            userName:  'System',
            userRole:  'system',
            hostelId:  null,
            timestamp: new Date().toISOString(),
        });
    } catch (e) {
        console.error('[audit:system_error]', e.message);
    }
};
