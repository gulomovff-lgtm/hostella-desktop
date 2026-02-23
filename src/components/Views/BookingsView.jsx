import React, { useState, useEffect } from 'react';
import {
    Globe, Phone, User, CalendarDays, BedDouble, Clock,
    CheckCircle2, XCircle, Building2, ChevronRight, Inbox,
    RefreshCw, Users, Calendar,
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../../firebase';
import { parseIcal } from '../../utils/ical';

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

const BookingsView = ({ bookings, onAccept, onReject, currentUser, lang, rooms }) => {
    const [tab, setTab]           = useState('website');
    const [bcData, setBcData]     = useState([]);
    const [syncing, setSyncing]   = useState(false);
    const [syncMsg, setSyncMsg]   = useState('');
    const [lastSync, setLastSync] = useState(null);

    const hostelId = currentUser?.hostelId || 'hostel1';

    // Build reverse map: room.bookingName (lowercase) → room object
    const bookingNameToRoom = React.useMemo(() => {
        const map = {};
        if (!rooms) return map;
        rooms.forEach(room => {
            if (room.bookingName) map[room.bookingName.toLowerCase().trim()] = room;
        });
        return map;
    }, [rooms]);

    // ── Load stored data from Firestore ───────────────────────────────────────
    useEffect(() => {
        const docRef = doc(db, ...PUBLIC_DATA_PATH, 'bookingCom', hostelId);
        getDoc(docRef).then(snap => {
            if (snap.exists()) {
                const d = snap.data();
                setBcData(d.reservations || []);
                setLastSync(d.syncedAt || null);
            }
        });
    }, [hostelId]);

    // ── Sync from Booking.com iCal ────────────────────────────────────────────
    const handleSync = async () => {
        setSyncing(true);
        setSyncMsg('');
        try {
            // 1. Get iCal URL from Firestore settings
            const cfgRef  = doc(db, ...PUBLIC_DATA_PATH, 'settings', 'hostelConfig');
            const cfgSnap = await getDoc(cfgRef);
            if (!cfgSnap.exists()) throw new Error('Настройки не найдены. Сохраните настройки хостела.');
            const icalUrl = cfgSnap.data()?.[hostelId]?.icalUrl;
            if (!icalUrl) throw new Error('iCal URL не задан. Добавьте его в Настройках → хостел.');

            // 2. Fetch iCal text via Electron IPC (no CORS)
            if (!window.electronAPI?.fetchIcal) throw new Error('Функция доступна только в приложении Hostella.');
            const text = await window.electronAPI.fetchIcal(icalUrl);
            if (!text || !text.includes('BEGIN:VCALENDAR')) throw new Error('Неверный ответ от Booking.com. Проверьте URL.');

            // 3. Parse
            const reservations = parseIcal(text);

            // 4. Save to Firestore
            const now    = new Date().toISOString();
            const docRef = doc(db, ...PUBLIC_DATA_PATH, 'bookingCom', hostelId);
            await setDoc(docRef, { reservations, syncedAt: now });

            setBcData(reservations);
            setLastSync(now);
            setSyncMsg(`Синхронизировано: ${reservations.length} ${reservations.length === 1 ? 'бронь' : 'броней'}`);
        } catch (e) {
            setSyncMsg('Ошибка: ' + (e.message || e));
        } finally {
            setSyncing(false);
            setTimeout(() => setSyncMsg(''), 6000);
        }
    };

    const pending = bookings.filter(b => b.status === 'booking' && b.source === 'website');

    // Sort Booking.com by checkIn
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = [...bcData]
        .filter(r => r.checkOut && r.checkOut >= today)
        .sort((a, b) => (a.checkIn || '').localeCompare(b.checkIn || ''));
    const past = [...bcData]
        .filter(r => r.checkOut && r.checkOut < today)
        .sort((a, b) => (b.checkIn || '').localeCompare(a.checkIn || ''));

    return (
        <div>
            {/* Tab switcher */}
            <div className="flex items-center gap-1 mb-5 bg-slate-100 rounded-2xl p-1 w-fit">
                <button
                    onClick={() => setTab('website')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                    style={tab === 'website'
                        ? { background: '#fff', color: '#1a3c40', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                        : { color: '#64748b' }}
                >
                    <Globe size={14} />
                    С сайта
                    {pending.length > 0 && (
                        <span className="bg-[#e88c40] text-white text-[10px] font-black rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                            {pending.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setTab('bookingCom')}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                    style={tab === 'bookingCom'
                        ? { background: '#fff', color: '#003580', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }
                        : { color: '#64748b' }}
                >
                    <span className="inline-flex items-center bg-[#003580] text-white text-[9px] font-black px-1.5 py-0.5 rounded-md leading-none">BK</span>
                    Booking.com
                    {upcoming.length > 0 && (
                        <span className="bg-[#003580] text-white text-[10px] font-black rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                            {upcoming.length}
                        </span>
                    )}
                </button>
            </div>

            {/* ── Website bookings tab ── */}
            {tab === 'website' && (<>
                {!pending.length ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                            <Inbox size={28} className="text-slate-400" />
                        </div>
                        <div className="text-slate-500 font-bold text-base">Новых бронирований нет</div>
                        <div className="text-slate-400 text-sm text-center max-w-xs">
                            Когда гости оставят заявку на сайте, они появятся здесь
                        </div>
                    </div>
                ) : (
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
                                <BookingCard key={b.id} booking={b} onAccept={onAccept} onReject={onReject} />
                            ))}
                        </div>
                    </div>
                )}
            </>)}

            {/* ── Booking.com tab ── */}
            {tab === 'bookingCom' && (
                <div>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                        <div>
                            <h2 className="font-black text-slate-800 text-lg flex items-center gap-2">
                                <span className="inline-flex items-center bg-[#003580] text-white text-xs font-black px-2 py-0.5 rounded-lg">booking</span>
                                Booking.com
                            </h2>
                            {lastSync && (
                                <p className="text-xs text-slate-400 font-medium mt-0.5">
                                    Синхронизировано: {new Date(lastSync).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {syncMsg && (
                                <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${syncMsg.startsWith('Ошибка') ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>
                                    {syncMsg}
                                </span>
                            )}
                            <button
                                onClick={handleSync} disabled={syncing}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                                style={{ background: '#003580', color: '#fff', opacity: syncing ? 0.7 : 1 }}
                            >
                                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                                {syncing ? 'Загрузка...' : 'Синхронизировать'}
                            </button>
                        </div>
                    </div>

                    {!bcData.length ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                                <Calendar size={28} className="text-blue-300" />
                            </div>
                            <div className="text-slate-500 font-bold text-base">Нет данных</div>
                            <div className="text-slate-400 text-sm text-center max-w-xs">
                                Добавьте iCal URL в Настройки → Хостел, затем нажмите «Синхронизировать»
                            </div>
                        </div>
                    ) : (<>
                        {upcoming.length > 0 && (
                            <>
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Предстоящие — {upcoming.length}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-6">
                        {upcoming.map(r => <BookingComCard key={r.uid} res={r} matchedRoom={bookingNameToRoom[r.room?.toLowerCase()?.trim()]} />)}
                                </div>
                            </>
                        )}
                        {past.length > 0 && (
                            <>
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Прошедшие — {past.length}</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 opacity-60">
                                {past.map(r => <BookingComCard key={r.uid} res={r} matchedRoom={bookingNameToRoom[r.room?.toLowerCase()?.trim()]} />)}
                                </div>
                            </>
                        )}
                    </>)}
                </div>
            )}
        </div>
    );
};

// ── Booking.com reservation card ──────────────────────────────────────────────
const BookingComCard = ({ res, matchedRoom }) => {
    const fmtDate = (d) => {
        if (!d) return '—';
        try { return new Date(d + 'T00:00:00').toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' }); }
        catch { return d; }
    };
    const nights = (() => {
        try {
            if (!res.checkIn || !res.checkOut) return null;
            return Math.round((new Date(res.checkOut) - new Date(res.checkIn)) / 86400000);
        } catch { return null; }
    })();

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between"
                 style={{ background: 'linear-gradient(to right, #00358008, #00358004)' }}>
                <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#003580] bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#003580] inline-block" />
                    Booking.com
                </span>
                <span className="text-[11px] text-slate-400 font-mono font-bold">#{res.reservationId?.slice(-8) || '—'}</span>
            </div>
            <div className="p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                    <User  size={14} className="text-slate-400 shrink-0" />
                    <span className="font-black text-slate-800">{res.name}</span>
                </div>
                {res.guests > 1 && (
                    <div className="flex items-center gap-2">
                        <Users size={13} className="text-slate-400 shrink-0" />
                        <span className="text-sm text-slate-600 font-medium">{res.guests} гостя</span>
                    </div>
                )}
                {res.room && (
                    <div className="flex items-center gap-2">
                        <BedDouble size={13} className="text-slate-400 shrink-0" />
                        <span className="text-sm text-slate-600 font-medium">
                            {res.room}
                            {matchedRoom && (
                                <span className="ml-2 text-[11px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                                    ℑ6{String(matchedRoom.number)}{matchedRoom.name ? ` - ${matchedRoom.name}` : ''}
                                </span>
                            )}
                            {!matchedRoom && (
                                <span className="ml-2 text-[10px] text-amber-500 font-bold" title="Название не связано с комнатой">? не сопоставлено</span>
                            )}
                        </span>
                    </div>
                )}
                <div className="flex gap-4 pt-0.5">
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Заезд</div>
                        <div className="text-sm font-bold text-slate-700">{fmtDate(res.checkIn)}</div>
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Выезд</div>
                        <div className="text-sm font-bold text-slate-700">{fmtDate(res.checkOut)}</div>
                    </div>
                    {nights !== null && (
                        <div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Ночей</div>
                            <div className="text-sm font-bold text-slate-700">{nights}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BookingsView;
