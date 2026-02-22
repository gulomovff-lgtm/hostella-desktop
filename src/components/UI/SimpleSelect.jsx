import React from 'react';
import { ChevronDown } from 'lucide-react';

const SimpleSelect = ({ label, value, onChange, options }) => (
  <div className="space-y-1">
    {label && <label className="text-xs font-bold text-slate-600 uppercase ml-1">{label}</label>}
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-slate-300 rounded-lg py-2.5 pl-3 pr-8 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm appearance-none cursor-pointer"
      >
        {options.map((opt, i) => (
            <option key={i} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
        <ChevronDown size={16} />
      </div>
    </div>
  </div>
);

export default SimpleSelect;
