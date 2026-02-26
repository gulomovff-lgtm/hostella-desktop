import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`pointer-events-auto px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-10 fade-in duration-300 ${type === 'error' ? 'bg-rose-500 text-white' : type === 'warning' ? 'bg-amber-500 text-white' : 'bg-slate-900 text-white'}`}>
      {type === 'error' ? <AlertCircle size={24}/> : <CheckCircle2 size={24} className="text-emerald-400"/>}
      <span className="font-bold">{message}</span>
    </div>
  );
};

export default Notification;
