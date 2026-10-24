import { pmcFmtISO, OVERLAY_STYLE } from './shared';
import React, { useMemo, useRef, useState } from 'react';
import { ChevronRight, Plus, Trash2, X } from 'lucide-react';
import TRANSLATIONS from '../../../constants/translations';

const pmcSd = (iso) => { if (!iso) return ''; const [, m, d] = iso.split('-'); return `${parseInt(d)}.${m}`; };

const PeriodMiniCalendar = ({ entries = [], onAddPeriod, onEditPeriod, onDeletePeriod, lang = 'ru' }) => {
    const t = k => TRANSLATIONS[lang]?.[k] || k;
    const withDates = entries.filter(e => e.checkIn && e.checkOut);
    const initRef = useRef(null);
    if (!initRef.current) {
        const isos = withDates.flatMap(e => [e.checkIn, e.checkOut]).filter(Boolean).sort();
        const base = isos.length ? new Date(isos[isos.length - 1] + 'T12:00:00') : new Date();
        initRef.current = { y: base.getFullYear(), m: base.getMonth() };
    }
    const [ym, setYm] = useState(initRef.current);
    const [dayPopup, setDayPopup] = useState(null);

    // Сколько людей в каждый день (день занят, если checkIn <= день < checkOut — ночь 12→12)
    const dayMap = useMemo(() => {
        const map = {};
        withDates.forEach(e => {
            let d = new Date(e.checkIn + 'T12:00:00');
            const end = new Date(e.checkOut + 'T12:00:00');
            let guard = 0;
            while (d < end && guard < 400) {
                const iso = pmcFmtISO(d);
                if (!map[iso]) map[iso] = { people: 0, periods: [] };
                map[iso].people += (parseInt(e.people) || 0);
                map[iso].periods.push(e);
                d = new Date(d.getTime() + 86400000);
                guard++;
            }
        });
        return map;
    }, [entries]); // eslint-disable-line react-hooks/exhaustive-deps

    const cells = useMemo(() => {
        const first = new Date(ym.y, ym.m, 1);
        const startDow = (first.getDay() + 6) % 7; // Пн=0
        const start = new Date(ym.y, ym.m, 1 - startDow);
        return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }, [ym]);

    const todayIso = pmcFmtISO(new Date());
    const maxPeople = Math.max(1, ...Object.values(dayMap).map(v => v.people));
    const prevMonth = () => setYm(s => { const d = new Date(s.y, s.m - 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
    const nextMonth = () => setYm(s => { const d = new Date(s.y, s.m + 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

    const popupInfo = dayPopup ? (dayMap[dayPopup] || { people: 0, periods: [] }) : null;

    return (
        <div className="px-4 pb-3">
            <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
                <div className="flex items-center justify-between px-2 py-2 border-b border-slate-100">
                    <button onClick={prevMonth} title={t('mslPrevMonth')} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"><ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} /></button>
                    <span className="text-sm font-bold text-slate-700">{t('monthsFull')[ym.m]} {ym.y}</span>
                    <button onClick={nextMonth} title={t('mslNextMonth')} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"><ChevronRight size={16} /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 px-1.5 pt-1.5">
                    {t('msmWeekdaysMon').split(',').map((w, i) => (
                        <div key={w} className={`text-center text-[10px] font-bold py-0.5 ${i >= 5 ? 'text-rose-400' : 'text-slate-400'}`}>{w}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1 p-1.5">
                    {cells.map((d, i) => {
                        const iso = pmcFmtISO(d);
                        const inMonth = d.getMonth() === ym.m;
                        const info = dayMap[iso];
                        const isToday = iso === todayIso;
                        const intensity = info ? 0.12 + 0.38 * (info.people / maxPeople) : 0;
                        return (
                            <button key={i} onClick={() => setDayPopup(iso)}
                                title={info ? `${info.people} ${t('msPeopleWord')}` : t('mslDayAddHint')}
                                className={`relative flex flex-col items-center justify-center rounded-lg border transition-colors ${info ? 'border-teal-300' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}
                                style={{ height: 42, opacity: inMonth ? 1 : 0.35,
                                    background: info ? `rgba(20,184,166,${intensity})` : undefined,
                                    boxShadow: isToday ? 'inset 0 0 0 2px #e88c40' : 'none' }}>
                                <span className={`text-xs font-bold leading-none tabular-nums ${info ? 'text-teal-900' : 'text-slate-600'}`}>{d.getDate()}</span>
                                {info && info.people > 0 && <span className="text-[10px] font-black leading-none mt-0.5 text-teal-900 tabular-nums">{info.people} {t('msPeopleWord')}</span>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {dayPopup && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center p-4" style={OVERLAY_STYLE} onClick={() => setDayPopup(null)}>
                    <div className="w-full max-w-sm rounded-2xl overflow-hidden bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('mslDay')}</div>
                                <div className="text-base font-black text-slate-800 tabular-nums">{pmcSd(dayPopup)} · {popupInfo.people} {t('msPeopleWord')}</div>
                            </div>
                            <button onClick={() => setDayPopup(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100"><X size={16} /></button>
                        </div>
                        <div className="p-3 space-y-2 max-h-[55vh] overflow-y-auto">
                            {popupInfo.periods.length === 0 && <div className="text-sm text-center py-2 text-slate-400">{t('msmNoPeriodsThisDay')}</div>}
                            {popupInfo.periods.map(p => {
                                const wgCount = (p.workerGroups || []).filter(wg => wg.specialty).length;
                                return (
                                    <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-slate-700 tabular-nums">{pmcSd(p.checkIn)} → {pmcSd(p.checkOut)}</div>
                                            <div className="text-xs text-slate-500">{p.people > 0 ? `${p.people} ${t('msPeopleWord')}` : t('mslPeopleNotSet')}{p.nights > 0 ? ` · ${p.nights} ${t('ormNochShort')}.` : ''}{wgCount > 0 ? ` · ${t('msBrigShort')} ${wgCount}` : ''}</div>
                                        </div>
                                        <button onClick={() => { onEditPeriod?.(p.id); setDayPopup(null); }} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:border-slate-300">{t('changeTitle')}</button>
                                        <button onClick={() => onDeletePeriod?.(p.id)} title={t('msmDeletePeriod')} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50"><Trash2 size={14} /></button>
                                    </div>
                                );
                            })}
                            <button onClick={() => { const co = pmcFmtISO(new Date(new Date(dayPopup + 'T12:00:00').getTime() + 86400000)); onAddPeriod?.(dayPopup, co); setDayPopup(null); }}
                                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors">
                                <Plus size={15} /> {t('msmNewPeriodFrom').replace('{n}', pmcSd(dayPopup))}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PeriodMiniCalendar;
