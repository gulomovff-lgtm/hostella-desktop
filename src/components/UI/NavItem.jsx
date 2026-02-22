import React from 'react';

const NavItem = ({ icon: Icon, label, active, onClick, badge }) => (
    <button onClick={onClick} className={`whitespace-nowrap w-full flex flex-col md:flex-row items-center gap-1 md:gap-3 px-3 py-2.5 rounded-lg text-[10px] md:text-sm font-medium transition-all relative ${active ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
        <Icon size={20} className={active ? 'text-indigo-600' : 'text-slate-400'} />
        <span>{label}</span>
        {badge > 0 && (
            <span className="absolute right-2 top-0 md:top-1/2 md:-translate-y-1/2 bg-rose-500 text-white text-[10px] font-bold rounded-full w-4 h-4 md:w-5 md:h-5 flex items-center justify-center">
                {badge > 9 ? '9+' : badge}
            </span>
        )}
    </button>
);

export default NavItem;
