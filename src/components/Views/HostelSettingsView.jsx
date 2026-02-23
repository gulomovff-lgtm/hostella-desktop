import React, { useState, useRef, useEffect } from 'react';
import {
    Settings, Upload, Save, RefreshCw, Download, Database, Image as ImageIcon,
    Building2, Phone, MapPin, Globe, Shield, CheckCircle2, AlertTriangle, X, Info, FileText, Link
} from 'lucide-react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, PUBLIC_DATA_PATH } from '../../firebase';
import { useExchangeRate } from '../../hooks/useExchangeRate';

const inputClass = "w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-700";
const labelClass = "block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide";

// ─── HostelBlock: defined OUTSIDE to avoid focus loss on re-render ────────────
const HOSTEL_META = {
    hostel1: { display: 'Хостел №1', color: 'indigo' },
    hostel2: { display: 'Хостел №2', color: 'teal' },
};

const HostelBlock = ({ hostelId, s, uploadingLogo, fileRef, onLogoClick, onChange }) => {
    const meta = HOSTEL_META[hostelId];
    const accentBg = hostelId === 'hostel1' ? 'from-indigo-500 to-violet-600' : 'from-teal-500 to-emerald-600';
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className={`bg-gradient-to-r ${accentBg} px-5 py-3 flex items-center gap-3`}>
                <Building2 size={18} className="text-white/80"/>
                <span className="font-black text-white text-base">{meta.display}</span>
            </div>
            <div className="p-5 space-y-4">
                {/* Логотип */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Логотип</label>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
                            {s.logoUrl ? <img src={s.logoUrl} alt="logo" className="w-full h-full object-contain"/> : <ImageIcon size={24} className="text-slate-300"/>}
                        </div>
                        <div className="flex-1 space-y-2">
                            <input type="url" className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-700"
                                placeholder="https://example.com/logo.png"
                                value={s.logoUrl}
                                onChange={e => onChange(hostelId, 'logoUrl', e.target.value)}
                            />
                            <input ref={fileRef} type="file" accept="image/*" className="hidden"
                                onChange={e => onLogoClick(hostelId, e.target.files[0])}
                            />
                            <button onClick={() => fileRef.current?.click()} disabled={uploadingLogo}
                                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors border border-slate-200">
                                <Upload size={13}/>
                                {uploadingLogo ? 'Загрузка...' : 'Загрузить файл'}
                            </button>
                        </div>
                    </div>
                </div>
                {/* Название */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Название</label>
                    <input className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-700"
                        value={s.name} onChange={e => onChange(hostelId, 'name', e.target.value)}/>
                </div>
                {/* Адрес + телефон */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Адрес</label>
                        <div className="relative">
                            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                            <input className="w-full px-4 py-2.5 pl-8 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-700"
                                value={s.address || ''} onChange={e => onChange(hostelId, 'address', e.target.value)} placeholder="ул. Примерная, 1"/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Телефон</label>
                        <div className="relative">
                            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                            <input className="w-full px-4 py-2.5 pl-8 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-700"
                                value={s.phone || ''} onChange={e => onChange(hostelId, 'phone', e.target.value)} placeholder="+998 90 000-00-00"/>
                        </div>
                    </div>
                </div>
                {/* Веб-сайт */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Веб-сайт</label>
                    <div className="relative">
                        <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input className="w-full px-4 py-2.5 pl-8 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-700"
                            value={s.website || ''} onChange={e => onChange(hostelId, 'website', e.target.value)} placeholder="https://myhostel.uz"/>
                    </div>
                </div>
                {/* Booking.com iCal */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 bg-[#003580] text-white text-[10px] font-black px-1.5 py-0.5 rounded-md">booking</span>
                        iCal URL
                    </label>
                    <div className="relative">
                        <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input className="w-full px-4 py-2.5 pl-8 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-700"
                            value={s.icalUrl || ''} onChange={e => onChange(hostelId, 'icalUrl', e.target.value)}
                            placeholder="https://ical.booking.com/v1/export?t=..."/>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Booking.com → Объект → Настройки → Синхронизация календаря → iCal</p>
                </div>
            </div>
        </div>
    );
};

// --- CurrencyCard ---
const CurrencyCard = ({ code, data, bg, text }) => {
    const sign  = data.diff > 0 ? '+' : data.diff < 0 ? '' : '';
    const color = data.diff > 0 ? 'text-emerald-600' : data.diff < 0 ? 'text-rose-500' : 'text-slate-400';
    return (
        <div className={`rounded-2xl p-4 ${bg}`}>
            <div className="flex items-center justify-between mb-1">
                <span className="text-xl font-black">{code}</span>
                <span className={`text-xs font-bold ${color}`}>{sign}{data.diff > 0 ? '+' : ''}{data.diff.toFixed(2)}</span>
            </div>
            <div className={`text-2xl font-black ${text}`}>{Math.round(data.rate).toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 mt-1 font-semibold">сум / {code === 'RUB' ? '100' : '1'} {data.name}</div>
        </div>
    );
};

// --- Main ---
const HostelSettingsView = ({ currentUser, guests, rooms, payments, expenses, users, tasks, shifts, lang, notify, onOpenTemplateEditor }) => {
    const { rates, loading: ratesLoading, updatedAt, error: ratesError, refresh: refreshRates } = useExchangeRate();

    const SETTINGS_DOC = doc(db, ...PUBLIC_DATA_PATH, 'settings', 'hostelConfig');

    const [settings, setSettings] = useState({
        hostel1: { name: 'Хостел №1', address: '', phone: '', logoUrl: '' },
        hostel2: { name: 'Хостел №2', address: '', phone: '', logoUrl: '' },
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [uploadingLogo, setUploadingLogo] = useState({ hostel1: false, hostel2: false });
    const [backupLoading, setBackupLoading] = useState(false);
    // Stable refs (defined at this level, never inside a nested component)
    const fileRef1 = useRef();
    const fileRef2 = useRef();
    const fileRefs = { hostel1: fileRef1, hostel2: fileRef2 };

    // Load settings from Firestore
    useEffect(() => {
        getDoc(SETTINGS_DOC).then(snap => {
            if (snap.exists()) {
                const data = snap.data();
                setSettings(s => ({
                    hostel1: { ...s.hostel1, ...(data.hostel1 || {}) },
                    hostel2: { ...s.hostel2, ...(data.hostel2 || {}) },
                }));
            }
        }).finally(() => setLoadingSettings(false));
    }, []);

    const handleChange = (hostelId, field, value) => {
        setSettings(s => ({ ...s, [hostelId]: { ...s[hostelId], [field]: value } }));
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(SETTINGS_DOC, settings, { merge: true });
            setSaved(true);
            notify && notify('Настройки сохранены', 'success');
            setTimeout(() => setSaved(false), 3000);
        } catch (e) {
            notify && notify('Ошибка сохранения: ' + e.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = async (hostelId, file) => {
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            notify && notify('Файл слишком большой (макс. 2 МБ)', 'error');
            return;
        }
        setUploadingLogo(u => ({ ...u, [hostelId]: true }));
        try {
            // Upload to Storage
            const path = `logos/${hostelId}_${Date.now()}_${file.name}`;
            const sRef = storageRef(storage, path);
            await uploadBytes(sRef, file);
            const url = await getDownloadURL(sRef);
            handleChange(hostelId, 'logoUrl', url);
            notify && notify('Логотип загружен', 'success');
        } catch (e) {
            // Fallback: base64 encode and store directly
            const reader = new FileReader();
            reader.onload = (ev) => handleChange(hostelId, 'logoUrl', ev.target.result);
            reader.readAsDataURL(file);
            notify && notify('Логотип в локальном режиме', 'info');
        } finally {
            setUploadingLogo(u => ({ ...u, [hostelId]: false }));
        }
    };

    // ── Backup Export ──────────────────────────────────────────────────────
    const handleBackup = () => {
        setBackupLoading(true);
        try {
            const backup = {
                exportedAt: new Date().toISOString(),
                exportedBy: currentUser?.name || currentUser?.login,
                version: '1.0',
                data: {
                    rooms:    rooms    || [],
                    guests:   guests   || [],
                    expenses: expenses || [],
                    payments: payments || [],
                    users:    (users || []).map(u => ({ ...u, pass: '***' })), // skip passwords
                    tasks:    tasks    || [],
                    shifts:   shifts   || [],
                },
                stats: {
                    rooms:    (rooms    || []).length,
                    guests:   (guests   || []).length,
                    expenses: (expenses || []).length,
                    payments: (payments || []).length,
                    users:    (users    || []).length,
                },
            };
            const json  = JSON.stringify(backup, null, 2);
            const blob  = new Blob([json], { type: 'application/json' });
            const url   = URL.createObjectURL(blob);
            const a     = document.createElement('a');
            a.href      = url;
            a.download  = `hostella_backup_${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            notify && notify('Резервная копия скачана', 'success');
        } catch (e) {
            notify && notify('Ошибка: ' + e.message, 'error');
        } finally {
            setBackupLoading(false);
        }
    };

    // Внутренний компонент HostelBlock удалён - он вынесен в модуль

    if (loadingSettings) return (
        <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"/>
        </div>
    );

    return (
        <div className="space-y-5 animate-in fade-in">
            {/* ── Header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Settings size={20}/> Настройки системы</h2>
                    <p className="text-sm text-slate-400 mt-0.5">Информация о хостеле, логотипы, резервная копия</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow transition-colors disabled:opacity-60"
                >
                    {saved ? <CheckCircle2 size={16}/> : <Save size={16}/>}
                    {saving ? 'Сохранение...' : saved ? 'Сохранено!' : 'Сохранить'}
                </button>
            </div>

            {/* ── Hostel Cards ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <HostelBlock hostelId="hostel1" s={settings.hostel1} uploadingLogo={uploadingLogo.hostel1} fileRef={fileRef1} onLogoClick={handleLogoUpload} onChange={handleChange}/>
                <HostelBlock hostelId="hostel2" s={settings.hostel2} uploadingLogo={uploadingLogo.hostel2} fileRef={fileRef2} onLogoClick={handleLogoUpload} onChange={handleChange}/>
            </div>

            {/* ── Template Editor ── */}
            {onOpenTemplateEditor && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center"><FileText size={18} className="text-violet-600"/></div>
                        <div>
                            <div className="font-black text-slate-800">Редактор шаблонов</div>
                            <div className="text-xs text-slate-400">Настройка чеков и регистрационных карт с логотипом</div>
                        </div>
                    </div>
                    <button onClick={onOpenTemplateEditor}
                        className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold shadow transition-colors text-sm">
                        <FileText size={15}/> Открыть
                    </button>
                </div>
            )}

            {/* ── Backup ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><Database size={18} className="text-emerald-600"/></div>
                    <div>
                        <div className="font-black text-slate-800">Резервная копия</div>
                        <div className="text-xs text-slate-400">JSON-экспорт всех данных системы</div>
                    </div>
                    <button
                        onClick={handleBackup}
                        disabled={backupLoading}
                        className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow transition-colors disabled:opacity-60 text-sm"
                    >
                        <Download size={15}/>
                        {backupLoading ? 'Экспорт...' : 'Скачать копию'}
                    </button>
                </div>
                <div className="grid grid-cols-4 gap-3">
                    {[
                        { label: 'Гостей',   val: (guests   || []).length, emoji: '👤', color: 'bg-blue-50 text-blue-700' },
                        { label: 'Комнат',   val: (rooms    || []).length, emoji: '🛏️', color: 'bg-purple-50 text-purple-700' },
                        { label: 'Расходов', val: (expenses || []).length, emoji: '💸', color: 'bg-rose-50 text-rose-700' },
                        { label: 'Платежей', val: (payments || []).length, emoji: '💰', color: 'bg-emerald-50 text-emerald-700' },
                    ].map(d => (
                        <div key={d.label} className={`rounded-xl p-3 text-center ${d.color}`}>
                            <div className="text-xl mb-1">{d.emoji}</div>
                            <div className="font-black text-lg">{d.val}</div>
                            <div className="text-[10px] font-bold uppercase tracking-wide opacity-70">{d.label}</div>
                        </div>
                    ))}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                    <Info size={12}/>
                    <span>Пароли сотрудников в резервной копии заменены на «***» в целях безопасности</span>
                </div>
            </div>

            {/* ── Exchange Rates ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                        <span className="text-lg">💱</span>
                    </div>
                    <div>
                        <div className="font-black text-slate-800">Курс валют ЦБ РУз</div>
                        <div className="text-xs text-slate-400">
                            {updatedAt ? `Обновлено: ${new Date(updatedAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}` : 'Загрузка...'}
                        </div>
                    </div>
                    <button
                        onClick={refreshRates}
                        disabled={ratesLoading}
                        className="ml-auto flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs border border-slate-200 transition-colors"
                    >
                        <RefreshCw size={13} className={ratesLoading ? 'animate-spin' : ''}/>
                        Обновить
                    </button>
                </div>
                {ratesError && (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-xl p-3 text-sm mb-3">
                        <AlertTriangle size={14}/> Нет соединения с ЦБ РУз, показаны кешированные данные
                    </div>
                )}
                {rates ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { code: 'USD', bg: 'bg-blue-50',   text: 'text-blue-800' },
                            { code: 'EUR', bg: 'bg-indigo-50', text: 'text-indigo-800' },
                            { code: 'RUB', bg: 'bg-rose-50',   text: 'text-rose-800' },
                            { code: 'CNY', bg: 'bg-amber-50',  text: 'text-amber-800' },
                        ].filter(c => rates[c.code]).map(c => (
                            <CurrencyCard key={c.code} code={c.code} data={rates[c.code]} bg={c.bg} text={c.text}/>
                        ))}
                    </div>
                ) : (
                    <div className="flex justify-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500"/>
                    </div>
                )}
            </div>

            {/* ── Security ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><Shield size={18} className="text-slate-600"/></div>
                    <div className="font-black text-slate-800">Безопасность</div>
                </div>
                <div className="text-sm text-slate-500 space-y-1">
                    <p>• Данные хранятся в Google Firebase (Firestore + Storage)</p>
                    <p>• Соединение зашифровано (TLS)</p>
                    <p>• Доступ разграничен по ролям: cashier → admin → super</p>
                </div>
            </div>
        </div>
    );
};

export default HostelSettingsView;
