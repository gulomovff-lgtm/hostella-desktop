import React from 'react';
import Button from './Button';
import { Lock, LogOut } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

/**
 * ShiftBlockScreen — показывается кассиру, который пытается войти,
 * когда другой кассир уже ведёт активную смену.
 * Передача смены намеренно убрана: второй кассир не может "забрать" смену.
 * Единственный выход — нажать «Выйти» и дождаться закрытия смены первым кассиром.
 */
const ShiftBlockScreen = ({ activeShift, activeUser, currentUser, onLogout, lang = 'ru' }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] ?? k;
    return (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
                <div className="mb-6 flex justify-center">
                    <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 animate-pulse">
                        <Lock size={40} />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">{t('shiftBusyTitle')}</h2>
                <p className="text-slate-500 mb-6">
                    {t('shiftBusyDesc')} <b>{activeUser?.name || t('cashier2')}</b>.<br/>
                    Вход невозможен, пока активная смена не будет закрыта.
                </p>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-left">
                    <div className="text-xs text-slate-400 uppercase font-bold mb-1">{t('shiftDetails')}</div>
                    <div className="font-bold text-slate-700">
                        {t('cashier2')}: {activeUser?.name || '—'}
                    </div>
                    <div className="text-sm text-slate-500 mt-0.5">
                        {t('start')}: {new Date(activeShift.startTime).toLocaleString('ru-RU')}
                    </div>
                    <div className="text-sm text-emerald-600 font-bold mt-1">{t('shiftActive')}</div>
                </div>

                <Button onClick={onLogout} className="w-full py-3" variant="secondary" icon={LogOut}>
                    {t('logout2')}
                </Button>

                <p className="text-xs text-slate-400 mt-4">
                    {t('contactAdmin')}
                </p>
            </div>
        </div>
    );
};

export default ShiftBlockScreen;
