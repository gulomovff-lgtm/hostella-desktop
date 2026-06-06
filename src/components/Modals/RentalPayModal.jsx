import React, { useState } from 'react';
import { X, DollarSign, CreditCard, QrCode, Magnet, CheckCircle2, Wallet } from 'lucide-react';

/**
 * RentalPayModal — приём оплаты по долгу аренды (наличные/карта/QR).
 * Используется из «Номеров» и календаря. Списывает остаток долга, пишет в кассу.
 */
const RentalPayModal = ({ room, onClose, onSubmit }) => {
    const r = room?.rental || {};
    const paid = (r.paidCash || 0) + (r.paidCard || 0) + (r.paidQR || 0) + (r.paidTransfer || 0);
    const debt = Math.max(0, (r.totalAmount || 0) - paid);

    const [cash, setCash] = useState('');
    const [card, setCard] = useState('');
    const [qr,   setQR  ] = useState('');
    const [busy, setBusy] = useState(false);

    const total = (parseInt(cash) || 0) + (parseInt(card) || 0) + (parseInt(qr) || 0);

    const magnet = (field) => {
        const others = (field !== 'cash' ? (parseInt(cash) || 0) : 0)
                     + (field !== 'card' ? (parseInt(card) || 0) : 0)
                     + (field !== 'qr'   ? (parseInt(qr)   || 0) : 0);
        const rem = Math.max(0, debt - others);
        if (field === 'cash') setCash(String(rem));
        if (field === 'card') setCard(String(rem));
        if (field === 'qr')   setQR(String(rem));
    };

    const submit = async () => {
        if (total <= 0 || busy) return;
        setBusy(true);
        try {
            await onSubmit?.(room, { cash: parseInt(cash) || 0, card: parseInt(card) || 0, qr: parseInt(qr) || 0 });
            onClose?.();
        } catch (e) {
            setBusy(false);
        }
    };

    const Row = ({ icon: Icon, label, value, onChange, field, accent }) => (
        <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>
                <Icon size={13} className="text-white" />
            </div>
            <span className="w-12 shrink-0 text-[11px] font-bold text-slate-500">{label}</span>
            <div className="relative flex-1">
                <input type="number" value={value} onChange={e => onChange(e.target.value)} onWheel={e => e.target.blur()}
                    placeholder="0"
                    className="w-full pr-9 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 text-right outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition no-spinner" />
                <button onClick={() => magnet(field)} title="Заполнить остаток"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-teal-500 transition-colors"><Magnet size={13} /></button>
            </div>
            {parseInt(value) > 0 && <span className="text-[11px] font-black text-teal-600 w-5 shrink-0">✓</span>}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pb-[84px] sm:pb-4" onClick={e => e.target === e.currentTarget && onClose?.()}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#0f9688,#0d7a6e)' }}>
                    <div className="min-w-0">
                        <h3 className="font-black text-white text-sm leading-tight flex items-center gap-1.5"><Wallet size={15} /> Оплата аренды</h3>
                        <p className="text-white/80 text-xs mt-0.5 truncate">{r.tenantName || 'Аренда'} · комната №{room?.number}</p>
                    </div>
                    <button onClick={onClose} className="shrink-0 w-7 h-7 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full text-white"><X size={15} /></button>
                </div>

                <div className="px-5 pt-4 pb-2 space-y-3">
                    <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-xl text-center">
                        <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Остаток долга</div>
                        <div className="text-2xl font-black text-rose-600 font-mono">{debt.toLocaleString()}</div>
                    </div>
                    <Row icon={DollarSign} label="Нал."  value={cash} onChange={setCash} field="cash" accent="bg-emerald-500" />
                    <Row icon={CreditCard} label="Карта" value={card} onChange={setCard} field="card" accent="bg-blue-500" />
                    <Row icon={QrCode}     label="QR"    value={qr}   onChange={setQR}   field="qr"   accent="bg-violet-500" />
                    <div className="flex justify-between items-center px-1 pt-1">
                        <span className="text-slate-500 font-medium text-sm">Итого к оплате</span>
                        <span className={`font-black font-mono text-base ${total > debt ? 'text-amber-600' : 'text-slate-800'}`}>{total.toLocaleString()}</span>
                    </div>
                </div>

                <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
                    <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 text-sm font-bold transition-colors">Отмена</button>
                    <button onClick={submit} disabled={total <= 0 || busy}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-black transition-all active:scale-98 disabled:opacity-40"
                        style={{ background: total > 0 && !busy ? 'linear-gradient(135deg,#0f9688,#0d7a6e)' : '#94a3b8' }}>
                        <CheckCircle2 size={16} /> {busy ? 'Сохранение…' : 'Принять оплату'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RentalPayModal;
