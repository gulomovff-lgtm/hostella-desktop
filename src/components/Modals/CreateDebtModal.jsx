import { useState } from 'react';
import TRANSLATIONS from '../../constants/translations';
import Button from '../UI/Button';

const inputClass = "w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm shadow-sm font-medium text-slate-700 no-spinner";
const labelClass = "block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide ml-1";

const CreateDebtModal = ({ clients, onClose, onCreate, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [search, setSearch] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [amount, setAmount] = useState('');

    const filteredClients = clients.filter(c =>
        (c.fullName.toLowerCase().includes(search.toLowerCase()) ||
        c.passport.toLowerCase().includes(search.toLowerCase()))
    ).slice(0, 5);

    const handleSubmit = () => {
        if (!selectedClient || !amount) return;
        onCreate(selectedClient, parseInt(amount));
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
                <h3 className="font-bold text-lg mb-4">{t('createDebt')}</h3>
                <div className="space-y-4">
                    <div className="relative">
                        <label className={labelClass}>Search Client</label>
                        <input className={inputClass} value={search} onChange={e => { setSearch(e.target.value); setSelectedClient(null); }} placeholder="Name or Passport" />
                        {search.length > 1 && !selectedClient && (
                            <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 z-50 max-h-40 overflow-y-auto">
                                {filteredClients.map(c => (
                                    <div key={c.id} onClick={() => { setSelectedClient(c); setSearch(c.fullName); }} className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0">
                                        <div className="font-bold text-sm">{c.fullName}</div>
                                        <div className="text-xs text-slate-500">{c.passport}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {selectedClient && (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm">
                            Selected: <b>{selectedClient.fullName}</b> ({selectedClient.passport})
                        </div>
                    )}
                    <div>
                        <label className={labelClass}>Debt Amount</label>
                        <input type="number" className={inputClass} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
                    </div>
                    <Button onClick={handleSubmit} disabled={!selectedClient || !amount} className="w-full">{t('save')}</Button>
                    <Button variant="secondary" onClick={onClose} className="w-full">{t('cancel')}</Button>
                </div>
            </div>
        </div>
    );
};

export default CreateDebtModal;
