import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const pad = n => String(n).padStart(2, '0');
const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDisplay = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return '';
    return `${pad(d)} ${MONTHS_SHORT[m - 1]} ${y}`;
};

/**
 * Современный date-picker (без сторонних зависимостей).
 * @param {string} value   — дата в формате YYYY-MM-DD
 * @param {(d:string)=>void} onChange
 */
export default function DatePicker({ value, onChange, placeholder = 'Дата', className = '' }) {
    const [open, setOpen] = useState(false);
    const [alignRight, setAlignRight] = useState(false);
    const [view, setView] = useState(() => (value ? new Date(value + 'T00:00:00') : new Date()));
    const ref = useRef(null);
    const dk = document.documentElement.dataset.theme === 'dark';

    // Открыть и выбрать сторону раскрытия, чтобы календарь не уходил за край экрана
    const toggleOpen = () => {
        setOpen(o => {
            const next = !o;
            if (next && ref.current) {
                const rect = ref.current.getBoundingClientRect();
                setAlignRight(rect.left + 292 > window.innerWidth - 8);
            }
            return next;
        });
    };

    useEffect(() => { if (value) setView(new Date(value + 'T00:00:00')); }, [value]);
    useEffect(() => {
        if (!open) return;
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        document.addEventListener('touchstart', h);
        return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
    }, [open]);

    const year = view.getFullYear(), month = view.getMonth();
    const startOffset = (new Date(year, month, 1).getDay() + 6) % 7; // понедельник первым
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayISO = toISO(new Date());

    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const pick = (d) => { onChange(toISO(new Date(year, month, d))); setOpen(false); };

    return (
        <div className="relative" ref={ref}>
            <button type="button" onClick={toggleOpen} className={`${className} flex items-center justify-between gap-2 text-left`}>
                <span className={value ? '' : 'text-slate-400'}>{value ? fmtDisplay(value) : placeholder}</span>
                <Calendar size={15} className="text-slate-400 shrink-0" />
            </button>
            {open && (
                <div className={`absolute ${alignRight ? 'right-0' : 'left-0'} z-[60] mt-2 p-3 rounded-2xl shadow-2xl border w-[284px] max-w-[90vw]`}
                    style={{ background: dk ? '#1e293b' : '#fff', borderColor: dk ? '#334155' : '#e2e8f0' }}>
                    {/* Навигация по месяцам */}
                    <div className="flex items-center justify-between mb-2.5">
                        <button type="button" onClick={() => setView(new Date(year, month - 1, 1))}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-500 transition-colors"><ChevronLeft size={18} /></button>
                        <span className="text-sm font-black" style={{ color: dk ? '#e2e8f0' : '#1e293b' }}>{MONTHS[month]} {year}</span>
                        <button type="button" onClick={() => setView(new Date(year, month + 1, 1))}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-slate-500 transition-colors"><ChevronRight size={18} /></button>
                    </div>
                    {/* Дни недели */}
                    <div className="grid grid-cols-7 gap-1 mb-1">
                        {WD.map((w, i) => <div key={w} className={`text-center text-[10px] font-bold ${i >= 5 ? 'text-rose-300' : 'text-slate-400'}`}>{w}</div>)}
                    </div>
                    {/* Сетка дней */}
                    <div className="grid grid-cols-7 gap-1">
                        {cells.map((d, i) => {
                            if (!d) return <div key={i} />;
                            const iso = toISO(new Date(year, month, d));
                            const isSel = iso === value;
                            const isToday = iso === todayISO;
                            const isWeekend = ((startOffset + d - 1) % 7) >= 5;
                            return (
                                <button key={i} type="button" onClick={() => pick(d)}
                                    className={`h-8 rounded-lg text-sm font-semibold transition-all active:scale-90 ${
                                        isSel ? 'bg-indigo-600 text-white shadow-sm'
                                        : isToday ? 'ring-1 ring-indigo-400 text-indigo-600'
                                        : isWeekend ? 'text-rose-400 hover:bg-indigo-50'
                                        : 'hover:bg-indigo-50'}`}
                                    style={!isSel && !isToday && !isWeekend ? { color: dk ? '#cbd5e1' : '#334155' } : undefined}>
                                    {d}
                                </button>
                            );
                        })}
                    </div>
                    {/* Быстро: сегодня */}
                    <button type="button" onClick={() => { onChange(todayISO); setOpen(false); }}
                        className="mt-2.5 w-full py-2 rounded-xl text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                        Сегодня
                    </button>
                </div>
            )}
        </div>
    );
}
