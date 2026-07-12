import React, { useState, useMemo } from 'react';
import { X, Lock, Copy, Power, DollarSign, CreditCard, QrCode, ArrowRightLeft, RotateCcw, AlertTriangle } from 'lucide-react';
import { computeShiftReport, buildShiftTelegramMsg, buildShiftReportText } from '../../utils/shiftReport';

/**
 * Закрытие смены в стиле беты. Расчёт, Telegram-отчёт и текст копии —
 * из utils/shiftReport (общие с основным приложением, один источник правды).
 */
const fmtMoney = (n) => (n || 0).toLocaleString('ru-RU');

const Row = ({ icon: Icon, cls, label, value, negative }) => (
    <div className="flex items-center gap-2.5 px-3.5 py-2 border-b border-slate-50 last:border-b-0">
        <span className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${cls}`}><Icon size={12} /></span>
        <span className="flex-1 text-[12.5px] font-semibold text-slate-600">{label}</span>
        <span className={`text-[13.5px] font-black tabular-nums ${negative ? 'text-rose-500' : 'text-slate-800'}`}>
            {negative ? '−' : ''}{fmtMoney(value)}
        </span>
    </div>
);

const ShiftCloseBeta = ({ user, payments = [], expenses = [], onClose, onEndShift, notify, sendTelegramMessage }) => {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);

    const r = useMemo(() => computeShiftReport(user, payments, expenses), [user, payments, expenses]);
    const transferEntries = Object.entries(r.income.transferByEntity || {});
    const otherExpenses = r.cashboxExpenses - r.totalRefunds;

    const copyReport = async () => {
        const text = buildShiftReportText(user, r);
        try {
            await navigator.clipboard.writeText(text);
            notify?.('Отчёт скопирован', 'success');
        } catch {
            notify?.('Не удалось скопировать', 'error');
        }
    };

    const closeShift = async () => {
        if (busy) return;
        setBusy(true);
        try {
            sendTelegramMessage(buildShiftTelegramMsg(user, r), 'shiftEnd');
            await onEndShift();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[170] flex items-center justify-center px-4"
            style={{ background: 'rgba(8,18,20,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 max-h-[92vh] flex flex-col">

                {/* Шапка: кассир + «в кассе» крупно */}
                <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg, var(--nav-bg) 0%, #14494f 100%)' }}>
                    <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(94,234,212,0.12)', border: '1px solid rgba(94,234,212,0.25)' }}>
                            <Lock size={16} color="#5eead4" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-black text-white truncate">Закрытие смены · {user.name}</div>
                            <div className="text-[11px]" style={{ color: 'rgba(158,205,208,0.6)' }}>
                                {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                            </div>
                        </div>
                        <button onClick={onClose} disabled={busy} aria-label="Закрыть"
                            className="p-1.5 rounded-lg transition-colors hover:bg-white/10" style={{ color: '#9ecdd0' }}>
                            <X size={16} />
                        </button>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between rounded-xl px-3.5 py-2.5"
                        style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.2)' }}>
                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(94,234,212,0.7)' }}>В кассе</span>
                        <span className="text-2xl font-black tabular-nums" style={{ color: '#5eead4' }}>{fmtMoney(r.cashInHand)}</span>
                    </div>
                </div>

                {/* Сверка */}
                <div className="overflow-y-auto">
                    <div className="px-3.5 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Поступления за смену</div>
                    <Row icon={DollarSign} cls="bg-emerald-50 text-emerald-600" label="Наличные" value={r.income.cash} />
                    <Row icon={CreditCard} cls="bg-indigo-50 text-indigo-600" label="Терминал" value={r.income.card} />
                    <Row icon={QrCode} cls="bg-purple-50 text-purple-600" label="QR / Click" value={r.income.qr} />
                    {transferEntries.length > 0
                        ? transferEntries.map(([entity, amt]) => (
                            <Row key={entity} icon={ArrowRightLeft} cls="bg-sky-50 text-sky-600" label={entity} value={amt} />
                        ))
                        : r.income.transfer > 0 && <Row icon={ArrowRightLeft} cls="bg-sky-50 text-sky-600" label="Перечисление" value={r.income.transfer} />}
                    {(r.totalRefunds > 0 || otherExpenses > 0) && (
                        <div className="px-3.5 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Вычеты</div>
                    )}
                    {r.totalRefunds > 0 && <Row icon={RotateCcw} cls="bg-amber-50 text-amber-600" label="Возвраты" value={r.totalRefunds} negative />}
                    {otherExpenses > 0 && <Row icon={Power} cls="bg-rose-50 text-rose-600" label="Расходы" value={otherExpenses} negative />}
                    <div className="mx-3.5 my-3 rounded-xl bg-emerald-50 border border-emerald-100 px-3.5 py-2.5 flex items-baseline justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Итого поступлений</span>
                        <span className="text-lg font-black tabular-nums text-slate-800">{fmtMoney(r.totalRevenue)}</span>
                    </div>
                </div>

                {/* Действия / подтверждение */}
                {confirming ? (
                    <div className="px-5 py-4 bg-amber-50 border-t border-amber-100 flex-shrink-0">
                        <div className="flex items-start gap-2.5 mb-3">
                            <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                            <div className="text-[12.5px] text-amber-800">
                                <b>Подтвердите закрытие.</b> В кассе остаётся <b className="text-emerald-700">{fmtMoney(r.cashInHand)}</b> сум.
                                Вы выйдете из системы на всех устройствах.
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirming(false)} disabled={busy}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                                Отмена
                            </button>
                            <button onClick={closeShift} disabled={busy}
                                className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                                <Power size={13} /> {busy ? 'Закрываю…' : 'Да, закрыть смену'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex gap-2 flex-shrink-0">
                        <button onClick={copyReport}
                            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-500 border border-slate-200 bg-white hover:bg-slate-100 transition-colors">
                            <Copy size={13} /> Отчёт
                        </button>
                        <button onClick={onClose}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 border border-slate-200 bg-white hover:bg-slate-100 transition-colors">
                            Отмена
                        </button>
                        <button onClick={() => setConfirming(true)}
                            className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-teal-500 hover:bg-teal-600 transition-colors flex items-center justify-center gap-2">
                            <Power size={13} /> Закрыть смену
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ShiftCloseBeta;
