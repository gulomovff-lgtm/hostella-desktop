/**
 * Глобальный конфиг приложения, редактируемый из «Настроек» без правки кода.
 * Хранится в Firestore (settings/appConfig), кешируется в localStorage для
 * мгновенного синхронного доступа (getConfig) из любого места.
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';

export const DEFAULT_APP_CONFIG = {
    appName: 'Hostella',
    brandColor: '#0f9688',
    currency: 'сум',
    companyAddress: '',
    companyPhone: '',
    defaultLang: 'ru',      // язык по умолчанию (ru | uz)
    defaultTheme: 'green',  // тема по умолчанию (green | dark)
    // Безопасность
    autoLogoutMin: 0,       // авто-выход при бездействии, минут (0 = выкл)
    // Уведомления об ошибках
    errorAlertsEnabled: true,
    errorAlertChatId: '7029598539',
    // Кому уходят запросы на понижение цены (Telegram chat_id, можно несколько)
    priceApprovalChatIds: ['6953132612'],
    // Отдельный бот одобрения цены: свой токен (пусто = общий TELEGRAM_BOT_TOKEN функции)
    priceBotToken: '',
    // Ценообразование: минимумы по комнатам/филиалам, пакеты, сезоны (по датам).
    // Пусто/отсутствует → работают старые дефолты (70000 / пакет 65000 / 10 дней).
    pricing: {
        packageMinDays: 10,
        packagePrice: 65000,               // общий фикс пакета (fallback)
        base: {
            hostel1: { default: 70000, rooms: { '1': 65000, '2': 65000, '3': 70000, '4': 60000, '5': 70000, '6': 70000, '7': 80000 } },
            hostel2: { default: 65000, rooms: {} },
        },
        package: {                         // цена пакета по комнатам (0/пусто = packagePrice)
            hostel1: { default: 0, rooms: {} },
            hostel2: { default: 0, rooms: {} },
        },
        // Сезоны по датам (MM-DD). Активный сезон переопределяет base/package/packageMinDays.
        // [{ id, name, from:'06-01', to:'08-31', base:{hostel1:{default,rooms},hostel2:{…}}, package:{…}, packageMinDays }]
        seasons: [],
    },
    // Интеграция с сайтом hostella.uz: обратная связь по броням (подтверждение/отмена)
    siteCallbackUrl: 'https://hostella.uz/crm-callback.php',
    siteCallbackKey: 'hst-cb-a81f37c2d94e',   // должен совпадать с CRM_CALLBACK_KEY на сайте
    // Финансы
    defaultUsdRate: '',          // курс USD по умолчанию в модалке расхода
    registrationDailyRate: '',   // ставка регистрации (кадастр) по умолчанию
    // Смены
    shiftDayHour: 9,             // час начала «суток» смены
    minFullShiftHours: 6,        // мин. часов, чтобы смена считалась полными сутками

    // #3 Авто-бэкап (серверный бэкап выполняется ежедневно; здесь — параметры/инфо)
    autoBackupEnabled: true,
    autoBackupFreq: 'daily',     // daily | weekly | monthly
    autoBackupTime: '04:00',     // время (Asia/Tashkent), информационно

    // #6 Налоги / комиссии
    taxEnabled: false,
    taxName: 'Налог',
    taxRate: 0,                  // %
    taxInclusive: false,         // true = включён в цену, false = добавляется сверху

    // #7 Способы оплаты (вкл/выкл + подписи)
    paymentMethods: {
        cash:     { enabled: true,  label: 'Наличные' },
        card:     { enabled: true,  label: 'Карта' },
        qr:       { enabled: true,  label: 'QR' },
        transfer: { enabled: false, label: 'Перевод' },
    },

    // #9 Политика паролей
    passwordMinLength: 4,
    passwordRequireMix: false,   // буквы + цифры обязательны
    passwordChangeDays: 0,       // обязательная смена раз в N дней (0 = выкл)

    // #11 Шаблоны категорий расходов (общий список-«семя» для всех хостелов)
    expenseCategories: [],       // [{ name, icon }]

    // #13 Брендинг чеков
    receiptFooter: 'Спасибо за визит!',
    receiptSignature: '',        // строка подписи (напр. «С уважением, администрация»)
    receiptShowQr: false,        // печатать QR-код на чеке

    // #15 Журнал действий (аудит)
    auditEnabled: true,
    auditRetentionDays: 90,      // хранить записи N дней (информационно для очистки)
    auditActions: {              // что записывать
        logins:    true,
        payments:  true,
        expenses:  true,
        edits:     true,
        deletions: true,
    },
};

const LS_KEY = 'hostella_app_config_v1';
let _config = { ...DEFAULT_APP_CONFIG };

// Синхронно поднимаем кеш из localStorage (до загрузки из Firestore)
try {
    const cached = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (cached && typeof cached === 'object') _config = { ...DEFAULT_APP_CONFIG, ...cached };
} catch { /* ignore */ }

export const getConfig = () => _config;
export const getConfigValue = (key) => _config[key];

/** Загрузить конфиг из Firestore (вызывается один раз при старте). */
export const loadAppConfig = async () => {
    try {
        const snap = await getDoc(doc(db, ...PUBLIC_DATA_PATH, 'settings', 'appConfig'));
        if (snap.exists()) {
            _config = { ...DEFAULT_APP_CONFIG, ...snap.data() };
            try { localStorage.setItem(LS_KEY, JSON.stringify(_config)); } catch { /* ignore */ }
        }
    } catch { /* остаёмся на кеше/дефолтах */ }
    return _config;
};

/** Сохранить изменения конфига (merge) и обновить кеш. */
export const saveAppConfig = async (patch) => {
    _config = { ...DEFAULT_APP_CONFIG, ..._config, ...patch };
    try { localStorage.setItem(LS_KEY, JSON.stringify(_config)); } catch { /* ignore */ }
    await setDoc(doc(db, ...PUBLIC_DATA_PATH, 'settings', 'appConfig'), _config, { merge: true });
    return _config;
};
