import React from 'react';

const ActionBtn = ({ icon: Icon, color, onClick }) => {
    // Пастельные кнопки действий
    const styles = {
        blue: "hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200",
        purple: "hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200",
        rose: "hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
    };
    return (
        <button onClick={onClick} className={`p-2 rounded-xl bg-white text-slate-400 border border-slate-100 transition-all shadow-sm ${styles[color]}`}>
            <Icon size={16} />
        </button>
    );
};

export default ActionBtn;
