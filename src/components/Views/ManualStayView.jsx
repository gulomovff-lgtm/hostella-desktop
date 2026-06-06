import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, X, Search, Loader2, Edit2, Check, Users, CalendarDays, ChevronDown, ChevronRight, CreditCard, DollarSign, Shuffle, Trash2, FileText, TrendingUp, Archive, ArchiveRestore } from 'lucide-react';
import {
    collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch, addDoc,
} from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../../firebase';

const CONTRACT_GROUPS_KEY = 'hostella_contract_groups';
const COLLECTION = [...PUBLIC_DATA_PATH, 'manualStayGroups'];
const PAYMENTS_COLLECTION = [...PUBLIC_DATA_PATH, 'payments'];
const TRANSFER_ENTITIES = ['YATT SOBIROVA', 'YATT YULDASHEV'];

const INP = 'px-2.5 py-1.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-700 transition-all';

const fmt = n => (parseInt(n) || 0).toLocaleString('ru');

const getStayNights = (stay) => {
    const d = parseInt(stay?.days, 10);
    if (d > 0) return d;
    if (!stay?.checkInDate || !stay?.checkOutDate) return 0;
    const ms = new Date(stay.checkOutDate) - new Date(stay.checkInDate);
    return ms > 0 ? Math.round(ms / 86400000) : 0;
};

const pluralGroups = (n) => {
    if (n % 10 === 1 && n % 100 !== 11) return 'группа';
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'группы';
    return 'групп';
};

const computeEntry = (entry) => {
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

const ACCENT_COLORS = ['#6366f1', '#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#14b8a6', '#fb923c'];

// ── Выпадающий выбор комнат ─────────────────────────────────────────────────
const RoomPicker = ({ rooms, selected, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const selSet = new Set(selected);
    const toggle = (id) => {
        const next = new Set(selSet);
        if (next.has(id)) next.delete(id); else next.add(id);
        onChange([...next]);
    };

    const label = selected.length === 0
        ? 'Комнаты'
        : rooms.filter(r => selSet.has(r.id)).map(r => `№${r.number}`).join(', ');

    const btnRef = useRef(null);
    const [dropPos, setDropPos] = useState({ top: 0, left: 0 });

    const handleOpen = () => {
        if (!open && btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            setDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
        }
        setOpen(v => !v);
    };

    return (
        <div className="relative" ref={ref}>
            <button
                ref={btnRef}
                type="button"
                onClick={handleOpen}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-xl border transition-all ${open ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
            >
                <span className="max-w-[120px] truncate font-semibold">{label}</span>
                <ChevronDown size={11} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="fixed z-[200] bg-white border border-slate-200 rounded-xl shadow-xl p-2 min-w-[170px] max-h-52 overflow-y-auto" style={{ top: dropPos.top, left: dropPos.left }}>
                    {rooms.length === 0
                        ? <div className="text-xs text-slate-400 px-2 py-1.5">Нет комнат</div>
                        : rooms.map(room => {
                            const checked = selSet.has(room.id);
                            return (
                                <button
                                    key={room.id}
                                    type="button"
                                    onClick={() => toggle(room.id)}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${checked ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'}`}>
                                        {checked && <Check size={8} className="text-white" strokeWidth={3} />}
                                    </div>
                                    <span className="font-semibold">№{room.number}</span>
                                    {room.name ? <span className="text-slate-400 truncate">{room.name}</span> : null}
                                </button>
                            );
                        })
                    }
                </div>
            )}
        </div>
    );
};

// ── Модал оплаты ────────────────────────────────────────────────────────────
const PaymentModal = ({ group, groups, currentUser, onClose }) => {
    // groups = array for merged payment, group = single group
    const allGroups = groups || (group ? [group] : []);
    const combinedDebt = allGroups.reduce((s, g) => s + (g.debt || 0), 0);
    const combinedName = allGroups.length === 1 ? allGroups[0].name : allGroups.map(g => g.name).join(', ');

    const [method, setMethod] = useState('cash');
    const [amount, setAmount] = useState('');
    const [cashAmount, setCashAmount] = useState('');
    const [transferAmount, setTransferAmount] = useState('');
    const [transferTo, setTransferTo] = useState(TRANSFER_ENTITIES[0]);
    const [saving, setSaving] = useState(false);

    const handlePay = async () => {
        const cash = method === 'cash' ? (parseInt(amount) || 0) : (method === 'mix' ? (parseInt(cashAmount) || 0) : 0);
        const transfer = method === 'transfer' ? (parseInt(amount) || 0) : (method === 'mix' ? (parseInt(transferAmount) || 0) : 0);
        const total = cash + transfer;
        if (total <= 0) return;
        setSaving(true);
        try {
            for (const g of allGroups) {
                const groupShare = allGroups.length === 1 ? total : Math.round(total * ((g.debt || 0) / Math.max(1, combinedDebt)));
                await addDoc(collection(db, ...PAYMENTS_COLLECTION), {
                    date: new Date().toISOString(),
                    staffId: currentUser.id || currentUser.login || '',
                    hostelId: currentUser.hostelId || '',
                    type: 'income',
                    category: 'contract',
                    comment: allGroups.length > 1 ? `Договор (объед.): ${combinedName}` : `Договор: ${g.name}`,
                    contractGroupId: g.id,
                    cash: allGroups.length === 1 ? cash : Math.round(cash * ((g.debt || 0) / Math.max(1, combinedDebt))),
                    card: 0,
                    qr: 0,
                    transfer: allGroups.length === 1 ? transfer : Math.round(transfer * ((g.debt || 0) / Math.max(1, combinedDebt))),
                    ...(transfer > 0 ? { transferTo } : {}),
                    amount: allGroups.length === 1 ? total : groupShare,
                    method: method === 'mix' ? 'mix' : method === 'transfer' ? 'transfer' : 'cash',
                });
            }
            onClose();
        } catch (e) {
            console.error('[PaymentModal]', e);
        }
        setSaving(false);
    };

    const needsTransferTo = method === 'transfer' || method === 'mix';

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.6)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-800">{allGroups.length > 1 ? `Объединённая оплата (${allGroups.length} гр.)` : 'Оплата по договору'}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><X size={15}/></button>
                </div>
                <div className="text-sm font-semibold text-slate-600 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                    {allGroups.length > 1
                        ? <div className="space-y-0.5">{allGroups.map(g => <div key={g.id} className="flex items-center justify-between"><span>{g.name}</span>{g.debt > 0 && <span className="text-xs text-rose-500 font-bold">{fmt(g.debt)}</span>}</div>)}</div>
                        : <>{allGroups[0]?.name}{combinedDebt > 0 && <span className="ml-2 text-xs text-rose-500 font-bold">долг: {fmt(combinedDebt)} сум</span>}</>
                    }
                </div>

                {/* Метод */}
                <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Способ оплаты</div>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: 'cash', icon: <DollarSign size={14}/>, label: 'Наличные' },
                            { id: 'transfer', icon: <CreditCard size={14}/>, label: 'Перечисление' },
                            { id: 'mix', icon: <Shuffle size={14}/>, label: 'Микс' },
                        ].map(opt => (
                            <button key={opt.id} type="button"
                                onClick={() => setMethod(opt.id)}
                                className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${method === opt.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                            >
                                {opt.icon}
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Суммы */}
                {method !== 'mix' ? (
                    <div>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Сумма</div>
                        <input
                            autoFocus
                            type="number" min="0"
                            value={amount}
                            onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder={combinedDebt > 0 ? String(combinedDebt) : '0'}
                            className={INP + ' w-full text-right font-bold text-base'}
                            onKeyDown={e => e.key === 'Enter' && handlePay()}
                        />
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div>
                            <div className="text-xs font-bold text-slate-500 mb-1.5">💵 Наличные</div>
                            <input type="number" min="0" value={cashAmount}
                                onChange={e => setCashAmount(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="0" className={INP + ' w-full text-right font-bold'} />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-500 mb-1.5">🏦 Перечисление</div>
                            <input type="number" min="0" value={transferAmount}
                                onChange={e => setTransferAmount(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="0" className={INP + ' w-full text-right font-bold'} />
                        </div>
                        {(parseInt(cashAmount)||0) + (parseInt(transferAmount)||0) > 0 && (
                            <div className="text-xs text-right text-slate-500">Итого: <b>{fmt((parseInt(cashAmount)||0) + (parseInt(transferAmount)||0))}</b> сум</div>
                        )}
                    </div>
                )}

                {/* Получатель перечисления */}
                {needsTransferTo && (
                    <div>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Получатель</div>
                        <div className="grid grid-cols-2 gap-2">
                            {TRANSFER_ENTITIES.map(ent => (
                                <button key={ent} type="button"
                                    onClick={() => setTransferTo(ent)}
                                    className={`px-3 py-2 rounded-xl border-2 text-xs font-bold transition-all text-left ${transferTo === ent ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:border-teal-300'}`}
                                >
                                    {ent}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-2 pt-1">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors">
                        Отмена
                    </button>
                    <button onClick={handlePay} disabled={saving} className="flex-2 flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                        {saving ? 'Сохраняем…' : 'Оплатить'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Строка специальности (локальный стейт → Firestore только onBlur) ──────
const WorkerGroupRow = ({ wg, wgIdx, onUpdate, onRemove, options = [] }) => {
    const [specialty, setSpecialty] = useState(wg.specialty || '');
    const [count, setCount] = useState(wg.count || '');
    useEffect(() => { setSpecialty(wg.specialty || ''); }, [wg.specialty]);
    useEffect(() => { setCount(wg.count || ''); }, [wg.count]);
    const listId = `spec-list-${wg.id || wgIdx}`;
    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] w-4 text-right shrink-0" style={{ color: 'rgba(94,234,212,0.4)' }}>{wgIdx + 1}.</span>
            <input
                value={specialty}
                list={options.length ? listId : undefined}
                onChange={e => setSpecialty(e.target.value)}
                onBlur={() => { if (specialty !== (wg.specialty || '')) onUpdate({ specialty }); }}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                placeholder="Специальность (маляры, штукатуры…)"
                className="flex-1 px-2 py-1 text-[11px] rounded-lg focus:outline-none"
                style={{ border: '1px solid rgba(94,234,212,0.2)', background: 'rgba(94,234,212,0.06)', color: '#e2f7f8' }}
            />
            {options.length > 0 && (
                <datalist id={listId}>
                    {options.map(o => <option key={o} value={o} />)}
                </datalist>
            )}
            <input
                type="number" min="0"
                value={count}
                onChange={e => setCount(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={() => { if (String(count) !== String(wg.count || '')) onUpdate({ count }); }}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                placeholder="0"
                className="w-14 px-1.5 py-1 text-[11px] rounded-lg focus:outline-none text-center font-semibold"
                style={{ border: '1px solid rgba(94,234,212,0.2)', background: 'rgba(94,234,212,0.06)', color: '#e2f7f8' }}
            />
            <span className="text-[10px] shrink-0" style={{ color: 'rgba(94,234,212,0.4)' }}>чел</span>
            <button onClick={onRemove}
                className="w-5 h-5 rounded-lg flex items-center justify-center transition-colors shrink-0"
                style={{ color: 'rgba(94,234,212,0.3)' }}
                onMouseEnter={e => e.currentTarget.style.color='#f87171'} onMouseLeave={e => e.currentTarget.style.color='rgba(94,234,212,0.3)'}>
                <X size={10} />
            </button>
        </div>
    );
};

// ── Числовой инпут с локальным стейтом (запись по blur, без зависания) ──────
const LocalNumInput = ({ value, onCommit, className, style, placeholder }) => {
    const [v, setV] = useState(value ?? '');
    useEffect(() => { setV(value ?? ''); }, [value]);
    return (
        <input type="number" min="0" value={v} placeholder={placeholder}
            onChange={e => setV(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => { if (String(v) !== String(value ?? '')) onCommit(v); }}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
            className={className} style={style} />
    );
};

// ── Мини-календарь периодов договора (месячная сетка, как Google Calendar) ──
const pmcFmtISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const PMC_MONTHS_FULL = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const pmcSd = (iso) => { if (!iso) return ''; const [, m, d] = iso.split('-'); return `${parseInt(d)}.${m}`; };

const PeriodMiniCalendar = ({ entries = [], onAddPeriod, onEditPeriod, onDeletePeriod }) => {
    const withDates = entries.filter(e => e.checkIn && e.checkOut);
    const initRef = useRef(null);
    if (!initRef.current) {
        const isos = withDates.flatMap(e => [e.checkIn, e.checkOut]).filter(Boolean).sort();
        const base = isos.length ? new Date(isos[isos.length - 1] + 'T12:00:00') : new Date();
        initRef.current = { y: base.getFullYear(), m: base.getMonth() };
    }
    const [ym, setYm] = useState(initRef.current);
    const [dayPopup, setDayPopup] = useState(null);

    // Сколько людей в каждый день (день занят, если checkIn <= день < checkOut — ночь 12→12)
    const dayMap = useMemo(() => {
        const map = {};
        withDates.forEach(e => {
            let d = new Date(e.checkIn + 'T12:00:00');
            const end = new Date(e.checkOut + 'T12:00:00');
            let guard = 0;
            while (d < end && guard < 400) {
                const iso = pmcFmtISO(d);
                if (!map[iso]) map[iso] = { people: 0, periods: [] };
                map[iso].people += (parseInt(e.people) || 0);
                map[iso].periods.push(e);
                d = new Date(d.getTime() + 86400000);
                guard++;
            }
        });
        return map;
    }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps

    const cells = useMemo(() => {
        const first = new Date(ym.y, ym.m, 1);
        const startDow = (first.getDay() + 6) % 7; // Пн=0
        const start = new Date(ym.y, ym.m, 1 - startDow);
        return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }, [ym]);

    const todayIso = pmcFmtISO(new Date());
    const maxPeople = Math.max(1, ...Object.values(dayMap).map(v => v.people));
    const prevMonth = () => setYm(s => { const d = new Date(s.y, s.m - 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
    const nextMonth = () => setYm(s => { const d = new Date(s.y, s.m + 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

    const popupInfo = dayPopup ? (dayMap[dayPopup] || { people: 0, periods: [] }) : null;

    return (
        <div className="px-3 pb-2">
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(94,234,212,0.15)', background: 'rgba(94,234,212,0.03)' }}>
                <div className="flex items-center justify-between px-2 py-1.5" style={{ borderBottom: '1px solid rgba(94,234,212,0.12)' }}>
                    <button onClick={prevMonth} className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ color: '#5eead4' }}><ChevronRight size={13} style={{ transform: 'rotate(180deg)' }} /></button>
                    <span className="text-[11px] font-bold" style={{ color: '#e2f7f8' }}>{PMC_MONTHS_FULL[ym.m]} {ym.y}</span>
                    <button onClick={nextMonth} className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ color: '#5eead4' }}><ChevronRight size={13} /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 px-1 pt-1">
                    {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((w, i) => (
                        <div key={w} className="text-center text-[9px] font-bold py-0.5" style={{ color: i >= 5 ? 'rgba(248,113,113,0.6)' : 'rgba(94,234,212,0.4)' }}>{w}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1 p-1">
                    {cells.map((d, i) => {
                        const iso = pmcFmtISO(d);
                        const inMonth = d.getMonth() === ym.m;
                        const info = dayMap[iso];
                        const isToday = iso === todayIso;
                        const intensity = info ? 0.18 + 0.55 * (info.people / maxPeople) : 0;
                        return (
                            <button key={i} onClick={() => setDayPopup(iso)}
                                className="relative flex flex-col items-center justify-center rounded-lg transition-colors hover:brightness-110"
                                style={{ height: 40, opacity: inMonth ? 1 : 0.3,
                                    background: info ? `rgba(15,150,136,${intensity})` : 'rgba(94,234,212,0.04)',
                                    border: `1px solid ${info ? 'rgba(94,234,212,0.4)' : 'rgba(94,234,212,0.08)'}`,
                                    boxShadow: isToday ? 'inset 0 0 0 2px #5eead4' : 'none' }}>
                                <span className="text-[11px] font-bold leading-none" style={{ color: inMonth ? '#e2f7f8' : 'rgba(94,234,212,0.4)' }}>{d.getDate()}</span>
                                {info && info.people > 0 && <span className="text-[9px] font-black leading-none mt-0.5" style={{ color: '#5eead4' }}>{info.people}</span>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {dayPopup && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center p-4" style={{ background: 'rgba(8,20,22,0.6)' }} onClick={() => setDayPopup(null)}>
                    <div className="w-full max-w-xs rounded-2xl overflow-hidden" style={{ background: '#0d2532', border: '1px solid rgba(94,234,212,0.25)' }} onClick={e => e.stopPropagation()}>
                        <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#0f9688,#0d7a6e)' }}>
                            <div className="text-white font-black text-sm">{pmcSd(dayPopup)} · {popupInfo.people} чел</div>
                            <button onClick={() => setDayPopup(null)} className="w-6 h-6 rounded-full flex items-center justify-center bg-white/20 text-white"><X size={12} /></button>
                        </div>
                        <div className="p-3 space-y-1.5 max-h-[55vh] overflow-y-auto">
                            {popupInfo.periods.length === 0 && <div className="text-[11px] text-center py-2" style={{ color: 'rgba(94,234,212,0.4)' }}>Нет периодов в этот день</div>}
                            {popupInfo.periods.map(p => {
                                const wgCount = (p.workerGroups || []).filter(wg => wg.specialty).length;
                                return (
                                    <div key={p.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(94,234,212,0.06)', border: '1px solid rgba(94,234,212,0.12)' }}>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[11px] font-semibold" style={{ color: '#e2f7f8' }}>{pmcSd(p.checkIn)} → {pmcSd(p.checkOut)}</div>
                                            <div className="text-[9px]" style={{ color: 'rgba(94,234,212,0.5)' }}>{p.people > 0 ? `${p.people} чел` : ''}{p.nights > 0 ? ` · ${p.nights}н` : ''}{wgCount > 0 ? ` · бриг.${wgCount}` : ''}</div>
                                        </div>
                                        <button onClick={() => { onEditPeriod?.(p.id); setDayPopup(null); }} className="px-2 py-1 rounded-lg text-[10px] font-bold" style={{ color: '#5eead4', background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.25)' }}>Изменить</button>
                                        <button onClick={() => onDeletePeriod?.(p.id)} className="p-1 rounded-lg" style={{ color: 'rgba(94,234,212,0.4)' }}><X size={12} /></button>
                                    </div>
                                );
                            })}
                            <button onClick={() => { const co = pmcFmtISO(new Date(new Date(dayPopup + 'T12:00:00').getTime() + 86400000)); onAddPeriod?.(dayPopup, co); setDayPopup(null); }}
                                className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-dashed text-[10px] font-semibold" style={{ borderColor: 'rgba(94,234,212,0.3)', color: '#0f9688' }}>
                                <Plus size={9} /> Новый период с {pmcSd(dayPopup)}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Попап редактирования периода ─────────────────────────────────────────
const PeriodEditModal = ({ group, entry, rooms, savedSpecialties, onUpdate, onRemove, onAddWG, onUpdateWG, onRemoveWG, onClose }) => {
    const [checkIn, setCheckIn] = useState(entry.checkIn || '');
    const [checkOut, setCheckOut] = useState(entry.checkOut || '');
    const [people, setPeople] = useState(entry.people || '');
    const nights = (checkIn && checkOut) ? Math.max(0, Math.round((new Date(checkOut + 'T12:00:00') - new Date(checkIn + 'T12:00:00')) / 86400000)) : 0;
    // Если бригада заполнена — кол-во людей берётся из неё (read-only)
    const brigTotal = (entry.workerGroups || []).reduce((s, wg) => s + (wg.specialty ? (parseInt(wg.count) || 0) : 0), 0);
    const inp = { border: '1px solid rgba(94,234,212,0.25)', background: 'rgba(94,234,212,0.07)', color: '#e2f7f8' };
    const lbl = { color: 'rgba(94,234,212,0.5)' };
    return (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4" style={{ background: 'rgba(8,20,22,0.72)' }} onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#0d2532', border: '1px solid rgba(94,234,212,0.25)' }} onClick={e => e.stopPropagation()}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#0f9688,#0d7a6e)' }}>
                    <div className="text-white font-black text-sm truncate">Период · {group.name}</div>
                    <button onClick={onClose} className="w-6 h-6 rounded-full flex items-center justify-center bg-white/20 text-white shrink-0"><X size={12} /></button>
                </div>
                <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[9px] font-bold uppercase tracking-wide block mb-1" style={lbl}>Заезд</label>
                            <input type="date" value={checkIn} onChange={e => { setCheckIn(e.target.value); onUpdate({ checkIn: e.target.value }); }}
                                className="w-full px-2 py-1.5 text-[11px] rounded-lg focus:outline-none" style={inp} />
                        </div>
                        <div>
                            <label className="text-[9px] font-bold uppercase tracking-wide block mb-1" style={lbl}>Выезд</label>
                            <input type="date" value={checkOut} onChange={e => { setCheckOut(e.target.value); onUpdate({ checkOut: e.target.value }); }}
                                className="w-full px-2 py-1.5 text-[11px] rounded-lg focus:outline-none" style={inp} />
                        </div>
                    </div>
                    {nights > 0 && <div className="text-[10px]" style={lbl}>{nights} ноч.</div>}
                    <div className="flex items-end gap-2">
                        <div className="flex-1 min-w-0">
                            <label className="text-[9px] font-bold uppercase tracking-wide block mb-1" style={lbl}>Комнаты</label>
                            <RoomPicker rooms={rooms} selected={Array.isArray(entry.roomIds) ? entry.roomIds : []} onChange={roomIds => onUpdate({ roomIds })} />
                        </div>
                        <div className="w-16">
                            <label className="text-[9px] font-bold uppercase tracking-wide block mb-1" style={lbl}>Человек{brigTotal > 0 ? ' (бриг.)' : ''}</label>
                            {brigTotal > 0 ? (
                                <input type="text" readOnly value={brigTotal} title="Из бригады"
                                    className="w-full px-1.5 py-1.5 text-[11px] rounded-lg text-center font-bold"
                                    style={{ ...inp, color: '#5eead4', opacity: 0.9 }} />
                            ) : (
                                <input type="number" min="0" value={people}
                                    onChange={e => setPeople(e.target.value.replace(/[^0-9]/g, ''))}
                                    onBlur={() => { if (String(people) !== String(entry.people || '')) onUpdate({ people }); }}
                                    className="w-full px-1.5 py-1.5 text-[11px] rounded-lg focus:outline-none text-center" style={inp} />
                            )}
                        </div>
                    </div>
                    <div className="pt-2" style={{ borderTop: '1px solid rgba(94,234,212,0.1)' }}>
                        <div className="text-[9px] font-bold uppercase tracking-wide mb-1.5" style={lbl}>Бригада / специальности</div>
                        <div className="space-y-1">
                            {(entry.workerGroups || []).map((wg, wgIdx) => (
                                <WorkerGroupRow key={wg.id || wgIdx} wg={wg} wgIdx={wgIdx} options={savedSpecialties}
                                    onUpdate={patch => onUpdateWG(wg.id, patch)} onRemove={() => onRemoveWG(wg.id)} />
                            ))}
                            <button onClick={onAddWG}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-dashed text-[9px] font-semibold"
                                style={{ borderColor: 'rgba(94,234,212,0.2)', color: 'rgba(94,234,212,0.6)' }}>
                                <Plus size={7} /> Добавить специальность
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        <button onClick={() => { onRemove(); onClose(); }} className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: '#f87171' }}>
                            <Trash2 size={11} /> Удалить период
                        </button>
                        <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: '#0f9688' }}>Готово</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Общий отчёт (по месяцам / по выбранным договорам) ────────────────────
const orPayAmt = (p) => ((parseInt(p.cash) || 0) + (parseInt(p.transfer) || 0) + (parseInt(p.card) || 0) + (parseInt(p.qr) || 0)) || (parseInt(p.amount) || 0);
const orMethod = (p) => { const parts = []; if (p.cash) parts.push('нал'); if (p.transfer) parts.push('переч'); if (p.card) parts.push('карта'); if (p.qr) parts.push('QR'); return parts.join('+') || '—'; };

const OR_COLS = [
    { key: 'members',      label: 'Участн.',   num: true,  val: r => r.members },
    { key: 'pn',           label: 'Чел-ночи',  num: true,  val: r => r.pn,           accent: true },
    { key: 'rate',         label: 'Ставка',    num: true,  money: true, val: r => r.rate },
    { key: 'charged',      label: 'Начислено', num: true,  money: true, val: r => r.charged },
    { key: 'paid',         label: 'Оплачено',  num: true,  money: true, green: true, val: r => r.paid },
    { key: 'paidCash',     label: 'Наличные',  num: true,  money: true, val: r => r.paidCash },
    { key: 'paidTransfer', label: 'Перечисл.', num: true,  money: true, val: r => r.paidTransfer },
    { key: 'paidCard',     label: 'Карта',     num: true,  money: true, val: r => r.paidCard },
    { key: 'paidQR',       label: 'QR',        num: true,  money: true, val: r => r.paidQR },
    { key: 'debt',         label: 'Долг',      num: true,  money: true, red: true, val: r => r.debt },
    { key: 'period',       label: 'Период',    num: false, text: true, val: r => r.period },
    { key: 'status',       label: 'Статус',    num: false, text: true, val: r => r.closed ? 'Архив' : r.completed ? 'Завершён' : 'Активен' },
];

const OverallReportModal = ({ groups = [], payments = [], scopeLabel = 'Все договоры', hostelLabel = '', onClose }) => {
    const dk = document.documentElement.dataset.theme === 'dark';
    const [ym, setYm] = useState('');
    const [copied, setCopied] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [cols, setCols] = useState({ members: true, pn: true, rate: false, charged: true, paid: true, paidCash: false, paidTransfer: false, paidCard: false, paidQR: false, debt: true, period: true, status: false });
    const [sec, setSec] = useState({ payments: true, periods: false, members: false, specs: false });
    const groupIds = useMemo(() => new Set(groups.map(g => g.id)), [groups]);
    const mkey = (iso) => (iso || '').slice(0, 7);
    const fm = (n) => (Number(n) || 0).toLocaleString('ru-RU');

    const months = useMemo(() => {
        const s = new Set();
        groups.forEach(g => (g.manualEntries || []).forEach(e => { if (e.checkIn) s.add(mkey(e.checkIn)); }));
        payments.forEach(p => { if (groupIds.has(p.contractGroupId) && p.date) s.add(mkey(p.date)); });
        return [...s].filter(Boolean).sort().reverse();
    }, [groups, payments, groupIds]);

    // Дни/чел-ночи/специальности периода в рамках выбранного месяца (или всего)
    const scopeStats = (g, m) => {
        let pn = 0; const specs = {};
        (g.manualEntries || []).forEach(e => {
            if (!e.checkIn || !e.checkOut) return;
            const ppl = parseInt(e.people) || 0;
            let days = 0;
            let d = new Date(e.checkIn + 'T12:00:00'); const end = new Date(e.checkOut + 'T12:00:00'); let guard = 0;
            while (d < end && guard < 500) { if (!m || pmcFmtISO(d).slice(0, 7) === m) days++; d = new Date(d.getTime() + 86400000); guard++; }
            pn += ppl * days;
            (e.workerGroups || []).forEach(wg => { if (!wg.specialty) return; specs[wg.specialty] = (specs[wg.specialty] || 0) + (parseInt(wg.count) || 0) * days; });
        });
        return { pn, specs };
    };

    const rows = useMemo(() => groups.map((g, i) => {
        const isos = (g.manualEntries || []).flatMap(e => [e.checkIn, e.checkOut]).filter(Boolean).sort();
        const periodStr = isos.length ? `${isos[0]} → ${isos[isos.length - 1]}` : '—';
        const grpPays = payments.filter(p => p.contractGroupId === g.id && (!ym || mkey(p.date) === ym));
        const paidCash = grpPays.reduce((s, p) => s + (parseInt(p.cash) || 0), 0);
        const paidTransfer = grpPays.reduce((s, p) => s + (parseInt(p.transfer) || 0), 0);
        const paidCard = grpPays.reduce((s, p) => s + (parseInt(p.card) || 0), 0);
        const paidQR = grpPays.reduce((s, p) => s + (parseInt(p.qr) || 0), 0);
        const recPaid = grpPays.reduce((s, p) => s + orPayAmt(p), 0);
        const rate = parseInt(g.contractRate) || 0;
        const ss = scopeStats(g, ym);
        if (ym) {
            const charged = rate * ss.pn;
            return { id: g.id, name: g.name, members: g.members.length, memberNames: g.members.map(m => m.name), pn: ss.pn, rate, charged, paid: recPaid, paidCash, paidTransfer, paidCard, paidQR, debt: charged > 0 ? charged - recPaid : 0, period: ym, closed: !!g.closed, completed: !!g.completed, specs: ss.specs };
        }
        return { id: g.id, name: g.name, members: g.members.length, memberNames: g.members.map(m => m.name), pn: g.totalPersonNights, rate, charged: g.contractTotal, paid: g.amountPaid, paidCash, paidTransfer, paidCard, paidQR, debt: Math.max(0, g.debt), period: periodStr, closed: !!g.closed, completed: !!g.completed, specs: ss.specs };
    }), [groups, ym, payments]); // eslint-disable-line react-hooks/exhaustive-deps

    const activeCols = OR_COLS.filter(c => cols[c.key]);
    const totals = {};
    OR_COLS.forEach(c => { if (c.num) totals[c.key] = rows.reduce((s, r) => s + (c.key === 'debt' ? Math.max(0, r.debt) : (Number(c.val(r)) || 0)), 0); });

    const scopedPayments = useMemo(() => payments
        .filter(p => groupIds.has(p.contractGroupId) && (!ym || mkey(p.date) === ym))
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')), [payments, groupIds, ym]);

    // Специальности по всем (в рамках области)
    const specsTotal = useMemo(() => {
        const m = {};
        rows.forEach(r => Object.entries(r.specs).forEach(([sp, v]) => { m[sp] = (m[sp] || 0) + v; }));
        return Object.entries(m).sort((a, b) => b[1] - a[1]);
    }, [rows]);

    const gname = (id) => groups.find(g => g.id === id)?.name || '—';
    const titleScope = ym ? `${PMC_MONTHS_FULL[parseInt(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : scopeLabel;

    // Оплаты по ДНЮ: общая сумма за день + разбивка, КОМУ (по договорам) и каким методом
    const paymentsByDay = useMemo(() => {
        const dayMap = new Map();
        scopedPayments.forEach(p => {
            const day = (p.date || '').slice(0, 10);
            if (!dayMap.has(day)) dayMap.set(day, { day, total: 0, cash: 0, transfer: 0, card: 0, qr: 0, byContract: new Map() });
            const d = dayMap.get(day);
            let cash = parseInt(p.cash) || 0, transfer = parseInt(p.transfer) || 0, card = parseInt(p.card) || 0, qr = parseInt(p.qr) || 0;
            let sum = cash + transfer + card + qr;
            if (sum === 0) { const amt = parseInt(p.amount) || 0; const m = p.method; if (m === 'transfer') transfer = amt; else if (m === 'card') card = amt; else if (m === 'qr') qr = amt; else cash = amt; sum = amt; }
            d.total += sum; d.cash += cash; d.transfer += transfer; d.card += card; d.qr += qr;
            if (!d.byContract.has(p.contractGroupId)) d.byContract.set(p.contractGroupId, { id: p.contractGroupId, cash: 0, transfer: 0, card: 0, qr: 0, total: 0 });
            const bc = d.byContract.get(p.contractGroupId);
            bc.cash += cash; bc.transfer += transfer; bc.card += card; bc.qr += qr; bc.total += sum;
        });
        return [...dayMap.values()]
            .map(d => ({ ...d, contracts: [...d.byContract.values()].sort((a, b) => b.total - a.total) }))
            .sort((a, b) => (b.day || '').localeCompare(a.day || ''));
    }, [scopedPayments]);
    const methodParts = (o) => [['нал', o.cash], ['переч', o.transfer], ['карта', o.card], ['QR', o.qr]].filter(([, v]) => v > 0).map(([l, v]) => `${l} ${fm(v)}`).join(' · ') || '—';

    // Детальные периоды проживания всех договоров (с учётом выбранного месяца)
    const periodRows = useMemo(() => {
        const out = [];
        groups.forEach(g => (g.manualEntries || []).forEach(e => {
            if (ym) {
                const a = e.checkIn ? mkey(e.checkIn) : '', b = e.checkOut ? mkey(e.checkOut) : '';
                if (!(a === ym || b === ym || (a && b && a <= ym && ym <= b))) return;
            }
            let nights = 0;
            if (e.checkIn && e.checkOut) nights = Math.round((new Date(e.checkOut + 'T00:00:00') - new Date(e.checkIn + 'T00:00:00')) / 86400000);
            if (!nights) nights = parseInt(e.nights, 10) || 0;
            const people = parseInt(e.people, 10) || 0;
            const specs = (e.workerGroups || []).filter(wg => wg.specialty && (parseInt(wg.count) || 0) > 0).map(wg => `${wg.specialty} ${wg.count}`).join(', ');
            out.push({ contract: g.name, checkIn: e.checkIn || '', checkOut: e.checkOut || '', nights, people, personNights: nights * people, specs });
        }));
        // Сортируем по договору (каждый отдельно), внутри — по дате заезда
        return out.sort((a, b) => a.contract.localeCompare(b.contract, 'ru') || (a.checkIn || '').localeCompare(b.checkIn || ''));
    }, [groups, ym]); // eslint-disable-line react-hooks/exhaustive-deps

    // Участники с проживанием (сколько ночей прожили)
    const memberRows = useMemo(() => {
        const out = [];
        groups.forEach(g => (g.members || []).forEach(m => out.push({ contract: g.name, member: m.name, nights: m.totalNights || 0 })));
        return out.sort((a, b) => a.contract.localeCompare(b.contract, 'ru') || a.member.localeCompare(b.member, 'ru'));
    }, [groups]);

    const copyText = () => {
        const L = [`Отчёт — ${titleScope}`, ''];
        L.push(['Договор', ...activeCols.map(c => c.label)].join('\t'));
        rows.forEach(r => L.push([r.name, ...activeCols.map(c => c.key === 'debt' ? Math.max(0, r.debt) : c.val(r))].join('\t')));
        L.push(['ИТОГО', ...activeCols.map(c => c.num ? totals[c.key] : '')].join('\t'));
        if (sec.periods && periodRows.length) {
            L.push('', 'Периоды проживания:');
            periodRows.forEach(p => L.push(`  ${p.contract}: ${p.checkIn || '?'} → ${p.checkOut || '?'} · ${p.nights} н · ${p.people} чел · ${p.personNights} чел-ноч`));
        }
        if (sec.members) {
            L.push('', 'Участники (сколько прожили):');
            groups.forEach(g => { if ((g.members || []).length) L.push(`  ${g.name}: ${g.members.map(m => `${m.name} (${m.totalNights || 0}н)`).join(', ')}`); });
        }
        if (sec.specs && specsTotal.length) {
            L.push('', 'Специальности (чел-дней):');
            specsTotal.forEach(([sp, v]) => L.push(`  ${sp}: ${v}`));
        }
        if (sec.payments && paymentsByDay.length) {
            L.push('', 'Оплаты по дням:');
            paymentsByDay.forEach(d => {
                L.push(`  ${d.day} — итого ${fm(d.total)} (${methodParts(d)})`);
                d.contracts.forEach(c => L.push(`     ↳ ${gname(c.id)}: ${fm(c.total)} (${methodParts(c)})`));
            });
        }
        navigator.clipboard.writeText(L.join('\n')).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
    };

    const exportXlsx = async () => {
        if (exporting) return;
        setExporting(true);
        try {
        const ExcelJS = (await import('exceljs')).default;
        const wb = new ExcelJS.Workbook();
        wb.creator = 'Hostella';
        const MONEY = '#,##0';
        const HEAD = 'FF0F9688';        // бирюзовый заголовок
        const TOTAL_FILL = 'FFE8F5F3';  // светлый итог
        const ZEBRA = 'FFF8FAFC';       // чередование строк
        // акцентные цвета (как в экранной таблице)
        const C_TEAL = 'FF0F9688';      // чел-ночи
        const C_GREEN = 'FF059669';     // оплачено
        const C_RED = 'FFDC2626';       // долг (текст)
        const C_RED_FILL = 'FFFFE4E6';  // долг (заливка)
        const C_GREY = 'FF94A3B8';      // ноль / архив
        const C_SLATE = 'FF334155';     // обычный текст
        const thin = { style: 'thin', color: { argb: 'FFE2E8F0' } };
        const box = { top: thin, left: thin, bottom: thin, right: thin };
        const titleRow = (ws, span, text) => {
            const r = ws.addRow([text]);
            ws.mergeCells(r.number, 1, r.number, span);
            const c = r.getCell(1);
            c.font = { bold: true, size: 13, color: { argb: HEAD } };
            c.alignment = { vertical: 'middle', horizontal: 'left' };
            r.height = 26;
            return r;
        };

        const addHeader = (ws, labels) => {
            const r = ws.addRow(labels);
            r.height = 22;
            r.eachCell(c => {
                c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEAD } };
                c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                c.border = box;
            });
        };
        const fillRow = (row, argb) => row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }; });
        const boxRow = (row) => row.eachCell(c => { c.border = box; });
        const moneyFmt = (ws, idxs) => idxs.forEach(i => { ws.getColumn(i).numFmt = MONEY; ws.getColumn(i).alignment = { horizontal: 'right' }; });
        const widths = (ws, ws_widths) => ws_widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

        // ── 1) Сводка ──
        {
            const ncol = activeCols.length + 1;
            const ws = wb.addWorksheet('Сводка', { views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] });
            titleRow(ws, ncol, `Отчёт по договорам — ${titleScope}${hostelLabel ? ' · ' + hostelLabel : ''}`);
            addHeader(ws, ['Договор', ...activeCols.map(c => c.label)]);

            const accentCell = (cell, col, value, { isTotal = false } = {}) => {
                if (col.money) cell.numFmt = MONEY;
                if (col.num) cell.alignment = { horizontal: 'right' };
                const v = Number(value) || 0;
                if (col.key === 'debt') {
                    if (v > 0) {
                        cell.font = { bold: true, size: isTotal ? 12 : 11, color: { argb: C_RED } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_RED_FILL } };
                    } else {
                        cell.font = { color: { argb: C_GREY }, bold: isTotal };
                    }
                } else if (col.key === 'paid') {
                    cell.font = { bold: true, color: { argb: v > 0 ? C_GREEN : C_GREY } };
                } else if (col.key === 'pn') {
                    cell.font = { bold: true, color: { argb: C_TEAL } };
                } else if (col.key === 'status') {
                    cell.alignment = { horizontal: 'center' };
                    cell.font = { bold: true, color: { argb: value === 'Архив' ? C_GREY : value === 'Завершён' ? C_SLATE : C_TEAL } };
                } else if (isTotal) {
                    cell.font = { bold: true };
                }
            };

            rows.forEach((r, idx) => {
                const vals = activeCols.map(c => c.key === 'debt' ? Math.max(0, r.debt) : c.val(r));
                const row = ws.addRow([r.name, ...vals]);
                boxRow(row);
                if (idx % 2) fillRow(row, ZEBRA);
                row.getCell(1).font = { bold: true, color: { argb: C_SLATE } };
                row.getCell(1).alignment = { horizontal: 'left', wrapText: true };
                activeCols.forEach((c, i) => accentCell(row.getCell(i + 2), c, vals[i]));
            });

            const tr = ws.addRow(['ИТОГО', ...activeCols.map(c => c.num ? totals[c.key] : '')]);
            tr.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } }; c.border = { ...box, top: { style: 'medium', color: { argb: HEAD } } }; });
            tr.getCell(1).font = { bold: true, size: 12, color: { argb: C_SLATE } };
            activeCols.forEach((c, i) => { if (c.num) accentCell(tr.getCell(i + 2), c, totals[c.key], { isTotal: true }); });

            widths(ws, [30, ...activeCols.map(c => c.text ? 24 : 14)]);
        }

        // ── 2) Периоды (по договорам, с подытогами) ──
        if (sec.periods && periodRows.length) {
            const ws = wb.addWorksheet('Периоды', { views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] });
            titleRow(ws, 7, `Периоды проживания — ${titleScope}`);
            addHeader(ws, ['Договор', 'Заезд', 'Выезд', 'Ночей', 'Чел.', 'Чел-ночей', 'Специальности']);
            const byC = periodRows.reduce((acc, p) => { (acc[p.contract] = acc[p.contract] || []).push(p); return acc; }, {});
            const entries = Object.entries(byC);
            entries.forEach(([contract, list], gi) => {
                list.forEach((p, idx) => {
                    // Имя договора показываем только в первой строке группы — чище и понятнее
                    const row = ws.addRow([idx === 0 ? contract : '', p.checkIn, p.checkOut, p.nights, p.people, p.personNights, p.specs]);
                    boxRow(row);
                    if (idx % 2) fillRow(row, ZEBRA);
                    if (idx === 0) row.getCell(1).font = { bold: true, color: { argb: C_SLATE } };
                    row.getCell(1).alignment = { horizontal: 'left', wrapText: true };
                    [4, 5].forEach(ci => { row.getCell(ci).alignment = { horizontal: 'right' }; });
                    const pnCell = row.getCell(6); pnCell.alignment = { horizontal: 'right' }; pnCell.font = { bold: true, color: { argb: C_TEAL } };
                    row.getCell(7).alignment = { horizontal: 'left', wrapText: true };
                });
                const sub = ws.addRow([`Итого: ${contract}`, '', '', list.reduce((s, p) => s + p.nights, 0), '', list.reduce((s, p) => s + p.personNights, 0), '']);
                sub.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } }; c.border = box; });
                sub.getCell(1).font = { bold: true, color: { argb: C_SLATE } };
                sub.getCell(1).alignment = { horizontal: 'left' };
                sub.getCell(4).font = { bold: true }; sub.getCell(4).alignment = { horizontal: 'right' };
                sub.getCell(6).font = { bold: true, color: { argb: C_TEAL } }; sub.getCell(6).alignment = { horizontal: 'right' };
                // Разделитель между группами
                if (gi < entries.length - 1) ws.addRow([]);
            });
            widths(ws, [30, 13, 13, 9, 8, 13, 36]);
        }

        // ── 3) Участники (сколько прожили) ──
        if (sec.members && memberRows.length) {
            const ws = wb.addWorksheet('Участники', { views: [{ state: 'frozen', xSplit: 1, ySplit: 2 }] });
            titleRow(ws, 3, `Участники — ${titleScope}`);
            addHeader(ws, ['Договор', 'Участник', 'Прожил ночей']);
            memberRows.forEach((m, idx) => {
                const row = ws.addRow([m.contract, m.member, m.nights]);
                boxRow(row);
                if (idx % 2) fillRow(row, ZEBRA);
                row.getCell(3).alignment = { horizontal: 'right' };
            });
            widths(ws, [26, 28, 14]);
            moneyFmt(ws, [3]);
        }

        // ── 4) Специальности ──
        if (sec.specs && specsTotal.length) {
            const ws = wb.addWorksheet('Специальности', { views: [{ state: 'frozen', ySplit: 2 }] });
            titleRow(ws, 2, `Специальности (чел-дней) — ${titleScope}`);
            addHeader(ws, ['Специальность', 'Чел-дней']);
            specsTotal.forEach(([sp, v], idx) => {
                const row = ws.addRow([sp, v]);
                boxRow(row);
                if (idx % 2) fillRow(row, ZEBRA);
                const c = row.getCell(2); c.alignment = { horizontal: 'right' }; c.font = { bold: true, color: { argb: C_TEAL } };
            });
            widths(ws, [30, 14]);
            moneyFmt(ws, [2]);
        }

        // ── 5) Оплаты по дням (итог дня + кому) ──
        if (sec.payments && paymentsByDay.length) {
            const ws = wb.addWorksheet('Оплаты', { views: [{ state: 'frozen', ySplit: 2 }] });
            titleRow(ws, 7, `Оплаты по дням — ${titleScope}`);
            addHeader(ws, ['Дата', 'Договор', 'Наличные', 'Перечисл.', 'Карта', 'QR', 'Итого']);
            paymentsByDay.forEach((d, di) => {
                const dr = ws.addRow([d.day, 'Итого за день', d.cash, d.transfer, d.card, d.qr, d.total]);
                dr.eachCell(c => { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } }; c.border = box; });
                dr.getCell(7).font = { bold: true, color: { argb: C_TEAL } };
                d.contracts.forEach(c0 => {
                    const row = ws.addRow(['', `↳ ${gname(c0.id)}`, c0.cash, c0.transfer, c0.card, c0.qr, c0.total]);
                    boxRow(row);
                    row.getCell(2).font = { color: { argb: C_SLATE } };
                });
                if (di < paymentsByDay.length - 1) ws.addRow([]);
            });
            const tot = ws.addRow(['ВСЕГО', '', paymentsByDay.reduce((s, d) => s + d.cash, 0), paymentsByDay.reduce((s, d) => s + d.transfer, 0), paymentsByDay.reduce((s, d) => s + d.card, 0), paymentsByDay.reduce((s, d) => s + d.qr, 0), paymentsByDay.reduce((s, d) => s + d.total, 0)]);
            tot.eachCell(c => { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } }; c.border = { ...box, top: { style: 'medium', color: { argb: HEAD } } }; });
            tot.getCell(7).font = { bold: true, size: 12, color: { argb: C_GREEN } };
            widths(ws, [14, 28, 14, 14, 14, 12, 16]);
            moneyFmt(ws, [3, 4, 5, 6, 7]);
        }

        // ── Скачивание ──
        if (wb.worksheets.length === 0) wb.addWorksheet('Отчёт'); // на всякий случай: книга не пустая
        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Отчёт_${(hostelLabel || '').replace(/\s/g, '') || 'договоры'}_${ym || 'все'}.xlsx`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        } catch (e) {
            console.error('Excel export failed:', e);
            alert('Не удалось сформировать Excel: ' + (e?.message || 'неизвестная ошибка'));
        } finally {
            setExporting(false);
        }
    };

    const bg = dk ? '#1e293b' : '#fff';
    const txt = dk ? '#e2e8f0' : '#1e293b';
    const sub = dk ? '#94a3b8' : '#64748b';
    const bd = dk ? '#334155' : '#f1f5f9';
    const th = { color: sub, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' };
    const tdBase = { fontSize: 12, padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap', borderTop: `1px solid ${bd}` };
    const Chip = ({ on, onClick, children }) => (
        <button onClick={onClick} className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
            style={on ? { background: 'rgba(15,150,136,0.15)', color: '#0f9688', border: '1px solid rgba(15,150,136,0.4)' }
                      : { background: dk ? '#0f172a' : '#f1f5f9', color: sub, border: `1px solid ${bd}` }}>{children}</button>
    );

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: 'rgba(13,43,48,0.72)' }} onClick={onClose}>
            <div className="rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col" style={{ background: bg }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${bd}` }}>
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#0f9688' }}>Общий отчёт{hostelLabel ? ` · ${hostelLabel}` : ''}</div>
                        <div className="text-lg font-black mt-0.5" style={{ color: txt }}>{titleScope}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <select value={ym} onChange={e => setYm(e.target.value)}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg focus:outline-none"
                            style={{ background: dk ? '#0f172a' : '#f1f5f9', color: txt, border: `1px solid ${bd}` }}>
                            <option value="">Все месяцы (итоги)</option>
                            {months.map(m => <option key={m} value={m}>{PMC_MONTHS_FULL[parseInt(m.slice(5, 7)) - 1]} {m.slice(0, 4)}</option>)}
                        </select>
                        <button onClick={copyText} className="px-3 py-1.5 text-xs font-bold rounded-lg" style={{ background: copied ? '#22c55e' : '#0f9688', color: '#fff' }}>{copied ? '✓ Скопировано' : 'Копировать'}</button>
                        <button onClick={exportXlsx} disabled={exporting} className="px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-60" style={{ background: '#6366f1', color: '#fff' }}>{exporting ? 'Формирую…' : 'Excel'}</button>
                        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: sub }}><X size={16} /></button>
                    </div>
                </div>

                {/* Что показать */}
                <div className="px-5 py-3 shrink-0" style={{ borderBottom: `1px solid ${bd}` }}>
                    <div className="text-[9px] font-bold uppercase tracking-wide mb-1.5" style={{ color: sub }}>Колонки</div>
                    <div className="flex flex-wrap gap-1.5">
                        {OR_COLS.map(c => <Chip key={c.key} on={cols[c.key]} onClick={() => setCols(s => ({ ...s, [c.key]: !s[c.key] }))}>{c.label}</Chip>)}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-wide mt-2.5 mb-1.5" style={{ color: sub }}>Разделы</div>
                    <div className="flex flex-wrap gap-1.5">
                        <Chip on={sec.payments} onClick={() => setSec(s => ({ ...s, payments: !s.payments }))}>Оплаты по дням</Chip>
                        <Chip on={sec.periods} onClick={() => setSec(s => ({ ...s, periods: !s.periods }))}>Периоды подробно</Chip>
                        <Chip on={sec.members} onClick={() => setSec(s => ({ ...s, members: !s.members }))}>Участники (ночи)</Chip>
                        <Chip on={sec.specs} onClick={() => setSec(s => ({ ...s, specs: !s.specs }))}>Специальности</Chip>
                    </div>
                </div>

                <div className="overflow-auto px-5 py-4">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ ...th, textAlign: 'left' }}>Договор</th>
                                {activeCols.map(c => <th key={c.key} style={{ ...th, textAlign: c.text ? 'left' : 'right' }}>{c.label}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(r => (
                                <tr key={r.id}>
                                    <td style={{ ...tdBase, color: txt, textAlign: 'left', fontWeight: 700 }}>{r.name}{r.closed ? ' 🔒' : ''}</td>
                                    {activeCols.map(c => {
                                        const raw = c.key === 'debt' ? Math.max(0, r.debt) : c.val(r);
                                        const color = c.accent ? '#0f9688' : c.green ? '#16a34a' : (c.red && r.debt > 0) ? '#ef4444' : c.text ? sub : txt;
                                        return <td key={c.key} style={{ ...tdBase, color, textAlign: c.text ? 'left' : 'right', fontWeight: (c.accent || c.green) ? 700 : 400, fontSize: c.text ? 11 : 12 }}>
                                            {c.money ? (raw ? fm(raw) : (c.key === 'debt' ? '—' : fm(0))) : raw}
                                        </td>;
                                    })}
                                </tr>
                            ))}
                            {rows.length === 0 && (
                                <tr><td colSpan={activeCols.length + 1} style={{ ...tdBase, color: sub, textAlign: 'center' }}>Нет данных</td></tr>
                            )}
                        </tbody>
                        {rows.length > 0 && (
                            <tfoot>
                                <tr>
                                    <td style={{ ...tdBase, color: txt, textAlign: 'left', fontWeight: 900, borderTop: `2px solid ${bd}` }}>ИТОГО</td>
                                    {activeCols.map(c => (
                                        <td key={c.key} style={{ ...tdBase, color: c.accent ? '#0f9688' : c.green ? '#16a34a' : c.red ? '#ef4444' : txt, textAlign: c.text ? 'left' : 'right', fontWeight: 900, borderTop: `2px solid ${bd}` }}>
                                            {c.num ? (c.money ? fm(totals[c.key]) : totals[c.key]) : ''}
                                        </td>
                                    ))}
                                </tr>
                            </tfoot>
                        )}
                    </table>

                    {sec.periods && periodRows.length > 0 && (
                        <div className="mt-5">
                            <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: sub }}>Периоды проживания · по договорам</div>
                            <div className="space-y-3">
                                {Object.entries(periodRows.reduce((acc, p) => { (acc[p.contract] = acc[p.contract] || []).push(p); return acc; }, {})).map(([contract, list]) => (
                                    <div key={contract} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${bd}` }}>
                                        <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ background: dk ? '#0f172a' : '#f1f5f9' }}>
                                            <span style={{ color: txt, fontSize: 12, fontWeight: 800 }}>{contract}</span>
                                            <span style={{ color: sub, fontSize: 10 }}>{list.reduce((s, p) => s + p.nights, 0)} ноч · {list.reduce((s, p) => s + p.personNights, 0)} чел-ноч</span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr>
                                                        <th style={{ ...th, textAlign: 'left' }}>Заезд</th>
                                                        <th style={{ ...th, textAlign: 'left' }}>Выезд</th>
                                                        <th style={th}>Ночей</th>
                                                        <th style={th}>Чел.</th>
                                                        <th style={th}>Чел-ноч.</th>
                                                        <th style={{ ...th, textAlign: 'left' }}>Специальности</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {list.map((p, i) => (
                                                        <tr key={i}>
                                                            <td style={{ ...tdBase, textAlign: 'left', color: sub }}>{p.checkIn || '—'}</td>
                                                            <td style={{ ...tdBase, textAlign: 'left', color: sub }}>{p.checkOut || '—'}</td>
                                                            <td style={{ ...tdBase, color: txt }}>{p.nights}</td>
                                                            <td style={{ ...tdBase, color: txt }}>{p.people}</td>
                                                            <td style={{ ...tdBase, color: '#0f9688', fontWeight: 700 }}>{p.personNights}</td>
                                                            <td style={{ ...tdBase, textAlign: 'left', color: sub, whiteSpace: 'normal' }}>{p.specs || '—'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {sec.members && memberRows.length > 0 && (
                        <div className="mt-5">
                            <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: sub }}>Участники — сколько прожили</div>
                            <div className="space-y-1.5">
                                {groups.filter(g => (g.members || []).length).map(g => (
                                    <div key={g.id} className="px-3 py-1.5 rounded-lg" style={{ background: dk ? '#0f172a' : '#f8fafc' }}>
                                        <span style={{ color: txt, fontSize: 12, fontWeight: 700 }}>{g.name}:</span>{' '}
                                        <span style={{ color: sub, fontSize: 11 }}>{g.members.map(m => `${m.name} (${m.totalNights || 0}н)`).join(', ')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {sec.specs && specsTotal.length > 0 && (
                        <div className="mt-5">
                            <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: sub }}>Специальности (чел-дней)</div>
                            <div className="flex flex-wrap gap-2">
                                {specsTotal.map(([sp, v]) => (
                                    <div key={sp} className="px-3 py-1.5 rounded-lg flex items-center gap-2" style={{ background: dk ? '#0f172a' : '#f8fafc' }}>
                                        <span style={{ color: txt, fontSize: 12, fontWeight: 600 }}>{sp}</span>
                                        <span style={{ color: '#0f9688', fontSize: 12, fontWeight: 800 }}>{fm(v)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {sec.payments && paymentsByDay.length > 0 && (
                        <div className="mt-5">
                            <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: sub }}>Оплаты по дням ({paymentsByDay.length})</div>
                            <div className="space-y-2">
                                {paymentsByDay.map((d) => (
                                    <div key={d.day} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${bd}` }}>
                                        {/* Итог за день */}
                                        <div className="flex items-center justify-between gap-3 px-3 py-2" style={{ background: dk ? '#0f172a' : '#f1f5f9' }}>
                                            <span style={{ color: txt, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{d.day}</span>
                                            <span style={{ color: sub, fontSize: 10, flex: 1, textAlign: 'right', minWidth: 0 }} className="truncate">{methodParts(d)}</span>
                                            <span style={{ color: '#16a34a', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' }}>{fm(d.total)}</span>
                                        </div>
                                        {/* Кому из этой суммы */}
                                        {d.contracts.map(c => (
                                            <div key={c.id} className="flex items-center justify-between gap-3 px-3 py-1.5" style={{ borderTop: `1px solid ${bd}` }}>
                                                <span style={{ color: txt, fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0 }} className="truncate">↳ {gname(c.id)}</span>
                                                <span style={{ color: sub, fontSize: 10, whiteSpace: 'nowrap' }}>{methodParts(c)}</span>
                                                <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{fm(c.total)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Отчёт по составу бригады ─────────────────────────────────────────────
const BrigadeReportModal = ({ group, onClose }) => {
    const dk = document.documentElement.dataset.theme === 'dark';
    const fmtDate = (d) => {
        if (!d) return '—';
        const [, m, day] = d.split('-');
        const months = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
        return `${parseInt(day)} ${months[parseInt(m) - 1]}`;
    };
    const weekDay = (d) => ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][new Date(d + 'T00:00:00').getDay()];

    const { members, entries, specialtySummary, totalPersonDays, totalNights, wgDays, memberPersonNights, totalPersonNights } = React.useMemo(() => {
        const members = group.members || [];
        const entries = (group.manualEntries || []).map(entry => {
            let nights = 0;
            if (entry.checkIn && entry.checkOut) {
                nights = Math.round((new Date(entry.checkOut + 'T00:00:00') - new Date(entry.checkIn + 'T00:00:00')) / 86400000);
            }
            if (!nights) nights = parseInt(entry.nights, 10) || 0;
            const people = parseInt(entry.people, 10) || 0;
            const wgs = (entry.workerGroups || []).filter(wg => wg.specialty && (parseInt(wg.count) || 0) > 0);
            return { ...entry, nights, people, wgs };
        }).sort((a, b) => (a.checkIn || '').localeCompare(b.checkIn || ''));

        const summary = new Map();
        const dayMap = new Map();
        entries.forEach(entry => {
            if (!entry.checkIn || !entry.checkOut || entry.wgs.length === 0) return;
            const start = new Date(entry.checkIn + 'T00:00:00');
            const end   = new Date(entry.checkOut + 'T00:00:00');
            let cur = new Date(start);
            while (cur < end) {
                const ds = cur.toISOString().slice(0, 10);
                if (!dayMap.has(ds)) dayMap.set(ds, []);
                entry.wgs.forEach(wg => {
                    dayMap.get(ds).push(wg);
                    if (!summary.has(wg.specialty)) summary.set(wg.specialty, { total: 0, daysSet: new Set() });
                    const s = summary.get(wg.specialty);
                    s.total += parseInt(wg.count) || 0;
                    s.daysSet.add(ds);
                });
                cur = new Date(cur.getTime() + 86400000);
            }
        });
        const wgDays = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, wgs]) => ({ date, wgs }));
        const totalPersonDays = [...summary.values()].reduce((s, v) => s + v.total, 0);
        const totalNights = entries.reduce((s, e) => s + e.nights, 0);
        // Проживание участников (их собственные ночи как гостей) + чел-ночи договора
        const memberPersonNights = (typeof group.autoPersonNights === 'number')
            ? group.autoPersonNights
            : members.reduce((s, m) => s + (m.totalNights || 0), 0);
        const totalPersonNights = (typeof group.totalPersonNights === 'number')
            ? group.totalPersonNights
            : memberPersonNights + (group.manualPersonNights || 0);
        return { members, entries, specialtySummary: summary, totalPersonDays, totalNights, wgDays, memberPersonNights, totalPersonNights };
    }, [group]);

    const copyReport = () => {
        const lines = [`Бригада: ${group.name}`, ''];
        if (group.contractTotal > 0) {
            if (group.contractRate > 0) lines.push(`Ставка: ${fmt(group.contractRate)} сум/чс`);
            lines.push(`Чел-ночей: ${totalPersonNights} (участники ${memberPersonNights} + периоды ${Math.max(0, totalPersonNights - memberPersonNights)})`);
            lines.push(`Начислено: ${fmt(group.contractTotal)} сум`);
            lines.push(`Оплачено: ${fmt(group.amountPaid || 0)} сум`);
            if ((group.debt || 0) > 0) lines.push(`Долг: ${fmt(group.debt)} сум`);
            lines.push('');
        }
        if (members.length > 0) {
            lines.push(`Участники (${memberPersonNights} чел-ноч.):`);
            members.forEach(m => lines.push(`  - ${m.name}${m.totalNights ? ` (${m.totalNights} н)` : ''}`));
            lines.push('');
        }
        if (entries.length > 0) {
            lines.push('Периоды:');
            entries.forEach(e => {
                const period = e.checkIn && e.checkOut ? `${e.checkIn} — ${e.checkOut}` : `${e.nights} ночей`;
                const details = [e.nights > 0 ? `${e.nights} н` : '', e.people > 0 ? `${e.people} чел` : ''].filter(Boolean).join(', ');
                lines.push(`  ${period}${details ? ': ' + details : ''}`);
                if (e.wgs.length > 0) e.wgs.forEach(wg => lines.push(`    • ${wg.specialty}: ${wg.count} чел`));
            });
            lines.push('');
        }
        if (specialtySummary.size > 0) {
            lines.push(`Всего чел-дней: ${totalPersonDays}`);
            lines.push('По специальностям:');
            [...specialtySummary.entries()].forEach(([sp, { total, daysSet }]) => lines.push(`  ${sp}: ${total} чел-дн (${daysSet.size} дн)`));
            if (wgDays.length > 0) {
                lines.push('', 'По дням:');
                wgDays.forEach(d => {
                    const total = d.wgs.reduce((s, wg) => s + (parseInt(wg.count)||0), 0);
                    lines.push(`  ${d.date} (${weekDay(d.date)}): ${d.wgs.map(wg => `${wg.specialty} ${wg.count}`).join(', ')} = ${total} чел`);
                });
            }
        }
        navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
    };

    const hasData = entries.length > 0 || members.length > 0;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: 'rgba(13,43,48,0.72)' }}>
            <div className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
                style={{ background: dk ? '#1e293b' : '#fff' }}>
                <div className="flex items-center justify-between px-6 py-4 shrink-0"
                    style={{ borderBottom: `1px solid ${dk ? '#334155' : '#f1f5f9'}` }}>
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#0f9688' }}>Отчёт по группе</div>
                        <div className="text-lg font-black mt-0.5" style={{ color: dk ? '#f1f5f9' : '#1e293b' }}>{group.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasData && (
                            <button onClick={copyReport}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-colors"
                                style={{ background: '#0f9688' }}>
                                Копировать
                            </button>
                        )}
                        <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
                            style={{ color: dk ? '#64748b' : '#94a3b8' }}><X size={15}/></button>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-6 space-y-5">
                    {!hasData ? (
                        <div className="py-16 text-center">
                            <div className="mb-3" style={{ color: dk ? '#334155' : '#cbd5e1' }}><Users size={40} className="mx-auto" /></div>
                            <p className="text-sm font-semibold" style={{ color: dk ? '#64748b' : '#94a3b8' }}>Нет данных</p>
                            <p className="text-xs mt-1" style={{ color: dk ? '#475569' : '#94a3b8' }}>Добавьте периоды проживания и участников</p>
                        </div>
                    ) : (
                        <>
                            {/* Метрики */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: 'Участников',      value: members.length },
                                    { label: 'Чел-ноч. участ.', value: memberPersonNights },
                                    { label: 'Периодов',        value: entries.length },
                                    { label: 'Чел-ноч. всего',  value: totalPersonNights },
                                ].map(s => (
                                    <div key={s.label} className="rounded-xl p-4 text-center"
                                        style={{ background: dk ? 'rgba(15,150,136,0.15)' : 'linear-gradient(135deg,#f0fdfa,#ccfbf1)', border: `1px solid ${dk ? 'rgba(15,150,136,0.3)' : '#99f6e4'}` }}>
                                        <div className="text-2xl font-black" style={{ color: dk ? '#5eead4' : '#0f766e' }}>{s.value}</div>
                                        <div className="text-[11px] font-semibold mt-0.5" style={{ color: '#0d9488' }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Финансы */}
                            {group.contractTotal > 0 && (
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: dk ? '#64748b' : '#94a3b8' }}>Финансовый итог</div>
                                    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${dk ? '#334155' : '#e2e8f0'}` }}>
                                        {group.contractRate > 0 && (
                                            <div className="flex justify-between items-center px-4 py-3" style={{ borderBottom: `1px solid ${dk ? '#334155' : '#f8fafc'}` }}>
                                                <span className="text-sm" style={{ color: dk ? '#94a3b8' : '#64748b' }}>Ставка</span>
                                                <span className="text-sm font-bold" style={{ color: dk ? '#e2e8f0' : '#334155' }}>{fmt(group.contractRate)} сум/чс</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center px-4 py-3" style={{ borderBottom: `1px solid ${dk ? '#334155' : '#f8fafc'}` }}>
                                            <span className="text-sm" style={{ color: dk ? '#94a3b8' : '#64748b' }}>Чел-ночей</span>
                                            <span className="text-sm font-bold" style={{ color: dk ? '#e2e8f0' : '#334155' }}>
                                                {totalPersonNights}
                                                <span className="text-[11px] font-normal" style={{ color: dk ? '#64748b' : '#94a3b8' }}> (участники {memberPersonNights} + периоды {Math.max(0, totalPersonNights - memberPersonNights)})</span>
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center px-4 py-3" style={{ borderBottom: `1px solid ${dk ? '#334155' : '#f8fafc'}` }}>
                                            <span className="text-sm" style={{ color: dk ? '#94a3b8' : '#64748b' }}>Начислено</span>
                                            <span className="text-sm font-bold" style={{ color: dk ? '#e2e8f0' : '#334155' }}>{fmt(group.contractTotal)} сум</span>
                                        </div>
                                        <div className="flex justify-between items-center px-4 py-3" style={{ borderBottom: (group.debt || 0) > 0 ? `1px solid ${dk ? '#334155' : '#f8fafc'}` : 'none' }}>
                                            <span className="text-sm" style={{ color: dk ? '#94a3b8' : '#64748b' }}>Оплачено</span>
                                            <span className="text-sm font-black" style={{ color: '#0f9688' }}>{fmt(group.amountPaid || 0)} сум</span>
                                        </div>
                                        {(group.debt || 0) > 0 && (
                                            <div className="flex justify-between items-center px-4 py-3"
                                                style={{ background: dk ? 'rgba(239,68,68,0.1)' : '#fff5f5' }}>
                                                <span className="text-sm font-bold text-rose-500">Долг</span>
                                                <span className="text-sm font-black text-rose-500">{fmt(group.debt)} сум</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Участники */}
                            {members.length > 0 && (
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: dk ? '#64748b' : '#94a3b8' }}>Участники · {members.length} · {memberPersonNights} чел-ноч.</div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {members.map((m, i) => (
                                            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium"
                                                style={{ background: dk ? 'rgba(15,150,136,0.15)' : '#f0fdfa', border: `1px solid ${dk ? 'rgba(15,150,136,0.3)' : '#99f6e4'}`, color: dk ? '#5eead4' : '#0f766e' }}>
                                                {m.name}
                                                {m.totalNights > 0 && <span className="text-[10px] opacity-60">{m.totalNights} н</span>}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Периоды */}
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: dk ? '#64748b' : '#94a3b8' }}>Периоды проживания · {entries.length}</div>
                                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${dk ? '#334155' : '#e2e8f0'}` }}>
                                    {entries.map((entry, i) => (
                                        <div key={i} className="last:border-0 transition-colors" style={{ borderBottom: `1px solid ${dk ? '#1e293b' : '#f8fafc'}` }}>
                                            <div className="flex items-center gap-3 px-4 py-3">
                                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                                                    style={{ background: dk ? 'rgba(15,150,136,0.2)' : '#f0fdfa', color: '#0f9688' }}>{i + 1}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold" style={{ color: dk ? '#e2e8f0' : '#1e293b' }}>
                                                        {entry.checkIn && entry.checkOut
                                                            ? `${fmtDate(entry.checkIn)} — ${fmtDate(entry.checkOut)}`
                                                            : entry.nights > 0 ? `${entry.nights} ночей` : '—'}
                                                    </div>
                                                    {(entry.people > 0 || (Array.isArray(entry.roomIds) && entry.roomIds.length > 0)) && (
                                                        <div className="text-[11px] mt-0.5" style={{ color: dk ? '#64748b' : '#94a3b8' }}>
                                                            {entry.people > 0 && <span>{entry.people} чел</span>}
                                                            {Array.isArray(entry.roomIds) && entry.roomIds.length > 0 && <span className="ml-2">{entry.roomIds.length} ком</span>}
                                                        </div>
                                                    )}
                                                    {entry.wgs.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {entry.wgs.map((wg, wi) => (
                                                                <span key={wi} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium"
                                                                    style={{ background: dk ? 'rgba(15,150,136,0.12)' : 'rgba(15,150,136,0.08)', color: dk ? '#5eead4' : '#0f766e' }}>
                                                                    <span className="font-black">{wg.count}</span> {wg.specialty}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {entry.nights > 0 && (
                                                    <div className="shrink-0 text-right">
                                                        <div className="text-sm font-black" style={{ color: '#0f9688' }}>{entry.nights}</div>
                                                        <div className="text-[10px]" style={{ color: dk ? '#64748b' : '#94a3b8' }}>ночей</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Специальности */}
                            {specialtySummary.size > 0 && (
                                <>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: dk ? '#64748b' : '#94a3b8' }}>Итого по специальностям</div>
                                        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${dk ? '#334155' : '#e2e8f0'}` }}>
                                            <div className="grid grid-cols-[1fr_72px_88px]" style={{ background: dk ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${dk ? '#334155' : '#e2e8f0'}` }}>
                                                <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: dk ? '#64748b' : '#64748b' }}>Специальность</div>
                                                <div className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-right" style={{ color: dk ? '#64748b' : '#64748b' }}>Дней</div>
                                                <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-right" style={{ color: dk ? '#64748b' : '#64748b' }}>Чел-дней</div>
                                            </div>
                                            {[...specialtySummary.entries()].sort((a, b) => b[1].total - a[1].total).map(([sp, { total, daysSet }]) => (
                                                <div key={sp} className="grid grid-cols-[1fr_72px_88px] last:border-0 transition-colors"
                                                    style={{ borderBottom: `1px solid ${dk ? '#1e293b' : '#f8fafc'}` }}>
                                                    <div className="px-4 py-3 text-sm font-semibold" style={{ color: dk ? '#e2e8f0' : '#1e293b' }}>{sp}</div>
                                                    <div className="px-3 py-3 text-sm font-bold text-right" style={{ color: dk ? '#64748b' : '#94a3b8' }}>{daysSet.size}</div>
                                                    <div className="px-4 py-3 text-sm font-black text-right" style={{ color: '#0f9688' }}>{total}</div>
                                                </div>
                                            ))}
                                            <div className="grid grid-cols-[1fr_72px_88px]" style={{ background: '#f0fdfa', borderTop: '1px solid #99f6e4' }}>
                                                <div className="px-4 py-3 text-sm font-black text-slate-700">Итого</div>
                                                <div className="px-3 py-3 text-sm font-black text-slate-400 text-right">{wgDays.length}</div>
                                                <div className="px-4 py-3 text-sm font-black text-right" style={{ color: '#0f766e' }}>{totalPersonDays}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* По дням */}
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">По дням · {wgDays.length} дн</div>
                                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                                            {wgDays.map((day, i) => {
                                                const total = day.wgs.reduce((s, wg) => s + (parseInt(wg.count) || 0), 0);
                                                const wd = weekDay(day.date);
                                                const isWeekend = wd === 'Сб' || wd === 'Вс';
                                                return (
                                                    <div key={day.date + i} className={`flex items-center gap-4 px-4 py-2.5 border-b border-slate-50 last:border-0 ${isWeekend ? 'bg-amber-50/50' : 'hover:bg-slate-50/70'} transition-colors`}>
                                                        <div className="w-20 shrink-0">
                                                            <div className="text-sm font-bold text-slate-700">{fmtDate(day.date)}</div>
                                                            <div className={`text-[10px] font-semibold ${isWeekend ? 'text-amber-500' : 'text-slate-400'}`}>{wd}</div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                                                            {day.wgs.map((wg, wi) => (
                                                                <span key={wi} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                                                                    style={{ background: 'rgba(15,150,136,0.08)', color: '#0f766e' }}>
                                                                    <span className="font-black">{wg.count}</span> {wg.specialty}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <div className="shrink-0 min-w-[52px] text-right">
                                                            <span className="text-sm font-black" style={{ color: '#0f9688' }}>{total}</span>
                                                            <span className="text-[10px] text-slate-400 ml-0.5">чел</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const ManualStayView = ({ guests = [], rooms = [], currentUser, payments = [], hostelFilter = 'all' }) => {
    const [contractGroups, setContractGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');
    const [memberPickerGroupId, setMemberPickerGroupId] = useState(null);
    const [memberSearch, setMemberSearch] = useState('');
    const [editingGroup, setEditingGroup] = useState(null);
    const [payingGroup, setPayingGroup] = useState(null);
    const [reportGroup, setReportGroup] = useState(null);
    const [openSections, setOpenSections] = useState({});
    const [openWorkerGroups, setOpenWorkerGroups] = useState({});
    const [editingEntryId, setEditingEntryId] = useState(null);
    const [editEntryModal, setEditEntryModal] = useState(null); // { groupId, entryId } — попап редактирования периода
    const [mergeMode, setMergeMode] = useState(false);
    const [selectedGroupIds, setSelectedGroupIds] = useState(new Set());
    const [payingMergedGroups, setPayingMergedGroups] = useState(null);
    const [groupFilter, setGroupFilter] = useState('active'); // active | closed | all
    const [reportOpen, setReportOpen] = useState(false);
    const [confirmComplete, setConfirmComplete] = useState(null); // группа для подтверждения завершения

    const toggleSection = (groupId, section) =>
        setOpenSections(s => ({ ...s, [`${groupId}:${section}`]: !s[`${groupId}:${section}`] }));
    const isSectionOpen = (groupId, section) => !!openSections[`${groupId}:${section}`];

    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';

    useEffect(() => {
        const colRef = collection(db, ...COLLECTION);
        const unsub = onSnapshot(colRef, (snap) => {
            const hostelId = currentUser?.hostelId || '';
            const groups = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(g => isAdmin || !g.hostelId || g.hostelId === hostelId)
                .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
            setContractGroups(groups);
            setLoading(false);
            if (!snap.metadata.fromCache && snap.empty) {
                try {
                    const raw = localStorage.getItem(CONTRACT_GROUPS_KEY);
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            const batch = writeBatch(db);
                            parsed.forEach(g => {
                                if (!g.id) return;
                                batch.set(doc(db, ...COLLECTION, g.id), {
                                    name: g.name || '', memberKeys: g.memberKeys || [],
                                    contractRate: g.contractRate || '', amountPaid: 0,
                                    manualEntries: g.manualEntries || [], createdAt: Date.now(),
                                });
                            });
                            batch.commit().then(() => localStorage.removeItem(CONTRACT_GROUPS_KEY)).catch(console.error);
                        }
                    }
                } catch { }
            }
        }, (err) => { console.error('[ManualStay]', err); setLoading(false); });
        return () => unsub();
    }, []);

    const createGroup = async () => {
        const name = newGroupName.trim();
        if (!name) return;
        const id = `contract-${Date.now()}`;
        const newHostel = (effectiveHostel && effectiveHostel !== 'all')
            ? effectiveHostel
            : (currentUser?.hostelId && currentUser.hostelId !== 'all' ? currentUser.hostelId : 'hostel1');
        await setDoc(doc(db, ...COLLECTION, id), {
            name, memberKeys: [], contractRate: '', amountPaid: 0,
            manualEntries: [], createdAt: Date.now(),
            hostelId: newHostel,
        });
        setNewGroupName('');
        setCreating(false);
        setMemberPickerGroupId(id);
        setMemberSearch('');
    };

    const renameGroup = async () => {
        if (!editingGroup) return;
        const name = editingGroup.name.trim();
        if (!name) return;
        await updateDoc(doc(db, ...COLLECTION, editingGroup.id), { name });
        setEditingGroup(null);
    };

    const deleteGroup = async (groupId) => {
        if (!window.confirm('Удалить группу?')) return;
        await deleteDoc(doc(db, ...COLLECTION, groupId));
        if (memberPickerGroupId === groupId) setMemberPickerGroupId(null);
    };

    const updateGroup = async (groupId, patch) => {
        await updateDoc(doc(db, ...COLLECTION, groupId), patch);
    };

    // Закрытие/возобновление договора — остаётся в истории, не удаляется
    // Завершить договор: становится неактивным (нельзя оплатить), но остаётся в отчёте.
    const markGroupCompleted = async (groupId) => {
        await updateDoc(doc(db, ...COLLECTION, groupId), { completed: true, completedAt: Date.now() });
    };

    const toggleGroupClosed = async (groupId, closed) => {
        await updateDoc(doc(db, ...COLLECTION, groupId), closed
            ? { closed: true, closedAt: Date.now() }
            : { closed: false, closedAt: null });
    };

    const toggleMember = async (groupId, memberKey) => {
        const group = contractGroups.find(g => g.id === groupId);
        if (!group) return;
        const keys = new Set(group.memberKeys || []);
        if (keys.has(memberKey)) keys.delete(memberKey); else keys.add(memberKey);
        await updateDoc(doc(db, ...COLLECTION, groupId), { memberKeys: [...keys] });
    };

    const addEntry = async (groupId) => {
        const group = contractGroups.find(g => g.id === groupId);
        if (!group) return;
        const today = new Date().toISOString().slice(0, 10);
        const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const entry = { id: `e-${Date.now()}`, checkIn: today, checkOut: tomorrow, roomIds: [], people: '' };
        await updateDoc(doc(db, ...COLLECTION, groupId), { manualEntries: [...(group.manualEntries || []), entry] });
    };

    // Создание периода из мини-календаря (выбранный диапазон дат). Открываем на редактирование.
    const addEntryDates = async (groupId, checkIn, checkOut) => {
        const group = contractGroups.find(g => g.id === groupId);
        if (!group) return;
        const id = `e-${Date.now()}`;
        const entry = { id, checkIn, checkOut, roomIds: [], people: '' };
        await updateDoc(doc(db, ...COLLECTION, groupId), { manualEntries: [...(group.manualEntries || []), entry] });
        setEditEntryModal({ groupId, entryId: id });
    };

    const updateEntry = async (groupId, entryId, patch) => {
        const group = contractGroups.find(g => g.id === groupId);
        if (!group) return;
        const manualEntries = (group.manualEntries || []).map(e => e.id === entryId ? { ...e, ...patch } : e);
        await updateDoc(doc(db, ...COLLECTION, groupId), { manualEntries });
    };

    const removeEntry = async (groupId, entryId) => {
        const group = contractGroups.find(g => g.id === groupId);
        if (!group) return;
        const manualEntries = (group.manualEntries || []).filter(e => e.id !== entryId);
        await updateDoc(doc(db, ...COLLECTION, groupId), { manualEntries });
    };

    const addWorkerGroup = async (groupId, entryId) => {
        const group = contractGroups.find(g => g.id === groupId);
        if (!group) return;
        const manualEntries = (group.manualEntries || []).map(e =>
            e.id !== entryId ? e : { ...e, workerGroups: [...(e.workerGroups || []), { id: `wg-${Date.now()}`, specialty: '', count: '' }] }
        );
        await updateDoc(doc(db, ...COLLECTION, groupId), { manualEntries });
    };

    // Сумма людей по бригаде (специальности с кол-вом). Если бригада заполнена —
    // общее кол-во людей берётся отсюда; если бригады нет — people вводится вручную.
    const brigadeTotal = (workerGroups) => (workerGroups || []).reduce((s, wg) => s + (wg.specialty ? (parseInt(wg.count) || 0) : 0), 0);

    const updateWorkerGroup = async (groupId, entryId, wgId, patch) => {
        const group = contractGroups.find(g => g.id === groupId);
        if (!group) return;
        const manualEntries = (group.manualEntries || []).map(e => {
            if (e.id !== entryId) return e;
            const workerGroups = (e.workerGroups || []).map(wg => wg.id === wgId ? { ...wg, ...patch } : wg);
            const bt = brigadeTotal(workerGroups);
            return { ...e, workerGroups, ...(bt > 0 ? { people: String(bt) } : {}) };
        });
        await updateDoc(doc(db, ...COLLECTION, groupId), { manualEntries });
    };

    const removeWorkerGroup = async (groupId, entryId, wgId) => {
        const group = contractGroups.find(g => g.id === groupId);
        if (!group) return;
        const manualEntries = (group.manualEntries || []).map(e => {
            if (e.id !== entryId) return e;
            const workerGroups = (e.workerGroups || []).filter(wg => wg.id !== wgId);
            const bt = brigadeTotal(workerGroups);
            return { ...e, workerGroups, ...(bt > 0 ? { people: String(bt) } : {}) };
        });
        await updateDoc(doc(db, ...COLLECTION, groupId), { manualEntries });
    };

    const groupedGuests = useMemo(() => {
        const map = new Map();
        guests.filter(g => g.status !== 'booking').forEach(g => {
            const key = (g.fullName || '—').trim();
            if (!map.has(key)) map.set(key, { key, name: key, stays: [] });
            map.get(key).stays.push(g);
        });
        return Array.from(map.values())
            .map(g => ({
                ...g,
                stayCount: g.stays.length,
                totalNights: g.stays.reduce((s, stay) => s + getStayNights(stay), 0),
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [guests]);

    const guestMap = useMemo(() => new Map(groupedGuests.map(g => [g.key, g])), [groupedGuests]);

    const detailedGroups = useMemo(() => {
        return contractGroups.map(group => {
            const members = (group.memberKeys || []).map(k => guestMap.get(k)).filter(Boolean);
            const rawEntries = Array.isArray(group.manualEntries) ? group.manualEntries : [];
            const entries = rawEntries.map(e => ({ ...e, ...computeEntry(e) }))
                .sort((a, b) => (a.checkIn || '').localeCompare(b.checkIn || ''));
            const autoPersonNights   = members.reduce((s, m) => s + m.totalNights, 0);
            const manualPersonNights = entries.reduce((s, e) => s + e.personNights, 0);
            const manualRoomNights   = entries.reduce((s, e) => s + e.roomNights, 0);
            const totalPersonNights  = autoPersonNights + manualPersonNights;
            const contractRate = parseInt(group.contractRate, 10) || 0;
            const contractTotal = contractRate > 0 ? contractRate * totalPersonNights : 0;
            // Compute amountPaid from payment records first, fallback to group.amountPaid (legacy)
            const groupPayments = payments.filter(p => p.contractGroupId === group.id);
            const paidFromRecords = groupPayments.reduce((s, p) => {
                const pAmt = (parseInt(p.cash)||0) + (parseInt(p.transfer)||0) + (parseInt(p.card)||0) + (parseInt(p.qr)||0);
                return s + (pAmt || parseInt(p.amount) || 0);
            }, 0);
            const amountPaid = paidFromRecords > 0 ? paidFromRecords : (parseInt(group.amountPaid, 10) || 0);
            const debt = contractTotal > 0 ? contractTotal - amountPaid : 0;
            return {
                ...group, members, manualEntries: entries,
                autoPersonNights, manualPersonNights, manualRoomNights, totalPersonNights,
                contractRate, contractTotal, amountPaid, debt,
            };
        });
    }, [contractGroups, guestMap, payments]);

    const filteredGuests = useMemo(() => {
        const q = memberSearch.trim().toLowerCase();
        return q ? groupedGuests.filter(g => g.name.toLowerCase().includes(q)) : groupedGuests;
    }, [groupedGuests, memberSearch]);

    // Ранее сохранённые специальности из всех договоров — для выбора при создании периода
    const savedSpecialties = useMemo(() => {
        const set = new Set();
        contractGroups.forEach(g => (g.manualEntries || []).forEach(e => (e.workerGroups || []).forEach(wg => {
            const s = (wg.specialty || '').trim();
            if (s) set.add(s);
        })));
        return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
    }, [contractGroups]);

    // Каждый договор привязан к хостелу. Показываем только договоры активного хостела.
    const effectiveHostel = (currentUser?.role === 'admin' || currentUser?.role === 'super')
        ? hostelFilter
        : (currentUser?.hostelId || 'all');
    const hostelGroups = useMemo(() => {
        if (!effectiveHostel || effectiveHostel === 'all') return detailedGroups;
        // Каждый договор привязан к хостелу. Легаси без hostelId считаем за hostel1,
        // чтобы они не показывались сразу в обоих хостелах.
        return detailedGroups.filter(g => (g.hostelId || 'hostel1') === effectiveHostel);
    }, [detailedGroups, effectiveHostel]);

    const closedCount = useMemo(() => hostelGroups.filter(g => g.closed).length, [hostelGroups]);
    const visibleGroups = useMemo(() => {
        if (groupFilter === 'closed') return hostelGroups.filter(g => g.closed);
        if (groupFilter === 'all') return hostelGroups;
        return hostelGroups.filter(g => !g.closed);
    }, [hostelGroups, groupFilter]);

    const globalStats = useMemo(() => ({
        nights:   visibleGroups.reduce((s, g) => s + g.totalPersonNights, 0),
        charged:  visibleGroups.reduce((s, g) => s + g.contractTotal, 0),
        paid:     visibleGroups.reduce((s, g) => s + g.amountPaid, 0),
        debt:     visibleGroups.reduce((s, g) => s + Math.max(0, g.debt), 0),
    }), [visibleGroups]);

    if (loading) return (
        <div className="flex items-center justify-center py-24">
            <Loader2 className="animate-spin" size={28} style={{ color: '#6366f1' }} />
        </div>
    );

    const paidPct = globalStats.charged > 0 ? Math.min(100, (globalStats.paid / globalStats.charged) * 100) : 0;
    const toggleWG = (entryId) => setOpenWorkerGroups(s => ({ ...s, [entryId]: !s[entryId] }));

    return (
        <div className="space-y-3">
            {payingGroup && (
                <PaymentModal group={payingGroup} currentUser={currentUser} onClose={() => setPayingGroup(null)} />
            )}
            {confirmComplete && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setConfirmComplete(null)}>
                    <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.15)' }}>
                                <Check size={18} className="text-indigo-500" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">Завершить договор?</h3>
                                <p className="text-sm text-slate-500">«{confirmComplete.name}»</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-500 mb-5">После завершения договор станет неактивным — в него нельзя будет добавить оплату. Он останется в отчётах. Дальше его можно только убрать в архив.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmComplete(null)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                                Отмена
                            </button>
                            <button onClick={() => { markGroupCompleted(confirmComplete.id); setConfirmComplete(null); }}
                                className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold transition-colors">
                                Завершить
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {payingMergedGroups && (
                <PaymentModal groups={payingMergedGroups} currentUser={currentUser} onClose={() => { setPayingMergedGroups(null); setMergeMode(false); setSelectedGroupIds(new Set()); }} />
            )}
            {reportGroup && (
                <BrigadeReportModal group={reportGroup} onClose={() => setReportGroup(null)} />
            )}
            {reportOpen && (() => {
                const sel = selectedGroupIds.size ? visibleGroups.filter(g => selectedGroupIds.has(g.id)) : visibleGroups;
                const label = selectedGroupIds.size
                    ? `Выбрано: ${selectedGroupIds.size}`
                    : (groupFilter === 'closed' ? 'История (закрытые)' : groupFilter === 'all' ? 'Все договоры' : 'Активные договоры');
                const hLabel = effectiveHostel === 'hostel1' ? 'Хостел №1' : effectiveHostel === 'hostel2' ? 'Хостел №2' : 'Все хостелы';
                return <OverallReportModal groups={sel} payments={payments} scopeLabel={label} hostelLabel={hLabel} onClose={() => setReportOpen(false)} />;
            })()}
            {editEntryModal && (() => {
                const g = contractGroups.find(x => x.id === editEntryModal.groupId);
                const en = g?.manualEntries?.find(e => e.id === editEntryModal.entryId);
                if (!g || !en) return null;
                return (
                    <PeriodEditModal
                        group={g} entry={en} rooms={rooms} savedSpecialties={savedSpecialties}
                        onUpdate={patch => updateEntry(g.id, en.id, patch)}
                        onRemove={() => removeEntry(g.id, en.id)}
                        onAddWG={() => addWorkerGroup(g.id, en.id)}
                        onUpdateWG={(wgId, patch) => updateWorkerGroup(g.id, en.id, wgId, patch)}
                        onRemoveWG={(wgId) => removeWorkerGroup(g.id, en.id, wgId)}
                        onClose={() => setEditEntryModal(null)}
                    />
                );
            })()}

            <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0d2b30 0%, #1a3c40 100%)' }}>
                <div className="px-5 pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                            <div style={{ color: 'rgba(94,234,212,0.5)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                                Ручной учёт проживания
                            </div>
                            <div style={{ marginTop: 4, lineHeight: 1.1 }}>
                                <span style={{ color: '#5eead4', fontSize: 28, fontWeight: 900 }}>{visibleGroups.length}</span>
                                {' '}
                                <span style={{ color: 'rgba(94,234,212,0.5)', fontSize: 15, fontWeight: 600 }}>{pluralGroups(visibleGroups.length)}</span>
                            </div>
                            <div className="flex items-center gap-1 mt-2">
                                {[
                                    { id: 'active', label: 'Активные' },
                                    { id: 'closed', label: `История${closedCount > 0 ? ` (${closedCount})` : ''}` },
                                    { id: 'all',    label: 'Все' },
                                ].map(tab => (
                                    <button key={tab.id} onClick={() => setGroupFilter(tab.id)}
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all"
                                        style={groupFilter === tab.id
                                            ? { background: 'rgba(94,234,212,0.18)', color: '#5eead4', border: '1px solid rgba(94,234,212,0.4)' }
                                            : { background: 'transparent', color: 'rgba(94,234,212,0.5)', border: '1px solid rgba(94,234,212,0.12)' }}>
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {!creating ? (
                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                {hostelGroups.length > 0 && (
                                    <button onClick={() => setReportOpen(true)}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-sm transition-all active:scale-[.97]"
                                        style={{ background: 'rgba(94,234,212,0.07)', color: 'rgba(94,234,212,0.6)', border: '1px solid rgba(94,234,212,0.15)' }}>
                                        <FileText size={13} /> Отчёт
                                    </button>
                                )}
                                {hostelGroups.length > 1 && (
                                    <button onClick={() => { setMergeMode(m => !m); setSelectedGroupIds(new Set()); }}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-sm transition-all active:scale-[.97]"
                                        style={{ background: mergeMode ? 'rgba(94,234,212,0.2)' : 'rgba(94,234,212,0.07)', color: mergeMode ? '#5eead4' : 'rgba(94,234,212,0.6)', border: `1px solid ${mergeMode ? 'rgba(94,234,212,0.4)' : 'rgba(94,234,212,0.15)'}` }}
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6H5a2 2 0 00-2 2v8a2 2 0 002 2h3"/><path d="M16 6h3a2 2 0 012 2v8a2 2 0 01-2 2h-3"/><line x1="12" y1="6" x2="12" y2="18"/></svg>
                                        {mergeMode ? 'Отмена' : 'Объединить'}
                                    </button>
                                )}
                            <button onClick={() => setCreating(true)}
                                className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold text-sm transition-all active:scale-[.97]"
                                style={{ background: 'rgba(94,234,212,0.1)', color: '#5eead4', border: '1px solid rgba(94,234,212,0.2)' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(94,234,212,0.18)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(94,234,212,0.1)'}
                            >
                                <Plus size={13} strokeWidth={2.5} /> Новая группа
                            </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 rounded-xl px-3 py-1.5"
                                style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.2)' }}>
                                <input autoFocus value={newGroupName}
                                    onChange={e => setNewGroupName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') createGroup(); if (e.key === 'Escape') { setCreating(false); setNewGroupName(''); } }}
                                    placeholder="Название договора…"
                                    className="flex-1 min-w-[160px] text-sm outline-none placeholder:opacity-40 bg-transparent"
                                    style={{ color: '#5eead4' }}
                                />
                                <button onClick={createGroup} className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                                    style={{ background: '#0f9688', color: '#fff' }}>
                                    Создать
                                </button>
                                <button onClick={() => { setCreating(false); setNewGroupName(''); }} style={{ color: 'rgba(94,234,212,0.45)' }} className="p-0.5">
                                    <X size={13} />
                                </button>
                            </div>
                        )}
                    </div>
                    {visibleGroups.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                            {[
                                { label: 'ЧЕЛ-СУТОК', sub: 'всего', value: globalStats.nights.toLocaleString(), red: false },
                                { label: 'НАЧИСЛЕНО',  sub: 'сум',   value: fmt(globalStats.charged),           red: false },
                                { label: 'ОПЛАЧЕНО',   sub: 'сум',   value: fmt(globalStats.paid),              red: false },
                                ...(globalStats.debt > 0 ? [{ label: 'ДОЛГ', sub: 'сум', value: fmt(globalStats.debt), red: true }] : []),
                            ].map(s => (
                                <div key={s.label} style={{ background: 'rgba(94,234,212,0.07)', border: '1px solid rgba(94,234,212,0.12)', borderRadius: 10, padding: '8px 12px' }}>
                                    <div style={{ color: 'rgba(94,234,212,0.4)', fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</div>
                                    <div style={{ color: s.red ? '#fca5a5' : '#5eead4', fontSize: 18, fontWeight: 900, lineHeight: 1.2, marginTop: 2 }}>{s.value}</div>
                                    <div style={{ color: 'rgba(94,234,212,0.25)', fontSize: 9 }}>{s.sub}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {globalStats.charged > 0 && (
                        <div className="mt-2.5">
                            <div className="flex justify-between mb-1">
                                <span style={{ color: 'rgba(94,234,212,0.4)', fontSize: 9 }}>Оплата</span>
                                <span style={{ color: paidPct >= 100 ? '#5eead4' : 'rgba(94,234,212,0.65)', fontSize: 9, fontWeight: 700 }}>{paidPct.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(94,234,212,0.1)' }}>
                                <div className="h-full rounded-full transition-all duration-700"
                                    style={{ width: `${paidPct}%`, background: paidPct >= 100 ? '#5eead4' : 'linear-gradient(90deg,#5eead4,#0f9688)' }} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {visibleGroups.length === 0 && (
                <div className="py-10 text-center">
                    <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.2)' }}>
                        <Users size={22} style={{ color: '#0f9688' }} />
                    </div>
                    <p className="text-slate-600 font-semibold">{groupFilter === 'closed' ? 'Закрытых договоров нет' : 'Групп пока нет'}</p>
                    {groupFilter !== 'closed' && (
                        <>
                            <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">Создайте группу и начните вести учёт</p>
                            <button onClick={() => setCreating(true)}
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors"
                                style={{ background: '#0f9688' }}>
                                <Plus size={13} /> Создать группу
                            </button>
                        </>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {visibleGroups.map((group, idx) => {
                    const isMemberPickerOpen = memberPickerGroupId === group.id;
                    const isEditing = editingGroup?.id === group.id;
                    const membersOpen = isSectionOpen(group.id, 'members');
                    const groupPaidPct = group.contractTotal > 0 ? Math.min(100, (group.amountPaid / group.contractTotal) * 100) : 0;
                    const isPaid = group.contractTotal > 0 && group.debt <= 0;
                    const num = String(idx + 1).padStart(2, '0');

                    const isSelected = selectedGroupIds.has(group.id);

                    return (
                        <div key={group.id} className="rounded-xl overflow-hidden"
                            style={{ background: isSelected ? 'linear-gradient(135deg, #0f2e33 0%, #1e4a50 100%)' : 'linear-gradient(135deg, #0d2532 0%, #1a3640 100%)', border: isSelected ? '1.5px solid rgba(94,234,212,0.55)' : '1px solid rgba(94,234,212,0.2)', borderLeft: isSelected ? '3px solid #5eead4' : '3px solid #0f9688' }}>

                            {/* ─ Main row ─ */}
                            <div className="flex items-stretch">
                                {mergeMode && (
                                    <button type="button"
                                        onClick={() => setSelectedGroupIds(prev => { const n = new Set(prev); if (n.has(group.id)) n.delete(group.id); else n.add(group.id); return n; })}
                                        className="flex items-center justify-center px-2.5 shrink-0 transition-colors"
                                        style={{ background: isSelected ? 'rgba(94,234,212,0.15)' : 'rgba(94,234,212,0.04)', borderRight: '1px solid rgba(94,234,212,0.12)' }}>
                                        <div className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all"
                                            style={{ borderColor: isSelected ? '#5eead4' : 'rgba(94,234,212,0.3)', background: isSelected ? '#5eead4' : 'transparent' }}>
                                            {isSelected && <Check size={8} color="#0d2532" strokeWidth={3} />}
                                        </div>
                                    </button>
                                )}
                                <div className="flex items-center justify-center px-3 shrink-0 select-none" style={{ background: 'rgba(94,234,212,0.07)', borderRight: '1px solid rgba(94,234,212,0.12)', minWidth: 42 }}>
                                    <span className="text-base font-black leading-none" style={{ color: '#5eead4' }}>{num}</span>
                                </div>
                                <div className="flex-1 min-w-0 px-3 py-2.5">
                                    {isEditing ? (
                                        <div className="flex items-center gap-1.5">
                                            <input autoFocus value={editingGroup.name}
                                                onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                                                onKeyDown={e => { if (e.key === 'Enter') renameGroup(); if (e.key === 'Escape') setEditingGroup(null); }}
                                                className="flex-1 text-sm font-semibold outline-none border-b bg-transparent"
                                                style={{ borderColor: '#5eead4', color: '#e2f7f8' }}
                                            />
                                            <button onClick={renameGroup} className="p-1 rounded" style={{ background: 'rgba(94,234,212,0.15)', color: '#5eead4' }}><Check size={11} /></button>
                                            <button onClick={() => setEditingGroup(null)} className="p-1 rounded" style={{ color: 'rgba(94,234,212,0.4)' }}><X size={11} /></button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-sm font-semibold" style={{ color: group.closed ? 'rgba(226,247,248,0.55)' : '#e2f7f8' }}>{group.name}</span>
                                            {group.closed && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(148,163,184,0.18)', color: '#94a3b8' }}>Закрыт</span>}
                                            {!group.closed && group.completed && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.18)', color: '#a5b4fc' }}>Завершён</span>}
                                            {isPaid && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}><Check size={7} strokeWidth={3} /> Оплачено</span>}
                                            {!isPaid && group.debt > 0 && group.contractTotal > 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>-{fmt(group.debt)}</span>}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        <span className="text-[11px]" style={{ color: 'rgba(94,234,212,0.5)' }}><b style={{ color: 'rgba(94,234,212,0.75)' }}>{group.members.length}</b> уч · <b style={{ color: '#5eead4' }}>{group.totalPersonNights.toLocaleString()}</b> чс</span>
                                        {group.contractRate > 0 && <span className="text-[11px]" style={{ color: 'rgba(94,234,212,0.5)' }}><b style={{ color: 'rgba(94,234,212,0.75)' }}>{fmt(group.contractRate)}</b>/чс · <b style={{ color: '#e2f7f8' }}>{fmt(group.contractTotal)}</b>{group.amountPaid > 0 && <> · <b style={{ color: '#4ade80' }}>{fmt(group.amountPaid)}</b></>}</span>}
                                        {isAdmin && (
                                            <select value={group.hostelId || ''} onChange={e => updateGroup(group.id, { hostelId: e.target.value })}
                                                className="text-[10px] rounded px-1 py-0.5 focus:outline-none"
                                                style={{ background: 'rgba(94,234,212,0.07)', border: `1px solid ${group.hostelId ? 'rgba(94,234,212,0.2)' : '#f59e0b'}`, color: group.hostelId ? '#5eead4' : '#fbbf24' }}>
                                                <option value="">— хостел —</option>
                                                <option value="hostel1">Хостел №1</option>
                                                <option value="hostel2">Хостел №2</option>
                                            </select>
                                        )}
                                    </div>
                                    {group.contractTotal > 0 && (
                                        <div className="mt-1.5 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(94,234,212,0.1)' }}>
                                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${groupPaidPct}%`, background: isPaid ? '#4ade80' : 'linear-gradient(90deg,#5eead4,#0f9688)' }} />
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col justify-center gap-1.5 px-3 py-2.5 shrink-0" style={{ borderLeft: '1px solid rgba(94,234,212,0.12)' }}>
                                    {(group.completed || group.closed) ? (
                                        <>
                                            <button onClick={() => setReportGroup(group)} className="px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1" style={{ background: 'rgba(94,234,212,0.1)', color: '#5eead4' }}><FileText size={11} /> Отчёт</button>
                                            {group.completed && !group.closed && (
                                                <button onClick={() => toggleGroupClosed(group.id, true)} title="Убрать договор в архив" className="px-2 py-1.5 rounded-lg text-[10px] font-bold text-white flex items-center justify-center gap-1" style={{ background: '#6366f1' }}><Archive size={11} /> В архив</button>
                                            )}
                                            {group.closed && (
                                                <button onClick={() => toggleGroupClosed(group.id, false)} title="Вернуть из архива" className="px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1" style={{ background: 'rgba(94,234,212,0.1)', color: '#5eead4' }}><ArchiveRestore size={11} /> Вернуть</button>
                                            )}
                                            <button onClick={() => deleteGroup(group.id)} className="p-1.5 rounded transition-colors self-center" style={{ color: 'rgba(94,234,212,0.35)' }}
                                                onMouseEnter={e => e.currentTarget.style.color='#f87171'} onMouseLeave={e => e.currentTarget.style.color='rgba(94,234,212,0.35)'}><Trash2 size={10} /></button>
                                        </>
                                    ) : (
                                        <>
                                            <LocalNumInput value={group.contractRate || ''} onCommit={val => updateGroup(group.id, { contractRate: val })}
                                                placeholder="Ставка"
                                                className="w-20 px-2 py-1.5 text-[10px] text-right rounded-lg focus:outline-none font-mono"
                                                style={{ background: 'rgba(94,234,212,0.07)', border: '1px solid rgba(94,234,212,0.2)', color: '#5eead4' }} />
                                            <button onClick={() => setPayingGroup(group)} className="px-2 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background: '#0f9688' }}>Оплатить</button>
                                            <div className="flex items-center justify-between gap-1">
                                                <button onClick={() => setEditingGroup({ id: group.id, name: group.name })} className="p-1.5 rounded transition-colors" style={{ color: 'rgba(94,234,212,0.35)' }}
                                                    onMouseEnter={e => e.currentTarget.style.color='#5eead4'} onMouseLeave={e => e.currentTarget.style.color='rgba(94,234,212,0.35)'}><Edit2 size={10} /></button>
                                                <button onClick={() => setReportGroup(group)} className="p-1.5 rounded transition-colors" style={{ color: 'rgba(94,234,212,0.35)' }}
                                                    onMouseEnter={e => e.currentTarget.style.color='#5eead4'} onMouseLeave={e => e.currentTarget.style.color='rgba(94,234,212,0.35)'}><FileText size={10} /></button>
                                                <button onClick={() => setConfirmComplete(group)} title="Завершить договор"
                                                    className="p-1.5 rounded transition-colors" style={{ color: 'rgba(94,234,212,0.35)' }}
                                                    onMouseEnter={e => e.currentTarget.style.color='#6366f1'} onMouseLeave={e => e.currentTarget.style.color='rgba(94,234,212,0.35)'}><Check size={12} /></button>
                                                <button onClick={() => deleteGroup(group.id)} className="p-1.5 rounded transition-colors" style={{ color: 'rgba(94,234,212,0.35)' }}
                                                    onMouseEnter={e => e.currentTarget.style.color='#f87171'} onMouseLeave={e => e.currentTarget.style.color='rgba(94,234,212,0.35)'}><Trash2 size={10} /></button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* ─ Members accordion ─ */}
                            <div style={{ borderTop: '1px solid rgba(94,234,212,0.1)' }}>
                                <button type="button"
                                    onClick={() => { toggleSection(group.id, 'members'); if (!isSectionOpen(group.id, 'members')) { setMemberPickerGroupId(null); setMemberSearch(''); } }}
                                    className="w-full flex items-center justify-between px-3 py-1.5 transition-colors text-left"
                                    style={{ background: 'transparent' }}
                                    onMouseEnter={e => e.currentTarget.style.background='rgba(94,234,212,0.04)'}
                                    onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-medium" style={{ color: 'rgba(94,234,212,0.5)' }}>Участники</span>
                                        {group.members.length > 0 && <span className="text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(94,234,212,0.15)', color: '#5eead4' }}>{group.members.length}</span>}
                                    </div>
                                    {membersOpen ? <ChevronDown size={10} style={{ color: 'rgba(94,234,212,0.4)' }} /> : <ChevronRight size={10} style={{ color: 'rgba(94,234,212,0.4)' }} />}
                                </button>
                                {membersOpen && (
                                    <div className="px-3 pb-2.5 space-y-2">
                                        {group.members.length > 0 && (
                                            <div className="flex flex-wrap gap-1">
                                                {group.members.map(member => (
                                                    <span key={member.key} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-medium" style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.25)', color: '#5eead4' }}>
                                                        {member.name}<span style={{ opacity: 0.5, fontSize: 9 }}>{member.totalNights}н</span>
                                                        <button onClick={() => toggleMember(group.id, member.key)} className="w-3 h-3 rounded-full flex items-center justify-center" style={{ opacity: 0.5, background: 'rgba(94,234,212,0.2)', color: '#5eead4' }}><X size={7} /></button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <button onClick={() => { if (isMemberPickerOpen) { setMemberPickerGroupId(null); setMemberSearch(''); } else { setMemberPickerGroupId(group.id); setMemberSearch(''); } }}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium border transition-all"
                                            style={isMemberPickerOpen
                                                ? { borderColor: 'rgba(94,234,212,0.4)', background: 'rgba(94,234,212,0.1)', color: '#5eead4' }
                                                : { borderColor: 'rgba(94,234,212,0.2)', color: 'rgba(94,234,212,0.5)', background: 'transparent' }}>
                                            <Plus size={8} style={{ transform: isMemberPickerOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s' }} />
                                            {isMemberPickerOpen ? 'Свернуть' : 'Добавить'}
                                        </button>
                                        {isMemberPickerOpen && (
                                            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(94,234,212,0.2)' }}>
                                                <div className="relative">
                                                    <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(94,234,212,0.4)' }} />
                                                    <input autoFocus value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Поиск…"
                                                        className="w-full pl-7 pr-2 py-1.5 text-[11px] focus:outline-none"
                                                        style={{ background: 'rgba(94,234,212,0.05)', color: '#e2f7f8', borderBottom: '1px solid rgba(94,234,212,0.12)' }} />
                                                </div>
                                                <div className="max-h-36 overflow-y-auto">
                                                    {filteredGuests.length === 0
                                                        ? <div className="text-[11px] text-center py-2" style={{ color: 'rgba(94,234,212,0.4)' }}>Не найдено</div>
                                                        : filteredGuests.map(guest => {
                                                            const inGroup = (group.memberKeys || []).includes(guest.key);
                                                            return (
                                                                <button key={guest.key} onClick={() => toggleMember(group.id, guest.key)}
                                                                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors"
                                                                    style={{ background: inGroup ? 'rgba(94,234,212,0.1)' : 'transparent', borderBottom: '1px solid rgba(94,234,212,0.07)' }}
                                                                    onMouseEnter={e => { if (!inGroup) e.currentTarget.style.background='rgba(94,234,212,0.05)'; }}
                                                                    onMouseLeave={e => { if (!inGroup) e.currentTarget.style.background='transparent'; }}>
                                                                    <div className="min-w-0">
                                                                        <div className="text-[11px] font-medium truncate" style={{ color: '#e2f7f8' }}>{guest.name}</div>
                                                                        <div className="text-[9px]" style={{ color: 'rgba(94,234,212,0.4)' }}>{guest.stayCount} засел · {guest.totalNights} сут</div>
                                                                    </div>
                                                                    <div className="shrink-0 w-3.5 h-3.5 rounded border-2 flex items-center justify-center"
                                                                        style={{ borderColor: inGroup ? '#5eead4' : 'rgba(94,234,212,0.3)', background: inGroup ? '#5eead4' : 'transparent' }}>
                                                                        {inGroup && <Check size={6} color="#0d2532" strokeWidth={3} />}
                                                                    </div>
                                                                </button>
                                                            );
                                                        })
                                                    }
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ─ Periods (always open) ─ */}
                            <div style={{ borderTop: '1px solid rgba(94,234,212,0.1)' }}>
                                <div className="flex items-center justify-between px-3 py-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-medium" style={{ color: 'rgba(94,234,212,0.5)' }}>Периоды</span>
                                        {group.manualEntries.length > 0 && <span className="text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(94,234,212,0.12)', color: '#5eead4' }}>{group.manualEntries.length}</span>}
                                        {group.manualPersonNights > 0 && <span className="text-[9px]" style={{ color: 'rgba(94,234,212,0.4)' }}>+{group.manualPersonNights} чс</span>}
                                    </div>
                                    <button type="button" onClick={() => toggleSection(group.id, 'minical')}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold transition-colors"
                                        style={isSectionOpen(group.id, 'minical')
                                            ? { background: 'rgba(94,234,212,0.18)', color: '#5eead4', border: '1px solid rgba(94,234,212,0.4)' }
                                            : { background: 'transparent', color: 'rgba(94,234,212,0.5)', border: '1px solid rgba(94,234,212,0.15)' }}>
                                        <CalendarDays size={9} /> Календарь
                                    </button>
                                </div>
                                {isSectionOpen(group.id, 'minical') && (
                                    <PeriodMiniCalendar
                                        entries={group.manualEntries}
                                        onAddPeriod={(ci, co) => addEntryDates(group.id, ci, co)}
                                        onEditPeriod={(id) => setEditEntryModal({ groupId: group.id, entryId: id })}
                                        onDeletePeriod={(id) => removeEntry(group.id, id)}
                                    />
                                )}
                                <div className="pb-2">
                                    {group.manualEntries.length > 0 && (
                                        <div className="mb-1">
                                            {group.manualEntries.map(entry => {
                                                const isEditingEntry = editingEntryId === entry.id;
                                                const wgOpen = !!openWorkerGroups[entry.id];
                                                const wgCount = (entry.workerGroups || []).filter(wg => wg.specialty).length;
                                                const sd = (iso) => { if (!iso) return '—'; const [,m,d]=iso.split('-'); return `${parseInt(d)}.${m}`; };
                                                const roomLabels = Array.isArray(entry.roomIds) && entry.roomIds.length > 0
                                                    ? entry.roomIds.map(id => { const r = rooms.find(x => x.id === id || x.number === id); return r ? `№${r.number}` : `№${id}`; }).join(' ')
                                                    : '';
                                                return (
                                                    <div key={entry.id} className="border-b last:border-0" style={{ borderColor: 'rgba(94,234,212,0.08)' }}>
                                                        {isEditingEntry ? (
                                                            <div className="px-3 py-2.5" style={{ background: 'rgba(94,234,212,0.04)' }}>
                                                                <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                                                                    <input type="date" value={entry.checkIn || ''} onChange={e => updateEntry(group.id, entry.id, { checkIn: e.target.value })}
                                                                        className="px-2 py-1.5 text-[11px] rounded-lg focus:outline-none"
                                                                        style={{ border: '1px solid rgba(94,234,212,0.25)', background: 'rgba(94,234,212,0.07)', color: '#e2f7f8' }} />
                                                                    <input type="date" value={entry.checkOut || ''} onChange={e => updateEntry(group.id, entry.id, { checkOut: e.target.value })}
                                                                        className="px-2 py-1.5 text-[11px] rounded-lg focus:outline-none"
                                                                        style={{ border: '1px solid rgba(94,234,212,0.25)', background: 'rgba(94,234,212,0.07)', color: '#e2f7f8' }} />
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className="flex-1 min-w-0"><RoomPicker rooms={rooms} selected={Array.isArray(entry.roomIds) ? entry.roomIds : []} onChange={roomIds => updateEntry(group.id, entry.id, { roomIds })} /></div>
                                                                    {(entry.workerGroups || []).reduce((s, wg) => s + (wg.specialty ? (parseInt(wg.count) || 0) : 0), 0) > 0 ? (
                                                                        <input type="text" readOnly title="Из бригады"
                                                                            value={(entry.workerGroups || []).reduce((s, wg) => s + (wg.specialty ? (parseInt(wg.count) || 0) : 0), 0)}
                                                                            className="w-14 px-1.5 py-1.5 text-[11px] rounded-lg text-center font-bold"
                                                                            style={{ border: '1px solid rgba(94,234,212,0.25)', background: 'rgba(94,234,212,0.07)', color: '#5eead4' }} />
                                                                    ) : (
                                                                        <LocalNumInput placeholder="Чел" value={entry.people || ''} onCommit={val => updateEntry(group.id, entry.id, { people: val })}
                                                                            className="w-14 px-1.5 py-1.5 text-[11px] rounded-lg focus:outline-none text-center"
                                                                            style={{ border: '1px solid rgba(94,234,212,0.25)', background: 'rgba(94,234,212,0.07)', color: '#e2f7f8' }} />
                                                                    )}
                                                                    <button onClick={() => setEditingEntryId(null)}
                                                                        className="shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white"
                                                                        style={{ background: '#0f9688' }}>
                                                                        Готово
                                                                    </button>
                                                                </div>
                                                                <div className="mt-1.5 pt-1.5" style={{ borderTop: '1px solid rgba(94,234,212,0.1)' }}>
                                                                    <button type="button" onClick={() => toggleWG(entry.id)}
                                                                        className="inline-flex items-center gap-1 text-[9px] font-semibold transition-colors"
                                                                        style={{ color: 'rgba(94,234,212,0.5)' }}
                                                                        onMouseEnter={e => e.currentTarget.style.color='#5eead4'} onMouseLeave={e => e.currentTarget.style.color='rgba(94,234,212,0.5)'}>
                                                                        <ChevronRight size={8} style={{ transform: wgOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                                                                        Бригада{wgCount > 0 ? ` (${wgCount})` : ''}
                                                                    </button>
                                                                    {wgOpen && (
                                                                        <div className="mt-1 space-y-1">
                                                                            {(entry.workerGroups || []).map((wg, wgIdx) => (
                                                                                <WorkerGroupRow key={wg.id || wgIdx} wg={wg} wgIdx={wgIdx}
                                                                                    options={savedSpecialties}
                                                                                    onUpdate={(patch) => updateWorkerGroup(group.id, entry.id, wg.id, patch)}
                                                                                    onRemove={() => removeWorkerGroup(group.id, entry.id, wg.id)}
                                                                                />
                                                                            ))}
                                                                            <button onClick={() => addWorkerGroup(group.id, entry.id)}
                                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-dashed text-[9px] font-semibold transition-colors"
                                                                                style={{ borderColor: 'rgba(94,234,212,0.2)', color: 'rgba(94,234,212,0.5)' }}
                                                                                onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(94,234,212,0.4)'; e.currentTarget.style.color='#5eead4'; }}
                                                                                onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(94,234,212,0.2)'; e.currentTarget.style.color='rgba(94,234,212,0.5)'; }}>
                                                                                <Plus size={7} /> Добавить специальность
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 px-3 py-2 transition-colors"
                                                                style={{ background: 'transparent' }}
                                                                onMouseEnter={e => e.currentTarget.style.background='rgba(94,234,212,0.04)'}
                                                                onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                                                                <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                                                                    <span className="text-[12px] font-semibold whitespace-nowrap" style={{ color: '#e2f7f8' }}>
                                                                        {entry.checkIn && entry.checkOut
                                                                            ? `${sd(entry.checkIn)} → ${sd(entry.checkOut)}`
                                                                            : entry.nights > 0 ? `${entry.nights} ночей` : '—'}
                                                                    </span>
                                                                    {roomLabels && <span className="text-[10px]" style={{ color: 'rgba(94,234,212,0.45)' }}>{roomLabels}</span>}
                                                                    {entry.nights > 0 && <span className="text-[11px]" style={{ color: 'rgba(94,234,212,0.5)' }}>{entry.nights}н</span>}
                                                                    {entry.people > 0 && <span className="text-[10px]" style={{ color: 'rgba(94,234,212,0.45)' }}>{entry.people}чел</span>}
                                                                    {entry.personNights > 0 && <span className="text-[11px] font-bold" style={{ color: '#5eead4' }}>-{entry.personNights}</span>}
                                                                    {wgCount > 0 && <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: 'rgba(94,234,212,0.1)', color: '#5eead4' }}>бриг.{wgCount}</span>}
                                                                </div>
                                                                <div className="flex items-center gap-0.5 shrink-0">
                                                                    <button onClick={() => setEditingEntryId(entry.id)}
                                                                        className="text-[9px] px-1.5 py-0.5 rounded font-semibold transition-colors"
                                                                        style={{ color: '#5eead4', background: 'rgba(94,234,212,0.07)', border: '1px solid rgba(94,234,212,0.2)' }}>
                                                                        изм
                                                                    </button>
                                                                    <button onClick={() => removeEntry(group.id, entry.id)} className="p-0.5 rounded transition-colors ml-0.5"
                                                                        style={{ color: 'rgba(94,234,212,0.3)' }}
                                                                        onMouseEnter={e => e.currentTarget.style.color='#f87171'} onMouseLeave={e => e.currentTarget.style.color='rgba(94,234,212,0.3)'}>
                                                                        <X size={9} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {group.manualEntries.length > 1 && (
                                                <div className="flex justify-end gap-2 px-3 pt-1.5">
                                                    <span className="text-[9px]" style={{ color: 'rgba(94,234,212,0.4)' }}>Итого:</span>
                                                    <span className="text-[9px] font-bold" style={{ color: '#5eead4' }}>{group.manualPersonNights} чел-сут</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="px-3 pb-1">
                                        <button onClick={() => addEntry(group.id)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed text-[10px] font-medium transition-colors"
                                            style={{ borderColor: 'rgba(94,234,212,0.3)', color: '#0f9688' }}
                                            onMouseEnter={e => { e.currentTarget.style.background='rgba(94,234,212,0.06)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background=''; }}>
                                            <Plus size={8} /> Добавить период
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ─ Merge payment sticky bar ─ */}
            {mergeMode && selectedGroupIds.size >= 2 && (() => {
                const selGroups = detailedGroups.filter(g => selectedGroupIds.has(g.id));
                const totalDebt = selGroups.reduce((s, g) => s + (g.debt || 0), 0);
                const totalCharged = selGroups.reduce((s, g) => s + (g.contractTotal || 0), 0);
                return (
                    <div className="sticky bottom-4 mt-4 mx-0 z-20">
                        <div className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-2xl"
                            style={{ background: 'linear-gradient(135deg, #0f2e33 0%, #1a4a50 100%)', border: '1.5px solid rgba(94,234,212,0.4)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(94,234,212,0.15)' }}>
                                    <span className="text-base font-black" style={{ color: '#5eead4' }}>{selectedGroupIds.size}</span>
                                </div>
                                <div>
                                    <div className="text-xs font-bold" style={{ color: '#e2f7f8' }}>Выбрано групп: {selectedGroupIds.size}</div>
                                    <div className="text-[10px]" style={{ color: 'rgba(94,234,212,0.6)' }}>
                                        {totalCharged > 0 && <span>начислено: <b style={{ color: '#5eead4' }}>{fmt(totalCharged)}</b></span>}
                                        {totalDebt > 0 && <span className="ml-2">долг: <b style={{ color: '#f87171' }}>{fmt(totalDebt)}</b></span>}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setPayingMergedGroups(selGroups)}
                                className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-[.97]"
                                style={{ background: '#0f9688' }}>
                                Оплатить {selectedGroupIds.size} гр.
                            </button>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default ManualStayView;
