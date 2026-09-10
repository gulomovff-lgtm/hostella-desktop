import { pmcFmtISO } from './shared';
import React, { useMemo, useRef, useState } from 'react';
import { ChevronRight, Plus, X } from 'lucide-react';
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
        <div className="px-3 pb-2">
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(94,234,212,0.15)', background: 'rgba(94,234,212,0.03)' }}>
                <div className="flex items-center justify-between px-2 py-1.5" style={{ borderBottom: '1px solid rgba(94,234,212,0.12)' }}>
                    <button onClick={prevMonth} className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ color: '#5eead4' }}><ChevronRight size={13} style={{ transform: 'rotate(180deg)' }} /></button>
                    <span className="text-[11px] font-bold" style={{ color: '#e2f7f8' }}>{t('monthsFull')[ym.m]} {ym.y}</span>
                    <button onClick={nextMonth} className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ color: '#5eead4' }}><ChevronRight size={13} /></button>
                </div>
                <div className="grid grid-cols-7 gap-1 px-1 pt-1">
                    {t('msmWeekdaysMon').split(',').map((w, i) => (
                        <div key={w} className="text-center text-[9px] font-bold py-0.5" style={{ color: i >= 5 ? 'rgba(248,113,113,0.6)' : 'rgba(94,234,212,0.4)' }}>{w}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1 p-1">
                    {cells.map((d, i) => {
                        const iso = pmcFmtISO(d);
                        const inMonth = d.getMonth() === ym.m;
                        const info = dayMap[iso];
                        const isToday = iso === todayIso;
                        const intensity = info ? 0.18 + 0.55 * (info.people / maxPeople) : 0;
                        return (
                            <button key={i} onClick={() => setDayPopup(iso)}
                                className="relative flex flex-col items-center justify-center rounded-lg transition-colors hover:brightness-110"
                                style={{ height: 40, opacity: inMonth ? 1 : 0.3,
                                    background: info ? `rgba(15,150,136,${intensity})` : 'rgba(94,234,212,0.04)',
                                    border: `1px solid ${info ? 'rgba(94,234,212,0.4)' : 'rgba(94,234,212,0.08)'}`,
                                    boxShadow: isToday ? 'inset 0 0 0 2px #5eead4' : 'none' }}>
                                <span className="text-[11px] font-bold leading-none" style={{ color: inMonth ? '#e2f7f8' : 'rgba(94,234,212,0.4)' }}>{d.getDate()}</span>
                                {info && info.people > 0 && <span className="text-[9px] font-black leading-none mt-0.5" style={{ color: '#5eead4' }}>{info.people}</span>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {dayPopup && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center p-4" style={{ background: 'rgba(8,20,22,0.6)' }} onClick={() => setDayPopup(null)}>
                    <div className="w-full max-w-xs rounded-2xl overflow-hidden" style={{ background: '#0d2532', border: '1px solid rgba(94,234,212,0.25)' }} onClick={e => e.stopPropagation()}>
                        <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#0f9688,#0d7a6e)' }}>
                            <div className="text-white font-black text-sm">{pmcSd(dayPopup)} · {popupInfo.people} {t('msPeopleWord')}</div>
                            <button onClick={() => setDayPopup(null)} className="w-6 h-6 rounded-full flex items-center justify-center bg-white/20 text-white"><X size={12} /></button>
                        </div>
                        <div className="p-3 space-y-1.5 max-h-[55vh] overflow-y-auto">
                            {popupInfo.periods.length === 0 && <div className="text-[11px] text-center py-2" style={{ color: 'rgba(94,234,212,0.4)' }}>{t('msmNoPeriodsThisDay')}</div>}
                            {popupInfo.periods.map(p => {
                                const wgCount = (p.workerGroups || []).filter(wg => wg.specialty).length;
                                return (
                                    <div key={p.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg" style={{ background: 'rgba(94,234,212,0.06)', border: '1px solid rgba(94,234,212,0.12)' }}>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[11px] font-semibold" style={{ color: '#e2f7f8' }}>{pmcSd(p.checkIn)} → {pmcSd(p.checkOut)}</div>
                                            <div className="text-[9px]" style={{ color: 'rgba(94,234,212,0.5)' }}>{p.people > 0 ? `${p.people} ${t('msPeopleWord')}` : ''}{p.nights > 0 ? ` · ${p.nights}${t('msNightShort')}` : ''}{wgCount > 0 ? ` · ${t('msBrigShort')}${wgCount}` : ''}</div>
                                        </div>
                                        <button onClick={() => { onEditPeriod?.(p.id); setDayPopup(null); }} className="px-2 py-1 rounded-lg text-[10px] font-bold" style={{ color: '#5eead4', background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.25)' }}>{t('changeTitle')}</button>
                                        <button onClick={() => onDeletePeriod?.(p.id)} className="p-1 rounded-lg" style={{ color: 'rgba(94,234,212,0.4)' }}><X size={12} /></button>
                                    </div>
                                );
                            })}
                            <button onClick={() => { const co = pmcFmtISO(new Date(new Date(dayPopup + 'T12:00:00').getTime() + 86400000)); onAddPeriod?.(dayPopup, co); setDayPopup(null); }}
                                className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-dashed text-[10px] font-semibold" style={{ borderColor: 'rgba(94,234,212,0.3)', color: '#0f9688' }}>
                                <Plus size={9} /> {t('msmNewPeriodFrom').replace('{n}', pmcSd(dayPopup))}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Попап редактирования периода ─────────────────────────────────────────

export default PeriodMiniCalendar;
