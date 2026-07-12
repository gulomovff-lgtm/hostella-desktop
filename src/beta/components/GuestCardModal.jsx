import React, { useMemo } from 'react';
import {
    X, BedDouble, Phone, ExternalLink, ClipboardCheck, Globe,
    DollarSign, CreditCard, QrCode, ArrowRightLeft, Coins, CalendarDays,
} from 'lucide-react';

const getTotalPaid = (g) => (typeof g.amountPaid === 'number'
    ? g.amountPaid
    : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0) + (g.paidTransfer || 0)));

const fmtMoney = (n) => (n || 0).toLocaleString('ru-RU');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) : '—');
const fmtDT = (d) => (d ? new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

const noon = (d) => {
    if (!d) return null;
    const x = new Date(d);
    if (typeof d === 'string' && !d.includes('T')) x.setHours(12, 0, 0, 0);
    return x;
};

const STATUS = {
    active: { label: 'Живёт', cls: 'bg-emerald-50 text-emerald-600' },
    booking: { label: 'Бронь', cls: 'bg-amber-50 text-amber-600' },
    checked_out: { label: 'Выехал', cls: 'bg-slate-100 text-slate-500' },
};

const METHOD_META = [
    { key: 'paidCash', pkey: 'cash', label: 'Наличные', icon: DollarSign, cls: 'text-emerald-600' },
    { key: 'paidCard', pkey: 'card', label: 'Карта', icon: CreditCard, cls: 'text-indigo-600' },
    { key: 'paidQR', pkey: 'qr', label: 'QR', icon: QrCode, cls: 'text-purple-600' },
    { key: 'paidTransfer', pkey: 'transfer', label: 'Перечисл.', icon: ArrowRightLeft, cls: 'text-sky-600' },
    { key: 'paidBalance', pkey: 'balance', label: 'Бонусы', icon: Coins, cls: 'text-amber-600' },
];

const GuestCardModal = ({ guest: g, rooms = [], payments = [], onClose, inMainApp, onPayDebt, onExtend, onCheckOut }) => {
    const now = new Date();
    const room = rooms.find(r => r.id === g.roomId);
    const paid = getTotalPaid(g);
    const total = g.totalPrice || 0;
    const debt = g.status !== 'booking' ? Math.max(0, total - paid) : 0;
    const overpaid = Math.max(0, paid - total);
    const st = STATUS[g.status] || STATUS.checked_out;

    // Проживание: сколько прожито / осталось
    const stay = useMemo(() => {
        const ci = noon(g.checkInDate);
        const co = noon(g.checkOutDate);
        if (!ci || !co) return null;
        const nights = Math.max(1, Math.round((co - ci) / 86400000));
        const passed = Math.min(nights, Math.max(0, Math.floor((now - ci) / 86400000)));
        const leftMs = co - now;
        const expired = g.status === 'active' && leftMs < 0;
        const leftNights = Math.ceil(leftMs / 86400000);
        return { nights, passed, expired, leftNights, pct: Math.min(100, Math.round((passed / nights) * 100)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [g.checkInDate, g.checkOutDate, g.status]);

    const guestPayments = useMemo(() =>
        payments
            .filter(p => p.guestId === g.id)
            .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [payments, g.id]);

    const methods = METHOD_META
        .map(m => ({ ...m, sum: g[m.key] || 0 }))
        .filter(m => m.sum > 0);

    const payPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center px-4"
            style={{ background: 'rgba(8,18,20,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 max-h-[92vh] flex flex-col">

                {/* Шапка */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-shrink-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-black text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(140deg,#e88c40,#c86a20)' }}>
                        {(g.fullName || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[15px] font-black text-slate-800 truncate">{g.fullName}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                            {g.country && <span className="inline-flex items-center gap-1"><Globe size={10} />{g.country}</span>}
                            {g.passport && <span>· {g.passport}</span>}
                            {g.phone && <span className="inline-flex items-center gap-1">· <Phone size={10} />{g.phone}</span>}
                        </div>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full flex-shrink-0 ${st.cls}`}>{st.label}</span>
                    <button onClick={onClose} aria-label="Закрыть" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors flex-shrink-0">
                        <X size={16} />
                    </button>
                </div>

                <div className="overflow-y-auto px-5 py-4 flex flex-col gap-4">

                    {/* Где живёт + сколько осталось */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-200 p-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1"><BedDouble size={11} /> Место</div>
                            <div className="text-[14px] font-black text-slate-800">
                                {g.roomNumber || room?.number ? `Комната ${g.roomNumber || room?.number} · место ${g.bedId ?? '—'}` : 'не назначено'}
                            </div>
                            {room?.price && <div className="text-[11px] text-slate-400 mt-0.5">{fmtMoney(parseInt(room.price))} сум/ночь</div>}
                        </div>
                        <div className="rounded-xl border border-slate-200 p-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1"><CalendarDays size={11} /> Проживание</div>
                            <div className="text-[14px] font-black text-slate-800 tabular-nums">{fmtDate(g.checkInDate)} → {fmtDate(g.checkOutDate)}</div>
                            {stay && (
                                <div className={`text-[11px] mt-0.5 font-semibold ${stay.expired ? 'text-amber-600' : 'text-slate-400'}`}>
                                    {g.status === 'active'
                                        ? stay.expired
                                            ? 'расчётное время прошло!'
                                            : stay.leftNights <= 0 ? 'выезд сегодня' : `осталось ${stay.leftNights} ${stay.leftNights === 1 ? 'ночь' : stay.leftNights < 5 ? 'ночи' : 'ночей'}`
                                        : `${stay.nights} ноч.`}
                                </div>
                            )}
                            {stay && g.status === 'active' && (
                                <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                    <div className={`h-full rounded-full ${stay.expired ? 'bg-amber-400' : 'bg-teal-400'}`} style={{ width: `${stay.pct}%` }} />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Оплата: прогресс + разбивка */}
                    <div className="rounded-xl border border-slate-200 p-3.5">
                        <div className="flex items-baseline justify-between mb-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Оплата</span>
                            <span className="text-[13px] font-black tabular-nums text-slate-800">
                                {fmtMoney(paid)} <span className="text-slate-300 font-bold">/ {fmtMoney(total)}</span>
                            </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-2">
                            <div className={`h-full rounded-full transition-all duration-300 ${debt > 0 ? 'bg-rose-400' : 'bg-emerald-400'}`}
                                style={{ width: `${payPct}%` }} />
                        </div>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex gap-3 flex-wrap">
                                {methods.length === 0 && <span className="text-[11px] text-slate-400">оплат пока нет</span>}
                                {methods.map(m => (
                                    <span key={m.key} className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500">
                                        <m.icon size={11} className={m.cls} /> {fmtMoney(m.sum)}
                                    </span>
                                ))}
                            </div>
                            {debt > 0 && <span className="text-[11px] font-black text-rose-500">долг {fmtMoney(debt)}</span>}
                            {overpaid > 0 && <span className="text-[11px] font-black text-amber-600">переплата {fmtMoney(overpaid)}</span>}
                            {debt === 0 && overpaid === 0 && total > 0 && <span className="text-[11px] font-black text-emerald-600">оплачено полностью ✓</span>}
                        </div>
                    </div>

                    {/* E-mehmon */}
                    <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3.5 py-2.5">
                        <ClipboardCheck size={14} className="text-slate-400 flex-shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 w-20 flex-shrink-0">E-mehmon</span>
                        <span className="text-[12.5px] font-semibold text-slate-600 min-w-0">
                            {g.emehmonReg
                                ? (g.status === 'checked_out' && !g.emehmonOut
                                    ? <span className="text-amber-600">зарегистрирован — нужно вывести</span>
                                    : <span className="text-emerald-600">зарегистрирован ✓</span>)
                                : g.emehmonSkip ? 'не требуется'
                                : <span className="text-amber-600">не отправлен</span>}
                        </span>
                        {g.emehmonRegError && <span className="text-[10.5px] text-rose-500 truncate">{g.emehmonRegError}</span>}
                    </div>

                    {/* История платежей — вся */}
                    {guestPayments.length > 0 && (
                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <div className="px-3.5 py-2 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/60">
                                Платежи · {guestPayments.length}
                            </div>
                            <div className="max-h-36 overflow-y-auto">
                                {guestPayments.map(p => (
                                    <div key={p.id} className="flex items-center gap-2 px-3.5 py-1.5 border-b border-slate-50 last:border-b-0">
                                        <span className="text-[11px] text-slate-400 tabular-nums w-24 flex-shrink-0">{fmtDT(p.date)}</span>
                                        <span className="flex-1 text-[11px] text-slate-400 truncate">
                                            {[+p.cash > 0 && 'нал', +p.card > 0 && 'карта', +p.qr > 0 && 'QR', +p.transfer > 0 && 'перечисл.', +p.balance > 0 && 'бонус']
                                                .filter(Boolean).join(' + ') || p.method || ''}
                                        </span>
                                        <span className="text-[12px] font-black text-emerald-600 tabular-nums">+{fmtMoney(parseInt(p.amount) || 0)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Действия */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex flex-col gap-2 flex-shrink-0">
                    {debt > 0 && onPayDebt && (
                        <button onClick={() => onPayDebt(g)}
                            className="w-full py-2.5 rounded-xl text-xs font-black text-white bg-orange-500 hover:bg-orange-600 transition-colors">
                            Принять оплату · {fmtMoney(debt)}
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        {g.status === 'active' && onExtend && (
                            <button onClick={() => onExtend(g)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-indigo-500 hover:bg-indigo-600 transition-colors">
                                Продлить
                            </button>
                        )}
                        {g.status === 'active' && onCheckOut && (
                            <button onClick={() => onCheckOut(g)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-rose-500 border border-rose-200 bg-white hover:bg-rose-50 transition-colors">
                                Выселить
                            </button>
                        )}
                        <button onClick={() => inMainApp('Переселение, разделение и правка полей гостя')}
                            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-500 border border-slate-200 bg-white hover:border-slate-300 transition-colors"
                            title="Переселение и другие действия — в основном приложении">
                            <ExternalLink size={12} /> Ещё
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GuestCardModal;
