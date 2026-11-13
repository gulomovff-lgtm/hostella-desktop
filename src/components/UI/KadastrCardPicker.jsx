import React, { useEffect, useState } from 'react';
import { CreditCard, Settings, X, KeyRound, Trash2, Plus, Star } from 'lucide-react';
import KadastrStages, { KADASTR_PAY_STEPS } from './KadastrStages';
import { vaultPublic, vaultSet, vaultArg } from '../../utils/kadastrVault';
import { HOSTELS } from '../../utils/helpers';

// Карта для оплаты турсбора на сайте кадастра (13.11.2026): сохранённые карты
// (одна — по умолчанию; хранятся на этом компьютере, видны только маски),
// другая — ввести здесь, или «введу в окне сайта». Секреты хранит главный
// процесс Electron.

export const emptyKadastrCard = () => ({ mode: 'default', number: '', mm: '', yy: '', phone: '' });

/** Значение выбора → аргумент для electronAPI ('default' | { savedId } | {…} | null). */
export function kadastrCardArg(v) {
    if (!v) return null;
    if (v.mode === 'default') return 'default';
    if (v.mode === 'saved' && v.savedId) return { savedId: v.savedId };
    if (v.mode === 'other') return { number: v.number, mm: v.mm, yy: v.yy, phone: v.phone };
    return null;
}

const digits = (s, n) => String(s || '').replace(/\D/g, '').slice(0, n);
export const kadastrCardOk = (v) => !v || v.mode !== 'other' || (
    digits(v.number, 16).length === 16 && /^(0[1-9]|1[0-2])$/.test(digits(v.mm, 2)) &&
    digits(v.yy, 2).length === 2 && [9, 12].includes(digits(v.phone, 12).length));

const inp = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold tabular-nums';

export function KadastrCardFields({ value, onChange }) {
    const set = (k, n) => (e) => onChange({ ...value, [k]: digits(e.target.value, n) });
    const shown = value.number.replace(/(\d{4})(?=\d)/g, '$1 ');
    return (
        <div className="space-y-2">
            <input inputMode="numeric" autoComplete="off" placeholder="0000 0000 0000 0000" value={shown} onChange={set('number', 16)} className={inp} />
            <div className="grid grid-cols-3 gap-2">
                <input inputMode="numeric" autoComplete="off" placeholder="MM" value={value.mm} onChange={set('mm', 2)} className={inp} />
                <input inputMode="numeric" autoComplete="off" placeholder="YY" value={value.yy} onChange={set('yy', 2)} className={inp} />
                <input inputMode="numeric" autoComplete="off" placeholder="998…" value={value.phone} onChange={set('phone', 12)} className={inp} />
            </div>
        </div>
    );
}

// hostelId — филиал гостя: карты и пароль ЭЦП берутся из его хранилища на сервере
export default function KadastrCardPicker({ value, onChange, t, canSetup = false, hostelId = 'hostel1' }) {
    const [st, setSt] = useState(null);
    const [setupOpen, setSetupOpen] = useState(false);
    const load = () => vaultPublic(hostelId).then(setSt).catch(() => setSt({}));
    useEffect(() => { load(); }, [hostelId]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!st) return;
        // Выбранной карты больше нет (удалили в настройках) — на другую
        if (value.mode === 'default' && !st.hasCard) onChange({ ...value, mode: 'other' });
        if (value.mode === 'saved' && !(st.cards || []).some(c => c.id === value.savedId)) onChange({ ...value, mode: st.hasCard ? 'default' : 'other' });
    }, [st]); // eslint-disable-line react-hooks/exhaustive-deps
    const cards = st?.cards || [];
    const radio = (key, checked, onPick, label) => (
        <label key={key} className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm font-semibold ${checked ? 'border-teal-400 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600'}`}>
            <input type="radio" className="accent-teal-600" checked={checked} onChange={onPick} />
            {label}
        </label>
    );
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1"><CreditCard size={13} /> {t('cadPayCard')}</span>
                {canSetup && (
                    <button type="button" onClick={() => setSetupOpen(true)} className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1">
                        <Settings size={12} /> {t('cadPortalSetup')}
                    </button>
                )}
            </div>
            {cards.map(c => c.isDefault
                ? radio(c.id, value.mode === 'default', () => onChange({ ...value, mode: 'default' }),
                    <span className="tabular-nums">{c.mask} <span className="text-[11px] font-bold text-teal-600">· {t('cadPayDefault')}</span></span>)
                : radio(c.id, value.mode === 'saved' && value.savedId === c.id, () => onChange({ ...value, mode: 'saved', savedId: c.id }),
                    <span className="tabular-nums">{c.mask}</span>))}
            {radio('other', value.mode === 'other', () => onChange({ ...value, mode: 'other' }), t('cadPayOther'))}
            {value.mode === 'other' && <KadastrCardFields value={value} onChange={onChange} />}
            {radio('manual', value.mode === 'manual', () => onChange({ ...value, mode: 'manual' }), t('cadPayManual'))}
            {st && !st.hasPassword && <p className="text-[11px] font-semibold text-amber-700">{t('cadPortalNoPassword')}</p>}
            {setupOpen && <KadastrSetupModal t={t} hostelId={hostelId} onClose={() => { setSetupOpen(false); load(); }} />}
        </div>
    );
}

// SMS-код оплаты турсбора — прямо в программе (13.11.2026): окно сайта скрыто,
// код уходит в его поля, «To`lash» жмёт программа. Неверный код — ещё раз.
// otp: { stage: 'working' | 'code' | 'error', name, phone, amount, error };
// onPaid — оплата прошла. «working» — сразу по кнопке, пока программа входит
// на сайт и вписывает карту (раньше кассир видел только тост и тишину).
export function KadastrOtpModal({ t, otp, onClose, onPaid }) {
    if (otp?.stage === 'working' || otp?.stage === 'error') {
        return (
            <div className="fixed inset-0 z-[185] flex items-center justify-center p-4" style={{ background: 'rgba(8,18,20,0.55)' }}>
                <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-black text-base text-slate-800 flex items-center gap-2"><CreditCard size={16} className="text-rose-600" /> {t('cadPortalPayBtn')}</h3>
                        <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><X size={16} /></button>
                    </div>
                    <p className="text-xs font-bold text-slate-700">{otp.name}</p>
                    {otp.stage === 'working' ? (
                        <div className="py-1"><KadastrStages steps={KADASTR_PAY_STEPS} t={t} /></div>
                    ) : (
                        <p className="text-sm font-semibold text-rose-600 py-2">{otp.error}</p>
                    )}
                    <p className="text-[11px] text-slate-400 leading-snug">{otp.stage === 'working' ? t('cadOtpWorkingHint') : t('cadOtpLater')}</p>
                    {otp.stage === 'error' && (
                        <button type="button" onClick={onClose} className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-black">{t('close')}</button>
                    )}
                </div>
            </div>
        );
    }
    return <KadastrOtpCode t={t} otp={otp} onClose={onClose} onPaid={onPaid} />;
}
function KadastrOtpCode({ t, otp, onClose, onPaid }) {
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const submit = async () => {
        if (code.length !== 6 || busy) return;
        setBusy(true); setErr('');
        const r = await window.electronAPI.kadastrPayOtp(code).catch(e => ({ status: 'error', message: e.message }));
        setBusy(false);
        if (r?.status === 'paid') { onPaid?.(); onClose(); return; }
        setCode('');
        setErr(r?.status === 'no_otp_form' ? t('cadOtpGone') : `${t('cadOtpFail')}${r?.message ? ': ' + r.message : ''}`);
    };
    return (
        <div className="fixed inset-0 z-[185] flex items-center justify-center p-4" style={{ background: 'rgba(8,18,20,0.55)' }}>
            <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-black text-base text-slate-800 flex items-center gap-2"><CreditCard size={16} className="text-rose-600" /> {t('cadOtpTitle')}</h3>
                    <button type="button" onClick={onClose} disabled={busy} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><X size={16} /></button>
                </div>
                <p className="text-xs text-slate-600 leading-snug">
                    {t('cadOtpHint').replace('{name}', otp?.name || '').replace('{phone}', otp?.phone || '—')}
                    {otp?.amount > 0 && <><br /><b className="tabular-nums">{Number(otp.amount).toLocaleString('ru-RU')} {t('cadSum')}</b></>}
                </p>
                <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} disabled={busy}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                    placeholder="••••••"
                    className="w-full px-3 py-3 bg-white border-2 border-slate-200 focus:border-teal-400 rounded-xl text-center text-2xl font-black tracking-[0.5em] tabular-nums" />
                {err && <p className="text-xs font-semibold text-rose-600">{err}</p>}
                <button type="button" onClick={submit} disabled={code.length !== 6 || busy}
                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-black disabled:opacity-40">
                    {busy ? t('cadOtpPaying') : t('cadPortalPayBtn')}
                </button>
                <p className="text-[11px] text-slate-400 leading-snug">{t('cadOtpLater')}</p>
            </div>
        </div>
    );
}

// Настройки сайта кадастра на этом компьютере (админ, 13.11.2026): пароль
// ключа ЭЦП (сменить / убрать), сертификат, кадастр, карты — добавить,
// удалить, сделать картой по умолчанию. Номера карт рендерер не видит — маски.
export function KadastrSetupModal({ t, onClose, hostelId: initialHostel = 'hostel1' }) {
    // Настройки — на сервере, у каждого филиала свои (13.11.2026): админ вводит
    // один раз, пользуются кассы этого филиала на любом компьютере
    const [hostelId, setHostelId] = useState(/^hostel\d+$/.test(initialHostel) ? initialHostel : 'hostel1');
    const [st, setSt] = useState(null);
    const [pw, setPw] = useState('');
    const [cert, setCert] = useState('');
    const [cadMatch, setCadMatch] = useState('');
    const [card, setCard] = useState({ ...emptyKadastrCard(), mode: 'other' });
    const [adding, setAdding] = useState(false);
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);
    const [localHas, setLocalHas] = useState(false);
    useEffect(() => {
        setSt(null); setMsg('');
        vaultPublic(hostelId).then(s => { setSt(s); setCert(s.cert || ''); setCadMatch(s.cadMatch || ''); })
            .catch(e => { setSt({}); setMsg(e?.message || 'error'); });
    }, [hostelId]);
    useEffect(() => { window.electronAPI?.kadastrLocalHas?.().then(r => setLocalHas(!!r?.has)).catch(() => {}); }, []);
    const save = async (patch, okText) => {
        setBusy(true);
        const r = await vaultSet(hostelId, patch);
        setBusy(false);
        if (r?.ok) {
            setSt(r); setMsg(okText || t('cadPortalSaved_ok'));
            window.electronAPI?.kadastrVaultChanged?.(hostelId);   // кассы этого компьютера — сразу
            return true;
        }
        setMsg(r?.error === 'bad_card' ? t('cadPayBadCard') : (r?.error || 'error'));
        return false;
    };
    // Прежние настройки этого компьютера → на сервер этого филиала (файл удаляется)
    const migrate = async () => {
        setBusy(true);
        const r = await window.electronAPI.kadastrMigrate(await vaultArg(hostelId)).catch(e => ({ ok: false, error: e.message }));
        setBusy(false);
        if (r?.ok) { setSt(r); setCert(r.cert || ''); setCadMatch(r.cadMatch || ''); setLocalHas(false); setMsg(t('cadVaultMigrated')); }
        else setMsg(r?.error || 'error');
    };
    const hostelIds = Object.keys(HOSTELS || {}).filter(h => /^hostel\d+$/.test(h));
    const cards = st?.cards || [];
    const savePw = async () => { if (pw && await save({ eimzoPassword: pw }, t('cadPwSaved'))) setPw(''); };
    const cardFilled = !!(card.number || card.mm || card.yy || card.phone);
    const addCard = async () => {
        if (!cardFilled || !kadastrCardOk(card)) return;
        if (await save({ addCard: { ...kadastrCardArg(card), makeDefault: !cards.length } }, t('cadCardAdded'))) {
            setCard({ ...emptyKadastrCard(), mode: 'other' }); setAdding(false);
        }
    };
    return (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4" style={{ background: 'rgba(8,18,20,0.55)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                    <h3 className="font-black text-base text-slate-800 flex items-center gap-2"><KeyRound size={16} className="text-teal-600" /> {t('cadPortalSetup')}</h3>
                    <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><X size={16} /></button>
                </div>
                {hostelIds.length > 1 && (
                    <div className="flex gap-1.5 flex-wrap">
                        {hostelIds.map(h => (
                            <button key={h} type="button" onClick={() => setHostelId(h)} disabled={busy}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${h === hostelId ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}>
                                {HOSTELS[h]?.name || h}
                            </button>
                        ))}
                    </div>
                )}
                <p className="text-[11px] text-slate-500 leading-snug">{t('cadVaultHint')}</p>
                {localHas && st?.empty && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                        <p className="text-[11px] font-semibold text-amber-800 leading-snug">{t('cadVaultLocalFound')}</p>
                        <button type="button" disabled={busy} onClick={migrate}
                            className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-black disabled:opacity-50">
                            {t('cadVaultMigrate').replace('{hostel}', HOSTELS[hostelId]?.name || hostelId)}
                        </button>
                    </div>
                )}
                {!st && <p className="text-xs text-slate-400">…</p>}

                <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500">
                        {t('cadPortalPassword')}{' '}
                        {st?.hasPassword
                            ? <span className="text-emerald-600">✓ {t('cadPwSet')}</span>
                            : <span className="text-amber-600">— {t('cadPwNone')}</span>}
                    </label>
                    <div className="flex gap-2">
                        <input type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} className={inp}
                            placeholder={st?.hasPassword ? t('cadPwNew') : ''} onKeyDown={e => { if (e.key === 'Enter') savePw(); }} />
                        <button type="button" disabled={!pw || busy} onClick={savePw}
                            className="px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black disabled:opacity-40 shrink-0">{t('save')}</button>
                    </div>
                    {st?.hasPassword && (
                        <button type="button" disabled={busy} onClick={() => save({ clearPassword: true }, t('cadPwCleared'))} className="text-[11px] font-bold text-rose-600">{t('cadPwClear')}</button>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">{t('cadPortalCert')}</label>
                        <input value={cert} onChange={e => setCert(e.target.value.trim())} onBlur={() => { if (cert && cert !== (st?.cert || '')) save({ cert }); }} className={inp} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">{t('cadPortalCadMatch')}</label>
                        <input value={cadMatch} onChange={e => setCadMatch(e.target.value)} onBlur={() => { if (cadMatch.trim() && cadMatch !== (st?.cadMatch || '')) save({ cadMatch }); }} className={inp} />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <span className="block text-xs font-bold text-slate-500">{t('cadCards')}</span>
                    {!cards.length && <p className="text-[11px] text-slate-400">{t('cadCardsNone')}</p>}
                    {cards.map(c => (
                        <div key={c.id} className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 rounded-xl border ${c.isDefault ? 'border-teal-300 bg-teal-50' : 'border-slate-200'}`}>
                            <CreditCard size={14} className="text-slate-400 shrink-0" />
                            <div className="flex-1 min-w-[110px] whitespace-nowrap">
                                <div className="text-sm font-bold text-slate-700 tabular-nums">{c.mask}</div>
                                <div className="text-[10.5px] text-slate-400 tabular-nums">{c.phoneMask}</div>
                            </div>
                            {c.isDefault
                                ? <span className="text-[10.5px] font-black px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 shrink-0">{t('cadPayDefault')}</span>
                                : <button type="button" disabled={busy} onClick={() => save({ defaultCard: c.id })}
                                    className="text-[11px] font-bold text-slate-500 hover:text-teal-700 flex items-center gap-1 shrink-0"><Star size={12} /> {t('cadCardMakeDefault')}</button>}
                            <button type="button" title={t('cadPayClear')} disabled={busy} onClick={() => save({ removeCard: c.id }, t('cadCardRemoved'))}
                                className="w-7 h-7 rounded-lg hover:bg-rose-50 text-rose-500 flex items-center justify-center shrink-0"><Trash2 size={14} /></button>
                        </div>
                    ))}
                    {adding ? (
                        <div className="space-y-2 p-3 rounded-xl border border-dashed border-slate-300">
                            <KadastrCardFields value={card} onChange={setCard} />
                            <div className="flex gap-2">
                                <button type="button" disabled={!cardFilled || !kadastrCardOk(card) || busy} onClick={addCard}
                                    className="flex-1 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black disabled:opacity-40">{t('cadCardAdd')}</button>
                                <button type="button" onClick={() => { setAdding(false); setCard({ ...emptyKadastrCard(), mode: 'other' }); }}
                                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-500">{t('cancel')}</button>
                            </div>
                        </div>
                    ) : (
                        <button type="button" onClick={() => setAdding(true)}
                            className="w-full py-2 rounded-xl border border-dashed border-slate-300 text-xs font-bold text-slate-600 hover:border-teal-400 hover:text-teal-700 flex items-center justify-center gap-1"><Plus size={13} /> {t('cadCardAdd')}</button>
                    )}
                </div>

                {msg && <p className="text-xs font-semibold text-slate-600">{msg}</p>}
                <button type="button" onClick={onClose} className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-black">{t('close')}</button>
            </div>
        </div>
    );
}
