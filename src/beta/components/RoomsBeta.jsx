import React, { useState, useMemo } from 'react';
import { Zap, BedDouble } from 'lucide-react';

const getTotalPaid = (g) => (typeof g.amountPaid === 'number'
    ? g.amountPaid
    : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0) + (g.paidTransfer || 0)));

const getLocalDateString = (d) => {
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 10);
};

const RoomsBeta = ({ rooms = [], guests = [], onOpenGuest, inMainApp, onCheckInBed }) => {
    const [filter, setFilter] = useState('all');
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
            const rg = byRoom[r.id] || [];
            const cap = parseInt(r.capacity || 0);
            const rental = r.rental?.active;
            const beds = [];
            for (let b = 1; b <= cap; b++) {
                const g = rg.find(x => String(x.bedId) === String(b));
                if (!g) { beds.push({ n: b, state: 'free' }); continue; }
                const debt = (g.totalPrice || 0) - getTotalPaid(g) > 0;
                beds.push({ n: b, state: isExpired(g) ? 'expired' : debt ? 'debt' : 'occ', guest: g });
            }
            const extra = rg.filter(g => !beds.some(b => b.guest?.id === g.id));
            const free = beds.filter(b => b.state === 'free').length;
            const depToday = rg.filter(g => ymd(g.checkOutDate) === todayStr).length;
            const hasDebt = beds.some(b => b.state === 'debt');
            const hasExpired = beds.some(b => b.state === 'expired');
            return { room: r, beds, extra, free, depToday, hasDebt, hasExpired, rental };
        });

        // Подсказка: сегодня освобождаются места и есть неназначенные брони на сегодня
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
        return { roomCards, freeingToday, unassigned, counts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rooms, guests, todayStr]);

    const visible = data.roomCards.filter(rc => {
        if (filter === 'free') return rc.free > 0 && !rc.rental;
        if (filter === 'dep') return rc.depToday > 0;
        if (filter === 'debt') return rc.hasDebt || rc.hasExpired;
        return true;
    });

    const BED_STYLE = {
        occ:     'bg-teal-50 text-teal-600 border border-teal-200',
        free:    'border-2 border-dashed border-slate-200 text-slate-300',
        debt:    'bg-rose-50 text-rose-600 border border-rose-200',
        expired: 'bg-amber-50 text-amber-600 border border-amber-300',
    };

    const chips = [
        { id: 'all',  label: `Все · ${data.counts.all}` },
        { id: 'free', label: `Со свободными · ${data.counts.free}` },
        { id: 'dep',  label: `Выезд сегодня · ${data.counts.dep}` },
        { id: 'debt', label: `Долг / просрочка · ${data.counts.debt}` },
    ];

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-1">
                <h1 className="text-xl md:text-2xl font-black text-slate-800">Комнаты</h1>
                <span className="text-sm text-slate-400">карта мест в реальном времени · клик по месту — карточка гостя</span>
            </div>

            {!hintHidden && data.freeingToday.length > 0 && data.unassigned.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 mt-4 rounded-xl px-4 py-3"
                    style={{ background: 'rgba(232,140,64,0.09)', border: '1px solid rgba(232,140,64,0.35)' }}>
                    <Zap size={16} className="text-orange-500 flex-shrink-0" />
                    <span className="flex-1 text-sm text-slate-700 min-w-[240px]">
                        <b>Подсказка:</b> сегодня освобождается {data.freeingToday.length} мест
                        (например {data.freeingToday[0].room.number}-{data.freeingToday[0].bed.n}),
                        и есть {data.unassigned.length} неназначенных брони ({data.unassigned.slice(0, 2).map(g => g.fullName).join(', ')}).
                        Можно назначить их на освобождающиеся места.
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

            <div className="flex flex-wrap gap-2 mt-4 mb-4">
                {chips.map(c => (
                    <button key={c.id} onClick={() => setFilter(c.id)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                            filter === c.id
                                ? 'bg-slate-800 text-white border-slate-800'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                        {c.label}
                    </button>
                ))}
            </div>

            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
                {visible.map(({ room, beds, extra, free, rental, hasDebt, hasExpired, depToday }) => (
                    <div key={room.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <BedDouble size={14} className="text-slate-400" />
                            <b className="text-sm text-slate-800">Комната {room.number}</b>
                            <span className={`ml-auto text-[10px] font-black px-2 py-0.5 rounded-full ${
                                rental ? 'bg-teal-50 text-teal-600'
                                : hasExpired ? 'bg-amber-50 text-amber-600'
                                : hasDebt ? 'bg-rose-50 text-rose-600'
                                : depToday ? 'bg-indigo-50 text-indigo-600'
                                : free > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                                {rental ? 'аренда' : hasExpired ? 'просрочка' : hasDebt ? 'долг' : depToday ? `выезд · ${depToday}` : free > 0 ? `${free} свободно` : 'заполнена'}
                            </span>
                        </div>
                        {rental ? (
                            <div className="text-xs text-slate-500">
                                Целиком: <b>{room.rental?.tenantName || 'аренда'}</b>
                                {room.rental?.endDate ? ` · до ${new Date(room.rental.endDate).toLocaleDateString('ru')}` : ''}
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-1.5">
                                {beds.map(b => {
                                    const clickable = b.guest || (b.state === 'free' && onCheckInBed);
                                    return (
                                        <button key={b.n} disabled={!clickable}
                                            onClick={() => b.guest ? onOpenGuest(b.guest) : onCheckInBed?.(room, b.n)}
                                            title={b.guest ? b.guest.fullName : onCheckInBed ? 'свободно — заселить' : 'свободно'}
                                            className={`w-8 h-8 rounded-lg text-[10px] font-black flex items-center justify-center transition-transform ${BED_STYLE[b.state]} ${clickable ? 'cursor-pointer hover:scale-110' : 'cursor-default'} ${b.state === 'free' && onCheckInBed ? 'hover:border-teal-400 hover:text-teal-500' : ''}`}>
                                            {b.state === 'free' && onCheckInBed ? '+' : b.n}
                                        </button>
                                    );
                                })}
                                {extra.map(g => (
                                    <button key={g.id} onClick={() => onOpenGuest(g)} title={`${g.fullName} (доп. место)`}
                                        className="h-8 px-2 rounded-lg text-[10px] font-black bg-purple-50 text-purple-600 border border-purple-200 cursor-pointer">
                                        +доп
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="text-[11px] text-slate-400 mt-2.5">
                            {parseInt(room.capacity || 0)} мест{room.gender ? ` · ${room.gender}` : ''}{room.price ? ` · ${parseInt(room.price).toLocaleString('ru-RU')}/ночь` : ''}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-4 mt-5 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-teal-50 border border-teal-300 inline-block" /> занято</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-dashed border-slate-300 inline-block" /> свободно</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-50 border border-rose-300 inline-block" /> долг</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-300 inline-block" /> просрочен выезд</span>
            </div>
        </div>
    );
};

export default RoomsBeta;
