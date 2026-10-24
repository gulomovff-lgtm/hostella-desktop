import React from 'react';
import { Users, X } from 'lucide-react';
import { fmt } from './shared';
import TRANSLATIONS from '../../../constants/translations';

const BrigadeReportModal = ({ group, onClose, lang = 'ru' }) => {
    const t = k => TRANSLATIONS[lang]?.[k] || k;
    const dk = document.documentElement.dataset.theme === 'dark';
    const fmtDate = (d) => {
        if (!d) return '—';
        const [, m, day] = d.split('-');
        const months = t('brmMonths').split(',');
        return `${parseInt(day)} ${months[parseInt(m) - 1]}`;
    };
    const weekDay = (d) => t('brmWeekdays').split(',')[new Date(d + 'T00:00:00').getDay()];

    const { members, entries, specialtySummary, totalPersonDays, wgDays, memberPersonNights, totalPersonNights } = React.useMemo(() => {
        const members = group.members || [];
        const entries = (group.manualEntries || []).map(entry => {
            let nights = 0;
            if (entry.checkIn && entry.checkOut) {
                nights = Math.round((new Date(entry.checkOut + 'T00:00:00') - new Date(entry.checkIn + 'T00:00:00')) / 86400000);
            }
            if (!nights) nights = parseInt(entry.nights, 10) || 0;
            const people = parseInt(entry.people, 10) || 0;
            const wgs = (entry.workerGroups || []).filter(wg => wg.specialty && (parseInt(wg.count) || 0) > 0);
            return { ...entry, nights, people, wgs };
        }).sort((a, b) => (a.checkIn || '').localeCompare(b.checkIn || ''));

        const summary = new Map();
        const dayMap = new Map();
        entries.forEach(entry => {
            if (!entry.checkIn || !entry.checkOut || entry.wgs.length === 0) return;
            const start = new Date(entry.checkIn + 'T00:00:00');
            const end   = new Date(entry.checkOut + 'T00:00:00');
            let cur = new Date(start);
            while (cur < end) {
                const ds = cur.toISOString().slice(0, 10);
                if (!dayMap.has(ds)) dayMap.set(ds, []);
                entry.wgs.forEach(wg => {
                    dayMap.get(ds).push(wg);
                    if (!summary.has(wg.specialty)) summary.set(wg.specialty, { total: 0, daysSet: new Set() });
                    const s = summary.get(wg.specialty);
                    s.total += parseInt(wg.count) || 0;
                    s.daysSet.add(ds);
                });
                cur = new Date(cur.getTime() + 86400000);
            }
        });
        const wgDays = [...dayMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, wgs]) => ({ date, wgs }));
        const totalPersonDays = [...summary.values()].reduce((s, v) => s + v.total, 0);
        // Проживание участников (их собственные ночи как гостей) + чел-ночи договора
        const memberPersonNights = (typeof group.autoPersonNights === 'number')
            ? group.autoPersonNights
            : members.reduce((s, m) => s + (m.totalNights || 0), 0);
        const totalPersonNights = (typeof group.totalPersonNights === 'number')
            ? group.totalPersonNights
            : memberPersonNights + (group.manualPersonNights || 0);
        return { members, entries, specialtySummary: summary, totalPersonDays, wgDays, memberPersonNights, totalPersonNights };
    }, [group]);

    const copyReport = () => {
        const lines = [`${t('msBrigade')}: ${group.name}`, ''];
        if (group.contractTotal > 0) {
            if (group.contractRate > 0) lines.push(`${t('msRate')}: ${fmt(group.contractRate)} ${t('sum')}/${t('msPersonNightsShort')}`);
            lines.push(`${t('brmPersonNights')}: ${totalPersonNights}${t('brmPnBreakdown').replace('{members}', memberPersonNights).replace('{periods}', Math.max(0, totalPersonNights - memberPersonNights))}`);
            if ((group.extraTotal || 0) > 0) {
                // Проживание считаем как остаток от «Начислено»: если админ списал часть
                // долга, строка списания в отчёт не попадает, а суммы всё равно сходятся.
                lines.push(`${t('accommodation')}: ${fmt((group.contractTotal || 0) - (group.extraTotal || 0))} ${t('sum')}`);
                lines.push(`${t('msExtraCharges')}: ${fmt(group.extraTotal)} ${t('sum')}`);
                (group.extraCharges || []).forEach(c => lines.push(`  - ${c.name || t('brmUnnamed')}: ${fmt(parseInt(c.amount, 10) || 0)} ${t('sum')}${c.date ? ` (${c.date})` : ''}`));
            }
            lines.push(`${t('accrued')}: ${fmt(group.contractTotal)} ${t('sum')}`);
            lines.push(`${t('paid')}: ${fmt(group.amountPaid || 0)} ${t('sum')}`);
            if ((group.debt || 0) > 0) lines.push(`${t('debt')}: ${fmt(group.debt)} ${t('sum')}`);
            lines.push('');
        }
        if (members.length > 0) {
            lines.push(`${t('msParticipants')} (${memberPersonNights} ${t('brmPnAbbr')}):`);
            members.forEach(m => lines.push(`  - ${m.name}${m.totalNights ? ` (${m.totalNights} ${t('msNightShort')})` : ''}`));
            lines.push('');
        }
        if (entries.length > 0) {
            lines.push(`${t('msPeriods')}:`);
            entries.forEach(e => {
                const period = e.checkIn && e.checkOut ? `${e.checkIn} — ${e.checkOut}` : `${e.nights} ${t('nightsMany')}`;
                const details = [e.nights > 0 ? `${e.nights} ${t('msNightShort')}` : '', e.people > 0 ? `${e.people} ${t('msPeopleWord')}` : ''].filter(Boolean).join(', ');
                lines.push(`  ${period}${details ? ': ' + details : ''}`);
                if (e.wgs.length > 0) e.wgs.forEach(wg => lines.push(`    • ${wg.specialty}: ${wg.count} ${t('msPeopleWord')}`));
            });
            lines.push('');
        }
        if (specialtySummary.size > 0) {
            lines.push(`${t('brmTotalPersonDays')}: ${totalPersonDays}`);
            lines.push(`${t('brmBySpecialty')}:`);
            [...specialtySummary.entries()].forEach(([sp, { total, daysSet }]) => lines.push(`  ${sp}: ${total} ${t('brmPersonDaysShort')} (${daysSet.size} ${t('brmDaysShort')})`));
            if (wgDays.length > 0) {
                lines.push('', `${t('brmByDay')}:`);
                wgDays.forEach(d => {
                    const total = d.wgs.reduce((s, wg) => s + (parseInt(wg.count)||0), 0);
                    lines.push(`  ${d.date} (${weekDay(d.date)}): ${d.wgs.map(wg => `${wg.specialty} ${wg.count}`).join(', ')} = ${total} ${t('msPeopleWord')}`);
                });
            }
        }
        navigator.clipboard.writeText(lines.join('\n')).catch(() => {});
    };

    const hasData = entries.length > 0 || members.length > 0;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: 'rgba(13,43,48,0.72)' }}>
            <div className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
                style={{ background: dk ? '#1e293b' : '#fff' }}>
                <div className="flex items-center justify-between px-6 py-4 shrink-0"
                    style={{ borderBottom: `1px solid ${dk ? '#334155' : '#f1f5f9'}` }}>
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#0f9688' }}>{t('brmGroupReport')}</div>
                        <div className="text-lg font-black mt-0.5" style={{ color: dk ? '#f1f5f9' : '#1e293b' }}>{group.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasData && (
                            <button onClick={copyReport}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-colors"
                                style={{ background: '#0f9688' }}>
                                {t('copy')}
                            </button>
                        )}
                        <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
                            style={{ color: dk ? '#64748b' : '#94a3b8' }}><X size={15}/></button>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 p-6 space-y-5">
                    {!hasData ? (
                        <div className="py-16 text-center">
                            <div className="mb-3" style={{ color: dk ? '#334155' : '#cbd5e1' }}><Users size={40} className="mx-auto" /></div>
                            <p className="text-sm font-semibold" style={{ color: dk ? '#64748b' : '#94a3b8' }}>{t('noData')}</p>
                            <p className="text-xs mt-1" style={{ color: dk ? '#475569' : '#94a3b8' }}>{t('brmNoDataHint')}</p>
                        </div>
                    ) : (
                        <>
                            {/* Метрики */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { label: t('brmMembersCount'), value: members.length },
                                    { label: t('brmMemberPN'),     value: memberPersonNights },
                                    { label: t('brmPeriodsCount'), value: entries.length },
                                    { label: t('brmTotalPN'),      value: totalPersonNights },
                                ].map(s => (
                                    <div key={s.label} className="rounded-xl p-4 text-center"
                                        style={{ background: dk ? 'rgba(15,150,136,0.15)' : 'linear-gradient(135deg,#f0fdfa,#ccfbf1)', border: `1px solid ${dk ? 'rgba(15,150,136,0.3)' : '#99f6e4'}` }}>
                                        <div className="text-2xl font-black" style={{ color: dk ? '#5eead4' : '#0f766e' }}>{s.value}</div>
                                        <div className="text-[11px] font-semibold mt-0.5" style={{ color: '#0d9488' }}>{s.label}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Финансы */}
                            {group.contractTotal > 0 && (
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: dk ? '#64748b' : '#94a3b8' }}>{t('brmFinanceTotal')}</div>
                                    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${dk ? '#334155' : '#e2e8f0'}` }}>
                                        {group.contractRate > 0 && (
                                            <div className="flex justify-between items-center px-4 py-3" style={{ borderBottom: `1px solid ${dk ? '#334155' : '#f8fafc'}` }}>
                                                <span className="text-sm" style={{ color: dk ? '#94a3b8' : '#64748b' }}>{t('msRate')}</span>
                                                <span className="text-sm font-bold" style={{ color: dk ? '#e2e8f0' : '#334155' }}>{fmt(group.contractRate)} {t('sum')}/{t('msPersonNightsShort')}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center px-4 py-3" style={{ borderBottom: `1px solid ${dk ? '#334155' : '#f8fafc'}` }}>
                                            <span className="text-sm" style={{ color: dk ? '#94a3b8' : '#64748b' }}>{t('brmPersonNights')}</span>
                                            <span className="text-sm font-bold" style={{ color: dk ? '#e2e8f0' : '#334155' }}>
                                                {totalPersonNights}
                                                <span className="text-[11px] font-normal" style={{ color: dk ? '#64748b' : '#94a3b8' }}>{t('brmPnBreakdown').replace('{members}', memberPersonNights).replace('{periods}', Math.max(0, totalPersonNights - memberPersonNights))}</span>
                                            </span>
                                        </div>
                                        {(group.extraTotal || 0) > 0 && (
                                            <>
                                                <div className="flex justify-between items-center px-4 py-3" style={{ borderBottom: `1px solid ${dk ? '#334155' : '#f8fafc'}` }}>
                                                    <span className="text-sm" style={{ color: dk ? '#94a3b8' : '#64748b' }}>{t('accommodation')}</span>
                                                    <span className="text-sm font-bold" style={{ color: dk ? '#e2e8f0' : '#334155' }}>{fmt((group.contractTotal || 0) - (group.extraTotal || 0))} {t('sum')}</span>
                                                </div>
                                                {(group.extraCharges || []).map(c => (
                                                    <div key={c.id} className="flex justify-between items-center px-4 py-2" style={{ borderBottom: `1px solid ${dk ? '#334155' : '#f8fafc'}` }}>
                                                        <span className="text-[13px]" style={{ color: dk ? '#94a3b8' : '#64748b' }}>+ {c.name}{c.date ? ` · ${c.date.slice(5).split('-').reverse().join('.')}` : ''}</span>
                                                        <span className="text-[13px] font-bold" style={{ color: '#d97706' }}>{fmt(parseInt(c.amount, 10) || 0)} {t('sum')}</span>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                        <div className="flex justify-between items-center px-4 py-3" style={{ borderBottom: `1px solid ${dk ? '#334155' : '#f8fafc'}` }}>
                                            <span className="text-sm" style={{ color: dk ? '#94a3b8' : '#64748b' }}>{t('accrued')}</span>
                                            <span className="text-sm font-bold" style={{ color: dk ? '#e2e8f0' : '#334155' }}>{fmt(group.contractTotal)} {t('sum')}</span>
                                        </div>
                                        <div className="flex justify-between items-center px-4 py-3" style={{ borderBottom: (group.debt || 0) > 0 ? `1px solid ${dk ? '#334155' : '#f8fafc'}` : 'none' }}>
                                            <span className="text-sm" style={{ color: dk ? '#94a3b8' : '#64748b' }}>{t('paid')}</span>
                                            <span className="text-sm font-black" style={{ color: '#0f9688' }}>{fmt(group.amountPaid || 0)} {t('sum')}</span>
                                        </div>
                                        {(group.debt || 0) > 0 && (
                                            <div className="flex justify-between items-center px-4 py-3"
                                                style={{ background: dk ? 'rgba(239,68,68,0.1)' : '#fff5f5' }}>
                                                <span className="text-sm font-bold text-rose-500">{t('debt')}</span>
                                                <span className="text-sm font-black text-rose-500">{fmt(group.debt)} {t('sum')}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Участники */}
                            {members.length > 0 && (
                                <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: dk ? '#64748b' : '#94a3b8' }}>{t('msParticipants')} · {members.length} · {memberPersonNights} {t('brmPnAbbr')}</div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {members.map((m, i) => (
                                            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium"
                                                style={{ background: dk ? 'rgba(15,150,136,0.15)' : '#f0fdfa', border: `1px solid ${dk ? 'rgba(15,150,136,0.3)' : '#99f6e4'}`, color: dk ? '#5eead4' : '#0f766e' }}>
                                                {m.name}
                                                {m.totalNights > 0 && <span className="text-[10px] opacity-60">{m.totalNights} {t('msNightShort')}</span>}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Периоды */}
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: dk ? '#64748b' : '#94a3b8' }}>{t('brmStayPeriods')} · {entries.length}</div>
                                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${dk ? '#334155' : '#e2e8f0'}` }}>
                                    {entries.map((entry, i) => (
                                        <div key={i} className="last:border-0 transition-colors" style={{ borderBottom: `1px solid ${dk ? '#1e293b' : '#f8fafc'}` }}>
                                            <div className="flex items-center gap-3 px-4 py-3">
                                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
                                                    style={{ background: dk ? 'rgba(15,150,136,0.2)' : '#f0fdfa', color: '#0f9688' }}>{i + 1}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold" style={{ color: dk ? '#e2e8f0' : '#1e293b' }}>
                                                        {entry.checkIn && entry.checkOut
                                                            ? `${fmtDate(entry.checkIn)} — ${fmtDate(entry.checkOut)}`
                                                            : entry.nights > 0 ? `${entry.nights} ${t('nightsMany')}` : '—'}
                                                    </div>
                                                    {(entry.people > 0 || (Array.isArray(entry.roomIds) && entry.roomIds.length > 0)) && (
                                                        <div className="text-[11px] mt-0.5" style={{ color: dk ? '#64748b' : '#94a3b8' }}>
                                                            {entry.people > 0 && <span>{entry.people} {t('msPeopleWord')}</span>}
                                                            {Array.isArray(entry.roomIds) && entry.roomIds.length > 0 && <span className="ml-2">{entry.roomIds.length} {t('brmRoomsShort')}</span>}
                                                        </div>
                                                    )}
                                                    {entry.wgs.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                                            {entry.wgs.map((wg, wi) => (
                                                                <span key={wi} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium"
                                                                    style={{ background: dk ? 'rgba(15,150,136,0.12)' : 'rgba(15,150,136,0.08)', color: dk ? '#5eead4' : '#0f766e' }}>
                                                                    <span className="font-black">{wg.count}</span> {wg.specialty}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {entry.nights > 0 && (
                                                    <div className="shrink-0 text-right">
                                                        <div className="text-sm font-black" style={{ color: '#0f9688' }}>{entry.nights}</div>
                                                        <div className="text-[10px]" style={{ color: dk ? '#64748b' : '#94a3b8' }}>{t('nightsMany')}</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Специальности */}
                            {specialtySummary.size > 0 && (
                                <>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: dk ? '#64748b' : '#94a3b8' }}>{t('brmSpecialtyTotal')}</div>
                                        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${dk ? '#334155' : '#e2e8f0'}` }}>
                                            <div className="grid grid-cols-[1fr_72px_88px]" style={{ background: dk ? '#0f172a' : '#f8fafc', borderBottom: `1px solid ${dk ? '#334155' : '#e2e8f0'}` }}>
                                                <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: dk ? '#64748b' : '#64748b' }}>{t('brmSpecialty')}</div>
                                                <div className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide text-right" style={{ color: dk ? '#64748b' : '#64748b' }}>{t('days')}</div>
                                                <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-right" style={{ color: dk ? '#64748b' : '#64748b' }}>{t('brmPersonDays')}</div>
                                            </div>
                                            {[...specialtySummary.entries()].sort((a, b) => b[1].total - a[1].total).map(([sp, { total, daysSet }]) => (
                                                <div key={sp} className="grid grid-cols-[1fr_72px_88px] last:border-0 transition-colors"
                                                    style={{ borderBottom: `1px solid ${dk ? '#1e293b' : '#f8fafc'}` }}>
                                                    <div className="px-4 py-3 text-sm font-semibold" style={{ color: dk ? '#e2e8f0' : '#1e293b' }}>{sp}</div>
                                                    <div className="px-3 py-3 text-sm font-bold text-right" style={{ color: dk ? '#64748b' : '#94a3b8' }}>{daysSet.size}</div>
                                                    <div className="px-4 py-3 text-sm font-black text-right" style={{ color: '#0f9688' }}>{total}</div>
                                                </div>
                                            ))}
                                            <div className="grid grid-cols-[1fr_72px_88px]" style={{ background: '#f0fdfa', borderTop: '1px solid #99f6e4' }}>
                                                <div className="px-4 py-3 text-sm font-black text-slate-700">{t('total')}</div>
                                                <div className="px-3 py-3 text-sm font-black text-slate-400 text-right">{wgDays.length}</div>
                                                <div className="px-4 py-3 text-sm font-black text-right" style={{ color: '#0f766e' }}>{totalPersonDays}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* По дням */}
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">{t('brmByDay')} · {wgDays.length} {t('brmDaysShort')}</div>
                                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                                            {wgDays.map((day, i) => {
                                                const total = day.wgs.reduce((s, wg) => s + (parseInt(wg.count) || 0), 0);
                                                const wd = weekDay(day.date);
                                                const dow = new Date(day.date + 'T00:00:00').getDay();
                                                const isWeekend = dow === 0 || dow === 6;
                                                return (
                                                    <div key={day.date + i} className={`flex items-center gap-4 px-4 py-2.5 border-b border-slate-50 last:border-0 ${isWeekend ? 'bg-amber-50/50' : 'hover:bg-slate-50/70'} transition-colors`}>
                                                        <div className="w-20 shrink-0">
                                                            <div className="text-sm font-bold text-slate-700">{fmtDate(day.date)}</div>
                                                            <div className={`text-[10px] font-semibold ${isWeekend ? 'text-amber-500' : 'text-slate-400'}`}>{wd}</div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                                                            {day.wgs.map((wg, wi) => (
                                                                <span key={wi} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                                                                    style={{ background: 'rgba(15,150,136,0.08)', color: '#0f766e' }}>
                                                                    <span className="font-black">{wg.count}</span> {wg.specialty}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <div className="shrink-0 min-w-[52px] text-right">
                                                            <span className="text-sm font-black" style={{ color: '#0f9688' }}>{total}</span>
                                                            <span className="text-[10px] text-slate-400 ml-0.5">{t('msPeopleWord')}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BrigadeReportModal;
