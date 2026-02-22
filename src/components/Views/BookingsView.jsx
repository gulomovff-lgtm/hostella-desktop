import React, { useState } from 'react';
import {
    Globe, Phone, User, CalendarDays, BedDouble, Clock,
    CheckCircle2, XCircle, Building2, ChevronRight, Inbox,
} from 'lucide-react';

const HOSTELS = {
    hostel1: 'Хостел №1',
    hostel2: 'Хостел №2',
};

const FORMAT_DATE = (iso) => {
    if (!iso) return '—';
    try {
        const d = typeof iso === 'object' && iso?.seconds
            ? new Date(iso.seconds * 1000)
            : new Date(iso);
        return d.toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return iso; }
};

const BookingCard = ({ booking, onAccept, onReject }) => {
    const [confirming, setConfirming] = useState(false);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
            {/* Header stripe */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-[#1a3c40]/5 to-[#e88c40]/5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#e88c40] uppercase tracking-wide bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
                        <Globe size={10} />
                        С сайта
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                        {HOSTELS[booking.hostelId] || booking.hostelId}
                    </span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                    {booking.createdAt
                        ? FORMAT_DATE(booking.createdAt)
                        : '—'}
                </span>
            </div>

            {/* Body */}
            <div className="p-4 grid grid-cols-2 gap-3">
                <div className="col-span-2">
                    <div className="flex items-center gap-2 mb-0.5">
                        <User size={14} className="text-slate-400 flex-shrink-0" />
                        <span className="font-black text-slate-800 text-base">{booking.fullName || '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Phone size={13} className="text-slate-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-600">{booking.phone || '—'}</span>
                    </div>
                </div>

                <div className="flex items-start gap-2">
                    <CalendarDays size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Заезд</div>
                        <div className="text-sm font-bold text-slate-700">{FORMAT_DATE(booking.checkInDate)}</div>
                    </div>
                </div>

                <div className="flex items-start gap-2">
                    <Clock size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Дней</div>
                        <div className="text-sm font-bold text-slate-700">{booking.days || '—'}</div>
                    </div>
                </div>

                {booking.country && (
                    <div className="col-span-2 flex items-center gap-2">
                        <Globe size={13} className="text-slate-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-600">{booking.country}</span>
                    </div>
                )}
            </div>

            {/* Actions */}
            {!confirming ? (
                <div className="px-4 pb-4 flex gap-2">
                    <button
                        onClick={() => onAccept(booking)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl
                                   bg-[#1a3c40] hover:bg-[#2a5c60] text-white text-sm font-black
                                   transition-all active:scale-[0.98]"
                    >
                        <BedDouble size={14} strokeWidth={2.5} />
                        Заселить
                        <ChevronRight size={13} strokeWidth={3} />
                    </button>
                    <button
                        onClick={() => setConfirming(true)}
                        className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl
                                   bg-rose-50 hover:bg-rose-100 text-rose-500 text-sm font-bold
                                   border border-rose-200 transition-all active:scale-[0.98]"
                    >
                        <XCircle size={14} />
                        Отклонить
                    </button>
                </div>
            ) : (
                <div className="px-4 pb-4">
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-2 text-sm text-rose-700 font-medium text-center">
                        Удалить бронирование?
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onReject(booking)}
                            className="flex-1 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-black transition-all"
                        >
                            Да, удалить
                        </button>
                        <button
                            onClick={() => setConfirming(false)}
                            className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold transition-all"
                        >
                            Отмена
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const BookingsView = ({ bookings, onAccept, onReject }) => {
    const pending = bookings.filter(b => b.status === 'booking' && b.source === 'website');

    if (!pending.length) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                    <Inbox size={28} className="text-slate-400" />
                </div>
                <div className="text-slate-500 font-bold text-base">Новых бронирований нет</div>
                <div className="text-slate-400 text-sm text-center max-w-xs">
                    Когда гости оставят заявку на сайте, они появятся здесь
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-3 mb-4">
                <div>
                    <h2 className="font-black text-slate-800 text-lg">Заявки с сайта</h2>
                    <p className="text-sm text-slate-400 font-medium">
                        {pending.length} {pending.length === 1 ? 'новая заявка' : pending.length < 5 ? 'новых заявки' : 'новых заявок'}
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {pending.map(b => (
                    <BookingCard
                        key={b.id}
                        booking={b}
                        onAccept={onAccept}
                        onReject={onReject}
                    />
                ))}
            </div>
        </div>
    );
};

export default BookingsView;
