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
