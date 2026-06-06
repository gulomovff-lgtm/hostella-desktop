import React, { useState, useMemo } from 'react';
import { Printer, ChevronDown, Users, CheckCircle2, Edit, Wallet, Magnet, Plus, X, AlertCircle } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import Button from '../UI/Button';
import CreateDebtModal from '../Modals/CreateDebtModal';
import DatePicker from '../UI/DatePicker';

// Фирменный зелёный приложения
const BRAND = '#0f9688';
const inputClass = "w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all text-sm shadow-sm font-medium text-slate-700 no-spinner";
const fInput = "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all";

const getTotalPaid = (g) => (typeof g.amountPaid === 'number' ? g.amountPaid : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0)));

const printDebts = (debts, totalDebt) => {
    const w = window.open('', '', 'width=800,height=600');
    const dateStr = new Date().toLocaleDateString();
    const esc = (v) => String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
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
                <td>${esc(d.fullName)}</td>
                <td>${esc(d.passport || '-')}</td>
                <td>${d.roomNumber ? `Комната ${esc(d.roomNumber)}` : '-'}</td>
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

const DebtsView = ({ guests, users, lang, onPayDebt, currentUser, onAdminAdjustDebt, clients, onCreateDebt, onOpenGuest, rooms = [], onPayRentalDebt }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [staffFilter, setStaffFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [expandedDebtId, setExpandedDebtId] = useState(null);
    const [rentalPay, setRentalPay] = useState(null); // комната для оплаты долга по аренде
    const [rpCash, setRpCash] = useState(''); const [rpCard, setRpCard] = useState(''); const [rpQR, setRpQR] = useState('');

    const aggregatedDebts = useMemo(() => {
        const debtMap = {};
        const visibleGuests = (!currentUser || currentUser.role === 'super' || currentUser.role === 'admin')
            ? guests
            : guests.filter(g => g.hostelId === currentUser.hostelId);
        visibleGuests.forEach(g => {
            if (g.status === 'booking') return;
            const totalPaid = getTotalPaid(g);
            const debt = (g.totalPrice || 0) - totalPaid;
            const dateMatch =
                (!startDate || g.checkInDate >= startDate) &&
                (!endDate   || g.checkInDate <= endDate + 'T23:59:59');
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
                    staffName: users.find(u => u.id === g.staffId || u.login === g.staffId)?.name || 'Неизвестно',
                    lastExtendedByName: g.lastExtendedBy
                        ? (users.find(u => u.id === g.lastExtendedBy || u.login === g.lastExtendedBy)?.name || g.lastExtendedBy)
                        : null,
                    lastExtensionPrice: g.lastExtensionPrice || 0,
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
    }, [guests, startDate, endDate, staffFilter, users]);

    // Долги по аренде комнат (из rooms)
    const rentalDebts = useMemo(() => {
        const isAll = !currentUser || currentUser.role === 'super' || currentUser.role === 'admin';
        return (rooms || [])
            .filter(r => r.rental?.active)
            .map(r => {
                const rt = r.rental;
                const paid = (rt.paidCash || 0) + (rt.paidCard || 0) + (rt.paidQR || 0) + (rt.paidTransfer || 0);
                const debt = Math.max(0, (rt.totalAmount || 0) - paid);
                return { roomId: r.id, room: r, number: r.number, hostelId: r.hostelId, tenantName: rt.tenantName, phone: rt.phone, passport: rt.passport, total: rt.totalAmount || 0, paid, debt };
            })
            .filter(x => x.debt > 0 && (isAll || x.hostelId === currentUser.hostelId));
    }, [rooms, currentUser]);

    const totalGuestDebt = aggregatedDebts.reduce((sum, item) => sum + item.totalDebt, 0);
    const totalRentalDebt = rentalDebts.reduce((s, x) => s + x.debt, 0);
    const totalDebt = totalGuestDebt + totalRentalDebt;
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';

    const rpTotal = (parseInt(rpCash) || 0) + (parseInt(rpCard) || 0) + (parseInt(rpQR) || 0);
    const openRentalPay = (x) => { setRentalPay(x); setRpCash(''); setRpCard(''); setRpQR(''); };
    const submitRentalPay = () => {
        if (!rentalPay || rpTotal <= 0) return;
        onPayRentalDebt?.(rentalPay.room, { cash: parseInt(rpCash) || 0, card: parseInt(rpCard) || 0, qr: parseInt(rpQR) || 0 });
        setRentalPay(null);
    };
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
        if (!debtor || debtor.totalDebt <= 0) return;
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
            
            {/* HEADER */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                        <Wallet size={20} className="text-rose-600" />
                    </div>
                    <div>
                        <h2 className="font-black text-xl text-slate-800">Долги</h2>
                        <p className="text-xs text-slate-400 mt-0.5">{aggregatedDebts.length} должников</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsCreateDebtModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-sm shadow-sm shadow-teal-200 transition-opacity hover:opacity-90" style={{ background: BRAND }}>
                        <Plus size={16}/> {t('createDebt')}
                    </button>
                    <button onClick={() => printDebts(aggregatedDebts, totalDebt)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">
                        <Printer size={16}/> {t('print')}
                    </button>
                </div>
            </div>

            {/* TOTAL + FILTERS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* KPI total debt */}
                <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-200">
                    <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/10"/>
                    <div className="relative">
                        <div className="flex items-center gap-2 text-rose-100 text-xs font-bold uppercase tracking-wider mb-1">
                            <AlertCircle size={14}/> {t('total')} {t('debt')}
                        </div>
                        <div className="text-3xl font-black tracking-tight">{totalDebt.toLocaleString()}</div>
                        <div className="text-rose-100 text-[11px] font-semibold mt-1">сум · {aggregatedDebts.length} чел.</div>
                    </div>
                </div>

                {/* Filters */}
                <div className="lg:col-span-2 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1.5 block">{t('staff')}</label>
                        <div className="relative">
                            <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                            <select className={fInput + ' pl-8 appearance-none'} value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
                                <option value="">Все сотрудники</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1.5 block">От</label>
                        <DatePicker value={startDate} onChange={setStartDate} placeholder="дата" className={fInput} />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide mb-1.5 block">До</label>
                        <DatePicker value={endDate} onChange={setEndDate} placeholder="дата" className={fInput} />
                    </div>
                </div>
            </div>

            {/* СПИСОК ДОЛЖНИКОВ */}
            <div className="grid gap-3">
                {(aggregatedDebts.length === 0 && rentalDebts.length === 0) ? (
                    <div className="bg-white rounded-xl p-10 text-center border border-slate-200 border-dashed">
                        <CheckCircle2 size={48} className="mx-auto mb-3 text-slate-300"/>
                        <p className="text-slate-500 font-medium">{t('noData')}</p>
                    </div>
                ) : (
                  <>
                    {aggregatedDebts.map(item => {
                        const isExpanded = expandedDebtId === item.id;
                        return (
                            <div key={item.id} className={`bg-white rounded-2xl border shadow-sm transition-all overflow-hidden group ${isExpanded ? 'border-teal-300 ring-2 ring-teal-100' : 'border-slate-200 hover:border-slate-300 hover:shadow-md'}`}>
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
                                                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{item.passport}</span>
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600">
                                                    {isExpanded ? 'Скрыть' : 'Детали'}
                                                    <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}/>
                                                </span>
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
                                                    className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-3 rounded-xl font-bold transition-colors shadow-sm shadow-teal-200 flex items-center gap-2 text-sm active:scale-95"
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
                                        {/* Сводка по кассирам */}
                                        {(() => {
                                            const byStaff = {};
                                            item.records.forEach(rec => {
                                                const hasDifferentExtender = rec.lastExtendedByName && rec.lastExtendedByName !== rec.staffName;
                                                if (hasDifferentExtender && rec.lastExtensionPrice > 0) {
                                                    // Долг продлившего = min(текущий долг, сколько добавило продление)
                                                    const extenderDebt = Math.min(rec.currentDebt, rec.lastExtensionPrice);
                                                    // Долг заселившего = остаток
                                                    const checkinDebt = rec.currentDebt - extenderDebt;
                                                    if (extenderDebt > 0) {
                                                        byStaff[rec.lastExtendedByName] = (byStaff[rec.lastExtendedByName] || 0) + extenderDebt;
                                                    }
                                                    if (checkinDebt > 0) {
                                                        byStaff[rec.staffName] = (byStaff[rec.staffName] || 0) + checkinDebt;
                                                    }
                                                } else {
                                                    // Продления не было или тот же кассир
                                                    const key = rec.lastExtendedByName || rec.staffName;
                                                    byStaff[key] = (byStaff[key] || 0) + rec.currentDebt;
                                                }
                                            });
                                            const entries = Object.entries(byStaff);
                                            if (entries.length === 0) return null;
                                            return (
                                                <div className="mb-3 px-2">
                                                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">По кассирам</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {entries.map(([name, sum]) => (
                                                            <div key={name} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                                                                <span className="font-semibold text-slate-700">{name}</span>
                                                                <span className="text-rose-600 font-bold">{sum.toLocaleString()}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        <div className="text-xs font-bold text-slate-400 uppercase mb-2 px-2">История задолженностей</div>
                                        <div className="space-y-2">
                                            {item.records.map((rec, idx) => (
                                                <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200">
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-xs text-slate-500 font-mono">
                                                            {new Date(rec.checkInDate).toLocaleDateString()}
                                                        </div>
                                                        <div className="font-bold text-slate-700 flex flex-col">
                                                            <span>Заселил: {rec.staffName}</span>
                                                            {rec.lastExtendedByName && (
                                                                <span className="text-[11px] text-amber-600 font-semibold">
                                                                    Продлил: {rec.lastExtendedByName}
                                                                    {rec.lastExtendedAt ? ` · ${new Date(rec.lastExtendedAt).toLocaleDateString('ru-RU')}` : ''}
                                                                </span>
                                                            )}
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
                                                                className="text-[10px] text-teal-600 hover:underline mt-1 font-semibold"
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
                    })}
                    {rentalDebts.map(x => (
                      <div key={'rent-'+x.roomId} className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                        <div className="p-4 flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-xl shrink-0">🏢</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-800 text-lg truncate flex items-center gap-2">
                              <span className="truncate">{x.tenantName || 'Аренда'}</span>
                              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black shrink-0">АРЕНДА · к.{x.number}</span>
                            </div>
                            <div className="text-xs font-medium text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                              {x.passport ? <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{x.passport}</span> : null}
                              <span>оплачено {x.paid.toLocaleString()} из {x.total.toLocaleString()}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Долг</div>
                            <div className="text-xl font-black text-rose-600">{x.debt.toLocaleString()}</div>
                          </div>
                          {onPayRentalDebt && (
                            <button onClick={() => openRentalPay(x)}
                              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-3 rounded-xl font-bold text-sm shadow-sm shadow-teal-200 flex items-center gap-2 active:scale-95 shrink-0">
                              <Wallet size={18}/> Оплатить
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
            </div>

            {isCreateDebtModalOpen && <CreateDebtModal clients={clients} onClose={() => setIsCreateDebtModalOpen(false)} onCreate={onCreateDebt} lang={lang} />}
            
            {isPayModalOpen && (
                <div className="modal-centered fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pb-[84px] sm:pb-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-base text-slate-800">{t('payDebt')}</h3>
                                <p className="text-xs text-slate-500">{selectedDebtor?.fullName}</p>
                            </div>
                            <button onClick={() => setIsPayModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"><X size={18}/></button>
                        </div>
                        {/* Content */}
                        <div className="px-5 pt-4 pb-2 space-y-3">
                            <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-lg text-center">
                                <div className="text-[10px] font-bold text-rose-400 uppercase">Общий долг</div>
                                <div className="text-xl font-black text-rose-600">{selectedDebtor?.totalDebt.toLocaleString()}</div>
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
                        </div>
                        {/* Buttons */}
                        <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
                            <Button onClick={() => setIsPayModalOpen(false)} variant="secondary" className="flex-1">{t('cancel')}</Button>
                            <Button onClick={submitPayment} variant="success" className="flex-1">{t('save')}</Button>
                        </div>
                    </div>
                </div>
            )}
            
            {isAdminAdjustModalOpen && (
                <div className="modal-centered fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pb-[84px] sm:pb-4">
                    <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl p-6">
                        <h3 className="font-bold text-lg mb-4">{t('adminAdjust')}</h3>
                        <input className={inputClass} type="number" value={adminAdjustAmount} onChange={e => setAdminAdjustAmount(e.target.value)} placeholder={t('amountPlusMinus')} />
                        <div className="flex gap-3 mt-4">
                            <Button onClick={() => setIsAdminAdjustModalOpen(false)} variant="secondary" className="flex-1">{t('cancel')}</Button>
                            <Button onClick={submitAdminAdjust} variant="success" className="flex-1">{t('save')}</Button>
                        </div>
                    </div>
                </div>
            )}

            {rentalPay && (
                <div className="modal-centered fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pb-[84px] sm:pb-4">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-base text-slate-800">Оплата аренды</h3>
                                <p className="text-xs text-slate-500">{rentalPay.tenantName || 'Аренда'} · комната {rentalPay.number}</p>
                            </div>
                            <button onClick={() => setRentalPay(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full"><X size={18}/></button>
                        </div>
                        <div className="px-5 pt-4 pb-2 space-y-3">
                            <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-lg text-center">
                                <div className="text-[10px] font-bold text-rose-400 uppercase">Остаток долга</div>
                                <div className="text-xl font-black text-rose-600">{rentalPay.debt.toLocaleString()}</div>
                            </div>
                            <div className="relative">
                                <input type="number" className={inputClass} placeholder={t('cash')} value={rpCash}
                                    onChange={e => setRpCash(e.target.value)} onWheel={e => e.target.blur()} />
                                <button onClick={() => setRpCash(String(Math.max(0, rentalPay.debt - (parseInt(rpCard)||0) - (parseInt(rpQR)||0))))} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-emerald-600"><Magnet size={16}/></button>
                            </div>
                            <input type="number" className={inputClass} placeholder={t('card')} value={rpCard}
                                onChange={e => setRpCard(e.target.value)} onWheel={e => e.target.blur()} />
                            <input type="number" className={inputClass} placeholder={t('qr')} value={rpQR}
                                onChange={e => setRpQR(e.target.value)} onWheel={e => e.target.blur()} />
                            <div className="flex justify-between items-center text-sm px-1">
                                <span className="text-slate-500 font-medium">Итого к оплате</span>
                                <span className={`font-black ${rpTotal > rentalPay.debt ? 'text-amber-600' : 'text-slate-800'}`}>{rpTotal.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
                            <Button onClick={() => setRentalPay(null)} variant="secondary" className="flex-1">{t('cancel')}</Button>
                            <Button onClick={submitRentalPay} variant="success" className="flex-1" disabled={rpTotal <= 0}>{t('save')}</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DebtsView;
