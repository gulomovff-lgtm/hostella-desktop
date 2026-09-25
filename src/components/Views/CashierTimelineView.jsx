import React, { useState, useMemo, useEffect } from 'react';
import { Activity, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../../firebase';
import TRANSLATIONS from '../../constants/translations';
import { ACTION_META } from '../../utils/auditActions';
import { hiddenFromAdmin } from '../../utils/auditScope';
import {
    buildTimeline, summarizeTimeline, describePayment, purposeText, paymentMethods, staffKeysOf, dayRange,
} from '../../utils/cashierTimeline';
import { stableView } from '../UI/stableView';

/**
 * Лента кассира — все действия по времени за день (или за смену):
 * заселения, продления «на сколько суток», оплаты «за что», расходы, смены, входы.
 * Источники: журнал действий (auditLog), касса (payments), расходы, смены.
 * Сборка — utils/cashierTimeline.js.
 */

const pad2 = (n) => String(n).padStart(2, '0');
const ymdOf = (d) => { const x = new Date(d); return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`; };
const hm = (ms) => { const d = new Date(ms); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const dm = (iso) => { const d = new Date(iso || 0); return Number.isFinite(d.getTime()) && d.getTime() ? `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}` : ''; };
const fmt = (n) => (Number(n) || 0).toLocaleString('ru-RU');

const GUEST_ACTIONS = new Set(['checkin', 'booking_add', 'booking_activate', 'checkout', 'auto_checkout', 'extend', 'extend_bulk', 'move', 'trim_days', 'reduce_days', 'price_change', 'undo', 'kpp_confirm', 'kpp_reset']);
const SESSION_ACTIONS = new Set(['login', 'logout', 'force_logout', 'shift_start', 'shift_end', 'shift_transfer', 'shift_split', 'shift_unsplit', 'auto_shift_start']);

const METHOD_KEYS = { cash: 'cash', card: 'card', qr: 'qr', transfer: 'transferMethod', balance: 'ctlBalanceMethod' };

const CashierTimelineView = ({ auditLog = [], payments = [], expenses = [], shifts = [], users = [], guests = [], currentUser, lang = 'ru', preset = null, onClearPreset, onOpenGuest }) => {
    const t = k => TRANSLATIONS[lang]?.[k] || k;
    const [day, setDay] = useState(() => ymdOf(Date.now()));
    const [staffKey, setStaffKey] = useState('');
    const [show, setShow] = useState('all');
    const [olderAudit, setOlderAudit] = useState(null); // { key, rows } — журнал за день старше загруженного
    const [loadingOld, setLoadingOld] = useState(false);

    // Переход из «Смен»: кассир и границы смены
    useEffect(() => {
        if (!preset) return;
        if (preset.staffKey) setStaffKey(preset.staffKey);
        if (preset.from) setDay(ymdOf(preset.from));
    }, [preset]);

    const range = useMemo(() => {
        if (preset?.from) return { from: new Date(preset.from).getTime(), to: preset.to ? new Date(preset.to).getTime() : Date.now() + 60000 };
        return dayRange(day);
    }, [preset, day]);

    // Загруженный журнал — последние 5000 записей. Если выбран день старше —
    // дочитываем журнал именно за этот день (один запрос).
    const oldestLoaded = useMemo(() => {
        const last = auditLog[auditLog.length - 1]?.timestamp;
        return last ? new Date(last).getTime() : 0;
    }, [auditLog]);
    const needOlder = auditLog.length >= 5000 && oldestLoaded > range.from;
    const olderKey = needOlder ? `${range.from}_${range.to}` : '';
    useEffect(() => {
        if (!olderKey || olderAudit?.key === olderKey) return;
        let alive = true;
        setLoadingOld(true);
        const q = query(collection(db, ...PUBLIC_DATA_PATH, 'auditLog'),
            where('timestamp', '>=', new Date(range.from).toISOString()),
            where('timestamp', '<', new Date(range.to).toISOString()),
            orderBy('timestamp', 'asc'));
        getDocs(q).then(snap => {
            if (!alive) return;
            const rows = snap.docs.map(d => ({ id: d.id, ...d.data(), _col: 'auditLog' }))
                .filter(e => currentUser?.role === 'super' || !hiddenFromAdmin(e));
            setOlderAudit({ key: olderKey, rows });
        }).catch(() => { if (alive) setOlderAudit({ key: olderKey, rows: [] }); })
          .finally(() => { if (alive) setLoadingOld(false); });
        return () => { alive = false; };
    }, [olderKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const auditSource = useMemo(() => {
        if (!needOlder || olderAudit?.key !== olderKey) return auditLog;
        const seen = new Set(auditLog.map(e => e.id));
        return [...auditLog, ...olderAudit.rows.filter(e => !seen.has(e.id))];
    }, [auditLog, needOlder, olderAudit, olderKey]);

    // Сотрудники в списке (супера админу не показываем — как и в «Истории»)
    const staffOptions = useMemo(() => {
        const list = users.filter(u => u && (currentUser?.role === 'super' || u.role !== 'super'));
        return list.map(u => ({ key: String(u.id || u.login), name: u.name || u.login || '—', user: u }))
            .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [users, currentUser?.role]);
    const selectedUser = staffOptions.find(o => o.key === staffKey)?.user || null;
    const keys = useMemo(() => (selectedUser ? staffKeysOf(selectedUser) : null), [selectedUser]);

    const guestsById = useMemo(() => new Map(guests.map(g => [g.id, g])), [guests]);
    const nameOf = useMemo(() => {
        const m = new Map();
        for (const u of users) { if (u.id) m.set(String(u.id), u.name || u.login); if (u.login) m.set(String(u.login), u.name || u.login); }
        return (k) => m.get(String(k)) || '';
    }, [users]);

    const events = useMemo(() => buildTimeline({
        audit: auditSource, payments, expenses, shifts, keys, from: range.from, to: range.to, guestsById,
    }), [auditSource, payments, expenses, shifts, keys, range, guestsById]);
    const summary = useMemo(() => summarizeTimeline(events), [events]);

    const visible = useMemo(() => events.filter(e => {
        if (show === 'money') return e.moneyIn || e.moneyOut || e.payments.length;
        if (show === 'guests') return GUEST_ACTIONS.has(e.action) || e.action === 'payment' || e.action === 'debt_pay' || e.action === 'payment_row';
        if (show === 'sessions') return SESSION_ACTIONS.has(e.action);
        return true;
    }), [events, show]);

    const shiftDay = (delta) => { const d = new Date(dayRange(day).from); d.setDate(d.getDate() + delta); setDay(ymdOf(d)); onClearPreset?.(); };
    const isToday = day === ymdOf(Date.now());

    const guestLink = (id, name) => {
        const g = id ? guestsById.get(id) : null;
        if (!name) return null;
        return g && onOpenGuest
            ? <button onClick={() => onOpenGuest(g)} className="font-bold text-indigo-600 hover:underline">{name}</button>
            : <span className="font-bold text-slate-700">{name}</span>;
    };

    // Описание события — «что сделал» человеческим языком
    const describe = (e) => {
        const d = e.entry?.details || {};
        const room = d.roomNumber ? t('ptRoom').replace('{n}', d.roomNumber) + (d.bedId ? `, ${t('alBedShort').replace('{n}', d.bedId).toLowerCase()}` : '') : '';
        switch (e.action) {
            case 'checkin': case 'booking_add': case 'booking_activate':
                return <>{guestLink(d.guestId, d.guestName)}{room && ` · ${room}`}{d.days ? ` · ${t('ptDays').replace('{n}', d.days)}` : ''}{d.checkOutDate ? ` ${t('ptUntil').replace('{date}', dm(d.checkOutDate))}` : ''}{d.totalPrice ? ` · ${t('ctlBill').replace('{sum}', fmt(d.totalPrice))}` : ''}</>;
            case 'extend':
                return <>{guestLink(d.guestId, d.guestName)}{room && ` · ${room}`} · <b className="text-indigo-700">{t('ptPlusDays').replace('{n}', d.days || '?')}</b>{d.toDate ? ` ${t('ptUntil').replace('{date}', dm(d.toDate))}` : ''}{d.fromDate ? ` (${t('ctlWas').replace('{date}', dm(d.fromDate))})` : ''}{d.addedPrice ? ` · ${t('ctlAddedToBill').replace('{sum}', fmt(d.addedPrice))}` : ''}</>;
            case 'extend_bulk':
                return <><b className="text-indigo-700">{t('ptPlusDays').replace('{n}', d.days || '?')}</b> × {d.count || 0}{d.guestNames ? ` · ${d.guestNames}` : ''}</>;
            case 'checkout': case 'auto_checkout':
                return <>{guestLink(d.guestId, d.guestName)}{room && ` · ${room}`}{Number(d.refund) > 0 ? ` · ${t('ctlRefundSum').replace('{sum}', fmt(d.refund))}` : ''}{Number(d.balanceTopUp) > 0 ? ` · ${t('ctlToBalance').replace('{sum}', fmt(d.balanceTopUp))}` : ''}</>;
            case 'move':
                return <>{guestLink(d.guestId, d.guestName)} · {t('ptRoom').replace('{n}', d.fromRoom || '—')} → {t('ptRoom').replace('{n}', d.toRoom || '—')}{d.toBed ? `, ${t('alBedShort').replace('{n}', d.toBed).toLowerCase()}` : ''}</>;
            case 'payment': case 'debt_pay':
                return <>{guestLink(d.guestId, d.guestName)}{d.guestNames && d.guestNames !== d.guestName ? ` · ${d.guestNames}` : ''}{room && ` · ${room}`}</>;
            case 'shop_sale':
                return <>{d.items || ''} · {fmt(d.total)} · {d.mode === 'account' ? t('ctlAccount') : t('ctlPaidNow')}{d.guestId ? <> · {guestLink(d.guestId, guestsById.get(d.guestId)?.fullName)}</> : null}</>;
            case 'shop_cancel':
                return <>{fmt(d.total)}</>;
            case 'shift_start':
                return <>{e.shift?.hostelId ? t(e.shift.hostelId === 'hostel1' ? 'alHostel1' : 'alHostel2') : ''}</>;
            case 'shift_end': {
                const h = e.shift?.endTime ? (new Date(e.shift.endTime) - new Date(e.shift.startTime)) / 3600000 : 0;
                return <>{h ? t('ctlHours').replace('{n}', h.toFixed(1)) : ''}</>;
            }
            case 'expense': case 'refund':
                return <>{e.expense?.category || ''}{e.expense?.comment ? `: ${e.expense.comment}` : ''}</>;
            case 'payment_row': case 'cash_to_terminal': {
                const p = e.payments[0];
                const g = guestsById.get(p?.guestId) || null;
                const desc = describePayment(p, g);
                return <>{purposeText({ ...desc, guestName: '' }, t, { withGuest: false })}{desc.guestName ? <> · {guestLink(p.guestId, desc.guestName)}</> : null}{desc.room ? ` · ${t('ptRoom').replace('{n}', desc.room)}` : ''}</>;
            }
            case 'login': case 'logout': case 'force_logout':
                return <>{d.selectedHostel ? t(d.selectedHostel === 'hostel1' ? 'alHostel1' : 'alHostel2') : ''}</>;
            default: {
                const bits = [d.guestName || d.fullName, d.comment, d.label, d.tenantName, d.code]
                    .filter(v => typeof v === 'string' && v).slice(0, 3);
                return <>{bits.join(' · ')}</>;
            }
        }
    };

    const titleOf = (e) => {
        if (e.action === 'shift_start') return { icon: '🟢', label: t('ctlShiftStart') };
        if (e.action === 'shift_end') return { icon: '🔴', label: t('ctlShiftEnd') };
        if (e.action === 'expense') return { icon: '💳', label: t('ctlExpense') };
        if (e.action === 'refund') return { icon: '↩️', label: t('ctlRefund') };
        if (e.action === 'cash_to_terminal') return { icon: '🏦', label: t('ctlCtt') };
        if (e.action === 'payment_row') return { icon: '💵', label: t('ctlPaymentRow') };
        const m = ACTION_META[e.action];
        return { icon: m?.icon || '📝', label: m?.label ? t(m.label) : e.action };
    };

    const moneyChips = (p) => {
        const m = paymentMethods(p);
        return Object.entries(m).filter(([, v]) => v > 0).map(([k, v]) => `${fmt(v)} ${t(METHOD_KEYS[k])}`.trim()).join(' + ');
    };

    const INP = 'px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-700';
    const cards = [
        { label: t('ctlSumCheckins'), val: summary.checkins },
        { label: t('ctlSumExtends'), val: summary.extends, sub: summary.extendDays ? t('ptPlusDays').replace('{n}', summary.extendDays) : '' },
        { label: t('ctlSumCheckouts'), val: summary.checkouts },
        { label: t('ctlSumIn'), val: fmt(summary.moneyIn), sub: Object.entries(summary.byMethod).filter(([, v]) => v > 0).map(([k, v]) => `${t(METHOD_KEYS[k])} ${fmt(v)}`).join(' · '), tone: 'text-emerald-600' },
        { label: t('ctlSumOut'), val: summary.moneyOut ? `−${fmt(summary.moneyOut)}` : '0', tone: summary.moneyOut ? 'text-rose-600' : '' },
    ];

    return (
        <div className="space-y-4 animate-in fade-in">
            <div>
                <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Activity size={20} className="text-indigo-500" /> {t('ctlTitle')}</h1>
                <p className="text-sm text-slate-500 mt-0.5">{t('ctlSubtitle')}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-sm flex flex-wrap items-center gap-2">
                <select value={staffKey} onChange={e => setStaffKey(e.target.value)} className={INP + ' min-w-[180px]'}>
                    <option value="">{t('ctlAllCashiers')}</option>
                    {staffOptions.map(o => <option key={o.key} value={o.key}>{o.name}</option>)}
                </select>
                {preset?.from ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-bold">
                        {t('ctlShiftChip').replace('{date}', dm(preset.from)).replace('{from}', hm(new Date(preset.from).getTime())).replace('{to}', preset.to ? hm(new Date(preset.to).getTime()) : '…')}
                        <button onClick={() => onClearPreset?.()} className="p-0.5 rounded hover:bg-indigo-100"><X size={14} /></button>
                    </span>
                ) : (
                    <div className="flex items-center gap-1">
                        <button onClick={() => shiftDay(-1)} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"><ChevronLeft size={16} /></button>
                        <input type="date" value={day} onChange={e => e.target.value && setDay(e.target.value)} className={INP} />
                        <button onClick={() => shiftDay(1)} disabled={isToday} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30"><ChevronRight size={16} /></button>
                        {!isToday && <button onClick={() => setDay(ymdOf(Date.now()))} className="px-3 py-2 rounded-xl text-sm font-bold text-indigo-600 hover:bg-indigo-50">{t('ctlToday')}</button>}
                    </div>
                )}
                <div className="flex items-center gap-1 ml-auto bg-slate-100 rounded-xl p-1">
                    {[['all', 'ctlShowAll'], ['money', 'ctlShowMoney'], ['guests', 'ctlShowGuests'], ['sessions', 'ctlShowSessions']].map(([k, lbl]) => (
                        <button key={k} onClick={() => setShow(k)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold ${show === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t(lbl)}</button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {cards.map(c => (
                    <div key={c.label} className="bg-white border border-slate-200 rounded-2xl px-3 py-2.5 shadow-sm">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{c.label}</div>
                        <div className={`text-lg font-black ${c.tone || 'text-slate-800'}`}>{c.val}</div>
                        {c.sub && <div className="text-[11px] text-slate-500 leading-tight">{c.sub}</div>}
                    </div>
                ))}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                {loadingOld && <div className="px-4 py-2 text-xs text-slate-400 border-b border-slate-100">{t('ctlLoadingOld')}</div>}
                {visible.length === 0 ? (
                    <div className="py-14 text-center text-slate-400 text-sm">{t('ctlEmpty')}</div>
                ) : (
                    <ol className="relative py-2">
                        {visible.map((e, i) => {
                            const { icon, label } = titleOf(e);
                            const who = !keys ? (e.staffName || nameOf(e.staffId)) : '';
                            const money = e.moneyIn ? `+${fmt(e.moneyIn)}` : e.moneyOut ? `−${fmt(e.moneyOut)}` : '';
                            return (
                                <li key={e.id} className="flex gap-3 px-4 py-2.5 hover:bg-slate-50/70">
                                    <div className="w-11 shrink-0 text-right text-xs font-mono font-bold text-slate-500 pt-1.5">{hm(e.at)}</div>
                                    <div className="relative flex flex-col items-center shrink-0">
                                        <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-sm select-none z-10">{icon}</div>
                                        {i < visible.length - 1 && <div className="flex-1 w-px bg-slate-200 -mb-2.5" />}
                                    </div>
                                    <div className="flex-1 min-w-0 pt-0.5">
                                        <div className="flex items-baseline gap-2 flex-wrap">
                                            <span className="text-sm font-black text-slate-800">{label}</span>
                                            {who && <span className="text-[11px] font-semibold text-slate-400">{who}</span>}
                                            {money && <span className={`ml-auto text-sm font-black tabular-nums ${e.moneyIn ? 'text-emerald-600' : 'text-rose-600'}`}>{money}</span>}
                                        </div>
                                        <div className="text-[13px] text-slate-600 leading-snug">{describe(e)}</div>
                                        {e.source === 'audit' && e.payments.length > 0 && (
                                            <div className="mt-1 flex flex-col gap-0.5">
                                                {e.payments.map(p => (
                                                    <div key={p.id} className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-0.5 w-fit">
                                                        💵 {moneyChips(p)} · {purposeText(describePayment(p, guestsById.get(p.guestId)), t, { withGuest: false })}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {e.source === 'payment' && e.payments[0] && (
                                            <div className="text-[11px] text-slate-400">{moneyChips(e.payments[0])}</div>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </div>
        </div>
    );
};

export default stableView(CashierTimelineView);
