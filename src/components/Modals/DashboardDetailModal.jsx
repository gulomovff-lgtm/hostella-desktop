import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, ChevronRight, Search, Users, BedDouble, Wallet, CalendarDays, TrendingUp, AlertCircle, Clock, Inbox } from 'lucide-react';
import { describePayment, purposeText } from '../../utils/cashierTimeline';
import { groupByMethod, byStaff, byDay, expensesByCategory, METHOD_ORDER } from '../../utils/dashboardDetails';
import { chargeOf } from '../../utils/shop';

/**
 * Окно «подробно» у плиток дашборда. kind:
 *   guests | occupancy | incomeToday | debts | overdue | free | incomeMonth | profitMonth
 * Гость в списке открывает карточку (она поверх — z-200, окно — z-150).
 *
 * Окно рисуется в <body> (портал): дашборд живёт внутри прокручиваемой
 * области, и на телефоне (iPhone/Telegram) окно оставалось заперто в ней —
 * нижнее меню ложилось поверх деталей (жалоба владельца 2026-09-26).
 *
 * Цвета — по смыслу, как во всей программе: emerald деньги и свободно, rose долг и
 * расход, amber просрочка, teal занятые места и гости.
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
const HEAD_TONE = {
    teal: 'bg-teal-50 text-teal-600', emerald: 'bg-emerald-50 text-emerald-600', rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600', indigo: 'bg-indigo-50 text-indigo-600',
};
const VALUE_TONE = {
    teal: 'text-teal-600', emerald: 'text-emerald-600', rose: 'text-rose-600', amber: 'text-amber-600', slate: 'text-slate-800', indigo: 'text-indigo-600',
};
const TH = 'sticky top-0 z-[1] bg-white py-2.5 px-3 first:pl-5 last:pr-5 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200 whitespace-nowrap';
const TD = 'py-3 px-3 first:pl-5 last:pr-5 align-middle border-b border-slate-100';

const Empty = ({ text }) => (
    <div className="flex flex-col items-center gap-2 py-14 text-center">
        <span className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center"><Inbox size={22} /></span>
        <span className="text-sm font-semibold text-slate-400">{text}</span>
    </div>
);
const RoomPill = ({ g }) => (
    <span className="inline-flex px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold tabular-nums whitespace-nowrap">
        {g.roomNumber || '—'}{g.bedId ? ` / ${g.bedId}` : ''}
    </span>
);
// На телефоне второстепенные колонки скрыты (WIDE): имя, комната и сумма видны без прокрутки вбок
const WIDE = 'hidden sm:table-cell';
const Table = ({ cols, children }) => (
    <table className="w-full text-sm border-separate border-spacing-0">
        <thead><tr>{cols.map((c, i) => <th key={i} className={`${TH} ${c.r ? 'text-right' : 'text-left'} ${c.wide ? WIDE : ''}`}>{c.l}</th>)}</tr></thead>
        <tbody>{children}</tbody>
    </table>
);
const Row = ({ children }) => <tr className="hover:bg-slate-50 transition-colors">{children}</tr>;
const Toggle = ({ open, onClick, children }) => (
    <button onClick={onClick} aria-expanded={open} className="w-full flex items-center gap-2.5 py-3 px-2 -mx-2 rounded-lg hover:bg-slate-50 text-left transition-colors">
        {open ? <ChevronDown size={15} className="text-slate-400 shrink-0" /> : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
        {children}
    </button>
);

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
        ? <button onClick={() => onOpenGuest(g)} className="font-bold text-slate-800 hover:text-indigo-600 hover:underline text-left transition-colors">{g.fullName || '—'}</button>
        : <span className="font-bold text-slate-800">{g.fullName || '—'}</span>);

    const payRows = (list) => list.map(({ p, amount }) => (
        <div key={p.id + '_' + amount} className="flex gap-3 py-2.5 px-3 border-b border-slate-100 last:border-0 text-[13px]">
            <span className="w-10 shrink-0 text-xs font-bold text-slate-400 tabular-nums pt-0.5">{hm(p.date)}</span>
            <div className="flex-1 min-w-0">
                <div className="text-slate-700 leading-snug">{payText(p)}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{staffName(p.staffId)}{p.method === 'split' ? ` · ${t('scmPartOfMix')}` : ''}{p.transferTo ? ` · ${p.transferTo}` : ''}</div>
            </div>
            <span className="shrink-0 font-black tabular-nums text-emerald-600">+{fmt(amount)}</span>
        </div>
    ));

    const methodBlocks = (payments) => {
        const { groups, totals } = groupByMethod(payments);
        return METHOD_ORDER.filter(k => groups[k].length).map(k => (
            <div key={k} className="mb-3 rounded-xl border border-slate-200 overflow-hidden">
                <div className={`flex items-center justify-between px-3 py-2.5 border-b font-bold text-sm ${METHOD_TONE[k]}`}>
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
                const withDebt = data.activeGuests.filter(g => chargeOf(g) - paidOf(g) > 0).length;
                return {
                    title: t('guestsNow'), Icon: Users, tone: 'teal', search: true, flush: true,
                    stats: [
                        { l: t('ddStatLiving'), v: data.activeGuests.length, c: 'teal' },
                        { l: t('ddStatNewToday'), v: data.arrivalsToday.length, c: 'indigo' },
                        { l: t('ddStatWithDebt'), v: withDebt, c: withDebt ? 'rose' : 'slate' },
                    ],
                    body: list.length === 0 ? <Empty text={t('ddNotFound')} /> : (
                        <Table cols={[{ l: t('ddGuest') }, { l: t('ddRoomBed') }, { l: t('ddStay'), wide: true }, { l: t('debts'), r: true }]}>
                            {list.map(g => {
                                const debt = chargeOf(g) - paidOf(g);
                                return (
                                    <Row key={g.id}>
                                        <td className={TD}>
                                            <GuestName g={g} />
                                            {today.has(g.id) && <span className="ml-1.5 text-[10.5px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 whitespace-nowrap">{t('ddNewToday')}</span>}
                                            {g.country && <div className="text-[11px] text-slate-400 mt-0.5">{g.country}</div>}
                                        </td>
                                        <td className={TD}><RoomPill g={g} /></td>
                                        <td className={`${TD} ${WIDE} text-slate-600 whitespace-nowrap tabular-nums`}>{dmy(g.checkInDate)} → {dmy(g.checkOutDate)} <span className="text-slate-400">· {g.days || '?'} {t('daysShort')}</span></td>
                                        <td className={`${TD} text-right font-bold tabular-nums ${debt > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{debt > 0 ? fmt(debt) : '—'}</td>
                                    </Row>
                                );
                            })}
                        </Table>
                    ),
                };
            }
            case 'occupancy': case 'free': {
                const free = kind === 'free';
                // места — тем же расчётом, что экран «Номера» (utils/roomBeds.js)
                const rooms = [...data.roomOccupancy].sort(roomSort)
                    .map(r => {
                        const bb = r.beds || [];
                        return {
                            r,
                            beds: bb.filter(b => b.status === 'free').map(b => b.id),
                            limited: bb.filter(b => b.status === 'free_limited'),
                            booked: bb.filter(b => b.status === 'booking'),
                            people: bb.filter(b => b.status === 'occupied' || b.status === 'timeout').map(b => ({ ...b.guest, bedId: b.id, timeout: b.isTimeout })),
                        };
                    })
                    .filter(x => !free || x.beds.length > 0 || x.limited.length > 0);
                return {
                    title: free ? t('freeBedsLabel') : t('occupancy'), Icon: BedDouble, tone: free ? 'emerald' : 'teal',
                    stats: [
                        { l: t('ddStatBusy'), v: `${data.occupiedBeds} / ${data.totalBeds}`, c: 'teal' },
                        { l: t('freeBedsLabel'), v: data.freeBeds, c: 'emerald' },
                        { l: t('occupancy'), v: `${data.occupancyRaw}%`, c: 'slate' },
                    ],
                    note: free && data.bookedToday ? t('ddBookedToday').replace('{n}', data.bookedToday) : null,
                    body: rooms.length === 0 ? <Empty text={t('ddNotFound')} /> : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {rooms.map(({ r, beds, limited, booked, people }) => (
                                <div key={r.id} className="border border-slate-200 rounded-xl p-3.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-black text-slate-800">{t('ddRoom').replace('{n}', r.number || '—')}</span>
                                        <span className={`text-[10.5px] font-black px-2 py-0.5 rounded-full tabular-nums ${r.rented ? 'bg-purple-50 text-purple-600' : r.pct >= 100 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                                            {r.rented ? t('ddRented') : `${r.occupied}/${parseInt(r.capacity) || 0}`}
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden"><div className={`h-full rounded-full ${r.pct >= 100 ? 'bg-rose-400' : 'bg-teal-400'}`} style={{ width: `${Math.min(100, r.pct)}%` }} /></div>
                                    {r.rented && <div className="text-xs text-purple-600 mt-2">{r.rental?.tenantName || ''}{r.rental?.endDate ? ` · ${t('ptUntil').replace('{date}', dmy(r.rental.endDate))}` : ''}</div>}
                                    {beds.length > 0 && <div className="text-xs font-bold mt-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700">{t('ddFreeBeds').replace('{list}', beds.join(', '))}</div>}
                                    {limited.map(b => (
                                        <div key={'l' + b.id} className="text-xs mt-1.5 px-2.5 py-1.5 rounded-lg bg-sky-50 text-sky-700">{t('ddFreeUntilBooking').replace('{bed}', b.id).replace('{n}', b.freeForDays).replace('{name}', b.guest?.fullName || '—').replace('{date}', dmy(b.guest?.checkInDate))}</div>
                                    ))}
                                    {booked.map(b => (
                                        <div key={'b' + b.id} className="text-xs mt-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-700">{t('ddBookedBed').replace('{bed}', b.id)} <GuestName g={b.guest || {}} /></div>
                                    ))}
                                    {!free && people.length > 0 && (
                                        <div className="mt-2 flex flex-col gap-1.5">
                                            {people.map(g => (
                                                <div key={g.id} className="flex items-baseline gap-1.5 text-xs">
                                                    <span className="w-4 shrink-0 text-right font-bold text-slate-400 tabular-nums">{String(g.bedId).startsWith('extra') ? '+' : g.bedId}</span>
                                                    <span className="flex-1 min-w-0 truncate"><GuestName g={g} /></span>
                                                    <span className={`shrink-0 tabular-nums ${g.timeout ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>{t('ptUntil').replace('{date}', dmy(g.checkOutDate))}</span>
                                                </div>
                                            ))}
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
                const net = data.incomeToday - expTotal;
                return {
                    title: t('incomeToday'), Icon: Wallet, tone: 'emerald',
                    stats: [
                        { l: t('incomeWord'), v: fmt(data.incomeToday), c: 'emerald' },
                        { l: t('expense'), v: expTotal ? `−${fmt(expTotal)}` : '0', c: expTotal ? 'rose' : 'slate' },
                        { l: t('ddStatNet'), v: fmt(net), c: net >= 0 ? 'teal' : 'rose' },
                    ],
                    body: (
                        <>
                            {pays.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {byStaff(pays).map(s => (
                                        <span key={s.staffId} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">{staffName(s.staffId)}: <span className="tabular-nums">{fmt(s.total)}</span> <span className="font-semibold text-slate-400">· {s.count}</span></span>
                                    ))}
                                </div>
                            )}
                            {pays.length === 0 && exps.length === 0 && <Empty text={t('ddNoPayments')} />}
                            {methodBlocks(pays)}
                            {exps.length > 0 && (
                                <div className="mb-3 rounded-xl border border-slate-200 overflow-hidden">
                                    <div className="flex items-center justify-between px-3 py-2.5 border-b font-bold text-sm bg-rose-50 border-rose-100 text-rose-700">
                                        <span>{t('scmExpensesTitle')} <span className="font-semibold opacity-70">· {exps.length}</span></span><span className="tabular-nums">−{fmt(expTotal)}</span>
                                    </div>
                                    {[...exps].sort((a, b) => String(a.date).localeCompare(String(b.date))).map(e => (
                                        <div key={e.id} className="flex gap-3 py-2.5 px-3 border-b border-slate-100 last:border-0 text-[13px]">
                                            <span className="w-10 shrink-0 text-xs font-bold text-slate-400 tabular-nums pt-0.5">{hm(e.date)}</span>
                                            <div className="flex-1 min-w-0"><div className="text-slate-700">{e.category || '—'}{e.comment ? `: ${e.comment}` : ''}</div><div className="text-[11px] text-slate-400 mt-0.5">{staffName(e.staffId)}</div></div>
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
                const best = Math.max(1, ...days.map(d => d.total));
                return {
                    title: t('ddIncomeMonth'), Icon: CalendarDays, tone: 'emerald',
                    stats: [
                        { l: t('incomeWord'), v: fmt(data.incomeThisMonth), c: 'emerald' },
                        { l: t('ddStatPayments'), v: pays.length, c: 'slate' },
                        { l: t('ddMonthDays'), v: days.length, c: 'slate' },
                    ],
                    body: days.length === 0 ? <Empty text={t('ddNoPayments')} /> : (
                        <>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {(() => { const { totals } = groupByMethod(pays); return METHOD_ORDER.filter(k => totals[k]).map(k => (
                                    <span key={k} className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${METHOD_TONE[k]}`}>{t(METHOD_LABEL[k])}: <span className="tabular-nums">{fmt(totals[k])}</span></span>)); })()}
                            </div>
                            {days.map(d => (
                                <div key={d.ds} className="border-b border-slate-100 last:border-0">
                                    <Toggle open={openKey === d.ds} onClick={() => setOpenKey(openKey === d.ds ? null : d.ds)}>
                                        <span className="font-black text-slate-700 w-12 shrink-0 tabular-nums">{d.ds.slice(8, 10)}.{d.ds.slice(5, 7)}</span>
                                        <span className="flex-1 min-w-0">
                                            <span className="block h-1.5 bg-slate-100 rounded-full overflow-hidden"><span className="block h-full rounded-full bg-emerald-400" style={{ width: `${(d.total / best) * 100}%` }} /></span>
                                            <span className="block text-[11px] text-slate-400 truncate mt-1">{[['cash', d.cash], ['card', d.card], ['qr', d.qr], ['transferMethod', d.transfer]].filter(([, v]) => v).map(([k, v]) => `${t(k)} ${fmt(v)}`).join(' · ')}</span>
                                        </span>
                                        <span className="font-black tabular-nums text-emerald-600 shrink-0">{fmt(d.total)}</span>
                                    </Toggle>
                                    {openKey === d.ds && <div className="pb-2 pt-1">{methodBlocks(d.payments)}</div>}
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
                const biggest = Math.max(1, ...cats.map(c => c.total));
                return {
                    title: t('monthProfit'), Icon: TrendingUp, tone: net >= 0 ? 'teal' : 'rose',
                    stats: [
                        { l: t('incomeWord'), v: fmt(data.incomeThisMonth), c: 'emerald' },
                        { l: t('expense'), v: `−${fmt(data.expenseThisMonth)}`, c: 'rose' },
                        { l: t('monthProfit'), v: fmt(net), c: net >= 0 ? 'teal' : 'rose' },
                    ],
                    body: (
                        <>
                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">{t('ddExpensesByCat')}</div>
                            {cats.length === 0 && <Empty text={t('ddNoExpenses')} />}
                            {cats.map(c => (
                                <div key={c.category} className="border-b border-slate-100 last:border-0">
                                    <Toggle open={openKey === c.category} onClick={() => setOpenKey(openKey === c.category ? null : c.category)}>
                                        <span className="flex-1 min-w-0">
                                            <span className="block font-bold text-slate-700 truncate">{c.category} <span className="text-slate-400 font-semibold">· {c.items.length}</span></span>
                                            <span className="block h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5"><span className="block h-full rounded-full bg-rose-300" style={{ width: `${(c.total / biggest) * 100}%` }} /></span>
                                        </span>
                                        <span className="font-black tabular-nums text-rose-600 shrink-0">−{fmt(c.total)}</span>
                                    </Toggle>
                                    {openKey === c.category && (
                                        <div className="pb-2">
                                            {c.items.map(e => (
                                                <div key={e.id} className="flex gap-3 py-1.5 pl-7 pr-1 text-[13px]">
                                                    <span className="w-11 shrink-0 text-xs text-slate-400 tabular-nums pt-0.5">{dmy(e.date)}</span>
                                                    <span className="flex-1 min-w-0 text-slate-600">{e.comment || '—'} <span className="text-[11px] text-slate-400">· {staffName(e.staffId)}</span></span>
                                                    <span className="shrink-0 tabular-nums text-rose-600 font-bold">−{fmt(e.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    ),
                };
            }
            case 'debts': {
                const list = data.debtors.filter(match);
                return {
                    title: t('debts'), Icon: AlertCircle, tone: 'rose', search: true, flush: true,
                    stats: [
                        { l: t('ddStatDebtSum'), v: fmt(data.totalDebt), c: 'rose' },
                        { l: t('ddStatDebtors'), v: data.debtors.length, c: 'slate' },
                    ],
                    body: list.length === 0 ? <Empty text={t('ddNotFound')} /> : (
                        <Table cols={[{ l: t('ddGuest') }, { l: t('ddRoomBed') }, { l: t('ddStatus'), wide: true }, { l: t('ddCharged'), r: true, wide: true }, { l: t('ddPaid'), r: true, wide: true }, { l: t('debts'), r: true }]}>
                            {list.map(g => (
                                <Row key={g.id}>
                                    <td className={TD}><GuestName g={g} /></td>
                                    <td className={TD}><RoomPill g={g} /></td>
                                    <td className={`${TD} ${WIDE} whitespace-nowrap`}>
                                        {g.isRental
                                            ? <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">{t('ddRented')}</span>
                                            : g.status === 'active'
                                                ? <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-teal-50 text-teal-600">{t('ddLiving')}</span>
                                                : <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 tabular-nums">{t('ddLeft')} {dmy(g.checkOutDate)}</span>}
                                    </td>
                                    <td className={`${TD} ${WIDE} text-right tabular-nums text-slate-500`}>{fmt(g.isRental ? g.totalPrice : chargeOf(g))}</td>
                                    <td className={`${TD} ${WIDE} text-right tabular-nums text-slate-500`}>{g.isRental ? fmt((g.totalPrice || 0) - g.debt) : fmt(paidOf(g))}</td>
                                    <td className={`${TD} text-right tabular-nums font-black text-rose-600`}>{fmt(g.debt)}</td>
                                </Row>
                            ))}
                        </Table>
                    ),
                };
            }
            case 'overdue': {
                const nowMs = Date.now();
                const list = [...expired].filter(match).sort((a, b) => new Date(a.checkOutDate) - new Date(b.checkOutDate));
                const debtSum = expired.reduce((s, g) => s + Math.max(0, chargeOf(g) - paidOf(g)), 0);
                return {
                    title: t('overdueCount'), Icon: Clock, tone: 'amber', search: expired.length > 0, flush: list.length > 0,
                    stats: [
                        { l: t('ddStatOverdue'), v: expired.length, c: expired.length ? 'amber' : 'slate' },
                        { l: t('ddStatDebtSum'), v: fmt(debtSum), c: debtSum ? 'rose' : 'slate' },
                    ],
                    body: list.length === 0 ? <Empty text={expired.length ? t('ddNotFound') : t('ddNoOverdue')} /> : (
                        <Table cols={[{ l: t('ddGuest') }, { l: t('ddRoomBed') }, { l: t('ddCheckoutWas'), wide: true }, { l: t('ddOverdueBy') }, { l: t('debts'), r: true, wide: true }]}>
                            {list.map(g => {
                                const h = Math.max(0, Math.floor((nowMs - new Date(g.checkOutDate).getTime()) / 3600000));
                                const debt = chargeOf(g) - paidOf(g);
                                return (
                                    <Row key={g.id}>
                                        <td className={TD}><GuestName g={g} /></td>
                                        <td className={TD}><RoomPill g={g} /></td>
                                        <td className={`${TD} ${WIDE} text-slate-600 whitespace-nowrap tabular-nums`}>{dmy(g.checkOutDate)} {hm(g.checkOutDate)}</td>
                                        <td className={`${TD} whitespace-nowrap`}><span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">{h >= 24 ? t('ddDaysHours').replace('{d}', Math.floor(h / 24)).replace('{h}', h % 24) : t('ddHours').replace('{h}', h)}</span></td>
                                        <td className={`${TD} ${WIDE} text-right font-bold tabular-nums ${debt > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{debt > 0 ? fmt(debt) : '—'}</td>
                                    </Row>
                                );
                            })}
                        </Table>
                    ),
                };
            }
            default: return { title: '', body: null };
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind, data, expired, q, openKey, users, guestsById, todayStr, monthPrefix, t]);

    const HeadIcon = view.Icon;
    const statCols = view.stats?.length === 2 ? 'grid-cols-2' : 'grid-cols-3';

    return createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-3" style={{ background: 'rgba(8,18,20,0.55)' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="dd-pop bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden" role="dialog" aria-modal="true" aria-label={view.title}>
                <div className="shrink-0 px-5 pt-4 pb-3.5 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        {HeadIcon && <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${HEAD_TONE[view.tone]}`}><HeadIcon size={20} /></span>}
                        <div className="flex-1 min-w-0 font-black text-lg text-slate-800 truncate">{view.title}</div>
                        <button onClick={onClose} aria-label={t('cancel')} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0 transition-colors"><X size={18} /></button>
                    </div>
                    {view.stats && (
                        <div className={`grid ${statCols} gap-2 mt-3`}>
                            {view.stats.map(s => (
                                <div key={s.l} className="min-w-0 rounded-xl bg-slate-50 border border-slate-100 px-2.5 sm:px-3 py-2">
                                    <div className="text-[9px] sm:text-[10px] leading-tight font-black uppercase tracking-wide sm:tracking-wider text-slate-400">{s.l}</div>
                                    <div className={`mt-0.5 text-[13px] sm:text-lg font-black tabular-nums whitespace-nowrap ${VALUE_TONE[s.c]}`}>{s.v}</div>
                                </div>
                            ))}
                        </div>
                    )}
                    {view.note && <div className="text-xs font-semibold text-indigo-600 mt-2">{view.note}</div>}
                    {view.search && (
                        <div className="relative mt-3">
                            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('ddSearch')} className="w-full pl-9 pr-9 py-2 text-sm bg-white text-slate-700 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400" />
                            {q && <button onClick={() => setQ('')} aria-label={t('cancel')} className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:bg-slate-100"><X size={14} /></button>}
                        </div>
                    )}
                </div>
                <div className={`flex-1 min-h-0 overflow-auto ${view.flush ? 'pb-1' : 'px-5 py-3.5'}`}>{view.body}</div>
            </div>
        </div>,
        document.body,
    );
};

export default DashboardDetailModal;
