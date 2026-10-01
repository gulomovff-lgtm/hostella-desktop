// Общие константы и расчёты экрана «Договоры / бригады».
// Держим отдельно, чтобы части экрана (модалки, календарь, отчёты) не тянули
// друг друга ради одной формулы.
import { PUBLIC_DATA_PATH } from '../../../firebase';

export const CONTRACT_GROUPS_KEY = 'hostella_contract_groups';
export const COLLECTION = [...PUBLIC_DATA_PATH, 'manualStayGroups'];
export const PAYMENTS_COLLECTION = [...PUBLIC_DATA_PATH, 'payments'];
export const TRANSFER_ENTITIES = ['YATT SOBIROVA', 'YATT YULDASHEV'];

export const INP = 'px-2.5 py-1.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-700 transition-all';

export const fmt = n => (parseInt(n) || 0).toLocaleString('ru');

export const getStayNights = (stay) => {
    const d = parseInt(stay?.days, 10);
    if (d > 0) return d;
    if (!stay?.checkInDate || !stay?.checkOutDate) return 0;
    const ms = new Date(stay.checkOutDate) - new Date(stay.checkInDate);
    return ms > 0 ? Math.round(ms / 86400000) : 0;
};

export const pluralGroups = (n) => {
    if (n % 10 === 1 && n % 100 !== 11) return 'группа';
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'группы';
    return 'групп';
};

export const computeEntry = (entry) => {
    const people = parseInt(entry.people, 10) || 0;
    const roomCount = Array.isArray(entry.roomIds) ? entry.roomIds.length : (parseInt(entry.rooms, 10) || 0);
    let nights = 0;
    if (entry.checkIn && entry.checkOut) {
        const ms = new Date(entry.checkOut) - new Date(entry.checkIn);
        nights = ms > 0 ? Math.round(ms / 86400000) : 0;
    }
    if (!nights) nights = parseInt(entry.nights, 10) || 0;
    return { roomCount, people, nights, roomNights: roomCount * nights, personNights: people * nights };
};

export const ACCENT_COLORS = ['#6366f1', '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#14b8a6', '#fb923c'];

// Помощники календаря периодов: нужны и мини-календарю, и общему отчёту
export const pmcFmtISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const PMC_MONTHS_FULL = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
