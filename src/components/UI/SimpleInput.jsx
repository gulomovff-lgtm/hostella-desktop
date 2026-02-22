import React from 'react';

const SimpleInput = ({ label, value, onChange, type = "text", placeholder, icon: Icon, rightElement, error }) => (
  <div className="space-y-1">
    {label && <label className={`text-xs font-bold uppercase ml-1 ${error ? 'text-rose-500' : 'text-slate-600'}`}>{label}{error && ' *'}</label>}
    <div className="relative group">
      {Icon && <div className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${error ? 'text-rose-400' : 'text-slate-400 group-focus-within:text-blue-600'}`}><Icon size={18} /></div>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-white border rounded-lg py-2.5 ${Icon ? 'pl-10' : 'pl-3'} ${rightElement ? 'pr-10' : 'pr-3'} font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${error ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50 focus:ring-rose-300 focus:border-rose-500' : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-600'}`}
      />
      {rightElement && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>}
    </div>
    {error && <p className="text-xs text-rose-500 font-medium ml-1 mt-0.5">{error}</p>}
  </div>
);

export default SimpleInput;
