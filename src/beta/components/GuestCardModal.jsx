import React, { useMemo } from 'react';
import { X, User, BedDouble, Calendar, Wallet, ClipboardCheck, Phone, ExternalLink } from 'lucide-react';

const getTotalPaid = (g) => (typeof g.amountPaid === 'number'
    ? g.amountPaid
    : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0) + (g.paidTransfer || 0)));

const fmtMoney = (n) => (n || 0).toLocaleString('ru-RU');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' }) : '—');

const STATUS = {
    active: { label: 'Живёт', cls: 'bg-emerald-50 text-emerald-600' },
    booking: { label: 'Бронь', cls: 'bg-amber-50 text-amber-600' },
    checked_out: { label: 'Выехал', cls: 'bg-slate-100 text-slate-500' },
};

const Row = ({ icon: Icon, label, children }) => (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-b-0">
        <Icon size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
        <span className="w-28 text-[11px] font-black uppercase tracking-wider text-slate-400 pt-0.5 flex-shrink-0">{label}</span>
        <span className="flex-1 text-[13.5px] text-slate-700 min-w-0">{children}</span>
    </div>
);

const GuestCardModal = ({ guest: g, rooms = [], payments = [], onClose, inMainApp, onPayDebt }) => {
    const room = rooms.find(r => r.id === g.roomId);
    const paid = getTotalPaid(g);
    const debt = g.status !== 'booking' ? Math.max(0, (g.totalPrice || 0) - paid) : 0;
    const st = STATUS[g.status] || STATUS.checked_out;

    const guestPayments = useMemo(() =>
        payments
            .filter(p => p.guestId === g.id)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5),
    [payments, g.id]);

    return (
        <div className="fixed inset-0 z-[160] flex items-center justify-center px-4"
            style={{ background: 'rgba(8,18,20,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                    <div className="w-9 h-9 rounded-full bg-orange-500 text-white font-black flex items-center justify-center flex-shrink-0">
                        {(g.fullName || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-black text-slate-800 truncate">{g.fullName}</div>
                        <div className="text-[11px] text-slate-400">{[g.country, g.passport].filter(Boolean).join(' · ') || '—'}</div>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full flex-shrink-0 ${st.cls}`}>{st.label}</span>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="px-5 py-2">
                    <Row icon={BedDouble} label="Место">
                        {g.roomNumber || room?.number ? `Комната ${g.roomNumber || room?.number}, место ${g.bedId ?? '—'}` : 'не назначено'}
                    </Row>
                    <Row icon={Calendar} label="Проживание">
                        {fmtDate(g.checkInDate)} → {fmtDate(g.checkOutDate)}{g.days ? ` · ${g.days} ноч.` : ''}
                    </Row>
                    <Row icon={Wallet} label="Оплата">
                        {fmtMoney(paid)} из {fmtMoney(g.totalPrice)}
                        {debt > 0 && <span className="ml-2 text-[11px] font-black text-rose-500">долг {fmtMoney(debt)}</span>}
                    </Row>
                    <Row icon={ClipboardCheck} label="E-mehmon">
                        {g.emehmonReg
                            ? (g.status === 'checked_out' && !g.emehmonOut ? 'зарегистрирован — нужно вывести' : 'зарегистрирован ✓')
                            : g.emehmonSkip ? 'не требуется' : 'не отправлен'}
                        {g.emehmonRegError && <span className="block text-[11px] text-rose-500">{g.emehmonRegError}</span>}
                    </Row>
                    {g.phone && <Row icon={Phone} label="Телефон">{g.phone}</Row>}
                    {guestPayments.length > 0 && (
                        <Row icon={User} label="Платежи">
                            {guestPayments.map(p => (
                                <span key={p.id} className="block text-[12px] tabular-nums">
                                    {new Date(p.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })} · +{fmtMoney(parseInt(p.amount) || 0)}
                                </span>
                            ))}
                        </Row>
                    )}
                </div>

                <div className="px-5 py-3.5 bg-slate-50 flex items-center gap-2">
                    <span className="flex-1 text-[11px] text-slate-400">Оплата — здесь; остальное пока в основном.</span>
                    {debt > 0 && onPayDebt && (
                        <button onClick={() => onPayDebt(g)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors">
                            Принять оплату
                        </button>
                    )}
                    <button onClick={() => inMainApp('Редактирование гостя')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 border border-slate-200 bg-white hover:border-slate-300 transition-colors">
                        <ExternalLink size={12} /> Ещё
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GuestCardModal;
