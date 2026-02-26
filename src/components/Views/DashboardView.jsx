import React, { useState, useEffect, useMemo } from 'react';
import {
    LayoutDashboard, TrendingUp, TrendingDown, BedDouble, Users, AlertCircle,
    Plus, UserPlus, LogOut, Calendar, Clock, Wallet, DollarSign, CreditCard,
    QrCode, BarChart3, CalendarDays, CheckCircle2, User, Download
} from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

// -- Export helpers ----------------------------------------------------------
const exportGuestsToExcel = (guests, hostelId) => {
    let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head><meta charset="UTF-8"><style>
        body{font-family:Arial;}
        table{border-collapse:collapse;width:100%;}
        th,td{border:1px solid #000;padding:6px;}
        th{background:#4f46e5;color:#fff;}
    </style></head><body><table><thead><tr>
        <th>№</th><th>ФИО</th><th>Страна</th><th>Паспорт</th><th>Комната</th><th>Место</th><th>Заезд</th><th>Выезд</th><th>Дней</th><th>Сумма</th><th>Долг</th>
    </tr></thead><tbody>`;
    guests.forEach((g, i) => {
        const paid = (parseInt(g.paidCash)||0) + (parseInt(g.paidCard)||0) + (parseInt(g.paidQR)||0) + (parseInt(g.amountPaid)||0);
        const debt = Math.max(0, (parseInt(g.totalPrice)||0) - paid);
        const ci   = g.checkInDate  ? new Date(g.checkInDate).toLocaleDateString('ru')  : '—';
        const co   = g.checkOutDate ? new Date(g.checkOutDate).toLocaleDateString('ru') : '—';
        html += `<tr>
            <td>${i+1}</td><td>${g.fullName||''}</td><td>${g.country||''}</td><td>${g.passport||''}</td>
            <td>${g.roomNumber||''}</td><td>${g.bedId||''}</td><td>${ci}</td><td>${co}</td>
            <td>${g.days||''}</td><td>${parseInt(g.totalPrice||0).toLocaleString()}</td>
            <td style="color:${debt>0?'#dc2626':'#16a34a'}">${debt>0?debt.toLocaleString():'0'}</td>
        </tr>`;
    });
    html += `</tbody></table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Гости_${new Date().toISOString().slice(0,10)}.xls`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

const COUNTRY_FLAGS = {
  "Узбекистан":"UZ","Россия":"RU","Казахстан":"KZ","Таджикистан":"TJ","Кыргызстан":"KG","Абхазия":"GE",
  "Австралия":"AU","Австрия":"AT","Азербайджан":"AZ","Албания":"AL","Алжир":"DZ","Ангола":"AO",
  "Аргентина":"AR","Армения":"AM","Афганистан":"AF","Багамские Острова":"BS","Бангладеш":"BD",
  "Барбадос":"BB","Бахрейн":"BH","Белоруссия":"BY","Бельгия":"BE","Болгария":"BG","Бразилия":"BR",
  "Великобритания":"GB","Венгрия":"HU","Венесуэла":"VE","Вьетнам":"VN","Германия":"DE",
  "Гонконг":"HK","Греция":"GR","Грузия":"GE","Дания":"DK","Египет":"EG","Израиль":"IL",
  "Индия":"IN","Индонезия":"ID","Иордания":"JO","Ирак":"IQ","Иран":"IR","Ирландия":"IE",
  "Исландия":"IS","Испания":"ES","Италия":"IT","Канада":"CA","Катар":"QA","Кения":"KE",
  "Кипр":"CY","Китай":"CN","Колумбия":"CO","Корея (Южная)":"KR","Куба":"CU","Кувейт":"KW",
  "Латвия":"LV","Литва":"LT","Малайзия":"MY","Мальдивы":"MV","Марокко":"MA","Мексика":"MX",
  "Молдавия":"MD","Монголия":"MN","Непал":"NP","Нидерланды":"NL","Новая Зеландия":"NZ",
  "Норвегия":"NO","ОАЭ":"AE","Пакистан":"PK","Польша":"PL","Португалия":"PT","Румыния":"RO",
  "Саудовская Аравия":"SA","Сербия":"RS","Сингапур":"SG","Сирия":"SY","Словакия":"SK",
  "Словения":"SI","США":"US","Таиланд":"TH","Туркмения":"TM","Турция":"TR","Украина":"UA",
  "Филиппины":"PH","Финляндия":"FI","Франция":"FR","Хорватия":"HR","Чехия":"CZ","Чили":"CL",
  "Швейцария":"CH","Швеция":"SE","Шри-Ланка":"LK","Эстония":"EE","Япония":"JP"
};

const FLAG_SIZES = [20, 40, 80, 160, 320];
const snapFlagSize = (s) => FLAG_SIZES.find(f => f >= s) || 320;
const Flag = ({ code, size = 20 }) => {
  if (!code) return null;
  const w = snapFlagSize(size);
  const w2 = snapFlagSize(size * 2);
  const h = Math.round(size * 0.75);
  return (
    <img
      src={`https://flagcdn.com/w${w}/${code.toLowerCase()}.png`}
      srcSet={`https://flagcdn.com/w${w2}/${code.toLowerCase()}.png 2x`}
      width={size}
      height={h}
      alt={code}
      style={{ display: 'inline-block', objectFit: 'cover', borderRadius: 2, verticalAlign: 'middle', flexShrink: 0 }}
    />
  );
};

const useNow = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
};

const parseDate = (dateInput) => {
    if (!dateInput) return null;
    const date = new Date(dateInput);
    if (typeof dateInput === 'string' && !dateInput.includes('T')) {
        date.setHours(12, 0, 0, 0);
    }
    return date;
};

const getTimeLeftLabel = (checkOutDate, nowMs) => {
  const checkOut = parseDate(checkOutDate);
  if (!checkOut) return null;
  const ms = checkOut.getTime() - nowMs;
  if (ms <= 0) return { text: 'Время вышло', color: 'text-rose-600', icon: 'alert' };
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hrs  = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days >= 1) {
    const w = days === 1 ? 'день' : days < 5 ? 'дня' : 'дней';
    return { text: hrs > 0 ? `${days} ${w} ${hrs}ч` : `${days} ${w}`, color: 'text-slate-500', icon: 'cal' };
  }
  if (hrs >= 1) return { text: `${hrs}ч ${mins > 0 ? `${mins}м` : ''}`, color: 'text-amber-600', icon: 'clock' };
  return { text: `${mins} мин`, color: 'text-rose-600', icon: 'clock' };
};

const getTotalPaid = (g) => (typeof g.amountPaid === 'number' ? g.amountPaid : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0)));

const getLocalDateString = (dateObj) => {
    if (!dateObj) return '';
    const offset = dateObj.getTimezoneOffset() * 60000;
    return new Date(dateObj.getTime() - offset).toISOString().slice(0, 10);
};

const formatMoney = (amount) => amount ? amount.toLocaleString() : '0';

// ---------------------------------------------------------------------------

const DashboardView = ({ rooms, guests, payments, expenses, lang, currentHostelId, users, onBulkExtend }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [tab, setTab] = useState('overview');
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkDays, setBulkDays] = useState('1');
    const nowMs = useNow();
    const now = new Date(nowMs);

    const todayStr = getLocalDateString(now);

    const ymd = (d) => {
        if (!d) return '';
        return getLocalDateString(new Date(d));
    };

    const data = useMemo(() => {
        const relRooms = currentHostelId === 'all' ? rooms : rooms.filter(r => r.hostelId === currentHostelId);
        const relGuests = currentHostelId === 'all' ? guests : guests.filter(g => g.hostelId === currentHostelId);
        const relPayments = currentHostelId === 'all' ? payments : payments.filter(p => p.hostelId === currentHostelId);
        const relExpenses = currentHostelId === 'all' ? expenses : expenses.filter(e => e.hostelId === currentHostelId);

        const totalBeds = relRooms.reduce((s, r) => s + parseInt(r.capacity || 0), 0);
        const activeGuests = relGuests.filter(g => g.status === 'active');
        const relRoomIds = new Set(relRooms.map(r => r.id));
        const occupancyGuests = activeGuests.filter(g => relRoomIds.has(g.roomId));
        const occupancyRaw = totalBeds ? Math.round((occupancyGuests.length / totalBeds) * 100) : 0;
        const occupancyPct = Math.min(100, occupancyRaw);
        const isOverCapacity = occupancyRaw > 100;

        const pay30 = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now); d.setDate(d.getDate() - i);
            const ds = getLocalDateString(d);
            const inc = relPayments.filter(p => ymd(p.date) === ds).reduce((s, p) => s + (parseInt(p.amount) || 0), 0);
            const exp = relExpenses.filter(e => ymd(e.date) === ds).reduce((s, e) => s + (parseInt(e.amount) || 0), 0);
            pay30.push({ ds, day: d.getDate(), inc, exp });
        }
        const last7 = pay30.slice(-7);

        const totalIncome = relPayments.reduce((s, p) => s + (parseInt(p.amount) || 0), 0);
        const totalExpense = relExpenses.reduce((s, e) => s + (parseInt(e.amount) || 0), 0);
        const incomeToday = relPayments.filter(p => ymd(p.date) === todayStr).reduce((s, p) => s + (parseInt(p.amount) || 0), 0);
        const incomeWeek = last7.reduce((s, d) => s + d.inc, 0);
        const incomeMonth = pay30.reduce((s, d) => s + d.inc, 0);

        const byCash = relPayments.filter(p => p.method === 'cash').reduce((s, p) => s + (parseInt(p.amount) || 0), 0);
        const byCard = relPayments.filter(p => p.method === 'card').reduce((s, p) => s + (parseInt(p.amount) || 0), 0);
        const byQR   = relPayments.filter(p => p.method === 'qr').reduce((s, p) => s + (parseInt(p.amount) || 0), 0);

        const guestsWithDebt = relGuests
            .filter(g => g.status !== 'booking')
            .map(g => ({ ...g, debt: (g.totalPrice || 0) - getTotalPaid(g) }))
            .filter(g => g.debt > 0)
            .sort((a, b) => b.debt - a.debt);
        const totalDebt = guestsWithDebt.reduce((s, g) => s + g.debt, 0);

        const arrivalsToday = relGuests.filter(g => ymd(g.checkInDate || g.checkInDateTime) === todayStr && g.status === 'active');
        const dep = relGuests.filter(g => ymd(g.checkOutDate) === todayStr);
        const tomorrow = getLocalDateString(new Date(now.getTime() + 86400000));
        const arrivalsTomorrow = relGuests.filter(g => (ymd(g.checkInDate || g.checkInDateTime) === tomorrow) && (g.status === 'active' || g.status === 'booking'));
        const depTomorrow = relGuests.filter(g => ymd(g.checkOutDate) === tomorrow && g.status === 'active');

        const expired = relGuests.filter(g => {
            if (g.status !== 'active') return false;
            const co = parseDate(g.checkOutDate);
            return co && now > co;
        });

        const countryMap = {};
        relGuests.filter(g => g.status === 'active' && g.country).forEach(g => {
            countryMap[g.country] = (countryMap[g.country] || 0) + 1;
        });
        const topCountries = Object.entries(countryMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

        const recentPayments = [...relPayments]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10)
            .map(p => {
                const g = relGuests.find(g => g.id === p.guestId);
                return { ...p, fullName: g?.fullName || p.comment || '' };
            });

        const roomOccupancy = relRooms.map(r => {
            const rGuests = relGuests.filter(g => g.roomId === r.id && g.status === 'active');
            return { ...r, occupied: rGuests.length, pct: r.capacity ? Math.round((rGuests.length / r.capacity) * 100) : 0 };
        }).sort((a, b) => b.pct - a.pct);

        const checkedOut = relGuests.filter(g => g.status === 'checked_out' && g.days);
        const avgStay = checkedOut.length ? Math.round(checkedOut.reduce((s, g) => s + parseInt(g.days || 0), 0) / checkedOut.length) : 0;

        const staffToday = {};
        relPayments.filter(p => ymd(p.date) === todayStr).forEach(p => {
            const u = users?.find(u => u.id === p.staffId || u.login === p.staffId);
            const name = u?.name || p.staffId || '—';
            staffToday[name] = (staffToday[name] || 0) + (parseInt(p.amount) || 0);
        });
        const staffTodayList = Object.entries(staffToday).sort((a, b) => b[1] - a[1]);

        // Room income: sum payments via guest-room mapping
        const guestRoomMap = {};
        relGuests.forEach(g => { if (g.roomId) guestRoomMap[g.id] = { roomId: g.roomId, roomNumber: g.roomNumber }; });
        const roomIncomeMap = {};
        relPayments.forEach(p => {
            const rm = guestRoomMap[p.guestId];
            if (!rm) return;
            if (!roomIncomeMap[rm.roomId]) roomIncomeMap[rm.roomId] = { cash: 0, card: 0, qr: 0 };
            const amt = parseInt(p.amount) || 0;
            if (p.method === 'cash') roomIncomeMap[rm.roomId].cash += amt;
            else if (p.method === 'card') roomIncomeMap[rm.roomId].card += amt;
            else if (p.method === 'qr') roomIncomeMap[rm.roomId].qr += amt;
            else roomIncomeMap[rm.roomId].cash += amt;
        });
        const maxRoomIncome = Math.max(1, ...Object.values(roomIncomeMap).map(r => r.cash + r.card + r.qr));
        const roomIncome = relRooms.map(r => {
            const m = roomIncomeMap[r.id] || { cash: 0, card: 0, qr: 0 };
            const total = m.cash + m.card + m.qr;
            const occ = roomOccupancy.find(ro => ro.id === r.id);
            return { ...r, income: total, cash: m.cash, card: m.card, qr: m.qr, pct: occ?.pct || 0, occupied: occ?.occupied || 0 };
        }).sort((a, b) => b.income - a.income);

        return {
            relRooms, relGuests, totalBeds, activeGuests, occupancyGuests, occupancyPct, occupancyRaw, isOverCapacity,
            pay30, last7, totalIncome, totalExpense, incomeToday, incomeWeek, incomeMonth,
            byCash, byCard, byQR,
            guestsWithDebt, totalDebt,
            arrivalsToday, dep, arrivalsTomorrow, depTomorrow,
            expired, topCountries, recentPayments, roomOccupancy,
            avgStay, staffTodayList, roomIncome, maxRoomIncome,
        };
    }, [rooms, guests, payments, expenses, currentHostelId, nowMs]);

    const MiniBar = ({ value, max, color = 'indigo' }) => {
        const pct = max ? Math.round((value / max) * 100) : 0;
        const bg = { indigo: 'bg-indigo-500', emerald: 'bg-emerald-500', rose: 'bg-rose-500', amber: 'bg-amber-400' }[color];
        return (
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className={`${bg} h-full rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
        );
    };

    const StatCard = ({ label, value, sub, icon: Icon, color, suffix }) => {
        const cfg = {
            emerald: { ring: 'ring-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'bg-emerald-100' },
            rose:    { ring: 'ring-rose-200',    bg: 'bg-rose-50',    text: 'text-rose-600',    icon: 'bg-rose-100' },
            indigo:  { ring: 'ring-indigo-200',  bg: 'bg-indigo-50',  text: 'text-indigo-600',  icon: 'bg-indigo-100' },
            amber:   { ring: 'ring-amber-200',   bg: 'bg-amber-50',   text: 'text-amber-600',   icon: 'bg-amber-100' },
            slate:   { ring: 'ring-slate-200',   bg: 'bg-slate-50',   text: 'text-slate-700',   icon: 'bg-slate-100' },
            purple:  { ring: 'ring-purple-200',  bg: 'bg-purple-50',  text: 'text-purple-600',  icon: 'bg-purple-100' },
        }[color] || { ring: 'ring-slate-200', bg: 'bg-white', text: 'text-slate-800', icon: 'bg-slate-100' };
        return (
            <div className={`bg-white border border-slate-200 rounded-2xl p-4 ring-1 ${cfg.ring} shadow-sm`}>
                <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ${cfg.icon} flex items-center justify-center`}>
                        <Icon size={18} className={cfg.text} />
                    </div>
                    {sub && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{sub}</span>}
                </div>
                <div className={`text-2xl font-black ${cfg.text}`}>{value}{suffix && <span className="text-sm font-semibold ml-0.5">{suffix}</span>}</div>
                <div className="text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-wide">{label}</div>
            </div>
        );
    };

    const BarChartMini = ({ data30, keyInc = 'inc', keyExp = 'exp' }) => {
        const maxVal = Math.max(...data30.map(d => Math.max(d[keyInc] || 0, d[keyExp] || 0)), 1);
        return (
            <div className="flex items-end gap-px w-full" style={{ height: 80 }}>
                {data30.map((d, i) => {
                    const incH = ((d[keyInc] || 0) / maxVal) * 80;
                    const expH = ((d[keyExp] || 0) / maxVal) * 80;
                    return (
                        <div key={i} className="flex-1 flex items-end gap-px">
                            <div className="flex-1 bg-emerald-400 rounded-sm opacity-80 hover:opacity-100 transition-opacity" style={{ height: incH || 1 }} title={`Доход: ${d.inc?.toLocaleString()}`} />
                            <div className="flex-1 bg-rose-400 rounded-sm opacity-70 hover:opacity-100 transition-opacity" style={{ height: expH || 1 }} title={`Расход: ${d.exp?.toLocaleString()}`} />
                        </div>
                    );
                })}
            </div>
        );
    };

    const tabs = [
        { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
        { id: 'finance', label: 'Финансы', icon: TrendingUp },
        { id: 'occupancy', label: 'Загрузка', icon: BedDouble },
        { id: 'guests', label: 'Гости', icon: Users },
        { id: 'rooms', label: 'Доходность', icon: BarChart3 },
        { id: 'debts', label: 'Долги', icon: AlertCircle },
    ];

    const kpis = [
        { label: 'Гостей сейчас', value: data.activeGuests.length, suffix: '', icon: Users, color: 'indigo', sub: `+${data.arrivalsToday.length} сег.` },
        { label: 'Загрузка', value: data.isOverCapacity ? `${data.occupancyRaw}` : data.occupancyPct, suffix: '%', icon: BedDouble, color: data.isOverCapacity ? 'rose' : data.occupancyPct >= 80 ? 'emerald' : data.occupancyPct >= 50 ? 'amber' : 'rose', sub: `${data.occupancyGuests.length}/${data.totalBeds}${data.isOverCapacity ? ' ⚠' : ''}` },
        { label: 'Доход сегодня', value: data.incomeToday.toLocaleString(), suffix: '', icon: TrendingUp, color: 'emerald', sub: 'UZS' },
        { label: 'Долг гостей', value: data.totalDebt.toLocaleString(), suffix: '', icon: Wallet, color: data.totalDebt > 0 ? 'rose' : 'slate', sub: `${data.guestsWithDebt.length} гостей` },
        { label: 'Просроченных', value: data.expired.length, suffix: '', icon: AlertCircle, color: data.expired.length > 0 ? 'amber' : 'slate', sub: 'не выселены' },
        { label: 'Свободных мест', value: Math.max(0, data.totalBeds - data.occupancyGuests.length), suffix: '', icon: Plus, color: 'purple', sub: `из ${data.totalBeds}` },
    ];

    return (
        <div className="space-y-4 animate-in fade-in">
            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                {kpis.map((k, i) => <StatCard key={i} {...k} />)}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm overflow-x-auto">
                {tabs.map(tb => {
                    const Icon = tb.icon;
                    return (
                        <button key={tb.id} onClick={() => setTab(tb.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                                tab === tb.id
                                    ? 'bg-slate-800 text-white shadow-md'
                                    : 'text-slate-500 hover:bg-slate-100'
                            }`}>
                            <Icon size={15} /> {tb.label}
                        </button>
                    );
                })}
            </div>

            {/* TAB: OVERVIEW */}
            {tab === 'overview' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div className="xl:col-span-2 space-y-4">
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <div className="font-bold text-slate-800">Доходы и расходы</div>
                                    <div className="text-xs text-slate-400">Последние 30 дней</div>
                                </div>
                                <div className="flex gap-4 text-xs font-bold">
                                    <span className="flex items-center gap-1 text-emerald-600"><span className="w-2 h-2 bg-emerald-400 rounded-sm inline-block"/>Доход</span>
                                    <span className="flex items-center gap-1 text-rose-600"><span className="w-2 h-2 bg-rose-400 rounded-sm inline-block"/>Расход</span>
                                </div>
                            </div>
                            <BarChartMini data30={data.pay30} />
                            <div className="flex justify-between mt-3 text-xs text-slate-400 font-medium">
                                <span>{data.pay30[0]?.day}</span>
                                <span>{data.pay30[14]?.day}</span>
                                <span>{data.pay30[29]?.day}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: 'Заезд сегодня', value: data.arrivalsToday.length, icon: UserPlus, color: 'indigo' },
                                { label: 'Выезд сегодня', value: data.dep.length, icon: LogOut, color: 'rose' },
                                { label: 'Заезд завтра', value: data.arrivalsTomorrow.length, icon: Calendar, color: 'amber' },
                                { label: 'Выезд завтра', value: data.depTomorrow.length, icon: Clock, color: 'slate' },
                            ].map((s, i) => (
                                <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm text-center">
                                    <s.icon size={20} className={`mx-auto mb-1 ${{ indigo:'text-indigo-500', rose:'text-rose-500', amber:'text-amber-500', slate:'text-slate-400' }[s.color]}`}/>
                                    <div className="text-2xl font-black text-slate-800">{s.value}</div>
                                    <div className="text-[10px] text-slate-400 font-semibold uppercase">{s.label}</div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                <span className="font-bold text-slate-800 text-sm">Активные гости</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{data.activeGuests.length}</span>
                                    <button onClick={() => exportGuestsToExcel(data.activeGuests, currentHostelId)}
                                        title="Экспорт в Excel"
                                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                                        <Download size={13}/>
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
                                {data.activeGuests.length === 0 ? (
                                    <div className="p-6 text-center text-slate-400 text-sm">Нет активных гостей</div>
                                ) : data.activeGuests.map(g => {
                                    const debt = (g.totalPrice || 0) - getTotalPaid(g);
                                    const co = parseDate(g.checkOutDate);
                                    const lbl = co ? getTimeLeftLabel(g.checkOutDate, nowMs) : null;
                                    return (
                                        <div key={g.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50">
                                            <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                                                {COUNTRY_FLAGS[g.country] ? <Flag code={COUNTRY_FLAGS[g.country]} size={18}/> : <User size={12} className="text-indigo-600"/>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-xs text-slate-800 truncate">{g.fullName}</div>
                                                <div className="text-[10px] text-slate-400">К.{g.roomNumber} М.{g.bedId}</div>
                                            </div>
                                            {lbl && <span className={`text-[10px] font-bold ${lbl.color} shrink-0`}>{lbl.text}</span>}
                                            {debt > 0 && <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md shrink-0">-{formatMoney(debt)}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100">
                                <span className="font-bold text-slate-800 text-sm">Комнаты</span>
                            </div>
                            <div className="p-3 space-y-2">
                                {data.roomOccupancy.map(r => (
                                    <div key={r.id}>
                                        <div className="flex items-center justify-between text-xs mb-0.5">
                                            <span className="font-bold text-slate-700">№{r.number}</span>
                                            <span className="font-semibold text-slate-500">{r.occupied}/{r.capacity}</span>
                                        </div>
                                        <MiniBar value={r.occupied} max={r.capacity} color={r.pct >= 80 ? 'emerald' : r.pct >= 40 ? 'amber' : 'rose'} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {data.staffTodayList.length > 0 && (
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-100">
                                    <span className="font-bold text-slate-800 text-sm">Сборы сегодня по сотрудникам</span>
                                </div>
                                <div className="p-3 space-y-2">
                                    {data.staffTodayList.map(([name, amt], i) => (
                                        <div key={i} className="flex items-center justify-between text-xs">
                                            <span className="font-semibold text-slate-600 truncate">{name}</span>
                                            <span className="font-black text-emerald-600 shrink-0 ml-2">+{amt.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {data.expired.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl shadow-sm p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <AlertCircle size={16} className="text-amber-600"/>
                                    <span className="font-bold text-amber-800 text-sm">Время вышло ({data.expired.length})</span>
                                </div>
                                {data.expired.slice(0, 5).map(g => (
                                    <div key={g.id} className="text-xs text-amber-700 font-semibold py-0.5 truncate">• {g.fullName} — К.{g.roomNumber}</div>
                                ))}
                            </div>
                        )}

                        {data.topCountries.length > 0 && (
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                                <div className="font-bold text-slate-800 text-sm mb-3">Гости по странам</div>
                                <div className="space-y-1.5">
                                    {data.topCountries.map(([country, cnt], i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs">
                                            {COUNTRY_FLAGS[country] ? <Flag code={COUNTRY_FLAGS[country]} size={16}/> : <span className="w-4">🌍</span>}
                                            <span className="flex-1 text-slate-600 truncate font-medium">{country}</span>
                                            <span className="font-black text-slate-700">{cnt}</span>
                                            <div className="w-16"><MiniBar value={cnt} max={data.topCountries[0]?.[1] || 1} color="indigo"/></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: FINANCE */}
            {tab === 'finance' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Доход сегодня',    value: data.incomeToday.toLocaleString(),  color: 'emerald', icon: TrendingUp },
                            { label: 'Доход за 7 дней',  value: data.incomeWeek.toLocaleString(),   color: 'indigo',  icon: Calendar },
                            { label: 'Доход за 30 дней', value: data.incomeMonth.toLocaleString(),  color: 'purple',  icon: BarChart3 },
                            { label: 'Расход за 30 дней',value: data.pay30.reduce((s,d)=>s+d.exp,0).toLocaleString(), color: 'rose', icon: TrendingDown },
                        ].map((s, i) => <StatCard key={i} {...s} />)}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                            <div className="font-bold text-slate-800 mb-1">30 дней — Доходы vs Расходы</div>
                            <div className="text-xs text-slate-400 mb-4">Каждый столбик = 1 день</div>
                            <BarChartMini data30={data.pay30} />
                            <div className="flex justify-between mt-2 text-[10px] text-slate-400">
                                <span>{data.pay30[0]?.ds?.slice(5)}</span>
                                <span>{data.pay30[29]?.ds?.slice(5)}</span>
                            </div>
                            <div className="flex gap-6 mt-3 text-xs font-bold border-t border-slate-100 pt-3">
                                <span className="text-emerald-600">+{data.incomeMonth.toLocaleString()}</span>
                                <span className="text-rose-600">-{data.pay30.reduce((s,d)=>s+d.exp,0).toLocaleString()}</span>
                                <span className="text-indigo-600 ml-auto">Баланс: {(data.incomeMonth - data.pay30.reduce((s,d)=>s+d.exp,0)).toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                            <div className="font-bold text-slate-800 mb-4">Методы оплаты (всё время)</div>
                            <div className="space-y-3">
                                {[
                                    { label: 'Наличные', value: data.byCash, icon: DollarSign, color: 'emerald' },
                                    { label: 'Карта',    value: data.byCard, icon: CreditCard, color: 'indigo' },
                                    { label: 'QR',       value: data.byQR,   icon: QrCode,     color: 'purple' },
                                ].map((m, i) => {
                                    const total = data.byCash + data.byCard + data.byQR || 1;
                                    return (
                                        <div key={i}>
                                            <div className="flex items-center justify-between text-sm mb-1">
                                                <div className="flex items-center gap-2 font-semibold text-slate-700">
                                                    <m.icon size={14}/> {m.label}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="font-black text-slate-800">{m.value.toLocaleString()}</span>
                                                    <span className="text-slate-400">{Math.round((m.value/total)*100)}%</span>
                                                </div>
                                            </div>
                                            <MiniBar value={m.value} max={total} color={m.color} />
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-100">
                                <div className="flex justify-between text-xs font-bold text-slate-500">
                                    <span>Итого всё время</span>
                                    <span className="text-emerald-600 text-sm">{data.totalIncome.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs font-bold text-slate-500 mt-1">
                                    <span>Расходы всё время</span>
                                    <span className="text-rose-600 text-sm">{data.totalExpense.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs font-black mt-2 pt-2 border-t border-slate-100">
                                    <span className="text-slate-700">Чистая прибыль</span>
                                    <span className={`text-sm ${(data.totalIncome-data.totalExpense)>=0?'text-indigo-600':'text-rose-600'}`}>{(data.totalIncome-data.totalExpense).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100">
                            <span className="font-bold text-slate-800 text-sm">Последние платежи</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50 text-slate-400 uppercase font-bold">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Дата</th>
                                        <th className="px-4 py-2 text-left">Гость</th>
                                        <th className="px-4 py-2 text-left">Метод</th>
                                        <th className="px-4 py-2 text-right">Сумма</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {data.recentPayments.map((p, i) => (
                                        <tr key={i} className="hover:bg-slate-50">
                                            <td className="px-4 py-2 text-slate-400">{new Date(p.date).toLocaleString('ru', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</td>
                                            <td className="px-4 py-2 font-semibold text-slate-700 truncate max-w-[150px]">{p.fullName || '—'}</td>
                                            <td className="px-4 py-2 uppercase font-bold text-slate-400">{p.method || '—'}</td>
                                            <td className="px-4 py-2 text-right font-black text-emerald-600">+{parseInt(p.amount).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: OCCUPANCY */}
            {tab === 'occupancy' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Загрузка', value: data.isOverCapacity ? `${data.occupancyRaw}` : data.occupancyPct, suffix: '%', icon: BedDouble, color: data.isOverCapacity ? 'rose' : data.occupancyPct >= 80 ? 'emerald' : data.occupancyPct >= 50 ? 'amber' : 'rose', sub: data.isOverCapacity ? 'Перегружен!' : `из ${data.totalBeds}` },
                            { label: 'Занято мест',   value: data.occupancyGuests.length, icon: Users,    color: 'indigo', sub: `из ${data.totalBeds}` },
                            { label: 'Свободно',      value: Math.max(0, data.totalBeds - data.occupancyGuests.length), icon: Plus, color: 'emerald' },
                            { label: 'Ср. проживание',value: data.avgStay, suffix: ' дн', icon: Calendar, color: 'slate' },
                        ].map((s, i) => <StatCard key={i} {...s} />)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { title: 'Заезд сегодня', list: data.arrivalsToday, color: 'indigo', icon: UserPlus },
                            { title: 'Выезд сегодня', list: data.dep, color: 'rose', icon: LogOut },
                            { title: 'Заезд завтра', list: data.arrivalsTomorrow, color: 'amber', icon: Calendar },
                            { title: 'Выезд завтра', list: data.depTomorrow, color: 'slate', icon: Clock },
                        ].map((panel, pi) => (
                            <div key={pi} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                                    <panel.icon size={14} className={`text-${panel.color}-500`}/>
                                    <span className="font-bold text-slate-800 text-sm">{panel.title}</span>
                                    <span className="ml-auto text-xs font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{panel.list.length}</span>
                                </div>
                                {panel.list.length === 0 ? (
                                    <div className="p-4 text-center text-slate-400 text-xs">Нет</div>
                                ) : panel.list.slice(0, 8).map(g => (
                                    <div key={g.id} className="flex items-center gap-2 px-4 py-2 border-b border-slate-50 text-xs">
                                        {COUNTRY_FLAGS[g.country] ? <Flag code={COUNTRY_FLAGS[g.country]} size={14}/> : <User size={12} className="text-slate-300"/>}
                                        <span className="flex-1 font-semibold text-slate-700 truncate">{g.fullName}</span>
                                        <span className="text-slate-400 shrink-0">К.{g.roomNumber}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100">
                            <span className="font-bold text-slate-800 text-sm">Загрузка по комнатам</span>
                        </div>
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {data.roomOccupancy.map(r => (
                                <div key={r.id} className="border border-slate-200 rounded-xl p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-black text-slate-800">Комната №{r.number}</span>
                                        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                                            r.pct === 100 ? 'bg-emerald-100 text-emerald-700' :
                                            r.pct >= 50 ? 'bg-amber-100 text-amber-700' :
                                            'bg-rose-100 text-rose-700'
                                        }`}>{r.pct}%</span>
                                    </div>
                                    <MiniBar value={r.occupied} max={r.capacity} color={r.pct >= 80 ? 'emerald' : r.pct >= 40 ? 'amber' : 'rose'} />
                                    <div className="flex justify-between mt-1 text-[10px] text-slate-400 font-semibold">
                                        <span>Занято: {r.occupied}</span>
                                        <span>Всего: {r.capacity}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: GUESTS */}
            {tab === 'guests' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: 'Активных', value: data.activeGuests.length, icon: Users, color: 'indigo' },
                            { label: 'Броней', value: data.relGuests.filter(g=>g.status==='booking').length, icon: Clock, color: 'amber' },
                            { label: 'Выселено (с долгом)', value: data.relGuests.filter(g=>g.status==='checked_out'&&((g.totalPrice||0)-getTotalPaid(g))>0).length, icon: AlertCircle, color: 'rose' },
                            { label: 'Ср. ночей', value: data.avgStay, suffix: ' дн', icon: CalendarDays, color: 'slate' },
                        ].map((s, i) => <StatCard key={i} {...s} />)}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
                            <div className="font-bold text-slate-800 mb-4 text-sm">Гости по странам (сейчас)</div>
                            {data.topCountries.length === 0 ? (
                                <div className="text-center text-slate-400 py-4 text-sm">Нет активных гостей</div>
                            ) : (
                                <div className="space-y-2">
                                    {data.topCountries.map(([country, cnt], i) => {
                                        const pct = Math.round((cnt / (data.activeGuests.length || 1)) * 100);
                                        return (
                                            <div key={i}>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    {COUNTRY_FLAGS[country] ? <Flag code={COUNTRY_FLAGS[country]} size={16}/> : <span className="text-xs">🌍</span>}
                                                    <span className="flex-1 text-xs font-semibold text-slate-700 truncate">{country}</span>
                                                    <span className="text-xs font-black text-slate-800">{cnt}</span>
                                                    <span className="text-[10px] text-slate-400 w-8 text-right">{pct}%</span>
                                                </div>
                                                <MiniBar value={cnt} max={data.activeGuests.length || 1} color="indigo"/>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                <span className="font-bold text-slate-800 text-sm">Все активные гости</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400">{data.activeGuests.length}</span>
                                    {selectMode && selectedIds.length > 0 && (
                                        <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Выбрано: {selectedIds.length}</span>
                                    )}
                                    <button
                                        onClick={() => { setSelectMode(m => { if (m) setSelectedIds([]); return !m; }); }}
                                        className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors ${selectMode ? 'bg-indigo-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>
                                        {selectMode ? 'Готово' : 'Выбрать'}
                                    </button>
                                    <button onClick={() => exportGuestsToExcel(data.activeGuests, currentHostelId)}
                                        title="Экспорт в Excel"
                                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                                        <Download size={13}/>
                                    </button>
                                </div>
                            </div>
                            <div className="overflow-y-auto" style={{ maxHeight: 350 }}>
                                {data.activeGuests.map(g => {
                                    const debt = (g.totalPrice || 0) - getTotalPaid(g);
                                    const lbl = g.checkOutDate ? getTimeLeftLabel(g.checkOutDate, nowMs) : null;
                                    const isSelected = selectedIds.includes(g.id);
                                    return (
                                        <div key={g.id}
                                            onClick={() => selectMode && setSelectedIds(ids => isSelected ? ids.filter(i => i !== g.id) : [...ids, g.id])}
                                            className={`flex items-center gap-2 px-4 py-2.5 border-b border-slate-50 transition-colors ${selectMode ? 'cursor-pointer hover:bg-indigo-50' : 'hover:bg-slate-50'} ${isSelected ? 'bg-indigo-50' : ''}`}>
                                            {selectMode && (
                                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                                    {isSelected && <CheckCircle2 size={10} className="text-white" strokeWidth={3}/>}
                                                </div>
                                            )}
                                            {COUNTRY_FLAGS[g.country] ? <Flag code={COUNTRY_FLAGS[g.country]} size={16}/> : <User size={14} className="text-slate-300 shrink-0"/>}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-slate-800 truncate">{g.fullName}</div>
                                                <div className="text-[10px] text-slate-400">К.{g.roomNumber} М.{g.bedId} · {g.country||'—'}</div>
                                            </div>
                                            {lbl && <span className={`text-[10px] font-semibold ${lbl.color} shrink-0`}>{lbl.text}</span>}
                                            {debt > 0 && <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md shrink-0">-{formatMoney(debt)}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                            {selectMode && data.activeGuests.length > 0 && (
                                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                                    <button
                                        onClick={() => setSelectedIds(ids => ids.length === data.activeGuests.length ? [] : data.activeGuests.map(g => g.id))}
                                        className="text-xs text-slate-500 hover:text-slate-700 font-bold underline">
                                        {selectedIds.length === data.activeGuests.length ? 'Снять всё' : 'Выбрать всех'}
                                    </button>
                                    <div className="flex-1"/>
                                    {selectedIds.length > 0 && (
                                        <>
                                            <span className="text-xs text-slate-500 font-semibold">Продлить ({selectedIds.length} чел.):</span>
                                            <input
                                                type="number" min="1" max="30"
                                                value={bulkDays}
                                                onChange={e => setBulkDays(e.target.value)}
                                                className="w-14 px-2 py-1.5 border border-slate-300 rounded-lg text-xs font-black text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                            />
                                            <span className="text-xs text-slate-400">дн.</span>
                                            <button
                                                onClick={() => {
                                                    const d = parseInt(bulkDays) || 1;
                                                    onBulkExtend?.(selectedIds, d);
                                                    setSelectedIds([]);
                                                    setSelectMode(false);
                                                }}
                                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-colors">
                                                + Продлить
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: ROOMS */}
            {tab === 'rooms' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <StatCard label="Всего комнат" value={data.relRooms.length} icon={BedDouble} color="indigo" />
                        <StatCard label="Общий доход" value={data.roomIncome.reduce((s,r)=>s+r.income,0).toLocaleString()} icon={TrendingUp} color="emerald" sub="UZS" />
                        <StatCard label="Лучшая комната" value={data.roomIncome[0] ? `№${data.roomIncome[0].number}` : '—'} icon={BarChart3} color="amber" sub={data.roomIncome[0] ? data.roomIncome[0].income.toLocaleString() : ''} />
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100">
                            <span className="font-bold text-slate-800 text-sm">Доход по комнатам</span>
                            <span className="text-xs text-slate-400 ml-2">за всё время</span>
                        </div>
                        {data.roomIncome.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 text-sm">Нет данных</div>
                        ) : (
                            <div className="p-4 space-y-3">
                                {data.roomIncome.map(r => (
                                    <div key={r.id} className="border border-slate-100 rounded-xl p-3 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                                                    <BedDouble size={16} className="text-indigo-600"/>
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-800 text-sm">Комната №{r.number}</div>
                                                    <div className="text-[10px] text-slate-400">{r.occupied}/{r.capacity} мест занято · {r.pct}%</div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-black text-emerald-600 text-base">{r.income.toLocaleString()}</div>
                                                <div className="text-[10px] text-slate-400">UZS</div>
                                            </div>
                                        </div>
                                        <div className="mb-2">
                                            <MiniBar value={r.income} max={data.maxRoomIncome} color="emerald" />
                                        </div>
                                        {r.income > 0 && (
                                            <div className="flex gap-3 text-[10px] font-bold text-slate-500">
                                                <span className="flex items-center gap-1"><DollarSign size={9} className="text-emerald-500"/>Наличные: {r.cash.toLocaleString()}</span>
                                                <span className="flex items-center gap-1"><CreditCard size={9} className="text-indigo-500"/>Карта: {r.card.toLocaleString()}</span>
                                                <span className="flex items-center gap-1"><QrCode size={9} className="text-purple-500"/>QR: {r.qr.toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: DEBTS */}
            {tab === 'debts' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <StatCard label="Общий долг" value={data.totalDebt.toLocaleString()} icon={Wallet} color="rose" sub="UZS" />
                        <StatCard label="Должников" value={data.guestsWithDebt.length} icon={Users} color="amber" />
                        <StatCard label="Просроченных" value={data.expired.length} icon={AlertCircle} color={data.expired.length > 0 ? 'rose' : 'slate'} />
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-100">
                            <span className="font-bold text-slate-800 text-sm">Должники (по убыванию)</span>
                        </div>
                        {data.guestsWithDebt.length === 0 ? (
                            <div className="p-10 text-center text-slate-400">
                                <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400"/>
                                <div className="font-semibold">Долгов нет!</div>
                            </div>
                        ) : (
                            <div className="overflow-y-auto" style={{ maxHeight: 500 }}>
                                {data.guestsWithDebt.map((g, i) => {
                                    const isExpired = (() => { const co = parseDate(g.checkOutDate); return co && now > co && g.status === 'active'; })();
                                    return (
                                        <div key={g.id} className={`flex items-center gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50 ${isExpired ? 'bg-rose-50/50' : ''}`}>
                                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0">{i+1}</div>
                                            {COUNTRY_FLAGS[g.country] ? <Flag code={COUNTRY_FLAGS[g.country]} size={16}/> : <User size={14} className="text-slate-300 shrink-0"/>}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1">
                                                    {g.fullName}
                                                    {isExpired && <span className="text-[9px] bg-rose-100 text-rose-600 px-1 rounded font-black">ПРОСРОЧЕН</span>}
                                                </div>
                                                <div className="text-[10px] text-slate-400">К.{g.roomNumber} М.{g.bedId} · {g.status === 'checked_out' ? 'Выселен' : 'Живёт'}</div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="font-black text-base text-rose-600">-{formatMoney(g.debt)}</div>
                                                <div className="text-[10px] text-slate-400">из {formatMoney(g.totalPrice||0)}</div>
                                            </div>
                                            <div className="w-20 shrink-0">
                                                <MiniBar value={(g.totalPrice||0) - g.debt} max={g.totalPrice||1} color="emerald"/>
                                                <div className="text-[9px] text-slate-400 mt-0.5 text-center">{Math.round(((g.totalPrice||0)-g.debt)/(g.totalPrice||1)*100)}% опл.</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardView;
