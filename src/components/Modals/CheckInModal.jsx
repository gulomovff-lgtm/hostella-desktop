import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BedDouble, User, FileText, Phone, CreditCard, QrCode, Magnet, X, CheckCircle2, Wallet,
         Minus, Plus, ChevronDown, RefreshCw, ScanLine, Camera, AlertTriangle,
         Cake, Globe, MapPin, Tag, CalendarDays, Moon, Banknote, Landmark } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { useExchangeRate } from '../../hooks/useExchangeRate';
import { COUNTRIES, COUNTRY_FLAGS } from '../../constants/countries';
import { Flag, fmtSum, parseSum } from '../../utils/helpers';
import { minNightPrice, packageNightPrice, packageMinDays, configuredNightPrice } from '../../utils/pricing';
import DatePicker from '../UI/DatePicker';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../../firebase';

// --- Helpers ---
/**
 * Auto-select price based on bed position and room bunk type.
 * Lower beds (1..ceil(cap/2)) -> prices.lower, upper -> prices.upper.
 */
const getRoomPrice = (room, bedId) => {
    if (!room) return 0;
    // Приоритет — цена из настроек 💵 Цены (единая по комнате). Нет конфига → старая логика.
    const cfg = configuredNightPrice(room.hostelId, room.number);
    if (cfg != null) return cfg;
    const lower = parseInt(room.prices?.lower) || parseInt(room.price) || 0;
    const upper = parseInt(room.prices?.upper);
    if (!upper || upper === lower) return lower;
    const cap    = parseInt(room.capacity) || 1;
    const bedNum = parseInt(bedId);
    if (!bedNum) return lower;
    return bedNum > Math.ceil(cap / 2) ? upper : lower;
};

const EXTRA_BED_ID = 'extra';

/**
 * Склонения. «31 лет» и «6 заезд» читаются как ошибка системы, а не как
 * округление, и подрывают доверие к соседним числам — тем, что про деньги.
 * Формы приходят из словаря: в узбекском склонения нет, и там все три
 * значения совпадают.
 */
const plural = (n, one, few, many) => {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b > 1 && b < 5) return few;
    return many;
};

const isExtraBed = (bedId) => String(bedId || '').toLowerCase() === EXTRA_BED_ID;

// ── Тарифы заселения ── (значения вычисляются по комнате/филиалу/дате внутри
//    компонента через utils/pricing; ниже — только легаси-фолбэки для справки)

// --- MRZ Parser (Machine Readable Zone) ---
const parseMRZ = (raw) => {
    const lines = raw.replace(/\r/g, '\n').split('\n').map(l => l.trim()).filter(l => l.length >= 20);
    if (!lines.length) return null;
    const line1 = lines.find(l => /^P</i.test(l)) || lines[0] || '';
    const line2 = lines.find(l => l !== line1 && /^[A-Z0-9]{9}/.test(l)) || lines[1] || '';
    // ФИО из первой строки MRZ
    let fullName = '';
    if (line1.length >= 10) {
        const section = line1.slice(5, 44).replace(/</g, ' ').trim().replace(/\s{2,}/, '  ');
        const parts = section.split(/  +/);
        const surname  = (parts[0] || '').replace(/ /g, '');
        const first    = (parts.slice(1).join(' ') || '').trim();
        fullName = [surname, first].filter(Boolean).join(' ');
    }
    // Данные из второй строки
    const passport   = line2 ? line2.slice(0, 9).replace(/</g, '').trim() : '';
    const natCode    = line2 ? line2.slice(10, 13) : '';
    const bdRaw      = line2 ? line2.slice(13, 19) : '';
    let birthDate = '';
    if (bdRaw.length === 6 && /^\d+$/.test(bdRaw)) {
        const yy = parseInt(bdRaw.slice(0, 2));
        const year = yy > 30 ? 1900 + yy : 2000 + yy;
        birthDate = `${year}-${bdRaw.slice(2, 4)}-${bdRaw.slice(4, 6)}`;
    }
    const NAT = { UZB:'Узбекистан', RUS:'Россия', KAZ:'Казахстан', KGZ:'Кыргызстан', TJK:'Таджикистан', TKM:'Туркмения', UKR:'Украина', BLR:'Белоруссия', GBR:'Великобритания', USA:'США', DEU:'Германия', FRA:'Франция', CHN:'Китай', IND:'Индия', TUR:'Турция', ARE:'ОАЭ', IRN:'Иран', AFG:'Афганистан', AZE:'Азербайджан', ARM:'Армения', GEO:'Грузия', MNG:'Монголия', PAK:'Пакистан', KOR:'Корея (Южная)' };
    const country = NAT[natCode] || '';
    return { fullName, passport, birthDate, country };
};

// --- Photo Compressor ---
const compressPhoto = (file) => new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
        const max = 640;
        const ratio = Math.min(max / img.width, max / img.height, 1);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * ratio);
        c.height = Math.round(img.height * ratio);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.6));
    };
    img.src = URL.createObjectURL(file);
});

// --- Styles ---
const MODAL_STYLE = `
    @keyframes ci-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes ci-card-in { from { opacity: 0; transform: scale(0.97) translateY(14px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    .ci-backdrop { animation: ci-backdrop-in 0.2s ease forwards; }
    .ci-card { animation: ci-card-in 0.28s cubic-bezier(0.34,1.3,0.64,1) forwards; will-change: transform, opacity; }
`;

// --- Sub-components ---
const SimpleInput = ({ label, value, onChange, type = "text", placeholder, icon: Icon, rightElement, error, formatNumber }) => (
    <div className="space-y-1">
        {label && <label className={`text-xs font-bold uppercase ml-1 ${error ? 'text-rose-500' : 'text-slate-600'}`}>{label}{error && ' *'}</label>}
        <div className="relative group">
            {Icon && <div className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${error ? 'text-rose-400' : 'text-slate-400 group-focus-within:text-blue-600'}`}><Icon size={18}/></div>}
            <input
                type={formatNumber ? 'text' : type}
                inputMode={formatNumber ? 'numeric' : undefined}
                value={formatNumber ? fmtSum(value) : value}
                onChange={(e) => onChange(formatNumber ? parseSum(e.target.value) : e.target.value)}
                placeholder={placeholder}
                className={`w-full bg-white border rounded-xl py-2.5 ${Icon ? 'pl-10' : 'pl-3'} ${rightElement ? 'pr-10' : 'pr-3'} font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${error ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50 focus:ring-rose-300 focus:border-rose-500' : 'border-slate-200 focus:ring-teal-500/20 focus:border-teal-600'}`}
            />
            {rightElement && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>}
        </div>
        {error && <p className="text-xs text-rose-500 font-medium ml-1 mt-0.5">{error}</p>}
    </div>
);

// Дата через единый кастомный календарь приложения (как в бронированиях/отчётах)
const DateField = ({ label, value, onChange, error, placeholder, lang = 'ru' }) => (
    <div className="space-y-1">
        {label && <label className={`text-xs font-bold uppercase ml-1 ${error ? 'text-rose-500' : 'text-slate-600'}`}>{label}{error && ' *'}</label>}
        <DatePicker
            value={value}
            onChange={onChange}
            lang={lang}
            placeholder={placeholder || 'дд.мм.гггг'}
            className={`w-full bg-white border rounded-xl py-2.5 px-3 font-medium text-slate-800 shadow-sm transition-all ${error ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50' : 'border-slate-200'}`}
        />
        {error && <p className="text-xs text-rose-500 font-medium ml-1 mt-0.5">{error}</p>}
    </div>
);

const SimpleSelect = ({ label, value, onChange, options }) => (
    <div className="space-y-1">
        {label && <label className="text-xs font-bold text-slate-600 uppercase ml-1">{label}</label>}
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg py-2.5 pl-3 pr-8 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm appearance-none cursor-pointer"
            >
                {options.map((opt, i) => (
                    <option key={i} value={opt.value}>{opt.label}</option>
                ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                <ChevronDown size={16}/>
            </div>
        </div>
    </div>
);

// --- Keyboard layout transliteration (Cyrillic → Latin by QWERTY position) ---
const CYR_TO_LAT = {
    'й':'q','ц':'w','у':'e','к':'r','е':'t','н':'y','г':'u','ш':'i','щ':'o','з':'p',
    'ф':'a','ы':'s','в':'d','а':'f','п':'g','р':'h','о':'j','л':'k','д':'l',
    'я':'z','ч':'x','с':'c','м':'v','и':'b','т':'n','ь':'m',
};
const cyrToLat = (str) => str.toUpperCase().split('').map(ch => {
    const lo = ch.toLowerCase();
    return CYR_TO_LAT[lo] ? CYR_TO_LAT[lo].toUpperCase() : ch;
}).join('');

// --- Main Component ---
const CheckInModal = ({ initialRoom, preSelectedBedId, initialDate, initialClient, isFromBooking = false, allRooms = [], guests = [], clients = [], clientsDb = [], onClose, onSubmit, onCheckinPriceRequest, priceWhitelist = [], notify, lang, currentUser, checkInHour = 14, checkOutHour = 12 }) => {
    const t = (k) => TRANSLATIONS[lang][k];

    const safeInitialRoom = initialRoom || (allRooms.length > 0 ? allRooms[0] : null);
    /**
     * Раскрыт ли выбор места.
     *
     * Открыт, только если места ещё нет: окно позвали кнопкой «Заселить»,
     * а не нажатием на койку в сетке комнат. Во втором случае место уже
     * известно, и держать под него треть окна незачем.
     */
    const [bedPickerOpen, setBedPickerOpen] = useState(!preSelectedBedId);
    /** Время открытия окна — для подписи в подвале. */
    const [openedAt] = useState(() => new Date());

    const [formData, setFormData] = useState({
        roomId: safeInitialRoom?.id || '',
        roomNumber: safeInitialRoom?.number || '',
        bedId: preSelectedBedId ? String(preSelectedBedId) : '',
        pricePerNight: getRoomPrice(safeInitialRoom, preSelectedBedId ? String(preSelectedBedId) : ''),

        fullName: initialClient?.fullName || '',
        passport: initialClient?.passport || '',
        passportIssueDate: initialClient?.passportIssueDate || '',
        country: initialClient?.country || 'Узбекистан',
        kppDate: initialClient?.kppDate || '',
        birthDate: initialClient?.birthDate || '',
        phone: initialClient?.phone || '',

        checkInDate: initialDate ? initialDate.split('T')[0] : new Date().toISOString().split('T')[0],
        days: 1,
        tariff: 'standard', // 'standard' | 'package' (пакет 65000, от 10 дней, невозвратный)

        paidCash: '',
        paidCard: '',
        paidQR: '',
        paidTransfer: '',
        paidBalance: 0,
        passportPhoto: '',
        status: 'active'
    });

    // ── Динамические тарифы: минимум и пакет по комнате/филиалу/дате заезда ──
    const _curRoom = allRooms.find(r => r.id === formData.roomId) || safeInitialRoom;
    const _roomHostel = _curRoom?.hostelId || currentUser?.hostelId || 'hostel1';
    const _priceDate = formData.checkInDate ? new Date(formData.checkInDate) : new Date();
    const MIN_NIGHT_PRICE  = minNightPrice(_roomHostel, formData.roomNumber, _priceDate);
    const PACKAGE_PRICE    = packageNightPrice(_roomHostel, formData.roomNumber, _priceDate);
    const PACKAGE_MIN_DAYS = packageMinDays(_priceDate);

    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [errors, setErrors] = useState({});
    // Запрос на понижение цены при заселении (одобрение в Telegram)
    const [priceReqId, setPriceReqId] = useState(null);
    const [priceReqStatus, setPriceReqStatus] = useState('idle'); // idle | pending | approved | rejected
    const [priceReqApproved, setPriceReqApproved] = useState(0);
    const [priceReqSending, setPriceReqSending] = useState(false);
    const [blacklistWarning, setBlacklistWarning] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitConflict, setSubmitConflict] = useState(null); // { maxDays, guestName, guestDate, alternatives }
    const [currencyMode, setCurrencyMode] = useState('UZS'); // 'UZS' | 'USD'
    const [usdInputs, setUsdInputs] = useState({ paidCash: '', paidCard: '', paidQR: '' });
    const [manualRate, setManualRate] = useState('');
    const [clientBalance, setClientBalance] = useState(0);
    /**
     * Карточка клиента целиком — ради истории визитов.
     *
     * Раньше из неё брался только баланс, а `visits` и `lastVisit`
     * пропадали: касса не показывала, что перед ней постоянный гость,
     * хотя база это знает.
     */
    const [clientCard, setClientCard] = useState(null);

    // Подтягиваем баланс клиента при каждом изменении паспорта (включая initialClient, скан, ручной ввод)
    useEffect(() => {
        const passport = formData.passport?.replace(/\s/g, '').toUpperCase();
        if (!passport || passport.length < 5) {
            setClientBalance(0);
            setClientCard(null);
            setFormData(p => ({ ...p, paidBalance: 0 }));
            return;
        }
        const found = clientsDb.find(c => c.passport && c.passport.replace(/\s/g, '').toUpperCase() === passport);
        const bal = found?.balance || 0;
        setClientBalance(bal);
        setClientCard(found || null);
        // Применялся при переходе со второго шага на третий. Шагов нет —
        // применяем там же, где баланс и узнаётся: касса всё равно зачитывала
        // его целиком, просто на два нажатия позже.
        setFormData(p => ({ ...p, paidBalance: bal > 0 ? bal : 0,
            ...(bal > 0 ? { paidCash: '', paidCard: '', paidQR: '' } : {}) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.passport]);

    const [scanMode, setScanMode] = useState(false); // false | 'usb' | 'ocr'
    const [ocrLoading, setOcrLoading] = useState(false);
    const scanInputRef = useRef(null);
    const scanTimerRef = useRef(null);
    const photoInputRef = useRef(null);

    const processAndCloseScan = (val) => {
        if (val.trim().length > 15) {
            const result = parseMRZ(val);
            if (result) {
                setFormData(p => ({
                    ...p,
                    fullName:  result.fullName  ? result.fullName.toUpperCase()  : p.fullName,
                    passport:  result.passport  ? result.passport.toUpperCase()  : p.passport,
                    birthDate: result.birthDate || p.birthDate,
                    country:   result.country   || p.country,
                }));
                notify(t('passportScanned'), 'success');
            }
        }
        setScanMode(false);
    };

    const handleScanInput = (e) => {
        clearTimeout(scanTimerRef.current);
        const val = e.target.value;
        scanTimerRef.current = setTimeout(() => processAndCloseScan(val), 400);
    };

    const handlePhotoChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Сначала сохраняем фото
        const b64 = await compressPhoto(file);
        setFormData(p => ({ ...p, passportPhoto: b64 }));
        e.target.value = '';
        // Пробуем OCR (Tesseract.js)
        setOcrLoading(true);
        let worker = null;
        try {
            const { createWorker } = await import('tesseract.js');
            worker = await createWorker('eng', 1, {
                logger: () => {},
                errorHandler: () => {},
            });
            await worker.setParameters({
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
                tessedit_pageseg_mode: '6',
            });
            const { data: { text } } = await worker.recognize(file);
            const result = parseMRZ(text);
            if (result && (result.fullName || result.passport)) {
                setFormData(p => ({
                    ...p,
                    passportPhoto: b64,
                    fullName:  result.fullName  ? result.fullName.toUpperCase()  : p.fullName,
                    passport:  result.passport  ? result.passport.toUpperCase()  : p.passport,
                    birthDate: result.birthDate || p.birthDate,
                    country:   result.country   || p.country,
                }));
                notify(t('dataFromPhoto'), 'success');
            } else {
                notify(t('photoSaved'), 'success');
            }
        } catch (err) {
            console.warn('OCR error:', err);
            notify(t('photoSaved'), 'success');
        } finally {
            if (worker) await worker.terminate().catch(() => {});
            setOcrLoading(false);
        }
    };

    const { rates } = useExchangeRate();
    const usdRate = rates?.USD?.rate || 0;
    const effectiveRate = (parseInt(manualRate) > 0 ? parseInt(manualRate) : usdRate);

    const totalPrice = (parseInt(formData.days) || 0) * (parseInt(formData.pricePerNight) || 0);
    const appliedBalance = formData.paidBalance || 0;
    const totalPaid = (parseInt(formData.paidCash) || 0) + (parseInt(formData.paidCard) || 0) + (parseInt(formData.paidQR) || 0) + (parseInt(formData.paidTransfer) || 0) + (parseInt(formData.paidBalance) || 0);
    const effectiveTotal = Math.max(0, totalPrice - appliedBalance);
    /**
     * Деньги, РЕАЛЬНО принятые в кассу, — без зачтённого баланса.
     *
     * Здесь была ошибка, и стоила она денег. Остаток считался как
     * `effectiveTotal - totalPaid`, но баланс клиента вычитался в ОБОИХ
     * слагаемых: из цены (`effectiveTotal`) и внутри `totalPaid`, куда
     * `paidBalance` входит. При цене 300 000 и балансе 100 000 окно
     * показывало остаток 100 000 вместо 200 000 — кассир брал с гостя
     * на сумму баланса меньше, чем нужно, и недостача всплывала
     * на закрытии смены.
     *
     * Заметно это было только у клиентов с балансом, то есть
     * у постоянных. Кнопка «вся сумма» при этом считала верно
     * (`effectiveTotal - others`, без баланса) — то есть магнит
     * и надпись рядом показывали разное.
     *
     * `totalPaid` остаётся прежним: в документ гостя пишется всё
     * оплаченное, включая зачтённый баланс.
     */
    const collected = totalPaid - appliedBalance;
    const balance = effectiveTotal - collected;

    // Конвертация для USD-режима
    const fromDisplay = (val) => {
        if (currencyMode === 'USD' && effectiveRate > 0) return String(Math.round((parseFloat(val) || 0) * effectiveRate));
        return val;
    };
    const handleUsdChange = (field, rawVal) => {
        setUsdInputs(prev => ({ ...prev, [field]: rawVal }));
        handleChange(field, fromDisplay(rawVal));
    };
    const handleModeSwitch = (mode) => {
        setCurrencyMode(mode);
        if (mode === 'USD' && effectiveRate > 0) {
            setUsdInputs({
                paidCash: (parseInt(formData.paidCash) || 0) > 0 ? ((parseInt(formData.paidCash) || 0) / effectiveRate).toFixed(2) : '',
                paidCard: (parseInt(formData.paidCard) || 0) > 0 ? ((parseInt(formData.paidCard) || 0) / effectiveRate).toFixed(2) : '',
                paidQR:   (parseInt(formData.paidQR)   || 0) > 0 ? ((parseInt(formData.paidQR)   || 0) / effectiveRate).toFixed(2) : '',
            });
        } else {
            setUsdInputs({ paidCash: '', paidCard: '', paidQR: '' });
        }
    };
    /** Способы оплаты. Порядок — по частоте в кассе, наличные первыми. */
    const PAY_METHODS = [
        { key: 'paidCash',     label: t('cash'),           Icon: Wallet,     usd: 'paidCash' },
        { key: 'paidCard',     label: t('card'),           Icon: CreditCard, usd: 'paidCard' },
        { key: 'paidQR',       label: t('qrTransfer'),     Icon: QrCode,     usd: 'paidQR'   },
        // Перечисление принимают только в сумах — валюты ввода у него нет.
        { key: 'paidTransfer', label: t('transferMethod'), Icon: Landmark,   usd: null       },
    ];

    /** Сколько раз гость уже жил — из карточки клиента. */
    const visitCount = parseInt(clientCard?.visits, 10) || 0;

    /**
     * Ярус и вместимость выбранного места. Ярус называется, только если
     * в комнате две цены: в одноместной «нижний ярус» — выдумка.
     */
    const bedDetail = useMemo(() => {
        const room = allRooms.find(r => r.id === formData.roomId);
        if (!room) return '';
        const cap = parseInt(room.capacity) || 0;
        const parts = [];
        if (formData.bedId && !isExtraBed(formData.bedId) && cap > 1) {
            const upper = parseInt(room.prices?.upper);
            const lower = parseInt(room.prices?.lower) || parseInt(room.price) || 0;
            const n = parseInt(formData.bedId) || 0;
            if (n && upper && upper !== lower) {
                parts.push(n > Math.ceil(cap / 2) ? t('upperTier') : t('lowerTier'));
            }
        }
        if (cap > 0) parts.push(t('capacityBeds').replace('{n}', cap));
        return parts.join(' · ').toLowerCase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allRooms, formData.roomId, formData.bedId, lang]);

    /** Возраст гостя — паспорт с чужой датой видно сразу. */
    const guestAge = useMemo(() => {
        if (!formData.birthDate) return null;
        const d = new Date(formData.birthDate);
        if (Number.isNaN(d.getTime())) return null;
        const now = new Date();
        let a = now.getFullYear() - d.getFullYear();
        const m = now.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a -= 1;
        return a >= 0 && a < 130 ? a : null;
    }, [formData.birthDate]);

    /**
     * Сколько полей гостя заполнено. Число в заголовке графы отвечает
     * на вопрос «всё ли я внёс», не заставляя перечитывать строки.
     */
    const guestFilled = useMemo(() => {
        const vals = [formData.fullName, formData.passport, formData.birthDate,
            formData.country, formData.phone];
        if (formData.country && formData.country !== 'Узбекистан') {
            vals.push(formData.passportIssueDate, formData.kppDate);
        }
        return { done: vals.filter(v => String(v ?? '').trim() !== '').length, total: vals.length };
    }, [formData]);

    /** Дата выезда — считается, а не вводится: два поля про одни сутки разойдутся. */
    const checkOutPreview = useMemo(() => {
        const d = new Date(formData.checkInDate);
        if (Number.isNaN(d.getTime())) return '';
        d.setDate(d.getDate() + (parseInt(formData.days) || 1));
        return d.toLocaleDateString('ru-RU');
    }, [formData.checkInDate, formData.days]);

    /**
     * Все проверки полей разом.
     *
     * Раньше они висели на кнопке «Далее» между вторым и третьим шагом.
     * Шагов больше нет, а проверять по-прежнему надо. Собраны в одно место
     * и показывают ВСЕ ошибки сразу: на одном экране это и естественно,
     * и быстрее — кассир видит одним взглядом, что дозаполнить.
     */
    const validate = () => {
        const errs = {};
        if (!formData.fullName.trim()) errs.fullName = t('fieldRequired');
        if (!formData.passport.trim()) errs.passport = t('fieldRequired');
        if (!formData.birthDate) errs.birthDate = t('fieldRequired');
        if (formData.country && formData.country !== 'Узбекистан') {
            if (!formData.passportIssueDate) errs.passportIssueDate = t('fieldRequired');
            if (!formData.kppDate) errs.kppDate = t('fieldRequired');
        }
        if (formData.tariff === 'package') {
            if ((parseInt(formData.days) || 0) < PACKAGE_MIN_DAYS) errs.days = t('minDaysError').replace('{days}', PACKAGE_MIN_DAYS);
        } else if ((parseInt(formData.pricePerNight) || 0) < MIN_NIGHT_PRICE && !priceApproved) {
            errs.pricePerNight = t('minSumOrApproval').replace('{min}', MIN_NIGHT_PRICE.toLocaleString());
        }
        return errs;
    };


    const rentalConflict = useMemo(() => {
        if (!formData.roomId || !formData.checkInDate) return null;
        const room = allRooms.find(r => r.id === formData.roomId);
        if (!room?.rental?.active || !room.rental.checkInDate || !room.rental.checkOutDate) return null;
        const ci = new Date(formData.checkInDate + 'T00:00:00');
        const co = new Date(ci); co.setDate(co.getDate() + (parseInt(formData.days) || 1));
        const rs = new Date(room.rental.checkInDate);
        const re = new Date(room.rental.checkOutDate);
        if (ci < re && co > rs) {
            return {
                tenantName: room.rental.tenantName || '',
                from: rs.toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' }),
                to:   re.toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            };
        }
        return null;
    }, [allRooms, formData.roomId, formData.checkInDate, formData.days]);

    const availableBeds = useMemo(() => {
        if (!formData.roomId) return [];
        const room = allRooms.find(r => r.id === formData.roomId);
        if (!room) return [];
        const now = new Date();
        const checkIn = formData.checkInDate ? new Date(formData.checkInDate + 'T00:00:00') : now;
        // Гость со статусом active, заехавший сегодня (даже если расчётный час 14:00 ещё
        // не настал при раннем заезде), уже занимает кровать.
        const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
        const debtOf = (g) => Math.max(0, (parseInt(g.totalPrice) || 0) -
            (typeof g.amountPaid === 'number' ? g.amountPaid : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0))));
        const arrived = guests.filter(g =>
            g.roomId === formData.roomId && g.status === 'active' && new Date(g.checkInDate) <= endOfToday);
        // Текущие жильцы (срок не вышел) — койка занята
        const occupants = {};
        arrived
            .filter(g => { const out = new Date(g.checkOutDate); return !g.checkOutDate || now < out; })
            .forEach(g => { occupants[String(g.bedId)] = g; });
        // «Просроченные»: срок вышел, но гость НЕ выселен (возможно ещё в койке / не оплатил).
        // Койка формально свободна, но кассир должен это ВИДЕТЬ перед подтверждением брони.
        const expired = {};
        arrived
            .filter(g => g.checkOutDate && now >= new Date(g.checkOutDate) && !occupants[String(g.bedId)])
            .forEach(g => { expired[String(g.bedId)] = g; });
        const shortName = (g) => (g?.fullName || '').split(' ')[0] || '';
        return Array.from({ length: room.capacity || 0 }, (_, i) => {
            const id = String(i + 1);
            const nextConflict = guests
                .filter(g =>
                    g.roomId === formData.roomId &&
                    String(g.bedId) === id &&
                    (g.status === 'booking' || g.status === 'active') &&
                    new Date(g.checkInDate) > checkIn
                )
                .sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate))[0];
            const maxFreeDays = nextConflict
                ? Math.max(0, Math.floor((new Date(nextConflict.checkInDate) - checkIn) / (1000 * 60 * 60 * 24)))
                : null;
            const occ = occupants[id] || null;
            const exp = expired[id] || null;
            return {
                id,
                isOccupied: !!occ,
                occupantName: shortName(occ),
                occupantDebt: occ ? debtOf(occ) : 0,
                // Просроченный «жилец»: койка выбирается, но с предупреждением
                expiredName: shortName(exp),
                expiredDebt: exp ? debtOf(exp) : 0,
                expiredSince: exp?.checkOutDate || null,
                maxFreeDays,
                nextGuestName: nextConflict?.fullName || null,
                nextGuestDate: nextConflict?.checkInDate || null,
            };
        });
    }, [formData.roomId, formData.checkInDate, guests, allRooms]);

    /** Выбранное место — из уже посчитанного списка коек. Объявлено здесь,
        а не выше: `availableBeds` считается ниже по файлу, и обращение
        к нему раньше — обращение к переменной до её инициализации. */
    const selectedBed = availableBeds.find(b => b.id === formData.bedId) || null;

    const bedConflict = useMemo(() => {
        if (!formData.bedId || isExtraBed(formData.bedId)) return null;
        const bed = availableBeds.find(b => b.id === formData.bedId);
        if (!bed || bed.maxFreeDays === null) return null;
        if ((parseInt(formData.days) || 1) > bed.maxFreeDays) {
            return { maxDays: bed.maxFreeDays, guestName: bed.nextGuestName, guestDate: bed.nextGuestDate };
        }
        return null;
    }, [formData.bedId, formData.days, availableBeds]);

    const canSelectExtraBed = useMemo(() => {
        if (!formData.roomId) return false;
        if (availableBeds.length === 0) return false;
        return availableBeds.every(b => b.isOccupied);
    }, [formData.roomId, availableBeds]);

    // Выбор тарифа: пакет фиксирует цену 65000 и минимум 10 дней
    const selectTariff = (mode) => {
        setErrors(e => ({ ...e, pricePerNight: '', days: '' }));
        if (mode === 'package') {
            setFormData(p => ({
                ...p,
                tariff: 'package',
                pricePerNight: String(PACKAGE_PRICE),
                days: Math.max(parseInt(p.days) || 1, PACKAGE_MIN_DAYS),
            }));
        } else {
            setFormData(p => ({
                ...p,
                tariff: 'standard',
                // если стояла пакетная цена — сбрасываем, чтобы кассир ввёл от 70000
                pricePerNight: (parseInt(p.pricePerNight) || 0) === PACKAGE_PRICE ? '' : p.pricePerNight,
            }));
        }
    };

    // Слушаем статус заявки на понижение цены при заселении
    useEffect(() => {
        if (!priceReqId) return;
        const unsub = onSnapshot(doc(db, ...PUBLIC_DATA_PATH, 'priceRequests', priceReqId), (snap) => {
            if (!snap.exists()) return;
            const d = snap.data();
            setPriceReqStatus(d.status || 'pending');
            if (d.status === 'approved') {
                const ap = parseInt(d.requestedPrice) || 0;
                setPriceReqApproved(ap);
                if (ap > 0) setFormData(p => ({ ...p, pricePerNight: String(ap) }));
            }
        });
        return unsub;
    }, [priceReqId]);

    const requestPriceApproval = async () => {
        if (!onCheckinPriceRequest) return;
        const price = parseInt(formData.pricePerNight) || 0;
        if (price <= 0) { notify(t('enterDesiredPrice'), 'error'); return; }
        if (!formData.fullName.trim()) { notify(t('enterGuestNameFirst'), 'error'); return; }
        setPriceReqSending(true);
        setPriceReqStatus('pending');
        try {
            const id = await onCheckinPriceRequest({
                guestName: formData.fullName,
                passport: formData.passport,
                roomNumber: formData.roomNumber,
                hostelId: currentUser?.hostelId || '',
                requestedPrice: price,
            });
            if (id) setPriceReqId(id); else setPriceReqStatus('idle');
        } catch { setPriceReqStatus('idle'); }
        finally { setPriceReqSending(false); }
    };

    // Клиент уже в списке разрешённых на понижение (по паспорту) — запрос не нужен
    const clientWhitelisted = useMemo(() => {
        const key = (formData.passport || '').replace(/\s/g, '').toUpperCase();
        return !!key && priceWhitelist.some(w => (w.passport || w.id || '').replace(/\s/g, '').toUpperCase() === key);
    }, [formData.passport, priceWhitelist]);

    const priceApproved = priceReqStatus === 'approved' || clientWhitelisted;

    const handleChange = (field, value) => {
        const processed = (field === 'fullName' || field === 'passport') ? value.toUpperCase() : value;
        setFormData(prev => ({ ...prev, [field]: processed }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
        if (field === 'fullName') {
            if (processed.length > 1) {
                const term = processed.toLowerCase();
                // Если в тексте есть кирилица - пробуем перекладку по QWERTY
                const hasCyrillic = /[а-яё]/i.test(term);
                const termLat = hasCyrillic ? cyrToLat(term).toLowerCase() : null;
                const seen = new Set();
                const matches = clients.filter(c => {
                    if (seen.has(c.passport)) return false;
                    const name = (c.fullName || '').toLowerCase();
                    const pass = (c.passport || '').toLowerCase();
                    const hit = name.includes(term) || pass.includes(term)
                        || (termLat && (name.includes(termLat) || pass.includes(termLat)));
                    if (hit) seen.add(c.passport);
                    return hit;
                }).slice(0, 5);
                setSuggestions(matches);
                setShowSuggestions(true);
            } else {
                setSuggestions([]);
                setShowSuggestions(false);
            }
        }
    };

    const handleMagnet = (field) => {
        let others = 0;
        if (field !== 'paidCash')     others += (parseInt(formData.paidCash)     || 0);
        if (field !== 'paidCard')     others += (parseInt(formData.paidCard)     || 0);
        if (field !== 'paidQR')       others += (parseInt(formData.paidQR)       || 0);
        if (field !== 'paidTransfer') others += (parseInt(formData.paidTransfer) || 0);
        const remainder = Math.max(0, effectiveTotal - others);
        handleChange(field, String(remainder));
        if (currencyMode === 'USD' && effectiveRate > 0) {
            setUsdInputs(prev => ({ ...prev, [field]: remainder > 0 ? (remainder / effectiveRate).toFixed(2) : '' }));
        }
    };

    const handleSelectClient = (client) => {
        setFormData(prev => ({
            ...prev,
            fullName: client.fullName,
            passport: client.passport || '',
            passportIssueDate: client.passportIssueDate || '',
            phone: client.phone || '',
            birthDate: client.birthDate || '',
            country: client.country || 'Узбекистан',
            paidBalance: 0,
        }));
        setShowSuggestions(false);
        // Check blacklist/warning in clients database (balance is handled by useEffect on passport)
        const dbClient = clientsDb.find(c => c.passport && c.passport === client.passport);
        if (dbClient?.clientStatus === 'blacklist') {
            setBlacklistWarning({ level: 'blacklist', name: dbClient.fullName });
        } else if (dbClient?.clientStatus === 'warning') {
            setBlacklistWarning({ level: 'warning', name: dbClient.fullName });
        } else {
            setBlacklistWarning(null);
        }
    };

    const handleRoomSelect = (roomId) => {
        const room = allRooms.find(r => r.id === roomId);
        if (room) {
            const price = getRoomPrice(room, '');
            setFormData(prev => ({ ...prev, roomId: room.id, roomNumber: room.number, pricePerNight: price, bedId: '' }));
        }
    };

    // Свободные варианты по всем комнатам (для подсказок в случае конфликта)
    const freeBedSuggestions = useMemo(() => {
        const now = new Date();
        const checkIn = formData.checkInDate ? new Date(formData.checkInDate + 'T00:00:00') : now;
        const days = parseInt(formData.days) || 1;
        const checkOut = new Date(checkIn);
        checkOut.setDate(checkOut.getDate() + days);
        const results = [];
        for (const room of allRooms) {
            const cap = parseInt(room.capacity) || 0;
            for (let b = 1; b <= cap; b++) {
                const bedId = String(b);
                // Пропускаем текущее выбранное место
                if (room.id === formData.roomId && bedId === formData.bedId) continue;
                // Есть ли активный жилец
                const hasActive = guests.some(g =>
                    g.roomId === room.id && String(g.bedId) === bedId &&
                    g.status === 'active' && new Date(g.checkInDate) <= now &&
                    (!g.checkOutDate || new Date(g.checkOutDate) > checkIn)
                );
                if (hasActive) continue;
                // Есть ли перекрывающая бронь
                const conflict = guests.find(g =>
                    g.roomId === room.id && String(g.bedId) === bedId &&
                    (g.status === 'booking' || g.status === 'active') &&
                    new Date(g.checkInDate) < checkOut &&
                    (!g.checkOutDate || new Date(g.checkOutDate) > checkIn)
                );
                if (!conflict) {
                    results.push({ roomId: room.id, roomNumber: room.number, bedId, price: getRoomPrice(room, bedId) });
                }
            }
        }
        return results.slice(0, 6); // не более 6 вариантов
    }, [allRooms, guests, formData.roomId, formData.bedId, formData.checkInDate, formData.days]);

    const handleSubmit = async (status) => {
        if (isSubmitting) return;
        if (!formData.bedId) { notify(t('selectBedFirst'), 'error'); return; }
        const errs = validate();
        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            notify(t('fillAllFields'), 'error');
            return;
        }
        setErrors({});
        if (!formData.fullName || !formData.roomId || !formData.bedId) {
            notify(t('fillAllFields'), 'error');
            return;
        }
        // Бронь с сайта/бота приходит без паспорта. При ФАКТИЧЕСКОМ заселении (гость
        // пришёл) паспортные данные обязательны — просим дополнить.
        if (status === 'active' && isFromBooking) {
            const pass = (formData.passport || '').replace(/\s/g, '');
            if (pass.length < 5 || !formData.birthDate) {
                // Раньше здесь стоял возврат на второй шаг. Шагов нет —
                // поле паспорта и так на экране, достаточно подсветить.
                setErrors(e => ({ ...e,
                    passport: pass.length < 5 ? t('completeGuestPassport') : '',
                    birthDate: !formData.birthDate ? t('enterBirthDateMsg') : '' }));
                notify(t('bookingCompletePassportMsg'), 'error');
                return;
            }
        }
        // Правила тарифов (финальный контроль)
        if (formData.tariff === 'package') {
            if ((parseInt(formData.days) || 0) < PACKAGE_MIN_DAYS) {
                notify(t('packageMinDaysError').replace('{days}', PACKAGE_MIN_DAYS), 'error');
                return;
            }
        } else if ((parseInt(formData.pricePerNight) || 0) < MIN_NIGHT_PRICE && !priceApproved) {
            notify(t('priceBelowMinApproval').replace('{min}', MIN_NIGHT_PRICE.toLocaleString()), 'error');
            return;
        }
        if (blacklistWarning?.level === 'blacklist') {
            if (!window.confirm(t('blacklistConfirmMsg'))) return;
        }
        // Проверка конфликта занятости — показываем inline-плашку
        const selBed = isExtraBed(formData.bedId) ? null : availableBeds.find(b => b.id === formData.bedId);
        if (selBed && selBed.maxFreeDays !== null && selBed.maxFreeDays !== undefined &&
            (parseInt(formData.days) || 1) > selBed.maxFreeDays) {
            setSubmitConflict({
                maxDays: selBed.maxFreeDays,
                guestName: selBed.nextGuestName,
                guestDate: selBed.nextGuestDate,
                alternatives: freeBedSuggestions,
            });
            notify(t('conflictBannerTitle'), 'error');
            return;
        }
        setSubmitConflict(null);
        if (rentalConflict) return; // inline-предупреждение уже показано в UI
        // Защита от некорректной даты заезда (иначе toISOString() бросит RangeError и заселение молча провалится)
        const checkInBase = new Date(formData.checkInDate);
        if (isNaN(checkInBase.getTime())) {
            notify(t('enterValidCheckInDate'), 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            const checkIn = new Date(formData.checkInDate);
            checkIn.setHours(checkInHour, 0, 0, 0);
            // Выезд считается от даты заезда + дни в расчётный час выезда (полные сутки),
            // независимо от фактического времени прихода.
            const checkOut = new Date(checkIn);
            checkOut.setDate(checkOut.getDate() + (parseInt(formData.days) || 1));
            checkOut.setHours(checkOutHour, 0, 0, 0);
            // Ранний заезд: гость уже физически здесь. Если расчётный час заезда сегодня
            // ещё не наступил (например пришёл в 9:00, а заезд в 14:00) — фиксируем
            // фактическое время прихода, иначе гость числится будущей бронью и кровать
            // ошибочно показывается свободной, что ведёт к двойному заселению и ложному
            // авто-выселению.
            const nowTs = new Date();
            if (status === 'active' && checkIn > nowTs && checkIn.toDateString() === nowTs.toDateString()) {
                checkIn.setTime(nowTs.getTime());
            }
            await onSubmit({
                ...formData,
                status,
                checkInDate: checkIn.toISOString(),
                checkOutDate: checkOut.toISOString(),
                totalPrice,
                amountPaid: totalPaid,
                nonRefundable: formData.tariff === 'package',
                priceReductionAllowed: !!priceApproved,
                approvedPrice: priceApproved ? (parseInt(formData.pricePerNight) || 0) : 0,
            });
        } catch (e) {
            console.error('[checkin]', e);
            notify(t('checkinError').replace('{msg}', (e?.message || e)), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
        <style>{MODAL_STYLE}</style>
        <div className="ci-backdrop modal-centered fixed inset-0 z-[200] flex items-center justify-center p-4 pb-[84px] sm:pb-4" style={{ background: 'rgba(15,30,32,0.7)' }}>
            {/* ── ОКНО — БЛАНК, А НЕ АНКЕТА В ТРИ ШАГА ────────────────────
                Шагов было три: койка, гость, оплата. Высота окна одна
                на все три, под самый длинный, — и на коротких шагах
                пустовала треть экрана. Плюс два нажатия «Далее» на каждое
                заселение: при сорока за смену это восемьдесят нажатий,
                и цена становилась видна только на третьем шаге.

                Теперь три графы рядом: кто, на каких условиях, за сколько.
                Ширина выросла с 2xl до 7xl — содержимое уходит вбок,
                а не вниз. Прокрутка оставлена страховкой: телефон боком
                и увеличенный системный шрифт окно пережить обязано. */}
            <div className="ci-card w-full max-w-7xl overflow-hidden flex flex-col relative"
                 style={{ borderRadius: 14, boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
                          height: 'min(900px, 93dvh)' }}>

                {/* ── ШАПКА ── */}
                <div className="ci-head shrink-0 flex items-end gap-4 px-6 pt-3 pb-3">
                    <div className="min-w-0">
                        <h2 className="text-[19px] font-black leading-none tracking-tight">{t('checkinSheetTitle')}</h2>
                        <div className="ci-head-sub mt-1.5 text-[11.5px] font-semibold truncate">
                            {openedAt.toLocaleDateString('ru-RU')}
                            {(currentUser?.name || currentUser?.login)
                                && <> · {t('cashDeskShort')} {currentUser.name || currentUser.login}</>}
                        </div>
                    </div>
                    <button onClick={onClose} aria-label={t('close')}
                        className="ci-x ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                        <X size={15}/>
                    </button>
                </div>

                {/* ── ПОЛОСА МЕСТА ────────────────────────────────────────
                    Выбор койки занимал шаг целиком ВСЕГДА — и тогда, когда
                    выбирать уже нечего: кассир в девяти случаях из десяти
                    открывает окно нажатием на койку в сетке комнат.
                    Теперь это строка, и она же кнопка «сменить». */}
                {formData.bedId && !bedPickerOpen && (
                    <button type="button" onClick={() => setBedPickerOpen(true)}
                        className="ci-bed shrink-0 flex w-full items-center gap-3 px-6 py-2.5 text-left">
                        <span className="ci-bed-lb text-[9px] font-black uppercase tracking-[0.2em]">{t('bed2')}</span>
                        <BedDouble size={16} className="shrink-0"/>
                        <b className="text-[15px] font-black tracking-tight">
                            {t('room')} {formData.roomNumber}
                            <span> · </span>
                            {isExtraBed(formData.bedId) ? t('extraGuest') : `${t('bed2')} ${formData.bedId}`}
                        </b>
                        {bedDetail && <span className="ci-bed-lb text-[11.5px] font-medium">{bedDetail}</span>}
                        <span className="ci-bed-pr ml-auto text-sm font-black tabular-nums">
                            {(parseInt(formData.pricePerNight) || 0).toLocaleString()} {t('sumPerNight')}
                        </span>
                        <span className="ci-bed-chg px-2.5 py-1 text-[11px] font-bold">{t('changeBed')}</span>
                    </button>
                )}

                {/* ── ПРЕДУПРЕЖДЕНИЯ ──────────────────────────────────────
                    Полосами во всю ширину и над графами: всё, что кассир
                    обязан увидеть ДО того, как продолжит. Внутри шага они
                    оказывались ниже сгиба. */}
                {isFromBooking && (formData.passport || '').replace(/\s/g, '').length < 5 && (
                    <div className="ci-notice ci-info shrink-0"><i/>
                        <div>{t('bookingNoPassportPre')} <b>{t('bookingCompletePassportBold')}</b> {t('bookingNoPassportPost')}</div>
                    </div>
                )}
                {blacklistWarning && (
                    <div className={`ci-notice shrink-0 ${blacklistWarning.level === 'blacklist' ? 'ci-danger' : 'ci-warn'}`}><i/>
                        <div>
                            <b>{blacklistWarning.level === 'blacklist' ? t('blacklistLabel') : t('warningLabel')}</b>
                            {' — '}{blacklistWarning.name}
                            {': '}{blacklistWarning.level === 'blacklist' ? t('blacklistDesc') : t('warningGuestDesc')}
                        </div>
                        <button onClick={() => setBlacklistWarning(null)} className="ml-auto shrink-0 opacity-60 hover:opacity-100"><X size={13}/></button>
                    </div>
                )}
                {isFromBooking && !initialClient?.depositMoved && (Number(initialClient?.amountPaid) || 0) > 0 && (
                    <div className="ci-notice ci-ok shrink-0"><i/>
                        <div><b>{t('bookingDeposit')} {Number(initialClient.amountPaid).toLocaleString()} {t('sum')}</b> — {t('depositAutoApplied')}</div>
                    </div>
                )}
                {currentUser?.role === 'admin' && (
                    <div className="ci-notice ci-warn shrink-0"><i/>
                        <div><b>{t('adminNoPayment')}</b> — {t('adminNoPaymentSub')}</div>
                    </div>
                )}
                {bedConflict && (
                    <div className="ci-notice ci-warn shrink-0"><i/>
                        <div>
                            <b>{t('conflictBannerTitle')}</b> — {t('conflictInDays')} {bedConflict.maxDays} {t('daysShort')}
                            {' '}{t('conflictArrivesOnBed')} {bedConflict.guestName}. {t('conflictReduceDaysTo')} {bedConflict.maxDays}.
                        </div>
                    </div>
                )}
                {(() => {
                    const sel = availableBeds.find(b => b.id === formData.bedId);
                    if (!sel || sel.isOccupied || !sel.expiredName) return null;
                    return (
                        <div className="ci-notice ci-danger shrink-0"><i/>
                            <div>
                                <b>{t('expiredGuestOnBedTitle')}</b> — {sel.expiredName}{' '}
                                {t('expiredWasCheckout').replace('{date}', new Date(sel.expiredSince).toLocaleDateString('ru'))}
                                {sel.expiredDebt > 0 && <> {t('andConj')} {t('expiredNotPaid').replace('{n}', sel.expiredDebt.toLocaleString())}</>}.
                                {' '}{t('expiredResolveFirst')}
                            </div>
                        </div>
                    );
                })()}

                {/* Прокручивается середина: полоса прокрутки не должна
                    уносить кнопку «Заселить» за нижний край. */}
                <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">

                    {/* ── ВЫБОР МЕСТА ── */}
                    {(!formData.bedId || bedPickerOpen) && (
                        <div className="shrink-0 px-6 pt-3 pb-1">
                            <div className="lg:grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-5 lg:items-start">
                                <div>
                                    <div className="ci-cap mb-2">{t('bedSelection')}</div>
                                    <SimpleSelect
                                        label={t('room')}
                                        value={formData.roomId}
                                        onChange={handleRoomSelect}
                                        options={allRooms.map(r => {
                                            const cfg = configuredNightPrice(r.hostelId, r.number);
                                            let priceStr;
                                            if (cfg != null) {
                                                priceStr = `${cfg.toLocaleString()} ${t('sum')}`;
                                            } else {
                                                const lower = parseInt(r.prices?.lower) || parseInt(r.price) || 0;
                                                const upper = parseInt(r.prices?.upper);
                                                priceStr = upper && upper !== lower
                                                    ? `↓${lower.toLocaleString()} / ↑${upper.toLocaleString()} ${t('sum')}`
                                                    : `${lower.toLocaleString()} ${t('sum')}`;
                                            }
                                            return { value: r.id, label: `№${r.number} · ${r.capacity} ${t('kpiBeds')} · ${priceStr}` };
                                        })}
                                    />
                                </div>
                                {formData.roomId && (() => {
                                    const _room = allRooms.find(r => r.id === formData.roomId);
                                    if (!_room) return null;
                                    const _cap  = parseInt(_room.capacity) || 1;
                                    const _mid  = Math.ceil(_cap / 2);
                                    const _cfg  = configuredNightPrice(_room.hostelId, _room.number);
                                    const _pLow = _cfg != null ? _cfg : (parseInt(_room.prices?.lower) || parseInt(_room.price) || 0);
                                    const _pUp  = _cfg != null ? _cfg : parseInt(_room.prices?.upper);
                                    const _hasTiers = _cfg == null && _pUp && _pUp !== _pLow && _cap > 1;
                                    const lowerBeds = availableBeds.filter(b => parseInt(b.id) <= _mid);
                                    const upperBeds = availableBeds.filter(b => parseInt(b.id) >  _mid);
                                    const BedBtn = ({ bed }) => {
                                        const hasExpired = !bed.isOccupied && !!bed.expiredName;
                                        const title =
                                            bed.isOccupied ? `${t('bedOccupied').replace('{name}', bed.occupantName)}${bed.occupantDebt > 0 ? t('bedDebtPart').replace('{n}', bed.occupantDebt.toLocaleString()) : ''}` :
                                            hasExpired ? `${t('bedExpiredTitle').replace('{name}', bed.expiredName).replace('{date}', new Date(bed.expiredSince).toLocaleDateString('ru'))}${bed.expiredDebt > 0 ? t('bedExpiredUnpaid').replace('{n}', bed.expiredDebt.toLocaleString()) : ''}${t('bedExpiredSuffix')}` :
                                            bed.maxFreeDays != null ? t('bedFreeDaysTitle').replace('{days}', bed.maxFreeDays).replace('{name}', bed.nextGuestName) :
                                            t('bedPlaceTitle').replace('{id}', bed.id);
                                        return (
                                        <button
                                            onClick={() => {
                                                if (!bed.isOccupied) {
                                                    const price = getRoomPrice(_room, bed.id);
                                                    setFormData(prev => ({ ...prev, bedId: bed.id, pricePerNight: price }));
                                                    setBedPickerOpen(false);
                                                }
                                            }}
                                            disabled={bed.isOccupied}
                                            title={title}
                                            className={`w-14 h-14 rounded-xl font-bold text-[10px] flex flex-col items-center justify-center gap-0 transition-all border-2 relative
                                                ${formData.bedId === bed.id
                                                    ? 'bg-teal-600 text-white border-teal-600 shadow-md scale-105'
                                                    : bed.isOccupied
                                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                                                        : hasExpired
                                                            ? 'bg-rose-50 text-rose-700 border-rose-300 hover:border-rose-500 hover:bg-rose-100'
                                                            : bed.maxFreeDays != null
                                                                ? 'bg-amber-50 text-amber-700 border-amber-300 hover:border-amber-500 hover:bg-amber-100'
                                                                : 'bg-white text-slate-600 border-slate-200 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-600'
                                                }`}>
                                            {/* Индикатор долга у текущего/просроченного жильца */}
                                            {((bed.isOccupied && bed.occupantDebt > 0) || (hasExpired && bed.expiredDebt > 0)) && (
                                                <span className="absolute -top-1.5 -right-1.5 text-[10px] leading-none" title={t('hasDebtTitle')}>💰</span>
                                            )}
                                            <BedDouble size={13}/>
                                            <span className="text-xs font-bold leading-tight">{bed.id}</span>
                                            {bed.isOccupied && (
                                                <span className="text-[7px] font-black leading-none truncate max-w-[52px] px-0.5">{bed.occupantName}</span>
                                            )}
                                            {hasExpired && (
                                                <span className="text-[7px] font-black leading-none truncate max-w-[52px] px-0.5">⏰{bed.expiredName}</span>
                                            )}
                                            {bed.maxFreeDays != null && !bed.isOccupied && !hasExpired && (
                                                <span className="text-[8px] font-black leading-none">{bed.maxFreeDays}{t('daysShort')}</span>
                                            )}
                                        </button>
                                        );
                                    };
                                    return (
                                        <div className="space-y-3 mt-3 lg:mt-0">
                                            {upperBeds.length > 0 && (
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ci-ink-3)' }}>↑ {t('upperTier')}</span>
                                                        {_hasTiers && (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                                                  style={{ color: 'var(--ci-info-ink)', background: 'rgba(79,70,229,.1)' }}>
                                                                {_pUp.toLocaleString()} {t('sumPerNight')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {upperBeds.map(bed => <BedBtn key={bed.id} bed={bed}/>)}
                                                    </div>
                                                </div>
                                            )}
                                            {lowerBeds.length > 0 && (
                                                <div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--ci-ink-3)' }}>↓ {t('lowerTier')}</span>
                                                        {_hasTiers && (
                                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                                                                  style={{ color: 'var(--ci-accent-ink)', background: 'rgba(15,150,136,.12)' }}>
                                                                {_pLow.toLocaleString()} {t('sumPerNight')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {lowerBeds.map(bed => <BedBtn key={bed.id} bed={bed}/>)}
                                                    </div>
                                                </div>
                                            )}
                                            {canSelectExtraBed && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const price = getRoomPrice(_room, '');
                                                        setFormData(prev => ({ ...prev, bedId: EXTRA_BED_ID, pricePerNight: price }));
                                                        setBedPickerOpen(false);
                                                    }}
                                                    className={`w-full rounded-xl border-2 px-3 py-2 text-left transition-all ${
                                                        isExtraBed(formData.bedId)
                                                            ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                                                            : 'bg-white text-orange-700 border-orange-300 hover:bg-orange-100 hover:border-orange-400'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-1.5 font-bold text-sm">
                                                        <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true"><circle cx="5" cy="6" r="2.8"/><rect x="2" y="11" width="20" height="4" rx="2"/></svg>
                                                        {t('onFloor')}
                                                    </div>
                                                    <div className={`text-xs mt-0.5 ${isExtraBed(formData.bedId) ? 'text-orange-100' : 'text-orange-600'}`}>
                                                        {t('extraBedHint')}
                                                    </div>
                                                </button>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* ── ТРИ ГРАФЫ ── */}
                    <div className="ci-sheet3 flex-1">

                        {/* ───────────── I. ГОСТЬ ───────────── */}
                        <div className="ci-col ci-col-a">
                            <div className="ci-cap">
                                {t('guestData')}
                                {/[а-яёА-ЯЁ]/.test(formData.fullName) && (
                                    <button type="button" className="ci-cap-act"
                                        onClick={() => handleChange('fullName', cyrToLat(formData.fullName))}
                                        title={t('translitTitle')}>{t('translitBtn')}</button>
                                )}
                                <span className="ci-cap-ct">
                                    {t('filledOf').replace('{done}', guestFilled.done).replace('{total}', guestFilled.total)}
                                </span>
                            </div>

                            {/* Сканер и снимок паспорта — те же, что были на шаге «Гость». */}
                            <div className="flex gap-2 flex-wrap py-2">
                                <button type="button"
                                    onClick={() => { setScanMode('usb'); setTimeout(() => scanInputRef.current?.focus(), 80); }}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
                                    style={{ background: 'rgba(15,150,136,.1)', color: 'var(--ci-accent-ink)' }}>
                                    <ScanLine size={13}/> {t('scanUsb')}
                                </button>
                                <button type="button"
                                    onClick={() => photoInputRef.current?.click()}
                                    disabled={ocrLoading}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
                                    style={{ background: 'var(--ci-surface-2)', color: 'var(--ci-ink-2)' }}>
                                    <Camera size={13}/>
                                    {ocrLoading ? t('recognizing') : formData.passportPhoto ? `✓ ${t('changePhoto')}` : t('photoMrz')}
                                </button>
                                <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange}/>
                                {formData.passportPhoto && (
                                    <span className="relative inline-block">
                                        <img src={formData.passportPhoto} alt={t('passport')} className="h-8 rounded-md object-cover"/>
                                        <button type="button" onClick={() => setFormData(p => ({ ...p, passportPhoto: '' }))}
                                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                                            style={{ background: 'var(--ci-surface)', border: '1px solid var(--ci-line)', color: 'var(--ci-ink-3)' }}>
                                            <X size={9}/>
                                        </button>
                                    </span>
                                )}
                            </div>

                            <div className="ci-r" style={{ position: 'relative', zIndex: 30 }}>
                                <span className="ci-r-k"><User size={15}/>{t('guestName')}<b className="ci-req">∗</b></span>
                                <span className={`ci-r-v${errors.fullName ? ' ci-err' : ''}`}>
                                    <input className="ci-f" value={formData.fullName}
                                        onChange={e => handleChange('fullName', e.target.value)}
                                        placeholder={t('startTypingName')}/>
                                </span>
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="absolute top-full left-[132px] right-0 mt-1 rounded-xl shadow-xl overflow-hidden z-50"
                                        style={{ background: 'var(--ci-surface)', border: '1px solid var(--ci-accent)' }}>
                                        {suggestions.map((c, idx) => (
                                            <button key={c.id} onClick={() => handleSelectClient(c)}
                                                className="w-full text-left px-3.5 py-2.5 flex justify-between items-center gap-3 outline-none"
                                                style={{ borderTop: idx ? '1px solid var(--ci-line)' : 'none',
                                                         background: idx === 0 ? 'var(--ci-accent)' : 'transparent' }}>
                                                <span className="min-w-0">
                                                    <span className="block truncate font-bold text-[13.5px]"
                                                          style={{ color: idx === 0 ? '#fff' : 'var(--ci-ink)' }}>{c.fullName}</span>
                                                    <span className="block truncate text-[11px]"
                                                          style={{ color: idx === 0 ? 'rgba(255,255,255,.75)' : 'var(--ci-ink-3)' }}>{c.passport} · {c.country}</span>
                                                </span>
                                                {COUNTRY_FLAGS[c.country] && <Flag code={COUNTRY_FLAGS[c.country]} size={20}/>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="ci-r">
                                <span className="ci-r-k"><FileText size={15}/>{t('passport')}<b className="ci-req">∗</b></span>
                                <span className={`ci-r-v${errors.passport ? ' ci-err' : ''}`}>
                                    <input className="ci-f" value={formData.passport}
                                        onChange={e => handleChange('passport', e.target.value)} placeholder="AA 1234567"/>
                                </span>
                            </div>
                            {errors.passport && <div className="ci-errmsg pl-[142px] pb-1">{errors.passport}</div>}

                            <div className="ci-r">
                                <span className="ci-r-k"><Cake size={15}/>{t('birthDate')}<b className="ci-req">∗</b></span>
                                <span className={`ci-r-v${errors.birthDate ? ' ci-err' : ''}`}>
                                    <DatePicker className="ci-f" lang={lang} placeholder={t('dateFmt')}
                                        value={formData.birthDate} onChange={val => handleChange('birthDate', val)}/>
                                </span>
                                {guestAge !== null && (
                                    <span className="ci-r-side">
                                        {guestAge} {plural(guestAge, t('yearsOne'), t('yearsFew'), t('yearsMany'))}
                                    </span>
                                )}
                            </div>
                            {errors.birthDate && <div className="ci-errmsg pl-[142px] pb-1">{errors.birthDate}</div>}

                            <div className="ci-r">
                                <span className="ci-r-k"><Globe size={15}/>{t('country')}</span>
                                <span className="ci-r-v">
                                    <select className="ci-f cursor-pointer" value={formData.country}
                                        onChange={e => handleChange('country', e.target.value)}>
                                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </span>
                            </div>

                            {formData.country && formData.country !== 'Узбекистан' && (
                                <div className="ci-r">
                                    <span className="ci-r-k"><FileText size={15}/>{t('passportIssueDateLabel')}<b className="ci-req">∗</b></span>
                                    <span className={`ci-r-v${errors.passportIssueDate ? ' ci-err' : ''}`}>
                                        <DatePicker className="ci-f" lang={lang} placeholder={t('dateFmt')}
                                            value={formData.passportIssueDate} onChange={val => handleChange('passportIssueDate', val)}/>
                                    </span>
                                </div>
                            )}

                            <div className="ci-r">
                                <span className="ci-r-k"><Phone size={15}/>{t('phone')}</span>
                                <span className="ci-r-v">
                                    <input className="ci-f" value={formData.phone}
                                        onChange={e => handleChange('phone', e.target.value)} placeholder="+998..."/>
                                </span>
                            </div>

                            {formData.country && formData.country !== 'Узбекистан' && (
                                <div className="ci-r">
                                    <span className="ci-r-k"><MapPin size={15}/>{t('kppDatePassed')}<b className="ci-req">∗</b></span>
                                    <span className={`ci-r-v${errors.kppDate ? ' ci-err' : ''}`}>
                                        <DatePicker className="ci-f" lang={lang} placeholder={t('dateFmt')}
                                            value={formData.kppDate} onChange={val => handleChange('kppDate', val)}/>
                                    </span>
                                </div>
                            )}

                            {/* ── ОТМЕТКИ ────────────────────────────────
                                То, что база знает о госте, но полем не является:
                                сколько раз жил, есть ли деньги на карточке, нет ли
                                его в чёрном списке. Без этого касса не отличает
                                постоянного гостя от впервые зашедшего, а «нет
                                в чёрном списке» приходится выводить из отсутствия
                                предупреждения — то есть из молчания. */}
                            <div className="ci-cap ci-cap-sub">{t('marksTitle')}</div>
                            <div className="mt-1.5">
                                {clientCard ? (
                                    <>
                                        <div className="ci-note">
                                            <span className={`ci-dot${visitCount >= 2 ? '' : ' ci-off'}`}/>
                                            <span>
                                                {visitCount >= 2
                                                    ? <>{t('regularGuest')} — <b>{visitCount} {plural(visitCount, t('staysOne'), t('staysFew'), t('staysMany'))}</b></>
                                                    : visitCount === 1 ? t('stayedOnce') : t('noStaysMarked')}
                                                {clientCard.lastVisit && t('lastStayOn').replace('{d}', new Date(clientCard.lastVisit).toLocaleDateString('ru-RU'))}
                                            </span>
                                        </div>
                                        <div className="ci-note">
                                            <span className={`ci-dot${clientBalance > 0 ? '' : ' ci-off'}`}/>
                                            <span>
                                                {clientBalance > 0
                                                    ? <>{t('balance')} <b>{clientBalance.toLocaleString()}</b> — {appliedBalance > 0 ? t('balanceCounted') : t('balanceNotCounted')}</>
                                                    : t('noBalanceOnCard')}
                                            </span>
                                        </div>
                                        <div className="ci-note">
                                            <span className={`ci-dot${blacklistWarning ? '' : ' ci-off'}`}/>
                                            <span>
                                                {t('inBlacklistLine')}{' '}
                                                <b style={blacklistWarning ? { color: 'var(--ci-danger-ink)' } : undefined}>
                                                    {blacklistWarning?.level === 'blacklist' ? t('blYes')
                                                        : blacklistWarning ? t('blMark') : t('blNo')}
                                                </b>
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="ci-note"><span className="ci-dot ci-off"/>
                                        <span>{(formData.passport || '').replace(/\s/g, '').length >= 5
                                            ? t('noClientCardNew') : t('noClientCardHint')}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ───────────── II. УСЛОВИЯ ───────────── */}
                        <div className="ci-col ci-col-b">
                            <div className="ci-cap">
                                {t('stayConditions')}
                                <span className="ci-cap-ct">{parseInt(formData.days) || 0} {t('daysShort')}</span>
                            </div>

                            <div className="ci-r">
                                <span className="ci-r-k ci-r-k-w"><Tag size={15}/>{t('tariff')}</span>
                                <span className="ci-r-v ci-flat">
                                    <span className="ci-pick">
                                        <button type="button" onClick={() => selectTariff('standard')}
                                            className={formData.tariff === 'standard' ? 'ci-on' : ''}>{t('tariffStandard')}</button>
                                        <button type="button" onClick={() => selectTariff('package')}
                                            className={formData.tariff === 'package' ? 'ci-on' : ''}>{t('tariffPackage')}</button>
                                    </span>
                                </span>
                            </div>

                            <div className="ci-r">
                                <span className="ci-r-k ci-r-k-w"><CalendarDays size={15}/>{t('checkIn')}</span>
                                <span className="ci-r-v">
                                    <DatePicker className="ci-f" lang={lang} placeholder={t('dateFmt')}
                                        value={formData.checkInDate} onChange={val => handleChange('checkInDate', val)}/>
                                </span>
                            </div>

                            <div className="ci-r">
                                <span className="ci-r-k ci-r-k-w"><Moon size={15}/>{t('days')}</span>
                                <span className={`ci-r-v${errors.days ? ' ci-err' : ''}`}>
                                    <input className="ci-f" inputMode="numeric" value={formData.days}
                                        onChange={e => handleChange('days', e.target.value.replace(/\D/g, ''))}/>
                                </span>
                                {/* Сколько суток место свободно до чужого заезда — видно ДО
                                    того, как поставлены лишние сутки, а не только полосой после. */}
                                {selectedBed?.maxFreeDays != null && (
                                    <span className={`ci-r-side${(parseInt(formData.days) || 1) <= selectedBed.maxFreeDays ? ' ci-ok' : ''}`}>
                                        {t('maxDaysShort').replace('{n}', selectedBed.maxFreeDays)}
                                    </span>
                                )}
                                <span className="flex shrink-0 gap-1">
                                    <button type="button" aria-label="−"
                                        onClick={() => handleChange('days', Math.max(1, (parseInt(formData.days) || 1) - 1))}
                                        className="rounded p-1" style={{ background: 'var(--ci-surface-2)', color: 'var(--ci-ink-2)' }}><Minus size={13}/></button>
                                    <button type="button" aria-label="+"
                                        onClick={() => handleChange('days', (parseInt(formData.days) || 1) + 1)}
                                        className="rounded p-1" style={{ background: 'var(--ci-surface-2)', color: 'var(--ci-ink-2)' }}><Plus size={13}/></button>
                                </span>
                            </div>
                            {errors.days && <div className="ci-errmsg pl-[134px] pb-1">{errors.days}</div>}

                            <div className="ci-r">
                                <span className="ci-r-k ci-r-k-w"><CalendarDays size={15}/>{t('checkOut')}</span>
                                <span className="ci-r-v ci-flat text-[15px] font-bold tabular-nums" style={{ padding: '5px 2px' }}>
                                    {checkOutPreview || '—'}
                                </span>
                                <span className="ci-r-side">{t('untilHour').replace('{h}', String(checkOutHour).padStart(2, '0'))}</span>
                            </div>

                            <div className="ci-r">
                                <span className="ci-r-k ci-r-k-w"><Banknote size={15}/>{t('price')}</span>
                                {formData.tariff === 'package' ? (
                                    <>
                                        <span className="ci-r-v ci-flat text-[15px] font-bold tabular-nums" style={{ padding: '5px 2px' }}>
                                            {PACKAGE_PRICE.toLocaleString()}
                                        </span>
                                        <span className="ci-r-side">{t('packageSumLabel')}</span>
                                    </>
                                ) : (
                                    <>
                                        <span className={`ci-r-v${errors.pricePerNight ? ' ci-err' : ''}`}>
                                            <input className="ci-f" inputMode="numeric"
                                                value={fmtSum(formData.pricePerNight)}
                                                onChange={e => handleChange('pricePerNight', parseSum(e.target.value))}/>
                                        </span>
                                        <span className="ci-r-side">{t('fromMinSuffix').replace('{min}', MIN_NIGHT_PRICE.toLocaleString())}</span>
                                    </>
                                )}
                            </div>
                            {errors.pricePerNight && <div className="ci-errmsg pl-[134px] pb-1">{errors.pricePerNight}</div>}

                            <div className="ci-cap ci-cap-sub">{t('notesTitle')}</div>
                            <div className="mt-1.5">
                                <div className="ci-note">
                                    <span className={`ci-dot${formData.tariff === 'package' ? '' : ' ci-off'}`}/>
                                    <span>{t('tariffPackage')} <b>{PACKAGE_PRICE.toLocaleString()}</b>
                                        {' — '}{t('packageFromDays').replace('{days}', PACKAGE_MIN_DAYS)}</span>
                                </div>
                                <div className="ci-note"><span className="ci-dot ci-off"/>
                                    <span>{t('priceBelowMinApproval').replace('{min}', MIN_NIGHT_PRICE.toLocaleString())}</span>
                                </div>
                            </div>

                            {/* Запрос на понижение цены — с состоянием, поэтому блок,
                                а не строка примечания. */}
                            {formData.tariff === 'standard' && (parseInt(formData.pricePerNight) || 0) > 0 && (parseInt(formData.pricePerNight) || 0) < MIN_NIGHT_PRICE && (
                                <div className="mt-3">
                                    {clientWhitelisted ? (
                                        <div className="flex items-start gap-2 rounded-xl px-3 py-2.5"
                                             style={{ background: 'rgba(15,150,136,.12)', color: 'var(--ci-accent-ink)' }}>
                                            <CheckCircle2 size={15} className="shrink-0 mt-0.5"/>
                                            <p className="text-[11.5px] font-semibold">{t('clientWhitelistedMsg')}</p>
                                        </div>
                                    ) : priceReqStatus === 'approved' ? (
                                        <div className="flex items-start gap-2 rounded-xl px-3 py-2.5"
                                             style={{ background: 'rgba(15,150,136,.12)', color: 'var(--ci-accent-ink)' }}>
                                            <CheckCircle2 size={15} className="shrink-0 mt-0.5"/>
                                            <p className="text-[11.5px] font-semibold">{t('priceApprovedMsg').replace('{n}', priceReqApproved.toLocaleString())}</p>
                                        </div>
                                    ) : priceReqStatus === 'pending' ? (
                                        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                                             style={{ background: 'rgba(245,158,11,.12)', color: 'var(--ci-warn-ink)' }}>
                                            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0"/>
                                            <p className="text-[11.5px] font-semibold">{t('waitingTelegramApproval')}</p>
                                        </div>
                                    ) : (
                                        <div className="rounded-xl px-3 py-2.5 space-y-2"
                                             style={{ background: 'rgba(245,158,11,.12)', color: 'var(--ci-warn-ink)' }}>
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle size={15} className="shrink-0 mt-0.5"/>
                                                <p className="text-[11.5px] font-semibold leading-snug">
                                                    {t('priceBelowMinApproval').replace('{min}', MIN_NIGHT_PRICE.toLocaleString())}
                                                    {priceReqStatus === 'rejected' && <b className="block mt-1" style={{ color: 'var(--ci-danger-ink)' }}>{t('prevRequestRejected')}</b>}
                                                </p>
                                            </div>
                                            <button type="button" onClick={requestPriceApproval} disabled={priceReqSending}
                                                className="w-full py-2 rounded-xl text-white text-xs font-bold disabled:opacity-50"
                                                style={{ background: '#f59e0b' }}>
                                                {t('requestPriceReduction').replace('{n}', (parseInt(formData.pricePerNight) || 0).toLocaleString())}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ───────────── III. РАСЧЁТ ───────────── */}
                        <div className="ci-col ci-col-c">
                            <div className="ci-cap">
                                {t('calcTitle')}
                                <span className="ci-cap-ct">{currencyMode === 'USD' ? 'USD' : t('sum')}</span>
                            </div>

                            <div className="ci-crow">
                                <span>{t('accommodationLine')} · {(parseInt(formData.pricePerNight) || 0).toLocaleString()} × {parseInt(formData.days) || 0}</span>
                                <b>{totalPrice.toLocaleString()}</b>
                            </div>

                            {/* Баланс клиента — строка вычета, а не отдельная карточка
                                с кнопкой «Применить». Он и есть вычет из счёта. */}
                            {clientBalance > 0 && (
                                <div className="ci-crow ci-minus">
                                    <span>{t('clientBalanceLabel')}</span>
                                    {appliedBalance > 0 ? (
                                        <button type="button" className="ml-2 text-[11px] font-bold underline"
                                            style={{ color: 'var(--ci-ink-3)' }}
                                            onClick={() => setFormData(p => ({ ...p, paidBalance: 0 }))}>{t('undoApply')}</button>
                                    ) : (
                                        <button type="button" className="ml-2 text-[11px] font-bold underline"
                                            style={{ color: 'var(--ci-accent-ink)' }}
                                            onClick={() => setFormData(p => ({ ...p, paidBalance: Math.min(clientBalance, totalPrice), paidCash: '', paidCard: '', paidQR: '' }))}>
                                            {t('applyToPayment')}
                                        </button>
                                    )}
                                    <b>−{appliedBalance.toLocaleString()}</b>
                                </div>
                            )}

                            <div className="ci-sum">
                                <span className="ci-sum-k">{t('totalDue')}</span>
                                <span className="ci-sum-v">{effectiveTotal.toLocaleString()}</span>
                            </div>

                            {/* ── КАССА ─────────────────────────────────
                                Ввод денег стоял на той же подложке, что и счёт,
                                и терялся среди чисел, которые только читают.
                                Теперь он на своей поверхности. */}
                            {currentUser?.role !== 'admin' && (
                                <div className="ci-kassa">
                                    <div className="ci-kcap">
                                        {t('acceptedTitle')}
                                        <span className="ci-cap-ct">
                                            <span className="ci-pick">
                                                {[['UZS', t('sumCurrency')], ['USD', 'USD']].map(([mode, label]) => (
                                                    <button key={mode} type="button" onClick={() => handleModeSwitch(mode)}
                                                        className={currencyMode === mode ? 'ci-on' : ''}
                                                        style={{ padding: '2px 8px', fontSize: 11 }}>{label}</button>
                                                ))}
                                            </span>
                                        </span>
                                    </div>

                                    {currencyMode === 'USD' && (
                                        <div className="flex items-center gap-2 pt-2 text-[11px] font-semibold" style={{ color: 'var(--ci-ink-3)' }}>
                                            <span>{t('exchangeRateLabel')}</span>
                                            <input type="number" value={manualRate}
                                                onChange={e => {
                                                    setManualRate(e.target.value);
                                                    const rate = parseInt(e.target.value) > 0 ? parseInt(e.target.value) : usdRate;
                                                    if (rate > 0) {
                                                        setUsdInputs({
                                                            paidCash: (parseInt(formData.paidCash) || 0) > 0 ? ((parseInt(formData.paidCash) || 0) / rate).toFixed(2) : '',
                                                            paidCard: (parseInt(formData.paidCard) || 0) > 0 ? ((parseInt(formData.paidCard) || 0) / rate).toFixed(2) : '',
                                                            paidQR:   (parseInt(formData.paidQR)   || 0) > 0 ? ((parseInt(formData.paidQR)   || 0) / rate).toFixed(2) : '',
                                                        });
                                                    }
                                                }}
                                                placeholder={usdRate > 0 ? Math.round(usdRate).toLocaleString() : ''}
                                                className="w-24 rounded-lg px-2 py-0.5 text-[11px]"
                                                style={{ border: '1px solid var(--ci-line)' }}/>
                                            {effectiveRate > 0 && parseInt(manualRate) > 0 && usdRate > 0 && (
                                                <button type="button" onClick={() => { setManualRate(''); handleModeSwitch('USD'); }}
                                                    className="underline">{t('autoRate')}</button>
                                            )}
                                        </div>
                                    )}

                                    {PAY_METHODS.map(m => {
                                        const usdOn  = !!m.usd && currencyMode === 'USD';
                                        const amount = parseInt(formData[m.key]) || 0;
                                        const MIcon  = m.Icon;
                                        return (
                                            <div key={m.key} className={`ci-m${amount > 0 ? ' ci-filled' : ''}`}>
                                                <span className="ci-m-k"><MIcon size={15}/>{m.label}</span>
                                                <span className="ci-m-field">
                                                    <input inputMode="numeric"
                                                        value={usdOn ? usdInputs[m.usd] : fmtSum(formData[m.key])}
                                                        onChange={e => (usdOn
                                                            ? handleUsdChange(m.usd, e.target.value)
                                                            : handleChange(m.key, parseSum(e.target.value)))}
                                                        placeholder={usdOn ? '0.00' : '—'}/>
                                                    {/* Магнит был и раньше — значком внутри поля. Теперь это
                                                        кнопка: самое частое движение кассира не должно быть
                                                        бледнее рамки. */}
                                                    <button type="button" className="ci-mag" tabIndex={-1}
                                                        onClick={() => handleMagnet(m.key)}
                                                        title={t('fillRemainderTitle')}>
                                                        <Magnet size={14}/>
                                                    </button>
                                                </span>
                                            </div>
                                        );
                                    })}

                                    <div className="ci-sum">
                                        <span className="ci-sum-k">{t('depositedTitle')}</span>
                                        <span className="ci-sum-v">{collected.toLocaleString()}</span>
                                    </div>
                                </div>
                            )}

                            <div className={`ci-rest${balance > 0 ? '' : ' ci-done'}`}>
                                <span className="ci-rest-k">{balance > 0 ? t('remaining') : t('paid')}</span>
                                <span className="ci-rest-v">
                                    {balance > 0 ? balance.toLocaleString() : (balance < 0 ? `+${Math.abs(balance).toLocaleString()}` : '0')}
                                </span>
                            </div>
                        </div>
                    </div>

                {/* ── Аренда конфликт ── */}
                {rentalConflict && (
                    <div className="mx-6 mb-4 rounded-2xl overflow-hidden border border-orange-300 shadow-lg">
                        <div className="bg-orange-500 px-4 py-3 flex items-center gap-2">
                            <span className="text-white text-lg">🏢</span>
                            <div>
                                <div className="text-white font-black text-sm">{t('roomRented')}</div>
                                <div className="text-orange-100 text-xs">{t('checkinImpossibleDates')}</div>
                            </div>
                        </div>
                        <div className="bg-orange-50 px-4 py-3">
                            <p className="text-sm text-orange-800 font-semibold">
                                {rentalConflict.tenantName && <span>{t('tenantLabel')}: <b>{rentalConflict.tenantName}</b> · </span>}
                                {t('rentalPeriod')}: <b>{rentalConflict.from}</b> — <b>{rentalConflict.to}</b>
                            </p>
                            <p className="text-xs text-orange-600 mt-1">{t('changeDatesOrRoom')}</p>
                        </div>
                    </div>
                )}

                {/* ── Inline конфликт-плашка ── */}
                {submitConflict && (
                    <div className="mx-6 mb-4 rounded-2xl overflow-hidden border border-rose-300 shadow-lg">
                        <div className="bg-rose-600 px-4 py-3 flex items-center gap-2">
                            <span className="text-white text-lg">🚫</span>
                            <div>
                                <div className="text-white font-black text-sm">{t('conflictBannerTitle')}</div>
                                <div className="text-rose-200 text-xs">{t('conflictBannerSub')}</div>
                            </div>
                        </div>
                        <div className="bg-rose-50 px-4 py-3 space-y-2">
                            <div className="text-sm text-rose-800">
                                {t('conflictBedPrefix')} <b>#{formData.bedId}</b> {t('conflictBedIn')}{' '}
                                <b>{submitConflict.maxDays} {t('daysShort')}</b> {t('conflictBedArrives')}{' '}
                                <b>{submitConflict.guestName}</b>
                                {submitConflict.guestDate && (
                                    <span className="text-rose-600"> ({new Date(submitConflict.guestDate).toLocaleDateString(lang === 'uz' ? 'uz-UZ' : 'ru-RU')})</span>
                                )}.{' '}
                                {t('conflictBedMax')} <b>{submitConflict.maxDays} {t('daysShort')}</b>.
                            </div>
                            {submitConflict.alternatives.length > 0 ? (
                                <div>
                                    <div className="text-xs font-black text-rose-700 uppercase tracking-wider mb-2">{t('conflictFreeTitle')}</div>
                                    <div className="flex flex-wrap gap-2">
                                        {submitConflict.alternatives.map(alt => (
                                            <button
                                                key={`${alt.roomId}-${alt.bedId}`}
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        roomId: alt.roomId,
                                                        roomNumber: alt.roomNumber,
                                                        bedId: alt.bedId,
                                                        pricePerNight: alt.price,
                                                    }));
                                                    setSubmitConflict(null);
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-emerald-400 rounded-xl text-emerald-700 font-bold text-xs hover:bg-emerald-50 hover:border-emerald-500 transition-all shadow-sm">
                                                🛏 {t('room')} {alt.roomNumber} · {t('bed')} {alt.bedId}
                                                {alt.price > 0 && <span className="text-emerald-500 font-medium">{alt.price.toLocaleString()} {t('sum')}</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-xs text-rose-700 font-semibold bg-rose-100 rounded-xl px-3 py-2">
                                    <span>😔</span> {t('conflictNoFree')}
                                </div>
                            )}
                            <button onClick={() => setSubmitConflict(null)} className="text-xs text-rose-500 hover:text-rose-700 underline">
                                {t('close')}
                            </button>
                        </div>
                    </div>
                )}

                </div>

                {/* ── ПОДВАЛ ──────────────────────────────────────────────
                    Деньги переехали в графу расчёта — она видна всё время
                    и без прокрутки, поэтому дублировать итог здесь незачем.
                    Остаётся то, чего в графах нет: кто оформляет и что делает. */}
                <div className="ci-foot shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2.5">
                    <div className="ci-foot-sig">
                        {t('issuedBy')} <b>{currentUser?.name || currentUser?.login || '—'}</b>
                        {' · '}
                        {openedAt.toLocaleString('ru-RU', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                        })}
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        <button onClick={() => handleSubmit('booking')}
                            disabled={isSubmitting || !!rentalConflict}
                            className="px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-colors">
                            {t('booking')}
                        </button>
                        {/* «В долг» — только когда в кассу не внесено ничего. Внёс
                            часть — это уже не долг целиком, и кнопка ушла бы мимо смысла. */}
                        {collected === 0 && totalPrice > 0 && (
                            <button type="button" onClick={() => handleSubmit('active')}
                                disabled={isSubmitting || !!rentalConflict}
                                className="px-4 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-sm transition-colors text-xs flex items-center gap-1 whitespace-nowrap">
                                <Wallet size={14}/> {t('inDebt')}
                            </button>
                        )}
                        <button type="button" onClick={() => handleSubmit('active')}
                            disabled={isSubmitting || !!rentalConflict}
                            className="px-10 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-opacity flex items-center gap-2"
                            style={{ background: 'linear-gradient(135deg,#0f9688,#0d7a6e)', boxShadow: '0 4px 14px rgba(15,150,136,0.3)' }}>
                            {isSubmitting
                                ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full inline-block"/>
                                : <CheckCircle2 size={20}/>} {t('checkin').toUpperCase()}
                        </button>
                    </div>
                </div>
            </div>

            {/* Scan overlay (USB scanner) */}
            {scanMode === 'usb' && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-xl">
                    <div className="bg-white rounded-2xl p-8 shadow-2xl w-72 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{background:'#f0fdfa'}}>
                            <ScanLine size={32} className="text-teal-500 animate-pulse"/>
                        </div>
                        <h3 className="font-black text-slate-800 mb-1 text-base">{t('applyPassport')}</h3>
                        <p className="text-xs text-slate-400 mb-5">{t('scannerWaiting')}</p>
                        <div className="flex justify-center gap-1 mb-5">
                            {[0,1,2,3,4].map(i => (
                                <div key={i} className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-bounce" style={{animationDelay:`${i*100}ms`}}/>
                            ))}
                        </div>
                        <textarea
                            ref={scanInputRef}
                            onChange={handleScanInput}
                            className="opacity-0 absolute w-0 h-0 pointer-events-none"
                            autoFocus
                        />
                        <button onClick={() => { clearTimeout(scanTimerRef.current); setScanMode(false); }}
                            className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 px-5 py-2 rounded-lg transition-colors">
                            {t('cancel')}
                        </button>
                    </div>
                </div>
            )}

            {/* OCR loading overlay */}
            {ocrLoading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-xl">
                    <div className="bg-white rounded-2xl p-8 shadow-2xl w-72 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{background:'#fffbeb'}}>
                            <Camera size={32} className="text-amber-500 animate-pulse"/>
                        </div>
                        <h3 className="font-black text-slate-800 mb-1 text-base">{t('readingPassport')}</h3>
                        <p className="text-xs text-slate-400 mb-5">{t('recognizingMrz')}</p>
                        <div className="flex justify-center gap-1">
                            {[0,1,2,3,4].map(i => (
                                <div key={i} className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{animationDelay:`${i*100}ms`}}/>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
        </>
    );
};

export default CheckInModal;

