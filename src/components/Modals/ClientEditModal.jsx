import { useState } from 'react';
import TRANSLATIONS from '../../constants/translations';
import { COUNTRIES } from '../../constants/countries';
import Button from '../UI/Button';

const inputClass = "w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm shadow-sm font-medium text-slate-700 no-spinner";
const labelClass = "block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide ml-1";

const ClientEditModal = ({ client, onClose, onSave, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [form, setForm] = useState({ ...client });
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
                <h3 className="font-bold text-lg mb-4">{t('edit')}</h3>
                <div className="space-y-3">
                    <div>
                        <label className={labelClass}>{t('guestName')}</label>
                        <input className={inputClass} value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value.toUpperCase()})} />
                    </div>
                    <div>
                        <label className={labelClass}>{t('passport')}</label>
                        <input className={inputClass} value={form.passport} onChange={e => setForm({...form, passport: e.target.value.toUpperCase()})} />
                    </div>
                    <div>
                        <label className={labelClass}>{t('birthDate')}</label>
                        <input type="date" className={inputClass} value={form.birthDate} onChange={e => setForm({...form, birthDate: e.target.value})} />
                    </div>
                    <div>
                        <label className={labelClass}>{t('country')}</label>
                        <select className={inputClass} value={form.country} onChange={e => setForm({...form, country: e.target.value})}>
                            {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Статус клиента</label>
                        <select
                            className={inputClass}
                            value={form.clientStatus || 'normal'}
                            onChange={e => setForm({...form, clientStatus: e.target.value})}
                        >
                            <option value="normal">Обычный</option>
                            <option value="vip">⭐ VIP</option>
                            <option value="warning">⚠️ Предупреждение</option>
                            <option value="blacklist">🚫 Чёрный список</option>
                        </select>
                    </div>
                    <Button onClick={() => onSave(form)}>{t('save')}</Button>
                    <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
                </div>
            </div>
        </div>
    );
};

export default ClientEditModal;
