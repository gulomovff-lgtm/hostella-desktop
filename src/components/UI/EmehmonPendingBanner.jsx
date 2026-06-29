import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Plane, Check } from 'lucide-react';

// Глобальный баннер «хвостов» e-mehmon: гости, помеченные как зарегистрированные,
// выселены, но ещё не выведены из e-mehmon (за последние 30 дней).
// Виден на любой вкладке всем ролям — чтобы не забыть оформить убытие.
const EmehmonPendingBanner = ({ guests = [], onDepart, onDone, onOpen, checkingId = null }) => {
  const [open, setOpen] = useState(true);

  const pending = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    return (guests || [])
      .filter(g => g.emehmonReg && !g.emehmonOut && g.status === 'checked_out' &&
        (!g.checkOutDate || new Date(g.checkOutDate).getTime() >= cutoff))
      .sort((a, b) => new Date(b.checkOutDate || 0) - new Date(a.checkOutDate || 0));
  }, [guests]);

  if (!pending.length) return null;

  return (
    <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-3 md:px-6 py-2">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left text-amber-800">
        <Plane size={15} className="shrink-0" />
        <span className="font-black text-sm">Вывести из e-mehmon ({pending.length})</span>
        <span className="text-xs text-amber-600 hidden sm:inline">— выселены, но не выведены</span>
        {open ? <ChevronUp size={16} className="ml-auto" /> : <ChevronDown size={16} className="ml-auto" />}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-1.5 max-h-44 overflow-y-auto">
          {pending.map(g => (
            <div key={g.id} className="flex items-center gap-2 bg-white rounded-lg border border-amber-100 px-3 py-1.5">
              <button onClick={() => onOpen?.(g)} className="flex-1 min-w-0 text-left">
                <span className="text-sm font-bold text-slate-800 truncate">{g.fullName}</span>
                {g.roomNumber && <span className="text-xs text-slate-400"> · ком. {g.roomNumber}</span>}
                {g.checkOutDate && <span className="text-[11px] text-slate-400"> · выехал {new Date(g.checkOutDate).toLocaleDateString('ru-RU')}</span>}
              </button>
              {window.electronAPI?.openEmehmon && (
                <button onClick={() => onDepart?.(g)}
                  className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500 text-white text-xs font-bold hover:bg-rose-600">
                  <Plane size={11} /> Вывести
                </button>
              )}
              <button onClick={() => onDone?.(g)} disabled={checkingId === g.id}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 disabled:opacity-50">
                <Check size={11} /> {checkingId === g.id ? 'Проверка…' : 'Готово'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmehmonPendingBanner;
