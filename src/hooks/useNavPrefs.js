import { useState, useEffect } from 'react';

const KEY = (uid) => `nav_prefs_v1_${uid}`;

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

const DEFAULTS = { position: 'left', hidden: [], order: [], folders: null, navOrder: null, openFolders: {} };

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

    // Re-read when userId changes (user switch)
    useEffect(() => {
        try {
            const raw = userId ? localStorage.getItem(KEY(userId)) : null;
            setPrefs(raw ? { ...getRoleDefaults(role), ...JSON.parse(raw) } : getRoleDefaults(role));
        } catch { setPrefs(getRoleDefaults(role)); }
    }, [userId]); // eslint-disable-line

    const save = (patch) => {
        setPrefs(prev => {
            const next = { ...prev, ...patch };
            try { if (userId) localStorage.setItem(KEY(userId), JSON.stringify(next)); } catch {}
            return next;
        });
    };

    return [prefs, save];
}
