import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
    ChevronLeft, ChevronRight, BedDouble, Flame,
    Zap, ArrowRight, LogIn, LogOut, Globe, AlertTriangle, UserPlus, Sparkles, Plus,
} from 'lucide-react';
import { countryCode, citizenshipBreakdown } from '../utils/geo';

/**
 * ДИЗАЙН-ПРОМПТ (умный календарь Hostella v3).
 * Проблема прошлой версии: «каша» — пустые ячейки-коробки в каждом дне, нет
 * структуры, много пустых строк, бары теряются. Решение — чистый Gantt:
 *   • группировка по КОМНАТАМ (заголовок-полоса с загрузкой), под ним — компактные
 *     строки мест; пустые комнаты читаются как «свободно N»;
 *   • единая сетка вертикальными линиями (repeating-gradient), без ячеек-коробок;
 *   • сплошная колонка «сегодня» (оранжевая) и мягкая подсветка выходных на всю высоту;
 *   • липкая левая колонка названий при горизонтальном скролле;
 *   • плотные строки, крупные читаемые бары-пилюли с аватаром/страной.
 * Поверх — слой интеллекта: «Что сделать» (закрыть простой, назначить бронь,
 * просрочка), «Кто живёт» (гражданства, клик подсвечивает), заезды/выезды и heat
 * по дням. Все прежние функции целы: клик по бару → карточка, клик по дню → заселение.
 */

const LABEL_W = 132;
const RANGES = [14, 21, 30];
const DAY_W_BY_RANGE = { 14: 52, 21: 40, 30: 30 };
const ROW_H = 32;
const HEAD_H = 30;

const getLocalDateString = (d) => {
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 10);
};
const noon = (v) => {
    if (!v) return null;
    const d = new Date(v);
    if (typeof v === 'string' && !v.includes('T')) d.setHours(12, 0, 0, 0);
    return d;
};
const getTotalPaid = (g) => (typeof g.amountPaid === 'number'
    ? g.amountPaid
    : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0) + (g.paidTransfer || 0)));

const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const nightsWord = (n) => (n === 1 ? 'ночь' : n < 5 ? 'ночи' : 'ночей');
const fmtDM = (d) => new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
const initial = (s) => (s || '?').trim()[0]?.toUpperCase() || '?';

const BAR = {
    ok:      { bg: 'linear-gradient(135deg,#2dd4bf,#0d9488)', text: '#fff' },
    debt:    { bg: 'linear-gradient(135deg,#fb7185,#e11d48)', text: '#fff' },
    expired: { bg: 'linear-gradient(135deg,#fbbf24,#d97706)', text: '#fff' },
    booking: { bg: 'rgba(99,102,241,0.14)', text: '#4338ca' },
    rental:  { bg: 'linear-gradient(135deg,#a78bfa,#7c3aed)', text: '#fff' },
};
const heatColor = (pct) => pct >= 90 ? '#f43f5e' : pct >= 70 ? '#f59e0b' : pct > 0 ? '#10b981' : '#e2e8f0';

const useCountUp = (target, dur = 550) => {
    const [v, setV] = useState(target);
    const prev = useRef(target);
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { prev.current = target; setV(target); return; }
        const from = prev.current;
        prev.current = target;
        if (from === target) return;
        const t0 = performance.now();
        let raf;
        const step = (t) => {
            const k = Math.min(1, (t - t0) / dur);
            setV(Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3))));
            if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [target, dur]);
    return v;
};

const SUG_TONE = {
    teal:   { chip: 'bg-teal-50 text-teal-600 border-teal-200', btn: 'bg-teal-500 hover:bg-teal-600' },
    indigo: { chip: 'bg-indigo-50 text-indigo-600 border-indigo-200', btn: 'bg-indigo-500 hover:bg-indigo-600' },
    amber:  { chip: 'bg-amber-50 text-amber-600 border-amber-200', btn: 'bg-amber-500 hover:bg-amber-600' },
    rose:   { chip: 'bg-rose-50 text-rose-600 border-rose-200', btn: 'bg-rose-500 hover:bg-rose-600' },
    slate:  { chip: 'bg-slate-50 text-slate-500 border-slate-200', btn: 'bg-slate-700 hover:bg-slate-800' },
};

const CalendarBeta = ({ rooms = [], guests = [], onOpenGuest, onCheckInBedDate }) => {
    const [offset, setOffset] = useState(-2);
    const [range, setRange] = useState(21);
    const [activeCountry, setActiveCountry] = useState(null);
    const DAY_W = DAY_W_BY_RANGE[range];
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const canCheckIn = !!onCheckInBedDate;

    const days = useMemo(() => {
        const list = [];
        for (let i = 0; i < range; i++) {
            const d = new Date(now); d.setDate(d.getDate() + offset + i); d.setHours(0, 0, 0, 0);
            list.push({ d, ds: getLocalDateString(d), day: d.getDate(), wd: WD[d.getDay()], weekend: d.getDay() === 0 || d.getDay() === 6, month: d.getMonth() });
        }
        return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offset, range, todayStr]);

    const winStart = days[0].d.getTime();
    const winEnd = days[range - 1].d.getTime() + 86400000;
    const todayIdx = days.findIndex(d => d.ds === todayStr);
    const monthLabel = `${MONTHS[days[Math.floor(range / 2)].month]} ${days[Math.floor(range / 2)].d.getFullYear()}`;
    const trackW = range * DAY_W;

    const barPos = (from, to) => {
        const a = Math.max(winStart, from);
        const b = Math.min(winEnd, to);
        if (b <= a) return null;
        return {
            left: ((a - winStart) / 86400000) * DAY_W,
            width: Math.max(DAY_W * 0.7, ((b - a) / 86400000) * DAY_W - 4),
            clipL: from < winStart, clipR: to > winEnd,
        };
    };

    const model = useMemo(() => {
        const groups = [];
        let beds = 0;
        const arrivals = {}, departures = {};
        const gaps = [];

        guests.forEach(g => {
            if (g.status === 'active' || g.status === 'booking') {
                const inDs = getLocalDateString(noon(g.checkInDate) || now);
                arrivals[inDs] = (arrivals[inDs] || 0) + 1;
            }
            if (g.status === 'active' && g.checkOutDate) {
                departures[getLocalDateString(noon(g.checkOutDate))] = (departures[getLocalDateString(noon(g.checkOutDate))] || 0) + 1;
            }
        });

        rooms.forEach(room => {
            const cap = parseInt(room.capacity) || 0;
            beds += cap;
            if (room.rental?.active) {
                const rt = room.rental;
                const from = rt.startDate ? noon(rt.startDate)?.getTime() : winStart;
                const to = rt.checkOutDate ? noon(rt.checkOutDate)?.getTime() : (rt.endDate ? noon(rt.endDate)?.getTime() : winEnd);
                groups.push({
                    room, gender: room.gender, cap, isRental: true, occNow: cap, freeNow: 0,
                    rows: [{ key: room.id + '-rental', bed: null, bars: [{ id: 'rent', kind: 'rental', name: rt.tenantName || 'Аренда', country: '', from: from || winStart, to: to || winEnd }] }],
                });
                return;
            }
            const rows = [];
            let occNow = 0;
            for (let b = 1; b <= cap; b++) {
                const intervals = guests
                    .filter(g => g.roomId === room.id && String(g.bedId) === String(b) &&
                        (g.status === 'active' || g.status === 'booking'))
                    .map(g => {
                        const from = noon(g.checkInDate)?.getTime();
                        const to = noon(g.checkOutDate)?.getTime() || (from + 86400000);
                        const debt = (g.totalPrice || 0) - getTotalPaid(g) > 0;
                        const kind = g.status === 'booking' ? 'booking' : (to < Date.now() ? 'expired' : debt ? 'debt' : 'ok');
                        return { id: g.id, g, kind, name: g.fullName, country: g.country || '', from, to };
                    })
                    .filter(x => x.from)
                    .sort((a, b2) => a.from - b2.from);

                if (intervals.some(iv => iv.kind !== 'booking' && iv.from <= now.getTime() && iv.to > now.getTime())) occNow++;

                // Простои (orphan): по дням окна, начиная с сегодня
                const dayMs = days.map(d => d.d.getTime());
                const occ = dayMs.map(ms => intervals.some(iv => iv.from < ms + 86400000 && iv.to > ms));
                const startScan = Math.max(0, todayIdx < 0 ? 0 : todayIdx);
                let i = startScan;
                while (i < days.length) {
                    if (occ[i]) { i++; continue; }
                    let j = i;
                    while (j + 1 < days.length && !occ[j + 1]) j++;
                    const nights = j - i + 1;
                    const nextIv = j + 1 < days.length
                        ? intervals.find(iv => getLocalDateString(new Date(iv.from)) === days[j + 1].ds) : null;
                    const boundedLeft = i > 0 && occ[i - 1];
                    if (nextIv && nights <= 6) {
                        gaps.push({ room, bed: b, startDs: days[i].ds, startMs: days[i].d.getTime(), nights, nextName: nextIv.name, orphan: boundedLeft });
                    }
                    i = j + 1;
                }

                rows.push({ key: `${room.id}-${b}`, bed: b, bars: intervals.filter(x => x.to > winStart && x.from < winEnd) });
            }
            groups.push({ room, gender: room.gender, cap, isRental: false, occNow, freeNow: cap - occNow, rows });
        });

        // Heat
        const heatArr = days.map(({ d }) => {
            const dayStart = d.getTime(), dayEnd = dayStart + 86400000;
            let occ = 0;
            groups.forEach(gr => gr.rows.forEach(row => {
                const busy = row.bars.some(bar => bar.from < dayEnd && bar.to > dayStart && bar.kind !== 'booking');
                if (busy) occ += 1;
                else if (gr.isRental) occ += 0;
            }));
            groups.filter(gr => gr.isRental).forEach(gr => {
                const bar = gr.rows[0].bars[0];
                if (bar && bar.from < dayEnd && bar.to > dayStart) occ += gr.cap;
            });
            return beds > 0 ? Math.min(100, Math.round((occ / beds) * 100)) : 0;
        });
        const freeTonight = todayIdx >= 0 && beds > 0 ? Math.round(beds * (1 - heatArr[todayIdx] / 100)) : null;
        const avgLoad = heatArr.length ? Math.round(heatArr.reduce((s, x) => s + x, 0) / heatArr.length) : 0;

        // Подсказки
        const sug = [];
        guests.filter(g => g.status === 'active' && g.checkOutDate && noon(g.checkOutDate) < now).slice(0, 3).forEach(g => sug.push({
            id: 'exp-' + g.id, tone: 'rose', icon: AlertTriangle,
            title: `Просрочен выезд: ${g.fullName}`, sub: `комн. ${g.roomNumber || g.roomId} · расчётное время прошло`,
            act: onOpenGuest ? { label: 'Открыть', fn: () => onOpenGuest(g) } : null,
        }));
        guests.filter(g => g.status === 'booking' && !g.bedId &&
            noon(g.checkInDate)?.getTime() >= winStart && noon(g.checkInDate)?.getTime() < winEnd).slice(0, 3).forEach(g => sug.push({
            id: 'un-' + g.id, tone: 'indigo', icon: UserPlus,
            title: `Бронь без места: ${g.fullName}`, sub: `заезд ${fmtDM(g.checkInDate)} — назначьте место`,
            act: onOpenGuest ? { label: 'Открыть', fn: () => onOpenGuest(g) } : null,
        }));
        gaps.filter(g => g.orphan).sort((a, b) => a.nights - b.nights).slice(0, 4).forEach(g => sug.push({
            id: `gap-${g.room.id}-${g.bed}-${g.startDs}`, tone: 'teal', icon: Zap,
            title: `Простой ${g.nights} ${nightsWord(g.nights)}: комн. ${g.room.number}, место ${g.bed}`,
            sub: `с ${fmtDM(g.startDs)} до заезда «${g.nextName}» — можно заселить`,
            act: canCheckIn ? { label: 'Заселить', fn: () => onCheckInBedDate(g.room, g.bed, g.startDs) } : null,
        }));

        const citizenship = citizenshipBreakdown(guests);
        return { groups, heat: heatArr, totalBeds: beds, freeTonight, avgLoad, arrivals, departures, suggestions: sug.slice(0, 6), gaps, citizenship };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rooms, guests, winStart, winEnd, days]);

    const { groups, heat, totalBeds, freeTonight, avgLoad, arrivals, departures, suggestions, gaps, citizenship } = model;

    const gapByBed = useMemo(() => {
        const m = {};
        gaps.forEach(g => { (m[`${g.room.id}-${g.bed}`] = m[`${g.room.id}-${g.bed}`] || []).push(g); });
        return m;
    }, [gaps]);

    // Единая сетка вертикальными линиями (вместо ячеек-коробок)
    const gridBg = `repeating-linear-gradient(to right, #eef1f5 0, #eef1f5 1px, transparent 1px, transparent ${DAY_W}px)`;

    // Слой фоновых колонок (выходные + сегодня) — общий для строки
    const ColumnBands = () => (
        <>
            {days.map((d, i) => (d.weekend || d.ds === todayStr) && (
                <div key={d.ds} className="absolute top-0 bottom-0 pointer-events-none"
                    style={{ left: i * DAY_W, width: DAY_W, background: d.ds === todayStr ? 'rgba(232,140,64,0.08)' : 'rgba(148,163,184,0.06)' }} />
            ))}
            {todayIdx >= 0 && (
                <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: todayIdx * DAY_W, width: 2, background: '#f97316', opacity: 0.7 }} />
            )}
        </>
    );

    // Кликабельные дни для заселения (невидимые, только hover)
    const ClickCells = ({ bed, room }) => (
        <div className="absolute inset-0 flex">
            {days.map(d => (
                <button key={d.ds} style={{ width: DAY_W }} disabled={!canCheckIn || !bed}
                    onClick={() => onCheckInBedDate?.(room, bed, d.ds)}
                    aria-label={`Заселить: комната ${room.number}, место ${bed}, ${d.ds}`}
                    className={`h-full ${canCheckIn && bed ? 'hover:bg-teal-100/50 cursor-pointer' : 'cursor-default'}`} />
            ))}
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto beta-fade">
            <style>{`
                @keyframes cal-bar-in{from{opacity:0;transform:scaleX(.75)}to{opacity:1;transform:none}}
                .cal-bar{animation:cal-bar-in .22s cubic-bezier(.2,.8,.3,1) both;transform-origin:left center;transition:transform .14s,box-shadow .14s,filter .14s,opacity .14s}
                .cal-bar:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(15,23,42,.22);filter:brightness(1.05);z-index:6}
                @media (prefers-reduced-motion: reduce){.cal-bar{animation:none}}
            `}</style>

            {/* Шапка */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
                <h1 className="text-xl md:text-2xl font-black text-slate-800">Календарь</h1>
                <span className="text-sm font-bold text-slate-400 capitalize">{monthLabel}</span>
                {freeTonight !== null && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 tabular-nums">
                        <BedDouble size={11} /> свободно сегодня: {useCountUp(freeTonight)} из {totalBeds}
                    </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full tabular-nums"
                    style={{ background: (avgLoad > 0 ? heatColor(avgLoad) : '#64748b') + '22', color: avgLoad > 0 ? heatColor(avgLoad) : '#64748b' }}>
                    <Flame size={11} /> средняя загрузка {useCountUp(avgLoad)}%
                </span>
                <div className="ml-auto flex items-center gap-2">
                    <div className="flex gap-0.5 p-0.5 rounded-lg bg-slate-100">
                        {RANGES.map(r => (
                            <button key={r} onClick={() => setRange(r)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-black transition-colors ${range === r ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{r}д</button>
                        ))}
                    </div>
                    <button onClick={() => setOffset(offset - 7)} aria-label="Неделя назад" className="p-2 rounded-lg text-slate-400 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"><ChevronLeft size={14} /></button>
                    <button onClick={() => setOffset(-2)} className="px-3 py-2 rounded-lg text-xs font-bold text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 transition-colors">Сегодня</button>
                    <button onClick={() => setOffset(offset + 7)} aria-label="Неделя вперёд" className="p-2 rounded-lg text-slate-400 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"><ChevronRight size={14} /></button>
                </div>
            </div>

            {/* Что можно сделать */}
            {suggestions.length > 0 && (
                <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles size={14} className="text-orange-500" />
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Что можно сделать</span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">{suggestions.length}</span>
                    </div>
                    <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))' }}>
                        {suggestions.map((s, i) => {
                            const tone = SUG_TONE[s.tone] || SUG_TONE.slate; const Icon = s.icon;
                            return (
                                <div key={s.id} className="beta-rise bg-white rounded-xl border border-slate-200 p-3 flex items-start gap-2.5 hover:shadow-sm transition-shadow" style={{ animationDelay: `${Math.min(i * 45, 300)}ms` }}>
                                    <span className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 ${tone.chip}`}><Icon size={14} /></span>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[12.5px] font-bold text-slate-800 leading-tight">{s.title}</div>
                                        <div className="text-[11px] text-slate-400 mt-0.5 leading-tight">{s.sub}</div>
                                    </div>
                                    {s.act && (
                                        <button onClick={s.act.fn} className={`flex-shrink-0 self-center flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black text-white transition-colors ${tone.btn}`}>{s.act.label}<ArrowRight size={12} /></button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Кто живёт */}
            {citizenship.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-500"><Globe size={13} /> Кто живёт</span>
                    {citizenship.map(c => (
                        <button key={c.country} onClick={() => setActiveCountry(activeCountry === c.country ? null : c.country)} title={c.country}
                            className={`inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full border transition-all ${activeCountry === c.country ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                            <span className={`text-[9px] font-black px-1 py-px rounded ${activeCountry === c.country ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{c.code}</span>
                            {c.country} · {c.count}
                        </button>
                    ))}
                    {activeCountry && <button onClick={() => setActiveCountry(null)} className="text-[11px] font-bold text-slate-400 hover:text-slate-600 underline">сбросить</button>}
                </div>
            )}

            {/* Таймлайн */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
                <div style={{ minWidth: LABEL_W + trackW }}>
                    {/* Шапка дней */}
                    <div className="flex sticky top-0 z-20 bg-white border-b border-slate-200">
                        <div style={{ width: LABEL_W }} className="flex-shrink-0 sticky left-0 z-10 bg-white flex items-center gap-1.5 px-3 text-[10px] font-black uppercase tracking-wider text-slate-400 border-r border-slate-200">
                            <BedDouble size={12} /> Места
                        </div>
                        <div className="flex-shrink-0" style={{ width: trackW }}>
                            <div className="flex">
                                {days.map(d => {
                                    const a = arrivals[d.ds] || 0, dep = departures[d.ds] || 0;
                                    const today = d.ds === todayStr;
                                    return (
                                        <div key={d.ds} style={{ width: DAY_W }}
                                            className={`flex-shrink-0 pt-1.5 pb-1 text-center ${d.weekend && !today ? 'bg-slate-50/60' : ''} ${today ? 'bg-orange-50/70' : ''}`}>
                                            <div className={`mx-auto w-7 leading-[22px] h-[22px] rounded-lg text-[12px] font-black tabular-nums ${today ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600'}`}>{d.day}</div>
                                            <div className={`text-[8.5px] font-bold mt-0.5 ${today ? 'text-orange-500' : 'text-slate-300'}`}>{d.wd}</div>
                                            <div className="flex items-center justify-center gap-1 h-[11px] mt-0.5">
                                                {a > 0 && <span className="inline-flex items-center text-[8px] font-black text-teal-600 leading-none"><LogIn size={8} />{a}</span>}
                                                {dep > 0 && <span className="inline-flex items-center text-[8px] font-black text-slate-400 leading-none"><LogOut size={8} />{dep}</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* heat-полоса */}
                            <div className="flex items-end h-[7px] mb-0.5">
                                {days.map((d, i) => (
                                    <div key={d.ds} style={{ width: DAY_W }} className="flex-shrink-0 px-[3px]" title={`${d.ds}: ${heat[i]}%`}>
                                        <div className="h-[4px] rounded-full transition-all duration-300" style={{ background: heatColor(heat[i]), opacity: heat[i] > 0 ? 0.45 + (heat[i] / 100) * 0.55 : 1, width: `${Math.max(14, heat[i])}%` }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Группы комнат */}
                    {groups.map(gr => (
                        <div key={gr.room.id}>
                            {/* Заголовок комнаты */}
                            <div className="flex bg-slate-50/80 border-b border-slate-100">
                                <div style={{ width: LABEL_W, height: HEAD_H }} className="flex-shrink-0 sticky left-0 z-10 bg-slate-50 flex items-center gap-1.5 px-3 border-r border-slate-200">
                                    <span className="text-[12px] font-black text-slate-700">Комн. {gr.room.number}</span>
                                    {gr.gender && <span className="text-[8.5px] font-black text-slate-400 uppercase">{gr.gender}</span>}
                                </div>
                                <div className="relative flex-shrink-0" style={{ width: trackW, height: HEAD_H, backgroundImage: gridBg }}>
                                    <ColumnBands />
                                    <div className="absolute inset-0 flex items-center px-2 gap-2">
                                        {gr.isRental ? (
                                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">аренда целиком</span>
                                        ) : (
                                            <>
                                                <div className="w-16 h-1.5 rounded-full bg-slate-200/80 overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${gr.cap ? Math.round((gr.occNow / gr.cap) * 100) : 0}%`, background: gr.freeNow === 0 ? '#94a3b8' : '#2dd4bf' }} />
                                                </div>
                                                <span className="text-[10px] font-black tabular-nums text-slate-400">{gr.occNow}/{gr.cap}</span>
                                                {gr.freeNow > 0 && <span className="text-[10px] font-black text-emerald-600">{gr.freeNow} свободно</span>}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {/* Строки мест */}
                            {gr.rows.map(row => {
                                const rowGaps = gapByBed[`${gr.room.id}-${row.bed}`] || [];
                                return (
                                    <div key={row.key} className="flex border-b border-slate-50 last:border-b-0 hover:bg-slate-50/40 transition-colors">
                                        <div style={{ width: LABEL_W, height: ROW_H }} className="flex-shrink-0 sticky left-0 z-10 bg-white flex items-center px-3 border-r border-slate-100">
                                            <span className="text-[11px] text-slate-500">{gr.isRental ? 'вся комната' : `место ${row.bed}`}</span>
                                        </div>
                                        <div className="relative flex-shrink-0" style={{ width: trackW, height: ROW_H, backgroundImage: gridBg }}>
                                            <ColumnBands />
                                            <ClickCells bed={row.bed} room={gr.room} />
                                            {/* простои (orphan) */}
                                            {rowGaps.filter(g => g.orphan).map(g => {
                                                const pos = barPos(g.startMs, g.startMs + g.nights * 86400000);
                                                if (!pos) return null;
                                                return (
                                                    <button key={'gap' + g.startDs} onClick={() => canCheckIn && onCheckInBedDate(gr.room, row.bed, g.startDs)}
                                                        title={`Простой ${g.nights} ${nightsWord(g.nights)} до заезда «${g.nextName}» — заселить`}
                                                        className="absolute top-1.5 flex items-center justify-center gap-0.5 text-[9px] font-black text-teal-600 rounded-md transition-colors hover:bg-teal-100/70"
                                                        style={{ left: pos.left + 1, width: pos.width - 1, height: ROW_H - 12, border: '1.5px dashed rgba(20,184,166,.55)', background: 'rgba(20,184,166,.07)' }}>
                                                        {pos.width > 30 ? <><Plus size={9} strokeWidth={3} />{g.nights}н</> : <Plus size={9} strokeWidth={3} />}
                                                    </button>
                                                );
                                            })}
                                            {/* бары */}
                                            {row.bars.map((bar, bi) => {
                                                const pos = barPos(bar.from, bar.to);
                                                if (!pos) return null;
                                                const st = BAR[bar.kind];
                                                const dim = activeCountry && bar.country !== activeCountry;
                                                const code = bar.country ? countryCode(bar.country) : '';
                                                const isBk = bar.kind === 'booking';
                                                return (
                                                    <button key={bar.id} onClick={() => bar.g && onOpenGuest?.(bar.g)}
                                                        title={`${bar.name}${bar.country ? ` · ${bar.country}` : ''}${bar.g ? ` · ${fmtDM(bar.from)} → ${fmtDM(bar.to)}` : ''}`}
                                                        className={`cal-bar absolute top-1 flex items-center gap-1 pl-1 pr-1.5 text-[10.5px] font-bold truncate text-left ${pos.clipL ? 'rounded-l' : 'rounded-l-full'} ${pos.clipR ? 'rounded-r' : 'rounded-r-full'} ${bar.g ? 'cursor-pointer' : 'cursor-default'}`}
                                                        style={{ left: pos.left, width: pos.width, height: ROW_H - 8, background: st.bg, color: st.text, border: isBk ? '1.5px dashed rgba(99,102,241,.5)' : 'none', opacity: dim ? 0.26 : 1 }}>
                                                        {!isBk && <span className="w-[17px] h-[17px] rounded-full bg-white/25 text-[9px] font-black flex items-center justify-center flex-shrink-0">{initial(bar.name)}</span>}
                                                        <span className="truncate">{bar.name}</span>
                                                        {code && pos.width > 68 && <span className={`ml-auto text-[8px] font-black px-1 rounded flex-shrink-0 ${isBk ? 'bg-indigo-100 text-indigo-500' : 'bg-white/25'}`}>{code}</span>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Легенда */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: BAR.ok.bg }} /> оплачен</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: BAR.debt.bg }} /> долг</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: BAR.expired.bg }} /> просрочен</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block border border-dashed border-indigo-400 bg-indigo-50" /> бронь</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-md inline-block" style={{ border: '1.5px dashed rgba(20,184,166,.6)', background: 'rgba(20,184,166,.1)' }} /> простой — закрыть</span>
                <span className="inline-flex items-center gap-1.5 text-slate-400"><span className="inline-block w-0.5 h-3.5 rounded-full" style={{ background: '#f97316' }} /> сегодня</span>
            </div>
        </div>
    );
};

export default CalendarBeta;
