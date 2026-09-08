import React from 'react';
import { AlertTriangle, ShieldCheck, Building2, ExternalLink, Check } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

const fmt = (iso) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('ru-RU'); } catch { return iso; }
};

/**
 * «Ситуация с регистрацией». Иностранец за пределами окна пришёл к нам, а по
 * списку портала с выезда из прошлого отеля прошло больше суток (или отелей
 * не было вовсе). Мастер остановлен ПЕРЕД «Сохранить»: по закону такого гостя
 * направляют в миграционную службу, а не регистрируют молча. Решает человек;
 * закрыть можно только кнопкой.
 */
const KppSituationModal = ({ guest, assessment, stays = [], lang = 'ru', onDecide, onOpenGuest }) => {
    const t = k => TRANSLATIONS[lang]?.[k] || k;
    if (!guest || !assessment) return null;
    const reasonKey = assessment.reason === 'gap_after_hotel' ? 'kppReasonGapAfterHotel' : 'kppReasonGapAfterKpp';
    const lastStay = stays.length ? stays[stays.length - 1] : null;
    const rows = stays.slice(-5);
    return (
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '92vh' }}>
                <div className="shrink-0 px-6 py-5 flex items-center gap-4" style={{ background: 'linear-gradient(135deg,#78350f,#f59e0b)' }}>
                    <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0"><AlertTriangle size={30} className="text-white" /></div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-black text-white leading-tight">{t('kppSituationTitle')}</h2>
                        <p className="text-sm text-amber-100/90 mt-0.5">{t(reasonKey)}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50">
                    <div className="bg-white rounded-2xl border border-slate-200 p-4">
                        <div className="text-lg font-black text-slate-800">{guest.fullName}</div>
                        <div className="text-xs font-semibold text-slate-500">{guest.country} · {guest.passport || '—'}</div>
                        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                            <div><span className="text-[10px] text-slate-400 uppercase font-bold">{t('kppDateLabel')}: </span><b className="tabular-nums">{fmt(guest.kppDate)}</b>{guest.kppNumber ? <span className="text-slate-400"> · №{guest.kppNumber}</span> : null}</div>
                            <div><span className="text-[10px] text-slate-400 uppercase font-bold">{t('kppDayOfWindow')}: </span><b className="tabular-nums text-rose-600">{assessment.dayNumber}</b> / {assessment.window}</div>
                            <div><span className="text-[10px] text-slate-400 uppercase font-bold">{t('kppLastHotel')}: </span>{lastStay ? <b>{lastStay.hotel || '—'} · {fmt(lastStay.to)}</b> : <span className="text-slate-400">{t('kppNoStays')}</span>}</div>
                            <div><span className="text-[10px] text-slate-400 uppercase font-bold">{t('kppGapDays')}: </span><b className="tabular-nums text-rose-600">{assessment.gapDays}</b></div>
                        </div>
                    </div>

                    {rows.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            <div className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Building2 size={12} /> {t('kppStaysTitle')}</div>
                            <table className="w-full text-sm">
                                <tbody>
                                    {rows.map((s, i) => (
                                        <tr key={i} className="border-t border-slate-100">
                                            <td className="px-4 py-2 font-semibold text-slate-700">{s.hotel || '—'}</td>
                                            <td className="px-4 py-2 tabular-nums text-slate-500 whitespace-nowrap text-right">{fmt(s.from)} — {fmt(s.to)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-start gap-2">
                        <ShieldCheck size={14} className="shrink-0 mt-0.5" /><span>{t('kppLawNote')}</span>
                    </div>
                </div>

                <div className="shrink-0 px-5 py-4 bg-white border-t border-slate-200 flex flex-col gap-2">
                    <button onClick={() => onDecide?.('migration')}
                        className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm flex items-center justify-center gap-2">
                        <ShieldCheck size={15} /> {t('kppDecideMigration')}
                    </button>
                    <button onClick={() => onDecide?.('register')}
                        className="w-full py-3 rounded-xl border-2 border-slate-800 text-slate-800 font-black text-sm hover:bg-slate-50 flex items-center justify-center gap-2">
                        <Check size={15} /> {t('kppDecideRegister')}
                    </button>
                    <div className="flex gap-2">
                        <button onClick={() => onDecide?.('ack')}
                            className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50">
                            {t('kppAckBtn')}
                        </button>
                        {onOpenGuest && (
                            <button onClick={onOpenGuest}
                                className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 flex items-center justify-center gap-1.5">
                                <ExternalLink size={13} /> {t('kppOpenGuest')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KppSituationModal;
