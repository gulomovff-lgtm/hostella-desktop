import React, { useMemo, useState } from 'react';
import { AlertCircle, Search } from 'lucide-react';

const getTotalPaid = (g) => (typeof g.amountPaid === 'number'
    ? g.amountPaid
    : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0) + (g.paidTransfer || 0)));

const fmtMoney = (n) => (n || 0).toLocaleString('ru-RU');
const norm = (s) => (s || '').toString().toLowerCase();
const getLocalDateString = (d) => {
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 10);
};

const DebtsBeta = ({ guests = [], onOpenGuest, onPayDebt }) => {
    const [q, setQ] = useState('');
    const todayStr = getLocalDateString(new Date());
    const ymd = (d) => (d ? getLocalDateString(new Date(d)) : '');

    const data = useMemo(() => {
        const debtors = guests
            .filter(g => g.status !== 'booking')
            .map(g => ({ g, debt: Math.max(0, (g.totalPrice || 0) - getTotalPaid(g)) }))
            .filter(x => x.debt > 0)
            .sort((a, b) => b.debt - a.debt);
        return {
            debtors,
            total: debtors.reduce((s, x) => s + x.debt, 0),
            living: debtors.filter(x => x.g.status === 'active').length,
            gone: debtors.filter(x => x.g.status === 'checked_out').length,
        };
    }, [guests]);

    const query = norm(q).trim();
    const visible = query
        ? data.debtors.filter(x => norm(`${x.g.fullName} ${x.g.passport || ''} ${x.g.phone || ''}`).includes(query))
        : data.debtors;

    return (
        <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-1">
                <h1 className="text-xl md:text-2xl font-black text-slate-800">Долги</h1>
                <span className="text-sm text-slate-400">кнопка «Принять» пишет оплату сразу в базу</span>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 mb-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Всего долгов</div>
                    <div className="text-xl font-black text-rose-500 tabular-nums">{fmtMoney(data.total)}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{data.debtors.length} должников</div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Ещё живут</div>
                    <div className="text-xl font-black text-slate-800 tabular-nums">{data.living}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">взять при выезде</div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Уже выехали</div>
                    <div className="text-xl font-black text-amber-600 tabular-nums">{data.gone}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">нужен телефон</div>
                </div>
            </div>

            <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 focus-within:border-orange-300 px-3.5 py-2 mb-4 transition-colors">
                <Search size={14} className="text-slate-400" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Имя, паспорт или телефон…"
                    className="flex-1 text-sm outline-none bg-transparent text-slate-700" />
            </div>

            {visible.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 px-4 py-10 text-center">
                    <AlertCircle size={22} className="mx-auto mb-2 text-emerald-400" />
                    <div className="text-sm text-slate-400">{query ? 'Никого не нашлось.' : 'Долгов нет — отлично!'}</div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    {visible.map(({ g, debt }) => (
                        <div key={g.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-b-0 hover:bg-slate-50 transition-colors">
                            <button onClick={() => onOpenGuest(g)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${g.status === 'active' ? 'bg-emerald-400' : 'bg-slate-300'}`}
                                    title={g.status === 'active' ? 'живёт' : 'выехал'} />
                                <span className="min-w-0">
                                    <span className="block text-[13.5px] font-bold text-slate-800 truncate">{g.fullName}</span>
                                    <span className="block text-[11px] text-slate-400 truncate">
                                        {g.status === 'active'
                                            ? `живёт · комната ${g.roomNumber || '—'}${ymd(g.checkOutDate) === todayStr ? ' · выезд сегодня!' : ''}`
                                            : `выехал ${g.checkOutDate ? new Date(g.checkOutDate).toLocaleDateString('ru-RU') : ''}${g.phone ? ` · ${g.phone}` : ' · телефона нет'}`}
                                    </span>
                                </span>
                            </button>
                            <span className="text-[14px] font-black text-rose-500 tabular-nums flex-shrink-0">{fmtMoney(debt)}</span>
                            {onPayDebt && (
                                <button onClick={() => onPayDebt(g)}
                                    className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-black transition-colors">
                                    Принять
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DebtsBeta;
