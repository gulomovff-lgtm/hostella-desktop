import React, { useState, useMemo } from 'react';
import { Zap, BedDouble, Search, Plus, Building2 } from 'lucide-react';

const getTotalPaid = (g) => (typeof g.amountPaid === 'number'
    ? g.amountPaid
    : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0) + (g.paidTransfer || 0)));

const getLocalDateString = (d) => {
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 10);
};

const fmtMoney = (n) => (n || 0).toLocaleString('ru-RU');
const fmtShort = (d) => (d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : '—');
const norm = (s) => (s || '').toString().toLowerCase();

// «до 15.07 · осталось 2 ночи» / «выезд сегодня» / «просрочен»
const stayLabel = (g, now, todayStr, ymd) => {
    if (!g.checkOutDate) return '';
    const co = new Date(g.checkOutDate);
    if (typeof g.checkOutDate === 'string' && !g.checkOutDate.includes('T')) co.setHours(12, 0, 0, 0);
    if (now > co) return 'просрочен выезд';
    if (ymd(g.checkOutDate) === todayStr) return 'выезд сегодня';
    const nights = Math.ceil((co - now) / 86400000);
    return `до ${fmtShort(g.checkOutDate)} · ${nights} ${nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'}`;
};

const RoomsBeta = ({ rooms = [], guests = [], onOpenGuest, inMainApp, onCheckInBed, onGroupCheckIn, onRental }) => {
    const [filter, setFilter] = useState('all');
    const [q, setQ] = useState('');
    const [hintHidden, setHintHidden] = useState(false);

    const now = new Date();
    const todayStr = getLocalDateString(now);
    const ymd = (d) => (d ? getLocalDateString(new Date(d)) : '');

    const data = useMemo(() => {
        const active = guests.filter(g => g.status === 'active');
        const byRoom = {};
        active.forEach(g => { (byRoom[g.roomId] = byRoom[g.roomId] || []).push(g); });

        const isExpired = (g) => {
            if (!g.checkOutDate) return false;
            const co = new Date(g.checkOutDate);
            if (typeof g.checkOutDate === 'string' && !g.checkOutDate.includes('T')) co.setHours(12, 0, 0, 0);
            return now > co;
        };

        const roomCards = rooms.map(r => {
            const rg = (byRoom[r.id] || []).sort((a, b) => (parseInt(a.bedId) || 99) - (parseInt(b.bedId) || 99));
            const cap = parseInt(r.capacity || 0);
            const rental = r.rental?.active;
            const beds = [];
            for (let b = 1; b <= cap; b++) {
                const g = rg.find(x => String(x.bedId) === String(b));
                if (!g) { beds.push({ n: b, state: 'free' }); continue; }
                const debt = Math.max(0, (g.totalPrice || 0) - getTotalPaid(g));
                beds.push({ n: b, state: isExpired(g) ? 'expired' : debt > 0 ? 'debt' : 'occ', guest: g, debt });
            }
            const extra = rg.filter(g => !beds.some(b => b.guest?.id === g.id))
                .map(g => ({ n: 'доп', state: 'extra', guest: g, debt: Math.max(0, (g.totalPrice || 0) - getTotalPaid(g)) }));
            const free = beds.filter(b => b.state === 'free').length;
            const depToday = rg.filter(g => ymd(g.checkOutDate) === todayStr).length;
            const hasDebt = beds.some(b => b.debt > 0) || extra.some(b => b.debt > 0);
            const hasExpired = beds.some(b => b.state === 'expired');
            return { room: r, beds: [...beds, ...extra], free, depToday, hasDebt, hasExpired, rental, guests: rg };
        });

        const freeingToday = roomCards.flatMap(rc =>
            rc.beds.filter(b => b.guest && ymd(b.guest.checkOutDate) === todayStr)
                .map(b => ({ room: rc.room, bed: b })));
        const unassigned = guests.filter(g =>
            g.status === 'booking' && ymd(g.checkInDate || g.checkInDateTime) === todayStr && !g.roomId);

        const counts = {
            all: roomCards.length,
            free: roomCards.filter(rc => rc.free > 0 && !rc.rental).length,
            dep: roomCards.filter(rc => rc.depToday > 0).length,
            debt: roomCards.filter(rc => rc.hasDebt || rc.hasExpired).length,
        };
        const totalFree = roomCards.reduce((s, rc) => s + (rc.rental ? 0 : rc.free), 0);
        return { roomCards, freeingToday, unassigned, counts, totalFree };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rooms, guests, todayStr]);

    const query = norm(q).trim();
    const visible = data.roomCards.filter(rc => {
        if (filter === 'free' && !(rc.free > 0 && !rc.rental)) return false;
        if (filter === 'dep' && !(rc.depToday > 0)) return false;
        if (filter === 'debt' && !(rc.hasDebt || rc.hasExpired)) return false;
        if (!query) return true;
        // поиск: номер комнаты или имя гостя
        if (norm(String(rc.room.number)).includes(query)) return true;
        return rc.guests.some(g => norm(g.fullName).includes(query));
    });

    const chips = [
        { id: 'all',  label: `Все · ${data.counts.all}` },
        { id: 'free', label: `Свободные · ${data.counts.free}` },
        { id: 'dep',  label: `Выезд сегодня · ${data.counts.dep}` },
        { id: 'debt', label: `Долг / просрочка · ${data.counts.debt}` },
    ];

    const PILL = {
        occ:     null,
        debt:    (b) => <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 whitespace-nowrap">долг {fmtMoney(b.debt)}</span>,
        expired: ()  => <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 whitespace-nowrap">просрочен</span>,
    };

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-1">
                <h1 className="text-xl md:text-2xl font-black text-slate-800">Комнаты</h1>
                <span className="text-sm text-slate-400">свободно {data.totalFree} мест · клик по гостю — карточка, по «+» — заселение</span>
            </div>

            {!hintHidden && data.freeingToday.length > 0 && data.unassigned.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 mt-4 rounded-xl px-4 py-3"
                    style={{ background: 'rgba(232,140,64,0.09)', border: '1px solid rgba(232,140,64,0.35)' }}>
                    <Zap size={16} className="text-orange-500 flex-shrink-0" />
                    <span className="flex-1 text-sm text-slate-700 min-w-[240px]">
                        <b>Подсказка:</b> сегодня освобождается {data.freeingToday.length} мест,
                        и есть {data.unassigned.length} неназначенных брони ({data.unassigned.slice(0, 2).map(g => g.fullName).join(', ')}).
                    </span>
                    <button onClick={() => inMainApp('Назначение брони на место')}
                        className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors">
                        Назначить
                    </button>
                    <button onClick={() => setHintHidden(true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors">
                        Скрыть
                    </button>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-4 mb-4">
                <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 focus-within:border-orange-300 px-3 py-1.5 transition-colors">
                    <Search size={14} className="text-slate-400" />
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="Комната или гость…"
                        className="w-40 text-xs outline-none bg-transparent text-slate-700" />
                </div>
                {chips.map(c => (
                    <button key={c.id} onClick={() => setFilter(c.id)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                            filter === c.id
                                ? 'bg-slate-800 text-white border-slate-800'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                        {c.label}
                    </button>
                ))}
                {(onGroupCheckIn || onRental) && <span className="w-px h-5 bg-slate-200 mx-1" />}
                {onGroupCheckIn && (
                    <button onClick={onGroupCheckIn}
                        className="px-3.5 py-1.5 rounded-full text-xs font-bold text-teal-600 bg-teal-50 border border-teal-200 hover:border-teal-400 transition-all">
                        + Группа
                    </button>
                )}
                {onRental && (
                    <button onClick={onRental}
                        className="px-3.5 py-1.5 rounded-full text-xs font-bold text-purple-600 bg-purple-50 border border-purple-200 hover:border-purple-400 transition-all">
                        + Аренда комнаты
                    </button>
                )}
            </div>

            {visible.length === 0 && (
                <div className="text-center py-10 text-sm text-slate-400">Ничего не нашлось — измените фильтр или запрос.</div>
            )}

            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                {visible.map(({ room, beds, free, rental, hasDebt, hasExpired, depToday }) => (
                    <div key={room.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        {/* Заголовок комнаты */}
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
                            <BedDouble size={14} className="text-slate-400" />
                            <b className="text-sm text-slate-800">Комната {room.number}</b>
                            <span className="text-[11px] text-slate-400">
                                {room.gender ? `${room.gender} · ` : ''}{room.price ? `${fmtMoney(parseInt(room.price))}/ночь` : ''}
                            </span>
                            <span className={`ml-auto text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${
                                rental ? 'bg-teal-50 text-teal-600'
                                : hasExpired ? 'bg-amber-50 text-amber-600'
                                : hasDebt ? 'bg-rose-50 text-rose-600'
                                : depToday ? 'bg-indigo-50 text-indigo-600'
                                : free > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                {rental ? 'аренда' : hasExpired ? 'просрочка' : hasDebt ? 'есть долг' : depToday ? `выезд · ${depToday}` : free > 0 ? `${free} свободно` : 'заполнена'}
                            </span>
                        </div>

                        {/* Места построчно — имена видны сразу */}
                        {rental ? (
                            <div className="flex items-center gap-3 px-4 py-3">
                                <span className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0"><Building2 size={15} /></span>
                                <div className="min-w-0">
                                    <div className="text-[13px] font-bold text-slate-700 truncate">{room.rental?.tenantName || 'Аренда целиком'}</div>
                                    <div className="text-[11px] text-slate-400">
                                        вся комната{room.rental?.endDate ? ` · до ${fmtShort(room.rental.endDate)}` : ''}
                                    </div>
                                </div>
                            </div>
                        ) : beds.map((b, i) => (
                            b.guest ? (
                                <button key={i} onClick={() => onOpenGuest(b.guest)}
                                    className="w-full flex items-center gap-3 px-4 py-2 border-b border-slate-50 last:border-b-0 hover:bg-slate-50 transition-colors text-left">
                                    <span className={`w-7 h-7 rounded-lg text-[11px] font-black flex items-center justify-center flex-shrink-0 ${
                                        b.state === 'expired' ? 'bg-amber-50 text-amber-600'
                                        : b.state === 'debt' ? 'bg-rose-50 text-rose-600'
                                        : b.state === 'extra' ? 'bg-purple-50 text-purple-600'
                                        : 'bg-teal-50 text-teal-600'}`}>
                                        {b.n}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[13px] font-bold text-slate-700 truncate">{b.guest.fullName}</span>
                                        <span className={`block text-[11px] truncate ${
                                            b.state === 'expired' ? 'text-amber-600 font-semibold'
                                            : ymd(b.guest.checkOutDate) === todayStr ? 'text-indigo-500 font-semibold'
                                            : 'text-slate-400'}`}>
                                            {stayLabel(b.guest, now, todayStr, ymd)}
                                        </span>
                                    </span>
                                    {b.state === 'debt' && PILL.debt(b)}
                                    {b.state === 'expired' && PILL.expired()}
                                </button>
                            ) : (
                                <button key={i} disabled={!onCheckInBed}
                                    onClick={() => onCheckInBed?.(room, b.n)}
                                    className={`w-full flex items-center gap-3 px-4 py-2 border-b border-slate-50 last:border-b-0 text-left transition-colors ${
                                        onCheckInBed ? 'hover:bg-teal-50/50 group' : 'cursor-default'}`}>
                                    <span className={`w-7 h-7 rounded-lg text-[11px] font-black flex items-center justify-center flex-shrink-0 border-2 border-dashed ${
                                        onCheckInBed ? 'border-teal-200 text-teal-400 group-hover:border-teal-400 group-hover:text-teal-600' : 'border-slate-200 text-slate-300'}`}>
                                        {onCheckInBed ? <Plus size={13} strokeWidth={3} /> : b.n}
                                    </span>
                                    <span className={`text-[12px] font-semibold ${onCheckInBed ? 'text-teal-500 group-hover:text-teal-600' : 'text-slate-300'}`}>
                                        Место {b.n} свободно{onCheckInBed ? ' — заселить' : ''}
                                    </span>
                                </button>
                            )
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default RoomsBeta;
