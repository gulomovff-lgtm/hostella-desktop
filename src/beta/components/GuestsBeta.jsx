import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';

const getTotalPaid = (g) => (typeof g.amountPaid === 'number'
    ? g.amountPaid
    : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0) + (g.paidTransfer || 0)));

const getLocalDateString = (d) => {
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 10);
};

const fmtMoney = (n) => (n || 0).toLocaleString('ru-RU');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : '—');
const norm = (s) => (s || '').toString().toLowerCase();

const Pill = ({ tone, children }) => {
    const TONES = {
        good:  'bg-emerald-50 text-emerald-600',
        warn:  'bg-amber-50 text-amber-600',
        bad:   'bg-rose-50 text-rose-600',
        mut:   'bg-slate-100 text-slate-400',
        info:  'bg-indigo-50 text-indigo-600',
    };
    return <span className={`inline-flex text-[10.5px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${TONES[tone]}`}>{children}</span>;
};

const GuestsBeta = ({ guests = [], clients = [], onOpenGuest, initialFilter }) => {
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState(initialFilter || 'active');
    const [copiedId, setCopiedId] = useState(null);

    // «Вернуть клиентов»: постоянные (2+ визита), не в ЧС, не были 30+ дней.
    // Скоринг: визиты × давность — сверху те, кого вероятнее вернуть.
    const returnCandidates = useMemo(() => {
        const now = Date.now();
        return clients
            .filter(c => (c.visits || 0) >= 2 && c.clientStatus !== 'blacklist' && c.lastVisit)
            .map(c => {
                const daysAgo = Math.floor((now - new Date(c.lastVisit).getTime()) / 86400000);
                return { c, daysAgo, score: (c.visits || 0) * 10 - Math.min(daysAgo, 365) / 30 };
            })
            .filter(x => x.daysAgo >= 30 && x.daysAgo <= 365)
            .sort((a, b) => b.score - a.score)
            .slice(0, 50);
    }, [clients]);

    const copyPhone = async (c) => {
        try {
            await navigator.clipboard.writeText(c.phone || '');
            setCopiedId(c.id);
            setTimeout(() => setCopiedId(null), 1500);
        } catch { /* ignore */ }
    };

    const todayStr = getLocalDateString(new Date());
    const ymd = (d) => (d ? getLocalDateString(new Date(d)) : '');

    const enriched = useMemo(() => guests.map(g => ({
        g,
        debt: g.status !== 'booking' ? Math.max(0, (g.totalPrice || 0) - getTotalPaid(g)) : 0,
        depToday: ymd(g.checkOutDate) === todayStr,
        needsEmehmon: g.status === 'active' && !g.emehmonReg && !g.emehmonSkip,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    })), [guests, todayStr]);

    const counts = useMemo(() => ({
        active: enriched.filter(x => x.g.status === 'active').length,
        debt: enriched.filter(x => x.debt > 0 && x.g.status !== 'booking').length,
        emehmon: enriched.filter(x => x.needsEmehmon).length,
        dep: enriched.filter(x => x.g.status === 'active' && x.depToday).length,
        booking: enriched.filter(x => x.g.status === 'booking').length,
        all: enriched.length,
    }), [enriched]);

    const visible = useMemo(() => {
        let list = enriched;
        if (filter === 'active') list = list.filter(x => x.g.status === 'active');
        if (filter === 'debt') list = list.filter(x => x.debt > 0 && x.g.status !== 'booking');
        if (filter === 'emehmon') list = list.filter(x => x.needsEmehmon);
        if (filter === 'dep') list = list.filter(x => x.g.status === 'active' && x.depToday);
        if (filter === 'booking') list = list.filter(x => x.g.status === 'booking');
        const query = norm(q).trim();
        if (query) {
            list = list.filter(x =>
                norm(`${x.g.fullName} ${x.g.passport || ''} ${x.g.phone || ''}`).includes(query));
        }
        return list.slice(0, 200);
    }, [enriched, filter, q]);

    const chips = [
        { id: 'active',  label: `Живут · ${counts.active}` },
        { id: 'debt',    label: `С долгом · ${counts.debt}` },
        { id: 'emehmon', label: `Без E-mehmon · ${counts.emehmon}` },
        { id: 'dep',     label: `Выезжают сегодня · ${counts.dep}` },
        { id: 'booking', label: `Брони · ${counts.booking}` },
        { id: 'all',     label: `Все · ${counts.all}` },
        { id: 'return',  label: `✨ Вернуть · ${returnCandidates.length}` },
    ];

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-1">
                <h1 className="text-xl md:text-2xl font-black text-slate-800">Гости</h1>
                <span className="text-sm text-slate-400">один список — все состояния: долг и E-mehmon видны сразу</span>
            </div>

            <div className="flex items-center gap-3 mt-4 mb-1 bg-white rounded-xl border-2 border-slate-200 focus-within:border-orange-300 px-4 py-2.5 transition-colors">
                <Search size={16} className="text-slate-400 flex-shrink-0" />
                <input value={q} onChange={e => setQ(e.target.value)}
                    placeholder="Имя, паспорт или телефон — по всей базе"
                    className="flex-1 text-sm outline-none bg-transparent text-slate-800" />
            </div>
            <p className="text-[11px] text-slate-400 mb-3 ml-1">Поиск понимает часть имени, номер паспорта и телефон.</p>

            <div className="flex flex-wrap gap-2 mb-4">
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

            {filter === 'return' && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-4">
                    <div className="px-4 py-3 border-b border-slate-100 bg-orange-50/50">
                        <div className="text-xs font-black uppercase tracking-wider text-orange-600">Умный подбор: кого вернуть</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                            Постоянные гости (2+ визита), которые не были от месяца до года. Отсортированы по вероятности возврата — звоните сверху вниз.
                        </div>
                    </div>
                    {returnCandidates.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-slate-400">Кандидатов пока нет — все постоянные гости были недавно.</div>
                    ) : returnCandidates.map(({ c, daysAgo }) => (
                        <div key={c.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-b-0 hover:bg-slate-50 transition-colors">
                            <span className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 text-[11px] font-black flex items-center justify-center flex-shrink-0">
                                {c.visits}×
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-[13.5px] font-bold text-slate-800 truncate">{c.fullName}</span>
                                <span className="block text-[11px] text-slate-400">
                                    был {daysAgo} дн. назад · {c.visits} визитов
                                    {(parseInt(c.balance) || 0) > 0 ? ` · бонус ${(parseInt(c.balance)).toLocaleString('ru-RU')} — повод позвонить!` : ''}
                                </span>
                            </span>
                            {c.phone ? (
                                <>
                                    <span className="text-[12px] font-bold text-slate-600 tabular-nums flex-shrink-0">{c.phone}</span>
                                    <button onClick={() => copyPhone(c)}
                                        className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[10.5px] font-black text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors">
                                        {copiedId === c.id ? '✓' : 'Копир.'}
                                    </button>
                                </>
                            ) : (
                                <span className="text-[11px] text-slate-300 flex-shrink-0">телефона нет</span>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className={`bg-white rounded-2xl border border-slate-200 overflow-x-auto ${filter === 'return' ? 'hidden' : ''}`}>
                {visible.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                        <div className="text-sm text-slate-400">Никого не нашлось — измените фильтр или запрос.</div>
                        <button onClick={() => { setFilter('all'); setQ(''); }}
                            className="mt-3 px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors">
                            Показать всех гостей
                        </button>
                    </div>
                ) : (
                    <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 640 }}>
                        <thead>
                            <tr>
                                {['Гость', 'Место', 'Проживание', 'Оплата', 'E-mehmon'].map(h => (
                                    <th key={h} className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 px-4 py-2.5 border-b border-slate-100">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map(({ g, debt, depToday, needsEmehmon }) => (
                                <tr key={g.id} onClick={() => onOpenGuest(g)}
                                    className="cursor-pointer hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-2.5 border-b border-slate-50">
                                        <div className="text-[13.5px] font-bold text-slate-800">{g.fullName}</div>
                                        <div className="text-[11px] text-slate-400">{[g.country, g.passport].filter(Boolean).join(' · ') || '—'}</div>
                                    </td>
                                    <td className="px-4 py-2.5 border-b border-slate-50 text-[13px] tabular-nums text-slate-600 whitespace-nowrap">
                                        {g.roomNumber ? `${g.roomNumber}-${g.bedId ?? '?'}` : '—'}
                                    </td>
                                    <td className="px-4 py-2.5 border-b border-slate-50 text-[12.5px] tabular-nums text-slate-600 whitespace-nowrap">
                                        {fmtDate(g.checkInDate)} → {fmtDate(g.checkOutDate)}
                                        {g.status === 'active' && depToday && <span className="block text-[10px] font-bold text-indigo-500">выезд сегодня</span>}
                                        {g.status === 'booking' && <span className="block text-[10px] font-bold text-amber-500">бронь</span>}
                                        {g.status === 'checked_out' && <span className="block text-[10px] text-slate-400">выехал</span>}
                                    </td>
                                    <td className="px-4 py-2.5 border-b border-slate-50">
                                        {g.status === 'booking'
                                            ? <Pill tone="mut">бронь</Pill>
                                            : debt > 0 ? <Pill tone="bad">долг {fmtMoney(debt)}</Pill> : <Pill tone="good">оплачено</Pill>}
                                    </td>
                                    <td className="px-4 py-2.5 border-b border-slate-50">
                                        {g.status === 'booking' ? <Pill tone="mut">—</Pill>
                                            : g.emehmonReg && !g.emehmonOut && g.status === 'checked_out' ? <Pill tone="warn">вывести</Pill>
                                            : g.emehmonReg ? <Pill tone="good">✓ отправлен</Pill>
                                            : g.emehmonSkip ? <Pill tone="mut">не требуется</Pill>
                                            : needsEmehmon ? <Pill tone="warn">не отправлен</Pill>
                                            : <Pill tone="mut">—</Pill>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default GuestsBeta;
