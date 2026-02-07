import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  increment,
  writeBatch,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { 
  getFunctions, 
  httpsCallable 
} from 'firebase/functions';

import { 
  LayoutDashboard, 
  BedDouble, 
  Users, 
  LogOut, 
  Plus, 
  Wallet,
  Edit,
  Building2,
  Calendar as CalendarIcon,
  User,
  Lock,
  CheckCircle2,
  MapPin,
  FileText,
  PlusCircle,
  Power,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertCircle,
  Copy,
  ChevronLeft,
  ChevronRight,
  Download,
  XCircle,
  UserCog,
  Loader2,
  Split, 
  ArrowLeftRight,
  Search,
  Check,
  Printer, 
  Clock,   
  Coins,    
  Magnet, 
  Wrench,
  CalendarDays,
  X,
  Wifi,
  WifiOff,
  Globe,
  History,
  Scissors,
  Upload,
  FileSpreadsheet,
  Merge,
  Square,
  CheckSquare,
  ScanLine,
  Timer
} from 'lucide-react';

// --- STYLES ---
const inputClass = "w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm shadow-sm font-medium text-slate-700 no-spinner";
const labelClass = "block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide ml-1";

// --- TRANSLATIONS ---
const TRANSLATIONS = {
  ru: {
    dashboard: "Дашборд", rooms: "Номера", calendar: "Календарь", reports: "Отчеты", debts: "Долги", tasks: "Задачи", expenses: "Расходы", clients: "Клиенты", staff: "Персонал", shifts: "Смены",
    logout: "Выйти", login: "Логин", pass: "Пароль", enter: "Войти в систему",
    guests: "Постояльцы", occupancy: "Загрузка", revenue: "Выручка", today: "Сегодня",
    cash: "Наличные", card: "Терминал", qr: "QR",
    checkin: "Заселить", booking: "Бронь", debt: "Долг", paid: "Оплачено", 
    save: "Сохранить", cancel: "Отмена", delete: "Удалить", edit: "Редактировать",
    guestName: "ФИО Гостя", passport: "Паспорт", birthDate: "Дата рождения", country: "Страна",
    room: "Комната", bed: "Койка", days: "Дней", price: "Цена", total: "Итого",
    comment: "Комментарий", category: "Категория", amount: "Сумма",
    success: "Успешно", error: "Ошибка",
    splitTitle: "Разделение (Пауза)", splitAfter: "Выезд через (дн.)", splitGap: "Пауза (дн.)",
    splitInfo: "Гость живет {x} дн., затем место свободно {y} дн., затем заселяется снова на {z} дн.",
    confirmSplit: "Подтвердить разделение",
    checkoutWarn: "Осталось", timeOut: "Время вышло",
    shiftClose: "Закрытие смены", cashInHand: "В кассе", shift: "Смена",
    payment: "Оплата", extend: "Продлить", move: "Переместить", checkout: "Выселить",
    confirmDelete: "Вы уверены?",
    search: "Поиск...",
    allHostels: "Все филиалы",
    welcome: "Добро пожаловать",
    initDb: "Инициализация БД",
    addTask: "Добавить задачу", priority: "Приоритет", description: "Описание",
    low: "Низкий", medium: "Средний", high: "Высокий",
    printCheck: "Чек", printForm: "Анкета", printRef: "Справка",
    income: "Приход", expense: "Расход", balance: "Баланс",
    done: "Готово", role: "Роль", action: "Действие",
    admin: "Админ", cashier: "Кассир",
    noData: "Нет данных", createdBy: "Создал", date: "Дата",
    moveDate: "Перенос даты", newDate: "Новая дата", manualRefund: "Сумма возврата",
    payDebt: "Погасить долг", addDebt: "Изменить долг", history: "История",
    reduceNoRefund: "Сократить (Без возврата)",
    debtRemaining: "Остался долг. Требуется админ.",
    allCashiers: "Все кассиры",
    selectCashier: "Выбрать кассира",
    assignTo: "Назначить",
    householdGoods: "Хозтовары",
    groceries: "Продукты", 
    repair: "Ремонт",
    salary: "Зарплата",
    utilities: "Коммунальные",
    other: "Прочее",
    freeFor: "Свободно",
    future: "Будет",
    import: "Импорт (CSV)",
    preview: "Предпросмотр",
    new: "Новый",
    update: "Обновить",
    importSuccess: "Импорт завершен",
    deduplicate: "Найти дубликаты",
    deleteSelected: "Удалить выбранные",
    normalizeCountries: "Нормализация стран",
    createDebt: "Создать долг",
    print: "Печать",
    printReport: "Печать отчета",
    checkinNew: "Заселить нового",
    startShift: "Начать смену",
    endShift: "Закончить смену",
    transferShift: "Передать смену",
    working: "В работе",
    workedHours: "Часы",
    salaryCalc: "Расчет ЗП"
  },
  uz: {
    dashboard: "Boshqaruv", rooms: "Xonalar", calendar: "Kalendar", reports: "Hisobotlar", debts: "Qarzlar", tasks: "Vazifalar", expenses: "Xarajatlar", clients: "Mijozlar", staff: "Xodimlar", shifts: "Smenalar",
    logout: "Chiqish", login: "Login", pass: "Parol", enter: "Tizimga kirish",
    guests: "Mehmonlar", occupancy: "Bandlik", revenue: "Tushum", today: "Bugun",
    cash: "Naqd", card: "Terminal", qr: "QR",
    checkin: "Joylashtirish", booking: "Band qilish", debt: "Qarz", paid: "To'langan",
    save: "Saqlash", cancel: "Bekor qilish", delete: "O'chirish", edit: "Tahrirlash",
    guestName: "F.I.SH", passport: "Pasport", birthDate: "Tug'ilgan sana", country: "Davlat",
    room: "Xona", bed: "Joy", days: "Kun", price: "Narx", total: "Jami",
    comment: "Izoh", category: "Toifa", amount: "Summa",
    success: "Muvaffaqiyatli", error: "Xato",
    splitTitle: "Bo'lish (Pauza)", splitAfter: "Chiqish (kun)", splitGap: "Tanaffus (kun)",
    splitInfo: "Mehmon {x} kun yashaydi, keyin joy {y} kun bo'sh turadi, so'ng yana {z} kunga joylashadi.",
    confirmSplit: "Bo'lishni tasdiqlash",
    checkoutWarn: "Qoldi", timeOut: "Vaqt tugadi",
    shiftClose: "Smenani yopish", cashInHand: "Kassada", shift: "Smena",
    payment: "To'lov", extend: "Uzaytirish", move: "Ko'chirish", checkout: "Chiqarish",
    confirmDelete: "Ishonchingiz komilmi?",
    search: "Qidirish...",
    allHostels: "Barcha filiallar",
    welcome: "Xush kelibsiz",
    initDb: "MB ishga tushirish",
    addTask: "Vazifa qo'shish", priority: "Muhimlik", description: "Tavsif",
    low: "Past", medium: "O'rta", high: "Yuqori",
    printCheck: "Chek", printForm: "Anketa", printRef: "Ma'lumotnoma",
    income: "Kirim", expense: "Chiqim", balance: "Balans",
    done: "Bajarildi", role: "Rol", action: "Amal",
    admin: "Admin", cashier: "Kassir",
    noData: "Ma'lumot yo'q", createdBy: "Yaratdi", date: "Sana",
    moveDate: "Sanani ko'chirish", newDate: "Yangi sana", manualRefund: "Qaytarish summasi",
    payDebt: "Qarzni to'lash", addDebt: "Qarzni o'zgartirish", history: "Tarix",
    reduceNoRefund: "Qisqartirish (Qaytim yo'q)",
    debtRemaining: "Qarz qoldi. Admin kerak.",
    allCashiers: "Barcha kassirlar",
    selectCashier: "Kassirni tanlash",
    assignTo: "Tayinlash",
    householdGoods: "Хўжалик буюмлари",
    groceries: "Озиқ-овқат",
    repair: "Таъмирлаш",
    salary: "Иш ҳақи",
    utilities: "Коммунал",
    other: "Бошқа",
    freeFor: "Bo'sh",
    future: "Bo'ladi",
    import: "Import (CSV)",
    preview: "Ko'rib chiqish",
    new: "Yangi",
    update: "Yangilash",
    importSuccess: "Import bajarildi",
    deduplicate: "Dublikatlarni topish",
    deleteSelected: "Tanlanganlarni o'chirish",
    normalizeCountries: "Davlatlarni to'g'irlash",
    createDebt: "Qarz yaratish",
    print: "Chop etish",
    printReport: "Hisobotni chop etish",
    checkinNew: "Yangi mehmon",
    startShift: "Smenani boshlash",
    endShift: "Smenani tugatish",
    transferShift: "Smenani topshirish",
    working: "Ishlamoqda",
    workedHours: "Soat",
    salaryCalc: "Maosh hisobi"
  }
};

// --- TELEGRAM CONFIG ---
const TG_BOT_TOKEN = "8483864240:AAGotoLWbAVH4iA6gh3GF-eNL5fAASHW468"; 
const TG_CHAT_IDS = ["7029598539", "6953132612"]; 

const sendTelegramMessage = async (text) => {
    if (!TG_BOT_TOKEN || TG_BOT_TOKEN.includes("YOUR_TELEGRAM")) return;
    try {
        await Promise.all(TG_CHAT_IDS.map(chatId => 
            fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
            })
        ));
    } catch (e) {
        console.error("Telegram Error:", e);
    }
};

// --- FIREBASE CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyAoVj92dmnl5gBB7zYul0iG2Ekp5cbmkp0",
  authDomain: "hostella-app-a1e07.firebaseapp.com",
  projectId: "hostella-app-a1e07",
  storageBucket: "hostella-app-a1e07.firebasestorage.app",
  messagingSenderId: "826787873496",
  appId: "1:826787873496:web:51a0c6e42631a28919cdad"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app);

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, "hostella");

const APP_ID = 'hostella-multi-v4';
const PUBLIC_DATA_PATH = ['artifacts', APP_ID, 'public', 'data'];

// --- SALARY CONFIG ---
const DAILY_SALARY = 266666; // for 24 hours

// --- DEFAULT DATA ---
const DEFAULT_USERS = [
  { login: 'admin', pass: 'admin', name: 'Aziz Yuldashev', role: 'admin', hostelId: 'all' },
  { login: 'dilafruz', pass: '123', name: 'Dilafruz', role: 'cashier', hostelId: 'hostel1' },
  { login: 'nargiza', pass: '123', name: 'Nargiza', role: 'cashier', hostelId: 'hostel1' },
  { login: 'fazliddin', pass: '123', name: 'Fazliddin', role: 'viewer', hostelId: 'hostel2', viewHostels: ['hostel1', 'hostel2'] },
  { login: 'olimjon', pass: '123', name: 'Olimjon', role: 'cashier', hostelId: 'hostel2' },
];

// --- COUNTRY MAPPING & LIST ---
const COUNTRY_MAP = {
  'turkmenistan': 'Туркмения',
  'turkmenia': 'Туркмения',
  'uzbekistan': 'Узбекистан',
  'russia': 'Россия',
  'russian federation': 'Россия',
  'kazakhstan': 'Казахстан',
  'tajikistan': 'Таджикистан',
  'kyrgyzstan': 'Кыргызстан',
  'kirgizstan': 'Кыргызстан',
  'usa': 'США',
  'united states': 'США',
  'united states of america': 'США',
  'china': 'Китай',
  'turkey': 'Турция',
  'korea': 'Корея (Южная)',
  'south korea': 'Корея (Южная)',
  'india': 'Индия',
  'pakistan': 'Пакистан',
  'afghanistan': 'Афганистан',
  'germany': 'Германия',
  'uk': 'Великобритания',
  'united kingdom': 'Великобритания',
  'england': 'Великобритания',
  'france': 'Франция',
  'italy': 'Италия',
  'spain': 'Испания',
  'japan': 'Япония',
  'uae': 'ОАЭ',
  'united arab emirates': 'ОАЭ'
};

const COUNTRIES = [
  "Узбекистан", "Россия", "Казахстан", "Таджикистан", "Кыргызстан", "Абхазия", "Австралия", "Австрия", "Азербайджан", "Албания", "Алжир", 
  "Ангола", "Аргентина", "Армения", "Афганистан", "Багамские Острова", "Бангладеш", "Барбадос", "Бахрейн", "Белоруссия", "Бельгия", 
  "Болгария", "Бразилия", "Великобритания", "Венгрия", "Венесуэла", "Вьетнам", "Германия", "Гонконг", "Греция", "Грузия", "Дания", 
  "Египет", "Израиль", "Индия", "Индонезия", "Иордания", "Ирак", "Иран", "Ирландия", "Исландия", "Испания", "Италия", 
  "Канада", "Катар", "Кения", "Кипр", "Китай", "Колумбия", "Корея (Южная)", "Куба", "Кувейт", 
  "Латвия", "Литва", "Малайзия", "Мальдивы", "Марокко", "Мексика", "Молдавия", "Монголия", "Непал", "Нидерланды", 
  "Новая Зеландия", "Норвегия", "ОАЭ", "Пакистан", "Польша", "Португалия", "Румыния", "Саудовская Аравия", "Сербия", "Сингапур", 
  "Сирия", "Словакия", "Словеия", "США", "Таиланд", "Туркмения", "Турция", "Украина", "Филиппины", "Финляндия", 
  "Франция", "Хорватия", "Чехия", "Чили", "Швейцария", "Швеция", "Шри-Ланка", "Эстония", "Япония"
];

const HOSTELS = {
  hostel1: { name: 'Хостел №1', address: 'Ташкент, улица Ниёзбек Йули, 43', currency: 'UZS' },
  hostel2: { name: 'Хостел №2', address: 'Ташкент, 6-й пр. Ниёзбек Йули, 39', currency: 'UZS' }
};

// --- HELPERS ---
const getTotalPaid = (g) => (typeof g.amountPaid === 'number' ? g.amountPaid : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0)));

const getLocalDateString = (dateObj) => {
    if (!dateObj) return '';
    const offset = dateObj.getTimezoneOffset() * 60000;
    const localISOTime = new Date(dateObj.getTime() - offset).toISOString().slice(0, 10);
    return localISOTime;
};

const getLocalDatetimeString = (dateObj) => {
    if (!dateObj) return '';
    const offset = dateObj.getTimezoneOffset() * 60000;
    const localISOTime = new Date(dateObj.getTime() - offset).toISOString().slice(0, 16);
    return localISOTime;
};

const getStayDetails = (checkInIsoOrDate, days, now = new Date()) => {
    const start = new Date(checkInIsoOrDate);
    start.setHours(12, 0, 0, 0);

    const startDateNormalized = new Date(start);

    const end = new Date(start);
    end.setDate(end.getDate() + parseInt(days));
    end.setHours(12, 0, 0, 0);

    return { start, end, startDateNormalized };
};

const checkCollision = (startA, daysA, startB, daysB) => {
    const stayA = getStayDetails(startA, daysA);
    const stayB = getStayDetails(startB, daysB);
    
    const startATime = stayA.start.getTime();
    const endATime = stayA.end.getTime();
    
    const startBTime = stayB.start.getTime();
    const endBTime = stayB.end.getTime();

    return (startATime < endBTime && endATime > startBTime);
};

const calculateSalary = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end - start;
    const hours = diffMs / (1000 * 60 * 60);
    const hourlyRate = DAILY_SALARY / 24;
    return Math.round(hours * hourlyRate);
};

const exportToExcel = (data, filename, totalIncome = 0, totalExpense = 0) => {
    const balance = totalIncome - totalExpense;
    
    let tableContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
            <style>
                body { font-family: Arial, sans-serif; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #000000; padding: 8px; text-align: left; vertical-align: top; }
                th { background-color: #4f46e5; color: #ffffff; font-weight: bold; }
                .income { color: #166534; font-weight: bold; }
                .expense { color: #9f1239; font-weight: bold; }
                .amount { text-align: right; }
            </style>
        </head>
        <body>
            <table>
                <thead>
                    <tr>
                        <th>Дата</th>
                        <th>Тип</th>
                        <th>Хостел</th>
                        <th>Кассир</th>
                        <th>Сумма</th>
                        <th>Метод</th>
                        <th>Описание</th>
                    </tr>
                </thead>
                <tbody>
    `;

    data.forEach(row => {
        const typeClass = row.type === 'income' ? 'income' : 'expense';
        const typeLabel = row.type === 'income' ? 'Приход' : 'Расход';
        tableContent += `
            <tr>
                <td>${row.date}</td>
                <td class="${typeClass}">${typeLabel}</td>
                <td>${row.hostel || '-'}</td>
                <td>${row.staff}</td>
                <td class="amount">${parseInt(row.amount).toLocaleString()}</td>
                <td>${row.method}</td>
                <td>${row.comment}</td>
            </tr>
        `;
    });

    // ✅ Итоговые строки
    if (totalIncome > 0 || totalExpense > 0) {
        tableContent += `
            <tr style="background-color: #f3f4f6; font-weight: bold; border-top: 3px solid #000;">
                <td colspan="4" style="text-align: right;">ИТОГО ПРИХОД:</td>
                <td class="income" style="text-align: right;">${totalIncome.toLocaleString()}</td>
                <td colspan="2"></td>
            </tr>
            <tr style="background-color: #f3f4f6; font-weight: bold;">
                <td colspan="4" style="text-align: right;">ИТОГО РАСХОД:</td>
                <td class="expense" style="text-align: right;">${totalExpense.toLocaleString()}</td>
                <td colspan="2"></td>
            </tr>
            <tr style="background-color: #e0e7ff; font-weight: bold;">
                <td colspan="4" style="text-align: right; font-size: 16px;">БАЛАНС:</td>
                <td style="text-align: right; font-size: 16px; color: ${balance >= 0 ? '#166534' : '#9f1239'};">${balance.toLocaleString()}</td>
                <td colspan="2"></td>
            </tr>
        `;
    }

    tableContent += `</tbody></table></body></html>`;

    // Add BOM for proper UTF-8 encoding
    const blob = new Blob(['\ufeff', tableContent], { type: 'application/vnd.ms-excel; charset=UTF-8' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const printDocument = (type, guest, hostel) => {
    const w = window.open('', '', 'width=800,height=600');
    let html = '<html><head><meta charset="UTF-8"><title>';
    
    if (type === 'check' || type === 'Чек') {
        html += 'Receipt</title>';
        html += `
        <style>
            body { font-family: 'Courier New', monospace; padding: 30px; max-width: 400px; margin: 0 auto; background: #f9fafb; }
            .receipt { background: white; border: 2px solid #000; padding: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 15px; margin-bottom: 20px; }
            .header h2 { margin: 0 0 8px 0; font-size: 20px; }
            .header p { margin: 3px 0; font-size: 11px; color: #666; }
            .row { display: flex; justify-content: space-between; margin: 10px 0; font-size: 13px; }
            .row.bold { font-weight: bold; font-size: 14px; }
            .divider { border-top: 1px dashed #ccc; margin: 15px 0; }
            .total { border-top: 2px solid #000; margin-top: 20px; padding-top: 15px; }
            .total .row { font-size: 16px; font-weight: bold; }
            .balance { font-size: 18px; margin-top: 10px; }
            .balance.paid { color: #10b981; }
            .balance.debt { color: #ef4444; }
            .footer { text-align: center; margin-top: 25px; padding-top: 15px; border-top: 2px dashed #000; font-size: 11px; color: #666; }
        </style>
        </head><body>
        <div class="receipt">
            <div class="header">
                <h2>${hostel.name}</h2>
                <p>${hostel.address}</p>
                <p>ЧЕК №${(guest.id || '').toString().slice(0, 8).toUpperCase()}</p>
                <p>${new Date().toLocaleString('ru-RU')}</p>
            </div>
            
            <div class="row bold"><span>Гость:</span><span>${guest.fullName}</span></div>
            <div class="row"><span>Паспорт:</span><span>${guest.passport}</span></div>
            <div class="row"><span>Комната:</span><span>№${guest.roomNumber}, место ${guest.bedId}</span></div>
            
            <div class="divider"></div>
            
            <div class="row"><span>Дата заезда:</span><span>${new Date(guest.checkInDate).toLocaleDateString('ru-RU')}</span></div>
            <div class="row"><span>Количество дней:</span><span>${guest.days}</span></div>
            <div class="row"><span>Цена за ночь:</span><span>${(guest.pricePerNight || 0).toLocaleString()} сум</span></div>
            
            <div class="divider"></div>
            
            <div class="row bold"><span>ИТОГО:</span><span>${(guest.totalPrice || 0).toLocaleString()} сум</span></div>
            <div class="row" style="color: #10b981;"><span>Оплачено:</span><span>${getTotalPaid(guest).toLocaleString()} сум</span></div>
            
            <div class="total">
                <div class="row balance ${(guest.totalPrice || 0) - getTotalPaid(guest) > 0 ? 'debt' : 'paid'}">
                    <span>К оплате:</span>
                    <span>${Math.max(0, (guest.totalPrice || 0) - getTotalPaid(guest)).toLocaleString()} сум</span>
                </div>
            </div>
            
            <div class="footer">
                <p>Спасибо за выбор нашего хостела!</p>
                <p>Хорошего дня!</p>
            </div>
        </div>
        </body></html>`;
        
    } else if (type === 'regcard' || type === 'Анкета') {
        html += 'Registration Card</title>';
        html += `
        <style>
            body { font-family: Arial, sans-serif; padding: 40px; background: #f9fafb; }
            .form { background: white; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #ddd; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .form-header { text-align: center; border-bottom: 3px solid #4f46e5; padding-bottom: 20px; margin-bottom: 30px; }
            .form-header h1 { margin: 0 0 10px 0; color: #4f46e5; font-size: 24px; }
            .field { margin: 20px 0; padding: 15px; background: #f9fafb; border-left: 4px solid #4f46e5; }
            .field-label { font-size: 11px; color: #666; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; }
            .field-value { font-size: 16px; color: #1f2937; font-weight: 600; }
            .signature { margin-top: 50px; border-top: 1px solid #000; padding-top: 10px; text-align: center; }
        </style>
        </head><body>
        <div class="form">
            <div class="form-header">
                <h1>РЕГИСТРАЦИОННАЯ АНКЕТА ГОСТЯ</h1>
                <p style="margin: 5px 0; color: #666;">${hostel.name}</p>
                <p style="margin: 0; font-size: 12px; color: #999;">${hostel.address}</p>
            </div>
            
            <div class="field">
                <div class="field-label">ФИО гостя:</div>
                <div class="field-value">${guest.fullName}</div>
            </div>
            
            <div class="field">
                <div class="field-label">Паспортные данные:</div>
                <div class="field-value">${guest.passport}</div>
            </div>
            
            <div class="field">
                <div class="field-label">Гражданство:</div>
                <div class="field-value">${guest.country}</div>
            </div>
            
            <div class="field">
                <div class="field-label">Дата рождения:</div>
                <div class="field-value">${guest.birthDate || 'Не указана'}</div>
            </div>
            
            <div class="field">
                <div class="field-label">Комната / Место:</div>
                <div class="field-value">№${guest.roomNumber}, место ${guest.bedId}</div>
            </div>
            
            <div class="field">
                <div class="field-label">Дата заезда:</div>
                <div class="field-value">${new Date(guest.checkInDate).toLocaleString('ru-RU')}</div>
            </div>
            
            <div class="field">
                <div class="field-label">Период проживания:</div>
                <div class="field-value">${guest.days} дней</div>
            </div>
            
            <div class="signature">
                <p style="margin: 30px 0 10px 0; font-size: 12px;">Подпись гостя: _______________________</p>
                <p style="margin: 0; font-size: 11px; color: #999;">Дата: ${new Date().toLocaleDateString('ru-RU')}</p>
            </div>
        </div>
        </body></html>`;
        
    } else if (type === 'ref' || type === 'Справка') {
        html += 'Reference Letter</title>';
        html += `
        <style>
            body { font-family: 'Times New Roman', serif; padding: 50px; background: #f9fafb; }
            .certificate { background: white; max-width: 700px; margin: 0 auto; padding: 50px; border: 2px solid #4f46e5; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .cert-header { text-align: center; margin-bottom: 40px; }
            .cert-header h1 { margin: 0 0 20px 0; color: #4f46e5; font-size: 28px; text-transform: uppercase; letter-spacing: 2px; }
            .cert-number { text-align: right; font-size: 12px; color: #666; margin-bottom: 30px; }
            .cert-body { line-height: 1.8; font-size: 15px; text-align: justify; }
            .cert-body p { margin: 20px 0; }
            .cert-highlight { font-weight: bold; color: #1f2937; }
            .cert-footer { margin-top: 50px; }
            .cert-footer p { margin: 30px 0 5px 0; font-size: 13px; }
            .signature-line { border-bottom: 1px solid #000; display: inline-block; min-width: 250px; margin-left: 10px; }
            .stamp { margin-top: 30px; padding: 20px; border: 2px dashed #4f46e5; text-align: center; color: #4f46e5; font-weight: bold; }
        </style>
        </head><body>
        <div class="certificate">
            <div class="cert-header">
                <h1>СПРАВКА</h1>
                <p style="margin: 0; font-size: 14px; color: #666;">${hostel.name}</p>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #999;">${hostel.address}</p>
            </div>
            
            <div class="cert-number">№ ${Date.now().toString().slice(-6)} от ${new Date().toLocaleDateString('ru-RU')}</div>
            
            <div class="cert-body">
                <p>Настоящая справка выдана в том, что гражданин(ка) <span class="cert-highlight">${guest.fullName}</span>, паспорт <span class="cert-highlight">${guest.passport}</span>, гражданство <span class="cert-highlight">${guest.country}</span>, действительно проживал(а) в ${hostel.name}.</p>
                
                <p><strong>Период проживания:</strong> с <span class="cert-highlight">${new Date(guest.checkInDate).toLocaleDateString('ru-RU')}</span> продолжительностью <span class="cert-highlight">${guest.days} дней</span>.</p>
                
                <p><strong>Место размещения:</strong> комната №<span class="cert-highlight">${guest.roomNumber}</span>, место <span class="cert-highlight">${guest.bedId}</span>.</p>
                
                <p>Справка выдана для предъявления по месту требования.</p>
            </div>
            
            <div class="cert-footer">
                <p>Администратор: <span class="signature-line"></span></p>
                <p style="margin-left: 160px; font-size: 11px; color: #666;">(подпись)</p>
                
                <div class="stamp">
                    МЕСТО ДЛЯ ПЕЧАТИ
                </div>
            </div>
        </div>
        </body></html>`;
    }
    
    html += '</body></html>';
    w.document.write(html);
    w.document.close();
    w.print();
};

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

const printReport = (data, totalIncome, totalExpense, filters, users) => {
    const w = window.open('', '', 'width=800,height=600');
    const startStr = new Date(filters.start).toLocaleString();
    const endStr = new Date(filters.end).toLocaleString();
    
    let html = `
    <html>
    <head>
        <title>Финансовый отчет</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 5px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header { text-align: center; margin-bottom: 20px; }
            .summary { display: flex; justify-content: space-between; margin: 20px 0; border: 1px solid #000; padding: 10px; }
            .income { color: green; }
            .expense { color: red; }
            .balance { font-weight: bold; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h2>Финансовый отчет</h2>
            <p>${startStr} — ${endStr}</p>
        </div>
        
        <div class="summary">
            <div>Приход: <span class="income">+${totalIncome.toLocaleString()}</span></div>
            <div>Расход: <span class="expense">-${totalExpense.toLocaleString()}</span></div>
            <div class="balance">Итого: ${(totalIncome - totalExpense).toLocaleString()}</div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Дата</th>
                    <th>Тип</th>
                    <th>Сумма</th>
                    <th>Метод</th>
                    <th>Кассир</th>
                    <th>Описание</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    data.forEach(row => {
        const staffName = users.find(u => u.id === row.staffId || u.login === row.staffId)?.name || row.staffId;
        const typeLabel = row.type === 'income' ? 'Приход' : 'Расход';
        const typeClass = row.type === 'income' ? 'income' : 'expense';
        
        html += `
            <tr>
                <td>${new Date(row.date).toLocaleString()}</td>
                <td class="${typeClass}">${typeLabel}</td>
                <td>${parseInt(row.amount).toLocaleString()}</td>
                <td>${row.method}</td>
                <td>${staffName}</td>
                <td>${row.comment || '-'}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    </body>
    </html>
    `;
    
    w.document.write(html);
    w.document.close();
    w.print();
};

const getNormalizedCountry = (input) => {
    if (!input) return "Узбекистан";
    const clean = input.trim().replace(/['"]/g, '');
    const lower = clean.toLowerCase();
    if (COUNTRY_MAP[lower]) return COUNTRY_MAP[lower];
    const valid = COUNTRIES.find(c => c.toLowerCase() === lower);
    if (valid) return valid;
    return clean;
};

// --- UI COMPONENTS ---
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-300 p-5 ${className}`}>
    {children}
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = '', icon: Icon, disabled, type="button", title, size="md" }) => {
  const baseStyle = `rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm border ${size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5'}`;
  const variants = {
    primary: "bg-indigo-600 text-white border-transparent hover:bg-indigo-700 shadow-indigo-200",
    secondary: "bg-white text-slate-700 border-slate-300 hover:bg-slate-50",
    danger: "bg-rose-500 text-white border-transparent hover:bg-rose-600 shadow-rose-200", 
    success: "bg-emerald-600 text-white border-transparent hover:bg-emerald-700 shadow-emerald-200",
    ghost: "text-slate-500 border-transparent hover:bg-slate-100 shadow-none",
    warning: "bg-amber-500 text-white border-transparent hover:bg-amber-600 shadow-amber-200"
  };

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`} title={title}>
      {Icon && <Icon size={size === 'sm' ? 16 : 18} />}
      {children}
    </button>
  );
};

const NavItem = ({ icon: Icon, label, active, onClick, badge }) => (
    <button onClick={onClick} className={`whitespace-nowrap w-full flex flex-col md:flex-row items-center gap-1 md:gap-3 px-3 py-2.5 rounded-lg text-[10px] md:text-sm font-medium transition-all relative ${active ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>
        <Icon size={20} className={active ? 'text-indigo-600' : 'text-slate-400'} />
        <span>{label}</span>
        {badge > 0 && (
            <span className="absolute right-2 top-0 md:top-1/2 md:-translate-y-1/2 bg-rose-500 text-white text-[10px] font-bold rounded-full w-4 h-4 md:w-5 md:h-5 flex items-center justify-center">
                {badge > 9 ? '9+' : badge}
            </span>
        )}
    </button>
);

const Notification = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-12 right-4 z-[60] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-right-10 fade-in duration-300 ${type === 'error' ? 'bg-rose-500 text-white' : 'bg-slate-900 text-white'}`}>
      {type === 'error' ? <AlertCircle size={24}/> : <CheckCircle2 size={24} className="text-emerald-400"/>}
      <span className="font-bold">{message}</span>
    </div>
  );
};

const MobileNavigation = ({ currentUser, activeTab, setActiveTab, pendingTasksCount, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const tabs = [
       { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard, role: 'admin' },
       { id: 'rooms', label: t('rooms'), icon: BedDouble, role: 'all' },
       { id: 'calendar', label: t('calendar'), icon: CalendarIcon, role: 'all' },
       { id: 'tasks', label: t('tasks'), icon: Wrench, role: 'all', badge: pendingTasksCount },
       { id: 'shifts', label: t('shifts'), icon: Timer, role: 'all' },
    ];
    const roleCheck = (role) => {
        if (currentUser.role === 'super') return true; 
        if (role === 'all') return true;
        return role === currentUser.role;
    };
    
    const mobileTabs = tabs.filter(t => roleCheck(t.role)).slice(0, 5);

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe pt-2 px-2 flex justify-between items-center z-50 md:hidden h-16 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
            {mobileTabs.map(tab => (
                 <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex flex-col items-center justify-center py-1 relative ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`}>
                    <tab.icon size={20} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                    <span className="text-[9px] font-bold mt-1 truncate max-w-[60px]">{tab.label}</span>
                    {tab.badge > 0 && <span className="absolute top-0 right-1/4 w-2 h-2 bg-rose-500 rounded-full"></span>}
                 </button>
            ))}
            <button onClick={() => setActiveTab(currentUser.role === 'admin' ? 'staff' : 'debts')} className={`flex-1 flex flex-col items-center justify-center py-1 ${activeTab === 'more' ? 'text-indigo-600' : 'text-slate-400'}`}>
                <UserCog size={20}/>
                <span className="text-[9px] font-bold mt-1">Menu</span>
            </button>
        </div>
    )
}

const Navigation = ({ currentUser, activeTab, setActiveTab, onLogout, lang, setLang, pendingTasksCount, selectedHostelView, setSelectedHostelView }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    
    // ✅ НОВОЕ: Проверка роли viewer
    const isViewer = currentUser.role === 'viewer';
    
    const tabs = [
       { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard, role: 'admin' },
       { id: 'rooms', label: t('rooms'), icon: BedDouble, role: 'all' },
       { id: 'calendar', label: t('calendar'), icon: CalendarIcon, role: 'all' },
       { id: 'reports', label: t('reports'), icon: FileText, role: 'admin' },
       { id: 'debts', label: t('debts'), icon: Coins, role: 'all' },
       { id: 'shifts', label: t('shifts'), icon: Timer, role: 'all' },
       { id: 'tasks', label: t('tasks'), icon: Wrench, role: 'all', badge: pendingTasksCount },
       { id: 'expenses', label: t('expenses'), icon: Wallet, role: 'admin' },
       { id: 'clients', label: t('clients'), icon: Users, role: 'admin' },
       { id: 'staff', label: t('staff'), icon: UserCog, role: 'admin' },
    ];
    const roleCheck = (role) => {
        if (currentUser.role === 'super') return true; 
        if (role === 'all') return true;
        if (currentUser.role === 'viewer' && (role === 'admin' || role === 'viewer')) return true; // viewer can access admin tabs for viewing
        return role === currentUser.role;
    };

    return (
      <div className="w-56 bg-white h-screen border-r border-slate-200 flex flex-col p-4 fixed md:relative z-20 hidden md:flex">
           <div className="text-2xl font-bold text-indigo-600 mb-8 flex items-center gap-2 pl-2">
              <Building2/> Hostella
           </div>
           
           <div className="mb-4 flex bg-slate-100 rounded-lg p-1">
               <button onClick={() => setLang('ru')} className={`flex-1 py-1 text-xs font-bold rounded ${lang==='ru'?'bg-white shadow text-indigo-600':'text-slate-500'}`}>RU</button>
               <button onClick={() => setLang('uz')} className={`flex-1 py-1 text-xs font-bold rounded ${lang==='uz'?'bg-white shadow text-indigo-600':'text-slate-500'}`}>UZ</button>
           </div>
           
           {/* ✅ НОВОЕ: Переключатель хостелов для viewer */}
           {isViewer && setSelectedHostelView && (
               <div className="mb-4">
                   <label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-wide">Хостел</label>
                   <select 
                       className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium"
                       value={selectedHostelView}
                       onChange={e => setSelectedHostelView(e.target.value)}
                   >
                       <option value="hostel1">Хостел №1 (просмотр)</option>
                       <option value="hostel2">Хостел №2 (работа)</option>
                   </select>
               </div>
           )}

           <div className="space-y-1 flex-1 overflow-y-auto">
              {tabs.filter(t => roleCheck(t.role)).map(tab => (
                  <NavItem key={tab.id} icon={tab.icon} label={tab.label} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} badge={tab.badge} />
              ))}
           </div>
           <div className="border-t border-slate-100 pt-4 mt-auto">
              <div className="flex items-center gap-3 px-3 py-2 mb-2 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold uppercase shrink-0">{currentUser.name[0]}</div>
                  <div className="overflow-hidden">
                      <div className="font-bold text-sm truncate text-slate-700">{currentUser.name}</div>
                      <div className="text-[10px] text-slate-500 capitalize uppercase tracking-wider">{currentUser.role === 'super' ? 'Super Admin' : (currentUser.role === 'admin' ? t('admin') : (currentUser.role === 'viewer' ? 'Viewer' : t('cashier')))}</div>
                  </div>
              </div>
              <Button variant="ghost" className="w-full justify-start text-orange-600 hover:bg-orange-50 hover:text-orange-700" icon={LogOut} onClick={onLogout}>{t('logout')}</Button>
           </div>
      </div>
    );
};

const LoginScreen = ({ users, onLogin, onSeed, lang, setLang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [login, setLogin] = useState('');
    const [pass, setPass] = useState('');

    const handleAuth = (e) => {
        e.preventDefault();
        if (login === 'Super' && pass === 'super') {
            onLogin({ name: 'Super Admin', login: 'Super', role: 'super', hostelId: 'all' });
            return;
        }
        const u = users.find(u => u.login.toLowerCase() === login.toLowerCase() && u.pass === pass);
        if(u) {
            onLogin(u);
        }
        else alert(t('error'));
    };

    return (
        <div className="fixed inset-0 w-screen h-screen bg-slate-50 flex items-center justify-center z-[100] p-4">
            <div className="absolute top-4 right-4 flex gap-2">
                 <button onClick={()=>setLang('ru')} className={`px-3 py-1 rounded ${lang==='ru'?'bg-indigo-600 text-white':'bg-white'}`}>RU</button>
                 <button onClick={()=>setLang('uz')} className={`px-3 py-1 rounded ${lang==='uz'?'bg-indigo-600 text-white':'bg-white'}`}>UZ</button>
            </div>
            
            <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 flex flex-col items-center">
                <div className="bg-indigo-600 p-4 rounded-2xl mb-6 shadow-lg shadow-indigo-200">
                    <Building2 className="text-white" size={40}/>
                </div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Hostella</h1>
                <p className="text-slate-500 mb-8 text-center">Система управления хостелом</p>
                
                <form onSubmit={handleAuth} className="space-y-5 w-full">
                    <div>
                        <label className={labelClass}>{t('login')}</label>
                        <input className={inputClass} value={login} onChange={e=>setLogin(e.target.value)} placeholder="admin" autoFocus />
                    </div>
                    <div>
                        <label className={labelClass}>{t('pass')}</label>
                        <input type="password" className={inputClass} value={pass} onChange={e=>setPass(e.target.value)} placeholder="•••••••" />
                    </div>
                    <Button type="submit" className="w-full py-4 text-lg shadow-xl shadow-indigo-100 mt-4">{t('enter')}</Button>
                </form>
                
                <div className="mt-8 text-center pt-6 border-t border-slate-100 w-full">
                    <button onClick={onSeed} className="text-xs text-slate-400 hover:text-indigo-500 transition-colors">{t('initDb')}</button>
                </div>
            </div>
        </div>
    );
};

const DashboardStats = ({ rooms, guests, payments, lang, currentHostelId }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    
    const currentHostelInfo = HOSTELS[currentHostelId];

    // 1. Фильтруем комнаты строго по текущему хостелу
    const relevantRooms = currentHostelId === 'all' ? rooms : rooms.filter(r => r.hostelId === currentHostelId);
    
    // 2. Емкость (общее кол-во мест)
    const totalCapacity = relevantRooms.reduce((acc, r) => acc + parseInt(r.capacity), 0);
    const now = new Date();
    
    // 3. Активные гости (Загруженность)
    // ИСПРАВЛЕНИЕ: Считаем только тех, кто физически должен быть в номере СЕЙЧАС.
    // Если время выезда прошло (прошлые даты), мы их НЕ считаем, даже если статус 'active'.
    const activeGuests = guests.filter(g => {
        // Фильтр по хостелу
        if (currentHostelId !== 'all' && g.hostelId !== currentHostelId) return false;
        
        // Должен быть активен
        if (g.status !== 'active') return false;

        const rawCheckIn = g.checkInDate || g.checkInDateTime || g.checkIn;
        const rawCheckOut = g.checkOutDate;
        
        if (!rawCheckIn || !rawCheckOut) return false;

        const checkIn = new Date(rawCheckIn);
        const checkOut = new Date(rawCheckOut);

        // Нормализуем даты, если они без времени (ставим 12:00)
        if (typeof rawCheckIn === 'string' && !rawCheckIn.includes('T')) checkIn.setHours(12, 0, 0, 0);
        if (typeof rawCheckOut === 'string' && !rawCheckOut.includes('T')) checkOut.setHours(12, 0, 0, 0);

        // ГЛАВНОЕ УСЛОВИЕ: Текущее время должно быть внутри периода проживания
        // CheckIn <= NOW < CheckOut
        return now >= checkIn && now < checkOut;
    }).length;
    
    // 4. Выручка за сегодня
    // Функция для получения локальной даты YYYY-MM-DD (чтобы избежать проблем с UTC)
    const getLocalYMD = (dateInput) => {
        if (!dateInput) return '';
        const d = new Date(dateInput);
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().slice(0, 10);
    };
    
    const todayYMD = getLocalYMD(new Date());

    const revenueToday = payments 
        ? payments
            .filter(p => {
                // Фильтр по хостелу
                if (currentHostelId !== 'all' && p.hostelId !== currentHostelId) return false;
                
                // Сравниваем только дату (день)
                const paymentYMD = getLocalYMD(p.date);
                return paymentYMD === todayYMD;
            })
            .reduce((acc, p) => acc + (parseInt(p.amount) || 0), 0)
        : 0;
        
    const guestsTodayCount = guests.filter(g => {
        if (currentHostelId !== 'all' && g.hostelId !== currentHostelId) return false;
        const checkInYMD = getLocalYMD(g.checkInDate || g.checkIn);
        return checkInYMD === todayYMD && g.status === 'active';
    }).length;

    const occupancyPercent = totalCapacity ? Math.round((activeGuests/totalCapacity)*100) : 0;
    const freeBeds = Math.max(0, totalCapacity - activeGuests);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="flex flex-col justify-between h-32 relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Users size={64}/></div>
                <div><div className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('guests')}</div><div className="text-2xl font-bold text-slate-800 mt-1">{activeGuests}</div></div>
                <div className="text-xs text-slate-400 mt-auto">{t('today')}: +{guestsTodayCount}</div>
            </Card>
            <Card className="flex flex-col justify-between h-32 relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><BedDouble size={64}/></div>
                <div><div className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('occupancy')}</div><div className="text-2xl font-bold text-indigo-600 mt-1">{occupancyPercent}%</div></div>
                <div className="text-xs text-slate-400 mt-auto">Занято: {activeGuests} / Свободно: {freeBeds}</div>
            </Card>
            <Card className="flex flex-col justify-between h-32 relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Wallet size={64}/></div>
                <div><div className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('revenue')} ({t('today')})</div><div className="text-2xl font-bold text-emerald-600 mt-1">{revenueToday.toLocaleString()}</div></div>
                <div className="text-xs text-slate-400 mt-auto">Hostel: {currentHostelInfo?.name || currentHostelId}</div>
            </Card>
            <Card className="flex flex-col justify-between h-32 relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Building2 size={64}/></div>
                <div><div className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('rooms')}</div><div className="text-2xl font-bold text-slate-800 mt-1">{relevantRooms.length}</div></div>
                <div className="text-xs text-slate-400 mt-auto">{t('total')}</div>
            </Card>
        </div>
    );
};

const ChartsSection = ({ guests, rooms, payments = [], lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [period, setPeriod] = useState(7);
    const totalCapacity = rooms.reduce((acc, r) => acc + parseInt(r.capacity), 0);
    const now = new Date();

    const activeGuests = guests.filter(g => {
        if (g.status !== 'active') return false;
        
        // --- FIX START ---
        const rawCheckIn = g.checkInDate || g.checkInDateTime || g.checkIn;
        if (!rawCheckIn) return false;

        const checkIn = new Date(rawCheckIn);
        if(typeof rawCheckIn === 'string' && !rawCheckIn.includes('T')) {
             checkIn.setHours(12, 0, 0, 0);
        }

        const rawCheckOut = g.checkOutDate;
        if (!rawCheckOut) return false;

        const checkOut = new Date(rawCheckOut);
        if(typeof rawCheckOut === 'string' && !rawCheckOut.includes('T')) {
             checkOut.setHours(12, 0, 0, 0);
        }
        // --- FIX END ---

        return now >= checkIn && now < checkOut;
    }).length;

    const occupancyRate = (totalCapacity > 0) ? (activeGuests / totalCapacity) * 100 : 0;
    
    const chartDays = Array.from({length: period}, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (period - 1 - i));
        return { iso: d.toISOString().split('T')[0], label: d.toLocaleDateString('ru-RU', {day: '2-digit', month: '2-digit'}) };
    });
    
    const revenueData = chartDays.map(dObj => {
        const dayTotal = payments
            .filter(p => p.date && p.date.startsWith(dObj.iso))
            .reduce((sum, p) => sum + (parseInt(p.amount) || 0), 0);
        return { date: dObj.label, value: dayTotal };
    });
    const maxRev = Math.max(...revenueData.map(d => d.value), 100000); 
    const recentPayments = payments.filter(p => p.date >= chartDays[0].iso);
    const methods = { cash: 0, card: 0, qr: 0 };
    recentPayments.forEach(p => {
        if(p.method === 'cash') methods.cash += (parseInt(p.amount) || 0);
        if(p.method === 'card') methods.card += (parseInt(p.amount) || 0);
        if(p.method === 'qr') methods.qr += (parseInt(p.amount) || 0);
    });
    const totalPaymentVolume = methods.cash + methods.card + methods.qr || 1;
    const countriesCount = {};
    guests.filter(g => g.status === 'active').forEach(g => {
        const c = g.country || 'Unknown';
        countriesCount[c] = (countriesCount[c] || 0) + 1;
    });
    const topCountries = Object.entries(countriesCount).sort((a,b) => b[1] - a[1]).slice(0, 4);
    const maxGuestsCountry = topCountries.length > 0 ? topCountries[0][1] : 1;

    return (
        <>
            <Card className="flex flex-col items-center justify-center relative">
                <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase">{t('occupancy')}</h3>
                <div className="relative w-40 h-40">
                    <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                        <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3"/>
                        <path className="text-indigo-600" strokeDasharray={`${isNaN(occupancyRate) ? 0 : occupancyRate}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-indigo-900"><span className="text-3xl font-bold">{Math.round(occupancyRate)}%</span><span className="text-xs text-slate-400">{activeGuests}/{totalCapacity}</span></div>
                </div>
            </Card>

            <Card className="flex flex-col justify-end">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="text-sm font-bold text-slate-500 uppercase">{t('revenue')}</h3>
                     <div className="flex bg-slate-100 rounded-lg p-1">
                         <button onClick={() => setPeriod(7)} className={`px-2 py-0.5 text-xs rounded-md transition-all ${period === 7 ? 'bg-white shadow-sm font-bold' : 'text-slate-500'}`}>7</button>
                         <button onClick={() => setPeriod(14)} className={`px-2 py-0.5 text-xs rounded-md transition-all ${period === 14 ? 'bg-white shadow-sm font-bold' : 'text-slate-500'}`}>14</button>
                     </div>
                </div>
                <div className="flex justify-between items-end h-40 gap-1">
                    {revenueData.map((d, i) => (
                        <div key={i} className="flex flex-col items-center flex-1 group relative h-full justify-end">
                             <div className="w-full bg-emerald-100 rounded-t-sm hover:bg-emerald-200 transition-all relative" style={{ height: `${(d.value / maxRev) * 100}%`, minHeight: d.value > 0 ? '4px' : '0' }}>
                                <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-xs bg-slate-800 text-white p-1 rounded z-10 whitespace-nowrap">{d.value.toLocaleString()}</div>
                             </div>
                             <span className="text-[10px] text-slate-400 mt-2 whitespace-nowrap">{d.date}</span>
                        </div>
                    ))}
                </div>
            </Card>

            <Card className="flex flex-col">
                <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase">{t('payment')} ({period} d)</h3>
                <div className="flex-1 flex flex-col justify-center gap-4">
                     <div className="space-y-1">
                         <div className="flex justify-between text-xs text-slate-600"><span>{t('cash')}</span><span>{Math.round(methods.cash/totalPaymentVolume*100)}%</span></div>
                         <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{width: `${methods.cash/totalPaymentVolume*100}%`}}></div></div>
                     </div>
                     <div className="space-y-1">
                         <div className="flex justify-between text-xs text-slate-600"><span>{t('card')}</span><span>{Math.round(methods.card/totalPaymentVolume*100)}%</span></div>
                         <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{width: `${methods.card/totalPaymentVolume*100}%`}}></div></div>
                     </div>
                     <div className="space-y-1">
                         <div className="flex justify-between text-xs text-slate-600"><span>{t('qr')}</span><span>{Math.round(methods.qr/totalPaymentVolume*100)}%</span></div>
                         <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-amber-500" style={{width: `${methods.qr/totalPaymentVolume*100}%`}}></div></div>
                     </div>
                </div>
            </Card>

            <Card className="flex flex-col">
                <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase">Top Country</h3>
                <div className="space-y-3">
                    {topCountries.map(([country, count]) => (
                        <div key={country} className="flex items-center gap-2">
                             <div className="flex-1 text-xs text-slate-600 truncate">{country}</div>
                             <div className="flex-[2] h-2 bg-slate-100 rounded-full overflow-hidden">
                                 <div className="h-full bg-indigo-500" style={{width: `${(count/maxGuestsCountry)*100}%`}}></div>
                             </div>
                             <div className="text-xs font-bold text-slate-700">{count}</div>
                        </div>
                    ))}
                    {topCountries.length === 0 && <div className="text-xs text-slate-400 text-center mt-10">{t('noData')}</div>}
                </div>
            </Card>
        </>
    );
}

const CountdownTimer = ({ targetDate, lang }) => {
    const [timeLeft, setTimeLeft] = useState('');
    const t = (k) => TRANSLATIONS[lang][k];
    useEffect(() => {
        const calculate = () => {
            const now = new Date();
            const end = new Date(targetDate);
            const diff = end - now;
            if (diff <= 0) {
                setTimeLeft(t('timeOut'));
            } else {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                setTimeLeft(`${hours}h ${minutes}m`);
            }
        };
        calculate();
        const interval = setInterval(calculate, 60000);
        return () => clearInterval(interval);
    }, [targetDate, lang]);

    return (
        <div className="mt-1 flex items-center gap-1">
             <Clock size={12} className="text-rose-500 animate-pulse"/>
             <span className="text-[10px] font-bold text-rose-600">{t('checkoutWarn')}: {timeLeft}</span>
        </div>
    );
};

const RoomCardChess = ({ room, guests, isAdmin, onEdit, onClone, onDelete, onBedClick, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const beds = Array.from({length: room.capacity}, (_, i) => i + 1);
    const now = new Date();
    
    // Ghost Logic: Find recent checkouts (last 24-48 hours) for empty beds
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-all">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-bold text-lg text-slate-700 flex items-center gap-2">
                    <span className="bg-slate-200 px-3 py-1 rounded-md text-sm text-slate-700 font-bold border border-slate-200">{t('room')} №{room.number}</span>
                    <span className="text-xs font-normal text-slate-400">({room.capacity})</span>
                </h3>
                {isAdmin && (
                    <div className="flex gap-1">
                        <button onClick={onEdit} className="p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-all"><Edit size={16}/></button>
                        <button onClick={onClone} className="p-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded transition-all"><Copy size={16}/></button>
                        <button onClick={onDelete} className="p-2 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded transition-all"><Trash2 size={16}/></button>
                    </div>
                )}
            </div>
            <div className="p-4 grid grid-cols-2 gap-3 flex-1">
                {beds.map(bedId => {
                    const guest = guests.find(g => {
                        const isBedMatch = String(g.bedId) === String(bedId);
                        const isActiveOrBooking = (g.status === 'active' || g.status === 'booking');
                        if (!isBedMatch || !isActiveOrBooking) return false;
                        const checkIn = new Date(g.checkInDate || g.checkInDateTime || g.checkIn);
                        if (!g.checkInDate.includes('T')) checkIn.setHours(12, 0, 0, 0); 
                        const days = parseInt(g.days);
                        const checkOut = new Date(checkIn.getTime() + (days * 24 * 60 * 60 * 1000));
                        return now >= checkIn && now < checkOut;
                    });

                    // Ghost: If no active guest, find last occupant
                    let ghostGuest = null;
                    if (!guest) {
                        const recent = guests.filter(g => 
                            String(g.roomId) === String(room.id) && 
                            String(g.bedId) === String(bedId) &&
                            g.status === 'checked_out' &&
                            new Date(g.checkOutDate) > yesterday
                        ).sort((a,b) => new Date(b.checkOutDate) - new Date(a.checkOutDate));
                        if(recent.length > 0) ghostGuest = recent[0];
                    }

                    // Future: Bookings
                    let futureGuest = null;
                    if (!guest) {
                        const upcoming = guests.filter(g => {
                            if (String(g.roomId) !== String(room.id) || String(g.bedId) !== String(bedId)) return false;
                            if (g.status !== 'active' && g.status !== 'booking') return false;
                            const checkIn = new Date(g.checkInDate || g.checkInDateTime || g.checkIn);
                            if (!g.checkInDate.includes('T')) checkIn.setHours(12, 0, 0, 0);
                            return checkIn > now; 
                        }).sort((a,b) => new Date(a.checkInDate) - new Date(b.checkInDate));
                        if (upcoming.length > 0) futureGuest = upcoming[0];
                    }
                    
                    const isBooking = guest?.status === 'booking';
                    const paid = guest ? getTotalPaid(guest) : 0;
                    const debt = guest ? guest.totalPrice - paid : 0;
                    
                    let targetDateObj = null;
                    if (guest) {
                         const checkIn = new Date(guest.checkInDate || guest.checkInDateTime || guest.checkIn);
                         checkIn.setHours(12, 0, 0, 0);
                         targetDateObj = new Date(checkIn.getTime() + (parseInt(guest.days) * 24 * 60 * 60 * 1000));
                         targetDateObj.setHours(12, 0, 0, 0);
                    }
                    
                    const isExpired = targetDateObj && targetDateObj < new Date();

                    let bgClass = 'bg-white border-slate-100 hover:border-indigo-300 hover:shadow-sm';
                    let badgeClass = 'bg-slate-100 text-slate-400';
                    let textClass = 'text-slate-700';
                    let showTimer = false;

                    if (guest && !isBooking) {
                         if (isExpired) {
                             if (debt <= 0) {
                                 // Expired and paid -> Gray
                                 bgClass = 'bg-slate-200 border-slate-300';
                                 badgeClass = 'bg-slate-300 text-slate-500';
                                 textClass = 'text-slate-500';
                             } else {
                                 bgClass = 'bg-rose-50 border-rose-200';
                                 badgeClass = 'bg-white/50 text-rose-700';
                                 textClass = 'text-rose-900';
                             }
                         } else if (debt > 0) {
                             bgClass = 'bg-rose-50 border-rose-200';
                             badgeClass = 'bg-white/50 text-rose-700';
                             textClass = 'text-rose-900';
                         } else {
                             bgClass = 'bg-emerald-50 border-emerald-200';
                             badgeClass = 'bg-white/50 text-emerald-700';
                             textClass = 'text-emerald-900';
                         }
                         
                         const diffMs = targetDateObj - now;
                         const twelveHoursMs = 12 * 60 * 60 * 1000;
                         if (diffMs > 0 && diffMs < twelveHoursMs) showTimer = true;
                    } else if (isBooking) {
                        bgClass = 'bg-amber-50 border-amber-200';
                        badgeClass = 'bg-white/50 text-amber-600';
                        textClass = 'text-amber-900';
                    } else if (ghostGuest) {
                        // Ghost styling (Checked out recently)
                        bgClass = 'bg-slate-50 border-slate-200 opacity-70';
                        badgeClass = 'bg-slate-200 text-slate-400';
                        textClass = 'text-slate-400 italic';
                    }

                    return (
                        <div key={bedId} onClick={() => onBedClick(bedId, guest || ghostGuest, !!ghostGuest)}
                             className={`cursor-pointer rounded-xl p-3 border transition-all relative min-h-[90px] flex flex-col justify-between group overflow-hidden ${bgClass}`}>
                            
                            {/* HOVER OVERLAY FOR EXPIRED GUESTS OR GHOST GUESTS */}
                            {((guest && isExpired && debt <= 0) || ghostGuest) && (
                                <div className="absolute inset-0 bg-slate-800/90 z-10 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-2 gap-2">
                                    <span className="text-white text-[10px] font-bold text-center mb-1">
                                        {ghostGuest ? 'Checked Out' : 'Time Out'}
                                    </span>
                                    <div className="flex flex-col gap-1 w-full">
                                        {/* If active but expired, show extend. If ghost, show re-book */}
                                        {guest && (
                                            <button className="bg-emerald-500 text-white text-[10px] py-1.5 rounded font-bold hover:bg-emerald-600 w-full">
                                                {t('extend')}
                                            </button>
                                        )}
                                        {/* Action to checkin NEW guest on this spot */}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onBedClick(bedId, null, false); }} 
                                            className="bg-indigo-500 text-white text-[10px] py-1.5 rounded font-bold hover:bg-indigo-600 w-full flex items-center justify-center gap-1"
                                        >
                                            <Plus size={12}/> {t('checkinNew')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-between items-start">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${badgeClass}`}>
                                    {bedId} {bedId % 2 === 0 ? 'Up' : 'Dn'}
                                </span>
                                {guest && (isBooking ? <Clock size={14} className="text-amber-500"/> : <User size={14} className={isExpired && debt <=0 ? 'text-slate-400' : (debt > 0 ? 'text-rose-400' : 'text-emerald-400')}/>)}
                                {ghostGuest && <History size={14} className="text-slate-300"/>}
                            </div>
                            
                            {guest || ghostGuest ? (
                                <div className="mt-2 overflow-hidden">
                                    <div className={`font-bold text-sm leading-tight truncate ${textClass}`}>{(guest || ghostGuest).fullName}</div>
                                    <div className="flex justify-between items-end mt-1">
                                         <div className="text-[10px] opacity-70">
                                            {isBooking ? t('booking') : `${(guest || ghostGuest).days} ${t('days')}`} 
                                         </div>
                                         {!isBooking && debt > 0 && <div className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1 rounded">-{debt.toLocaleString()}</div>}
                                    </div>
                                    {showTimer && targetDateObj && <CountdownTimer targetDate={targetDateObj} lang={lang} />}
                                    {isExpired && debt <= 0 && <div className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wide">Time Out</div>}
                                </div>
                            ) : (
                                <div className="mt-auto text-center">
                                    {futureGuest ? (
                                        <div className="text-left">
                                            <div className="text-[10px] text-slate-400 font-medium uppercase">{t('freeFor')} {Math.max(0, Math.ceil((new Date(futureGuest.checkInDate) - now)/(1000*60*60*24)))} {t('days')}</div>
                                            <div className="text-xs font-bold text-slate-500 truncate flex items-center gap-1"><Clock size={10}/> {futureGuest.fullName}</div>
                                        </div>
                                    ) : (
                                        <Plus className="mx-auto text-slate-200 group-hover:text-indigo-400 transition-colors" size={20}/>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

const CalendarView = ({ rooms, guests, onSlotClick, lang, currentUser, onDeleteGuest }) => {
    // ... (весь код до getBlockColorClass без изменений) ...
    const t = (k) => TRANSLATIONS[lang][k]; 
    const [collapsedRooms, setCollapsedRooms] = useState({});
    const [startDate, setStartDate] = useState(new Date());

    const shiftDate = (days) => {
        const newDate = new Date(startDate);
        newDate.setDate(newDate.getDate() + days);
        setStartDate(newDate);
    };

    const calendarDaysCount = 14;
    const days = Array.from({length: calendarDaysCount}, (_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        return { 
            date: d, 
            str: getLocalDateString(d), 
            day: d.getDate(), 
            month: d.getMonth() + 1,
            week: d.toLocaleDateString('ru-RU', {weekday: 'short'}) 
        };
    });

    const toggleRoom = (roomId) => {
        setCollapsedRooms(prev => ({...prev, [roomId]: !prev[roomId]}));
    };
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const relevantGuests = guests.filter(g => {
        if (g.status === 'checked_out') {
            const end = new Date(g.checkOutDate);
            return end > sevenDaysAgo;
        }
        return true;
    });

    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';
    
    // --- ВАЖНО: Эта функция обн��влена для серого цвета ---
    const getBlockColorClass = (guest) => {
        // Если бронь - желтый
        if (guest.status === 'booking') return 'bg-amber-400 border-amber-500';
        
        // Если выселен - серый
        if (guest.status === 'checked_out') return 'bg-slate-400 border-slate-500';

        // ПРОВЕРКА НА ИСТЕЧЕНИЕ ВРЕМЕНИ (АВТОМАТИЧЕСКИЙ СЕРЫЙ)
        // Если текущее время больше времени выезда, красим в серый (Expired),
        // даже если статус все еще 'active'.
        const now = new Date();
        const checkOut = new Date(guest.checkOutDate);
        // Нормализация checkOut если нужно (обычно checkOutDate уже содержит правильное время)
        if (typeof guest.checkOutDate === 'string' && !guest.checkOutDate.includes('T')) {
             checkOut.setHours(12, 0, 0, 0);
        }
        
        if (now > checkOut) {
            // Серый, но немного другой оттенок или стиль, чтобы понимать что это "просрочка"
            return 'bg-slate-400 border-slate-500 opacity-90'; 
        }
        
        // Логика долгов (только если время не вышло)
        const totalPrice = guest.totalPrice || 0;
        const totalPaid = getTotalPaid(guest);
        const debt = totalPrice - totalPaid;

        if (debt <= 0) return 'bg-emerald-500 border-emerald-600';
        return 'bg-rose-500 border-rose-600';
    };

    // ... (остальной код функции getGuestBlockStyle и return без изменений) ...

    const getGuestBlockStyle = (guest) => {
        // Parse Check-In
        let checkInDate = new Date(guest.checkInDate || guest.checkInDateTime || guest.checkIn);
        // Normalize visual start to 12:00 PM of the check-in day
        checkInDate.setHours(12, 0, 0, 0);

        const calendarStart = new Date(days[0].str);
        calendarStart.setHours(0,0,0,0);
        
        // For checked_out guests, use the actual checkout date instead of extending
        let checkOutDate;
        if (guest.status === 'checked_out' && guest.checkOutDate) {
            checkOutDate = new Date(guest.checkOutDate);
            checkOutDate.setHours(12, 0, 0, 0);
        } else {
            const guestDurationMs = parseInt(guest.days) * 24 * 60 * 60 * 1000;
            checkOutDate = new Date(checkInDate.getTime() + guestDurationMs);
            checkOutDate.setHours(12, 0, 0, 0);
        }

        const calendarEnd = new Date(days[days.length-1].str);
        calendarEnd.setHours(23,59,59,999);

        if (checkOutDate < calendarStart || checkInDate > calendarEnd) return null;

        const msPerDay = 1000 * 60 * 60 * 24;
        const totalCalendarMs = msPerDay * calendarDaysCount;
        
        let startTimeDiff = checkInDate.getTime() - calendarStart.getTime();
        let durationMs = checkOutDate.getTime() - checkInDate.getTime();

        if (startTimeDiff < 0) {
            durationMs += startTimeDiff; 
            startTimeDiff = 0; 
        }

        const leftPercent = (startTimeDiff / totalCalendarMs) * 100;
        const widthPercent = (durationMs / totalCalendarMs) * 100;
        const maxRemaining = 100 - leftPercent;
        const finalWidth = Math.min(widthPercent, maxRemaining);

        return { leftPercent, widthPercent: finalWidth };
    };
    
    const handleEmptyCellClick = (room, bedId, dateStr, isRightHalf) => {
        const clickDate = new Date(dateStr);
        if (isRightHalf) {
            clickDate.setHours(12, 0, 0, 0); 
        } else {
            clickDate.setDate(clickDate.getDate() - 1);
            clickDate.setHours(12, 0, 0, 0);
        }
        onSlotClick(room, bedId, null, clickDate.toISOString());
    };

    const handleDeleteGuest = (e, guestId) => {
        e.stopPropagation();
        if (confirm(t('confirmDelete'))) {
            onDeleteGuest(guestId);
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shadow-sm">
                <div className="flex gap-2">
                    <button onClick={() => shiftDate(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronLeft size={20}/></button>
                    <button onClick={() => { const d = new Date(); d.setHours(0,0,0,0); setStartDate(d); }} className="px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold hover:bg-indigo-100">{t('today')}</button>
                    <button onClick={() => shiftDate(7)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><ChevronRight size={20}/></button>
                </div>
                <div className="text-sm font-bold text-slate-700 bg-slate-50 px-3 py-1 rounded-md border border-slate-200">
                    {days[0].date.toLocaleDateString()} — {days[days.length - 1].date.toLocaleDateString()}
                </div>
            </div>

            <div className="flex-1 overflow-auto relative">
                <div className="min-w-[1600px]">
                    <div className="flex sticky top-0 bg-white z-40 border-b border-slate-200 shadow-sm h-12">
                        <div className="w-40 p-3 font-bold text-xs text-slate-500 bg-slate-50 border-r border-slate-200 sticky left-0 z-50">
                            {t('room')} / {t('bed')}
                        </div>
                        {days.map(d => (
                            <div key={d.str} className={`flex-1 min-w-[80px] flex flex-col items-start justify-center px-2 border-r border-slate-100 ${['сб','вс'].includes(d.week) ? 'bg-rose-50' : ''}`}>
                                <div className="text-[10px] text-slate-400 uppercase font-bold">{d.week}</div>
                                <div className="text-sm font-bold text-slate-800">{d.day}.{d.month}</div>
                            </div>
                        ))}
                    </div>

                    {rooms.map(room => {
                        const isCollapsed = collapsedRooms[room.id];
                        const roomLabel = lang === 'uz' ? `Xona №${room.number}` : `Комната №${room.number}`;
                        
                        return (
                            <div key={room.id} className="border-b border-slate-200">
                                <div 
                                    className="flex items-center justify-between px-3 py-2 bg-slate-100 hover:bg-slate-200 cursor-pointer font-bold text-slate-700 text-sm sticky left-0 z-30 border-r border-slate-200 w-40 border-b border-slate-200"
                                    onClick={() => toggleRoom(room.id)}
                                >
                                    <span>{roomLabel}</span>
                                    {isCollapsed ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}
                                </div>

                                {!isCollapsed && Array.from({length: room.capacity}, (_, i) => i + 1).map(bedId => {
                                    const bedGuests = relevantGuests.filter(g => g.roomId === room.id && String(g.bedId) === String(bedId));
                                    
                                    return (
                                        <div key={bedId} className="flex h-16 border-b border-slate-50 last:border-b-0 relative">
                                            <div className="w-40 px-4 flex items-center justify-between border-r border-slate-200 bg-white sticky left-0 z-30 text-xs font-bold text-slate-500">
                                                <span>{t('bed')} {bedId}</span>
                                                <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-400">{bedId % 2 === 0 ? 'Up' : 'Dn'}</span>
                                            </div>

                                            <div className="flex-1 relative">
                                                <div className="absolute inset-0 flex">
                                                    {days.map(d => (
                                                        <div key={d.str} className={`flex-1 min-w-[80px] border-r border-slate-100 h-full flex ${['сб','вс'].includes(d.week) ? 'bg-rose-50' : ''}`}>
                                                            <div className="w-1/2 h-full cursor-pointer hover:bg-indigo-50 border-r border-slate-200/30" onClick={() => handleEmptyCellClick(room, bedId, d.str, false)}/>
                                                            <div className="w-1/2 h-full cursor-pointer hover:bg-indigo-50" onClick={() => handleEmptyCellClick(room, bedId, d.str, true)}/>
                                                        </div>
                                                    ))}
                                                </div>

                                                {bedGuests.map(guest => {
                                                    const styleData = getGuestBlockStyle(guest);
                                                    if (!styleData) return null;
                                                    
                                                    const bgClass = getBlockColorClass(guest);
                                                    const debt = (guest.totalPrice || 0) - getTotalPaid(guest);
                                                    const hasDebt = debt > 0;
                                                    const isCheckedOut = guest.status === 'checked_out';
                                                    const isBooking = guest.status === 'booking';
                                                    
                                                    // ✅ НОВОЕ: расчёт процента оплаты для градиента
                                                    const totalPaid = getTotalPaid(guest);
                                                    const totalPrice = guest.totalPrice || 1;
                                                    const paidPercent = Math.min(100, (totalPaid / totalPrice) * 100);

                                                    return (
                                                        <div 
                                                            key={guest.id}
                                                            className={`absolute top-1 bottom-1 z-20 rounded-md shadow-sm cursor-pointer hover:z-50 hover:shadow-lg border group/block overflow-hidden flex items-center`}
                                                            style={{
                                                                left: `${styleData.leftPercent}%`,
                                                                width: `${styleData.widthPercent}%`,
                                                                background: isCheckedOut 
                                                                    ? '#94a3b8' 
                                                                    : isBooking
                                                                    ? '#fbbf24'
                                                                    : `linear-gradient(to right, #10b981 0%, #10b981 ${paidPercent}%, #ef4444 ${paidPercent}%, #ef4444 100%)`
                                                            }}
                                                            onClick={(e) => { e.stopPropagation(); onSlotClick(room, bedId, guest, null); }}
                                                            title={guest.fullName}
                                                        >
                                                            <div className="sticky left-0 pl-1 pr-1 flex flex-col justify-center h-full w-full max-w-full z-50">
                                                                <span className="font-bold text-[10px] text-white whitespace-nowrap overflow-hidden text-ellipsis px-1.5 py-0.5 rounded-sm bg-black/40 w-fit block relative">
                                                                    {guest.status === 'booking' && '🕰 '}{guest.fullName}
                                                                </span>
                                                                
                                                                {!isCheckedOut && hasDebt && (
                                                                    <span className="text-[9px] font-bold mt-0.5 px-1.5 py-px rounded w-fit bg-white text-rose-600 shadow-sm border border-rose-200 relative">
                                                                        -{debt.toLocaleString()}
                                                                    </span>
                                                                )}
                                                                {!isCheckedOut && !hasDebt && (
                                                                    <span className="text-[9px] font-bold mt-0.5 px-1 py-px rounded w-fit bg-white/90 text-emerald-700 shadow-sm relative">
                                                                        ✓ OK
                                                                    </span>
                                                                )}
                                                                {isCheckedOut && (
                                                                     <span className="text-[9px] text-white/90 italic ml-1">OUT</span>
                                                                )}
                                                            </div>

                                                            {isCheckedOut && isAdmin && (
                                                                <button 
                                                                    onClick={(e) => handleDeleteGuest(e, guest.id)}
                                                                    className="absolute right-1 top-1 p-1 bg-white hover:bg-rose-500 hover:text-white rounded-full text-slate-700 shadow-md hidden group-hover/block:block z-50"
                                                                    title={t('delete')}
                                                                >
                                                                    <X size={10} strokeWidth={3}/>
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const StaffView = ({ users, onAdd, onDelete, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [form, setForm] = useState({ name: '', login: '', pass: '', role: 'cashier', hostelId: 'hostel1' });
    const visibleUsers = users.filter(u => u.login !== 'Super');
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
                 <h3 className="font-bold text-lg">{t('staff')}</h3>
                 <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                     <table className="w-full text-sm text-left">
                         <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                             <tr>
                                 <th className="p-4">{t('guestName')}</th>
                                 <th className="p-4">{t('login')}</th>
                                 <th className="p-4">{t('role')}</th>
                                 <th className="p-4">Hostel</th>
                                 <th className="p-4">{t('action')}</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-100">
                             {visibleUsers.map(u => (
                                 <tr key={u.id || u.login}>
                                     <td className="p-4 font-medium">{u.name}</td>
                                     <td className="p-4 text-slate-500 font-mono">{u.login}</td>
                                     <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{u.role === 'admin' ? t('admin') : t('cashier')}</span></td>
                                     <td className="p-4 text-slate-500">{u.hostelId}</td>
                                     <td className="p-4"><button onClick={() => onDelete(u.id)} className="text-rose-500 hover:bg-rose-50 p-2 rounded"><Trash2 size={16}/></button></td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-min">
                 <h3 className="font-bold text-lg mb-4">Add</h3>
                 <div className="space-y-3">
                     <input className={inputClass} placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                     <input className={inputClass} placeholder="Login" value={form.login} onChange={e => setForm({...form, login: e.target.value})} />
                     <input className={inputClass} placeholder="Pass" value={form.pass} onChange={e => setForm({...form, pass: e.target.value})} />
                     <select className={inputClass} value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                         <option value="cashier">{t('cashier')}</option>
                         <option value="admin">{t('admin')}</option>
                     </select>
                     <Button onClick={() => onAdd(form)} className="w-full">{t('save')}</Button>
                 </div>
            </div>
        </div>
    )
}

const ClientImportModal = ({ onClose, onImport, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [fileData, setFileData] = useState([]);
    const [rawText, setRawText] = useState("");

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target.result;
            setRawText(text);
            const rows = text.split("\n").map(r => r.split(","));
            
            const parsed = rows.filter(r => r.length >= 2).map(r => {
                const rawCountry = r[3]?.replace(/['"]/g, '').trim() || "";
                return {
                    fullName: r[0]?.replace(/['"]/g, '').trim()?.toUpperCase(),
                    passport: r[1]?.replace(/['"]/g, '').trim()?.toUpperCase(),
                    birthDate: r[2]?.replace(/['"]/g, '').trim(),
                    country: getNormalizedCountry(rawCountry)
                };
            }).filter(p => p.fullName && p.passport); 
            
            setFileData(parsed);
        };
        reader.readAsText(file);
    };

    const confirmImport = () => {
        onImport(fileData);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-xl flex flex-col max-h-[90vh]">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Upload size={20}/> {t('import')}</h3>
                <div className="mb-4">
                    <p className="text-sm text-slate-500 mb-2">CSV Format: Name,Passport,BirthDate,Country</p>
                    <input type="file" accept=".csv" onChange={handleFileUpload} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                </div>
                
                {fileData.length > 0 && (
                    <div className="flex-1 overflow-auto border border-slate-200 rounded-lg mb-4">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                    <th className="p-2">Name</th>
                                    <th className="p-2">Passport</th>
                                    <th className="p-2">Country</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {fileData.map((d, i) => (
                                    <tr key={i}>
                                        <td className="p-2">{d.fullName}</td>
                                        <td className="p-2">{d.passport}</td>
                                        <td className="p-2">{d.country}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="flex gap-2">
                    <Button onClick={confirmImport} disabled={fileData.length === 0} className="flex-1">{t('save')} ({fileData.length})</Button>
                    <Button variant="secondary" onClick={onClose} className="flex-1">{t('cancel')}</Button>
                </div>
            </div>
        </div>
    );
};

const ClientsView = ({ clients, onUpdateClient, onImportClients, onDeduplicate, onBulkDelete, onNormalizeCountries, lang, currentUser }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [search, setSearch] = useState('');
    const [editingClient, setEditingClient] = useState(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [pagination, setPagination] = useState({ page: 1, perPage: 25 });
    const [countryFilter, setCountryFilter] = useState('');
    
    const isAdmin = currentUser && (currentUser.role === 'admin' || currentUser.role === 'super');

    const filtered = useMemo(() => {
        let result = clients;
        
        // Search filter - require at least 2 characters to avoid performance issues with large datasets
        if (search.length > 1) {
            result = result.filter(c => 
                (c.fullName || '').toLowerCase().includes(search.toLowerCase()) || 
                (c.passport || '').toLowerCase().includes(search.toLowerCase())
            );
        }
        
        // Country filter
        if (countryFilter) {
            result = result.filter(c => c.country === countryFilter);
        }
        
        return result;
    }, [clients, search, countryFilter]);

    const paginatedData = useMemo(() => {
        const start = (pagination.page - 1) * pagination.perPage;
        const end = start + pagination.perPage;
        return filtered.slice(start, end);
    }, [filtered, pagination]);

    const totalPages = Math.ceil(filtered.length / pagination.perPage);
    
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(new Set(paginatedData.map(c => c.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelect = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleBulkDelete = () => {
        if (confirm(`${t('deleteSelected')} (${selectedIds.size})?`)) {
            onBulkDelete(Array.from(selectedIds));
            setSelectedIds(new Set());
        }
    };

    const handleNormalize = () => {
        if (confirm("Normalize all countries?")) {
            onNormalizeCountries();
        }
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPagination(prev => ({ ...prev, page: newPage }));
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                    <input className={`${inputClass} pl-10`} placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select 
                    className={inputClass} 
                    value={countryFilter} 
                    onChange={e => { setCountryFilter(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                    style={{ minWidth: '200px' }}
                >
                    <option value="">Все страны</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select 
                    className={inputClass} 
                    value={pagination.perPage} 
                    onChange={e => setPagination({ page: 1, perPage: parseInt(e.target.value) })}
                    style={{ minWidth: '120px' }}
                >
                    <option value="25">25 записей</option>
                    <option value="50">50 записей</option>
                    <option value="100">100 записей</option>
                </select>
                <div className="flex gap-2 flex-wrap">
                     {isAdmin && (
                         <>
                             <Button icon={Merge} variant="secondary" onClick={onDeduplicate} title="Merge duplicates">{t('deduplicate')}</Button>
                             <Button icon={Globe} variant="secondary" onClick={handleNormalize} title="Fix country names">{t('normalizeCountries')}</Button>
                             <Button icon={FileSpreadsheet} variant="secondary" onClick={() => setIsImportModalOpen(true)}>Import CSV</Button>
                             {selectedIds.size > 0 && <Button icon={Trash2} variant="danger" onClick={handleBulkDelete}>{t('deleteSelected')}</Button>}
                         </>
                     )}
                </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
                 <table className="w-full text-sm text-left min-w-[600px]">
                     <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                         <tr>
                             {isAdmin && (
                                 <th className="p-4 w-10">
                                     <input type="checkbox" onChange={handleSelectAll} checked={selectedIds.size > 0 && selectedIds.size === paginatedData.length} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"/>
                                 </th>
                             )}
                             <th className="p-4">{t('guestName')}</th>
                             <th className="p-4">{t('passport')}</th>
                             <th className="p-4">{t('birthDate')}</th>
                             <th className="p-4">{t('country')}</th>
                             <th className="p-4">Visits</th>
                             <th className="p-4">Last Visit</th>
                             <th className="p-4">{t('action')}</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                         {paginatedData.map(c => (
                             <tr key={c.id} className={selectedIds.has(c.id) ? 'bg-indigo-50' : ''}>
                                 {isAdmin && (
                                     <td className="p-4">
                                         <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => handleSelect(c.id)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"/>
                                     </td>
                                 )}
                                 <td className="p-4 font-bold">{c.fullName}</td>
                                 <td className="p-4 font-mono text-indigo-600">{c.passport}</td>
                                 <td className="p-4">{c.birthDate || '-'}</td>
                                 <td className="p-4">{c.country}</td>
                                 <td className="p-4">{c.visits}</td>
                                 <td className="p-4 text-slate-500">{new Date(c.lastVisit).toLocaleDateString()}</td>
                                 <td className="p-4">
                                     <button onClick={() => setEditingClient(c)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded"><Edit size={16}/></button>
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
            </div>
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="text-sm text-slate-600">
                    Показано {((pagination.page - 1) * pagination.perPage) + 1} - {Math.min(pagination.page * pagination.perPage, filtered.length)} из {filtered.length}
                </div>
                <div className="flex gap-2">
                    <Button 
                        variant="secondary" 
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page === 1}
                        icon={ChevronLeft}
                        size="sm"
                    />
                    <span className="px-4 py-2 text-sm font-bold text-slate-700">
                        {pagination.page} / {totalPages || 1}
                    </span>
                    <Button 
                        variant="secondary" 
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page >= totalPages}
                        icon={ChevronRight}
                        size="sm"
                    />
                </div>
            </div>
            
            {editingClient && (
                <ClientEditModal 
                    client={editingClient} 
                    onClose={() => setEditingClient(null)} 
                    onSave={(updatedData) => { onUpdateClient(editingClient.id, updatedData); setEditingClient(null); }} 
                    lang={lang}
                />
            )}
            {isImportModalOpen && (
                <ClientImportModal 
                    onClose={() => setIsImportModalOpen(false)}
                    onImport={(data) => { onImportClients(data); setIsImportModalOpen(false); }}
                    lang={lang}
                />
            )}
        </div>
    )
}

const ClientEditModal = ({ client, onClose, onSave, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [form, setForm] = useState({ ...client });
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
                <h3 className="font-bold text-lg mb-4">{t('edit')}</h3>
                <div className="space-y-3">
                    <div><label className={labelClass}>{t('guestName')}</label><input className={inputClass} value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value.toUpperCase()})} /></div>
                    <div><label className={labelClass}>{t('passport')}</label><input className={inputClass} value={form.passport} onChange={e => setForm({...form, passport: e.target.value.toUpperCase()})} /></div>
                    <div><label className={labelClass}>{t('birthDate')}</label><input type="date" className={inputClass} value={form.birthDate} onChange={e => setForm({...form, birthDate: e.target.value})} /></div>
                    <div><label className={labelClass}>{t('country')}</label><select className={inputClass} value={form.country} onChange={e => setForm({...form, country: e.target.value})}>{COUNTRIES.map(c => <option key={c}>{c}</option>)}</select></div>
                    <Button onClick={() => onSave(form)}>{t('save')}</Button>
                    <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
                </div>
            </div>
        </div>
    );
};

const TaskManager = ({ tasks, users, currentUser, onAddTask, onCompleteTask, onUpdateTask, onDeleteTask, lang, selectedHostelFilter }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    
    const availableCashiers = useMemo(() => {
        const targetHostel = currentUser.role === 'admin' || currentUser.role === 'super' ? selectedHostelFilter : currentUser.hostelId;
        return users.filter(u => 
            u.role === 'cashier' && (u.hostelId === targetHostel || u.hostelId === 'all')
        );
    }, [users, selectedHostelFilter, currentUser]);
    
    const [newTask, setNewTask] = useState({ 
        description: '', 
        roomNumber: '', 
        priority: 'medium', 
        hostelId: currentUser.role === 'admin' || currentUser.role === 'super' ? 'hostel1' : currentUser.hostelId,
        assignedTo: ''
    });
    const [editingTask, setEditingTask] = useState(null);
    const filteredTasks = tasks.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';
    
    const getPriorityLabel = (p) => {
        if(p === 'low' || p === 'Низкий') return t('low');
        if(p === 'medium' || p === 'Средний') return t('medium');
        if(p === 'high' || p === 'Высокий') return t('high');
        return p;
    }
    
    const handleSubmit = () => {
        if (!newTask.description) return;
        onAddTask({
            ...newTask,
            status: 'pending',
            createdBy: currentUser.name,
            createdAt: new Date().toISOString(),
            hostelId: isAdmin ? newTask.hostelId : currentUser.hostelId
        });
        setNewTask({ 
            description: '', 
            roomNumber: '', 
            priority: 'medium', 
            hostelId: isAdmin ? 'hostel1' : currentUser.hostelId,
            assignedTo: ''
        });
    };
    
    const handleUpdate = () => {
        if(!editingTask) return;
        onUpdateTask(editingTask.id, { 
            description: editingTask.description, 
            roomNumber: editingTask.roomNumber, 
            priority: editingTask.priority,
            assignedTo: editingTask.assignedTo
        });
        setEditingTask(null);
    }
    
    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-bold text-lg mb-4">{t('addTask')}</h3>
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full"><label className={labelClass}>{t('description')}</label><input className={inputClass} value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} placeholder="..." /></div>
                    <div className="w-full md:w-32"><label className={labelClass}>{t('room')}</label><input className={inputClass} value={newTask.roomNumber} onChange={e => setNewTask({...newTask, roomNumber: e.target.value})} placeholder="№" /></div>
                    <div className="w-full md:w-40"><label className={labelClass}>{t('priority')}</label><select className={inputClass} value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})}><option value="low">{t('low')}</option><option value="medium">{t('medium')}</option><option value="high">{t('high')}</option></select></div>
                    {isAdmin && (
                        <div className="w-full md:w-48">
                            <label className={labelClass}>{t('assignTo')}</label>
                            <select 
                                className={inputClass} 
                                value={newTask.assignedTo} 
                                onChange={e => setNewTask({...newTask, assignedTo: e.target.value})}
                            >
                                <option value="">{t('allCashiers')}</option>
                                {availableCashiers.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <Button onClick={handleSubmit} icon={Plus}>{t('save')}</Button>
                </div>
            </div>
            {editingTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl">
                        <h3 className="font-bold text-lg mb-4">{t('edit')}</h3>
                        <div className="space-y-3">
                            <input className={inputClass} value={editingTask.description} onChange={e => setEditingTask({...editingTask, description: e.target.value})} />
                            <div className="flex gap-2">
                                <input className={inputClass} value={editingTask.roomNumber} onChange={e => setEditingTask({...editingTask, roomNumber: e.target.value})} placeholder="Room" />
                                <select className={inputClass} value={editingTask.priority} onChange={e => setEditingTask({...editingTask, priority: e.target.value})}><option value="low">{t('low')}</option><option value="medium">{t('medium')}</option><option value="high">{t('high')}</option></select>
                            </div>
                            {isAdmin && (
                                <div>
                                    <label className={labelClass}>{t('assignTo')}</label>
                                    <select 
                                        className={inputClass} 
                                        value={editingTask.assignedTo || ''} 
                                        onChange={e => setEditingTask({...editingTask, assignedTo: e.target.value})}
                                    >
                                        <option value="">{t('allCashiers')}</option>
                                        {availableCashiers.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <Button onClick={handleUpdate} className="w-full">{t('save')}</Button>
                            <Button variant="secondary" onClick={() => setEditingTask(null)} className="w-full">{t('cancel')}</Button>
                        </div>
                    </div>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTasks.map(task => {
                    const assignedUser = task.assignedTo ? users.find(u => u.id === task.assignedTo) : null;
                    return (
                        <div key={task.id} className={`p-4 rounded-xl border flex flex-col justify-between ${task.status === 'done' ? 'bg-slate-50 border-slate-200 opacity-70' : 'bg-white border-indigo-100 shadow-sm'}`}>
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${task.priority === 'high' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>{getPriorityLabel(task.priority)}</span>
                                    {task.roomNumber && <span className="text-xs font-bold text-slate-600">{t('room')} {task.roomNumber}</span>}
                                </div>
                                <p className={`font-medium ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.description}</p>
                                <div className="text-[10px] text-slate-400 mt-2">
                                    {t('createdBy')}: {task.createdBy} • {new Date(task.createdAt).toLocaleDateString()}
                                    {assignedUser && <div className="mt-1 text-indigo-600">→ {assignedUser.name}</div>}
                                </div>
                            </div>
                            <div className="flex justify-between items-center mt-4">
                                {task.status !== 'done' ? (
                                    <Button size="sm" variant="success" onClick={() => onCompleteTask(task.id)} icon={Check}>{t('done')}</Button>
                                ) : <span></span>}
                                {isAdmin && (
                                    <div className="flex gap-1">
                                        <button onClick={() => setEditingTask(task)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Edit size={16}/></button>
                                        <button onClick={() => onDeleteTask(task.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"><Trash2 size={16}/></button>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    )
};

const CreateDebtModal = ({ clients, onClose, onCreate, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [search, setSearch] = useState('');
    const [selectedClient, setSelectedClient] = useState(null);
    const [amount, setAmount] = useState('');
    
    const filteredClients = clients.filter(c => 
        (c.fullName.toLowerCase().includes(search.toLowerCase()) || 
        c.passport.toLowerCase().includes(search.toLowerCase()))
    ).slice(0, 5);

    const handleSubmit = () => {
        if (!selectedClient || !amount) return;
        onCreate(selectedClient, parseInt(amount));
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
                <h3 className="font-bold text-lg mb-4">{t('createDebt')}</h3>
                <div className="space-y-4">
                    <div className="relative">
                        <label className={labelClass}>Search Client</label>
                        <input className={inputClass} value={search} onChange={e => {setSearch(e.target.value); setSelectedClient(null);}} placeholder="Name or Passport" />
                        {search.length > 1 && !selectedClient && (
                            <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 z-50 max-h-40 overflow-y-auto">
                                {filteredClients.map(c => (
                                    <div key={c.id} onClick={() => {setSelectedClient(c); setSearch(c.fullName);}} className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0">
                                        <div className="font-bold text-sm">{c.fullName}</div>
                                        <div className="text-xs text-slate-500">{c.passport}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {selectedClient && (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm">
                            Selected: <b>{selectedClient.fullName}</b> ({selectedClient.passport})
                        </div>
                    )}
                    <div>
                        <label className={labelClass}>Debt Amount</label>
                        <input type="number" className={inputClass} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
                    </div>
                    <Button onClick={handleSubmit} disabled={!selectedClient || !amount} className="w-full">{t('save')}</Button>
                    <Button variant="secondary" onClick={onClose} className="w-full">{t('cancel')}</Button>
                </div>
            </div>
        </div>
    );
};

const DebtsView = ({ guests, users, lang, onPayDebt, currentUser, onAdminAdjustDebt, clients, onCreateDebt }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [staffFilter, setStaffFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const aggregatedDebts = useMemo(() => {
        const debtMap = {};
        guests.forEach(g => {
            if (g.status === 'booking') return;
            const totalPaid = getTotalPaid(g);
            const debt = g.totalPrice - totalPaid;
            if (debt > 0) {
                const dateMatch = startDate ? g.checkInDate >= startDate : true;
                const staffMatch = staffFilter ? (g.staffId === staffFilter || users.find(u=>u.id === staffFilter)?.login === g.staffId) : true;
                if (dateMatch && staffMatch) {
                    const key = g.passport || g.fullName; 
                    if (!debtMap[key]) {
                        debtMap[key] = {
                            ...g,
                            totalDebt: 0,
                            records: []
                        };
                    }
                    debtMap[key].totalDebt += debt;
                    debtMap[key].records.push(g);
                }
            }
        });
        return Object.values(debtMap);
    }, [guests, startDate, staffFilter, users]);
    const totalDebt = aggregatedDebts.reduce((sum, item) => sum + item.totalDebt, 0);
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';
    const [selectedDebtor, setSelectedDebtor] = useState(null);
    const [payCash, setPayCash] = useState('');
    const [payCard, setPayCard] = useState('');
    const [payQR, setPayQR] = useState('');
    const [adminAdjustAmount, setAdminAdjustAmount] = useState('');
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [isAdminAdjustModalOpen, setIsAdminAdjustModalOpen] = useState(false);
    const [magnetActiveField, setMagnetActiveField] = useState(null);
    const [isCreateDebtModalOpen, setIsCreateDebtModalOpen] = useState(false);

    const handlePayClick = (debtor) => { 
        setSelectedDebtor(debtor); 
        setIsPayModalOpen(true); 
        setPayCash(''); 
        setPayCard(''); 
        setPayQR(''); 
        setMagnetActiveField(null);
    };
    const handleAdminAdjustClick = (debtor) => { setSelectedDebtor(debtor); setIsAdminAdjustModalOpen(true); setAdminAdjustAmount(''); }
    
    const submitPayment = () => {
        if (!selectedDebtor) return;
        const cash = parseInt(payCash) || 0;
        const card = parseInt(payCard) || 0;
        const qr = parseInt(payQR) || 0;
        const amount = cash + card + qr;
        
        if (amount <= 0) return;
        
        const targets = selectedDebtor.records.map(r => ({
            id: r.id, 
            currentDebt: r.totalPrice - getTotalPaid(r)
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

    const disableWheel = (e) => { e.currentTarget.blur(); };

    return (
        <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full"><label className={labelClass}>{t('staff')}</label><select className={inputClass} value={staffFilter} onChange={e => setStaffFilter(e.target.value)}><option value="">All</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                <div className="w-full md:w-auto"><label className={labelClass}>{t('date')}</label><input type="date" className={inputClass} value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                <div className="px-6 py-2 bg-rose-50 border border-rose-200 rounded-xl text-center w-full md:w-auto min-w-[200px]"><div className="text-xs font-bold text-rose-500 uppercase">{t('total')} {t('debt')}</div><div className="text-2xl font-bold text-rose-700">{totalDebt.toLocaleString()}</div></div>
                <div className="flex gap-2">
                    <Button icon={Plus} onClick={() => setIsCreateDebtModalOpen(true)}>{t('createDebt')}</Button>
                    <Button variant="secondary" icon={Printer} onClick={() => printDebts(aggregatedDebts, totalDebt)}>{t('print')}</Button>
                </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm text-left min-w-[600px]">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                        <tr>
                            <th className="p-4">{t('guestName')}</th>
                            <th className="p-4">{t('passport')}</th>
                            <th className="p-4">{t('staff')}</th>
                            <th className="p-4 text-right">{t('debt')}</th>
                            <th className="p-4 text-right">{t('action')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {aggregatedDebts.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50">
                                <td className="p-4 font-bold">{item.fullName}</td>
                                <td className="p-4 font-mono">{item.passport}</td>
                                <td className="p-4">{users.find(u => u.id === item.staffId || u.login === item.staffId)?.name || item.staffId}</td>
                                <td className="p-4 text-right font-bold text-rose-600">{item.totalDebt.toLocaleString()}</td>
                                <td className="p-4 text-right flex justify-end gap-2">
                                    <Button size="sm" onClick={() => handlePayClick(item)}>{t('payDebt')}</Button>
                                    {isAdmin && (
                                        <Button size="sm" variant="secondary" onClick={() => handleAdminAdjustClick(item)}>{t('addDebt')}</Button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {aggregatedDebts.length === 0 && <div className="p-8 text-center text-slate-400">{t('noData')}</div>}
            </div>
            {isPayModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-xl">
                        <h3 className="font-bold text-lg mb-4">{t('payDebt')}</h3>
                        <p className="mb-4 text-sm">{selectedDebtor?.fullName} (Total: {selectedDebtor?.totalDebt.toLocaleString()})</p>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">{t('cash')}</label>
                                <div className="flex items-center">
                                    <input 
                                        type="number" 
                                        className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-l focus:ring-1 focus:ring-indigo-500 outline-none text-sm no-spinner" 
                                        value={payCash} 
                                        onChange={e => {setPayCash(e.target.value); setMagnetActiveField(null);}} 
                                        placeholder="0"
                                        onWheel={disableWheel}
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => applyMagnet('payCash')} 
                                        disabled={magnetActiveField && magnetActiveField !== 'payCash'} 
                                        className="bg-white border border-l-0 border-slate-300 rounded-r px-2 py-2 text-indigo-600 disabled:opacity-40"
                                    >
                                        <Magnet size={16}/>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">{t('card')}</label>
                                <div className="flex items-center">
                                    <input 
                                        type="number" 
                                        className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-l focus:ring-1 focus:ring-indigo-500 outline-none text-sm no-spinner" 
                                        value={payCard} 
                                        onChange={e => {setPayCard(e.target.value); setMagnetActiveField(null);}} 
                                        placeholder="0"
                                        onWheel={disableWheel}
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => applyMagnet('payCard')} 
                                        disabled={magnetActiveField && magnetActiveField !== 'payCard'} 
                                        className="bg-white border border-l-0 border-slate-300 rounded-r px-2 py-2 text-indigo-600 disabled:opacity-40"
                                    >
                                        <Magnet size={16}/>
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">{t('qr')}</label>
                                <div className="flex items-center">
                                    <input 
                                        type="number" 
                                        className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-l focus:ring-1 focus:ring-indigo-500 outline-none text-sm no-spinner" 
                                        value={payQR} 
                                        onChange={e => {setPayQR(e.target.value); setMagnetActiveField(null);}} 
                                        placeholder="0"
                                        onWheel={disableWheel}
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => applyMagnet('payQR')} 
                                        disabled={magnetActiveField && magnetActiveField !== 'payQR'} 
                                        className="bg-white border border-l-0 border-slate-300 rounded-r px-2 py-2 text-indigo-600 disabled:opacity-40"
                                    >
                                        <Magnet size={16}/>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <Button className="flex-1" onClick={submitPayment}>{t('save')}</Button>
                            <Button variant="secondary" className="flex-1" onClick={() => setIsPayModalOpen(false)}>{t('cancel')}</Button>
                        </div>
                    </div>
                </div>
            )}
            {isAdminAdjustModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-xl">
                        <h3 className="font-bold text-lg mb-4">{t('addDebt')} (Admin)</h3>
                        <p className="mb-4 text-sm text-slate-500">Enter +/- amount to adjust total price.</p>
                        <input className={inputClass} type="number" value={adminAdjustAmount} onChange={e => setAdminAdjustAmount(e.target.value)} placeholder="+/- Amount" />
                        <div className="flex gap-2 mt-4">
                            <Button className="flex-1" onClick={submitAdminAdjust}>{t('save')}</Button>
                            <Button variant="secondary" className="flex-1" onClick={() => setIsAdminAdjustModalOpen(false)}>{t('cancel')}</Button>
                        </div>
                    </div>
                </div>
            )}
            {isCreateDebtModalOpen && <CreateDebtModal clients={clients} onClose={() => setIsCreateDebtModalOpen(false)} onCreate={onCreateDebt} lang={lang} />}
            <style>{`
                .no-spinner::-webkit-outer-spin-button, .no-spinner::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
                .no-spinner { -moz-appearance: textfield; }
            `}</style>
        </div>
    );
};

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
        hostelId: currentUser.role === 'admin' && currentUser.hostelId !== 'all' ? currentUser.hostelId : '' 
    });
    const [filters, setFilters] = useState({
        start: getLocalDatetimeString(new Date(new Date().setHours(0,0,0,0))),
        end: getLocalDatetimeString(new Date(new Date().setHours(23,59,59,999))),
        staffId: '',
        method: '',
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

    const filteredData = allTransactions.filter(t => {
        const tTime = new Date(t.date).getTime();
        const startTime = filters.start ? new Date(filters.start).getTime() : 0;
        const endTime = filters.end ? new Date(filters.end).getTime() : Infinity;
        const matchesDate = tTime >= startTime && tTime <= endTime;
        const matchesStaff = filters.staffId ? (t.staffId === filters.staffId || (users.find(u=>u.id===filters.staffId)?.login === t.staffId)) : true;
        const matchesMethod = filters.method ? t.method === filters.method : true;
        const matchesHostel = filters.hostelId ? t.hostelId === filters.hostelId : true;
        
        if (parseInt(t.amount) === 0) return false;
        
        return matchesDate && matchesStaff && matchesMethod && matchesHostel;
    });

    const availableCashiers = useMemo(() => {
        if (!tempFilters.hostelId) return users; 
        return users.filter(u => u.hostelId === tempFilters.hostelId || u.hostelId === 'all');
    }, [users, tempFilters.hostelId]);

    const totalIncome = filteredData.filter(t => t.type === 'income').reduce((sum, t) => sum + (parseInt(t.amount)||0), 0);
    const totalExpense = filteredData.filter(t => t.type === 'expense').reduce((sum, t) => sum + (parseInt(t.amount)||0), 0);

    const handleExport = () => {
        const exportData = filteredData.map(item => ({
            date: new Date(item.date).toLocaleString(),
            type: item.type,
            staff: users.find(u => u.id === item.staffId || u.login === item.staffId)?.name || item.staffId,
            hostel: HOSTEL_LIST.find(h => h.id === item.hostelId)?.name || item.hostelId || '-',
            amount: item.amount,
            method: item.method || '-',
            comment: item.comment || (item.guestId ? guests.find(g => g.id === item.guestId)?.fullName : '-')
        }));
        exportToExcel(exportData, `Otchet_${filters.hostelId || 'All'}.xls`, totalIncome, totalExpense);
    };

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end mb-4">
                    <div><label className={labelClass}>From</label><input type="datetime-local" className={inputClass} value={tempFilters.start} onChange={e => setTempFilters({...tempFilters, start: e.target.value})} /></div>
                    <div><label className={labelClass}>To</label><input type="datetime-local" className={inputClass} value={tempFilters.end} onChange={e => setTempFilters({...tempFilters, end: e.target.value})} /></div>
                    
                    <div>
                        <label className={labelClass}>{t('staff')}</label>
                        <select className={inputClass} value={tempFilters.staffId} onChange={e => setTempFilters({...tempFilters, staffId: e.target.value})}>
                            <option value="">All</option>
                            {availableCashiers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className={labelClass}>Payment Method</label>
                        <select className={inputClass} value={tempFilters.method} onChange={e => setTempFilters({...tempFilters, method: e.target.value})}>
                            <option value="">All</option>
                            <option value="cash">{t('cash')}</option>
                            <option value="card">{t('card')}</option>
                            <option value="qr">{t('qr')}</option>
                        </select>
                    </div>
                </div>
                
                <div className="flex gap-2 justify-end border-t border-slate-100 pt-4">
                    <Button onClick={handleApplyFilters} icon={Check} className="flex-1 md:flex-none">{t('save')}</Button>
                    <Button icon={Printer} variant="secondary" onClick={() => printReport(filteredData, totalIncome, totalExpense, filters, users)} className="flex-1 md:flex-none">{t('printReport')}</Button>
                    <Button icon={Download} variant="secondary" onClick={handleExport} className="flex-1 md:flex-none">Export (XLS)</Button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center"><div className="text-sm text-emerald-600 font-bold uppercase">{t('income')}</div><div className="text-2xl font-bold text-emerald-800">+{totalIncome.toLocaleString()}</div></div>
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-center"><div className="text-sm text-rose-600 font-bold uppercase">{t('expense')}</div><div className="text-2xl font-bold text-rose-800">-{totalExpense.toLocaleString()}</div></div>
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center"><div className="text-sm text-slate-600 font-bold uppercase">{t('balance')}</div><div className="text-2xl font-bold text-slate-800">{(totalIncome - totalExpense).toLocaleString()}</div></div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm text-left min-w-[700px]">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                        <tr>
                            <th className="p-4">{t('date')}</th>
                            <th className="p-4">Hostel</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">{t('amount')}</th>
                            <th className="p-4">Method</th>
                            <th className="p-4">{t('staff')}</th>
                            <th className="p-4">Details</th>
                            {currentUser.role === 'super' && <th className="p-4">{t('action')}</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredData.map((t, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="p-4 text-slate-500">{new Date(t.date).toLocaleString()}</td>
                                <td className="p-4 font-bold text-slate-600">{HOSTEL_LIST.find(h=>h.id === t.hostelId)?.name || 'N/A'}</td>
                                <td className="p-4">{t.type === 'income' ? <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">IN</span> : <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-bold">OUT</span>}</td>
                                <td className={`p-4 font-bold ${t.type==='income'?'text-emerald-700':'text-rose-700'}`}>{parseInt(t.amount).toLocaleString()}</td>
                                <td className="p-4 uppercase text-xs font-bold text-slate-500">{t.method}</td>
                                <td className="p-4">{users.find(u => u.id === t.staffId || u.login === t.staffId)?.name || 'N/A'}</td>
                                <td className="p-4 text-slate-600 truncate max-w-[200px]">{t.comment || (t.guestId ? guests.find(g => g.id === t.guestId)?.fullName : '-')}</td>
                                {currentUser.role === 'super' && (
                                    <td className="p-4">
                                        <button onClick={() => onDeletePayment(t.id, t.type)} className="text-rose-500 hover:bg-rose-50 p-2 rounded" title="Delete"><Trash2 size={16}/></button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredData.length === 0 && <div className="p-8 text-center text-slate-400">{t('noData')}</div>}
            </div>
        </div>
    );
};

const FillButton = ({ onClick, disabled }) => (
    <button type="button" onClick={onClick} disabled={disabled} className="ml-1 px-2 py-1 rounded bg-slate-100 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed">
        <Magnet size={16} />
    </button>
);
// ... (Вставьте это продолжение сразу после компонента FillButton)

const ShiftsView = ({ shifts, users, currentUser, onStartShift, onEndShift, onTransferShift, lang, hostelId, onAdminAddShift, onAdminUpdateShift }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';

    // Для Кассира:
    const myActiveShift = shifts.find(s => s.staffId === currentUser.id && !s.endTime);
    const allCashiers = users.filter(u => u.role === 'cashier' && u.id !== currentUser.id);
    const [transferTarget, setTransferTarget] = useState('');

    // Для Админа:
    const [dateRange, setDateRange] = useState({ 
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], 
        end: new Date().toISOString().split('T')[0] 
    });
    const [filterCashierId, setFilterCashierId] = useState(''); // Фильтр по кассиру
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingShift, setEditingShift] = useState(null);
    const [shiftForm, setShiftForm] = useState({ staffId: '', startTime: '', endTime: '', hostelId: 'hostel1' });

    // Фильтрация смен
    const displayedShifts = useMemo(() => {
        let list = shifts;
        
        // 1. Ограничение для кассира
        if (!isAdmin) {
            list = list.filter(s => s.staffId === currentUser.id);
        } else {
            // 2. Фильтр по дате для админа
            const start = new Date(dateRange.start); start.setHours(0,0,0,0);
            const end = new Date(dateRange.end); end.setHours(23,59,59,999);
            list = list.filter(s => {
                const sDate = new Date(s.startTime);
                return sDate >= start && sDate <= end;
            });

            // 3. Фильтр по кассиру (Добавлено)
            if (filterCashierId) {
                list = list.filter(s => s.staffId === filterCashierId);
            }
        }
        return list.sort((a,b) => new Date(b.startTime) - new Date(a.startTime));
    }, [shifts, isAdmin, currentUser.id, dateRange, filterCashierId]);

    // Подсчет общей зарплаты
    const totalSalary = useMemo(() => {
        return displayedShifts.reduce((sum, s) => {
            if (!s.endTime) return sum;
            return sum + calculateSalary(s.startTime, s.endTime);
        }, 0);
    }, [displayedShifts]);

    const handleExportExcel = () => {
        // ... (код экспорта Excel без изменений, только использовать displayedShifts) ...
        const dataForExport = displayedShifts.map(s => {
            const staff = users.find(u => u.id === s.staffId)?.name || 'Unknown';
            const start = new Date(s.startTime);
            const end = s.endTime ? new Date(s.endTime) : null;
            const duration = end ? ((end - start) / (1000 * 60 * 60)).toFixed(1) : 'Active';
            const salary = end ? calculateSalary(s.startTime, s.endTime) : 0;
            return {
                staff,
                hostel: HOSTELS[s.hostelId]?.name || s.hostelId,
                date: start.toLocaleDateString(),
                start: start.toLocaleTimeString(),
                end: end ? end.toLocaleTimeString() : 'Active',
                hours: duration,
                salary: salary
            };
        });
        
        let table = `
            <html>
            <head><meta charset="UTF-8"></head>
            <body>
            <h2 style="text-align:center">Табель смен (${dateRange.start} - ${dateRange.end})</h2>
            <table border="1" style="border-collapse: collapse; width: 100%;">
                <thead style="background-color: #4f46e5; color: white;">
                    <tr>
                        <th style="padding:10px">Сотрудник</th>
                        <th style="padding:10px">Хостел</th>
                        <th style="padding:10px">Дата</th>
                        <th style="padding:10px">Начало</th>
                        <th style="padding:10px">Конец</th>
                        <th style="padding:10px">Часы</th>
                        <th style="padding:10px">Зарплата</th>
                    </tr>
                </thead>
                <tbody>
        `;
        dataForExport.forEach(row => {
            table += `
                <tr>
                    <td style="padding:5px">${row.staff}</td>
                    <td style="padding:5px">${row.hostel}</td>
                    <td style="padding:5px">${row.date}</td>
                    <td style="padding:5px">${row.start}</td>
                    <td style="padding:5px">${row.end}</td>
                    <td style="text-align:center">${row.hours}</td>
                    <td style="text-align:right;">${row.salary.toLocaleString()}</td>
                </tr>
            `;
        });
        table += `
            <tr style="background-color: #f3f4f6; font-weight: bold;">
                <td colspan="6" style="padding:10px; text-align:right;">ИТОГО:</td>
                <td style="padding:10px; text-align:right;">${totalSalary.toLocaleString()}</td>
            </tr>
        </tbody></table></body></html>`;
        
        const blob = new Blob([table], { type: 'application/vnd.ms-excel' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Shifts_Report.xls`;
        link.click();
    };

    const handleSaveShift = () => {
        const payload = {
            ...shiftForm,
            startTime: new Date(shiftForm.startTime).toISOString(),
            endTime: shiftForm.endTime ? new Date(shiftForm.endTime).toISOString() : null
        };
        if (editingShift) { onAdminUpdateShift(editingShift.id, payload); } else { onAdminAddShift(payload); }
        setIsAddModalOpen(false); setEditingShift(null);
    };

    const openEdit = (s) => {
        setEditingShift(s);
        setShiftForm({
            staffId: s.staffId,
            hostelId: s.hostelId || 'hostel1',
            startTime: getLocalDatetimeString(new Date(s.startTime)),
            endTime: s.endTime ? getLocalDatetimeString(new Date(s.endTime)) : ''
        });
        setIsAddModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Timer className="text-indigo-600"/> {t('shifts')}
                        </h2>
                    </div>
                    
                    {!isAdmin && (
                        <div className="flex gap-2">
                            {!myActiveShift && <Button icon={Power} onClick={onStartShift}>{t('startShift')}</Button>}
                            {myActiveShift && (
                                <div className="flex gap-2 items-center bg-slate-100 p-1 rounded-xl">
                                    <select className="bg-white border-0 rounded-lg text-sm py-2 px-3 focus:ring-0" value={transferTarget} onChange={e => setTransferTarget(e.target.value)}>
                                        <option value="">Передать кому...</option>
                                        {allCashiers.map(u => <option key={u.id} value={u.id}>{u.name} ({HOSTELS[u.hostelId]?.name})</option>)}
                                    </select>
                                    <Button size="sm" variant="secondary" onClick={() => onTransferShift(myActiveShift.id, transferTarget)} disabled={!transferTarget}>{t('transferShift')}</Button>
                                    <div className="w-px h-6 bg-slate-300 mx-1"></div>
                                    <Button size="sm" variant="danger" onClick={onEndShift}>{t('endShift')}</Button>
                                </div>
                            )}
                        </div>
                    )}

                    {isAdmin && (
                        <div className="flex flex-wrap gap-2 items-center">
                            {/* Фильтр по дате */}
                            <input type="date" className="border rounded-lg px-2 py-2 text-sm" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
                            <span>-</span>
                            <input type="date" className="border rounded-lg px-2 py-2 text-sm" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
                            
                            {/* Фильтр по кассиру (НОВОЕ) */}
                            <select className="border rounded-lg px-2 py-2 text-sm max-w-[150px]" value={filterCashierId} onChange={e => setFilterCashierId(e.target.value)}>
                                <option value="">Все кассиры</option>
                                {users.filter(u => u.role !== 'super').map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>

                            <Button icon={Plus} onClick={() => { setEditingShift(null); setShiftForm({ staffId: users[0]?.id, startTime: '', endTime: '', hostelId: 'hostel1' }); setIsAddModalOpen(true); }}>Добавить</Button>
                            <Button icon={FileSpreadsheet} variant="secondary" onClick={handleExportExcel}>Excel</Button>
                        </div>
                    )}
                </div>

                <div className="overflow-hidden border rounded-xl">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                            <tr>
                                <th className="p-4">{t('staff')}</th>
                                <th className="p-4">Хостел</th>
                                <th className="p-4">Начало</th>
                                <th className="p-4">Конец</th>
                                <th className="p-4">{t('workedHours')}</th>
                                <th className="p-4 text-right">{t('salaryCalc')}</th>
                                {isAdmin && <th className="p-4 text-right">Edit</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {displayedShifts.map(s => {
                                const staff = users.find(u => u.id === s.staffId)?.name || 'Unknown';
                                const hours = s.endTime ? ((new Date(s.endTime) - new Date(s.startTime)) / (1000 * 60 * 60)).toFixed(1) : '-';
                                const salary = s.endTime ? calculateSalary(s.startTime, s.endTime).toLocaleString() : '...';
                                
                                return (
                                    <tr key={s.id} className={!s.endTime ? "bg-emerald-50" : "hover:bg-slate-50"}>
                                        <td className="p-4 font-bold">{staff}</td>
                                        <td className="p-4 text-xs text-slate-500">{HOSTELS[s.hostelId]?.name}</td>
                                        <td className="p-4">{new Date(s.startTime).toLocaleString()}</td>
                                        <td className="p-4">{s.endTime ? new Date(s.endTime).toLocaleString() : <span className="text-emerald-600 font-bold">В работе...</span>}</td>
                                        <td className="p-4 font-mono">{hours}</td>
                                        <td className="p-4 text-right font-bold text-indigo-600">{salary}</td>
                                        {isAdmin && (
                                            <td className="p-4 text-right">
                                                <button onClick={() => openEdit(s)} className="text-blue-500 hover:bg-blue-50 p-1 rounded"><Edit size={16}/></button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                            {/* Строка ИТОГО */}
                            {isAdmin && (
                                <tr className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                                    <td colSpan="5" className="p-4 text-right uppercase text-slate-600">Итого за период:</td>
                                    <td className="p-4 text-right text-emerald-700 text-lg">{totalSalary.toLocaleString()}</td>
                                    <td className="p-4"></td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
                        <h3 className="font-bold text-lg mb-4">{editingShift ? 'Редактировать смену' : 'Добавить смену'}</h3>
                        <div className="space-y-3">
                            <div><label className={labelClass}>Сотрудник</label><select className={inputClass} value={shiftForm.staffId} onChange={e => setShiftForm({...shiftForm, staffId: e.target.value})}>{users.filter(u => u.role !== 'super').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
                            <div><label className={labelClass}>Хостел</label><select className={inputClass} value={shiftForm.hostelId} onChange={e => setShiftForm({...shiftForm, hostelId: e.target.value})}>{Object.keys(HOSTELS).map(k => <option key={k} value={k}>{HOSTELS[k].name}</option>)}</select></div>
                            <div><label className={labelClass}>Начало</label><input type="datetime-local" className={inputClass} value={shiftForm.startTime} onChange={e => setShiftForm({...shiftForm, startTime: e.target.value})} /></div>
                            <div><label className={labelClass}>Конец</label><input type="datetime-local" className={inputClass} value={shiftForm.endTime} onChange={e => setShiftForm({...shiftForm, endTime: e.target.value})} /></div>
                            <Button onClick={handleSaveShift} className="w-full mt-4">Сохранить</Button>
                            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)} className="w-full">Отмена</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const CheckInModal = ({ initialRoom, preSelectedBedId, initialDate, allRooms, guests, clients, onClose, onSubmit, notify, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [selectedRoomId, setSelectedRoomId] = useState(initialRoom?.id || allRooms[0]?.id || '');
    const room = allRooms.find(r => r.id === selectedRoomId);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    const [isScanning, setIsScanning] = useState(false);
    
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const yesterdayStr = getLocalDateString(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    
    // Logic: If current time is < 12:00, default date is YESTERDAY
    const defaultDate = now.getHours() < 12 ? yesterdayStr : todayStr;

    const [form, setForm] = useState({
        fullName: '', birthDate: '', passport: '', country: 'Узбекистан',
        bedId: String(preSelectedBedId || '1'),
        checkInDate: initialDate || defaultDate, 
        days: 1, 
        pricePerNight: 0,
        payCash: '', payCard: '', payQR: ''
    });

    const [magnetActiveField, setMagnetActiveField] = useState(null);

    useEffect(() => {
        if (room) {
            const isUpper = parseInt(form.bedId) % 2 === 0;
            const price = isUpper ? (room.prices?.upper || 0) : (room.prices?.lower || 0);
            setForm(prev => ({ ...prev, pricePerNight: price }));
        }
    }, [room, form.bedId]);

    const handleNameChange = (e) => {
        const val = e.target.value.toUpperCase();
        setForm(prev => ({ ...prev, fullName: val }));
        setSearchTerm(val);
        setShowSuggestions(true);
    };

    const selectClient = (client) => {
        setForm(prev => ({ ...prev, fullName: client.fullName, passport: client.passport, birthDate: client.birthDate, country: client.country }));
        setShowSuggestions(false);
    };
    
    const handlePassportScan = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsScanning(true);

        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            
            reader.onload = async () => {
                const base64String = reader.result.toString();
                const base64Image = base64String.split(',')[1];

                if (!base64Image) {
                    notify("Error processing image file", 'error');
                    setIsScanning(false);
                    return;
                }

                try {
                    const scanPassportFn = httpsCallable(functions, 'scanPassport');
                    
                    const response = await scanPassportFn({ image: base64Image });
                    const { success, data, error } = response.data;

                    if (success) {
                        setForm(prev => ({
                            ...prev,
                            fullName: data.fullName || prev.fullName,
                            passport: data.passport || prev.passport,
                            birthDate: data.birthDate || prev.birthDate,
                            country: data.country || prev.country
                        }));
                        notify("Passport Scanned Successfully!", 'success');
                    } else {
                        throw new Error(error || "Unknown server error");
                    }
                } catch (apiErr) {
                    console.error("Cloud Function Error:", apiErr);
                    notify("Scan failed: " + (apiErr.message || "Server Error"), 'error');
                } finally {
                    setIsScanning(false);
                }
            };
            
            reader.onerror = () => {
                notify("File Read Error", 'error');
                setIsScanning(false);
            };

        } catch (err) {
            console.error(err);
            notify("System Error", 'error');
            setIsScanning(false);
        }
    };

    const suggestions = searchTerm.length > 1 ? clients.filter(c => c.fullName.includes(searchTerm) || c.passport.includes(searchTerm)).slice(0, 5) : [];
    const totalPrice = (parseInt(form.pricePerNight) || 0) * (parseInt(form.days) || 1);
    const totalPaid = (parseInt(form.payCash)||0) + (parseInt(form.payCard)||0) + (parseInt(form.payQR)||0);
    const debt = totalPrice - totalPaid;

    const applyMagnet = (field) => {
        const currentCash = field === 'payCash' ? 0 : (parseInt(form.payCash) || 0);
        const currentCard = field === 'payCard' ? 0 : (parseInt(form.payCard) || 0);
        const currentQR = field === 'payQR' ? 0 : (parseInt(form.payQR) || 0);
        const currentTotal = currentCash + currentCard + currentQR;
        const remaining = Math.max(0, totalPrice - currentTotal);

        setForm(prev => ({ ...prev, [field]: String(remaining) }));
        setMagnetActiveField(field);
    };

    const handleAction = (e, isBooking = false) => {
        if(e) e.preventDefault();
        try {
            if (!room) return notify(t('error'), 'error');
            if (!form.fullName.trim()) return notify("Fill Name!", 'error');

            const selectedDate = new Date(form.checkInDate);
            selectedDate.setHours(12, 0, 0, 0);
            
            const stay = getStayDetails(selectedDate.toISOString(), form.days);
            
            const conflicts = guests.filter(g => {
                if(g.roomId !== room.id || String(g.bedId) !== String(form.bedId)) return false;
                if(g.status !== 'active' && g.status !== 'booking') return false;
                return checkCollision(g.checkInDate || g.checkInDateTime || g.checkIn, g.days, selectedDate.toISOString(), form.days);
            });

            if (conflicts.length > 0) return notify(`Occupied! (${conflicts[0].fullName})`, 'error');

            const finalCash = isBooking ? 0 : (parseInt(form.payCash) || 0);
            const finalCard = isBooking ? 0 : (parseInt(form.payCard) || 0);
            const finalQR = isBooking ? 0 : (parseInt(form.payQR) || 0);
            const finalTotalPaid = isBooking ? 0 : totalPaid;

            onSubmit({
                ...form,
                checkInDate: stay.start.toISOString(), 
                checkOutDate: stay.end.toISOString(), 
                roomId: room.id, 
                roomNumber: room.number, 
                hostelId: room.hostelId,
                bedId: String(form.bedId), 
                paidCash: finalCash, 
                paidCard: finalCard, 
                paidQR: finalQR,
                amountPaid: finalTotalPaid, 
                totalPrice,
                status: isBooking ? 'booking' : 'active'
            });
        } catch (err) {
            console.error(err);
        }
    };
    const disableWheel = (e) => { e.currentTarget.blur(); };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20">
              <div><h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">{t('checkin')} {room && <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-sm rounded-full font-bold">Room {room.number}</span>}</h3><p className="text-slate-500 text-sm mt-1">New Guest</p></div>
              <button onClick={onClose} type="button" className="p-2 hover:bg-slate-100 rounded-full transition-colors"><XCircle className="text-slate-400 hover:text-slate-600" size={32}/></button>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8">
              <form onSubmit={(e)=>handleAction(e, false)} className="flex flex-col gap-6">
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full relative flex flex-col">
                        {isScanning && (
                            <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl animate-in fade-in">
                                <Loader2 className="animate-spin text-indigo-600 mb-4" size={50} />
                                <span className="font-bold text-slate-800 text-lg">AI распознавание...</span>
                                <span className="text-slate-500 text-sm mt-1">Пожалуйста, подождите</span>
                            </div>
                        )}

                        <div className="flex items-center gap-2 mb-4">
                            <User className="text-indigo-600" size={24}/>
                            <h4 className="font-bold text-slate-800 text-lg">{t('guestName')}</h4>
                        </div>

                        <div className="mb-6">
                            <label className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-indigo-300 rounded-xl cursor-pointer bg-indigo-50 hover:bg-indigo-100 transition-all group overflow-hidden">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <div className="bg-white p-3 rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform">
                                        <ScanLine className="text-indigo-600" size={24} />
                                    </div>
                                    <p className="mb-1 text-sm font-bold text-indigo-700">Снять фото / Загрузить</p>
                                    <p className="text-xs text-indigo-400">Паспорт или ID карта</p>
                                </div>
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    capture="environment" 
                                    onChange={handlePassportScan}
                                    className="hidden" 
                                    disabled={isScanning}
                                />
                            </label>
                        </div>

                        <div className="space-y-5 flex-1">
                            <div className="relative">
                                <label className={labelClass}>{t('guestName')} (Search DB)</label>
                                <div className="relative">
                                    <input className={`${inputClass} pl-10 py-3 text-lg font-bold text-slate-700`} value={form.fullName} onChange={handleNameChange} placeholder="IVANOV IVAN" onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} />
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><User size={18}/></div>
                                </div>
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-xl mt-2 z-50 overflow-hidden">
                                        {suggestions.map(s => (
                                            <div key={s.id} onClick={() => selectClient(s)} className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center group">
                                                <div><div className="font-bold text-slate-800">{s.fullName}</div><div className="text-xs text-slate-400">{s.country}</div></div><div className="bg-slate-100 px-2 py-1 rounded text-xs font-mono text-slate-500 group-hover:bg-white">{s.passport}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-5">
                                <div><label className={labelClass}>{t('passport')}</label><input className={`${inputClass} uppercase font-mono text-lg`} value={form.passport} onChange={e => setForm({...form, passport: e.target.value.toUpperCase()})} placeholder="AA1234567" /></div>
                                <div><label className={labelClass}>{t('birthDate')}</label><input type="date" className={inputClass} value={form.birthDate} onChange={e => setForm({...form, birthDate: e.target.value})} /></div>
                            </div>
                            <div><label className={labelClass}>{t('country')}</label><select className={inputClass} value={form.country} onChange={e => setForm({...form, country: e.target.value})}>{COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                        </div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full">
                        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
                            <BedDouble className="text-indigo-600" size={20}/>
                            <h4 className="font-bold text-slate-800">Placement</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-5">
                            <div><label className={labelClass}>{t('room')}</label><select className={`${inputClass} font-bold`} value={selectedRoomId} onChange={e => setSelectedRoomId(e.target.value)}>{allRooms.map(r => <option key={r.id} value={r.id}>№ {r.number}</option>)}</select></div>
                            <div>
                                <label className={labelClass}>{t('bed')}</label>
                                <select className={inputClass} value={form.bedId} onChange={e => setForm({...form, bedId: e.target.value})}>
                                    {room && Array.from({length: room.capacity}).map((_, i) => { const id = i + 1; return <option key={id} value={id}>№ {id} {id % 2 === 0 ? '(Up)' : '(Down)'}</option> })}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Date In</label>
                                <input 
                                    type="date" 
                                    className={inputClass} 
                                    value={form.checkInDate.split('T')[0]} 
                                    onChange={e => setForm({...form, checkInDate: e.target.value})}
                                    
                                />
                            </div>
                            <div><label className={labelClass}>{t('days')}</label><input type="number" min="1" className={`${inputClass} font-bold text-lg`} value={form.days} onChange={e => setForm({...form, days: e.target.value})} onWheel={disableWheel} /></div>
                            <div className="col-span-2"><label className={labelClass}>{t('price')}</label><input type="number" className={inputClass} value={form.pricePerNight} onChange={e => setForm({...form, pricePerNight: e.target.value})} onWheel={disableWheel} /></div>
                        </div>
                    </div>
                 </div>
                 
                 <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl w-full">
                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2 text-lg"><Wallet className="text-indigo-600"/> {t('payment')}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                         <div>
                             <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">{t('cash')}</label>
                             <div className="flex items-center">
                                 <input type="number" className="w-full bg-white border border-slate-300 rounded-l-xl px-4 py-3 text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-slate-400 no-spinner" value={form.payCash} onChange={e => { setForm({...form, payCash: e.target.value}); setMagnetActiveField(null); }} placeholder="0" onWheel={disableWheel} />
                                 <button type="button" onClick={() => applyMagnet('payCash')} disabled={magnetActiveField && magnetActiveField !== 'payCash'} className="bg-white border border-l-0 border-slate-300 rounded-r-xl px-3 py-3 hover:bg-slate-50 text-indigo-600 disabled:opacity-40"><Magnet size={18}/></button>
                             </div>
                         </div>
                         <div>
                             <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">{t('card')}</label>
                             <div className="flex items-center">
                                 <input type="number" className="w-full bg-white border border-slate-300 rounded-l-xl px-4 py-3 text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-slate-400 no-spinner" value={form.payCard} onChange={e => { setForm({...form, payCard: e.target.value}); setMagnetActiveField(null); }} placeholder="0" onWheel={disableWheel} />
                                 <button type="button" onClick={() => applyMagnet('payCard')} disabled={magnetActiveField && magnetActiveField !== 'payCard'} className="bg-white border border-l-0 border-slate-300 rounded-r-xl px-3 py-3 hover:bg-slate-50 text-indigo-600 disabled:opacity-40"><Magnet size={18}/></button>
                             </div>
                         </div>
                         <div>
                             <label className="text-xs uppercase font-bold text-slate-500 mb-1 block">{t('qr')}</label>
                             <div className="flex items-center">
                                 <input type="number" className="w-full bg-white border border-slate-300 rounded-l-xl px-4 py-3 text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-slate-400 no-spinner" value={form.payQR} onChange={e => { setForm({...form, payQR: e.target.value}); setMagnetActiveField(null); }} placeholder="0" onWheel={disableWheel} />
                                 <button type="button" onClick={() => applyMagnet('qr')} disabled={magnetActiveField && magnetActiveField !== 'payQR'} className="bg-white border border-l-0 border-slate-300 rounded-r-xl px-3 py-3 hover:bg-slate-50 text-indigo-600 disabled:opacity-40"><Magnet size={18}/></button>
                             </div>
                         </div>
                    </div>
                    <div className="flex flex-col md:flex-row gap-4 items-stretch">
                        <div className="flex-1 bg-white border border-slate-200 rounded-xl p-4 flex justify-around items-center shadow-sm">
                             <div className="text-center">
                                 <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t('total')}</div>
                                 <div className="font-extrabold text-slate-800 text-xl">{totalPrice.toLocaleString()}</div>
                             </div>
                             <div className="w-px h-8 bg-slate-100 mx-2"></div>
                             <div className="text-center">
                                 <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t('paid')}</div>
                                 <div className="font-extrabold text-emerald-600 text-xl">{totalPaid.toLocaleString()}</div>
                             </div>
                             <div className="w-px h-8 bg-slate-100 mx-2"></div>
                             <div className="text-center">
                                 <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{t('debt')}</div>
                                 <div className={`font-extrabold text-xl ${debt > 0 ? 'text-rose-500' : 'text-slate-300'}`}>{debt > 0 ? debt.toLocaleString() : '0'}</div>
                             </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 min-w-[300px]">
                            <Button type="button" onClick={(e) => handleAction(e, true)} variant="warning" className="flex-1 py-4 text-lg shadow-sm" title="Book">
                                <Clock size={20} /> {t('booking')}
                            </Button>
                            <Button type="button" onClick={(e) => handleAction(e, false)} variant="primary" className="flex-[2] py-4 text-lg shadow-lg shadow-indigo-200" icon={CheckCircle2}>
                                {t('checkin')}
                            </Button>
                        </div>
                    </div>
                 </div>
              </form>
            </div>
          </div>
          <style>{`
            .no-spinner::-webkit-outer-spin-button, .no-spinner::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
            .no-spinner { -moz-appearance: textfield; }
          `}</style>
        </div>
    );
};

const GuestDetailsModal = ({ guest, room, currentUser, onClose, onUpdate, onPayment, onCheckOut, onSplit, onOpenMove, onDelete, notify, onReduceDays, onActivateBooking, onReduceDaysNoRefund, hostelInfo, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const totalPaid = getTotalPaid(guest);
    const debt = (guest.totalPrice || 0) - totalPaid;
    
    // Permission check - viewers can only modify guests in their assigned hostel (hostel2)
    // All other roles (admin, super, cashier) have full modification rights
    const canModify = currentUser.role === 'viewer' ? guest.hostelId === currentUser.hostelId : true;
    
    const [activeAction, setActiveAction] = useState(null);
    const [payCash, setPayCash] = useState('');
    const [payCard, setPayCard] = useState('');
    const [payQR, setPayQR] = useState('');
    
    const [extendDays, setExtendDays] = useState(1);
    const [checkoutManualRefund, setCheckoutManualRefund] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ fullName: guest.fullName, birthDate: guest.birthDate, passport: guest.passport, country: guest.country, pricePerNight: guest.pricePerNight });
    const [splitAfterDays, setSplitAfterDays] = useState(1);
    const [splitGapDays, setSplitGapDays] = useState(1);
    const [reduceDays, setReduceDays] = useState(1);
    const [reduceDaysNoRefund, setReduceDaysNoRefund] = useState(1);
    const [newStartDate, setNewStartDate] = useState(guest.checkInDate.split('T')[0]);
    
    const isBooking = guest.status === 'booking';
    const isCheckedOut = guest.status === 'checked_out';
    const [magnetActiveField, setMagnetActiveField] = useState(null);

    const today = new Date(); 
    const checkIn = new Date(guest.checkInDate); 
    let daysStayedCalculated = Math.max(1, Math.ceil((today - checkIn) / (1000 * 60 * 60 * 24)));
    const daysStayed = Math.min(daysStayedCalculated, parseInt(guest.days));
    const actualCost = daysStayed * parseInt(guest.pricePerNight); 
    const balance = totalPaid - actualCost;

    const handlePayDebt = () => { const cash = parseInt(payCash) || 0; const card = parseInt(payCard) || 0; const qr = parseInt(payQR) || 0; const sum = cash + card + qr; if(sum <= 0) return notify("Enter Amount", 'error'); onPayment(guest.id, { cash, card, qr }); };
    
    const handleExtend = () => { 
        const days = parseInt(extendDays); if(!days) return; 
        const newTotal = (guest.totalPrice || 0) + (days * parseInt(guest.pricePerNight)); 
        const updates = { days: parseInt(guest.days) + days, totalPrice: newTotal, status: 'active' };
        const stay = getStayDetails(guest.checkInDate, updates.days);
        updates.checkOutDate = stay.end.toISOString();
        onUpdate(guest.id, updates); 
    };

    const handleDoCheckout = () => { 
        const debt = (guest.totalPrice || 0) - getTotalPaid(guest);
        const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';
        
        // ✅ ИСПРАВЛЕНО: админ может выселять принудительно, даже если есть долг
        if (debt > 0 && !isAdmin) {
            return notify(t('debtRemaining'), 'error');
        }
        
        // Остальная логика выселения
        const refund = checkoutManualRefund ? parseInt(checkoutManualRefund) : Math.max(0, balance); 
        const finalData = { totalPrice: actualCost, paidCash: (guest.paidCash || 0) - refund, amountPaid: (guest.amountPaid || 0) - refund }; 
        onCheckOut(guest, finalData); 
    };

    const handleDoSplit = () => { 
        const iSplitAfter = parseInt(splitAfterDays); 
        const iSplitGap = parseInt(splitGapDays); 
        const iTotalDays = parseInt(guest.days); 
        if (iSplitAfter >= iTotalDays) return notify("Split day must be less than total days", 'error'); 
        onSplit(guest, iSplitAfter, iSplitGap); onClose(); 
    };
    const handleSaveInfo = () => { const newPrice = parseInt(editForm.pricePerNight); const newTotal = newPrice * parseInt(guest.days); onUpdate(guest.id, { ...editForm, totalPrice: newTotal }); setIsEditing(false); }
    const handleDeleteGuest = () => { if (confirm(t('confirmDelete'))) { onDelete(guest); } };
    const handleReduceDays = async () => { const rd = parseInt(reduceDays); if (!rd || rd <= 0) return notify("Error days", 'error'); if (rd >= guest.days) return notify("Can't remove all days", 'error'); onReduceDays(guest, rd); onClose(); };
    const handleReduceDaysNoRefund = async () => { const rd = parseInt(reduceDaysNoRefund); if (!rd || rd <= 0) return notify("Error days", 'error'); if (rd >= guest.days) return notify("Can't remove all days", 'error'); onReduceDaysNoRefund(guest, rd); onClose(); };

    const handlePrint = (type) => { printDocument(type, guest, hostelInfo); };
    
    const handleMoveBooking = () => {
        const start = new Date(newStartDate);
        start.setHours(12, 0, 0, 0);
        const stay = getStayDetails(start.toISOString(), guest.days);
        onUpdate(guest.id, { checkInDate: start.toISOString(), checkOutDate: stay.end.toISOString() });
        notify("Date Changed!");
        setActiveAction(null);
    }
    
    const applyMagnet = (field) => {
        const currentCash = field === 'payCash' ? 0 : (parseInt(payCash) || 0);
        const currentCard = field === 'payCard' ? 0 : (parseInt(payCard) || 0);
        const currentQR = field === 'payQR' ? 0 : (parseInt(payQR) || 0);
        const currentTotal = currentCash + currentCard + currentQR;
        const remaining = Math.max(0, debt - currentTotal);
        if (field === 'payCash') setPayCash(String(remaining));
        if (field === 'payCard') setPayCard(String(remaining));
        if (field === 'payQR') setPayQR(String(remaining));
        setMagnetActiveField(field);
    };
    const disableWheel = (e) => { e.currentTarget.blur(); };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] overflow-y-auto">
                {/* --- HEADER --- */}
                <div className={`${isBooking ? 'bg-amber-500' : (isCheckedOut ? 'bg-slate-500' : 'bg-slate-900')} text-white p-6 flex justify-between items-start relative`}>
                    <div className="flex-1">
                        {isBooking && <div className="text-xs uppercase font-bold text-white/80 mb-1 flex items-center gap-1"><Clock size={12}/> {t('booking')}</div>}
                        {isCheckedOut && <div className="text-xs uppercase font-bold text-white/80 mb-1 flex items-center gap-1"><History size={12}/> Checked Out</div>}
                        {isEditing ? (
                            <div className="space-y-2 text-slate-900">
                                <input className={inputClass} value={editForm.fullName} onChange={e => setEditForm({...editForm, fullName: e.target.value.toUpperCase()})} />
                                <div className="grid grid-cols-2 gap-2"><input className={inputClass} value={editForm.passport} onChange={e => setEditForm({...editForm, passport: e.target.value.toUpperCase()})} /><input type="date" className={inputClass} value={editForm.birthDate} onChange={e => setEditForm({...editForm, birthDate: e.target.value})} /></div>
                                <select className={inputClass} value={editForm.country} onChange={e => setEditForm({...editForm, country: e.target.value})}>{COUNTRIES.map(c => <option key={c}>{c}</option>)}</select>
                                {(currentUser.role === 'admin' || currentUser.role === 'super') && (<div><label className={labelClass}>{t('price')}</label><input type="number" className={inputClass} value={editForm.pricePerNight} onChange={e => setEditForm({...editForm, pricePerNight: e.target.value})} /></div>)}
                                <Button size="sm" onClick={handleSaveInfo}>{t('save')}</Button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-bold">{guest.fullName}</h2>
                                    {/* --- ИСПРАВЛЕННАЯ КНОПКА РЕДАКТИРОВАНИЯ --- */}
                                    <button 
                                        onClick={() => setIsEditing(true)} 
                                        className="bg-transparent border-none p-1 text-white/60 hover:text-white transition-colors cursor-pointer" 
                                        title="Редактировать"
                                    >
                                        <Edit size={18}/>
                                    </button>
                                </div>
                                <div className="flex gap-4 text-sm text-white/70 mt-1 flex-wrap"><span>Room {guest.roomNumber}</span><span>Bed {guest.bedId}</span><span>{new Date(guest.checkInDate).toLocaleDateString()}</span><span>{guest.passport}</span></div>
                            </>
                        )}
                    </div>
                    {/* --- ИСПРАВЛЕННАЯ КНОПКА ЗАКРЫТИЯ --- */}
                    <button 
                        onClick={onClose} 
                        className="bg-transparent border-none p-2 text-white/60 hover:text-white transition-colors cursor-pointer hover:bg-white/10 rounded-full"
                    >
                        <XCircle size={32}/>
                    </button>
                </div>

                {!isBooking && (
                    <div className={`p-4 flex justify-between items-center ${debt > 0 ? 'bg-rose-50 border-b border-rose-200' : 'bg-emerald-50 border-b border-emerald-200'}`}>
                        <div className="flex items-center gap-2">{debt > 0 ? <AlertCircle className="text-rose-600"/> : <CheckCircle2 className="text-emerald-600"/>}<span className={`font-bold ${debt > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{debt > 0 ? `${t('debt')}: ${debt.toLocaleString()}` : t('paid')}</span></div>
                        <div className="text-xs text-slate-500 text-right"><div>{t('total')}: {guest.totalPrice?.toLocaleString()}</div><div>{t('paid')}: {totalPaid.toLocaleString()}</div></div>
                    </div>
                )}
                <div className="p-6 space-y-6">
                    {isBooking && (
                        <div className="space-y-2">
                            <Button className="w-full py-3 text-lg" onClick={() => onActivateBooking(guest)}><CheckCircle2/> {t('checkin')}</Button>
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="secondary" onClick={() => setActiveAction(activeAction === 'moveDate' ? null : 'moveDate')} icon={CalendarDays}>{t('moveDate')}</Button>
                                <Button variant="danger" onClick={handleDeleteGuest} icon={Trash2}>{t('cancel')}</Button>
                            </div>
                        </div>
                    )}
                    {!isBooking && (
                        <div className="grid grid-cols-4 gap-2">
                             <Button variant={activeAction === 'pay' ? 'primary' : 'secondary'} onClick={() => setActiveAction(activeAction === 'pay' ? null : 'pay')} disabled={debt <= 0 || !canModify}>{t('payment')}</Button>
                             <Button variant={activeAction === 'extend' ? 'primary' : 'secondary'} onClick={() => setActiveAction(activeAction === 'extend' ? null : 'extend')} disabled={!canModify}>{t('extend')}</Button>
                             {!isCheckedOut && <Button variant={activeAction === 'split' ? 'primary' : 'secondary'} onClick={() => setActiveAction(activeAction === 'split' ? null : 'split')} title="Split" disabled={!canModify}><Split size={18}/></Button>}
                             {!isCheckedOut && <Button variant={activeAction === 'checkout' ? 'primary' : 'secondary'} onClick={() => setActiveAction(activeAction === 'checkout' ? null : 'checkout')} className="text-rose-600 border-rose-300 hover:bg-rose-50" disabled={!canModify}>{t('checkout')}</Button>}
                        </div>
                    )}
                    {!isBooking && (
                        <div className="flex gap-2 justify-center">
                            <Button size="sm" variant="ghost" onClick={() => handlePrint('check')} icon={Printer}>{t('printCheck')}</Button>
                            <Button size="sm" variant="ghost" onClick={() => handlePrint('regcard')} icon={Printer}>{t('printForm')}</Button>
                            <Button size="sm" variant="ghost" onClick={() => handlePrint('ref')} icon={Printer}>{t('printRef')}</Button>
                        </div>
                    )}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-300">
                        {(!activeAction && !isBooking) && (
                            <div className="space-y-4">
                                <div className="flex justify-center gap-2">
                                    {!isCheckedOut && <Button variant="ghost" icon={ArrowLeftRight} onClick={onOpenMove}>{t('move')}</Button>}
                                    {/* --- ADMIN MOVE DATE BUTTON --- */}
                                    {!isCheckedOut && (currentUser.role === 'admin' || currentUser.role === 'super') && (
                                        <Button variant="ghost" icon={CalendarDays} onClick={() => setActiveAction('moveDate')}>{t('moveDate')}</Button>
                                    )}
                                </div>
                                {(currentUser.role === 'admin' || currentUser.role === 'super') && (
                                    <>
                                        <div className="border-t border-slate-200 pt-4 flex justify-center gap-4">
                                            {!isCheckedOut && <button onClick={() => setActiveAction('reduceNoRefund')} className="text-xs text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1"><Scissors size={14}/> {t('reduceNoRefund')}</button>}
                                            <button onClick={handleDeleteGuest} className="text-xs text-rose-400 hover:text-rose-600 underline">{t('delete')}</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        {activeAction === 'split' && (
                            <div className="space-y-4">
                                <h4 className="font-bold text-slate-700">{t('splitTitle')}</h4>
                                <div className="grid grid-cols-2 gap-4"><div><label className={labelClass}>{t('splitAfter')}</label><input type="number" min="1" max={guest.days - 1} className={inputClass} value={splitAfterDays} onChange={e => setSplitAfterDays(e.target.value)} /></div><div><label className={labelClass}>{t('splitGap')}</label><input type="number" min="1" className={inputClass} value={splitGapDays} onChange={e => setSplitGapDays(e.target.value)} /></div></div>
                                <div className="text-xs text-slate-500 bg-white p-2 rounded border border-slate-200">{t('splitInfo').replace('{x}', splitAfterDays).replace('{y}', splitGapDays).replace('{z}', guest.days - splitAfterDays)}</div>
                                <Button className="w-full" onClick={handleDoSplit}>{t('confirmSplit')}</Button>
                            </div>
                        )}
                        {activeAction === 'moveDate' && (
                            <div className="space-y-4">
                                <h4 className="font-bold text-slate-700">{t('moveDate')}</h4>
                                <div><label className={labelClass}>{t('newDate')}</label><input type="date" className={inputClass} value={newStartDate} onChange={e => setNewStartDate(e.target.value)} /></div>
                                <Button className="w-full" onClick={handleMoveBooking}>{t('save')}</Button>
                            </div>
                        )}
                        {activeAction === 'pay' && (
                            <div className="space-y-3">
                                <label className={labelClass}>{t('amount')} ({t('debt')}: {debt})</label>
                                <div className="grid grid-cols-1 gap-2">
                                    <div className="flex items-center">
                                        <span className="w-20 text-[10px] uppercase font-bold text-slate-400">{t('cash')}</span>
                                        <input type="number" className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-l focus:ring-1 focus:ring-indigo-500 outline-none text-sm no-spinner" value={payCash} onChange={e => {setPayCash(e.target.value); setMagnetActiveField(null);}} placeholder="0" onWheel={disableWheel} />
                                        <button onClick={() => applyMagnet('payCash')} disabled={magnetActiveField && magnetActiveField !== 'payCash'} className="bg-white border border-l-0 border-slate-300 rounded-r px-2 py-2 text-indigo-600 disabled:opacity-40"><Magnet size={16}/></button>
                                    </div>
                                    <div className="flex items-center">
                                        <span className="w-20 text-[10px] uppercase font-bold text-slate-400">{t('card')}</span>
                                        <input type="number" className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-l focus:ring-1 focus:ring-indigo-500 outline-none text-sm no-spinner" value={payCard} onChange={e => {setPayCard(e.target.value); setMagnetActiveField(null);}} placeholder="0" onWheel={disableWheel} />
                                        <button onClick={() => applyMagnet('payCard')} disabled={magnetActiveField && magnetActiveField !== 'payCard'} className="bg-white border border-l-0 border-slate-300 rounded-r px-2 py-2 text-indigo-600 disabled:opacity-40"><Magnet size={16}/></button>
                                    </div>
                                    <div className="flex items-center">
                                        <span className="w-20 text-[10px] uppercase font-bold text-slate-400">{t('qr')}</span>
                                        <input type="number" className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-l focus:ring-1 focus:ring-indigo-500 outline-none text-sm no-spinner" value={payQR} onChange={e => {setPayQR(e.target.value); setMagnetActiveField(null);}} placeholder="0" onWheel={disableWheel} />
                                        <button onClick={() => applyMagnet('payQR')} disabled={magnetActiveField && magnetActiveField !== 'payQR'} className="bg-white border border-l-0 border-slate-300 rounded-r px-2 py-2 text-indigo-600 disabled:opacity-40"><Magnet size={16}/></button>
                                    </div>
                                </div>
                                <Button className="w-full" onClick={handlePayDebt}>{t('payment')}</Button>
                            </div>
                        )}
                        {activeAction === 'extend' && (
                            <div className="space-y-3"><label className={labelClass}>{t('extend')} ({t('days')})</label><input type="number" min="1" className={inputClass} value={extendDays} onChange={e => setExtendDays(e.target.value)} /><div className="text-right text-sm text-slate-500">+ {(extendDays * parseInt(guest.pricePerNight)).toLocaleString()}</div><Button className="w-full" onClick={handleExtend}>OK</Button></div>
                        )}
                        {activeAction === 'checkout' && (
                            <div className="space-y-4">
                                <div className="text-sm space-y-1 pb-3 border-b border-slate-300"><div className="flex justify-between"><span>Прожито (расчет):</span> <b>{daysStayed} дн.</b></div><div className="flex justify-between"><span>Оплачено всего:</span> <b>{totalPaid.toLocaleString()}</b></div><div className="flex justify-between"><span>Стоимость факта:</span> <b>{actualCost.toLocaleString()}</b></div></div>
                                {balance < 0 ? (<div className="bg-rose-100 text-rose-800 p-3 rounded-lg text-center font-bold border border-rose-200">Долг: {Math.abs(balance).toLocaleString()} <br/><span className="text-xs font-normal">Продлите проживание или оплатите.</span></div>) : (<div className="bg-emerald-100 text-emerald-800 p-3 rounded-lg border border-emerald-200"><div className="text-center font-bold mb-2">К возврату: {balance.toLocaleString()}</div>{balance > 0 && <div><label className={`${labelClass} mb-1`}>{t('manualRefund')}</label><input type="number" className={inputClass} value={checkoutManualRefund} placeholder={balance} onChange={e => setCheckoutManualRefund(e.target.value)} /></div>}</div>)}
                                <Button variant="danger" className="w-full" onClick={handleDoCheckout}>{t('checkout')}</Button>
                            </div>
                        )}
                        {(currentUser.role === 'admin' || currentUser.role === 'super') && !isBooking && !activeAction && (
                            <div className="mt-6 p-4 border-t border-slate-100">
                                <h4 className="font-bold text-slate-700 mb-2">Reduce Days (Refund)</h4>
                                <div className="grid grid-cols-2 gap-3 items-end"><div><label className={labelClass}>Reduce by (days)</label><input type="number" min="1" max={guest.days-1} className={inputClass} value={reduceDays} onChange={e => setReduceDays(e.target.value)} /></div><div className="text-right"><div className="text-xs text-slate-500">Refund:</div><div className="font-bold">{((parseInt(guest.pricePerNight)||0) * (parseInt(reduceDays)||0)).toLocaleString()}</div></div><div className="col-span-2"><Button className="w-full" variant="secondary" onClick={handleReduceDays}>Apply & Refund</Button></div></div>
                            </div>
                        )}
                        {activeAction === 'reduceNoRefund' && (
                            <div className="space-y-4">
                                <h4 className="font-bold text-amber-700">{t('reduceNoRefund')}</h4>
                                <p className="text-xs text-slate-500">Money stays in register. Guest stay is shortened.</p>
                                <div><label className={labelClass}>Reduce by (days)</label><input type="number" min="1" max={guest.days-1} className={inputClass} value={reduceDaysNoRefund} onChange={e => setReduceDaysNoRefund(e.target.value)} /></div>
                                <Button className="w-full" variant="warning" onClick={handleReduceDaysNoRefund}>Apply (No Refund)</Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ShiftClosingModal = ({ user, payments = [], expenses, onClose, onLogout, notify, onEndShift, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const shiftStart = user.lastShiftEnd || '1970-01-01T00:00:00.000Z'; 
    const myPayments = payments.filter(p => { const isMyPayment = (p.staffId === user.id) || (p.staffId === user.login); return isMyPayment && p.date > shiftStart; });
    const myExpenses = expenses.filter(e => { const isMyExpense = (e.staffId === user.id) || (e.staffId === user.login); return isMyExpense && e.date > shiftStart; });
    const income = { cash: myPayments.reduce((sum, p) => sum + (p.method === 'cash' ? (parseInt(p.amount)||0) : 0), 0), card: myPayments.reduce((sum, p) => sum + (p.method === 'card' ? (parseInt(p.amount)||0) : 0), 0), qr: myPayments.reduce((sum, p) => sum + (p.method === 'qr' ? (parseInt(p.amount)||0) : 0), 0) };
    const totalExpenses = myExpenses.reduce((sum, e) => sum + (parseInt(e.amount)||0), 0);
    const totalRevenue = income.cash + income.card + income.qr;
    const cashInHand = income.cash - totalExpenses;
    const handleEndShiftWithNotify = () => {
        const msg = `<b>🔔 Закрытие смены</b>\nКассир: ${user.name}\n---\n💵 Наличные: ${income.cash.toLocaleString()}\n💳 Терминал: ${income.card.toLocaleString()}\n📱 QR: ${income.qr.toLocaleString()}\n---\n<b>💰 ИТОГО: ${totalRevenue.toLocaleString()}</b>\n📉 Расходы: ${totalExpenses.toLocaleString()}\n<b>🏦 В КАССЕ: ${cashInHand.toLocaleString()}</b>`;
        sendTelegramMessage(msg);
        onEndShift(); // This will trigger closing the shift record too
    };
    const copyReport = () => {
        const lines = [ `User: ${user.name}`, `Cash: ${income.cash.toLocaleString()}`, `Card: ${income.card.toLocaleString()}`, `QR: ${income.qr.toLocaleString()}`, `TOTAL: ${totalRevenue.toLocaleString()}`, `Exp: ${totalExpenses.toLocaleString()}`, `HAND: ${cashInHand.toLocaleString()}` ];
        const text = lines.join('\n');
        const textArea = document.createElement("textarea"); textArea.value = text; document.body.appendChild(textArea); textArea.select();
        try { document.execCommand('copy'); notify("Copied!", 'success'); } catch (err) { }
        document.body.removeChild(textArea);
    };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-slate-900 p-6 text-white flex justify-between items-center">
                    <div><h2 className="text-xl font-bold flex items-center gap-2"><Lock size={20} className="text-rose-400"/> {t('shiftClose')}</h2><p className="text-slate-400 text-xs mt-1">{t('staff')}: {user.name}</p></div>
                    <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><XCircle size={20}/></button>
                </div>
                <div className="p-6 overflow-y-auto bg-slate-50 space-y-6">
                    <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-200 shadow-sm text-center">
                        <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">{t('total')}</h3>
                        <div className="text-3xl font-extrabold text-indigo-700">{totalRevenue.toLocaleString()}</div>
                        <div className="text-xs text-indigo-400 mt-1">{t('cash')} + {t('card')} + {t('qr')}</div>
                    </div>
                     <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Kassa ({t('cash')})</h3><div className="flex justify-between items-center mb-2 text-sm"><span className="text-slate-600">{t('income')}:</span><span className="font-bold text-slate-900">+{income.cash.toLocaleString()}</span></div><div className="flex justify-between items-center mb-4 text-sm"><span className="text-rose-600">{t('expense')}:</span><span className="font-bold text-rose-600">-{totalExpenses.toLocaleString()}</span></div><div className="pt-3 border-t border-dashed border-slate-300 flex justify-between items-center"><span className="font-bold text-lg text-slate-800">{t('cashInHand')}:</span><span className="font-bold text-2xl text-emerald-600">{cashInHand.toLocaleString()}</span></div></div><div className="grid grid-cols-2 gap-4"><div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><div className="text-slate-400 text-xs font-bold uppercase mb-1">{t('card')}</div><div className="text-lg font-bold text-slate-800">{income.card.toLocaleString()}</div></div><div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"><div className="text-slate-400 text-xs font-bold uppercase mb-1">{t('qr')}</div><div className="text-lg font-bold text-slate-800">{income.qr.toLocaleString()}</div></div></div>
                </div>
                <div className="p-4 bg-white border-t border-slate-200 flex flex-col gap-3">
                    <Button variant="secondary" onClick={copyReport} icon={Copy} className="w-full">Copy</Button>
                    <div className="flex gap-3"><Button variant="ghost" className="flex-1" onClick={onClose}>{t('cancel')}</Button><Button variant="danger" className="flex-1" icon={LogOut} onClick={handleEndShiftWithNotify}>{t('shiftClose')}</Button></div>
                </div>
            </div>
        </div>
    );
};

const ExpenseModal = ({ onClose, onSubmit, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const categories = lang === 'uz' ? ['Хўжалик буюмлари', 'Озиқ-овқат', 'Таъмирлаш', 'Иш ҳақи', 'Коммунал', 'Бошқа'] : ['Хозтовары', 'Продукты', 'Ремонт', 'Зарплата', 'Коммунальные', 'Прочее'];
    const [form, setForm] = useState({ amount: '', category: categories[0], comment: '' });
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><Wallet size={20} className="text-rose-500"/> {t('expense')}</h3>
                <div className="space-y-4">
                    <div><label className={labelClass}>{t('amount')}</label><input type="number" className={inputClass} value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="0" /></div>
                    <div>
                        <label className={labelClass}>{t('category')}</label>
                        <select className={inputClass} value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                    <div><label className={labelClass}>{t('comment')}</label><input className={inputClass} value={form.comment} onChange={e => setForm({...form, comment: e.target.value})} placeholder="..." /></div>
                    <Button onClick={() => onSubmit(form)} className="w-full mt-4" disabled={!form.amount}>{t('save')}</Button>
                    <Button variant="secondary" onClick={onClose} className="w-full">{t('cancel')}</Button>
                </div>
            </div>
        </div>
    );
};

const RoomFormModal = ({ title, initialData = {}, onClose, onSubmit, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [form, setForm] = useState({ 
        number: initialData.number || '', 
        capacity: initialData.capacity || '4', 
        prices: initialData.prices || { lower: 0, upper: 0 } 
    });
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
                <h3 className="font-bold text-lg mb-6">{title}</h3>
                <div className="space-y-4">
                    <div><label className={labelClass}>{t('room')}</label><input className={inputClass} value={form.number} onChange={e => setForm({...form, number: e.target.value})} /></div>
                    <div><label className={labelClass}>{t('bed')}</label><input type="number" className={inputClass} value={form.capacity} onChange={e => setForm({...form, capacity: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className={labelClass}>{t('price')} (Down)</label><input type="number" className={inputClass} value={form.prices.lower} onChange={e => setForm({...form, prices: {...form.prices, lower: e.target.value}})} /></div>
                        <div><label className={labelClass}>{t('price')} (Up)</label><input type="number" className={inputClass} value={form.prices.upper} onChange={e => setForm({...form, prices: {...form.prices, upper: e.target.value}})} /></div>
                    </div>
                    <Button onClick={() => onSubmit(form)} className="w-full mt-4">{t('save')}</Button>
                    <Button variant="secondary" onClick={onClose} className="w-full">{t('cancel')}</Button>
                </div>
            </div>
        </div>
    );
};

const MoveGuestModal = ({ guest, allRooms, guests, onClose, onMove, notify, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [targetRoomId, setTargetRoomId] = useState(guest.roomId);
    const [targetBedId, setTargetBedId] = useState('');
    const room = allRooms.find(r => r.id === targetRoomId);
    const availableBeds = room ? Array.from({length: room.capacity}, (_, i) => i + 1) : [];
    const handleMove = () => {
        if (!targetRoomId || !targetBedId) return notify("Select Destination", 'error');
        const conflicts = guests.filter(g => 
            g.roomId === targetRoomId && 
            String(g.bedId) === String(targetBedId) && 
            (g.status === 'active' || g.status === 'booking') &&
            g.id !== guest.id && 
            checkCollision(g.checkInDate, g.days, guest.checkInDate, guest.days)
        );
        if (conflicts.length > 0) return notify(`Occupied! (${conflicts[0].fullName})`, 'error');
        onMove(guest, targetRoomId, room.number, String(targetBedId));
    };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
                <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><ArrowLeftRight size={20}/> {t('move')}</h3>
                <p className="text-sm text-slate-500 mb-4">{t('guestName')}: <b>{guest.fullName}</b></p>
                <div className="space-y-4">
                    <div><label className={labelClass}>New {t('room')}</label><select className={inputClass} value={targetRoomId} onChange={e => { setTargetRoomId(e.target.value); setTargetBedId(''); }}>{allRooms.map(r => <option key={r.id} value={r.id}>Room {r.number}</option>)}</select></div>
                    <div><label className={labelClass}>New {t('bed')}</label><select className={inputClass} value={targetBedId} onChange={e => setTargetBedId(e.target.value)}><option value="">Select Bed</option>{availableBeds.map(id => (<option key={id} value={id}>Bed {id} {id%2===0?'(Up)':'(Down)'}</option>))}</select></div>
                    <Button onClick={handleMove} className="w-full mt-4">{t('move')}</Button>
                    <Button variant="secondary" onClick={onClose} className="w-full">{t('cancel')}</Button>
                </div>
            </div>
        </div>
    );
};
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

function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedHostelFilter, setSelectedHostelFilter] = useState('hostel1');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [permissionError, setPermissionError] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [notification, setNotification] = useState(null);
  const [lang, setLang] = useState('ru'); 

  const showNotification = (message, type = 'success') => { setNotification({ message, type }); };
  
  const [rooms, setRooms] = useState([]);
  const [guests, setGuests] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [clients, setClients] = useState([]);
  const [payments, setPayments] = useState([]); 
  const [usersList, setUsersList] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [shifts, setShifts] = useState([]);

  const [checkInModal, setCheckInModal] = useState({ open: false, room: null, bedId: null, date: null }); 
  const [guestDetailsModal, setGuestDetailsModal] = useState({ open: false, guest: null });
  const [moveGuestModal, setMoveGuestModal] = useState({ open: false, guest: null });
  const [expenseModal, setExpenseModal] = useState(false);
  const [shiftModal, setShiftModal] = useState(false);
  const [addRoomModal, setAddRoomModal] = useState(false);
  const [editRoomModal, setEditRoomModal] = useState({ open: false, room: null });

  const pendingTasksCount = useMemo(() => {
    return tasks.filter(t => t.status !== 'done').length;
  }, [tasks]);

  // --- ЛОГИКА БЛОКИРОВКИ СМЕНЫ ---
  const activeShiftInMyHostel = useMemo(() => {
      // Админов не блокируем
      if (!currentUser || currentUser.role === 'admin' || currentUser.role === 'super') return null;
      
      // Ищем открытую смену в моем хостеле, но НЕ мою
      return shifts.find(s => 
          s.hostelId === currentUser.hostelId && 
          !s.endTime && 
          s.staffId !== currentUser.id 
      );
  }, [shifts, currentUser]);

  const activeUserForBlock = useMemo(() => {
      if (!activeShiftInMyHostel) return null;
      return usersList.find(u => u.id === activeShiftInMyHostel.staffId);
  }, [activeShiftInMyHostel, usersList]);

  useEffect(() => {
    const handleEsc = (event) => {
        if (event.key === 'Escape') {
            if (checkInModal.open) setCheckInModal({open: false, room: null, bedId: null, date: null});
            if (guestDetailsModal.open) setGuestDetailsModal({open: false, guest: null});
            if (moveGuestModal.open) setMoveGuestModal({open: false, guest: null});
            if (expenseModal) setExpenseModal(false);
            if (shiftModal) setShiftModal(false);
            if (addRoomModal) setAddRoomModal(false);
            if (editRoomModal.open) setEditRoomModal({open: false, room: null});
        }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [checkInModal, guestDetailsModal, moveGuestModal, expenseModal, shiftModal, addRoomModal, editRoomModal]);

  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error(err));
    const unsubAuth = onAuthStateChanged(auth, (user) => { setFirebaseUser(user); setIsLoadingAuth(false); });
    const savedUser = localStorage.getItem('hostella_user_v4');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { unsubAuth(); window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  const handleLogin = (user) => { setCurrentUser(user); localStorage.setItem('hostella_user_v4', JSON.stringify(user)); if (user.role === 'cashier') setActiveTab('calendar'); else setActiveTab('dashboard'); };
  const handleLogout = () => { setCurrentUser(null); localStorage.removeItem('hostella_user_v4'); };
  
  const handleEndShift = async () => {
      if (currentUser && currentUser.id) { await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', currentUser.id), { lastShiftEnd: new Date().toISOString() }); }
      const myOpenShift = shifts.find(s => s.staffId === currentUser.id && !s.endTime);
      if (myOpenShift) {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'shifts', myOpenShift.id), { endTime: new Date().toISOString() });
      }
      handleLogout();
  };

  // --- ФУНКЦИЯ ПЕРЕДАЧИ "НА СЕБЯ" ИЗ БЛОКИРОВКИ ---
  const handleTransferToMe = async (shiftId) => {
      if (!currentUser) return;
      try {
        const batch = writeBatch(db);
        // Закрываем чужую смену
        batch.update(doc(db, ...PUBLIC_DATA_PATH, 'shifts', shiftId), { endTime: new Date().toISOString() });
        // Открываем свою
        const newShiftRef = doc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'));
        batch.set(newShiftRef, {
            staffId: currentUser.id,
            hostelId: currentUser.hostelId,
            startTime: new Date().toISOString(),
            endTime: null
        });
        await batch.commit();
        showNotification("Смена принята успешно!", "success");
      } catch (e) {
        showNotification("Ошибка передачи смены: " + e.message, "error");
      }
  };

  useEffect(() => {
    if (!firebaseUser) return;
    const usersCol = collection(db, ...PUBLIC_DATA_PATH, 'users');
    const unsubUsers = onSnapshot(usersCol, (snap) => { const users = snap.docs.map(d => ({id: d.id, ...d.data()})); setUsersList(users.length ? users : DEFAULT_USERS); });

    if (!currentUser) return unsubUsers; 

    const roomsCol = collection(db, ...PUBLIC_DATA_PATH, 'rooms');
    const guestsCol = collection(db, ...PUBLIC_DATA_PATH, 'guests');
    const expensesCol = collection(db, ...PUBLIC_DATA_PATH, 'expenses');
    const clientsCol = collection(db, ...PUBLIC_DATA_PATH, 'clients');
    const paymentsCol = collection(db, ...PUBLIC_DATA_PATH, 'payments');
    const tasksCol = collection(db, ...PUBLIC_DATA_PATH, 'tasks');
    const shiftsCol = collection(db, ...PUBLIC_DATA_PATH, 'shifts');

    const u1 = onSnapshot(roomsCol, { includeMetadataChanges: true }, (snap) => { setPermissionError(false); setRooms(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => parseInt(a.number) - parseInt(b.number))); setIsOnline(!snap.metadata.fromCache); }, (err) => { if (err.code === 'permission-denied') setPermissionError(true); setIsOnline(false); });
    const u2 = onSnapshot(guestsCol, (snap) => setGuests(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => new Date(b.checkInDate) - new Date(a.checkInDate))));
    const u3 = onSnapshot(expensesCol, (snap) => setExpenses(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => new Date(b.date) - new Date(a.date))));
    const u4 = onSnapshot(clientsCol, (snap) => setClients(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => a.fullName.localeCompare(b.fullName))));
    const u5 = onSnapshot(paymentsCol, (snap) => setPayments(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    const u6 = onSnapshot(tasksCol, (snap) => setTasks(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    const u7 = onSnapshot(shiftsCol, (snap) => setShifts(snap.docs.map(d => ({id: d.id, ...d.data()}))));

    return () => { unsubUsers(); u1(); u2(); u3(); u4(); u5(); u6(); u7(); };
  }, [firebaseUser, currentUser]);

  const seedUsers = async () => { if (usersList.length === DEFAULT_USERS.length && usersList[0].id === undefined) { try { for(const u of DEFAULT_USERS) { await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'users'), u); } alert("Init done"); } catch(e) {} } };
  const handleAddUser = async (d) => { await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'users'), d); };
  const handleDeleteUser = async (id) => { if(confirm("Del?")) await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', id)); };

  const filterByHostel = (items) => {
    if (!currentUser) return [];
    if (currentUser.role === 'super') return items;
    // Viewer role can view items from selectedHostelFilter
    if (currentUser.role === 'viewer') {
      return items.filter(i => i.hostelId === selectedHostelFilter);
    }
    const target = currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId;
    return items.filter(i => i.hostelId === target);
  };
  
  const filteredUsersForReports = useMemo(() => {
     if (!currentUser) return [];
     const targetHostel = currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId;
     if (currentUser.role === 'super') return usersList; 
     return usersList.filter(u => u.hostelId === targetHostel || u.role === 'super' || u.hostelId === 'all');
  }, [usersList, currentUser, selectedHostelFilter]);

  const filteredPayments = useMemo(() => {
    if (!currentUser) return [];
    const targetHostel = currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId;
    if (currentUser.role === 'super') return payments;
    return payments.filter(p => {
        const staff = usersList.find(u => u.id === p.staffId || u.login === p.staffId);
        return staff && (staff.hostelId === targetHostel || staff.hostelId === 'all');
    });
  }, [payments, usersList, currentUser, selectedHostelFilter]);

  const filteredRooms = useMemo(() => filterByHostel(rooms), [rooms, currentUser, selectedHostelFilter]);
  const filteredGuests = useMemo(() => filterByHostel(guests), [guests, currentUser, selectedHostelFilter]);
  const filteredExpenses = useMemo(() => filterByHostel(expenses), [expenses, currentUser, selectedHostelFilter]);
  const filteredTasks = useMemo(() => filterByHostel(tasks), [tasks, currentUser, selectedHostelFilter]);
  // Смены фильтруем теперь внутри ShiftsView, чтобы админ видел всё

  const handleUpdateClient = async (id, d) => { await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', id), d); showNotification("Updated"); };
  const handleImportClients = async (newClients) => {
    if (newClients.length === 0) return;
    try {
        const batch = writeBatch(db);
        let updated = 0; let created = 0;
        newClients.forEach(nc => {
            const existing = clients.find(c => (c.passport && nc.passport && c.passport === nc.passport) || (c.fullName === nc.fullName && c.passport === nc.passport));
            if (existing) {
                batch.update(doc(db, ...PUBLIC_DATA_PATH, 'clients', existing.id), { fullName: existing.fullName||nc.fullName, passport: existing.passport||nc.passport, birthDate: existing.birthDate||nc.birthDate, country: existing.country||nc.country });
                updated++;
            } else {
                batch.set(doc(collection(db, ...PUBLIC_DATA_PATH, 'clients')), { ...nc, visits: 0, lastVisit: new Date().toISOString() });
                created++;
            }
        });
        await batch.commit(); showNotification(`Success! New: ${created}, Merged: ${updated}`, 'success');
    } catch (e) { console.error(e); showNotification("Import failed", 'error'); }
  };

  const handleDeduplicate = async () => {
    if(!confirm("Start auto deduplication?")) return;
    try {
        const map = {}; const duplicates = [];
        clients.forEach(c => { const key = c.passport ? `P:${c.passport}` : `N:${c.fullName}`; if (!map[key]) map[key] = c; else duplicates.push({ original: map[key], duplicate: c }); });
        if (duplicates.length === 0) return showNotification("No duplicates found!");
        const batch = writeBatch(db);
        duplicates.forEach(({ original, duplicate }) => {
            batch.update(doc(db, ...PUBLIC_DATA_PATH, 'clients', original.id), { visits: (original.visits||0) + (duplicate.visits||0), lastVisit: new Date(original.lastVisit) > new Date(duplicate.lastVisit) ? original.lastVisit : duplicate.lastVisit });
            batch.delete(doc(db, ...PUBLIC_DATA_PATH, 'clients', duplicate.id));
        });
        await batch.commit(); showNotification(`Merged ${duplicates.length} duplicates!`, 'success');
    } catch(e) { console.error(e); showNotification("Deduplication failed", 'error'); }
  };

  const handleBulkDeleteClients = async (ids) => {
      try { const batch = writeBatch(db); ids.forEach(id => batch.delete(doc(db, ...PUBLIC_DATA_PATH, 'clients', id))); await batch.commit(); showNotification(`Deleted ${ids.length} clients`, 'success'); } catch (e) { showNotification("Bulk delete failed", 'error'); }
  };
  
  const handleNormalizeCountries = async () => {
      try { const batch = writeBatch(db); let count = 0; clients.forEach(c => { const normalized = getNormalizedCountry(c.country); if (normalized !== c.country) { batch.update(doc(db, ...PUBLIC_DATA_PATH, 'clients', c.id), { country: normalized }); count++; } }); if (count > 0) { await batch.commit(); showNotification(`Normalized ${count} countries`, 'success'); } else showNotification("All normalized"); } catch(e) { showNotification("Normalization failed", 'error'); }
  };

  const handleCreateRoom = async (d) => { setAddRoomModal(false); await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'rooms'), {...d, hostelId: currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId, occupied: 0}); };
  const handleCloneRoom = async (r) => { };
  const handleEditRoom = async (d) => { };
  const handleDeleteRoom = async (r) => { };

  const logTransaction = async (guestId, amounts, staffId) => {
      const { cash, card, qr } = amounts;
      const date = new Date().toISOString();
      const batch = [];
      if(cash > 0) batch.push({ guestId, staffId, amount: cash, method: 'cash', date, hostelId: currentUser.hostelId });
      if(card > 0) batch.push({ guestId, staffId, amount: card, method: 'card', date, hostelId: currentUser.hostelId });
      if(qr > 0) batch.push({ guestId, staffId, amount: qr, method: 'qr', date, hostelId: currentUser.hostelId });
      for(const item of batch) { await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'payments'), item); }
  };

  const handleCheckIn = async (data) => {
      setCheckInModal({open:false, room:null, bedId:null, date:null}); 
      try {
          const safeStaffId = currentUser.id || currentUser.login || 'unknown';
          const docRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'guests'), {...data, staffId: safeStaffId});
          const total = (data.paidCash||0) + (data.paidCard||0) + (data.paidQR||0);
          if (total > 0) await logTransaction(docRef.id, {cash:data.paidCash, card:data.paidCard, qr:data.paidQR}, safeStaffId);
          if (data.status === 'active') { const r = rooms.find(i=>i.id===data.roomId); if(r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), {occupied:(r.occupied||0)+1}); }
          showNotification(data.status==='booking' ? "Booking created" : "Checked In!");
      } catch(e) { showNotification(e.message, 'error'); }
  };
  
  const handleCreateDebt = async (client, amount) => {
      try {
          const safeStaffId = currentUser.id || currentUser.login || 'unknown';
          const debtData = { fullName: client.fullName, passport: client.passport, country: client.country, birthDate: client.birthDate, staffId: safeStaffId, checkInDate: new Date().toISOString(), days: 0, roomId: 'DEBT_ONLY', roomNumber: '-', bedId: '-', pricePerNight: 0, totalPrice: amount, paidCash: 0, paidCard: 0, paidQR: 0, amountPaid: 0, status: 'active', hostelId: currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId };
          await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'guests'), debtData); showNotification("Debt created successfully");
      } catch (e) { showNotification("Error creating debt", 'error'); }
  };

  const handleActivateBooking = async (guest) => {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guest.id), {status: 'active'});
      const r = rooms.find(i=>i.id===guest.roomId); if(r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), {occupied:(r.occupied||0)+1});
      setGuestDetailsModal({open:false, guest:null}); showNotification("Activated");
  };

  const handleGuestUpdate = async (id, d) => { if(guestDetailsModal.open) setGuestDetailsModal({open:false, guest:null}); await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', id), d); };

  const handlePayment = async (guestId, amounts) => {
      try {
          const safeStaffId = currentUser.id || currentUser.login;
          const { cash, card, qr } = amounts;
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), { paidCash: increment(cash), paidCard: increment(card), paidQR: increment(qr), amountPaid: increment(cash+card+qr) });
          await logTransaction(guestId, amounts, safeStaffId);
          setGuestDetailsModal({open:false, guest:null}); showNotification("Payment success");
      } catch(e) { showNotification(e.message, 'error'); }
  };

  const handleCheckOut = async (guest, final) => {
      setGuestDetailsModal({open:false, guest:null});
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guest.id), {...final, status: 'checked_out', checkOutDate: new Date().toISOString()});
      const r = rooms.find(i=>i.id===guest.roomId); if(r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), {occupied:Math.max(0, (r.occupied||1)-1)});
      const refund = (guest.amountPaid || 0) - final.totalPrice; 
      if (refund > 0) sendTelegramMessage(`⚠️ <b>Refund</b>\nGuest: ${guest.fullName}\nAmount: ~${refund}`);
  };

  const handleSplitGuest = async (orig, splitAfterDays, gapDays) => {
      try {
          const price = parseInt(orig.pricePerNight);
          const firstLegDays = parseInt(splitAfterDays);
          const gap = parseInt(gapDays);
          const totalOriginalDays = parseInt(orig.days);
          const remainingDays = totalOriginalDays - firstLegDays;
          if (remainingDays <= 0) return;
          const totalPaid = orig.amountPaid || 0;
          const ratio1 = firstLegDays / totalOriginalDays; const ratio2 = remainingDays / totalOriginalDays;
          const firstLegTotal = firstLegDays * price;
          const stay1 = getStayDetails(orig.checkInDate, firstLegDays);
          
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', orig.id), { days: firstLegDays, totalPrice: firstLegTotal, amountPaid: Math.floor(totalPaid * ratio1), paidCash: Math.floor((orig.paidCash||0) * ratio1), paidCard: Math.floor((orig.paidCard||0) * ratio1), paidQR: Math.floor((orig.paidQR||0) * ratio1), checkOutDate: stay1.end.toISOString() });

          const gapStart = new Date(stay1.end);
          const secondStart = new Date(gapStart); secondStart.setDate(secondStart.getDate() + gap); secondStart.setHours(12, 0, 0, 0);
          const stay2 = getStayDetails(secondStart.toISOString(), remainingDays);
          
          const newGuest = { ...orig, checkInDate: secondStart.toISOString(), checkOutDate: stay2.end.toISOString(), days: remainingDays, pricePerNight: price, totalPrice: remainingDays * price, amountPaid: Math.floor(totalPaid * ratio2), paidCash: Math.floor((orig.paidCash||0) * ratio2), paidCard: Math.floor((orig.paidCard||0) * ratio2), paidQR: Math.floor((orig.paidQR||0) * ratio2), status: 'active', checkInDateTime: null, checkIn: null };
          delete newGuest.id;
          await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'guests'), newGuest);
          showNotification("Split successful!");
      } catch (e) { console.error(e); showNotification("Split Error", 'error'); }
  };

  const handleMoveGuest = async (g, rid, rnum, bid) => { 
      try { await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { roomId: rid, roomNumber: rnum, bedId: bid }); setMoveGuestModal({open: false, guest: null}); setGuestDetailsModal({open: false, guest: null}); showNotification("Moved!"); } catch (e) { showNotification("Error: " + e.message, 'error'); }
  };
  
  const handleDeleteGuest = async (g) => {
      let guestId = typeof g === 'string' ? g : g.id;
      let guestData = typeof g === 'object' ? g : guests.find(guest => guest.id === guestId);
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId));
      if(guestData && guestData.status==='active' && guestData.roomId !== 'DEBT_ONLY') { const r=rooms.find(i=>i.id===guestData.roomId); if(r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), {occupied:Math.max(0,(r.occupied||1)-1)}); }
      setGuestDetailsModal({open:false, guest:null}); showNotification("Deleted");
  };

  const handleDeletePayment = async (id, type) => { if(!confirm("Delete?")) return; await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, type === 'income' ? 'payments' : 'expenses', id)); sendTelegramMessage(`⚠️ <b>Delete Record</b>\nID: ${id}\nType: ${type}`); showNotification("Deleted"); };

  const handleAddExpense = async (d) => { setExpenseModal(false); await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {...d, hostelId: currentUser.role==='admin'?selectedHostelFilter:currentUser.hostelId, staffId:currentUser.id||currentUser.login, date:new Date().toISOString()}); };
  const handleAddTask = async (task) => { await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'tasks'), task); showNotification("Task Added"); };
  const handleCompleteTask = async (id) => { await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'tasks', id), { status: 'done' }); };
  const handleUpdateTask = async (id, updates) => { await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'tasks', id), updates); showNotification("Task Updated"); };
  const handleDeleteTask = async (id) => { await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'tasks', id)); showNotification("Task Deleted"); };
  
  // SHIFT MANAGEMENT
  const handleStartShift = async () => {
      const activeShift = shifts.find(s => s.staffId === currentUser.id && !s.endTime);
      if(activeShift) return showNotification("Shift already started", 'error');
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'), { staffId: currentUser.id, hostelId: currentUser.hostelId, startTime: new Date().toISOString(), endTime: null });
      showNotification("Shift Started");
  };

  const handleTransferShift = async (currentShiftId, targetUserId) => {
      if(!targetUserId) return;
      const batch = writeBatch(db);
      const shiftRef = doc(db, ...PUBLIC_DATA_PATH, 'shifts', currentShiftId);
      batch.update(shiftRef, { endTime: new Date().toISOString() });
      const targetUser = usersList.find(u => u.id === targetUserId);
      const newShiftRef = doc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'));
      batch.set(newShiftRef, { staffId: targetUserId, hostelId: targetUser ? targetUser.hostelId : currentUser.hostelId, startTime: new Date().toISOString(), endTime: null });
      await batch.commit(); showNotification("Shift Transferred");
  };

  // ADMIN SHIFT MANAGEMENT
  const handleAdminAddShift = async (shiftData) => {
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'), shiftData);
      showNotification("Смена добавлена вручную");
  };

  const handleAdminUpdateShift = async (id, data) => {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'shifts', id), data);
      showNotification("Смена обновлена");
  };

  const handleAdminReduceDays = async (g, rd) => { 
      const newDays = parseInt(g.days) - parseInt(rd); const newTotal = newDays * parseInt(g.pricePerNight); const refundAmount = parseInt(rd) * parseInt(g.pricePerNight);
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { days: newDays, totalPrice: newTotal, amountPaid: (g.amountPaid || 0) - refundAmount, paidCash: (g.paidCash || 0) - refundAmount });
      const stay = getStayDetails(g.checkInDate, newDays); await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { checkOutDate: stay.end.toISOString() });
      showNotification("Days reduced");
  };

  const handleAdminReduceDaysNoRefund = async (g, rd) => {
      const newDays = parseInt(g.days) - parseInt(rd); const newTotal = newDays * parseInt(g.pricePerNight);
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { days: newDays, totalPrice: newTotal });
      const stay = getStayDetails(g.checkInDate, newDays); await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { checkOutDate: stay.end.toISOString() });
      showNotification("Reduced (No Refund)");
  };

  const handlePayDebt = async (targets, amount, methods = { cash: amount, card: 0, qr: 0 }) => {
      try {
          const safeStaffId = currentUser.id || currentUser.login; let remaining = amount;
          for (const target of targets) {
              if (remaining <= 0) break;
              const pay = Math.min(remaining, target.currentDebt); const ratio = pay / amount;
              const cashPay = Math.floor(methods.cash * ratio); const cardPay = Math.floor(methods.card * ratio); const qrPay = Math.floor(methods.qr * ratio);
              await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', target.id), { paidCash: increment(cashPay), paidCard: increment(cardPay), paidQR: increment(qrPay), amountPaid: increment(pay) });
              await logTransaction(target.id, { cash: cashPay, card: cardPay, qr: qrPay }, safeStaffId); remaining -= pay;
          }
          showNotification("Debt Paid!");
      } catch(e) { showNotification("Error paying debt", 'error'); }
  };

  const handleAdminAdjustDebt = async (guestId, adjustment) => {
      try { await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), { totalPrice: increment(adjustment) }); showNotification("Debt Adjusted"); } catch(e) { showNotification("Error adjusting", 'error'); }
  };

  const downloadExpensesCSV = () => { alert("Export feature pending") };

  if (isLoadingAuth) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;
  if (!currentUser) return <LoginScreen users={usersList} onLogin={handleLogin} onSeed={seedUsers} lang={lang} setLang={setLang} />;

  // --- БЛОКИРОВКА ЭКРАНА ЕСЛИ СМЕНА ЗАНЯТА ---
  if (activeShiftInMyHostel) {
      return <ShiftBlockScreen activeShift={activeShiftInMyHostel} activeUser={activeUserForBlock} currentUser={currentUser} onLogout={handleLogout} onTransferToMe={handleTransferToMe} />;
  }

  const activeUserDoc = usersList.find(u => u.id === currentUser?.id) || currentUser;
  const currentHostelInfo = HOSTELS[currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId] || HOSTELS['hostel1'];
  const t = (k) => TRANSLATIONS[lang][k];

  return (
    <div className="h-screen w-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row overflow-hidden">
      
      <div className="flex-shrink-0">
         <Navigation currentUser={currentUser} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} lang={lang} setLang={setLang} pendingTasksCount={pendingTasksCount} selectedHostelView={selectedHostelFilter} setSelectedHostelView={setSelectedHostelFilter} />
      </div>

      <MobileNavigation currentUser={currentUser} activeTab={activeTab} setActiveTab={setActiveTab} pendingTasksCount={pendingTasksCount} lang={lang} />
      
      {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
      
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        <div className="flex-shrink-0 p-4 md:p-6 pb-0 bg-slate-50 z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        {activeTab === 'dashboard' ? t('dashboard').toUpperCase() : activeTab === 'rooms' ? t('rooms').toUpperCase() : activeTab === 'calendar' ? t('calendar').toUpperCase() : activeTab === 'reports' ? t('reports').toUpperCase() : activeTab === 'debts' ? t('debts').toUpperCase() : activeTab === 'tasks' ? t('tasks').toUpperCase() : activeTab === 'expenses' ? t('expenses').toUpperCase() : activeTab === 'clients' ? t('clients').toUpperCase() : activeTab === 'staff' ? t('staff').toUpperCase() : activeTab === 'shifts' ? t('shifts').toUpperCase() : ''}
                    </h2>
                    <div className="flex items-center gap-4 text-slate-500 text-sm mt-1">
                        <div className="flex items-center gap-1"><MapPin size={14}/> {HOSTELS[currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId]?.name || 'All'}</div>
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 border ${isOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            {isOnline ? <Wifi size={12}/> : <WifiOff size={12}/>}
                            {isOnline ? 'ONLINE' : 'OFFLINE'}
                        </div>
                        {currentUser.role === 'cashier' && (
                            <div className="bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px] font-bold text-slate-600 flex items-center gap-1">
                                <User size={10}/>
                                Current: {usersList.find(u => shifts.find(s => s.staffId === u.id && !s.endTime))?.name || "Nobody"}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {currentUser.role === 'cashier' && (<><Button variant="danger" icon={Wallet} onClick={() => setExpenseModal(true)}>{t('expense')}</Button><Button variant="primary" icon={CheckCircle2} onClick={() => setCheckInModal({ open: true, room: null, bedId: null, date: null })}>{t('checkin')}</Button><Button variant="secondary" icon={Power} onClick={() => setShiftModal(true)}>{t('shift')}</Button></>)}
                    {(currentUser.role === 'admin' || currentUser.role === 'super' || currentUser.role === 'viewer') && (
                        <div className="flex bg-white p-1 rounded-xl border border-slate-300 shadow-sm">
                            {(() => {
                                // Determine which hostels to display based on role
                                const availableHostels = currentUser.role === 'viewer' 
                                    ? (currentUser.viewHostels || [currentUser.hostelId])
                                    : Object.keys(HOSTELS);
                                
                                return availableHostels.map(hid => (
                                    <button key={hid} onClick={() => setSelectedHostelFilter(hid)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedHostelFilter === hid ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>{HOSTELS[hid].name}</button>
                                ));
                            })()}
                        </div>
                    )}
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 pt-2 pb-20">
            {activeTab === 'dashboard' && (currentUser.role === 'admin' || currentUser.role === 'viewer') && (
                <div className="space-y-8 animate-in fade-in">
                    {/* Передаем currentHostelId для правильной фильтрации */}
                    <DashboardStats rooms={filteredRooms} guests={guests} payments={payments} lang={lang} currentHostelId={selectedHostelFilter} />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <ChartsSection guests={filteredGuests} rooms={filteredRooms} payments={filteredPayments} lang={lang} />
                    </div>
                </div>
            )}
            
            {activeTab === 'rooms' && ( <div className="space-y-6"><div className="flex justify-between items-center"><div className="flex items-center gap-2 text-slate-500 text-sm"><CheckCircle2 size={18} /> <span>Click bed for actions</span></div>{(currentUser.role === 'admin' || currentUser.role === 'super') && <Button icon={PlusCircle} onClick={() => setAddRoomModal(true)}>Add Room</Button>}</div><div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">{filteredRooms.map(room => (<RoomCardChess key={room.id} room={room} guests={filteredGuests.filter(g => g.roomId === room.id)} isAdmin={currentUser.role === 'admin' || currentUser.role === 'super'} onEdit={() => setEditRoomModal({ open: true, room })} onClone={() => handleCloneRoom(room)} onDelete={() => handleDeleteRoom(room)} lang={lang} onBedClick={(bedId, guest, isGhost) => { 
                if (guest) {
                    if (isGhost) {
                        setGuestDetailsModal({ open: true, guest });
                    } else {
                        setGuestDetailsModal({ open: true, guest });
                    }
                } else { 
                    if(currentUser.role === 'admin' || currentUser.role === 'super') alert("Admin cannot check-in"); 
                    else setCheckInModal({ open: true, room, bedId, date: null }); 
                } 
            }} />))}</div></div>)}
            
            {activeTab === 'calendar' && (
                <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
                    <CalendarView rooms={filteredRooms} guests={filteredGuests} onSlotClick={(room, bedId, guest, dateISO) => { 
                        if (guest) setGuestDetailsModal({ open: true, guest }); 
                        else { 
                            if(currentUser.role === 'admin' || currentUser.role === 'super') alert("Admin cannot check-in"); 
                            else setCheckInModal({ open: true, room, bedId, date: dateISO }); 
                        } 
                    }} lang={lang} currentUser={currentUser} onDeleteGuest={handleDeleteGuest} />
                </div>
            )}
            
            {activeTab === 'reports' && (currentUser.role === 'admin' || currentUser.role === 'super') && <ReportsView payments={filteredPayments} expenses={filteredExpenses} users={filteredUsersForReports} guests={filteredGuests} currentUser={currentUser} onDeletePayment={handleDeletePayment} lang={lang} />}
            {activeTab === 'debts' && <DebtsView guests={filteredGuests} users={usersList} lang={lang} onPayDebt={handlePayDebt} currentUser={currentUser} onAdminAdjustDebt={handleAdminAdjustDebt} clients={clients} onCreateDebt={handleCreateDebt} />}
            
            {activeTab === 'tasks' && <TaskManager tasks={filteredTasks} users={usersList} currentUser={currentUser} onAddTask={handleAddTask} onCompleteTask={handleCompleteTask} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} lang={lang} selectedHostelFilter={selectedHostelFilter} />}

            {/* ОБНОВЛЕННЫЙ SHIFTS VIEW */}
            {activeTab === 'shifts' && (
                <ShiftsView 
                    shifts={shifts} 
                    users={usersList} 
                    currentUser={currentUser} 
                    onStartShift={handleStartShift} 
                    onEndShift={handleEndShift} 
                    onTransferShift={handleTransferShift} 
                    lang={lang} 
                    hostelId={currentUser.hostelId} 
                    onAdminAddShift={handleAdminAddShift} 
                    onAdminUpdateShift={handleAdminUpdateShift} 
                />
            )}

            {activeTab === 'clients' && (currentUser.role === 'admin' || currentUser.role === 'super') && <ClientsView clients={clients} onUpdateClient={handleUpdateClient} onImportClients={handleImportClients} onDeduplicate={handleDeduplicate} onBulkDelete={handleBulkDeleteClients} onNormalizeCountries={handleNormalizeCountries} lang={lang} currentUser={currentUser} />}
            {activeTab === 'staff' && currentUser.role === 'admin' && <StaffView users={usersList} onAdd={handleAddUser} onDelete={handleDeleteUser} lang={lang} />}
            {activeTab === 'expenses' && (currentUser.role === 'admin' || currentUser.role === 'super') && (
                <div className="animate-in slide-in-from-bottom-2 space-y-6">
                    <div className="flex justify-between items-center"><h3 className="text-lg font-bold">{t('expenses')}</h3><div className="flex gap-2"><Button icon={Download} variant="secondary" onClick={downloadExpensesCSV}>Export</Button><Button icon={Plus} onClick={() => setExpenseModal(true)}>{t('expense')}</Button></div></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{filteredExpenses.length > 0 ? filteredExpenses.map(e => (<div key={e.id} className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm flex flex-col justify-between"><div><div className="flex justify-between items-start mb-2"><span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-600">{e.category}</span><span className="text-xs text-slate-400">{new Date(e.date).toLocaleDateString()}</span></div><p className="font-medium text-slate-800">{e.comment}</p></div><div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center"><span className="font-bold text-rose-600">-{parseInt(e.amount).toLocaleString()}</span><span className="text-xs text-slate-400">{usersList.find(u => u.id === e.staffId)?.name || 'N/A'}</span></div></div>)) : <div className="text-slate-400 col-span-3 text-center py-10">No Expenses</div>}</div>
                </div>
            )}
        </div>
      </main>

      {/* Модальные окна */}
      {checkInModal.open && <CheckInModal initialRoom={checkInModal.room} preSelectedBedId={checkInModal.bedId} initialDate={checkInModal.date} allRooms={filteredRooms} guests={filteredGuests} clients={clients} onClose={() => setCheckInModal({open: false, room: null, bedId: null, date: null})} onSubmit={handleCheckIn} notify={showNotification} lang={lang} />}
      {guestDetailsModal.open && <GuestDetailsModal guest={guestDetailsModal.guest} room={filteredRooms.find(r => r.id === guestDetailsModal.guest.roomId)} currentUser={currentUser} onClose={() => setGuestDetailsModal({open: false, guest: null})} onUpdate={handleGuestUpdate} onPayment={handlePayment} onCheckOut={handleCheckOut} onSplit={handleSplitGuest} onOpenMove={() => setMoveGuestModal({ open: true, guest: guestDetailsModal.guest })} onDelete={handleDeleteGuest} notify={showNotification} onReduceDays={handleAdminReduceDays} onActivateBooking={handleActivateBooking} onReduceDaysNoRefund={handleAdminReduceDaysNoRefund} hostelInfo={currentHostelInfo} lang={lang} />}
      {moveGuestModal.open && <MoveGuestModal guest={moveGuestModal.guest} allRooms={filteredRooms} guests={filteredGuests} onClose={() => setMoveGuestModal({open: false, guest: null})} onMove={handleMoveGuest} notify={showNotification} lang={lang} />}
      {expenseModal && <ExpenseModal onClose={() => setExpenseModal(false)} onSubmit={handleAddExpense} lang={lang} />}
      {addRoomModal && <RoomFormModal title="Add Room" onClose={() => setAddRoomModal(false)} onSubmit={handleCreateRoom} lang={lang} />}
      {editRoomModal.open && <RoomFormModal title="Edit Room" initialData={editRoomModal.room} onClose={() => setEditRoomModal({open: false, room: null})} onSubmit={handleEditRoom} lang={lang} />}
      {shiftModal && <ShiftClosingModal user={activeUserDoc} payments={payments} expenses={filteredExpenses} onClose={() => setShiftModal(false)} onEndShift={handleEndShift} onLogout={handleLogout} notify={showNotification} lang={lang} />}
    </div>
  );
}

export default App;