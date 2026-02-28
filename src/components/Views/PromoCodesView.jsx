import React, { useState } from 'react';
import { Tag, Plus, Trash2, Edit2, Check, X, Copy, Percent, Hash } from 'lucide-react';

// ── PromoCodesView ────────────────────────────────────────────────────────────
const PromoCodesView = ({ promos = [], onSave, onDelete }) => {
    const [showModal, setShowModal] = useState(false);
    const [editing,   setEditing  ] = useState(null);
    const [copied,    setCopied   ] = useState(null);
    const blank = { code: '', discount: 10, type: 'percent', active: true, maxUses: '', expiresAt: '' };
    const [form, setForm] = useState(blank);

    const openNew  = () => { setEditing(null); setForm(blank); setShowModal(true); };
    const openEdit = (p) => {
        setEditing(p.id);
        setForm({ code: p.code, discount: p.discount, type: p.type || 'percent',
                  active: p.active !== false, maxUses: p.maxUses ?? '', expiresAt: p.expiresAt ?? '' });
        setShowModal(true);
    };

    const handleSubmit = () => {
        if (!form.code.trim()) return;
        const existing = promos.find(p => p.id === editing);
        onSave({
            id:        editing || Date.now().toString(36),
            code:      form.code.trim().toUpperCase(),
            discount:  parseFloat(form.discount) || 0,
            type:      form.type,
            active:    form.active,
            maxUses:   form.maxUses ? parseInt(form.maxUses) : null,
            expiresAt: form.expiresAt || null,
            usedCount: existing?.usedCount || 0,
        });
        setShowModal(false);
    };

    const copyCode = (code) => {
        navigator.clipboard.writeText(code).catch(() => {});
        setCopied(code);
        setTimeout(() => setCopied(null), 1500);
    };

    const isEffective = (p) => {
        if (!p.active) return false;
        if (p.expiresAt && new Date(p.expiresAt) < new Date()) return false;
        if (p.maxUses   && p.usedCount >= p.maxUses)           return false;
        return true;
    };

    return (
        <div className="space-y-4 animate-in fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Tag size={20} className="text-orange-500"/> Промокоды
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {promos.filter(isEffective).length} активных · применяются при онлайн-бронировании
                    </p>
                </div>
                <button onClick={openNew}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors shadow-sm">
                    <Plus size={15}/> Добавить
                </button>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                {promos.length === 0 ? (
                    <div className="py-16 text-center">
                        <div className="text-5xl mb-3">🏷️</div>
                        <div className="text-slate-500 font-semibold">Нет промокодов</div>
                        <div className="text-slate-300 text-sm mt-1">Создайте первый код скидки</div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[640px]">
                            <thead>
                                <tr className="bg-slate-50 text-xs font-black text-slate-400 uppercase tracking-wide">
                                    <th className="px-4 py-3 text-left">Код</th>
                                    <th className="px-4 py-3 text-left">Скидка</th>
                                    <th className="px-4 py-3 text-left">Использований</th>
                                    <th className="px-4 py-3 text-left">Истекает</th>
                                    <th className="px-4 py-3 text-left">Статус</th>
                                    <th className="px-4 py-3 text-right"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {promos.map(p => {
                                    const eff = isEffective(p);
                                    const expired   = p.expiresAt && new Date(p.expiresAt) < new Date();
                                    const exhausted = p.maxUses   && p.usedCount >= p.maxUses;
                                    return (
                                        <tr key={p.id} className={`hover:bg-slate-50/60 transition-colors ${!eff ? 'opacity-50' : ''}`}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-slate-800 tracking-wider text-base">{p.code}</span>
                                                    <button onClick={() => copyCode(p.code)}
                                                        className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                                                        title="Скопировать">
                                                        {copied === p.code ? <Check size={13} className="text-emerald-500"/> : <Copy size={13}/>}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="font-bold text-orange-600 text-base">
                                                    {p.type === 'percent'
                                                        ? `${p.discount}%`
                                                        : `${(p.discount || 0).toLocaleString()} сум`}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                <span className="font-semibold">{p.usedCount || 0}</span>
                                                {p.maxUses && <span className="text-slate-400"> / {p.maxUses}</span>}
                                                {exhausted && <span className="ml-1.5 text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full">лимит</span>}
                                            </td>
                                            <td className="px-4 py-3 text-slate-500">
                                                {p.expiresAt
                                                    ? new Date(p.expiresAt).toLocaleDateString('ru', { day: 'numeric', month: 'short', year: 'numeric' })
                                                    : <span className="text-slate-300">бессрочно</span>}
                                                {expired && <span className="ml-1.5 text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full">истёк</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                                    eff
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-slate-100 text-slate-400 border-slate-200'
                                                }`}>
                                                    {eff ? <Check size={10}/> : <X size={10}/>}
                                                    {eff ? 'Активен' : 'Неактивен'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1 justify-end">
                                                    <button onClick={() => openEdit(p)}
                                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                        <Edit2 size={14}/>
                                                    </button>
                                                    <button onClick={() => onDelete(p.id)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                                                        <Trash2 size={14}/>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* How to use info */}
            <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
                <div className="font-bold text-orange-700 mb-1.5 text-sm">Как работают промокоды</div>
                <ul className="text-orange-600 space-y-1 text-xs leading-relaxed">
                    <li>• Гость вводит код при онлайн-бронировании на сайте — скидка применяется автоматически</li>
                    <li>• Тип «%» — скидка от суммы (например 10% с 150 000 = 135 000 сум)</li>
                    <li>• Тип «сум» — фиксированная скидка (например 20 000 сум с любой суммы)</li>
                    <li>• «Макс. использований» — сколько раз можно применить код (пусто = без ограничений)</li>
                </ul>
            </div>

            {/* ── Modal ── */}
            {showModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
                            <h3 className="font-bold text-lg text-slate-800">
                                {editing ? 'Редактировать код' : 'Новый промокод'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
                                <X size={18}/>
                            </button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            {/* Code */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Промокод</label>
                                <input
                                    value={form.code}
                                    onChange={e => setForm(f => ({...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '')}))}
                                    placeholder="SUMMER25"
                                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-black tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"/>
                            </div>

                            {/* Type + Amount */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Тип скидки</label>
                                    <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white text-slate-700">
                                        <option value="percent">Процент %</option>
                                        <option value="fixed">Фиксированная (сум)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                                        {form.type === 'percent' ? 'Скидка (%)' : 'Скидка (сум)'}
                                    </label>
                                    <div className="relative">
                                        <input type="number" min="0" max={form.type === 'percent' ? 100 : undefined}
                                            value={form.discount}
                                            onChange={e => setForm(f => ({...f, discount: e.target.value}))}
                                            className="w-full pl-3 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"/>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                            {form.type === 'percent' ? <Percent size={14}/> : <Hash size={14}/>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Limits */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Макс. использований</label>
                                    <input type="number" min="1"
                                        value={form.maxUses}
                                        onChange={e => setForm(f => ({...f, maxUses: e.target.value}))}
                                        placeholder="∞"
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Дата истечения</label>
                                    <input type="date"
                                        value={form.expiresAt}
                                        onChange={e => setForm(f => ({...f, expiresAt: e.target.value}))}
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"/>
                                </div>
                            </div>

                            {/* Active toggle */}
                            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                                <span className="text-sm font-semibold text-slate-700">Активен</span>
                                <button onClick={() => setForm(f => ({...f, active: !f.active}))}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${form.active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.active ? 'left-[22px]' : 'left-0.5'}`}/>
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <button onClick={() => setShowModal(false)}
                                    className="py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors">
                                    Отмена
                                </button>
                                <button onClick={handleSubmit}
                                    className="py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-colors shadow-sm">
                                    {editing ? 'Сохранить' : 'Создать'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PromoCodesView;
