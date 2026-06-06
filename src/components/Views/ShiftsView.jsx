import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Power, LogOut, LayoutDashboard, FileText, Plus, Edit, FileSpreadsheet, X, Calendar, Magnet, Trash2, Wallet } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../../firebase';
import TRANSLATIONS from '../../constants/translations';

// --- Constants ---
const DAILY_SALARY = 266666; // дефолт; реальная ставка берётся из settings/salaryConfig

const HOSTELS = {
    hostel1: { name: 'Хостел №1', address: 'Ташкент, улица Ниёзбек Йули, 43', currency: 'UZS' },
    hostel2: { name: 'Хостел №2', address: 'Ташкент, 6-й пр. Ниёзбек Йули, 39', currency: 'UZS' }
};

// --- Utilities ---
const getLocalDatetimeString = (dateObj) => {
    if (!dateObj) return '';
    const offset = dateObj.getTimezoneOffset() * 60000;
    return new Date(dateObj.getTime() - offset).toISOString().slice(0, 16);
};

// Локальная дата YYYY-MM-DD (без UTC-сдвига) — единый ключ для колонок и смен.
const ymdLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Активная смена старше этого порога уже засчитывается как полные отработанные сутки.
const ACTIVE_COUNT_AFTER_H = 3;

// Эффективный диапазон смены для подсчёта отработанного и начисления ЗП:
//  • закрытая смена — её реальные времена (как в БД, уже нормализованы при закрытии);
//  • активная старше 3ч — виртуальные сутки 9:00 дня старта → +24ч (как при закрытии);
//  • активная младше 3ч — null (ещё не засчитывается).
const effShiftRange = (s) => {
    if (s.endTime) return { start: s.startTime, end: s.endTime };
    const ageH = (Date.now() - new Date(s.startTime).getTime()) / 3600000;
    if (!(ageH > ACTIVE_COUNT_AFTER_H)) return null;
    const st = new Date(s.startTime); st.setHours(9, 0, 0, 0);
    const en = new Date(st); en.setDate(en.getDate() + 1);
    return { start: st.toISOString(), end: en.toISOString() };
};

const calculateSalary = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    return Math.round(diffDays * DAILY_SALARY);
};

// --- FillButton ---
const FillButton = ({ onClick, disabled }) => (
    <button type="button" onClick={onClick} disabled={disabled} className="ml-1 px-2 py-1 rounded bg-slate-100 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed">
        <Magnet size={16}/>
    </button>
);

// --- ShiftsView ---
const ShiftsView = ({ shifts, users, allUsers, currentUser, onStartShift, onEndShift, onTransferShift, lang, hostelId, onAdminAddShift, onAdminUpdateShift, onAdminDeleteShift, payments = [], expenses = [], onPaySalary }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';

    const myActiveShift = shifts.find(s => (s.staffId === currentUser.id || (s.staffLogin && s.staffLogin === currentUser.login)) && !s.endTime);
    const allCashiers = users.filter(u => u.role === 'cashier' && u.id !== currentUser.id);
    const [transferTarget, setTransferTarget] = useState('');
    const [view, setView] = useState('grid');
    // По умолчанию — текущий месяц: с 1 числа по сегодня
    const [dateRange, setDateRange] = useState(() => {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        return { start: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), end: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    });
    const [filterCashierId, setFilterCashierId] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingShift, setEditingShift] = useState(null);
    const [shiftForm, setShiftForm] = useState({ staffId: '', startTime: '', endTime: '', hostelId: 'hostel1' });
    const [hoveredCell, setHoveredCell] = useState(null);
    const gridScrollRef = useRef(null);

    const cashierIds = useMemo(() => new Set((allUsers || users).filter(u => u.role === 'cashier').map(u => u.id)), [users, allUsers]);

    // Ставка ЗП за сутки (общая, редактируется админом) — из settings/salaryConfig
    const [dailyRate, setDailyRate] = useState(DAILY_SALARY);
    const [rateDraft, setRateDraft] = useState('');
    const [editingRate, setEditingRate] = useState(false);
    useEffect(() => {
        const ref = doc(db, ...PUBLIC_DATA_PATH, 'settings', 'salaryConfig');
        return onSnapshot(ref, snap => {
            const r = snap.exists() ? parseInt(snap.data().dailyRate) : 0;
            if (r > 0) setDailyRate(r);
        });
    }, []);
    const saveDailyRate = async () => {
        const v = parseInt(rateDraft) || 0;
        if (v > 0) await setDoc(doc(db, ...PUBLIC_DATA_PATH, 'settings', 'salaryConfig'), { dailyRate: v }, { merge: true });
        setEditingRate(false);
    };
    // Расчёт ЗП по сутки-ставке: длительность в сутках × ставка
    const calcSalary = useCallback((startTime, endTime) => {
        if (!startTime || !endTime) return 0;
        const d = (new Date(endTime) - new Date(startTime)) / 86400000;
        return Math.round(d * dailyRate);
    }, [dailyRate]);

    const displayedShifts = useMemo(() => {
        // Смены только кассиров — admin не учитывается
        let list = shifts.filter(s => cashierIds.has(s.staffId));
        // Фильтруем по hostelId смены — чтобы старые смены переведённого кассира
        // не попадали в отчёт нового хостела
        if (hostelId && hostelId !== 'all') {
            list = list.filter(s => !s.hostelId || s.hostelId === hostelId);
        }
        if (!isAdmin) {
            list = list.filter(s => s.staffId === currentUser.id);
        } else {
            const start = new Date(dateRange.start); start.setHours(0,0,0,0);
            const end   = new Date(dateRange.end);   end.setHours(23,59,59,999);
            list = list.filter(s => { const d = new Date(s.startTime); return d >= start && d <= end; });
            if (filterCashierId) list = list.filter(s => s.staffId === filterCashierId);
        }
        return list.sort((a,b) => new Date(b.startTime) - new Date(a.startTime));
    }, [shifts, cashierIds, hostelId, isAdmin, currentUser.id, dateRange, filterCashierId]);

    const kpi = useMemo(() => {
        // Считаем закрытые + активные старше 3ч (как полные отработанные сутки)
        const counted  = displayedShifts.map(s => effShiftRange(s)).filter(Boolean);
        const totalH   = counted.reduce((s,r) => s + (new Date(r.end)-new Date(r.start))/3600000, 0);
        const totalSal = counted.reduce((s,r) => s + calcSalary(r.start, r.end), 0);
        const sutki    = counted.reduce((s,r) => s + Math.round((new Date(r.end)-new Date(r.start))/86400000), 0);
        const active   = displayedShifts.filter(s => !s.endTime).length;
        const avgH     = counted.length ? totalH / counted.length : 0;

        // Финансовые итоги за период
        // Для admin — используем dateRange напрямую (надёжно)
        // Для кассира — используем диапазон его смен
        let payStart, payEnd;
        if (isAdmin) {
            const s = new Date(dateRange.start); s.setHours(0, 0, 0, 0);
            const e = new Date(dateRange.end);   e.setHours(23, 59, 59, 999);
            payStart = s.getTime();
            payEnd   = e.getTime();
        } else {
            if (!displayedShifts.length) {
                return { totalH: totalH.toFixed(1), totalSal, sutki, salaryPaid: 0, salaryDue: totalSal, active, avgH: avgH.toFixed(1), count: 0, totalCash: 0, totalCard: 0, totalQR: 0, totalTransfer: 0, totalInc: 0 };
            }
            payStart = Math.min(...displayedShifts.map(s => new Date(s.startTime).getTime()));
            payEnd   = Math.max(...displayedShifts.map(s => new Date(s.endTime || Date.now()).getTime()));
        }

        // Выплачено кассирам за период: расходы «Зарплата» (targetStaffId) + «Аванс» (staffId)
        const matchCashier = (val) => {
            if (!val) return false;
            if (!isAdmin) return val === currentUser.id || val === currentUser.login;
            if (filterCashierId) { const u = users.find(u => u.id === filterCashierId); return val === filterCashierId || (u && val === u.login); }
            const list = allUsers || users;
            return list.some(u => u.role === 'cashier' && (u.id === val || u.login === val));
        };
        const salaryPaid = expenses.filter(e => {
            const t = new Date(e.date).getTime();
            if (t < payStart || t > payEnd) return false;
            return (e.category === 'Зарплата' && matchCashier(e.targetStaffId)) || (e.category === 'Аванс' && matchCashier(e.staffId));
        }).reduce((s, e) => s + (parseInt(e.amount) || 0), 0);

        const relPay = payments.filter(p => {
            if (p.type === 'cash_to_terminal') return false;
            const pt = new Date(p.date).getTime();
            if (pt < payStart || pt > payEnd) return false;
            // если выбран конкретный сотрудник — фильтруем строго по его staffId
            if (filterCashierId) {
                const u = users.find(u => u.id === filterCashierId);
                return p.staffId === filterCashierId || (u && p.staffId === u.login);
            }
            // если кассир смотрит свою статистику — только его платежи
            if (!isAdmin) return p.staffId === currentUser.id || p.staffId === currentUser.login;
            // для admin без фильтра — все платежи за период
            return true;
        });

        const totalCash = relPay.reduce((s,p)=>s+(p.cash!==undefined?parseInt(p.cash)||0:p.method==='cash'?parseInt(p.amount)||0:0),0);
        const totalCard = relPay.reduce((s,p)=>s+(p.card!==undefined?parseInt(p.card)||0:p.method==='card'?parseInt(p.amount)||0:0),0);
        const totalQR   = relPay.reduce((s,p)=>s+(p.qr!==undefined?parseInt(p.qr)||0:p.method==='qr'?parseInt(p.amount)||0:0),0);
        const totalTransfer = relPay.reduce((s,p)=>s+(p.transfer!==undefined?parseInt(p.transfer)||0:p.method==='transfer'?parseInt(p.amount)||0:0),0);
        const totalInc  = totalCash + totalCard + totalQR + totalTransfer;
        return { totalH: totalH.toFixed(1), totalSal, sutki, salaryPaid, salaryDue: totalSal - salaryPaid, active, avgH: avgH.toFixed(1), count: displayedShifts.length, totalCash, totalCard, totalQR, totalTransfer, totalInc };
    }, [displayedShifts, payments, expenses, filterCashierId, users, allUsers, isAdmin, currentUser, dateRange, calcSalary]);

    // ── Помесячная зарплата: начислено / взято с расходов (Зарплата+Аванс) / остаток ──
    const monthlySalary = useMemo(() => {
        const pad = n => String(n).padStart(2, '0');
        const ymOf = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
        const cashiers = (allUsers || users).filter(u => u.role === 'cashier');
        // Закрытые + активные старше 3ч (как полные сутки), с привязкой к месяцу старта
        const counted = displayedShifts.map(s => ({ s, r: effShiftRange(s) })).filter(x => x.r);
        const months = [...new Set(counted.map(({ s }) => ymOf(s.startTime)).filter(Boolean))].sort().reverse();
        const matchStaff = (val, c) => val && (val === c.id || val === c.login);
        return months.map(ym => {
            const rows = cashiers.map(c => {
                const cShifts = counted.filter(({ s }) => ymOf(s.startTime) === ym && (s.staffId === c.id || (s.staffLogin && s.staffLogin === c.login)));
                const days = cShifts.reduce((a, { r }) => a + Math.round((new Date(r.end) - new Date(r.start)) / 86400000), 0);
                const earned = cShifts.reduce((a, { r }) => a + calcSalary(r.start, r.end), 0);
                const taken = expenses.filter(e => ymOf(e.date) === ym && (
                    (e.category === 'Зарплата' && matchStaff(e.targetStaffId, c)) ||
                    (e.category === 'Аванс' && matchStaff(e.staffId, c))
                )).reduce((a, e) => a + (parseInt(e.amount) || 0), 0);
                return { id: c.id, name: c.name || c.login, days, earned, taken, remaining: earned - taken };
            }).filter(r => r.days > 0 || r.taken > 0);
            const tot = rows.reduce((t, r) => ({ days: t.days + r.days, earned: t.earned + r.earned, taken: t.taken + r.taken, remaining: t.remaining + r.remaining }), { days: 0, earned: 0, taken: 0, remaining: 0 });
            return { ym, rows, tot };
        }).filter(m => m.rows.length > 0);
    }, [displayedShifts, expenses, allUsers, users, calcSalary]);

    // Выплачено по каждому кассиру за выбранный период (Зарплата + Аванс) — для «остатка»
    const paidByStaff = useMemo(() => {
        const map = {};
        const s = new Date(dateRange.start); s.setHours(0, 0, 0, 0);
        const e = new Date(dateRange.end);   e.setHours(23, 59, 59, 999);
        const list = allUsers || users;
        expenses.forEach(exp => {
            const t = new Date(exp.date).getTime();
            if (t < s.getTime() || t > e.getTime()) return;
            let val = null;
            if (exp.category === 'Зарплата') val = exp.targetStaffId;
            else if (exp.category === 'Аванс') val = exp.staffId;
            if (!val) return;
            const u = list.find(x => x.id === val || x.login === val);
            const key = u?.id || val;
            map[key] = (map[key] || 0) + (parseInt(exp.amount) || 0);
        });
        return map;
    }, [expenses, dateRange, allUsers, users]);

    const gridDays = useMemo(() => {
        const days = [];
        const s = new Date(dateRange.start); s.setHours(0,0,0,0);
        const e = new Date(dateRange.end);   e.setHours(0,0,0,0);
        for (let d = new Date(s); d <= e; d.setDate(d.getDate()+1)) days.push(new Date(d));
        return days;
    }, [dateRange]);

    const staffList = useMemo(() =>
        isAdmin ? users.filter(u => u.role === 'cashier') : [currentUser],
    [users, isAdmin, currentUser]);

    // Автопрокрутка шахматки к сегодня (последняя смена) — всегда справа
    useEffect(() => {
        if (view !== 'grid') return;
        const el = gridScrollRef.current;
        if (!el) return;
        const ts = ymdLocal(new Date());
        const idx = gridDays.findIndex(d => ymdLocal(d) === ts);
        const DAY_W = 42, LABEL_W = 140;
        requestAnimationFrame(() => {
            if (idx < 0) { el.scrollLeft = el.scrollWidth; return; }
            el.scrollLeft = Math.max(0, LABEL_W + (idx + 1) * DAY_W - el.clientWidth + 24);
        });
    }, [view, gridDays]);

    const getShiftSlots = (shift) => {
        const start = new Date(shift.startTime);
        // Сутки 9→9 занимают обе половинки своего дня старта (☀ 9-21 + 🌙 21-9 след.).
        const slots = [];
        const cursor = new Date(start);
        const h = cursor.getHours();
        // Привязка к дню старта: до 21:00 — с 9:00 этого дня; после 21:00 — с 21:00 этого дня.
        if (h >= 21) { cursor.setHours(21, 0, 0, 0); }
        else         { cursor.setHours(9, 0, 0, 0); }
        // Активная смена считается полными сутками (квадратный блок на 2 ячейки).
        const end = shift.endTime ? new Date(shift.endTime) : new Date(cursor.getTime() + 24 * 3600 * 1000);
        const MS_12H = 12 * 3600 * 1000;
        let safety = 0;
        const c = new Date(cursor);
        while (c < end && safety++ < 60) {
            slots.push(`${ymdLocal(c)}_${c.getHours() === 9 ? 0 : 1}`);
            c.setTime(c.getTime() + MS_12H);
        }
        return slots.length ? slots : [`${ymdLocal(cursor)}_${cursor.getHours() === 9 ? 0 : 1}`];
    };

    const shiftMap = useMemo(() => {
        const m = {};
        displayedShifts.forEach(s => {
            const slots = getShiftSlots(s);
            if (!m[s.staffId]) m[s.staffId] = {};
            slots.forEach((key, idx) => {
                if (!m[s.staffId][key]) {
                    m[s.staffId][key] = { shift: s, isStart: idx === 0, colspan: slots.length, slotIdx: idx };
                }
            });
        });
        return m;
    }, [displayedShifts]);

    const fmt = n => Number(n).toLocaleString('ru');
    const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'}) : '—';
    const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('ru',{day:'2-digit',month:'2-digit'}) : '—';
    const todayStr = ymdLocal(new Date());

    const handleSaveShift = () => {
        const payload = {
            ...shiftForm,
            startTime: new Date(shiftForm.startTime).toISOString(),
            endTime: shiftForm.endTime ? new Date(shiftForm.endTime).toISOString() : null
        };
        if (editingShift) { onAdminUpdateShift(editingShift.id, payload); }
        else { onAdminAddShift(payload); }
        setIsAddModalOpen(false); setEditingShift(null);
    };

    const openEdit = (s) => {
        setEditingShift(s);
        setShiftForm({
            staffId: s.staffId, hostelId: s.hostelId || 'hostel1',
            startTime: getLocalDatetimeString(new Date(s.startTime)),
            endTime: s.endTime ? getLocalDatetimeString(new Date(s.endTime)) : ''
        });
        setIsAddModalOpen(true);
    };

    const handleDeleteShift = (s) => {
        const staff = (users.find(u => u.id === s.staffId))?.name || s.staffName || '?';
        const dur = s.endTime ? `${((new Date(s.endTime) - new Date(s.startTime)) / 60000).toFixed(0)} мин` : 'открыта';
        if (!window.confirm(`Удалить смену ${staff} (${fmtDate(s.startTime)} ${fmtTime(s.startTime)}, ${dur})? Это действие необратимо.`)) return;
        onAdminDeleteShift?.(s.id);
        if (editingShift?.id === s.id) { setIsAddModalOpen(false); setEditingShift(null); }
    };

    // «Призрачные» смены — завершённые короче 10 минут (случайно открыли/закрыли)
    const GHOST_MAX_MIN = 10;
    const ghostShifts = useMemo(
        () => displayedShifts.filter(s => s.endTime && (new Date(s.endTime) - new Date(s.startTime)) < GHOST_MAX_MIN * 60000),
        [displayedShifts]
    );
    const handleCleanGhosts = () => {
        if (!ghostShifts.length) return;
        if (!window.confirm(`Удалить ${ghostShifts.length} коротких смен (< ${GHOST_MAX_MIN} мин)? Это действие необратимо.`)) return;
        ghostShifts.forEach(s => onAdminDeleteShift?.(s.id));
    };

    // Выровнять все смены к формату 9:00→9:00 (нормализуются те, что > 6ч и ещё не 9→9)
    const shiftsToAlign = useMemo(() => displayedShifts.filter(s => {
        if (!s.endTime) return false;
        const durH = (new Date(s.endTime) - new Date(s.startTime)) / 3600000;
        if (durH <= 6) return false;
        const st = new Date(s.startTime);
        return !(st.getHours() === 9 && st.getMinutes() === 0 && Math.abs(durH - 24) < 0.02);
    }), [displayedShifts]);
    const handleAlignShifts = () => {
        if (!shiftsToAlign.length) return;
        if (!window.confirm(`Выровнять ${shiftsToAlign.length} смен к формату 9:00 → 9:00 (полные сутки)?`)) return;
        shiftsToAlign.forEach(s => onAdminUpdateShift(s.id, { startTime: s.startTime, endTime: s.endTime }));
    };

    const handleExportExcel = () => {
        const rows = displayedShifts.map(s => {
            const staff = (users.find(u=>u.id===s.staffId || (s.staffLogin && u.login===s.staffLogin)))?.name || s.staffName || '?';
            const start = new Date(s.startTime), end = s.endTime ? new Date(s.endTime) : null;
            const hours = end ? ((end-start)/3600000).toFixed(1) : '—';
            const salary = end ? calcSalary(s.startTime, s.endTime) : 0;
            return `<tr><td>${staff}</td><td>${HOSTELS[s.hostelId]?.name||s.hostelId}</td><td>${start.toLocaleDateString('ru')}</td><td>${start.toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})}</td><td>${end?end.toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'}):'—'}</td><td>${hours}</td><td>${salary.toLocaleString()}</td></tr>`;
        }).join('');
        const html = `<html><head><meta charset="UTF-8"></head><body><table border="1" style="border-collapse:collapse"><thead><tr><th>Сотрудник</th><th>Хостел</th><th>Дата</th><th>Начало</th><th>Конец</th><th>Часы</th><th>Зарплата</th></tr></thead><tbody>${rows}<tr><td colspan="6" style="text-align:right;font-weight:bold">Итого:</td><td><b>${fmt(kpi.totalSal)}</b></td></tr></tbody></table></body></html>`;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([html],{type:'application/vnd.ms-excel'}));
        a.download = 'Shifts.xls'; a.click();
    };

    const MONTHS_SHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
    const WDAYS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

    return (
        <div className="space-y-4">
            {/* Cashier banner */}
            {!isAdmin && (
                <div className={`rounded-2xl border p-5 flex items-center gap-4 flex-wrap ${myActiveShift ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${myActiveShift ? 'bg-emerald-200' : 'bg-slate-100'}`}>
                        {myActiveShift ? '🟢' : '⚫'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-black text-slate-800 text-lg">{myActiveShift ? 'Смена активна' : 'Смена не начата'}</div>
                        {myActiveShift && <div className="text-sm text-emerald-700 font-semibold mt-0.5">Началась в {fmtTime(myActiveShift.startTime)} · {fmtDate(myActiveShift.startTime)}</div>}
                    </div>
                    {!myActiveShift ? (
                        <button onClick={() => onStartShift(hostelId)} className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-sm transition-colors">
                            <Power size={18}/> Начать смену
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                            <select className="border border-slate-200 rounded-xl text-sm py-2.5 px-3 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                value={transferTarget} onChange={e => setTransferTarget(e.target.value)}>
                                <option value="">Передать кому…</option>
                                {allCashiers.map(u => <option key={u.id} value={u.id}>{u.name} ({HOSTELS[u.hostelId]?.name})</option>)}
                            </select>
                            <button onClick={() => onTransferShift(myActiveShift.id, transferTarget)} disabled={!transferTarget}
                                className="px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors">
                                Передать
                            </button>
                            <button onClick={onEndShift} className="flex items-center gap-2 px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold transition-colors">
                                <LogOut size={16}/> Завершить смену
                            </button>
                        </div>
                    )}
                </div>
            )}


            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { icon:'🌙',  label:'Сутки',          value: kpi.sutki,            sub: `${kpi.count} смен за период`, color:'#4f46e5', bg:'#eef2ff' },
                    { icon:'💰',  label:'Начислено ЗП',   value: fmt(kpi.totalSal),    sub: 'за период',                  color:'#0f766e', bg:'#ccfbf1' },
                    { icon:'✅',  label:'Выплачено',      value: fmt(kpi.salaryPaid),  sub: 'зарплата + аванс',           color:'#15803d', bg:'#dcfce7' },
                    { icon:'⚖️',  label:'Остаток к выплате', value: fmt(kpi.salaryDue), sub: kpi.salaryDue > 0 ? 'нужно доплатить' : 'закрыто', color: kpi.salaryDue > 0 ? '#b91c1c' : '#64748b', bg: kpi.salaryDue > 0 ? '#fee2e2' : '#f1f5f9' },
                ].map(c => (
                    <div key={c.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">{c.icon}</span>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide leading-tight">{c.label}</span>
                        </div>
                        <div className="text-2xl font-black" style={{color: c.color}}>{c.value}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{c.sub}</div>
                    </div>
                ))}
            </div>

            {/* Финансовая статистика за период */}
            {kpi.totalInc > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center flex-wrap gap-4">
                    <div className="flex flex-col">
                        <div className="text-xs font-black text-slate-500 uppercase tracking-wide">💵 Приход за период:</div>
                        {isAdmin && <div className="text-[10px] text-slate-400 mt-0.5">{dateRange.start} — {dateRange.end}{filterCashierId ? ` · ${users.find(u=>u.id===filterCashierId)?.name || ''}` : ''}</div>}
                    </div>
                    <div className="flex gap-4 flex-wrap">
                        {kpi.totalCash > 0 && <div><span className="text-xs text-slate-400 font-semibold">Наличные: </span><span className="font-black text-slate-800">{fmt(kpi.totalCash)}</span></div>}
                        {kpi.totalCard > 0 && <div><span className="text-xs text-slate-400 font-semibold">Карта: </span><span className="font-black text-slate-800">{fmt(kpi.totalCard)}</span></div>}
                        {kpi.totalQR > 0 && <div><span className="text-xs text-slate-400 font-semibold">QR: </span><span className="font-black text-slate-800">{fmt(kpi.totalQR)}</span></div>}
                        {kpi.totalTransfer > 0 && <div><span className="text-xs text-slate-400 font-semibold">🏦 Перечисление: </span><span className="font-black text-slate-800">{fmt(kpi.totalTransfer)}</span></div>}
                        <div className="ml-auto"><span className="text-xs text-slate-400 font-semibold">Итого: </span><span className="font-black text-emerald-600 text-base">{fmt(kpi.totalInc)}</span></div>
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm">
                {isAdmin && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <input type="date" className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 flex-1 sm:flex-none min-w-[130px]"
                            value={dateRange.start} onChange={e => setDateRange(r=>({...r, start:e.target.value}))}/>
                        <span className="text-slate-400 text-sm">—</span>
                        <input type="date" className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 flex-1 sm:flex-none min-w-[130px]"
                            value={dateRange.end} onChange={e => setDateRange(r=>({...r, end:e.target.value}))}/>
                        <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 flex-1 sm:flex-none"
                            value={filterCashierId} onChange={e => setFilterCashierId(e.target.value)}>
                            <option value="">Все сотрудники</option>
                            {users.filter(u=>u.role==='cashier').map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                )}

                <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
                    <div className="flex rounded-xl overflow-hidden border border-slate-200">
                        <button onClick={()=>setView('grid')} className="px-3 py-2 text-sm font-bold transition-colors flex items-center gap-1.5"
                            style={view==='grid' ? {background:'#16a34a',color:'#fff'} : {background:'#fff',color:'#64748b'}}>
                            <LayoutDashboard size={14}/> Шахматка
                        </button>
                        <button onClick={()=>setView('list')} className="px-3 py-2 text-sm font-bold transition-colors flex items-center gap-1.5 border-l border-slate-200"
                            style={view==='list' ? {background:'#16a34a',color:'#fff'} : {background:'#fff',color:'#64748b'}}>
                            <FileText size={14}/> Список
                        </button>
                        <button onClick={()=>setView('salary')} className="px-3 py-2 text-sm font-bold transition-colors flex items-center gap-1.5 border-l border-slate-200"
                            style={view==='salary' ? {background:'#16a34a',color:'#fff'} : {background:'#fff',color:'#64748b'}}>
                            <Wallet size={14}/> ЗП
                        </button>
                    </div>
                    {isAdmin && (
                        editingRate ? (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-xl border border-indigo-200 bg-indigo-50">
                                <span className="text-[10px] font-bold text-indigo-500">Ставка/сутки</span>
                                <input type="number" autoFocus value={rateDraft} onChange={e=>setRateDraft(e.target.value.replace(/[^0-9]/g,''))}
                                    onKeyDown={e=>{ if(e.key==='Enter') saveDailyRate(); if(e.key==='Escape') setEditingRate(false); }}
                                    className="w-24 px-2 py-1 text-sm rounded-lg border border-indigo-200 focus:outline-none" />
                                <button onClick={saveDailyRate} className="px-2 py-1 rounded-lg bg-indigo-500 text-white text-xs font-bold">OK</button>
                            </div>
                        ) : (
                            <button onClick={()=>{ setRateDraft(String(dailyRate)); setEditingRate(true); }} title="Ставка ЗП за сутки"
                                className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                <Wallet size={14}/> {dailyRate.toLocaleString('ru-RU')}/сут
                            </button>
                        )
                    )}
                    {isAdmin && <>
                        <button onClick={() => { setEditingShift(null); setShiftForm({staffId:users.filter(u=>u.role==='cashier')[0]?.id||'',startTime:'',endTime:'',hostelId:'hostel1'}); setIsAddModalOpen(true); }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-colors">
                            <Plus size={15}/> Добавить
                        </button>
                        <button onClick={handleExportExcel}
                            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                            <FileSpreadsheet size={15}/> Excel
                        </button>
                        {shiftsToAlign.length > 0 && (
                            <button onClick={handleAlignShifts} title="Привести все смены к 9:00 → 9:00"
                                className="flex items-center gap-1.5 px-3 py-2 border border-emerald-300 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-colors">
                                🕘 Выровнять 9→9 ({shiftsToAlign.length})
                            </button>
                        )}
                        {ghostShifts.length > 0 && (
                            <button onClick={handleCleanGhosts} title={`Завершённые смены короче ${GHOST_MAX_MIN} мин`}
                                className="flex items-center gap-1.5 px-3 py-2 border border-amber-300 bg-amber-50 text-amber-700 rounded-xl text-sm font-bold hover:bg-amber-100 transition-colors">
                                <Trash2 size={14}/> Короткие ({ghostShifts.length})
                            </button>
                        )}
                    </>}
                </div>
            </div>

            {/* Grid view */}
            {view === 'grid' && (() => {
                const nowH = new Date().getHours();
                const currentHalf = nowH >= 9 && nowH < 21 ? 0 : 1;
                return (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto" ref={gridScrollRef}>
                            <table className="w-full border-collapse" style={{minWidth: 140 + gridDays.length*42}}>
                                <thead>
                                    <tr>
                                        <th className="sticky left-0 z-20 bg-slate-50 border-b border-r-2 border-slate-200 px-4 text-left text-xs font-black text-slate-400 uppercase tracking-wide"
                                            style={{minWidth:140, width:140}} rowSpan={2}>
                                            Сотрудник
                                        </th>
                                        {gridDays.map(d => {
                                            const str = ymdLocal(d);
                                            const isToday = str === todayStr;
                                            const isSun = d.getDay()===0, isSat = d.getDay()===6;
                                            return (
                                                <th key={str} colSpan={2} style={{width:42, minWidth:42}}
                                                    className={`border-b border-r border-slate-200 text-center py-1.5 select-none
                                                        ${isToday ? 'bg-indigo-600 text-white' : isSun||isSat ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'}`}>
                                                    <span className="text-[9px] font-bold uppercase mr-1">{WDAYS[d.getDay()]}</span>
                                                    <span className="text-sm font-black">{d.getDate()}</span>
                                                    {d.getDate()===1 && <span className="text-[8px] font-bold uppercase ml-1" style={{color: isToday?'rgba(255,255,255,0.7)':'#94a3b8'}}>{MONTHS_SHORT[d.getMonth()]}</span>}
                                                </th>
                                            );
                                        })}
                                        <th className="border-b-2 border-l-2 border-slate-200 px-2 text-center text-xs font-black text-slate-400 uppercase tracking-wide" style={{width:60, minWidth:60, maxWidth:60, boxSizing:'border-box', position:'sticky', right:260, zIndex:25, background:'#f8fafc'}} rowSpan={2}>Сутки</th>
                                        <th className="border-b-2 border-slate-200 px-2 text-right text-xs font-black text-slate-400 uppercase tracking-wide" style={{width:150, minWidth:150, maxWidth:150, boxSizing:'border-box', position:'sticky', right:110, zIndex:25, background:'#f8fafc'}} rowSpan={2}>Начислено</th>
                                        <th className="border-b-2 border-slate-200 px-3 text-right text-xs font-black text-slate-400 uppercase tracking-wide" style={{width:110, minWidth:110, maxWidth:110, boxSizing:'border-box', position:'sticky', right:0, zIndex:25, background:'#f8fafc'}} rowSpan={2}>Остаток</th>
                                    </tr>
                                    <tr>
                                        {gridDays.map(d => {
                                            const str = ymdLocal(d);
                                            const isToday = str === todayStr;
                                            return [
                                                <th key={`${str}_0`} style={{width:21, minWidth:21}}
                                                    className={`border-b-2 border-r border-slate-100 text-center py-0.5 select-none text-[9px] font-bold
                                                        ${isToday && currentHalf===0 ? 'bg-indigo-500 text-white' : isToday ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-slate-400'}`}>
                                                    ☀
                                                </th>,
                                                <th key={`${str}_1`} style={{width:21, minWidth:21}}
                                                    className={`border-b-2 border-r border-slate-200 text-center py-0.5 select-none text-[9px] font-bold
                                                        ${isToday && currentHalf===1 ? 'bg-indigo-500 text-white' : isToday ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                                                    🌙
                                                </th>
                                            ];
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {staffList.map((staff, si) => {
                                        const staffShifts = shiftMap[staff.id] || {};
                                        const staffCounted = displayedShifts.filter(s=>s.staffId===staff.id).map(s=>effShiftRange(s)).filter(Boolean);
                                        const totalH = staffCounted.reduce((sum,r)=>sum+(new Date(r.end)-new Date(r.start))/3600000,0);
                                        const totalS = staffCounted.reduce((sum,r)=>sum+calcSalary(r.start,r.end),0);
                                        const fullShifts = staffCounted.filter(r=>(new Date(r.end)-new Date(r.start))/3600000>=6).length;
                                        const paidS = paidByStaff[staff.id] || 0;
                                        const dueS = totalS - paidS;
                                        const hasActive = displayedShifts.some(s=>s.staffId===staff.id&&!s.endTime);
                                        return (
                                            <tr key={staff.id} className={si%2===0?'bg-white':'bg-slate-50/50'}>
                                                <td className="sticky left-0 z-10 border-r-2 border-slate-200 px-4 py-2.5" style={{background: si%2===0?'#fff':'#f8fafc'}}>
                                                    <div className="flex items-center gap-2">
                                                        {hasActive && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse"/>}
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-800 leading-tight truncate" style={{maxWidth:110}}>{staff.name}</div>
                                                            <div className="text-[10px] text-slate-400">{HOSTELS[staff.hostelId]?.name}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                {(() => {
                                                    const allKeys = gridDays.flatMap(d => [0,1].map(h => `${ymdLocal(d)}_${h}`));
                                                    const CELL_W = 21;
                                                    return gridDays.flatMap(d => {
                                                        const dayStr  = ymdLocal(d);
                                                        const isToday = dayStr===todayStr;
                                                        return [0,1].map(half => {
                                                            const cellKey  = `${dayStr}_${half}`;
                                                            const cellInfo = staffShifts[cellKey];
                                                            const isCurrentSlot = isToday && currentHalf===half;
                                                            const cellBg = isCurrentSlot?'#e0e7ff':isToday?'#eef2ff':'transparent';

                                                            if (cellInfo && !cellInfo.isStart) return (
                                                                <td key={cellKey} className={half===0?'border-r border-dashed border-slate-200':'border-r border-slate-200'}
                                                                    style={{height:44, width:CELL_W, background:cellBg}}/>
                                                            );

                                                            if (!cellInfo) return (
                                                                <td key={cellKey} className={`relative ${half===0?'border-r border-dashed border-slate-200':'border-r border-slate-200'}`}
                                                                    style={{height:44, width:CELL_W, background:cellBg}}/>
                                                            );

                                                            const { shift: s, colspan: rawColspan } = cellInfo;
                                                            const startIdx = allKeys.indexOf(cellKey);
                                                            const colspan = Math.min(rawColspan, allKeys.length - startIdx);
                                                            const active = !s.endTime;
                                                            const shiftH = s.endTime ? (new Date(s.endTime)-new Date(s.startTime))/3600000 : (new Date()-new Date(s.startTime))/3600000;
                                                            const effR = effShiftRange(s);
                                                            const effSal = effR ? calcSalary(effR.start, effR.end) : 0;
                                                            const bg = active ? 'linear-gradient(135deg,#22c55e,#15803d)' : shiftH>=6 ? 'linear-gradient(135deg,#10b981,#059669)' : '#a7f3d0';
                                                            const fg = (active||shiftH>=6) ? '#fff' : '#065f46';
                                                            const barW = colspan * CELL_W - 4;
                                                            return (
                                                                <td key={cellKey}
                                                                    className={`relative ${half===0?'border-r border-dashed border-slate-200':'border-r border-slate-200'}`}
                                                                    style={{height:44, width:CELL_W, overflow:'visible', background:cellBg}}>
                                                                    <div onClick={() => openEdit(s)}
                                                                        onMouseEnter={(e)=>{ const r=e.currentTarget.getBoundingClientRect(); setHoveredCell({ x:r.left+r.width/2, y:r.top, name: (users.find(u=>u.id===s.staffId)?.name)||staff.name, line1: `${fmtTime(s.startTime)} – ${s.endTime?fmtTime(s.endTime):'сейчас'}`, line2: `${shiftH.toFixed(1)}ч · ${fmt(effSal)} сум${active && effR ? ' (идёт)' : ''}` }); }}
                                                                        onMouseLeave={()=>setHoveredCell(null)}
                                                                        className="hover:brightness-110"
                                                                        style={{ position:'absolute', top:7, bottom:7, left:2, width:barW, zIndex:3, background: bg, color: fg, borderRadius: 9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', userSelect:'none', fontSize: shiftH>=6 ? 15 : 9, fontWeight: 800, whiteSpace:'nowrap', overflow:'hidden', transition:'filter .15s' }}>
                                                                        {active ? '💼' : shiftH >= 6 ? '✓' : `${shiftH.toFixed(0)}ч`}
                                                                    </div>
                                                                </td>
                                                            );
                                                        });
                                                    });
                                                })()}
                                                <td className="px-2 text-center border-l-2 border-slate-200" style={{position:'sticky', right:260, zIndex:9, width:60, minWidth:60, maxWidth:60, boxSizing:'border-box', background: si%2===0?'#fff':'#f8fafc'}}>
                                                    <div className="text-base font-black text-slate-700">{fullShifts}</div>
                                                </td>
                                                <td className="px-2 text-right" style={{position:'sticky', right:110, zIndex:9, width:150, minWidth:150, maxWidth:150, boxSizing:'border-box', background: si%2===0?'#fff':'#f8fafc'}}>
                                                    <div className="text-sm font-black text-slate-800">{fmt(totalS)}</div>
                                                    {paidS > 0 && <div className="text-[10px] text-emerald-600 font-semibold">выпл. {fmt(paidS)}</div>}
                                                </td>
                                                <td className="px-3 text-right" style={{position:'sticky', right:0, zIndex:9, width:110, minWidth:110, maxWidth:110, boxSizing:'border-box', background: si%2===0?'#fff':'#f8fafc'}}>
                                                    <div className={`text-sm font-black ${dueS > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{dueS > 0 ? fmt(dueS) : '✓'}</div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-slate-100 border-t-2 border-slate-200">
                                        <td className="sticky left-0 bg-slate-100 px-4 py-2 text-xs font-black text-slate-500 uppercase tracking-wide border-r-2 border-slate-200">Итого</td>
                                        {gridDays.map(d => {
                                            const dayStr = ymdLocal(d);
                                            return [0,1].map(half => {
                                                const cellKey = `${dayStr}_${half}`;
                                                const cnt = staffList.filter(st => !!(shiftMap[st.id]||{})[cellKey]).length;
                                                return (
                                                    <td key={cellKey} className={`text-center py-2 ${half===0?'border-r border-dashed border-slate-300':'border-r border-slate-200'}`}>
                                                        {cnt > 0 && <span className="text-[10px] font-black text-slate-600">{cnt}</span>}
                                                    </td>
                                                );
                                            });
                                        })}
                                        <td className="px-2 text-center border-l-2 border-slate-200" style={{position:'sticky', right:260, zIndex:9, width:60, minWidth:60, maxWidth:60, boxSizing:'border-box', background:'#f1f5f9'}}>
                                            <div className="text-base font-black text-slate-700">{kpi.sutki}</div>
                                        </td>
                                        <td className="px-2 text-right" style={{position:'sticky', right:110, zIndex:9, width:150, minWidth:150, maxWidth:150, boxSizing:'border-box', background:'#f1f5f9'}}>
                                            <div className="text-sm font-black text-slate-800">{fmt(kpi.totalSal)}</div>
                                        </td>
                                        <td className="px-3 text-right" style={{position:'sticky', right:0, zIndex:9, width:110, minWidth:110, maxWidth:110, boxSizing:'border-box', background:'#f1f5f9'}}>
                                            <div className={`text-sm font-black ${kpi.salaryDue > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{kpi.salaryDue > 0 ? fmt(kpi.salaryDue) : '✓'}</div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="flex items-center gap-4 px-5 py-3 border-t border-slate-100 text-[11px] font-semibold text-slate-500 flex-wrap">
                            <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-md inline-flex items-center justify-center text-[10px]" style={{background:'linear-gradient(135deg,#22c55e,#15803d)'}}>💼</span>Активная</div>
                            <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-md inline-flex items-center justify-center text-white text-[10px]" style={{background:'linear-gradient(135deg,#10b981,#059669)'}}>✓</span>Сутки (смена)</div>
                            <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-md bg-emerald-200 inline-flex items-center justify-center text-emerald-800 text-[8px] font-black">ч</span>Короткая (&lt;6ч)</div>
                            <div className="flex items-center gap-1.5 ml-auto text-slate-400 italic">Клик по смене = редактировать</div>
                        </div>
                        {hoveredCell && (
                            <div style={{ position:'fixed', left:hoveredCell.x, top:hoveredCell.y-10, transform:'translate(-50%,-100%)', zIndex:9999, pointerEvents:'none' }}>
                                <div className="bg-slate-800 text-white text-[11px] rounded-lg px-3 py-2 whitespace-nowrap shadow-2xl font-semibold">
                                    <div>{hoveredCell.name}</div>
                                    <div>{hoveredCell.line1}</div>
                                    <div className="text-emerald-300">{hoveredCell.line2}</div>
                                </div>
                                <div className="w-2.5 h-2.5 bg-slate-800 mx-auto rotate-45 -mt-1.5"/>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* List view */}
            {view === 'list' && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    {displayedShifts.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 text-sm">Нет смен за выбранный период</div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {displayedShifts.map(s => {
                                const staff = users.find(u=>u.id===s.staffId);
                                const active = !s.endTime;
                                const hours  = s.endTime ? (new Date(s.endTime)-new Date(s.startTime))/3600000 : null;
                                const effR   = effShiftRange(s);
                                const salary = effR ? calcSalary(effR.start, effR.end) : null;
                                        const shiftPay = payments.filter(p => {
                                                if (p.type === 'cash_to_terminal') return false;
                                                const t = new Date(p.date).getTime();
                                                const st = new Date(s.startTime).getTime();
                                                const en = s.endTime ? new Date(s.endTime).getTime() : Date.now();
                                                return (p.staffId === s.staffId) && t >= st && t <= en;
                                            });
                                            const sCash = shiftPay.reduce((a,p)=>a+(p.cash!==undefined?parseInt(p.cash)||0:p.method==='cash'?parseInt(p.amount)||0:0),0);
                                            const sCard = shiftPay.reduce((a,p)=>a+(p.card!==undefined?parseInt(p.card)||0:p.method==='card'?parseInt(p.amount)||0:0),0);
                                            const sQR   = shiftPay.reduce((a,p)=>a+(p.qr!==undefined?parseInt(p.qr)||0:p.method==='qr'?parseInt(p.amount)||0:0),0);
                                            const sTotal = sCash + sCard + sQR;
                                        return (
                                            <div key={s.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                                                <span className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`}/>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-bold text-slate-800 truncate">
                                                        {staff?.name || '—'}<span className="text-[10px] font-normal text-slate-400"> · {HOSTELS[s.hostelId]?.name}</span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                                                        <span className="font-semibold">{fmtDate(s.startTime)}</span>
                                                        <span className="font-mono">{fmtTime(s.startTime)}–{active ? '…' : fmtTime(s.endTime)}</span>
                                                        {hours !== null && <span className="text-slate-400">{hours.toFixed(1)}ч</span>}
                                                        {sTotal > 0 && <span className="text-emerald-600 font-semibold">касса {fmt(sTotal)}</span>}
                                                    </div>
                                                </div>
                                                {active && <span className="text-[10px] font-black text-emerald-600 shrink-0 hidden sm:block">● сейчас</span>}
                                                <div className="text-right shrink-0 w-20">
                                                    <div className="text-sm font-black text-slate-800">{salary !== null ? fmt(salary) : '…'}</div>
                                                    <div className="text-[9px] text-slate-400 uppercase tracking-wide">ЗП</div>
                                                </div>
                                                {isAdmin && (
                                                    <div className="flex items-center gap-0.5 shrink-0">
                                                        {active && (
                                                            <button onClick={() => onAdminUpdateShift(s.id, { endTime: new Date().toISOString() })} title="Закрыть смену"
                                                                className="w-8 h-8 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 transition-all"><Power size={15}/></button>
                                                        )}
                                                        <button onClick={() => openEdit(s)} title="Изменить"
                                                            className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all"><Edit size={15}/></button>
                                                        <button onClick={() => handleDeleteShift(s)} title="Удалить смену"
                                                            className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"><Trash2 size={15}/></button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                            })}
                            <div className="flex items-center justify-end gap-5 px-5 py-3 bg-slate-50 border-t border-slate-200 flex-wrap">
                                <span className="text-xs text-slate-500 font-semibold mr-auto">{displayedShifts.length} записей · {kpi.sutki} сут</span>
                                <span className="text-xs text-slate-500">Начислено: <b className="text-slate-800">{fmt(kpi.totalSal)}</b></span>
                                <span className="text-xs text-slate-500">Выплачено: <b className="text-emerald-600">{fmt(kpi.salaryPaid)}</b></span>
                                <span className="text-xs text-slate-500">Остаток: <b className={kpi.salaryDue > 0 ? 'text-rose-600' : 'text-slate-400'}>{kpi.salaryDue > 0 ? fmt(kpi.salaryDue) : '✓'}</b></span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Salary view — помесячно */}
            {view === 'salary' && (
                <div className="space-y-4">
                    {monthlySalary.length === 0 ? (
                        <div className="py-16 text-center text-slate-400">
                            <Wallet size={36} className="mx-auto mb-3 opacity-30" />
                            <p className="font-semibold">Нет завершённых смен в выбранном периоде</p>
                            <p className="text-xs mt-1">Расширьте диапазон дат выше</p>
                        </div>
                    ) : monthlySalary.map(({ ym, rows, tot }) => {
                        const [y, m] = ym.split('-');
                        const monthName = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][parseInt(m) - 1];
                        return (
                            <div key={ym} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                    <span className="font-black text-slate-800">{monthName} {y}</span>
                                    <span className="text-xs font-semibold text-slate-500">Ставка: {dailyRate.toLocaleString('ru-RU')}/сут</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-[10px] uppercase text-slate-400 font-bold">
                                                <th className="text-left px-5 py-2">Кассир</th>
                                                <th className="text-right px-3 py-2">Сутки</th>
                                                <th className="text-right px-3 py-2">Начислено</th>
                                                <th className="text-right px-3 py-2">Выплачено</th>
                                                <th className="text-right px-5 py-2">Остаток</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map(r => (
                                                <tr key={r.id} className="border-t border-slate-100">
                                                    <td className="text-left px-5 py-2.5 font-bold text-slate-700">{r.name}</td>
                                                    <td className="text-right px-3 py-2.5 text-slate-500">{r.days}</td>
                                                    <td className="text-right px-3 py-2.5 font-semibold text-slate-800">{fmt(r.earned)}</td>
                                                    <td className="text-right px-3 py-2.5 text-emerald-600 font-semibold">{fmt(r.taken)}</td>
                                                    <td className="text-right px-5 py-2.5">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className={`font-black ${r.remaining > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{r.remaining > 0 ? fmt(r.remaining) : '✓'}</span>
                                                            {r.remaining > 0 && isAdmin && onPaySalary && (
                                                                <button onClick={() => { if (window.confirm(`Выдать ${fmt(r.remaining)} сум кассиру ${r.name}? Создастся расход «Зарплата».`)) onPaySalary({ staffId: r.id, amount: r.remaining, comment: `ЗП ${r.name} (${monthName} ${y})` }); }}
                                                                    className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black transition-colors">Выдать</button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-slate-200 bg-slate-50/60">
                                                <td className="text-left px-5 py-2.5 font-black text-slate-800">ИТОГО</td>
                                                <td className="text-right px-3 py-2.5 font-black text-slate-600">{tot.days}</td>
                                                <td className="text-right px-3 py-2.5 font-black text-slate-800">{fmt(tot.earned)}</td>
                                                <td className="text-right px-3 py-2.5 font-black text-emerald-600">{fmt(tot.taken)}</td>
                                                <td className={`text-right px-5 py-2.5 font-black ${tot.remaining > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{tot.remaining > 0 ? fmt(tot.remaining) : '✓'}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                    <p className="text-[11px] text-slate-400 text-center">
                        Начислено = сутки × ставка. Выплачено = расходы «Зарплата» + «Аванс» кассира за месяц. Остаток = начислено − выплачено.
                    </p>
                </div>
            )}

            {/* Активные смены — внизу, для админа */}
            {isAdmin && (() => {
                const activeShifts = shifts.filter(s => !s.endTime);
                if (!activeShifts.length) return null;
                const resolveList = allUsers || users;
                return (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>
                            <span className="font-black text-slate-700 text-sm">Сейчас на смене</span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">{activeShifts.length}</span>
                        </div>
                        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {activeShifts.map(s => {
                                const staff = resolveList.find(u => u.id === s.staffId || (s.staffLogin && u.login === s.staffLogin));
                                const hoursGone = ((Date.now() - new Date(s.startTime)) / 3600000).toFixed(1);
                                const isOrphaned = !staff;
                                const displayName = staff?.name || s.staffName || 'Удалённый пользователь';
                                const initial = (displayName || '?').trim().charAt(0).toUpperCase();
                                return (
                                    <div key={s.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${isOrphaned ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-slate-50/60'}`}>
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-white shrink-0 ${isOrphaned ? 'bg-amber-400' : 'bg-emerald-500'}`}>{isOrphaned ? '⚠' : initial}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-sm font-bold truncate ${isOrphaned ? 'text-amber-700' : 'text-slate-800'}`}>{displayName}</div>
                                            <div className="text-[11px] text-slate-400 truncate">
                                                {HOSTELS[s.hostelId]?.name} · с {fmtTime(s.startTime)} {fmtDate(s.startTime)} · <b className="text-emerald-600">{hoursGone}ч</b>
                                            </div>
                                            {isOrphaned && <div className="text-[10px] text-amber-600 font-bold">блокирует вход кассирам</div>}
                                        </div>
                                        <button
                                            onClick={() => onAdminUpdateShift(s.id, { endTime: new Date().toISOString() })}
                                            className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-colors">
                                            <Power size={12}/> Закрыть
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* Add/Edit modal */}
            {isAddModalOpen && (() => {
                const previewH = shiftForm.startTime && shiftForm.endTime
                    ? ((new Date(shiftForm.endTime)-new Date(shiftForm.startTime))/3600000) : null;
                const previewSal = previewH && previewH > 0
                    ? calcSalary(new Date(shiftForm.startTime).toISOString(), new Date(shiftForm.endTime).toISOString()) : null;
                const setTimeOnDate = (dtLocalStr, hh, mm) => {
                    if (!dtLocalStr) { const now = new Date(); now.setHours(hh, mm, 0, 0); return getLocalDatetimeString(now); }
                    const d = new Date(dtLocalStr); d.setHours(hh, mm, 0, 0); return getLocalDatetimeString(d);
                };
                const setEndAuto = () => {
                    if (!shiftForm.startTime) return;
                    const d = new Date(shiftForm.startTime); d.setTime(d.getTime() + 24*3600*1000);
                    setShiftForm(f=>({...f, endTime: getLocalDatetimeString(d)}));
                };
                const staffUser = users.find(u=>u.id===shiftForm.staffId);
                return (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100"
                                style={{background: editingShift ? '#f8fafc' : '#eef2ff'}}>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                                        style={{background: editingShift ? '#e2e8f0' : '#c7d2fe'}}>
                                        {editingShift ? '✏️' : '➕'}
                                    </div>
                                    <div>
                                        <div className="font-black text-slate-800">{editingShift ? 'Редактировать смену' : 'Новая смена'}</div>
                                        {staffUser && <div className="text-xs text-slate-400 font-semibold">{staffUser.name} · {HOSTELS[shiftForm.hostelId]?.name}</div>}
                                    </div>
                                </div>
                                <button onClick={()=>setIsAddModalOpen(false)}
                                    className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-200 text-slate-400 transition-colors">
                                    <X size={18}/>
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-1.5">Сотрудник</label>
                                        <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white font-semibold"
                                            value={shiftForm.staffId} onChange={e=>setShiftForm(f=>({...f,staffId:e.target.value}))}>
                                            {users.filter(u=>u.role==='cashier').map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-1.5">Хостел</label>
                                        <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white font-semibold"
                                            value={shiftForm.hostelId} onChange={e=>setShiftForm(f=>({...f,hostelId:e.target.value}))}>
                                            {Object.keys(HOSTELS).map(k=><option key={k} value={k}>{HOSTELS[k].name}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-wide">Начало смены</label>
                                        <div className="flex gap-1">
                                            {[['09:00',9,0],['21:00',21,0]].map(([label,hh,mm])=>(
                                                <button key={label} type="button" onClick={()=>setShiftForm(f=>({...f,startTime:setTimeOnDate(f.startTime,hh,mm)}))}
                                                    className="px-2 py-0.5 text-[10px] font-bold rounded-md border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors">{label}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <input type="datetime-local" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 font-mono"
                                        value={shiftForm.startTime} onChange={e=>setShiftForm(f=>({...f,startTime:e.target.value}))}/>
                                </div>

                                <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-wide">Конец смены <span className="font-normal text-slate-400 normal-case">(необязательно)</span></label>
                                        <div className="flex gap-1">
                                            {[['09:00',9,0],['21:00',21,0]].map(([label,hh,mm])=>(
                                                <button key={label} type="button" onClick={()=>setShiftForm(f=>({...f,endTime:setTimeOnDate(f.endTime||f.startTime,hh,mm)}))}
                                                    className="px-2 py-0.5 text-[10px] font-bold rounded-md border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors">{label}</button>
                                            ))}
                                            <button type="button" onClick={setEndAuto} title="Выставить конец = начало + 24ч"
                                                className="px-2 py-0.5 text-[10px] font-bold rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">+24ч</button>
                                        </div>
                                    </div>
                                    <input type="datetime-local" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 font-mono"
                                        value={shiftForm.endTime} onChange={e=>setShiftForm(f=>({...f,endTime:e.target.value}))}/>
                                </div>

                                {previewH !== null && previewH > 0 && (
                                    <div className="rounded-xl p-4 flex items-center gap-6" style={{background: '#f0fdf4', border: '1px solid #bbf7d0'}}>
                                        <div className="text-center"><div className="text-2xl font-black text-emerald-600">{previewH.toFixed(1)}ч</div><div className="text-[10px] text-emerald-500 font-semibold uppercase">отработано</div></div>
                                        <div className="w-px h-10 bg-emerald-200"/>
                                        <div className="text-center"><div className="text-2xl font-black text-emerald-600">{fmt(previewSal)}</div><div className="text-[10px] text-emerald-500 font-semibold uppercase">зарплата</div></div>
                                    </div>
                                )}
                                {previewH !== null && previewH <= 0 && (
                                    <div className="rounded-xl p-3 text-sm font-semibold text-rose-600 bg-rose-50 border border-rose-200">⚠ Конец раньше начала</div>
                                )}

                                <div className="flex gap-3 pt-1">
                                    <button onClick={()=>setIsAddModalOpen(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Отмена</button>
                                    <button onClick={handleSaveShift} className="flex-2 flex-grow-[2] py-3 rounded-xl text-white text-sm font-bold transition-colors shadow-sm" style={{background:'#16a34a'}}>
                                        {editingShift ? '✏️ Сохранить изменения' : '➕ Добавить смену'}
                                    </button>
                                </div>
                                {editingShift && isAdmin && (
                                    <button onClick={()=>handleDeleteShift(editingShift)} className="w-full py-2.5 rounded-xl border border-rose-200 text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors">
                                        🗑 Удалить смену
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default ShiftsView;
