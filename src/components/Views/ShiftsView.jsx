import React, { useState, useMemo } from 'react';
import { Power, LogOut, LayoutDashboard, FileText, Plus, Edit, FileSpreadsheet, X, Calendar, Magnet } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

// --- Constants ---
const DAILY_SALARY = 266666;

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
const ShiftsView = ({ shifts, users, currentUser, onStartShift, onEndShift, onTransferShift, lang, hostelId, onAdminAddShift, onAdminUpdateShift, payments = [] }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';

    const myActiveShift = shifts.find(s => s.staffId === currentUser.id && !s.endTime);
    const allCashiers = users.filter(u => u.role === 'cashier' && u.id !== currentUser.id);
    const [transferTarget, setTransferTarget] = useState('');
    const [view, setView] = useState('grid');
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 27)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [filterCashierId, setFilterCashierId] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingShift, setEditingShift] = useState(null);
    const [shiftForm, setShiftForm] = useState({ staffId: '', startTime: '', endTime: '', hostelId: 'hostel1' });
    const [hoveredCell, setHoveredCell] = useState(null);

    const cashierIds = useMemo(() => new Set(users.filter(u => u.role === 'cashier').map(u => u.id)), [users]);

    const displayedShifts = useMemo(() => {
        // Смены только кассиров — admin не учитывается
        let list = shifts.filter(s => cashierIds.has(s.staffId));
        if (!isAdmin) {
            list = list.filter(s => s.staffId === currentUser.id);
        } else {
            const start = new Date(dateRange.start); start.setHours(0,0,0,0);
            const end   = new Date(dateRange.end);   end.setHours(23,59,59,999);
            list = list.filter(s => { const d = new Date(s.startTime); return d >= start && d <= end; });
            if (filterCashierId) list = list.filter(s => s.staffId === filterCashierId);
        }
        return list.sort((a,b) => new Date(b.startTime) - new Date(a.startTime));
    }, [shifts, cashierIds, isAdmin, currentUser.id, dateRange, filterCashierId]);

    const kpi = useMemo(() => {
        const finished = displayedShifts.filter(s => s.endTime);
        const totalH   = finished.reduce((s,x) => s + (new Date(x.endTime)-new Date(x.startTime))/3600000, 0);
        const totalSal = finished.reduce((s,x) => s + calculateSalary(x.startTime, x.endTime), 0);
        const active   = displayedShifts.filter(s => !s.endTime).length;
        const avgH     = finished.length ? totalH / finished.length : 0;

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
                return { totalH: totalH.toFixed(1), totalSal, active, avgH: avgH.toFixed(1), count: 0, totalCash: 0, totalCard: 0, totalQR: 0, totalInc: 0 };
            }
            payStart = Math.min(...displayedShifts.map(s => new Date(s.startTime).getTime()));
            payEnd   = Math.max(...displayedShifts.map(s => new Date(s.endTime || Date.now()).getTime()));
        }

        const relPay = payments.filter(p => {
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

        const totalCash = relPay.filter(p=>p.method==='cash').reduce((s,p)=>s+(parseInt(p.amount)||0),0);
        const totalCard = relPay.filter(p=>p.method==='card').reduce((s,p)=>s+(parseInt(p.amount)||0),0);
        const totalQR   = relPay.filter(p=>p.method==='qr').reduce((s,p)=>s+(parseInt(p.amount)||0),0);
        const totalInc  = totalCash + totalCard + totalQR;
        return { totalH: totalH.toFixed(1), totalSal, active, avgH: avgH.toFixed(1), count: displayedShifts.length, totalCash, totalCard, totalQR, totalInc };
    }, [displayedShifts, payments, filterCashierId, users, isAdmin, currentUser, dateRange]);

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

    const getShiftSlots = (shift) => {
        const start = new Date(shift.startTime);
        const end   = shift.endTime ? new Date(shift.endTime) : new Date();
        const slots = [];
        const cursor = new Date(start);
        const h = cursor.getHours();
        if (h >= 9 && h < 21) { cursor.setHours(9, 0, 0, 0); }
        else if (h >= 21)     { cursor.setHours(21, 0, 0, 0); }
        else                  { cursor.setDate(cursor.getDate()-1); cursor.setHours(21,0,0,0); }
        const MS_12H = 12 * 3600 * 1000;
        let safety = 0;
        while (cursor < end && safety++ < 60) {
            const dayStr = cursor.toISOString().split('T')[0];
            const half   = cursor.getHours() === 9 ? 0 : 1;
            slots.push(`${dayStr}_${half}`);
            cursor.setTime(cursor.getTime() + MS_12H);
        }
        return slots;
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
    const todayStr = new Date().toISOString().split('T')[0];

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

    const handleExportExcel = () => {
        const rows = displayedShifts.map(s => {
            const staff = users.find(u=>u.id===s.staffId)?.name||'?';
            const start = new Date(s.startTime), end = s.endTime ? new Date(s.endTime) : null;
            const hours = end ? ((end-start)/3600000).toFixed(1) : '—';
            const salary = end ? calculateSalary(s.startTime, s.endTime) : 0;
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
                        <button onClick={onStartShift} className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-sm transition-colors">
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

            {/* Активные смены — только для админа */}
            {isAdmin && (() => {
                const activeShifts = shifts.filter(s => !s.endTime && cashierIds.has(s.staffId));
                if (!activeShifts.length) return null;
                return (
                    <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0"/>
                            <span className="text-rose-700 font-black text-sm uppercase tracking-wide">Активные смены сейчас</span>
                            <span className="ml-1 px-2 py-0.5 rounded-full bg-rose-200 text-rose-700 text-xs font-black">{activeShifts.length}</span>
                        </div>
                        <div className="space-y-2">
                            {activeShifts.map(s => {
                                const staff = users.find(u => u.id === s.staffId);
                                const hoursGone = ((Date.now() - new Date(s.startTime)) / 3600000).toFixed(1);
                                return (
                                    <div key={s.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-rose-100">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"/>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-bold text-slate-800">{staff?.name || '—'}</span>
                                            <span className="text-slate-400 text-sm ml-2">{HOSTELS[s.hostelId]?.name}</span>
                                            <span className="text-slate-400 text-xs ml-2">с {fmtTime(s.startTime)} {fmtDate(s.startTime)} · {hoursGone}ч</span>
                                        </div>
                                        <button
                                            onClick={() => onAdminUpdateShift(s.id, { endTime: new Date().toISOString() })}
                                            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-colors">
                                            <Power size={12}/> Закрыть смену
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { icon:'⏱',  label:'Часов отработано', value: kpi.totalH + 'ч', sub: `${kpi.count} смен`,     color:'#4f46e5', bg:'#eef2ff' },
                    { icon:'💰',  label:'Зарплата итого',   value: fmt(kpi.totalSal),sub: 'за период',              color:'#15803d', bg:'#dcfce7' },
                    { icon:'📊',  label:'Ср. длина смены',  value: kpi.avgH + 'ч',   sub: 'на сотрудника',          color:'#b45309', bg:'#fef9c3' },
                    { icon:'🟢',  label:'Активных смен',    value: kpi.active,        sub: kpi.active ? 'прямо сейчас' : 'нет активных', color:'#065f46', bg:'#d1fae5' },
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
                        <div className="ml-auto"><span className="text-xs text-slate-400 font-semibold">Итого: </span><span className="font-black text-emerald-600 text-base">{fmt(kpi.totalInc)}</span></div>
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center gap-3 flex-wrap shadow-sm">
                {isAdmin && <>
                    <input type="date" className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        value={dateRange.start} onChange={e => setDateRange(r=>({...r, start:e.target.value}))}/>
                    <span className="text-slate-400 text-sm">—</span>
                    <input type="date" className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        value={dateRange.end} onChange={e => setDateRange(r=>({...r, end:e.target.value}))}/>
                    <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        value={filterCashierId} onChange={e => setFilterCashierId(e.target.value)}>
                        <option value="">Все сотрудники</option>
                        {users.filter(u=>u.role==='cashier').map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                </>}

                <div className="ml-auto flex items-center gap-2">
                    <div className="flex rounded-xl overflow-hidden border border-slate-200">
                        <button onClick={()=>setView('grid')} className="px-3 py-2 text-sm font-bold transition-colors flex items-center gap-1.5"
                            style={view==='grid' ? {background:'#4f46e5',color:'#fff'} : {background:'#fff',color:'#64748b'}}>
                            <LayoutDashboard size={14}/> Шахматка
                        </button>
                        <button onClick={()=>setView('list')} className="px-3 py-2 text-sm font-bold transition-colors flex items-center gap-1.5 border-l border-slate-200"
                            style={view==='list' ? {background:'#4f46e5',color:'#fff'} : {background:'#fff',color:'#64748b'}}>
                            <FileText size={14}/> Список
                        </button>
                    </div>
                    {isAdmin && <>
                        <button onClick={() => { setEditingShift(null); setShiftForm({staffId:users.filter(u=>u.role==='cashier')[0]?.id||'',startTime:'',endTime:'',hostelId:'hostel1'}); setIsAddModalOpen(true); }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold transition-colors">
                            <Plus size={15}/> Добавить
                        </button>
                        <button onClick={handleExportExcel}
                            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                            <FileSpreadsheet size={15}/> Excel
                        </button>
                    </>}
                </div>
            </div>

            {/* Grid view */}
            {view === 'grid' && (() => {
                const nowH = new Date().getHours();
                const currentHalf = nowH >= 9 && nowH < 21 ? 0 : 1;
                return (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse" style={{minWidth: 140 + gridDays.length*42}}>
                                <thead>
                                    <tr>
                                        <th className="sticky left-0 z-20 bg-slate-50 border-b border-r-2 border-slate-200 px-4 text-left text-xs font-black text-slate-400 uppercase tracking-wide"
                                            style={{minWidth:140, width:140}} rowSpan={2}>
                                            Сотрудник
                                        </th>
                                        {gridDays.map(d => {
                                            const str = d.toISOString().split('T')[0];
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
                                        <th className="border-b-2 border-slate-200 bg-slate-50 px-3 text-right text-xs font-black text-slate-400 uppercase tracking-wide" style={{minWidth:80}} rowSpan={2}>Итого</th>
                                    </tr>
                                    <tr>
                                        {gridDays.map(d => {
                                            const str = d.toISOString().split('T')[0];
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
                                        const totalH = displayedShifts.filter(s=>s.staffId===staff.id&&s.endTime).reduce((sum,s)=>sum+(new Date(s.endTime)-new Date(s.startTime))/3600000,0);
                                        const totalS = displayedShifts.filter(s=>s.staffId===staff.id&&s.endTime).reduce((sum,s)=>sum+calculateSalary(s.startTime,s.endTime),0);
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
                                                    const allKeys = gridDays.flatMap(d => [0,1].map(h => `${d.toISOString().split('T')[0]}_${h}`));
                                                    const CELL_W = 21;
                                                    return gridDays.flatMap(d => {
                                                        const dayStr  = d.toISOString().split('T')[0];
                                                        const isToday = dayStr===todayStr;
                                                        return [0,1].map(half => {
                                                            const cellKey  = `${dayStr}_${half}`;
                                                            const cellInfo = staffShifts[cellKey];
                                                            const isCurrentSlot = isToday && currentHalf===half;
                                                            const isHov = hoveredCell?.staffId===staff.id && hoveredCell?.dayStr===cellKey;
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
                                                            const bg = active ? '#22c55e' : shiftH>=10 ? '#4f46e5' : shiftH>=6 ? '#818cf8' : shiftH>=2 ? '#a5b4fc' : '#c7d2fe';
                                                            const fg = active||shiftH>=6 ? '#fff' : '#4338ca';
                                                            const barW = colspan * CELL_W - 4;
                                                            return (
                                                                <td key={cellKey}
                                                                    onMouseEnter={()=>setHoveredCell({staffId:staff.id,dayStr:cellKey})}
                                                                    onMouseLeave={()=>setHoveredCell(null)}
                                                                    className={`relative ${half===0?'border-r border-dashed border-slate-200':'border-r border-slate-200'}`}
                                                                    style={{height:44, width:CELL_W, overflow:'visible', background:cellBg}}>
                                                                    <div onClick={() => openEdit(s)} title={`${fmtTime(s.startTime)} – ${s.endTime ? fmtTime(s.endTime) : 'сейчас'} (${shiftH.toFixed(1)}ч)`}
                                                                        style={{ position:'absolute', top:8, bottom:8, left:2, width:barW, zIndex:3, background: bg, color: fg, borderRadius: 6, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', userSelect:'none', fontSize: 9, fontWeight: 800, whiteSpace:'nowrap', overflow:'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }}>
                                                                        {colspan >= 2 ? `${fmtTime(s.startTime)}–${s.endTime?fmtTime(s.endTime):'…'}` : `${shiftH.toFixed(0)}ч`}
                                                                    </div>
                                                                    {isHov && (
                                                                        <div className="absolute z-50 left-1/2 -translate-x-1/2 -top-1 -translate-y-full pointer-events-none" style={{minWidth:160}}>
                                                                            <div className="bg-slate-800 text-white text-[11px] rounded-lg px-3 py-2 whitespace-nowrap shadow-xl font-semibold">
                                                                                <div>{users.find(u=>u.id===s.staffId)?.name}</div>
                                                                                <div>{fmtTime(s.startTime)} – {s.endTime ? fmtTime(s.endTime) : 'сейчас'}</div>
                                                                                <div>{shiftH.toFixed(1)}ч · {fmt(s.endTime?calculateSalary(s.startTime,s.endTime):0)} сум</div>
                                                                            </div>
                                                                            <div className="w-2 h-2 bg-slate-800 mx-auto rotate-45 -mt-1"/>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                            );
                                                        });
                                                    });
                                                })()}
                                                <td className="px-3 text-right">
                                                    <div className="text-sm font-black text-indigo-600">{totalH.toFixed(1)}ч</div>
                                                    <div className="text-[10px] text-slate-400">{fmt(totalS)}</div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-slate-100 border-t-2 border-slate-200">
                                        <td className="sticky left-0 bg-slate-100 px-4 py-2 text-xs font-black text-slate-500 uppercase tracking-wide border-r-2 border-slate-200">Итого</td>
                                        {gridDays.map(d => {
                                            const dayStr = d.toISOString().split('T')[0];
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
                                        <td className="px-3 text-right">
                                            <div className="text-sm font-black text-indigo-600">{kpi.totalH}ч</div>
                                            <div className="text-[10px] text-slate-400">{fmt(kpi.totalSal)}</div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="flex items-center gap-4 px-5 py-3 border-t border-slate-100 text-[11px] font-semibold text-slate-500 flex-wrap">
                            <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-md bg-emerald-400 inline-block"/>Активная</div>
                            <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-md bg-indigo-500 inline-block"/>10+ ч</div>
                            <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-md bg-indigo-300 inline-block"/>6–10 ч</div>
                            <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-md bg-indigo-200 inline-block"/>2–6 ч</div>
                            <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-md bg-indigo-100 inline-block"/>&lt;2 ч</div>
                            <div className="flex items-center gap-1.5 text-slate-400">☀ = 09:00–21:00 · 🌙 = 21:00–09:00</div>
                            <div className="flex items-center gap-1.5 ml-auto text-slate-400 italic">Клик по ячейке = редактировать</div>
                        </div>
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
                                const salary = s.endTime ? calculateSalary(s.startTime, s.endTime) : null;
                                        const shiftPay = payments.filter(p => {
                                                const t = new Date(p.date).getTime();
                                                const st = new Date(s.startTime).getTime();
                                                const en = s.endTime ? new Date(s.endTime).getTime() : Date.now();
                                                return (p.staffId === s.staffId) && t >= st && t <= en;
                                            });
                                            const sCash = shiftPay.filter(p=>p.method==='cash').reduce((a,p)=>a+(parseInt(p.amount)||0),0);
                                            const sCard = shiftPay.filter(p=>p.method==='card').reduce((a,p)=>a+(parseInt(p.amount)||0),0);
                                            const sQR   = shiftPay.filter(p=>p.method==='qr').reduce((a,p)=>a+(parseInt(p.amount)||0),0);
                                            const sTotal = sCash + sCard + sQR;
                                        return (
                                            <div key={s.id} className="group flex flex-col px-5 py-3.5 hover:bg-slate-50 transition-colors border-b border-slate-50">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`}/>
                                                    <div className="w-28 shrink-0">
                                                        <div className="text-sm font-bold text-slate-800 truncate">{staff?.name||'—'}</div>
                                                        <div className="text-[10px] text-slate-400">{HOSTELS[s.hostelId]?.name}</div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <span className="font-semibold text-slate-700">{fmtDate(s.startTime)}</span>
                                                            <span className="text-slate-300">·</span>
                                                            <span className="font-mono text-slate-700">{fmtTime(s.startTime)}</span>
                                                            <span className="text-slate-300">→</span>
                                                            {active ? <span className="text-emerald-600 font-bold">в процессе</span> : <span className="font-mono text-slate-700">{fmtTime(s.endTime)}</span>}
                                                        </div>
                                                    </div>
                                                    {hours !== null ? (
                                                        <div className="shrink-0 text-center w-16">
                                                            <div className="text-sm font-black" style={{color: hours>=8?'#4f46e5':hours>=4?'#818cf8':'#94a3b8'}}>{hours.toFixed(1)}ч</div>
                                                        </div>
                                                    ) : <div className="w-16"/>}
                                                    <div className="shrink-0 w-24 text-right">
                                                        {salary !== null ? <span className="text-sm font-black text-emerald-600">{fmt(salary)}</span> : <span className="text-xs text-slate-400">…</span>}
                                                    </div>
                                                    {isAdmin && active && (
                                                        <button
                                                            onClick={() => onAdminUpdateShift(s.id, { endTime: new Date().toISOString() })}
                                                            className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-colors"
                                                            title="Принудительно закрыть смену">
                                                            <Power size={12}/> Закрыть
                                                        </button>
                                                    )}
                                                    {isAdmin && (
                                                        <button onClick={() => openEdit(s)}
                                                            className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all shrink-0">
                                                            <Edit size={15}/>
                                                        </button>
                                                    )}
                                                </div>
                                                {sTotal > 0 && (
                                                    <div className="ml-[52px] mt-1.5 flex gap-3 text-[11px] font-semibold text-slate-500">
                                                        {sCash > 0 && <span className="bg-slate-100 px-2 py-0.5 rounded-full">💵 {fmt(sCash)}</span>}
                                                        {sCard > 0 && <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">💳 {fmt(sCard)}</span>}
                                                        {sQR > 0   && <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">QR {fmt(sQR)}</span>}
                                                        <span className="bg-emerald-50 text-emerald-700 font-black px-2 py-0.5 rounded-full">∑ {fmt(sTotal)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                            })}
                            <div className="flex items-center justify-end gap-6 px-5 py-3 bg-slate-50 border-t border-slate-200">
                                <span className="text-xs text-slate-500 font-semibold">{displayedShifts.length} записей</span>
                                <span className="text-sm font-black text-indigo-600">{kpi.totalH}ч</span>
                                <span className="text-sm font-black text-emerald-600">{fmt(kpi.totalSal)} сум</span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit modal */}
            {isAddModalOpen && (() => {
                const previewH = shiftForm.startTime && shiftForm.endTime
                    ? ((new Date(shiftForm.endTime)-new Date(shiftForm.startTime))/3600000) : null;
                const previewSal = previewH && previewH > 0
                    ? calculateSalary(new Date(shiftForm.startTime).toISOString(), new Date(shiftForm.endTime).toISOString()) : null;
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
                                    <button onClick={handleSaveShift} className="flex-2 flex-grow-[2] py-3 rounded-xl text-white text-sm font-bold transition-colors shadow-sm" style={{background:'#4f46e5'}}>
                                        {editingShift ? '✏️ Сохранить изменения' : '➕ Добавить смену'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default ShiftsView;
