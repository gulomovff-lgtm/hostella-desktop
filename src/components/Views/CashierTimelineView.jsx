import React, { useState, useMemo, useEffect } from 'react';
import { Activity } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { openShiftTimeline, summarizeTimeline } from '../../utils/cashierTimeline';
import { stableView } from '../UI/stableView';
import TimelineList, { hm, dm, fmt, GUEST_ACTIONS, SESSION_ACTIONS, METHOD_KEYS } from '../UI/TimelineList';

/**
 * Лента кассира — все действия по времени за ТЕКУЩУЮ открытую смену
 * (владелец: прошлые смены здесь не показывать, только незакрытые):
 * заселения, продления «на сколько суток», оплаты «за что», расходы, смены, входы.
 * Источники: журнал действий (auditLog), касса (payments), расходы, смены.
 * Сборка — utils/cashierTimeline.js.
 */

const CashierTimelineView = ({ auditLog = [], payments = [], expenses = [], shifts = [], users = [], guests = [], lang = 'ru', preset = null, onOpenGuest }) => {
    const t = k => TRANSLATIONS[lang]?.[k] || k;
    const [staffKey, setStaffKey] = useState('');
    const [show, setShow] = useState('all');

    // Переход из «Смен» (кнопка у открытой смены): сразу этот кассир
    useEffect(() => { if (preset?.staffKey) setStaffKey(preset.staffKey); }, [preset]);

    const guestsById = useMemo(() => new Map(guests.map(g => [g.id, g])), [guests]);
    const nameOf = useMemo(() => {
        const m = new Map();
        for (const u of users) { if (u.id) m.set(String(u.id), u.name || u.login); if (u.login) m.set(String(u.login), u.name || u.login); }
        return (k) => m.get(String(k)) || '';
    }, [users]);

    // Кассиры с открытой сменой — для выбора
    const openAll = useMemo(() => shifts.filter(s => s && !s.endTime && s.startTime), [shifts]);
    const staffOptions = useMemo(() => {
        const m = new Map();
        for (const s of openAll) {
            const k = String(s.staffId || s.staffLogin || '');
            if (k && !m.has(k)) m.set(k, { key: k, name: s.staffName || nameOf(k) || k, since: s.startTime });
        }
        return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }, [openAll, nameOf]);
    const effKey = staffOptions.some(o => o.key === staffKey) ? staffKey : '';

    const { events, open } = useMemo(() => openShiftTimeline({
        audit: auditLog, payments, expenses, shifts: openAll, users, staffKey: effKey, guestsById,
    }), [auditLog, payments, expenses, openAll, users, effKey, guestsById]);
    const summary = useMemo(() => summarizeTimeline(events), [events]);

    const visible = useMemo(() => events.filter(e => {
        if (show === 'money') return e.moneyIn || e.moneyOut || e.payments.length;
        if (show === 'guests') return GUEST_ACTIONS.has(e.action) || e.action === 'payment' || e.action === 'debt_pay' || e.action === 'payment_row';
        if (show === 'sessions') return SESSION_ACTIONS.has(e.action);
        return true;
    }), [events, show]);

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
                <select value={effKey} onChange={e => setStaffKey(e.target.value)} className={INP + ' min-w-[180px]'}>
                    <option value="">{t('ctlAllOpenShifts')}</option>
                    {staffOptions.map(o => <option key={o.key} value={o.key}>{o.name}</option>)}
                </select>
                {open.length > 0 && (
                    <span className="text-xs font-semibold text-slate-500">
                        {open.map(o => t('ctlShiftSince').replace('{name}', o.staffName || nameOf(o.staffId) || '—').replace('{from}', hm(new Date(o.startTime).getTime())).replace('{date}', dm(o.startTime))).join(' · ')}
                    </span>
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
                {visible.length === 0 ? (
                    <div className="py-14 text-center text-slate-400 text-sm">{open.length ? t('ctlEmpty') : t('ctlNoOpenShift')}</div>
                ) : (
                    <TimelineList events={visible} guestsById={guestsById} t={t} showWho={!effKey} nameOf={nameOf} onOpenGuest={onOpenGuest} />
                )}
            </div>
        </div>
    );
};

export default stableView(CashierTimelineView);
