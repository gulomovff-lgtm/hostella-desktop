import { useState, useEffect, useRef } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';

const KEY = (uid) => `nav_prefs_v1_${uid}`;
const fsDocRef = (uid) => doc(db, ...PUBLIC_DATA_PATH, 'userPrefs', uid);

// Default folders — auto-grouping by purpose (for admins)
export const DEFAULT_FOLDERS = [
    {
        id: 'guests',
        label: 'Гости',
        emoji: '🛏️',
        items: ['rooms', 'calendar', 'debts', 'clients', 'bookings', 'registrations', 'cadastre'],
        open: true,
    },
    {
        id: 'finance',
        label: 'Финансы',
        emoji: '💰',
        items: ['expenses', 'reports', 'analytics'],
        open: false,
    },
    {
        id: 'management',
        label: 'Управление',
        emoji: '⚙️',
        items: ['staff', 'shifts', 'telegram', 'promos', 'hostelconfig', 'auditlog', 'sessions'],
        open: false,
    },
];

// Default for cashiers: rooms/calendar/debts standalone first, rest in "Прочее"
export const DEFAULT_CASHIER_FOLDERS = [
    {
        id: 'misc',
        label: 'Прочее',
        items: ['clients', 'bookings', 'registrations', 'cadastre', 'tasks', 'referrals', 'guesthistory'],
        open: false,
    },
];
export const DEFAULT_CASHIER_ORDER = ['item:rooms', 'item:calendar', 'item:debts', 'folder:misc'];

const DEFAULTS = { position: 'left', hidden: [], order: [], folders: null, navOrder: null, openFolders: {}, navStyle: 'compact' };

const getRoleDefaults = (role) => ({
    ...DEFAULTS,
    ...(role === 'cashier' ? { folders: DEFAULT_CASHIER_FOLDERS, navOrder: DEFAULT_CASHIER_ORDER } : {}),
});

export function useNavPrefs(userId, role) {
    const [prefs, setPrefs] = useState(() => {
        try {
            const raw = userId ? localStorage.getItem(KEY(userId)) : null;
            return raw ? { ...getRoleDefaults(role), ...JSON.parse(raw) } : getRoleDefaults(role);
        } catch { return getRoleDefaults(role); }
    });

    // Flag to skip writing back to Firestore when an update came FROM Firestore
    const skipSaveRef = useRef(false);

    // Re-read when userId changes (user switch) + subscribe to Firestore for cross-device sync
    useEffect(() => {
        if (!userId) {
            setPrefs(getRoleDefaults(role));
            return;
        }

        // Immediately apply localStorage cache while Firestore loads
        try {
            const raw = localStorage.getItem(KEY(userId));
            if (raw) setPrefs({ ...getRoleDefaults(role), ...JSON.parse(raw) });
        } catch {}

        const unsubscribe = onSnapshot(fsDocRef(userId), (snap) => {
            if (!snap.exists()) return;
            const data = snap.data();
            if (data?.navPrefs) {
                const merged = { ...getRoleDefaults(role), ...data.navPrefs };
                // Write to localStorage as offline cache
                try { localStorage.setItem(KEY(userId), JSON.stringify(data.navPrefs)); } catch {}
                skipSaveRef.current = true;
                setPrefs(merged);
            }
        }, () => {
            // Firestore error — fall back to localStorage only
        });

        return () => unsubscribe();
    }, [userId]); // eslint-disable-line

    const save = (patch) => {
        setPrefs(prev => {
            const next = { ...prev, ...patch };
            try { if (userId) localStorage.setItem(KEY(userId), JSON.stringify(next)); } catch {}
            // Sync to Firestore (skip if this update was triggered by Firestore itself)
            if (userId && !skipSaveRef.current) {
                setDoc(fsDocRef(userId), { navPrefs: next }, { merge: true }).catch(() => {});
            }
            skipSaveRef.current = false;
            return next;
        });
    };

    return [prefs, save];
}
