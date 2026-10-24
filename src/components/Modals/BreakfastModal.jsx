import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Coffee, CheckCircle2, AlertTriangle } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../../firebase';
import { getConfig } from '../../utils/appConfig';
import { breakfastGuests, breakfastWriteOff, recipeOf, ymd, addDays } from '../../utils/stayPlans';

/**
 * Окно «Завтраки»: кому готовить сегодня и завтра (гости тарифа «с
 * завтраком», ночевавшие накануне), и отметка «выданы» — списание продуктов
 * со склада по рецепту из Настройки → Цены. Это списание, а не продажа:
 * выручки нет, остаток уменьшается, себестоимость пишется в отметку дня
 * (breakfasts/{филиал}_{дата}). Повторная отметка за тот же день — поправка
 * на разницу, а не второе списание.
 *
 * Портал в <body>: дашборд прокручивается, на телефоне окно уходило под меню.
 */
const HOSTEL_KEY = { hostel1: 'expHostel1', hostel2: 'expHostel2' };
const fmt = (n) => (Number(n) || 0).toLocaleString('ru-RU');

const BreakfastModal = ({ onClose, t, guests = [], hostelIds = [], catalog = [], onServe, onOpenGuest }) => {
    const now = new Date();
    const today = ymd(now);
    const [hid, setHid] = useState(hostelIds[0] || '');
    const [served, setServed] = useState(null);    // отметка дня из базы
    const [picked, setPicked] = useState(null);    // null — все из списка
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    useEffect(() => {
        if (!hid) return undefined;
        setServed(null); setPicked(null);
        return onSnapshot(doc(db, ...PUBLIC_DATA_PATH, 'breakfasts', `${hid}_${today}`),
            (s) => setServed(s.exists() ? s.data() : false), () => setServed(false));
    }, [hid, today]);

    const todayList = useMemo(() => breakfastGuests(guests, hid, now, now), [guests, hid, today]); // eslint-disable-line react-hooks/exhaustive-deps
    const tomorrowList = useMemo(() => breakfastGuests(guests, hid, addDays(now, 1), now), [guests, hid, today]); // eslint-disable-line react-hooks/exhaustive-deps

    // Кого отмечаем: по умолчанию — весь список дня; после отметки — отмеченные
    const selected = picked || new Set(served?.guestIds || todayList.map(g => g.id));
    const toggle = (id) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setPicked(s); };
    const count = todayList.filter(g => selected.has(g.id)).length;
    const recipe = recipeOf(getConfig(), hid);
    const plan = breakfastWriteOff(recipe, count, catalog, hid);
    const short = plan.lines.filter(l => l.qty > l.have + (served?.items?.find(x => x.itemId === l.itemId)?.qty || 0));

    const serve = async () => {
        setBusy(true);
        try {
            const ok = await onServe?.({ hostelId: hid, day: today, guestIds: todayList.filter(g => selected.has(g.id)).map(g => g.id) });
            if (ok) setPicked(null);
        } finally { setBusy(false); }
    };

    const Row = ({ g, check }) => (
        <div className="flex items-center gap-2 py-1.5 border-b border-slate-50 text-[13px]">
            {check && <input type="checkbox" checked={selected.has(g.id)} onChange={() => toggle(g.id)} />}
            <span className="w-16 shrink-0 text-slate-400 tabular-nums">№{g.roomNumber} · {g.bedId}</span>
            {onOpenGuest
                ? <button onClick={() => onOpenGuest(g)} className="font-bold text-indigo-600 hover:underline text-left truncate">{g.fullName || '—'}</button>
                : <span className="font-bold text-slate-800 truncate">{g.fullName || '—'}</span>}
            {g.status === 'booking' && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 rounded-full">{t('bookingBadge')}</span>}
        </div>
    );

    return createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/50 p-3" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden" role="dialog" aria-modal="true" aria-label={t('bfTitle')}>
                <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100">
                    <Coffee size={20} className="text-amber-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="font-black text-lg text-slate-800">{t('bfTitle')}</div>
                        <div className="text-xs font-semibold text-slate-400">{t('bfSub').replace('{today}', todayList.length).replace('{tomorrow}', tomorrowList.length)}</div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400"><X size={20} /></button>
                </div>
                {hostelIds.length > 1 && (
                    <div className="flex gap-1 px-5 pt-3">
                        {hostelIds.map(h => (
                            <button key={h} onClick={() => setHid(h)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${h === hid ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{t(HOSTEL_KEY[h] || 'expHostel')}</button>
                        ))}
                    </div>
                )}
                <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t('bfToday')} · {todayList.length}</div>
                        {todayList.length ? todayList.map(g => <Row key={g.id} g={g} check />) : <p className="text-xs text-slate-400 italic">{t('bfNobody')}</p>}
                    </div>
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t('bfTomorrow')} · {tomorrowList.length}</div>
                        {tomorrowList.length ? tomorrowList.map(g => <Row key={g.id} g={g} />) : <p className="text-xs text-slate-400 italic">{t('bfNobody')}</p>}
                    </div>
                    {/* Что уйдёт со склада */}
                    <div className="rounded-xl border border-slate-200 p-3 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">{t('bfWriteOffTitle').replace('{n}', count)}</div>
                        {!recipe.length && <p className="text-xs text-slate-400">{t('bfNoRecipe')}</p>}
                        {plan.lines.map(l => (
                            <div key={l.itemId} className="flex justify-between text-[13px]">
                                <span>{l.name}</span>
                                <span className={`tabular-nums ${short.includes(l) ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>{l.qty} {t('bfPcs')} · {fmt(l.cost)}</span>
                            </div>
                        ))}
                        {plan.lines.length > 0 && <div className="flex justify-between text-[13px] font-bold border-t border-slate-100 pt-1"><span>{t('bfCost')}</span><span className="tabular-nums">{fmt(plan.cost)}</span></div>}
                        {short.length > 0 && (
                            <p className="flex items-start gap-1.5 text-[11px] font-semibold text-rose-600"><AlertTriangle size={13} className="shrink-0 mt-0.5" />{t('bfShort')}</p>
                        )}
                    </div>
                    {served && (
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 size={14} />
                            {t('bfServedAt').replace('{n}', served.served || 0).replace('{cost}', fmt(served.cost))}</p>
                    )}
                </div>
                <div className="px-5 py-3 border-t border-slate-100">
                    <button onClick={serve} disabled={busy || !onServe || served === null || (!count && !served)}
                        className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 disabled:opacity-50">
                        {busy ? '…' : (served ? t('bfFixBtn') : t('bfServeBtn')).replace('{n}', count)}
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};

export default BreakfastModal;
