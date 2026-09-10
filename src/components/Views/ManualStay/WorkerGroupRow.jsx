import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import TRANSLATIONS from '../../../constants/translations';

const WorkerGroupRow = ({ wg, wgIdx, onUpdate, onRemove, options = [], lang = 'ru' }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const [specialty, setSpecialty] = useState(wg.specialty || '');
    const [count, setCount] = useState(wg.count || '');
    useEffect(() => { setSpecialty(wg.specialty || ''); }, [wg.specialty]);
    useEffect(() => { setCount(wg.count || ''); }, [wg.count]);
    const listId = `spec-list-${wg.id || wgIdx}`;
    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] w-4 text-right shrink-0" style={{ color: 'rgba(94,234,212,0.4)' }}>{wgIdx + 1}.</span>
            <input
                value={specialty}
                list={options.length ? listId : undefined}
                onChange={e => setSpecialty(e.target.value)}
                onBlur={() => { if (specialty !== (wg.specialty || '')) onUpdate({ specialty }); }}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                placeholder={t('wgrSpecPlaceholder')}
                className="flex-1 px-2 py-1 text-[11px] rounded-lg focus:outline-none"
                style={{ border: '1px solid rgba(94,234,212,0.2)', background: 'rgba(94,234,212,0.06)', color: '#e2f7f8' }}
            />
            {options.length > 0 && (
                <datalist id={listId}>
                    {options.map(o => <option key={o} value={o} />)}
                </datalist>
            )}
            <input
                type="number" min="0"
                value={count}
                onChange={e => setCount(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={() => { if (String(count) !== String(wg.count || '')) onUpdate({ count }); }}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                placeholder="0"
                className="w-14 px-1.5 py-1 text-[11px] rounded-lg focus:outline-none text-center font-semibold"
                style={{ border: '1px solid rgba(94,234,212,0.2)', background: 'rgba(94,234,212,0.06)', color: '#e2f7f8' }}
            />
            <span className="text-[10px] shrink-0" style={{ color: 'rgba(94,234,212,0.4)' }}>{t('msPeopleWord')}</span>
            <button onClick={onRemove}
                className="w-5 h-5 rounded-lg flex items-center justify-center transition-colors shrink-0"
                style={{ color: 'rgba(94,234,212,0.3)' }}
                onMouseEnter={e => e.currentTarget.style.color='#f87171'} onMouseLeave={e => e.currentTarget.style.color='rgba(94,234,212,0.3)'}>
                <X size={10} />
            </button>
        </div>
    );
};

// ── Числовой инпут с локальным стейтом (запись по blur, без зависания) ──────

export default WorkerGroupRow;
