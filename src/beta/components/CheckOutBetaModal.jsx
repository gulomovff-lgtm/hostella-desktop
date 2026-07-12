import React, { useState } from 'react';
import { X, LogOut, Coins, Banknote, AlertTriangle } from 'lucide-react';

/**
 * Выселение в стиле беты. Запись — через РОДНОЙ handleCheckOut:
 * дата выезда, возвраты (нал/на бонусный баланс), Telegram, аудит — как в основном.
 */
const fmtMoney = (n) => (n || 0).toLocaleString('ru-RU');
const getTotalPaid = (g) => (typeof g.amountPaid === 'number'
    ? g.amountPaid
    : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0) + (g.paidTransfer || 0)));

const CheckOutBetaModal = ({ guest: g, onSubmit, onClose, onPayDebt }) => {
    const paid = getTotalPaid(g);
    const total = g.totalPrice || 0;
    const alreadySettled = Math.max(0, Number(g.refundSettledAmount || 0));
    const debt = Math.max(0, total - paid);
    const overpay = Math.max(0, paid - total - alreadySettled);

    // Способ обращения с переплатой: 'balance' | 'cash' | 'keep'
    const [refundMode, setRefundMode] = useState('balance');
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (busy) return;
        setBusy(true);
        try {
            await onSubmit(g, {
                totalPrice: total,
                refundAmount: overpay > 0 && refundMode !== 'keep' ? overpay : 0,
                leaveOnBalance: refundMode === 'balance',
                mixBalanceAmount: 0,
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
                    <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center"><LogOut size={16} /></span>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-black text-slate-800 truncate">Выселение · {g.fullName}</div>
                        <div className="text-[11px] text-slate-400">Комната {g.roomNumber || '—'}{g.bedId ? `, место ${g.bedId}` : ''}</div>
                    </div>
                    <button onClick={onClose} disabled={busy} aria-label="Закрыть" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="px-5 py-4 flex flex-col gap-3">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                            <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Итого</div>
                            <div className="text-[14px] font-black text-slate-700 tabular-nums">{fmtMoney(total)}</div>
                        </div>
                        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-center">
                            <div className="text-[9px] font-black uppercase tracking-wider text-emerald-500">Оплачено</div>
                            <div className="text-[14px] font-black text-emerald-600 tabular-nums">{fmtMoney(paid)}</div>
                        </div>
                    </div>

                    {debt > 0 && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3">
                            <div className="flex items-center gap-2 text-[12.5px] font-bold text-rose-600 mb-2">
                                <AlertTriangle size={14} /> Долг {fmtMoney(debt)} — примите оплату перед выездом.
                            </div>
                            {onPayDebt && (
                                <button onClick={() => { onClose(); onPayDebt(g); }}
                                    className="w-full py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[11.5px] font-black transition-colors">
                                    Принять оплату · {fmtMoney(debt)}
                                </button>
                            )}
                        </div>
                    )}

                    {overpay > 0 && (
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                                Переплата {fmtMoney(overpay)} — что с ней сделать?
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {[
                                    { id: 'balance', icon: Coins, label: 'На бонусный баланс клиента', sub: 'вернётся при следующем визите' },
                                    { id: 'cash', icon: Banknote, label: 'Вернуть наличными', sub: `запишется расход «Возврат» ${fmtMoney(overpay)}` },
                                    { id: 'keep', icon: X, label: 'Ничего не возвращать', sub: 'переплата останется как есть' },
                                ].map(({ id, icon: Icon, label, sub }) => (
                                    <button key={id} onClick={() => setRefundMode(id)}
                                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
                                            refundMode === id ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                        <Icon size={14} className={refundMode === id ? 'text-orange-500' : 'text-slate-400'} />
                                        <span className="min-w-0">
                                            <span className={`block text-[12px] font-bold ${refundMode === id ? 'text-orange-700' : 'text-slate-600'}`}>{label}</span>
                                            <span className="block text-[10.5px] text-slate-400">{sub}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {debt === 0 && overpay === 0 && (
                        <div className="text-[12.5px] font-semibold text-emerald-600">Расчёт закрыт полностью ✓ — можно выселять.</div>
                    )}
                    {g.emehmonReg && !g.emehmonOut && (
                        <div className="text-[11px] text-amber-600 font-semibold">
                            После выселения не забудьте вывести гостя из E-mehmon (раздел «Гости → E-mehmon»).
                        </div>
                    )}
                </div>

                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex gap-2">
                    <button onClick={onClose} disabled={busy}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 border border-slate-200 bg-white hover:bg-slate-100 transition-colors">
                        Отмена
                    </button>
                    <button onClick={submit} disabled={busy}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-black text-white disabled:opacity-40 transition-colors ${
                            debt > 0 ? 'bg-rose-500 hover:bg-rose-600' : 'bg-teal-500 hover:bg-teal-600'}`}>
                        {busy ? 'Выселяю…' : debt > 0 ? `Выселить с долгом ${fmtMoney(debt)}` : 'Выселить'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckOutBetaModal;
