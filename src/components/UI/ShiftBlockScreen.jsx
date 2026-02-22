import React from 'react';
import Button from './Button';
import { Lock, ArrowLeftRight, LogOut } from 'lucide-react';

const ShiftBlockScreen = ({ activeShift, activeUser, currentUser, onLogout, onTransferToMe }) => {
    return (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
                <div className="mb-6 flex justify-center">
                    <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 animate-pulse">
                        <Lock size={40} />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Смена занята</h2>
                <p className="text-slate-500 mb-6">
                    В данный момент в этом хостеле работает <b>{activeUser?.name || 'Другой кассир'}</b>.<br/>
                    Вы не можете войти, пока смена не будет закрыта или передана.
                </p>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-left">
                    <div className="text-xs text-slate-400 uppercase font-bold mb-1">Детали смены:</div>
                    <div className="font-bold text-slate-700">Начало: {new Date(activeShift.startTime).toLocaleString()}</div>
                    <div className="text-sm text-emerald-600 font-bold mt-1">Активна сейчас</div>
                </div>

                <div className="space-y-3">
                    <Button onClick={() => onTransferToMe(activeShift.id, currentUser.id)} className="w-full py-3" variant="primary" icon={ArrowLeftRight}>
                        Принять смену (Передача мне)
                    </Button>
                    <Button onClick={onLogout} className="w-full py-3" variant="secondary" icon={LogOut}>
                        Выйти
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ShiftBlockScreen;
