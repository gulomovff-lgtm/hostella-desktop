import React from 'react';
import { Download, Plus, Search, Trash2 } from 'lucide-react';

const CAT_META = [
    { key:'Аренда',              icon:'🏠', bg:'#ede9fe', text:'#6d28d9', bar:'#7c3aed' },
    { key:'Коммунальные услуги', icon:'💡', bg:'#e0f2fe', text:'#0369a1', bar:'#0284c7' },
    { key:'Зарплата',            icon:'💼', bg:'#eef2ff', text:'#4338ca', bar:'#4f46e5' },
    { key:'Продукты',            icon:'🛒', bg:'#dcfce7', text:'#15803d', bar:'#16a34a' },
    { key:'Канцелярия',          icon:'📎', bg:'#f1f5f9', text:'#475569', bar:'#94a3b8' },
    { key:'Ремонт',              icon:'🔧', bg:'#ffedd5', text:'#c2410c', bar:'#ea580c' },
    { key:'Интернет',            icon:'🌐', bg:'#ccfbf1', text:'#0f766e', bar:'#0d9488' },
    { key:'Реклама',             icon:'📣', bg:'#fce7f3', text:'#be185d', bar:'#db2777' },
    { key:'Другое',              icon:'📦', bg:'#f8fafc', text:'#64748b', bar:'#94a3b8' },
];
const CAT_FALLBACK = { icon:'📦', bg:'#f8fafc', text:'#64748b', bar:'#94a3b8' };

const getCat = (c) => {
    if (!c) return CAT_FALLBACK;
    const norm = c.trim().toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ');
    const ns = norm.replace(/\s/g,'');
    return CAT_META.find(m => m.key.toLowerCase().replace(/ё/g,'е') === norm)
        || CAT_META.find(m => m.key.toLowerCase().replace(/ё/g,'е').replace(/\s/g,'') === ns)
        || CAT_META.find(m => { const mk = m.key.toLowerCase().replace(/ё/g,'е'); return norm.includes(mk) || mk.includes(norm); })
        || CAT_META.find(m => { const mk = m.key.toLowerCase().replace(/ё/g,'е').replace(/\s/g,''); return ns.includes(mk) || mk.includes(ns); })
        || CAT_FALLBACK;
};

/**
 * ExpensesView — extracted from App.jsx inline IIFE.
 *
 * Props:
 *   filteredExpenses  - array of expense objects (already filtered by hostel/period)
 *   expenseCatFilter  - current category filter string ('Все' = no filter)
 *   setExpenseCatFilter
 *   expSearch         - search string
 *   setExpSearch
 *   usersList         - all users array
 *   onDownloadCSV     - () => void
 *   onAddExpense      - () => void  (opens expense modal)
 *   onDeleteExpense   - (id) => void
 */
const ExpensesView = ({
    filteredExpenses,
    expenseCatFilter,
    setExpenseCatFilter,
    expSearch,
    setExpSearch,
    usersList,
    onDownloadCSV,
    onAddExpense,
    onDeleteExpense,
}) => {
    const now = new Date();

    const displayed = expenseCatFilter === 'Все'
        ? filteredExpenses
        : filteredExpenses.filter(e => e.category === expenseCatFilter);
    const sorted = [...displayed].sort((a,b) => new Date(b.date)-new Date(a.date));

    const totalAll = filteredExpenses.reduce((s,e)=>s+(Number(e.amount)||0),0);
    const thisMonthExp = filteredExpenses.filter(e => {
        const d=new Date(e.date); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    });
    const thisMonth = thisMonthExp.reduce((s,e)=>s+(Number(e.amount)||0),0);
    const prevMonthExp = filteredExpenses.filter(e => {
        const d=new Date(e.date); const pm=new Date(now.getFullYear(),now.getMonth()-1,1);
        return d.getMonth()===pm.getMonth()&&d.getFullYear()===pm.getFullYear();
    });
    const prevMonth = prevMonthExp.reduce((s,e)=>s+(Number(e.amount)||0),0);
    const monthDiff = prevMonth ? Math.round((thisMonth-prevMonth)/prevMonth*100) : null;

    const cats = Array.from(new Set(filteredExpenses.map(e=>e.category).filter(Boolean)));
    const byCategory = cats.map(c => ({
        name:c, total: filteredExpenses.filter(e=>e.category===c).reduce((s,e)=>s+(Number(e.amount)||0),0)
    })).sort((a,b)=>b.total-a.total);

    const byMonth = {};
    sorted.forEach(e => {
        const d=new Date(e.date);
        const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        if(!byMonth[key]) byMonth[key]={label:d.toLocaleDateString('ru',{month:'long',year:'numeric'}),items:[],total:0};
        byMonth[key].items.push(e);
        byMonth[key].total += Number(e.amount)||0;
    });

    const searchLow = expSearch.toLowerCase();
    const matchFn = e => !searchLow ||
        (e.category||'').toLowerCase().includes(searchLow) ||
        (e.comment||'').toLowerCase().includes(searchLow);

    const fmt = n => Number(n).toLocaleString('ru');

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h2 className="text-xl font-black text-slate-800">Расходы</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{filteredExpenses.length} записей · все категории</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={onDownloadCSV}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
                        <Download size={15}/> CSV
                    </button>
                    <button onClick={onAddExpense}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-sm shadow-rose-200 transition-colors">
                        <Plus size={16}/> Добавить расход
                    </button>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-base">💸</div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Итого</span>
                    </div>
                    <div className="text-2xl font-black text-rose-600">{fmt(totalAll)}</div>
                    <div className="text-xs text-slate-400 mt-1">за всё время</div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-base">📅</div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Этот месяц</span>
                    </div>
                    <div className="text-2xl font-black text-amber-600">{fmt(thisMonth)}</div>
                    {monthDiff !== null && (
                        <div className={`text-xs mt-1 font-semibold ${monthDiff > 0 ? 'text-rose-500' : 'text-teal-500'}`}>
                            {monthDiff > 0 ? '↑' : '↓'} {Math.abs(monthDiff)}% vs прошлый
                        </div>
                    )}
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-base">📆</div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Прошлый месяц</span>
                    </div>
                    <div className="text-2xl font-black text-slate-700">{fmt(prevMonth)}</div>
                    <div className="text-xs text-slate-400 mt-1">{prevMonthExp.length} записей</div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-base">📊</div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Записей</span>
                    </div>
                    <div className="text-2xl font-black text-indigo-600">{filteredExpenses.length}</div>
                    <div className="text-xs text-slate-400 mt-1">{cats.length} категорий</div>
                </div>
            </div>

            {/* Category breakdown */}
            {byCategory.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-black text-slate-600 uppercase tracking-wide">По категориям</span>
                        <span className="text-xs text-slate-400">{fmt(totalAll)} сум</span>
                    </div>
                    <div className="space-y-2.5">
                        {byCategory.map(c => {
                            const m = getCat(c.name);
                            const pct = totalAll ? Math.round(c.total/totalAll*100) : 0;
                            const active = expenseCatFilter === c.name;
                            return (
                                <button key={c.name} onClick={() => setExpenseCatFilter(active ? 'Все' : c.name)}
                                    className="w-full text-left group"
                                    style={{outline:'none'}}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm">{m.icon}</span>
                                        <span className="text-sm font-semibold flex-1" style={{color: active ? m.text : '#475569'}}>{c.name}</span>
                                        <span className="text-xs font-bold" style={{color: m.text}}>
                                            {fmt(c.total)} <span className="font-normal text-slate-400">({pct}%)</span>
                                        </span>
                                    </div>
                                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                        <div className="h-full rounded-full transition-all"
                                             style={{width:`${pct}%`, background: active ? m.bar : m.bar+'99'}}/>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    {expenseCatFilter !== 'Все' && (
                        <button onClick={() => setExpenseCatFilter('Все')}
                            className="mt-3 text-xs font-bold text-slate-400 hover:text-slate-600 underline">
                            Показать все категории
                        </button>
                    )}
                </div>
            )}

            {/* Search + filter info */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-48">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input value={expSearch} onChange={e=>setExpSearch(e.target.value)}
                        placeholder="Поиск по категории или комментарию…"
                        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200 transition-all"/>
                </div>
                {expenseCatFilter !== 'Все' && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold shrink-0"
                         style={{background: getCat(expenseCatFilter).bg, color: getCat(expenseCatFilter).text}}>
                        {getCat(expenseCatFilter).icon} {expenseCatFilter}
                        <button onClick={() => setExpenseCatFilter('Все')} className="ml-1 opacity-60 hover:opacity-100">✕</button>
                    </div>
                )}
                <span className="text-sm text-slate-400 shrink-0">{displayed.filter(matchFn).length} записей</span>
            </div>

            {/* Grouped list */}
            {Object.keys(byMonth).length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center text-slate-400 text-sm">
                    Нет расходов
                </div>
            ) : (
                <div className="space-y-4">
                    {Object.entries(byMonth).map(([mk, mg]) => {
                        const monthItems = mg.items.filter(matchFn);
                        if (monthItems.length === 0) return null;
                        return (
                            <div key={mk} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
                                    <span className="text-sm font-black text-slate-700 capitalize">{mg.label}</span>
                                    <span className="text-sm font-black text-rose-600">₊{fmt(mg.items.filter(matchFn).reduce((s,e)=>s+(Number(e.amount)||0),0))}</span>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {monthItems.map(e => {
                                        const m = getCat(e.category);
                                        const staff = usersList.find(u=>u.id===e.staffId||u.login===e.staffId);
                                        const d = new Date(e.date);
                                        const dateStr = `${d.getDate()} ${d.toLocaleDateString('ru',{month:'short'})}`;
                                        return (
                                            <div key={e.id} className="group flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 font-bold"
                                                     style={{background: m.bg}}>
                                                    {m.icon}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold" style={{color: m.text}}>{e.category}</span>
                                                        {staff && <span className="text-xs text-slate-400">{staff.name.split(' ')[0]}</span>}
                                                    </div>
                                                    {e.comment && <div className="text-xs text-slate-500 truncate mt-0.5">{e.comment}</div>}
                                                </div>
                                                <span className="text-xs text-slate-400 shrink-0 hidden sm:block">{dateStr}</span>
                                                <span className="text-base font-black text-rose-600 shrink-0 tabular-nums">
                                                    ₊{fmt(e.amount)}
                                                </span>
                                                <button onClick={() => onDeleteExpense(e.id)}
                                                    className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all shrink-0"
                                                    title="Удалить">
                                                    <Trash2 size={15}/>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ExpensesView;
