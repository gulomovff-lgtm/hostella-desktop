import React, { useMemo, useState } from 'react';
import { X, Printer, Download, Wallet, ArrowRightLeft, Banknote, TrendingUp } from 'lucide-react';
import { buildDebtReport, expectedProfit } from '../../../utils/debtReport';
import { printDebtReport } from './debtPrint';
import { exportDebtsToExcel } from './debtExcel';

const money = (n) => (parseInt(n, 10) || 0).toLocaleString('ru');

const SOURCES = [
    { key: 'guest',    title: 'Гости',              hint: 'долги за проживание' },
    { key: 'rental',   title: 'Аренда комнат',      hint: 'помесячная аренда' },
    { key: 'contract', title: 'Договоры и бригады', hint: 'по договорам' },
];

/**
 * Отчёт по долгам: кто и сколько должен, в разрезе филиалов, источников и
 * способа оплаты. Показывается поверх финансового отчёта — вместе они дают
 * ожидаемую прибыль: собранное за период плюс то, что ещё придёт.
 */
const DebtReportModal = ({
    guests = [], rooms = [], contractGroups = [], payments = [],
    hostelId = null, hostelLabel = 'Все хостелы', hostels,
    periodNet = 0, periodLabel = '', onClose,
}) => {
    const [tab, setTab] = useState('all');
    const [busy, setBusy] = useState(false);

    const hostelName = (id) => hostels?.[id]?.name
        || (id === 'hostel1' ? 'Хостел №1' : id === 'hostel2' ? 'Хостел №2' : id || '—');

    const report = useMemo(
        () => buildDebtReport({ guests, rooms, contractGroups, payments, hostelId }),
        [guests, rooms, contractGroups, payments, hostelId]);

    const { rows, totals, bySource, byHostel, byEntity } = report;
    const expected = expectedProfit(periodNet, totals.debt);
    const shownRows = tab === 'all' ? rows : rows.filter(r => r.source === tab);
    const printArgs = { report, hostelLabel, hostelName, periodLabel, periodNet, expected };

    const handleExcel = async () => {
        if (busy) return;
        setBusy(true);
        try { await exportDebtsToExcel(printArgs); } finally { setBusy(false); }
    };

    const CARDS = [
        { label: 'Всего долгов',  val: money(totals.debt),     sub: `${totals.count} должников`, Icon: Wallet,        grad: 'from-rose-500 to-pink-600',    shadow: 'rgba(244,63,94,0.35)' },
        { label: 'Перечислением', val: money(totals.transfer), sub: 'от юрлиц и по договорам',   Icon: ArrowRightLeft, grad: 'from-sky-500 to-indigo-600',   shadow: 'rgba(59,130,246,0.35)' },
        { label: 'Обычные',       val: money(totals.regular),  sub: 'наличные, карта, QR',       Icon: Banknote,      grad: 'from-amber-500 to-orange-600', shadow: 'rgba(245,158,11,0.35)' },
        { label: 'Ожидаемо',      val: money(expected),        sub: 'баланс периода + долги',    Icon: TrendingUp,    grad: 'from-emerald-500 to-teal-600', shadow: 'rgba(16,185,129,0.35)' },
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center p-0 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-slate-50 w-full sm:max-w-5xl sm:rounded-3xl shadow-2xl min-h-full sm:min-h-0 sm:max-h-[92vh] flex flex-col">
                {/* Шапка */}
                <div className="flex items-center justify-between gap-3 px-5 py-4 bg-white border-b border-slate-200 sm:rounded-t-3xl shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-lg font-black text-slate-800 truncate">Отчёт по долгам</h2>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5 truncate">
                            {hostelLabel} · на {new Date().toLocaleDateString('ru')}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => printDebtReport(printArgs)}
                            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-sm font-bold transition-colors">
                            <Printer size={15} /> Печать
                        </button>
                        <button onClick={handleExcel} disabled={busy}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-sm font-bold transition-colors disabled:opacity-60">
                            <Download size={15} /> {busy ? 'Формирую…' : 'Excel'}
                        </button>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                    {/* Итоги */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {CARDS.map(({ label, val, sub, Icon, grad, shadow }) => (
                            <div key={label} className={`relative overflow-hidden rounded-3xl p-4 text-white bg-gradient-to-br ${grad}`}
                                style={{ boxShadow: `0 12px 28px -8px ${shadow}` }}>
                                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
                                <div className="relative flex items-center gap-2 mb-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center"><Icon size={16} /></div>
                                    <span className="text-[11px] font-black uppercase tracking-wider opacity-90">{label}</span>
                                </div>
                                <div className="relative text-xl sm:text-2xl font-black tracking-tight tabular-nums leading-none">{val}</div>
                                <div className="relative inline-block text-[10px] font-bold mt-2 px-2 py-0.5 rounded-full bg-white/15">{sub}</div>
                            </div>
                        ))}
                    </div>

                    <p className="text-[11px] text-slate-500 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 leading-relaxed">
                        Долги — снимок на сегодня, они не зависят от выбранного периода.
                        «Ожидаемо» = баланс за период {periodLabel ? <b>({periodLabel})</b> : null} плюс все долги: сколько будет, когда должники рассчитаются.
                        Способ оплаты определён по прошлым платежам должника.
                    </p>

                    {/* По филиалам */}
                    {byHostel.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70">
                                <span className="text-xs font-black uppercase tracking-wide text-slate-500">По филиалам</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                                            <th className="text-left font-bold px-4 py-2">Филиал</th>
                                            <th className="text-right font-bold px-3 py-2">Гости</th>
                                            <th className="text-right font-bold px-3 py-2">Аренда</th>
                                            <th className="text-right font-bold px-3 py-2">Договоры</th>
                                            <th className="text-right font-bold px-3 py-2">Перечисл.</th>
                                            <th className="text-right font-bold px-3 py-2">Обычные</th>
                                            <th className="text-right font-bold px-4 py-2">Всего</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {byHostel.map(h => (
                                            <tr key={h.hostelId} className="border-b border-slate-50 last:border-0">
                                                <td className="px-4 py-2.5 font-bold text-slate-700">{hostelName(h.hostelId)}</td>
                                                <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{money(h.guest)}</td>
                                                <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{money(h.rental)}</td>
                                                <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{money(h.contract)}</td>
                                                <td className="px-3 py-2.5 text-right tabular-nums text-indigo-600 font-semibold">{money(h.transfer)}</td>
                                                <td className="px-3 py-2.5 text-right tabular-nums text-amber-600 font-semibold">{money(h.regular)}</td>
                                                <td className="px-4 py-2.5 text-right tabular-nums font-black text-rose-600">{money(h.debt)}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-slate-50 font-black">
                                            <td className="px-4 py-2.5 text-slate-700">Итого</td>
                                            <td className="px-3 py-2.5 text-right tabular-nums">{money(bySource.guest.debt)}</td>
                                            <td className="px-3 py-2.5 text-right tabular-nums">{money(bySource.rental.debt)}</td>
                                            <td className="px-3 py-2.5 text-right tabular-nums">{money(bySource.contract.debt)}</td>
                                            <td className="px-3 py-2.5 text-right tabular-nums text-indigo-700">{money(totals.transfer)}</td>
                                            <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">{money(totals.regular)}</td>
                                            <td className="px-4 py-2.5 text-right tabular-nums text-rose-600">{money(totals.debt)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Перечисления по получателям */}
                    {byEntity.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3">
                            <div className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">Ожидается перечислением</div>
                            <div className="flex flex-wrap gap-2">
                                {byEntity.map(e => (
                                    <span key={e.entity} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold">
                                        {e.entity}
                                        <b className="tabular-nums">{money(e.debt)}</b>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Подробно */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="flex gap-1.5 p-2.5 border-b border-slate-100 bg-slate-50/70 overflow-x-auto scrollbar-hide">
                            {[{ key: 'all', title: 'Все', debt: totals.debt }, ...SOURCES.map(s => ({ ...s, debt: bySource[s.key].debt }))].map(s => {
                                const on = tab === s.key;
                                return (
                                    <button key={s.key} onClick={() => setTab(s.key)}
                                        className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${on ? 'bg-indigo-600 text-white border border-indigo-600 shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'}`}>
                                        {s.title} <span className={on ? 'opacity-80' : 'text-slate-400'}>{money(s.debt)}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {shownRows.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 text-sm">Долгов нет</div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {shownRows.map(r => (
                                    <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-sm text-slate-800 truncate">
                                                {r.name}
                                                {r.records > 1 && <span className="ml-1.5 text-[10px] font-bold text-slate-400">{r.records} записи</span>}
                                                {r.completed && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">завершён</span>}
                                            </div>
                                            <div className="text-[11px] text-slate-400 truncate">
                                                {SOURCES.find(s => s.key === r.source)?.title}
                                                {r.detail ? ` · ${r.detail}` : ''}
                                                {` · ${hostelName(r.hostelId)}`}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="font-black text-sm text-rose-600 tabular-nums">{money(r.debt)}</div>
                                            <div className="text-[10px] text-slate-400 tabular-nums">{money(r.paid)} из {money(r.charged)}</div>
                                        </div>
                                        <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${r.method === 'transfer' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                                            {r.method === 'transfer' ? (r.entities?.[0] || 'перечисление') : 'наличные'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <button onClick={() => printDebtReport(printArgs)}
                        className="sm:hidden w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold">
                        <Printer size={15} /> Печать
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DebtReportModal;
