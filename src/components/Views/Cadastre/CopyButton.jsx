import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import TRANSLATIONS from '../../../constants/translations';

const CopyButton = ({ text, lang = 'ru' }) => {
  const t = (k) => TRANSLATIONS[lang]?.[k] || k;
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button onClick={copy} title={t('pcCopy')}
      className="p-1 rounded-md hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-700">
      {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
    </button>
  );
};

export default CopyButton;
