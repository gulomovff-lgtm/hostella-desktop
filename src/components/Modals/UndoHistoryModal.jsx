import React, { useState, useMemo } from 'react';
import { X, RotateCcw, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

// Actions that can be undone and their UI metadata
const ACTION_META = {
    checkin:    { icon: '🏨', label: 'Заселение',   color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
    payment:    { icon: '💵', label: 'Оплата',       color: 'bg-blue-50 border-blue-200 text-blue-800'         },
    extend:     { icon: '📅', label: 'Продление',    color: 'bg-violet-50 border-violet-200 text-violet-800'   },
    expense:    { icon: '💳', label: 'Расход',       color: 'bg-amber-50 border-amber-200 text-amber-800'      },
};

const UNDO_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    const min  = Math.floor(diff / 60000);
    if (min < 1) return 'только что';
    if (min < 60) return `${min} мин назад`;
    return `${Math.floor(min / 60)} ч назад`;
}

function timeLeft(ts) {
    const left = UNDO_WINDOW_MS - (Date.now() - new Date(ts).getTime());
    if (left <= 0) return null;
    const min = Math.ceil(left / 60000);
    return `${min} мин`;
}

// ─── Single confirm step ───────────────────────────────────────────────────────
function ConfirmRow({ item, onConfirm, onCancel, confirming }) {
    return (
        <div className="border border-amber-300 bg-amber-50 rounded-xl p-3 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0"/>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-amber-800 mb-0.5">Подтвердите отмену</div>
                <div className="text-xs text-amber-700">{item.label}</div>
            </div>
            <div className="flex gap-1.5 shrink-0">
                <button onClick={onCancel}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-slate-300 text-slate-600 hover:bg-slate-50">
                    Нет
                </button>
                <button onClick={() => onConfirm(item)} disabled={confirming}
                    className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-500 hover:bg-rose-600 text-white disabled:opacity-50">
                    {confirming ? '...' : 'Отменить'}
                </button>
            </div>
        </div>
    );
}

// ─── Main modal ────────────────────────────────────────────────────────────────
const UndoHistoryModal = ({ undoStack, onClose, onUndo }) => {
    const [confirmId, setConfirmId] = useState(null);
    const [loading,   setLoading  ] = useState(false);

    // Filter out expired items (>30 min)
    const validItems = useMemo(() =>
        undoStack.filter(item => {
            const age = Date.now() - new Date(item.timestamp).getTime();
            return age < UNDO_WINDOW_MS;
        }),
    [undoStack]);

    const handleConfirm = async (item) => {
        setLoading(true);
        try {
            await onUndo(item);
        } finally {
            setLoading(false);
            setConfirmId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            style={{ WebkitAppRegion: 'no-drag' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-amber-500 to-orange-500">
                    <div className="flex items-center gap-2.5">
                        <RotateCcw size={17} className="text-white"/>
                        <span className="font-black text-white text-sm">Отмена действий</span>
                        {validItems.length > 0 && (
                            <span className="bg-white/25 text-white text-xs font-black px-2 py-0.5 rounded-full">
                                {validItems.length}
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="w-7 h-7 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full text-white">
                        <X size={14}/>
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
                    {validItems.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            <CheckCircle size={36} className="mx-auto mb-2 opacity-30"/>
                            <div className="text-sm font-medium">Нет действий для отмены</div>
                            <div className="text-xs mt-1">Действия доступны 30 минут</div>
                        </div>
                    ) : (
                        validItems.map(item => {
                            const meta = ACTION_META[item.type] || { icon: '⚙️', label: item.type, color: 'bg-slate-50 border-slate-200 text-slate-800' };
                            const tLeft = timeLeft(item.timestamp);

                            if (confirmId === item.id) {
                                return (
                                    <ConfirmRow key={item.id} item={item}
                                        onConfirm={handleConfirm}
                                        onCancel={() => setConfirmId(null)}
                                        confirming={loading}
                                    />
                                );
                            }

                            return (
                                <div key={item.id} className={`border rounded-xl p-3 flex items-center gap-3 ${meta.color}`}>
                                    <span className="text-xl shrink-0">{meta.icon}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-black uppercase tracking-wide opacity-60 mb-0.5">{meta.label}</div>
                                        <div className="text-sm font-bold truncate">{item.label}</div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Clock size={10} className="opacity-50"/>
                                            <span className="text-[10px] opacity-60">{timeAgo(item.timestamp)}</span>
                                            {tLeft && (
                                                <span className="text-[10px] opacity-50">· осталось {tLeft}</span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setConfirmId(item.id)}
                                        className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-white/70 hover:bg-white border border-current/20 rounded-lg text-xs font-black transition-colors"
                                    >
                                        <RotateCcw size={11}/> Отменить
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
                    <p className="text-[11px] text-slate-400 text-center">
                        Действия доступны для отмены в течение 30 минут с момента выполнения
                    </p>
                </div>
            </div>
        </div>
    );
};

export { UNDO_WINDOW_MS };
export default UndoHistoryModal;
