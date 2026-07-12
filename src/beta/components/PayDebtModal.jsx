import React, { useState, useMemo } from 'react';
import { X, DollarSign, CreditCard, QrCode, ArrowRightLeft, Zap } from 'lucide-react';

const fmtMoney = (n) => (n || 0).toLocaleString('ru-RU');
const toInt = (v) => {
    const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
};

const METHODS = [
    { key: 'cash', label: 'Наличные', icon: DollarSign, cls: 'text-emerald-600', bg: 'bg-emerald-50' },
    { key: 'card', label: 'Карта', icon: CreditCard, cls: 'text-indigo-600', bg: 'bg-indigo-50' },
    { key: 'qr', label: 'QR / Click', icon: QrCode, cls: 'text-purple-600', bg: 'bg-purple-50' },
    { key: 'transfer', label: 'Перечисление', icon: ArrowRightLeft, cls: 'text-sky-600', bg: 'bg-sky-50' },
];

const getTotalPaid = (g) => (typeof g.amountPaid === 'number'
    ? g.amountPaid
    : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0) + (g.paidTransfer || 0)));

const PayDebtModal = ({ guest, debt = 0, onSubmit, onClose }) => {
    const [vals, setVals] = useState({ cash: '', card: '', qr: '', transfer: '' });
    const [busy, setBusy] = useState(false);

    const total = useMemo(() =>
        toInt(vals.cash) + toInt(vals.card) + toInt(vals.qr) + toInt(vals.transfer), [vals]);

    const paid = getTotalPaid(guest);
    const priceTotal = guest.totalPrice || 0;
    const restDebt = Math.max(0, debt - total);
    const overpay = Math.max(0, total - debt);

    const setMethod = (key, v) => setVals(prev => ({ ...prev, [key]: v }));
    const fillAll = (key) => setVals({ cash: '', card: '', qr: '', transfer: '', [key]: String(debt) });
    const halfCash = () => setVals({ cash: String(Math.ceil(debt / 2)), card: '', qr: '', transfer: '' });

    const submit = async () => {
        if (total <= 0 || busy) return;
        setBusy(true);
        try {
            await onSubmit({ cash: toInt(vals.cash), card: toInt(vals.card), qr: toInt(vals.qr), transfer: toInt(vals.transfer) });
            onClose();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[170] flex items-center justify-center px-4"
            style={{ background: 'rgba(8,18,20,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">

                {/* Шапка: кто и сколько должен */}
                <div className="px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black text-white flex-shrink-0"
                            style={{ background: 'linear-gradient(140deg,#e88c40,#c86a20)' }}>
                            {(guest.fullName || '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-black text-slate-800 truncate">{guest.fullName}</div>
                            <div className="text-[11px] text-slate-400">Комната {guest.roomNumber || '—'}{guest.bedId ? `, место ${guest.bedId}` : ''}</div>
                        </div>
                        <button onClick={onClose} disabled={busy} aria-label="Закрыть"
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                    {/* Сводка счёта */}
                    <div className="grid grid-cols-3 gap-2 mt-3">
                        <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-center">
                            <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Итого</div>
                            <div className="text-[13px] font-black text-slate-700 tabular-nums">{fmtMoney(priceTotal)}</div>
                        </div>
                        <div className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-center">
                            <div className="text-[9px] font-black uppercase tracking-wider text-emerald-500">Оплачено</div>
                            <div className="text-[13px] font-black text-emerald-600 tabular-nums">{fmtMoney(paid)}</div>
                        </div>
                        <div className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-center">
                            <div className="text-[9px] font-black uppercase tracking-wider text-rose-400">Долг</div>
                            <div className="text-[13px] font-black text-rose-500 tabular-nums">{fmtMoney(debt)}</div>
                        </div>
                    </div>
                </div>

                <div className="px-5 py-4">
                    {/* Быстрые суммы */}
                    {debt > 0 && (
                        <div className="flex gap-2 mb-3">
                            <button onClick={() => fillAll('cash')}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors">
                                <Zap size={12} /> Весь долг налом
                            </button>
                            <button onClick={() => fillAll('card')}
                                className="flex-1 py-2 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors">
                                Весь — картой
                            </button>
                            <button onClick={halfCash}
                                className="py-2 px-3 rounded-xl text-xs font-bold text-slate-500 bg-white hover:bg-slate-50 border border-slate-200 transition-colors">
                                ½
                            </button>
                        </div>
                    )}

                    {/* Методы */}
                    <div className="grid grid-cols-2 gap-2.5">
                        {METHODS.map(({ key, label, icon: Icon, cls, bg }) => (
                            <label key={key} className={`block rounded-xl border p-2.5 transition-colors ${
                                toInt(vals[key]) > 0 ? 'border-orange-300 bg-orange-50/40' : 'border-slate-200 bg-white'}`}>
                                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                    <span className={`w-5 h-5 rounded-md flex items-center justify-center ${bg}`}><Icon size={11} className={cls} /></span>
                                    {label}
                                </span>
                                <input inputMode="numeric" value={vals[key]}
                                    onChange={e => setMethod(key, e.target.value)}
                                    placeholder="0"
                                    className="w-full text-[15px] font-black tabular-nums text-slate-800 bg-transparent outline-none" />
                            </label>
                        ))}
                    </div>

                    {/* Живой расчёт */}
                    <div className="mt-3.5 rounded-xl px-3.5 py-2.5 text-[12px] font-semibold flex items-center justify-between"
                        style={{ background: total === 0 ? '#f8fafc' : overpay > 0 ? '#fffbeb' : restDebt === 0 ? '#ecfdf5' : '#fff7ed' }}>
                        <span className="text-slate-500">
                            {total === 0 ? 'Введите сумму или нажмите быструю кнопку'
                                : overpay > 0 ? <>Переплата <b className="text-amber-600">{fmtMoney(overpay)}</b> — уйдёт на бонусный баланс</>
                                : restDebt === 0 ? <b className="text-emerald-600">Долг будет закрыт полностью ✓</b>
                                : <>Останется долг <b className="text-rose-500">{fmtMoney(restDebt)}</b></>}
                        </span>
                        <span className="text-[15px] font-black tabular-nums text-slate-800 pl-3">{fmtMoney(total)}</span>
                    </div>
                </div>

                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex gap-2">
                    <button onClick={onClose} disabled={busy}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 border border-slate-200 bg-white hover:bg-slate-100 transition-colors">
                        Отмена
                    </button>
                    <button onClick={submit} disabled={total <= 0 || busy}
                        className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 transition-colors">
                        {busy ? 'Записываю…' : total > 0 ? `Принять ${fmtMoney(total)} сум` : 'Принять оплату'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PayDebtModal;
