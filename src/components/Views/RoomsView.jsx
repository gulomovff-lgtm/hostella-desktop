import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
    BedDouble, Wallet, CheckCircle2, Clock, CalendarDays, LogOut,
    Plus, Edit, Trash2, Copy, Search, X, AlertTriangle, AlertCircle,
    TrendingUp, Users, ArrowRight, Layers, RotateCcw,
    Building2, User, Download, Key, LogIn, Phone, RefreshCw, FileText
} from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { computeContractFinancials } from '../../utils/contractFinancials';
import { getKppDayNumber, getRegistrationWindow } from '../../utils/helpers';

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

const getEffectiveCheckoutDate = (guest) => {
    const regularCo = parseDate(guest?.checkOutDate);
    const bonusCo = parseDate(guest?.bonusCheckOutDate);
    if (regularCo && bonusCo) return bonusCo > regularCo ? bonusCo : regularCo;
    return bonusCo || regularCo;
};

const fmt = n => (n ? Number(n).toLocaleString('ru-RU') : '0');
const fmtShort = (d, lang = 'ru') => {
    if (!d) return '—';
    const dt = parseDate(d);
    if (!dt) return '—';
    const months = TRANSLATIONS[lang]?.monthsShort || ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
    return `${dt.getDate()} ${months[dt.getMonth()]}`;
};
const getDaysDiff = (a, b) => (!a || !b) ? 0 : Math.ceil((b - a) / 864e5);

const isRegularBedId = (bedId, capacity) => {
    const n = Number(bedId);
    return Number.isInteger(n) && n >= 1 && n <= capacity;
};

const ExtraBedIcon = ({ size = 13, className = '' }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className={className} aria-hidden="true">
        <circle cx="5" cy="6" r="2.8"/>
        <rect x="2" y="11" width="20" height="4" rx="2"/>
    </svg>
);

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
const buildTimeInfo = (guest, status, nowMs, lang = 'ru') => {
    if (!guest?.checkOutDate || status === 'free' || status === 'booking' || status === 'free_limited') return null;
    const co = parseDate(guest.checkOutDate);
    if (!co) return null;
    const tr = (k) => TRANSLATIONS[lang]?.[k] || k;
    // Bonus day: show bonus indicator instead of overdue
    const bonusCo = guest.bonusCheckOutDate ? parseDate(guest.bonusCheckOutDate) : null;
    if (bonusCo && nowMs >= co.getTime() && nowMs < bonusCo.getTime()) {
        const msBonus = bonusCo.getTime() - nowMs;
        const hBonus = Math.max(0, Math.floor(msBonus / 3_600_000));
        const bonus = tr('bonusBadge');
        return { label: hBonus > 0 ? `${bonus}, ${tr('stillPrefix')} ${hBonus}${tr('hoursShort')}` : bonus, hot: false, isBonus: true };
    }
    const ms = co.getTime() - nowMs;
    if (ms <= 0) return { label: tr('timeout'), hot: true };
    const d = Math.floor(ms / 864e5);
    const h = Math.floor((ms % 864e5) / 3_600_000);
    if (d >= 2)  return { label: `${tr('stillPrefix')} ${d} ${tr('daysShort')}`,  hot: false };
    if (d === 1) return { label: `${tr('stillPrefix')} 1 ${tr('daysShort')}`,     hot: true  };
    if (h > 0)   return { label: `${tr('stillPrefix')} ${h} ${tr('hoursShort')}`, hot: h < 4 };
    return { label: tr('lessThan1h'), hot: true };
};

// ─────────────────────────────────────────────────────────────────────────────
//  Badge «Просрочено»
// ─────────────────────────────────────────────────────────────────────────────
const TimeoutBadge = ({ isBonus = false, lang = 'ru' }) => {
    const tr = (k) => TRANSLATIONS[lang]?.[k] || k;
    return isBonus
        ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-orange-100 text-orange-600 border border-orange-200">{tr('bonusBadge')}</span>
        : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-purple-100 text-purple-700 border border-purple-200">
            <Clock size={8} strokeWidth={3} /> {tr('overdueBadge')}
          </span>;
};

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
const BedCell = React.memo(({ bed, onBedClick, onKppConfirm, nowMs, lang = 'ru', cadastreRegs = [] }) => {
    const { id, status, guest, debt, freeForDays, isTimeout, isBonus, incomingGuest, incomingDays } = bed;
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const flagCode = guest?.country ? CF[guest.country] : null;
    const timeInfo = buildTimeInfo(guest, status, nowMs, lang);

    // День КПП = 1. Срок без регистрации зависит от гражданства. Пересчёт каждый рендер (nowMs).
    const kppDays = (guest?.kppDate && guest.country && guest.country !== 'Узбекистан')
        ? getKppDayNumber(guest.kppDate)
        : -1;
    const kppWindow = getRegistrationWindow(guest?.country);
    const kppAlert = kppDays >= kppWindow - 1 && !guest?.kppRegistered;

    const cadastreExpired = (() => {
        if (!guest?.id && !guest?.fullName) return false;
        const regs = cadastreRegs.filter(r =>
            (r.guestId === guest?.id || r.guestName === guest?.fullName) &&
            r.status !== 'removed'
        );
        if (regs.length === 0) return false;
        return !regs.some(r => r.endDate && new Date(r.endDate + 'T12:00:00') >= new Date(nowMs));
    })();

    if (status === 'free') {
        return (
            <button
                onClick={() => onBedClick(id, null, false)}
                title={`${t('bed2')} ${id}`}
                className="group relative flex flex-col items-center justify-center gap-2 min-w-[120px] w-full sm:w-40 min-h-[130px] shrink-0 rounded-2xl
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
                <span className="text-[11px] font-bold text-slate-400 group-hover:text-indigo-500 transition-colors">{t('checkin')}</span>
            </button>
        );
    }

    let cardBg, cardBorder, headerBg, nameCls;
    if (isTimeout) {
        cardBg = 'bg-purple-50'; cardBorder = 'border-purple-200'; headerBg = 'bg-purple-100'; nameCls = 'text-purple-900';
    } else if (isBonus) {
        cardBg = 'bg-orange-50'; cardBorder = 'border-orange-300'; headerBg = 'bg-orange-100'; nameCls = 'text-orange-900';
    } else if (guest?.isBonusStay) {
        cardBg = 'bg-orange-50'; cardBorder = 'border-orange-300'; headerBg = 'bg-orange-100'; nameCls = 'text-orange-900';
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
            title={`${guest?.fullName || t('nameUnknown')} | ${bed?.isExtra ? 'Доп. гость' : `${t('bed2')} ${id}`}`}
            className={`group relative flex flex-col min-w-[120px] w-full sm:w-40 min-h-[155px] shrink-0 rounded-2xl border shadow-sm
                        ${cardBg} ${cardBorder}
                        hover:shadow-md hover:-translate-y-0.5
                        transition-all duration-300 cursor-pointer overflow-hidden text-left`}
        >
            <div className={`flex items-center justify-between px-3 py-2 ${headerBg} border-b border-white/60`}>
                <span className="text-[10px] font-black text-slate-500 flex items-center gap-1">
                    {bed?.isExtra ? <ExtraBedIcon size={13} className="opacity-70" /> : `#${id}`}
                </span>
                <div className="flex items-center gap-1.5">
                    {flagCode ? (
                        <span className={`fi fi-${flagCode.toLowerCase()}`} style={{ width: 22, height: 14, display: 'inline-block', objectFit: 'cover', borderRadius: 2, verticalAlign: 'middle', backgroundSize: 'cover' }} />
                    ) : (
                        <div className="w-[22px] h-[14px] rounded bg-white/60 border border-white shadow flex items-center justify-center">
                            <User size={8} className="text-slate-300" />
                        </div>
                    )}
                    {isTimeout && <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />}
                    {(isBonus || guest?.isBonusStay) && <span className="w-2 h-2 rounded-full bg-orange-400" />}
                    {status === 'booking' && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                    {status === 'occupied' && debt > 0 && <span className="w-2 h-2 rounded-full bg-rose-400" />}
                    {status === 'occupied' && debt === 0 && <span className="w-2 h-2 rounded-full bg-teal-400" />}
                    {status === 'free_limited' && <span className="w-2 h-2 rounded-full bg-sky-400" />}
                </div>
            </div>

            <div className="flex flex-col flex-1 px-3 py-2.5 gap-1">
                <div className={`text-[13px] font-extrabold leading-snug line-clamp-2 ${nameCls} ${isTimeout ? 'opacity-60 line-through' : ''}`}>
                    {guest?.fullName || t('nameUnknown')}
                </div>
                {!flagCode && guest?.country && (
                    <div className="text-[10px] text-slate-400 font-semibold truncate">{guest.country}</div>
                )}
                {(guest?.checkInDate || guest?.checkOutDate) && (
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 mt-0.5">
                        <CalendarDays size={10} className="shrink-0 text-slate-400" />
                        <span>{fmtShort(guest?.checkInDate, lang)}</span>
                        <ArrowRight size={8} className="text-slate-300 shrink-0" />
                        <span>{fmtShort(getEffectiveCheckoutDate(guest), lang)}</span>
                    </div>
                )}
                {timeInfo && (
                    <span className={`text-[10px] font-bold mt-0.5 ${timeInfo.hot ? 'text-rose-500' : 'text-slate-400'}`}>{timeInfo.label}</span>
                )}
                {kppAlert && (
                    <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1">
                        <div className="flex items-center gap-1 text-[9px] font-black text-amber-700">
                            <AlertTriangle size={9} />Регистрация! {kppDays}д
                        </div>
                    </div>
                )}
                {cadastreExpired && (
                    <div className="mt-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1">
                        <div className="flex items-center gap-1 text-[9px] font-black text-rose-700">
                            <AlertCircle size={9} />Кадастр истёк
                        </div>
                    </div>
                )}
                {status === 'free_limited' && freeForDays != null && (
                    <span className="text-[10px] font-bold text-sky-600 mt-0.5">{t('free')} {freeForDays} {t('daysShort')}</span>
                )}
                {incomingGuest && incomingDays !== null && (
                    <div className={`flex items-center gap-1 mt-1 rounded-lg px-2 py-1 ${
                        incomingDays === 0 ? 'bg-rose-100 border border-rose-200'
                        : incomingDays <= 2 ? 'bg-orange-100 border border-orange-200'
                        : 'bg-amber-50 border border-amber-200'
                    }`}>
                        <CalendarDays size={9} className={incomingDays <= 2 ? 'text-rose-500 shrink-0' : 'text-amber-500 shrink-0'}/>
                        <span className={`text-[9px] font-black truncate ${
                            incomingDays === 0 ? 'text-rose-700'
                            : incomingDays <= 2 ? 'text-orange-700'
                            : 'text-amber-700'
                        }`}>
                            {incomingDays === 0 ? t('arrivalToday') : `${t('arrivesIn')} ${incomingDays} ${t('daysShort')}`}
                        </span>
                    </div>
                )}
                {status === 'booking' && (
                    <span className="text-[10px] font-bold text-amber-700 mt-0.5 flex items-center gap-1">
                        <CalendarDays size={9} />{t('bookingWaiting')}
                    </span>
                )}

                {(isTimeout || (bed?.isBonus)) && <TimeoutBadge isBonus={bed?.isBonus} lang={lang} />}
                {debt > 0 ? (
                    <div className="flex items-center gap-1.5 mt-auto bg-rose-100/80 border border-rose-200 rounded-lg px-2 py-1">
                        <Wallet size={11} className="text-rose-500 shrink-0" />
                        <span className="text-[11px] font-black text-rose-600">{t('debt')}: {fmt(debt)}</span>
                    </div>
                ) : status === 'occupied' ? (
                    <div className="flex items-center gap-1 mt-auto opacity-70">
                        <CheckCircle2 size={11} className="text-teal-500" />
                        <span className="text-[10px] font-semibold text-teal-600">{t('paid')}</span>
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
                        <User size={12} /> {t('guestDetails')}
                    </button>
                )}
                {/* Продлить — для активных и просроченных */}
                {(status === 'occupied' || isTimeout) && (
                    <button onClick={e => { e.stopPropagation(); onBedClick(id, guest, 'extend'); }}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-500/80 hover:bg-indigo-500 text-white text-[11px] font-bold transition-colors border border-indigo-400/40">
                        <Clock size={12} /> {t('extend')}
                    </button>
                )}
                {/* Заселить нового — для просроченных, free_limited И ожидающих бронирования */}
                {(isTimeout || status === 'free_limited' || status === 'booking') && !bed?.isExtra && (
                    <button onClick={e => { e.stopPropagation(); onBedClick(id, null, false); }}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/80 hover:bg-emerald-500 text-white text-[11px] font-bold transition-colors border border-emerald-400/40">
                        <Plus size={12} /> {t('checkinNew')}
                    </button>
                )}
            </div>
        </div>
    );
});
BedCell.displayName = 'BedCell';

// ─────────────────────────────────────────────────────────────────────────────
//  СПАРКЛАЙН — 14 дней загрузки комнаты
// ─────────────────────────────────────────────────────────────────────────────
const Sparkline = ({ guests, capacity, lang = 'ru' }) => {
    const DAYS = 14;
    const tr = (k) => TRANSLATIONS[lang]?.[k] || k;
    const cap = parseInt(capacity) || 1;
    const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
    const bars = useMemo(() => {
        return Array.from({ length: DAYS }, (_, i) => {
            const d = new Date(today);
            d.setDate(d.getDate() - (DAYS - 1 - i));
            const ds = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
            const occ = guests.filter(g => {
                if (!['active', 'checked_out'].includes(g.status)) return false;
                if (!g.checkInDate || !g.checkOutDate) return false;
                return g.checkInDate.slice(0, 10) <= ds && g.checkOutDate.slice(0, 10) > ds;
            }).length;
            return Math.min(100, Math.round((occ / cap) * 100));
        });
    }, [guests, cap, today]);
    const BAR_H = 18;
    return (
        <div title={`${tr('occupancy')} ${DAYS} ${tr('days')}`}>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">{DAYS} {tr('days')}</div>
            <div className="flex items-end gap-px w-full" style={{ height: BAR_H }}>
                {bars.map((pct, i) => (
                    <div key={i}
                        className={`flex-1 rounded-sm ${
                            i === DAYS - 1 ? 'opacity-50' :
                            pct >= 80 ? 'bg-indigo-500' :
                            pct >= 40 ? 'bg-teal-400' :
                            pct > 0   ? 'bg-slate-300' : 'bg-slate-100'
                        }`}
                        style={{ height: Math.max(2, Math.round((pct / 100) * BAR_H)) }}
                    />
                ))}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//  ВЫЧИСЛЕНИЕ ДАННЫХ КОЕК
// ─────────────────────────────────────────────────────────────────────────────
const buildBedsData = (room, guests) => {
    const now = new Date();
    // Конец сегодняшнего дня. Гость со статусом active считается уже присутствующим,
    // если дата заезда — сегодня или раньше (даже если расчётный час 14:00 ещё не настал
    // при раннем заезде утром). Будущие заезды в системе всегда имеют статус booking.
    const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
    const isArrived = (g) => new Date(g.checkInDate) <= endOfToday;
    const cap = parseInt(room.capacity) || 0;
    // Если комната сдана в аренду — все места считаются занятыми
    if (room.rental?.active) {
        return Array.from({ length: cap }, (_, i) => ({
            id: i + 1,
            status: 'rented_out',
            guest: null,
            debt: 0,
            isTimeout: false,
            isBonus: false,
            freeForDays: null,
            incomingGuest: null,
            incomingDays: null,
        }));
    }
    const byBed = {};
    guests.forEach(g => {
        const rawBedId = g?.bedId == null ? '' : String(g.bedId);
        const k = rawBedId || `extra-${g.id}`;
        if (!byBed[k]) byBed[k] = [];
        byBed[k].push(g);
    });
    const beds = [];
    for (let i = 1; i <= cap; i++) {
        const bg = byBed[String(i)] || [];
        // Активный гость — статус active И заезд сегодня или раньше
        const activeGuest = bg.find(g => g.status === 'active' && isArrived(g));
        const nextBooking = bg
            .filter(g => (g.status === 'booking' ||
                (g.status === 'active' && !isArrived(g))) &&
                g !== activeGuest)
            .sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate))[0];
        let status = 'free', displayGuest = null, debt = 0, isTimeout = false, isBonus = false, freeForDays = null;
        let incomingGuest = null, incomingDays = null;
        if (activeGuest) {
            const co      = parseDate(activeGuest.checkOutDate);
            const bonusCo = activeGuest.bonusCheckOutDate ? parseDate(activeGuest.bonusCheckOutDate) : null;
            // Use the later of the two dates (bonus may be outdated after an extension)
            const effectiveCo = (bonusCo && co && bonusCo > co) ? bonusCo : (co || bonusCo);
            const expired = effectiveCo && now > effectiveCo;
            isBonus = !!(bonusCo && co && now > co && now <= bonusCo);
            if (expired && (now - effectiveCo) / 3_600_000 > 28) {
                status = 'free';
            } else {
                displayGuest = activeGuest;
                debt = Math.max(0, (activeGuest.totalPrice || 0) - getTotalPaid(activeGuest));
                isTimeout = !!expired;
                status = isTimeout ? 'timeout' : 'occupied';
                // Входящее бронирование даже при занятой ячейке
                if (nextBooking) {
                    const du = getDaysDiff(now, parseDate(nextBooking.checkInDate));
                    incomingGuest = nextBooking;
                    incomingDays = Math.max(0, du);
                }
            }
        } else if (nextBooking) {
            const du = getDaysDiff(now, parseDate(nextBooking.checkInDate));
            if (du <= 0) { status = 'booking'; displayGuest = nextBooking; }
            else { status = 'free_limited'; displayGuest = nextBooking; freeForDays = du; }
        }
        beds.push({ id: i, status, guest: displayGuest, debt, isTimeout, isBonus, freeForDays, incomingGuest, incomingDays });
    }

    const extraBedIds = Object.keys(byBed).filter(k => !isRegularBedId(k, cap));
    extraBedIds.forEach(extraBedId => {
        const bg = byBed[extraBedId] || [];
        const activeGuest = bg
            .filter(g => g.status === 'active' && isArrived(g))
            .sort((a, b) => new Date(b.checkInDate || 0) - new Date(a.checkInDate || 0))[0];
        const nextBooking = bg
            .filter(g => (g.status === 'booking' || (g.status === 'active' && !isArrived(g))) && g !== activeGuest)
            .sort((a, b) => new Date(a.checkInDate || 0) - new Date(b.checkInDate || 0))[0];

        const showGuest = activeGuest || nextBooking;
        if (!showGuest) return;

        let status = nextBooking && !activeGuest ? 'booking' : 'occupied';
        let debt = 0;
        let isTimeout = false;
        let isBonus = false;

        if (activeGuest) {
            const co = parseDate(activeGuest.checkOutDate);
            const bonusCo = activeGuest.bonusCheckOutDate ? parseDate(activeGuest.bonusCheckOutDate) : null;
            const effectiveCo = (bonusCo && co && bonusCo > co) ? bonusCo : (co || bonusCo);
            const expired = effectiveCo && now > effectiveCo;
            isBonus = !!(bonusCo && co && now > co && now <= bonusCo);
            debt = Math.max(0, (activeGuest.totalPrice || 0) - getTotalPaid(activeGuest));
            isTimeout = !!expired;
            status = isTimeout ? 'timeout' : 'occupied';
        }

        beds.push({
            id: extraBedId,
            status,
            guest: showGuest,
            debt,
            isTimeout,
            isBonus,
            freeForDays: null,
            incomingGuest: null,
            incomingDays: null,
            isExtra: true,
        });
    });

    return beds;
};



// ─────────────────────────────────────────────────────────────────────────────
//  СТРОКА КОМНАТЫ
// ─────────────────────────────────────────────────────────────────────────────
const RoomRow = React.memo(({ room, guests, isAdmin, onEdit, onClone, onDelete, onBedClick, onAddExtraGuest, onKppConfirm, onEndRental, onEditRental, onExtendRental, onPayRental, filter, guestSearch, lang = 'ru', cadastreRegs = [], contractGroups = [], payments = [], allGuests = [] }) => {
    const nowMs = useNow();
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const bedsData = useMemo(() => buildBedsData(room, guests), [room, guests]);

    // ── Rental state (computed here; return deferred until after all hooks) ───
    const rental = room.rental?.active ? room.rental : null;

    const stats = useMemo(() => bedsData.reduce((a, b) => {
        if (b.status === 'occupied' || b.isTimeout || b.status === 'rented_out') a.occ++;
        if (b.status === 'free' || b.status === 'free_limited') a.free++;
        if (b.debt > 0) { a.debtCount++; a.debtSum += b.debt; }
        if (b.isTimeout) a.timeout++;
        if (b.status === 'booking') a.booking++;
        return a;
    }, { occ: 0, free: 0, debtCount: 0, debtSum: 0, timeout: 0, booking: 0 }), [bedsData]);

    const cap    = parseInt(room.capacity) || 1;
    const occPct = Math.min(100, Math.round((stats.occ / cap) * 100));
    const canAddExtraGuest = stats.free === 0;

    if (filter === 'free'     && stats.free === 0)    return null;
    if (filter === 'occupied' && stats.occ === 0)     return null;
    if (filter === 'debt'     && stats.debtSum === 0) return null;
    if (filter === 'timeout'  && stats.timeout === 0) return null;
    if (filter === 'booking'  && stats.booking === 0) return null;
    if (filter === 'rental'   && !room.rental?.active) return null;

    // ── Rental card — light style (matches other rooms) ─────────────
    if (rental) {
        const daysLeft = (() => {
            if (!rental.checkOutStr) return null;
            const today    = new Date(); today.setHours(0, 0, 0, 0);
            const checkout = new Date(rental.checkOutStr + 'T00:00:00');
            return Math.round((checkout - today) / 86400000);
        })();
        // Если аренда привязана к договору — финансы берём из договора
        const contract = rental.contractGroupId ? contractGroups.find(g => g.id === rental.contractGroupId) : null;
        const fin = contract ? computeContractFinancials(contract, allGuests, payments) : null;
        const contractName = contract?.name || rental.contractGroupName || '';
        const charged   = fin ? fin.contractTotal : (rental.totalAmount || 0);
        const totalPaid = fin ? fin.amountPaid : ((rental.paidCash || 0) + (rental.paidCard || 0) + (rental.paidQR || 0));
        const debt      = fin ? Math.max(0, fin.debt) : Math.max(0, charged - totalPaid);
        const totalDays = rental.days || 1;
        const elapsed   = totalDays - Math.max(0, daysLeft ?? totalDays);
        const pct       = Math.min(100, Math.round((elapsed / totalDays) * 100));
        return (
            <div className="group/room bg-white rounded-2xl border border-emerald-100
                            shadow-[0_2px_20px_-6px_rgba(0,0,0,0.06)]
                            hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.1)]
                            transition-all duration-300 overflow-hidden">

                {/* цветная полоска */}
                <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />

                {/* md+ layout */}
                <div className="hidden md:flex flex-row">
                    {/* левая панель */}
                    <div className="w-52 lg:w-60 shrink-0 flex flex-col p-5 border-r border-slate-100 bg-gradient-to-b from-emerald-50/60 to-white">
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <Key size={13} className="text-emerald-500" />
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Аренда</span>
                                </div>
                                <span className="text-4xl font-black text-slate-800 tracking-tighter leading-none">{room.number}</span>
                                {room.name && <div className="text-xs font-semibold text-slate-500 mt-1">{room.name}</div>}
                            </div>
                            <div className="flex flex-col gap-1 opacity-0 group-hover/room:opacity-100 transition-opacity duration-200">
                                <button onClick={() => onEditRental?.(room)} title="Изменить аренду" className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"><Edit size={14}/></button>
                                <button onClick={() => onExtendRental?.(room)} title="Продлить аренду" className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><RefreshCw size={14}/></button>
                                <button onClick={() => onEndRental?.(room)} title="Завершить аренду" className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><LogIn size={14}/></button>
                            </div>
                        </div>
                        <div className="mt-auto">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Период</span>
                                {daysLeft !== null && (
                                    <span className={`text-[10px] font-black ${
                                        daysLeft < 0  ? 'text-rose-500' :
                                        daysLeft <= 1 ? 'text-orange-500' :
                                        'text-emerald-600'
                                    }`}>
                                        {daysLeft < 0  ? `−${Math.abs(daysLeft)} дн.` :
                                         daysLeft === 0 ? 'сегодня' :
                                         `${daysLeft} дн.`}
                                    </span>
                                )}
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700" style={{
                                    width: `${pct}%`,
                                    background: daysLeft < 0 ? 'linear-gradient(90deg,#f87171,#ef4444)' :
                                                daysLeft <= 1 ? 'linear-gradient(90deg,#fb923c,#f97316)' :
                                                'linear-gradient(90deg,#34d399,#10b981)',
                                }} />
                            </div>
                            <div className="text-[10px] font-semibold text-slate-400 mt-1">
                                {rental.checkInDate?.slice(0,10)} → {rental.checkOutStr || rental.checkOutDate?.slice(0,10)}
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-3">
                                <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                                    <Key size={9} /> {rental.days} дн.
                                </span>
                                {debt > 0 && (
                                    <span className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 text-[10px] font-bold flex items-center gap-1">
                                        <Wallet size={9} />{debt.toLocaleString()}
                                    </span>
                                )}
                                {debt === 0 && totalPaid > 0 && (
                                    <span className="px-2 py-1 rounded-lg bg-teal-50 border border-teal-100 text-teal-700 text-[10px] font-bold">
                                        ✓ оплачено
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* правая часть */}
                    <div className="flex-1 p-5 bg-white flex flex-col justify-between gap-3">
                        {/* Арендатор */}
                        <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 shadow-sm">
                                <User size={18} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-slate-800 font-black text-lg leading-tight tracking-tight">{rental.tenantName}</div>
                                <div className="flex flex-wrap gap-2 mt-1.5">
                                    {rental.passport && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-semibold font-mono">
                                            🪪 {rental.passport}
                                        </span>
                                    )}
                                    {rental.phone && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-semibold font-mono">
                                            📞 {rental.phone}
                                        </span>
                                    )}
                                    {rental.staffName && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-semibold font-mono">
                                            {rental.staffName} · {rental.createdAt?.slice(0,10)}
                                        </span>
                                    )}
                                    {contractName && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 text-[11px] font-bold">
                                            <FileText size={11} /> {contractName}
                                        </span>
                                    )}
                                </div>
                                {rental.comment && (
                                    <div className="text-slate-400 text-xs italic mt-1.5 bg-slate-50 rounded-lg px-2 py-1">{rental.comment}</div>
                                )}
                            </div>
                        </div>

                        {/* Финансы + кнопки */}
                        <div className="flex items-end justify-between gap-3 flex-wrap">
                            {charged > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Итого{fin ? ' (договор)' : ''}</div>
                                        <div className="text-slate-700 font-black text-sm font-mono leading-none">{charged.toLocaleString()}</div>
                                    </div>
                                    {totalPaid > 0 && (
                                        <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                                            <div className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-0.5">Внесено</div>
                                            <div className="text-emerald-700 font-black text-sm font-mono leading-none">{totalPaid.toLocaleString()}</div>
                                        </div>
                                    )}
                                    {debt > 0 ? (
                                        <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200">
                                            <div className="text-[9px] font-black uppercase tracking-widest text-rose-400 mb-0.5">Долг</div>
                                            <div className="text-rose-600 font-black text-sm font-mono leading-none">{debt.toLocaleString()}</div>
                                        </div>
                                    ) : totalPaid > 0 && (
                                        <div className="px-3 py-2 rounded-xl bg-teal-50 border border-teal-100 flex items-center gap-1.5">
                                            <CheckCircle2 size={13} className="text-teal-500" />
                                            <div className="text-teal-700 font-black text-xs">Оплачено</div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="flex items-center gap-1.5 shrink-0">
                                {debt > 0 && !contract && (
                                    <button onClick={() => onPayRental?.(room)}
                                        className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-black rounded-xl bg-teal-600 text-white border border-teal-600 hover:bg-teal-700 shadow-sm shadow-teal-200 transition-colors">
                                        <Wallet size={12} /> Оплатить
                                    </button>
                                )}
                                {debt > 0 && contract && (
                                    <span className="px-3 py-2 text-[11px] font-bold rounded-xl bg-teal-50 border border-teal-200 text-teal-700">оплата по договору</span>
                                )}
                                <button onClick={() => onEditRental?.(room)}
                                    className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-colors">
                                    <Edit size={12} /> Изменить
                                </button>
                                <button onClick={() => onExtendRental?.(room)}
                                    className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors">
                                    <RefreshCw size={12} /> Продлить
                                </button>
                                <button onClick={() => onEndRental?.(room)}
                                    className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl bg-slate-100 border border-slate-200 text-slate-500 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-colors">
                                    <LogIn size={12} /> Выселить
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* мобильная версия */}
                <div className="md:hidden">
                    <div className="px-3 py-2.5 flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/80">
                        <span className="text-2xl font-black text-slate-800 leading-none tracking-tighter w-10 shrink-0">{room.number}</span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-slate-700 font-black text-sm">Комната №{room.number}</span>
                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">АРЕНДА</span>
                                {daysLeft !== null && (
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                        daysLeft < 0  ? 'bg-rose-100 text-rose-600' :
                                        daysLeft <= 1 ? 'bg-orange-100 text-orange-600' :
                                        'bg-emerald-100 text-emerald-700'
                                    }`}>
                                        {daysLeft < 0  ? `просрочка ${Math.abs(daysLeft)} дн.` :
                                         daysLeft === 0 ? 'выезд сегодня' :
                                         `${daysLeft} дн. осталось`}
                                    </span>
                                )}
                            </div>
                            <div className="text-slate-400 text-[10px] font-mono mt-0.5">
                                {rental.checkInDate?.slice(0,10)} → {rental.checkOutStr || rental.checkOutDate?.slice(0,10)} · {rental.days} дн.
                            </div>
                        </div>
                    </div>
                    <div className="px-3 py-2.5 bg-white">
                        <div className="text-slate-800 font-black text-sm">{rental.tenantName}</div>
                        <div className="flex gap-2 mt-0.5 flex-wrap items-center">
                            {rental.passport && <span className="text-slate-400 text-[10px] font-mono">🪪 {rental.passport}</span>}
                            {rental.phone    && <span className="text-slate-400 text-[10px] font-mono">{rental.phone}</span>}
                            {contractName && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-bold"><FileText size={9} />{contractName}</span>}
                        </div>
                        {charged > 0 && (
                            <div className="flex gap-4 mt-1.5">
                                <span className="text-slate-600 font-black text-xs font-mono">{charged.toLocaleString()} сум{fin ? ' · договор' : ''}</span>
                                {debt > 0 && <span className="text-rose-600 font-black text-xs font-mono">долг {debt.toLocaleString()}</span>}
                                {debt === 0 && totalPaid > 0 && <span className="text-emerald-600 font-bold text-xs">✓ оплачено</span>}
                            </div>
                        )}
                    </div>
                    <div className="px-3 pb-3 flex items-center gap-1.5 bg-white flex-wrap">
                        {debt > 0 && !contract && (
                            <button onClick={() => onPayRental?.(room)}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-black rounded-lg bg-teal-600 text-white border border-teal-600 hover:bg-teal-700 transition-colors">
                                <Wallet size={11} /> Оплатить
                            </button>
                        )}
                        <button onClick={() => onEditRental?.(room)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-amber-50 border border-amber-100 text-amber-600 hover:bg-amber-100 transition-colors">
                            <Edit size={11} /> Изменить
                        </button>
                        <button onClick={() => onExtendRental?.(room)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 hover:bg-emerald-100 transition-colors">
                            <RefreshCw size={11} /> Продлить
                        </button>
                        <button onClick={() => onEndRental?.(room)}
                            className="ml-auto flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors">
                            <LogIn size={11} /> Завершить
                        </button>
                    </div>
                </div>
            </div>
        );
    }

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
                    {stats.timeout > 0 && <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[9px] font-black">{stats.timeout}{t('bedsTimeoutShort')}</span>}
                    {stats.booking > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-black">{stats.booking}{t('bedsBookingShort')}</span>}
                </div>

                {/* Кнопка доп-гостя */}
                {canAddExtraGuest && (
                    <button
                        onClick={() => onAddExtraGuest?.(room)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-100 text-orange-700 text-[10px] font-black hover:bg-orange-200 transition-colors shrink-0"
                        title="Заселить доп. гостя"
                    >
                        <ExtraBedIcon size={12} />
                        <span>+</span>
                    </button>
                )}

                {/* Админ-кнопки */}
                {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                        <button onClick={onEdit}   className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg"><Edit   size={13}/></button>
                        <button onClick={onClone}  className="p-1.5 text-slate-400 hover:text-sky-600   rounded-lg"><Copy   size={13}/></button>
                        <button onClick={onDelete} className="p-1.5 text-slate-400 hover:text-rose-600  rounded-lg"><Trash2 size={13}/></button>
                    </div>
                )}
            </div>

            {/* Мобильная сетка коек */}
            <div className="md:hidden px-3 py-3 bg-slate-50 overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 w-max">
                {visibleBeds.map(bed => {
                    if (filter === 'debt'     && bed.debt <= 0 && bed.status !== 'free') return null;
                    if (filter === 'free'     && bed.status !== 'free' && bed.status !== 'free_limited') return null;
                    if (filter === 'occupied' && bed.status !== 'occupied' && !bed.isTimeout && bed.status !== 'free') return null;
                    if (filter === 'timeout'  && !bed.isTimeout && bed.status !== 'free') return null;
                    if (filter === 'booking'  && bed.status !== 'booking' && bed.status !== 'free') return null;
                    return (
                        <div key={bed.id} className="w-36 shrink-0">
                            <BedCell bed={bed} onBedClick={(bedId, g, action) => onBedClick(room, bedId, g, action)} onKppConfirm={onKppConfirm} nowMs={nowMs} lang={lang} cadastreRegs={cadastreRegs} />
                        </div>
                    );
                })}
                </div>
            </div>

            {/* md+ боковая панель */}
            <div className="hidden md:flex flex-row">
                <div className="w-52 lg:w-60 shrink-0 flex flex-col p-5 border-r border-slate-100 bg-gradient-to-b from-slate-50/80 to-white">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <Building2 size={13} className="text-slate-400" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('room')}</span>
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
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t('roomCapacity')}</span>
                            <span className="text-xs font-black text-slate-700">{stats.occ}/{cap}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${
                                occPct === 100 ? 'bg-gradient-to-r from-indigo-500 to-purple-500' :
                                occPct >= 60   ? 'bg-gradient-to-r from-teal-400 to-emerald-500' :
                                                 'bg-gradient-to-r from-emerald-300 to-teal-400'
                            }`} style={{ width: `${occPct}%` }} />
                        </div>
                        <div className="text-[10px] font-semibold text-slate-400 mt-1">{occPct}% {t('occupied')}</div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                            <Sparkline guests={guests} capacity={room.capacity} lang={lang} />
                            {canAddExtraGuest && (
                                <button
                                    onClick={() => onAddExtraGuest?.(room)}
                                    title="Заселить доп. гостя"
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-100 border border-orange-200 text-orange-700 text-[10px] font-black hover:bg-orange-200 transition-colors shrink-0"
                                >
                                    <ExtraBedIcon size={12} />
                                    <span>Доп. гость</span>
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {stats.free > 0 && <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold">{stats.free} {t('bedsFreeShort')}</span>}
                            {stats.debtSum > 0 && <span className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 text-[10px] font-bold flex items-center gap-1"><Wallet size={9}/>{fmt(stats.debtSum)}</span>}
                            {stats.timeout > 0 && <span className="px-2 py-1 rounded-lg bg-purple-50 border border-purple-100 text-purple-700 text-[10px] font-bold flex items-center gap-1"><Clock size={9}/>{stats.timeout} {t('bedsTimeoutShort')}</span>}
                            {stats.booking > 0 && <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold flex items-center gap-1"><CalendarDays size={9}/>{stats.booking} {t('bedsBookingShort')}</span>}
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
                                <BedCell key={bed.id} bed={bed} onBedClick={(bedId, g, action) => onBedClick(room, bedId, g, action)} onKppConfirm={onKppConfirm} nowMs={nowMs} lang={lang} cadastreRegs={cadastreRegs} />
                        );
                    })}
                    </div>
                </div>
        </div>
        </div>
    );
});
RoomRow.displayName = 'RoomRow';

// ─────────────────────────────────────────────────────────────────────────────
//  ГЛАВНЫЙ КОМПОНЕНТ
// ─────────────────────────────────────────────────────────────────────────────
const RoomsView = ({
    filteredRooms, guestsByRoom, currentUser,
    onBedClick, onAddExtraGuest, onEditRoom, onCloneRoom, onDeleteRoom, onAddRoom, onKppConfirm, onExportGuests, onOpenGroupReceipt, onEndRental, onEditRental, onExtendRental, onPayRental, lang = 'ru', cadastreRegs = [],
    contractGroups = [], payments = [], allGuests = [],
}) => {
    const [filter, setFilter]           = useState('all');
    const [guestSearch, setGuestSearch] = useState('');
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;

    const FILTERS = [
        { key: 'all',      label: t('all'),             icon: Layers        },
        { key: 'free',     label: t('filterFree'),       icon: Plus          },
        { key: 'occupied', label: t('filterOccupied'),   icon: Users         },
        { key: 'debt',     label: t('debts'),            icon: Wallet        },
        { key: 'timeout',  label: t('filterTimeout'),    icon: AlertTriangle },
        { key: 'booking',  label: t('filterBooking'),    icon: CalendarDays  },
        { key: 'rental',   label: 'Аренда',              icon: Key           },
    ];

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
            // Долг по активной аренде комнаты (с учётом договора, если привязан)
            if (r.rental?.active) {
                const rt = r.rental;
                const grp = rt.contractGroupId ? contractGroups.find(g => g.id === rt.contractGroupId) : null;
                const fin = grp ? computeContractFinancials(grp, allGuests, payments) : null;
                const rDebt = fin
                    ? Math.max(0, fin.debt)
                    : Math.max(0, (rt.totalAmount || 0) - ((rt.paidCash || 0) + (rt.paidCard || 0) + (rt.paidQR || 0) + (rt.paidTransfer || 0)));
                if (rDebt > 0) debtSum += rDebt;
            }
        });
        return { beds, occ, free, debtSum, timeoutCount };
    }, [filteredRooms, guestsByRoom, contractGroups, payments, allGuests]);

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
                            placeholder={t('searchByName')}
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

                    <button
                        onClick={onOpenGroupReceipt}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all duration-200 shrink-0 shadow-sm active:scale-95"
                        title="Лист в бухгалтерию"
                    >
                        <FileText size={14} strokeWidth={3} />
                        <span className="hidden sm:inline">Лист</span>
                    </button>

                    {isAdmin && (
                        <button
                            onClick={onAddRoom}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500
                                       text-white text-xs font-bold transition-all duration-200 shrink-0
                                       shadow-[0_4px_14px_-4px_rgba(79,70,229,0.5)] active:scale-95"
                        >
                            <Plus size={14} strokeWidth={3} />
                            <span>{t('new')}</span>
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
                        <BedDouble size={11} className="text-slate-400" />{totals.beds} {t('kpiBeds')}
                    </span>
                    <span className="text-slate-200">·</span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-teal-600">
                        <Users size={11} />{totals.occ} {t('occupied')}
                    </span>
                    <span className="text-slate-200">·</span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                        <TrendingUp size={11} />{totals.free} {t('free')}
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
                            <AlertTriangle size={11} />{totals.timeoutCount} {t('overdueBadge')}
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
                        onAddExtraGuest={onAddExtraGuest}
                        onKppConfirm={onKppConfirm}
                        onEndRental={onEndRental}
                        onEditRental={onEditRental}
                        onExtendRental={onExtendRental}
                        onPayRental={onPayRental}
                        filter={filter}
                        guestSearch={guestSearch}
                        lang={lang}
                        cadastreRegs={cadastreRegs}
                        contractGroups={contractGroups}
                        payments={payments}
                        allGuests={allGuests}
                    />
                ))}

                {filteredRooms.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-5">
                            <BedDouble size={40} className="text-slate-300" strokeWidth={1.5} />
                        </div>
                        <span className="text-lg font-black text-slate-400">{t('roomsNotFound')}</span>
                        <span className="text-sm font-medium text-slate-400 mt-1">{t('tryFiltersHint')}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RoomsView;