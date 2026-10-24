import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import TRANSLATIONS from '../../../constants/translations';

const RoomPicker = ({ rooms, selected, onChange, lang = 'ru' }) => {
    const t = k => TRANSLATIONS[lang]?.[k] || k;
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const selSet = new Set(selected);
    const toggle = (id) => {
        const next = new Set(selSet);
        if (next.has(id)) next.delete(id); else next.add(id);
        onChange([...next]);
    };

    const label = selected.length === 0
        ? t('roomsWord')
        : rooms.filter(r => selSet.has(r.id)).map(r => `№${r.number}`).join(', ');

    const btnRef = useRef(null);
    const [dropPos, setDropPos] = useState({ top: 0, left: 0 });

    const handleOpen = () => {
        if (!open && btnRef.current) {
            const r = btnRef.current.getBoundingClientRect();
            setDropPos({ top: r.bottom + 4, left: r.left }); // fixed — координаты окна, без scroll
        }
        setOpen(v => !v);
    };

    return (
        <div className="relative" ref={ref}>
            <button
                ref={btnRef}
                type="button"
                onClick={handleOpen}
                className={`w-full flex items-center justify-between gap-1.5 px-3 py-2 text-sm rounded-xl border transition-all ${open ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
            >
                <span className={`truncate font-semibold ${selected.length === 0 ? 'text-slate-400' : ''}`}>{selected.length === 0 ? t('mslChooseRooms') : label}</span>
                <ChevronDown size={14} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="fixed z-[230] bg-white border border-slate-200 rounded-xl shadow-xl p-2 min-w-[190px] max-h-60 overflow-y-auto" style={{ top: dropPos.top, left: dropPos.left }}>
                    {rooms.length === 0
                        ? <div className="text-xs text-slate-400 px-2 py-1.5">{t('msmNoRooms')}</div>
                        : rooms.map(room => {
                            const checked = selSet.has(room.id);
                            return (
                                <button
                                    key={room.id}
                                    type="button"
                                    onClick={() => toggle(room.id)}
                                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors ${checked ? 'bg-teal-50 text-teal-900' : 'hover:bg-slate-50 text-slate-700'}`}
                                >
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'border-teal-500 bg-teal-500' : 'border-slate-300'}`}>
                                        {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                                    </div>
                                    <span className="font-semibold">№{room.number}</span>
                                    {room.name ? <span className="text-slate-400 truncate">{room.name}</span> : null}
                                </button>
                            );
                        })
                    }
                </div>
            )}
        </div>
    );
};

// ── Модал оплаты ────────────────────────────────────────────────────────────

export default RoomPicker;
