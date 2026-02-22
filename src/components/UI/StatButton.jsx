import React from 'react';

const StatButton = ({ label, value, color, active, onClick, isCurrency }) => {
    // МЯГКИЕ ЦВЕТА СТАТИСТИКИ
    const styles = {
        slate: active 
            ? "bg-slate-50 border-slate-100 text-slate-800 ring-1 ring-slate-100" 
            : "bg-white border-slate-100 text-slate-500 hover:border-slate-200",
        emerald: active 
            ? "bg-emerald-100 border-emerald-200 text-emerald-800 ring-1 ring-emerald-200" 
            : "bg-emerald-100/30 border-emerald-100/50 text-emerald-600 hover:bg-emerald-50/50",
        rose: active 
            ? "bg-rose-50 border-rose-200 text-rose-800 ring-1 ring-rose-200" 
            : "bg-rose-50/30 border-rose-100/50 text-rose-600 hover:bg-rose-50/50",
    };

    return (
        <button 
            onClick={onClick}
            className={`
                flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-200
                ${styles[color]} ${active ? 'shadow-sm' : ''}
            `}
        >
            <span className="text-[10px] font-bold uppercase opacity-60 mb-0.5">{label}</span>
            <span className={`text-sm font-bold ${isCurrency ? 'truncate w-full text-center' : ''}`}>
                {value}
            </span>
        </button>
    );
};

export default StatButton;
