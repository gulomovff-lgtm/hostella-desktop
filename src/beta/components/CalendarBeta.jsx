import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, BedDouble, Flame } from 'lucide-react';

/**
 * Календарь занятости v2: heat-строка загрузки по дням, «свободно сегодня»,
 * диапазон 14/21/30 дней, градиентные бары с анимацией входа, маркер «сегодня».
 * Клик по бару — карточка гостя; по пустой ячейке — заселение с этой даты.
 */
const LABEL_W = 118;
const RANGES = [14, 21, 30];
const DAY_W_BY_RANGE = { 14: 48, 21: 37, 30: 27 };

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

const BAR = {
    ok:      { bg: 'linear-gradient(135deg,#2dd4bf,#0d9488)', text: '#fff', border: 'none' },
    debt:    { bg: 'linear-gradient(135deg,#fb7185,#e11d48)', text: '#fff', border: 'none' },
    expired: { bg: 'linear-gradient(135deg,#fbbf24,#d97706)', text: '#fff', border: 'none' },
    booking: { bg: 'rgba(99,102,241,0.1)', text: '#4f46e5', border: '1.5px dashed rgba(99,102,241,0.45)' },
    rental:  { bg: 'linear-gradient(135deg,#c4b5fd,#8b5cf6)', text: '#fff', border: 'none' },
};

const heatColor = (pct) => pct >= 90 ? '#f43f5e' : pct >= 70 ? '#f59e0b' : pct > 0 ? '#10b981' : '#e2e8f0';

const CalendarBeta = ({ rooms = [], guests = [], onOpenGuest, onCheckInBedDate }) => {
    const [offset, setOffset] = useState(-2);
    const [range, setRange] = useState(21);
    const DAY_W = DAY_W_BY_RANGE[range];
    const now = new Date();
    const todayStr = getLocalDateString(now);

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
    const monthLabel = `${MONTHS[days[Math.floor(range / 2)].month]} ${days[Math.floor(range / 2)].d.getFullYear()}`;

    const barPos = (from, to) => {
        const a = Math.max(winStart, from);
        const b = Math.min(winEnd, to);
        if (b <= a) return null;
        return {
            left: ((a - winStart) / 86400000) * DAY_W,
            width: Math.max(DAY_W * 0.6, ((b - a) / 86400000) * DAY_W - 3),
            clipL: from < winStart, clipR: to > winEnd,
        };
    };

    const { rows, heat, totalBeds, freeTonight } = useMemo(() => {
        const out = [];
        let beds = 0;
        rooms.forEach(room => {
            if (room.rental?.active) {
                const rt = room.rental;
                beds += parseInt(room.capacity) || 0;
                const from = rt.startDate ? noon(rt.startDate)?.getTime() : winStart;
                const to = rt.checkOutDate ? noon(rt.checkOutDate)?.getTime() : (rt.endDate ? noon(rt.endDate)?.getTime() : winEnd);
                out.push({
                    key: room.id + '-rental', label: `Комн. ${room.number}`, sub: 'аренда целиком', room, bed: null,
                    cap: parseInt(room.capacity) || 0,
                    bars: [{ id: 'rent', kind: 'rental', name: rt.tenantName || 'Аренда', from: from || winStart, to: to || winEnd }],
                });
                return;
            }
            const cap = parseInt(room.capacity) || 0;
            beds += cap;
            for (let b = 1; b <= cap; b++) {
                const bedGuests = guests
                    .filter(g => g.roomId === room.id && String(g.bedId) === String(b) &&
                        (g.status === 'active' || g.status === 'booking'))
                    .map(g => {
                        const from = noon(g.checkInDate)?.getTime();
                        const to = noon(g.checkOutDate)?.getTime() || (from + 86400000);
                        const debt = (g.totalPrice || 0) - getTotalPaid(g) > 0;
                        const kind = g.status === 'booking' ? 'booking'
                            : (to < Date.now() ? 'expired' : debt ? 'debt' : 'ok');
                        return { id: g.id, g, kind, name: g.fullName, from, to };
                    })
                    .filter(x => x.from && x.to > winStart && x.from < winEnd);
                out.push({ key: `${room.id}-${b}`, label: `Комн. ${room.number}`, sub: `место ${b}`, room, bed: b, cap: 1, bars: bedGuests });
            }
        });

        // Heat: занятость на каждый день окна
        const heatArr = days.map(({ d }) => {
            const dayStart = d.getTime(), dayEnd = dayStart + 86400000;
            let occ = 0;
            out.forEach(row => {
                const busy = row.bars.some(bar => bar.from < dayEnd && bar.to > dayStart && bar.kind !== 'booking');
                if (busy) occ += row.bed ? 1 : row.cap; // аренда занимает всю комнату
            });
            return beds > 0 ? Math.round((occ / beds) * 100) : 0;
        });
        const todayIdx = days.findIndex(d => d.ds === todayStr);
        const free = todayIdx >= 0 && beds > 0 ? Math.round(beds * (1 - heatArr[todayIdx] / 100)) : null;

        return { rows: out, heat: heatArr, totalBeds: beds, freeTonight: free };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rooms, guests, winStart, winEnd, days]);

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
                <h1 className="text-xl md:text-2xl font-black text-slate-800">Календарь</h1>
                <span className="text-sm font-bold text-slate-400 capitalize">{monthLabel}</span>
                {freeTonight !== null && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">
                        <BedDouble size={11} /> свободно сегодня: {freeTonight} из {totalBeds}
                    </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                    <div className="flex gap-0.5 p-0.5 rounded-lg bg-slate-100">
                        {RANGES.map(r => (
                            <button key={r} onClick={() => setRange(r)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-black transition-colors ${
                                    range === r ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                {r}д
                            </button>
                        ))}
                    </div>
                    <button onClick={() => setOffset(offset - 7)} aria-label="Неделя назад"
                        className="p-2 rounded-lg text-slate-400 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"><ChevronLeft size={14} /></button>
                    <button onClick={() => setOffset(-2)}
                        className="px-3 py-2 rounded-lg text-xs font-bold text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 transition-colors">
                        Сегодня
                    </button>
                    <button onClick={() => setOffset(offset + 7)} aria-label="Неделя вперёд"
                        className="p-2 rounded-lg text-slate-400 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"><ChevronRight size={14} /></button>
                </div>
            </div>

            <style>{`
                @keyframes cal-bar-in { from { opacity: 0; transform: scaleX(.7); } to { opacity: 1; transform: scaleX(1); } }
                .cal-bar { animation: cal-bar-in .25s cubic-bezier(.2,.8,.3,1) both; transform-origin: left center; transition: transform .15s, box-shadow .15s, filter .15s; }
                .cal-bar:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(15,23,42,.18); filter: brightness(1.06); z-index: 5; }
                @media (prefers-reduced-motion: reduce) { .cal-bar { animation: none; } }
            `}</style>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
                <div style={{ minWidth: LABEL_W + range * DAY_W }} key={`${offset}-${range}`}>
                    {/* Шапка дней + heat-строка загрузки */}
                    <div className="border-b border-slate-100 sticky top-0 bg-white z-10">
                        <div className="flex">
                            <div style={{ width: LABEL_W }} className="flex-shrink-0 px-3 pt-2 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <CalendarDays size={11} /> Места
                            </div>
                            {days.map(d => (
                                <div key={d.ds} style={{ width: DAY_W }}
                                    className={`flex-shrink-0 pt-1.5 text-center ${d.weekend && d.ds !== todayStr ? 'bg-slate-50/70' : ''}`}>
                                    <div className={`mx-auto w-7 leading-[22px] h-[22px] rounded-lg text-[12px] font-black tabular-nums ${
                                        d.ds === todayStr ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600'}`}>{d.day}</div>
                                    <div className={`text-[8.5px] font-bold mt-0.5 ${d.ds === todayStr ? 'text-orange-400' : 'text-slate-300'}`}>{d.wd}</div>
                                </div>
                            ))}
                        </div>
                        {/* Heat: загрузка каждого дня */}
                        <div className="flex items-end pb-1" title="Загрузка по дням">
                            <div style={{ width: LABEL_W }} className="flex-shrink-0 px-3 text-[8.5px] font-bold text-slate-300 flex items-center gap-1">
                                <Flame size={9} /> загрузка
                            </div>
                            {days.map((d, i) => (
                                <div key={d.ds} style={{ width: DAY_W }} className="flex-shrink-0 px-[3px]" title={`${d.ds}: ${heat[i]}%`}>
                                    <div className="h-[5px] rounded-full transition-all duration-300"
                                        style={{ background: heatColor(heat[i]), opacity: heat[i] > 0 ? 0.4 + (heat[i] / 100) * 0.6 : 1, width: `${Math.max(12, heat[i])}%` }} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Строки мест */}
                    {rows.map((row, ri) => (
                        <div key={row.key} className="flex border-b border-slate-50 last:border-b-0">
                            <div style={{ width: LABEL_W }} className="flex-shrink-0 px-3 py-1.5 border-r border-slate-100">
                                <div className="text-[11.5px] font-bold text-slate-600 leading-tight">{row.label}</div>
                                <div className="text-[9.5px] text-slate-400">{row.sub}</div>
                            </div>
                            <div className="relative flex-shrink-0" style={{ width: range * DAY_W, height: 36 }}>
                                <div className="absolute inset-0 flex">
                                    {days.map(d => (
                                        <button key={d.ds} style={{ width: DAY_W }}
                                            disabled={!onCheckInBedDate || !row.bed}
                                            onClick={() => onCheckInBedDate?.(row.room, row.bed, d.ds)}
                                            aria-label={`Заселить: комната ${row.room.number}, место ${row.bed}, ${d.ds}`}
                                            className={`h-full border-r border-slate-50 transition-colors ${
                                                d.ds === todayStr ? 'bg-orange-50/50' : d.weekend ? 'bg-slate-50/50' : ''} ${
                                                onCheckInBedDate && row.bed ? 'hover:bg-teal-50 cursor-pointer' : 'cursor-default'}`} />
                                    ))}
                                </div>
                                {row.bars.map((bar, bi) => {
                                    const pos = barPos(bar.from, bar.to);
                                    if (!pos) return null;
                                    const st = BAR[bar.kind];
                                    return (
                                        <button key={bar.id}
                                            onClick={() => bar.g && onOpenGuest?.(bar.g)}
                                            title={`${bar.name}${bar.g ? ` · ${new Date(bar.from).toLocaleDateString('ru')} → ${new Date(bar.to).toLocaleDateString('ru')}` : ''}`}
                                            className={`cal-bar absolute top-[6px] h-[24px] pl-1 pr-2 text-[10px] font-bold truncate text-left flex items-center gap-1 ${
                                                pos.clipL ? 'rounded-l-sm' : 'rounded-l-full'} ${pos.clipR ? 'rounded-r-sm' : 'rounded-r-full'} ${bar.g ? 'cursor-pointer' : 'cursor-default'}`}
                                            style={{
                                                left: pos.left, width: pos.width,
                                                background: st.bg, color: st.text, border: st.border,
                                                animationDelay: `${Math.min((ri * 2 + bi) * 18, 350)}ms`,
                                            }}>
                                            {bar.kind !== 'booking' && (
                                                <span className="w-[16px] h-[16px] rounded-full bg-white/25 text-[8.5px] font-black flex items-center justify-center flex-shrink-0">
                                                    {(bar.name || '?')[0].toUpperCase()}
                                                </span>
                                            )}
                                            <span className="truncate">{bar.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: BAR.ok.bg }} /> оплачен</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: BAR.debt.bg }} /> долг</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: BAR.expired.bg }} /> просрочен</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block border border-dashed border-indigo-400 bg-indigo-50" /> бронь</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full inline-block" style={{ background: BAR.rental.bg }} /> аренда</span>
                <span className="ml-auto inline-flex items-center gap-1.5 text-slate-400"><Flame size={11} /> строка загрузки: зелёная &lt;70% · янтарная &lt;90% · красная ≥90%</span>
            </div>
        </div>
    );
};

export default CalendarBeta;
