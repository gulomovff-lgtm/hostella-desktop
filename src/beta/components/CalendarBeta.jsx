import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

/**
 * Календарь занятости: строки — места, столбцы — дни, бары — гости.
 * Клик по бару — карточка гостя; клик по пустой ячейке — заселение с этой датой.
 */
const DAY_W = 36;      // ширина колонки дня, px
const LABEL_W = 118;   // ширина колонки «комната · место»
const WINDOW = 21;     // дней в окне

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

const BAR_STYLE = {
    ok:      'bg-teal-400/90 text-white',
    debt:    'bg-rose-400/90 text-white',
    expired: 'bg-amber-400/95 text-white',
    booking: 'bg-indigo-100 text-indigo-600 border border-dashed border-indigo-300',
    rental:  'bg-purple-200/80 text-purple-700',
};

const CalendarBeta = ({ rooms = [], guests = [], onOpenGuest, onCheckInBedDate }) => {
    const [offset, setOffset] = useState(-2); // старт окна: сегодня-2
    const now = new Date();
    const todayStr = getLocalDateString(now);

    const days = useMemo(() => {
        const list = [];
        for (let i = 0; i < WINDOW; i++) {
            const d = new Date(now); d.setDate(d.getDate() + offset + i); d.setHours(0, 0, 0, 0);
            list.push({ d, ds: getLocalDateString(d), day: d.getDate(), wd: WD[d.getDay()], weekend: d.getDay() === 0 || d.getDay() === 6 });
        }
        return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offset, todayStr]);

    const winStart = days[0].d.getTime();
    const winEnd = days[WINDOW - 1].d.getTime() + 86400000;

    // Позиция бара в окне (px)
    const barPos = (from, to) => {
        const a = Math.max(winStart, from);
        const b = Math.min(winEnd, to);
        if (b <= a) return null;
        return {
            left: ((a - winStart) / 86400000) * DAY_W,
            width: Math.max(DAY_W * 0.6, ((b - a) / 86400000) * DAY_W - 2),
            clipL: from < winStart, clipR: to > winEnd,
        };
    };

    const rows = useMemo(() => {
        const out = [];
        rooms.forEach(room => {
            if (room.rental?.active) {
                const rt = room.rental;
                const from = rt.startDate ? noon(rt.startDate)?.getTime() : winStart;
                const to = rt.checkOutDate ? noon(rt.checkOutDate)?.getTime() : (rt.endDate ? noon(rt.endDate)?.getTime() : winEnd);
                out.push({
                    key: room.id + '-rental', label: `Комн. ${room.number}`, sub: 'аренда целиком', room, bed: null,
                    bars: [{ id: 'rent', kind: 'rental', name: rt.tenantName || 'Аренда', from: from || winStart, to: to || winEnd }],
                });
                return;
            }
            const cap = parseInt(room.capacity) || 0;
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
                out.push({ key: `${room.id}-${b}`, label: `Комн. ${room.number}`, sub: `место ${b}`, room, bed: b, bars: bedGuests });
            }
        });
        return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rooms, guests, winStart, winEnd]);

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
                <h1 className="text-xl md:text-2xl font-black text-slate-800">Календарь</h1>
                <span className="text-sm text-slate-400">клик по полосе — гость, по пустому дню — заселение с этой даты</span>
                <div className="ml-auto flex items-center gap-1">
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

            <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
                <div style={{ minWidth: LABEL_W + WINDOW * DAY_W }}>
                    {/* Шапка дней */}
                    <div className="flex border-b border-slate-100 sticky top-0 bg-white z-10">
                        <div style={{ width: LABEL_W }} className="flex-shrink-0 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <CalendarDays size={11} /> Места
                        </div>
                        {days.map(d => (
                            <div key={d.ds} style={{ width: DAY_W }}
                                className={`flex-shrink-0 py-1.5 text-center ${d.ds === todayStr ? 'bg-orange-50' : d.weekend ? 'bg-slate-50/70' : ''}`}>
                                <div className={`text-[12px] font-black tabular-nums leading-none ${d.ds === todayStr ? 'text-orange-500' : 'text-slate-600'}`}>{d.day}</div>
                                <div className={`text-[8.5px] font-bold ${d.ds === todayStr ? 'text-orange-400' : 'text-slate-300'}`}>{d.wd}</div>
                            </div>
                        ))}
                    </div>

                    {/* Строки мест */}
                    {rows.map(row => (
                        <div key={row.key} className="flex border-b border-slate-50 last:border-b-0 group">
                            <div style={{ width: LABEL_W }} className="flex-shrink-0 px-3 py-1.5 border-r border-slate-100">
                                <div className="text-[11.5px] font-bold text-slate-600 leading-tight">{row.label}</div>
                                <div className="text-[9.5px] text-slate-400">{row.sub}</div>
                            </div>
                            <div className="relative flex-shrink-0" style={{ width: WINDOW * DAY_W, height: 34 }}>
                                {/* Ячейки-дни (клик = заселение с даты) */}
                                <div className="absolute inset-0 flex">
                                    {days.map(d => (
                                        <button key={d.ds} style={{ width: DAY_W }}
                                            disabled={!onCheckInBedDate || !row.bed}
                                            onClick={() => onCheckInBedDate?.(row.room, row.bed, d.ds)}
                                            aria-label={`Заселить: комната ${row.room.number}, место ${row.bed}, ${d.ds}`}
                                            className={`h-full border-r border-slate-50 transition-colors ${
                                                d.ds === todayStr ? 'bg-orange-50/60' : d.weekend ? 'bg-slate-50/50' : ''} ${
                                                onCheckInBedDate && row.bed ? 'hover:bg-teal-50 cursor-pointer' : 'cursor-default'}`} />
                                    ))}
                                </div>
                                {/* Бары гостей */}
                                {row.bars.map(bar => {
                                    const pos = barPos(bar.from, bar.to);
                                    if (!pos) return null;
                                    return (
                                        <button key={bar.id}
                                            onClick={() => bar.g && onOpenGuest?.(bar.g)}
                                            title={`${bar.name}${bar.g ? ` · ${new Date(bar.from).toLocaleDateString('ru')} → ${new Date(bar.to).toLocaleDateString('ru')}` : ''}`}
                                            className={`absolute top-[5px] h-[24px] px-1.5 text-[10px] font-bold truncate text-left transition-transform hover:scale-y-110 ${BAR_STYLE[bar.kind]} ${
                                                pos.clipL ? 'rounded-l-none' : 'rounded-l-lg'} ${pos.clipR ? 'rounded-r-none' : 'rounded-r-lg'} ${bar.g ? 'cursor-pointer' : 'cursor-default'}`}
                                            style={{ left: pos.left, width: pos.width, lineHeight: '24px' }}>
                                            {bar.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-teal-400 inline-block" /> живёт, оплачено</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-400 inline-block" /> долг</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400 inline-block" /> просрочен выезд</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-100 border border-dashed border-indigo-300 inline-block" /> бронь</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-200 inline-block" /> аренда</span>
            </div>
        </div>
    );
};

export default CalendarBeta;
