import { addDoc, collection } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';

/**
 * Write an audit log entry to Firestore.
 * Silent — never throws, never blocks UX.
 * @param {object} user    - current app user
 * @param {string} action  - action key (e.g. 'checkin', 'checkout', 'expense_add')
 * @param {object} details - optional extra details
 */
export const logAction = async (user, action, details = {}) => {
    try {
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

/**
 * Log a system-level error without user context.
 * @param {string} context  - where the error occurred (e.g. 'window.onerror')
 * @param {Error|string} error - error object or message string
 * @param {object} details  - extra context fields
 */
export const logSystemError = async (context, error, details = {}) => {
    try {
        const message = error instanceof Error ? error.message : String(error);
        const stack   = error instanceof Error ? (error.stack || '').slice(0, 600) : '';
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
