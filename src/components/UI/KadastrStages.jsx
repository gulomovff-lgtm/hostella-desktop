import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

// Этапы входа в кадастр и оплаты (13.11.2026: «кнопка минуту неактивна —
// покажи, на какой он стадии»). Главный процесс шлёт 'kadastr-stage' на
// каждом шаге; пройденные — галочкой, текущий — крутилкой, с секундами.
// Если вход уже был, сайт сразу перескакивает к оплате — шаги входа
// считаются пройденными.
export const KADASTR_LOGIN_STEPS = ['site', 'oneid', 'key', 'password', 'return'];
export const KADASTR_PAY_STEPS = [...KADASTR_LOGIN_STEPS, 'pay_open', 'card'];

export default function KadastrStages({ steps = KADASTR_LOGIN_STEPS, t }) {
    const [cur, setCur] = useState({ stage: steps[0], at: Date.now() });
    const [, tick] = useState(0);
    useEffect(() => window.electronAPI?.onKadastrStage?.((p) => { if (p?.stage) setCur({ stage: p.stage, at: p.at || Date.now() }); }), []);
    useEffect(() => { const id = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(id); }, []);
    const manual = cur.stage === 'manual';
    const idx = steps.indexOf(cur.stage);
    const secs = Math.max(0, Math.round((Date.now() - cur.at) / 1000));
    return (
        <ol className="space-y-1.5">
            {steps.map((s, i) => {
                const done = idx > i;
                const now = idx === i || (idx < 0 && !manual && i === 0);
                return (
                    <li key={s} className={`flex items-center gap-2 text-xs ${done ? 'text-slate-400' : now ? 'text-slate-800 font-bold' : 'text-slate-300'}`}>
                        <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                            {done ? <Check size={13} className="text-emerald-500" />
                                : now ? <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 border-t-teal-600 animate-spin" />
                                : <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />}
                        </span>
                        <span className="flex-1">{t('kadStage_' + s)}</span>
                        {now && secs >= 3 && <span className="tabular-nums text-[10.5px] font-semibold text-slate-400">{secs} {t('secShort')}</span>}
                    </li>
                );
            })}
            {manual && (
                <li className="flex items-center gap-2 text-xs font-bold text-amber-700">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-amber-200 border-t-amber-600 animate-spin shrink-0" />
                    {t('kadStage_manual')}
                </li>
            )}
        </ol>
    );
}
