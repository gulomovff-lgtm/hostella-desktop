/**
 * ExpenseSortModal — разбор раздела «Другое» (просьба владельца 02.11.2026:
 * «в другом за месяц и зп, и завтраки, и яндекс — всё в одной куче»).
 *
 * Программа предлагает раздел по описанию (utils/expenseSort.js), админ
 * проверяет список, правит, что нужно, и переносит одной кнопкой. Зарплата
 * переносится только с получателем — иначе она не попадёт в расчёт ЗП.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { X, Check, Wand2 } from 'lucide-react';
import { planOtherExpenses } from '../../utils/expenseSort';

const PERIODS = [
    { id: 'this', label: 'Этот месяц' },
    { id: 'prev', label: 'Прошлый месяц' },
    { id: 'two', label: '2 месяца' },
];

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU');
const fmtDate = (iso) => { const d = new Date(iso); return isNaN(d) ? '—' : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }); };

function inPeriod(iso, period, now = new Date()) {
    const d = new Date(iso);
    if (isNaN(d)) return false;
    const ym = d.getFullYear() * 12 + d.getMonth();
    const cur = now.getFullYear() * 12 + now.getMonth();
    if (period === 'this') return ym === cur;
    if (period === 'prev') return ym === cur - 1;
    return ym === cur || ym === cur - 1;
}

export default function ExpenseSortModal({ expenses = [], users = [], staffOptions = [], categories = [], onApply, onClose, notify }) {
    const [period, setPeriod] = useState(() => (new Date().getDate() <= 7 ? 'two' : 'this'));
    const [rows, setRows] = useState([]);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(0);

    const source = useMemo(
        () => expenses.filter(e => (!e.category || e.category === 'Другое') && inPeriod(e.date, period))
            .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
        [expenses, period]);

    // Предложение — для новых строк; правки админа у уже показанных строк
    // сохраняются, даже если список расходов обновился из базы.
    useEffect(() => {
        setRows(prev => {
            const kept = new Map(prev.map(r => [r.id, r]));
            return planOtherExpenses(source, users).map(p => {
                const old = kept.get(p.expense.id);
                if (old) return { ...old, e: p.expense };
                return {
                    id: p.expense.id, e: p.expense,
                    category: p.category || 'Другое',
                    staffId: p.staffId || '',
                    on: !!p.category && (p.category !== 'Зарплата' || !!p.staffId),
                };
            });
        });
    }, [source, users]);

    useEffect(() => {
        const onKey = (ev) => { if (ev.key === 'Escape' && !busy) onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [busy, onClose]);

    const ready = (r) => r.category !== 'Другое' && (r.category !== 'Зарплата' || r.staffId);
    const chosen = rows.filter(r => r.on && ready(r));
    const chosenSum = chosen.reduce((s, r) => s + (Number(r.e.amount) || 0), 0);
    const suggested = rows.filter(r => r.category !== 'Другое').length;
    const byCat = useMemo(() => {
        const m = new Map();
        for (const r of chosen) m.set(r.category, (m.get(r.category) || 0) + (Number(r.e.amount) || 0));
        return [...m.entries()].sort((a, b) => b[1] - a[1]);
    }, [chosen]);

    const upd = (id, patch) => setRows(rs => rs.map(r => {
        if (r.id !== id) return r;
        const next = { ...r, ...patch };
        if ('category' in patch) next.on = ready(next);
        if ('staffId' in patch && next.category === 'Зарплата') next.on = !!next.staffId;
        return next;
    }));

    const apply = async () => {
        if (!chosen.length || busy) return;
        setBusy(true); setDone(0);
        let ok = 0, failed = 0;
        for (const r of chosen) {
            try {
                await onApply(r.id, r.category === 'Зарплата'
                    ? { category: 'Зарплата', targetStaffId: r.staffId }
                    : { category: r.category });
                ok++;
            } catch { failed++; }
            setDone(d => d + 1);
        }
        setBusy(false);
        notify?.(failed ? `Перенесено ${ok}, не удалось ${failed}` : `Перенесено из «Другое»: ${ok}`, failed ? 'warning' : 'success');
        if (!failed) onClose();
    };

    const catOptions = useMemo(() => [...new Set(['Другое', ...categories])], [categories]);

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4" style={{ background: 'rgba(8,18,20,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={() => !busy && onClose()}>
            <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col" style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                    <div>
                        <div className="flex items-center gap-2 font-black text-slate-800"><Wand2 size={18} className="text-orange-500" /> Разложить «Другое»</div>
                        <div className="text-xs text-slate-400 mt-0.5">Раздел подобран по описанию — проверьте и поправьте, где нужно</div>
                    </div>
                    <button onClick={onClose} disabled={busy} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={18} /></button>
                </div>

                <div className="px-5 py-3 border-b border-slate-100 shrink-0 flex flex-wrap items-center gap-2">
                    {PERIODS.map(p => (
                        <button key={p.id} type="button" onClick={() => setPeriod(p.id)} disabled={busy}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${period === p.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                            {p.label}
                        </button>
                    ))}
                    <span className="ml-auto text-xs text-slate-500 tabular-nums">
                        в «Другое»: <b>{rows.length}</b> · подсказка есть у <b>{suggested}</b>
                    </span>
                </div>

                {byCat.length > 0 && (
                    <div className="px-5 py-2.5 border-b border-slate-100 shrink-0 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        {byCat.map(([c, s]) => <span key={c}><b>{c}</b> <span className="tabular-nums">{fmt(s)}</span></span>)}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-5 py-2">
                    {!rows.length && (
                        <div className="py-12 text-center text-sm text-slate-400">В «Другое» за этот период ничего нет</div>
                    )}
                    {rows.map(r => (
                        <div key={r.id} className={`flex flex-wrap md:flex-nowrap items-center gap-2 py-2 border-b border-slate-50 ${r.on ? '' : 'opacity-60'}`}>
                            <input type="checkbox" checked={r.on} disabled={busy || !ready(r)} onChange={ev => upd(r.id, { on: ev.target.checked })}
                                className="w-4 h-4 accent-orange-500 shrink-0" />
                            <span className="text-xs text-slate-400 tabular-nums w-11 shrink-0">{fmtDate(r.e.date)}</span>
                            <span className="text-sm font-black text-slate-800 tabular-nums w-24 text-right shrink-0">{fmt(r.e.amount)}</span>
                            <span className="flex-1 min-w-[140px] text-sm text-slate-600 truncate" title={r.e.comment || ''}>{r.e.comment || <i className="text-slate-300">без описания</i>}</span>
                            <select value={r.category} disabled={busy} onChange={ev => upd(r.id, { category: ev.target.value })}
                                className={`w-44 shrink-0 px-2 py-1.5 rounded-lg border text-sm font-bold outline-none ${r.category === 'Другое' ? 'border-slate-200 text-slate-400' : 'border-orange-200 text-slate-800 bg-orange-50/40'}`}>
                                {catOptions.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            {r.category === 'Зарплата' ? (
                                <select value={r.staffId} disabled={busy} onChange={ev => upd(r.id, { staffId: ev.target.value })}
                                    className={`w-40 shrink-0 px-2 py-1.5 rounded-lg border text-sm font-bold outline-none ${r.staffId ? 'border-slate-200 text-slate-700' : 'border-amber-300 text-amber-700'}`}>
                                    <option value="">Кому?</option>
                                    {staffOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            ) : <span className="w-40 shrink-0 hidden md:block" />}
                        </div>
                    ))}
                </div>

                <div className="flex items-center gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
                    <span className="text-sm text-slate-500 tabular-nums">
                        {busy ? `Переношу… ${done} из ${chosen.length}` : <>Выбрано <b className="text-slate-800">{chosen.length}</b> на <b className="text-slate-800">{fmt(chosenSum)}</b> сум</>}
                    </span>
                    <button onClick={onClose} disabled={busy}
                        className="ml-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50">Отмена</button>
                    <button onClick={apply} disabled={!chosen.length || busy}
                        className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm disabled:opacity-40 flex items-center gap-2">
                        <Check size={16} /> Перенести ({chosen.length})
                    </button>
                </div>
            </div>
        </div>
    );
}
