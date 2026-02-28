import React, { useState } from 'react';
import TRANSLATIONS from '../../constants/translations';
import Button from '../UI/Button';

// --- Styles ---
const inputClass = "w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm shadow-sm font-medium text-slate-700 no-spinner";
const labelClass = "block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide ml-1";

// --- RoomFormModal ---
const RoomFormModal = ({ title, initialData = {}, onClose, onSubmit, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [form, setForm] = useState({ 
        number: initialData.number || '', 
        capacity: initialData.capacity || '4', 
        prices: initialData.prices || { lower: 0, upper: 0 },
        bookingName: initialData.bookingName || '',
    });
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
                <h3 className="font-bold text-lg mb-6">{title}</h3>
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>{t('room')}</label>
                        <input className={inputClass} value={form.number} onChange={e => setForm({...form, number: e.target.value})} />
                    </div>
                    <div>
                        <label className={labelClass}>{t('bed')}</label>
                        <input type="number" className={inputClass} value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>{t('price')} (Down)</label>
                            <input type="number" className={inputClass} value={form.prices.lower} onChange={e => setForm({...form, prices: {...form.prices, lower: e.target.value}})} />
                        </div>
                        <div>
                            <label className={labelClass}>{t('price')} (Up)</label>
                            <input type="number" className={inputClass} value={form.prices.upper} onChange={e => setForm({...form, prices: {...form.prices, upper: e.target.value}})} />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass} style={{display:'flex', alignItems:'center', gap:6}}>
                            <span style={{background:'#003580',color:'#fff',fontSize:9,fontWeight:900,padding:'1px 6px',borderRadius:4}}>booking</span>
                            Уникальное название (необязательно)
                        </label>
                        <input
                            className={inputClass}
                            value={form.bookingName}
                            onChange={e => setForm({...form, bookingName: e.target.value})}
                            placeholder="напр. Bed in Dorm"
                        />
                        <p style={{fontSize:10,color:'#94a3b8',marginTop:4,marginLeft:4}}>
                            Booking.com → Комнаты → Редактировать → «Уникальное название».
                            Используется для супоставления броней из iCal.
                        </p>
                    </div>
                    <Button onClick={() => onSubmit(form)} className="w-full mt-4">{t('save')}</Button>
                    <Button variant="secondary" onClick={onClose} className="w-full">{t('cancel')}</Button>
                </div>
            </div>
        </div>
    );
};

export default RoomFormModal;
