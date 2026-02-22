import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    BedDouble, Wallet, CheckCircle2, Clock, CalendarDays, LogOut,
    Plus, Edit, Trash2, Copy, Search, X, AlertTriangle,
    TrendingUp, Users, ArrowRight, Layers, RotateCcw,
    Building2, User
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
//  УТИЛИТЫ
// ─────────────────────────────────────────────────────────────────────────────
const getTotalPaid = g =>
    typeof g.amountPaid === 'number'
        ? g.amountPaid
        : (g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0);

const parseDate = d => {
    if (!d) return null;
    const dt = new Date(d);
    if (typeof d === 'string' && !d.includes('T')) dt.setHours(12, 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
};

const fmt = n => (n ? Number(n).toLocaleString('ru-RU') : '0');
const fmtShort = d => {
    if (!d) return '—';
    const dt = parseDate(d);
    if (!dt) return '—';
    return `${dt.getDate()} ${['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][dt.getMonth()]}`;
};
const getDaysDiff = (a, b) => (!a || !b) ? 0 : Math.ceil((b - a) / 864e5);

const useNow = () => {
    const [n, setN] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setN(Date.now()), 60_000);
        return () => clearInterval(id);
    }, []);
    return n;
};

// ─────────────────────────────────────────────────────────────────────────────
//  СПРАВОЧНИК ФЛАГОВ
// ─────────────────────────────────────────────────────────────────────────────
const CF = {
    'Узбекистан':'uz','Россия':'ru','Казахстан':'kz','Кыргызстан':'kg',
    'Таджикистан':'tj','Туркменистан':'tm','Беларусь':'by','Белоруссия':'by',
    'Украина':'ua','Германия':'de','Франция':'fr','США':'us','Китай':'cn',
    'Япония':'jp','Южная Корея':'kr','Корея (Южная)':'kr','Турция':'tr',
    'ОАЭ':'ae','Великобритания':'gb','Польша':'pl','Чехия':'cz','Австрия':'at',
    'Италия':'it','Испания':'es','Индия':'in','Иран':'ir','Афганистан':'af',
    'Пакистан':'pk','Египет':'eg','Азербайджан':'az','Армения':'am','Грузия':'ge',
    'Монголия':'mn','Нидерланды':'nl','Бельгия':'be','Швейцария':'ch',
    'Швеция':'se','Норвегия':'no','Дания':'dk','Финляндия':'fi','Израиль':'il',
    'Саудовская Аравия':'sa','Катар':'qa','Кувейт':'kw','Бразилия':'br',
    'Аргентина':'ar','Мексика':'mx','Канада':'ca','Австралия':'au',
};

// ─────────────────────────────────────────────────────────────────────────────
//  Временная информация до выезда
// ─────────────────────────────────────────────────────────────────────────────
const buildTimeInfo = (guest, status, nowMs) => {
    if (!guest?.checkOutDate || status === 'free' || status === 'booking' || status === 'free_limited') return null;
    const co = parseDate(guest.checkOutDate);
    if (!co) return null;
    const ms = co.getTime() - nowMs;
    if (ms <= 0) return { label: 'Выезд просрочен', hot: true };
    const d = Math.floor(ms / 864e5);
    const h = Math.floor((ms % 864e5) / 3_600_000);
    if (d >= 2)  return { label: `Ещё ${d} дн.`,  hot: false };
    if (d === 1) return { label: `Завтра выезд`,   hot: true  };
    if (h > 0)   return { label: `Ещё ${h} ч.`,   hot: h < 4 };
    return { label: '< 1 ч.',  hot: true };
};

// ─────────────────────────────────────────────────────────────────────────────
//  Badge «Просрочено»
// ─────────────────────────────────────────────────────────────────────────────
const TimeoutBadge = () => (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-purple-100 text-purple-700 border border-purple-200">
        <Clock size={8} strokeWidth={3} /> Просрочено
    </span>
);

// ─────────────────────────────────────────────────────────────────────────────
//  KPI-карточка
// ─────────────────────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, sub, colorClass }) => (
    <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200/80 px-5 py-4 shadow-sm flex items-center gap-4 min-w-[150px]">
        <div className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${colorClass}`}>
            <Icon size={20} strokeWidth={2} />
        </div>
        <div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{label}</div>
            <div className="text-2xl font-black text-slate-800 leading-tight">{value}</div>
            {sub && <div className="text-[10px] font-medium text-slate-400 mt-0.5">{sub}</div>}
        </div>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────
//  КАРТОЧКА КОЙКИ
// ─────────────────────────────────────────────────────────────────────────────
const BedCell = React.memo(({ bed, onBedClick, nowMs }) => {
    const { id, status, guest, debt, freeForDays, isTimeout } = bed;
    const flagCode = guest?.country ? CF[guest.country] : null;
    const timeInfo = buildTimeInfo(guest, status, nowMs);

    if (status === 'free') {
        return (
            <button
                onClick={() => onBedClick(id, null, false)}
                title={`Место ${id} — свободно`}
                className="group relative flex flex-col items-center justify-center gap-2 w-40 min-h-[130px] shrink-0 rounded-2xl
                           border-2 border-dashed border-slate-200 bg-slate-50
                           hover:border-indigo-300 hover:bg-indigo-50
                           transition-all duration-300 cursor-pointer"
            >
                <span className="absolute top-2 left-3 text-[10px] font-black text-slate-300 group-hover:text-indigo-400 transition-colors">#{id}</span>
                <div className="w-11 h-11 rounded-full bg-white border border-slate-200 shadow-sm
                                flex items-center justify-center
                                group-hover:border-indigo-300 group-hover:shadow-indigo-100/80
                                group-hover:scale-110 transition-all duration-300">
                    <Plus size={22} className="text-slate-300 group-hover:text-indigo-500 transition-colors" strokeWidth={2.5} />
                </div>
                <span className="text-[11px] font-bold text-slate-400 group-hover:text-indigo-500 transition-colors">Заселить</span>
            </button>
        );
    }

    let cardBg, cardBorder, headerBg, nameCls;
    if (isTimeout) {
        cardBg = 'bg-purple-50'; cardBorder = 'border-purple-200'; headerBg = 'bg-purple-100'; nameCls = 'text-purple-900';
    } else if (status === 'free_limited') {
        cardBg = 'bg-sky-50'; cardBorder = 'border-sky-200'; headerBg = 'bg-sky-100'; nameCls = 'text-sky-800';
    } else if (status === 'booking') {
        cardBg = 'bg-amber-50'; cardBorder = 'border-amber-200'; headerBg = 'bg-amber-100'; nameCls = 'text-amber-800';
    } else if (debt > 0) {
        cardBg = 'bg-rose-50'; cardBorder = 'border-rose-200'; headerBg = 'bg-rose-100'; nameCls = 'text-rose-900';
    } else {
        cardBg = 'bg-teal-50'; cardBorder = 'border-teal-200'; headerBg = 'bg-teal-100'; nameCls = 'text-teal-900';
    }

    return (
        <div
            role="button" tabIndex={0}
            onClick={() => onBedClick(id, guest, false)}
            onKeyDown={e => e.key === 'Enter' && onBedClick(id, guest, false)}
            title={`${guest?.fullName || 'Гость'} | Место ${id}`}
            className={`group relative flex flex-col w-40 min-h-[155px] shrink-0 rounded-2xl border shadow-sm
                        ${cardBg} ${cardBorder}
                        hover:shadow-md hover:-translate-y-0.5
                        transition-all duration-300 cursor-pointer overflow-hidden text-left`}
        >
            <div className={`flex items-center justify-between px-3 py-2 ${headerBg} border-b border-white/60`}>
                <span className="text-[10px] font-black text-slate-500">#{id}</span>
                <div className="flex items-center gap-1.5">
                    {flagCode ? (
                        <img src={`https://flagcdn.com/w40/${flagCode}.png`} alt={guest?.country}
                            className="w-[22px] h-[14px] object-cover rounded shadow border border-black/10" loading="lazy" />
                    ) : (
                        <div className="w-[22px] h-[14px] rounded bg-white/60 border border-white shadow flex items-center justify-center">
                            <User size={8} className="text-slate-300" />
                        </div>
                    )}
                    {isTimeout && <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />}
                    {status === 'booking' && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                    {status === 'occupied' && debt > 0 && <span className="w-2 h-2 rounded-full bg-rose-400" />}
                    {status === 'occupied' && debt === 0 && <span className="w-2 h-2 rounded-full bg-teal-400" />}
                    {status === 'free_limited' && <span className="w-2 h-2 rounded-full bg-sky-400" />}
                </div>
            </div>

            <div className="flex flex-col flex-1 px-3 py-2.5 gap-1">
                <div className={`text-[13px] font-extrabold leading-snug line-clamp-2 ${nameCls} ${isTimeout ? 'opacity-60 line-through' : ''}`}>
                    {guest?.fullName || 'Имя не указано'}
                </div>
                {!flagCode && guest?.country && (
                    <div className="text-[10px] text-slate-400 font-semibold truncate">{guest.country}</div>
                )}
                {(guest?.checkInDate || guest?.checkOutDate) && (
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 mt-0.5">
                        <CalendarDays size={10} className="shrink-0 text-slate-400" />
                        <span>{fmtShort(guest?.checkInDate)}</span>
                        <ArrowRight size={8} className="text-slate-300 shrink-0" />
                        <span>{fmtShort(guest?.checkOutDate)}</span>
                    </div>
                )}
                {timeInfo && (
                    <span className={`text-[10px] font-bold mt-0.5 ${timeInfo.hot ? 'text-rose-500' : 'text-slate-400'}`}>{timeInfo.label}</span>
                )}
                {status === 'free_limited' && freeForDays != null && (
                    <span className="text-[10px] font-bold text-sky-600 mt-0.5">Заезд через {freeForDays} дн.</span>
                )}
                {status === 'booking' && (
                    <span className="text-[10px] font-bold text-amber-700 mt-0.5 flex items-center gap-1">
                        <CalendarDays size={9} />Бронь / ожидает заезда
                    </span>
                )}
                {isTimeout && <TimeoutBadge />}
                {debt > 0 ? (
                    <div className="flex items-center gap-1.5 mt-auto bg-rose-100/80 border border-rose-200 rounded-lg px-2 py-1">
                        <Wallet size={11} className="text-rose-500 shrink-0" />
                        <span className="text-[11px] font-black text-rose-600">Долг: {fmt(debt)}</span>
                    </div>
                ) : status === 'occupied' ? (
                    <div className="flex items-center gap-1 mt-auto opacity-70">
                        <CheckCircle2 size={11} className="text-teal-500" />
                        <span className="text-[10px] font-semibold text-teal-600">Оплачено</span>
                    </div>
                ) : null}
            </div>

            <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-[3px] rounded-2xl
                            flex flex-col items-center justify-center gap-2 px-3
                            opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto
                            transition-all duration-200 z-20">
                {/* Детали гостя — только для активных (не просроченных) */}
                {!isTimeout && (
                    <button onClick={e => { e.stopPropagation(); onBedClick(id, guest, false); }}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold transition-colors border border-white/20">
                        <User size={12} /> Детали гостя
                    </button>
                )}
                {/* Продлить — для активных и просроченных */}
                {(status === 'occupied' || isTimeout) && (
                    <button onClick={e => { e.stopPropagation(); onBedClick(id, guest, 'extend'); }}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-500/80 hover:bg-indigo-500 text-white text-[11px] font-bold transition-colors border border-indigo-400/40">
                        <Clock size={12} /> Продлить
                    </button>
                )}
                {/* Заселить нового — только для просроченных */}
                {isTimeout && (
                    <button onClick={e => { e.stopPropagation(); onBedClick(id, null, false); }}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/80 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors border border-emerald-400/40">
                        <Plus size={12} /> Заселить
                    </button>
                )}
            </div>
        </div>
    );
});
BedCell.displayName = 'BedCell';

// ─────────────────────────────────────────────────────────────────────────────
//  ВЫЧИСЛЕНИЕ ДАННЫХ КОЕК
// ─────────────────────────────────────────────────────────────────────────────
const buildBedsData = (room, guests) => {
    const now = new Date();
    const cap = parseInt(room.capacity) || 0;
    const byBed = {};
    guests.forEach(g => {
        const k = String(g.bedId);
        if (!byBed[k]) byBed[k] = [];
        byBed[k].push(g);
    });
    const beds = [];
    for (let i = 1; i <= cap; i++) {
        const bg = byBed[String(i)] || [];
        const activeGuest = bg.find(g => g.status === 'active');
        const nextBooking = bg
            .filter(g => g.status === 'booking')
            .sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate))[0];
        let status = 'free', displayGuest = null, debt = 0, isTimeout = false, freeForDays = null;
        if (activeGuest) {
            const co = parseDate(activeGuest.checkOutDate);
            const expired = co && now > co;
            if (expired && (now - co) / 3_600_000 > 28) {
                status = 'free';
            } else {
                displayGuest = activeGuest;
                debt = Math.max(0, (activeGuest.totalPrice || 0) - getTotalPaid(activeGuest));
                isTimeout = !!expired;
                status = isTimeout ? 'timeout' : 'occupied';
            }
        } else if (nextBooking) {
            const du = getDaysDiff(now, parseDate(nextBooking.checkInDate));
            if (du <= 0) { status = 'booking'; displayGuest = nextBooking; }
            else { status = 'free_limited'; displayGuest = nextBooking; freeForDays = du; }
        }
        beds.push({ id: i, status, guest: displayGuest, debt, isTimeout, freeForDays });
    }
    return beds;
};



// ─────────────────────────────────────────────────────────────────────────────
//  СТРОКА КОМНАТЫ
// ─────────────────────────────────────────────────────────────────────────────
const RoomRow = React.memo(({ room, guests, isAdmin, onEdit, onClone, onDelete, onBedClick, filter, guestSearch }) => {
    const nowMs = useNow();
    const bedsData = useMemo(() => buildBedsData(room, guests), [room, guests]);

    const stats = useMemo(() => bedsData.reduce((a, b) => {
        if (b.status === 'occupied' || b.isTimeout) a.occ++;
        if (b.status === 'free' || b.status === 'free_limited') a.free++;
        if (b.debt > 0) { a.debtCount++; a.debtSum += b.debt; }
        if (b.isTimeout) a.timeout++;
        if (b.status === 'booking') a.booking++;
        return a;
    }, { occ: 0, free: 0, debtCount: 0, debtSum: 0, timeout: 0, booking: 0 }), [bedsData]);

    const cap    = parseInt(room.capacity) || 1;
    const occPct = Math.min(100, Math.round((stats.occ / cap) * 100));

    if (filter === 'free'     && stats.free === 0)    return null;
    if (filter === 'occupied' && stats.occ === 0)     return null;
    if (filter === 'debt'     && stats.debtSum === 0) return null;
    if (filter === 'timeout'  && stats.timeout === 0) return null;
    if (filter === 'booking'  && stats.booking === 0) return null;

    const searchNorm = guestSearch?.toLowerCase().trim();
    let visibleBeds = bedsData;
    if (searchNorm) {
        const hasMatch = bedsData.some(b => b.guest?.fullName?.toLowerCase().includes(searchNorm));
        if (!hasMatch) return null;
        visibleBeds = bedsData.filter(b => !b.guest || b.guest.fullName?.toLowerCase().includes(searchNorm));
    }

    return (
        <div className="group/room bg-white rounded-2xl border border-slate-200/80
                        shadow-[0_2px_20px_-6px_rgba(0,0,0,0.06)]
                        hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.1)]
                        transition-all duration-300 overflow-hidden">

            {/* ── ШАПКА комнаты (мобильная: компактная строка; md+: боковая панель) ── */}

            {/* Мобильная шапка */}
            <div className="md:hidden flex items-center gap-3 px-3 py-2 border-b border-slate-100 bg-slate-50/80">
                <span className="text-2xl font-black text-slate-800 leading-none tracking-tighter w-10 shrink-0">{room.number}</span>
                {room.name && <span className="text-xs font-semibold text-slate-500 truncate max-w-[80px]">{room.name}</span>}

                {/* Индикатор заполненности */}
                <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${
                            occPct === 100 ? 'bg-indigo-500' : occPct >= 60 ? 'bg-teal-400' : 'bg-emerald-400'
                        }`} style={{ width: `${occPct}%` }} />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 shrink-0">{stats.occ}/{cap}</span>
                </div>

                {/* Баджи */}
                <div className="flex items-center gap-1 shrink-0">
                    {stats.free > 0 && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-black">{stats.free}св</span>}
                    {stats.debtSum > 0 && <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[9px] font-black">д</span>}
                    {stats.timeout > 0 && <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[9px] font-black">{stats.timeout}пр</span>}
                    {stats.booking > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-black">{stats.booking}бр</span>}
                </div>

                {/* Админ-кнопки */}
                {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                        <button onClick={onEdit}   className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg"><Edit   size={13}/></button>
                        <button onClick={onClone}  className="p-1.5 text-slate-400 hover:text-sky-600   rounded-lg"><Copy   size={13}/></button>
                        <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-rose-600  rounded-lg"><Trash2 size={13}/></button>
                    </div>
                )}
            </div>

            {/* md+ боковая панель */}
            <div className="hidden md:flex flex-row">
                <div className="w-52 lg:w-60 shrink-0 flex flex-col p-5 border-r border-slate-100 bg-gradient-to-b from-slate-50/80 to-white">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <Building2 size={13} className="text-slate-400" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Номер</span>
                            </div>
                            <span className="text-4xl font-black text-slate-800 tracking-tighter leading-none">{room.number}</span>
                            {room.name && <div className="text-xs font-semibold text-slate-500 mt-1">{room.name}</div>}
                        </div>
                        {isAdmin && (
                            <div className="flex flex-col gap-1 opacity-0 group-hover/room:opacity-100 transition-opacity duration-200">
                                <button onClick={onEdit}   title="Изменить" className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit   size={14}/></button>
                                <button onClick={onClone}  title="Клон"     className="p-1.5 text-slate-400 hover:text-sky-600   hover:bg-sky-50   rounded-lg transition-colors"><Copy   size={14}/></button>
                                <button onClick={onDelete} title="Удалить"  className="p-1.5 text-slate-400 hover:text-rose-600  hover:bg-rose-50  rounded-lg transition-colors"><Trash2 size={14}/></button>
                            </div>
                        )}
                    </div>
                    <div className="mt-auto">
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Заполненность</span>
                            <span className="text-xs font-black text-slate-700">{stats.occ}/{cap}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${
                                occPct === 100 ? 'bg-gradient-to-r from-indigo-500 to-purple-500' :
                                occPct >= 60   ? 'bg-gradient-to-r from-teal-400 to-emerald-500' :
                                                 'bg-gradient-to-r from-emerald-300 to-teal-400'
                            }`} style={{ width: `${occPct}%` }} />
                        </div>
                        <div className="text-[10px] font-semibold text-slate-400 mt-1">{occPct}% занято</div>
                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {stats.free > 0 && <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold">{stats.free} св.</span>}
                            {stats.debtSum > 0 && <span className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 text-[10px] font-bold flex items-center gap-1"><Wallet size={9}/>{fmt(stats.debtSum)}</span>}
                            {stats.timeout > 0 && <span className="px-2 py-1 rounded-lg bg-purple-50 border border-purple-100 text-purple-700 text-[10px] font-bold flex items-center gap-1"><Clock size={9}/>{stats.timeout} прос.</span>}
                            {stats.booking > 0 && <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold flex items-center gap-1"><CalendarDays size={9}/>{stats.booking} бр.</span>}
                        </div>
                    </div>
                </div>

                {/* md+ сетка коек */}
                <div className="flex-1 p-5 bg-slate-50">
                    <div className="flex flex-wrap gap-3">
                        {visibleBeds.map(bed => {
                            if (filter === 'debt'     && bed.debt <= 0 && bed.status !== 'free') return null;
                            if (filter === 'free'     && bed.status !== 'free' && bed.status !== 'free_limited') return null;
                            if (filter === 'occupied' && bed.status !== 'occupied' && !bed.isTimeout && bed.status !== 'free') return null;
                            if (filter === 'timeout'  && !bed.isTimeout && bed.status !== 'free') return null;
                            if (filter === 'booking'  && bed.status !== 'booking' && bed.status !== 'free') return null;
                            return (
                                <BedCell key={bed.id} bed={bed} onBedClick={(bedId, g, action) => onBedClick(room, bedId, g, action)} nowMs={nowMs} />
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Мобильная сетка коек: горизонтальная прокрутка */}
            <div className="md:hidden overflow-x-auto scrollbar-hide bg-slate-50 px-3 py-3">
                <div className="flex gap-2.5">
                    {visibleBeds.map(bed => {
                        if (filter === 'debt'     && bed.debt <= 0 && bed.status !== 'free') return null;
                        if (filter === 'free'     && bed.status !== 'free' && bed.status !== 'free_limited') return null;
                        if (filter === 'occupied' && bed.status !== 'occupied' && !bed.isTimeout && bed.status !== 'free') return null;
                        if (filter === 'timeout'  && !bed.isTimeout && bed.status !== 'free') return null;
                        if (filter === 'booking'  && bed.status !== 'booking' && bed.status !== 'free') return null;
                        return (
                            <BedCell key={bed.id} bed={bed} onBedClick={(bedId, g, action) => onBedClick(room, bedId, g, action)} nowMs={nowMs} />
                        );
                    })}
                </div>
            </div>
        </div>
    );
});
RoomRow.displayName = 'RoomRow';

// ─────────────────────────────────────────────────────────────────────────────
//  ГЛАВНЫЙ КОМПОНЕНТ
// ─────────────────────────────────────────────────────────────────────────────
const FILTERS = [
    { key: 'all',      label: 'Все',        icon: Layers        },
    { key: 'free',     label: 'Свободные',  icon: Plus          },
    { key: 'occupied', label: 'Занятые',    icon: Users         },
    { key: 'debt',     label: 'Долги',      icon: Wallet        },
    { key: 'timeout',  label: 'Просрочены', icon: AlertTriangle },
    { key: 'booking',  label: 'Брони',      icon: CalendarDays  },
];

const RoomsView = ({
    filteredRooms, guestsByRoom, currentUser,
    onBedClick, onEditRoom, onCloneRoom, onDeleteRoom, onAddRoom,
}) => {
    const [filter, setFilter]           = useState('all');
    const [guestSearch, setGuestSearch] = useState('');


    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';

    const totals = useMemo(() => {
        let beds = 0, occ = 0, free = 0, debtSum = 0, timeoutCount = 0;
        filteredRooms.forEach(r => {
            const bd = buildBedsData(r, guestsByRoom[r.id] || []);
            beds += parseInt(r.capacity || 0);
            bd.forEach(b => {
                if (b.status === 'occupied' || b.isTimeout) occ++;
                else if (b.status === 'free' || b.status === 'free_limited') free++;
                if (b.debt > 0) debtSum += b.debt;
                if (b.isTimeout) timeoutCount++;
            });
        });
        return { beds, occ, free, debtSum, timeoutCount };
    }, [filteredRooms, guestsByRoom]);

    const clearSearch = useCallback(() => setGuestSearch(''), []);

    return (
        <div className="flex flex-col h-full bg-[#f6f8fc] overflow-hidden">

            {/* ══ ШАПКА ════════════════════════════════════════════════════ */}
            <div className="shrink-0 border-b border-slate-200/80 bg-white/80 backdrop-blur-sm overflow-hidden">

                {/* Строка 1: фильтры (прокручиваемая полоса) */}
                <div className="overflow-x-auto scrollbar-hide px-3 md:px-5 pt-3">
                    <div className="flex items-center bg-slate-100/80 rounded-xl p-1 gap-0.5 w-max">
                        {FILTERS.map(({ key, label, icon: Icon }) => (
                            <button
                                key={key}
                                onClick={() => setFilter(key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200
                                    ${filter === key
                                        ? 'bg-white text-indigo-700 shadow-sm shadow-slate-200/80'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60'
                                    }`}
                            >
                                <Icon size={12} />
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Строка 2: поиск + кнопки */}
                <div className="flex items-center gap-2 px-3 md:px-5 pt-2 pb-3">
                    <div className="relative flex-1 min-w-0">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Поиск по имени..."
                            value={guestSearch}
                            onChange={e => setGuestSearch(e.target.value)}
                            className="w-full pl-8 pr-8 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-700
                                       placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400
                                       transition-all duration-200 shadow-sm"
                        />
                        {guestSearch && (
                            <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {isAdmin && (
                        <button
                            onClick={onAddRoom}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500
                                       text-white text-xs font-bold transition-all duration-200 shrink-0
                                       shadow-[0_4px_14px_-4px_rgba(79,70,229,0.5)] active:scale-95"
                        >
                            <Plus size={14} strokeWidth={3} />
                            <span>Новый</span>
                        </button>
                    )}

                    {(filter !== 'all' || guestSearch) && (
                        <button
                            onClick={() => { setFilter('all'); clearSearch(); }}
                            className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700
                                       bg-white border border-slate-200 hover:bg-slate-50 transition-colors shrink-0 shadow-sm"
                        >
                            <RotateCcw size={11} />
                        </button>
                    )}
                </div>

                {/* Мини-статистика */}
                <div className="flex items-center gap-2 flex-wrap px-3 md:px-5 pb-2.5">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                        <BedDouble size={11} className="text-slate-400" />{totals.beds} мест
                    </span>
                    <span className="text-slate-200">·</span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-teal-600">
                        <Users size={11} />{totals.occ} занято
                    </span>
                    <span className="text-slate-200">·</span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                        <TrendingUp size={11} />{totals.free} свободно
                    </span>
                    {totals.debtSum > 0 && <>
                        <span className="text-slate-200">·</span>
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-500">
                            <Wallet size={11} />{fmt(totals.debtSum)}
                        </span>
                    </>}
                    {totals.timeoutCount > 0 && <>
                        <span className="text-slate-200">·</span>
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-purple-600">
                            <AlertTriangle size={11} />{totals.timeoutCount} просрочено
                        </span>
                    </>}
                </div>
            </div>
            {/* ══ СПИСОК КОМНАТ ══════════════════════════════════════════════ */}
            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-4 pb-24 scrollbar-hide">
                {filteredRooms.map(room => (
                    <RoomRow
                        key={room.id}
                        room={room}
                        guests={guestsByRoom[room.id] || []}
                        isAdmin={isAdmin}
                        onEdit={() => onEditRoom(room)}
                        onClone={() => onCloneRoom(room)}
                        onDelete={() => onDeleteRoom(room)}
                        onBedClick={onBedClick}
                        filter={filter}
                        guestSearch={guestSearch}
                    />
                ))}

                {filteredRooms.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-5">
                            <BedDouble size={40} className="text-slate-300" strokeWidth={1.5} />
                        </div>
                        <span className="text-lg font-black text-slate-400">Номера не найдены</span>
                        <span className="text-sm font-medium text-slate-400 mt-1">Попробуйте изменить фильтры</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RoomsView;