import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet, Check, Printer, Download, Trash2, Award, Trophy, Medal } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import Button from '../UI/Button';

// --- Styles ---
const inputClass = "w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm shadow-sm font-medium text-slate-700 no-spinner";
const labelClass = "block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide ml-1";

// --- Utilities ---
const getLocalDatetimeString = (dateObj) => {
    if (!dateObj) return '';
    const offset = dateObj.getTimezoneOffset() * 60000;
    return new Date(dateObj.getTime() - offset).toISOString().slice(0, 16);
};

const exportToExcel = (data, filename, totalIncome = 0, totalExpense = 0, totalRefund = 0, hostelLabel = 'Все хостелы', periodStr = '') => {
    const net = totalIncome - totalExpense - totalRefund;
    const loc = n => Number(n).toLocaleString('ru');
    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const mLabel = m => ({ cash:'Наличные', card:'Терминал', qr:'QR' }[m] || m || '—');

    // ── inline style helpers ──────────────────────────────────────────────
    const TD  = 'border:1px solid #e2e8f0;padding:7px 10px;font-family:Arial,sans-serif;font-size:11px;vertical-align:middle;';
    const TH  = 'border:1px solid #3730a3;padding:8px 10px;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;color:#ffffff;background-color:#4338ca;text-align:center;';
    const th  = t => `<th style="${TH}">${t}</th>`;

    // summary card cell
    const card = (bg, fg, label, value, sub) =>
        `<td colspan="2" style="background-color:${bg};border:2px solid ${fg};border-radius:4px;padding:12px 16px;text-align:center;vertical-align:middle;">
            <div style="font-family:Arial,sans-serif;font-size:10px;font-weight:bold;color:${fg};text-transform:uppercase;letter-spacing:1px;">${label}</div>
            <div style="font-family:Arial,sans-serif;font-size:22px;font-weight:bold;color:${fg};margin:4px 0;">${value}</div>
            <div style="font-family:Arial,sans-serif;font-size:9px;color:${fg};opacity:0.7;">${sub}</div>
        </td>`;

    const incCount = data.filter(r => r.type === 'income').length;
    const expCount = data.filter(r => r.type === 'expense' && r.category !== 'Возврат').length;
    const refCount = data.filter(r => r.category === 'Возврат').length;
    const netBg = net >= 0 ? '#dbeafe' : '#fee2e2';
    const netFg = net >= 0 ? '#1e3a8a' : '#7f1d1d';

    // ── row builder ────────────────────────────────────────────────────────
    const rowHtml = data.map((row, i) => {
        const isRef = row.category === 'Возврат';
        const isInc = row.type === 'income';
        const [rowBg, typeBg, typeFg, amtFg] = isInc
            ? ['#f0fdf4','#dcfce7','#166534','#166534']
            : isRef
                ? ['#fffbeb','#fef3c7','#92400e','#92400e']
                : ['#fff1f2','#ffe4e6','#9f1239','#9f1239'];
        const typeLabel = isInc ? '▲ ПРИХОД' : isRef ? '↩ ВОЗВРАТ' : '▼ РАСХОД';
        const sign = isInc ? '+' : '-';
        const stripe = i % 2 === 0 ? rowBg : (isInc ? '#e8fef1' : isRef ? '#fef5d9' : '#ffe8ea');
        return `<tr>
            <td style="${TD}background-color:#f8fafc;color:#94a3b8;text-align:center;">${i+1}</td>
            <td style="${TD}background-color:${stripe};color:#334155;">${esc(row.date)}</td>
            <td style="${TD}background-color:${typeBg};color:${typeFg};font-weight:bold;text-align:center;">${typeLabel}</td>
            <td style="${TD}background-color:${stripe};color:#334155;">${esc(row.hostel)}</td>
            <td style="${TD}background-color:${stripe};color:#334155;">${esc(row.staff)}</td>
            <td style="${TD}background-color:${stripe};color:${amtFg};font-weight:bold;text-align:right;font-size:12px;">${sign}${loc(row.amount)}</td>
            <td style="${TD}background-color:${stripe};color:#475569;text-align:center;">${mLabel(row.method)}</td>
            <td style="${TD}background-color:${stripe};color:#64748b;">${esc(row.comment)}</td>
        </tr>`;
    }).join('');

    // ── totals ─────────────────────────────────────────────────────────────
    const totRow = (label, value, bg, fg) =>
        `<tr><td colspan="5" style="${TD}background-color:${bg};text-align:right;font-weight:bold;font-size:12px;color:${fg};border-top:2px solid ${fg};">${label}</td>
         <td style="${TD}background-color:${bg};text-align:right;font-weight:bold;font-size:14px;color:${fg};border-top:2px solid ${fg};">${value}</td>
         <td colspan="2" style="${TD}background-color:${bg};border-top:2px solid ${fg};"></td></tr>`;

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<style>table{mso-displayed-decimal-separator:".";mso-displayed-thousand-separator:" ";}</style>
</head><body>
<table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
  <!-- ШАПКА -->
  <tr>
    <td colspan="8" style="background-color:#1e1b4b;padding:16px 20px;text-align:center;">
      <div style="font-family:Arial,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:2px;">HOSTELLA</div>
      <div style="font-family:Arial,sans-serif;font-size:13px;color:#a5b4fc;margin-top:4px;">Финансовый отчёт</div>
    </td>
  </tr>
  <tr>
    <td colspan="4" style="background-color:#312e81;padding:8px 20px;font-family:Arial,sans-serif;font-size:11px;color:#c7d2fe;">
      <b style="color:#e0e7ff;">Хостел:</b> ${esc(hostelLabel)}
    </td>
    <td colspan="4" style="background-color:#312e81;padding:8px 20px;font-family:Arial,sans-serif;font-size:11px;color:#c7d2fe;text-align:right;">
      <b style="color:#e0e7ff;">Период:</b> ${esc(periodStr)}
    </td>
  </tr>
  <!-- ПУСТАЯ СТРОКА -->
  <tr><td colspan="8" style="height:10px;background-color:#f8fafc;"></td></tr>
  <!-- СВОДНЫЕ КАРТОЧКИ -->
  <tr>
    ${card('#dcfce7','#166534','▲ Приход','+'+loc(totalIncome), incCount+' операций')}
    ${card('#ffe4e6','#9f1239','▼ Расход','-'+loc(totalExpense), expCount+' операций')}
    ${card('#fef3c7','#92400e','↩ Возврат','-'+loc(totalRefund), refCount+' операций')}
    ${card(netBg,netFg,'= Баланс',(net>=0?'+':'')+loc(net), data.length+' всего')}
  </tr>
  <!-- ПУСТАЯ СТРОКА -->
  <tr><td colspan="8" style="height:12px;background-color:#f8fafc;"></td></tr>
  <!-- ЗАГОЛОВКИ ТАБЛИЦЫ -->
  <tr>${th('№')}${th('Дата и время')}${th('Тип')}${th('Хостел')}${th('Кассир')}${th('Сумма')}${th('Метод')}${th('Описание / Гость')}</tr>
  <!-- СТРОКИ ДАННЫХ -->
  ${rowHtml}
  <!-- ПУСТАЯ СТРОКА -->
  <tr><td colspan="8" style="height:8px;background-color:#f8fafc;"></td></tr>
  <!-- ИТОГИ -->
  ${totRow('ИТОГО ПРИХОД:', '+'+loc(totalIncome),'#dcfce7','#166534')}
  ${totRow('ИТОГО РАСХОД:', '-'+loc(totalExpense),'#ffe4e6','#9f1239')}
  ${totalRefund > 0 ? totRow('ИТОГО ВОЗВРАТ:', '-'+loc(totalRefund),'#fef3c7','#92400e') : ''}
  <tr>
    <td colspan="5" style="${TD}background-color:${netBg};text-align:right;font-weight:bold;font-size:14px;color:${netFg};border-top:3px solid ${netFg};">БАЛАНС:</td>
    <td style="${TD}background-color:${netBg};text-align:right;font-weight:bold;font-size:18px;color:${netFg};border-top:3px solid ${netFg};">${(net>=0?'+':'')+loc(net)}</td>
    <td colspan="2" style="${TD}background-color:${netBg};border-top:3px solid ${netFg};"></td>
  </tr>
  <!-- НИЖНИЙ КОЛОНТИТУЛ -->
  <tr><td colspan="8" style="height:8px;background-color:#f8fafc;"></td></tr>
  <tr>
    <td colspan="8" style="background-color:#f1f5f9;padding:8px 20px;font-family:Arial,sans-serif;font-size:9px;color:#94a3b8;text-align:center;">
      Сформировано: ${new Date().toLocaleString('ru')} · Hostella Management System
    </td>
  </tr>
</table>
</body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const printReport = (data, totalIncome, totalExpense, filters, users) => {
    const w = window.open('', '', 'width=800,height=600');
    const startStr = new Date(filters.start).toLocaleString();
    const endStr = new Date(filters.end).toLocaleString();
    let html = `<html><head><title>Финансовый отчет</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ccc; padding: 5px; text-align: left; }
        th { background-color: #f2f2f2; }
        .header { text-align: center; margin-bottom: 20px; }
        .summary { display: flex; justify-content: space-between; margin: 20px 0; border: 1px solid #000; padding: 10px; }
        .income { color: green; } .expense { color: red; }
        .balance { font-weight: bold; font-size: 14px; }
    </style></head><body>
    <div class="header"><h2>Финансовый отчет</h2><p>${startStr} — ${endStr}</p></div>
    <div class="summary">
        <div>Приход: <span class="income">+${totalIncome.toLocaleString()}</span></div>
        <div>Расход: <span class="expense">-${totalExpense.toLocaleString()}</span></div>
        <div class="balance">Итого: ${(totalIncome - totalExpense).toLocaleString()}</div>
    </div>
    <table><thead><tr><th>Дата</th><th>Тип</th><th>Сумма</th><th>Метод</th><th>Кассир</th><th>Описание</th></tr></thead><tbody>`;
    data.forEach(row => {
        const staffName = users.find(u => u.id === row.staffId || u.login === row.staffId)?.name || '(Удалённый кассир)';
        const typeLabel = row.type === 'income' ? 'Приход' : 'Расход';
        const typeClass = row.type === 'income' ? 'income' : 'expense';
        html += `<tr><td>${new Date(row.date).toLocaleString()}</td><td class="${typeClass}">${typeLabel}</td>
            <td>${parseInt(row.amount).toLocaleString()}</td><td>${row.method || '-'}</td>
            <td>${staffName}</td><td>${row.comment || '-'}</td></tr>`;
    });
    html += `</tbody></table></body></html>`;
    w.document.write(html);
    w.document.close();
    w.print();
};

// --- ReportsView ---
const ReportsView = ({ payments, expenses, users, guests, currentUser, onDeletePayment, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const HOSTEL_LIST = [
        { id: 'hostel1', name: 'Хостел №1' },
        { id: 'hostel2', name: 'Хостел №2' }
    ];
    const [tempFilters, setTempFilters] = useState({
        start: getLocalDatetimeString(new Date(new Date().setHours(0,0,0,0))), 
        end: getLocalDatetimeString(new Date(new Date().setHours(23,59,59,999))), 
        staffId: '',
        method: '',
        type: '',
        hostelId: currentUser.role === 'admin' && currentUser.hostelId !== 'all' ? currentUser.hostelId : '' 
    });
    const [filters, setFilters] = useState({
        start: getLocalDatetimeString(new Date(new Date().setHours(0,0,0,0))),
        end: getLocalDatetimeString(new Date(new Date().setHours(23,59,59,999))),
        staffId: '',
        method: '',
        type: '',
        hostelId: currentUser.role === 'admin' && currentUser.hostelId !== 'all' ? currentUser.hostelId : ''
    });
    const handleApplyFilters = () => { setFilters(tempFilters); };
    const allTransactions = useMemo(() => {
        const incomes = payments.map(p => {
            let hId = p.hostelId;
            if (!hId && p.staffId) {
                const staff = users.find(u => u.id === p.staffId || u.login === p.staffId);
                if (staff) hId = staff.hostelId;
            }
            return { ...p, type: 'income', id: p.id, hostelId: hId };
        });
        const outcomes = expenses.map(e => {
            let hId = e.hostelId;
            if (!hId && e.staffId) { 
                const staff = users.find(u => u.id === e.staffId || u.login === e.staffId);
                if (staff) hId = staff.hostelId;
            }
            return { ...e, type: 'expense', method: 'cash', id: e.id, hostelId: hId };
        });
        return [...incomes, ...outcomes].sort((a,b) => new Date(b.date) - new Date(a.date));
    }, [payments, expenses, users]);

    const filteredData = useMemo(() => allTransactions.filter(t => {
        const tTime = new Date(t.date).getTime();
        const startTime = filters.start ? new Date(filters.start).getTime() : 0;
        const endTime = filters.end ? new Date(filters.end).getTime() : Infinity;
        const matchesDate = tTime >= startTime && tTime <= endTime;
        const matchesStaff = filters.staffId ? (t.staffId === filters.staffId || (users.find(u=>u.id===filters.staffId)?.login === t.staffId)) : true;
        const matchesMethod = filters.method ? t.method === filters.method : true;
        const matchesType = filters.type === 'refund'
            ? (t.type === 'expense' && t.category === 'Возврат')
            : filters.type === 'expense'
                ? (t.type === 'expense' && t.category !== 'Возврат')
                : filters.type === 'income'
                    ? t.type === 'income'
                    : true;
        const matchesHostel = filters.hostelId ? t.hostelId === filters.hostelId : true;
        if (parseInt(t.amount) === 0) return false;
        return matchesDate && matchesStaff && matchesMethod && matchesType && matchesHostel;
    }), [allTransactions, filters, users]);

    const availableCashiers = useMemo(() => {
        if (!tempFilters.hostelId) return users; 
        return users.filter(u => u.hostelId === tempFilters.hostelId || u.hostelId === 'all');
    }, [users, tempFilters.hostelId]);

    const totalIncome  = filteredData.filter(t => t.type === 'income').reduce((sum, t) => sum + (parseInt(t.amount)||0), 0);
    const totalRefund  = filteredData.filter(t => t.type === 'expense' && t.category === 'Возврат').reduce((sum, t) => sum + (parseInt(t.amount)||0), 0);
    const totalExpense = filteredData.filter(t => t.type === 'expense' && t.category !== 'Возврат').reduce((sum, t) => sum + (parseInt(t.amount)||0), 0);

    const handleExport = () => {
        const hostelLabel = filters.hostelId
            ? (HOSTEL_LIST.find(h => h.id === filters.hostelId)?.name || filters.hostelId)
            : 'Все хостелы';
        const periodStr = `${new Date(filters.start).toLocaleString('ru')} — ${new Date(filters.end).toLocaleString('ru')}`;
        const exportData = filteredData.map(item => ({
            date: new Date(item.date).toLocaleString('ru'),
            type: item.type,
            category: item.category || (item.type === 'income' ? 'Оплата' : 'Расход'),
            staff: users.find(u => u.id === item.staffId || u.login === item.staffId)?.name || '—',
            hostel: HOSTEL_LIST.find(h => h.id === item.hostelId)?.name || item.hostelId || '—',
            amount: parseInt(item.amount) || 0,
            method: item.method || '-',
            comment: item.comment || (item.guestId ? guests.find(g => g.id === item.guestId)?.fullName : null) || '—',
        }));
        exportToExcel(exportData, `Hostella_Финансы_${new Date().toISOString().slice(0,10)}.xls`, totalIncome, totalExpense, totalRefund, hostelLabel, periodStr);
    };

    const applyPreset = (preset) => {
        const now = new Date();
        let s, e;
        if (preset === 'today') {
            s = new Date(now); s.setHours(0,0,0,0);
            e = new Date(now); e.setHours(23,59,59,999);
        } else if (preset === 'yesterday') {
            s = new Date(now); s.setDate(s.getDate()-1); s.setHours(0,0,0,0);
            e = new Date(now); e.setDate(e.getDate()-1); e.setHours(23,59,59,999);
        } else if (preset === 'week') {
            s = new Date(now); s.setDate(s.getDate()-6); s.setHours(0,0,0,0);
            e = new Date(now); e.setHours(23,59,59,999);
        } else if (preset === 'month') {
            s = new Date(now.getFullYear(), now.getMonth(), 1);
            e = new Date(now); e.setHours(23,59,59,999);
        }
        const nf = { ...tempFilters, start: getLocalDatetimeString(s), end: getLocalDatetimeString(e) };
        setTempFilters(nf); setFilters(nf);
    };
    const net = totalIncome - totalExpense - totalRefund;

    // ── Top Cashiers ──────────────────────────────────────────────────────
    const topCashiers = useMemo(() => {
        const map = {};
        filteredData.filter(t => t.type === 'income').forEach(t => {
            const uid  = t.staffId || 'unknown';
            const user = users.find(u => u.id === uid || u.login === uid);
            const name = user?.name || uid;
            if (!map[uid]) map[uid] = { name, income: 0, count: 0 };
            map[uid].income += parseInt(t.amount) || 0;
            map[uid].count  += 1;
        });
        return Object.values(map).sort((a, b) => b.income - a.income).slice(0, 5);
    }, [filteredData, users]);

    const MedalIcon = ({ rank }) => {
        if (rank === 0) return <Trophy size={16} className="text-amber-500"/>;
        if (rank === 1) return <Medal size={16} className="text-slate-400"/>;
        if (rank === 2) return <Medal size={16} className="text-orange-400"/>;
        return <span className="text-xs font-black text-slate-400 w-4 text-center">{rank + 1}</span>;
    };

    return (
        <div className="space-y-4 animate-in fade-in">
            {/* -- SUMMARY CARDS -- */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-lg">
                    <div className="flex items-center gap-2 mb-2 opacity-80"><TrendingUp size={16}/><span className="text-xs font-bold uppercase tracking-wide">Приход</span></div>
                    <div className="text-xl sm:text-2xl font-black">+{totalIncome.toLocaleString()}</div>
                    <div className="text-[10px] opacity-70 mt-0.5">{filteredData.filter(x=>x.type==='income').length} операций</div>
                </div>
                <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-4 text-white shadow-lg">
                    <div className="flex items-center gap-2 mb-2 opacity-80"><TrendingDown size={16}/><span className="text-xs font-bold uppercase tracking-wide">Расход</span></div>
                    <div className="text-xl sm:text-2xl font-black">-{totalExpense.toLocaleString()}</div>
                    <div className="text-[10px] opacity-70 mt-0.5">{filteredData.filter(x=>x.type==='expense'&&x.category!=='Возврат').length} операций</div>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 text-white shadow-lg">
                    <div className="flex items-center gap-2 mb-2 opacity-80"><TrendingDown size={16}/><span className="text-xs font-bold uppercase tracking-wide">Возврат</span></div>
                    <div className="text-xl sm:text-2xl font-black">-{totalRefund.toLocaleString()}</div>
                    <div className="text-[10px] opacity-70 mt-0.5">{filteredData.filter(x=>x.type==='expense'&&x.category==='Возврат').length} операций</div>
                </div>
                <div className={`rounded-2xl p-4 text-white shadow-lg bg-gradient-to-br ${ net >= 0 ? 'from-indigo-500 to-purple-600' : 'from-slate-600 to-slate-700'}`}>
                    <div className="flex items-center gap-2 mb-2 opacity-80"><Wallet size={16}/><span className="text-xs font-bold uppercase tracking-wide">Баланс</span></div>
                    <div className="text-xl sm:text-2xl font-black">{net >= 0 ? '+' : ''}{net.toLocaleString()}</div>
                    <div className="text-[10px] opacity-70 mt-0.5">{filteredData.length} всего</div>
                </div>
            </div>

            {/* ── Top Cashiers ── */}
            {currentUser.role !== 'cashier' && topCashiers.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-amber-50">
                        <Award size={16} className="text-amber-600"/>
                        <span className="font-black text-slate-700 text-sm">Топ кассиров — приход за период</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {topCashiers.map((c, i) => {
                            const maxIncome = topCashiers[0]?.income || 1;
                            const pct = Math.round((c.income / maxIncome) * 100);
                            return (
                                <div key={i} className="flex items-center gap-3 px-5 py-3">
                                    <MedalIcon rank={i}/>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-bold text-slate-800 truncate">{c.name}</span>
                                            <span className="text-sm font-black text-emerald-700 ml-2 shrink-0">+{c.income.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all" style={{ width: `${pct}%` }}/>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-semibold shrink-0">{c.count} оп.</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* -- FILTERS -- */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex gap-2 p-3 border-b border-slate-100 bg-slate-50 overflow-x-auto">
                    {[['today','Сегодня'],['yesterday','Вчера'],['week','7 дней'],['month','Этот месяц']].map(([k,l]) => (
                        <button key={k} onClick={() => applyPreset(k)}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 text-xs font-bold transition-all shadow-sm">
                            {l}
                        </button>
                    ))}
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                        <label className={labelClass}>С</label>
                        <input type="datetime-local" className={inputClass} value={tempFilters.start} onChange={e=>setTempFilters({...tempFilters,start:e.target.value})}/>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <label className={labelClass}>По</label>
                        <input type="datetime-local" className={inputClass} value={tempFilters.end} onChange={e=>setTempFilters({...tempFilters,end:e.target.value})}/>
                    </div>
                    <div>
                        <label className={labelClass}>Тип</label>
                        <select className={inputClass} value={tempFilters.type} onChange={e=>setTempFilters({...tempFilters,type:e.target.value})}>
                            <option value="">Все</option>
                            <option value="income">Приход</option>
                            <option value="expense">Расход</option>
                            <option value="refund">Возврат</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Метод</label>
                        <select className={inputClass} value={tempFilters.method} onChange={e=>setTempFilters({...tempFilters,method:e.target.value})}>
                            <option value="">Все</option>
                            <option value="cash">{t('cash')}</option>
                            <option value="card">{t('card')}</option>
                            <option value="qr">{t('qr')}</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>{t('staff')}</label>
                        <select className={inputClass} value={tempFilters.staffId} onChange={e=>setTempFilters({...tempFilters,staffId:e.target.value})}>
                            <option value="">Все</option>
                            {availableCashiers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="px-4 pb-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <Button onClick={handleApplyFilters} icon={Check}>Применить</Button>
                    <Button icon={Printer} variant="secondary" onClick={() => printReport(filteredData, totalIncome, totalExpense, filters, users)}>{t('printReport')}</Button>
                    <Button icon={Download} variant="secondary" onClick={handleExport}>Excel</Button>
                </div>
            </div>

            {/* -- TRANSACTIONS (Mobile) -- */}
            <div className="lg:hidden space-y-2">
                {filteredData.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-400">{t('noData')}</div>
                ) : filteredData.map((item, i) => {
                    const staffName = users.find(u=>u.id===item.staffId||u.login===item.staffId)?.name||'—';
                    const detail = item.comment||(item.guestId?guests.find(g=>g.id===item.guestId)?.fullName:null)||'—';
                    const hostelName = HOSTEL_LIST.find(h=>h.id===item.hostelId)?.name||item.hostelId||'—';
                    const isIncome = item.type==='income';
                    return (
                        <div key={i} className={`bg-white rounded-2xl border p-3.5 shadow-sm ${ isIncome ? 'border-emerald-100' : 'border-rose-100' }`}>
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700' }`}>
                                        {isIncome ? <TrendingUp size={16}/> : <TrendingDown size={16}/>}
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-slate-800 leading-tight">{detail}</div>
                                        <div className="text-xs text-slate-400">{staffName} · {hostelName}</div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className={`font-black text-base ${ isIncome ? 'text-emerald-600' : 'text-rose-600' }`}>
                                        {isIncome?'+':'-'}{parseInt(item.amount).toLocaleString()}
                                    </div>
                                    <div className="text-[10px] text-slate-400">{new Date(item.date).toLocaleString('ru',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-slate-100">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ isIncome ? 'bg-emerald-100 text-emerald-700' : item.category === 'Возврат' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700' }`}>
                                    {isIncome ? 'ПРИХОД' : item.category === 'Возврат' ? 'ВОЗВРАТ' : 'РАСХОД'}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">{item.method||'—'}</span>
                                {currentUser.role==='super' && (
                                    <button onClick={()=>onDeletePayment(item.id,item.type,item)} className="ml-auto p-1 text-rose-400 hover:bg-rose-50 rounded-lg"><Trash2 size={13}/></button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* -- TRANSACTIONS (Desktop) -- */}
            <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200">
                                <th className="px-4 py-3">{t('date')}</th>
                                <th className="px-4 py-3">Хостел</th>
                                <th className="px-4 py-3">Тип</th>
                                <th className="px-4 py-3">{t('amount')}</th>
                                <th className="px-4 py-3">Метод</th>
                                <th className="px-4 py-3">{t('staff')}</th>
                                <th className="px-4 py-3">Детали</th>
                                {currentUser.role==='super' && <th className="px-4 py-3"/>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredData.length===0 ? (
                                <tr><td colSpan={8} className="p-8 text-center text-slate-400">{t('noData')}</td></tr>
                            ) : filteredData.map((item,i) => {
                                const staffName = users.find(u=>u.id===item.staffId||u.login===item.staffId)?.name||'—';
                                const detail = item.comment||(item.guestId?guests.find(g=>g.id===item.guestId)?.fullName:null)||'—';
                                const hostelName = HOSTEL_LIST.find(h=>h.id===item.hostelId)?.name||'—';
                                const isIncome = item.type==='income';
                                return (
                                    <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{new Date(item.date).toLocaleString('ru')}</td>
                                        <td className="px-4 py-3 text-xs font-semibold text-slate-600">{hostelName}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full ${ isIncome ? 'bg-emerald-100 text-emerald-700' : item.category === 'Возврат' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700' }`}>
                                                {isIncome ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                                                {isIncome ? 'ПРИХОД' : item.category === 'Возврат' ? 'ВОЗВРАТ' : 'РАСХОД'}
                                            </span>
                                        </td>
                                        <td className={`px-4 py-3 font-black text-sm ${ isIncome ? 'text-emerald-600' : 'text-rose-600' }`}>
                                            {isIncome?'+':'-'}{parseInt(item.amount).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 uppercase text-[10px] font-bold text-slate-400">{item.method||'—'}</td>
                                        <td className="px-4 py-3 text-sm text-slate-700">{staffName}</td>
                                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">{detail}</td>
                                        {currentUser.role==='super' && (
                                            <td className="px-4 py-3">
                                                <button onClick={()=>onDeletePayment(item.id,item.type,item)} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg"><Trash2 size={14}/></button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ReportsView;
