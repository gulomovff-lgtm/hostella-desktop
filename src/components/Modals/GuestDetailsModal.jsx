import React, { useState, useRef } from 'react';
import {
    ChevronLeft, X, DollarSign, CreditCard, QrCode, Magnet, User, Wallet, Clock, Split,
    LogOut, Minus, Plus, Calendar, CalendarDays, ArrowLeftRight, Edit, Trash2, FileText,
    Printer, Lock, ShieldCheck, RotateCcw, UserX, Search, ChevronDown, Camera
} from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

// --- COUNTRY_FLAGS ---
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
            width={size} height={h} alt={code}
            style={{ display: 'inline-block', objectFit: 'cover', borderRadius: 2, verticalAlign: 'middle', flexShrink: 0 }}
        />
    );
};

// --- Utilities ---
const getTotalPaid = (g) => (typeof g.amountPaid === 'number' ? g.amountPaid : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0)));

const getStayDetails = (checkInDateTime, days) => {
    const start = new Date(checkInDateTime);
    const checkInHour = start.getHours();
    if (checkInHour === 0) {
        const end = new Date(start);
        end.setDate(end.getDate() + parseInt(days));
        end.setHours(12, 0, 0, 0);
        return { start, end };
    }
    start.setHours(12, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + parseInt(days));
    return { start, end };
};

const printDocument = (type, guest, hostel) => {
    const w = window.open('', '', 'width=800,height=600');
    const date = new Date().toLocaleDateString('ru-RU');
    const time = new Date().toLocaleTimeString('ru-RU');
    const totalPaid = getTotalPaid(guest);
    let html = `<html><head><meta charset="UTF-8">
    <title>${type === 'check' ? 'Чек' : type === 'regcard' ? 'Регистрационная карта' : 'Справка'}</title>
    <style>
        body { font-family: 'Courier New', monospace; padding: 20px; max-width: 600px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
        .header h2 { margin: 5px 0; font-size: 18px; }
        .info-row { display: flex; justify-content: space-between; margin: 5px 0; font-size: 14px; }
        .info-row .label { font-weight: bold; }
        .total { border-top: 2px dashed #000; margin-top: 15px; padding-top: 10px; font-size: 16px; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
        .signature { margin-top: 40px; border-top: 1px solid #000; width: 200px; display: inline-block; }
        @media print { body { padding: 10px; } }
    </style></head><body>`;
    if (type === 'check') {
        const total = guest.totalPrice || 0;
        const paid = totalPaid;
        html += `<div class="header"><h2>${hostel.name}</h2>
            <p style="margin: 2px 0; font-size: 12px;">${hostel.address}</p>
            <p style="margin: 2px 0; font-size: 12px;">Дата: ${date} ${time}</p></div>
            <div style="text-align: center; font-size: 16px; font-weight: bold; margin: 15px 0;">КАССОВЫЙ ЧЕК</div>
            <div class="info-row"><span class="label">Гость:</span><span>${guest.fullName}</span></div>
            <div class="info-row"><span class="label">Паспорт:</span><span>${guest.passport || '-'}</span></div>
            <div class="info-row"><span class="label">Комната:</span><span>№${guest.roomNumber}, Место ${guest.bedId}</span></div>
            <div class="info-row"><span class="label">Дата заезда:</span><span>${new Date(guest.checkInDate).toLocaleDateString('ru-RU')}</span></div>
            <div class="info-row"><span class="label">Дней:</span><span>${guest.days}</span></div>
            <div class="info-row"><span class="label">Цена за ночь:</span><span>${guest.pricePerNight.toLocaleString()} сум</span></div>
            <div class="total">
                <div class="info-row"><span>ИТОГО:</span><span>${total.toLocaleString()} сум</span></div>
                <div class="info-row"><span>Оплачено:</span><span>${paid.toLocaleString()} сум</span></div>
                <div class="info-row"><span>Долг:</span><span style="color: ${(total - paid) > 0 ? '#d63031' : '#00b894'};">${Math.max(0, total - paid).toLocaleString()} сум</span></div>
            </div>
            <div class="footer">Спасибо за выбор ${hostel.name}!<br/>Приходите к нам еще!</div>`;
    } else if (type === 'regcard') {
        html += `<div class="header"><h2>РЕГИСТРАЦИОННАЯ КАРТА ГОСТЯ</h2><p style="margin: 2px 0;">${hostel.name}</p></div>
            <div class="info-row"><span class="label">ФИО:</span><span>${guest.fullName}</span></div>
            <div class="info-row"><span class="label">Дата рождения:</span><span>${guest.birthDate || '-'}</span></div>
            <div class="info-row"><span class="label">Паспорт:</span><span>${guest.passport || '-'}</span></div>
            <div class="info-row"><span class="label">Гражданство:</span><span>${guest.country || '-'}</span></div>
            <div class="info-row"><span class="label">Дата заезда:</span><span>${new Date(guest.checkInDate).toLocaleDateString('ru-RU')}</span></div>
            <div class="info-row"><span class="label">Дата выезда:</span><span>${guest.checkOutDate ? new Date(guest.checkOutDate).toLocaleDateString('ru-RU') : '-'}</span></div>
            <div class="info-row"><span class="label">Комната:</span><span>№${guest.roomNumber}</span></div>
            <div class="info-row"><span class="label">Место:</span><span>№${guest.bedId}</span></div>
            <div style="margin-top: 40px;"><p>Подпись гостя: <span class="signature"></span></p><p>Дата: ${date}</p></div>
            <div class="footer">Документ сформирован автоматически</div>`;
    } else if (type === 'ref') {
        html += `<div class="header"><h2>СПРАВКА О ПРОЖИВАНИИ</h2><p style="margin: 2px 0;">${hostel.name}</p>
            <p style="margin: 2px 0; font-size: 11px;">${hostel.address}</p></div>
            <p style="text-align: justify; line-height: 1.6; margin: 20px 0;">
                Настоящая справка выдана <strong>${guest.fullName}</strong>, паспорт ${guest.passport || '-'}, 
                в том, что он(а) действительно проживал(а) в ${hostel.name} 
                с <strong>${new Date(guest.checkInDate).toLocaleDateString('ru-RU')}</strong> 
                по <strong>${guest.checkOutDate ? new Date(guest.checkOutDate).toLocaleDateString('ru-RU') : 'настоящее время'}</strong>.
            </p>
            <p style="margin: 20px 0;">Комната: №${guest.roomNumber}, Место: №${guest.bedId}</p>
            <p style="margin: 20px 0;">Справка выдана для предъявления по месту требования.</p>
            <div style="margin-top: 60px;"><p>Дата выдачи: ${date}</p>
            <p>Подпись администратора: _________________</p>
            <p style="text-align: center; margin-top: 20px;">М.П.</p></div>`;
    }
    html += `</body></html>`;
    w.document.write(html);
    w.document.close();
    w.print();
};

// ─── Country list for replace form ─────────────────────────────────────────
const COUNTRIES_LIST = [
    'Узбекистан','Россия','Казахстан','Таджикистан','Кыргызстан',
    'Украина','Беларусь','Азербайджан','Грузия','Армения',
    'Германия','США','Великобритания','Франция','Италия','Испания',
    'Китай','Индия','Турция','ОАЭ','Саудовская Аравия','Иран',
    'Пакистан','Бангладеш','Афганистан','Монголия',
];

// --- GuestDetailsModal ---
const compressPhotoGDM = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
            const MAX = 640;
            const scale = Math.min(1, MAX / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width  = Math.round(img.width  * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
});

const GuestDetailsModal = ({ guest, room, currentUser, clients = [], onClose, onUpdate, onPayment, onSuperPayment, onCheckOut, onSplit, onOpenMove, onDelete, notify, onReduceDays, onActivateBooking, onReduceDaysNoRefund, hostelInfo, lang, initialView = 'dashboard', onExtend }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    if (!guest) { onClose(); return null; }

    const totalPaid = getTotalPaid(guest);
    const debt = (guest.totalPrice || 0) - totalPaid;
    
    const [currentView, setCurrentView] = useState(initialView); 
    const [payCash, setPayCash] = useState('');
    const [payCard, setPayCard] = useState('');
    const [payQR, setPayQR] = useState('');
    const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
    const [extendDays, setExtendDays] = useState(1);
    const [checkoutManualRefund, setCheckoutManualRefund] = useState('');
    const photoInputRef = useRef(null);
    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const b64 = await compressPhotoGDM(file);
        onUpdate(guest.id, { passportPhoto: b64 });
        notify('Фото паспорта сохранено', 'success');
    };

    const [editForm, setEditForm] = useState({ 
        fullName: guest.fullName || '', 
        birthDate: guest.birthDate || '', 
        passport: guest.passport || '', 
        passportIssueDate: guest.passportIssueDate || '',
        phone: guest.phone || '',
        country: guest.country || 'Узбекистан', 
        pricePerNight: guest.pricePerNight || 0
    });
    const [splitStartDate, setSplitStartDate] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0];
    });
    const [splitReturnDate, setSplitReturnDate] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() + 2); return d.toISOString().split('T')[0];
    });
    const [reduceDaysNoRefund, setReduceDaysNoRefund] = useState(1);
    const [superPayAmount, setSuperPayAmount] = useState('');
    const [newStartDate, setNewStartDate] = useState(() => {
        try { return guest.checkInDate ? new Date(guest.checkInDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]; }
        catch(e) { return new Date().toISOString().split('T')[0]; }
    });

    // --- Replace guest state ---
    const [replaceTab,     setReplaceTab]     = useState('db');
    const [replaceSearch,  setReplaceSearch]  = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [replaceNew,     setReplaceNew]     = useState({
        fullName: '', passport: '', birthDate: '', country: 'Узбекистан', phone: '', passportIssueDate: ''
    });

    const isBooking    = guest.status === 'booking';
    const isCheckedOut = guest.status === 'checked_out';
    const isAdmin      = currentUser.role === 'admin' || currentUser.role === 'super';
    const canMoveDate  = isAdmin || currentUser.login === 'fazliddin';
    const canPay = !isAdmin
        && !(guest.hostelId === 'hostel1' && currentUser.permissions?.canPayInHostel1 === false)
        && !(guest.hostelId === 'hostel2' && currentUser.permissions?.canPayInHostel2 === false);

    const today    = new Date();
    const checkIn  = new Date(guest.checkInDate);
    const daysStayed = Math.min(Math.max(1, Math.ceil((today - checkIn)/(1000*60*60*24))), parseInt(guest.days));
    const actualCost = daysStayed * parseInt(guest.pricePerNight);
    const balance    = totalPaid - actualCost;

    const disableWheel = e => e.target.blur();
    const goBack = () => { setCurrentView('dashboard'); setPayCash(''); setPayCard(''); setPayQR(''); };

    const applyMagnet = field => {
        const extCost = currentView === 'extend' ? extendDays * parseInt(guest.pricePerNight) : 0;
        const total  = debt + extCost;
        const others = (field !== 'payCash' ? (parseInt(payCash)||0) : 0)
                     + (field !== 'payCard' ? (parseInt(payCard)||0) : 0)
                     + (field !== 'payQR'   ? (parseInt(payQR)||0)   : 0);
        const rem = Math.max(0, total - others);
        if (field === 'payCash') setPayCash(String(rem));
        if (field === 'payCard') setPayCard(String(rem));
        if (field === 'payQR')   setPayQR(String(rem));
    };

    const handlePayDebt = () => {
        if (isPaymentSubmitting) return;
        const c=parseInt(payCash)||0, cd=parseInt(payCard)||0, q=parseInt(payQR)||0;
        if (c+cd+q<=0) return notify('Введите сумму','error');
        setIsPaymentSubmitting(true);
        onPayment(guest.id, {cash:c,card:cd,qr:q});
        setTimeout(()=>{ setIsPaymentSubmitting(false); goBack(); }, 500);
    };

    const handleSuperPaymentLocal = () => {
        const amount = parseInt(superPayAmount) || 0;
        if (amount <= 0) return notify('Введите сумму', 'error');
        if (onSuperPayment) onSuperPayment(guest.id, amount);
        setSuperPayAmount('');
    };

    const handleExtend = () => {
        const days = parseInt(extendDays); if (!days) return;
        setIsPaymentSubmitting(true);
        const newTotal    = (guest.totalPrice||0) + days*parseInt(guest.pricePerNight);
        const newDays     = parseInt(guest.days) + days;
        const stay        = getStayDetails(guest.checkInDate, newDays);
        const newCheckOut = stay.end.toISOString();
        const c=parseInt(payCash)||0, cd=parseInt(payCard)||0, q=parseInt(payQR)||0;

        if (onExtend) {
            // Апп-уровень: с поддержкой undo
            onExtend(guest.id, {
                extendDays: days,
                payCash: c, payCard: cd, payQR: q,
                prevDays:       parseInt(guest.days),
                prevTotalPrice: guest.totalPrice || 0,
                prevCheckOut:   guest.checkOutDate,
                prevStatus:     guest.status,
                newDays, newTotalPrice: newTotal, newCheckOut,
            });
            setIsPaymentSubmitting(false);
        } else {
            // fallback: прямой вызов
            onUpdate(guest.id, { days: newDays, totalPrice: newTotal, status:'active', checkOutDate: newCheckOut });
            if (c+cd+q>0) {
                setTimeout(()=>{ onPayment(guest.id,{cash:c,card:cd,qr:q}); notify(`Продлено на ${days} дн.`,'success'); setIsPaymentSubmitting(false); goBack(); },300);
            } else { notify(`Продлено на ${days} дн. (в долг)`,'success'); setIsPaymentSubmitting(false); goBack(); }
        }
    };

    const handleDoCheckout = () => {
        const refund = checkoutManualRefund ? parseInt(checkoutManualRefund) : Math.max(0, balance);
        onCheckOut(guest, {totalPrice: actualCost, refundAmount: refund});
    };

    const handleDoSplit = () => {
        const s0 = new Date(guest.checkInDate); s0.setHours(0,0,0,0);
        const ss = new Date(splitStartDate);    ss.setHours(0,0,0,0);
        const se = new Date(splitReturnDate);   se.setHours(0,0,0,0);
        if (ss <= s0) return notify('Дата паузы после заезда','error');
        if (se <= ss) return notify('Возврат позже ухода','error');
        const ms = 1000*60*60*24;
        const before = Math.floor((ss-s0)/ms), gap = Math.floor((se-ss)/ms);
        if (before >= parseInt(guest.days)) return notify('Дата паузы превышает срок','error');
        onSplit(guest, before, gap); onClose();
    };

    const handleReplaceFromDB = () => {
        if (!selectedClient) return notify('Выберите гостя из списка', 'error');
        const { fullName, passport, birthDate, country, phone, passportIssueDate } = selectedClient;
        onUpdate(guest.id, { fullName, passport, birthDate: birthDate||'', country: country||'Узбекистан', phone: phone||'', passportIssueDate: passportIssueDate||'' });
        notify('Гость заменён ✓', 'success');
        goBack();
    };
    const handleReplaceNew = () => {
        if (!replaceNew.fullName.trim()) return notify('Введите ФИО', 'error');
        onUpdate(guest.id, { ...replaceNew });
        notify('Гость заменён ✓', 'success');
        goBack();
    };

    const handleSaveInfo    = () => { onUpdate(guest.id, {...editForm, totalPrice: parseInt(editForm.pricePerNight)*parseInt(guest.days)}); goBack(); };
    const handleDelete      = () => { if (confirm(t('confirmDelete'))) onDelete(guest); };
    const handleReduceNR    = () => { onReduceDaysNoRefund(guest, parseInt(reduceDaysNoRefund)); onClose(); };
    const handleMoveBooking = () => {
        const s = new Date(newStartDate); s.setHours(12,0,0,0);
        const stay = getStayDetails(s.toISOString(), guest.days);
        onUpdate(guest.id, {checkInDate: s.toISOString(), checkOutDate: stay.end.toISOString()});
        notify('Дата изменена!'); goBack();
    };
    const handlePrint = type => printDocument(type, guest, hostelInfo);

    const hdr = (title, back) => (
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 bg-white shrink-0">
            {back && <button onClick={goBack} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400"><ChevronLeft size={20}/></button>}
            <span className="font-black text-slate-800 text-lg">{title}</span>
            <button onClick={onClose} className="ml-auto p-1.5 hover:bg-slate-100 rounded-full text-slate-400"><X size={20}/></button>
        </div>
    );

    const payFields = (
        <div className="space-y-3">
            {[['payCash','Наличные',<DollarSign size={16}/>],['payCard','Карта',<CreditCard size={16}/>],['payQR','QR',<QrCode size={16}/>]].map(([f,pl,ic])=>(
                <div key={f} className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">{ic}</div>
                    <input type="number" className="w-full pl-9 pr-9 py-3 border-2 border-slate-200 rounded-xl font-bold text-slate-800 focus:border-emerald-500 outline-none"
                        placeholder={pl}
                        value={f==='payCash'?payCash:f==='payCard'?payCard:payQR}
                        onChange={e=>{const v=e.target.value; f==='payCash'?setPayCash(v):f==='payCard'?setPayCard(v):setPayQR(v);}}
                        onWheel={disableWheel}/>
                    <button onClick={()=>applyMagnet(f)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg"><Magnet size={15}/></button>
                </div>
            ))}
        </div>
    );

    const MenuButton = ({ icon: Icon, label, color, onClick, subLabel }) => {
        const themes = {
            emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100',
            blue:    'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100',
            rose:    'bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100',
            amber:   'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100',
            slate:   'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
        };
        return (
            <button onClick={onClick} className={`w-full p-4 rounded-2xl border transition-colors flex flex-col items-center justify-center gap-1 ${themes[color]}`}>
                <Icon size={28} className="mb-1 opacity-90"/>
                <span className="font-bold text-sm leading-tight">{label}</span>
                {subLabel && <span className="text-[10px] opacity-70 font-medium leading-none">{subLabel}</span>}
            </button>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 animate-in fade-in duration-150">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

                {currentView === 'dashboard' && (
                    <div className="flex flex-col overflow-hidden bg-slate-50 h-full">
                        <div className="px-5 pt-4 pb-3 border-b border-slate-100 bg-white shrink-0 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                {guest.country && COUNTRY_FLAGS[guest.country]
                                    ? <Flag code={COUNTRY_FLAGS[guest.country]} size={36} className="rounded-md shrink-0"/>
                                    : <div className="w-9 h-9 bg-slate-100 rounded-md flex items-center justify-center shrink-0"><User size={20} className="text-slate-400"/></div>}
                                <div>
                                    <h2 className="font-black text-slate-800 text-lg leading-tight">{guest.fullName}</h2>
                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                        <span className="text-xs text-slate-400">К.{guest.roomNumber} · Место {guest.bedId}</span>
                                        {isBooking    && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">БРОНЬ</span>}
                                        {isCheckedOut && <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">ВЫЕХАЛ</span>}
                                    </div>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 shrink-0"><X size={20}/></button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 pb-8 space-y-3">
                            {!isBooking && (
                                <div className={`rounded-xl p-3 border flex items-center justify-between bg-white ${debt > 0 ? 'border-rose-200' : 'border-emerald-200'}`}>
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Долг / Баланс</div>
                                        {debt > 0
                                            ? <div className="text-xl font-black text-rose-600">⚠{debt.toLocaleString()}</div>
                                            : <div className="text-xl font-black text-emerald-600">Оплачено ✓</div>}
                                    </div>
                                    <div className="text-right text-xs text-slate-400 space-y-0.5">
                                        <div>Итого: <span className="font-bold text-slate-600">{(guest.totalPrice||0).toLocaleString()}</span></div>
                                        <div>Оплачено: <span className="font-bold text-emerald-600">{totalPaid.toLocaleString()}</span></div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-white rounded-xl border border-slate-200 p-3">
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Проживание</div>
                                <div className="grid grid-cols-4 gap-1 text-center">
                                    {[
                                        ['Заезд',  new Date(guest.checkInDate).toLocaleDateString('ru',{day:'2-digit',month:'2-digit'})],
                                        ['Выезд',  new Date(guest.checkOutDate).toLocaleDateString('ru',{day:'2-digit',month:'2-digit'})],
                                        ['Дней',   guest.days],
                                        ['Тариф',  parseInt(guest.pricePerNight).toLocaleString()],
                                    ].map(([l,v])=>(
                                        <div key={l}>
                                            <div className="text-[10px] text-slate-400">{l}</div>
                                            <div className="font-black text-slate-700 text-sm">{v}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 p-3">
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center justify-between">
                                    <span>Личные данные</span>
                                    <button onClick={()=>photoInputRef.current?.click()} className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700 text-[10px] font-bold"><Camera size={12}/> Фото</button>
                                    <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload}/>
                                </div>
                                {guest.passportPhoto && (
                                    <div className="mb-2 relative inline-block">
                                        <img src={guest.passportPhoto} alt="Паспорт" className="h-20 rounded-xl border border-slate-200 object-cover shadow-sm"/>
                                        <button onClick={()=>onUpdate(guest.id,{passportPhoto:''})} className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-xs font-bold">×</button>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                    {[
                                        ['Паспорт',    guest.passport || '—'],
                                        ['Дата рожд.', guest.birthDate ? new Date(guest.birthDate).toLocaleDateString('ru') : '—'],
                                        ['Выдан',      guest.passportIssueDate ? new Date(guest.passportIssueDate).toLocaleDateString('ru') : '—'],
                                        ['Телефон',    guest.phone || '—'],
                                        ['Страна',     guest.country || '—'],
                                        ['Оплата',     [guest.paidCash>0&&`Нал:${(+guest.paidCash).toLocaleString()}`, guest.paidCard>0&&`Карта:${(+guest.paidCard).toLocaleString()}`, guest.paidQR>0&&`QR:${(+guest.paidQR).toLocaleString()}`].filter(Boolean).join(' · ')||'—'],
                                    ].map(([l,v])=>(
                                        <div key={l}>
                                            <span className="text-[10px] text-slate-400">{l}: </span>
                                            <span className="text-xs font-semibold text-slate-700">{v}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {isBooking ? (
                                <div className="space-y-2">
                                    <div className="bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl text-amber-800 text-sm font-bold flex items-center gap-2"><Clock size={15}/> БРОНЬ — не заселён</div>
                                    <button onClick={()=>onActivateBooking(guest)} className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold">ЗАСЕЛИТЬ</button>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={()=>setCurrentView('moveDate')} className="py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 flex items-center justify-center gap-1"><Calendar size={14}/> Перенести</button>
                                        <button onClick={handleDelete} className="py-2.5 rounded-xl border border-rose-200 text-rose-600 font-bold text-sm hover:bg-rose-50 flex items-center justify-center gap-1"><Trash2 size={14}/> Отменить</button>
                                    </div>
                                </div>
                            ) : !isCheckedOut ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {canPay && (
                                        <button onClick={()=>setCurrentView('pay')} className="py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 flex items-center justify-center gap-1.5"><Wallet size={15}/> Оплата</button>
                                    )}
                                    <button onClick={()=>setCurrentView('extend')}   className="py-3 rounded-xl bg-sky-500    text-white font-bold text-sm hover:bg-sky-600    flex items-center justify-center gap-1.5"><Clock size={15}/> Продлить</button>
                                    <button onClick={()=>setCurrentView('split')}    className="py-3 rounded-xl bg-amber-400  text-white font-bold text-sm hover:bg-amber-500  flex items-center justify-center gap-1.5"><Split size={15}/> Пауза</button>
                                    <button onClick={()=>setCurrentView('checkout')} className="py-3 rounded-xl bg-rose-500   text-white font-bold text-sm hover:bg-rose-600   flex items-center justify-center gap-1.5"><LogOut size={15}/> Выселить</button>
                                </div>
                            ) : null}
                        </div>

                        <div className="px-4 py-3 border-t border-slate-100 bg-white shrink-0 flex items-center gap-1 flex-wrap">
                            {!isBooking && (
                                <>
                                    <button onClick={()=>handlePrint('check')}   className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg" title="Чек"><Printer size={17}/></button>
                                    <button onClick={()=>handlePrint('regcard')} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg" title="Рег. карта"><FileText size={17}/></button>
                                    <button onClick={()=>setCurrentView('edit')} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Редактировать"><Edit size={17}/></button>
                                </>
                            )}
                            {!isCheckedOut && canMoveDate && <button onClick={()=>setCurrentView('moveDate')} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Перенос дат"><CalendarDays size={17}/></button>}
                            {!isCheckedOut && <button onClick={onOpenMove} className="ml-auto text-slate-500 hover:text-slate-800 font-bold text-xs flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg"><ArrowLeftRight size={13}/> Переместить</button>}
                            {!isCheckedOut && (
                                <button onClick={() => { setReplaceTab('db'); setReplaceSearch(''); setSelectedClient(null); setCurrentView('replaceGuest'); }}
                                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg" title="Заменить гостя">
                                    <UserX size={17}/>
                                </button>
                            )}
                            {isAdmin && <button onClick={handleDelete} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Удалить"><Trash2 size={17}/></button>}
                            {isAdmin && !isCheckedOut && <button onClick={()=>setCurrentView('admin')} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" title="Админ"><Lock size={17}/></button>}
                            {currentUser.role === 'super' && !isCheckedOut && <button onClick={()=>setCurrentView('superPay')} className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg" title="Зачёт суммы"><ShieldCheck size={17}/></button>}
                            {currentUser.role === 'super' && isCheckedOut && <button onClick={()=>{ if(confirm('Восстановить гостя как активного?')) { onUpdate(guest.id, { status: 'active' }); notify('Гость восстановлен', 'success'); onClose(); }}} className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-violet-100 text-violet-700 hover:bg-violet-200 rounded-lg text-xs font-bold" title="Восстановить гостя"><RotateCcw size={14}/> Восстановить</button>}
                        </div>
                    </div>
                )}

                {currentView === 'pay' && (
                    <div className="flex flex-col overflow-hidden h-full">
                        {hdr('Оплата', true)}
                        <div className="flex-1 p-5 overflow-y-auto space-y-4">
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2">
                                <div className="flex justify-between"><span className="text-xs text-slate-400 uppercase font-bold">Долг</span><span className="font-black text-rose-600 text-xl">{debt.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-xs text-slate-400 uppercase font-bold">Вношу</span><span className="font-black text-emerald-600 text-xl">+{((parseInt(payCash)||0)+(parseInt(payCard)||0)+(parseInt(payQR)||0)).toLocaleString()}</span></div>
                                <div className="flex justify-between pt-2 border-t border-dashed border-slate-200"><span className="text-xs text-slate-400 uppercase font-bold">Останется</span><span className="font-bold text-slate-500">{Math.max(0,debt-((parseInt(payCash)||0)+(parseInt(payCard)||0)+(parseInt(payQR)||0))).toLocaleString()}</span></div>
                            </div>
                            {payFields}
                            <button onClick={handlePayDebt} disabled={isPaymentSubmitting} className="w-full py-3.5 bg-emerald-600 text-white rounded-xl font-bold shadow-lg hover:bg-emerald-700">ПОДТВЕРДИТЬ ОПЛАТУ</button>
                        </div>
                    </div>
                )}

                {currentView === 'extend' && (
                    <div className="flex flex-col overflow-hidden h-full">
                        {hdr('Продление', true)}
                        <div className="flex-1 p-5 overflow-y-auto space-y-4">
                            <div className="flex items-center justify-center gap-5">
                                <button onClick={()=>setExtendDays(Math.max(1,extendDays-1))} className="w-14 h-14 rounded-2xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center hover:bg-slate-200"><Minus size={28}/></button>
                                <div className="text-center">
                                    <input type="number" className="w-20 text-center text-5xl font-black text-slate-800 bg-transparent outline-none" value={extendDays} onChange={e=>setExtendDays(Math.max(1,parseInt(e.target.value)||1))} onWheel={disableWheel}/>
                                    <div className="text-slate-400 font-bold text-xs uppercase">Дней</div>
                                </div>
                                <button onClick={()=>setExtendDays(d=>d+1)} className="w-14 h-14 rounded-2xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center hover:bg-slate-200"><Plus size={28}/></button>
                            </div>
                            <div className="flex gap-2 justify-center">{[1,3,7,30].map(d=><button key={d} onClick={()=>setExtendDays(d)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 text-sm font-bold hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600">+{d}</button>)}</div>
                            {!isAdmin && (
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                                <div className="text-xs font-bold text-slate-400 uppercase mb-3">Оплатить сейчас (опц.)</div>
                                {payFields}
                            </div>
                            )}
                            <div className="flex justify-between items-center px-1">
                                <span className="text-slate-500 font-bold">Стоимость:</span>
                                <span className="text-2xl font-black text-indigo-600">+{(extendDays*parseInt(guest.pricePerNight)).toLocaleString()}</span>
                            </div>
                            <button onClick={handleExtend} disabled={isPaymentSubmitting} className={`w-full py-3.5 text-white rounded-xl font-black shadow-lg ${(!isAdmin && (parseInt(payCash)||0)+(parseInt(payCard)||0)+(parseInt(payQR)||0))>0?'bg-emerald-600 hover:bg-emerald-700':'bg-indigo-600 hover:bg-indigo-700'}`}>
                                {(!isAdmin && ((parseInt(payCash)||0)+(parseInt(payCard)||0)+(parseInt(payQR)||0))>0)?'ОПЛАТИТЬ И ПРОДЛИТЬ':'ПРОДЛИТЬ (В ДОЛГ)'}
                            </button>
                        </div>
                    </div>
                )}

                {currentView === 'checkout' && (
                    <div className="flex flex-col overflow-hidden h-full">
                        {hdr('Выселение', true)}
                        <div className="p-5 flex-1 overflow-y-auto space-y-4">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                <div className="flex justify-between"><span className="text-slate-500">Прожито</span><span className="font-bold">{daysStayed} д.</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Стоимость</span><span className="font-bold">{actualCost.toLocaleString()}</span></div>
                                <div className="h-px bg-slate-200"/>
                                <div className="flex justify-between"><span className="text-slate-500">Оплачено</span><span className="font-bold text-emerald-600">{totalPaid.toLocaleString()}</span></div>
                            </div>
                            {balance < 0 ? (
                                <div className="p-4 bg-rose-50 border-2 border-rose-100 rounded-xl text-center">
                                    <div className="text-rose-400 font-bold text-xs uppercase mb-1">Долг</div>
                                    <div className="text-3xl font-black text-rose-600">{Math.abs(balance).toLocaleString()}</div>
                                </div>
                            ) : (
                                <div className="p-4 bg-emerald-50 border-2 border-emerald-100 rounded-xl text-center">
                                    <div className="text-emerald-500 font-bold text-xs uppercase mb-1">К возврату</div>
                                    <div className="text-3xl font-black text-emerald-600">{balance.toLocaleString()}</div>
                                    {balance > 0 && <input type="number" className="mt-3 w-full p-2.5 text-center border border-emerald-200 rounded-xl outline-none font-bold" placeholder="Возврат (опц.)" value={checkoutManualRefund} onChange={e=>setCheckoutManualRefund(e.target.value)}/>}
                                </div>
                            )}
                            <button onClick={handleDoCheckout} className="w-full py-3.5 bg-rose-600 text-white rounded-xl font-black shadow-xl shadow-rose-200 hover:bg-rose-700">ПОДТВЕРДИТЬ ВЫСЕЛЕНИЕ</button>
                        </div>
                    </div>
                )}

                {currentView === 'edit' && (
                    <div className="flex flex-col overflow-hidden h-full">
                        {hdr('Редактирование', true)}
                        <div className="p-5 flex-1 space-y-3 overflow-y-auto">
                            <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">ФИО</label><input className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold" value={editForm.fullName} onChange={e=>setEditForm({...editForm,fullName:e.target.value.toUpperCase()})}/></div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Паспорт</label><input className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold" value={editForm.passport} onChange={e=>setEditForm({...editForm,passport:e.target.value.toUpperCase()})}/></div>
                                <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Дата рожд.</label><input type="date" className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold" value={editForm.birthDate} onChange={e=>setEditForm({...editForm,birthDate:e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Выдан</label><input type="date" className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold" value={editForm.passportIssueDate} onChange={e=>setEditForm({...editForm,passportIssueDate:e.target.value})}/></div>
                                <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Телефон</label><input className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold" value={editForm.phone} onChange={e=>setEditForm({...editForm,phone:e.target.value})}/></div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Страна</label>
                                <select className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold bg-white" value={editForm.country||'Узбекистан'} onChange={e=>setEditForm({...editForm,country:e.target.value})}>
                                    {COUNTRIES_LIST.map(c=><option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div><label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Тариф/ночь</label><input type="number" className="w-full p-3 border-2 border-slate-200 rounded-xl font-bold" value={editForm.pricePerNight} onChange={e=>setEditForm({...editForm,pricePerNight:e.target.value})}/></div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Фото паспорта</label>
                                <button type="button" onClick={()=>photoInputRef.current?.click()} className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold text-sm flex items-center justify-center gap-2 hover:border-indigo-300 hover:text-indigo-600">
                                    <Camera size={16}/> {guest.passportPhoto ? 'Заменить фото' : 'Загрузить фото'}
                                </button>
                                {guest.passportPhoto && <img src={guest.passportPhoto} alt="Паспорт" className="mt-2 h-24 rounded-xl border border-slate-200 object-cover"/>}
                            </div>
                            <button onClick={handleSaveInfo} className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold mt-2">СОХРАНИТЬ</button>
                        </div>
                    </div>
                )}

                {currentView === 'split' && (
                    <div className="flex flex-col overflow-hidden h-full">
                        {hdr('Пауза', true)}
                        <div className="p-5 flex-1 flex flex-col space-y-4 overflow-y-auto">
                            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-900 font-medium">Выберите даты отсутствия. Место освободится на это время.</div>
                            <div><label className="font-bold block mb-1.5 text-sm text-slate-500">Дата уезда</label><input type="date" className="w-full p-3.5 border-2 border-slate-200 rounded-xl text-base font-bold" value={splitStartDate} onChange={e=>setSplitStartDate(e.target.value)}/></div>
                            <div><label className="font-bold block mb-1.5 text-sm text-slate-500">Дата возвращения</label><input type="date" className="w-full p-3.5 border-2 border-slate-200 rounded-xl text-base font-bold" value={splitReturnDate} onChange={e=>setSplitReturnDate(e.target.value)}/></div>
                            <div className="mt-auto text-center text-sm font-bold text-slate-500">Пауза: <span className="text-amber-600 text-lg">{Math.max(0,Math.ceil((new Date(splitReturnDate)-new Date(splitStartDate))/(1000*60*60*24)))} дн.</span></div>
                            <button onClick={handleDoSplit} className="w-full py-3.5 bg-amber-500 text-white rounded-xl font-bold">ПОДТВЕРДИТЬ ПАУЗУ</button>
                        </div>
                    </div>
                )}

                {currentView === 'admin' && (
                    <div className="flex flex-col overflow-hidden h-full">
                        {hdr('Админ', true)}
                        <div className="p-5 space-y-4 overflow-y-auto">
                            <div className="p-4 border-2 border-amber-200 bg-amber-50 rounded-xl space-y-3">
                                <div className="text-xs font-bold text-amber-700 uppercase">Сократить дни (без возврата)</div>
                                <div className="flex gap-2">
                                    <input type="number" className="w-20 p-2.5 border rounded-xl font-bold text-center" value={reduceDaysNoRefund} onChange={e=>setReduceDaysNoRefund(e.target.value)}/>
                                    <button onClick={handleReduceNR} className="flex-1 px-3 py-2.5 bg-amber-500 text-white rounded-xl font-bold text-sm">Сократить</button>
                                </div>
                            </div>
                            <div className="p-4 border-2 border-rose-200 bg-rose-50 rounded-xl space-y-3">
                                <div className="text-xs font-bold text-rose-700 uppercase">Опасная зона</div>
                                {!isCheckedOut && <button onClick={()=>setCurrentView('checkout')} className="w-full py-3 bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-2"><LogOut size={15}/> ПРИНУДИТЕЛЬНО ВЫСЕЛИТЬ</button>}
                                <button onClick={handleDelete} className="w-full py-3 bg-rose-600 text-white rounded-xl font-bold flex items-center justify-center gap-2"><Trash2 size={15}/> УДАЛИТЬ ГОСТЯ</button>
                            </div>
                        </div>
                    </div>
                )}

                {currentView === 'superPay' && (
                    <div className="flex flex-col overflow-hidden h-full">
                        {hdr('Зачёт суммы', true)}
                        <div className="p-5 space-y-4">
                            <div className="p-4 border-2 border-violet-200 bg-violet-50 rounded-xl space-y-1">
                                <div className="text-xs font-bold text-violet-700 uppercase">Текущий долг</div>
                                <div className="text-2xl font-black text-violet-800">{debt.toLocaleString()} сум</div>
                            </div>
                            {guest.superAdjusted ? (
                                <div className="text-xs text-violet-500 font-semibold">Ранее зачтено: {(guest.superAdjusted).toLocaleString()} сум</div>
                            ) : null}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Сумма к зачёту</label>
                                <input type="number" className="w-full p-4 border-2 border-violet-200 rounded-xl font-bold text-xl text-center focus:border-violet-400 outline-none"
                                    placeholder="0" value={superPayAmount} onChange={e => setSuperPayAmount(e.target.value)} onWheel={disableWheel}/>
                            </div>
                            <button onClick={handleSuperPaymentLocal} className="w-full py-3.5 text-white rounded-xl font-bold flex items-center justify-center gap-2" style={{background:'#7c3aed'}}>
                                <ShieldCheck size={16}/> ЗАЧЕСТЬ СУММУ
                            </button>
                            <p className="text-xs text-slate-400 text-center">Операция не отображается в финансовых отчётах</p>
                        </div>
                    </div>
                )}

                {currentView === 'moveDate' && (
                    <div className="flex flex-col overflow-hidden">
                        {hdr('Перенос даты', true)}
                        <div className="p-5">
                            <label className="font-bold block mb-2 text-sm text-slate-500">Новая дата заезда</label>
                            <input type="date" className="w-full p-4 border-2 border-slate-200 rounded-xl font-bold text-lg mb-5" value={newStartDate} onChange={e=>setNewStartDate(e.target.value)}/>
                            <button onClick={handleMoveBooking} className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold">СОХРАНИТЬ</button>
                        </div>
                    </div>
                )}

                {/* ───────────────── ЗАМЕНИТЬ ГОСТЯ ───────────────── */}
                {currentView === 'replaceGuest' && (() => {
                    const INP2 = "w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:border-amber-400 outline-none";
                    const q = replaceSearch.toLowerCase();
                    const filteredClients = clients.filter(c =>
                        (c.fullName || '').toLowerCase().includes(q) ||
                        (c.passport || '').toLowerCase().includes(q)
                    ).slice(0, 40);

                    return (
                        <div className="flex flex-col overflow-hidden h-full">
                            {hdr('Заменить гостя', true)}

                            {/* Tabs */}
                            <div className="flex border-b border-slate-100 bg-white shrink-0">
                                {[['db','Из базы клиентов'],['new','Ввести вручную']].map(([tab, label]) => (
                                    <button key={tab} onClick={() => setReplaceTab(tab)}
                                        className={`flex-1 py-3 text-sm font-bold transition-colors border-b-2 ${
                                            replaceTab === tab
                                                ? 'border-amber-500 text-amber-700'
                                                : 'border-transparent text-slate-400 hover:text-slate-600'
                                        }`}>
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* Tab: from DB */}
                            {replaceTab === 'db' && (
                                <div className="flex flex-col flex-1 overflow-hidden">
                                    {/* Search */}
                                    <div className="px-4 pt-3 pb-2 bg-slate-50 border-b border-slate-100 shrink-0">
                                        <div className="relative">
                                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                autoFocus
                                                className="w-full pl-9 pr-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:border-amber-400 outline-none"
                                                placeholder="ФИО или паспорт..."
                                                value={replaceSearch}
                                                onChange={e => { setReplaceSearch(e.target.value); setSelectedClient(null); }}
                                            />
                                        </div>
                                    </div>

                                    {/* Client list */}
                                    <div className="flex-1 overflow-y-auto">
                                        {filteredClients.length === 0 ? (
                                            <div className="py-10 text-center text-slate-400 text-sm">
                                                {replaceSearch ? 'Ничего не найдено' : 'Начните вводить ФИО или паспорт'}
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-slate-50">
                                                {filteredClients.map(c => {
                                                    const isSel = selectedClient?.id === c.id || selectedClient?.passport === c.passport;
                                                    const flagCode = COUNTRY_FLAGS[c.country];
                                                    return (
                                                        <button key={c.id || c.passport}
                                                            onClick={() => setSelectedClient(c)}
                                                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                                                                isSel
                                                                    ? 'bg-amber-50 border-l-4 border-amber-400'
                                                                    : 'hover:bg-slate-50 border-l-4 border-transparent'
                                                            }`}>
                                                            {flagCode
                                                                ? <img src={`https://flagcdn.com/w40/${flagCode.toLowerCase()}.png`} alt="" className="w-6 h-4 object-cover rounded shrink-0" />
                                                                : <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center shrink-0"><User size={12} className="text-slate-400" /></div>
                                                            }
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-bold text-sm text-slate-800 truncate">{c.fullName}</div>
                                                                <div className="text-[11px] text-slate-400 font-mono">{c.passport || '—'} {c.country ? `· ${c.country}` : ''}</div>
                                                            </div>
                                                            {isSel && <div className="w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shrink-0"><span className="text-white text-[10px] font-black">✓</span></div>}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Confirm */}
                                    {selectedClient && (
                                        <div className="p-4 border-t border-slate-100 bg-white shrink-0">
                                            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                                                <div className="font-black text-slate-800 truncate">{selectedClient.fullName}</div>
                                                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{selectedClient.passport} · {selectedClient.country}</div>
                                            </div>
                                            <button onClick={handleReplaceFromDB}
                                                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow-sm shadow-amber-100 transition-colors">
                                                ПОДТВЕРДИТЬ ЗАМЕНУ
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Tab: manual */}
                            {replaceTab === 'new' && (
                                <div className="flex-1 overflow-y-auto p-4 pb-8 space-y-3">
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
                                        Заменит ФИО, паспорт и личные данные гостя. Комната, даты и оплата останутся.
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">ФИО *</label>
                                        <input className={INP2} placeholder="ИВАНОВ ИВАН ИВАНОВИЧ"
                                            value={replaceNew.fullName}
                                            onChange={e => setReplaceNew({...replaceNew, fullName: e.target.value.toUpperCase()})} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Паспорт</label>
                                            <input className={INP2} placeholder="AA1234567"
                                                value={replaceNew.passport}
                                                onChange={e => setReplaceNew({...replaceNew, passport: e.target.value.toUpperCase()})} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Дата рожд.</label>
                                            <input type="date" className={INP2}
                                                value={replaceNew.birthDate}
                                                onChange={e => setReplaceNew({...replaceNew, birthDate: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Выдан</label>
                                            <input type="date" className={INP2}
                                                value={replaceNew.passportIssueDate}
                                                onChange={e => setReplaceNew({...replaceNew, passportIssueDate: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Телефон</label>
                                            <input className={INP2} placeholder="+998..."
                                                value={replaceNew.phone}
                                                onChange={e => setReplaceNew({...replaceNew, phone: e.target.value})} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Страна</label>
                                        <div className="relative">
                                            <select className={INP2 + ' pr-8 appearance-none'}
                                                value={replaceNew.country}
                                                onChange={e => setReplaceNew({...replaceNew, country: e.target.value})}>
                                                {COUNTRIES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                                        </div>
                                    </div>
                                    <button onClick={handleReplaceNew}
                                        className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black shadow-sm shadow-amber-100 transition-colors mt-2">
                                        СОХРАНИТЬ И ЗАМЕНИТЬ
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })()}

            </div>
        </div>
    );
};

export default GuestDetailsModal;
