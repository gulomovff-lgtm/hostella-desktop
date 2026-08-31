import React, { useState, useRef, useEffect } from 'react';
import {
    Settings, Upload, Save, RefreshCw, Download, Database, Image as ImageIcon,
    Building2, Phone, MapPin, Globe, Shield, CheckCircle2, AlertTriangle, X, Info, FileText, Link, Clock,
    Bell, DollarSign, Palette, Send, Hash,
    Percent, KeyRound, ScrollText, ListChecks, Plus, UploadCloud, CalendarClock,
    Tags, Wallet, Receipt, CreditCard, Banknote, HardDriveUpload
} from 'lucide-react';
import { doc, setDoc, getDoc, writeBatch } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, PUBLIC_DATA_PATH } from '../../firebase';
import { useExchangeRate } from '../../hooks/useExchangeRate';
import { getConfig, saveAppConfig, DEFAULT_APP_CONFIG } from '../../utils/appConfig';
import { sendTelegramMessage } from '../../utils/telegram';
import { APP_VERSION } from '../../constants/config';
import { getDeviceId } from '../../utils/clientTelemetry';
import PricingSettingsPanel from './PricingSettingsPanel';
import TRANSLATIONS from '../../constants/translations';

const inputClass = "w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm font-medium text-slate-700";
const labelClass = "block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide";

// Фирменный зелёный приложения
const BRAND = '#0f9688';

// Переключатель в фирменном стиле
const Toggle = ({ on, onClick }) => (
    <button type="button" onClick={onClick}
        className="w-11 h-6 rounded-full flex items-center px-0.5 shrink-0 transition-colors"
        style={{ background: on ? BRAND : '#cbd5e1', justifyContent: on ? 'flex-end' : 'flex-start' }}>
        <span className="w-5 h-5 bg-white rounded-full shadow-sm" />
    </button>
);

// ─── HostelBlock: defined OUTSIDE to avoid focus loss on re-render ────────────
const HOSTEL_META = {
    hostel1: { display: 'Хостел №1', color: 'indigo' },
    hostel2: { display: 'Хостел №2', color: 'teal' },
};

const HostelBlock = ({ hostelId, s, uploadingLogo, fileRef, onLogoClick, onChange, t }) => {
    const meta = HOSTEL_META[hostelId];
    const displayName = t(hostelId === 'hostel1' ? 'hsHostel1' : 'hsHostel2') || meta.display;
    const accent = hostelId === 'hostel1' ? '#6366f1' : '#0f9688';
    const tint   = hostelId === 'hostel1' ? 'rgba(99,102,241,0.08)' : 'rgba(15,150,136,0.08)';
    const secLabel = "text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5";
    const Divider = () => <div className="h-px bg-slate-100" />;
    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Шапка */}
            <div className="flex items-center gap-3 px-5 py-4" style={{ background: tint }}>
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                    {s.logoUrl ? <img src={s.logoUrl} alt="logo" className="w-full h-full object-contain"/> : <Building2 size={22} style={{ color: accent }}/>}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-black text-slate-800 text-base truncate">{s.name || displayName}</div>
                    <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: accent }}>{displayName}</div>
                </div>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: accent }}/>
            </div>

            <div className="p-5 space-y-4">
                {/* Бренд */}
                <div>
                    <div className={secLabel}><ImageIcon size={12}/> {t('hsLogoName')}</div>
                    <div className="flex items-center gap-3 mb-2.5">
                        <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
                            {s.logoUrl ? <img src={s.logoUrl} alt="logo" className="w-full h-full object-contain"/> : <ImageIcon size={24} className="text-slate-300"/>}
                        </div>
                        <div className="flex-1 space-y-2">
                            <input type="url" className={inputClass} placeholder="https://.../logo.png" value={s.logoUrl} onChange={e => onChange(hostelId, 'logoUrl', e.target.value)}/>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => onLogoClick(hostelId, e.target.files[0])}/>
                            <button onClick={() => fileRef.current?.click()} disabled={uploadingLogo}
                                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-colors border border-slate-200">
                                <Upload size={13}/> {uploadingLogo ? t('hsUploading') : t('hsUploadFile')}
                            </button>
                        </div>
                    </div>
                    <input className={inputClass} value={s.name} onChange={e => onChange(hostelId, 'name', e.target.value)} placeholder={t('hsHostelNamePh')}/>
                </div>

                <Divider/>

                {/* Контакты */}
                <div>
                    <div className={secLabel}><Phone size={12}/> {t('hsContacts')}</div>
                    <div className="space-y-2.5">
                        <div className="relative"><MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                            <input className={inputClass + ' pl-8'} value={s.address || ''} onChange={e => onChange(hostelId, 'address', e.target.value)} placeholder={t('address')}/></div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="relative"><Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input className={inputClass + ' pl-8'} value={s.phone || ''} onChange={e => onChange(hostelId, 'phone', e.target.value)} placeholder={t('phone')}/></div>
                            <div className="relative"><Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input className={inputClass + ' pl-8'} value={s.website || ''} onChange={e => onChange(hostelId, 'website', e.target.value)} placeholder={t('hsWebsite')}/></div>
                        </div>
                    </div>
                </div>

                <Divider/>

                {/* Время */}
                <div>
                    <div className={secLabel}><Clock size={12}/> {t('hsCheckInOutTime')}</div>
                    <div className="grid grid-cols-2 gap-2.5">
                        <div>
                            <label className="text-[10px] text-slate-400 font-semibold mb-1 block">{t('hsCheckInLabel')}</label>
                            <select className={inputClass} value={s.checkInHour ?? 14} onChange={e => onChange(hostelId, 'checkInHour', parseInt(e.target.value))}>
                                {Array.from({length:24},(_,i)=><option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-400 font-semibold mb-1 block">{t('hsCheckOutLabel')}</label>
                            <select className={inputClass} value={s.checkOutHour ?? 12} onChange={e => onChange(hostelId, 'checkOutHour', parseInt(e.target.value))}>
                                {Array.from({length:24},(_,i)=><option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                <Divider/>

                {/* Автоматизация */}
                <div>
                    <div className={secLabel}><RefreshCw size={12}/> {t('hsAutomation')}</div>
                    <div className="space-y-2">
                    <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
                        <RefreshCw size={16} style={{ color: BRAND }} className="shrink-0"/>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-700">{t('hsAutoCheckout')}</div>
                            <div className="text-[10px] text-slate-400">{t('hsAutoCheckoutDesc')}</div>
                        </div>
                        <Toggle on={s.autoCheckoutEnabled ?? true} onClick={() => onChange(hostelId, 'autoCheckoutEnabled', !(s.autoCheckoutEnabled ?? true))}/>
                    </div>
                    <div className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
                        <div className="flex items-center gap-3">
                            <RefreshCw size={16} style={{ color: BRAND }} className="shrink-0"/>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-slate-700">{t('hsAutoSync')}</div>
                                <div className="text-[10px] text-slate-400">{t('hsAutoSyncDesc')}</div>
                            </div>
                            <Toggle on={!!s.autoSync?.enabled} onClick={() => onChange(hostelId, 'autoSync', { ...(s.autoSync || {}), enabled: !(s.autoSync?.enabled) })}/>
                        </div>
                        {s.autoSync?.enabled && (
                            <select
                                className="mt-2.5 w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-sm font-medium text-slate-700"
                                value={s.autoSync?.frequency || 'daily'}
                                onChange={e => onChange(hostelId, 'autoSync', { ...(s.autoSync || {}), frequency: e.target.value })}
                            >
                                <option value="daily">{t('hsDaily')}</option>
                                <option value="weekly">{t('hsWeekly')}</option>
                                <option value="monthly">{t('hsMonthly')}</option>
                            </select>
                        )}
                    </div>
                </div>
                </div>

                <Divider/>

                {/* Booking.com iCal */}
                <div>
                    <div className={secLabel}><span className="inline-flex items-center gap-1 bg-[#003580] text-white text-[9px] font-black px-1.5 py-0.5 rounded">booking</span> {t('hsSync')}</div>
                    <div className="relative">
                        <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input className={inputClass + ' pl-8'} value={s.icalUrl || ''} onChange={e => onChange(hostelId, 'icalUrl', e.target.value)} placeholder={t('hsIcalPh')}/>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5">{t('hsIcalHint')}</p>
                </div>
            </div>
        </div>
    );
};

// --- CurrencyCard ---
const CUR_FLAG = { USD: 'us', EUR: 'eu', RUB: 'ru', CNY: 'cn', KZT: 'kz', GBP: 'gb', TRY: 'tr' };
const CUR_SYMBOL = { USD: '$', EUR: '€', RUB: '₽', CNY: '¥', KZT: '₸', GBP: '£', TRY: '₺' };
const CurrencyCard = ({ code, data, bg, text, t }) => {
    const color = data.diff > 0 ? 'text-emerald-600' : data.diff < 0 ? 'text-rose-500' : 'text-slate-400';
    const flag = CUR_FLAG[code];
    return (
        <div className={`rounded-2xl p-4 ${bg}`}>
            <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                    {flag && <span className={`fi fi-${flag} rounded-sm shadow-sm`} style={{ width: 26, height: 19, backgroundSize: 'cover' }}/>}
                    <span className="text-lg font-black">{code}</span>
                    {CUR_SYMBOL[code] && <span className="text-sm font-bold text-slate-400">{CUR_SYMBOL[code]}</span>}
                </div>
                <span className={`text-xs font-bold ${color}`}>{data.diff > 0 ? '▲' : data.diff < 0 ? '▼' : ''} {data.diff > 0 ? '+' : ''}{data.diff.toFixed(2)}</span>
            </div>
            <div className={`text-2xl font-black ${text}`}>{Math.round(data.rate).toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 mt-1 font-semibold">{t('hsSum')} / {code === 'RUB' ? '100' : '1'} {data.name}</div>
        </div>
    );
};

// --- Main ---
const HostelSettingsView = ({ currentUser, guests, rooms, payments, expenses, users, tasks, shifts, lang = 'ru', notify, onOpenTemplateEditor }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const { rates, loading: ratesLoading, updatedAt, error: ratesError, refresh: refreshRates } = useExchangeRate();

    const SETTINGS_DOC = doc(db, ...PUBLIC_DATA_PATH, 'settings', 'hostelConfig');

    const HOSTEL_DEFAULTS = {
        hostel1: { name: 'Хостел №1', address: '', phone: '', logoUrl: '', checkInHour: 14, checkOutHour: 12, autoCheckoutEnabled: true, autoSync: { enabled: false, frequency: 'daily' } },
        hostel2: { name: 'Хостел №2', address: '', phone: '', logoUrl: '', checkInHour: 14, checkOutHour: 12, autoCheckoutEnabled: true, autoSync: { enabled: false, frequency: 'daily' } },
    };
    const [settings, setSettings] = useState(HOSTEL_DEFAULTS);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [uploadingLogo, setUploadingLogo] = useState({ hostel1: false, hostel2: false });
    const [backupLoading, setBackupLoading] = useState(false);
    const [tab, setTab] = useState('hostels');
    const [appCfg, setAppCfg] = useState(() => ({ ...DEFAULT_APP_CONFIG, ...getConfig() }));
    const [testingAlert, setTestingAlert] = useState(false);
    // Защита от потери несохранённых изменений при переключении вкладок
    const [dirty, setDirty] = useState(false);
    const [pendingTab, setPendingTab] = useState(null);
    const lastSavedRef = useRef({ settings: null, appCfg: { ...DEFAULT_APP_CONFIG, ...getConfig() } });
    const cfgChange = (k, v) => { setAppCfg(c => ({ ...c, [k]: v })); setSaved(false); setDirty(true); };
    const requestTab = (id) => { if (id === tab) return; if (dirty) setPendingTab(id); else setTab(id); };

    // Вложенные настройки
    const setPm = (key, patch) => cfgChange('paymentMethods', {
        ...(appCfg.paymentMethods || {}), [key]: { ...(appCfg.paymentMethods?.[key] || {}), ...patch },
    });
    const setAudit = (key, val) => cfgChange('auditActions', { ...(appCfg.auditActions || {}), [key]: val });

    // #11 Категории расходов
    const [newExpCat, setNewExpCat] = useState({ name: '', icon: '📦' });
    const EXP_ICONS = ['📦','🏠','💡','💧','🔥','🌐','📱','💼','💰','🛒','🍽️','☕','🧺','🛏️','🔧','🧹','🚗','⛽','🏦','💳','📣','📊','🖨️','🔑','💊','🎁','🚚','🧾'];
    const addExpCat = () => {
        const name = (newExpCat.name || '').trim();
        if (!name) return;
        const list = appCfg.expenseCategories || [];
        if (list.some(c => c.name === name)) { notify && notify(t('hsCatExists'), 'error'); return; }
        cfgChange('expenseCategories', [...list, { name, icon: newExpCat.icon || '📦' }]);
        setNewExpCat({ name: '', icon: '📦' });
    };
    const removeExpCat = (name) => cfgChange('expenseCategories', (appCfg.expenseCategories || []).filter(c => c.name !== name));

    // #4 Восстановление из бэкапа
    const restoreRef = useRef();
    const [restoreData, setRestoreData] = useState(null);
    const [restoreText, setRestoreText] = useState('');
    const [restoring, setRestoring] = useState(false);
    const RESTORE_COLLS = ['rooms', 'guests', 'expenses', 'payments', 'tasks', 'shifts'];

    const handleRestoreFile = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const parsed = JSON.parse(ev.target.result);
                const data = parsed.data || parsed;
                const stats = {};
                RESTORE_COLLS.forEach(c => { stats[c] = Array.isArray(data[c]) ? data[c].length : 0; });
                setRestoreData({ data, stats, exportedAt: parsed.exportedAt, exportedBy: parsed.exportedBy });
                setRestoreText('');
            } catch (e) {
                notify && notify(t('hsBadBackupFile') + e.message, 'error');
            }
        };
        reader.readAsText(file);
    };

    const handleRestoreConfirm = async () => {
        if (!restoreData) return;
        setRestoring(true);
        try {
            const { data } = restoreData;
            let written = 0;
            for (const coll of RESTORE_COLLS) {
                const items = Array.isArray(data[coll]) ? data[coll] : [];
                for (let i = 0; i < items.length; i += 400) {
                    const batch = writeBatch(db);
                    items.slice(i, i + 400).forEach(item => {
                        if (!item || !item.id) return;
                        const { id, ...body } = item;
                        batch.set(doc(db, ...PUBLIC_DATA_PATH, coll, String(id)), body, { merge: true });
                        written++;
                    });
                    await batch.commit();
                }
            }
            notify && notify(t('hsRestoredCount').replace('{n}', written), 'success');
            setRestoreData(null); setRestoreText('');
        } catch (e) {
            notify && notify(t('hsRestoreError') + e.message, 'error');
        } finally {
            setRestoring(false);
        }
    };

    const handleTestAlert = async () => {
        const chatId = (appCfg.errorAlertChatId || '').trim();
        if (!chatId) { notify && notify(t('hsEnterTelegramId'), 'error'); return; }
        setTestingAlert(true);
        try {
            await saveAppConfig(appCfg);
            const res = await sendTelegramMessage(
                `🧪 <b>${t('hsTestMsgTitle')}</b>\n${t('hsTestMsgBody')}\n👤 ${currentUser?.name || currentUser?.login || '—'}`,
                null, [chatId], true
            );
            if (res && (res.success || res.sent > 0)) notify && notify(t('hsTestSent'), 'success');
            else notify && notify(t('hsTestNotDelivered'), 'error');
        } catch (e) {
            notify && notify(t('hsSendError') + (e?.message || ''), 'error');
        } finally {
            setTestingAlert(false);
        }
    };
    // Stable refs (defined at this level, never inside a nested component)
    const fileRef1 = useRef();
    const fileRef2 = useRef();

    // Load settings from Firestore
    useEffect(() => {
        getDoc(SETTINGS_DOC).then(snap => {
            let merged = {
                hostel1: { ...HOSTEL_DEFAULTS.hostel1 },
                hostel2: { ...HOSTEL_DEFAULTS.hostel2 },
            };
            if (snap.exists()) {
                const data = snap.data();
                merged = {
                    hostel1: { ...HOSTEL_DEFAULTS.hostel1, ...(data.hostel1 || {}), autoSync: { enabled: false, frequency: 'daily', ...(HOSTEL_DEFAULTS.hostel1.autoSync || {}), ...(data.hostel1?.autoSync || {}) } },
                    hostel2: { ...HOSTEL_DEFAULTS.hostel2, ...(data.hostel2 || {}), autoSync: { enabled: false, frequency: 'daily', ...(HOSTEL_DEFAULTS.hostel2.autoSync || {}), ...(data.hostel2?.autoSync || {}) } },
                };
                setSettings(merged);
            }
            // Базовый снимок «последнего сохранённого» для отката при «Не сохранять»
            lastSavedRef.current = { settings: JSON.parse(JSON.stringify(merged)), appCfg: JSON.parse(JSON.stringify(appCfg)) };
            setDirty(false);
        }).finally(() => setLoadingSettings(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = (hostelId, field, value) => {
        setSettings(s => ({ ...s, [hostelId]: { ...s[hostelId], [field]: value } }));
        setSaved(false);
        setDirty(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(SETTINGS_DOC, settings, { merge: true });
            await saveAppConfig(appCfg);
            try { if (appCfg.appName) document.title = appCfg.appName; } catch { /* ignore */ }
            try { if (appCfg.brandColor) document.documentElement.style.setProperty('--brand', appCfg.brandColor); } catch { /* ignore */ }
            lastSavedRef.current = { settings: JSON.parse(JSON.stringify(settings)), appCfg: JSON.parse(JSON.stringify(appCfg)) };
            setDirty(false);
            setSaved(true);
            notify && notify(t('hsSettingsSaved'), 'success');
            setTimeout(() => setSaved(false), 3000);
            return true;
        } catch (e) {
            notify && notify(t('hsSaveError') + e.message, 'error');
            return false;
        } finally {
            setSaving(false);
        }
    };

    // Переход на другую вкладку из диалога несохранённых изменений
    const confirmSwitchSave = async () => {
        const ok = await handleSave();
        if (ok === false) return;
        const t = pendingTab; setPendingTab(null); if (t) setTab(t);
    };
    const confirmSwitchDiscard = () => {
        const snap = lastSavedRef.current;
        if (snap?.settings) setSettings(JSON.parse(JSON.stringify(snap.settings)));
        if (snap?.appCfg)   setAppCfg(JSON.parse(JSON.stringify(snap.appCfg)));
        setDirty(false); setSaved(false);
        const t = pendingTab; setPendingTab(null); if (t) setTab(t);
    };

    const handleLogoUpload = async (hostelId, file) => {
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            notify && notify(t('hsFileTooBig'), 'error');
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
            notify && notify(t('hsLogoUploaded'), 'success');
        } catch (e) {
            // Fallback: base64 encode and store directly
            const reader = new FileReader();
            reader.onload = (ev) => handleChange(hostelId, 'logoUrl', ev.target.result);
            reader.readAsDataURL(file);
            notify && notify(t('hsLogoLocal'), 'info');
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
            notify && notify(t('hsBackupDownloaded'), 'success');
        } catch (e) {
            notify && notify(t('hsError') + e.message, 'error');
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
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(15,150,136,0.12)' }}>
                        <Settings size={20} style={{ color: BRAND }}/>
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">{t('hsTitle')}</h2>
                        <p className="text-xs text-slate-400 mt-0.5">{t('hsSubtitle')}</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl font-bold shadow transition-opacity hover:opacity-90 disabled:opacity-60"
                    style={{ background: BRAND }}
                >
                    {saved ? <CheckCircle2 size={16}/> : <Save size={16}/>}
                    {saving ? t('hsSaving') : saved ? t('hsSavedBang') : t('save')}
                </button>
            </div>

            {/* ── Tabs ── */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1">
                {[
                    { id: 'hostels',  label: '🏨 ' + t('hsTabHostels') },
                    { id: 'general',  label: '⚙️ ' + t('hsTabGeneral') },
                    { id: 'finance',  label: '💰 ' + t('hsTabFinance') },
                    { id: 'pricing',  label: '💵 ' + t('hsTabPricing') },
                    { id: 'notify',   label: '🔔 ' + t('hsTabNotify') },
                    { id: 'templates', label: '📄 ' + t('hsTabTemplates') },
                    { id: 'data',     label: '💾 ' + t('hsTabData') },
                    { id: 'rates',    label: '💱 ' + t('hsTabRates') },
                    { id: 'security', label: '🛡️ ' + t('hsTabSecurity') },
                ].map(tb => (
                    <button key={tb.id} onClick={() => requestTab(tb.id)}
                        className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                        style={tab === tb.id
                            ? { background: BRAND, color: '#fff', boxShadow: '0 4px 12px -4px rgba(15,150,136,0.5)' }
                            : { background: '#fff', color: '#64748b', border: '1px solid #e2e8f0' }}>
                        {tb.label}
                    </button>
                ))}
            </div>

            {/* ── Hostel Cards ── */}
            {tab === 'hostels' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <HostelBlock hostelId="hostel1" s={settings.hostel1} uploadingLogo={uploadingLogo.hostel1} fileRef={fileRef1} onLogoClick={handleLogoUpload} onChange={handleChange} t={t}/>
                <HostelBlock hostelId="hostel2" s={settings.hostel2} uploadingLogo={uploadingLogo.hostel2} fileRef={fileRef2} onLogoClick={handleLogoUpload} onChange={handleChange} t={t}/>
            </div>
            )}

            {/* ── Общие ── */}
            {tab === 'general' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 max-w-2xl">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(15,150,136,0.12)' }}><Palette size={18} style={{ color: BRAND }}/></div>
                        <div><div className="font-black text-slate-800">{t('hsGeneral')}</div><div className="text-xs text-slate-400">{t('hsGeneralDesc')}</div></div>
                    </div>
                    <div>
                        <label className={labelClass}>{t('hsSystemName')}</label>
                        <input className={inputClass} value={appCfg.appName || ''} onChange={e => cfgChange('appName', e.target.value)} placeholder="Hostella"/>
                        <p className="text-[10px] text-slate-400 mt-1">{t('hsSystemNameHint')}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>{t('hsCurrency')}</label>
                            <input className={inputClass} value={appCfg.currency || ''} onChange={e => cfgChange('currency', e.target.value)} placeholder={t('hsSum')}/>
                        </div>
                        <div>
                            <label className={labelClass}>{t('hsAccentColor')}</label>
                            <div className="flex items-center gap-2">
                                <input type="color" value={appCfg.brandColor || '#0f9688'} onChange={e => cfgChange('brandColor', e.target.value)} className="w-11 h-10 rounded-lg border border-slate-200 cursor-pointer shrink-0"/>
                                <input className={inputClass} value={appCfg.brandColor || ''} onChange={e => cfgChange('brandColor', e.target.value)} placeholder="#0f9688"/>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div><label className={labelClass}>{t('hsCompanyAddress')}</label><input className={inputClass} value={appCfg.companyAddress || ''} onChange={e => cfgChange('companyAddress', e.target.value)} placeholder={t('hsCompanyAddressPh')}/></div>
                        <div><label className={labelClass}>{t('hsCompanyPhone')}</label><input className={inputClass} value={appCfg.companyPhone || ''} onChange={e => cfgChange('companyPhone', e.target.value)} placeholder="+998 ..."/></div>
                        <div><label className={labelClass}>{t('hsDefaultLang')}</label>
                            <select className={inputClass} value={appCfg.defaultLang || 'ru'} onChange={e => cfgChange('defaultLang', e.target.value)}>
                                <option value="ru">Русский</option><option value="uz">O‘zbek</option>
                            </select>
                        </div>
                        <div><label className={labelClass}>{t('hsDefaultTheme')}</label>
                            <select className={inputClass} value={appCfg.defaultTheme || 'green'} onChange={e => cfgChange('defaultTheme', e.target.value)}>
                                <option value="green">{t('hsThemeLight')}</option><option value="dark">{t('hsThemeDark')}</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400"><Info size={12}/><span>{t('hsLangThemeHint')}</span></div>
                </div>
            )}

            {/* ── Финансы и смены ── */}
            {tab === 'finance' && (
              <div className="space-y-4 max-w-2xl">
                {/* Значения по умолчанию */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><DollarSign size={18} className="text-emerald-600"/></div>
                        <div><div className="font-black text-slate-800">{t('hsFinanceShifts')}</div><div className="text-xs text-slate-400">{t('hsDefaults')}</div></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>{t('hsDefaultUsdRate')}</label>
                            <input className={inputClass} type="number" value={appCfg.defaultUsdRate || ''} onChange={e => cfgChange('defaultUsdRate', e.target.value)} placeholder="12900"/>
                            <p className="text-[10px] text-slate-400 mt-1">{t('hsDefaultUsdRateHint')}</p>
                        </div>
                        <div>
                            <label className={labelClass}>{t('hsRegRate')}</label>
                            <input className={inputClass} type="number" value={appCfg.registrationDailyRate || ''} onChange={e => cfgChange('registrationDailyRate', e.target.value)} placeholder="8240"/>
                            <p className="text-[10px] text-slate-400 mt-1">{t('hsRegRateHint')}</p>
                        </div>
                        <div>
                            <label className={labelClass}>{t('hsShiftDayHour')}</label>
                            <select className={inputClass} value={appCfg.shiftDayHour ?? 9} onChange={e => cfgChange('shiftDayHour', parseInt(e.target.value))}>
                                {Array.from({length:24},(_,i)=><option key={i} value={i}>{String(i).padStart(2,'0')}:00</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>{t('hsMinShiftHours')}</label>
                            <input className={inputClass} type="number" min="1" max="24" value={appCfg.minFullShiftHours ?? 6} onChange={e => cfgChange('minFullShiftHours', parseInt(e.target.value) || 6)}/>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400"><Info size={12}/><span>{t('hsShiftHint')}</span></div>
                </div>

                {/* #6 Налоги / комиссии */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center"><Percent size={18} className="text-rose-600"/></div>
                        <div className="flex-1"><div className="font-black text-slate-800">{t('hsTaxes')}</div><div className="text-xs text-slate-400">{t('hsTaxesDesc')}</div></div>
                        <Toggle on={!!appCfg.taxEnabled} onClick={() => cfgChange('taxEnabled', !appCfg.taxEnabled)}/>
                    </div>
                    {appCfg.taxEnabled && (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div><label className={labelClass}>{t('hsLabelName')}</label><input className={inputClass} value={appCfg.taxName || ''} onChange={e => cfgChange('taxName', e.target.value)} placeholder={t('hsTaxNamePh')}/></div>
                                <div><label className={labelClass}>{t('hsRatePercent')}</label><input className={inputClass} type="number" min="0" max="100" step="0.1" value={appCfg.taxRate ?? 0} onChange={e => cfgChange('taxRate', parseFloat(e.target.value) || 0)} placeholder="12"/></div>
                            </div>
                            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
                                <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-slate-700">{t('hsTaxInclusive')}</div><div className="text-[10px] text-slate-400">{t('hsTaxInclusiveDesc')}</div></div>
                                <Toggle on={!!appCfg.taxInclusive} onClick={() => cfgChange('taxInclusive', !appCfg.taxInclusive)}/>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400"><Info size={12}/><span>{t('hsTaxVarHintPre')} <code className="font-mono">{'{{TAX}}'}</code> {t('hsTaxVarHintPost')}</span></div>
                        </>
                    )}
                </div>

                {/* #7 Способы оплаты */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><Wallet size={18} className="text-blue-600"/></div>
                        <div><div className="font-black text-slate-800">{t('hsPaymentMethods')}</div><div className="text-xs text-slate-400">{t('hsPaymentMethodsDesc')}</div></div>
                    </div>
                    {[
                        { key: 'cash',     icon: <Banknote size={16} className="text-emerald-600"/> },
                        { key: 'card',     icon: <CreditCard size={16} className="text-indigo-600"/> },
                        { key: 'qr',       icon: <Hash size={16} className="text-violet-600"/> },
                        { key: 'transfer', icon: <Link size={16} className="text-sky-600"/> },
                    ].map(({ key, icon }) => {
                        const m = appCfg.paymentMethods?.[key] || {};
                        return (
                            <div key={key} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
                                <span className="shrink-0">{icon}</span>
                                <input className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-slate-700 outline-none" value={m.label || ''} onChange={e => setPm(key, { label: e.target.value })} placeholder={t('hsMethodNamePh')}/>
                                <Toggle on={m.enabled !== false} onClick={() => setPm(key, { enabled: !(m.enabled !== false) })}/>
                            </div>
                        );
                    })}
                </div>

                {/* #11 Категории расходов */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><Tags size={18} className="text-amber-600"/></div>
                        <div><div className="font-black text-slate-800">{t('hsExpCategories')}</div><div className="text-xs text-slate-400">{t('hsExpCategoriesDesc')}</div></div>
                    </div>
                    {(appCfg.expenseCategories || []).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {(appCfg.expenseCategories || []).map(c => (
                                <span key={c.name} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-sm font-semibold text-slate-700">
                                    <span>{c.icon}</span>{c.name}
                                    <button onClick={() => removeExpCat(c.name)} className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-rose-100 hover:text-rose-600 text-slate-400"><X size={12}/></button>
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <select className="px-2 py-2.5 bg-white border border-slate-300 rounded-xl outline-none text-lg shrink-0" value={newExpCat.icon} onChange={e => setNewExpCat(c => ({ ...c, icon: e.target.value }))}>
                            {EXP_ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                        </select>
                        <input className={inputClass} value={newExpCat.name} onChange={e => setNewExpCat(c => ({ ...c, name: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') addExpCat(); }} placeholder={t('hsNewCatPh')}/>
                        <button onClick={addExpCat} className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-white font-bold text-sm shrink-0" style={{ background: BRAND }}><Plus size={15}/></button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400"><Info size={12}/><span>{t('hsExpCatHint')}</span></div>
                </div>
              </div>
            )}

            {/* ── Цены ── */}
            {tab === 'pricing' && (
                <PricingSettingsPanel notify={notify} lang={lang} />
            )}

            {/* ── Уведомления ── */}
            {tab === 'notify' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4 max-w-2xl">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><Bell size={18} className="text-amber-600"/></div>
                        <div><div className="font-black text-slate-800">{t('hsErrorNotify')}</div><div className="text-xs text-slate-400">{t('hsErrorNotifyDesc')}</div></div>
                    </div>
                    <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
                        <Bell size={16} style={{ color: BRAND }} className="shrink-0"/>
                        <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-slate-700">{t('hsSendErrorAlerts')}</div><div className="text-[10px] text-slate-400">{t('hsSendErrorAlertsDesc')}</div></div>
                        <Toggle on={appCfg.errorAlertsEnabled !== false} onClick={() => cfgChange('errorAlertsEnabled', !(appCfg.errorAlertsEnabled !== false))}/>
                    </div>
                    <div>
                        <label className={labelClass}>{t('hsTelegramId')}</label>
                        <div className="relative">
                            <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                            <input className={inputClass + ' pl-8'} value={appCfg.errorAlertChatId || ''} onChange={e => cfgChange('errorAlertChatId', e.target.value.trim())} placeholder="7029598539"/>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">{t('hsTelegramIdHint')}</p>
                    </div>
                    <button onClick={handleTestAlert} disabled={testingAlert}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-sm transition-opacity hover:opacity-90 disabled:opacity-60" style={{ background: BRAND }}>
                        <Send size={15}/> {testingAlert ? t('hsSending') : t('hsSendTest')}
                    </button>
                </div>
            )}

            {/* ── Шаблоны: брендинг + редактор ── */}
            {tab === 'templates' && (
              <div className="space-y-4 max-w-2xl">
                {/* #13 Брендинг чеков */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center"><Receipt size={18} className="text-violet-600"/></div>
                        <div><div className="font-black text-slate-800">{t('hsReceiptBranding')}</div><div className="text-xs text-slate-400">{t('hsReceiptBrandingDesc')}</div></div>
                    </div>
                    <div>
                        <label className={labelClass}>{t('hsReceiptFooter')}</label>
                        <input className={inputClass} value={appCfg.receiptFooter || ''} onChange={e => cfgChange('receiptFooter', e.target.value)} placeholder={t('hsReceiptFooterPh')}/>
                        <p className="text-[10px] text-slate-400 mt-1">{t('hsFooterVarHintPre')} <code className="font-mono">{'{{FOOTER}}'}</code> {t('hsFooterVarHintPost')}</p>
                    </div>
                    <div>
                        <label className={labelClass}>{t('hsSignature')}</label>
                        <input className={inputClass} value={appCfg.receiptSignature || ''} onChange={e => cfgChange('receiptSignature', e.target.value)} placeholder={t('hsSignaturePh')}/>
                    </div>
                    <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
                        <Hash size={16} style={{ color: BRAND }} className="shrink-0"/>
                        <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-slate-700">{t('hsReceiptQr')}</div><div className="text-[10px] text-slate-400">{t('hsReceiptQrDesc')}</div></div>
                        <Toggle on={!!appCfg.receiptShowQr} onClick={() => cfgChange('receiptShowQr', !appCfg.receiptShowQr)}/>
                    </div>
                </div>

                {/* Редактор шаблонов */}
                {onOpenTemplateEditor && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center"><FileText size={18} className="text-indigo-600"/></div>
                        <div>
                            <div className="font-black text-slate-800">{t('hsTemplateEditor')}</div>
                            <div className="text-xs text-slate-400">{t('hsTemplateEditorDesc')}</div>
                        </div>
                    </div>
                    <button onClick={onOpenTemplateEditor}
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow transition-colors text-sm">
                        <FileText size={15}/> {t('hsOpen')}
                    </button>
                </div>
                )}
              </div>
            )}

            {/* ── Backup / Restore ── */}
            {tab === 'data' && (
            <div className="space-y-4 max-w-2xl">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><Database size={18} className="text-emerald-600"/></div>
                    <div>
                        <div className="font-black text-slate-800">{t('hsBackup')}</div>
                        <div className="text-xs text-slate-400">{t('hsBackupDesc')}</div>
                    </div>
                    <button
                        onClick={handleBackup}
                        disabled={backupLoading}
                        className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow transition-colors disabled:opacity-60 text-sm"
                    >
                        <Download size={15}/>
                        {backupLoading ? t('hsExporting') : t('hsDownloadBackup')}
                    </button>
                </div>
                <div className="grid grid-cols-4 gap-3">
                    {[
                        { label: t('hsStatGuests'),   val: (guests   || []).length, emoji: '👤', color: 'bg-blue-50 text-blue-700' },
                        { label: t('hsStatRooms'),   val: (rooms    || []).length, emoji: '🛏️', color: 'bg-purple-50 text-purple-700' },
                        { label: t('hsStatExpenses'), val: (expenses || []).length, emoji: '💸', color: 'bg-rose-50 text-rose-700' },
                        { label: t('hsStatPayments'), val: (payments || []).length, emoji: '💰', color: 'bg-emerald-50 text-emerald-700' },
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
                    <span>{t('hsBackupPassNote')}</span>
                </div>
              </div>

              {/* #3 Авто-бэкап (серверный) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center"><CalendarClock size={18} className="text-teal-600"/></div>
                    <div className="flex-1"><div className="font-black text-slate-800">{t('hsAutoBackup')}</div><div className="text-xs text-slate-400">{t('hsAutoBackupDesc')}</div></div>
                    <Toggle on={appCfg.autoBackupEnabled !== false} onClick={() => cfgChange('autoBackupEnabled', !(appCfg.autoBackupEnabled !== false))}/>
                </div>
                {appCfg.autoBackupEnabled !== false && (
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>{t('hsFrequency')}</label>
                            <select className={inputClass} value={appCfg.autoBackupFreq || 'daily'} onChange={e => cfgChange('autoBackupFreq', e.target.value)}>
                                <option value="daily">{t('hsFreqDaily')}</option><option value="weekly">{t('hsFreqWeekly')}</option><option value="monthly">{t('hsFreqMonthly')}</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>{t('hsTimeTashkent')}</label>
                            <input className={inputClass} type="time" value={appCfg.autoBackupTime || '04:00'} onChange={e => cfgChange('autoBackupTime', e.target.value)}/>
                        </div>
                    </div>
                )}
                <div className="flex items-start gap-2 text-xs text-slate-400"><Info size={12} className="mt-0.5 shrink-0"/><span>{t('hsAutoBackupHint')}</span></div>
              </div>

              {/* #4 Восстановление */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center"><HardDriveUpload size={18} className="text-orange-600"/></div>
                    <div><div className="font-black text-slate-800">{t('hsRestore')}</div><div className="text-xs text-slate-400">{t('hsRestoreDesc')}</div></div>
                </div>
                <input ref={restoreRef} type="file" accept="application/json,.json" className="hidden" onChange={e => { handleRestoreFile(e.target.files?.[0]); e.target.value = ''; }}/>
                <button onClick={() => restoreRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                    <UploadCloud size={15}/> {t('hsChooseJson')}
                </button>
                <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl p-3">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0"/>
                    <span>{t('hsRestoreWarnPre')} <b>{t('hsRestoreWarnBold')}</b> {t('hsRestoreWarnPost')}</span>
                </div>
              </div>
            </div>
            )}

            {/* ── Exchange Rates ── */}
            {tab === 'rates' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                        <span className="text-lg">💱</span>
                    </div>
                    <div>
                        <div className="font-black text-slate-800">{t('hsCbuRates')}</div>
                        <div className="text-xs text-slate-400">
                            {updatedAt ? t('hsUpdatedAt').replace('{time}', new Date(updatedAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })) : t('hsLoading')}
                        </div>
                    </div>
                    <button
                        onClick={refreshRates}
                        disabled={ratesLoading}
                        className="ml-auto flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-xs border border-slate-200 transition-colors"
                    >
                        <RefreshCw size={13} className={ratesLoading ? 'animate-spin' : ''}/>
                        {t('hsRefresh')}
                    </button>
                </div>
                {ratesError && (
                    <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-xl p-3 text-sm mb-3">
                        <AlertTriangle size={14}/> {t('hsCbuOffline')}
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
                            <CurrencyCard key={c.code} code={c.code} data={rates[c.code]} bg={c.bg} text={c.text} t={t}/>
                        ))}
                    </div>
                ) : (
                    <div className="flex justify-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500"/>
                    </div>
                )}
            </div>
            )}

            {/* ── Security ── */}
            {tab === 'security' && (
            <div className="space-y-4">
                {/* Информация о системе */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><Shield size={18} className="text-slate-600"/></div>
                        <div><div className="font-black text-slate-800">{t('hsSystemSection')}</div><div className="text-xs text-slate-400">{t('hsDeviceInfo')}</div></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: t('hsVersion'),    val: 'v' + APP_VERSION, color: 'bg-indigo-50 text-indigo-700' },
                            { label: t('hsPlatform'), val: /electron/i.test(navigator.userAgent) ? t('hsDesktop') : t('hsWeb'), color: 'bg-violet-50 text-violet-700' },
                            { label: t('hsNetwork'),      val: navigator.onLine ? t('hsOnline') : t('hsOffline'), color: navigator.onLine ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700' },
                            { label: t('hsRole'),      val: currentUser?.role || '—', color: 'bg-amber-50 text-amber-700' },
                        ].map(d => (
                            <div key={d.label} className={`rounded-xl p-3 ${d.color}`}>
                                <div className="font-black text-sm truncate">{d.val}</div>
                                <div className="text-[10px] font-bold uppercase tracking-wide opacity-70">{d.label}</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase text-slate-400">{t('hsDeviceId')}</span>
                        <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200 truncate">{(() => { try { return getDeviceId(); } catch { return '—'; } })()}</span>
                    </div>
                    <button onClick={() => { try { window.location.reload(); } catch { /* ignore */ } }}
                        className="mt-4 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                        <RefreshCw size={15}/> {t('hsReloadApp')}
                    </button>
                </div>

                {/* #9 Политика паролей и сессия */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center"><KeyRound size={18} className="text-indigo-600"/></div>
                        <div><div className="font-black text-slate-800">{t('hsPasswordSession')}</div><div className="text-xs text-slate-400">{t('hsPasswordReq')}</div></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className={labelClass}>{t('hsPassMinLen')}</label>
                            <input className={inputClass} type="number" min="3" max="32" value={appCfg.passwordMinLength ?? 4} onChange={e => cfgChange('passwordMinLength', parseInt(e.target.value) || 4)}/>
                        </div>
                        <div>
                            <label className={labelClass}>{t('hsPassChangeDays')}</label>
                            <input className={inputClass} type="number" min="0" max="365" value={appCfg.passwordChangeDays ?? 0} onChange={e => cfgChange('passwordChangeDays', parseInt(e.target.value) || 0)} placeholder={t('hsZeroOff')}/>
                        </div>
                        <div>
                            <label className={labelClass}>{t('hsAutoLogout')}</label>
                            <input className={inputClass} type="number" min="0" max="240" value={appCfg.autoLogoutMin ?? 0} onChange={e => cfgChange('autoLogoutMin', parseInt(e.target.value) || 0)} placeholder={t('hsZeroOff')}/>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
                        <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-slate-700">{t('hsPassMix')}</div><div className="text-[10px] text-slate-400">{t('hsPassMixDesc')}</div></div>
                        <Toggle on={!!appCfg.passwordRequireMix} onClick={() => cfgChange('passwordRequireMix', !appCfg.passwordRequireMix)}/>
                    </div>
                </div>

                {/* #15 Журнал действий */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><ScrollText size={18} className="text-slate-600"/></div>
                        <div className="flex-1"><div className="font-black text-slate-800">{t('hsAuditLog')}</div><div className="text-xs text-slate-400">{t('hsAuditDesc')}</div></div>
                        <Toggle on={appCfg.auditEnabled !== false} onClick={() => cfgChange('auditEnabled', !(appCfg.auditEnabled !== false))}/>
                    </div>
                    {appCfg.auditEnabled !== false && (
                        <>
                            <div>
                                <label className={labelClass}>{t('hsAuditRetention')}</label>
                                <input className={inputClass} type="number" min="7" max="3650" value={appCfg.auditRetentionDays ?? 90} onChange={e => cfgChange('auditRetentionDays', parseInt(e.target.value) || 90)}/>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {[
                                    ['logins', t('hsAuditLogins')],
                                    ['payments', t('hsAuditPayments')],
                                    ['expenses', t('hsAuditExpenses')],
                                    ['edits', t('hsAuditEdits')],
                                    ['deletions', t('hsAuditDeletions')],
                                ].map(([k, l]) => {
                                    const on = appCfg.auditActions?.[k] !== false;
                                    return (
                                        <button key={k} onClick={() => setAudit(k, !on)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${on ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200'}`}
                                            style={on ? { background: BRAND } : {}}>
                                            <ListChecks size={13}/> {l}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Принципы безопасности */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(15,150,136,0.12)' }}><CheckCircle2 size={18} style={{ color: BRAND }}/></div>
                        <div className="font-black text-slate-800">{t('hsDataProtection')}</div>
                    </div>
                    <div className="space-y-2">
                        {[
                            t('hsSec1'),
                            t('hsSec2'),
                            t('hsSec3'),
                            t('hsSec4'),
                            t('hsSec5'),
                        ].map((line, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                <CheckCircle2 size={15} style={{ color: BRAND }} className="shrink-0 mt-0.5"/>
                                <span>{line}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            )}

            {/* ── Unsaved-changes guard ── */}
            {pendingTab && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4" onClick={() => setPendingTab(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><AlertTriangle size={18} className="text-amber-600"/></div>
                            <div className="font-black text-slate-800">{t('hsUnsavedTitle')}</div>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">{t('hsUnsavedDesc')}</p>
                        <div className="flex flex-col gap-2">
                            <button onClick={confirmSwitchSave} disabled={saving}
                                className="w-full px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60" style={{ background: BRAND }}>
                                {saving ? t('hsSavingEllipsis') : t('hsSaveAndSwitch')}
                            </button>
                            <div className="flex gap-2">
                                <button onClick={confirmSwitchDiscard} disabled={saving}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 disabled:opacity-60">{t('hsDiscard')}</button>
                                <button onClick={() => setPendingTab(null)} disabled={saving}
                                    className="flex-1 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 disabled:opacity-60">{t('cancel')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Restore confirmation modal ── */}
            {restoreData && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4" onClick={() => !restoring && setRestoreData(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center"><HardDriveUpload size={18} className="text-orange-600"/></div>
                            <div><div className="font-black text-slate-800">{t('hsRestoreConfirmTitle')}</div>
                                {restoreData.exportedAt && <div className="text-[11px] text-slate-400">{t('hsCopyFrom').replace('{date}', new Date(restoreData.exportedAt).toLocaleString('ru'))}</div>}</div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            {Object.entries(restoreData.stats).map(([k, v]) => (
                                <div key={k} className="rounded-xl bg-slate-50 border border-slate-200 p-2 text-center">
                                    <div className="font-black text-slate-800">{v}</div>
                                    <div className="text-[9px] font-bold uppercase text-slate-400">{k}</div>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl p-3 mb-3">
                            <AlertTriangle size={14} className="mt-0.5 shrink-0"/>
                            <span>{t('hsRestoreConfirmWarn')} <b>{t('hsRestoreWord')}</b>.</span>
                        </div>
                        <input className={inputClass + ' mb-3'} value={restoreText} onChange={e => setRestoreText(e.target.value)} placeholder={t('hsRestoreWord')}/>
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setRestoreData(null)} disabled={restoring} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-60">{t('cancel')}</button>
                            <button onClick={handleRestoreConfirm} disabled={restoring || restoreText.trim() !== t('hsRestoreWord')}
                                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-40">
                                {restoring ? t('hsRestoring') : t('hsRestoreBtn')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HostelSettingsView;
