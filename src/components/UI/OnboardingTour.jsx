import React, { useState, useEffect } from 'react';
import { ArrowRight, X, CheckCircle } from 'lucide-react';

const STEPS = [
    {
        id:      'dashboard',
        title:   'Добро пожаловать в Hostella!',
        text:    'Это дашборд — здесь вы видите ключевые показатели: занятость, выручку, задачи и последние действия.',
        target:  'nav-dashboard',
        emoji:   '🏠',
    },
    {
        id:      'rooms',
        title:   'Управление номерами',
        text:    'В разделе «Номера» можно добавлять комнаты, настраивать цены и следить за свободными местами.',
        target:  'nav-rooms',
        emoji:   '🛏️',
    },
    {
        id:      'checkin',
        title:   'Заселение гостей',
        text:    'Нажмите «+ Заселить» в любой момент чтобы зарегистрировать нового гостя. Используйте групповое заселение для нескольких гостей сразу.',
        target:  'checkin-btn',
        emoji:   '👤',
    },
    {
        id:      'guests',
        title:   'Список гостей',
        text:    'В разделе «Гости» — все текущие гости с деталями, оплатами и историей. Можно искать по имени или паспорту.',
        target:  'nav-guests',
        emoji:   '👥',
    },
    {
        id:      'expenses',
        title:   'Расходы',
        text:    'Фиксируйте расходы с фото чека. Все расходы учитываются в отчётах и видны в разрезе смены.',
        target:  'nav-expenses',
        emoji:   '💸',
    },
    {
        id:      'reports',
        title:   'Отчёты',
        text:    'Отчёты показывают выручку по периодам, топ-кассиров, статистику по оплатам. Данные можно экспортировать в Excel.',
        target:  'nav-reports',
        emoji:   '📊',
    },
    {
        id:      'settings',
        title:   'Настройки',
        text:    'Укажите название и логотип хостела, настройте шаблоны чеков, сделайте резервную копию данных.',
        target:  'nav-settings',
        emoji:   '⚙️',
    },
];

const LS_KEY = 'hostella_onboarding_v1';

const OnboardingTour = ({ onComplete, lang }) => {
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
                                Шаг {step + 1} / {STEPS.length}
                            </div>
                            <div className="text-white font-black text-[15px]">{current.title}</div>
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
                    <p className="text-slate-600 text-sm leading-relaxed">{current.text}</p>
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
                        Пропустить
                    </button>
                    <button onClick={handleNext}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black text-white transition-all shadow-lg
                            ${isLast
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-200'
                                : 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 shadow-indigo-200'
                            }`}>
                        {isLast ? (
                            <><CheckCircle size={15}/> Начать работу</>
                        ) : (
                            <>Далее <ArrowRight size={15}/></>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
};

export { LS_KEY };
export default OnboardingTour;
