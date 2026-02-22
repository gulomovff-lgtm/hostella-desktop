import React from 'react';

const Button = ({ children, onClick, variant = 'primary', className = '', icon: Icon, disabled, type = "button", title, size = "md" }) => {
  const baseStyle = `rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm border ${size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5'}`;
  const variants = {
    primary: "bg-indigo-600 text-white border-transparent hover:bg-indigo-700 shadow-indigo-200",
    secondary: "bg-white text-slate-700 border-slate-300 hover:bg-slate-50",
    danger: "bg-rose-500 text-white border-transparent hover:bg-rose-600 shadow-rose-200",
    success: "bg-emerald-600 text-white border-transparent hover:bg-emerald-700 shadow-emerald-200",
    ghost: "text-slate-500 border-transparent hover:bg-slate-100 shadow-none",
    warning: "bg-amber-500 text-white border-transparent hover:bg-amber-600 shadow-amber-200"
  };

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`} title={title}>
      {Icon && <Icon size={size === 'sm' ? 16 : 18} />}
      {children}
    </button>
  );
};

export default Button;
