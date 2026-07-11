import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Zap, User, Hash, LayoutGrid, ArrowRight } from 'lucide-react';

const getTotalPaid = (g) => (typeof g.amountPaid === 'number'
    ? g.amountPaid
    : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0) + (g.paidTransfer || 0)));

const getLocalDateString = (d) => {
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 10);
};

const SECTIONS = [
    { id: 'today',    label: 'Сегодня',    k: 'сегодня обзор главная today' },
    { id: 'rooms',    label: 'Комнаты',    k: 'комнаты проживание rooms карта мест' },
    { id: 'clients',  label: 'Гости',      k: 'гости клиенты guests список долги emehmon' },
    { id: 'expenses', label: 'Деньги',     k: 'деньги касса расходы money сверка' },
    { id: 'calendar', label: 'Календарь',  k: 'календарь calendar' },
    { id: 'bookings', label: 'Брони',      k: 'брони booking бронирования' },
    { id: 'registrations', label: 'E-mehmon', k: 'emehmon мехмон регистрация' },
];

const norm = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, ' ').trim();
const fmtMoney = (n) => (n || 0).toLocaleString('ru-RU');

const CommandPalette = ({ guests = [], payments = [], onClose, onGoTab, onOpenGuest, onOpenExpense, inMainApp }) => {
    const [q, setQ] = useState('');
    const inputRef = useRef(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const todayStr = getLocalDateString(new Date());
    const ymd = (d) => (d ? getLocalDateString(new Date(d)) : '');

    // ── Умные подсказки по текущему состоянию базы ──
    const smart = useMemo(() => {
        const now = new Date();
        const out = [];
        const active = guests.filter(g => g.status === 'active');

        const expired = active.filter(g => {
            if (!g.checkOutDate) return false;
            const co = new Date(g.checkOutDate);
            if (typeof g.checkOutDate === 'string' && !g.checkOutDate.includes('T')) co.setHours(12, 0, 0, 0);
            return now > co;
        });
        if (expired.length) out.push({
            icon: Zap, title: `Просроченные выезды: ${expired.length}`,
            why: expired.slice(0, 2).map(g => g.fullName).join(', ') + (expired.length > 2 ? '…' : ''),
            run: () => onGoTab('today'),
        });

        const debtDeparting = active.filter(g =>
            ymd(g.checkOutDate) === todayStr && (g.totalPrice || 0) - getTotalPaid(g) > 0);
        if (debtDeparting.length) out.push({
            icon: Zap, title: `Долги у выезжающих сегодня: ${debtDeparting.length}`,
            why: debtDeparting.map(g => `${g.fullName} · ${fmtMoney((g.totalPrice || 0) - getTotalPaid(g))}`).slice(0, 2).join(', '),
            run: () => onGoTab('today'),
        });

        const emehmon = active.filter(g => !g.emehmonReg && !g.emehmonSkip);
        if (emehmon.length) out.push({
            icon: Zap, title: `E-mehmon: не зарегистрированы ${emehmon.length}`,
            why: 'штраф при просрочке — проверьте сегодня',
            run: () => onGoTab('registrations'),
        });

        const arriving = guests.filter(g => g.status === 'booking' && ymd(g.checkInDate || g.checkInDateTime) === todayStr);
        if (arriving.length) out.push({
            icon: Zap, title: `Ожидаются заезды сегодня: ${arriving.length}`,
            why: arriving.slice(0, 2).map(g => g.fullName).join(', ') + (arriving.length > 2 ? '…' : ''),
            run: () => onGoTab('today'),
        });
        return out.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guests, todayStr]);

    // ── Результаты по запросу ──
    const results = useMemo(() => {
        const query = norm(q);
        if (!query) return null;

        // Сумма?
        const digits = query.replace(/[\s.,]/g, '');
        if (/^\d{3,}$/.test(digits)) {
            const amount = parseInt(digits, 10);
            const matches = payments.filter(p => parseInt(p.amount) === amount);
            const items = [];
            items.push({
                icon: Hash, title: `Записать расход ${fmtMoney(amount)} UZS`,
                why: 'откроется форма расхода', run: () => onOpenExpense?.(),
            });
            items.push({
                icon: Hash, title: `Принять оплату ${fmtMoney(amount)} UZS`,
                why: 'откройте гостя в списке — кнопка «Принять оплату» в карточке',
                run: () => onGoTab('clients'),
            });
            if (matches.length) items.push({
                icon: Hash, title: `Найдены платежи на ${fmtMoney(amount)}: ${matches.length}`,
                why: matches.slice(0, 2).map(p => `${p.guestName || 'без имени'} · ${ymd(p.date)}`).join(', '),
                run: () => onGoTab('expenses'),
            });
            return [{ section: 'Похоже на сумму', items }];
        }

        const out = [];

        // Гости: имя / паспорт / телефон
        const gm = guests.filter(g => {
            const hay = norm(`${g.fullName} ${g.passport || ''} ${g.phone || ''}`);
            return hay.includes(query);
        });
        // живущие выше, потом брони, потом выехавшие
        const rank = { active: 0, booking: 1, checked_out: 2 };
        gm.sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3));
        if (gm.length) out.push({
            section: 'Гости',
            items: gm.slice(0, 6).map(g => ({
                icon: User,
                title: g.fullName,
                why: `${g.status === 'active' ? `живёт · комната ${g.roomNumber || '—'}` : g.status === 'booking' ? 'бронь' : 'выехал'}`
                    + ((g.totalPrice || 0) - getTotalPaid(g) > 0 ? ` · долг ${fmtMoney((g.totalPrice || 0) - getTotalPaid(g))}` : ''),
                run: () => onOpenGuest(g),
            })),
        });

        // Разделы
        const sm = SECTIONS.filter(s => s.k.includes(query) || norm(s.label).includes(query));
        if (sm.length) out.push({
            section: 'Разделы',
            items: sm.map(s => ({ icon: LayoutGrid, title: s.label, why: '', run: () => onGoTab(s.id) })),
        });

        return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, guests, payments]);

    const Item = ({ it, accent }) => {
        const Icon = it.icon;
        return (
            <button onClick={it.run}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-orange-50"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${accent ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                    <Icon size={14} />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-bold text-slate-800 truncate">{it.title}</span>
                    {it.why && <span className="block text-[11.5px] text-slate-400 truncate">{it.why}</span>}
                </span>
                <ArrowRight size={13} className="text-slate-300 flex-shrink-0" />
            </button>
        );
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-start justify-center pt-24 px-4"
            style={{ background: 'rgba(8,18,20,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
                    <Zap size={16} className="text-orange-500 flex-shrink-0" />
                    <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
                        placeholder="Имя гостя, паспорт, сумма или раздел…"
                        className="flex-1 text-[15px] outline-none bg-transparent text-slate-800" />
                    <span className="text-[10px] font-bold text-slate-300 border border-slate-200 rounded px-1.5 py-0.5">ESC</span>
                </div>
                <div className="max-h-[380px] overflow-y-auto pb-2">
                    {!results && (
                        <>
                            {smart.length > 0 && (
                                <>
                                    <div className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Подсказки сейчас</div>
                                    {smart.map((it, i) => <Item key={i} it={it} accent />)}
                                </>
                            )}
                            <div className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Разделы</div>
                            {SECTIONS.slice(0, 4).map(s => (
                                <Item key={s.id} it={{ icon: LayoutGrid, title: s.label, why: '', run: () => onGoTab(s.id) }} />
                            ))}
                        </>
                    )}
                    {results && results.length === 0 && (
                        <div className="px-4 py-8 text-center text-sm text-slate-400">
                            Ничего не нашлось. Попробуйте имя гостя, сумму («50000») или раздел («комнаты»).
                        </div>
                    )}
                    {results && results.map((grp, i) => (
                        <React.Fragment key={i}>
                            <div className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{grp.section}</div>
                            {grp.items.map((it, j) => <Item key={j} it={it} accent={grp.section === 'Похоже на сумму'} />)}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
