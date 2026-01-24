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
  increment,
  writeBatch
} from 'firebase/firestore';
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
  CheckSquare
} from 'lucide-react';

// --- STYLES ---
const inputClass = "w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm shadow-sm font-medium text-slate-700 no-spinner";
const labelClass = "block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide ml-1";

// --- TRANSLATIONS ---
const TRANSLATIONS = {
  ru: {
    dashboard: "Дашборд", rooms: "Номера", calendar: "Календарь", reports: "Отчеты", debts: "Долги", tasks: "Задачи", expenses: "Расходы", clients: "Клиенты", staff: "Персонал",
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
    printReport: "Печать отчета"
  },
  uz: {
    dashboard: "Boshqaruv", rooms: "Xonalar", calendar: "Kalendar", reports: "Hisobotlar", debts: "Qarzlar", tasks: "Vazifalar", expenses: "Xarajatlar", clients: "Mijozlar", staff: "Xodimlar",
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
    printReport: "Hisobotni chop etish"
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

const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
}, "hostella");

const APP_ID = 'hostella-multi-v4';
const PUBLIC_DATA_PATH = ['artifacts', APP_ID, 'public', 'data'];

// --- DEFAULT DATA ---
const DEFAULT_USERS = [
  { login: 'admin', pass: 'admin', name: 'Aziz Yuldashev', role: 'admin', hostelId: 'all' },
  { login: 'dilafruz', pass: '123', name: 'Dilafruz', role: 'cashier', hostelId: 'hostel1' },
  { login: 'nargiza', pass: '123', name: 'Nargiza', role: 'cashier', hostelId: 'hostel1' },
  { login: 'fazliddin', pass: '123', name: 'Fazliddin', role: 'cashier', hostelId: 'hostel2' },
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
  "Сирия", "Словакия", "Словения", "США", "Таиланд", "Туркмения", "Турция", "Украина", "Филиппины", "Финляндия", 
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
    const hasTime = checkInIsoOrDate.includes('T') && checkInIsoOrDate.length > 10;
    
    let arrivalHour = start.getHours();
    
    const startDateNormalized = new Date(start);
    startDateNormalized.setHours(0,0,0,0);
    
    const end = new Date(start);
    
    if (hasTime && arrivalHour >= 0 && arrivalHour < 7) {
         end.setDate(end.getDate() + (parseInt(days) - 1));
    } else {
         end.setDate(end.getDate() + parseInt(days));
    }
    
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

const exportToExcel = (data, filename) => {
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
                <td>${row.staff}</td>
                <td class="amount">${parseInt(row.amount).toLocaleString()}</td>
                <td>${row.method}</td>
                <td>${row.comment}</td>
            </tr>
        `;
    });

    tableContent += `</tbody></table></body></html>`;

    const blob = new Blob([tableContent], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const printDocument = (type, guest, hostel) => {
    const w = window.open('', '', 'width=800,height=600');
    w.document.write('<html><head><title>Print</title></head><body>');
    w.document.write(`<h2>${type}</h2><p>Guest: ${guest.fullName}</p>`);
    w.document.write('</body></html>');
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
    // Check map for translation
    if (COUNTRY_MAP[lower]) return COUNTRY_MAP[lower];
    // Check if it's already a valid Russian country name (case insensitive check)
    const valid = COUNTRIES.find(c => c.toLowerCase() === lower);
    if (valid) return valid;
    // Default to clean input
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
       { id: 'reports', label: t('reports'), icon: FileText, role: 'admin' },
    ];
    const roleCheck = (role) => {
        if (currentUser.role === 'super') return true; 
        if (role === 'all') return true;
        return role === currentUser.role;
    };
    
    // Only show top 5 relevant tabs for mobile to fit screen
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

const Navigation = ({ currentUser, activeTab, setActiveTab, onLogout, lang, setLang, pendingTasksCount }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const tabs = [
       { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard, role: 'admin' },
       { id: 'rooms', label: t('rooms'), icon: BedDouble, role: 'all' },
       { id: 'calendar', label: t('calendar'), icon: CalendarIcon, role: 'all' },
       { id: 'reports', label: t('reports'), icon: FileText, role: 'admin' },
       { id: 'debts', label: t('debts'), icon: Coins, role: 'all' },
       { id: 'tasks', label: t('tasks'), icon: Wrench, role: 'all', badge: pendingTasksCount },
       { id: 'expenses', label: t('expenses'), icon: Wallet, role: 'admin' },
       { id: 'clients', label: t('clients'), icon: Users, role: 'admin' },
       { id: 'staff', label: t('staff'), icon: UserCog, role: 'admin' },
    ];
    const roleCheck = (role) => {
        if (currentUser.role === 'super') return true; 
        if (role === 'all') return true;
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
                      <div className="text-[10px] text-slate-500 capitalize uppercase tracking-wider">{currentUser.role === 'super' ? 'Super Admin' : (currentUser.role === 'admin' ? t('admin') : t('cashier'))}</div>
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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="absolute top-4 right-4 flex gap-2">
                 <button onClick={()=>setLang('ru')} className={`px-3 py-1 rounded ${lang==='ru'?'bg-indigo-600 text-white':'bg-white'}`}>RU</button>
                 <button onClick={()=>setLang('uz')} className={`px-3 py-1 rounded ${lang==='uz'?'bg-indigo-600 text-white':'bg-white'}`}>UZ</button>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-100">
                <div className="flex flex-col items-center mb-8">
                    <div className="bg-indigo-600 p-3 rounded-2xl mb-4 shadow-lg shadow-indigo-200">
                        <Building2 className="text-white" size={32}/>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Hostella App</h1>
                    <p className="text-slate-500">Система управления хостелом</p>
                </div>
                <form onSubmit={handleAuth} className="space-y-5">
                    <div><label className={labelClass}>{t('login')}</label><input className={inputClass} value={login} onChange={e=>setLogin(e.target.value)} placeholder="..." /></div>
                    <div><label className={labelClass}>{t('pass')}</label><input type="password" className={inputClass} value={pass} onChange={e=>setPass(e.target.value)} placeholder="•••••••" /></div>
                    <Button type="submit" className="w-full py-3.5 text-lg shadow-lg shadow-indigo-100">{t('enter')}</Button>
                </form>
                <div className="mt-8 text-center pt-6 border-t border-slate-100">
                    <button onClick={onSeed} className="text-xs text-slate-400 hover:text-indigo-500 transition-colors">{t('initDb')}</button>
                </div>
            </div>
        </div>
    );
};

const DashboardStats = ({ rooms, guests, payments, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const totalCapacity = rooms.reduce((acc, r) => acc + parseInt(r.capacity), 0);
    const now = new Date();
    
    const activeGuests = guests.filter(g => {
        if (g.status !== 'active') return false;
        const stay = getStayDetails(g.checkInDate || g.checkInDateTime || g.checkIn, g.days);
        const todayNoTime = new Date();
        todayNoTime.setHours(0,0,0,0);
        const guestStart = new Date(stay.startDateNormalized);
        const guestEnd = new Date(stay.end);
        guestEnd.setHours(0,0,0,0);
        return todayNoTime >= guestStart && todayNoTime < guestEnd;
    }).length;
    
    const todayStr = getLocalDateString(new Date());
    const guestsToday = guests.filter(g => {
        const d = g.checkInDate || g.checkInDateTime || g.checkIn;
        return d && d.startsWith(todayStr) && g.status === 'active';
    });
    
    const revenueToday = payments 
        ? payments
            .filter(p => p.date && p.date.startsWith(todayStr))
            .reduce((acc, p) => acc + (parseInt(p.amount) || 0), 0)
        : 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="flex flex-col justify-between h-32 relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Users size={64}/></div>
                <div><div className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('guests')}</div><div className="text-2xl font-bold text-slate-800 mt-1">{activeGuests}</div></div>
                <div className="text-xs text-slate-400 mt-auto">{t('today')}</div>
            </Card>
            <Card className="flex flex-col justify-between h-32 relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><BedDouble size={64}/></div>
                <div><div className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('occupancy')}</div><div className="text-2xl font-bold text-indigo-600 mt-1">{totalCapacity ? Math.round((activeGuests/totalCapacity)*100) : 0}%</div></div>
                <div className="text-xs text-slate-400 mt-auto">{activeGuests} / {totalCapacity}</div>
            </Card>
            <Card className="flex flex-col justify-between h-32 relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Wallet size={64}/></div>
                <div><div className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('revenue')} ({t('today')})</div><div className="text-2xl font-bold text-emerald-600 mt-1">{revenueToday.toLocaleString()}</div></div>
                <div className="text-xs text-slate-400 mt-auto">New: {guestsToday.length}</div>
            </Card>
            <Card className="flex flex-col justify-between h-32 relative overflow-hidden group">
                <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity"><Building2 size={64}/></div>
                <div><div className="text-slate-500 text-xs font-bold uppercase tracking-wider">{t('rooms')}</div><div className="text-2xl font-bold text-slate-800 mt-1">{rooms.length}</div></div>
                <div className="text-xs text-slate-400 mt-auto">{t('total')}</div>
            </Card>
        </div>
    );
};

const ChartsSection = ({ guests, rooms, payments = [], lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [period, setPeriod] = useState(7);
    const totalCapacity = rooms.reduce((acc, r) => acc + parseInt(r.capacity), 0);
    const activeGuests = guests.filter(g => {
        if (g.status !== 'active') return false;
        const stay = getStayDetails(g.checkInDate || g.checkInDateTime || g.checkIn, g.days);
        const todayNoTime = new Date();
        todayNoTime.setHours(0,0,0,0);
        const guestStart = new Date(stay.startDateNormalized);
        const guestEnd = new Date(stay.end);
        guestEnd.setHours(0,0,0,0);
        return todayNoTime >= guestStart && todayNoTime < guestEnd;
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
                         if (!guest.checkInDate.includes('T')) checkIn.setHours(12, 0, 0, 0);
                         targetDateObj = new Date(checkIn.getTime() + (parseInt(guest.days) * 24 * 60 * 60 * 1000));
                    }
                    const isExpired = targetDateObj && targetDateObj < new Date();

                    let bgClass = 'bg-white border-slate-100 hover:border-indigo-300 hover:shadow-sm';
                    let badgeClass = 'bg-slate-100 text-slate-400';
                    let textClass = 'text-slate-700';
                    let showTimer = false;

                    if (guest && !isBooking) {
                         if (isExpired && debt <= 0) {
                             bgClass = 'bg-slate-200 border-slate-300';
                             badgeClass = 'bg-slate-300 text-slate-500';
                             textClass = 'text-slate-500';
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
                         if (diffMs > 0 && diffMs < twelveHoursMs) {
                             showTimer = true;
                         }
                    } else if (isBooking) {
                        bgClass = 'bg-amber-50 border-amber-200';
                        badgeClass = 'bg-white/50 text-amber-600';
                        textClass = 'text-amber-900';
                    } else if (futureGuest) {
                        bgClass = 'bg-slate-50 border-slate-200 border-dashed';
                    }

                    return (
                        <div key={bedId} onClick={() => onBedClick(bedId, guest)}
                             className={`cursor-pointer rounded-xl p-3 border transition-all relative min-h-[90px] flex flex-col justify-between group ${bgClass}`}>
                            <div className="flex justify-between items-start">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${badgeClass}`}>
                                    {bedId} {bedId % 2 === 0 ? 'Up' : 'Dn'}
                                </span>
                                {guest && (isBooking ? <Clock size={14} className="text-amber-500"/> : <User size={14} className={isExpired && debt <=0 ? 'text-slate-400' : (debt > 0 ? 'text-rose-400' : 'text-emerald-400')}/>)}
                            </div>
                            {guest ? (
                                <div className="mt-2 overflow-hidden">
                                    <div className={`font-bold text-sm leading-tight truncate ${textClass}`}>{guest.fullName}</div>
                                    <div className="flex justify-between items-end mt-1">
                                         <div className="text-[10px] opacity-70">
                                            {isBooking ? t('booking') : `${guest.days} ${t('days')}`} 
                                         </div>
                                         {!isBooking && debt > 0 && <div className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1 rounded">-{debt.toLocaleString()}</div>}
                                    </div>
                                    {showTimer && targetDateObj && <CountdownTimer targetDate={targetDateObj} lang={lang} />}
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

    const getGuestBlockStyle = (guest) => {
        let checkInDate = new Date(guest.checkInDate || guest.checkInDateTime || guest.checkIn);
        if (guest.checkInDate && !guest.checkInDate.includes('T')) {
            checkInDate.setHours(12, 0, 0, 0);
        }

        const calendarStart = new Date(days[0].str);
        calendarStart.setHours(0,0,0,0);
        
        const calendarEnd = new Date(days[days.length-1].str);
        calendarEnd.setHours(23,59,59,999);
        
        const guestDurationMs = parseInt(guest.days) * 24 * 60 * 60 * 1000;
        const checkOutDate = new Date(checkInDate.getTime() + guestDurationMs);

        if (checkOutDate < calendarStart || checkInDate > calendarEnd) return null;

        const msPerDay = 1000 * 60 * 60 * 24;
        const totalCalendarMs = msPerDay * calendarDaysCount;
        
        let startTimeDiff = checkInDate.getTime() - calendarStart.getTime();
        
        const leftPercent = (startTimeDiff / totalCalendarMs) * 100;
        const widthPercent = (guestDurationMs / totalCalendarMs) * 100;

        return { leftPercent, widthPercent };
    };

    const getBlockColorClass = (guest) => {
        if (guest.status === 'booking') return 'bg-amber-400 border-amber-500';
        if (guest.status === 'checked_out') return 'bg-slate-400 border-slate-500';
        
        const totalPrice = guest.totalPrice || 0;
        const totalPaid = getTotalPaid(guest);
        const debt = totalPrice - totalPaid;

        if (debt <= 0) return 'bg-emerald-500 border-emerald-600';
        return 'bg-rose-500 border-rose-600';
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
            {/* Nav Header */}
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

            {/* Calendar Grid */}
            <div className="flex-1 overflow-auto relative">
                <div className="min-w-[1600px]">
                    
                    {/* Header Dates */}
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

                    {/* Room Rows */}
                    {rooms.map(room => {
                        const isCollapsed = collapsedRooms[room.id];
                        const roomLabel = lang === 'uz' ? `Xona №${room.number}` : `Комната №${room.number}`;
                        
                        return (
                            <div key={room.id} className="border-b border-slate-200">
                                {/* Room Label */}
                                <div 
                                    className="flex items-center justify-between px-3 py-2 bg-slate-100 hover:bg-slate-200 cursor-pointer font-bold text-slate-700 text-sm sticky left-0 z-30 border-r border-slate-200 w-40 border-b border-slate-200"
                                    onClick={() => toggleRoom(room.id)}
                                >
                                    <span>{roomLabel}</span>
                                    {isCollapsed ? <ChevronDown size={16}/> : <ChevronUp size={16}/>}
                                </div>

                                {/* Beds */}
                                {!isCollapsed && Array.from({length: room.capacity}, (_, i) => i + 1).map(bedId => {
                                    const bedGuests = relevantGuests.filter(g => g.roomId === room.id && String(g.bedId) === String(bedId));
                                    
                                    return (
                                        <div key={bedId} className="flex h-16 border-b border-slate-50 last:border-b-0 relative">
                                            <div className="w-40 px-4 flex items-center justify-between border-r border-slate-200 bg-white sticky left-0 z-30 text-xs font-bold text-slate-500">
                                                <span>{t('bed')} {bedId}</span>
                                                <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-400">{bedId % 2 === 0 ? 'Up' : 'Dn'}</span>
                                            </div>

                                            <div className="flex-1 relative">
                                                {/* Background Grid */}
                                                <div className="absolute inset-0 flex">
                                                    {days.map(d => (
                                                        <div 
                                                            key={d.str} 
                                                            className={`flex-1 min-w-[80px] border-r border-slate-100 h-full flex ${['сб','вс'].includes(d.week) ? 'bg-rose-50' : ''}`}
                                                        >
                                                            <div 
                                                                className="w-1/2 h-full cursor-pointer hover:bg-indigo-50 border-r border-slate-200/30" 
                                                                onClick={() => handleEmptyCellClick(room, bedId, d.str, false)}
                                                            />
                                                            <div 
                                                                className="w-1/2 h-full cursor-pointer hover:bg-indigo-50" 
                                                                onClick={() => handleEmptyCellClick(room, bedId, d.str, true)}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Guest Blocks */}
                                                {bedGuests.map(guest => {
                                                    const styleData = getGuestBlockStyle(guest);
                                                    if (!styleData) return null;
                                                    
                                                    const bgClass = getBlockColorClass(guest);
                                                    const debt = (guest.totalPrice || 0) - getTotalPaid(guest);
                                                    const hasDebt = debt > 0;
                                                    const isCheckedOut = guest.status === 'checked_out';

                                                    return (
                                                        <div 
                                                            key={guest.id}
                                                            className={`absolute top-1 bottom-1 z-20 rounded-md shadow-sm cursor-pointer hover:z-50 hover:shadow-lg border group/block overflow-visible ${bgClass} flex items-center`}
                                                            style={{
                                                                left: `${styleData.leftPercent}%`,
                                                                width: `${styleData.widthPercent}%`
                                                            }}
                                                            onClick={(e) => { e.stopPropagation(); onSlotClick(room, bedId, guest, null); }}
                                                            title={guest.fullName}
                                                        >
                                                            {/* Sticky Name */}
                                                            <div className="sticky left-0 pl-1 pr-1 flex flex-col justify-center h-full w-full">
                                                                <span className="font-bold text-[10px] text-white whitespace-nowrap overflow-visible px-1.5 py-0.5 rounded-sm bg-black/40 w-fit block relative z-50">
                                                                    {guest.status === 'booking' && '🕰 '}{guest.fullName}
                                                                </span>
                                                                
                                                                {!isCheckedOut && hasDebt && (
                                                                    <span className="text-[9px] font-bold mt-0.5 px-1.5 py-px rounded w-fit bg-white text-rose-600 shadow-sm border border-rose-200 relative z-40">
                                                                        -{debt.toLocaleString()}
                                                                    </span>
                                                                )}
                                                                {!isCheckedOut && !hasDebt && (
                                                                    <span className="text-[9px] font-bold mt-0.5 px-1 py-px rounded w-fit bg-white/90 text-emerald-700 shadow-sm relative z-40">
                                                                        ✓ OK
                                                                    </span>
                                                                )}
                                                                {isCheckedOut && (
                                                                     <span className="text-[9px] text-white/90 italic ml-1">OUT</span>
                                                                )}
                                                            </div>

                                                            {/* Кнопка удаления */}
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
            }).filter(p => p.fullName && p.passport); // Remove empty lines
            
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

const ClientsView = ({ clients, onUpdateClient, onImportClients, onDeduplicate, onBulkDelete, onNormalizeCountries, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [search, setSearch] = useState('');
    const [editingClient, setEditingClient] = useState(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());

    const filtered = clients.filter(c => (c.fullName || '').toLowerCase().includes(search.toLowerCase()) || (c.passport || '').includes(search.toUpperCase()));
    
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(new Set(filtered.map(c => c.id)));
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

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20}/>
                    <input className={`${inputClass} pl-10`} placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="flex gap-2 flex-wrap">
                     <Button icon={Merge} variant="secondary" onClick={onDeduplicate} title="Merge duplicates">{t('deduplicate')}</Button>
                     <Button icon={Globe} variant="secondary" onClick={handleNormalize} title="Fix country names">{t('normalizeCountries')}</Button>
                     <Button icon={FileSpreadsheet} variant="secondary" onClick={() => setIsImportModalOpen(true)}>Import CSV</Button>
                     {selectedIds.size > 0 && <Button icon={Trash2} variant="danger" onClick={handleBulkDelete}>{t('deleteSelected')}</Button>}
                </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
                 <table className="w-full text-sm text-left min-w-[600px]">
                     <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                         <tr>
                             <th className="p-4 w-10">
                                 <input type="checkbox" onChange={handleSelectAll} checked={selectedIds.size > 0 && selectedIds.size === filtered.length} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"/>
                             </th>
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
                         {filtered.map(c => (
                             <tr key={c.id} className={selectedIds.has(c.id) ? 'bg-indigo-50' : ''}>
                                 <td className="p-4">
                                     <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => handleSelect(c.id)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"/>
                                 </td>
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
        
        // --- FIX: Filter out 0 amounts ---
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
        exportToExcel(exportData, `Otchet_${filters.hostelId || 'All'}.xls`);
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

const CheckInModal = ({ initialRoom, preSelectedBedId, initialDate, allRooms, guests, clients, onClose, onSubmit, notify, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [selectedRoomId, setSelectedRoomId] = useState(initialRoom?.id || allRooms[0]?.id || '');
    const room = allRooms.find(r => r.id === selectedRoomId);
    
    const [searchTerm, setSearchTerm] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    
    const now = new Date();
    const todayStr = getLocalDateString(now);
    
    const yesterdayStr = getLocalDateString(new Date(now.getTime() - 24 * 60 * 60 * 1000));
    const minDate = now.getHours() < 12 ? yesterdayStr : todayStr;

    const [form, setForm] = useState({
        fullName: '', birthDate: '', passport: '', country: 'Узбекистан',
        bedId: String(preSelectedBedId || '1'),
        checkInDate: initialDate || todayStr, 
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
            if (form.checkInDate < minDate) return notify("Date Error!", 'error');
            if (!isBooking && totalPaid > totalPrice) return notify("Paid > Price!", 'error');

            const selectedDate = new Date(form.checkInDate);
            const now = new Date();
            if (form.checkInDate === getLocalDateString(now)) {
                 if (initialDate && initialDate.includes('T')) {
                     const specificTime = new Date(initialDate);
                     selectedDate.setHours(specificTime.getHours(), specificTime.getMinutes(), 0, 0);
                 } else {
                     selectedDate.setHours(now.getHours(), now.getMinutes(), 0, 0);
                 }
            } else {
                selectedDate.setHours(12,0,0,0);
            }
            
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
                checkInDate: selectedDate.toISOString(), 
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
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full">
                        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-slate-100">
                            <User className="text-indigo-600" size={20}/>
                            <h4 className="font-bold text-slate-800">{t('guestName')}</h4>
                        </div>
                        <div className="space-y-5">
                                                        <div className="relative">
                                <label className={labelClass}>{t('guestName')} (Search DB)</label>
                                <div className="relative">
                                    <input className={`${inputClass} pl-10 py-3 text-lg`} value={form.fullName} onChange={handleNameChange} placeholder="IVANOV IVAN" onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} />
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
                                <div><label className={labelClass}>{t('passport')}</label><input className={`${inputClass} uppercase font-mono`} value={form.passport} onChange={e => setForm({...form, passport: e.target.value.toUpperCase()})} placeholder="AA1234567" /></div>
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
                                    min={minDate}
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
        const today = new Date(); const checkIn = new Date(guest.checkInDate); const daysStayed = Math.max(1, Math.ceil((today - checkIn) / (1000 * 60 * 60 * 24))); const actualCost = daysStayed * parseInt(guest.pricePerNight); const balance = totalPaid - actualCost;
        if (balance < 0) return notify(`Error! Debt: ${Math.abs(balance).toLocaleString()}`, 'error'); const refund = checkoutManualRefund ? parseInt(checkoutManualRefund) : Math.max(0, balance); const finalData = { totalPrice: actualCost, paidCash: (guest.paidCash || 0) - refund }; onCheckOut(guest, finalData); 
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
        const now = new Date();
        if (newStartDate === getLocalDateString(now)) {
             start.setHours(now.getHours(), now.getMinutes(), 0, 0);
        } else {
             start.setHours(12,0,0,0);
        }
        const stay = getStayDetails(start.toISOString(), guest.days);
        onUpdate(guest.id, { checkInDate: start.toISOString(), checkOutDate: stay.end.toISOString() });
        notify("Date Changed!");
        setActiveAction(null);
    }
    const today = new Date(); const checkIn = new Date(guest.checkInDate); const daysStayed = Math.max(1, Math.ceil((today - checkIn) / (1000 * 60 * 60 * 24))); const actualCost = daysStayed * parseInt(guest.pricePerNight); const balance = totalPaid - actualCost;

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
                <div className={`${isBooking ? 'bg-amber-500' : (isCheckedOut ? 'bg-slate-500' : 'bg-slate-900')} text-white p-6 flex justify-between items-start`}>
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
                                <div className="flex items-center gap-2"><h2 className="text-xl font-bold">{guest.fullName}</h2><button onClick={() => setIsEditing(true)} className="p-1 hover:bg-white/20 rounded"><Edit size={14}/></button></div>
                                <div className="flex gap-4 text-sm text-white/70 mt-1 flex-wrap"><span>Room {guest.roomNumber}</span><span>Bed {guest.bedId}</span><span>{new Date(guest.checkInDate).toLocaleDateString()}</span><span>{guest.passport}</span></div>
                            </>
                        )}
                    </div>
                    <button onClick={onClose}><XCircle className="text-white/60 hover:text-white"/></button>
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
                             <Button variant={activeAction === 'pay' ? 'primary' : 'secondary'} onClick={() => setActiveAction(activeAction === 'pay' ? null : 'pay')} disabled={debt <= 0}>{t('payment')}</Button>
                             <Button variant={activeAction === 'extend' ? 'primary' : 'secondary'} onClick={() => setActiveAction(activeAction === 'extend' ? null : 'extend')}>{t('extend')}</Button>
                             {!isCheckedOut && <Button variant={activeAction === 'split' ? 'primary' : 'secondary'} onClick={() => setActiveAction(activeAction === 'split' ? null : 'split')} title="Split"><Split size={18}/></Button>}
                             {!isCheckedOut && <Button variant={activeAction === 'checkout' ? 'primary' : 'secondary'} onClick={() => setActiveAction(activeAction === 'checkout' ? null : 'checkout')} className="text-rose-600 border-rose-300 hover:bg-rose-50">{t('checkout')}</Button>}
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
                                {!isCheckedOut && <div className="flex justify-center"><Button variant="ghost" icon={ArrowLeftRight} onClick={onOpenMove}>{t('move')}</Button></div>}
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
                                <div className="text-sm space-y-1 pb-3 border-b border-slate-300"><div className="flex justify-between"><span>Days:</span> <b>{daysStayed}</b></div><div className="flex justify-between"><span>Fact:</span> <b>{actualCost.toLocaleString()}</b></div><div className="flex justify-between"><span>Paid:</span> <b>{totalPaid.toLocaleString()}</b></div></div>
                                {balance < 0 ? (<div className="bg-rose-100 text-rose-800 p-3 rounded-lg text-center font-bold border border-rose-200">Debt: {Math.abs(balance).toLocaleString()} <br/><span className="text-xs font-normal">Pay before checkout.</span></div>) : (<div className="bg-emerald-100 text-emerald-800 p-3 rounded-lg border border-emerald-200"><div className="text-center font-bold mb-2">Refund: {balance.toLocaleString()}</div>{balance > 0 && <div><label className={`${labelClass} mb-1`}>{t('manualRefund')}</label><input type="number" className={inputClass} value={checkoutManualRefund} placeholder={balance} onChange={e => setCheckoutManualRefund(e.target.value)} /></div>}</div>)}
                                <Button variant="danger" className="w-full" onClick={handleDoCheckout} disabled={balance < 0}>{t('checkout')}</Button>
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
        onEndShift();
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
    
    const EXPENSE_CATEGORIES = {
        ru: ['Хозтовары', 'Продукты', 'Ремонт', 'Зарплата', 'Коммунальные', 'Прочее'],
        uz: ['Хўжалик буюмлари', 'Озиқ-овқат', 'Таъмирлаш', 'Иш ҳақи', 'Коммунал', 'Бошқа']
    };
    
    const categories = EXPENSE_CATEGORIES[lang];
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
      handleLogout();
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

    const u1 = onSnapshot(roomsCol, { includeMetadataChanges: true }, (snap) => { setPermissionError(false); setRooms(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => parseInt(a.number) - parseInt(b.number))); setIsOnline(!snap.metadata.fromCache); }, (err) => { if (err.code === 'permission-denied') setPermissionError(true); setIsOnline(false); });
    const u2 = onSnapshot(guestsCol, (snap) => setGuests(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => new Date(b.checkInDate) - new Date(a.checkInDate))));
    const u3 = onSnapshot(expensesCol, (snap) => setExpenses(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => new Date(b.date) - new Date(a.date))));
    const u4 = onSnapshot(clientsCol, (snap) => setClients(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => a.fullName.localeCompare(b.fullName))));
    const u5 = onSnapshot(paymentsCol, (snap) => setPayments(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    const u6 = onSnapshot(tasksCol, (snap) => setTasks(snap.docs.map(d => ({id: d.id, ...d.data()}))));

    return () => { unsubUsers(); u1(); u2(); u3(); u4(); u5(); u6(); };
  }, [firebaseUser, currentUser]);

  const seedUsers = async () => { if (usersList.length === DEFAULT_USERS.length && usersList[0].id === undefined) { try { for(const u of DEFAULT_USERS) { await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'users'), u); } alert("Init done"); } catch(e) {} } };
  const handleAddUser = async (d) => { await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'users'), d); };
  const handleDeleteUser = async (id) => { if(confirm("Del?")) await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', id)); };

  const filterByHostel = (items) => {
    if (!currentUser) return [];
    if (currentUser.role === 'super') return items;
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

  const handleUpdateClient = async (id, d) => { await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', id), d); showNotification("Updated"); };
  const handleImportClients = async (newClients) => {
    if (newClients.length === 0) return;
    try {
        const batch = writeBatch(db);
        let updated = 0;
        let created = 0;

        newClients.forEach(nc => {
            const existing = clients.find(c => 
                (c.passport && nc.passport && c.passport === nc.passport) || 
                (c.fullName === nc.fullName && c.passport === nc.passport)
            );

            if (existing) {
                const docRef = doc(db, ...PUBLIC_DATA_PATH, 'clients', existing.id);
                const merged = {
                    fullName: existing.fullName || nc.fullName,
                    passport: existing.passport || nc.passport,
                    birthDate: existing.birthDate || nc.birthDate,
                    country: existing.country || nc.country,
                    visits: existing.visits,
                    lastVisit: existing.lastVisit
                };
                batch.update(docRef, merged);
                updated++;
            } else {
                const docRef = doc(collection(db, ...PUBLIC_DATA_PATH, 'clients'));
                batch.set(docRef, { ...nc, visits: 0, lastVisit: new Date().toISOString() });
                created++;
            }
        });

        await batch.commit();
        showNotification(`Success! New: ${created}, Merged: ${updated}`, 'success');
    } catch (e) {
        console.error(e);
        showNotification("Import failed", 'error');
    }
  };

  const handleDeduplicate = async () => {
    if(!confirm("Start auto deduplication? This will merge clients with same Passport or exact Full Name.")) return;
    
    try {
        const map = {};
        const duplicates = [];
        clients.forEach(c => {
            const key = c.passport ? `P:${c.passport}` : `N:${c.fullName}`;
            if (!map[key]) {
                map[key] = c;
            } else {
                duplicates.push({ original: map[key], duplicate: c });
            }
        });

        if (duplicates.length === 0) return showNotification("No duplicates found!");

        const batch = writeBatch(db);
        let count = 0;

        duplicates.forEach(({ original, duplicate }) => {
            const mergedData = {
                fullName: original.fullName || duplicate.fullName,
                passport: original.passport || duplicate.passport,
                birthDate: original.birthDate || duplicate.birthDate,
                country: original.country || duplicate.country,
                visits: (original.visits || 0) + (duplicate.visits || 0),
                lastVisit: new Date(original.lastVisit) > new Date(duplicate.lastVisit) ? original.lastVisit : duplicate.lastVisit
            };

            const originalRef = doc(db, ...PUBLIC_DATA_PATH, 'clients', original.id);
            batch.update(originalRef, mergedData);
            
            const duplicateRef = doc(db, ...PUBLIC_DATA_PATH, 'clients', duplicate.id);
            batch.delete(duplicateRef);
            
            count++;
        });

        await batch.commit();
        showNotification(`Merged ${count} duplicates!`, 'success');

    } catch(e) {
        console.error(e);
        showNotification("Deduplication failed", 'error');
    }
  };

  const handleBulkDeleteClients = async (ids) => {
      try {
          const batch = writeBatch(db);
          ids.forEach(id => {
              const ref = doc(db, ...PUBLIC_DATA_PATH, 'clients', id);
              batch.delete(ref);
          });
          await batch.commit();
          showNotification(`Deleted ${ids.length} clients`, 'success');
      } catch (e) {
          showNotification("Bulk delete failed", 'error');
      }
  };
  
  const handleNormalizeCountries = async () => {
      try {
          const batch = writeBatch(db);
          let count = 0;
          clients.forEach(c => {
              const normalized = getNormalizedCountry(c.country);
              if (normalized !== c.country) {
                  const ref = doc(db, ...PUBLIC_DATA_PATH, 'clients', c.id);
                  batch.update(ref, { country: normalized });
                  count++;
              }
          });
          
          if (count > 0) {
              await batch.commit();
              showNotification(`Normalized ${count} countries`, 'success');
          } else {
              showNotification("All countries are already normalized");
          }
      } catch(e) {
          showNotification("Normalization failed", 'error');
      }
  };

  const handleCreateRoom = async (d) => { setAddRoomModal(false); await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'rooms'), {...d, hostelId: currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId, occupied: 0}); };
  const handleCloneRoom = async (r) => { };
  const handleEditRoom = async (d) => { };
  const handleDeleteRoom = async (r) => { };

  const logTransaction = async (guestId, amounts, staffId) => {
      const { cash, card, qr } = amounts;
      const date = new Date().toISOString();
      const batch = [];
      // --- FIX: Only log amounts > 0 ---
      if(cash > 0) batch.push({ guestId, staffId, amount: cash, method: 'cash', date });
      if(card > 0) batch.push({ guestId, staffId, amount: card, method: 'card', date });
      if(qr > 0) batch.push({ guestId, staffId, amount: qr, method: 'qr', date });
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
          const debtData = {
              fullName: client.fullName,
              passport: client.passport,
              country: client.country,
              birthDate: client.birthDate,
              staffId: safeStaffId,
              checkInDate: new Date().toISOString(),
              days: 0,
              roomId: 'DEBT_ONLY',
              roomNumber: '-',
              bedId: '-',
              pricePerNight: 0,
              totalPrice: amount,
              paidCash: 0,
              paidCard: 0,
              paidQR: 0,
              amountPaid: 0,
              status: 'active', // Needs to be active to show in debts list
              hostelId: currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId
          };
          
          await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'guests'), debtData);
          showNotification("Debt created successfully");
      } catch (e) {
          showNotification("Error creating debt", 'error');
      }
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
          const paidCash = orig.paidCash || 0;
          const paidCard = orig.paidCard || 0;
          const paidQR = orig.paidQR || 0;
          
          const ratio1 = firstLegDays / totalOriginalDays;
          const ratio2 = remainingDays / totalOriginalDays;

          const firstLegTotal = firstLegDays * price;
          const stay1 = getStayDetails(orig.checkInDate, firstLegDays);
          const newCheckOut = stay1.end.toISOString();

          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', orig.id), {
              days: firstLegDays,
              totalPrice: firstLegTotal,
              amountPaid: Math.floor(totalPaid * ratio1),
              paidCash: Math.floor(paidCash * ratio1),
              paidCard: Math.floor(paidCard * ratio1),
              paidQR: Math.floor(paidQR * ratio1),
              checkOutDate: newCheckOut
          });

          const gapStart = new Date(stay1.end);
          const secondStart = new Date(gapStart);
          secondStart.setDate(secondStart.getDate() + gap); 
          secondStart.setHours(12, 0, 0, 0);

          const stay2 = getStayDetails(secondStart.toISOString(), remainingDays);
          const newGuest = {
              ...orig,
              checkInDate: secondStart.toISOString(),
              checkOutDate: stay2.end.toISOString(),
              days: remainingDays,
              pricePerNight: price, 
              totalPrice: remainingDays * price,
              amountPaid: Math.floor(totalPaid * ratio2),
              paidCash: Math.floor(paidCash * ratio2),
              paidCard: Math.floor(paidCard * ratio2),
              paidQR: Math.floor(paidQR * ratio2),
              status: 'active', 
              checkInDateTime: null,
              checkIn: null 
          };
          delete newGuest.id;
          await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'guests'), newGuest);
          showNotification("Split successful!");
      } catch (e) {
          console.error(e);
          showNotification("Split Error", 'error');
      }
  };

  const handleMoveGuest = async (g, rid, rnum, bid) => { 
      try {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { roomId: rid, roomNumber: rnum, bedId: bid });
          setMoveGuestModal({open: false, guest: null});
          setGuestDetailsModal({open: false, guest: null});
          showNotification("Moved!");
      } catch (e) {
          showNotification("Error: " + e.message, 'error');
      }
  };
  
  const handleDeleteGuest = async (g) => {
      let guestId = typeof g === 'string' ? g : g.id;
      let guestData = typeof g === 'object' ? g : guests.find(guest => guest.id === guestId);

      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId));
      if(guestData && guestData.status==='active' && guestData.roomId !== 'DEBT_ONLY') { 
          const r=rooms.find(i=>i.id===guestData.roomId); 
          if(r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), {occupied:Math.max(0,(r.occupied||1)-1)}); 
      }
      setGuestDetailsModal({open:false, guest:null});
      showNotification("Deleted");
  };

  const handleDeletePayment = async (id, type) => {
      if(!confirm("Delete?")) return;
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, type === 'income' ? 'payments' : 'expenses', id));
      sendTelegramMessage(`⚠️ <b>Delete Record</b>\nID: ${id}\nType: ${type}`);
      showNotification("Deleted");
  };

  const handleAddExpense = async (d) => { setExpenseModal(false); await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {...d, hostelId: currentUser.role==='admin'?selectedHostelFilter:currentUser.hostelId, staffId:currentUser.id||currentUser.login, date:new Date().toISOString()}); };
  const handleAddTask = async (task) => { await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'tasks'), task); showNotification("Task Added"); };
  const handleCompleteTask = async (id) => { await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'tasks', id), { status: 'done' }); };
  const handleUpdateTask = async (id, updates) => { await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'tasks', id), updates); showNotification("Task Updated"); };
  const handleDeleteTask = async (id) => { await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'tasks', id)); showNotification("Task Deleted"); };
  
  const handleAdminReduceDays = async (g, rd) => { 
      const newDays = parseInt(g.days) - parseInt(rd);
      const newTotal = newDays * parseInt(g.pricePerNight);
      const refundAmount = parseInt(rd) * parseInt(g.pricePerNight);
      
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), {
          days: newDays,
          totalPrice: newTotal,
          amountPaid: (g.amountPaid || 0) - refundAmount,
          paidCash: (g.paidCash || 0) - refundAmount 
      });
      const stay = getStayDetails(g.checkInDate, newDays);
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { checkOutDate: stay.end.toISOString() });
      showNotification("Days reduced");
  };

  const handleAdminReduceDaysNoRefund = async (g, rd) => {
      const newDays = parseInt(g.days) - parseInt(rd);
      const newTotal = newDays * parseInt(g.pricePerNight);
      
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), {
          days: newDays,
          totalPrice: newTotal
      });
      const stay = getStayDetails(g.checkInDate, newDays);
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { checkOutDate: stay.end.toISOString() });
      showNotification("Reduced (No Refund)");
  };

  const handlePayDebt = async (targets, amount, methods = { cash: amount, card: 0, qr: 0 }) => {
      try {
          const safeStaffId = currentUser.id || currentUser.login;
          let remaining = amount;
          for (const target of targets) {
              if (remaining <= 0) break;
              const pay = Math.min(remaining, target.currentDebt);
              
              const ratio = pay / amount;
              const cashPay = Math.floor(methods.cash * ratio);
              const cardPay = Math.floor(methods.card * ratio);
              const qrPay = Math.floor(methods.qr * ratio);
              
              await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', target.id), {
                  paidCash: increment(cashPay), 
                  paidCard: increment(cardPay),
                  paidQR: increment(qrPay),
                  amountPaid: increment(pay)
              });
              await logTransaction(target.id, { cash: cashPay, card: cardPay, qr: qrPay }, safeStaffId);
              remaining -= pay;
          }
          showNotification("Debt Paid!");
      } catch(e) {
          showNotification("Error paying debt", 'error');
      }
  };

  const handleAdminAdjustDebt = async (guestId, adjustment) => {
      try {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), {
              totalPrice: increment(adjustment)
          });
          showNotification("Debt Adjusted");
      } catch(e) {
          showNotification("Error adjusting", 'error');
      }
  };

  const downloadExpensesCSV = () => { alert("Export feature pending") };

  if (isLoadingAuth) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;
  if (!currentUser) return <LoginScreen users={usersList} onLogin={handleLogin} onSeed={seedUsers} lang={lang} setLang={setLang} />;

  const activeUserDoc = usersList.find(u => u.id === currentUser?.id) || currentUser;
  const currentHostelInfo = HOSTELS[currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId] || HOSTELS['hostel1'];
  const t = (k) => TRANSLATIONS[lang][k];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row">
      <Navigation currentUser={currentUser} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} lang={lang} setLang={setLang} pendingTasksCount={pendingTasksCount} />
      
      <MobileNavigation currentUser={currentUser} activeTab={activeTab} setActiveTab={setActiveTab} pendingTasksCount={pendingTasksCount} lang={lang} />
      
      {notification && <Notification message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
      
      <main className="flex-1 p-4 md:p-6 pt-6 pb-20 md:pb-6 overflow-y-auto h-screen flex flex-col">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    {activeTab === 'dashboard' ? t('dashboard').toUpperCase() : activeTab === 'rooms' ? t('rooms').toUpperCase() : activeTab === 'calendar' ? t('calendar').toUpperCase() : activeTab === 'reports' ? t('reports').toUpperCase() : activeTab === 'debts' ? t('debts').toUpperCase() : activeTab === 'tasks' ? t('tasks').toUpperCase() : activeTab === 'expenses' ? t('expenses').toUpperCase() : activeTab === 'clients' ? t('clients').toUpperCase() : activeTab === 'staff' ? t('staff').toUpperCase() : ''}
                </h2>
                <div className="flex items-center gap-4 text-slate-500 text-sm mt-1">
                    <div className="flex items-center gap-1"><MapPin size={14}/> {HOSTELS[currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId]?.name || 'All'}</div>
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 border ${isOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                         {isOnline ? <Wifi size={12}/> : <WifiOff size={12}/>}
                         {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3">
                 {currentUser.role === 'cashier' && (<><Button variant="danger" icon={Wallet} onClick={() => setExpenseModal(true)}>{t('expense')}</Button><Button variant="primary" icon={CheckCircle2} onClick={() => setCheckInModal({ open: true, room: null, bedId: null, date: null })}>{t('checkin')}</Button><Button variant="secondary" icon={Power} onClick={() => setShiftModal(true)}>{t('shift')}</Button></>)}
                 {(currentUser.role === 'admin' || currentUser.role === 'super') && (
                    <div className="flex bg-white p-1 rounded-xl border border-slate-300 shadow-sm">{Object.keys(HOSTELS).map(hid => (<button key={hid} onClick={() => setSelectedHostelFilter(hid)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedHostelFilter === hid ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>{HOSTELS[hid].name}</button>))}</div>
                 )}
            </div>
        </div>

        {activeTab === 'dashboard' && currentUser.role === 'admin' && <div className="space-y-8 animate-in fade-in"><DashboardStats rooms={filteredRooms} guests={filteredGuests} payments={filteredPayments} lang={lang} /><div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><ChartsSection guests={filteredGuests} rooms={filteredRooms} payments={filteredPayments} lang={lang} /></div></div>}
        {activeTab === 'rooms' && ( <div className="space-y-6"><div className="flex justify-between items-center"><div className="flex items-center gap-2 text-slate-500 text-sm"><CheckCircle2 size={18} /> <span>Click bed for actions</span></div>{(currentUser.role === 'admin' || currentUser.role === 'super') && <Button icon={PlusCircle} onClick={() => setAddRoomModal(true)}>Add Room</Button>}</div><div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">{filteredRooms.map(room => (<RoomCardChess key={room.id} room={room} guests={filteredGuests.filter(g => g.roomId === room.id)} isAdmin={currentUser.role === 'admin' || currentUser.role === 'super'} onEdit={() => setEditRoomModal({ open: true, room })} onClone={() => handleCloneRoom(room)} onDelete={() => handleDeleteRoom(room)} lang={lang} onBedClick={(bedId, guest) => { if (guest) setGuestDetailsModal({ open: true, guest }); else { if(currentUser.role === 'admin' || currentUser.role === 'super') alert("Admin cannot check-in"); else setCheckInModal({ open: true, room, bedId, date: null }); } }} />))}</div></div>)}
        {activeTab === 'calendar' && <div className="flex-1 flex flex-col animate-in fade-in overflow-hidden bg-white rounded-2xl border border-slate-300 shadow-sm relative"><CalendarView rooms={filteredRooms} guests={filteredGuests} onSlotClick={(room, bedId, guest, dateISO) => { 
            if (guest) setGuestDetailsModal({ open: true, guest }); 
            else { 
                if(currentUser.role === 'admin' || currentUser.role === 'super') alert("Admin cannot check-in"); 
                else {
                    setCheckInModal({ open: true, room, bedId, date: dateISO }); 
                }
            } 
        }} lang={lang} currentUser={currentUser} onDeleteGuest={handleDeleteGuest} /></div>}
        
        {activeTab === 'reports' && (currentUser.role === 'admin' || currentUser.role === 'super') && <ReportsView payments={filteredPayments} expenses={filteredExpenses} users={filteredUsersForReports} guests={filteredGuests} currentUser={currentUser} onDeletePayment={handleDeletePayment} lang={lang} />}
        {activeTab === 'debts' && <DebtsView guests={filteredGuests} users={usersList} lang={lang} onPayDebt={handlePayDebt} currentUser={currentUser} onAdminAdjustDebt={handleAdminAdjustDebt} clients={clients} onCreateDebt={handleCreateDebt} />}
        
        {activeTab === 'tasks' && <TaskManager tasks={filteredTasks} users={usersList} currentUser={currentUser} onAddTask={handleAddTask} onCompleteTask={handleCompleteTask} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} lang={lang} selectedHostelFilter={selectedHostelFilter} />}

        {activeTab === 'clients' && (currentUser.role === 'admin' || currentUser.role === 'super') && <ClientsView clients={clients} onUpdateClient={handleUpdateClient} onImportClients={handleImportClients} onDeduplicate={handleDeduplicate} onBulkDelete={handleBulkDeleteClients} onNormalizeCountries={handleNormalizeCountries} lang={lang} />}
        {activeTab === 'staff' && currentUser.role === 'admin' && <StaffView users={usersList} onAdd={handleAddUser} onDelete={handleDeleteUser} lang={lang} />}
        {activeTab === 'expenses' && (currentUser.role === 'admin' || currentUser.role === 'super') && (
             <div className="animate-in slide-in-from-bottom-2 space-y-6">
                <div className="flex justify-between items-center"><h3 className="text-lg font-bold">{t('expenses')}</h3><div className="flex gap-2"><Button icon={Download} variant="secondary" onClick={downloadExpensesCSV}>Export</Button><Button icon={Plus} onClick={() => setExpenseModal(true)}>{t('expense')}</Button></div></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">{filteredExpenses.length > 0 ? filteredExpenses.map(e => (<div key={e.id} className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm flex flex-col justify-between"><div><div className="flex justify-between items-start mb-2"><span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-600">{e.category}</span><span className="text-xs text-slate-400">{new Date(e.date).toLocaleDateString()}</span></div><p className="font-medium text-slate-800">{e.comment}</p></div><div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center"><span className="font-bold text-rose-600">-{parseInt(e.amount).toLocaleString()}</span><span className="text-xs text-slate-400">{usersList.find(u => u.id === e.staffId)?.name || 'N/A'}</span></div></div>)) : <div className="text-slate-400 col-span-3 text-center py-10">No Expenses</div>}</div>
             </div>
        )}
      </main>

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