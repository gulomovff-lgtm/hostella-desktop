import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Search,
    BedDouble, Building2, Check, Clock, Wallet, AlertCircle, User
} from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

// --- Utilities ---
const getTotalPaid = (g) => (typeof g.amountPaid === 'number' ? g.amountPaid : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0)));

const parseDate = (dateInput) => {
    if (!dateInput) return null;
    const date = new Date(dateInput);
    if (typeof dateInput === 'string' && !dateInput.includes('T')) {
        date.setHours(12, 0, 0, 0);
    }
    return date;
};

const getLocalDateString = (dateObj) => {
    if (!dateObj) return '';
    const offset = dateObj.getTimezoneOffset() * 60000;
    return new Date(dateObj.getTime() - offset).toISOString().slice(0, 10);
};

const COUNTRY_FLAGS = {
  "Узбекистан":"UZ","Россия":"RU","Казахстан":"KZ","Таджикистан":"TJ","Кыргызстан":"KG","Абхазия":"GE",
  "Австралия":"AU","Австрия":"AT","Азербайджан":"AZ","Германия":"DE","Великобритания":"GB","США":"US",
  "Китай":"CN","Индия":"IN","Турция":"TR","ОАЭ":"AE","Корея (Южная)":"KR","Япония":"JP",
  "Франция":"FR","Италия":"IT","Испания":"ES","Польша":"PL","Украина":"UA","Пакистан":"PK"
};

const FLAG_SIZES = [20, 40, 80, 160, 320];
const snapFlagSize = (s) => FLAG_SIZES.find(f => f >= s) || 320;
const Flag = ({ code, size = 20 }) => {
    if (!code) return null;
    const w = snapFlagSize(size);
    const w2 = snapFlagSize(size * 2);
    const h = Math.round(size * 0.75);
    return (
        <img
            src={`https://flagcdn.com/w${w}/${code.toLowerCase()}.png`}
            srcSet={`https://flagcdn.com/w${w2}/${code.toLowerCase()}.png 2x`}
            width={size} height={h} alt={code}
            style={{ display:'inline-block', objectFit:'cover', borderRadius:2, verticalAlign:'middle', flexShrink:0 }}
        />
    );
};

// --- GuestTooltip ---
const GuestTooltip = ({ guest, room, mousePos, lang }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const totalPaid = getTotalPaid(guest);
    const debt = (guest.totalPrice || 0) - totalPaid;
    const now = new Date();
    const checkIn = new Date(guest.checkInDate);
    let checkOut = new Date(guest.checkOutDate);
    if (isNaN(checkOut.getTime())) {
        checkOut = new Date(checkIn);
        checkOut.setDate(checkOut.getDate() + parseInt(guest.days));
    }
    checkOut.setHours(12, 0, 0, 0);
    const isExpired = now >= checkOut;
    const daysTotal = parseInt(guest.days);
    const daysStayed = Math.min(daysTotal, Math.max(0, Math.ceil((now - checkIn) / (1000 * 60 * 60 * 24))));
    const daysLeft = Math.max(0, daysTotal - daysStayed);
    const tooltipWidth = 320, tooltipHeight = 400, offset = 15;
    let x = mousePos.x + offset, y = mousePos.y + offset;
    if (x + tooltipWidth > window.innerWidth) x = mousePos.x - tooltipWidth - offset;
    if (y + tooltipHeight > window.innerHeight) y = mousePos.y - tooltipHeight - offset;
    if (x < 10) x = 10;
    if (y < 10) y = 10;
    return (
        <div className="fixed z-[100] bg-slate-900 text-white rounded-2xl shadow-2xl p-5 min-w-[320px] animate-in fade-in zoom-in-95 duration-200 pointer-events-none border border-slate-700/50"
            style={{ left:`${x}px`, top:`${y}px` }}>
            <div className="border-b border-white/10 pb-4 mb-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                        <h4 className="font-black text-xl text-white mb-1 tracking-tight">{guest.fullName}</h4>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                            <span className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded"><User size={10}/> {guest.passport || 'Нет пасп.'}</span>
                            <span>{guest.country}</span>
                        </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm ${
                        guest.status==='booking'?'bg-amber-500 text-white':
                        guest.status==='checked_out'?'bg-slate-600 text-slate-200':
                        isExpired?'bg-rose-500 text-white':
                        debt>0?'bg-orange-500 text-white':'bg-emerald-500 text-white'}`}>
                        {guest.status==='booking'?'Бронь':guest.status==='checked_out'?'Выселен':isExpired?'Просрочен':debt>0?'Долг':'Оплачено'}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
                {[['Комната',`№${guest.roomNumber} / Место ${guest.bedId}`],['Период',`${guest.days} дн.`],
                  ['Заезд',new Date(guest.checkInDate).toLocaleDateString()],['Выезд',checkOut.toLocaleDateString()]
                ].map(([l,v])=>(
                    <div key={l} className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1">{l}</div>
                        <div className="text-sm font-bold text-white">{v}</div>
                    </div>
                ))}
            </div>
            {guest.status !== 'booking' && (
                <div className="bg-slate-800/50 rounded-xl p-4 mb-4 border border-white/5">
                    <div className="flex justify-between items-center mb-2"><span className="text-xs font-bold text-slate-400 uppercase">К оплате</span><span className="font-bold text-lg">{guest.totalPrice?.toLocaleString()}</span></div>
                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/10"><span className="text-xs font-bold text-slate-400 uppercase">Оплачено</span><span className="font-bold text-emerald-400 text-lg">{totalPaid.toLocaleString()}</span></div>
                    {debt > 0
                        ? <div className="flex justify-between items-center pt-1"><span className="text-xs font-bold text-rose-400 uppercase">Остаток долга</span><span className="font-black text-rose-400 text-xl">-{debt.toLocaleString()}</span></div>
                        : <div className="text-center text-xs font-bold text-emerald-500 uppercase pt-1">Вся сумма оплачена</div>}
                </div>
            )}
            {guest.status === 'active' && !isExpired && (
                <div className="bg-slate-800/30 rounded-xl p-3 border border-white/5">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mb-2"><span>Прогресс</span><span>{daysStayed}/{daysTotal} дн.</span></div>
                    <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                            style={{ width:`${Math.min(100,(daysStayed/daysTotal)*100)}%` }}/>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                        <div className="text-xs font-bold text-slate-300">Осталось: <span className="text-white">{daysLeft} дн.</span></div>
                        {debt > 0 && <div className="text-[9px] font-bold text-rose-400 bg-rose-400/10 px-1.5 py-0.5 rounded-md uppercase">Есть долг</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- CalendarView ---
const CalendarView = ({ rooms, guests, onSlotClick, lang, currentUser, onDeleteGuest, onRescheduleGuest }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const [startDate, setStartDate]   = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
    const [zoom, setZoom]             = useState(21);
    const [colScale, setColScale]     = useState(1.0);
    const [search, setSearch]         = useState('');
    const [hoveredGuest, setHoveredGuest] = useState(null);
    const [mousePos, setMousePos]     = useState({ x: 0, y: 0 });
    const [dragData, setDragData]     = useState(null);
    const ttRef = useRef(null);
    const rafRef = useRef(null);
    const calRef = useRef(null);
    const BASE_DAY_W = zoom <= 14 ? 60 : zoom <= 21 ? 46 : 38;
    const DAY_W = Math.round(BASE_DAY_W * colScale);
    const ROW_H = 40;
    const LABEL_W = 148;

    useEffect(() => {
        const el = calRef.current;
        if (!el) return;
        const onWheel = (e) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setColScale(s => Math.min(4, Math.max(0.4, parseFloat((s + delta).toFixed(2)))));
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);

    useEffect(() => {
        const onKey = (e) => {
            if (!e.ctrlKey) return;
            if (e.key === '=' || e.key === '+') { e.preventDefault(); setColScale(s => Math.min(4, parseFloat((s + 0.1).toFixed(2)))); }
            if (e.key === '-')                  { e.preventDefault(); setColScale(s => Math.max(0.4, parseFloat((s - 0.1).toFixed(2)))); }
            if (e.key === '0')                  { e.preventDefault(); setColScale(1.0); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const goToday  = useCallback(() => { const d = new Date(); d.setHours(0,0,0,0); setStartDate(d); }, []);
    const shift    = useCallback((n) => setStartDate(p => { const d = new Date(p); d.setDate(d.getDate() + n); return d; }), []);

    const days = useMemo(() => Array.from({ length: zoom }, (_, i) => {
        const d = new Date(startDate); d.setDate(d.getDate() + i);
        return { date: d, str: getLocalDateString(d), day: d.getDate(), wd: d.getDay(), month: d.getMonth() };
    }), [startDate, zoom]);

    const todayStr = getLocalDateString(new Date());

    const relevantGuests = useMemo(() => {
        const rangeStart = days[0].date;
        const rangeEnd   = new Date(days[days.length - 1].date); rangeEnd.setHours(23,59,59,999);
        const seen = new Set();
        return guests.filter(g => {
            if (seen.has(g.id)) return false; seen.add(g.id);
            const ci = parseDate(g.checkInDate || g.checkInDateTime);
            const co = parseDate(g.checkOutDate);
            if (!ci) return false;
            if (co && co < rangeStart) return false;
            if (ci > rangeEnd) return false;
            return true;
        });
    }, [guests, days]);

    const filteredGuests = useMemo(() => {
        if (!search.trim()) return relevantGuests;
        const q = search.toLowerCase();
        return relevantGuests.filter(g => g.fullName?.toLowerCase().includes(q) || String(g.roomNumber).includes(q));
    }, [relevantGuests, search]);

    const guestBars = useMemo(() => {
        const rangeStartMs = days[0].date.getTime();
        const result = {};
        filteredGuests.forEach(g => {
            let ci = parseDate(g.checkInDate || g.checkInDateTime);
            let co = parseDate(g.checkOutDate);
            if (!ci) return;
            if (!co) { co = new Date(ci); co.setDate(co.getDate() + parseInt(g.days || 1)); }
            ci = new Date(ci); ci.setHours(12,0,0,0);
            co = new Date(co); co.setHours(12,0,0,0);
            const startPx = Math.max(0, (ci.getTime() - rangeStartMs) / 86400000 * DAY_W);
            const endPx   = (co.getTime() - rangeStartMs) / 86400000 * DAY_W;
            const widthPx = Math.max(DAY_W, endPx - startPx);
            if (endPx <= 0 || startPx >= zoom * DAY_W) { result[g.id] = null; return; }
            result[g.id] = { left: startPx, width: Math.min(widthPx, zoom * DAY_W - startPx) };
        });
        return result;
    }, [filteredGuests, days, DAY_W, zoom]);

    const dailyOcc = useMemo(() => {
        const totalBeds = rooms.reduce((s, r) => s + parseInt(r.capacity || 0), 0);
        return days.map(d => {
            const count = filteredGuests.filter(g => {
                if (g.status === 'checked_out') return false;
                const ci = parseDate(g.checkInDate || g.checkInDateTime);
                const co = parseDate(g.checkOutDate);
                if (!ci) return false;
                const ciStr = getLocalDateString(ci);
                const coStr = co ? getLocalDateString(co) : null;
                return ciStr <= d.str && (!coStr || coStr > d.str);
            }).length;
            return { count, pct: totalBeds ? Math.min(100, Math.round((count / totalBeds) * 100)) : 0 };
        });
    }, [filteredGuests, days, rooms]);

    const getBarStyle = useCallback((g) => {
        const paid  = getTotalPaid(g);
        const debt  = (g.totalPrice || 0) - paid;
        const isOut = g.status === 'checked_out';
        const isBk  = g.status === 'booking';
        const co    = parseDate(g.checkOutDate);
        const isExp = co && new Date() > co && !isOut;
        const pct   = g.totalPrice ? Math.min(100, Math.round((paid / g.totalPrice) * 100)) : 100;
        if (isBk)  return { cls: 'border-yellow-500 text-yellow-900', bg: '#fef08a' };
        if (isExp) return { cls: 'border-red-700 text-white', bg: '#dc2626' };
        if (isOut && debt > 0) return { cls: 'border-rose-300 text-rose-700', bg: '#fecdd3' };
        if (isOut) return { cls: 'border-slate-300 text-slate-500', bg: '#e2e8f0' };
        if (debt > 0 && paid > 0) return { cls: 'border-red-600 text-white', bg: `linear-gradient(90deg,#22c55e 0%,#16a34a ${pct}%,#ef4444 ${pct}%,#dc2626 100%)` };
        if (debt > 0) return { cls: 'border-red-600 text-white', bg: '#ef4444' };
        return { cls: 'border-green-700 text-white', bg: '#22c55e' };
    }, []);

    const onMove = useCallback((e) => {
        if (rafRef.current) return;
        const x = e.clientX, y = e.clientY;
        rafRef.current = requestAnimationFrame(() => { setMousePos({ x, y }); rafRef.current = null; });
    }, []);
    const onEnter = useCallback((e, g) => {
        if (ttRef.current) clearTimeout(ttRef.current);
        setMousePos({ x: e.clientX, y: e.clientY });
        ttRef.current = setTimeout(() => setHoveredGuest(g), 60);
    }, []);
    const onLeave = useCallback(() => { if (ttRef.current) clearTimeout(ttRef.current); setHoveredGuest(null); }, []);

    const handleEmptyClick = useCallback((room, bedId, dayStr, isRight) => {
        const d = new Date(dayStr);
        if (!isRight) d.setDate(d.getDate() - 1);
        d.setHours(12, 0, 0, 0);
        onSlotClick(room, bedId, null, d.toISOString());
    }, [onSlotClick]);

    const sortedRooms = useMemo(() => [...rooms].sort((a, b) => parseInt(a.number) - parseInt(b.number)), [rooms]);

    const monthLabel = useMemo(() => {
        const months = days.reduce((acc, d) => { const k = `${d.date.getFullYear()}-${d.month}`; acc[k] = d.date; return acc; }, {});
        return Object.values(months).map(d => d.toLocaleDateString('ru', { month: 'long', year: 'numeric' })).join(' / ');
    }, [days]);

    const WDAY = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    const totalWidth = LABEL_W + zoom * DAY_W;

    return (
        <div ref={calRef} className="flex flex-col h-full overflow-hidden bg-slate-100" onMouseMove={onMove}>
            {/* Toolbar — desktop */}
            <div className="hidden md:flex flex-wrap items-center gap-2 px-3 py-2 bg-white border-b border-slate-200 shadow-sm z-50 shrink-0">
                <div className="flex items-center gap-1">
                    <button onClick={() => shift(-7)} title="-7 дней" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 border border-slate-200"><ChevronsLeft size={15}/></button>
                    <button onClick={() => shift(-1)} title="-1 день" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 border border-slate-200"><ChevronLeft size={15}/></button>
                    <button onClick={goToday} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700 shadow-sm">Сегодня</button>
                    <button onClick={() => shift(1)} title="+1 день" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 border border-slate-200"><ChevronRight size={15}/></button>
                    <button onClick={() => shift(7)} title="+7 дней" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 border border-slate-200"><ChevronsRight size={15}/></button>
                </div>
                <div className="text-sm font-bold text-slate-700 px-2 capitalize">{monthLabel}</div>
                <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 border border-slate-200 ml-auto">
                    {[7, 14, 21, 30].map(z => (
                        <button key={z} onClick={() => setZoom(z)} className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${zoom === z ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{z}д</button>
                    ))}
                </div>
                <div className="flex items-center gap-1 border border-slate-200 rounded-lg bg-slate-50 px-2 py-1">
                    <button onClick={() => setColScale(s => Math.max(0.4, parseFloat((s-0.1).toFixed(2))))} className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 text-slate-500 text-sm font-bold">-</button>
                    <span className="text-[11px] font-bold text-slate-600 w-9 text-center select-none">{Math.round(colScale*100)}%</span>
                    <button onClick={() => setColScale(s => Math.min(4, parseFloat((s+0.1).toFixed(2))))} className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 text-slate-500 text-sm font-bold">+</button>
                    {colScale !== 1.0 && <button onClick={() => setColScale(1.0)} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 ml-0.5">0</button>}
                </div>
                <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск гостя…" className="pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-36"/>
                </div>
                <div className="hidden lg:flex items-center gap-3 text-[10px] font-bold text-slate-500 border-l border-slate-200 pl-3 ml-1">
                    {[{bg:'#22c55e',label:'Оплачено'},{bg:'#fef08a',label:'Бронь',border:'#ca8a04'},{bg:'#ef4444',label:'Долг'},{bg:'#dc2626',label:'Просрочен'},{bg:'#e2e8f0',label:'Выселен',border:'#94a3b8'}].map(l => (
                        <div key={l.label} className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded inline-block flex-shrink-0 border" style={{ background:l.bg, borderColor:l.border||l.bg }}/>
                            {l.label}
                        </div>
                    ))}
                </div>
            </div>

            {/* Toolbar — mobile (2 строки) */}
            <div className="md:hidden shrink-0 bg-white border-b border-slate-200 shadow-sm z-50">
                {/* Строка 1: навигация + заголовок */}
                <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
                    <button onClick={() => shift(-7)} className="p-2 rounded-lg bg-slate-100 text-slate-600 active:bg-slate-200"><ChevronsLeft size={16}/></button>
                    <button onClick={() => shift(-1)} className="p-2 rounded-lg bg-slate-100 text-slate-600 active:bg-slate-200"><ChevronLeft size={16}/></button>
                    <button onClick={goToday} className="flex-1 py-2 bg-slate-800 text-white rounded-lg text-xs font-black active:bg-slate-700">Сегодня</button>
                    <div className="flex-[2] text-center text-xs font-bold text-slate-700 capitalize leading-tight truncate px-1">{monthLabel}</div>
                    <button onClick={() => shift(1)} className="p-2 rounded-lg bg-slate-100 text-slate-600 active:bg-slate-200"><ChevronRight size={16}/></button>
                    <button onClick={() => shift(7)} className="p-2 rounded-lg bg-slate-100 text-slate-600 active:bg-slate-200"><ChevronsRight size={16}/></button>
                </div>
                {/* Строка 2: зум + поиск */}
                <div className="flex items-center gap-2 px-2 pb-2">
                    <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 shrink-0">
                        {[7, 14, 21, 30].map(z => (
                            <button key={z} onClick={() => setZoom(z)}
                                className={`px-2.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                                    zoom === z ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'
                                }`}>{z}д</button>
                        ))}
                    </div>
                    <div className="relative flex-1">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск гостя…"
                            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none"/>
                    </div>
                </div>
            </div>

            {/* Scrollable grid */}
            <div className="flex-1 overflow-auto">
                <div style={{ minWidth: totalWidth }}>
                    {/* Date header */}
                    <div className="flex sticky top-0 z-40 bg-white border-b-2 border-slate-200 shadow-sm" style={{ height: 42 }}>
                        <div className="shrink-0 flex items-center justify-center bg-slate-50 border-r-2 border-slate-300 text-[10px] font-black text-slate-400 uppercase tracking-wide sticky left-0 z-50" style={{ width: LABEL_W }}>
                            Номер / Место
                        </div>
                        {days.map((d, i) => {
                            const isToday = d.str === todayStr;
                            const isSun = d.wd === 0, isSat = d.wd === 6, isNew = d.day === 1 || i === 0;
                            return (
                                <div key={d.str} className={`shrink-0 relative flex flex-col items-center justify-center border-r select-none
                                    ${isToday ? 'bg-indigo-600 text-white' : isSun || isSat ? 'bg-amber-50 text-amber-700' : 'bg-white text-slate-600'}
                                    ${i > 0 ? 'border-slate-200' : ''}`} style={{ width: DAY_W }}>
                                    {isNew && <span className={`absolute -left-px top-0 h-full w-0.5 ${isToday ? 'bg-indigo-400' : 'bg-slate-300'}`}/>}
                                    {isNew && <span className={`absolute top-0 left-1 text-[8px] font-black uppercase ${isToday ? 'text-indigo-200' : 'text-slate-400'}`}>{d.date.toLocaleDateString('ru',{month:'short'})}</span>}
                                    <span className={`text-[9px] font-bold uppercase leading-none mt-1 ${isToday ? 'text-indigo-200' : isSun||isSat ? 'text-amber-500' : 'text-slate-400'}`}>{WDAY[d.wd]}</span>
                                    <span className={`text-sm font-black leading-tight ${isToday ? 'text-white' : ''}`}>{d.day}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Occupancy summary row */}
                    <div className="flex sticky top-[42px] z-30 bg-white border-b border-slate-200" style={{ height: 22 }}>
                        <div className="shrink-0 flex items-center justify-center bg-slate-50 border-r-2 border-slate-300 text-[9px] font-black text-slate-400 uppercase sticky left-0 z-40" style={{ width: LABEL_W }}>Загрузка</div>
                        {dailyOcc.map((o, i) => {
                            const isToday = days[i].str === todayStr;
                            const color = o.pct >= 90 ? '#10b981' : o.pct >= 60 ? '#f59e0b' : o.pct >= 30 ? '#6366f1' : '#94a3b8';
                            return (
                                <div key={i} className={`shrink-0 flex flex-col items-center justify-center border-r border-slate-100 ${isToday ? 'bg-indigo-50' : ''}`} style={{ width: DAY_W }}>
                                    <div className="w-full px-0.5" style={{ height: 4 }}><div style={{ width:`${o.pct}%`, height:'100%', background:color, borderRadius:2 }}/></div>
                                    <span className="text-[8px] font-black leading-none" style={{ color }}>{o.count || ''}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Room rows */}
                    {sortedRooms.map(room => {
                        const roomGuests = filteredGuests.filter(g => g.roomId === room.id && g.status !== 'checked_out');
                        const occupied = roomGuests.length;
                        const capNum = parseInt(room.capacity || 0);
                        const occPct = capNum ? Math.round((occupied / capNum) * 100) : 0;
                        const occColor = occPct >= 90 ? 'text-emerald-600 bg-emerald-50' : occPct >= 50 ? 'text-amber-600 bg-amber-50' : 'text-slate-500 bg-slate-100';
                        return (
                            <div key={room.id} className="border-b-2 border-slate-300">
                                <div className="flex items-center border-b border-slate-200 bg-slate-100" style={{ height: 28 }}>
                                    <div className="shrink-0 flex items-center justify-between px-3 border-r-2 border-slate-300 sticky left-0 z-20 bg-slate-100" style={{ width: LABEL_W }}>
                                        <span className="flex items-center gap-1.5 font-black text-xs text-slate-700 whitespace-nowrap"><Building2 size={11} className="text-slate-500"/>№{room.number}</span>
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${occColor}`}>{occupied}/{capNum}</span>
                                    </div>
                                    {days.map((d) => {
                                        const isToday = d.str === todayStr;
                                        return <div key={d.str} className={`shrink-0 border-r border-slate-200 ${isToday ? 'bg-indigo-100' : ''}`} style={{ width: DAY_W, height:'100%' }}/>;
                                    })}
                                </div>
                                {Array.from({ length: capNum }, (_, i) => i + 1).map(bedId => {
                                    const bedGuests = filteredGuests.filter(g => g.roomId === room.id && String(g.bedId) === String(bedId));
                                    const hasCurrent = bedGuests.some(g => g.status === 'active');
                                    return (
                                        <div key={bedId} className={`flex relative border-b border-slate-100 group/row ${hasCurrent ? '' : 'bg-white'}`} style={{ height: ROW_H }}>
                                            <div className={`shrink-0 flex items-center gap-2 px-3 border-r-2 border-slate-200 sticky left-0 z-20 text-xs font-bold text-slate-500 ${hasCurrent ? 'bg-emerald-50' : 'bg-white'}`} style={{ width: LABEL_W }}>
                                                <BedDouble size={13} className={hasCurrent ? 'text-emerald-500' : 'text-slate-300'}/>
                                                <span>Место {bedId}</span>
                                                {!hasCurrent && <span className="ml-auto text-[9px] text-emerald-500 font-black">свободно</span>}
                                            </div>
                                            <div className="relative flex-1" style={{ width: zoom * DAY_W }}>
                                                <div className="absolute inset-0 flex pointer-events-none">
                                                    {days.map((d, i) => {
                                                        const isToday = d.str === todayStr;
                                                        const isSat = d.wd === 6, isSun = d.wd === 0;
                                                        return (
                                                            <div key={d.str} className={`shrink-0 h-full border-r flex ${isToday?'bg-indigo-50/70 border-indigo-200':isSat||isSun?'bg-amber-50/40 border-amber-100':'border-slate-100'}`}
                                                                style={{ width: DAY_W }}
                                                                onDragOver={dragData ? (e) => e.preventDefault() : undefined}
                                                                onDrop={dragData ? (e) => {
                                                                    e.preventDefault();
                                                                    try {
                                                                        const { guestId, offsetDays, duration } = JSON.parse(e.dataTransfer.getData('text/plain'));
                                                                        const newCi = new Date(d.date); newCi.setHours(12,0,0,0); newCi.setDate(newCi.getDate() - offsetDays);
                                                                        const newCo = new Date(newCi); newCo.setDate(newCo.getDate() + duration);
                                                                        const g2 = filteredGuests.find(x => x.id === guestId);
                                                                        if (g2?.status==='checked_out' && onRescheduleGuest) onRescheduleGuest(guestId, getLocalDateString(newCi), getLocalDateString(newCo));
                                                                    } catch {}
                                                                    setDragData(null);
                                                                } : undefined}>
                                                                <div className="w-1/2 h-full pointer-events-auto hover:bg-indigo-100/50 cursor-pointer border-r border-dashed border-slate-100/60" onClick={() => handleEmptyClick(room, bedId, d.str, false)}/>
                                                                <div className="w-1/2 h-full pointer-events-auto hover:bg-indigo-100/50 cursor-pointer" onClick={() => handleEmptyClick(room, bedId, d.str, true)}/>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {bedGuests.map(g => {
                                                    const bar = guestBars[g.id];
                                                    if (!bar) return null;
                                                    const style = getBarStyle(g);
                                                    const paid = getTotalPaid(g);
                                                    const debt = (g.totalPrice || 0) - paid;
                                                    const isOut = g.status === 'checked_out';
                                                    const isBk  = g.status === 'booking';
                                                    const co    = parseDate(g.checkOutDate);
                                                    const isExp = co && new Date() > co && !isOut;
                                                    const days_count = g.days || Math.round((co?.getTime() - parseDate(g.checkInDate||g.checkInDateTime)?.getTime()) / 86400000) || 1;
                                                    return (
                                                        <div key={g.id}
                                                            className={`absolute top-1.5 bottom-1.5 rounded-md border cursor-pointer flex items-center overflow-hidden hover:brightness-105 z-10 ${style.cls} ${isOut&&onRescheduleGuest?'cursor-grab active:cursor-grabbing':''}`}
                                                            style={{ left:bar.left, width:bar.width, background:style.bg, zIndex:isOut?5:isExp?30:20 }}
                                                            draggable={!!(isOut&&onRescheduleGuest)}
                                                            onDragStart={isOut&&onRescheduleGuest?(e)=>{
                                                                const rect=e.currentTarget.getBoundingClientRect();
                                                                const offsetDays=Math.max(0,Math.round((e.clientX-rect.left)/DAY_W));
                                                                e.dataTransfer.setData('text/plain',JSON.stringify({guestId:g.id,offsetDays,duration:days_count}));
                                                                e.dataTransfer.effectAllowed='move';
                                                                setDragData({guestId:g.id});
                                                            }:undefined}
                                                            onDragEnd={()=>setDragData(null)}
                                                            onClick={e=>{e.stopPropagation();onSlotClick(room,bedId,g,null);}}
                                                            onMouseEnter={e=>onEnter(e,{...g,room})}
                                                            onMouseLeave={onLeave}>
                                                            <div className="px-2 flex items-center gap-1.5 min-w-0 w-full">
                                                                {isBk && <Clock size={10} strokeWidth={3}/>}
                                                                {isExp && <AlertCircle size={10} strokeWidth={3}/>}
                                                                {!isBk && !isExp && debt > 0 && <Wallet size={10} strokeWidth={3}/>}
                                                                {!isBk && !isExp && debt <= 0 && <Check size={10} strokeWidth={4}/>}
                                                                <span className="font-bold text-[11px] truncate leading-none select-none">{g.fullName}</span>
                                                                {bar.width >= 80 && <span className="ml-auto shrink-0 text-[9px] font-black opacity-80">{days_count}н</span>}
                                                                {debt > 0 && bar.width >= 60 && (
                                                                    <span className={`shrink-0 text-[9px] font-black px-1 rounded ${isOut?'text-rose-700 bg-white/60':'bg-black/20'}`}>-{Math.round(debt/1000)}к</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {(() => {
                                                    const todayIdx = days.findIndex(d => d.str === todayStr);
                                                    if (todayIdx < 0) return null;
                                                    return <div className="absolute top-0 bottom-0 w-0.5 bg-indigo-500 z-30 pointer-events-none" style={{ left: todayIdx * DAY_W + DAY_W / 2 }}/>;
                                                })()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
            {hoveredGuest && <GuestTooltip guest={hoveredGuest} room={hoveredGuest.room} mousePos={mousePos} lang={lang}/>}
        </div>
    );
};

export default CalendarView;
