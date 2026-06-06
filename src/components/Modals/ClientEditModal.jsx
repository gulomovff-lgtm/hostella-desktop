import { useState } from 'react';
import { X, UserCog, FileText, Calendar, Phone, MapPin, ShieldCheck } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { COUNTRIES } from '../../constants/countries';

const BRAND = '#0f9688';
const inputClass = "w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-sm font-medium text-slate-700 no-spinner";
const labelClass = "flex items-center gap-1.5 text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wide";

const STATUS_OPTS = [
    { v: 'normal',    l: 'Обычный' },
    { v: 'vip',       l: '⭐ VIP' },
    { v: 'warning',   l: '⚠️ Предупреждение' },
    { v: 'blacklist', l: '🚫 Чёрный список' },
];

const ClientEditModal = ({ client, onClose, onSave, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [form, setForm] = useState({ ...client });
    const initials = (form.fullName || '').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black shrink-0" style={{ background: BRAND }}>{initials}</div>
                        <div className="min-w-0">
                            <div className="font-black text-slate-800 leading-tight">Редактировать клиента</div>
                            <div className="text-xs text-slate-400 truncate">{client.fullName || '—'}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={18}/></button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-3.5">
                    <div>
                        <label className={labelClass}><UserCog size={12}/> {t('guestName')}</label>
                        <input className={inputClass} value={form.fullName || ''} onChange={e => set('fullName', e.target.value)} onBlur={e => set('fullName', e.target.value.toUpperCase())} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}><FileText size={12}/> {t('passport')}</label>
                            <input className={inputClass} value={form.passport || ''} onChange={e => set('passport', e.target.value.toUpperCase())} />
                        </div>
                        <div>
                            <label className={labelClass}><Calendar size={12}/> {t('birthDate')}</label>
                            <input type="date" className={inputClass} value={form.birthDate || ''} onChange={e => set('birthDate', e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}><Phone size={12}/> Телефон</label>
                            <input className={inputClass} value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="+998 ..." />
                        </div>
                        <div>
                            <label className={labelClass}><MapPin size={12}/> {t('country')}</label>
                            <select className={inputClass} value={form.country || 'Узбекистан'} onChange={e => set('country', e.target.value)}>
                                {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}><ShieldCheck size={12}/> Статус клиента</label>
                        <div className="grid grid-cols-2 gap-2">
                            {STATUS_OPTS.map(o => {
                                const active = (form.clientStatus || 'normal') === o.v;
                                return (
                                    <button key={o.v} type="button" onClick={() => set('clientStatus', o.v)}
                                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${active ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                                        style={active ? { background: BRAND } : {}}>
                                        {o.l}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-5 py-4 border-t border-slate-100">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-colors">{t('cancel')}</button>
                    <button onClick={() => onSave(form)} className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition-opacity hover:opacity-90" style={{ background: BRAND }}>{t('save')}</button>
                </div>
            </div>
        </div>
    );
};

export default ClientEditModal;
