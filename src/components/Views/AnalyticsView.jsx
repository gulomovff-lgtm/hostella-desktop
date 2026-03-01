import React, { useState, useMemo } from 'react';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LabelList,
} from 'recharts';
import {
    TrendingUp, TrendingDown, DollarSign, Calendar, BarChart3,
    Users, BedDouble, CreditCard, Banknote, QrCode, PieChart as PieIcon,
    ArrowUpRight, ArrowDownRight,
} from 'lucide-react';

// ─── Константы ────────────────────────────────────────────────────────────────
const COUNTRY_FLAGS = {
    "Узбекистан":"uz","Россия":"ru","Казахстан":"kz","Таджикистан":"tj","Кыргызстан":"kg",
    "Беларусь":"by","Украина":"ua","Германия":"de","США":"us","Китай":"cn","Турция":"tr",
    "Индия":"in","Франция":"fr","Великобритания":"gb","Италия":"it","Испания":"es",
    "Южная Корея":"kr","Япония":"jp","Австралия":"au","Канада":"ca","ОАЭ":"ae",
    "Иран":"ir","Афганистан":"af","Пакистан":"pk","Израиль":"il","Польша":"pl",
    "Румыния":"ro","Нидерланды":"nl","Австрия":"at","Швейцария":"ch","Швеция":"se",
    "Норвегия":"no","Дания":"dk","Финляндия":"fi","Чехия":"cz","Венгрия":"hu",
    "Армения":"am","Азербайджан":"az","Грузия":"ge","Монголия":"mn","Вьетнам":"vn",
    "Таиланд":"th","Малайзия":"my","Индонезия":"id","Сингапур":"sg","Бразилия":"br",
    "Мексика":"mx","Аргентина":"ar","Египет":"eg","Марокко":"ma","Нигерия":"ng",
};

const fmt = (n) => (parseInt(n) || 0).toLocaleString('ru') + ' сум';
const fmtShort = (n) => {
    const v = parseInt(n) || 0;
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'М';
    if (v >= 1_000) return (v / 1_000).toFixed(0) + 'К';
    return v.toLocaleString('ru');
};

const COLORS = {
    income:  '#10b981',
    expense: '#ef4444',
    profit:  '#3b82f6',
    cash:    '#10b981',
    card:    '#3b82f6',
    qr:      '#8b5cf6',
};

const toDateStr = (d) => {
    const dt = new Date(d);
    return `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}`;
};
const toMonthStr = (d) => {
    const dt = new Date(d);
    return `${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}`;
};
const isoDate = (d) => d.toISOString().slice(0, 10);

// ─── Кастомный tooltip ────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
            <div className="font-black text-slate-600 mb-2">{label}</div>
            {payload.map((p, i) => (
                <div key={i} className="flex items-center gap-2 py-0.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span className="text-slate-500">{p.name}:</span>
                    <span className="font-bold text-slate-800">{fmtShort(p.value)}</span>
                </div>
            ))}
        </div>
    );
};

// ─── KPI-карточка ─────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, sub, color, trend }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: color + '18' }}>
            <Icon size={22} style={{ color }} />
        </div>
        <div className="min-w-0">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
            <div className="text-2xl font-black text-slate-800 leading-tight truncate">{fmtShort(value)}</div>
            {sub != null && (
                <div className={`flex items-center gap-1 mt-1 text-xs font-semibold ${trend >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {trend >= 0 ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>}
                    {sub}
                </div>
            )}
        </div>
    </div>
);

// ─── Пустое состояние ─────────────────────────────────────────────────────────
const Empty = () => (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-300">
        <BarChart3 size={40} />
        <span className="text-sm font-semibold">Нет данных за период</span>
    </div>
);

// ─── Заглушка секции ─────────────────────────────────────────────────────────
const ChartCard = ({ title, icon: Icon, children }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center gap-2 mb-4">
            <Icon size={16} className="text-slate-400" />
            <span className="text-sm font-black text-slate-700 uppercase tracking-wide">{title}</span>
        </div>
        {children}
    </div>
);

// ─── Главный компонент ────────────────────────────────────────────────────────
const AnalyticsView = ({ payments = [], expenses = [], guests = [], rooms = [], users = [], currentUser }) => {
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';

    // ─── Фильтры ─────────────────────────────────────────────────────────────
    const [period, setPeriod] = useState('30');
    const [hostelFilter, setHostelFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const PERIODS = [
        { id: '1',    label: 'Сегодня' },
        { id: '7',    label: '7 дней' },
        { id: '30',   label: '30 дней' },
        { id: '90',   label: '3 мес.' },
        { id: '365',  label: 'Год' },
        { id: 'custom', label: 'Период' },
    ];

    const { startDate, endDate } = useMemo(() => {
        if (period === 'custom' && dateFrom && dateTo) {
            return { startDate: new Date(dateFrom + 'T00:00:00'), endDate: new Date(dateTo + 'T23:59:59') };
        }
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        if (period !== 'custom') start.setDate(start.getDate() - (parseInt(period) - 1));
        return { startDate: start, endDate: end };
    }, [period, dateFrom, dateTo]);

    // ─── Фильтрованные данные ─────────────────────────────────────────────────
    const filteredPayments = useMemo(() => {
        return payments.filter(p => {
            const t = new Date(p.date);
            if (t < startDate || t > endDate) return false;
            if (hostelFilter !== 'all') {
                const staff = users.find(u => u.id === p.staffId || u.login === p.staffId);
                const h = p.hostelId || staff?.hostelId;
                if (h && h !== hostelFilter) return false;
            }
            return true;
        });
    }, [payments, users, startDate, endDate, hostelFilter]);

    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => {
            const t = new Date(e.date);
            if (t < startDate || t > endDate) return false;
            if (hostelFilter !== 'all' && e.hostelId && e.hostelId !== hostelFilter) return false;
            return true;
        });
    }, [expenses, startDate, endDate, hostelFilter]);

    const filteredGuests = useMemo(() => {
        if (hostelFilter === 'all') return guests;
        return guests.filter(g => g.hostelId === hostelFilter);
    }, [guests, hostelFilter]);

    const filteredRooms = useMemo(() => {
        if (hostelFilter === 'all') return rooms;
        return rooms.filter(r => r.hostelId === hostelFilter);
    }, [rooms, hostelFilter]);

    // ─── KPI ──────────────────────────────────────────────────────────────────
    const totalIncome  = useMemo(() => filteredPayments.reduce((s, p) => s + (parseInt(p.amount) || 0), 0), [filteredPayments]);
    const totalExpense = useMemo(() => filteredExpenses.reduce((s, e) => s + (parseInt(e.amount) || 0), 0), [filteredExpenses]);
    const totalProfit  = totalIncome - totalExpense;
    const days         = Math.max(1, Math.round((endDate - startDate) / 86400000));
    const avgPerDay    = Math.round(totalIncome / days);

    // ─── 1. Финансовая динамика ───────────────────────────────────────────────
    const financeChartData = useMemo(() => {
        const byDay = {};
        const groupKey = (iso) => {
            const d = new Date(iso);
            return days <= 31 ? isoDate(d) : toMonthStr(d);
        };
        // Доход
        filteredPayments.forEach(p => {
            const k = groupKey(p.date);
            if (!byDay[k]) byDay[k] = { label: days <= 31 ? toDateStr(p.date) : k, income: 0, expense: 0 };
            byDay[k].income += parseInt(p.amount) || 0;
        });
        // Расход
        filteredExpenses.forEach(e => {
            const k = groupKey(e.date);
            if (!byDay[k]) byDay[k] = { label: days <= 31 ? toDateStr(e.date) : k, income: 0, expense: 0 };
            byDay[k].expense += parseInt(e.amount) || 0;
        });
        return Object.entries(byDay)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([, v]) => ({ ...v, profit: v.income - v.expense }));
    }, [filteredPayments, filteredExpenses, days]);

    // ─── 2. Источники дохода ─────────────────────────────────────────────────
    const paymentMethodData = useMemo(() => {
        const cash = filteredPayments.filter(p => p.method === 'cash').reduce((s, p) => s + (parseInt(p.amount)||0), 0);
        const card = filteredPayments.filter(p => p.method === 'card').reduce((s, p) => s + (parseInt(p.amount)||0), 0);
        const qr   = filteredPayments.filter(p => p.method === 'qr').reduce((s, p) => s + (parseInt(p.amount)||0), 0);
        return [
            { name: 'Наличные', value: cash, color: COLORS.cash },
            { name: 'Карта',    value: card, color: COLORS.card },
            { name: 'QR',       value: qr,   color: COLORS.qr   },
        ].filter(x => x.value > 0);
    }, [filteredPayments]);

    const PieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
        if (percent < 0.05) return null;
        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        return (
            <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
                fontSize={11} fontWeight={700}>
                {(percent * 100).toFixed(0)}%
            </text>
        );
    };

    // ─── 3. Загрузка хостела по дням ─────────────────────────────────────────
    const occupancyData = useMemo(() => {
        const totalBeds = filteredRooms.reduce((s, r) => s + (parseInt(r.capacity)||0), 0);
        if (!totalBeds) return [];
        const result = [];
        const cursor = new Date(startDate);
        cursor.setHours(12, 0, 0, 0);
        const endCursor = new Date(endDate);
        while (cursor <= endCursor) {
            const dayTs = cursor.getTime();
            const active = filteredGuests.filter(g => {
                if (!g.checkInDate || !g.checkOutDate) return false;
                const ci = new Date(g.checkInDate).getTime();
                const co = new Date(g.checkOutDate).getTime();
                return ci <= dayTs && dayTs < co;
            }).length;
            result.push({
                label: toDateStr(cursor),
                occupancy: Math.min(100, Math.round((active / totalBeds) * 100)),
            });
            cursor.setDate(cursor.getDate() + 1);
            if (result.length > 90) break; // ограничим 90 точками
        }
        return result;
    }, [filteredGuests, filteredRooms, startDate, endDate]);

    // ─── 4. Демография по странам ────────────────────────────────────────────
    const countryData = useMemo(() => {
        const map = {};
        filteredGuests.forEach(g => {
            if (!g.country) return;
            map[g.country] = (map[g.country] || 0) + 1;
        });
        return Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([country, count]) => ({ country, count, flag: COUNTRY_FLAGS[country] }));
    }, [filteredGuests]);

    // ─── 5. Доходность комнат ────────────────────────────────────────────────
    const roomRevenueData = useMemo(() => {
        const map = {};
        filteredPayments.forEach(p => {
            const g = guests.find(x => x.id === p.guestId);
            if (!g) return;
            const key = g.roomNumber || g.roomId || '—';
            map[key] = (map[key] || 0) + (parseInt(p.amount) || 0);
        });
        const sorted = Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([room, revenue], i) => ({ room: `Ком. ${room}`, revenue, top: i < 3 }));
        return sorted;
    }, [filteredPayments, guests]);

    // ─── 6. Кассиры — оборот ─────────────────────────────────────────────────
    const cashierData = useMemo(() => {
        const map = {};
        filteredPayments.forEach(p => {
            const staffUser = users.find(u => u.id === p.staffId || u.login === p.staffId);
            const name = staffUser?.name || staffUser?.login || p.staffId || 'Неизвестно';
            if (!map[name]) map[name] = { name, cash: 0, card: 0, qr: 0 };
            if (p.method === 'cash') map[name].cash += parseInt(p.amount) || 0;
            else if (p.method === 'card') map[name].card += parseInt(p.amount) || 0;
            else if (p.method === 'qr') map[name].qr += parseInt(p.amount) || 0;
        });
        return Object.values(map)
            .map(d => ({ ...d, total: d.cash + d.card + d.qr }))
            .sort((a, b) => b.total - a.total);
    }, [filteredPayments, users]);

    // ─── Категории расходов ───────────────────────────────────────────────────
    const expenseCategoryData = useMemo(() => {
        const map = {};
        filteredExpenses.forEach(e => {
            const cat = e.category || 'Прочее';
            map[cat] = (map[cat] || 0) + (parseInt(e.amount) || 0);
        });
        return Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .map(([name, value]) => ({ name, value }));
    }, [filteredExpenses]);

    const CAT_COLORS = ['#ef4444','#f97316','#eab308','#06b6d4','#8b5cf6','#ec4899','#14b8a6','#64748b'];

    // ─── Средний чек ─────────────────────────────────────────────────────────
    const avgCheck = useMemo(() => {
        const checkedOutInPeriod = filteredGuests.filter(g => {
            if (g.status !== 'checked_out' || !g.checkOutDate) return false;
            const co = new Date(g.checkOutDate);
            return co >= startDate && co <= endDate;
        });
        if (!checkedOutInPeriod.length) return 0;
        const total = checkedOutInPeriod.reduce((s, g) => s + (parseInt(g.totalPrice)||0), 0);
        return Math.round(total / checkedOutInPeriod.length);
    }, [filteredGuests, startDate, endDate]);

    return (
        <div className="flex-1 overflow-y-auto bg-[#f0f2f5]">
            <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">

                {/* ── Заголовок ── */}
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
                        <BarChart3 size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800">Аналитика</h1>
                        <p className="text-xs text-slate-400">Финансы, загрузка, гости — всё в одном месте</p>
                    </div>
                </div>

                {/* ── Фильтры ── */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-wrap gap-3 items-center">
                    {/* Период */}
                    <div className="flex gap-1 flex-wrap">
                        {PERIODS.map(p => (
                            <button key={p.id} onClick={() => setPeriod(p.id)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                                style={period === p.id
                                    ? { background: '#1e293b', color: '#fff' }
                                    : { background: '#f1f5f9', color: '#64748b' }}>
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Кастомный диапазон */}
                    {period === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-400"/>
                            <span className="text-slate-400 text-xs">—</span>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-400"/>
                        </div>
                    )}

                    {/* Хостел (только для admin/super) */}
                    {isAdmin && (
                        <div className="flex gap-1 ml-auto">
                            {[['all','Все'],['hostel1','Хостел №1'],['hostel2','Хостел №2']].map(([id, label]) => (
                                <button key={id} onClick={() => setHostelFilter(id)}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                                    style={hostelFilter === id
                                        ? { background: '#e88c40', color: '#fff' }
                                        : { background: '#f1f5f9', color: '#64748b' }}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── KPI-карточки ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiCard icon={TrendingUp}   label="Доходы"          value={totalIncome}  color="#10b981" />
                    <KpiCard icon={TrendingDown}  label="Расходы"         value={totalExpense} color="#ef4444" />
                    <KpiCard icon={DollarSign}    label="Прибыль"         value={totalProfit}  color={totalProfit >= 0 ? '#3b82f6' : '#ef4444'} />
                    <KpiCard icon={Calendar}      label="Доход / день"    value={avgPerDay}    color="#8b5cf6" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiCard icon={Users}         label="Гостей за период" value={filteredGuests.filter(g => { const ci=new Date(g.checkInDate); return ci>=startDate && ci<=endDate; }).length + ' чел.'} color="#06b6d4" />
                    <KpiCard icon={BedDouble}     label="Средний чек"      value={avgCheck}    color="#f59e0b" />
                    <KpiCard icon={Banknote}      label="Наличные"         value={filteredPayments.filter(p=>p.method==='cash').reduce((s,p)=>s+(parseInt(p.amount)||0),0)} color="#10b981" />
                    <KpiCard icon={CreditCard}    label="Безнал + QR"      value={filteredPayments.filter(p=>p.method!=='cash').reduce((s,p)=>s+(parseInt(p.amount)||0),0)} color="#3b82f6" />
                </div>

                {/* ── Диаграммы 2x2 ── */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

                    {/* 1. Финансовая динамика */}
                    <ChartCard title="Финансовая динамика" icon={TrendingUp}>
                        {financeChartData.length === 0 ? <Empty /> : (
                            <ResponsiveContainer width="100%" height={280}>
                                <LineChart data={financeChartData} margin={{ left: 10, right: 10, top: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: '#94a3b8' }} width={52} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: 12 }} />
                                    <Line type="monotone" dataKey="income"  name="Доход"   stroke={COLORS.income}  strokeWidth={2.5} dot={false} />
                                    <Line type="monotone" dataKey="expense" name="Расходы" stroke={COLORS.expense} strokeWidth={2} dot={false} strokeDasharray="4 2" />
                                    <Line type="monotone" dataKey="profit"  name="Прибыль" stroke={COLORS.profit}  strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>

                    {/* 2. Источники дохода */}
                    <ChartCard title="Источники дохода" icon={PieIcon}>
                        {paymentMethodData.length === 0 ? <Empty /> : (
                            <div className="flex items-center gap-4">
                                <ResponsiveContainer width="60%" height={280}>
                                    <PieChart>
                                        <Pie data={paymentMethodData} cx="50%" cy="50%"
                                            innerRadius={60} outerRadius={110}
                                            dataKey="value" labelLine={false}
                                            label={<PieLabel />}>
                                            {paymentMethodData.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(val) => [fmt(val)]} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex-1 space-y-3">
                                    {paymentMethodData.map((item) => {
                                        const pct = totalIncome > 0 ? Math.round(item.value / totalIncome * 100) : 0;
                                        return (
                                            <div key={item.name}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                                                        <span className="text-xs font-semibold text-slate-600">{item.name}</span>
                                                    </div>
                                                    <span className="text-xs font-black text-slate-700">{pct}%</span>
                                                </div>
                                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: item.color }} />
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">{fmtShort(item.value)}</div>
                                            </div>
                                        );
                                    })}
                                    <div className="pt-2 border-t border-slate-100">
                                        <div className="text-xs text-slate-400">Итого</div>
                                        <div className="text-lg font-black text-slate-800">{fmtShort(totalIncome)}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </ChartCard>

                    {/* 3. Загрузка хостела */}
                    <ChartCard title="Загрузка хостела (%)" icon={BedDouble}>
                        {occupancyData.length === 0 ? <Empty /> : (
                            <ResponsiveContainer width="100%" height={280}>
                                <AreaChart data={occupancyData} margin={{ left: 10, right: 10, top: 5 }}>
                                    <defs>
                                        <linearGradient id="occupancyGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        interval={Math.max(0, Math.floor(occupancyData.length / 10) - 1)} />
                                    <YAxis domain={[0, 100]} tickFormatter={v => v + '%'} tick={{ fontSize: 10, fill: '#94a3b8' }} width={40} />
                                    <Tooltip formatter={(v) => [v + '%', 'Загрузка']} />
                                    <Area type="monotone" dataKey="occupancy" name="Загрузка"
                                        stroke="#3b82f6" strokeWidth={2.5}
                                        fill="url(#occupancyGrad)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>

                    {/* 4. Демография */}
                    <ChartCard title="Демография гостей" icon={Users}>
                        {countryData.length === 0 ? <Empty /> : (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={countryData} layout="vertical" margin={{ left: 10, right: 40, top: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <YAxis type="category" dataKey="country" width={100}
                                        tick={({ x, y, payload }) => {
                                            const code = COUNTRY_FLAGS[payload.value];
                                            return (
                                                <g transform={`translate(${x},${y})`}>
                                                    {code && (
                                                        <image
                                                            href={`https://flagcdn.com/w20/${code}.png`}
                                                            x={-105} y={-8} width={16} height={12}
                                                        />
                                                    )}
                                                    <text x={-85} y={4} textAnchor="start"
                                                        fontSize={10} fill="#64748b" fontWeight={600}>
                                                        {payload.value.length > 11 ? payload.value.slice(0,11)+'…' : payload.value}
                                                    </text>
                                                </g>
                                            );
                                        }}
                                    />
                                    <Tooltip formatter={(v) => [v + ' чел.', 'Гостей']} />
                                    <Bar dataKey="count" name="Гостей" radius={[0, 4, 4, 0]}>
                                        {countryData.map((_, i) => (
                                            <Cell key={i} fill={i === 0 ? '#6366f1' : i === 1 ? '#818cf8' : '#a5b4fc'} />
                                        ))}
                                        <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>

                    {/* 5. Доходность комнат */}
                    <ChartCard title="Доходность комнат" icon={BedDouble}>
                        {roomRevenueData.length === 0 ? <Empty /> : (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={roomRevenueData} margin={{ left: 10, right: 10, top: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="room" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: '#94a3b8' }} width={52} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="revenue" name="Доход" radius={[6, 6, 0, 0]}>
                                        {roomRevenueData.map((item, i) => (
                                            <Cell key={i} fill={item.top ? '#f59e0b' : '#94a3b8'} />
                                        ))}
                                        <LabelList dataKey="revenue" position="top" formatter={fmtShort}
                                            style={{ fontSize: 9, fill: '#475569', fontWeight: 700 }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>

                    {/* 6. Кассиры */}
                    {isAdmin && (
                        <ChartCard title="Оборот по кассирам" icon={Users}>
                            {cashierData.length === 0 ? <Empty /> : (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={cashierData} layout="vertical" margin={{ left: 10, right: 50, top: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                        <XAxis type="number" tickFormatter={fmtShort} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                        <YAxis type="category" dataKey="name" width={90}
                                            tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: 11 }} />
                                        <Bar dataKey="cash" name="Наличные" stackId="a" fill={COLORS.cash} radius={[0, 0, 0, 0]}>
                                            <LabelList dataKey="total" position="right" formatter={fmtShort}
                                                style={{ fontSize: 9, fill: '#475569', fontWeight: 700 }} />
                                        </Bar>
                                        <Bar dataKey="card" name="Карта"    stackId="a" fill={COLORS.card} />
                                        <Bar dataKey="qr"   name="QR"       stackId="a" fill={COLORS.qr} radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </ChartCard>
                    )}

                    {/* 7. Категории расходов */}
                    <ChartCard title="Категории расходов" icon={TrendingDown}>
                        {expenseCategoryData.length === 0 ? <Empty /> : (
                            <div className="flex items-center gap-4">
                                <ResponsiveContainer width="55%" height={280}>
                                    <PieChart>
                                        <Pie data={expenseCategoryData} cx="50%" cy="50%"
                                            innerRadius={55} outerRadius={105}
                                            dataKey="value" labelLine={false}>
                                            {expenseCategoryData.map((_, i) => (
                                                <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(val) => [fmt(val)]} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex-1 space-y-2 overflow-y-auto max-h-64">
                                    {expenseCategoryData.map((item, i) => (
                                        <div key={item.name} className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                    style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                                                <span className="text-xs font-semibold text-slate-600 truncate max-w-[90px]">{item.name}</span>
                                            </div>
                                            <span className="text-xs font-black text-slate-700 ml-2">{fmtShort(item.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </ChartCard>

                </div>
            </div>
        </div>
    );
};

export default AnalyticsView;
