import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { describePayment, purposeText } from '../../utils/cashierTimeline';
import { groupByMethod, byStaff, byDay, expensesByCategory, freeBedsOf, METHOD_ORDER } from '../../utils/dashboardDetails';
import { chargeOf } from '../../utils/shop';

/**
 * Окно «подробно» у плиток дашборда. kind:
 *   guests | occupancy | incomeToday | debts | overdue | free | incomeMonth | profitMonth
 * Гость в списке открывает карточку (она поверх — z-200, окно — z-150).
 *
 * Окно рисуется в <body> (портал): дашборд живёт внутри прокручиваемой
 * области, и на телефоне (iPhone/Telegram) окно оставалось заперто в ней —
 * нижнее меню ложилось поверх деталей (жалоба владельца 2026-09-26).
 */

const fmt = (n) => (Number(n) || 0).toLocaleString('ru-RU');
const pad2 = (n) => String(n).padStart(2, '0');
const hm = (d) => { const x = new Date(d); return Number.isFinite(x.getTime()) ? `${pad2(x.getHours())}:${pad2(x.getMinutes())}` : ''; };
const dmy = (d) => { const x = new Date(d); return Number.isFinite(x.getTime()) && x.getTime() ? `${pad2(x.getDate())}.${pad2(x.getMonth() + 1)}` : '—'; };
const paidOf = (g) => (typeof g.amountPaid === 'number' ? g.amountPaid : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0) + (g.paidTransfer || 0)));
const roomSort = (a, b) => String(a.roomNumber || a.number || '').localeCompare(String(b.roomNumber || b.number || ''), 'ru', { numeric: true }) ||
    String(a.bedId || '').localeCompare(String(b.bedId || ''), 'ru', { numeric: true });

const METHOD_LABEL = { cash: 'cash', card: 'card', qr: 'qr', transfer: 'transferMethod', balance: 'ctlBalanceMethod', other: 'ptOther' };
const METHOD_TONE = {
    cash: 'bg-emerald-50 border-emerald-100 text-emerald-700', card: 'bg-blue-50 border-blue-100 text-blue-700',
    qr: 'bg-purple-50 border-purple-100 text-purple-700', transfer: 'bg-teal-50 border-teal-100 text-teal-700',
    balance: 'bg-amber-50 border-amber-100 text-amber-700', other: 'bg-slate-50 border-slate-200 text-slate-600',
};

const DashboardDetailModal = ({ kind, onClose, t, data, expired = [], users = [], guests = [], todayStr, monthPrefix, dayOf, onOpenGuest }) => {
    const [q, setQ] = useState('');
    const [openKey, setOpenKey] = useState(null);
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const guestsById = useMemo(() => new Map(guests.map(g => [g.id, g])), [guests]);
    const staffName = (k) => { const u = users.find(x => x.id === k || x.login === k); return u?.name || u?.login || k || '—'; };
    const payText = (p) => (p.type === 'cash_to_terminal'
        ? `${t('ptCtt')}${p.comment ? ': ' + p.comment : ''}`
        : purposeText(describePayment(p, guestsById.get(p.guestId) || null), t));
    const match = (g) => !q || `${g.fullName || ''} ${g.roomNumber || ''} ${g.passport || ''} ${g.country || ''}`.toLowerCase().includes(q.toLowerCase());

    const GuestName = ({ g }) => (onOpenGuest && !g.isRental
        ? <button onClick={() => onOpenGuest(g)} className="font-bold text-indigo-600 hover:underline text-left">{g.fullName || '—'}</button>
        : <span className="font-bold text-slate-800">{g.fullName || '—'}</span>);

    const Head = ({ cols }) => (
        <thead><tr className="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
            {cols.map((c, i) => <th key={i} className={`py-2 px-2 font-bold ${c.r ? 'text-right' : 'text-left'}`}>{c.l}</th>)}
        </tr></thead>
    );

    const payRows = (list) => list.map(({ p, amount }) => (
        <div key={p.id + '_' + amount} className="flex gap-3 py-1.5 pl-3 pr-1 border-b border-slate-50 text-[13px]">
            <span className="w-11 shrink-0 text-xs font-mono font-bold text-slate-400 pt-0.5">{hm(p.date)}</span>
            <div className="flex-1 min-w-0">
                <div className="text-slate-700 leading-snug">{payText(p)}</div>
                <div className="text-[11px] text-slate-400">{staffName(p.staffId)}{p.method === 'split' ? ` · ${t('scmPartOfMix')}` : ''}{p.transferTo ? ` · ${p.transferTo}` : ''}</div>
            </div>
            <span className="shrink-0 font-black tabular-nums text-emerald-600">+{fmt(amount)}</span>
        </div>
    ));

    const methodBlocks = (payments) => {
        const { groups, totals } = groupByMethod(payments);
        return METHOD_ORDER.filter(k => groups[k].length).map(k => (
            <div key={k} className="mb-3">
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl border font-bold text-sm ${METHOD_TONE[k]}`}>
                    <span>{t(METHOD_LABEL[k])} <span className="font-semibold opacity-70">· {groups[k].length}</span></span>
                    <span className="tabular-nums">{fmt(totals[k])}</span>
                </div>
                {payRows(groups[k])}
            </div>
        ));
    };

    const view = useMemo(() => {
        switch (kind) {
            case 'guests': {
                const today = new Set(data.arrivalsToday.map(g => g.id));
                const list = [...data.activeGuests].filter(match).sort(roomSort);
                return {
                    title: t('guestsNow'), sub: `${data.activeGuests.length} · +${data.arrivalsToday.length} ${t('todayShort')}`, search: true,
                    body: (
                        <table className="w-full text-sm">
                            <Head cols={[{ l: t('ddGuest') }, { l: t('ddRoomBed') }, { l: t('ddStay') }, { l: t('debts'), r: true }]} />
                            <tbody>{list.map(g => {
                                const debt = chargeOf(g) - paidOf(g);
                                return (
                                    <tr key={g.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                                        <td className="py-2 px-2"><GuestName g={g} />{today.has(g.id) && <span className="ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">{t('ddNewToday')}</span>}<div className="text-[11px] text-slate-400">{g.country || ''}</div></td>
                                        <td className="py-2 px-2 text-slate-600">{g.roomNumber || '—'} / {g.bedId || '—'}</td>
                                        <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{dmy(g.checkInDate)} → {dmy(g.checkOutDate)} <span className="text-slate-400">· {g.days || '?'} {t('daysShort')}</span></td>
                                        <td className={`py-2 px-2 text-right font-bold tabular-nums ${debt > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{debt > 0 ? fmt(debt) : '—'}</td>
                                    </tr>
                                );
                            })}</tbody>
                        </table>
                    ),
                };
            }
            case 'occupancy': case 'free': {
                const free = kind === 'free';
                const rooms = [...data.roomOccupancy].sort(roomSort)
                    .map(r => ({ r, beds: freeBedsOf(r, data.activeGuests), people: data.activeGuests.filter(g => g.roomId === r.id).sort(roomSort) }))
                    .filter(x => !free || x.beds.length > 0);
                return {
                    title: free ? t('freeBedsLabel') : t('occupancy'),
                    sub: free ? `${data.freeBeds} ${t('ofLabel')} ${data.totalBeds}` : `${data.occupiedBeds}/${data.totalBeds} · ${data.occupancyRaw}%`,
                    body: (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {rooms.map(({ r, beds, people }) => (
                                <div key={r.id} className="border border-slate-200 rounded-xl p-3">
                                    <div className="flex items-center justify-between">
                                        <span className="font-black text-slate-800">{t('ddRoom').replace('{n}', r.number || '—')}</span>
                                        <span className={`text-xs font-black ${r.rented ? 'text-purple-600' : r.pct >= 100 ? 'text-rose-600' : 'text-slate-500'}`}>
                                            {r.rented ? t('ddRented') : `${r.occupied}/${parseInt(r.capacity) || 0}`}
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden"><div className={`h-full rounded-full ${r.pct >= 100 ? 'bg-rose-400' : 'bg-indigo-400'}`} style={{ width: `${Math.min(100, r.pct)}%` }} /></div>
                                    {r.rented && <div className="text-xs text-purple-600 mt-1.5">{r.rental?.tenantName || ''}{r.rental?.endDate ? ` · ${t('ptUntil').replace('{date}', dmy(r.rental.endDate))}` : ''}</div>}
                                    {beds.length > 0 && <div className="text-xs text-emerald-700 mt-1.5 font-semibold">{t('ddFreeBeds').replace('{list}', beds.join(', '))}</div>}
                                    {!free && people.length > 0 && (
                                        <div className="mt-1.5 flex flex-col gap-0.5">
                                            {people.map(g => <div key={g.id} className="text-xs text-slate-600"><span className="text-slate-400 mr-1">{g.bedId || '—'}.</span><GuestName g={g} /> <span className="text-slate-400">{t('ptUntil').replace('{date}', dmy(g.checkOutDate))}</span></div>)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ),
                };
            }
            case 'incomeToday': {
                const pays = data.relPayments.filter(p => dayOf(p.date) === todayStr);
                const exps = data.relExpenses.filter(e => dayOf(e.date) === todayStr);
                const expTotal = exps.reduce((s, e) => s + (parseInt(e.amount) || 0), 0);
                return {
                    title: t('incomeToday'), sub: fmt(data.incomeToday),
                    body: (
                        <>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {byStaff(pays).map(s => (
                                    <span key={s.staffId} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">{staffName(s.staffId)}: {fmt(s.total)} <span className="font-semibold text-slate-400">· {s.count}</span></span>
                                ))}
                            </div>
                            {pays.length === 0 && <div className="text-center text-slate-400 py-8 text-sm">{t('ddNoPayments')}</div>}
                            {methodBlocks(pays)}
                            {exps.length > 0 && (
                                <div className="mb-3">
                                    <div className="flex items-center justify-between px-3 py-2 rounded-xl border font-bold text-sm bg-rose-50 border-rose-100 text-rose-700">
                                        <span>{t('scmExpensesTitle')} <span className="font-semibold opacity-70">· {exps.length}</span></span><span className="tabular-nums">−{fmt(expTotal)}</span>
                                    </div>
                                    {[...exps].sort((a, b) => String(a.date).localeCompare(String(b.date))).map(e => (
                                        <div key={e.id} className="flex gap-3 py-1.5 pl-3 pr-1 border-b border-slate-50 text-[13px]">
                                            <span className="w-11 shrink-0 text-xs font-mono font-bold text-slate-400 pt-0.5">{hm(e.date)}</span>
                                            <div className="flex-1 min-w-0"><div className="text-slate-700">{e.category || '—'}{e.comment ? `: ${e.comment}` : ''}</div><div className="text-[11px] text-slate-400">{staffName(e.staffId)}</div></div>
                                            <span className="shrink-0 font-black tabular-nums text-rose-600">−{fmt(e.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ),
                };
            }
            case 'incomeMonth': {
                const pays = data.relPayments.filter(p => (dayOf(p.date) || '').slice(0, 7) === monthPrefix);
                const days = byDay(pays, dayOf);
                return {
                    title: t('ddIncomeMonth'), sub: fmt(data.incomeThisMonth),
                    body: (
                        <>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {(() => { const { totals } = groupByMethod(pays); return METHOD_ORDER.filter(k => totals[k]).map(k => (
                                    <span key={k} className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${METHOD_TONE[k]}`}>{t(METHOD_LABEL[k])}: {fmt(totals[k])}</span>)); })()}
                            </div>
                            {days.map(d => (
                                <div key={d.ds} className="border-b border-slate-100">
                                    <button onClick={() => setOpenKey(openKey === d.ds ? null : d.ds)} className="w-full flex items-center gap-2 py-2 px-1 hover:bg-slate-50 text-left">
                                        {openKey === d.ds ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                                        <span className="font-bold text-slate-700 w-14">{d.ds.slice(8, 10)}.{d.ds.slice(5, 7)}</span>
                                        <span className="text-[11px] text-slate-400 flex-1 truncate">{[['cash', d.cash], ['card', d.card], ['qr', d.qr], ['transferMethod', d.transfer]].filter(([, v]) => v).map(([k, v]) => `${t(k)} ${fmt(v)}`).join(' · ')}</span>
                                        <span className="font-black tabular-nums text-emerald-600">{fmt(d.total)}</span>
                                    </button>
                                    {openKey === d.ds && <div className="pb-2">{methodBlocks(d.payments)}</div>}
                                </div>
                            ))}
                        </>
                    ),
                };
            }
            case 'profitMonth': {
                const exps = data.relExpenses.filter(e => (dayOf(e.date) || '').slice(0, 7) === monthPrefix);
                const cats = expensesByCategory(exps);
                const net = data.incomeThisMonth - data.expenseThisMonth;
                return {
                    title: t('monthProfit'), sub: fmt(net),
                    body: (
                        <>
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2"><div className="text-[10px] font-bold uppercase text-emerald-600">{t('incomeWord')}</div><div className="font-black text-emerald-700 tabular-nums">{fmt(data.incomeThisMonth)}</div></div>
                                <div className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2"><div className="text-[10px] font-bold uppercase text-rose-600">{t('expense')}</div><div className="font-black text-rose-700 tabular-nums">−{fmt(data.expenseThisMonth)}</div></div>
                                <div className={`rounded-xl border px-3 py-2 ${net >= 0 ? 'bg-teal-50 border-teal-100' : 'bg-rose-50 border-rose-100'}`}><div className="text-[10px] font-bold uppercase text-slate-500">{t('monthProfit')}</div><div className={`font-black tabular-nums ${net >= 0 ? 'text-teal-700' : 'text-rose-700'}`}>{fmt(net)}</div></div>
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">{t('ddExpensesByCat')}</div>
                            {cats.length === 0 && <div className="text-center text-slate-400 py-6 text-sm">{t('ddNoExpenses')}</div>}
                            {cats.map(c => (
                                <div key={c.category} className="border-b border-slate-100">
                                    <button onClick={() => setOpenKey(openKey === c.category ? null : c.category)} className="w-full flex items-center gap-2 py-2 px-1 hover:bg-slate-50 text-left">
                                        {openKey === c.category ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                                        <span className="font-bold text-slate-700 flex-1">{c.category} <span className="text-slate-400 font-semibold">· {c.items.length}</span></span>
                                        <span className="font-black tabular-nums text-rose-600">−{fmt(c.total)}</span>
                                    </button>
                                    {openKey === c.category && c.items.map(e => (
                                        <div key={e.id} className="flex gap-3 py-1 pl-7 pr-1 text-[13px]">
                                            <span className="w-12 shrink-0 text-xs text-slate-400">{dmy(e.date)}</span>
                                            <span className="flex-1 text-slate-600">{e.comment || '—'} <span className="text-[11px] text-slate-400">· {staffName(e.staffId)}</span></span>
                                            <span className="tabular-nums text-rose-600 font-bold">−{fmt(e.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </>
                    ),
                };
            }
            case 'debts': {
                const list = data.debtors.filter(match);
                return {
                    title: t('debts'), sub: `${fmt(data.totalDebt)} · ${data.debtors.length}`, search: true,
                    body: (
                        <table className="w-full text-sm">
                            <Head cols={[{ l: t('ddGuest') }, { l: t('ddRoomBed') }, { l: t('ddStatus') }, { l: t('ddCharged'), r: true }, { l: t('ddPaid'), r: true }, { l: t('debts'), r: true }]} />
                            <tbody>{list.map(g => (
                                <tr key={g.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                                    <td className="py-2 px-2"><GuestName g={g} /></td>
                                    <td className="py-2 px-2 text-slate-600">{g.roomNumber || '—'}{g.bedId ? ` / ${g.bedId}` : ''}</td>
                                    <td className="py-2 px-2 text-xs font-bold">{g.isRental ? <span className="text-purple-600">{t('ddRented')}</span> : g.status === 'active' ? <span className="text-emerald-600">{t('ddLiving')}</span> : <span className="text-slate-500">{t('ddLeft')} {dmy(g.checkOutDate)}</span>}</td>
                                    <td className="py-2 px-2 text-right tabular-nums text-slate-600">{fmt(g.isRental ? g.totalPrice : chargeOf(g))}</td>
                                    <td className="py-2 px-2 text-right tabular-nums text-slate-600">{g.isRental ? fmt((g.totalPrice || 0) - g.debt) : fmt(paidOf(g))}</td>
                                    <td className="py-2 px-2 text-right tabular-nums font-black text-rose-600">{fmt(g.debt)}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    ),
                };
            }
            case 'overdue': {
                const nowMs = Date.now();
                const list = [...expired].filter(match).sort((a, b) => new Date(a.checkOutDate) - new Date(b.checkOutDate));
                return {
                    title: t('overdueCount'), sub: String(expired.length),
                    body: list.length === 0 ? <div className="text-center text-slate-400 py-8 text-sm">{t('ddNoOverdue')}</div> : (
                        <table className="w-full text-sm">
                            <Head cols={[{ l: t('ddGuest') }, { l: t('ddRoomBed') }, { l: t('ddCheckoutWas') }, { l: t('ddOverdueBy') }, { l: t('debts'), r: true }]} />
                            <tbody>{list.map(g => {
                                const h = Math.max(0, Math.floor((nowMs - new Date(g.checkOutDate).getTime()) / 3600000));
                                const debt = chargeOf(g) - paidOf(g);
                                return (
                                    <tr key={g.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                                        <td className="py-2 px-2"><GuestName g={g} /></td>
                                        <td className="py-2 px-2 text-slate-600">{g.roomNumber || '—'} / {g.bedId || '—'}</td>
                                        <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{dmy(g.checkOutDate)} {hm(g.checkOutDate)}</td>
                                        <td className="py-2 px-2 font-bold text-amber-600 whitespace-nowrap">{h >= 24 ? t('ddDaysHours').replace('{d}', Math.floor(h / 24)).replace('{h}', h % 24) : t('ddHours').replace('{h}', h)}</td>
                                        <td className={`py-2 px-2 text-right font-bold tabular-nums ${debt > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{debt > 0 ? fmt(debt) : '—'}</td>
                                    </tr>
                                );
                            })}</tbody>
                        </table>
                    ),
                };
            }
            default: return { title: '', body: null };
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind, data, expired, q, openKey, users, guestsById, todayStr, monthPrefix, t]);

    return createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/50 p-3" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden" role="dialog" aria-modal="true" aria-label={view.title}>
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100">
                    <div className="flex-1 min-w-0">
                        <div className="font-black text-lg text-slate-800">{view.title}</div>
                        {view.sub && <div className="text-xs font-semibold text-slate-400">{view.sub}</div>}
                    </div>
                    {view.search && (
                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('ddSearch')} className="pl-7 pr-2 py-1.5 text-sm border border-slate-200 rounded-lg w-44 focus:outline-none focus:border-indigo-400" />
                        </div>
                    )}
                    <button onClick={onClose} aria-label={t('cancel')} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={18} /></button>
                </div>
                <div className="overflow-y-auto px-5 py-3">{view.body}</div>
            </div>
        </div>,
        document.body,
    );
};

export default DashboardDetailModal;
