import React, { useEffect, useState } from 'react';
import { CreditCard, Settings, X, KeyRound } from 'lucide-react';

// Карта для оплаты турсбора на сайте кадастра (13.11.2026): по умолчанию
// (задаётся на этом компьютере, видна только маска), другая — ввести здесь,
// или «введу в окне сайта». Секреты хранит главный процесс Electron.

export const emptyKadastrCard = () => ({ mode: 'default', number: '', mm: '', yy: '', phone: '' });

/** Значение выбора → аргумент для electronAPI ('default' | {…} | null). */
export function kadastrCardArg(v) {
    if (!v) return null;
    if (v.mode === 'default') return 'default';
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

export default function KadastrCardPicker({ value, onChange, t, canSetup = false }) {
    const [st, setSt] = useState(null);
    const [setupOpen, setSetupOpen] = useState(false);
    const load = () => window.electronAPI?.kadastrSettingsGet?.().then(setSt).catch(() => setSt({}));
    useEffect(() => { load(); }, []);
    useEffect(() => {
        if (st && !st.hasCard && value.mode === 'default') onChange({ ...value, mode: 'other' });
    }, [st]); // eslint-disable-line react-hooks/exhaustive-deps
    const opt = (mode, label) => (
        <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm font-semibold ${value.mode === mode ? 'border-teal-400 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600'}`}>
            <input type="radio" className="accent-teal-600" checked={value.mode === mode} onChange={() => onChange({ ...value, mode })} />
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
            {st?.hasCard && opt('default', `${t('cadPayDefault')} ${st.cardMask}`)}
            {opt('other', t('cadPayOther'))}
            {value.mode === 'other' && <KadastrCardFields value={value} onChange={onChange} />}
            {opt('manual', t('cadPayManual'))}
            {st && !st.hasPassword && <p className="text-[11px] font-semibold text-amber-700">{t('cadPortalNoPassword')}</p>}
            {setupOpen && <KadastrSetupModal t={t} onClose={() => { setSetupOpen(false); load(); }} />}
        </div>
    );
}

// Настройки сайта кадастра на этом компьютере: пароль ключа ЭЦП, номер
// сертификата, какой кадастр выбирать и карта по умолчанию.
export function KadastrSetupModal({ t, onClose }) {
    const [st, setSt] = useState(null);
    const [pw, setPw] = useState('');
    const [cert, setCert] = useState('');
    const [cadMatch, setCadMatch] = useState('');
    const [card, setCard] = useState({ ...emptyKadastrCard(), mode: 'other' });
    const [msg, setMsg] = useState('');
    useEffect(() => {
        window.electronAPI?.kadastrSettingsGet?.().then(s => { setSt(s); setCert(s.cert || ''); setCadMatch(s.cadMatch || ''); }).catch(() => setSt({}));
    }, []);
    const save = async (patch) => {
        const r = await window.electronAPI.kadastrSettingsSet(patch);
        if (r?.ok) { setSt(r); setPw(''); setCard({ ...emptyKadastrCard(), mode: 'other' }); setMsg(t('cadPortalSaved_ok')); }
        else setMsg(r?.error === 'bad_card' ? t('cadPayBadCard') : (r?.error || 'error'));
    };
    const cardFilled = card.number || card.mm || card.yy || card.phone;
    return (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4" style={{ background: 'rgba(8,18,20,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-black text-base text-slate-800 flex items-center gap-2"><KeyRound size={16} className="text-teal-600" /> {t('cadPortalSetup')}</h3>
                    <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><X size={16} /></button>
                </div>
                <p className="text-[11px] text-slate-500 leading-snug">{t('cadPortalSetupHint')}</p>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('cadPortalPassword')} {st?.hasPassword ? '✓' : ''}</label>
                    <input type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} className={inp} placeholder={st?.hasPassword ? '••••••••' : ''} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">{t('cadPortalCert')}</label>
                        <input value={cert} onChange={e => setCert(e.target.value.trim())} className={inp} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">{t('cadPortalCadMatch')}</label>
                        <input value={cadMatch} onChange={e => setCadMatch(e.target.value)} className={inp} />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('cadPayDefault')} {st?.hasCard ? st.cardMask : '—'}</label>
                    <KadastrCardFields value={card} onChange={setCard} />
                    {st?.hasCard && (
                        <button type="button" onClick={() => save({ clearCard: true })} className="mt-1 text-[11px] font-bold text-rose-600">{t('cadPayClear')}</button>
                    )}
                </div>
                {msg && <p className="text-xs font-semibold text-slate-600">{msg}</p>}
                <button type="button"
                    disabled={cardFilled && !kadastrCardOk(card)}
                    onClick={() => save({ ...(pw ? { eimzoPassword: pw } : {}), cert, cadMatch, ...(cardFilled ? { card: kadastrCardArg(card) } : {}) })}
                    className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-black disabled:opacity-50">
                    {t('save')}
                </button>
            </div>
        </div>
    );
}
