import React, { useState, useMemo } from 'react';
import { Search, Trash2, Plus, ShieldCheck, X, UserPlus } from 'lucide-react';

const norm = (p) => (p || '').replace(/\s/g, '').toUpperCase();
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const inputCls = 'w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition';

/**
 * PricePermissionsView — список клиентов с разрешением на понижение цены.
 * Видно у кого есть «добро», можно добавить вручную и убрать.
 */
const PricePermissionsView = ({ whitelist = [], clients = [], guests = [], onGrant, onRevoke }) => {
    const [search, setSearch] = useState('');
    const [picked, setPicked] = useState(null);
    const [price, setPrice] = useState('');
    const [listSearch, setListSearch] = useState('');

    const wlKeys = useMemo(() => new Set(whitelist.map(w => norm(w.passport || w.id))), [whitelist]);

    // Уже одобренные ранее (флаг на госте), но ещё не в списке — для добавления одной кнопкой
    const alreadyApproved = useMemo(() => {
        const byPass = new Map();
        guests.forEach(g => {
            if (!g.priceReductionAllowed && !(parseInt(g.approvedPrice) > 0)) return;
            if (!g.passport) return;
            const key = norm(g.passport);
            if (wlKeys.has(key)) return; // уже в списке
            const price = parseInt(g.approvedPrice) || parseInt(g.pricePerNight) || 0;
            const prev = byPass.get(key);
            // берём запись с самой свежей датой заезда
            if (!prev || new Date(g.checkInDate || 0) > new Date(prev.checkInDate || 0)) {
                byPass.set(key, { passport: g.passport, fullName: g.fullName || '', price, checkInDate: g.checkInDate });
            }
        });
        return [...byPass.values()].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    }, [guests, wlKeys]);

    // Кандидаты для добавления — клиенты с паспортом, которых ещё нет в списке
    const candidates = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return [];
        return clients
            .filter(c => c.passport && !wlKeys.has(norm(c.passport)))
            .filter(c => (c.fullName || '').toLowerCase().includes(q) || (c.passport || '').toLowerCase().includes(q))
            .slice(0, 8);
    }, [clients, search, wlKeys]);

    const shownList = useMemo(() => {
        const q = listSearch.trim().toLowerCase();
        const sorted = [...whitelist].sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0));
        if (!q) return sorted;
        return sorted.filter(w => (w.name || '').toLowerCase().includes(q) || (w.passport || '').toLowerCase().includes(q));
    }, [whitelist, listSearch]);

    const submitGrant = () => {
        if (!picked) return;
        onGrant?.(picked, parseInt(price) || 0);
        setPicked(null); setSearch(''); setPrice('');
    };

    return (
        <div className="space-y-4 animate-in fade-in pb-20">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                    <ShieldCheck size={20} className="text-teal-600" />
                </div>
                <div>
                    <h2 className="font-black text-xl text-slate-800">Разрешения на понижение цены</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{whitelist.length} в списке · при повторном заселении запрос не показывается</p>
                </div>
            </div>

            {/* Add */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <p className="text-xs font-bold text-slate-600 uppercase flex items-center gap-1.5"><UserPlus size={14} className="text-teal-500" /> Добавить вручную</p>
                {!picked ? (
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input className={`${inputCls} pl-9`} placeholder="Поиск клиента по ФИО или паспорту…" value={search} onChange={e => setSearch(e.target.value)} />
                        {search && candidates.length > 0 && (
                            <div className="mt-1 bg-white border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto shadow-sm">
                                {candidates.map(c => (
                                    <button key={c.id} onClick={() => { setPicked(c); setSearch(''); }}
                                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-teal-50 transition-colors border-b border-slate-50 last:border-0">
                                        <div className="font-bold text-slate-700">{c.fullName || '—'}</div>
                                        <div className="text-[11px] text-slate-400 font-mono">{c.passport}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                        {search && candidates.length === 0 && <p className="text-[11px] text-slate-400 mt-1 px-1">Не найдено (или уже в списке)</p>}
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-xl px-3 py-2">
                            <div>
                                <div className="font-bold text-teal-800 text-sm">{picked.fullName || '—'}</div>
                                <div className="text-[11px] text-teal-600 font-mono">{picked.passport}</div>
                            </div>
                            <button onClick={() => setPicked(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-white"><X size={16} /></button>
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">Согласованная цена (сум/ночь, опционально)</label>
                            <input type="number" className={inputCls} placeholder="напр. 50000" value={price} onChange={e => setPrice(e.target.value)} onWheel={e => e.target.blur()} />
                        </div>
                        <button onClick={submitGrant} className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all">
                            <Plus size={16} /> Добавить в список
                        </button>
                    </div>
                )}
            </div>

            {/* Уже одобренные ранее, но не в списке */}
            {alreadyApproved.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs font-bold text-amber-700 uppercase">Уже одобрены ранее — не в списке ({alreadyApproved.length})</p>
                        <button onClick={() => alreadyApproved.forEach(g => onGrant?.(g, g.price))}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1 active:scale-95 transition-all">
                            <Plus size={13} /> Добавить всех
                        </button>
                    </div>
                    <div className="space-y-1.5 max-h-72 overflow-y-auto">
                        {alreadyApproved.map(g => (
                            <div key={norm(g.passport)} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2 border border-amber-100">
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-700 text-sm truncate">{g.fullName || '—'}</div>
                                    <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{g.passport}</span>
                                        {g.price > 0 && <span className="text-teal-600 font-semibold">{Number(g.price).toLocaleString()} сум</span>}
                                    </div>
                                </div>
                                <button onClick={() => onGrant?.(g, g.price)}
                                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1 shrink-0 active:scale-95 transition-all">
                                    <Plus size={12} /> В список
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* List */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm">В списке ({whitelist.length})</span>
                    {whitelist.length > 0 && (
                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 w-40" placeholder="Поиск…" value={listSearch} onChange={e => setListSearch(e.target.value)} />
                        </div>
                    )}
                </div>
                {shownList.length === 0 ? (
                    <div className="p-10 text-center text-slate-400">
                        <ShieldCheck size={32} className="mx-auto mb-2 text-slate-300" />
                        <div className="font-semibold text-sm">{whitelist.length === 0 ? 'Список пуст' : 'Ничего не найдено'}</div>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {shownList.map(w => (
                            <div key={w.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
                                    <ShieldCheck size={16} className="text-teal-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-800 text-sm truncate">{w.name || '—'}</div>
                                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                                        <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{w.passport || w.id}</span>
                                        {w.price > 0 && <span className="text-teal-600 font-semibold">{Number(w.price).toLocaleString()} сум</span>}
                                        <span>· {w.source === 'manual' ? 'вручную' : 'Telegram'} · {w.addedBy || '—'} · {fmtDate(w.addedAt)}</span>
                                    </div>
                                </div>
                                <button onClick={() => onRevoke?.(w)} title="Убрать из списка"
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PricePermissionsView;
