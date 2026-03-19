import React, { useState, useMemo } from 'react';
import {
    History, Search, Download, ChevronDown, ChevronRight,
    X, Filter, TrendingUp, TrendingDown, Minus, Users,
    Banknote, CreditCard, QrCode, Building2,
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

const GuestHistoryView = ({ guests = [], payments = [], shifts = [], users = [], currentUser }) => {
    const [search,         setSearch        ] = useState('');
    const [filterHostel,   setFilterHostel  ] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo,   setFilterDateTo  ] = useState('');
    const [filterCashier,  setFilterCashier ] = useState('');
    const [filterStatus,   setFilterStatus  ] = useState('all'); // all | active | checked_out
    const [expandedIds,    setExpandedIds   ] = useState(new Set());
    const [pageSize,       setPageSize      ] = useState(100);
    const [sortKey,        setSortKey       ] = useState('checkInDate'); // checkInDate | pricePerNight | totalPrice
    const [sortAsc,        setSortAsc       ] = useState(false);

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

    // Build enriched guest list (exclude pure bookings with no checkin)
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

                // Cashier at check-in
                const checkInCashier = resolveUser(g.staffId || g.createdBy);

                return {
                    ...g,
                    guestPayments: enrichedPays,
                    totalPaid: getTotalPaid(g),
                    debt: (g.totalPrice || 0) - getTotalPaid(g),
                    checkInCashier,
                };
            });
    }, [guests, payments, shifts, users]);

    // Stats
    const stats = useMemo(() => {
        const valid = enriched.filter(g => g.pricePerNight > 0);
        if (!valid.length) return { count: 0, avg: 0, min: null, max: null };
        const prices = valid.map(g => parseInt(g.pricePerNight) || 0);
        const minP = Math.min(...prices);
        const maxP = Math.max(...prices);
        const minG = valid.find(g => parseInt(g.pricePerNight) === minP);
        const maxG = valid.find(g => parseInt(g.pricePerNight) === maxP);
        const avg  = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
        return { count: valid.length, avg, min: minP, max: maxP, minGuest: minG, maxGuest: maxG };
    }, [enriched]);

    // Filter + sort
    const filtered = useMemo(() => {
        const s = search.toLowerCase();
        let list = enriched.filter(g => {
            if (filterHostel && g.hostelId !== filterHostel) return false;
            if (filterStatus  === 'active'      && g.status !== 'active')      return false;
            if (filterStatus  === 'checked_out' && g.status !== 'checked_out') return false;
            if (filterDateFrom && ymd(g.checkInDate) < filterDateFrom) return false;
            if (filterDateTo   && ymd(g.checkInDate) > filterDateTo)   return false;
            if (filterCashier) {
                // Should have at least one payment from this cashier
                const hasPay = g.guestPayments.some(p => p.staffId === filterCashier);
                const isCheckinCashier = g.staffId === filterCashier || g.createdBy === filterCashier;
                if (!hasPay && !isCheckinCashier) return false;
            }
            if (s) {
                return (
                    (g.fullName    || '').toLowerCase().includes(s) ||
                    (g.roomNumber  || '').toString().includes(s) ||
                    (g.bedId       || '').toString().includes(s) ||
                    g.guestPayments.some(p => p.cashierName.toLowerCase().includes(s))
                );
            }
            return true;
        });

        list.sort((a, b) => {
            let va = a[sortKey] ?? 0;
            let vb = b[sortKey] ?? 0;
            if (sortKey === 'checkInDate') {
                va = new Date(va).getTime();
                vb = new Date(vb).getTime();
            } else {
                va = parseInt(va) || 0;
                vb = parseInt(vb) || 0;
            }
            return sortAsc ? va - vb : vb - va;
        });

        return list;
    }, [enriched, filterHostel, filterStatus, filterDateFrom, filterDateTo, filterCashier, search, sortKey, sortAsc]);

    const hasFilter = search || filterHostel || filterDateFrom || filterDateTo || filterCashier || filterStatus !== 'all';

    const resetFilters = () => {
        setSearch(''); setFilterHostel(''); setFilterDateFrom('');
        setFilterDateTo(''); setFilterCashier(''); setFilterStatus('all');
    };

    const toggleExpand = (id) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSort = (key) => {
        if (sortKey === key) setSortAsc(a => !a);
        else { setSortKey(key); setSortAsc(false); }
    };

    const handleExport = () => {
        const rows = [['ФИО', 'Хостел', 'Комната', 'Место', 'Заезд', 'Выезд', 'Ночей', 'Цена/ночь', 'Итого', 'Оплачено', 'Долг', 'Статус', 'Кассир при заселении', 'Платежи']];
        filtered.forEach(g => {
            const pays = g.guestPayments.map(p => `${p.cashierName}: ${fmt(p.amount)} (${METHOD_LABEL[p.method] || p.method})`).join('; ');
            rows.push([
                g.fullName || '',
                HOSTELS[g.hostelId] || g.hostelId || '',
                g.roomNumber || '',
                g.bedId || '',
                fmtDate(g.checkInDate),
                fmtDate(g.checkOutDate),
                g.days || '',
                g.pricePerNight || '',
                g.totalPrice || '',
                g.totalPaid || '',
                g.debt || 0,
                g.status === 'active' ? 'Активный' : g.status === 'checked_out' ? 'Выехал' : g.status,
                g.checkInCashier,
                pays,
            ]);
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
                        {filtered.length.toLocaleString()} из {enriched.length.toLocaleString()} записей
                    </p>
                </div>
                <button onClick={handleExport}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-colors shadow-sm">
                    <Download size={14}/> Экспорт CSV
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon={Users}       label="Всего постояльцев" value={stats.count.toLocaleString()} />
                <StatCard icon={Minus}       label="Средняя цена/ночь"  value={`${fmt(stats.avg)} сум`} highlight />
                <StatCard
                    icon={TrendingDown}
                    label="Минимальная цена"
                    value={stats.min !== null ? `${fmt(stats.min)} сум` : '—'}
                    sub={stats.minGuest ? `${stats.minGuest.fullName} · ${HOSTELS[stats.minGuest.hostelId] || ''}` : ''}
                />
                <StatCard
                    icon={TrendingUp}
                    label="Максимальная цена"
                    value={stats.max !== null ? `${fmt(stats.max)} сум` : '—'}
                    sub={stats.maxGuest ? `${stats.maxGuest.fullName} · ${HOSTELS[stats.maxGuest.hostelId] || ''}` : ''}
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
                        <option value="active">Активные</option>
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
                    <div className="flex items-center">
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
                <div className="hidden md:grid grid-cols-[2fr_1fr_1.5fr_1fr_1fr_1fr_1fr] px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase gap-2">
                    <span>Гость</span>
                    <span>Место</span>
                    <span><SortBtn k="checkInDate" label="Даты"/></span>
                    <span><SortBtn k="pricePerNight" label="Цена/ночь"/></span>
                    <span><SortBtn k="totalPrice"    label="Итого"/></span>
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
                        <div className="divide-y divide-slate-50">
                            {filtered.slice(0, pageSize).map(g => {
                                const isExpanded = expandedIds.has(g.id);
                                const isActive   = g.status === 'active';
                                const hasDebt    = g.debt > 0;

                                return (
                                    <div key={g.id} className="group">
                                        {/* Main row */}
                                        <div
                                            className={`md:grid md:grid-cols-[2fr_1fr_1.5fr_1fr_1fr_1fr_1fr] flex flex-col px-4 py-3 gap-2 cursor-pointer hover:bg-slate-50/70 transition-colors ${isExpanded ? 'bg-indigo-50/30' : ''}`}
                                            onClick={() => toggleExpand(g.id)}
                                        >
                                            {/* Guest name + hostel */}
                                            <div className="flex items-start gap-2 min-w-0">
                                                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isActive ? 'bg-emerald-400' : 'bg-slate-300'}`}/>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-slate-800 text-sm truncate">{g.fullName || '—'}</div>
                                                    <div className="text-xs text-slate-400 flex items-center gap-1">
                                                        <Building2 size={10}/>
                                                        {HOSTELS[g.hostelId] || g.hostelId || '—'}
                                                        {isExpanded
                                                            ? <ChevronDown size={11} className="text-indigo-500"/>
                                                            : <ChevronRight size={11} className="opacity-40"/>
                                                        }
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Room/Bed */}
                                            <div className="text-sm text-slate-600">
                                                <span className="font-bold">Ком. {g.roomNumber || '—'}</span>
                                                <span className="text-slate-400 text-xs ml-1">· {g.bedId || '—'}</span>
                                            </div>

                                            {/* Dates */}
                                            <div className="text-xs text-slate-500 space-y-0.5">
                                                <div>🟢 {fmtDate(g.checkInDate)}</div>
                                                <div>🔴 {fmtDate(g.checkOutDate)}</div>
                                                <div className="text-slate-400">{g.days || '?'} ночей</div>
                                            </div>

                                            {/* Price/night */}
                                            <div>
                                                <div className="text-sm font-black text-slate-700">{fmt(g.pricePerNight)}</div>
                                                <div className="text-[10px] text-slate-400">сум/ночь</div>
                                            </div>

                                            {/* Total */}
                                            <div>
                                                <div className="text-sm font-black text-slate-700">{fmt(g.totalPrice)}</div>
                                                <div className="text-[10px] text-slate-400">итого</div>
                                            </div>

                                            {/* Paid */}
                                            <div>
                                                <div className="text-sm font-bold text-emerald-600">{fmt(g.totalPaid)}</div>
                                                <div className="text-[10px] text-slate-400">оплачено</div>
                                            </div>

                                            {/* Debt */}
                                            <div>
                                                <div className={`text-sm font-bold ${hasDebt ? 'text-rose-600' : 'text-slate-400'}`}>
                                                    {hasDebt ? fmt(g.debt) : '—'}
                                                </div>
                                                {hasDebt && <div className="text-[10px] text-rose-400">долг</div>}
                                            </div>
                                        </div>

                                        {/* Expanded: payments by cashier */}
                                        {isExpanded && (
                                            <div className="px-8 pt-1 pb-4 bg-indigo-50/20 border-t border-indigo-100/60 space-y-2">
                                                {/* Check-in cashier */}
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <span className="font-bold text-slate-600">Заселил:</span>
                                                    <span>{g.checkInCashier}</span>
                                                </div>

                                                {g.guestPayments.length === 0 ? (
                                                    <div className="text-xs text-slate-400 italic">Платежей нет</div>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        <div className="text-[11px] font-bold text-slate-400 uppercase">Платежи</div>
                                                        {g.guestPayments.map((p, idx) => {
                                                            const shiftLabel = p.shiftStart
                                                                ? `Смена: ${new Date(p.shiftStart).toLocaleDateString('ru', { day:'numeric', month:'short' })} ${new Date(p.shiftStart).toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit' })} – ${p.shiftEnd ? new Date(p.shiftEnd).toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit' }) : 'сейчас'}`
                                                                : null;
                                                            return (
                                                                <div key={p.id || idx}
                                                                    className="flex flex-wrap items-center gap-2 bg-white border border-slate-100 rounded-xl px-3 py-2 shadow-sm text-xs">
                                                                    {/* Method chip */}
                                                                    <MethodChip method={p.method} amount={p.amount}/>
                                                                    {/* Cashier */}
                                                                    <span className="font-bold text-slate-700">{p.cashierName}</span>
                                                                    {/* Shift */}
                                                                    {shiftLabel && (
                                                                        <span className="text-slate-400">{shiftLabel}</span>
                                                                    )}
                                                                    {/* Date */}
                                                                    <span className="text-slate-400 ml-auto">
                                                                        {new Date(p.date).toLocaleDateString('ru', { day:'numeric', month:'short' })}
                                                                        {' '}
                                                                        {new Date(p.date).toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit' })}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {filtered.length > pageSize && (
                            <div className="py-4 text-center border-t border-slate-100">
                                <button onClick={() => setPageSize(p => p + 100)}
                                    className="flex items-center gap-2 mx-auto px-5 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                                    <ChevronDown size={15}/> Показать ещё ({(filtered.length - pageSize).toLocaleString()} записей)
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
