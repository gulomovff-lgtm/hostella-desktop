import React, { useState, useMemo } from 'react';
import { X, Minus, Plus, CalendarPlus, DollarSign, CreditCard, QrCode } from 'lucide-react';

/**
 * Продление проживания в стиле беты. Запись — через РОДНОЙ handleExtendGuest:
 * тот же расчёт checkOut/бонусов, платежи, Telegram «Продление проживания».
 */
const fmtMoney = (n) => (n || 0).toLocaleString('ru-RU');
const toInt = (v) => { const n = parseInt(String(v).replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : 0; };
const getTotalPaid = (g) => (typeof g.amountPaid === 'number'
    ? g.amountPaid
    : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0) + (g.paidTransfer || 0)));

const METHODS = [
    { key: 'payCash', label: 'Наличные', icon: DollarSign, cls: 'text-emerald-600', bg: 'bg-emerald-50' },
    { key: 'payCard', label: 'Карта', icon: CreditCard, cls: 'text-indigo-600', bg: 'bg-indigo-50' },
    { key: 'payQR', label: 'QR', icon: QrCode, cls: 'text-purple-600', bg: 'bg-purple-50' },
];

const ExtendBetaModal = ({ guest: g, onSubmit, onClose }) => {
    const prevDays = parseInt(g.days) || Math.max(1, Math.round((new Date(g.checkOutDate) - new Date(g.checkInDate)) / 86400000));
    const defaultPrice = parseInt(g.pricePerNight) || (prevDays > 0 ? Math.round((g.totalPrice || 0) / prevDays) : 0);

    const [add, setAdd] = useState(1);
    const [price, setPrice] = useState(String(defaultPrice || ''));
    const [pays, setPays] = useState({ payCash: '', payCard: '', payQR: '' });
    const [busy, setBusy] = useState(false);

    const addPrice = add * toInt(price);
    const newTotal = (g.totalPrice || 0) + addPrice;
    const payTotal = toInt(pays.payCash) + toInt(pays.payCard) + toInt(pays.payQR);
    const debtAfter = Math.max(0, newTotal - getTotalPaid(g) - payTotal);

    const newCheckOut = useMemo(() => {
        const d = new Date(g.checkOutDate);
        d.setDate(d.getDate() + add);
        return d;
    }, [g.checkOutDate, add]);

    const submit = async () => {
        if (busy || add < 1 || toInt(price) <= 0) return;
        setBusy(true);
        try {
            await onSubmit(g.id, {
                extendDays: add,
                payCash: toInt(pays.payCash), payCard: toInt(pays.payCard), payQR: toInt(pays.payQR),
                prevDays,
                prevTotalPrice: g.totalPrice || 0,
                prevCheckOut: g.checkOutDate,
                prevBonusCheckOut: g.bonusCheckOutDate || null,
                prevStatus: g.status,
                newDays: prevDays + add,
                newTotalPrice: newTotal,
                newCheckOut: newCheckOut.toISOString(),
            });
            onClose();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[170] flex items-center justify-center px-4"
            style={{ background: 'rgba(8,18,20,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
            <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">

                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                    <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><CalendarPlus size={16} /></span>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-black text-slate-800 truncate">Продление · {g.fullName}</div>
                        <div className="text-[11px] text-slate-400">
                            сейчас до {new Date(g.checkOutDate).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                        </div>
                    </div>
                    <button onClick={onClose} disabled={busy} aria-label="Закрыть" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="px-5 py-4 flex flex-col gap-3.5">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden">
                            <button onClick={() => setAdd(Math.max(1, add - 1))} className="px-3 py-2.5 text-slate-400 hover:bg-slate-50"><Minus size={14} /></button>
                            <span className="px-2 text-[14px] font-black text-slate-800 tabular-nums min-w-[80px] text-center">+{add} {add === 1 ? 'ночь' : add < 5 ? 'ночи' : 'ночей'}</span>
                            <button onClick={() => setAdd(add + 1)} className="px-3 py-2.5 text-slate-400 hover:bg-slate-50"><Plus size={14} /></button>
                        </div>
                        <div className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2.5 flex-1">
                            <input inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)}
                                className="w-full text-[13px] font-black tabular-nums text-slate-800 outline-none bg-transparent" />
                            <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">сум/ночь</span>
                        </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-[12px] font-semibold text-slate-500 flex items-center justify-between">
                        <span>Новый выезд: <b className="text-slate-700">{newCheckOut.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</b></span>
                        <span>Доплата: <b className="text-slate-800 tabular-nums">{fmtMoney(addPrice)}</b></span>
                    </div>

                    <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Оплата сейчас (не обязательно)</div>
                        <div className="grid grid-cols-3 gap-2">
                            {METHODS.map(({ key, label, icon: Icon, cls, bg }) => (
                                <label key={key} className={`block rounded-lg border p-2 transition-colors ${toInt(pays[key]) > 0 ? 'border-orange-300 bg-orange-50/40' : 'border-slate-200'}`}>
                                    <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">
                                        <span className={`w-4 h-4 rounded flex items-center justify-center ${bg}`}><Icon size={9} className={cls} /></span>
                                        {label}
                                    </span>
                                    <input inputMode="numeric" value={pays[key]} placeholder="0"
                                        onChange={e => setPays(prev => ({ ...prev, [key]: e.target.value }))}
                                        className="w-full text-[13px] font-black tabular-nums text-slate-800 bg-transparent outline-none" />
                                </label>
                            ))}
                        </div>
                        <button onClick={() => setPays({ payCash: String(addPrice), payCard: '', payQR: '' })}
                            className="mt-2 px-3 py-1.5 rounded-lg text-[11px] font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors">
                            Доплата налом · {fmtMoney(addPrice)}
                        </button>
                    </div>

                    <div className={`text-[12px] font-semibold ${debtAfter > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                        {debtAfter > 0 ? `После продления долг составит ${fmtMoney(debtAfter)}` : 'После продления долга не будет ✓'}
                    </div>
                </div>

                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex gap-2">
                    <button onClick={onClose} disabled={busy}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 border border-slate-200 bg-white hover:bg-slate-100 transition-colors">
                        Отмена
                    </button>
                    <button onClick={submit} disabled={busy || add < 1 || toInt(price) <= 0}
                        className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 transition-colors">
                        {busy ? 'Продлеваю…' : `Продлить на ${add} ноч. · +${fmtMoney(addPrice)}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExtendBetaModal;
