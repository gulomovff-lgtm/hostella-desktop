import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ArrowRight, User } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

const GlobalSearch = ({ isOpen, onClose, guests, rooms, onSelectGuest, onSelectRoom, lang }) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef(null);
    const t = (k) => TRANSLATIONS[lang][k];

    // Фокус при открытии
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current.focus(), 50);
        }
    }, [isOpen]);

    // Закрытие по Escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Логика поиска
    const results = useMemo(() => {
        if (!query || query.length < 2) return { guests: [], rooms: [] };

        const lowerQ = query.toLowerCase();

        // Deduplicate: for each unique person (fullName+passport), keep the most relevant record
        const statusPriority = { active: 0, booking: 1, checked_out: 2 };
        const personMap = new Map();
        guests.forEach(g => {
            const name = (g.fullName || g.name || '').toLowerCase();
            const passport = (g.passport || '').toLowerCase();
            if (!name.includes(lowerQ) && !passport.includes(lowerQ)) return;
            const key = (name + '|' + passport);
            const existing = personMap.get(key);
            const prio = statusPriority[g.status] ?? 3;
            const existingPrio = existing ? (statusPriority[existing.status] ?? 3) : 99;
            if (!existing || prio < existingPrio) personMap.set(key, g);
        });
        // personMap already deduplicates: active beats booking beats checked_out.
        // If checked_out remains in map → no active/booking record exists for that person → show it.
        const foundGuests = [...personMap.values()]
            .sort((a, b) => (statusPriority[a.status] ?? 3) - (statusPriority[b.status] ?? 3))
            .slice(0, 10);

        const foundRooms = rooms.filter(r =>
            String(r.number).includes(lowerQ)
        ).slice(0, 3);

        return { guests: foundGuests, rooms: foundRooms };
    }, [query, guests, rooms]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="w-full max-w-xl bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden transform transition-all scale-100"
                onClick={e => e.stopPropagation()}
            >
                {/* Input Area */}
                <div className="flex items-center px-4 py-4 border-b border-slate-200/60">
                    <Search className="text-slate-400 mr-3" size={24} />
                    <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent text-xl font-bold text-slate-800 placeholder:text-slate-400 outline-none"
                        placeholder="Поиск гостя (имя, паспорт) или комнаты..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold px-2 py-1 rounded-lg transition-colors">
                        ESC
                    </button>
                </div>

                {/* Results Area */}
                <div className="max-h-[60vh] overflow-y-auto bg-slate-50/50">
                    {results.guests.length === 0 && results.rooms.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            {query.length < 2 ? 'Введите минимум 2 символа' : 'Ничего не найдено'}
                        </div>
                    ) : (
                        <div className="p-2 space-y-4">
                            {/* Rooms Section */}
                            {results.rooms.length > 0 && (
                                <div>
                                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Комнаты</div>
                                    {results.rooms.map(room => (
                                        <button
                                            key={room.id}
                                            onClick={() => { onSelectRoom(room); onClose(); }}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-50 hover:border-indigo-100 border border-transparent transition-all group text-left"
                                        >
                                            <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-black text-slate-700 shadow-sm group-hover:scale-110 transition-transform">
                                                {room.number}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-bold text-slate-800">Комната №{room.number}</div>
                                                <div className="text-xs text-slate-500">{room.capacity} мест • {parseInt(room.price).toLocaleString()} сум</div>
                                            </div>
                                            <ArrowRight size={18} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"/>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Guests Section */}
                            {results.guests.length > 0 && (
                                <div>
                                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Гости</div>
                                    {results.guests.map(guest => {
                                        const isOld = guest.status === 'checked_out';
                                        const isBooking = guest.status === 'booking';
                                        const displayName = guest.fullName || guest.name || '—';
                                        return (
                                            <button
                                                key={guest.id}
                                                onClick={() => { onSelectGuest(guest); onClose(); }}
                                                className={`w-full flex items-center gap-3 p-3 rounded-xl border border-transparent transition-all group text-left
                                                    ${isOld ? 'hover:bg-slate-100 hover:border-slate-200' : isBooking ? 'hover:bg-amber-50 hover:border-amber-100 bg-white/40' : 'hover:bg-white hover:shadow-md hover:border-indigo-100 bg-white/40'}
                                                `}
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm
                                                    ${isOld ? 'bg-slate-200 text-slate-500' : isBooking ? 'bg-amber-100 text-amber-600' : 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'}
                                                `}>
                                                    <User size={18}/>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-center">
                                                        <span className={`font-bold ${isOld ? 'text-slate-600' : 'text-slate-900'}`}>{displayName}</span>
                                                        {isOld && <span className="text-[10px] bg-slate-200 px-1.5 rounded text-slate-500 font-bold">Архив</span>}
                                                        {isBooking && <span className="text-[10px] bg-amber-100 px-1.5 rounded text-amber-700 font-bold">Бронь</span>}
                                                    </div>
                                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                                        {guest.passport && <span>{guest.passport}</span>}
                                                        {guest.passport && <span>•</span>}
                                                        <span>{isBooking ? `${guest.checkInDate ? new Date(guest.checkInDate).toLocaleDateString('ru',{day:'numeric',month:'short'}) : ''}` : `Комната ${guest.roomNumber}`}</span>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Hint */}
                <div className="px-4 py-2 bg-slate-100/50 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400 font-bold">
                    <span>Перемещение: ↑ ↓</span>
                    <span>Выбрать: Enter</span>
                </div>
            </div>
        </div>
    );
};

export default GlobalSearch;
