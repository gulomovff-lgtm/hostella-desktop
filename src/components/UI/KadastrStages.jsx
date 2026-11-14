import React, { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

// Этапы входа в кадастр и оплаты (13–14.11.2026). Главный процесс шлёт
// 'kadastr-stage' на каждом шаге, а при сбое — { stage: 'fail', reason }:
// шаг, на котором сорвалось, — красным, ниже понятная причина. Пройденные —
// галочкой, текущий — крутилкой с секундами. Если вход уже был, сайт сразу
// перескакивает дальше — прежние шаги пройдены.
//  variant 'line' — лента шагов на всю ширину (экран кадастра, между шапкой
//  и счётчиками); 'list' — столбик (окошко оплаты).
export const KADASTR_LOGIN_STEPS = ['site', 'oneid', 'key', 'password', 'return'];
export const KADASTR_PAY_STEPS = [...KADASTR_LOGIN_STEPS, 'pay_open', 'card'];
// Перевод в кадастр: вход, листок на сайте, карта и SMS
export const KADASTR_REGISTER_STEPS = [...KADASTR_LOGIN_STEPS, 'form', 'card'];

/** Причина сбоя кадастра → понятный текст кассиру. */
export function kadReasonText(reason, t) {
    const r = String(reason || '');
    const code = r.split(' | ')[0].trim();
    const detail = r.includes(' | ') ? r.split(' | ').slice(1).find(x => x && !/^eimzo:|^page:/.test(x)) : '';
    if (/^eimzo_(closed|cancelled)/.test(code)) return t('kadFail_cancelled');
    if (code === 'eimzo_no_window') return t('kadFail_noWindow');
    if (code === 'eimzo_timeout') return t('kadFail_eimzoTimeout');
    if (code === 'eimzo_focus_lost') return t('kadFail_focus');
    if (code === 'no_key') return t('kadFail_noKey');
    if (code === 'no_password') return t('kadFail_noPassword');
    if (code === 'oneid_error') return t('kadFail_oneid') + (detail ? ': ' + detail : '');
    if (code === 'oneid_timeout') return t('kadFail_oneidTimeout');
    if (/^oneid_not_opened|^not_oneid|^no_tab/.test(code)) return t('kadFail_oneidOpen');
    if (code === 'timeout') return t('cadPortal_timeout');
    return t('kadFail_other') + (code ? ' (' + code.slice(0, 60) + ')' : '');
}

export default function KadastrStages({ steps = KADASTR_LOGIN_STEPS, t, done = false, doneText = '', variant = 'list' }) {
    const [cur, setCur] = useState({ stage: steps[0], at: Date.now() });
    const lastIdx = useRef(0);
    const [, tick] = useState(0);
    useEffect(() => window.electronAPI?.onKadastrStage?.((p) => { if (p?.stage) setCur({ stage: p.stage, reason: p.reason || '', at: p.at || Date.now() }); }), []);
    useEffect(() => { const id = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(id); }, []);
    const manual = cur.stage === 'manual';
    const failed = cur.stage === 'fail';
    const raw = steps.indexOf(cur.stage);
    if (raw >= 0) lastIdx.current = raw;
    const idx = done ? steps.length : failed ? lastIdx.current : raw < 0 ? lastIdx.current : raw;
    const secs = Math.max(0, Math.round((Date.now() - cur.at) / 1000));
    const progress = done ? 100 : Math.round(((idx + (failed ? 1 : 0.5)) / steps.length) * 100);
    const stateOf = (i) => (idx > i ? 'done' : idx === i ? (failed ? 'fail' : (done || manual) ? 'wait' : 'now') : 'wait');

    if (variant === 'line') {
        return (
            <div>
                <div className="relative flex items-start justify-between">
                    <div className="absolute left-4 right-4 top-[13px] h-0.5 bg-slate-100 rounded-full" />
                    <div className={`absolute left-4 top-[13px] h-0.5 rounded-full transition-[width] duration-700 ease-out ${failed ? 'bg-rose-300' : done ? 'bg-emerald-400' : 'bg-teal-400'}`}
                        style={{ width: `calc((100% - 2rem) * ${Math.min(1, idx / Math.max(1, steps.length - 1))})` }} />
                    {steps.map((s, i) => {
                        const st = stateOf(i);
                        return (
                            <div key={s} className="kad-strip relative flex flex-col items-center gap-1.5 flex-1 min-w-0" style={{ animationDelay: `${i * 70}ms` }}>
                                <span className={`w-7 h-7 rounded-full flex items-center justify-center border-2 bg-white transition-colors duration-300 ${
                                    st === 'done' ? 'border-emerald-400 bg-emerald-50' : st === 'now' ? 'border-teal-400' : st === 'fail' ? 'border-rose-400 bg-rose-50' : 'border-slate-200'}`}>
                                    {st === 'done' ? <Check size={13} strokeWidth={3} className="text-emerald-500 kad-tick" />
                                        : st === 'now' ? <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 border-t-teal-500 animate-spin" />
                                        : st === 'fail' ? <X size={13} strokeWidth={3} className="text-rose-500 kad-pop" />
                                        : <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                                </span>
                                <span className={`text-[10.5px] leading-tight text-center px-1 ${st === 'now' ? 'text-slate-800 font-bold' : st === 'fail' ? 'text-rose-600 font-bold' : st === 'done' ? 'text-slate-500' : 'text-slate-300'}`}>
                                    {t('kadStage_' + s)}
                                    {st === 'now' && secs >= 3 && <span className="block tabular-nums font-normal text-slate-400">{secs} {t('secShort')}</span>}
                                </span>
                            </div>
                        );
                    })}
                </div>
                {failed && <p className="kad-strip mt-3 text-xs font-semibold text-rose-600 text-center">{kadReasonText(cur.reason, t)}</p>}
                {manual && <p className="kad-strip mt-3 text-xs font-semibold text-amber-700 text-center">{t('kadStage_manual')}</p>}
                {done && (
                    <p className="kad-strip mt-3 flex items-center justify-center gap-2 text-xs font-bold text-emerald-600">
                        <span className="kad-pop w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"><Check size={10} strokeWidth={3} className="text-white" /></span>
                        {doneText || t('kadStageDone')}
                    </p>
                )}
            </div>
        );
    }

    return (
        <div>
            <div className="h-1 rounded-full bg-slate-100 overflow-hidden mb-3">
                <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${done ? 'bg-emerald-400' : failed ? 'bg-rose-300' : manual ? 'bg-amber-300' : 'bg-teal-400'}`}
                    style={{ width: `${progress}%` }} />
            </div>
            <ol className="space-y-1.5">
                {steps.map((s, i) => {
                    const st = stateOf(i);
                    return (
                        <li key={s} className={`kad-strip flex items-center gap-2 text-xs transition-colors duration-300 ${st === 'done' ? 'text-slate-400' : st === 'now' ? 'text-slate-800 font-bold' : st === 'fail' ? 'text-rose-600 font-bold' : 'text-slate-300'}`}
                            style={{ animationDelay: `${i * 70}ms` }}>
                            <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                                {st === 'done' ? <span className="kad-tick w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center"><Check size={10} strokeWidth={3} className="text-emerald-500" /></span>
                                    : st === 'now' ? <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 border-t-teal-500 animate-spin" />
                                    : st === 'fail' ? <span className="kad-pop w-4 h-4 rounded-full bg-rose-50 flex items-center justify-center"><X size={10} strokeWidth={3} className="text-rose-500" /></span>
                                    : <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />}
                            </span>
                            <span className="flex-1">{t('kadStage_' + s)}</span>
                            {st === 'now' && secs >= 3 && <span className="kad-slide tabular-nums text-[10.5px] font-normal text-slate-400">{secs} {t('secShort')}</span>}
                        </li>
                    );
                })}
                {failed && <li className="kad-strip pt-1 text-xs font-semibold text-rose-600">{kadReasonText(cur.reason, t)}</li>}
                {manual && (
                    <li className="kad-strip flex items-center gap-2 text-xs font-semibold text-amber-700">
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-200 border-t-amber-500 animate-spin shrink-0" />
                        {t('kadStage_manual')}
                    </li>
                )}
                {done && (
                    <li className="kad-strip flex items-center gap-2 pt-1 text-xs font-bold text-emerald-600">
                        <span className="kad-pop w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"><Check size={10} strokeWidth={3} className="text-white" /></span>
                        {doneText || t('kadStageDone')}
                    </li>
                )}
            </ol>
        </div>
    );
}
