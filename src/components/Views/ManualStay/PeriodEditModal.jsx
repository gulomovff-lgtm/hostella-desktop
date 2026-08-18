import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import RoomPicker from './RoomPicker';
import WorkerGroupRow from './WorkerGroupRow';

const PeriodEditModal = ({ group, entry, rooms, savedSpecialties, onUpdate, onRemove, onAddWG, onUpdateWG, onRemoveWG, onClose }) => {
    const [checkIn, setCheckIn] = useState(entry.checkIn || '');
    const [checkOut, setCheckOut] = useState(entry.checkOut || '');
    const [people, setPeople] = useState(entry.people || '');
    const nights = (checkIn && checkOut) ? Math.max(0, Math.round((new Date(checkOut + 'T12:00:00') - new Date(checkIn + 'T12:00:00')) / 86400000)) : 0;
    // Если бригада заполнена — кол-во людей берётся из неё (read-only)
    const brigTotal = (entry.workerGroups || []).reduce((s, wg) => s + (wg.specialty ? (parseInt(wg.count) || 0) : 0), 0);
    const inp = { border: '1px solid rgba(94,234,212,0.25)', background: 'rgba(94,234,212,0.07)', color: '#e2f7f8' };
    const lbl = { color: 'rgba(94,234,212,0.5)' };
    return (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4" style={{ background: 'rgba(8,20,22,0.72)' }} onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: '#0d2532', border: '1px solid rgba(94,234,212,0.25)' }} onClick={e => e.stopPropagation()}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#0f9688,#0d7a6e)' }}>
                    <div className="text-white font-black text-sm truncate">Период · {group.name}</div>
                    <button onClick={onClose} className="w-6 h-6 rounded-full flex items-center justify-center bg-white/20 text-white shrink-0"><X size={12} /></button>
                </div>
                <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[9px] font-bold uppercase tracking-wide block mb-1" style={lbl}>Заезд</label>
                            <input type="date" value={checkIn} onChange={e => { setCheckIn(e.target.value); onUpdate({ checkIn: e.target.value }); }}
                                className="w-full px-2 py-1.5 text-[11px] rounded-lg focus:outline-none" style={inp} />
                        </div>
                        <div>
                            <label className="text-[9px] font-bold uppercase tracking-wide block mb-1" style={lbl}>Выезд</label>
                            <input type="date" value={checkOut} onChange={e => { setCheckOut(e.target.value); onUpdate({ checkOut: e.target.value }); }}
                                className="w-full px-2 py-1.5 text-[11px] rounded-lg focus:outline-none" style={inp} />
                        </div>
                    </div>
                    {nights > 0 && <div className="text-[10px]" style={lbl}>{nights} ноч.</div>}
                    <div className="flex items-end gap-2">
                        <div className="flex-1 min-w-0">
                            <label className="text-[9px] font-bold uppercase tracking-wide block mb-1" style={lbl}>Комнаты</label>
                            <RoomPicker rooms={rooms} selected={Array.isArray(entry.roomIds) ? entry.roomIds : []} onChange={roomIds => onUpdate({ roomIds })} />
                        </div>
                        <div className="w-16">
                            <label className="text-[9px] font-bold uppercase tracking-wide block mb-1" style={lbl}>Человек{brigTotal > 0 ? ' (бриг.)' : ''}</label>
                            {brigTotal > 0 ? (
                                <input type="text" readOnly value={brigTotal} title="Из бригады"
                                    className="w-full px-1.5 py-1.5 text-[11px] rounded-lg text-center font-bold"
                                    style={{ ...inp, color: '#5eead4', opacity: 0.9 }} />
                            ) : (
                                <input type="number" min="0" value={people}
                                    onChange={e => setPeople(e.target.value.replace(/[^0-9]/g, ''))}
                                    onBlur={() => { if (String(people) !== String(entry.people || '')) onUpdate({ people }); }}
                                    className="w-full px-1.5 py-1.5 text-[11px] rounded-lg focus:outline-none text-center" style={inp} />
                            )}
                        </div>
                    </div>
                    <div className="pt-2" style={{ borderTop: '1px solid rgba(94,234,212,0.1)' }}>
                        <div className="text-[9px] font-bold uppercase tracking-wide mb-1.5" style={lbl}>Бригада / специальности</div>
                        <div className="space-y-1">
                            {(entry.workerGroups || []).map((wg, wgIdx) => (
                                <WorkerGroupRow key={wg.id || wgIdx} wg={wg} wgIdx={wgIdx} options={savedSpecialties}
                                    onUpdate={patch => onUpdateWG(wg.id, patch)} onRemove={() => onRemoveWG(wg.id)} />
                            ))}
                            <button onClick={onAddWG}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-dashed text-[9px] font-semibold"
                                style={{ borderColor: 'rgba(94,234,212,0.2)', color: 'rgba(94,234,212,0.6)' }}>
                                <Plus size={7} /> Добавить специальность
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        <button onClick={() => { onRemove(); onClose(); }} className="inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: '#f87171' }}>
                            <Trash2 size={11} /> Удалить период
                        </button>
                        <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: '#0f9688' }}>Готово</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Общий отчёт (по месяцам / по выбранным договорам) ────────────────────

export default PeriodEditModal;
