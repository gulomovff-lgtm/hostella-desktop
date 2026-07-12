import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import CategoryIcon from '../../utils/categoryIcon';
import { getConfig } from '../../utils/appConfig';

/**
 * Расход в новом стиле беты. Запись — через РОДНОЙ handleAddExpense (onSubmit):
 * тот же документ, аудит, Telegram. Фото чека и валюта USD — пока в основном.
 */
const fmtMoney = (n) => (n || 0).toLocaleString('ru-RU');
const toInt = (v) => {
    const n = parseInt(String(v).replace(/[^\d]/g, ''), 10);
    return Number.isFinite(n) ? n : 0;
};

// Встроенные категории (без служебных «Аванс»/«Возврат» — у них свои потоки)
const BUILTIN = [
    'Аренда', 'Коммунальные услуги', 'Зарплата', 'Продукты', 'Налоги', 'Регистрация',
    'Интернет', 'Реклама', 'Газ', 'Электричество', 'Вода', 'Ремонт', 'Другое',
];

const QUICK = [10000, 50000, 100000, 500000];

const ExpenseBetaModal = ({ onClose, onSubmit }) => {
    const [category, setCategory] = useState('');
    const [amount, setAmount] = useState('');
    const [comment, setComment] = useState('');
    const [busy, setBusy] = useState(false);

    // Центральные категории из конфига (общие с основным приложением)
    const allCats = useMemo(() => {
        let central = [];
        try { central = (getConfig().expenseCategories || []).filter(c => c && c.name); } catch { /* ignore */ }
        const names = new Set(BUILTIN);
        const extra = central.map(c => ({ name: c.name, emoji: c.icon })).filter(c => !names.has(c.name));
        return [...BUILTIN.map(n => ({ name: n })), ...extra];
    }, []);

    const sum = toInt(amount);
    const canSubmit = category && sum > 0 && !busy;

    const submit = async () => {
        if (!canSubmit) return;
        setBusy(true);
        try {
            await onSubmit({ category, amount: sum, comment: comment.trim(), date: new Date().toISOString() });
            // handleAddExpense сам закрывает модалку через setExpenseModal(false)
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[170] flex items-center justify-center px-4"
            style={{ background: 'rgba(8,18,20,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
            <div role="dialog" aria-modal="true" aria-label="Новый расход"
                className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 max-h-[92vh] flex flex-col">

                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-shrink-0">
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-black text-slate-800">Новый расход</div>
                        <div className="text-[11px] text-slate-400">пишется в общую базу — как из основного приложения</div>
                    </div>
                    <button onClick={onClose} disabled={busy} aria-label="Закрыть"
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="overflow-y-auto px-5 py-4 flex flex-col gap-4">
                    {/* Категория */}
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Категория</div>
                        <div className="grid grid-cols-3 gap-2">
                            {allCats.map(c => {
                                const act = category === c.name;
                                return (
                                    <button key={c.name} onClick={() => setCategory(c.name)}
                                        className={`flex flex-col items-center gap-1.5 rounded-xl border px-1.5 py-2.5 transition-all ${
                                            act ? 'border-orange-400 bg-orange-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                                        <span className={act ? 'text-orange-500' : 'text-slate-400'}>
                                            <CategoryIcon cat={c.name} emoji={c.emoji} size={18} color={act ? '#f97316' : '#94a3b8'} />
                                        </span>
                                        <span className={`text-[10px] font-bold leading-tight text-center ${act ? 'text-orange-600' : 'text-slate-500'}`}>
                                            {c.name}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Сумма */}
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Сумма</div>
                        <div className={`rounded-xl border px-4 py-3 flex items-baseline gap-2 transition-colors ${
                            sum > 0 ? 'border-orange-300 bg-orange-50/40' : 'border-slate-200'}`}>
                            <input inputMode="numeric" autoFocus value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0"
                                className="flex-1 text-xl font-black tabular-nums text-slate-800 bg-transparent outline-none min-w-0" />
                            <span className="text-xs font-bold text-slate-400">сум</span>
                        </div>
                        <div className="flex gap-2 mt-2">
                            {QUICK.map(v => (
                                <button key={v} onClick={() => setAmount(String(toInt(amount) + v))}
                                    className="flex-1 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 border border-slate-200 bg-white hover:border-orange-200 hover:text-orange-600 transition-colors tabular-nums">
                                    +{v >= 1000000 ? `${v / 1000000}М` : `${v / 1000}к`}
                                </button>
                            ))}
                            {sum > 0 && (
                                <button onClick={() => setAmount('')}
                                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 border border-slate-200 hover:bg-slate-50 transition-colors">
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Комментарий */}
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Комментарий <span className="normal-case font-semibold">(не обязательно)</span></div>
                        <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                            placeholder="Например: 6 бутылей воды"
                            className="w-full rounded-xl border border-slate-200 focus:border-orange-300 px-3.5 py-2.5 text-sm text-slate-700 outline-none resize-none transition-colors" />
                        <p className="text-[10.5px] text-slate-400 mt-1.5">Фото чека и оплата в USD — пока в основном приложении.</p>
                    </div>
                </div>

                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex gap-2 flex-shrink-0">
                    <button onClick={onClose} disabled={busy}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 border border-slate-200 bg-white hover:bg-slate-100 transition-colors">
                        Отмена
                    </button>
                    <button onClick={submit} disabled={!canSubmit}
                        className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 transition-colors">
                        {busy ? 'Записываю…' : canSubmit ? `Записать ${fmtMoney(sum)} сум · ${category}` : 'Выберите категорию и сумму'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExpenseBetaModal;
