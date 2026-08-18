import React, { useState } from 'react';
import { Building, X } from 'lucide-react';
import { HOSTELS } from '../../../utils/helpers';
import { getConfig } from '../../../utils/appConfig';
import { inp } from './shared';

const CadastreManageModal = ({ cadastre, onClose, onSubmit, selectedHostelFilter }) => {
  const [name, setName] = useState(cadastre?.name || '');
  const [address, setAddress] = useState(cadastre?.address || '');
  const [owner, setOwner] = useState(cadastre?.owner || '');
  const [phone, setPhone] = useState(cadastre?.phone || '');
  const [dailyRate, setDailyRate] = useState(cadastre?.dailyRate || getConfig().registrationDailyRate || '');
  const [hostelId, setHostelId] = useState(cadastre?.hostelId || (selectedHostelFilter === 'all' ? 'hostel1' : selectedHostelFilter) || 'hostel1');

  const submit = () => {
    if (!address.trim()) return;
    onSubmit({ name, address, owner, phone, dailyRate: Number(dailyRate) || 0, hostelId });
    onClose();
  };

  return (
    <div className="modal-centered fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 pb-[84px] sm:pb-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center"><Building size={15} className="text-teal-600" /></div>
            <h3 className="font-black text-base text-slate-800">{cadastre ? 'Редактировать кадастр' : 'Добавить кадастр'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Название / Кадастр №</label>
            <input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Дом Алишера, Кадастр №5..." />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Адрес *</label>
            <input className={inp} value={address} onChange={e => setAddress(e.target.value)} placeholder="Ташкент, ул. Навои, 12" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Владелец</label>
            <input className={inp} value={owner} onChange={e => setOwner(e.target.value)} placeholder="ФИО владельца" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Телефон владельца</label>
            <input className={inp} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+998..." />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Суточная ставка регистрации (сум)</label>
            <input className={inp} type="number" value={dailyRate} onChange={e => setDailyRate(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Хостел</label>
            <select className={inp} value={hostelId} onChange={e => setHostelId(e.target.value)}>
              {Object.entries(HOSTELS).map(([k, v]) => (
                <option key={k} value={k}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">Отмена</button>
          <button onClick={submit} disabled={!address.trim()}
            className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-40">
            {cadastre ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── RemoveConfirmModal ──────────────────────────────────────────────────────

export default CadastreManageModal;
