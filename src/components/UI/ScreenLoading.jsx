import React from 'react';

/**
 * Загрузка на месте экрана. Появляется с короткой задержкой (.screen-loading в
 * index.css), чтобы быстрые переключения не мигали. Кольцо вращается через
 * transform: браузер крутит его сам, и оно движется, даже когда программа занята
 * расчётами или разбором данных.
 */
const ScreenLoading = ({ text }) => (
    <div className="screen-loading flex flex-col items-center justify-center gap-3 py-24 text-center" role="status" aria-live="polite">
        <span className="w-9 h-9 rounded-full border-[3px] border-slate-200 border-t-orange-500 animate-spin" />
        <span className="text-sm font-bold text-slate-500 max-w-sm px-4">{text}</span>
    </div>
);

export default ScreenLoading;
