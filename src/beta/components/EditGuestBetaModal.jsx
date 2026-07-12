import React, { useState } from 'react';
import { X, Pencil } from 'lucide-react';
import { COUNTRIES } from '../../constants/countries';

/**
 * Правка данных гостя в стиле беты. Запись — через родной handleGuestUpdate
 * (он же снимает пометку «ошибка паспорта» e-mehmon при исправлении данных).
 */
const FIELDS = [
    { key: 'fullName', label: 'ФИО', type: 'text' },
    { key: 'passport', label: 'Паспорт', type: 'text' },
    { key: 'phone', label: 'Телефон', type: 'text' },
    { key: 'country', label: 'Гражданство', type: 'country' },
    { key: 'birthDate', label: 'Дата рождения', type: 'date' },
    { key: 'passportIssueDate', label: 'Паспорт выдан', type: 'date' },
    { key: 'kppDate', label: 'Дата КПП', type: 'date' },
];

const EditGuestBetaModal = ({ guest: g, onSubmit, onClose }) => {
    const [f, setF] = useState(() => Object.fromEntries(FIELDS.map(x => [x.key, g[x.key] || ''])));
    const [busy, setBusy] = useState(false);

    const changed = FIELDS.some(x => (f[x.key] || '') !== (g[x.key] || ''));

    const submit = async () => {
        if (!changed || busy || !f.fullName.trim()) return;
        setBusy(true);
        try {
            const patch = {};
            FIELDS.forEach(x => { if ((f[x.key] || '') !== (g[x.key] || '')) patch[x.key] = f[x.key]; });
            await onSubmit(g.id, patch);
            onClose();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[170] flex items-center justify-center px-4"
            style={{ background: 'rgba(8,18,20,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
            <div role="dialog" aria-modal="true" aria-label="Правка данных гостя"
                className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">

                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                    <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center"><Pencil size={15} /></span>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-black text-slate-800 truncate">Данные гостя · {g.fullName}</div>
                        <div className="text-[11px] text-slate-400">исправление паспорта снимет пометку ошибки E-mehmon</div>
                    </div>
                    <button onClick={onClose} disabled={busy} aria-label="Закрыть" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="px-5 py-4 grid grid-cols-2 gap-2.5">
                    {FIELDS.map(x => (
                        <div key={x.key} className={x.key === 'fullName' ? 'col-span-2' : ''}>
                            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 ml-1">{x.label}</span>
                            <input
                                type={x.type === 'date' ? 'date' : 'text'}
                                list={x.type === 'country' ? 'edit-countries' : undefined}
                                value={f[x.key]}
                                onChange={e => setF(prev => ({ ...prev, [x.key]: e.target.value }))}
                                className="w-full rounded-lg border border-slate-200 focus:border-orange-300 px-3 py-2 text-[13px] text-slate-700 outline-none transition-colors" />
                        </div>
                    ))}
                    <datalist id="edit-countries">{COUNTRIES.map(c => <option key={c} value={c} />)}</datalist>
                </div>

                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex gap-2">
                    <button onClick={onClose} disabled={busy}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 border border-slate-200 bg-white hover:bg-slate-100 transition-colors">
                        Отмена
                    </button>
                    <button onClick={submit} disabled={!changed || busy || !f.fullName.trim()}
                        className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40 transition-colors">
                        {busy ? 'Сохраняю…' : changed ? 'Сохранить изменения' : 'Изменений нет'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditGuestBetaModal;
