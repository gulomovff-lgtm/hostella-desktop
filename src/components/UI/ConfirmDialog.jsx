import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

/**
 * Reusable confirmation dialog for destructive actions.
 *
 * Props:
 *   open        {boolean}   — whether the dialog is visible
 *   title       {string}    — dialog title
 *   message     {string}    — descriptive message
 *   confirmText {string}    — text for the confirm button (default: t('delete'))
 *   cancelText  {string}    — text for cancel button (default: t('cancel'))
 *   onConfirm   {function}  — called when user confirms
 *   onCancel    {function}  — called when user cancels / closes
 *   danger      {boolean}   — if true, confirm button is red (default: true)
 *   lang        {string}    — 'ru' | 'uz'
 */
const ConfirmDialog = ({
    open,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
    danger = true,
    lang = 'ru',
}) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] ?? k;

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
            onClick={e => { if (e.target === e.currentTarget) onCancel?.(); }}
        >
            <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden">
                {/* Coloured top-stripe */}
                <div className={`h-1.5 w-full ${danger ? 'bg-rose-500' : 'bg-amber-400'}`} />

                <div className="p-6">
                    {/* Icon + title */}
                    <div className="flex items-start gap-4 mb-4">
                        <div className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center ${danger ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                            <AlertTriangle size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-slate-800 leading-tight">
                                {title || t('confirmDelete')}
                            </h3>
                            {message && (
                                <p className="text-sm text-slate-500 mt-1 leading-relaxed">{message}</p>
                            )}
                        </div>
                        <button
                            onClick={onCancel}
                            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        >
                            <X size={15} />
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
                        >
                            {cancelText || t('cancel')}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`flex-1 px-4 py-2.5 rounded-xl text-white font-bold text-sm transition-colors ${
                                danger
                                    ? 'bg-rose-600 hover:bg-rose-700'
                                    : 'bg-amber-500 hover:bg-amber-600'
                            }`}
                        >
                            {confirmText || t('delete')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
