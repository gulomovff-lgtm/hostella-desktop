import React, { useState, useMemo } from 'react';
import { X, DollarSign, CreditCard, QrCode, ArrowRightLeft, Zap } from 'lucide-react';

const fmtMoney = (n) => (n || 0).toLocaleString('ru-RU');
const toInt = (v) => {
    const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
};

const METHODS = [
    { key: 'cash', label: 'Наличные', icon: DollarSign },
    { key: 'card', label: 'Карта', icon: CreditCard },
    { key: 'qr', label: 'QR / Click', icon: QrCode },
    { key: 'transfer', label: 'Перечисление', icon: ArrowRightLeft },
];

const PayDebtModal = ({ guest, debt = 0, onSubmit, onClose }) => {
    const [vals, setVals] = useState({ cash: '', card: '', qr: '', transfer: '' });
    const [busy, setBusy] = useState(false);

    const amounts = useMemo(() => ({
        cash: toInt(vals.cash), card: toInt(vals.card), qr: toInt(vals.qr), transfer: toInt(vals.transfer),
    }), [vals]);
    const total = amounts.cash + amounts.card + amounts.qr + amounts.transfer;
    const overpay = Math.max(0, total - debt);

    const submit = async () => {
        if (total <= 0 || busy) return;
        setBusy(true);
        try {
            await onSubmit(amounts);
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
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-black text-slate-800 truncate">Оплата · {guest.fullName}</div>
                        <div className="text-[11px] text-slate-400">
                            Комната {guest.roomNumber || '—'}{debt > 0 ? <> · долг <b className="text-rose-500">{fmtMoney(debt)}</b></> : ' · долга нет'}
                        </div>
                    </div>
                    <button onClick={onClose} disabled={busy} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="px-5 py-4">
                    {debt > 0 && (
                        <button onClick={() => setVals({ cash: String(debt), card: '', qr: '', transfer: '' })}
                            className="w-full mb-3 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors">
                            <Zap size={13} /> Весь долг наличными · {fmtMoney(debt)}
                        </button>
                    )}
                    <div className="grid grid-cols-2 gap-2.5">
                        {METHODS.map(({ key, label, icon: Icon }) => (
                            <label key={key} className="block">
                                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                                    <Icon size={11} /> {label}
                                </span>
                                <input inputMode="numeric" value={vals[key]}
                                    onChange={e => setVals(v => ({ ...v, [key]: e.target.value }))}
                                    placeholder="0"
                                    className="w-full px-3 py-2 rounded-xl text-sm font-bold tabular-nums text-slate-800 bg-slate-50 border border-slate-200 outline-none focus:border-orange-300 transition-colors" />
                            </label>
                        ))}
                    </div>
                    <div className="flex items-baseline justify-between mt-4 px-1">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Итого</span>
                        <span className="text-lg font-black tabular-nums text-slate-800">{fmtMoney(total)} <span className="text-[11px] text-slate-400">UZS</span></span>
                    </div>
                    {overpay > 0 && (
                        <div className="mt-1.5 text-[11px] text-amber-600 font-semibold px-1">
                            Переплата {fmtMoney(overpay)} — уйдёт на бонусный баланс клиента (как в основном приложении).
                        </div>
                    )}
                </div>

                <div className="px-5 py-3.5 bg-slate-50 flex gap-2">
                    <button onClick={onClose} disabled={busy}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 border border-slate-200 hover:bg-white transition-colors">
                        Отмена
                    </button>
                    <button onClick={submit} disabled={total <= 0 || busy}
                        className="flex-1 py-2 rounded-xl text-xs font-black text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 transition-colors">
                        {busy ? 'Записываю…' : `Принять ${total > 0 ? fmtMoney(total) + ' сум' : 'оплату'}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PayDebtModal;
