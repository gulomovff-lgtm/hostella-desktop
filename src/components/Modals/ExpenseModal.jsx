import React, { useState, useRef } from 'react';
import { X, Camera, ImageIcon, Trash2 } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

const ExpenseModal = ({ onClose, onSubmit, lang, currentUser }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [category, setCategory] = useState('');
    const [amount, setAmount] = useState('');
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [photoUploading, setPhotoUploading] = useState(false);
    const fileRef = useRef();

    const CAT_LIST = [
        { key: 'Аренда',              icon: '🏠', bg: '#ede9fe', text: '#6d28d9' },
        { key: 'Коммунальные услуги', icon: '💡', bg: '#e0f2fe', text: '#0369a1' },
        { key: 'Зарплата',            icon: '💼', bg: '#eef2ff', text: '#4338ca' },
        { key: 'Продукты',            icon: '🛒', bg: '#dcfce7', text: '#15803d' },
        { key: 'Канцелярия',          icon: '📎', bg: '#f1f5f9', text: '#475569' },
        { key: 'Ремонт',              icon: '🔧', bg: '#ffedd5', text: '#c2410c' },
        { key: 'Интернет',            icon: '🌐', bg: '#ccfbf1', text: '#0f766e' },
        { key: 'Реклама',             icon: '📣', bg: '#fce7f3', text: '#be185d' },
        { key: 'Другое',              icon: '📦', bg: '#f8fafc', text: '#64748b' },
    ];

    const handlePhotoSelect = (file) => {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('Файл слишком большой (макс. 5 МБ)'); return; }
        setPhotoFile(file);
        const reader = new FileReader();
        reader.onload = (e) => setPhotoPreview(e.target.result);
        reader.readAsDataURL(file);
    };

    const uploadPhoto = async (file) => {
        try {
            const path = `expenses/${Date.now()}_${file.name}`;
            const sRef = storageRef(storage, path);
            await uploadBytes(sRef, file);
            return await getDownloadURL(sRef);
        } catch {
            // fallback: return base64 preview (works offline)
            return photoPreview;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!category || !amount) { alert('Заполните все обязательные поля'); return; }
        setLoading(true);
        try {
            let photoUrl = null;
            if (photoFile) {
                setPhotoUploading(true);
                photoUrl = await uploadPhoto(photoFile);
                setPhotoUploading(false);
            }
            await onSubmit({
                category, amount: parseFloat(amount), comment,
                date: new Date().toISOString(),
                staffId: currentUser.id || currentUser.login,
                hostelId: currentUser.hostelId,
                ...(photoUrl ? { photoUrl } : {}),
            });
        } finally {
            setLoading(false);
            setPhotoUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 sm:p-4">
            <div className="bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl border border-slate-200 w-full max-w-lg flex flex-col" style={{ maxHeight: '92dvh' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-rose-50 sm:rounded-t-2xl rounded-t-2xl flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-xl">💸</div>
                        <div>
                            <div className="font-black text-slate-800">Новый расход</div>
                            <div className="text-xs text-slate-400 font-semibold">Выберите категорию и укажите сумму</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-rose-100 text-slate-400 transition-colors" style={{ outline: 'none' }}>
                        <X size={18}/>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 space-y-5 overflow-y-auto flex-1">
                    {/* Category grid */}
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-2">Категория *</label>
                        <div className="grid grid-cols-3 gap-2">
                            {CAT_LIST.map(c => (
                                <button key={c.key} type="button"
                                    onClick={() => setCategory(c.key)}
                                    style={{
                                        outline: 'none',
                                        background: category === c.key ? c.bg : '#f8fafc',
                                        border: `2px solid ${category === c.key ? c.text : '#e2e8f0'}`,
                                        color: category === c.key ? c.text : '#64748b',
                                        borderRadius: 12, padding: '8px 4px',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                                        gap: 4, cursor: 'pointer', transition: 'all 0.15s',
                                        fontWeight: category === c.key ? 800 : 600,
                                    }}>
                                    <span style={{ fontSize: 20 }}>{c.icon}</span>
                                    <span style={{ fontSize: 10, lineHeight: 1.2, textAlign: 'center' }}>{c.key}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-2">Сумма (сум) *</label>
                        <input
                            type="text" inputMode="decimal" pattern="[0-9]*"
                            value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                            placeholder="0" required
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-rose-400 focus:ring-0 outline-none text-xl font-black text-slate-800 transition-colors"
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                        />
                    </div>

                    {/* Comment */}
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-2">Комментарий</label>
                        <textarea
                            value={comment} onChange={e => setComment(e.target.value)}
                            placeholder="Дополнительная информация..." rows={2}
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-rose-400 focus:ring-0 outline-none text-sm text-slate-700 resize-none transition-colors"
                        />
                    </div>

                    {/* Photo */}
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-wide mb-2">Фото чека / документа</label>
                        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                            onChange={e => handlePhotoSelect(e.target.files[0])}/>
                        {photoPreview ? (
                            <div className="relative rounded-xl overflow-hidden border-2 border-rose-200">
                                <img src={photoPreview} alt="чек" className="w-full max-h-40 object-cover"/>
                                <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                                    className="absolute top-2 right-2 w-7 h-7 bg-rose-500/90 text-white rounded-full flex items-center justify-center hover:bg-rose-600">
                                    <Trash2 size={13}/>
                                </button>
                            </div>
                        ) : (
                            <button type="button" onClick={() => fileRef.current?.click()}
                                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 hover:border-rose-300 hover:text-rose-500 transition-colors text-sm font-semibold">
                                <Camera size={18}/>
                                Сфотографировать чек
                            </button>
                        )}
                    </div>

                </div>
                    {/* Buttons — fixed at bottom */}
                    <div className="flex gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                            style={{ outline: 'none' }}>
                            Отмена
                        </button>
                        <button type="submit" disabled={!category || !amount || loading}
                            className="flex-[2] py-3 rounded-xl text-white text-sm font-black transition-colors shadow-sm disabled:opacity-50"
                            style={{ background: '#f43f5e', outline: 'none' }}>
                            {photoUploading ? '📸 Загрузка фото…' : loading ? '⏳ Сохранение…' : `💸 Добавить расход${category ? ` (${CAT_LIST.find(c => c.key === category)?.icon || ''})` : ''}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ExpenseModal;
