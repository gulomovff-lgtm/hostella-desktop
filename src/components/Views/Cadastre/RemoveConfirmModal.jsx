import React, { useState } from 'react';
import { UserX } from 'lucide-react';
import { fmt } from './shared';

const RemoveConfirmModal = ({ reg, onClose, onConfirm }) => {
  const [addToExpenses, setAddToExpenses] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasAmount = Number(reg.amount) > 0 && !reg.expenseAdded;

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    await onConfirm(reg, { addToExpenses: hasAmount && addToExpenses });
    onClose();
  };

  return (
    <div className="modal-centered fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pb-[84px] sm:pb-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="h-1.5 bg-amber-400 w-full" />
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <UserX size={20} className="text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Завершить регистрацию</h3>
              <p className="text-sm text-slate-500 mt-1">
                Регистрация <b>{reg.guestName}</b> будет завершена.
              </p>
            </div>
          </div>

          {hasAmount && (
            <label className="flex items-center gap-3 cursor-pointer bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
              <input type="checkbox" checked={addToExpenses} onChange={e => setAddToExpenses(e.target.checked)}
                className="w-4 h-4 rounded accent-violet-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-violet-800">Добавить сумму в расходы</p>
                <p className="text-xs text-violet-600">{fmt(reg.amount)} сум</p>
              </div>
            </label>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} disabled={busy}
              className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 disabled:opacity-40">
              Отмена
            </button>
            <button onClick={handleConfirm} disabled={busy}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 disabled:opacity-40 flex items-center justify-center gap-2">
              {busy
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <UserX size={14} />
              }
              Завершить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── RegCard ──────────────────────────────────────────────────────────────────

export default RemoveConfirmModal;
