import React, { useState, useMemo } from 'react';
import { Printer, ChevronDown, Users, CheckCircle2, Edit, Wallet, Magnet, Plus } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import Button from '../UI/Button';
import CreateDebtModal from '../Modals/CreateDebtModal';

const inputClass = "w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm shadow-sm font-medium text-slate-700 no-spinner";

const getTotalPaid = (g) => (typeof g.amountPaid === 'number' ? g.amountPaid : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0)));

const printDebts = (debts, totalDebt) => {
    const w = window.open('', '', 'width=800,height=600');
    const dateStr = new Date().toLocaleDateString();
    let html = `
    <html>
    <head>
        <title>Список Должников</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header { text-align: center; margin-bottom: 30px; }
            .total { text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; }
            .debt { color: #d63031; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>Отчет по долгам</h1>
            <p>Дата: ${dateStr}</p>
        </div>
        <table>
            <thead>
                <tr>
                    <th>ФИО Гостя</th>
                    <th>Паспорт</th>
                    <th>Телефон/Инфо</th>
                    <th>Сумма долга</th>
                </tr>
            </thead>
            <tbody>
    `;
    debts.forEach(d => {
        html += `
            <tr>
                <td>${d.fullName}</td>
                <td>${d.passport || '-'}</td>
                <td>${d.roomNumber ? `Комната ${d.roomNumber}` : '-'}</td>
                <td class="debt">${d.totalDebt.toLocaleString()}</td>
            </tr>
        `;
    });
    html += `
            </tbody>
        </table>
        <div class="total">Итого долгов: ${totalDebt.toLocaleString()}</div>
    </body>
    </html>
    `;
    w.document.write(html);
    w.document.close();
    w.print();
};

const DebtsView = ({ guests, users, lang, onPayDebt, currentUser, onAdminAdjustDebt, clients, onCreateDebt, onOpenGuest }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [staffFilter, setStaffFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [expandedDebtId, setExpandedDebtId] = useState(null);

    const aggregatedDebts = useMemo(() => {
        const debtMap = {};
        guests.forEach(g => {
            if (g.status === 'booking') return;
            const totalPaid = getTotalPaid(g);
            const debt = (g.totalPrice || 0) - totalPaid;
            const dateMatch = startDate ? g.checkInDate >= startDate : true;
            if (debt > 0 && dateMatch) {
                const key = g.passport || g.fullName;
                if (!debtMap[key]) {
                    debtMap[key] = {
                        id: key,
                        fullName: g.fullName,
                        passport: g.passport,
                        phone: g.phone,
                        roomNumber: g.roomNumber,
                        totalDebt: 0,
                        records: []
                    };
                }
                debtMap[key].records.push({
                    ...g,
                    currentDebt: debt,
                    staffName: users.find(u => u.id === g.staffId || u.login === g.staffId)?.name || 'Неизвестно'
                });
                debtMap[key].totalDebt += debt;
            }
        });

        let result = Object.values(debtMap);
        if (staffFilter) {
            result = result.filter(group => 
                group.records.some(r => r.staffId === staffFilter || users.find(u=>u.id === staffFilter)?.login === r.staffId)
            );
        }
        return result;
    }, [guests, startDate, staffFilter, users]);

    const totalDebt = aggregatedDebts.reduce((sum, item) => sum + item.totalDebt, 0);
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';
    const canPay  = !isAdmin
        && !(currentUser.hostelId === 'hostel1' && currentUser.permissions?.canPayInHostel1 === false)
        && !(currentUser.hostelId === 'hostel2' && currentUser.permissions?.canPayInHostel2 === false);
    
    const [selectedDebtor, setSelectedDebtor] = useState(null);
    const [payCash, setPayCash] = useState('');
    const [payCard, setPayCard] = useState('');
    const [payQR, setPayQR] = useState('');
    const [isAdminAdjustModalOpen, setIsAdminAdjustModalOpen] = useState(false);
    const [adminAdjustAmount, setAdminAdjustAmount] = useState('');
    const [magnetActiveField, setMagnetActiveField] = useState(null);
    const [isCreateDebtModalOpen, setIsCreateDebtModalOpen] = useState(false);
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);

    const handlePayClick = (debtor) => { 
        setSelectedDebtor(debtor); 
        setIsPayModalOpen(true); 
        setPayCash(''); setPayCard(''); setPayQR(''); 
        setMagnetActiveField(null);
    };
    
    const handleAdminAdjustClick = (debtor) => { 
        setSelectedDebtor(debtor); 
        setIsAdminAdjustModalOpen(true); 
        setAdminAdjustAmount(''); 
    };
    
    const submitPayment = () => {
        if (!selectedDebtor) return;
        const cash = parseInt(payCash) || 0;
        const card = parseInt(payCard) || 0;
        const qr = parseInt(payQR) || 0;
        const amount = cash + card + qr;
        if (amount <= 0) return;
        const targets = selectedDebtor.records.map(r => ({
            id: r.id, 
            currentDebt: r.currentDebt
        }));
        onPayDebt(targets, amount, { cash, card, qr });
        setIsPayModalOpen(false);
    };

    const submitAdminAdjust = () => {
        if(!selectedDebtor || !adminAdjustAmount) return;
        const latestRecord = selectedDebtor.records[0];
        onAdminAdjustDebt(latestRecord.id, parseInt(adminAdjustAmount));
        setIsAdminAdjustModalOpen(false);
    };

    const applyMagnet = (field) => {
        const currentCash = field === 'payCash' ? 0 : (parseInt(payCash) || 0);
        const currentCard = field === 'payCard' ? 0 : (parseInt(payCard) || 0);
        const currentQR = field === 'payQR' ? 0 : (parseInt(payQR) || 0);
        const currentTotal = currentCash + currentCard + currentQR;
        const remaining = Math.max(0, selectedDebtor.totalDebt - currentTotal);
        if (field === 'payCash') setPayCash(String(remaining));
        if (field === 'payCard') setPayCard(String(remaining));
        if (field === 'payQR') setPayQR(String(remaining));
        setMagnetActiveField(field);
    };

    const toggleDetails = (id) => {
        setExpandedDebtId(prev => prev === id ? null : id);
    };

    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-300">
            
            {/* HEADER & FILTERS */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-4 items-end">
                <div className="flex-1 w-full min-w-0 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('staff')}</label>
                        <select className={inputClass} value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
                            <option value="">Все сотрудники</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('date')}</label>
                        <input type="date" className={inputClass} value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                </div>
                <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-3 items-stretch">
                    <div className="px-6 py-2 bg-rose-50 border border-rose-200 rounded-xl text-center min-w-[200px]">
                        <div className="text-xs font-bold text-rose-400 uppercase tracking-wider">{t('total')} {t('debt')}</div>
                        <div className="text-2xl font-black text-rose-600 tracking-tight">{totalDebt.toLocaleString()}</div>
                    </div>
                    <div className="flex gap-2">
                        <Button icon={Plus} onClick={() => setIsCreateDebtModalOpen(true)} className="flex-1">{t('createDebt')}</Button>
                        <Button variant="secondary" icon={Printer} onClick={() => printDebts(aggregatedDebts, totalDebt)} className="flex-1">{t('print')}</Button>
                    </div>
                </div>
            </div>

            {/* СПИСОК ДОЛЖНИКОВ */}
            <div className="grid gap-3">
                {aggregatedDebts.length === 0 ? (
                    <div className="bg-white rounded-xl p-10 text-center border border-slate-200 border-dashed">
                        <CheckCircle2 size={48} className="mx-auto mb-3 text-slate-300"/>
                        <p className="text-slate-500 font-medium">{t('noData')}</p>
                    </div>
                ) : (
                    aggregatedDebts.map(item => {
                        const isExpanded = expandedDebtId === item.id;
                        return (
                            <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm transition-all overflow-hidden group">
                                <div className="p-4 flex flex-col md:flex-row items-center gap-4">
                                    <div className="flex-1 w-full flex items-center gap-4 cursor-pointer" onClick={() => toggleDetails(item.id)}>
                                        <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center text-lg font-bold shrink-0">
                                            {item.records.length > 1 ? <Users size={20}/> : item.roomNumber}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-slate-800 text-lg truncate mb-0.5 flex items-center gap-2">
                                                {item.fullName}
                                                {item.records.length > 1 && (
                                                    <span className="text-[10px] bg-slate-100 px-1.5 rounded text-slate-500 font-normal">
                                                        {item.records.length} записи
                                                    </span>
                                                )}
                                            </h3>
                                            <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{item.passport}</span>
                                                {!isExpanded && (
                                                    <span className="flex items-center gap-1 text-indigo-600">
                                                        Нажмите для деталей <ChevronDown size={12}/>
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
                                        <div className="text-right min-w-[100px]">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('total')}</div>
                                            <div className="text-xl font-black text-rose-600">
                                                {item.totalDebt.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {canPay && (
                                                <button 
                                                    onClick={() => handlePayClick(item)}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-lg font-bold transition-colors shadow-sm flex items-center gap-2 text-sm"
                                                >
                                                    <Wallet size={18}/> {t('payDebt')}
                                                </button>
                                            )}
                                            {isAdmin && (
                                                <button 
                                                    onClick={() => handleAdminAdjustClick(item)}
                                                    className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-3 rounded-lg transition-colors border border-slate-200"
                                                >
                                                    <Edit size={18}/>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className="bg-slate-50 border-t border-slate-100 p-3 text-sm animate-in slide-in-from-top-2 duration-200">
                                        <div className="text-xs font-bold text-slate-400 uppercase mb-2 px-2">История задолженностей</div>
                                        <div className="space-y-2">
                                            {item.records.map((rec, idx) => (
                                                <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-xs text-slate-500 font-mono">
                                                            {new Date(rec.checkInDate).toLocaleDateString()}
                                                        </div>
                                                        <div className="font-bold text-slate-700 flex flex-col">
                                                            <span>Кассир: {rec.staffName}</span>
                                                            <span className="text-[10px] text-slate-400 font-normal">
                                                                Комната {rec.roomNumber} {rec.autoCheckedOut ? '(Авто-выселение)' : ''}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-bold text-rose-600">
                                                            -{rec.currentDebt.toLocaleString()}
                                                        </div>
                                                        {currentUser.role === 'admin' && (
                                                            <button 
                                                                onClick={() => onOpenGuest(rec)}
                                                                className="text-[10px] text-indigo-600 hover:underline mt-1"
                                                            >
                                                                Карточка
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {isCreateDebtModalOpen && <CreateDebtModal clients={clients} onClose={() => setIsCreateDebtModalOpen(false)} onCreate={onCreateDebt} lang={lang} />}
            
            {isPayModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl border border-slate-300 overflow-hidden max-h-[85vh] overflow-y-auto">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                            <h3 className="font-bold text-lg text-slate-800">{t('payDebt')}</h3>
                            <p className="text-sm text-slate-500 font-medium">{selectedDebtor?.fullName}</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg text-center">
                                <div className="text-xs font-bold text-rose-400 uppercase">Общий долг</div>
                                <div className="text-2xl font-black text-rose-600">{selectedDebtor?.totalDebt.toLocaleString()}</div>
                            </div>
                            {['payCash', 'payCard', 'payQR'].map(field => (
                                <div key={field} className="relative">
                                    <input 
                                        type="number" 
                                        className={inputClass}
                                        placeholder={field === 'payCash' ? t('cash') : field === 'payCard' ? t('card') : t('qr')}
                                        value={field === 'payCash' ? payCash : field === 'payCard' ? payCard : payQR}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if(field === 'payCash') setPayCash(val);
                                            else if(field === 'payCard') setPayCard(val);
                                            else setPayQR(val);
                                            setMagnetActiveField(null);
                                        }}
                                        onWheel={e => e.target.blur()}
                                    />
                                    <button onClick={() => applyMagnet(field)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-emerald-600"><Magnet size={16}/></button>
                                </div>
                            ))}
                            <div className="flex gap-3 mt-2">
                                <Button onClick={() => setIsPayModalOpen(false)} variant="secondary" className="flex-1">{t('cancel')}</Button>
                                <Button onClick={submitPayment} variant="success" className="flex-1">{t('save')}</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {isAdminAdjustModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl p-6">
                        <h3 className="font-bold text-lg mb-4">Admin Adjust</h3>
                        <input className={inputClass} type="number" value={adminAdjustAmount} onChange={e => setAdminAdjustAmount(e.target.value)} placeholder="+/- Amount" />
                        <div className="flex gap-3 mt-4">
                            <Button onClick={() => setIsAdminAdjustModalOpen(false)} variant="secondary" className="flex-1">{t('cancel')}</Button>
                            <Button onClick={submitAdminAdjust} className="flex-1">{t('save')}</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DebtsView;
