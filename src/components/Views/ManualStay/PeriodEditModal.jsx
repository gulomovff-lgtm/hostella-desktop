import React, { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import RoomPicker from './RoomPicker';
import WorkerGroupRow from './WorkerGroupRow';
import { INP, LBL, OVERLAY_STYLE } from './shared';
import TRANSLATIONS from '../../../constants/translations';

const PeriodEditModal = ({ group, entry, rooms, savedSpecialties, onUpdate, onRemove, onAddWG, onUpdateWG, onRemoveWG, onClose, lang = 'ru' }) => {
    const t = k => TRANSLATIONS[lang]?.[k] || k;
    const [checkIn, setCheckIn] = useState(entry.checkIn || '');
    const [checkOut, setCheckOut] = useState(entry.checkOut || '');
    const [people, setPeople] = useState(entry.people || '');
    const nights = (checkIn && checkOut) ? Math.max(0, Math.round((new Date(checkOut + 'T12:00:00') - new Date(checkIn + 'T12:00:00')) / 86400000)) : 0;
    // Если бригада заполнена — кол-во людей берётся из неё (read-only)
    const brigTotal = (entry.workerGroups || []).reduce((s, wg) => s + (wg.specialty ? (parseInt(wg.count) || 0) : 0), 0);
    const shownPeople = brigTotal > 0 ? brigTotal : (parseInt(people) || 0);
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4" style={OVERLAY_STYLE} onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl overflow-hidden bg-white shadow-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100 shrink-0">
                    <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{t('mslPeriodTitle')}</div>
                        <div className="text-base font-black text-slate-800 truncate">{group.name}</div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 shrink-0"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-4 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={LBL}>{t('checkinShort')}</label>
                            <input type="date" value={checkIn} onChange={e => { setCheckIn(e.target.value); onUpdate({ checkIn: e.target.value }); }}
                                className={INP + ' w-full'} />
                        </div>
                        <div>
                            <label className={LBL}>{t('checkoutDate')}</label>
                            <input type="date" value={checkOut} onChange={e => { setCheckOut(e.target.value); onUpdate({ checkOut: e.target.value }); }}
                                className={INP + ' w-full'} />
                        </div>
                    </div>
                    <div className="flex items-end gap-3">
                        <div className="flex-1 min-w-0">
                            <label className={LBL}>{t('roomsWord')}</label>
                            <RoomPicker rooms={rooms} selected={Array.isArray(entry.roomIds) ? entry.roomIds : []} onChange={roomIds => onUpdate({ roomIds })} lang={lang} />
                        </div>
                        <div className="w-24">
                            <label className={LBL}>{t('msmPeople')}</label>
                            {brigTotal > 0 ? (
                                <input type="text" readOnly value={brigTotal} title={t('msFromBrigade')}
                                    className={INP + ' w-full text-center font-bold bg-slate-50 text-teal-600'} />
                            ) : (
                                <input type="number" min="0" value={people}
                                    onChange={e => setPeople(e.target.value.replace(/[^0-9]/g, ''))}
                                    onBlur={() => { if (String(people) !== String(entry.people || '')) onUpdate({ people }); }}
                                    className={INP + ' w-full text-center font-bold tabular-nums'} />
                            )}
                        </div>
                    </div>
                    {brigTotal > 0 && <div className="text-xs text-slate-500 -mt-2">{t('mslPeopleByBrigade')}</div>}

                    {/* Итог периода — сразу видно, сколько начислится */}
                    <div className="flex items-center justify-between rounded-xl bg-teal-50 border border-teal-100 px-4 py-2.5">
                        <span className="text-sm text-slate-600 tabular-nums">{nights} {t('ormNochShort')}. × {shownPeople} {t('msPeopleWord')}</span>
                        <span className="text-base font-black text-teal-600 tabular-nums">= {nights * shownPeople} {t('msPersonNightsWord')}</span>
                    </div>

                    <div className="pt-3 border-t border-slate-100">
                        <div className={LBL}>{t('msmBrigadeSpecs')}</div>
                        <div className="space-y-2">
                            {(entry.workerGroups || []).map((wg, wgIdx) => (
                                <WorkerGroupRow key={wg.id || wgIdx} wg={wg} wgIdx={wgIdx} lang={lang} options={savedSpecialties}
                                    onUpdate={patch => onUpdateWG(wg.id, patch)} onRemove={() => onRemoveWG(wg.id)} />
                            ))}
                            <button onClick={onAddWG}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-xs font-bold text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-colors">
                                <Plus size={13} /> {t('msAddSpecialty')}
                            </button>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 shrink-0">
                    {/* removeEntry сам спрашивает подтверждение */}
                    <button onClick={async () => { if (await onRemove() !== false) onClose(); }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-rose-500 hover:bg-rose-50 transition-colors">
                        <Trash2 size={14} /> {t('msmDeletePeriod')}
                    </button>
                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors">{t('done')}</button>
                </div>
            </div>
        </div>
    );
};

export default PeriodEditModal;
