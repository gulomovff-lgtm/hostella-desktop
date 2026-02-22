import React, { useState } from 'react';
import { ArrowLeftRight, X, BedDouble } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

// --- Utilities ---
const checkCollision = (existingCheckIn, existingDays, newCheckIn, newDays) => {
    const e1 = new Date(existingCheckIn); 
    e1.setHours(12, 0, 0, 0);
    const e2 = new Date(e1); 
    e2.setDate(e2.getDate() + parseInt(existingDays));
    const n1 = new Date(newCheckIn); 
    n1.setHours(12, 0, 0, 0);
    const n2 = new Date(n1); 
    n2.setDate(n2.getDate() + parseInt(newDays));
    return !(e2 <= n1 || n2 <= e1);
};

// --- MoveGuestModal ---
const MoveGuestModal = ({ guest, allRooms, guests, onClose, onMove, notify, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [targetRoomId, setTargetRoomId] = useState(guest.roomId);
    const [targetBedId, setTargetBedId] = useState('');
    
    const selectedRoom = allRooms.find(r => r.id === targetRoomId);
    const beds = selectedRoom ? Array.from({length: selectedRoom.capacity}, (_, i) => i + 1) : [];
    const now = new Date();

    const handleMove = () => {
        if (!targetRoomId || !targetBedId) return notify("Выберите место", 'error');
        
        const conflicts = guests.filter(g => {
            if (String(g.roomId) !== String(targetRoomId)) return false;
            if (String(g.bedId) !== String(targetBedId)) return false;
            if (g.id === guest.id) return false;
            if (g.status === 'checked_out') return false;

            if (g.status === 'active') {
                const checkOut = new Date(g.checkOutDate);
                if (typeof g.checkOutDate === 'string' && !g.checkOutDate.includes('T')) {
                    checkOut.setHours(12, 0, 0, 0);
                }
                if (now > checkOut) return false;
            }

            return checkCollision(g.checkInDate, g.days, guest.checkInDate, guest.days);
        });
        
        if (conflicts.length > 0) return notify(`Занято! (${conflicts[0].fullName})`, 'error');
        
        onMove(guest, targetRoomId, selectedRoom.number, String(targetBedId));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-300 overflow-hidden flex flex-col max-h-[90vh]">
                
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <ArrowLeftRight size={20} className="text-indigo-600"/>
                        {t('move')}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20}/>
                    </button>
                </div>
                
                <div className="p-6 space-y-5 overflow-y-auto">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex justify-between items-center">
                        <div>
                            <div className="text-xs text-indigo-500 font-bold uppercase mb-0.5">Гость</div>
                            <div className="font-bold text-indigo-900">{guest.fullName}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-indigo-500 font-bold uppercase mb-0.5">Текущее место</div>
                            <div className="font-bold text-indigo-900">Комн. {guest.roomNumber} / {guest.bedId}</div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Выберите комнату</label>
                        <select 
                            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm transition-all"
                            value={targetRoomId} 
                            onChange={e => { setTargetRoomId(e.target.value); setTargetBedId(''); }}
                        >
                            {allRooms.map(r => (
                                <option key={r.id} value={r.id}>Комната №{r.number} ({r.capacity} мест)</option>
                            ))}
                        </select>
                    </div>

                    {selectedRoom && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">
                                Доступные места (Комната {selectedRoom.number})
                            </label>
                            
                            <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                                {beds.map(bedId => {
                                    const occupant = guests.find(g => 
                                        String(g.roomId) === String(selectedRoom.id) && 
                                        String(g.bedId) === String(bedId) &&
                                        (g.status === 'active' || g.status === 'booking') &&
                                        g.id !== guest.id
                                    );

                                    let status = 'free';
                                    let statusText = 'Свободно';
                                    
                                    if (occupant) {
                                        if (occupant.status === 'booking') {
                                            status = 'booking';
                                            statusText = 'Бронь';
                                        } else {
                                            const checkOut = new Date(occupant.checkOutDate);
                                            if (typeof occupant.checkOutDate === 'string' && !occupant.checkOutDate.includes('T')) {
                                                checkOut.setHours(12, 0, 0, 0);
                                            }
                                            if (now > checkOut) {
                                                status = 'timeout';
                                                statusText = 'Time Out';
                                            } else {
                                                status = 'occupied';
                                                statusText = occupant.fullName.split(' ')[0];
                                            }
                                        }
                                    }

                                    const isSelected = String(targetBedId) === String(bedId);
                                    let cardClass = "border border-slate-200 bg-white hover:border-slate-400";
                                    let textClass = "text-slate-600";
                                    let disabled = false;

                                    if (isSelected) {
                                        cardClass = "border-2 border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600";
                                        textClass = "text-indigo-700";
                                    } else if (status === 'occupied') {
                                        cardClass = "bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed";
                                        textClass = "text-slate-400";
                                        disabled = true;
                                    } else if (status === 'timeout') {
                                        cardClass = "bg-slate-50 border-slate-300 border-dashed hover:border-indigo-400 hover:bg-slate-100";
                                        textClass = "text-slate-500";
                                    } else if (status === 'booking') {
                                        cardClass = "bg-amber-50 border-amber-200 hover:border-amber-400";
                                        textClass = "text-amber-700";
                                    } else {
                                        cardClass = "bg-white border-emerald-200 hover:border-emerald-500 hover:shadow-md hover:-translate-y-0.5";
                                        textClass = "text-emerald-700";
                                    }

                                    return (
                                        <button
                                            key={bedId}
                                            onClick={() => !disabled && setTargetBedId(String(bedId))}
                                            disabled={disabled}
                                            className={`p-3 rounded-xl transition-all duration-200 text-left relative overflow-hidden group ${cardClass}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex items-center gap-1">
                                                    <BedDouble size={16} className={disabled ? 'text-slate-400' : isSelected ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}/>
                                                    <span className={`text-xs font-bold ${textClass}`}>№{bedId}</span>
                                                </div>
                                                <span className="text-[9px] uppercase font-bold text-slate-400 bg-white/50 px-1 rounded">
                                                    {bedId % 2 === 0 ? 'Верх' : 'Низ'}
                                                </span>
                                            </div>
                                            <div className={`text-xs font-medium truncate ${status === 'timeout' ? 'text-slate-500' : textClass}`}>
                                                {statusText}
                                            </div>
                                            {isSelected && (
                                                <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-600 rounded-full shadow-sm"></div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-200 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-white text-sm transition-colors">
                        Отмена
                    </button>
                    <button 
                        onClick={handleMove} 
                        disabled={!targetBedId}
                        className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 text-sm shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        Переместить
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MoveGuestModal;
