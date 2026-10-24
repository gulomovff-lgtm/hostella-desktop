import React, { useState } from 'react';
import { ArrowRight, X, CheckCircle } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

const STEPS = [
    {
        id:      'dashboard',
        title:   'obDashTitle',
        text:    'obDashText',
        target:  'nav-dashboard',
        emoji:   '🏠',
    },
    {
        id:      'rooms',
        title:   'obRoomsTitle',
        text:    'obRoomsText',
        target:  'nav-rooms',
        emoji:   '🛏️',
    },
    {
        id:      'checkin',
        title:   'obCheckinTitle',
        text:    'obCheckinText',
        target:  'checkin-btn',
        emoji:   '👤',
    },
    {
        id:      'guests',
        title:   'obGuestsTitle',
        text:    'obGuestsText',
        target:  'nav-guests',
        emoji:   '👥',
    },
    {
        id:      'expenses',
        title:   'obExpTitle',
        text:    'obExpText',
        target:  'nav-expenses',
        emoji:   '💸',
    },
    {
        id:      'reports',
        title:   'obRepTitle',
        text:    'obRepText',
        target:  'nav-reports',
        emoji:   '📊',
    },
    {
        id:      'settings',
        title:   'obSetTitle',
        text:    'obSetText',
        target:  'nav-settings',
        emoji:   '⚙️',
    },
];

const LS_KEY = 'hostella_onboarding_v1';

const OnboardingTour = ({ onComplete, lang = 'ru' }) => {
    const t = k => TRANSLATIONS[lang]?.[k] || k;
    const [step, setStep]     = useState(0);
    const [visible, setVisible] = useState(true);

    const current = STEPS[step];
    const isLast  = step === STEPS.length - 1;

    const handleNext = () => {
        if (isLast) finishTour();
        else setStep(s => s + 1);
    };

    const handleSkip = () => finishTour();

    const finishTour = () => {
        localStorage.setItem(LS_KEY, 'done');
        setVisible(false);
        onComplete?.();
    };

    if (!visible) return null;

    return (
        <>
            {/* Dark overlay */}
            <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-[1px]" onClick={handleSkip}/>

            {/* Card */}
            <div className="fixed z-[201] bottom-10 left-1/2 -translate-x-1/2 w-[420px] max-w-[calc(100vw-32px)]
                            bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 pt-5 pb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="text-3xl leading-none">{current.emoji}</div>
                        <div>
                            <div className="text-[10px] font-black text-white/60 uppercase tracking-wider mb-0.5">
                                {t('obStep').replace('{n}', step + 1).replace('{total}', STEPS.length)}
                            </div>
                            <div className="text-white font-black text-[15px]">{t(current.title)}</div>
                        </div>
                    </div>
                    <button onClick={handleSkip}
                        className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center mt-0.5 shrink-0">
                        <X size={12} className="text-white"/>
                    </button>
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-slate-100">
                    <div className="h-full bg-gradient-to-r from-indigo-400 to-violet-500 transition-all duration-500"
                         style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}/>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                    <p className="text-slate-600 text-sm leading-relaxed">{t(current.text)}</p>
                </div>

                {/* Step dots */}
                <div className="flex justify-center gap-1.5 pb-3">
                    {STEPS.map((_, i) => (
                        <button key={i} onClick={() => setStep(i)}
                            className={`rounded-full transition-all duration-300 ${
                                i === step ? 'w-5 h-2 bg-indigo-500' : 'w-2 h-2 bg-slate-200 hover:bg-slate-300'
                            }`}/>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 pb-5">
                    <button onClick={handleSkip} className="text-slate-400 hover:text-slate-600 text-xs font-medium transition-colors">
                        {t('obSkip')}
                    </button>
                    <button onClick={handleNext}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all shadow-lg
                            ${isLast
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-200'
                                : 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 shadow-indigo-200'
                            }`}>
                        {isLast ? (
                            <><CheckCircle size={15}/> {t('hpStart')}</>
                        ) : (
                            <>{t('next')} <ArrowRight size={15}/></>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
};

export { LS_KEY };
export default OnboardingTour;
