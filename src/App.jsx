import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'; // ← ДОБАВЛЕНО useCallback
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
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
  Calendar,
  CalendarIcon,
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
  Smartphone, 
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
  Timer,
  Home,
  UserPlus,
  DollarSign,
  CreditCard,
  QrCode,
  Activity,    // ← ДОБАВЛЕНО (для ChartsSection и CalendarView)
  BarChart3    // ← ДОБАВЛЕНО (для ChartsSection)
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
    salaryCalc: "Расчет ЗП",
    changePassword: "Сменить пароль",
    currentPassword: "Текущий пароль",
    newPassword: "Новый пароль",
    confirmPassword: "Повторите пароль",
    passwordChanged: "Пароль изменен",
    wrongPassword: "Неверный пароль",
    passwordsDontMatch: "Пароли не совпадают",
    repeatStay: "Повторить заселение",
    clientHistory: "История визитов",
    filterByCountry: "Фильтр по стране",
    show: "Показать",
    perPage: "на странице"
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
    salaryCalc: "Maosh hisobi",
    changePassword: "Parolni o'zgartirish",
    currentPassword: "Joriy parol",
    newPassword: "Yangi parol",
    confirmPassword: "Parolni takrorlang",
    passwordChanged: "Parol o'zgartirildi",
    wrongPassword: "Noto'g'ri parol",
    passwordsDontMatch: "Parollar mos kelmaydi",
    repeatStay: "Takroriy joy",
    clientHistory: "Tashrif tarixi",
    filterByCountry: "Davlat bo'yicha filtr",
    show: "Ko'rsatish",
    perPage: "sahifada"
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

// ✅ ИСПРАВЛЕНО: защита от повторной инициализации
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, "hostella");
} catch (error) {
  console.log('Firestore уже инициализирован, используем существующий экземпляр');
  db = getFirestore(app);
}

const APP_ID = 'hostella-multi-v4';
const PUBLIC_DATA_PATH = ['artifacts', APP_ID, 'public', 'data'];

// --- SALARY CONFIG ---
const DAILY_SALARY = 266666;

// --- DEFAULT DATA ---
// ✅ ИЗМЕНЕНИЕ: Добавлен Fazliddin со спецправами (может видеть оба хостела)
const DEFAULT_USERS = [
  { login: 'admin', pass: 'admin', name: 'Aziz Yuldashev', role: 'admin', hostelId: 'all' },
  { login: 'dilafruz', pass: '123', name: 'Dilafruz', role: 'cashier', hostelId: 'hostel1' },
  { login: 'nargiza', pass: '123', name: 'Nargiza', role: 'cashier', hostelId: 'hostel1' },
  { login: 'fazliddin', pass: '123', name: 'Fazliddin', role: 'cashier', hostelId: 'hostel2', canViewHostel1: true },
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
const pluralize = (number, one, two, five, lang = 'ru') => {
    if (lang === 'uz') return one;
    
    const n = Math.abs(number);
    const n10 = n % 10;
    const n100 = n % 100;
    
    if (n10 === 1 && n100 !== 11) {
        return `${number} ${one}`;
    }
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) {
        return `${number} ${two}`;
    }
    return `${number} ${five}`;
};

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

// ✅ ОБНОВЛЕННАЯ ЛОГИКА: Ранний заезд (00:00) = до 12:00 следующего дня
const getStayDetails = (checkInDateTime, days) => {
    const start = new Date(checkInDateTime);
    const checkInHour = start.getHours();
    
    console.log('📅 getStayDetails:', {
        checkInDateTime,
        hour: checkInHour,
        days
    });
    
    // ✅ РАННИЙ ЗАЕЗД: если время 00:00 (полночь)
    if (checkInHour === 0) {
        console.log('🌅 Early check-in detected! Guest gets from 00:00 to 12:00 next day.');
        // Оставляем start как есть (00:00)
        // Выезд через days дней в 12:00
        const end = new Date(start);
        end.setDate(end.getDate() + parseInt(days));
        end.setHours(12, 0, 0, 0);
        
        console.log('📅 Stay details:', {
            checkIn: start.toISOString(),
            checkOut: end.toISOString()
        });
        
        return { start, end };
    }
    
    // ✅ ОБЫЧНЫЙ ЗАЕЗД: стандартизируем на 12:00
    start.setHours(12, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + parseInt(days));
    
    console.log('📅 Stay details:', {
        checkIn: start.toISOString(),
        checkOut: end.toISOString()
    });
    
    return { start, end };
};

const checkCollision = (existingCheckIn, existingDays, newCheckIn, newDays) => {
    const e1 = new Date(existingCheckIn); 
    e1.setHours(12, 0, 0, 0);
    const e2 = new Date(e1); 
    e2.setDate(e2.getDate() + parseInt(existingDays));
    const n1 = new Date(newCheckIn); 
    n1.setHours(12, 0, 0, 0);
    const n2 = new Date(n1); 
    n2.setDate(n2.getDate() + parseInt(newDays));
    return !(e2 <= n1 || n2 <= e1);
};

const calculateSalary = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;
    return Math.round(diffDays * DAILY_SALARY);
};

// ✅ ИСПРАВЛЕНИЕ: Улучшенный экспорт в Excel с правильными итогами
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
                .total-row { background-color: #f3f4f6; font-weight: bold; border-top: 3px solid #000000; }
                .total-label { text-align: right; font-size: 14px; }
                .total-value { text-align: right; font-size: 14px; }
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
                <td>${row.hostel}</td>
                <td>${row.staff}</td>
                <td class="amount">${parseInt(row.amount).toLocaleString()}</td>
                <td>${row.method}</td>
                <td>${row.comment}</td>
            </tr>
        `;
    });

    tableContent += `
        <tr class="total-row">
            <td colspan="4" class="total-label">ИТОГО ПРИХОД:</td>
            <td class="total-value income">${totalIncome.toLocaleString()}</td>
            <td colspan="2"></td>
        </tr>
        <tr class="total-row">
            <td colspan="4" class="total-label">ИТОГО РАСХОД:</td>
            <td class="total-value expense">${totalExpense.toLocaleString()}</td>
            <td colspan="2"></td>
        </tr>
        <tr class="total-row" style="background-color: #e0e7ff;">
            <td colspan="4" class="total-label" style="font-size: 16px;">БАЛАНС:</td>
            <td class="total-value" style="font-size: 16px; color: ${balance >= 0 ? '#166534' : '#9f1239'};">${balance.toLocaleString()}</td>
            <td colspan="2"></td>
        </tr>
    `;

    tableContent += `</tbody></table></body></html>`;

    const blob = new Blob([tableContent], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ✅ ИСПРАВЛЕНИЕ: Улучшенная печать документов (чеки, анкеты, справки)
const printDocument = (type, guest, hostel) => {
    const w = window.open('', '', 'width=800,height=600');
    const date = new Date().toLocaleDateString('ru-RU');
    const time = new Date().toLocaleTimeString('ru-RU');
    
    let html = `
    <html>
    <head>
        <meta charset="UTF-8">
        <title>${type === 'check' ? 'Чек' : type === 'regcard' ? 'Регистрационная карта' : 'Справка'}</title>
        <style>
            body { font-family: 'Courier New', monospace; padding: 20px; max-width: 600px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
            .header h2 { margin: 5px 0; font-size: 18px; }
            .info-row { display: flex; justify-between; margin: 5px 0; font-size: 14px; }
            .info-row .label { font-weight: bold; }
            .total { border-top: 2px dashed #000; margin-top: 15px; padding-top: 10px; font-size: 16px; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
            .signature { margin-top: 40px; border-top: 1px solid #000; width: 200px; display: inline-block; }
            @media print { body { padding: 10px; } }
        </style>
    </head>
    <body>
    `;
    
    if (type === 'check') {
        const total = guest.totalPrice || 0;
        const paid = getTotalPaid(guest);
        html += `
        <div class="header">
            <h2>${hostel.name}</h2>
            <p style="margin: 2px 0; font-size: 12px;">${hostel.address}</p>
            <p style="margin: 2px 0; font-size: 12px;">Дата: ${date} ${time}</p>
        </div>
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
        <div class="footer">Спасибо за выбор ${hostel.name}!<br/>Приходите к нам еще!</div>
        `;
    } else if (type === 'regcard') {
        html += `
        <div class="header">
            <h2>РЕГИСТРАЦИОННАЯ КАРТА ГОСТЯ</h2>
            <p style="margin: 2px 0;">${hostel.name}</p>
        </div>
        <div class="info-row"><span class="label">ФИО:</span><span>${guest.fullName}</span></div>
        <div class="info-row"><span class="label">Дата рождения:</span><span>${guest.birthDate || '-'}</span></div>
        <div class="info-row"><span class="label">Паспорт:</span><span>${guest.passport || '-'}</span></div>
        <div class="info-row"><span class="label">Гражданство:</span><span>${guest.country || '-'}</span></div>
        <div class="info-row"><span class="label">Дата заезда:</span><span>${new Date(guest.checkInDate).toLocaleDateString('ru-RU')}</span></div>
        <div class="info-row"><span class="label">Дата выезда:</span><span>${guest.checkOutDate ? new Date(guest.checkOutDate).toLocaleDateString('ru-RU') : '-'}</span></div>
        <div class="info-row"><span class="label">Комната:</span><span>№${guest.roomNumber}</span></div>
        <div class="info-row"><span class="label">Место:</span><span>№${guest.bedId}</span></div>
        <div style="margin-top: 40px;">
            <p>Подпись гостя: <span class="signature"></span></p>
            <p>Дата: ${date}</p>
        </div>
        <div class="footer">Документ сформирован автоматически</div>
        `;
    } else if (type === 'ref') {
        html += `
        <div class="header">
            <h2>СПРАВКА О ПРОЖИВАНИИ</h2>
            <p style="margin: 2px 0;">${hostel.name}</p>
            <p style="margin: 2px 0; font-size: 11px;">${hostel.address}</p>
        </div>
        <p style="text-align: justify; line-height: 1.6; margin: 20px 0;">
            Настоящая справка выдана <strong>${guest.fullName}</strong>, паспорт ${guest.passport || '-'}, 
            в том, что он(а) действительно проживал(а) в ${hostel.name} 
            с <strong>${new Date(guest.checkInDate).toLocaleDateString('ru-RU')}</strong> 
            по <strong>${guest.checkOutDate ? new Date(guest.checkOutDate).toLocaleDateString('ru-RU') : 'настоящее время'}</strong>.
        </p>
        <p style="margin: 20px 0;">Комната: №${guest.roomNumber}, Место: №${guest.bedId}</p>
        <p style="margin: 20px 0;">Справка выдана для пре��ъявления по месту требования.</p>
        <div style="margin-top: 60px;">
            <p>Дата выдачи: ${date}</p>
            <p>Подпись администратора: _________________</p>
            <p style="text-align: center; margin-top: 20px;">М.П.</p>
        </div>
        `;
    }
    
    html += `</body></html>`;
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
                <td>${row.method || '-'}</td>
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

// ✅ НОВЫЙ СОВРЕМЕННЫЙ TopBar
const TopBar = ({ 
    selectedHostelFilter, 
    hostels, 
    availableHostels,
    setSelectedHostelFilter, 
    currentUser, 
    activeTab,
    isOnline,
    hasUpdate,
    usersList,
    shifts,
    canPerformActions,
    onOpenExpense, 
    onOpenCheckIn, 
    onOpenShift, 
    lang 
}) => {
    const t = (k) => TRANSLATIONS[lang][k];
    
    const selectedHostel = hostels[selectedHostelFilter];
    const hostelName = selectedHostel?.name || 'Все хостелы';
    
    const activeTabName = 
        activeTab === 'dashboard' ? t('dashboard') : 
        activeTab === 'rooms' ? t('rooms') : 
        activeTab === 'calendar' ? t('calendar') : 
        activeTab === 'reports' ? t('reports') : 
        activeTab === 'debts' ? t('debts') : 
        activeTab === 'tasks' ? t('tasks') : 
        activeTab === 'expenses' ? t('expenses') : 
        activeTab === 'clients' ? t('clients') : 
        activeTab === 'staff' ? t('staff') : 
        activeTab === 'shifts' ? t('shifts') : '';

    return (
        <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-30">
            {/* Left Side */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                    <div>
                        <div className="text-lg font-bold text-slate-900">{activeTabName}</div>
                        <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
                            <MapPin size={12}/>
                            {hostelName}
                        </div>
                    </div>
                </div>

                {/* ✅ ТОЛЬКО ИКОНКИ */}
                <div className="flex items-center gap-2 ml-4">
                    {/* Статус ONLINE/OFFLINE - только иконка */}
                    <div className={`p-2 rounded-lg border ${
                        isOnline 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`} title={isOnline ? 'ONLINE' : 'OFFLINE'}>
                        {isOnline ? <Wifi size={16}/> : <WifiOff size={16}/>}
                    </div>
                    
                    {/* Кнопка обновить - только иконка */}
                    <button 
                        onClick={() => window.location.reload()}
                        className={`p-2 rounded-lg border transition-all hover:scale-105 active:scale-95 ${
                            hasUpdate 
                                ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' 
                                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                        }`}
                        title={hasUpdate ? 'Доступно обновление' : 'Обновить'}
                    >
                        <Download size={16}/>
                    </button>
                </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-3">
                {/* Hostel Selector для админа */}
                {availableHostels && availableHostels.length > 0 && (
                    <div className="flex bg-white p-1 rounded-xl border border-slate-300 shadow-sm">
                        {availableHostels.map(hid => (
                            <button 
                                key={hid} 
                                onClick={() => setSelectedHostelFilter(hid)} 
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    selectedHostelFilter === hid 
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md' 
                                        : 'text-slate-500 hover:bg-slate-50'
                                }`}
                            >
                                {hostels[hid]?.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* ✅ УБРАЛИ БЛОК "Current: Nargiza" */}

                {/* Action Buttons для кассира */}
                {currentUser.role === 'cashier' && canPerformActions && (
                    <>
                        <button
                            onClick={onOpenExpense}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-rose-200 hover:shadow-xl transition-all"
                        >
                            <Wallet size={16}/>
                            <span>{t('expense')}</span>
                        </button>
                        
                        <button
                            onClick={onOpenCheckIn}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:shadow-xl transition-all"
                        >
                            <UserPlus size={16}/>
                            <span>{t('checkin')}</span>
                        </button>

                        <button
                            onClick={onOpenShift}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-200 hover:shadow-xl transition-all"
                        >
                            <Power size={16}/>
                            <span>{t('shift')}</span>
                        </button>
                    </>
                )}

                {/* Режим просмотра */}
                {currentUser.login === 'fazliddin' && !canPerformActions && (
                    <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm font-bold">
                        Режим просмотра
                    </div>
                )}
            </div>
        </div>
    );
};

// ✅ НОВЫЙ СВЕТЛЫЙ Navigation с Glass эффектом
const Navigation = ({ currentUser, activeTab, setActiveTab, onLogout, lang, setLang, pendingTasksCount, onOpenChangePassword }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';
    
    const menuItems = [
        { id: 'dashboard', icon: LayoutDashboard, label: t('dashboard'), adminOnly: true, color: 'blue' },
        { id: 'rooms', icon: BedDouble, label: t('rooms'), color: 'purple' },
        { id: 'calendar', icon: Calendar, label: t('calendar'), color: 'indigo' },
        { id: 'reports', icon: FileText, label: t('reports'), adminOnly: true, color: 'emerald' },
        { id: 'debts', icon: AlertCircle, label: t('debts'), color: 'rose' },
        { id: 'tasks', icon: CheckSquare, label: t('tasks'), badge: pendingTasksCount, color: 'amber' },
        { id: 'expenses', icon: Wallet, label: t('expenses'), adminOnly: true, color: 'red' },
        { id: 'clients', icon: Users, label: t('clients'), color: 'cyan' },
        { id: 'staff', icon: UserCog, label: t('staff'), adminOnly: true, color: 'teal' },
        { id: 'shifts', icon: Clock, label: t('shifts'), color: 'violet' },
    ];

    const visibleItems = menuItems.filter(item => !item.adminOnly || isAdmin);

    const colorClasses = {
        blue: 'text-blue-600 bg-blue-50 border-blue-200',
        purple: 'text-purple-600 bg-purple-50 border-purple-200',
        indigo: 'text-indigo-600 bg-indigo-50 border-indigo-200',
        emerald: 'text-emerald-600 bg-emerald-50 border-emerald-200',
        rose: 'text-rose-600 bg-rose-50 border-rose-200',
        amber: 'text-amber-600 bg-amber-50 border-amber-200',
        red: 'text-red-600 bg-red-50 border-red-200',
        cyan: 'text-cyan-600 bg-cyan-50 border-cyan-200',
        teal: 'text-teal-600 bg-teal-50 border-teal-200',
        violet: 'text-violet-600 bg-violet-50 border-violet-200',
    };

    return (
        <div className="w-64 h-screen bg-white/80 backdrop-blur-xl border-r border-slate-200 flex flex-col shadow-lg">
            {/* Logo & Brand */}
            <div className="flex-shrink-0 p-6 border-b border-slate-200 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
                <div className="flex items-center gap-3">
                    <img 
                        src="https://hostella.uz/logo.png" 
                        alt="Hostella Logo"
                        className="w-12 h-12 rounded-2xl shadow-lg object-contain"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextElementSibling.style.display = 'flex';
                        }}
                    />
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg" style={{display: 'none'}}>
                        <Building2 size={28} className="text-white"/>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                            Hostella
                        </h1>
                        <p className="text-xs text-slate-500 font-medium">Система управления</p>
                    </div>
                </div>
            </div>

            {/* Menu Items - СКРОЛЛИТСЯ */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 min-h-0">
                {visibleItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all duration-200 group ${
                                isActive 
                                    ? `${colorClasses[item.color]} border shadow-md` 
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                        >
                            <Icon size={20} className={isActive ? '' : 'opacity-60'}/>
                            <span className="flex-1 text-left text-sm">{item.label}</span>
                            {item.badge > 0 && (
                                <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center animate-pulse shadow-sm">
                                    {item.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* ✅ Bottom Actions - НОВЫЙ ПОРЯДОК */}
            <div className="flex-shrink-0 p-3 border-t border-slate-200 bg-slate-50/50 backdrop-blur-sm space-y-2">
                {/* Кнопка пароля + языки */}
                <div className="flex items-center gap-2">
                                     
                    <button 
                        onClick={() => setLang('ru')} 
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            lang === 'ru' 
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md' 
                                : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
                        }`}
                    >
                        RU
                    </button>
                    <button 
                        onClick={() => setLang('uz')} 
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            lang === 'uz' 
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md' 
                                : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-200'
                        }`}
                    >
                        UZ
                    </button>
					<button 
                        onClick={onOpenChangePassword}
                        className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm transition-all text-xs font-medium border border-transparent hover:border-slate-200"
                    >
                        <Lock size={14}/>
                        <span>Пароль</span>
                    </button>
                </div>

                {/* ✅ ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ */}
                <div className="flex items-center gap-3 bg-white/60 backdrop-blur-sm rounded-xl p-2.5 border border-slate-200 shadow-sm">
                    <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center shadow-md">
                        <User size={18} className="text-white"/>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs text-slate-800 truncate">{currentUser.name}</div>
                        <div className="text-[10px] text-slate-500 capitalize">{currentUser.role}</div>
                    </div>
                </div>

                {/* Кнопка выхода */}
                <button 
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white font-bold transition-all shadow-lg shadow-rose-200 hover:shadow-xl text-sm"
                >
                    <LogOut size={16}/>
                    <span>{t('logout')}</span>
                </button>
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

    const relevantRooms = currentHostelId === 'all' ? rooms : rooms.filter(r => r.hostelId === currentHostelId);
    
    const totalCapacity = relevantRooms.reduce((acc, r) => acc + parseInt(r.capacity), 0);
    const now = new Date();
    
    const activeGuests = guests.filter(g => {
        if (currentHostelId !== 'all' && g.hostelId !== currentHostelId) return false;
        
        if (g.status !== 'active') return false;

        const rawCheckIn = g.checkInDate || g.checkInDateTime || g.checkIn;
        const rawCheckOut = g.checkOutDate;
        
        if (!rawCheckIn || !rawCheckOut) return false;

        const checkIn = new Date(rawCheckIn);
        const checkOut = new Date(rawCheckOut);

        if (typeof rawCheckIn === 'string' && !rawCheckIn.includes('T')) checkIn.setHours(12, 0, 0, 0);
        if (typeof rawCheckOut === 'string' && !rawCheckOut.includes('T')) checkOut.setHours(12, 0, 0, 0);

        return now >= checkIn && now < checkOut;
    }).length;
    
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
                if (currentHostelId !== 'all' && p.hostelId !== currentHostelId) return false;
                
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* ✅ Постояльцы - ПОЛНАЯ ЗАЛИВКА */}
            <div className="rounded-2xl shadow-sm border border-slate-300 overflow-hidden hover:shadow-md transition-all group bg-gradient-to-br from-slate-100 via-blue-100/50 to-indigo-100/50">
                <div className="p-5 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-200 to-indigo-200 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Users size={24} className="text-blue-600"/>
                        </div>
                        {guestsTodayCount > 0 && (
                            <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                                +{guestsTodayCount} сегодня
                            </span>
                        )}
                    </div>
                    <div className="space-y-1 flex-1">
                        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                            {t('guests')}
                        </h3>
                        <p className="text-4xl font-bold text-slate-800">{activeGuests}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600 mt-auto">
                        <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                            <span className="font-medium">Активных Постояльцев</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ✅ Загрузка - ПОЛНАЯ ЗАЛИВКА */}
            <div className="rounded-2xl shadow-sm border border-slate-300 overflow-hidden hover:shadow-md transition-all group bg-gradient-to-br from-slate-100 via-emerald-100/50 to-teal-100/50">
                <div className="p-5 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-200 to-teal-200 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <BedDouble size={24} className="text-emerald-600"/>
                        </div>
                        <span className="text-xs font-semibold text-slate-600 bg-white px-2.5 py-1 rounded-full border border-slate-300">
                            {activeGuests}/{totalCapacity}
                        </span>
                    </div>
                    <div className="space-y-2 flex-1">
                        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                            {t('occupancy')}
                        </h3>
                        <p className="text-4xl font-bold text-slate-800">{occupancyPercent}%</p>
                        
                        {/* ✅ Прогресс бар */}
                        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                                className={`h-full rounded-full transition-all ${
                                    occupancyPercent >= 90 ? 'bg-gradient-to-r from-rose-500 to-pink-500' :
                                    occupancyPercent >= 70 ? 'bg-gradient-to-r from-amber-500 to-yellow-500' :
                                    'bg-gradient-to-r from-emerald-500 to-teal-500'
                                }`}
                                style={{ width: `${Math.min(occupancyPercent, 100)}%` }}
                            ></div>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-slate-600 mt-auto">
                        <span>Занято: <span className="font-bold text-slate-700">{activeGuests}</span></span>
                        <span>Свободно: <span className="font-bold text-emerald-600">{freeBeds}</span></span>
                    </div>
                </div>
            </div>

            {/* ✅ Выручка - ПОЛНАЯ ЗАЛИВКА */}
            <div className="rounded-2xl shadow-sm border border-slate-300 overflow-hidden hover:shadow-md transition-all group bg-gradient-to-br from-slate-100 via-purple-100/50 to-violet-100/50">
                <div className="p-5 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-purple-200 to-violet-200 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Wallet size={24} className="text-purple-600"/>
                        </div>
                        {revenueToday > 0 && (
                            <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                                +{Math.round(revenueToday / 1000)}k
                            </span>
                        )}
                    </div>
                    <div className="space-y-1 flex-1">
                        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                            {t('revenue')} (сегодня)
                        </h3>
                        <p className="text-3xl font-bold text-slate-800">{revenueToday.toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-600 mt-auto">
                        <Building2 size={12}/>
                        <span className="font-medium">{currentHostelInfo?.name || 'Все хостелы'}</span>
                    </div>
                </div>
            </div>

            {/* ✅ Комнаты - ПОЛНАЯ ЗАЛИВКА */}
            <div className="rounded-2xl shadow-sm border border-slate-300 overflow-hidden hover:shadow-md transition-all group bg-gradient-to-br from-slate-100 via-orange-100/50 to-amber-100/50">
                <div className="p-5 h-full flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-orange-200 to-amber-200 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Building2 size={24} className="text-orange-600"/>
                        </div>
                        <span className="text-xs font-semibold text-slate-600 bg-white px-2.5 py-1 rounded-full border border-slate-300">
                            {totalCapacity} мест
                        </span>
                    </div>
                    <div className="space-y-1 flex-1">
                        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                            {t('rooms')}
                        </h3>
                        <p className="text-4xl font-bold text-slate-800">{relevantRooms.length}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-600 mt-auto">
                        <BedDouble size={12}/>
                        <span className="font-medium">Всего комнат</span>
                    </div>
                </div>
            </div>
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

// --- Вспомогательные функции (вынесены, чтобы не создавать их при каждом рендере) ---
const parseDate = (dateInput) => {
    if (!dateInput) return null;
    const date = new Date(dateInput);
    if (typeof dateInput === 'string' && !dateInput.includes('T')) {
        date.setHours(12, 0, 0, 0);
    }
    return date;
};

const getDaysDiff = (date1, date2) => {
    if (!date1 || !date2) return 0;
    return Math.ceil((date2 - date1) / (1000 * 60 * 60 * 24));
};

const formatMoney = (amount) => amount ? amount.toLocaleString() : '0';
// --- Основной компонент ---
const RoomCardGlass = ({ room, guests, isAdmin, onEdit, onClone, onDelete, onBedClick, lang }) => {
    const [filterMode, setFilterMode] = useState('all');
    const now = new Date();

    // 1. Логика данных (28 часов + статусы)
    const bedsData = useMemo(() => {
        const beds = [];
        
        for (let i = 1; i <= room.capacity; i++) {
            const bedId = i;
            const bedGuests = guests.filter(g => 
                String(g.roomId) === String(room.id) && String(g.bedId) === String(bedId)
            );

            const activeGuest = bedGuests.find(g => g.status === 'active');
            const bookingGuest = bedGuests.find(g => g.status === 'booking' && parseDate(g.checkInDate) > now);
            const ghostDebtor = bedGuests
                .filter(g => g.status === 'checked_out')
                .find(g => (g.totalPrice - getTotalPaid(g)) > 0);

            let status = 'free';
            let displayGuest = null;
            let debt = 0;
            let isTimeout = false;
            let daysLeft = 0;

            if (activeGuest) {
                const checkOut = parseDate(activeGuest.checkOutDate);
                const isExpired = checkOut && now > checkOut;
                
                // --- Правило 28 часов ---
                let showAsFree = false;
                if (isExpired) {
                    const hoursSinceCheckout = (now - checkOut) / (1000 * 60 * 60);
                    if (hoursSinceCheckout > 28) {
                        showAsFree = true;
                    }
                }

                if (showAsFree) {
                    status = 'free';
                    displayGuest = null;
                } else {
                    displayGuest = activeGuest;
                    const paid = getTotalPaid(activeGuest);
                    debt = (activeGuest.totalPrice || 0) - paid;
                    isTimeout = isExpired;
                    status = isTimeout ? 'timeout' : 'occupied';
                    daysLeft = checkOut ? getDaysDiff(now, checkOut) : 0;
                }
            } else if (bookingGuest) {
                displayGuest = bookingGuest;
                status = 'booking';
                daysLeft = getDaysDiff(now, parseDate(bookingGuest.checkInDate));
            }

            beds.push({
                id: bedId,
                status,
                guest: displayGuest,
                debt,
                isTimeout,
                daysLeft,
                ghostDebtor,
                ghostDebt: ghostDebtor ? (ghostDebtor.totalPrice - getTotalPaid(ghostDebtor)) : 0
            });
        }
        return beds;
    }, [guests, room.id, room.capacity]);

    // 2. Статистика
    const stats = useMemo(() => {
        return bedsData.reduce((acc, bed) => {
            if (bed.status === 'occupied') acc.occupied++;
            if (bed.status === 'free' || bed.status === 'timeout') acc.free++;
            if (bed.debt > 0) acc.totalDebt += bed.debt;
            return acc;
        }, { occupied: 0, free: 0, totalDebt: 0 });
    }, [bedsData]);

    const toggleFilter = (mode) => {
        setFilterMode(prev => prev === mode ? 'all' : mode);
    };

    // Мягкая подсветка фильтров
    const getOpacity = (bed) => {
        if (filterMode === 'all') return 'opacity-100';
        if (filterMode === 'debt') {
            const hasActiveDebt = bed.guest && bed.debt > 0;
            const hasGhostDebt = !!bed.ghostDebtor;
            // Мягкий фокус на должниках
            return (hasActiveDebt || hasGhostDebt) 
                ? 'opacity-100 ring-2 ring-rose-300 shadow-md transform scale-[1.01]' 
                : 'opacity-40 grayscale-[0.8] blur-[0.5px]';
        }
        if (filterMode === 'free') {
            // Мягкий фокус на свободных
            return (bed.status === 'free' || bed.status === 'timeout') 
                ? 'opacity-100 ring-2 ring-emerald-300 shadow-md transform scale-[1.01]' 
                : 'opacity-40 grayscale-[0.8] blur-[0.5px]';
        }
        return 'opacity-100';
    };

    return (
        <div className="relative group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 overflow-hidden">
            
            <div className="flex flex-col h-full">
                
                {/* HEADER: Чистый и легкий */}
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-700 shadow-sm">
                            <span className="font-bold text-xl text-slate-800">{room.number}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Комната</span>
                            <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-md w-fit">
                                <Users size={12} className="text-slate-500"/>
                                <span className="text-xs font-semibold text-slate-600">{room.capacity} мест</span>
                            </div>
                        </div>
                    </div>

                    {isAdmin && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                            <ActionBtn icon={Edit} color="blue" onClick={onEdit} />
                            <ActionBtn icon={Copy} color="purple" onClick={onClone} />
                            <ActionBtn icon={Trash2} color="rose" onClick={onDelete} />
                        </div>
                    )}
                </div>

                {/* STATS BAR: Мягкие кнопки */}
                <div className="grid grid-cols-3 gap-3 p-4 bg-white">
                    <StatButton 
                        label="Занято" 
                        value={stats.occupied} 
                        color="slate" 
                        active={filterMode === 'all'} 
                        onClick={() => toggleFilter('all')}
                    />
                    <StatButton 
                        label="Свободно" 
                        value={stats.free} 
                        color="emerald" 
                        active={filterMode === 'free'} 
                        onClick={() => toggleFilter('free')}
                    />
                    <StatButton 
                        label="Долг" 
                        value={formatMoney(stats.totalDebt)} 
                        color="rose" 
                        isCurrency 
                        active={filterMode === 'debt'} 
                        onClick={() => toggleFilter('debt')}
                    />
                </div>

                {/* BEDS GRID: Светлый фон сетки */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/50 flex-1">
                    {bedsData.map((bed) => {
                        const showGhost = filterMode === 'debt' && !bed.guest && bed.ghostDebtor;
                        const overrideWithGhost = filterMode === 'debt' && bed.ghostDebtor && (!bed.guest || bed.debt <= 0);

                        const targetGuest = overrideWithGhost ? bed.ghostDebtor : bed.guest;
                        const targetDebt = overrideWithGhost ? bed.ghostDebt : bed.debt;
                        const isGhostView = overrideWithGhost || showGhost;

                        return (
                            <div 
                                key={bed.id}
                                onClick={() => !bed.isTimeout && onBedClick(bed.id, targetGuest, isGhostView)}
                                className={`
                                    relative p-3 rounded-xl border transition-all duration-200 flex flex-col justify-between min-h-[110px] group/bed overflow-hidden
                                    ${getOpacity(bed)}
                                    ${getBedStyles(bed.status, targetDebt > 0, isGhostView)}
                                `}
                            >
                                {/* Хедер койки */}
                                <div className="flex justify-between items-start mb-2 relative z-10">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                        bed.isTimeout ? 'bg-slate-200 text-slate-500' : 'bg-white/60 text-slate-500 backdrop-blur-sm'
                                    }`}>
                                        №{bed.id}
                                    </span>
                                    
                                    {isGhostView && (
                                        <div className="flex items-center gap-1 text-[9px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-200">
                                            <History size={10} /> ИСТОРИЯ
                                        </div>
                                    )}
                                    
                                    {/* Статус Timeout - теперь аккуратный */}
                                    {bed.isTimeout && !isGhostView && (
                                        <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full">
                                            ВРЕМЯ ВЫШЛО
                                        </div>
                                    )}
                                </div>

                                {/* ТЕЛО КАРТОЧКИ */}
                                {targetGuest ? (
                                    <div className="flex-1 flex flex-col justify-end relative z-10">
                                        <div className={`font-semibold text-sm leading-tight mb-1.5 truncate ${bed.status === 'timeout' ? 'text-slate-500' : 'text-slate-800'}`}>
                                            {targetGuest.fullName}
                                        </div>
                                        
                                        <div className="flex items-center justify-between">
                                            {/* Дни */}
                                            {!isGhostView && !bed.isTimeout && (
                                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-100/50 px-1.5 py-0.5 rounded-md">
                                                    {bed.status === 'booking' ? <Clock size={11}/> : <CalendarDays size={11}/>}
                                                    {bed.status === 'booking' 
                                                        ? `Через ${bed.daysLeft} дн` 
                                                        : `${bed.daysLeft} дн`
                                                    }
                                                </div>
                                            )}
                                            {bed.isTimeout && <div className="h-4"></div>} {/* Пустой блок для выравнивания */}

                                            {/* Бейджи статуса */}
                                            {targetDebt > 0 ? (
                                                <div className="flex items-center gap-1 bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-rose-200 ml-auto">
                                                    <Wallet size={10} className="fill-rose-700/20"/>
                                                    -{formatMoney(targetDebt)}
                                                </div>
                                            ) : (
                                                !isGhostView && bed.status !== 'booking' && !bed.isTimeout && (
                                                    <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded-lg border border-emerald-200 ml-auto">
                                                        <CheckCircle2 size={10}/> OK
                                                    </div>
                                                )
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300 group-hover/bed:text-emerald-400 transition-colors">
                                        <div className="p-2 rounded-full border-2 border-dashed border-slate-200 group-hover/bed:border-emerald-300 group-hover/bed:bg-emerald-50 transition-all">
                                            <Plus size={16} strokeWidth={2.5} />
                                        </div>
                                        <span className="text-[10px] font-bold mt-1.5 uppercase tracking-wide group-hover/bed:text-emerald-600">Свободно</span>
                                    </div>
                                )}

                                {/* --- МЕНЮ ДЕЙСТВИЙ ДЛЯ TIMEOUT --- */}
                                {bed.isTimeout && (
                                    <div className="absolute inset-0 bg-white/90 backdrop-blur-[1px] z-20 flex flex-col items-center justify-center gap-2 opacity-0 group-hover/bed:opacity-100 transition-opacity duration-200 p-3">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onBedClick(bed.id, targetGuest, false); }}
                                            className="w-full py-2 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-slate-600 hover:text-blue-600 text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all"
                                        >
                                            <History size={14}/> Продлить
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onBedClick(bed.id, null, false); }}
                                            className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white border border-transparent text-xs font-bold rounded-lg shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all"
                                        >
                                            <UserPlus size={14}/> Заселить
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// --- СТИЛИ И КНОПКИ (SOFT UI VERSION) ---

const ActionBtn = ({ icon: Icon, color, onClick }) => {
    // Пастельные кнопки действий
    const styles = {
        blue: "hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200",
        purple: "hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200",
        rose: "hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
    };
    return (
        <button onClick={onClick} className={`p-2 rounded-xl bg-white text-slate-400 border border-slate-100 transition-all shadow-sm ${styles[color]}`}>
            <Icon size={16} />
        </button>
    );
};

const StatButton = ({ label, value, color, active, onClick, isCurrency }) => {
    // МЯГКИЕ ЦВЕТА СТАТИСТИКИ
    const styles = {
        slate: active 
            ? "bg-slate-50 border-slate-100 text-slate-800 ring-1 ring-slate-100" 
            : "bg-white border-slate-100 text-slate-500 hover:border-slate-200",
        emerald: active 
            ? "bg-emerald-100 border-emerald-200 text-emerald-800 ring-1 ring-emerald-200" 
            : "bg-emerald-100/30 border-emerald-100/50 text-emerald-600 hover:bg-emerald-50/50",
        rose: active 
            ? "bg-rose-50 border-rose-200 text-rose-800 ring-1 ring-rose-200" 
            : "bg-rose-50/30 border-rose-100/50 text-rose-600 hover:bg-rose-50/50",
    };

    return (
        <button 
            onClick={onClick}
            className={`
                flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-200
                ${styles[color]} ${active ? 'shadow-sm' : ''}
            `}
        >
            <span className="text-[10px] font-bold uppercase opacity-60 mb-0.5">{label}</span>
            <span className={`text-sm font-bold ${isCurrency ? 'truncate w-full text-center' : ''}`}>
                {value}
            </span>
        </button>
    );
};

// ✅ SOFT UI BED STYLES (Приятные глазу)
const getBedStyles = (status, hasDebt, isGhost) => {
    // 1. ИСТОРИЯ/ДОЛГ (Мягкий красный/розовый)
    if (isGhost) return "bg-rose-50/80 border border-rose-200 text-rose-900";
    
    // 2. СВОБОДНО (Белый с легким пунктиром)
    if (status === 'free') {
        return "bg-white border border-slate-200 border-dashed hover:border-emerald-300 hover:shadow-sm";
    }
    
    // 3. TIMEOUT (Благородный серый)
    if (status === 'timeout') {
        return "bg-slate-100 border border-slate-200 text-slate-400"; 
    }
    
    // 4. БРОНЬ (Светло-голубой)
    if (status === 'booking') {
        return "bg-blue-50/60 border border-blue-200 text-blue-800";
    }
    
    // 5. АКТИВНЫЙ ГОСТЬ
    if (hasDebt) {
        // Должник - Розовый фон (внимание, но не агрессия)
        return "bg-rose-50 border border-rose-200 text-rose-800 shadow-sm";
    }
    
    // Оплачено - Мятный/Светло-зеленый (Спокойствие)
    return "bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-sm";
};

const ChangePasswordModal = ({ currentUser, users, onClose, onChangePassword, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        setError('');
        
        if (oldPassword !== currentUser.pass) {
            setError(t('wrongPassword'));
            return;
        }
        
        if (newPassword.length < 3) {
            setError('Пароль должен быть не менее 3 символов');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            setError(t('passwordsDontMatch'));
            return;
        }
        
        onChangePassword(currentUser.id, newPassword);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Lock size={20} className="text-indigo-600"/>
                        {t('changePassword')}
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
                        <XCircle size={20} className="text-slate-400"/>
                    </button>
                </div>

                {error && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg mb-4 text-sm flex items-center gap-2">
                        <AlertCircle size={16}/>
                        {error}
                    </div>
                )}

                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>{t('currentPassword')}</label>
                        <input 
                            type="password" 
                            className={inputClass} 
                            value={oldPassword} 
                            onChange={e => setOldPassword(e.target.value)}
                            placeholder="••••••"
                        />
                    </div>
                    
                    <div>
                        <label className={labelClass}>{t('newPassword')}</label>
                        <input 
                            type="password" 
                            className={inputClass} 
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="••••••"
                        />
                    </div>
                    
                    <div>
                        <label className={labelClass}>{t('confirmPassword')}</label>
                        <input 
                            type="password" 
                            className={inputClass} 
                            value={confirmPassword} 
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="••••••"
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button onClick={handleSubmit} className="flex-1" disabled={!oldPassword || !newPassword || !confirmPassword}>
                            {t('save')}
                        </Button>
                        <Button variant="secondary" onClick={onClose} className="flex-1">
                            {t('cancel')}
                        </Button>
                    </div>
                </div>

                <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
                    <strong>Текущий пользователь:</strong> {currentUser.name} ({currentUser.login})
                </div>
            </div>
        </div>
    );
};
// ✅ ИСПРАВЛЕНО: Tooltip с умным позиционированием
const GuestTooltip = ({ guest, room, mousePos, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const totalPaid = getTotalPaid(guest);
    const debt = (guest.totalPrice || 0) - totalPaid;
    
    const now = new Date();
    const checkIn = new Date(guest.checkInDate);
    const checkOut = new Date(guest.checkOutDate);
    if (typeof guest.checkOutDate === 'string' && !guest.checkOutDate.includes('T')) {
        checkOut.setHours(12, 0, 0, 0);
    }
    const isExpired = now >= checkOut;
    
    const daysTotal = parseInt(guest.days);
    const daysStayed = Math.min(daysTotal, Math.max(0, Math.ceil((now - checkIn) / (1000 * 60 * 60 * 24))));
    const daysLeft = Math.max(0, daysTotal - daysStayed);
    
    // ✅ УМНОЕ ПОЗИЦИОНИРОВАНИЕ
    const tooltipWidth = 320;
    const tooltipHeight = 400; // примерная высота
    const offset = 15;
    
    let x = mousePos.x + offset;
    let y = mousePos.y + offset;
    
    // Если выходит за правый край - показываем слева от курсора
    if (x + tooltipWidth > window.innerWidth) {
        x = mousePos.x - tooltipWidth - offset;
    }
    
    // Если выходит за нижний край - показываем сверху от курсора
    if (y + tooltipHeight > window.innerHeight) {
        y = mousePos.y - tooltipHeight - offset;
    }
    
    // Если выходит за левый край - прижимаем к левому краю
    if (x < 10) {
        x = 10;
    }
    
    // Если выходит за верхний край - прижимаем к верхнему краю
    if (y < 10) {
        y = 10;
    }
    
    return (
        <div 
            className="fixed z-[100] bg-slate-900 text-white rounded-xl shadow-2xl p-4 min-w-[320px] animate-in fade-in zoom-in-95 duration-200 pointer-events-none"
            style={{
                left: `${x}px`,
                top: `${y}px`
            }}
        >
            {/* Header */}
            <div className="border-b border-white/20 pb-3 mb-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                        <h4 className="font-bold text-lg text-white mb-1">{guest.fullName}</h4>
                        <div className="flex items-center gap-2 text-xs text-white/70">
                            <span className="flex items-center gap-1">
                                <User size={12}/> {guest.passport}
                            </span>
                            <span>•</span>
                            <span>{guest.country}</span>
                        </div>
                    </div>
                    <div className={`px-2 py-1 rounded-lg text-xs font-bold ${
                        guest.status === 'booking' ? 'bg-amber-500' :
                        guest.status === 'checked_out' ? 'bg-slate-500' :
                        isExpired ? 'bg-rose-500' :
                        debt > 0 ? 'bg-orange-500' : 'bg-emerald-500'
                    }`}>
                        {guest.status === 'booking' ? '🕰 Бронь' :
                         guest.status === 'checked_out' ? 'Выселен' :
                         isExpired ? '⏰ Просрочен' :
                         debt > 0 ? 'Долг' : '✓ Оплачено'}
                    </div>
                </div>
            </div>
            
            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-white/10 rounded-lg p-2">
                    <div className="text-[10px] text-white/60 uppercase font-bold mb-1">Комната</div>
                    <div className="text-sm font-bold">№{guest.roomNumber} / Место {guest.bedId}</div>
                </div>
                <div className="bg-white/10 rounded-lg p-2">
                    <div className="text-[10px] text-white/60 uppercase font-bold mb-1">Период</div>
                    <div className="text-sm font-bold">{guest.days} {lang === 'ru' ? 'дн.' : 'kun'}</div>
                </div>
                <div className="bg-white/10 rounded-lg p-2">
                    <div className="text-[10px] text-white/60 uppercase font-bold mb-1">Заезд</div>
                    <div className="text-sm font-bold">{new Date(guest.checkInDate).toLocaleDateString()}</div>
                </div>
                <div className="bg-white/10 rounded-lg p-2">
                    <div className="text-[10px] text-white/60 uppercase font-bold mb-1">Выезд</div>
                    <div className="text-sm font-bold">{new Date(guest.checkOutDate).toLocaleDateString()}</div>
                </div>
            </div>
            
            {/* Financial Info */}
            {guest.status !== 'booking' && (
                <div className="bg-white/10 rounded-lg p-3 mb-3">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-white/70">К оплате:</span>
                        <span className="font-bold">{guest.totalPrice?.toLocaleString()} сум</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-white/70">Оплачено:</span>
                        <span className="font-bold text-emerald-400">{totalPaid.toLocaleString()} сум</span>
                    </div>
                    {debt > 0 && (
                        <div className="flex justify-between items-center pt-2 border-t border-white/20">
                            <span className="text-xs font-bold text-rose-400">Долг:</span>
                            <span className="font-bold text-rose-400">{debt.toLocaleString()} сум</span>
                        </div>
                    )}
                </div>
            )}
            
            {/* Progress */}
            {guest.status === 'active' && !isExpired && (
                <div className="bg-white/10 rounded-lg p-3">
                    <div className="flex justify-between text-xs text-white/70 mb-2">
                        <span>Прогресс проживания</span>
                        <span>{daysStayed} / {daysTotal} дн.</span>
                    </div>
                    <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
                            style={{ width: `${(daysStayed / daysTotal) * 100}%` }}
                        />
                    </div>
                    <div className="text-xs text-white/60 mt-2 text-center">
                        Осталось: {daysLeft} {lang === 'ru' ? 'дн.' : 'kun'}
                    </div>
                </div>
            )}
        </div>
    );
};

// ✅ ПОЛНОСТЬЮ НОВЫЙ CalendarView
const CalendarView = ({ rooms, guests, onSlotClick, lang, currentUser, onDeleteGuest }) => {
    const t = (k) => TRANSLATIONS[lang][k]; 
    const [collapsedRooms, setCollapsedRooms] = useState({});
    const [startDate, setStartDate] = useState(new Date());
    const [hoveredGuest, setHoveredGuest] = useState(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [hoveredRow, setHoveredRow] = useState(null);
    const [hoveredCol, setHoveredCol] = useState(null);

    const shiftDateLeft = useCallback(() => {
        setStartDate(prev => {
            const newDate = new Date(prev);
            newDate.setDate(newDate.getDate() - 1);
            return newDate;
        });
    }, []);

    const shiftDateRight = useCallback(() => {
        setStartDate(prev => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const currentStart = new Date(prev);
            currentStart.setHours(0, 0, 0, 0);
            
            const newDate = new Date(prev);
            
            if (currentStart >= today) {
                newDate.setDate(newDate.getDate() + 7);
            } else {
                newDate.setDate(newDate.getDate() + 1);
            }
            
            return newDate;
        });
    }, []);

    const calendarDaysCount = 20;
    
    // ✅ ОПРЕДЕЛЕНИЕ days
    const days = useMemo(() => {
        return Array.from({length: calendarDaysCount}, (_, i) => {
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
    }, [startDate]);

    const toggleRoom = useCallback((roomId) => {
        setCollapsedRooms(prev => ({...prev, [roomId]: !prev[roomId]}));
    }, []);
    
    const sevenDaysAgo = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        return date;
    }, []);
    
    const relevantGuests = useMemo(() => {
        const uniqueGuests = [];
        const seenIds = new Set();
        
        guests.forEach(g => {
            if (seenIds.has(g.id)) return;
            seenIds.add(g.id);
            
            if (g.status === 'active' || g.status === 'booking') {
                uniqueGuests.push(g);
            } else if (g.status === 'checked_out') {
                const checkOutDate = new Date(g.checkOutDate);
                if (checkOutDate > sevenDaysAgo) {
                    uniqueGuests.push(g);
                }
            }
        });
        
        return uniqueGuests;
    }, [guests, sevenDaysAgo]);

    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';

    const guestStyles = useMemo(() => {
        const styles = {};
        const calendarStart = new Date(days[0].str);
        calendarStart.setHours(0,0,0,0);
        const calendarEnd = new Date(days[days.length-1].str);
        calendarEnd.setHours(23,59,59,999);
        const msPerDay = 1000 * 60 * 60 * 24;
        const totalCalendarMs = msPerDay * calendarDaysCount;
        
        relevantGuests.forEach(guest => {
            let checkInDate = new Date(guest.checkInDate || guest.checkInDateTime || guest.checkIn);
            checkInDate.setHours(12, 0, 0, 0);

            const guestDurationMs = parseInt(guest.days) * 24 * 60 * 60 * 1000;
            const checkOutDate = new Date(checkInDate.getTime() + guestDurationMs);
            checkOutDate.setHours(12, 0, 0, 0);

            if (checkOutDate < calendarStart || checkInDate > calendarEnd) {
                styles[guest.id] = null;
                return;
            }

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

            styles[guest.id] = { leftPercent, widthPercent: finalWidth };
        });
        
        return styles;
    }, [relevantGuests, days, calendarDaysCount]);
    
    const handleEmptyCellClick = useCallback((room, bedId, dateStr, isRightHalf) => {
        const clickDate = new Date(dateStr);
        if (isRightHalf) {
            clickDate.setHours(12, 0, 0, 0); 
        } else {
            clickDate.setDate(clickDate.getDate() - 1);
            clickDate.setHours(12, 0, 0, 0);
        }
        onSlotClick(room, bedId, null, clickDate.toISOString());
    }, [onSlotClick]);

    const handleDeleteGuest = useCallback((e, guestId) => {
        e.stopPropagation();
        if (confirm(t('confirmDelete'))) {
            onDeleteGuest(guestId);
        }
    }, [t, onDeleteGuest]);

    const handleMouseMove = useCallback((e) => {
        setMousePosition({ x: e.clientX, y: e.clientY });
    }, []);

    const tooltipTimeoutRef = useRef(null);
    
    const handleMouseEnter = useCallback((e, guest, room) => {
        if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
        }
        
        setMousePosition({ x: e.clientX, y: e.clientY });
        
        tooltipTimeoutRef.current = setTimeout(() => {
            setHoveredGuest({ ...guest, room });
        }, 100);
    }, []);

    const handleMouseLeave = useCallback(() => {
        if (tooltipTimeoutRef.current) {
            clearTimeout(tooltipTimeoutRef.current);
        }
        setHoveredGuest(null);
    }, []);

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200/80 shadow-sm">
                <div className="flex gap-1.5">
                    <button onClick={shiftDateLeft} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-600 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-200">
                        <ChevronLeft size={18}/>
                    </button>
                    <button 
                        onClick={() => { 
                            const d = new Date(); 
                            d.setHours(0,0,0,0); 
                            setStartDate(d); 
                        }} 
                        className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-medium hover:bg-slate-700 shadow-sm transition-all"
                    >
                        {t('today')}
                    </button>
                    <button onClick={shiftDateRight} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-600 hover:text-slate-800 transition-colors border border-transparent hover:border-slate-200">
                        <ChevronRight size={18}/>
                    </button>
                </div>
				
                <div className="flex items-center gap-2.5">
                    <div className="text-xs font-medium text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                        {days[0].date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — {days[days.length - 1].date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    
                    <div className="flex items-center gap-2 text-[10px]">
                        <div className="flex items-center gap-1">
                            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/70"></div>
                            <span className="text-slate-600 font-medium">Оплачено</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-2.5 h-2.5 rounded-sm bg-rose-500/70"></div>
                            <span className="text-slate-600 font-medium">Долг</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-2.5 h-2.5 rounded-sm bg-amber-500/70"></div>
                            <span className="text-slate-600 font-medium">Бронь</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="w-2.5 h-2.5 rounded-sm bg-slate-400"></div>
                            <span className="text-slate-600 font-medium">Просрочен</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto relative" style={{willChange: 'scroll-position'}}>
                <div className="min-w-[2000px]" style={{contain: 'layout style'}}>
                    <div className="flex sticky top-0 bg-white z-40 border-b border-slate-200 shadow-sm h-12">
                        <div className="w-40 p-2 font-medium text-[10px] text-slate-600 bg-slate-50/50 border-r border-slate-200 sticky left-0 z-50 flex items-center">
                            <BedDouble size={14} className="mr-1.5 text-slate-500"/>
                            {t('room')} / {t('bed')}
                        </div>
                        {days.map((d, colIndex) => {
                            const isToday = d.str === getLocalDateString(new Date());
                            const isWeekend = ['сб','вс'].includes(d.week);
                            const isHovered = hoveredCol === colIndex;
                            
                            return (
                                <div 
                                    key={d.str} 
                                    className={`flex-1 min-w-[80px] flex flex-col items-center justify-center px-1 border-r border-slate-200/60 transition-colors ${
                                        isHovered ? 'bg-blue-100/50' :
                                        isToday ? 'bg-blue-50/50 border-blue-200' :
                                        isWeekend ? 'bg-slate-50' : 'bg-white'
                                    }`}
                                >
                                    <div className={`text-[8px] uppercase font-medium ${isToday ? 'text-blue-700' : 'text-slate-400'}`}>
                                        {d.week}
                                    </div>
                                    <div className={`text-sm font-semibold my-0.5 ${isToday ? 'text-blue-900' : 'text-slate-800'}`}>
                                        {d.day}
                                    </div>
                                    <div className={`text-[8px] ${isToday ? 'text-blue-600' : 'text-slate-400'}`}>
                                        {d.month < 10 ? '0' : ''}{d.month}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {rooms.map(room => {
                        const isCollapsed = collapsedRooms[room.id];
                        const roomLabel = lang === 'uz' ? `Xona №${room.number}` : `Комната №${room.number}`;
                        
                        return (
                            <div key={room.id} className="border-b border-slate-200/60 hover:bg-slate-50/30 transition-colors">
                                <div 
                                    className="flex items-center justify-between px-3 py-1.5 bg-slate-50/50 hover:bg-slate-100/50 cursor-pointer font-medium text-slate-700 text-xs sticky left-0 z-30 border-r border-slate-200 w-40 border-b border-slate-200/60 transition-all"
                                    onClick={() => toggleRoom(room.id)}
                                >
                                    <span className="flex items-center gap-1.5">
                                        <Building2 size={12} className="text-slate-500"/>
                                        {roomLabel}
                                    </span>
                                    {isCollapsed ? <ChevronDown size={14} className="text-slate-400"/> : <ChevronUp size={14} className="text-slate-400"/>}
                                </div>

                                {!isCollapsed && Array.from({length: room.capacity}, (_, i) => i + 1).map(bedId => {
                                    const bedGuests = relevantGuests.filter(g => g.roomId === room.id && String(g.bedId) === String(bedId));
                                    const rowKey = `${room.id}-${bedId}`;
                                    const isRowHovered = hoveredRow === rowKey;
                                    
                                    return (
                                        <div 
                                            key={bedId} 
                                            className={`flex h-10 border-b border-slate-100/60 last:border-b-0 relative group/row transition-colors ${
                                                isRowHovered ? 'bg-blue-100/30' : 'hover:bg-blue-50/20'
                                            }`}
                                            onMouseEnter={() => setHoveredRow(rowKey)}
                                            onMouseLeave={() => setHoveredRow(null)}
                                        >
                                            <div className={`w-40 px-3 flex items-center justify-between border-r border-slate-200/60 bg-white sticky left-0 z-30 text-xs font-medium text-slate-600 transition-colors ${
                                                isRowHovered ? 'bg-blue-100/40' : 'group-hover/row:bg-blue-50/30'
                                            }`}>
                                                <span className="flex items-center gap-1.5">
                                                    <BedDouble size={12} className="text-slate-400"/>
                                                    <span className="text-slate-700">№{bedId}</span>
                                                </span>
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium ${
                                                    bedId % 2 === 0 ? 'bg-blue-100/70 text-blue-700 border border-blue-200/50' : 'bg-purple-100/70 text-purple-700 border border-purple-200/50'
                                                }`}>
                                                    {bedId % 2 === 0 ? '⬆️' : '⬇️'}
                                                </span>
                                            </div>

                                            <div className="flex-1 relative">
                                                <div className="absolute inset-0 flex">
                                                    {days.map((d, colIndex) => {
                                                        const isToday = d.str === getLocalDateString(new Date());
                                                        const isWeekend = ['сб','вс'].includes(d.week);
                                                        const isColHovered = hoveredCol === colIndex;
                                                        
                                                        return (
                                                            <div 
                                                                key={d.str} 
                                                                className={`flex-1 min-w-[80px] border-r border-slate-100/50 h-full flex transition-colors ${
                                                                    isColHovered ? 'bg-blue-100/30' :
                                                                    isToday ? 'bg-blue-50/30' : 
                                                                    isWeekend ? 'bg-slate-50/30' : ''
                                                                }`}
                                                                onMouseEnter={() => setHoveredCol(colIndex)}
                                                                onMouseLeave={() => setHoveredCol(null)}
                                                            >
                                                                <div 
                                                                    className="w-1/2 h-full cursor-pointer hover:bg-blue-200/40 border-r border-slate-100/30 transition-colors" 
                                                                    onClick={() => handleEmptyCellClick(room, bedId, d.str, false)}
                                                                />
                                                                <div 
                                                                    className="w-1/2 h-full cursor-pointer hover:bg-blue-200/40 transition-colors" 
                                                                    onClick={() => handleEmptyCellClick(room, bedId, d.str, true)}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {bedGuests.map(guest => {
                                                    const styleData = guestStyles[guest.id];
                                                    if (!styleData) return null;
                                                    
                                                    const totalPaid = getTotalPaid(guest);
                                                    const debt = (guest.totalPrice || 0) - totalPaid;
                                                    const isCheckedOut = guest.status === 'checked_out';
                                                    
                                                    const now = new Date();
                                                    const checkOut = new Date(guest.checkOutDate);
                                                    if (typeof guest.checkOutDate === 'string' && !guest.checkOutDate.includes('T')) {
                                                        checkOut.setHours(12, 0, 0, 0);
                                                    }
                                                    const isExpired = now >= checkOut && !isCheckedOut;
                                                    
                                                    const totalPrice = guest.totalPrice || 0;
                                                    const paidRatio = totalPrice > 0 ? Math.min(1, totalPaid / totalPrice) : 0;
                                                    
                                                    const bgClass = guest.status === 'booking' ? 'bg-amber-500/90 border-amber-600' :
                                                                   isCheckedOut ? 'bg-slate-400/90 border-slate-500' :
                                                                   isExpired ? 'bg-slate-400/90 border-slate-500' :
                                                                   debt > 0 ? 'bg-rose-500/90 border-rose-600' :
                                                                   'bg-emerald-500/90 border-emerald-600';

                                                    const zIndex = isCheckedOut ? 'z-10' : 
                                                                   isExpired ? 'z-15' : 
                                                                   guest.status === 'booking' ? 'z-20' :
                                                                   'z-25';

                                                    return (
                                                        <div 
                                                            key={guest.id}
                                                            className={`absolute top-0.5 bottom-0.5 ${zIndex} rounded-md cursor-pointer hover:z-50 border group/block overflow-hidden ${bgClass} flex items-center transition-all duration-150`}
                                                            style={{
                                                                left: `${styleData.leftPercent}%`,
                                                                width: `${styleData.widthPercent}%`,
                                                                willChange: 'transform',
                                                                boxShadow: hoveredGuest?.id === guest.id 
                                                                    ? '0 4px 12px rgba(0,0,0,0.2)' 
                                                                    : '0 1px 3px rgba(0,0,0,0.1)'
                                                            }}
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                onSlotClick(room, bedId, guest, null); 
                                                            }}
                                                            onMouseEnter={(e) => handleMouseEnter(e, guest, room)}
                                                            onMouseMove={handleMouseMove}
                                                            onMouseLeave={handleMouseLeave}
                                                        >
                                                            {!isCheckedOut && !isExpired && guest.status !== 'booking' && paidRatio > 0 && (
                                                                <div 
                                                                    className="absolute inset-0 bg-emerald-500/90"
                                                                    style={{ width: `${paidRatio * 100}%` }}
                                                                />
                                                            )}

                                                            {!isCheckedOut && !isExpired && debt > 0 && guest.status !== 'booking' && paidRatio < 1 && (
                                                                <div 
                                                                    className="absolute inset-0 bg-rose-500/90"
                                                                    style={{ 
                                                                        left: `${paidRatio * 100}%`,
                                                                        width: `${(1 - paidRatio) * 100}%` 
                                                                    }}
                                                                />
                                                            )}

                                                            <div className="sticky left-0 px-1.5 flex items-center gap-1 w-full relative z-10">
                                                                <div className="bg-white/25 p-0.5 rounded backdrop-blur-sm">
                                                                    {guest.status === 'booking' ? <Clock size={10} className="text-white"/> :
                                                                     isExpired ? <AlertCircle size={10} className="text-white"/> :
                                                                     <User size={10} className="text-white"/>}
                                                                </div>
                                                                
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-semibold text-[10px] text-white truncate">
                                                                        {guest.fullName}
                                                                    </div>
                                                                    <div className="flex items-center gap-1 text-[8px] text-white/90">
                                                                        <span>{guest.days}д</span>
                                                                        {debt > 0 && !isCheckedOut && !isExpired && (
                                                                            <>
                                                                                <span>•</span>
                                                                                <span className="font-semibold">-{debt.toLocaleString()}</span>
                                                                            </>
                                                                        )}
                                                                        {isExpired && (
                                                                            <>
                                                                                <span>•</span>
                                                                                <span className="font-semibold">OUT</span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                
                                                                {isCheckedOut && isAdmin && (
                                                                    <button 
                                                                        onClick={(e) => handleDeleteGuest(e, guest.id)}
                                                                        className="bg-white/20 hover:bg-rose-500 p-0.5 rounded text-white transition-colors opacity-0 group-hover/block:opacity-100"
                                                                        title={t('delete')}
                                                                    >
                                                                        <X size={10} strokeWidth={3}/>
                                                                    </button>
                                                                )}
                                                            </div>
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
            
            {hoveredGuest && (
                <GuestTooltip 
                    guest={hoveredGuest} 
                    room={hoveredGuest.room} 
                    mousePos={mousePosition}
                    lang={lang}
                />
            )}
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
                                     <td className="p-4 text-slate-500">{u.hostelId}{u.canViewHostel1 && ' + №1'}</td>
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

// ✅ ИЗМЕНЕНИЕ: Добавлена пагинация и фильтрация по странам
const ClientsView = ({ clients, onUpdateClient, onImportClients, onDeduplicate, onBulkDelete, onNormalizeCountries, lang, currentUser, onOpenClientHistory }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [search, setSearch] = useState('');
    const [editingClient, setEditingClient] = useState(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [countryFilter, setCountryFilter] = useState('');

    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';

    // ✅ НОВОЕ: Фильтрация с поиском по базе и фильтром стран
    const filtered = useMemo(() => {
        return clients.filter(c => {
            const matchesSearch = !search || 
                (c.fullName || '').toLowerCase().includes(search.toLowerCase()) || 
                (c.passport || '').includes(search.toUpperCase());
            
            const matchesCountry = !countryFilter || c.country === countryFilter;
            
            return matchesSearch && matchesCountry;
        });
    }, [clients, search, countryFilter]);

    // ✅ НОВОЕ: Пагинация
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginatedClients = filtered.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // ✅ НОВОЕ: Список уникальных стран
    const uniqueCountries = useMemo(() => {
        const countries = new Set(clients.map(c => c.country).filter(Boolean));
        return Array.from(countries).sort();
    }, [clients]);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, countryFilter, itemsPerPage]);
    
    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedIds(new Set(paginatedClients.map(c => c.id)));
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
                
                {/* ✅ НОВОЕ: Фильтр по странам */}
                <div className="w-full md:w-64">
                    <select 
                        className={inputClass} 
                        value={countryFilter} 
                        onChange={e => setCountryFilter(e.target.value)}
                    >
                        <option value="">{t('filterByCountry')}: {t('allHostels')}</option>
                        {uniqueCountries.map(country => (
                            <option key={country} value={country}>{country}</option>
                        ))}
                    </select>
                </div>

                {/* ✅ НОВОЕ: Выбор количества на странице */}
                <div className="w-full md:w-32">
                    <select 
                        className={inputClass} 
                        value={itemsPerPage} 
                        onChange={e => setItemsPerPage(Number(e.target.value))}
                    >
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </div>
                
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

            {/* ✅ НОВОЕ: Информация о пагинации */}
            <div className="flex justify-between items-center text-sm text-slate-500">
                <span>{t('show')} {Math.min(itemsPerPage, filtered.length)} / {filtered.length}</span>
                <span>Страница {currentPage} из {totalPages}</span>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
                 <table className="w-full text-sm text-left min-w-[600px]">
                     <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                         <tr>
                             {isAdmin && (
                                 <th className="p-4 w-10">
                                     <input type="checkbox" onChange={handleSelectAll} checked={selectedIds.size > 0 && selectedIds.size === paginatedClients.length} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"/>
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
                         {paginatedClients.map(c => (
                             <tr key={c.id} className={selectedIds.has(c.id) ? 'bg-indigo-50' : 'hover:bg-slate-50'}>
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
                                     <div className="flex gap-1">
                                         <button 
                                             onClick={() => onOpenClientHistory(c)} 
                                             className="p-2 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                             title="История визитов"
                                         >
                                             <History size={16}/>
                                         </button>
                                         <button 
                                             onClick={() => setEditingClient(c)} 
                                             className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                             title="Редактировать"
                                         >
                                             <Edit size={16}/>
                                         </button>
                                     </div>
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
            </div>

            {/* ✅ НОВО��: Навигация по страницам */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    <Button 
                        variant="secondary" 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                        disabled={currentPage === 1}
                        icon={ChevronLeft}
                        size="sm"
                    />
                    {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                            pageNum = i + 1;
                        } else if (currentPage <= 3) {
                            pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                        } else {
                            pageNum = currentPage - 2 + i;
                        }
                        return (
                            <Button
                                key={pageNum}
                                variant={currentPage === pageNum ? 'primary' : 'secondary'}
                                onClick={() => setCurrentPage(pageNum)}
                                size="sm"
                            >
                                {pageNum}
                            </Button>
                        );
                    })}
                    <Button 
                        variant="secondary" 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                        disabled={currentPage === totalPages}
                        icon={ChevronRight}
                        size="sm"
                    />
                </div>
            )}

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
const ClientHistoryModal = ({ client, guests, users, rooms, onClose, onRepeatStay, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    
    const clientGuests = guests
        .filter(g => g.passport === client.passport || g.fullName === client.fullName)
        .sort((a, b) => new Date(b.checkInDate) - new Date(a.checkInDate));
    
    const totalSpent = clientGuests.reduce((sum, g) => sum + (g.totalPrice || 0), 0);
    const totalPaid = clientGuests.reduce((sum, g) => sum + getTotalPaid(g), 0);
    const totalDebt = totalSpent - totalPaid;
    const totalRefunded = clientGuests
        .filter(g => g.status === 'checked_out')
        .reduce((sum, g) => {
            const paid = getTotalPaid(g);
            const actual = g.totalPrice || 0;
            return sum + Math.max(0, paid - actual);
        }, 0);

    const latestStay = clientGuests.find(g => g.status === 'checked_out' || g.status === 'active');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-indigo-600 text-white p-6 flex justify-between items-start">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <User size={24} />
                            <h2 className="text-2xl font-bold">{client.fullName}</h2>
                        </div>
                        <div className="text-sm text-white/80 space-y-1">
                            <div>Паспорт: {client.passport}</div>
                            <div>Страна: {client.country}</div>
                            <div>Визитов: {clientGuests.length}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <XCircle size={24} />
                    </button>
                </div>

                <div className="grid grid-cols-4 gap-4 p-6 bg-slate-50 border-b border-slate-200">
                    <div className="text-center">
                        <div className="text-xs text-slate-500 uppercase font-bold">Потрачено</div>
                        <div className="text-lg font-bold text-slate-800">{totalSpent.toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-slate-500 uppercase font-bold">Оплачено</div>
                        <div className="text-lg font-bold text-emerald-600">{totalPaid.toLocaleString()}</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-slate-500 uppercase font-bold">Долг</div>
                        <div className={`text-lg font-bold ${totalDebt > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {totalDebt.toLocaleString()}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-xs text-slate-500 uppercase font-bold">Возвраты</div>
                        <div className="text-lg font-bold text-amber-600">{totalRefunded.toLocaleString()}</div>
                    </div>
                </div>

                {latestStay && (
                    <div className="p-4 bg-indigo-50 border-b border-indigo-100">
                        <Button 
                            onClick={() => onRepeatStay(latestStay)} 
                            icon={Copy} 
                            className="w-full"
                        >
                            🔄 {t('repeatStay')} ({latestStay.days} дн., {latestStay.pricePerNight} сум/ночь)
                        </Button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-6">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <History size={20} />
                        {t('clientHistory')}
                    </h3>
                    <div className="space-y-3">
                        {clientGuests.map(g => {
                            const paid = getTotalPaid(g);
                            const debt = (g.totalPrice || 0) - paid;
                            const staff = users.find(u => u.id === g.staffId || u.login === g.staffId);
                            const room = rooms.find(r => r.id === g.roomId);
                            
                            return (
                                <div key={g.id} className={`p-4 rounded-xl border ${g.status === 'active' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="font-bold text-slate-800">
                                                {new Date(g.checkInDate).toLocaleDateString()} — {g.checkOutDate ? new Date(g.checkOutDate).toLocaleDateString() : '...'}
                                            </div>
                                            <div className="text-sm text-slate-500">
                                                {room ? `Комната ${room.number}` : 'N/A'} • Место {g.bedId} • {g.days} дн.
                                            </div>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                                            g.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 
                                            g.status === 'booking' ? 'bg-amber-100 text-amber-700' : 
                                            'bg-slate-100 text-slate-600'
                                        }`}>
                                            {g.status === 'active' ? 'Активен' : g.status === 'booking' ? 'Бронь' : 'Выселен'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <div className="flex gap-4">
                                            <span>Сумма: <b>{(g.totalPrice || 0).toLocaleString()}</b></span>
                                            <span>Оплачено: <b className="text-emerald-600">{paid.toLocaleString()}</b></span>
                                            {debt > 0 && <span>Долг: <b className="text-rose-600">{debt.toLocaleString()}</b></span>}
                                        </div>
                                        <span className="text-slate-400 text-xs">
                                            {staff?.name || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
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
    
    // --- ЛОГИКА АГРЕГАЦИИ (БЕЗ ИЗМЕНЕНИЙ) ---
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
    
    // --- STATE ---
    const [selectedDebtor, setSelectedDebtor] = useState(null);
    const [payCash, setPayCash] = useState('');
    const [payCard, setPayCard] = useState('');
    const [payQR, setPayQR] = useState('');
    const [adminAdjustAmount, setAdminAdjustAmount] = useState('');
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [isAdminAdjustModalOpen, setIsAdminAdjustModalOpen] = useState(false);
    const [magnetActiveField, setMagnetActiveField] = useState(null);
    const [isCreateDebtModalOpen, setIsCreateDebtModalOpen] = useState(false);

    // --- HANDLERS ---
    const handlePayClick = (debtor) => { 
        setSelectedDebtor(debtor); 
        setIsPayModalOpen(true); 
        setPayCash(''); 
        setPayCard(''); 
        setPayQR(''); 
        setMagnetActiveField(null);
    };
    
    const handleAdminAdjustClick = (debtor) => { 
        setSelectedDebtor(debtor); 
        setIsAdminAdjustModalOpen(true); 
        setAdminAdjustAmount(''); 
    }
    
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

    // --- UI RENDER ---
    return (
        <div className="space-y-6 pb-20 animate-in fade-in duration-300">
            
            {/* HEADER & FILTERS */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col lg:flex-row gap-4 items-end">
                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('staff')}</label>
                        <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
                            <option value="">Все сотрудники</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">{t('date')}</label>
                        <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-100" value={startDate} onChange={e => setStartDate(e.target.value)} />
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

            {/* LIST (CARDS) */}
            <div className="grid gap-3">
                {aggregatedDebts.length === 0 ? (
                    <div className="bg-white rounded-xl p-10 text-center border border-slate-200 border-dashed">
                        <CheckCircle2 size={48} className="mx-auto mb-3 text-slate-300"/>
                        <p className="text-slate-500 font-medium">{t('noData')}</p>
                    </div>
                ) : (
                    aggregatedDebts.map(item => (
                        <div key={item.id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col md:flex-row items-center gap-4 group">
                            
                            {/* Left: Info */}
                            <div className="flex-1 w-full flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center text-lg font-bold">
                                    {item.roomNumber}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-slate-800 text-lg truncate mb-0.5">{item.fullName}</h3>
                                    <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{item.passport}</span>
                                        <span>{users.find(u => u.id === item.staffId || u.login === item.staffId)?.name || item.staffId}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Actions & Debt */}
                            <div className="w-full md:w-auto flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
                                <div className="text-right">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('debt')}</div>
                                    <div className="text-xl font-black text-rose-600">
                                        {item.totalDebt.toLocaleString()}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handlePayClick(item)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-lg font-bold transition-colors shadow-sm flex items-center gap-2 text-sm"
                                    >
                                        <Wallet size={18}/> {t('payDebt')}
                                    </button>
                                    {isAdmin && (
                                        <button 
                                            onClick={() => handleAdminAdjustClick(item)}
                                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-3 rounded-lg transition-colors border border-slate-200"
                                            title={t('addDebt')}
                                        >
                                            <Edit size={18}/>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* PAY MODAL */}
            {isPayModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl border border-slate-300 overflow-hidden">
                        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                            <h3 className="font-bold text-lg text-slate-800">{t('payDebt')}</h3>
                            <p className="text-sm text-slate-500 font-medium">{selectedDebtor?.fullName}</p>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            {/* Total Debt Badge */}
                            <div className="bg-rose-50 border border-rose-100 p-3 rounded-lg text-center">
                                <div className="text-xs font-bold text-rose-400 uppercase">Общий долг</div>
                                <div className="text-2xl font-black text-rose-600">{selectedDebtor?.totalDebt.toLocaleString()}</div>
                            </div>

                            {['payCash', 'payCard', 'payQR'].map(field => (
                                <div key={field} className="relative">
                                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                                        {field === 'payCash' ? <DollarSign size={16}/> : field === 'payCard' ? <CreditCard size={16}/> : <QrCode size={16}/>}
                                    </div>
                                    <input 
                                        type="number" 
                                        className="w-full pl-10 pr-10 py-3 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all no-spinner placeholder:font-normal"
                                        placeholder={field === 'payCash' ? t('cash') : field === 'payCard' ? t('card') : t('qr')}
                                        value={field === 'payCash' ? payCash : field === 'payCard' ? payCard : payQR}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if(field === 'payCash') setPayCash(val);
                                            else if(field === 'payCard') setPayCard(val);
                                            else setPayQR(val);
                                            setMagnetActiveField(null);
                                        }}
                                        onWheel={disableWheel}
                                    />
                                    <button 
                                        onClick={() => applyMagnet(field)}
                                        disabled={magnetActiveField && magnetActiveField !== field}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors disabled:opacity-30"
                                    >
                                        <Magnet size={16}/>
                                    </button>
                                </div>
                            ))}

                            <div className="flex gap-3 mt-2">
                                <button onClick={() => setIsPayModalOpen(false)} className="flex-1 py-3 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50">
                                    {t('cancel')}
                                </button>
                                <button onClick={submitPayment} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-md shadow-emerald-200">
                                    {t('save')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ADMIN ADJUST MODAL */}
            {isAdminAdjustModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl border border-slate-300 overflow-hidden">
                        <div className="px-6 py-4 bg-amber-50 border-b border-amber-100">
                            <h3 className="font-bold text-lg text-amber-900">{t('addDebt')} (Admin)</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-500">Введите сумму (+ или -) для корректировки баланса.</p>
                            <input 
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-lg font-bold outline-none focus:border-amber-500" 
                                type="number" 
                                value={adminAdjustAmount} 
                                onChange={e => setAdminAdjustAmount(e.target.value)} 
                                placeholder="+/- Сумма" 
                                onWheel={disableWheel}
                            />
                            <div className="flex gap-3">
                                <button onClick={() => setIsAdminAdjustModalOpen(false)} className="flex-1 py-3 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50">
                                    {t('cancel')}
                                </button>
                                <button onClick={submitAdminAdjust} className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold shadow-md shadow-amber-200">
                                    {t('save')}
                                </button>
                            </div>
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

    const filteredData = allTransactions.filter(t => {
        const tTime = new Date(t.date).getTime();
        const startTime = filters.start ? new Date(filters.start).getTime() : 0;
        const endTime = filters.end ? new Date(filters.end).getTime() : Infinity;
        const matchesDate = tTime >= startTime && tTime <= endTime;
        const matchesStaff = filters.staffId ? (t.staffId === filters.staffId || (users.find(u=>u.id===filters.staffId)?.login === t.staffId)) : true;
        const matchesMethod = filters.method ? t.method === filters.method : true;
        const matchesType = filters.type ? t.type === filters.type : true;
        const matchesHostel = filters.hostelId ? t.hostelId === filters.hostelId : true;
        
        if (parseInt(t.amount) === 0) return false;
        
        return matchesDate && matchesStaff && matchesMethod && matchesType && matchesHostel;
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end mb-4">
                    <div>
                        <label className={labelClass}>From</label>
                        <input 
                            type="datetime-local" 
                            className={inputClass} 
                            value={tempFilters.start} 
                            onChange={e => setTempFilters({...tempFilters, start: e.target.value})} 
                        />
                    </div>
                    <div>
                        <label className={labelClass}>To</label>
                        <input 
                            type="datetime-local" 
                            className={inputClass} 
                            value={tempFilters.end} 
                            onChange={e => setTempFilters({...tempFilters, end: e.target.value})} 
                        />
                    </div>
                    
                    <div>
                        <label className={labelClass}>Тип операции</label>
                        <select 
                            className={inputClass} 
                            value={tempFilters.type} 
                            onChange={e => setTempFilters({...tempFilters, type: e.target.value})}
                        >
                            <option value="">Все</option>
                            <option value="income">Приход</option>
                            <option value="expense">Расход</option>
                        </select>
                    </div>
                    
                    <div>
                        <label className={labelClass}>{t('staff')}</label>
                        <select 
                            className={inputClass} 
                            value={tempFilters.staffId} 
                            onChange={e => setTempFilters({...tempFilters, staffId: e.target.value})}
                        >
                            <option value="">All</option>
                            {availableCashiers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                    
                    <div>
                        <label className={labelClass}>Payment Method</label>
                        <select 
                            className={inputClass} 
                            value={tempFilters.method} 
                            onChange={e => setTempFilters({...tempFilters, method: e.target.value})}
                        >
                            <option value="">All</option>
                            <option value="cash">{t('cash')}</option>
                            <option value="card">{t('card')}</option>
                            <option value="qr">{t('qr')}</option>
                        </select>
                    </div>
                </div>
                
                <div className="flex gap-2 justify-end border-t border-slate-100 pt-4">
                    <Button onClick={handleApplyFilters} icon={Check} className="flex-1 md:flex-none">
                        {t('save')}
                    </Button>
                    <Button 
                        icon={Printer} 
                        variant="secondary" 
                        onClick={() => printReport(filteredData, totalIncome, totalExpense, filters, users)} 
                        className="flex-1 md:flex-none"
                    >
                        {t('printReport')}
                    </Button>
                    <Button 
                        icon={Download} 
                        variant="secondary" 
                        onClick={handleExport} 
                        className="flex-1 md:flex-none"
                    >
                        Export (XLS)
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-center">
                    <div className="text-sm text-emerald-600 font-bold uppercase">{t('income')}</div>
                    <div className="text-2xl font-bold text-emerald-800">+{totalIncome.toLocaleString()}</div>
                </div>
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-center">
                    <div className="text-sm text-rose-600 font-bold uppercase">{t('expense')}</div>
                    <div className="text-2xl font-bold text-rose-800">-{totalExpense.toLocaleString()}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                    <div className="text-sm text-slate-600 font-bold uppercase">{t('balance')}</div>
                    <div className="text-2xl font-bold text-slate-800">{(totalIncome - totalExpense).toLocaleString()}</div>
                </div>
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
                                <td className="p-4">
                                    {t.type === 'income' ? 
                                        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs font-bold">IN</span> : 
                                        <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded text-xs font-bold">OUT</span>
                                    }
                                </td>
                                <td className={`p-4 font-bold ${t.type==='income'?'text-emerald-700':'text-rose-700'}`}>
                                    {parseInt(t.amount).toLocaleString()}
                                </td>
                                <td className="p-4 uppercase text-xs font-bold text-slate-500">{t.method}</td>
                                <td className="p-4">{users.find(u => u.id === t.staffId || u.login === t.staffId)?.name || 'N/A'}</td>
                                <td className="p-4 text-slate-600 truncate max-w-[200px]">
                                    {t.comment || (t.guestId ? guests.find(g => g.id === t.guestId)?.fullName : '-')}
                                </td>
                                {currentUser.role === 'super' && (
                                    <td className="p-4">
                                        <button 
                                            onClick={() => onDeletePayment(t.id, t.type)} 
                                            className="text-rose-500 hover:bg-rose-50 p-2 rounded" 
                                            title="Delete"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
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

// ✅ ПРОДОЛЖЕНИЕ: Остальные компоненты будут в следующем сообщении...
// Код слишком большой, продолжаю в следующем блоке
const FillButton = ({ onClick, disabled }) => (
    <button type="button" onClick={onClick} disabled={disabled} className="ml-1 px-2 py-1 rounded bg-slate-100 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed">
        <Magnet size={16} />
    </button>
);

const ShiftsView = ({ shifts, users, currentUser, onStartShift, onEndShift, onTransferShift, lang, hostelId, onAdminAddShift, onAdminUpdateShift }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const isAdmin = currentUser.role === 'admin' || currentUser.role === 'super';

    const myActiveShift = shifts.find(s => s.staffId === currentUser.id && !s.endTime);
    const allCashiers = users.filter(u => u.role === 'cashier' && u.id !== currentUser.id);
    const [transferTarget, setTransferTarget] = useState('');

    const [dateRange, setDateRange] = useState({ 
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0], 
        end: new Date().toISOString().split('T')[0] 
    });
    const [filterCashierId, setFilterCashierId] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingShift, setEditingShift] = useState(null);
    const [shiftForm, setShiftForm] = useState({ staffId: '', startTime: '', endTime: '', hostelId: 'hostel1' });

    const displayedShifts = useMemo(() => {
        let list = shifts;
        
        if (!isAdmin) {
            list = list.filter(s => s.staffId === currentUser.id);
        } else {
            const start = new Date(dateRange.start); start.setHours(0,0,0,0);
            const end = new Date(dateRange.end); end.setHours(23,59,59,999);
            list = list.filter(s => {
                const sDate = new Date(s.startTime);
                return sDate >= start && sDate <= end;
            });

            if (filterCashierId) {
                list = list.filter(s => s.staffId === filterCashierId);
            }
        }
        return list.sort((a,b) => new Date(b.startTime) - new Date(a.startTime));
    }, [shifts, isAdmin, currentUser.id, dateRange, filterCashierId]);

    const totalSalary = useMemo(() => {
        return displayedShifts.reduce((sum, s) => {
            if (!s.endTime) return sum;
            return sum + calculateSalary(s.startTime, s.endTime);
        }, 0);
    }, [displayedShifts]);

    const handleExportExcel = () => {
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
                            <input type="date" className="border rounded-lg px-2 py-2 text-sm" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
                            <span>-</span>
                            <input type="date" className="border rounded-lg px-2 py-2 text-sm" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
                            
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
    
    const initialStep = (initialRoom && preSelectedBedId) ? 2 : 1;
    const [step, setStep] = useState(initialStep);
    
    const [formData, setFormData] = useState({
        roomId: initialRoom?.id || '',
        roomNumber: initialRoom?.number || '',
        bedId: preSelectedBedId || '',
        fullName: '',
        passport: '',
        country: '',
        birthDate: '',
        checkInDate: initialDate ? initialDate.split('T')[0] : new Date().toISOString().split('T')[0],
        days: 1,
        pricePerNight: initialRoom?.price || 0,
        paidCash: 0,
        paidCard: 0,
        paidQR: 0,
        status: 'active'
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [matchedClients, setMatchedClients] = useState([]);

    useEffect(() => {
        if (searchTerm.length >= 2) {
            const matches = clients.filter(c => 
                c.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.passport?.toLowerCase().includes(searchTerm.toLowerCase())
            ).slice(0, 5);
            setMatchedClients(matches);
        } else {
            setMatchedClients([]);
        }
    }, [searchTerm, clients]);

    const handleClientSelect = (client) => {
        setFormData(prev => ({
            ...prev,
            fullName: client.fullName || '',
            passport: client.passport || '',
            country: client.country || '',
            birthDate: client.birthDate || ''
        }));
        setSearchTerm('');
        setMatchedClients([]);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (field === 'fullName') setSearchTerm(value);
    };

    const handleRoomChange = (roomId) => {
        const room = allRooms.find(r => r.id === roomId);
        if (room) {
            setFormData(prev => ({
                ...prev,
                roomId: room.id,
                roomNumber: room.number,
                pricePerNight: room.price || 0,
                bedId: ''
            }));
        }
    };

    const getAvailableBeds = () => {
        if (!formData.roomId) return [];
        const room = allRooms.find(r => r.id === formData.roomId);
        if (!room) return [];
        
        const now = new Date();
        
        const occupiedBeds = guests.filter(g => {
            if (g.roomId !== formData.roomId) return false;
            if (g.status !== 'active') return false;
            
            const rawCheckOut = g.checkOutDate;
            if (!rawCheckOut) return true;
            const checkOut = new Date(rawCheckOut);
            if (typeof rawCheckOut === 'string' && !rawCheckOut.includes('T')) {
                checkOut.setHours(12, 0, 0, 0);
            }
            
            return now < checkOut;
        }).map(g => String(g.bedId));

        return Array.from({length: room.capacity}, (_, i) => i + 1).map(bedId => ({
            id: bedId,
            occupied: occupiedBeds.includes(String(bedId))
        }));
    };

    const handleMagnetClick = (field) => {
        const totalPrice = parseInt(formData.days) * parseInt(formData.pricePerNight);
        const currentTotal = parseInt(formData.paidCash || 0) + parseInt(formData.paidCard || 0) + parseInt(formData.paidQR || 0);
        const remaining = Math.max(0, totalPrice - currentTotal);
        
        if (remaining > 0) {
            handleChange(field, (parseInt(formData[field] || 0) + remaining).toString());
        }
    };

    // ✅ АВТОМАТИЧЕСКАЯ ЛОГИКА: Если сейчас 8:00-11:59 и выбрана сегодняшняя дата → 00:00 сегодня
const getCheckInDateTime = () => {
    const now = new Date();
    const currentHour = now.getHours();
    
    const selectedDate = new Date(formData.checkInDate);
    selectedDate.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // ✅ РАННИЙ ЗАЕЗД: если сейчас 8:00-11:59 И выбрана сегодняшняя дата
    if (currentHour >= 8 && currentHour < 12 && selectedDate.getTime() === today.getTime()) {
        // Устанавливаем на сегодня 00:00 (полночь)
        const checkInDateTime = new Date(selectedDate);
        checkInDateTime.setHours(0, 0, 0, 0);
        return { 
            dateTime: checkInDateTime.toISOString(), 
            isEarlyCheckIn: true 
        };
    }
    
    // ✅ ОБЫЧНЫЙ ЗАЕЗД: выбранная дата 12:00
    const checkInDateTime = new Date(selectedDate);
    checkInDateTime.setHours(12, 0, 0, 0);
    return { 
        dateTime: checkInDateTime.toISOString(), 
        isEarlyCheckIn: false 
    };
};

    // ✅ ЗАСЕЛЕНИЕ
    const handleSubmit = () => {
        if (!formData.fullName || !formData.passport || !formData.roomId || !formData.bedId) {
            notify(t('fillAllFields'), 'error');
            return;
        }

        const { dateTime: checkInDateTime, isEarlyCheckIn } = getCheckInDateTime();
        const stay = getStayDetails(checkInDateTime, parseInt(formData.days));
        const totalPrice = parseInt(formData.days) * parseInt(formData.pricePerNight);

        console.log('✅ Check-in:', { 
            isEarlyCheckIn, 
            checkInDateTime, 
            checkOutDateTime: stay.end.toISOString() 
        });

        onSubmit({
            ...formData,
            status: 'active',
            checkInDate: stay.start.toISOString(),
            checkOutDate: stay.end.toISOString(),
            totalPrice,
            amountPaid: parseInt(formData.paidCash) + parseInt(formData.paidCard) + parseInt(formData.paidQR),
            staffId: 'current',
            hostelId: allRooms.find(r => r.id === formData.roomId)?.hostelId
        });
    };

    // ✅ БРОНИРОВАНИЕ (только с данными гостя)
    const handleBooking = () => {
        if (!formData.fullName || !formData.passport || !formData.roomId || !formData.bedId) {
            notify(t('fillAllFields'), 'error');
            return;
        }

        const { dateTime: checkInDateTime, isEarlyCheckIn } = getCheckInDateTime();
        const stay = getStayDetails(checkInDateTime, parseInt(formData.days));
        const totalPrice = parseInt(formData.days) * parseInt(formData.pricePerNight);

        console.log('✅ Booking:', { 
            isEarlyCheckIn, 
            checkInDateTime, 
            checkOutDateTime: stay.end.toISOString() 
        });

        onSubmit({
            ...formData,
            status: 'booking',
            checkInDate: stay.start.toISOString(),
            checkOutDate: stay.end.toISOString(),
            totalPrice,
            amountPaid: 0,
            paidCash: 0,
            paidCard: 0,
            paidQR: 0,
            staffId: 'current',
            hostelId: allRooms.find(r => r.id === formData.roomId)?.hostelId
        });
    };

    const totalPrice = parseInt(formData.days) * parseInt(formData.pricePerNight);
    const totalPaid = parseInt(formData.paidCash || 0) + parseInt(formData.paidCard || 0) + parseInt(formData.paidQR || 0);
    const availableBeds = getAvailableBeds();
    
    const totalSteps = initialStep === 1 ? 3 : 2;
    const displayStep = initialStep === 2 ? step - 1 : step;

    // ✅ Проверяем, будет ли ранний заезд
    const { isEarlyCheckIn } = getCheckInDateTime();

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <style>{`
                input[type="number"]::-webkit-inner-spin-button,
                input[type="number"]::-webkit-outer-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }
                input[type="number"] {
                    -moz-appearance: textfield;
                }
            `}</style>
            
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 border border-slate-200">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                <UserPlus size={24} className="text-white"/>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                    {t('checkin')}
                                </h2>
                                <p className="text-indigo-600 text-sm font-medium">Шаг {displayStep} из {totalSteps}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-xl transition-colors">
                            <X size={24} className="text-slate-600"/>
                        </button>
                    </div>

                    <div className="mt-4 flex gap-2">
                        {Array.from({length: totalSteps}, (_, i) => i + 1).map(s => (
                            <div key={s} className={`h-2 flex-1 rounded-full transition-all ${
                                s <= displayStep ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-slate-200'
                            }`}/>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 1 && (
                        <div className="space-y-4 animate-in slide-in-from-right duration-200">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <Home size={20} className="text-indigo-600"/>
                                Выбор комнаты и места
                            </h3>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Комната</label>
                                <select 
                                    value={formData.roomId}
                                    onChange={(e) => handleRoomChange(e.target.value)}
                                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all bg-white"
                                >
                                    <option value="">Выберите комнату</option>
                                    {allRooms.map(r => (
                                        <option key={r.id} value={r.id}>
                                            Комната №{r.number} - {(r.price || 0).toLocaleString()} сум/день
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {formData.roomId && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-3">Выберите место</label>
                                    <div className="grid grid-cols-4 gap-3">
                                        {availableBeds.map(bed => (
                                            <button
                                                key={bed.id}
                                                onClick={() => !bed.occupied && handleChange('bedId', bed.id)}
                                                disabled={bed.occupied}
                                                className={`p-4 rounded-xl border-2 font-bold transition-all ${
                                                    formData.bedId === bed.id
                                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-lg'
                                                        : bed.occupied
                                                        ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                                                        : 'border-slate-200 hover:border-indigo-400 hover:bg-indigo-50'
                                                }`}
                                            >
                                                <BedDouble size={20} className="mx-auto mb-1"/>
                                                <div className="text-sm">Место {bed.id}</div>
                                                <div className="text-xs mt-1">
                                                    {bed.occupied ? '❌ Занято' : '✓ Свободно'}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4 animate-in slide-in-from-right duration-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2 relative">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">ФИО</label>
                                    <input
                                        type="text"
                                        value={formData.fullName}
                                        onChange={(e) => handleChange('fullName', e.target.value)}
                                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all bg-white"
                                        placeholder="Введите ФИО"
                                    />
                                    {matchedClients.length > 0 && (
                                        <div className="absolute z-10 w-full mt-2 bg-white border-2 border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                            {matchedClients.map(client => (
                                                <button
                                                    key={client.id}
                                                    onClick={() => handleClientSelect(client)}
                                                    className="w-full text-left px-4 py-3 hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-0"
                                                >
                                                    <div className="font-bold text-slate-800">{client.fullName}</div>
                                                    <div className="text-xs text-slate-500">{client.passport} • {client.country}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Паспорт</label>
                                    <input
                                        type="text"
                                        value={formData.passport}
                                        onChange={(e) => handleChange('passport', e.target.value)}
                                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all bg-white"
                                        placeholder="AA1234567"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Страна</label>
                                    <select
                                        value={formData.country}
                                        onChange={(e) => handleChange('country', e.target.value)}
                                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all bg-white"
                                    >
                                        <option value="">Выберите страну</option>
                                        {COUNTRIES.map((country, idx) => {
                                            if (country === '---') {
                                                return <option key={idx} disabled>──────────────</option>;
                                            }
                                            return <option key={idx} value={country}>{country}</option>;
                                        })}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Дата рождения</label>
                                    <input
                                        type="date"
                                        value={formData.birthDate}
                                        onChange={(e) => handleChange('birthDate', e.target.value)}
                                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Дата заезда</label>
                                    <input
                                        type="date"
                                        value={formData.checkInDate}
                                        onChange={(e) => handleChange('checkInDate', e.target.value)}
                                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Количество дней</label>
                                    <input
                                        type="number"
                                        value={formData.days}
                                        onChange={(e) => handleChange('days', e.target.value)}
                                        min="1"
                                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all bg-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Цена за ночь</label>
                                    <input
                                        type="number"
                                        value={formData.pricePerNight}
                                        onChange={(e) => handleChange('pricePerNight', e.target.value)}
                                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring focus:ring-indigo-200 transition-all bg-white"
                                    />
                                </div>
                            </div>

                            {/* ✅ АВТОМАТИЧЕСКОЕ УВЕДОМЛЕНИЕ О РАННЕМ ЗАЕЗДЕ */}
                            {isEarlyCheckIn && (
                                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 flex items-start gap-3 animate-in slide-in-from-top">
                                    <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5"/>
                                    <div className="text-sm text-amber-800">
                                        <strong>🌅 Ранний заезд обнаружен!</strong>
                                        <br/>
                                        Сейчас <strong>{new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</strong>, 
                                        система автоматически продлевает проживание до 12:00 следующего дня.
                                        <div className="mt-2 p-2 bg-white/60 rounded-lg font-semibold">
                                            📅 Фактическое проживание: {(() => {
                                                const { dateTime } = getCheckInDateTime();
                                                const stay = getStayDetails(dateTime, formData.days);
                                                return `${new Date(stay.start).toLocaleDateString('ru-RU')} → ${new Date(stay.end).toLocaleDateString('ru-RU')} 12:00`;
                                            })()}
                                        </div>
                                        <div className="text-xs text-amber-700 mt-2">
                                            💡 Гость получает бонусное время до 12:00
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-4 border-2 border-indigo-200">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-700 font-bold">Итого к оплате:</span>
                                    <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                        {totalPrice.toLocaleString()} сум
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4 animate-in slide-in-from-right duration-200">
                            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                <Wallet size={20} className="text-indigo-600"/>
                                Оплата
                            </h3>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1">
                                        <DollarSign size={12}/>
                                        Наличные
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={formData.paidCash}
                                            onChange={(e) => handleChange('paidCash', e.target.value)}
                                            className="w-full pl-3 pr-10 py-2 border-2 border-emerald-300 rounded-lg focus:border-emerald-500 focus:ring focus:ring-emerald-200 transition-all bg-white text-sm"
                                            placeholder="0"
                                        />
                                        <button
                                            onClick={() => handleMagnetClick('paidCash')}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md transition-colors"
                                            title="Заполнить остаток"
                                        >
                                            <Magnet size={14}/>
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-blue-700 mb-1 flex items-center gap-1">
                                        <CreditCard size={12}/>
                                        Карта
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={formData.paidCard}
                                            onChange={(e) => handleChange('paidCard', e.target.value)}
                                            className="w-full pl-3 pr-10 py-2 border-2 border-blue-300 rounded-lg focus:border-blue-500 focus:ring focus:ring-blue-200 transition-all bg-white text-sm"
                                            placeholder="0"
                                        />
                                        <button
                                            onClick={() => handleMagnetClick('paidCard')}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                                            title="Заполнить остаток"
                                        >
                                            <Magnet size={14}/>
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-purple-700 mb-1 flex items-center gap-1">
                                        <QrCode size={12}/>
                                        QR код
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={formData.paidQR}
                                            onChange={(e) => handleChange('paidQR', e.target.value)}
                                            className="w-full pl-3 pr-10 py-2 border-2 border-purple-300 rounded-lg focus:border-purple-500 focus:ring focus:ring-purple-200 transition-all bg-white text-sm"
                                            placeholder="0"
                                        />
                                        <button
                                            onClick={() => handleMagnetClick('paidQR')}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-md transition-colors"
                                            title="Заполнить остаток"
                                        >
                                            <Magnet size={14}/>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border-2 border-slate-200 space-y-2">
                                <div className="flex justify-between text-sm text-slate-600">
                                    <span>Стоимость:</span>
                                    <span className="font-bold text-slate-800">{totalPrice.toLocaleString()} сум</span>
                                </div>
                                <div className="flex justify-between text-sm text-emerald-600">
                                    <span>Оплачено:</span>
                                    <span className="font-bold">{totalPaid.toLocaleString()} сум</span>
                                </div>
                                <div className="border-t-2 border-slate-300 pt-2 flex justify-between items-center">
                                    <span className="font-bold">
                                        {totalPaid >= totalPrice ? 'Переплата:' : 'Долг:'}
                                    </span>
                                    <span className={`text-xl font-bold ${
                                        totalPaid >= totalPrice ? 'text-emerald-600' : 'text-rose-600'
                                    }`}>
                                        {Math.abs(totalPrice - totalPaid).toLocaleString()} сум
                                    </span>
                                </div>
                            </div>

                            {totalPaid < totalPrice && (
                                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 flex items-start gap-2">
                                    <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5"/>
                                    <div className="text-xs text-amber-700">
                                        <span className="font-bold">Внимание!</span> Гость заселяется с долгом <span className="font-bold">{(totalPrice - totalPaid).toLocaleString()} сум</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 bg-slate-50/50 backdrop-blur-sm flex justify-between gap-3">
                    {step > initialStep && (
                        <Button variant="secondary" onClick={() => setStep(step - 1)}>
                            Назад
                        </Button>
                    )}
                    
                    {step === 2 && (
                        <Button variant="warning" onClick={handleBooking} icon={Clock}>
                            Забронировать
                        </Button>
                    )}
                    
                    <div className="flex-1"></div>
                    
                    {step < 3 ? (
                        <Button variant="primary" onClick={() => setStep(step + 1)}>
                            Далее
                        </Button>
                    ) : (
                        <Button variant="success" onClick={handleSubmit} icon={CheckCircle2}>
                            Заселить
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};	

const GuestDetailsModal = ({ guest, room, currentUser, onClose, onUpdate, onPayment, onCheckOut, onSplit, onOpenMove, onDelete, notify, onReduceDays, onActivateBooking, onReduceDaysNoRefund, hostelInfo, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    
    if (!guest) { onClose(); return null; }
    
    const totalPaid = getTotalPaid(guest);
    const debt = (guest.totalPrice || 0) - totalPaid;
    
    // --- STATE ---
    const [activeAction, setActiveAction] = useState(null);
    const [payCash, setPayCash] = useState('');
    const [payCard, setPayCard] = useState('');
    const [payQR, setPayQR] = useState('');
    const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
    
    const [extendDays, setExtendDays] = useState(1);
    const [checkoutManualRefund, setCheckoutManualRefund] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ 
        fullName: guest.fullName || '', 
        birthDate: guest.birthDate || '', 
        passport: guest.passport || '', 
        country: guest.country || 'Узбекистан', 
        pricePerNight: guest.pricePerNight || 0
    });
    const [splitAfterDays, setSplitAfterDays] = useState(1);
    const [splitGapDays, setSplitGapDays] = useState(1);
    const [reduceDays, setReduceDays] = useState(1);
    const [reduceDaysNoRefund, setReduceDaysNoRefund] = useState(1);
    const [magnetActiveField, setMagnetActiveField] = useState(null);
    
    const [newStartDate, setNewStartDate] = useState(() => {
        try {
            return guest.checkInDate ? new Date(guest.checkInDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        } catch (e) { return new Date().toISOString().split('T')[0]; }
    });
    
    const isBooking = guest.status === 'booking';
    const isCheckedOut = guest.status === 'checked_out';
    const canMoveDate = currentUser.role === 'admin' || currentUser.role === 'super' || currentUser.login === 'fazliddin';
    
    const today = new Date(); 
    const checkIn = new Date(guest.checkInDate); 
    let daysStayedCalculated = Math.max(1, Math.ceil((today - checkIn) / (1000 * 60 * 60 * 24)));
    const daysStayed = Math.min(daysStayedCalculated, parseInt(guest.days));
    const actualCost = daysStayed * parseInt(guest.pricePerNight); 
    const balance = totalPaid - actualCost;

    // --- HANDLERS ---
    const disableWheel = (e) => e.target.blur();

    const handlePayDebt = () => { 
        if(isPaymentSubmitting) return;
        const c = parseInt(payCash)||0, cd = parseInt(payCard)||0, q = parseInt(payQR)||0;
        if(c+cd+q <= 0) return notify("Введите сумму", 'error'); 
        setIsPaymentSubmitting(true);
        onPayment(guest.id, { cash:c, card:cd, qr:q });
        setTimeout(() => setIsPaymentSubmitting(false), 1000);
    };
    
    const handleExtend = () => { 
        const days = parseInt(extendDays); 
        if(!days) return; 
        const newTotal = (guest.totalPrice || 0) + (days * parseInt(guest.pricePerNight)); 
        const updates = { days: parseInt(guest.days) + days, totalPrice: newTotal, status: 'active' };
        const stay = getStayDetails(guest.checkInDate, updates.days);
        updates.checkOutDate = stay.end.toISOString();
        onUpdate(guest.id, updates); 
        setActiveAction(null);
    };

    const handleDoCheckout = () => { 
        const refund = checkoutManualRefund ? parseInt(checkoutManualRefund) : Math.max(0, balance);
        onCheckOut(guest, { totalPrice: actualCost, refundAmount: refund }); 
    };

    const handleDoSplit = () => { 
        if (parseInt(splitAfterDays) >= parseInt(guest.days)) return notify("Error days", 'error'); 
        onSplit(guest, parseInt(splitAfterDays), parseInt(splitGapDays)); onClose(); 
    };

    const handleSaveInfo = () => { 
        onUpdate(guest.id, { ...editForm, totalPrice: parseInt(editForm.pricePerNight) * parseInt(guest.days) }); 
        setIsEditing(false); 
    };

    const handleDeleteGuest = () => { if (confirm(t('confirmDelete'))) onDelete(guest); };
    const handleReduceDays = () => { onReduceDays(guest, parseInt(reduceDays)); onClose(); };
    const handleReduceDaysNoRefund = () => { onReduceDaysNoRefund(guest, parseInt(reduceDaysNoRefund)); onClose(); };
    const handlePrint = (type) => printDocument(type, guest, hostelInfo); 
    
    const handleMoveBooking = () => {
        const start = new Date(newStartDate); start.setHours(12, 0, 0, 0);
        const stay = getStayDetails(start.toISOString(), guest.days);
        onUpdate(guest.id, { checkInDate: start.toISOString(), checkOutDate: stay.end.toISOString() });
        notify("Дата изменена!"); setActiveAction(null);
    };
    
    const applyMagnet = (field) => {
        const currentTotal = (field === 'payCash' ? 0 : (parseInt(payCash)||0)) + (field === 'payCard' ? 0 : (parseInt(payCard)||0)) + (field === 'payQR' ? 0 : (parseInt(payQR)||0));
        const rem = Math.max(0, debt - currentTotal);
        if (field === 'payCash') setPayCash(String(rem));
        if (field === 'payCard') setPayCard(String(rem));
        if (field === 'payQR') setPayQR(String(rem));
        setMagnetActiveField(field);
    };

    // --- UI HELPERS ---
    const InfoRow = ({ label, value, icon: Icon }) => (
        <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
                {Icon && <Icon size={14}/>}
                <span>{label}</span>
            </div>
            <div className="font-bold text-slate-800 text-sm">{value}</div>
        </div>
    );

    const BigActionButton = ({ label, icon: Icon, onClick, active, color }) => {
        // Четкие цвета для кнопок
        const colors = {
            emerald: active ? 'bg-emerald-600 text-white ring-2 ring-offset-1 ring-emerald-600' : 'bg-white border-2 border-emerald-100 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300',
            blue: active ? 'bg-blue-600 text-white ring-2 ring-offset-1 ring-blue-600' : 'bg-white border-2 border-blue-100 text-blue-700 hover:bg-blue-50 hover:border-blue-300',
            amber: active ? 'bg-amber-500 text-white ring-2 ring-offset-1 ring-amber-500' : 'bg-white border-2 border-amber-100 text-amber-700 hover:bg-amber-50 hover:border-amber-300',
            rose: active ? 'bg-rose-600 text-white ring-2 ring-offset-1 ring-rose-600' : 'bg-white border-2 border-rose-100 text-rose-700 hover:bg-rose-50 hover:border-rose-300',
        };

        return (
            <button 
                onClick={onClick}
                className={`flex flex-col items-center justify-center p-3 rounded-lg transition-all duration-150 shadow-sm ${colors[color]}`}
            >
                <Icon size={24} className="mb-1"/>
                <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
            </button>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* --- HEADER: Строгий и четкий --- */}
                <div className="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-start">
                    <div className="flex-1 mr-4">
                        {isEditing ? (
                            <div className="space-y-3">
                                <input className="w-full border-2 border-slate-300 rounded px-2 py-1 text-lg font-bold text-slate-900 focus:border-indigo-500 outline-none" value={editForm.fullName} onChange={e => setEditForm({...editForm, fullName: e.target.value.toUpperCase()})} />
                                <div className="grid grid-cols-2 gap-2">
                                    <input className="border border-slate-300 rounded px-2 py-1" value={editForm.passport} onChange={e => setEditForm({...editForm, passport: e.target.value.toUpperCase()})} />
                                    <input type="date" className="border border-slate-300 rounded px-2 py-1" value={editForm.birthDate} onChange={e => setEditForm({...editForm, birthDate: e.target.value})} />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={handleSaveInfo} className="bg-indigo-600 text-white px-3 py-1 rounded text-sm font-bold">Сохранить</button>
                                    <button onClick={() => setIsEditing(false)} className="bg-slate-200 text-slate-700 px-3 py-1 rounded text-sm font-bold">Отмена</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h2 className="text-xl font-black text-slate-800 leading-tight mb-1">{guest.fullName}</h2>
                                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700">{guest.passport}</span>
                                    <span>•</span>
                                    <span>{guest.country}</span>
                                    {!isCheckedOut && <button onClick={() => setIsEditing(true)} className="text-indigo-600 hover:underline ml-2 text-xs">Изм.</button>}
                                </div>
                            </>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500">
                        <X size={20}/>
                    </button>
                </div>

                {/* --- BODY: Контрастные блоки --- */}
                <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-4">
                    
                    {/* 1. Блок информации (Grid) */}
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
                        <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-wider border-b border-slate-100 pb-1">Детали проживания</h3>
                        <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                            <InfoRow label="Комната" value={`№${guest.roomNumber}`} icon={Building2}/>
                            <InfoRow label="Место" value={`№${guest.bedId}`} icon={BedDouble}/>
                            <InfoRow label="Заезд" value={new Date(guest.checkInDate).toLocaleDateString()} icon={Calendar}/>
                            <InfoRow label="Выезд" value={guest.checkOutDate ? new Date(guest.checkOutDate).toLocaleDateString() : '...'} icon={LogOut}/>
                            <InfoRow label="Дней" value={guest.days} icon={Clock}/>
                            <InfoRow label="Тариф" value={`${parseInt(guest.pricePerNight).toLocaleString()}`} icon={Wallet}/>
                        </div>
                    </div>

                    {/* 2. Блок финансов (Яркий) */}
                    {!isBooking && (
                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-xs text-slate-500 mb-1">Всего к оплате</div>
                                    <div className="text-lg font-bold text-slate-900">{guest.totalPrice?.toLocaleString()}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-500 mb-1">Оплачено</div>
                                    <div className="text-lg font-bold text-emerald-600">{totalPaid.toLocaleString()}</div>
                                </div>
                            </div>
                            <div className={`px-4 py-3 flex justify-between items-center ${debt > 0 ? 'bg-rose-50 border-t border-rose-100' : 'bg-emerald-50 border-t border-emerald-100'}`}>
                                <span className={`font-bold text-sm ${debt > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                    {debt > 0 ? 'ОСТАТОК ДОЛГА:' : 'БАЛАНС:'}
                                </span>
                                <span className={`text-xl font-black ${debt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {debt > 0 ? `-${debt.toLocaleString()}` : 'ОПЛАЧЕНО'}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* 3. Действия */}
                    {isBooking ? (
                        <div className="space-y-3">
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded text-amber-800 text-sm font-medium flex items-center gap-2">
                                <Clock size={16}/> Гость в статусе "Бронь". Заселение еще не выполнено.
                            </div>
                            <button onClick={() => onActivateBooking(guest)} className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-slate-700 shadow-sm">
                                ЗАСЕЛИТЬ СЕЙЧАС
                            </button>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setActiveAction('moveDate')} className="bg-white border border-slate-300 text-slate-700 py-2 rounded font-bold hover:bg-slate-50">Перенести</button>
                                <button onClick={handleDeleteGuest} className="bg-rose-50 border border-rose-200 text-rose-600 py-2 rounded font-bold hover:bg-rose-100">Отменить</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-4 gap-3">
                                <BigActionButton label="Оплата" icon={Wallet} color="emerald" active={activeAction === 'pay'} onClick={() => setActiveAction(activeAction === 'pay' ? null : 'pay')}/>
                                <BigActionButton label="Продлить" icon={Clock} color="blue" active={activeAction === 'extend'} onClick={() => setActiveAction(activeAction === 'extend' ? null : 'extend')}/>
                                {!isCheckedOut && <BigActionButton label="Пауза" icon={Split} color="amber" active={activeAction === 'split'} onClick={() => setActiveAction(activeAction === 'split' ? null : 'split')}/>}
                                {!isCheckedOut && <BigActionButton label="Выселить" icon={LogOut} color="rose" active={activeAction === 'checkout'} onClick={() => setActiveAction(activeAction === 'checkout' ? null : 'checkout')}/>}
                            </div>

                            {/* Forms Container */}
                            {activeAction && (
                                <div className="bg-white border-2 border-indigo-100 rounded-lg p-4 shadow-sm animate-in slide-in-from-top-2 duration-150">
                                    {activeAction === 'pay' && (
                                        <div className="space-y-3">
                                            <h4 className="font-bold text-slate-800 border-b pb-2 mb-3">Внести оплату</h4>
                                            {['payCash', 'payCard', 'payQR'].map(field => (
                                                <div key={field} className="flex items-center">
                                                    <div className="w-24 text-xs font-bold text-slate-500 uppercase">
                                                        {field === 'payCash' ? 'Наличные' : field === 'payCard' ? 'Карта' : 'QR-код'}
                                                    </div>
                                                    <div className="flex-1 relative">
                                                        <input 
                                                            type="number" 
                                                            className="w-full border border-slate-300 rounded px-3 py-2 font-bold text-slate-800 focus:border-indigo-500 outline-none"
                                                            placeholder="0"
                                                            value={field === 'payCash' ? payCash : field === 'payCard' ? payCard : payQR}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                if(field === 'payCash') setPayCash(val);
                                                                else if(field === 'payCard') setPayCard(val);
                                                                else setPayQR(val);
                                                                setMagnetActiveField(null);
                                                            }}
                                                            onWheel={disableWheel}
                                                        />
                                                        <button onClick={() => applyMagnet(field)} className="absolute right-1 top-1 text-indigo-500 p-1 hover:bg-indigo-50 rounded">
                                                            <Magnet size={16}/>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <button onClick={handlePayDebt} disabled={isPaymentSubmitting} className="w-full bg-emerald-600 text-white py-3 rounded font-bold hover:bg-emerald-700 mt-2">
                                                {isPaymentSubmitting ? 'Сохранение...' : 'ПОДТВЕРДИТЬ ОПЛАТУ'}
                                            </button>
                                        </div>
                                    )}

                                    {activeAction === 'extend' && (
                                        <div className="space-y-4">
                                            <h4 className="font-bold text-slate-800 border-b pb-2">Продление проживания</h4>
                                            <div className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200">
                                                <button onClick={() => setExtendDays(Math.max(1, extendDays-1))} className="w-10 h-10 bg-white border rounded font-bold text-xl">-</button>
                                                <div className="text-center">
                                                    <input 
                                                        type="number" 
                                                        className="w-20 text-center bg-transparent font-bold text-2xl outline-none"
                                                        value={extendDays}
                                                        onChange={e => setExtendDays(e.target.value)}
                                                        onWheel={disableWheel}
                                                    />
                                                    <div className="text-xs text-slate-500">дней</div>
                                                </div>
                                                <button onClick={() => setExtendDays(parseInt(extendDays)+1)} className="w-10 h-10 bg-white border rounded font-bold text-xl">+</button>
                                            </div>
                                            <div className="text-center font-bold text-indigo-700">
                                                К оплате: +{(extendDays * parseInt(guest.pricePerNight)).toLocaleString()} сум
                                            </div>
                                            <button onClick={handleExtend} className="w-full bg-indigo-600 text-white py-3 rounded font-bold hover:bg-indigo-700">
                                                ПРОДЛИТЬ
                                            </button>
                                        </div>
                                    )}

                                    {activeAction === 'checkout' && (
                                        <div className="space-y-4">
                                            <h4 className="font-bold text-slate-800 border-b pb-2">Выселение гостя</h4>
                                            <div className="bg-slate-50 p-3 rounded border border-slate-200 text-sm space-y-2">
                                                <div className="flex justify-between"><span>Факт проживания:</span> <strong>{daysStayed} дн.</strong></div>
                                                <div className="flex justify-between"><span>Стоимость факта:</span> <strong>{actualCost.toLocaleString()}</strong></div>
                                            </div>
                                            
                                            {balance < 0 ? (
                                                <div className="bg-rose-100 text-rose-800 p-3 rounded border border-rose-200 font-bold text-center">
                                                    ВНИМАНИЕ: ДОЛГ {Math.abs(balance).toLocaleString()}
                                                </div>
                                            ) : (
                                                <div className="bg-emerald-100 text-emerald-800 p-3 rounded border border-emerald-200 font-bold text-center">
                                                    К ВОЗВРАТУ: {balance.toLocaleString()}
                                                    {balance > 0 && (
                                                        <input 
                                                            type="number" 
                                                            className="w-full mt-2 border border-emerald-300 rounded px-2 py-1 text-sm font-normal text-black"
                                                            placeholder="Ввести другую сумму"
                                                            value={checkoutManualRefund}
                                                            onChange={e => setCheckoutManualRefund(e.target.value)}
                                                            onWheel={disableWheel}
                                                        />
                                                    )}
                                                </div>
                                            )}
                                            
                                            <button onClick={handleDoCheckout} className="w-full bg-rose-600 text-white py-3 rounded font-bold hover:bg-rose-700">
                                                ПОДТВЕРДИТЬ ВЫСЕЛЕНИЕ
                                            </button>
                                        </div>
                                    )}

                                    {/* Остальные формы (split, moveDate) в том же стиле... */}
                                    {activeAction === 'split' && (
                                        <div className="space-y-3">
                                            <h4 className="font-bold">Разделение (Пауза)</h4>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div><label className="text-xs">Выезд через</label><input type="number" className="w-full border p-2 rounded" value={splitAfterDays} onChange={e=>setSplitAfterDays(e.target.value)} onWheel={disableWheel}/></div>
                                                <div><label className="text-xs">Пауза (дней)</label><input type="number" className="w-full border p-2 rounded" value={splitGapDays} onChange={e=>setSplitGapDays(e.target.value)} onWheel={disableWheel}/></div>
                                            </div>
                                            <button onClick={handleDoSplit} className="w-full bg-amber-500 text-white py-2 rounded font-bold">Разделить</button>
                                        </div>
                                    )}
                                    {activeAction === 'moveDate' && (
                                        <div className="space-y-3">
                                            <h4 className="font-bold">Перенос даты</h4>
                                            <input type="date" className="w-full border p-2 rounded" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} />
                                            <button onClick={handleMoveBooking} className="w-full bg-slate-800 text-white py-2 rounded font-bold">Сохранить</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* --- FOOTER --- */}
                {!isBooking && (
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs font-bold text-slate-500">
                        <div className="flex gap-4">
                            <button onClick={() => handlePrint('check')} className="flex items-center gap-1 hover:text-slate-800"><Printer size={14}/> Чек</button>
                            <button onClick={() => handlePrint('regcard')} className="flex items-center gap-1 hover:text-slate-800"><FileText size={14}/> Анкета</button>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={onOpenMove} className="flex items-center gap-1 hover:text-slate-800"><ArrowLeftRight size={14}/> Переместить</button>
                            {(currentUser.role === 'admin' || currentUser.role === 'super') && (
                                <button onClick={handleDeleteGuest} className="flex items-center gap-1 text-rose-400 hover:text-rose-600"><Trash2 size={14}/> Удалить</button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ✅ ВСТАВЬТЕ ЭТОТ КОД ПЕРЕД function App()

const MoveGuestModal = ({ guest, allRooms, guests, onClose, onMove, notify, lang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [targetRoomId, setTargetRoomId] = useState(guest.roomId);
    const [targetBedId, setTargetBedId] = useState('');
    
    const selectedRoom = allRooms.find(r => r.id === targetRoomId);
    
    // Получаем список коек для выбранной комнаты
    const beds = selectedRoom ? Array.from({length: selectedRoom.capacity}, (_, i) => i + 1) : [];
    const now = new Date();

    const handleMove = () => {
        if (!targetRoomId || !targetBedId) return notify("Выберите место", 'error');
        
        // Проверка на конфликты
        const conflicts = guests.filter(g => {
            // Смотрим только гостей в целевой комнате и на целевой койке
            if (String(g.roomId) !== String(targetRoomId)) return false;
            if (String(g.bedId) !== String(targetBedId)) return false;
            if (g.id === guest.id) return false; // Не считаем самого себя
            if (g.status === 'checked_out') return false; // Выселенные не мешают

            // ВАЖНО: Проверка на Тайм-аут
            // Если у "соседа" время вышло — считаем койку свободной (игнорируем конфликт)
            if (g.status === 'active') {
                const checkOut = new Date(g.checkOutDate);
                if (typeof g.checkOutDate === 'string' && !g.checkOutDate.includes('T')) {
                    checkOut.setHours(12, 0, 0, 0);
                }
                const isTimeout = now > checkOut;
                if (isTimeout) return false; // Разрешаем перемещение поверх Timeout
            }

            // Стандартная проверка пересечения дат
            return checkCollision(g.checkInDate, g.days, guest.checkInDate, guest.days);
        });
        
        if (conflicts.length > 0) return notify(`Занято! (${conflicts[0].fullName})`, 'error');
        
        onMove(guest, targetRoomId, selectedRoom.number, String(targetBedId));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-slate-300 overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <ArrowLeftRight size={20} className="text-indigo-600"/>
                        {t('move')}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20}/>
                    </button>
                </div>
                
                {/* Body */}
                <div className="p-6 space-y-5 overflow-y-auto">
                    {/* Инфо о госте */}
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex justify-between items-center">
                        <div>
                            <div className="text-xs text-indigo-500 font-bold uppercase mb-0.5">Гость</div>
                            <div className="font-bold text-indigo-900">{guest.fullName}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-indigo-500 font-bold uppercase mb-0.5">Текущее место</div>
                            <div className="font-bold text-indigo-900">Комн. {guest.roomNumber} / {guest.bedId}</div>
                        </div>
                    </div>

                    {/* Выбор комнаты */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Выберите комнату</label>
                        <select 
                            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none bg-white shadow-sm transition-all"
                            value={targetRoomId} 
                            onChange={e => { setTargetRoomId(e.target.value); setTargetBedId(''); }}
                        >
                            {allRooms.map(r => (
                                <option key={r.id} value={r.id}>Комната №{r.number} ({r.capacity} мест)</option>
                            ))}
                        </select>
                    </div>

                    {/* Сетка кроватей (Визуализация) */}
                    {selectedRoom && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">
                                Доступные места (Комната {selectedRoom.number})
                            </label>
                            
                            <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto p-1">
                                {beds.map(bedId => {
                                    // Ищем, кто живет на этой койке
                                    const occupant = guests.find(g => 
                                        String(g.roomId) === String(selectedRoom.id) && 
                                        String(g.bedId) === String(bedId) &&
                                        (g.status === 'active' || g.status === 'booking') &&
                                        g.id !== guest.id // Исключаем самого себя
                                    );

                                    let status = 'free';
                                    let statusText = 'Свободно';
                                    
                                    if (occupant) {
                                        if (occupant.status === 'booking') {
                                            status = 'booking';
                                            statusText = 'Бронь';
                                        } else {
                                            // Проверка на Timeout
                                            const checkOut = new Date(occupant.checkOutDate);
                                            if (typeof occupant.checkOutDate === 'string' && !occupant.checkOutDate.includes('T')) {
                                                checkOut.setHours(12, 0, 0, 0);
                                            }
                                            
                                            if (now > checkOut) {
                                                status = 'timeout'; // Считаем свободным для выбора
                                                statusText = 'Time Out';
                                            } else {
                                                status = 'occupied';
                                                statusText = occupant.fullName.split(' ')[0]; // Имя
                                            }
                                        }
                                    }

                                    // Стилизация карточки койки
                                    const isSelected = String(targetBedId) === String(bedId);
                                    let cardClass = "border border-slate-200 bg-white hover:border-slate-400";
                                    let textClass = "text-slate-600";
                                    let disabled = false;

                                    if (isSelected) {
                                        cardClass = "border-2 border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600";
                                        textClass = "text-indigo-700";
                                    } else if (status === 'occupied') {
                                        cardClass = "bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed";
                                        textClass = "text-slate-400";
                                        disabled = true;
                                    } else if (status === 'timeout') {
                                        cardClass = "bg-slate-50 border-slate-300 border-dashed hover:border-indigo-400 hover:bg-slate-100";
                                        textClass = "text-slate-500";
                                    } else if (status === 'booking') {
                                        // Бронь можно выбрать, но будет проверка дат при нажатии "Переместить"
                                        cardClass = "bg-amber-50 border-amber-200 hover:border-amber-400";
                                        textClass = "text-amber-700";
                                    } else {
                                        // Free
                                        cardClass = "bg-white border-emerald-200 hover:border-emerald-500 hover:shadow-md hover:-translate-y-0.5";
                                        textClass = "text-emerald-700";
                                    }

                                    return (
                                        <button
                                            key={bedId}
                                            onClick={() => !disabled && setTargetBedId(String(bedId))}
                                            disabled={disabled}
                                            className={`p-3 rounded-xl transition-all duration-200 text-left relative overflow-hidden group ${cardClass}`}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="flex items-center gap-1">
                                                    <BedDouble size={16} className={disabled ? 'text-slate-400' : isSelected ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}/>
                                                    <span className={`text-xs font-bold ${textClass}`}>№{bedId}</span>
                                                </div>
                                                <span className="text-[9px] uppercase font-bold text-slate-400 bg-white/50 px-1 rounded">
                                                    {bedId % 2 === 0 ? 'Верх' : 'Низ'}
                                                </span>
                                            </div>
                                            
                                            <div className={`text-xs font-medium truncate ${status === 'timeout' ? 'text-slate-500' : textClass}`}>
                                                {statusText}
                                            </div>

                                            {/* Индикатор выбора */}
                                            {isSelected && (
                                                <div className="absolute top-2 right-2 w-2 h-2 bg-indigo-600 rounded-full shadow-sm"></div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-slate-50 border-t border-slate-200 flex gap-3">
                    <button 
                        onClick={onClose} 
                        className="flex-1 py-3 border border-slate-300 rounded-xl text-slate-600 font-bold hover:bg-white text-sm transition-colors"
                    >
                        Отмена
                    </button>
                    <button 
                        onClick={handleMove} 
                        disabled={!targetBedId}
                        className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 text-sm shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        Переместить
                    </button>
                </div>
            </div>
        </div>
    );
};

const ExpenseModal = ({ onClose, onSubmit, lang, currentUser }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [category, setCategory] = useState('');
    const [amount, setAmount] = useState('');
    const [comment, setComment] = useState('');

    const categories = [
        'Аренда', 'Коммунальные услуги', 'Зарплата', 'Продукты', 
        'Канцелярия', 'Ремонт', 'Интернет', 'Реклама', 'Другое'
    ];

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!category || !amount) {
            alert('Заполните все обязательные поля');
            return;
        }
        onSubmit({
            category,
            amount: parseFloat(amount),
            comment,
            date: new Date().toISOString(),
            staffId: currentUser.id || currentUser.login,
            hostelId: currentUser.hostelId
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden">
                {/* ✅ Header */}
                <div className="p-6 border-b border-slate-200 bg-gradient-to-br from-slate-100 via-rose-100/50 to-pink-100/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-rose-200 to-pink-200 rounded-xl flex items-center justify-center">
                                <Wallet size={24} className="text-rose-600"/>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800">Добавить расход</h2>
                                <p className="text-sm text-slate-600">Заполните данные о расходе</p>
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

                {/* ✅ Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-gradient-to-br from-slate-50 to-rose-50/20">
                    {/* Категория */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Категория *
                        </label>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:border-rose-400 focus:ring-4 focus:ring-rose-100 outline-none transition-all text-slate-700 font-medium"
                            required
                        >
                            <option value="">Выберите категорию</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    {/* Сумма */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Сумма (сум) *
                        </label>
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0"
                            className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:border-rose-400 focus:ring-4 focus:ring-rose-100 outline-none transition-all text-slate-700 font-medium"
                            required
                        />
                    </div>

                    {/* Комментарий */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Комментарий
                        </label>
                        <textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Дополнительная информация..."
                            rows={3}
                            className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl focus:border-rose-400 focus:ring-4 focus:ring-rose-100 outline-none transition-all text-slate-700 font-medium resize-none"
                        />
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 bg-white border-2 border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 transition-colors"
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-xl font-semibold shadow-lg shadow-rose-200 hover:shadow-xl transition-all"
                        >
                            Добавить
                        </button>
                    </div>
                </form>
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

const ShiftClosingModal = ({ user, payments = [], expenses, onClose, onLogout, notify, onEndShift, lang }) => {
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
        const msg = `<b>🔔 Закрытие смены</b>\nКассир: ${user.name}\n---\n💵 Наличные: ${income.cash.toLocaleString()}\n💳 Терминал: ${income.card.toLocaleString()}\n📱 QR: ${income.qr.toLocaleString()}\n---\n<b>💰 ИТОГО: ${totalRevenue.toLocaleString()}</b>\n📉 Расходы: ${totalExpenses.toLocaleString()}\n<b>🏦 В КАССЕ: ${cashInHand.toLocaleString()}</b>`;
        sendTelegramMessage(msg);
        onEndShift();
    };
    
    const copyReport = async () => {
        const lines = [ 
            `👤 Кассир: ${user.name}`,
            `📅 Дата: ${new Date().toLocaleString('ru-RU')}`,
            `───────────────────────────`,
            `💰 ПРИХОД`,
            `───────────────────────────`,
            `💵 Наличные:    ${income.cash.toLocaleString()} сум`,
            `💳 Терминал:    ${income.card.toLocaleString()} сум`,
            `📱 QR-код:      ${income.qr.toLocaleString()} сум`,
            `✅ ИТОГО ПРИХОД: ${totalRevenue.toLocaleString()} сум`,
            `───────────────────────────`,
            `📉 РАСХОДЫ:     ${totalExpenses.toLocaleString()} сум`,
            `═══════════════════════════`,
            `🏦 В КАССЕ:     ${cashInHand.toLocaleString()} сум`,
            `═══════════════════════════`
        ];
        const text = lines.join('\n');
        
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                notify("✓ Скопировано!", 'success');
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
                    notify("✓ Скопировано!", 'success');
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
                {/* ✅ Градиентный Header */}
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

                {/* ✅ Content */}
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

                {/* ✅ Footer Buttons */}
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
// ✅ ГЛАВНЫЙ КОМПОНЕНТ APP
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
  const [hasUpdate, setHasUpdate] = useState(false);  

  const showNotification = (message, type = 'success') => { 
    setNotification({ message, type }); 
  };
  
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
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [clientHistoryModal, setClientHistoryModal] = useState({ open: false, client: null });

  const pendingTasksCount = useMemo(() => {
    return tasks.filter(t => t.status !== 'done').length;
  }, [tasks]);

  const activeShiftInMyHostel = useMemo(() => {
      if (!currentUser || currentUser.role === 'admin' || currentUser.role === 'super') return null;
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
            if (clientHistoryModal.open) setClientHistoryModal({open: false, client: null});
        }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [checkInModal, guestDetailsModal, moveGuestModal, expenseModal, shiftModal, addRoomModal, editRoomModal, clientHistoryModal]);

  useEffect(() => {
    const checkUpdates = () => {
      const lastCheck = localStorage.getItem('app_version_check');
      const now = Date.now();
      
      if (!lastCheck || now - parseInt(lastCheck) > 5 * 60 * 1000) {
        setHasUpdate(Math.random() > 0.9);
        localStorage.setItem('app_version_check', String(now));
      }
    };
    
    checkUpdates();
    const interval = setInterval(checkUpdates, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error(err));
    const unsubAuth = onAuthStateChanged(auth, (user) => { 
      setFirebaseUser(user); 
      setIsLoadingAuth(false); 
    });
    
    const savedUser = localStorage.getItem('hostella_user_v4');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => { 
      unsubAuth(); 
      window.removeEventListener('online', handleOnline); 
      window.removeEventListener('offline', handleOffline); 
    };
  }, []);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'cashier') return;
    if (shifts.length === 0) return;
    
    const myActiveShift = shifts.find(s => s.staffId === currentUser.id && !s.endTime);
    
    if (!myActiveShift) {
      const otherActiveShift = shifts.find(s => 
        s.hostelId === currentUser.hostelId && 
        !s.endTime && 
        s.staffId !== currentUser.id
      );
      
      if (!otherActiveShift) {
        console.log('🚀 Auto-starting shift for', currentUser.name);
        handleStartShift();
      }
    }
  }, [currentUser, shifts]);

  const handleLogin = (user) => { 
    setCurrentUser(user); 
    localStorage.setItem('hostella_user_v4', JSON.stringify(user)); 
    if (user.role === 'cashier') setActiveTab('calendar'); 
    else setActiveTab('dashboard'); 
  };

  const handleLogout = () => { 
    setCurrentUser(null); 
    localStorage.removeItem('hostella_user_v4'); 
  };
  
  const handleEndShift = async () => {
      if (currentUser && currentUser.id) { 
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', currentUser.id), { 
          lastShiftEnd: new Date().toISOString() 
        }); 
      }
      const myOpenShift = shifts.find(s => s.staffId === currentUser.id && !s.endTime);
      if (myOpenShift) {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'shifts', myOpenShift.id), { 
            endTime: new Date().toISOString() 
          });
      }
      handleLogout();
  };

  const handleTransferToMe = async (shiftId) => {
      if (!currentUser) return;
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, ...PUBLIC_DATA_PATH, 'shifts', shiftId), { 
          endTime: new Date().toISOString() 
        });
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

  const handleChangePassword = async (userId, newPassword) => {
      try {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', userId), { 
              pass: newPassword 
          });
          
          const updatedUser = {...currentUser, pass: newPassword};
          setCurrentUser(updatedUser);
          localStorage.setItem('hostella_user_v4', JSON.stringify(updatedUser));
          
          showNotification("Пароль успешно изменен!", 'success');
      } catch (e) {
          showNotification("Ошибка изменения пароля: " + e.message, 'error');
      }
  };

  const handleOpenClientHistory = (client) => {
    setClientHistoryModal({ open: true, client });
  };

  useEffect(() => {
    if (!firebaseUser) return;
    
    const usersCol = collection(db, ...PUBLIC_DATA_PATH, 'users');
    const unsubUsers = onSnapshot(usersCol, (snap) => { 
      const users = snap.docs.map(d => ({id: d.id, ...d.data()})); 
      setUsersList(users.length ? users : DEFAULT_USERS); 
    });

    if (!currentUser) return unsubUsers; 

    const roomsCol = collection(db, ...PUBLIC_DATA_PATH, 'rooms');
    const guestsCol = collection(db, ...PUBLIC_DATA_PATH, 'guests');
    const expensesCol = collection(db, ...PUBLIC_DATA_PATH, 'expenses');
    const clientsCol = collection(db, ...PUBLIC_DATA_PATH, 'clients');
    const paymentsCol = collection(db, ...PUBLIC_DATA_PATH, 'payments');
    const tasksCol = collection(db, ...PUBLIC_DATA_PATH, 'tasks');
    const shiftsCol = collection(db, ...PUBLIC_DATA_PATH, 'shifts');

    const u1 = onSnapshot(roomsCol, { includeMetadataChanges: true }, (snap) => { 
      setPermissionError(false); 
      setRooms(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => parseInt(a.number) - parseInt(b.number))); 
      setIsOnline(!snap.metadata.fromCache); 
    }, (err) => { 
      if (err.code === 'permission-denied') setPermissionError(true); 
      setIsOnline(false); 
    });
    
    const u2 = onSnapshot(guestsCol, (snap) => setGuests(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => new Date(b.checkInDate) - new Date(a.checkInDate))));
    const u3 = onSnapshot(expensesCol, (snap) => setExpenses(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => new Date(b.date) - new Date(a.date))));
    const u4 = onSnapshot(clientsCol, (snap) => setClients(snap.docs.map(d => ({id: d.id, ...d.data()})).sort((a,b) => a.fullName.localeCompare(b.fullName))));
    const u5 = onSnapshot(paymentsCol, (snap) => setPayments(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    const u6 = onSnapshot(tasksCol, (snap) => setTasks(snap.docs.map(d => ({id: d.id, ...d.data()}))));
    const u7 = onSnapshot(shiftsCol, (snap) => setShifts(snap.docs.map(d => ({id: d.id, ...d.data()}))));

    return () => { unsubUsers(); u1(); u2(); u3(); u4(); u5(); u6(); u7(); };
  }, [firebaseUser, currentUser]);

  const seedUsers = async () => { 
    if (usersList.length === DEFAULT_USERS.length && usersList[0].id === undefined) { 
      try { 
        for(const u of DEFAULT_USERS) { 
          await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'users'), u); 
        } 
        alert("Init done"); 
      } catch(e) {
        console.error(e);
      } 
    } 
  };

  const handleAddUser = async (d) => { 
    await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'users'), d); 
  };

    const handleDeleteUser = async (id) => { 
    if(confirm("Del?")) await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', id)); 
  };

  // ✅ ИСПРАВЛЕННЫЙ БЛОК - ВСЕ ПРОВЕРКИ НА null
  const filterByHostel = (items) => {
    if (!currentUser) return []; // ✅ ПРОВЕРКА
    if (currentUser.role === 'super') return items;
    
    if (currentUser.login === 'fazliddin' && currentUser.canViewHostel1) {
        return items.filter(i => i.hostelId === selectedHostelFilter);
    }
    
    const target = currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId;
    return items.filter(i => i.hostelId === target);
  };
  
  const filteredUsersForReports = useMemo(() => {
     if (!currentUser) return []; // ✅ ПРОВЕРКА
     const targetHostel = currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId;
     if (currentUser.role === 'super') return usersList; 
     return usersList.filter(u => u.hostelId === targetHostel || u.role === 'super' || u.hostelId === 'all');
  }, [usersList, currentUser, selectedHostelFilter]);

  const filteredPayments = useMemo(() => {
    if (!currentUser) return []; // ✅ ПРОВЕРКА
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

  const availableHostelsForUser = useMemo(() => {
    if (!currentUser) return []; // ✅ ПРОВЕРКА
    if (currentUser.role === 'admin' || currentUser.role === 'super') {
      return Object.keys(HOSTELS);
    }
    if (currentUser.login === 'fazliddin' && currentUser.canViewHostel1) {
      return ['hostel1', 'hostel2'];
    }
    return [];
  }, [currentUser]);

  const canPerformActions = useMemo(() => {
    if (!currentUser) return false; // ✅ ПРОВЕРКА
    if (currentUser.role === 'admin' || currentUser.role === 'super') return true;
    if (currentUser.login === 'fazliddin') {
      return selectedHostelFilter === 'hostel2';
    }
    return true;
  }, [currentUser, selectedHostelFilter]);

  const handleUpdateClient = async (id, d) => { 
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', id), d); 
    showNotification("Updated"); 
  };

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
                batch.update(doc(db, ...PUBLIC_DATA_PATH, 'clients', existing.id), { 
                  fullName: existing.fullName || nc.fullName, 
                  passport: existing.passport || nc.passport, 
                  birthDate: existing.birthDate || nc.birthDate, 
                  country: existing.country || nc.country 
                });
                updated++;
            } else {
                batch.set(doc(collection(db, ...PUBLIC_DATA_PATH, 'clients')), { 
                  ...nc, 
                  visits: 0, 
                  lastVisit: new Date().toISOString() 
                });
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
    if(!confirm("Start auto deduplication?")) return;
    try {
        const map = {}; 
        const duplicates = [];
        
        clients.forEach(c => { 
          const key = c.passport ? `P:${c.passport}` : `N:${c.fullName}`; 
          if (!map[key]) map[key] = c; 
          else duplicates.push({ original: map[key], duplicate: c }); 
        });
        
        if (duplicates.length === 0) return showNotification("No duplicates found!");
        
        const batch = writeBatch(db);
        duplicates.forEach(({ original, duplicate }) => {
            batch.update(doc(db, ...PUBLIC_DATA_PATH, 'clients', original.id), { 
              visits: (original.visits||0) + (duplicate.visits||0), 
              lastVisit: new Date(original.lastVisit) > new Date(duplicate.lastVisit) ? original.lastVisit : duplicate.lastVisit 
            });
            batch.delete(doc(db, ...PUBLIC_DATA_PATH, 'clients', duplicate.id));
        });
        
        await batch.commit(); 
        showNotification(`Merged ${duplicates.length} duplicates!`, 'success');
    } catch(e) { 
      console.error(e); 
      showNotification("Deduplication failed", 'error'); 
    }
  };

  const handleBulkDeleteClients = async (ids) => {
      try { 
        const batch = writeBatch(db); 
        ids.forEach(id => batch.delete(doc(db, ...PUBLIC_DATA_PATH, 'clients', id))); 
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
            batch.update(doc(db, ...PUBLIC_DATA_PATH, 'clients', c.id), { country: normalized }); 
            count++; 
          } 
        }); 
        
        if (count > 0) { 
          await batch.commit(); 
          showNotification(`Normalized ${count} countries`, 'success'); 
        } else {
          showNotification("All normalized");
        }
      } catch(e) { 
        showNotification("Normalization failed", 'error'); 
      }
  };

  const handleCreateRoom = async (d) => { 
    setAddRoomModal(false); 
    await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'rooms'), {
      ...d, 
      hostelId: currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId, 
      occupied: 0
    }); 
  };

  const handleCloneRoom = async (r) => { };
  const handleEditRoom = async (d) => { };
  const handleDeleteRoom = async (r) => { };

  const logTransaction = async (guestId, amounts, staffId) => {
      const { cash, card, qr } = amounts;
      const date = new Date().toISOString();
      const batch = [];
      
      if(cash > 0) batch.push({ 
        guestId, 
        staffId, 
        amount: cash, 
        method: 'cash', 
        date, 
        hostelId: currentUser.hostelId 
      });
      if(card > 0) batch.push({ 
        guestId, 
        staffId, 
        amount: card, 
        method: 'card', 
        date, 
        hostelId: currentUser.hostelId 
      });
      if(qr > 0) batch.push({ 
        guestId, 
        staffId, 
        amount: qr, 
        method: 'qr', 
        date, 
        hostelId: currentUser.hostelId 
      });
      
      for(const item of batch) { 
        await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'payments'), item); 
      }
  };

  const handleCheckIn = async (data) => {
      setCheckInModal({open:false, room:null, bedId:null, date:null}); 
      try {
          const safeStaffId = currentUser.id || currentUser.login || 'unknown';
          const docRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'guests'), {
            ...data, 
            staffId: safeStaffId
          });
          
          const total = (data.paidCash||0) + (data.paidCard||0) + (data.paidQR||0);
          if (total > 0) await logTransaction(docRef.id, {
            cash:data.paidCash, 
            card:data.paidCard, 
            qr:data.paidQR
          }, safeStaffId);
          
          if (data.status === 'active') { 
            const r = rooms.find(i=>i.id===data.roomId); 
            if(r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), {
              occupied:(r.occupied||0)+1
            }); 
          }
          
          showNotification(data.status==='booking' ? "Booking created" : "Checked In!");
      } catch(e) { 
        showNotification(e.message, 'error'); 
      }
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
            status: 'active', 
            hostelId: currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId 
          };
          
          await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'guests'), debtData); 
          showNotification("Debt created successfully");
      } catch (e) { 
        showNotification("Error creating debt", 'error'); 
      }
  };

  const handleActivateBooking = async (guest) => {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guest.id), {
        status: 'active'
      });
      
      const r = rooms.find(i=>i.id===guest.roomId); 
      if(r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), {
        occupied:(r.occupied||0)+1
      });
      
      setGuestDetailsModal({open:false, guest:null}); 
      showNotification("Activated");
  };

  const handleGuestUpdate = async (id, d) => { 
    if(guestDetailsModal.open) setGuestDetailsModal({open:false, guest:null}); 
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', id), d); 
  };

  const handlePayment = async (guestId, amounts) => {
      try {
          const safeStaffId = currentUser.id || currentUser.login;
          const { cash, card, qr } = amounts;
          
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), { 
            paidCash: increment(cash), 
            paidCard: increment(card), 
            paidQR: increment(qr), 
            amountPaid: increment(cash+card+qr) 
          });
          
          await logTransaction(guestId, amounts, safeStaffId);
          setGuestDetailsModal({open:false, guest:null}); 
          showNotification("Payment success");
      } catch(e) { 
        showNotification(e.message, 'error'); 
      }
  };

 const handleCheckOut = async (guest, final) => {
    setGuestDetailsModal({open:false, guest:null});
    
    const actualRefund = final.refundAmount || 0;
    
    // ✅ ИСПРАВЛЕНИЕ: Правильная логика для checkOutDate
    const today = new Date();
    const originalCheckOut = new Date(guest.checkOutDate);
    originalCheckOut.setHours(12, 0, 0, 0);
    today.setHours(12, 0, 0, 0);
    
    // Если сегодня РАНЬШЕ оригинального checkOut - выселяем досрочно (уменьшаем полоску)
    // Если сегодня ПОЗЖЕ или РАВНО - оставляем оригинальную дату (не растягиваем)
    const finalCheckOutDate = today < originalCheckOut 
        ? today.toISOString() 
        : guest.checkOutDate; // ✅ ОСТАВЛЯЕМ ОРИГИНАЛЬНУЮ ДАТУ
    
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guest.id), {
        totalPrice: final.totalPrice,
        status: 'checked_out', 
        checkOutDate: finalCheckOutDate // ✅ ИСПОЛЬЗУЕМ ПРАВИЛЬНУЮ ДАТУ
    });
    
    const r = rooms.find(i=>i.id===guest.roomId); 
    if(r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), {
        occupied:Math.max(0, (r.occupied||1)-1)
    });
    
    if (actualRefund > 0) {
        await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
            amount: actualRefund,
            category: 'Возврат',
            comment: `Возврат: ${guest.fullName} (${guest.passport})`,
            date: new Date().toISOString(),
            staffId: currentUser.id || currentUser.login,
            hostelId: currentUser.hostelId || guest.hostelId
        });
        
        sendTelegramMessage(`⚠️ <b>Возврат гостю</b>\n👤 ${guest.fullName}\n💰 Сумма: ${actualRefund.toLocaleString()}\n👨‍💼 Кассир: ${currentUser.name}`);
    }
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
          const ratio1 = firstLegDays / totalOriginalDays; 
          const ratio2 = remainingDays / totalOriginalDays;
          const firstLegTotal = firstLegDays * price;
          const stay1 = getStayDetails(orig.checkInDate, firstLegDays);
          
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', orig.id), { 
            days: firstLegDays, 
            totalPrice: firstLegTotal, 
            amountPaid: Math.floor(totalPaid * ratio1), 
            paidCash: Math.floor((orig.paidCash||0) * ratio1), 
            paidCard: Math.floor((orig.paidCard||0) * ratio1), 
            paidQR: Math.floor((orig.paidQR||0) * ratio1), 
            checkOutDate: stay1.end.toISOString() 
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
            paidCash: Math.floor((orig.paidCash||0) * ratio2), 
            paidCard: Math.floor((orig.paidCard||0) * ratio2), 
            paidQR: Math.floor((orig.paidQR||0) * ratio2), 
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
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { 
          roomId: rid, 
          roomNumber: rnum, 
          bedId: bid 
        }); 
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
        if(r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), {
          occupied:Math.max(0,(r.occupied||1)-1)
        }); 
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

  const handleAddExpense = async (d) => { 
    setExpenseModal(false); 
    await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
      ...d, 
      hostelId: currentUser.role==='admin'?selectedHostelFilter:currentUser.hostelId, 
      staffId:currentUser.id||currentUser.login, 
      date:new Date().toISOString()
    }); 
  };

  const handleAddTask = async (task) => { 
    await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'tasks'), task); 
    showNotification("Task Added"); 
  };

  const handleCompleteTask = async (id) => { 
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'tasks', id), { status: 'done' }); 
  };

  const handleUpdateTask = async (id, updates) => { 
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'tasks', id), updates); 
    showNotification("Task Updated"); 
  };

  const handleDeleteTask = async (id) => { 
    await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'tasks', id)); 
    showNotification("Task Deleted"); 
  };
  
  const handleStartShift = async () => {
    if (!currentUser || !currentUser.id) return;
    
    const activeShift = shifts.find(s => s.staffId === currentUser.id && !s.endTime);
    if (activeShift) {
        console.log('Shift already active');
        return;
    }
    
    try {
        await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'), { 
            staffId: currentUser.id, 
            hostelId: currentUser.hostelId, 
            startTime: new Date().toISOString(), 
            endTime: null 
        });
        showNotification("✓ Смена начата автоматически", 'success');
    } catch (e) {
        console.error('Error starting shift:', e);
    }
  };

  const handleTransferShift = async (currentShiftId, targetUserId) => {
      if(!targetUserId) return;
      const batch = writeBatch(db);
      const shiftRef = doc(db, ...PUBLIC_DATA_PATH, 'shifts', currentShiftId);
      batch.update(shiftRef, { endTime: new Date().toISOString() });
      const targetUser = usersList.find(u => u.id === targetUserId);
      const newShiftRef = doc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'));
      batch.set(newShiftRef, { 
        staffId: targetUserId, 
        hostelId: targetUser ? targetUser.hostelId : currentUser.hostelId, 
        startTime: new Date().toISOString(), 
        endTime: null 
      });
      await batch.commit(); 
      showNotification("Shift Transferred");
  };

  const handleAdminAddShift = async (shiftData) => {
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'), shiftData);
      showNotification("Смена добавлена вручную");
  };

  const handleAdminUpdateShift = async (id, data) => {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'shifts', id), data);
      showNotification("Смена обновлена");
  };

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
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { 
        checkOutDate: stay.end.toISOString() 
      });
      
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
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { 
        checkOutDate: stay.end.toISOString() 
      });
      
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

const handleRepeatStay = (lastStay) => {
    const client = clients.find(c => c.passport === lastStay.passport);
    if (!client) return;
    
    const room = rooms.find(r => r.id === lastStay.roomId);
    if (!room) return;
    
    setCheckInModal({ 
        open: true, 
        room: room, 
        bedId: lastStay.bedId, 
        date: null 
    });
    
    setClientHistoryModal({ open: false, client: null });
};

const downloadExpensesCSV = () => {
    const t = (k) => TRANSLATIONS[lang][k];
    
    const exportData = filteredExpenses.map(e => {
        const staff = usersList.find(u => u.id === e.staffId || u.login === e.staffId)?.name || 'N/A';
        const hostelName = HOSTELS[e.hostelId]?.name || e.hostelId || '-';
        
        return {
            date: new Date(e.date).toLocaleString(),
            hostel: hostelName,
            category: e.category,
            amount: parseInt(e.amount),
            staff: staff,
            comment: e.comment || '-'
        };
    });
    
    const totalExpenses = exportData.reduce((sum, item) => sum + item.amount, 0);
    
    let table = `
        <html>
        <head>
            <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
            <style>
                body { font-family: Arial, sans-serif; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #000000; padding: 8px; text-align: left; }
                th { background-color: #dc2626; color: #ffffff; font-weight: bold; }
                .amount { text-align: right; color: #991b1b; font-weight: bold; }
                .total-row { background-color: #fee2e2; font-weight: bold; border-top: 3px solid #991b1b; }
                .total-label { text-align: right; font-size: 14px; }
            </style>
        </head>
        <body>
            <h2 style="text-align:center;">Отчет по расходам</h2>
            <p style="text-align:center;">Период: ${new Date().toLocaleDateString()}</p>
            <table>
                <thead>
                    <tr>
                        <th>Дата</th>
                        <th>Хостел</th>
                        <th>Категория</th>
                        <th>Сумма</th>
                        <th>Кассир</th>
                        <th>Комментарий</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    exportData.forEach(row => {
        table += `
            <tr>
                <td>${row.date}</td>
                <td>${row.hostel}</td>
                <td>${row.category}</td>
                <td class="amount">${row.amount.toLocaleString()}</td>
                <td>${row.staff}</td>
                <td>${row.comment}</td>
            </tr>
        `;
    });
    
    table += `
        <tr class="total-row">
            <td colspan="3" class="total-label">ИТОГО РАСХОДОВ:</td>
            <td class="amount">${totalExpenses.toLocaleString()}</td>
            <td colspan="2"></td>
        </tr>
    `;
    
    table += `</tbody></table></body></html>`;
    
    const blob = new Blob([table], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Expenses_Report_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

if (isLoadingAuth) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={40}/>
    </div>
);

if (!currentUser) return (
    <LoginScreen 
        users={usersList} 
        onLogin={handleLogin} 
        onSeed={seedUsers} 
        lang={lang} 
        setLang={setLang} 
    />
);

if (activeShiftInMyHostel) {
    return (
        <ShiftBlockScreen 
            activeShift={activeShiftInMyHostel} 
            activeUser={activeUserForBlock} 
            currentUser={currentUser} 
            onLogout={handleLogout} 
            onTransferToMe={handleTransferToMe} 
        />
    );
}

const activeUserDoc = usersList.find(u => u.id === currentUser?.id) || currentUser;
const currentHostelInfo = HOSTELS[currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId] || HOSTELS['hostel1'];
const t = (k) => TRANSLATIONS[lang][k];

return (
    <div className="h-screen w-screen bg-slate-50 text-slate-800 font-sans flex flex-col md:flex-row overflow-hidden">
        
        <div className="flex-shrink-0">
            <Navigation 
                currentUser={currentUser} 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                onLogout={handleLogout} 
                lang={lang} 
                setLang={setLang} 
                pendingTasksCount={pendingTasksCount} 
                onOpenChangePassword={() => setIsChangePasswordModalOpen(true)} 
            />
        </div>

        <MobileNavigation 
            currentUser={currentUser} 
            activeTab={activeTab} 
            setActiveTab={setActiveTab} 
            pendingTasksCount={pendingTasksCount} 
            lang={lang} 
        />
        
        {notification && (
            <Notification 
                message={notification.message} 
                type={notification.type} 
                onClose={() => setNotification(null)} 
            />
        )}
        
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
            
            {/* ✅ НОВЫЙ TopBar */}
            {!(currentUser.role === 'cashier' && activeTab === 'calendar') && (
                <TopBar 
                    selectedHostelFilter={selectedHostelFilter}
                    hostels={HOSTELS}
                    availableHostels={availableHostelsForUser}
                    setSelectedHostelFilter={setSelectedHostelFilter}
                    currentUser={currentUser}
                    activeTab={activeTab}
                    isOnline={isOnline}
                    hasUpdate={hasUpdate}
                    usersList={usersList}
                    shifts={shifts}
                    canPerformActions={canPerformActions}
                    onOpenExpense={() => setExpenseModal(true)}
                    onOpenCheckIn={() => setCheckInModal({ open: true, room: null, bedId: null, date: null })}
                    onOpenShift={() => setShiftModal(true)}
                    lang={lang}
                />
            )}

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 pt-2 pb-20">
                {activeTab === 'dashboard' && currentUser.role === 'admin' && (
                    <div className="space-y-8 animate-in fade-in">
                        <DashboardStats 
                            rooms={filteredRooms} 
                            guests={guests} 
                            payments={payments} 
                            lang={lang} 
                            currentHostelId={selectedHostelFilter} 
                        />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <ChartsSection 
                                guests={filteredGuests} 
                                rooms={filteredRooms} 
                                payments={filteredPayments} 
                                lang={lang} 
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'rooms' && (
                    <div>
                        {(currentUser.role === 'admin' || currentUser.role === 'super') && (
                            <div className="flex justify-end mb-4">
                                <Button icon={PlusCircle} onClick={() => setAddRoomModal(true)}>
                                    Добавить комнату
                                </Button>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 -mt-2">
                            {filteredRooms.map(room => (
                                <RoomCardGlass 
                                    key={room.id} 
                                    room={room} 
                                    guests={filteredGuests.filter(g => g.roomId === room.id)} 
                                    isAdmin={currentUser.role === 'admin' || currentUser.role === 'super'} 
                                    onEdit={() => setEditRoomModal({ open: true, room })} 
                                    onClone={() => handleCloneRoom(room)} 
                                    onDelete={() => handleDeleteRoom(room)} 
                                    lang={lang} 
                                    onBedClick={(bedId, guest, isGhost) => { 
                                        if (guest) {
                                            setGuestDetailsModal({ open: true, guest });
                                        } else { 
                                            if(!canPerformActions) {
                                                showNotification("Режим просмотра", 'error');
                                            } else if(currentUser.role === 'admin' || currentUser.role === 'super') {
                                                alert("Admin cannot check-in");
                                            } else {
                                                setCheckInModal({ open: true, room, bedId, date: null });
                                            }
                                        } 
                                    }} 
                                />
                            ))}
                        </div>
                    </div>
                )}
                
                {activeTab === 'calendar' && (
                    <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
                        <CalendarView 
                            rooms={filteredRooms} 
                            guests={filteredGuests} 
                            onSlotClick={(room, bedId, guest, dateISO) => { 
                                if (guest) setGuestDetailsModal({ open: true, guest }); 
                                else { 
                                    if(!canPerformActions) {
                                        showNotification("Режим просмотра", 'error');
                                    } else if(currentUser.role === 'admin' || currentUser.role === 'super') {
                                        alert("Admin cannot check-in");
                                    } else {
                                        setCheckInModal({ open: true, room, bedId, date: dateISO });
                                    }
                                } 
                            }} 
                            lang={lang} 
                            currentUser={currentUser} 
                            onDeleteGuest={handleDeleteGuest} 
                        />
                    </div>
                )}
                
                {activeTab === 'reports' && (currentUser.role === 'admin' || currentUser.role === 'super') && (
                    <ReportsView 
                        payments={filteredPayments} 
                        expenses={filteredExpenses} 
                        users={filteredUsersForReports} 
                        guests={filteredGuests} 
                        currentUser={currentUser} 
                        onDeletePayment={handleDeletePayment} 
                        lang={lang} 
                    />
                )}
                
                {activeTab === 'debts' && (
    <DebtsView 
        guests={filteredGuests} 
        users={usersList} 
        lang={lang} 
        onPayDebt={handlePayDebt} 
        currentUser={currentUser} 
        onAdminAdjustDebt={handleAdminAdjustDebt} 
        clients={clients} 
        onCreateDebt={handleCreateDebt}
        
        // 👇 ДОБАВЛЕНО: Функция открытия карточки гостя
        onOpenGuest={(guest) => setSelectedGuest(guest)} 
    />
)}
                
                {activeTab === 'tasks' && (
                    <TaskManager 
                        tasks={filteredTasks} 
                        users={usersList} 
                        currentUser={currentUser} 
                        onAddTask={handleAddTask} 
                        onCompleteTask={handleCompleteTask} 
                        onUpdateTask={handleUpdateTask} 
                        onDeleteTask={handleDeleteTask} 
                        lang={lang} 
                        selectedHostelFilter={selectedHostelFilter} 
                    />
                )}

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

                {activeTab === 'clients' && (
                    <ClientsView 
                        clients={clients} 
                        onUpdateClient={handleUpdateClient} 
                        onImportClients={handleImportClients} 
                        onDeduplicate={handleDeduplicate} 
                        onBulkDelete={handleBulkDeleteClients} 
                        onNormalizeCountries={handleNormalizeCountries} 
                        lang={lang} 
                        currentUser={currentUser} 
                        onOpenClientHistory={handleOpenClientHistory}
                    />
                )}
                
                {activeTab === 'staff' && currentUser.role === 'admin' && (
                    <StaffView 
                        users={usersList} 
                        onAdd={handleAddUser} 
                        onDelete={handleDeleteUser} 
                        lang={lang} 
                    />
                )}
                
                {activeTab === 'expenses' && (currentUser.role === 'admin' || currentUser.role === 'super') && (
                    <div className="animate-in slide-in-from-bottom-2 space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold">{t('expenses')}</h3>
                            <div className="flex gap-2">
                                <Button icon={Download} variant="secondary" onClick={downloadExpensesCSV}>
                                    Export
                                </Button>
                                <Button icon={Plus} onClick={() => setExpenseModal(true)}>
                                    {t('expense')}
                                </Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {filteredExpenses.length > 0 ? filteredExpenses.map(e => (
                                <div key={e.id} className="bg-white p-4 rounded-xl border border-slate-300 shadow-sm flex flex-col justify-between">
                                    <div>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="px-2 py-1 bg-slate-100 rounded text-xs font-bold text-slate-600">
                                                {e.category}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                {new Date(e.date).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="font-medium text-slate-800">{e.comment}</p>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                                        <span className="font-bold text-rose-600">
                                            -{parseInt(e.amount).toLocaleString()}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            {usersList.find(u => u.id === e.staffId)?.name || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-slate-400 col-span-3 text-center py-10">
                                    No Expenses
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </main>

        {/* Модальные окна */}
        {checkInModal.open && canPerformActions && (
            <CheckInModal 
                initialRoom={checkInModal.room} 
                preSelectedBedId={checkInModal.bedId} 
                initialDate={checkInModal.date} 
                allRooms={filteredRooms} 
                guests={filteredGuests} 
                clients={clients} 
                onClose={() => setCheckInModal({open: false, room: null, bedId: null, date: null})} 
                onSubmit={handleCheckIn} 
                notify={showNotification} 
                lang={lang} 
            />
        )}
        
        {guestDetailsModal.open && (
            <GuestDetailsModal 
                guest={guestDetailsModal.guest} 
                room={filteredRooms.find(r => r.id === guestDetailsModal.guest.roomId)} 
                currentUser={currentUser} 
                onClose={() => setGuestDetailsModal({open: false, guest: null})} 
                onUpdate={handleGuestUpdate} 
                onPayment={handlePayment} 
                onCheckOut={handleCheckOut} 
                onSplit={handleSplitGuest} 
                onOpenMove={() => setMoveGuestModal({ open: true, guest: guestDetailsModal.guest })} 
                onDelete={handleDeleteGuest} 
                notify={showNotification} 
                onReduceDays={handleAdminReduceDays} 
                onActivateBooking={handleActivateBooking} 
                onReduceDaysNoRefund={handleAdminReduceDaysNoRefund} 
                hostelInfo={currentHostelInfo} 
                lang={lang} 
            />
        )}
        
        {moveGuestModal.open && (
            <MoveGuestModal 
                guest={moveGuestModal.guest} 
                allRooms={filteredRooms} 
                guests={filteredGuests} 
                onClose={() => setMoveGuestModal({open: false, guest: null})} 
                onMove={handleMoveGuest} 
                notify={showNotification} 
                lang={lang} 
            />
        )}
        
        {expenseModal && canPerformActions && (
            <ExpenseModal 
                onClose={() => setExpenseModal(false)} 
                onSubmit={handleAddExpense} 
                lang={lang} 
            />
        )}
        
        {addRoomModal && (
            <RoomFormModal 
                title="Add Room" 
                onClose={() => setAddRoomModal(false)} 
                onSubmit={handleCreateRoom} 
                lang={lang} 
            />
        )}
        
        {editRoomModal.open && (
            <RoomFormModal 
                title="Edit Room" 
                initialData={editRoomModal.room} 
                onClose={() => setEditRoomModal({open: false, room: null})} 
                onSubmit={handleEditRoom} 
                lang={lang} 
            />
        )}
        
        {shiftModal && (
            <ShiftClosingModal 
                user={activeUserDoc} 
                payments={payments} 
                expenses={filteredExpenses} 
                onClose={() => setShiftModal(false)} 
                onEndShift={handleEndShift} 
                onLogout={handleLogout} 
                notify={showNotification} 
                lang={lang} 
            />
        )}
        
        {isChangePasswordModalOpen && (
            <ChangePasswordModal 
                currentUser={currentUser}
                users={usersList}
                onClose={() => setIsChangePasswordModalOpen(false)}
                onChangePassword={handleChangePassword}
                lang={lang}
            />
        )}
        
        {clientHistoryModal.open && (
            <ClientHistoryModal 
                client={clientHistoryModal.client}
                guests={guests}
                users={usersList}
                rooms={rooms}
                onClose={() => setClientHistoryModal({open: false, client: null})}
                onRepeatStay={handleRepeatStay}
                lang={lang}
            />
        )}
    </div>
);
}

export default App;