import React, { useState } from 'react';
import { CreditCard, DollarSign, Shuffle, X } from 'lucide-react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../../../firebase';
import { INP, PAYMENTS_COLLECTION, TRANSFER_ENTITIES, fmt } from './shared';
import TRANSLATIONS from '../../../constants/translations';

const PaymentModal = ({ group, groups, currentUser, onClose, lang = 'ru' }) => {
    const t = k => TRANSLATIONS[lang]?.[k] || k;
    // groups = array for merged payment, group = single group
    const allGroups = groups || (group ? [group] : []);
    const combinedDebt = allGroups.reduce((s, g) => s + (g.debt || 0), 0);
    const combinedName = allGroups.length === 1 ? allGroups[0].name : allGroups.map(g => g.name).join(', ');

    const [method, setMethod] = useState('cash');
    const [amount, setAmount] = useState('');
    const [cashAmount, setCashAmount] = useState('');
    const [transferAmount, setTransferAmount] = useState('');
    const [transferTo, setTransferTo] = useState(TRANSFER_ENTITIES[0]);
    const [saving, setSaving] = useState(false);

    const handlePay = async () => {
        const cash = method === 'cash' ? (parseInt(amount) || 0) : (method === 'mix' ? (parseInt(cashAmount) || 0) : 0);
        const transfer = method === 'transfer' ? (parseInt(amount) || 0) : (method === 'mix' ? (parseInt(transferAmount) || 0) : 0);
        const total = cash + transfer;
        if (total <= 0) return;
        setSaving(true);
        try {
            for (const g of allGroups) {
                const groupShare = allGroups.length === 1 ? total : Math.round(total * ((g.debt || 0) / Math.max(1, combinedDebt)));
                await addDoc(collection(db, ...PAYMENTS_COLLECTION), {
                    date: new Date().toISOString(),
                    staffId: currentUser.id || currentUser.login || '',
                    hostelId: currentUser.hostelId || '',
                    type: 'income',
                    category: 'contract',
                    comment: allGroups.length > 1 ? `Договор (объед.): ${combinedName}` : `Договор: ${g.name}`,
                    contractGroupId: g.id,
                    cash: allGroups.length === 1 ? cash : Math.round(cash * ((g.debt || 0) / Math.max(1, combinedDebt))),
                    card: 0,
                    qr: 0,
                    transfer: allGroups.length === 1 ? transfer : Math.round(transfer * ((g.debt || 0) / Math.max(1, combinedDebt))),
                    ...(transfer > 0 ? { transferTo } : {}),
                    amount: allGroups.length === 1 ? total : groupShare,
                    method: method === 'mix' ? 'mix' : method === 'transfer' ? 'transfer' : 'cash',
                });
            }
            onClose();
        } catch (e) {
            console.error('[PaymentModal]', e);
        }
        setSaving(false);
    };

    const needsTransferTo = method === 'transfer' || method === 'mix';

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.6)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-black text-slate-800">{allGroups.length > 1 ? t('msmMergedPayment').replace('{n}', allGroups.length) : t('msmPayByContract')}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"><X size={15}/></button>
                </div>
                <div className="text-sm font-semibold text-slate-600 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                    {allGroups.length > 1
                        ? <div className="space-y-0.5">{allGroups.map(g => <div key={g.id} className="flex items-center justify-between"><span>{g.name}</span>{g.debt > 0 && <span className="text-xs text-rose-500 font-bold">{fmt(g.debt)}</span>}</div>)}</div>
                        : <>{allGroups[0]?.name}{combinedDebt > 0 && <span className="ml-2 text-xs text-rose-500 font-bold">{t('msDebtLower')}: {fmt(combinedDebt)} {t('sum')}</span>}</>
                    }
                </div>

                {/* Метод */}
                <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{t('msmPaymentMethod')}</div>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: 'cash', icon: <DollarSign size={14}/>, label: t('cash') },
                            { id: 'transfer', icon: <CreditCard size={14}/>, label: t('transferMethod') },
                            { id: 'mix', icon: <Shuffle size={14}/>, label: t('mix') },
                        ].map(opt => (
                            <button key={opt.id} type="button"
                                onClick={() => setMethod(opt.id)}
                                className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${method === opt.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-indigo-300'}`}
                            >
                                {opt.icon}
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Суммы */}
                {method !== 'mix' ? (
                    <div>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{t('amount')}</div>
                        <input
                            autoFocus
                            type="number" min="0"
                            value={amount}
                            onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
                            placeholder={combinedDebt > 0 ? String(combinedDebt) : '0'}
                            className={INP + ' w-full text-right font-bold text-base'}
                            onKeyDown={e => e.key === 'Enter' && handlePay()}
                        />
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div>
                            <div className="text-xs font-bold text-slate-500 mb-1.5">💵 {t('cash')}</div>
                            <input type="number" min="0" value={cashAmount}
                                onChange={e => setCashAmount(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="0" className={INP + ' w-full text-right font-bold'} />
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-500 mb-1.5">🏦 {t('transferMethod')}</div>
                            <input type="number" min="0" value={transferAmount}
                                onChange={e => setTransferAmount(e.target.value.replace(/[^0-9]/g, ''))}
                                placeholder="0" className={INP + ' w-full text-right font-bold'} />
                        </div>
                        {(parseInt(cashAmount)||0) + (parseInt(transferAmount)||0) > 0 && (
                            <div className="text-xs text-right text-slate-500">{t('total')}: <b>{fmt((parseInt(cashAmount)||0) + (parseInt(transferAmount)||0))}</b> {t('sum')}</div>
                        )}
                    </div>
                )}

                {/* Получатель перечисления */}
                {needsTransferTo && (
                    <div>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{t('dbpRecipient')}</div>
                        <div className="grid grid-cols-2 gap-2">
                            {TRANSFER_ENTITIES.map(ent => (
                                <button key={ent} type="button"
                                    onClick={() => setTransferTo(ent)}
                                    className={`px-3 py-2 rounded-xl border-2 text-xs font-bold transition-all text-left ${transferTo === ent ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:border-teal-300'}`}
                                >
                                    {ent}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-2 pt-1">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors">
                        {t('cancel')}
                    </button>
                    <button onClick={handlePay} disabled={saving} className="flex-2 flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-60 transition-colors">
                        {saving ? t('rrSaving') : t('msPay')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Строка специальности (локальный стейт → Firestore только onBlur) ──────

export default PaymentModal;
