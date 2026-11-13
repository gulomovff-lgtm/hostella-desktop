import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

// Этапы входа в кадастр и оплаты (13.11.2026). Главный процесс шлёт
// 'kadastr-stage' на каждом шаге. Показ: тонкая полоса хода сверху плавно
// заполняется; шаги проявляются по очереди; пройденный — галочка «щёлкает»;
// текущий — крутилка и секунды. done — всё прошло: все галочки и «Готово».
// Если вход уже был, сайт сразу перескакивает дальше — прежние шаги пройдены.
export const KADASTR_LOGIN_STEPS = ['site', 'oneid', 'key', 'password', 'return'];
export const KADASTR_PAY_STEPS = [...KADASTR_LOGIN_STEPS, 'pay_open', 'card'];

export default function KadastrStages({ steps = KADASTR_LOGIN_STEPS, t, done = false, doneText = '' }) {
    const [cur, setCur] = useState({ stage: steps[0], at: Date.now() });
    const [, tick] = useState(0);
    useEffect(() => window.electronAPI?.onKadastrStage?.((p) => { if (p?.stage) setCur({ stage: p.stage, at: p.at || Date.now() }); }), []);
    useEffect(() => { const id = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(id); }, []);
    const manual = cur.stage === 'manual';
    const raw = steps.indexOf(cur.stage);
    const idx = done ? steps.length : raw < 0 ? 0 : raw;
    const secs = Math.max(0, Math.round((Date.now() - cur.at) / 1000));
    const progress = done ? 100 : Math.round(((idx + 0.5) / steps.length) * 100);
    return (
        <div>
            <div className="h-1 rounded-full bg-slate-100 overflow-hidden mb-3">
                <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${done ? 'bg-emerald-400' : manual ? 'bg-amber-300' : 'bg-teal-400'}`}
                    style={{ width: `${progress}%` }} />
            </div>
            <ol className="space-y-1.5">
                {steps.map((s, i) => {
                    const isDone = idx > i;
                    const now = !done && !manual && idx === i;
                    return (
                        <li key={s} className={`kad-strip flex items-center gap-2 text-xs transition-colors duration-300 ${isDone ? 'text-slate-400' : now ? 'text-slate-800 font-semibold' : 'text-slate-300'}`}
                            style={{ animationDelay: `${i * 70}ms` }}>
                            <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                                {isDone ? <span className="kad-tick w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center"><Check size={10} strokeWidth={3} className="text-emerald-500" /></span>
                                    : now ? <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 border-t-teal-500 animate-spin" />
                                    : <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />}
                            </span>
                            <span className="flex-1">{t('kadStage_' + s)}</span>
                            {now && secs >= 3 && <span className="kad-slide tabular-nums text-[10.5px] font-normal text-slate-400">{secs} {t('secShort')}</span>}
                        </li>
                    );
                })}
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
