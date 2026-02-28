import React, { useState } from 'react';
import { Download, Plus, Search, Trash2, ToggleLeft, ToggleRight, Play, ChevronDown, ChevronUp, Pencil, X, Check } from 'lucide-react';

const CAT_META = [
    { key:'Аренда',              icon:'🏠', bg:'#ede9fe', text:'#6d28d9', bar:'#7c3aed' },
    { key:'Коммунальные услуги', icon:'💡', bg:'#e0f2fe', text:'#0369a1', bar:'#0284c7' },
    { key:'Зарплата',            icon:'💼', bg:'#eef2ff', text:'#4338ca', bar:'#4f46e5' },
    { key:'Аванс',               icon:'💰', bg:'#fef9c3', text:'#a16207', bar:'#ca8a04' },
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
 *   onDeleteExpense   - (id, record) => void
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
    recurringExpenses = [],
    onAddRecurring,
    onUpdateRecurring,
    onDeleteRecurring,
    onToggleActive,
    onFireNow,
    onAddAdvance,
    currentUser,
}) => {
    const now = new Date();
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';
    const [recurringOpen, setRecurringOpen] = useState(false);
    const [addForm, setAddForm] = useState(false);
    const [form, setForm] = useState({ name: '', category: 'Аренда', amount: '', comment: '', dayOfMonth: 1, hostelId: 'all' });
    const [editId, setEditId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [advanceTargetId, setAdvanceTargetId] = useState(null);
    const [advanceAmt, setAdvanceAmt] = useState('');

    const CATS = ['Аренда','Коммунальные услуги','Зарплата','Продукты','Канцелярия','Ремонт','Интернет','Реклама','Другое'];

    const handleAddForm = async (e) => {
        e.preventDefault();
        if (!form.name || !form.amount) return;
        await onAddRecurring?.(form);
        setForm({ name: '', category: 'Аренда', amount: '', comment: '', dayOfMonth: 1, hostelId: 'all' });
        setAddForm(false);
    };

    const startEdit = (tmpl) => {
        setEditId(tmpl.id);
        setEditForm({ name: tmpl.name, category: tmpl.category || 'Аренда', amount: tmpl.amount, comment: tmpl.comment || '', dayOfMonth: tmpl.dayOfMonth || 1, hostelId: tmpl.hostelId || 'all' });
        setAddForm(false);
    };

    const handleEditForm = async (e) => {
        e.preventDefault();
        if (!editForm.name || !editForm.amount) return;
        await onUpdateRecurring?.(editId, { ...editForm, amount: Number(editForm.amount), dayOfMonth: Number(editForm.dayOfMonth) });
        setEditId(null);
        setEditForm({});
    };

    const today = now.getDate();

    const amtFn = e => e.category === 'Аванс' ? -(Number(e.amount)||0) : (Number(e.amount)||0);

    const displayed = expenseCatFilter === 'Все'
        ? filteredExpenses.filter(e => e.category !== 'Возврат')
        : filteredExpenses.filter(e => e.category === expenseCatFilter && e.category !== 'Возврат');
    const refunds = filteredExpenses.filter(e => e.category === 'Возврат');
    const sorted = [...displayed].sort((a,b) => new Date(b.date)-new Date(a.date));
    const sortedRefunds = [...refunds].sort((a,b) => new Date(b.date)-new Date(a.date));

    const totalAll = filteredExpenses.filter(e=>e.category!=='Возврат').reduce((s,e)=>s+amtFn(e),0);
    const totalRefunds = refunds.reduce((s,e)=>s+(Number(e.amount)||0),0);
    const thisMonthExp = filteredExpenses.filter(e => {
        const d=new Date(e.date); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear() && e.category!=='Возврат';
    });
    const thisMonth = thisMonthExp.reduce((s,e)=>s+amtFn(e),0);
    const prevMonthExp = filteredExpenses.filter(e => {
        const d=new Date(e.date); const pm=new Date(now.getFullYear(),now.getMonth()-1,1);
        return d.getMonth()===pm.getMonth()&&d.getFullYear()===pm.getFullYear() && e.category!=='Возврат';
    });
    const prevMonth = prevMonthExp.reduce((s,e)=>s+amtFn(e),0);
    const monthDiff = prevMonth ? Math.round((thisMonth-prevMonth)/prevMonth*100) : null;

    const cats = Array.from(new Set(filteredExpenses.filter(e=>e.category!=='Возврат').map(e=>e.category).filter(Boolean)));
    const byCategory = cats.map(c => ({
        name:c, total: filteredExpenses.filter(e=>e.category===c).reduce((s,e)=>s+(Number(e.amount)||0),0)
    })).sort((a,b)=>b.total-a.total);

    const byMonth = {};
    sorted.forEach(e => {
        const d=new Date(e.date);
        const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        if(!byMonth[key]) byMonth[key]={label:d.toLocaleDateString('ru',{month:'long',year:'numeric'}),items:[],total:0};
        byMonth[key].items.push(e);
        byMonth[key].total += amtFn(e);
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
                    <p className="text-xs text-slate-400 mt-0.5">{filteredExpenses.filter(e=>e.category!=='Возврат').length} записей · {refunds.length > 0 ? `${refunds.length} возвратов` : 'все категории'}</p>
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
            {/* ── Recurring Expenses Section ── */}
            {isAdmin && (
                <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">
                    <button
                        onClick={() => setRecurringOpen(o => !o)}
                        className="w-full flex items-center justify-between px-5 py-3.5 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                    >
                        <div className="flex items-center gap-2.5">
                            <span className="text-base">🔄</span>
                            <span className="text-sm font-black text-indigo-700">Регулярные расходы</span>
                            {recurringExpenses.length > 0 && (
                                <span className="text-xs bg-indigo-200 text-indigo-700 rounded-full px-2 py-0.5 font-bold">{recurringExpenses.length}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {recurringExpenses.some(t => t.active && today >= (t.dayOfMonth || 1) && t.lastFiredMonth !== `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`) && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">обработка…</span>
                            )}
                            {recurringOpen ? <ChevronUp size={16} className="text-indigo-400" /> : <ChevronDown size={16} className="text-indigo-400" />}
                        </div>
                    </button>

                    {recurringOpen && (
                        <div className="divide-y divide-slate-50">
                            {recurringExpenses.length === 0 && !addForm && (
                                <div className="py-8 text-center text-slate-400 text-sm">Нет шаблонов. Добавьте первый.</div>
                            )}

                            {recurringExpenses.map(tmpl => {
                                const m = getCat(tmpl.category);
                                const curMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
                                const firedThisMonth = tmpl.lastFiredMonth === curMonthKey;
                                const isEditing = editId === tmpl.id;
                                return (
                                    <div key={tmpl.id}>
                                        <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: m.bg }}>
                                                {m.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-bold text-slate-700">{tmpl.name}</span>
                                                    <span className="text-xs font-semibold" style={{ color: m.text }}>{tmpl.category}</span>
                                                    {firedThisMonth && (
                                                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">✓ начислено</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-slate-400">📅 {tmpl.dayOfMonth}-го числа</span>
                                                    {tmpl.hostelId !== 'all' && (
                                                        <span className="text-xs text-slate-400">· {tmpl.hostelId === 'hostel1' ? 'Хостел №1' : tmpl.hostelId === 'hostel2' ? 'Хостел №2' : tmpl.hostelId}</span>
                                                    )}
                                                    {tmpl.comment && <span className="text-xs text-slate-400 truncate">· {tmpl.comment}</span>}
                                                </div>
                                            </div>
                                            <span className="text-sm font-black text-rose-600 shrink-0">{fmt(tmpl.amount)}</span>
                                            <button
                                                onClick={() => onToggleActive?.(tmpl.id, tmpl.active)}
                                                title={tmpl.active ? 'Выключить' : 'Включить'}
                                                className="shrink-0 transition-colors"
                                            >
                                                {tmpl.active
                                                    ? <ToggleRight size={28} className="text-indigo-500" />
                                                    : <ToggleLeft size={28} className="text-slate-400" />}
                                            </button>
                                            <button
                                                onClick={() => isEditing ? setEditId(null) : startEdit(tmpl)}
                                                title={isEditing ? 'Отмена' : 'Редактировать'}
                                                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0 ${isEditing ? 'bg-indigo-100' : 'bg-slate-100 hover:bg-indigo-100'}`}
                                            >
                                                {isEditing ? <X size={16} color="#4f46e5" /> : <Pencil size={16} color="#334155" />}
                                            </button>
                                            <button
                                                onClick={() => onFireNow?.(tmpl)}
                                                title="Внести сейчас"
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-100 hover:bg-emerald-200 transition-colors shrink-0"
                                            >
                                                <Play size={16} color="#047857" />
                                            </button>
                                            <button
                                                onClick={() => onDeleteRecurring?.(tmpl.id)}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-rose-100 transition-colors shrink-0"
                                            >
                                                <Trash2 size={16} color="#334155" />
                                            </button>
                                        </div>
                                        {isEditing && (
                                            <form onSubmit={handleEditForm} className="px-5 py-4 bg-indigo-50 border-t border-indigo-100 space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="col-span-2">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Название *</label>
                                                        <input value={editForm.name} onChange={e => setEditForm(f=>({...f,name:e.target.value}))}
                                                            required
                                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Категория</label>
                                                        <select value={editForm.category} onChange={e => setEditForm(f=>({...f,category:e.target.value}))}
                                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200">
                                                            {CATS.map(c => <option key={c}>{c}</option>)}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Сумма *</label>
                                                        <input type="number" min="1" value={editForm.amount} onChange={e => setEditForm(f=>({...f,amount:e.target.value}))}
                                                            required
                                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Число месяца (1-28)</label>
                                                        <input type="number" min="1" max="28" value={editForm.dayOfMonth} onChange={e => setEditForm(f=>({...f,dayOfMonth:parseInt(e.target.value)||1}))}
                                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Хостел</label>
                                                        <select value={editForm.hostelId} onChange={e => setEditForm(f=>({...f,hostelId:e.target.value}))}
                                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200">
                                                            <option value="all">Все хостелы</option>
                                                            <option value="hostel1">Хостел №1</option>
                                                            <option value="hostel2">Хостел №2</option>
                                                        </select>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Комментарий</label>
                                                        <input value={editForm.comment} onChange={e => setEditForm(f=>({...f,comment:e.target.value}))}
                                                            placeholder="Необязательно…"
                                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button type="submit"
                                                        className="flex-1 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold transition-colors">
                                                        Сохранить
                                                    </button>
                                                    <button type="button" onClick={() => setEditId(null)}
                                                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-100 transition-colors">
                                                        Отмена
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Add form */}
                            {addForm ? (
                                <form onSubmit={handleAddForm} className="px-5 py-4 bg-slate-50 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Название *</label>
                                            <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))}
                                                placeholder="Аренда офиса…" required
                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Категория</label>
                                            <select value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}
                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200">
                                                {CATS.map(c => <option key={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Сумма *</label>
                                            <input type="number" min="1" value={form.amount} onChange={e => setForm(f=>({...f,amount:e.target.value}))}
                                                placeholder="0" required
                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Число месяца (1-28)</label>
                                            <input type="number" min="1" max="28" value={form.dayOfMonth} onChange={e => setForm(f=>({...f,dayOfMonth:parseInt(e.target.value)||1}))}
                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Хостел</label>
                                            <select value={form.hostelId} onChange={e => setForm(f=>({...f,hostelId:e.target.value}))}
                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200">
                                                <option value="all">Все хостелы</option>
                                                <option value="hostel1">Хостел №1</option>
                                                <option value="hostel2">Хостел №2</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1">Комментарий</label>
                                            <input value={form.comment} onChange={e => setForm(f=>({...f,comment:e.target.value}))}
                                                placeholder="Необязательно…"
                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="submit"
                                            className="flex-1 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold transition-colors">
                                            Сохранить
                                        </button>
                                        <button type="button" onClick={() => setAddForm(false)}
                                            className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-100 transition-colors">
                                            Отмена
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="px-5 py-3">
                                    <button onClick={() => setAddForm(true)}
                                        className="flex items-center gap-2 text-sm font-semibold text-indigo-500 hover:text-indigo-700 transition-colors">
                                        <Plus size={15} /> Добавить шаблон
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

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
                                    <span className="text-sm font-black text-rose-600">₊{fmt(mg.items.filter(matchFn).reduce((s,e)=>s+amtFn(e),0))}</span>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {monthItems.map(e => {
                                        const m = getCat(e.category);
                                        const staff = usersList.find(u=>u.id===e.staffId||u.login===e.staffId);
                                        const d = new Date(e.date);
                                        const dateStr = `${d.getDate()} ${d.toLocaleDateString('ru',{month:'short'})}`;
                                        const isSalary = e.category === 'Зарплата';
                                        const isAdvanceRow = e.category === 'Аванс';
                                        const staffAdvances = isSalary
                                            ? monthItems.filter(x => x.category === 'Аванс' && x.staffId === e.staffId)
                                            : [];
                                        const totalAdvances = staffAdvances.reduce((s,x)=>s+(Number(x.amount)||0),0);
                                        const remaining = (Number(e.amount)||0) - totalAdvances;
                                        const isAdvanceOpen = advanceTargetId === e.id;
                                        return (
                                            <div key={e.id} className={`group flex flex-col gap-0 ${isAdvanceRow ? 'bg-amber-50/40' : ''}`}>
                                                <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 font-bold"
                                                         style={{background: m.bg}}>
                                                        {m.icon}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-bold" style={{color: m.text}}>{e.category}</span>
                                                            {staff && <span className="text-xs text-slate-400">{staff.name.split(' ')[0]}</span>}
                                                            {isAdvanceRow && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">аванс</span>}
                                                        </div>
                                                        {e.comment && <div className="text-xs text-slate-500 truncate mt-0.5">{e.comment}</div>}
                                                        {isSalary && totalAdvances > 0 && (
                                                            <div className="text-xs text-amber-700 mt-0.5 font-semibold">
                                                                аванс: −{fmt(totalAdvances)} · <span className="text-indigo-600">к выплате: {fmt(remaining < 0 ? 0 : remaining)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-slate-400 shrink-0 hidden sm:block">{dateStr}</span>
                                                    {isAdvanceRow ? (
                                                        <span className="text-base font-black text-amber-600 shrink-0 tabular-nums">−{fmt(e.amount)}</span>
                                                    ) : (
                                                        <span className="text-base font-black text-rose-600 shrink-0 tabular-nums">₊{fmt(e.amount)}</span>
                                                    )}
                                                    {isSalary && !isAdvanceOpen && (
                                                        <button
                                                            onClick={() => { setAdvanceTargetId(e.id); setAdvanceAmt(''); }}
                                                            title="Выдать аванс"
                                                            className="w-7 h-7 flex items-center justify-center rounded-lg text-amber-400 hover:bg-amber-50 transition-colors shrink-0 text-base"
                                                        >💰</button>
                                                    )}
                                                    <button onClick={() => onDeleteExpense(e.id, e)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-rose-100 transition-all shrink-0"
                                                        title="Удалить">
                                                        <Trash2 size={16} color="#334155"/>
                                                    </button>
                                                </div>
                                                {isAdvanceOpen && (
                                                    <form
                                                        onSubmit={async (ev) => {
                                                            ev.preventDefault();
                                                            if (!advanceAmt) return;
                                                            await onAddAdvance?.({ staffExpense: e, amount: Number(advanceAmt) });
                                                            setAdvanceTargetId(null);
                                                            setAdvanceAmt('');
                                                        }}
                                                        className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 border-t border-amber-100"
                                                    >
                                                        <span className="text-xs font-semibold text-amber-700 shrink-0">💰 Сумма аванса:</span>
                                                        <input
                                                            type="number" min="1" autoFocus
                                                            value={advanceAmt}
                                                            onChange={ev => setAdvanceAmt(ev.target.value)}
                                                            placeholder="0"
                                                            className="flex-1 min-w-0 text-sm px-3 py-1.5 border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300"
                                                        />
                                                        <button type="submit" className="w-8 h-8 flex items-center justify-center rounded-xl bg-amber-400 hover:bg-amber-500 text-white transition-colors shrink-0">
                                                            <Check size={14} />
                                                        </button>
                                                        <button type="button" onClick={() => setAdvanceTargetId(null)} className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100 transition-colors shrink-0">
                                                            <X size={14} />
                                                        </button>
                                                    </form>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Возвраты — отдельная секция */}
            {sortedRefunds.length > 0 && (
                <div className="bg-white rounded-2xl border border-teal-200 overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between px-5 py-3 bg-teal-50 border-b border-teal-100">
                        <span className="text-sm font-black text-teal-700">💚 Возвраты гостям</span>
                        <span className="text-sm font-black text-teal-600">{fmt(totalRefunds)} сум · {sortedRefunds.length} записей</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                        {sortedRefunds.map(e => {
                            const staff = usersList.find(u=>u.id===e.staffId||u.login===e.staffId);
                            const d = new Date(e.date);
                            const dateStr = `${d.getDate()} ${d.toLocaleDateString('ru',{month:'short'})}`;
                            return (
                                <div key={e.id} className="group flex items-center gap-3 px-5 py-3.5 hover:bg-teal-50 transition-colors">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 font-bold bg-teal-100">
                                        💚
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-teal-700">Возврат</span>
                                            {staff && <span className="text-xs text-slate-400">{staff.name.split(' ')[0]}</span>}
                                        </div>
                                        {e.comment && <div className="text-xs text-slate-500 truncate mt-0.5">{e.comment}</div>}
                                    </div>
                                    <span className="text-xs text-slate-400 shrink-0 hidden sm:block">{dateStr}</span>
                                    <span className="text-base font-black text-teal-600 shrink-0 tabular-nums">
                                        ↩ {fmt(e.amount)}
                                    </span>
                                    <button onClick={() => onDeleteExpense(e.id, e)}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-rose-100 transition-all shrink-0"
                                        title="Удалить">
                                        <Trash2 size={16} color="#334155"/>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExpensesView;
