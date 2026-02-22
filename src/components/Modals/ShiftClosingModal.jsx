import React from 'react';
import { LogOut, Copy, X, Wallet, DollarSign, CreditCard, Smartphone, Lock } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import Button from '../UI/Button';

const ShiftClosingModal = ({ user, payments = [], expenses, onClose, onLogout, notify, onEndShift, lang, sendTelegramMessage }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const shiftStart = user.lastShiftEnd || '1970-01-01T00:00:00.000Z'; 
    const myPayments = payments.filter(p => { 
        const isMyPayment = (p.staffId === user.id) || (p.staffId === user.login); 
        return isMyPayment && p.date > shiftStart; 
    });
    const myExpenses = expenses.filter(e => { 
        const isMyExpense = (e.staffId === user.id) || (e.staffId === user.login); 
        return isMyExpense && e.date > shiftStart; 
    });
    const income = { 
        cash: myPayments.reduce((sum, p) => sum + (p.method === 'cash' ? (parseInt(p.amount)||0) : 0), 0), 
        card: myPayments.reduce((sum, p) => sum + (p.method === 'card' ? (parseInt(p.amount)||0) : 0), 0), 
        qr: myPayments.reduce((sum, p) => sum + (p.method === 'qr' ? (parseInt(p.amount)||0) : 0), 0) 
    };
    const totalExpenses = myExpenses.reduce((sum, e) => sum + (parseInt(e.amount)||0), 0);
    const totalRevenue = income.cash + income.card + income.qr;
    const cashInHand = income.cash - totalExpenses;
    
    const handleEndShiftWithNotify = () => {
        const msg = `<b>🔒 Закрытие смены</b>
Кассир: ${user.name}
---
💵 Наличные: ${income.cash.toLocaleString()}
💳 Терминал: ${income.card.toLocaleString()}
📱 QR: ${income.qr.toLocaleString()}
---
<b>✅ ИТОГО: ${totalRevenue.toLocaleString()}</b>
🔴 Расходы: ${totalExpenses.toLocaleString()}
<b>💰 В КАССЕ: ${cashInHand.toLocaleString()}</b>`;
        sendTelegramMessage(msg, 'shiftEnd');
        onEndShift();
    };
    
    const copyReport = async () => {
        const lines = [ 
            `🧑 Кассир: ${user.name}`,
            `📅 Дата: ${new Date().toLocaleString('ru-RU')}`,
            `---------------------------`,
            `📈 ПРИХОД`,
            `---------------------------`,
            `💵 Наличные:    ${income.cash.toLocaleString()} сум`,
            `💳 Терминал:    ${income.card.toLocaleString()} сум`,
            `📱 QR-код:      ${income.qr.toLocaleString()} сум`,
            `✅ ИТОГО ПРИХОД: ${totalRevenue.toLocaleString()} сум`,
            `---------------------------`,
            `🔴 РАСХОДЫ:     ${totalExpenses.toLocaleString()} сум`,
            `===========================`,
            `💰 В КАССЕ:     ${cashInHand.toLocaleString()} сум`,
            `===========================`
        ];
        const text = lines.join('\n');
        
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                notify("✅ Скопировано!", 'success');
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                try {
                    document.execCommand('copy');
                    notify("✅ Скопировано!", 'success');
                } catch (err) {
                    notify("Ошибка копирования", 'error');
                }
                
                document.body.removeChild(textArea);
            }
        } catch (err) {
            notify("Ошибка копирования", 'error');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[90vh]">
                {/* ? Градиентный Header */}
                <div className="p-6 border-b border-slate-200 bg-gradient-to-br from-slate-100 via-indigo-100/50 to-purple-100/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-200 to-purple-200 rounded-xl flex items-center justify-center">
                                <Lock size={24} className="text-indigo-600"/>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">{t('shiftClose')}</h2>
                                <p className="text-sm text-slate-600">{t('staff')}: <span className="font-semibold">{user.name}</span></p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white rounded-lg transition-colors text-slate-500 hover:text-slate-700"
                        >
                            <X size={24}/>
                        </button>
                    </div>
                </div>

                {/* ? Content */}
                <div className="p-6 overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50/20 space-y-4">
                    {/* Итого */}
                    <div className="bg-gradient-to-br from-indigo-100 to-purple-100 p-6 rounded-2xl border-2 border-indigo-300 shadow-sm text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-indigo-300 to-purple-300 rounded-lg flex items-center justify-center">
                                <Wallet size={16} className="text-indigo-700"/>
                            </div>
                            <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-wide">{t('total')}</h3>
                        </div>
                        <div className="text-4xl font-bold text-slate-800 mb-1">{totalRevenue.toLocaleString()}</div>
                        <div className="text-xs text-slate-600 font-medium">{t('cash')} + {t('card')} + {t('qr')}</div>
                    </div>

                    {/* Касса */}
                    <div className="bg-white p-5 rounded-2xl border-2 border-slate-300 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-gradient-to-br from-emerald-200 to-teal-200 rounded-lg flex items-center justify-center">
                                <DollarSign size={16} className="text-emerald-600"/>
                            </div>
                            <h3 className="text-base font-bold text-slate-700 uppercase tracking-wide">
                                Касса ({t('cash')})
                            </h3>
                        </div>
                        
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-slate-600 font-medium">{t('income')}:</span>
                                <span className="font-bold text-slate-800">+{income.cash.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-rose-600 font-medium">{t('expense')}:</span>
                                <span className="font-bold text-rose-600">-{totalExpenses.toLocaleString()}</span>
                            </div>
                            <div className="pt-3 border-t-2 border-slate-200 flex justify-between items-center">
                                <span className="font-bold text-slate-800">{t('cashInHand')}:</span>
                                <span className="font-bold text-2xl text-emerald-600">{cashInHand.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Терминал и QR */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-blue-100 to-cyan-100 p-4 rounded-xl border-2 border-blue-300 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-7 h-7 bg-gradient-to-br from-blue-200 to-cyan-200 rounded-lg flex items-center justify-center">
                                    <CreditCard size={14} className="text-blue-600"/>
                                </div>
                                <div className="text-xs font-bold text-blue-700 uppercase">{t('card')}</div>
                            </div>
                            <div className="text-xl font-bold text-slate-800">{income.card.toLocaleString()}</div>
                        </div>
                        
                        <div className="bg-gradient-to-br from-purple-100 to-violet-100 p-4 rounded-xl border-2 border-purple-300 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-7 h-7 bg-gradient-to-br from-purple-200 to-violet-200 rounded-lg flex items-center justify-center">
                                    <Smartphone size={14} className="text-purple-600"/>
                                </div>
                                <div className="text-xs font-bold text-purple-700 uppercase">{t('qr')}</div>
                            </div>
                            <div className="text-xl font-bold text-slate-800">{income.qr.toLocaleString()}</div>
                        </div>
                    </div>
                </div>

                {/* ? Footer Buttons */}
                <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col gap-3">
                    <button
                        onClick={copyReport}
                        className="w-full px-6 py-3 bg-white border-2 border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                    >
                        <Copy size={20}/>
                        Копировать отчет
                    </button>
                    
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-6 py-3 bg-white border-2 border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 transition-colors"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            onClick={handleEndShiftWithNotify}
                            className="flex-1 px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-xl font-semibold shadow-lg shadow-rose-200 hover:shadow-xl transition-all flex items-center justify-center gap-2"
                        >
                            <LogOut size={20}/>
                            {t('shiftClose')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShiftClosingModal;
