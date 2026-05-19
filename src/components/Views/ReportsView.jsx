import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet, Check, Printer, Download, Trash2, Award, Trophy, Medal } from 'lucide-react';
import * as XLSX from 'xlsx';
import TRANSLATIONS from '../../constants/translations';
import Button from '../UI/Button';

// --- Styles ---
const inputClass = "w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm shadow-sm font-medium text-slate-700 no-spinner";
const labelClass = "block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide ml-1";

// --- Utilities ---
const METHOD_LABELS = { cash: 'Наличные', card: 'Терминал', qr: 'QR', transfer: 'Перечисление' };
const methodLabel = m => METHOD_LABELS[m] || m || '—';

const getLocalDatetimeString = (dateObj) => {
    if (!dateObj) return '';
    const offset = dateObj.getTimezoneOffset() * 60000;
    return new Date(dateObj.getTime() - offset).toISOString().slice(0, 16);
};

const exportToExcel = (data, filename, totalIncome = 0, totalExpense = 0, totalRefund = 0, hostelLabel = 'Все хостелы', periodStr = '') => {
    const net = totalIncome - totalExpense - totalRefund;
    const loc = n => Number(n).toLocaleString('ru');
    const mLabel = methodLabel;
    const typeLabel = r => r.type === 'income' ? 'Приход' : r.category === 'Возврат' ? 'Возврат' : 'Расход';

    // ─── Лист 1: Все операции ────────────────────────────────────
    const mainRows = data.map((r, i) => ({
        '№':            i + 1,
        'Дата и время':  r.date,
        'Тип':          typeLabel(r),
        'Хостел':       r.hostel,
        'Кассир':      r.staff,
        'Категория':   r.category || '—',
        'Сумма (сум)':  r.type === 'expense' ? -Math.abs(r.amount) : r.amount,
        'Метод':        mLabel(r.method),
        'Комментарий':  r.comment,
    }));

    // Итоговые строки
    mainRows.push({});
    mainRows.push({ '№': 'ИТОГО', 'Дата и время': 'Приход',    'Сумма (сум)': totalIncome });
    mainRows.push({ '№': '',       'Дата и время': 'Расход',    'Сумма (сум)': -totalExpense });
    if (totalRefund > 0)
        mainRows.push({ '№': '', 'Дата и время': 'Возврат', 'Сумма (сум)': -totalRefund });
    mainRows.push({ '№': '', 'Дата и время': 'БАЛАНС',    'Сумма (сум)': net });

    // ─── Лист 2: Сводка ────────────────────────────────────────────
    const summaryRows = [
        { 'Показатель': 'Период',    'Значение': periodStr },
        { 'Показатель': 'Хостел',     'Значение': hostelLabel },
        { 'Показатель': 'Сформировано', 'Значение': new Date().toLocaleString('ru') },
        {},
        { 'Показатель': 'ВСЕГО ПРИХОД',    'Значение': totalIncome,  'Операций': data.filter(r => r.type === 'income').length },
        { 'Показатель': 'ВСЕГО РАСХОД',    'Значение': -totalExpense, 'Операций': data.filter(r => r.type === 'expense' && r.category !== 'Возврат').length },
        { 'Показатель': 'ВСЕГО ВОЗВРАТ',   'Значение': -totalRefund,  'Операций': data.filter(r => r.category === 'Возврат').length },
        { 'Показатель': 'БАЛАНС',           'Значение': net,           'Операций': data.length },
    ];

    // ─── Лист 3: По кассирам ──────────────────────────────────────
    const byStaff = {};
    data.forEach(r => {
        const s = r.staff || '—';
        if (!byStaff[s]) byStaff[s] = { income: 0, expense: 0, refund: 0, count: 0 };
        if (r.type === 'income') byStaff[s].income += r.amount;
        else if (r.category === 'Возврат') byStaff[s].refund += r.amount;
        else byStaff[s].expense += r.amount;
        byStaff[s].count++;
    });
    const staffRows = Object.entries(byStaff)
        .sort((a, b) => b[1].income - a[1].income)
        .map(([name, v]) => ({
            'Кассир':         name,
            'Операций':      v.count,
            'Приход (сум)':    v.income,
            'Расход (сум)':   -v.expense,
            'Возврат (сум)':  -v.refund,
            'Баланс (сум)':   v.income - v.expense - v.refund,
        }));

    // ─── Лист 4: По методам оплаты ────────────────────────────
    const byMethod = {};
    data.filter(r => r.type === 'income').forEach(r => {
        const m = mLabel(r.method);
        byMethod[m] = (byMethod[m] || 0) + r.amount;
    });
    const methodRows = Object.entries(byMethod)
        .sort((a, b) => b[1] - a[1])
        .map(([method, sum]) => ({
            'Метод оплаты': method,
            'Сумма (сум)': sum,
            'Доля (%)': totalIncome > 0 ? +((sum / totalIncome) * 100).toFixed(1) : 0,
        }));

    // ─── Сборка книги ───────────────────────────────────────────
    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.json_to_sheet(mainRows);
    ws1['!cols'] = [
        { wch: 5  }, // №
        { wch: 20 }, // Дата
        { wch: 10 }, // Тип
        { wch: 14 }, // Хостел
        { wch: 18 }, // Кассир
        { wch: 16 }, // Категория
        { wch: 16 }, // Сумма
        { wch: 12 }, // Метод
        { wch: 38 }, // Комментарий
    ];
    ws1['!freeze'] = { xSplit: 0, ySplit: 1 };
    ws1['!autofilter'] = { ref: ws1['!ref'] };
    XLSX.utils.book_append_sheet(wb, ws1, 'Операции');

    const ws2 = XLSX.utils.json_to_sheet(summaryRows);
    ws2['!cols'] = [{ wch: 22 }, { wch: 30 }, { wch: 12 }];
    ws2['!freeze'] = { xSplit: 0, ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ws2, 'Сводка');

    if (staffRows.length > 0) {
        const ws3 = XLSX.utils.json_to_sheet(staffRows);
        ws3['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
        ws3['!freeze'] = { xSplit: 0, ySplit: 1 };
        ws3['!autofilter'] = { ref: ws3['!ref'] };
        XLSX.utils.book_append_sheet(wb, ws3, 'По кассирам');
    }

    if (methodRows.length > 0) {
        const ws4 = XLSX.utils.json_to_sheet(methodRows);
        ws4['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 12 }];
        ws4['!freeze'] = { xSplit: 0, ySplit: 1 };
        ws4['!autofilter'] = { ref: ws4['!ref'] };
        XLSX.utils.book_append_sheet(wb, ws4, 'По методам');
    }

    // заменяем .xls на .xlsx в имени файла
    const xlsxFilename = filename.replace(/\.xls$/, '.xlsx');
    XLSX.writeFile(wb, xlsxFilename);
};

const printReport = (data, totalIncome, totalExpense, totalRefund, filters, users) => {
    const w = window.open('', '', 'width=800,height=600');
    const esc = (v) => String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
    const startStr = new Date(filters.start).toLocaleString();
    const endStr = new Date(filters.end).toLocaleString();
    const netBalance = totalIncome - totalExpense - totalRefund;
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
        ${totalRefund > 0 ? `<div>Возврат: <span class="expense">-${totalRefund.toLocaleString()}</span></div>` : ''}
        <div class="balance">Итого: ${netBalance.toLocaleString()}</div>
    </div>
    <table><thead><tr><th>Дата</th><th>Тип</th><th>Сумма</th><th>Метод</th><th>Кассир</th><th>Описание</th></tr></thead><tbody>`;
    data.forEach(row => {
        const staffName = users.find(u => u.id === row.staffId || u.login === row.staffId)?.name || '(Удалённый кассир)';
        const typeLabel = row.type === 'income' ? 'Приход' : 'Расход';
        const typeClass = row.type === 'income' ? 'income' : 'expense';
        html += `<tr><td>${new Date(row.date).toLocaleString()}</td><td class="${typeClass}">${typeLabel}</td>
            <td>${parseInt(row.amount).toLocaleString()}</td><td>${esc(row.method || '-')}</td>
            <td>${esc(staffName)}</td><td>${esc(row.comment || '-')}</td></tr>`;
    });
    html += `</tbody></table></body></html>`;
    w.document.write(html);
    w.document.close();
    w.print();
};

// --- ReportsView ---
const ReportsView = ({ payments, expenses, users, guests, currentUser, onDeletePayment, onCashToTerminal, lang }) => {
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
    const handleApplyFilters = () => {
        if (tempFilters.start && tempFilters.end && tempFilters.start > tempFilters.end) {
            // Автоматически меняем местами если «С» позже «По»
            setFilters({ ...tempFilters, start: tempFilters.end, end: tempFilters.start });
            setTempFilters(p => ({ ...p, start: p.end, end: p.start }));
        } else {
            setFilters(tempFilters);
        }
    };

    const [cashToTerminalOpen, setCashToTerminalOpen] = useState(false);
    const [cttAmount, setCttAmount] = useState('');
    const [cttComment, setCttComment] = useState('');
    const [cttDate, setCttDate] = useState('');
    const [cttReceipt, setCttReceipt] = useState(null); // base64 image
    const [cttDragOver, setCttDragOver] = useState(false);
    const [receiptViewer, setReceiptViewer] = useState(null); // lightbox
    const openCTT = () => {
        setCttDate(getLocalDatetimeString(new Date()));
        setCashToTerminalOpen(true);
    };
    const closeCTT = () => { setCashToTerminalOpen(false); setCttAmount(''); setCttComment(''); setCttDate(''); setCttReceipt(null); };
    const loadReceiptFile = (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => setCttReceipt(e.target.result);
        reader.readAsDataURL(file);
    };
    const handleSubmitCTT = async () => {
        const amt = parseInt(cttAmount);
        if (!amt || amt <= 0) return;
        const dateOverride = cttDate ? new Date(cttDate).toISOString() : null;
        await onCashToTerminal(amt, cttComment, dateOverride, cttReceipt);
        closeCTT();
    };

    const allTransactions = useMemo(() => {
        const incomes = payments.map(p => {
            let hId = p.hostelId;
            if (!hId && p.staffId) {
                const staff = users.find(u => u.id === p.staffId || u.login === p.staffId);
                if (staff) hId = staff.hostelId;
            }
            // cash_to_terminal: keep original type so it renders separately
            if (p.type === 'cash_to_terminal') return { ...p, id: p.id, hostelId: hId };
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
        // cash_to_terminal: показываем только если тип «инкассация» или фильтр не задан
        if (t.type === 'cash_to_terminal') return (filters.type === 'ctt' || !filters.type) && matchesDate && matchesStaff && matchesHostel;
        if (filters.type === 'ctt') return false;
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
    const totalCTT     = filteredData.filter(t => t.type === 'cash_to_terminal').reduce((sum, t) => sum + (parseInt(t.amount)||0), 0);

    const handleExport = () => {
        const hostelLabel = filters.hostelId
            ? (HOSTEL_LIST.find(h => h.id === filters.hostelId)?.name || filters.hostelId)
            : 'Все хостелы';
        const periodStr = `${new Date(filters.start).toLocaleString('ru')} — ${new Date(filters.end).toLocaleString('ru')}`;
        const CATEGORY_RU = { accommodation: 'Проживание' };
        const exportData = filteredData.map(item => ({
            date: new Date(item.date).toLocaleString('ru'),
            type: item.type,
            category: CATEGORY_RU[item.category] || item.category || (item.type === 'income' ? 'Оплата' : 'Расход'),
            staff: users.find(u => u.id === item.staffId || u.login === item.staffId)?.name || '—',
            hostel: HOSTEL_LIST.find(h => h.id === item.hostelId)?.name || item.hostelId || '—',
            amount: parseInt(item.amount) || 0,
            method: item.method || '-',
            comment: item.comment || (item.guestId ? guests.find(g => g.id === item.guestId)?.fullName : null) || '—',
        }));
        const dateFrom = new Date(filters.start).toLocaleDateString('ru').replace(/\./g, '-');
        const dateTo   = new Date(filters.end).toLocaleDateString('ru').replace(/\./g, '-');
        const sortLabel = filters.type ? filters.type : 'все';
        const hostelSlug = filters.hostelId
            ? (HOSTEL_LIST.find(h => h.id === filters.hostelId)?.name || filters.hostelId).replace(/\s/g, '_')
            : 'Все_хостелы';
        const fname = `Hostella_${dateFrom}_${dateTo}_${sortLabel}_${hostelSlug}.xls`;
        exportToExcel(exportData, fname, totalIncome, totalExpense, totalRefund, hostelLabel, periodStr);
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
        <>
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

            {totalCTT > 0 && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-blue-700">
                        <span className="text-lg">🏦</span>
                        <span className="font-bold text-sm">Инкассация за период</span>
                    </div>
                    <span className="font-black text-blue-800 text-lg">{totalCTT.toLocaleString()} сум</span>
                </div>
            )}

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
                            <option value="ctt">Инкассация</option>
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>Метод</label>
                        <select className={inputClass} value={tempFilters.method} onChange={e=>setTempFilters({...tempFilters,method:e.target.value})}>
                            <option value="">Все</option>
                            <option value="cash">{t('cash')}</option>
                            <option value="card">{t('card')}</option>
                            <option value="qr">{t('qr')}</option>
                            <option value="transfer">Перечисление</option>
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
                    <Button icon={Printer} variant="secondary" onClick={() => printReport(filteredData, totalIncome, totalExpense, totalRefund, filters, users)}>{t('printReport')}</Button>
                    <Button icon={Download} variant="secondary" onClick={handleExport}>Excel</Button>
                    {onCashToTerminal && (
                        <button
                            onClick={openCTT}
                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
                        >
                            🏦 Инкассация
                        </button>
                    )}
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
                    const isCTT = item.type === 'cash_to_terminal';
                    if (isCTT) return (
                        <div key={i} className="bg-blue-50 rounded-2xl border border-blue-200 p-3.5 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-blue-100 text-blue-700 text-base">🏦</div>
                                    <div>
                                        <div className="font-bold text-sm text-blue-900 leading-tight">{detail}</div>
                                        <div className="text-xs text-blue-500">{staffName} · {hostelName}</div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="font-black text-base text-blue-700">{parseInt(item.amount).toLocaleString()}</div>
                                    <div className="text-[10px] text-blue-400">{new Date(item.date).toLocaleString('ru',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-blue-100">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-200 text-blue-800">ИНКАССАЦИЯ</span>
                                {item.receipt && (
                                    <button onClick={() => setReceiptViewer(item.receipt)} className="ml-1 text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1">🧾 Чек</button>
                                )}
                                {currentUser.role==='super' && (
                                    <button onClick={()=>onDeletePayment(item.id,'income',item)} className="ml-auto p-1 text-rose-400 hover:bg-rose-50 rounded-lg"><Trash2 size={13}/></button>
                                )}
                            </div>
                        </div>
                    );
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
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{methodLabel(item.method)}</span>
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
                                const isCTT = item.type === 'cash_to_terminal';
                                if (isCTT) return (
                                    <tr key={i} className="bg-blue-50/60 hover:bg-blue-100/40 transition-colors">
                                        <td className="px-4 py-3 text-blue-500 text-xs whitespace-nowrap">{new Date(item.date).toLocaleString('ru')}</td>
                                        <td className="px-4 py-3 text-xs font-semibold text-blue-600">{hostelName}</td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full bg-blue-200 text-blue-800">🏦 ИНКАССАЦИЯ</span>
                                        </td>
                                        <td className="px-4 py-3 font-black text-sm text-blue-700">{parseInt(item.amount).toLocaleString()}</td>
                                        <td className="px-4 py-3 uppercase text-[10px] font-bold text-blue-400">НАЛИ</td>
                                        <td className="px-4 py-3 text-sm text-blue-700">{staffName}</td>
                                        <td className="px-4 py-3 text-xs text-blue-500 max-w-[200px]">
                                            <span className="truncate block">{detail}</span>
                                            {item.receipt && (
                                                <button onClick={() => setReceiptViewer(item.receipt)} className="text-blue-600 font-bold hover:underline flex items-center gap-1 mt-0.5">🧾 Чек</button>
                                            )}
                                        </td>
                                        {currentUser.role==='super' && (
                                            <td className="px-4 py-3">
                                                <button onClick={()=>onDeletePayment(item.id,'income',item)} className="p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg"><Trash2 size={14}/></button>
                                            </td>
                                        )}
                                    </tr>
                                );
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
                                        <td className="px-4 py-3 text-[10px] font-bold text-slate-400">{methodLabel(item.method)}</td>
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

        {cashToTerminalOpen && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🏦</span>
                        <div>
                            <h2 className="font-black text-slate-800 text-lg">Инкассация</h2>
                            <p className="text-xs text-slate-400">Перевод наличных в терминал</p>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Сумма (сум)</label>
                        <input
                            type="number"
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-bold text-slate-800 focus:border-blue-500 outline-none text-lg"
                            placeholder="0"
                            value={cttAmount}
                            onChange={e => setCttAmount(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Дата и время</label>
                        <input
                            type="datetime-local"
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-medium text-slate-700 focus:border-blue-500 outline-none"
                            value={cttDate}
                            onChange={e => setCttDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Комментарий (опц.)</label>
                        <input
                            type="text"
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-medium text-slate-700 focus:border-blue-500 outline-none"
                            placeholder="Инкассация — перевод наличных в терминал"
                            value={cttComment}
                            onChange={e => setCttComment(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Чек (фото)</label>
                        {cttReceipt ? (
                            <div className="relative">
                                <img src={cttReceipt} alt="Чек" className="w-full max-h-48 object-contain rounded-xl border border-slate-200"/>
                                <button onClick={() => setCttReceipt(null)} className="absolute top-1 right-1 w-6 h-6 bg-rose-500 text-white rounded-full text-xs font-black flex items-center justify-center hover:bg-rose-600">×</button>
                            </div>
                        ) : (
                            <label
                                className={`flex flex-col items-center justify-center gap-2 w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${cttDragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
                                onDragOver={e => { e.preventDefault(); setCttDragOver(true); }}
                                onDragLeave={() => setCttDragOver(false)}
                                onDrop={e => { e.preventDefault(); setCttDragOver(false); loadReceiptFile(e.dataTransfer.files[0]); }}
                            >
                                <span className="text-2xl">🧾</span>
                                <span className="text-xs text-slate-400 font-semibold">Перетащите фото или нажмите</span>
                                <input type="file" accept="image/*" className="hidden" onChange={e => loadReceiptFile(e.target.files[0])}/>
                            </label>
                        )}
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button
                            onClick={handleSubmitCTT}
                            disabled={!(parseInt(cttAmount) > 0)}
                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-black text-sm transition-colors"
                        >
                            Записать
                        </button>
                        <button
                            onClick={closeCTT}
                            className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm"
                        >
                            Отмена
                        </button>
                    </div>
                </div>
            </div>
        )}
        {receiptViewer && (
            <div
                className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80"
                onClick={() => setReceiptViewer(null)}
            >
                <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
                    <img src={receiptViewer} alt="Чек" className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl shadow-2xl"/>
                    <button
                        onClick={() => setReceiptViewer(null)}
                        className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full text-slate-700 font-black text-lg flex items-center justify-center shadow-lg hover:bg-rose-500 hover:text-white transition-colors"
                    >×</button>
                </div>
            </div>
        )}
        </>
    );
};

export default ReportsView;
