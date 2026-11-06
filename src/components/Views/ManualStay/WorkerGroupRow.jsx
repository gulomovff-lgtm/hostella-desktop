import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import TRANSLATIONS from '../../../constants/translations';
import { INP } from './shared';

// ── Строка специальности (локальный стейт → Firestore только onBlur) ──────
const WorkerGroupRow = ({ wg, wgIdx, onUpdate, onRemove, options = [], lang = 'ru' }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const [specialty, setSpecialty] = useState(wg.specialty || '');
    const [count, setCount] = useState(wg.count || '');
    useEffect(() => { setSpecialty(wg.specialty || ''); }, [wg.specialty]);
    useEffect(() => { setCount(wg.count || ''); }, [wg.count]);
    const listId = `spec-list-${wg.id || wgIdx}`;
    return (
        <div className="flex items-center gap-2">
            <span className="text-xs w-4 text-right shrink-0 text-slate-400 tabular-nums">{wgIdx + 1}.</span>
            <input
                value={specialty}
                list={options.length ? listId : undefined}
                onChange={e => setSpecialty(e.target.value)}
                onBlur={() => { if (specialty !== (wg.specialty || '')) onUpdate({ specialty }); }}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                placeholder={t('wgrSpecPlaceholder')}
                className={INP + ' flex-1 min-w-0'}
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
                className={INP + ' w-16 text-center font-bold tabular-nums'}
            />
            <span className="text-xs shrink-0 text-slate-500">{t('msPeopleWord')}</span>
            <button onClick={onRemove} title={t('mslRemoveSpecialty')}
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                <X size={14} />
            </button>
        </div>
    );
};

export default WorkerGroupRow;
