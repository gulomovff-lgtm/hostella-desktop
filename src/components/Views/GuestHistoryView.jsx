import React, { useState, useMemo } from 'react';
import {
    History, Search, Download, ChevronDown, ChevronRight,
    X, Filter, TrendingUp, TrendingDown, Minus, Users,
    Banknote, CreditCard, QrCode, Building2, ArrowRight, RefreshCw,
    Eye, EyeOff,
} from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────────────────────

const HOSTELS = { hostel1: 'Хостел №1', hostel2: 'Хостел №2' };
const METHOD_LABEL = { cash: 'Нал', card: 'Карта', qr: 'QR' };
const METHOD_COLOR = {
    cash: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    card: 'bg-blue-50 text-blue-700 border-blue-200',
    qr:   'bg-purple-50 text-purple-700 border-purple-200',
};
const METHOD_ICON = { cash: Banknote, card: CreditCard, qr: QrCode };

const fmt     = n => (parseInt(n) || 0).toLocaleString('ru');
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const ymd     = iso => iso ? new Date(iso).toISOString().slice(0, 10) : '';

const getTotalPaid = g =>
    typeof g.amountPaid === 'number'
        ? g.amountPaid
        : (g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0);

// Найти смену кассира, активную в момент платежа
const findShift = (shifts, staffId, payDate) => {
    const pt = new Date(payDate).getTime();
    return shifts.find(s =>
        s.staffId === staffId &&
        new Date(s.startTime).getTime() <= pt &&
        (!s.endTime || new Date(s.endTime).getTime() >= pt)
    ) || null;
};

// ── Sub-components ───────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, sub, highlight }) => (
    <div className={`flex flex-col gap-1 bg-white border rounded-2xl px-4 py-3 shadow-sm ${highlight ? 'border-indigo-200' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold uppercase">
            <Icon size={13} className={highlight ? 'text-indigo-500' : 'text-slate-400'}/> {label}
        </div>
        <div className={`text-xl font-black ${highlight ? 'text-indigo-700' : 'text-slate-800'}`}>{value}</div>
        {sub && <div className="text-[11px] text-slate-400 truncate">{sub}</div>}
    </div>
);

const MethodChip = ({ method, amount }) => {
    const Icon = METHOD_ICON[method] || Banknote;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${METHOD_COLOR[method] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            <Icon size={10}/> {METHOD_LABEL[method] || method} {fmt(amount)}
        </span>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────

const GuestHistoryView = ({ guests = [], payments = [], shifts = [], users = [], currentUser, auditLog = [] }) => {
    const [search,             setSearch            ] = useState('');
    const [filterHostel,       setFilterHostel      ] = useState('');
    const [filterDateFrom,     setFilterDateFrom    ] = useState('');
    const [filterDateTo,       setFilterDateTo      ] = useState('');
    const [filterCashier,      setFilterCashier     ] = useState('');
    const [filterStatus,       setFilterStatus      ] = useState('all');
    const [filterPriceChanged, setFilterPriceChanged] = useState('all');
    const [expandedKeys,       setExpandedKeys      ] = useState(new Set());
    const [expandedStays,      setExpandedStays     ] = useState(new Set());
    const [pageSize,           setPageSize          ] = useState(50);
    const [sortKey,            setSortKey           ] = useState('lastDate');
    const [sortAsc,            setSortAsc           ] = useState(false);
    const HIDDEN_KEY = 'hostella_hidden_guest_groups';
    const [hiddenKeys,  setHiddenKeys ] = useState(() => {
        try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')); }
        catch { return new Set(); }
    });
    const [showHidden,  setShowHidden ] = useState(false);

    // Resolve staffId → user name
    const resolveUser = (staffId) => {
        if (!staffId) return '—';
        const u = users.find(u => u.id === staffId || u.login === staffId);
        return u?.name || u?.login || staffId;
    };

    // Unique cashiers from payments (for filter dropdown)
    const cashierOptions = useMemo(() => {
        const seen = new Map();
        payments.forEach(p => {
            if (p.staffId && !seen.has(p.staffId)) {
                seen.set(p.staffId, resolveUser(p.staffId));
            }
        });
        return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [payments, users]);

    // Обогащаем каждое заселение
    const enriched = useMemo(() => {
        return guests
            .filter(g => g.status !== 'booking')
            .map(g => {
                const gPays = payments.filter(p => p.guestId === g.id);
                const enrichedPays = gPays.map(p => {
                    const shift = findShift(shifts, p.staffId, p.date);
                    return {
                        ...p,
                        cashierName: resolveUser(p.staffId),
                        shiftStart: shift?.startTime || null,
                        shiftEnd:   shift?.endTime   || null,
                    };
                }).sort((a, b) => new Date(a.date) - new Date(b.date));
                return {
                    ...g,
                    guestPayments: enrichedPays,
                    totalPaid:     getTotalPaid(g),
                    checkInCashier: resolveUser(g.staffId || g.createdBy),
                };
            });
    }, [guests, payments, shifts, users]);

    // Группируем заселения по имени гостя
    const grouped = useMemo(() => {
        const map = new Map();
        enriched.forEach(g => {
            const key = (g.fullName || '—').trim();
            if (!map.has(key)) map.set(key, { key, name: key, stays: [] });
            map.get(key).stays.push(g);
        });
        return Array.from(map.values()).map(grp => {
            grp.stays.sort((a, b) => new Date(b.checkInDate) - new Date(a.checkInDate));
            // Уникальные ненулевые цены — именно это определяет «разные цены»
            const validPrices = [...new Set(
                grp.stays.map(s => parseInt(s.pricePerNight) || 0).filter(p => p > 0)
            )].sort((a, b) => a - b);
            const hasPriceVariation = validPrices.length > 1;
            const totalPaid    = grp.stays.reduce((s, g) => s + g.totalPaid, 0);
            const totalAmount  = grp.stays.reduce((s, g) => s + (g.totalPrice || 0), 0);
            const isActive     = grp.stays.some(s => s.status === 'active');
            const hostels      = [...new Set(grp.stays.map(s => s.hostelId).filter(Boolean))];
            const lastDate     = grp.stays[0]?.checkInDate || '';
            return { ...grp, validPrices, hasPriceVariation, totalPaid, totalAmount,
                totalDebt: totalAmount - totalPaid, isActive, hostels, lastDate,
                stayCount: grp.stays.length };
        });
    }, [enriched]);

    // Статистика по сгруппированным данным
    const stats = useMemo(() => {
        const allPrices = enriched.map(g => parseInt(g.pricePerNight) || 0).filter(p => p > 0);
        const avg = allPrices.length ? Math.round(allPrices.reduce((s, p) => s + p, 0) / allPrices.length) : 0;
        const min = allPrices.length ? Math.min(...allPrices) : null;
        const max = allPrices.length ? Math.max(...allPrices) : null;
        const minGuest = min !== null ? enriched.find(g => parseInt(g.pricePerNight) === min) : null;
        const maxGuest = max !== null ? enriched.find(g => parseInt(g.pricePerNight) === max) : null;
        return { count: grouped.length, withVariation: grouped.filter(g => g.hasPriceVariation).length,
            avg, min, max, minGuest, maxGuest };
    }, [grouped, enriched]);

    // Фильтр + сортировка по сгруппированным гостям
    const filtered = useMemo(() => {
        const s = search.toLowerCase();
        let list = grouped.filter(grp => {
            if (s && !grp.name.toLowerCase().includes(s) &&
                !grp.stays.some(g =>
                    (g.roomNumber || '').toString().includes(s) ||
                    (g.bedId || '').toString().includes(s) ||
                    g.guestPayments.some(p => p.cashierName.toLowerCase().includes(s))
                )) return false;
            if (filterHostel && !grp.stays.some(g => g.hostelId === filterHostel)) return false;
            if (filterStatus === 'active'      && !grp.stays.some(g => g.status === 'active'))      return false;
            if (filterStatus === 'checked_out' && !grp.stays.some(g => g.status === 'checked_out')) return false;
            if (filterDateFrom && !grp.stays.some(g => ymd(g.checkInDate) >= filterDateFrom)) return false;
            if (filterDateTo   && !grp.stays.some(g => ymd(g.checkInDate) <= filterDateTo))   return false;
            if (filterCashier) {
                const ok = grp.stays.some(g =>
                    g.guestPayments.some(p => p.staffId === filterCashier) ||
                    g.staffId === filterCashier || g.createdBy === filterCashier);
                if (!ok) return false;
            }
            // Фильтр разных цен — только из данных заселений, без auditLog
            if (filterPriceChanged === 'changed'   && !grp.hasPriceVariation) return false;
            if (filterPriceChanged === 'unchanged' &&  grp.hasPriceVariation) return false;
            if (!showHidden && hiddenKeys.has(grp.key)) return false;
            return true;
        });
        list.sort((a, b) => {
            if (sortKey === 'lastDate')    return sortAsc ? new Date(a.lastDate) - new Date(b.lastDate) : new Date(b.lastDate) - new Date(a.lastDate);
            if (sortKey === 'totalAmount') return sortAsc ? a.totalAmount - b.totalAmount : b.totalAmount - a.totalAmount;
            if (sortKey === 'stayCount')   return sortAsc ? a.stayCount - b.stayCount : b.stayCount - a.stayCount;
            return 0;
        });
        return list;
    }, [grouped, search, filterHostel, filterStatus, filterDateFrom, filterDateTo,
        filterCashier, filterPriceChanged, showHidden, hiddenKeys, sortKey, sortAsc]);

    const hasFilter = search || filterHostel || filterDateFrom || filterDateTo || filterCashier ||
        filterStatus !== 'all' || filterPriceChanged !== 'all';

    const resetFilters = () => {
        setSearch(''); setFilterHostel(''); setFilterDateFrom('');
        setFilterDateTo(''); setFilterCashier(''); setFilterStatus('all');
        setFilterPriceChanged('all');
    };

    const hideGroup = (key) => {
        const next = new Set(hiddenKeys); next.add(key); setHiddenKeys(next);
        try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next])); } catch {}
    };
    const unhideGroup = (key) => {
        const next = new Set(hiddenKeys); next.delete(key); setHiddenKeys(next);
        try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next])); } catch {}
    };
    const unhideAll = () => { setHiddenKeys(new Set()); try { localStorage.removeItem(HIDDEN_KEY); } catch {}; };

    const toggleExpand = (key) => {
        setExpandedKeys(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
    };
    const toggleStay = (id) => {
        setExpandedStays(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
    };
    const toggleSort = (key) => {
        if (sortKey === key) setSortAsc(a => !a);
        else { setSortKey(key); setSortAsc(false); }
    };

    const handleExport = () => {
        const rows = [['ФИО', 'Хостел(ы)', 'Заселений', 'Уникальных цен', 'Цены сум/ночь', 'Итого', 'Оплачено', 'Долг']];
        filtered.forEach(grp => {
            rows.push([grp.name, grp.hostels.map(h => HOSTELS[h] || h).join('; '),
                grp.stayCount, grp.validPrices.length,
                grp.validPrices.map(fmt).join('; '),
                grp.totalAmount, grp.totalPaid, grp.totalDebt]);
        });
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `guest_history_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    const INP = "px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-700 transition-all";
    const SortBtn = ({ k, label }) => (
        <button onClick={() => toggleSort(k)} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
            {label}
            {sortKey === k ? (sortAsc ? <TrendingUp size={11}/> : <TrendingDown size={11}/>) : <Minus size={11} className="opacity-30"/>}
        </button>
    );

    return (
        <div className="space-y-4 animate-in fade-in">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <History size={20} className="text-indigo-500"/> История проживания
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {filtered.length.toLocaleString()} гостей · {enriched.length.toLocaleString()} заселений
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {currentUser.role === 'super' && hiddenKeys.size > 0 && (
                        <div className="flex items-center gap-1">
                            <button onClick={() => setShowHidden(h => !h)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs border transition-colors ${
                                    showHidden
                                        ? 'bg-amber-100 text-amber-700 border-amber-300'
                                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                }`}>
                                {showHidden ? <EyeOff size={13}/> : <Eye size={13}/>}
                                {showHidden ? 'Спрятать скрытые' : `Скрытые (${hiddenKeys.size})`}
                            </button>
                            {showHidden && (
                                <button onClick={unhideAll}
                                    className="text-xs font-bold text-rose-500 hover:text-rose-700 px-2 py-2">
                                    Восстановить все
                                </button>
                            )}
                        </div>
                    )}
                    <button onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors shadow-sm">
                        <Download size={14}/> Экспорт CSV
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <StatCard icon={Users}       label="Уникальных гостей"  value={stats.count.toLocaleString()} />
                <StatCard icon={Minus}       label="Средняя цена/ночь"  value={`${fmt(stats.avg)} сум`} highlight />
                <StatCard icon={TrendingDown} label="Мин. цена"         value={stats.min !== null ? `${fmt(stats.min)} сум` : '—'} sub={stats.minGuest?.fullName} />
                <StatCard icon={TrendingUp}   label="Макс. цена"        value={stats.max !== null ? `${fmt(stats.max)} сум` : '—'} sub={stats.maxGuest?.fullName} />
                <StatCard
                    icon={RefreshCw}
                    label="С разными ценами"
                    value={stats.withVariation ? `${stats.withVariation} гост.` : '—'}
                    sub={stats.withVariation ? `из ${stats.count} гостей` : 'все по одной цене'}
                />
            </div>

            {/* Filters */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                    <Filter size={12}/> Фильтры
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Поиск по имени, комнате, кассиру…"
                            className={INP + ' w-full pl-8'}/>
                    </div>
                    <select value={filterHostel} onChange={e => setFilterHostel(e.target.value)} className={INP + ' w-full'}>
                        <option value="">Все хостелы</option>
                        <option value="hostel1">Хостел №1</option>
                        <option value="hostel2">Хостел №2</option>
                    </select>
                    <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={INP + ' w-full'}>
                        <option value="all">Все статусы</option>
                        <option value="active">Сейчас живут</option>
                        <option value="checked_out">Выехавшие</option>
                    </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <select value={filterCashier} onChange={e => setFilterCashier(e.target.value)} className={INP + ' w-full'}>
                        <option value="">Все кассиры</option>
                        {cashierOptions.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <label className="absolute -top-2 left-2 text-[10px] font-bold text-slate-400 bg-white px-1">Заезд с</label>
                            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className={INP + ' w-full'}/>
                        </div>
                        <span className="text-slate-300 font-bold shrink-0">—</span>
                        <div className="relative flex-1">
                            <label className="absolute -top-2 left-2 text-[10px] font-bold text-slate-400 bg-white px-1">по</label>
                            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className={INP + ' w-full'}/>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => setFilterPriceChanged(v => v === 'changed' ? 'all' : 'changed')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-sm border transition-colors ${
                                filterPriceChanged === 'changed'
                                    ? 'bg-amber-100 text-amber-700 border-amber-300'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}>
                            <RefreshCw size={14}/> С разными ценами
                        </button>
                        {hasFilter && (
                            <button onClick={resetFilters}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors">
                                <X size={12}/> Сбросить
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                {/* Table header */}
                <div className="hidden md:grid grid-cols-[2.5fr_1fr_1fr_1fr_1fr_1fr] px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase gap-2">
                    <span>Гость</span>
                    <span><SortBtn k="stayCount"   label="Заселений"/></span>
                    <span>Цены сум/ночь</span>
                    <span><SortBtn k="totalAmount" label="Итого"/></span>
                    <span>Оплачено</span>
                    <span>Долг</span>
                </div>

                {filtered.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="text-4xl mb-3">🏨</div>
                        <div className="text-slate-500 font-bold">Нет записей</div>
                        {hasFilter && (
                            <button onClick={resetFilters} className="mt-2 text-xs font-bold text-indigo-600">
                                Сбросить фильтры
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="divide-y divide-slate-100">
                            {filtered.slice(0, pageSize).map(grp => {
                                const isExpanded = expandedKeys.has(grp.key);
                                const isHidden   = hiddenKeys.has(grp.key);
                                const hasDebt    = grp.totalDebt > 0;
                                return (
                                    <div key={grp.key} className={`group/g ${isHidden ? 'opacity-40' : ''}`}>
                                        {/* Group header row */}
                                        <div
                                            className={`relative md:grid md:grid-cols-[2.5fr_1fr_1fr_1fr_1fr_1fr] flex flex-col px-4 py-3.5 gap-2 cursor-pointer hover:bg-slate-50/70 transition-colors ${isExpanded ? 'bg-indigo-50/30' : ''}`}
                                            onClick={() => toggleExpand(grp.key)}
                                        >
                                            {/* Name */}
                                            <div className="flex items-start gap-2 min-w-0">
                                                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${grp.isActive ? 'bg-emerald-400' : 'bg-slate-300'}`}/>
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-black text-slate-800 flex items-center gap-1.5 flex-wrap">
                                                        {grp.name}
                                                        {isHidden && <span className="text-[9px] font-normal text-slate-400 italic">(скрыт)</span>}
                                                        {grp.hasPriceVariation && (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">разные цены</span>
                                                        )}
                                                        {grp.isActive && (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">живёт</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                                                        {grp.hostels.map(h => (
                                                            <span key={h} className="flex items-center gap-0.5"><Building2 size={9}/>{HOSTELS[h] || h}</span>
                                                        ))}
                                                        {isExpanded
                                                            ? <ChevronDown size={11} className="text-indigo-500"/>
                                                            : <ChevronRight size={11} className="opacity-40"/>
                                                        }
                                                    </div>
                                                </div>
                                                {currentUser.role === 'super' && (
                                                    <button
                                                        onClick={e => { e.stopPropagation(); isHidden ? unhideGroup(grp.key) : hideGroup(grp.key); }}
                                                        className="opacity-0 group-hover/g:opacity-100 transition-opacity shrink-0 p-1.5 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500"
                                                        title={isHidden ? 'Показать гостя' : 'Скрыть из аналитики'}
                                                    >
                                                        {isHidden ? <Eye size={14}/> : <EyeOff size={14}/>}
                                                    </button>
                                                )}
                                            </div>
                                            {/* Stay count */}
                                            <div>
                                                <div className="font-bold text-slate-700">{grp.stayCount}</div>
                                                <div className="text-[10px] text-slate-400">заселений</div>
                                            </div>
                                            {/* Prices */}
                                            <div>
                                                {grp.hasPriceVariation ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {grp.validPrices.map((p, i) => (
                                                            <span key={i} className="text-xs font-bold bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded-lg border border-amber-200">{fmt(p)}</span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <div className="font-bold text-slate-700">{fmt(grp.validPrices[0] || 0)}</div>
                                                        <div className="text-[10px] text-slate-400">сум/ночь</div>
                                                    </div>
                                                )}
                                            </div>
                                            {/* Total */}
                                            <div>
                                                <div className="font-black text-slate-700">{fmt(grp.totalAmount)}</div>
                                                <div className="text-[10px] text-slate-400">итого</div>
                                            </div>
                                            {/* Paid */}
                                            <div>
                                                <div className="font-bold text-emerald-600">{fmt(grp.totalPaid)}</div>
                                                <div className="text-[10px] text-slate-400">оплачено</div>
                                            </div>
                                            {/* Debt */}
                                            <div>
                                                <div className={`font-bold ${hasDebt ? 'text-rose-600' : 'text-slate-400'}`}>
                                                    {hasDebt ? fmt(grp.totalDebt) : '—'}
                                                </div>
                                                {hasDebt && <div className="text-[10px] text-rose-400">долг</div>}
                                            </div>
                                        </div>

                                        {/* Expanded: individual stays */}
                                        {isExpanded && (
                                            <div className="bg-indigo-50/20 border-t border-indigo-100/60 divide-y divide-slate-100/80">
                                                {grp.stays.map((stay) => {
                                                    const stayExpanded = expandedStays.has(stay.id);
                                                    const stayActive   = stay.status === 'active';
                                                    const stayDebt     = (stay.totalPrice || 0) - stay.totalPaid;
                                                    return (
                                                        <div key={stay.id}>
                                                            {/* Stay row */}
                                                            <div
                                                                className={`flex flex-wrap items-center gap-3 px-8 py-2.5 cursor-pointer hover:bg-indigo-50/40 transition-colors ${stayExpanded ? 'bg-indigo-100/20' : ''}`}
                                                                onClick={() => toggleStay(stay.id)}
                                                            >
                                                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${stayActive ? 'bg-emerald-400' : 'bg-slate-300'}`}/>
                                                                {/* Dates */}
                                                                <div className="text-xs text-slate-600 min-w-[180px]">
                                                                    🟢 {fmtDate(stay.checkInDate)}
                                                                    <span className="mx-1.5 text-slate-300">→</span>
                                                                    {stay.checkOutDate ? `🔴 ${fmtDate(stay.checkOutDate)}` : <span className="text-emerald-500">живёт</span>}
                                                                    {stay.days && <span className="text-slate-400 ml-1.5">· {stay.days} н.</span>}
                                                                </div>
                                                                {/* Room */}
                                                                <div className="text-xs font-bold text-slate-600">
                                                                    Ком.{stay.roomNumber || '—'} · {stay.bedId || '—'}
                                                                    <span className="text-[10px] font-normal text-slate-400 ml-1">({HOSTELS[stay.hostelId] || stay.hostelId})</span>
                                                                </div>
                                                                {/* Price highlight */}
                                                                <div className={`text-xs font-black px-2 py-1 rounded-lg ${
                                                                    grp.hasPriceVariation ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                                                                }`}>
                                                                    {fmt(stay.pricePerNight)} сум/н.
                                                                </div>
                                                                {/* Totals */}
                                                                <div className="text-xs text-slate-600 ml-auto">
                                                                    <span className="font-bold">{fmt(stay.totalPrice)}</span>
                                                                    <span className="text-slate-400 mx-1">·</span>
                                                                    <span className="text-emerald-600 font-bold">{fmt(stay.totalPaid)}</span>
                                                                    {stayDebt > 0 && <span className="text-rose-500 ml-1">-{fmt(stayDebt)}</span>}
                                                                </div>
                                                                {/* Cashier */}
                                                                <div className="text-xs text-indigo-600 font-bold">{stay.checkInCashier}</div>
                                                                {stay.guestPayments.length > 0 && (
                                                                    stayExpanded
                                                                        ? <ChevronDown size={12} className="text-indigo-500 shrink-0"/>
                                                                        : <ChevronRight size={12} className="text-slate-300 shrink-0"/>
                                                                )}
                                                            </div>
                                                            {/* Payments */}
                                                            {stayExpanded && stay.guestPayments.length > 0 && (
                                                                <div className="px-16 py-2 space-y-1 bg-white/50">
                                                                    {stay.guestPayments.map((p, idx) => {
                                                                        const shiftLabel = p.shiftStart
                                                                            ? `${new Date(p.shiftStart).toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit' })}–${p.shiftEnd ? new Date(p.shiftEnd).toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit' }) : '...'}`
                                                                            : null;
                                                                        return (
                                                                            <div key={p.id || idx}
                                                                                className="flex flex-wrap items-center gap-2 bg-white border border-slate-100 rounded-xl px-3 py-1.5 text-xs">
                                                                                <MethodChip method={p.method} amount={p.amount}/>
                                                                                <span className="font-bold text-slate-700">{p.cashierName}</span>
                                                                                {shiftLabel && <span className="text-slate-400">смена {shiftLabel}</span>}
                                                                                <span className="text-slate-400 ml-auto">
                                                                                    {new Date(p.date).toLocaleDateString('ru', { day:'numeric', month:'short' })}
                                                                                    {' '}{new Date(p.date).toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit' })}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {filtered.length > pageSize && (
                            <div className="py-4 text-center border-t border-slate-100">
                                <button onClick={() => setPageSize(p => p + 50)}
                                    className="flex items-center gap-2 mx-auto px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                                    <ChevronDown size={15}/> Показать ещё ({(filtered.length - pageSize).toLocaleString()} гостей)
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default GuestHistoryView;
