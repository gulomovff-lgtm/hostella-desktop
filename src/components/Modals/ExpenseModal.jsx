import React, { useState, useRef, useMemo, useCallback } from 'react';
import { X, Camera, ImageIcon, Trash2 } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

const CAT_LIST = [
    { key: 'Аренда',              icon: '🏠', bg: '#ede9fe', text: '#6d28d9' },
    { key: 'Коммунальные услуги', icon: '💡', bg: '#e0f2fe', text: '#0369a1' },
    { key: 'Зарплата',            icon: '💼', bg: '#eef2ff', text: '#4338ca' },
    { key: 'Продукты',            icon: '🛒', bg: '#dcfce7', text: '#15803d' },
    { key: 'Налоги',              icon: '🏛️', bg: '#f1f5f9', text: '#475569' },
    { key: 'Регистрация',          icon: '📋', bg: '#ffedd5', text: '#c2410c' },
    { key: 'Интернет',            icon: '🌐', bg: '#ccfbf1', text: '#0f766e' },
    { key: 'Реклама',             icon: '📣', bg: '#fce7f3', text: '#be185d' },
    { key: 'Другое',              icon: '📦', bg: '#f8fafc', text: '#64748b' },
];

const MODAL_STYLE = `
    @keyframes exp-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes exp-card-in { from { opacity: 0; transform: scale(0.96) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    .exp-backdrop { animation: exp-backdrop-in 0.2s ease forwards; }
    .exp-card { animation: exp-card-in 0.28s cubic-bezier(0.34,1.3,0.64,1) forwards; will-change: transform, opacity; }
    .exp-input:focus { border-color: #0f9688 !important; box-shadow: 0 0 0 3px rgba(15,150,136,0.12); }
    .exp-cat-btn:hover { transform: translateY(-1px); }
`;

const ExpenseModal = ({ onClose, onSubmit, lang, currentUser, initialCategory = '', usersList = [] }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';
    const getLocalDateTimeValue = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        return `${y}-${m}-${d}T${hh}:${mm}`;
    };

    const [category, setCategory] = useState(initialCategory);
    const [targetStaffId, setTargetStaffId] = useState('');
    const [amount, setAmount] = useState('');
    const [comment, setComment] = useState('');
    const [expenseDate, setExpenseDate] = useState(() => getLocalDateTimeValue());
    const [currency, setCurrency] = useState('uzs'); // 'uzs' | 'usd'
    const [usdAmount, setUsdAmount] = useState('');
    const [usdRate, setUsdRate] = useState('');
    const [skipCashbox, setSkipCashbox] = useState(false);
    const [loading, setLoading] = useState(false);
    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [photoUploading, setPhotoUploading] = useState(false);
    const fileRef = useRef();
    const dropRef = useRef();
    const [dragOver, setDragOver] = useState(false);
    const isDark = useMemo(() => document.documentElement.dataset.theme === 'dark', []);
    const maxExpenseDate = useMemo(() => getLocalDateTimeValue(), []);
    const canBackdate = isAdmin || currentUser?.login === 'fazliddin';
    const canSkipCashbox = currentUser?.login === 'fazliddin';

    // Вычисляем итоговую сумму в сумах
    const computedUzs = useMemo(() => {
        if (currency === 'usd') {
            const d = parseFloat(usdAmount);
            const r = parseFloat(usdRate);
            if (d > 0 && r > 0) return Math.round(d * r);
            return 0;
        }
        return parseFloat(amount) || 0;
    }, [currency, usdAmount, usdRate, amount]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) handlePhotoSelect(file);
    }, []);

    const handlePhotoSelect = (file) => {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('\u0424\u0430\u0439\u043b \u0441\u043b\u0438\u0448\u043a\u043e\u043c \u0431\u043e\u043b\u044c\u0448\u043e\u0439 (\u043c\u0430\u043a\u0441. 5 \u041c\u0411)'); return; }
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
            return photoPreview;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const finalAmount = currency === 'usd' ? computedUzs : parseFloat(amount);
        if (!category || !finalAmount || finalAmount <= 0) { alert('Заполните все обязательные поля (сумма должна быть больше 0)'); return; }
        if (currency === 'usd' && (!parseFloat(usdAmount) || !parseFloat(usdRate))) {
            alert('Укажите сумму в USD и курс обмена');
            return;
        }
        const parsedDate = expenseDate ? new Date(expenseDate) : null;
        if (canBackdate && (!parsedDate || Number.isNaN(parsedDate.getTime()))) {
            alert('Укажите корректную дату расхода');
            return;
        }
        setLoading(true);
        try {
            let photoUrl = null;
            if (photoFile) {
                setPhotoUploading(true);
                photoUrl = await uploadPhoto(photoFile);
                setPhotoUploading(false);
            }
            const usdNote = currency === 'usd' ? `$${usdAmount} × ${usdRate} = ${finalAmount.toLocaleString()} сум` : '';
            const finalComment = usdNote ? (comment ? `${usdNote} | ${comment}` : usdNote) : comment;
            await onSubmit({
                category, amount: finalAmount, comment: finalComment,
                ...(currency === 'usd' ? { usdAmount: parseFloat(usdAmount), usdRate: parseFloat(usdRate) } : {}),
                date: canBackdate ? parsedDate.toISOString() : new Date().toISOString(),
                staffId: currentUser.id || currentUser.login,
                ...(category === 'Зарплата' && targetStaffId ? { targetStaffId } : {}),
                hostelId: currentUser.hostelId,
                ...(skipCashbox ? { skipCashbox: true } : {}),
                ...(photoUrl ? { photoUrl } : {}),
            });
        } finally {
            setLoading(false);
            setPhotoUploading(false);
        }
    };

    return (
        <>
            <style>{MODAL_STYLE}</style>
            <div className="exp-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{ background: 'rgba(15,30,32,0.7)' }}>
                <div className="exp-card sm:rounded-2xl rounded-t-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: '92dvh', boxShadow: '0 32px 80px rgba(0,0,0,0.35)', background: isDark ? '#162a2e' : '#fff' }}>

                    {/* Dark header */}
                    <div style={{ background: '#1a3c40', padding: '22px 24px 20px', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: -30, right: -30, width: 110, height: 110, borderRadius: '50%', background: 'rgba(94,234,212,0.06)', pointerEvents: 'none' }}/>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 42, height: 42, borderRadius: 13, background: 'rgba(94,234,212,0.12)', border: '1px solid rgba(94,234,212,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>💸</div>
                                <div>
                                    <div style={{ color: '#e2f7f8', fontSize: 15, fontWeight: 800 }}>Новый расход</div>
                                    <div style={{ color: 'rgba(158,205,208,0.6)', fontSize: 11, marginTop: 2 }}>{currentUser?.name || currentUser?.login}</div>
                                </div>
                            </div>
                            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 9, padding: 8, cursor: 'pointer', color: '#9ecdd0', display: 'flex' }}
                                onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.12)'}
                                onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.07)'}>
                                <X size={16}/>
                            </button>
                        </div>
                        {category && (
                            <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.2)', borderRadius: 99, padding: '5px 12px' }}>
                                <span style={{ fontSize: 14 }}>{CAT_LIST.find(c => c.key === category)?.icon}</span>
                                <span style={{ color: '#5eead4', fontSize: 12, fontWeight: 700 }}>{category}</span>
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden" style={{ background: isDark ? '#162a2e' : '#fff' }}>
                        <div className="p-5 space-y-4 overflow-y-auto flex-1">

                            {/* Category grid */}
                            <div>
                                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Категория *</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {CAT_LIST.map(c => (
                                        <button key={c.key} type="button" className="exp-cat-btn"
                                            onClick={() => setCategory(c.key)}
                                            style={{
                                                outline: 'none', transition: 'all 0.15s',
                                                background: category === c.key ? c.bg : (isDark ? '#1e3a3e' : '#f8fafc'),
                                                border: `2px solid ${category === c.key ? c.text : (isDark ? 'rgba(94,234,212,0.15)' : '#e2e8f0')}`,
                                                color: category === c.key ? c.text : (isDark ? '#9ecdd0' : '#64748b'),
                                                borderRadius: 12, padding: '8px 4px',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                                gap: 4, cursor: 'pointer',
                                                fontWeight: category === c.key ? 800 : 600,
                                            }}>
                                            <span style={{ fontSize: 20 }}>{c.icon}</span>
                                            <span style={{ fontSize: 10, lineHeight: 1.2, textAlign: 'center' }}>{c.key}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Staff selector for Зарплата */}
                            {category === 'Зарплата' && usersList.length > 0 && (
                                <div>
                                    <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Сотрудник</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                                        {usersList.filter(u => u.role !== 'super').map(u => {
                                            const sel = targetStaffId === (u.id || u.login);
                                            return (
                                                <button key={u.id || u.login} type="button"
                                                    onClick={() => setTargetStaffId(sel ? '' : (u.id || u.login))}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 12, cursor: 'pointer', outline: 'none', transition: 'all 0.15s',
                                                        border: sel ? '2px solid #4338ca' : `2px solid ${isDark ? 'rgba(94,234,212,0.15)' : '#e2e8f0'}`,
                                                        background: sel ? '#eef2ff' : (isDark ? '#1e3a3e' : '#f8fafc'),
                                                    }}>
                                                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: sel ? '#4338ca' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                                                        {(u.name || u.login || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <span style={{ fontSize: 12, fontWeight: sel ? 800 : 600, color: sel ? '#4338ca' : (isDark ? '#9ecdd0' : '#475569'), lineHeight: 1.2 }}>
                                                        {u.name || u.login}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Amount */}
                            <div>
                                {/* Currency toggle */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <label style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                        {currency === 'uzs' ? 'Сумма (сум) *' : 'Сумма (USD) *'}
                                    </label>
                                    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: `1px solid ${isDark ? 'rgba(94,234,212,0.2)' : '#e2e8f0'}` }}>
                                        {[['uzs','UZS'],['usd','USD']].map(([v,l]) => (
                                            <button key={v} type="button" onClick={() => setCurrency(v)}
                                                style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                                                    background: currency === v ? '#0f9688' : (isDark ? '#1e3a3e' : '#f8fafc'),
                                                    color: currency === v ? '#fff' : (isDark ? '#9ecdd0' : '#64748b') }}>
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {currency === 'uzs' ? (
                                    <input
                                        type="text" inputMode="decimal" className="exp-input"
                                        value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                                        placeholder="0" required
                                        style={{ width: '100%', padding: '12px 16px', border: `2px solid ${isDark ? 'rgba(94,234,212,0.2)' : '#e2e8f0'}`, borderRadius: 12, outline: 'none', fontSize: 22, fontWeight: 900, color: isDark ? '#e2f7f8' : '#0f172a', background: isDark ? '#1e3a3e' : '#fff', boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                                    />
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                            <div>
                                                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Сумма $</label>
                                                <input type="text" inputMode="decimal" className="exp-input"
                                                    value={usdAmount} onChange={e => setUsdAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                                                    placeholder="0.00" required
                                                    style={{ width: '100%', padding: '10px 14px', border: `2px solid ${isDark ? 'rgba(94,234,212,0.2)' : '#e2e8f0'}`, borderRadius: 12, outline: 'none', fontSize: 20, fontWeight: 900, color: isDark ? '#e2f7f8' : '#0f172a', background: isDark ? '#1e3a3e' : '#fff', boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Курс (сум/$)</label>
                                                <input type="text" inputMode="decimal" className="exp-input"
                                                    value={usdRate} onChange={e => setUsdRate(e.target.value.replace(/[^0-9.]/g, ''))}
                                                    placeholder="12900" required
                                                    style={{ width: '100%', padding: '10px 14px', border: `2px solid ${isDark ? 'rgba(94,234,212,0.2)' : '#e2e8f0'}`, borderRadius: 12, outline: 'none', fontSize: 20, fontWeight: 900, color: isDark ? '#e2f7f8' : '#0f172a', background: isDark ? '#1e3a3e' : '#fff', boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                                                />
                                            </div>
                                        </div>
                                        {computedUzs > 0 && (
                                            <div style={{ background: isDark ? 'rgba(15,150,136,0.15)' : '#f0fdfa', border: '1.5px solid #99f6e4', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: 11, color: '#0f9688', fontWeight: 600 }}>Итого в сумах:</span>
                                                <span style={{ fontSize: 18, fontWeight: 900, color: '#0f9688', fontVariantNumeric: 'tabular-nums' }}>{computedUzs.toLocaleString()} сум</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Expense date */}
                            {canBackdate && (
                                <div>
                                    <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Дата расхода</label>
                                    <input
                                        type="datetime-local"
                                        className="exp-input"
                                        value={expenseDate}
                                        max={maxExpenseDate}
                                        onChange={e => setExpenseDate(e.target.value)}
                                        style={{ width: '100%', padding: '12px 16px', border: `2px solid ${isDark ? 'rgba(94,234,212,0.2)' : '#e2e8f0'}`, borderRadius: 12, outline: 'none', fontSize: 13, fontWeight: 600, color: isDark ? '#e2f7f8' : '#0f172a', background: isDark ? '#1e3a3e' : '#fff', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                                    />
                                </div>
                            )}

                            {canSkipCashbox && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: isDark ? '#d1f5f3' : '#334155' }}>
                                        <input type="checkbox" checked={skipCashbox} onChange={e => setSkipCashbox(e.target.checked)}
                                            style={{ width: 16, height: 16, accentColor: '#0f9688' }} />
                                        <span>Не вычитать с кассы</span>
                                    </label>
                                </div>
                            )}

                            {/* Comment */}
                            <div>
                                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Комментарий</label>
                                <textarea
                                    value={comment} onChange={e => setComment(e.target.value)}
                                    placeholder="Дополнительная информация..." rows={2} className="exp-input"
                                    style={{ width: '100%', padding: '12px 16px', border: `2px solid ${isDark ? 'rgba(94,234,212,0.2)' : '#e2e8f0'}`, borderRadius: 12, outline: 'none', fontSize: 13, color: isDark ? '#9ecdd0' : '#475569', background: isDark ? '#1e3a3e' : '#fff', resize: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s', fontFamily: 'inherit' }}
                                />
                            </div>

                            {/* Photo */}
                            <div>
                                <label style={{ display: 'block', fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Фото чека / документа</label>
                                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                                    onChange={e => handlePhotoSelect(e.target.files[0])}/>
                                {photoPreview ? (
                                    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '2px solid #99f6e4' }}>
                                        <img src={photoPreview} alt="чек" style={{ width: '100%', maxHeight: 140, objectFit: 'cover', display: 'block' }}/>
                                        <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                                            style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: '50%', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Trash2 size={13}/>
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        ref={dropRef}
                                        onDrop={handleDrop}
                                        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                        onDragEnter={e => { e.preventDefault(); setDragOver(true); }}
                                        onDragLeave={e => { if (!dropRef.current?.contains(e.relatedTarget)) setDragOver(false); }}
                                        onClick={() => fileRef.current?.click()}
                                        style={{
                                            width: '100%', borderRadius: 12, cursor: 'pointer', transition: 'all 0.18s',
                                            border: `2px dashed ${dragOver ? '#0f9688' : (isDark ? 'rgba(94,234,212,0.2)' : '#e2e8f0')}`,
                                            background: dragOver
                                                ? (isDark ? 'rgba(15,150,136,0.12)' : 'rgba(15,150,136,0.05)')
                                                : (isDark ? '#1e3a3e' : '#f8fafc'),
                                            padding: dragOver ? '20px 12px' : '12px',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                                            boxSizing: 'border-box',
                                        }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: dragOver ? '#0f9688' : (isDark ? '#9ecdd0' : '#94a3b8') }}>
                                            <Camera size={16}/>
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>
                                                {dragOver ? 'Отпустите файл' : 'Сфотографировать или перетащить чек'}
                                            </span>
                                        </div>
                                        {!dragOver && (
                                            <span style={{ fontSize: 11, color: isDark ? 'rgba(158,205,208,0.4)' : '#cbd5e1' }}>
                                                JPG, PNG · до 5 МБ
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Footer buttons */}
                        <div style={{ padding: '12px 20px 16px', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9'}`, display: 'flex', gap: 8, flexShrink: 0, background: isDark ? '#162a2e' : '#fff' }}>
                            <button type="button" onClick={onClose}
                                style={{ flex: 1, padding: '11px', background: isDark ? '#1e3a3e' : '#f8fafc', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, borderRadius: 12, color: isDark ? '#9ecdd0' : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer', outline: 'none' }}
                                onMouseEnter={e => e.currentTarget.style.background= isDark ? '#2d4e52' : '#f1f5f9'}
                                onMouseLeave={e => e.currentTarget.style.background= isDark ? '#1e3a3e' : '#f8fafc'}>
                                Отмена
                            </button>
                            <button type="submit" disabled={!category || (currency === 'uzs' ? !amount : computedUzs <= 0) || loading}
                                style={{ flex: 2, padding: '11px', background: (!category || (currency === 'uzs' ? !amount : computedUzs <= 0) || loading) ? '#e2e8f0' : 'linear-gradient(135deg,#0f9688,#0d7a6e)', border: 'none', borderRadius: 12, color: (!category || (currency === 'uzs' ? !amount : computedUzs <= 0) || loading) ? '#94a3b8' : '#fff', fontWeight: 700, fontSize: 13, cursor: (!category || (currency === 'uzs' ? !amount : computedUzs <= 0) || loading) ? 'not-allowed' : 'pointer', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.15s', boxShadow: (!category || (currency === 'uzs' ? !amount : computedUzs <= 0) || loading) ? 'none' : '0 4px 14px rgba(15,150,136,0.3)' }}>
                                {photoUploading ? '\ud83d\udcf8 \u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430\u2026' : loading ? '\u23f3 \u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435\u2026' : `\ud83d\udcb8 \u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0440\u0430\u0441\u0445\u043e\u0434${category ? ` \u00b7 ${CAT_LIST.find(c => c.key === category)?.icon || ''}` : ''}`}
                            </button>
                        </div>
                    </form>

                </div>
            </div>
        </>
    );
};

export default ExpenseModal;