import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BedDouble, User, FileText, Phone, DollarSign, CreditCard, QrCode, Magnet, X, ChevronRight, CheckCircle2, Wallet, Minus, Plus, ChevronDown, RefreshCw, ScanLine, Camera, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { useExchangeRate } from '../../hooks/useExchangeRate';
import { COUNTRIES, COUNTRY_FLAGS } from '../../constants/countries';
import { Flag, fmtSum, parseSum } from '../../utils/helpers';
import { minNightPrice, packageNightPrice, packageMinDays, configuredNightPrice } from '../../utils/pricing';
import DatePicker from '../UI/DatePicker';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../../firebase';

// --- Helpers ---
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
const StepIndicator = ({ step, total }) => (
    <div className="flex gap-2 mb-5">
        {Array.from({ length: total }).map((_, i) => (
            <div key={i} className="h-1.5 rounded-full flex-1 transition-all duration-300" style={{ background: i + 1 <= step ? '#0f9688' : '#e2e8f0' }}/>
        ))}
    </div>
);

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
const DateField = ({ label, value, onChange, error, placeholder }) => (
    <div className="space-y-1">
        {label && <label className={`text-xs font-bold uppercase ml-1 ${error ? 'text-rose-500' : 'text-slate-600'}`}>{label}{error && ' *'}</label>}
        <DatePicker
            value={value}
            onChange={onChange}
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
    const initialStep = (initialRoom && preSelectedBedId) ? 2 : 1;
    const [step, setStep] = useState(initialStep);

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

    // Подтягиваем баланс клиента при каждом изменении паспорта (включая initialClient, скан, ручной ввод)
    useEffect(() => {
        const passport = formData.passport?.replace(/\s/g, '').toUpperCase();
        if (!passport || passport.length < 5) { setClientBalance(0); return; }
        const found = clientsDb.find(c => c.passport && c.passport.replace(/\s/g, '').toUpperCase() === passport);
        const bal = found?.balance || 0;
        setClientBalance(bal);
        // Сбрасываем ранее применённый баланс если клиент изменился
        setFormData(p => ({ ...p, paidBalance: 0 }));
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
                notify('\u2705 Паспорт считан', 'success');
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
                notify('\u2705 Данные из фото извлечены', 'success');
            } else {
                notify('\u{1F4F7} Фото сохранено', 'success');
            }
        } catch (err) {
            console.warn('OCR error:', err);
            notify('\u{1F4F7} Фото сохранено', 'success');
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
    const balance = effectiveTotal - totalPaid;

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
    const displayTotal = currencyMode === 'USD' && effectiveRate > 0 ? `${(totalPrice / effectiveRate).toFixed(2)} USD` : `${totalPrice.toLocaleString()} сум`;
    const displayBalance = currencyMode === 'USD' && effectiveRate > 0 ? `${(balance / effectiveRate).toFixed(2)} USD` : `${balance.toLocaleString()} сум`;

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
        if (price <= 0) { notify('Укажите желаемую цену', 'error'); return; }
        if (!formData.fullName.trim()) { notify('Сначала укажите ФИО гостя', 'error'); return; }
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
        if (!formData.fullName || !formData.roomId || !formData.bedId) {
            notify(t('fillAllFields'), 'error');
            return;
        }
        // Бронь с сайта/бота приходит без паспорта. При ФАКТИЧЕСКОМ заселении (гость
        // пришёл) паспортные данные обязательны — просим дополнить.
        if (status === 'active' && isFromBooking) {
            const pass = (formData.passport || '').replace(/\s/g, '');
            if (pass.length < 5 || !formData.birthDate) {
                setStep(2);
                setErrors(e => ({ ...e,
                    passport: pass.length < 5 ? 'Дополните паспорт гостя' : '',
                    birthDate: !formData.birthDate ? 'Укажите дату рождения' : '' }));
                notify('Гость пришёл по брони — дополните паспортные данные (паспорт и дату рождения)', 'error');
                return;
            }
        }
        // Правила тарифов (финальный контроль)
        if (formData.tariff === 'package') {
            if ((parseInt(formData.days) || 0) < PACKAGE_MIN_DAYS) {
                notify(`Пакетный тариф: минимум ${PACKAGE_MIN_DAYS} дней`, 'error');
                return;
            }
        } else if ((parseInt(formData.pricePerNight) || 0) < MIN_NIGHT_PRICE && !priceApproved) {
            notify(`Цена ниже ${MIN_NIGHT_PRICE.toLocaleString()} — нужно одобрение администратора`, 'error');
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
            notify('Укажите корректную дату заезда', 'error');
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
            notify('Ошибка заселения: ' + (e?.message || e), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
        <style>{MODAL_STYLE}</style>
        <div className="ci-backdrop modal-centered fixed inset-0 z-[200] flex items-center justify-center p-4 pb-[84px] sm:pb-4" style={{ background: 'rgba(15,30,32,0.7)' }}>
            <div className="ci-card w-full max-w-2xl overflow-hidden flex flex-col relative" style={{ borderRadius: 24, boxShadow: '0 32px 80px rgba(0,0,0,0.35)', maxHeight: '95vh', background: '#fff' }}>

                <div style={{ background: '#1a3c40', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: -40, right: 60, width: 130, height: 130, borderRadius: '50%', background: 'rgba(94,234,212,0.06)', pointerEvents: 'none' }}/>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(94,234,212,0.12)', border: '1px solid rgba(94,234,212,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <BedDouble size={18} color="#5eead4"/>
                        </div>
                        <div>
                            <div style={{ color: 'rgba(158,205,208,0.55)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>{t('checkin')}</div>
                            <div style={{ color: '#e2f7f8', fontSize: 14, fontWeight: 700, lineHeight: 1.3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span>{formData.roomNumber ? `${t('room')} ${formData.roomNumber}` : t('newCheckin')}</span>
                                {formData.bedId && (
                                    isExtraBed(formData.bedId) ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', background: 'rgba(251,146,60,0.25)', borderRadius: 6 }}>
                                            <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" style={{ flexShrink: 0 }} aria-hidden="true"><circle cx="5" cy="6" r="2.8"/><rect x="2" y="11" width="20" height="4" rx="2"/></svg>
                                            <span style={{ fontSize: 12 }}>Доп. гость</span>
                                        </span>
                                    ) : (
                                        <span style={{ opacity: 0.7, fontSize: 12 }}>· {t('bed2')} {formData.bedId}</span>
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.15)', borderRadius: 8, padding: 8, cursor: 'pointer', color: '#5eead4', display: 'flex' }}>
                        <X size={16}/>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6 bg-white">
                    <StepIndicator step={step} total={3}/>

                    {/* Step 1: Choose room/bed */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right duration-200">
                            <div className="bg-white p-4 rounded-xl border" style={{ borderColor: 'rgba(15,150,136,0.18)' }}>
                                <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase">{t('bedSelection')}</h3>
                                <div className="mb-4">
                                    <SimpleSelect
                                        label={t('room')}
                                        value={formData.roomId}
                                        onChange={handleRoomSelect}
                                        options={allRooms.map(r => {
                                            const cfg = configuredNightPrice(r.hostelId, r.number);
                                            let priceStr;
                                            if (cfg != null) {
                                                priceStr = `${cfg.toLocaleString()} сум`;
                                            } else {
                                                const lower = parseInt(r.prices?.lower) || parseInt(r.price) || 0;
                                                const upper = parseInt(r.prices?.upper);
                                                priceStr = upper && upper !== lower
                                                    ? `↓${lower.toLocaleString()} / ↑${upper.toLocaleString()} сум`
                                                    : `${lower.toLocaleString()} сум`;
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
                                            bed.isOccupied ? `Занято: ${bed.occupantName}${bed.occupantDebt > 0 ? ` · долг ${bed.occupantDebt.toLocaleString()} сум` : ''}` :
                                            hasExpired ? `⏰ Срок вышел: ${bed.expiredName} (выезд был ${new Date(bed.expiredSince).toLocaleDateString('ru')})${bed.expiredDebt > 0 ? ` · НЕ ОПЛАТИЛ ${bed.expiredDebt.toLocaleString()} сум` : ''} — сначала выселите/проверьте` :
                                            bed.maxFreeDays != null ? `Свободно ${bed.maxFreeDays} дн. — потом ${bed.nextGuestName}` :
                                            `Место ${bed.id}`;
                                        return (
                                        <button
                                            onClick={() => {
                                                if (!bed.isOccupied) {
                                                    const price = getRoomPrice(_room, bed.id);
                                                    setFormData(prev => ({ ...prev, bedId: bed.id, pricePerNight: price }));
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
                                                <span className="absolute -top-1.5 -right-1.5 text-[10px] leading-none" title="Есть долг">💰</span>
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
                                                <span className="text-[8px] font-black leading-none">{bed.maxFreeDays}дн</span>
                                            )}
                                        </button>
                                        );
                                    };
                                    return (
                                        <div className="space-y-3 mt-1">
                                            {upperBeds.length > 0 && (
                                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">↑ {t('upperTier')}</span>
                                                        {_hasTiers && (
                                                            <span className="text-[10px] font-bold text-violet-600 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-md">
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
                                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">↓ {t('lowerTier')}</span>
                                                        {_hasTiers && (
                                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                                                                {_pLow.toLocaleString()} сум/ночь
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {lowerBeds.map(bed => <BedBtn key={bed.id} bed={bed}/>)}
                                                    </div>
                                                </div>
                                            )}
                                            {canSelectExtraBed && (
                                                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                                                    <div className="flex items-center gap-1.5 text-[11px] font-black text-orange-700 uppercase tracking-wider mb-2">
                                                        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true"><circle cx="5" cy="6" r="2.8"/><rect x="2" y="11" width="20" height="4" rx="2"/></svg>
                                                        Доп. гость
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const price = getRoomPrice(_room, '');
                                                            setFormData(prev => ({ ...prev, bedId: EXTRA_BED_ID, pricePerNight: price }));
                                                        }}
                                                        className={`w-full rounded-xl border-2 px-3 py-2 text-left transition-all ${
                                                            isExtraBed(formData.bedId)
                                                                ? 'bg-orange-500 text-white border-orange-500 shadow-md'
                                                                : 'bg-white text-orange-700 border-orange-300 hover:bg-orange-100 hover:border-orange-400'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-1.5 font-bold text-sm">
                                                            <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15" aria-hidden="true"><circle cx="5" cy="6" r="2.8"/><rect x="2" y="11" width="20" height="4" rx="2"/></svg>
                                                            На полу
                                                        </div>
                                                        <div className={`text-xs mt-0.5 ${isExtraBed(formData.bedId) ? 'text-orange-100' : 'text-orange-600'}`}>
                                                            {t('extraBedHint') || 'Временное размещение без свободной койки'}
                                                        </div>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                            {/* Просроченный жилец на выбранной койке — крупное предупреждение */}
                            {(() => {
                                const sel = availableBeds.find(b => b.id === formData.bedId);
                                if (!sel || sel.isOccupied || !sel.expiredName) return null;
                                return (
                                    <div className="mt-3 p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2">
                                        <span className="text-rose-500 text-lg shrink-0">⏰</span>
                                        <div>
                                            <div className="font-black text-rose-700 text-sm">На этом месте — гость с истёкшим сроком</div>
                                            <div className="text-xs text-rose-600 mt-0.5">
                                                <b>{sel.expiredName}</b> — выезд был {new Date(sel.expiredSince).toLocaleDateString('ru')}, но он ещё не выселен
                                                {sel.expiredDebt > 0 && <> и <b>не оплатил {sel.expiredDebt.toLocaleString()} сум</b></>}.
                                                Сначала разберитесь с ним (выселите/продлите), иначе будет два гостя на одной койке.
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                            {/* Conflict warning after bed selection */}
                            {bedConflict && (
                                <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2">
                                    <span className="text-amber-500 text-lg shrink-0">⚠️</span>
                                    <div>
                                        <div className="font-black text-amber-700 text-sm">{t('conflictBannerTitle')}</div>
                                        <div className="text-xs text-amber-600 mt-0.5">
                                            {t('conflictInDays')} <b>{bedConflict.maxDays} {t('daysShort')}</b> {t('conflictArrivesOnBed')} <b>{bedConflict.guestName}</b>.
                                            {t('conflictReduceDaysTo')} <b>{bedConflict.maxDays}</b>.
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Guest data */}
                    {step === 2 && (
                        <div className="space-y-5 animate-in slide-in-from-right duration-200">
                            {/* Заселение из брони: паспорт нужно дополнить */}
                            {isFromBooking && (formData.passport || '').replace(/\s/g, '').length < 5 && (
                                <div className="rounded-xl p-3 flex items-start gap-2 text-sm font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700">
                                    <span className="text-lg leading-none shrink-0">🌐</span>
                                    <div>Бронь с сайта — паспортных данных ещё нет. Для заселения <b>дополните паспорт и дату рождения</b> (телефон уже сохранён).</div>
                                </div>
                            )}
                            {/* Blacklist / Warning banner */}
                            {blacklistWarning && (
                                <div className={`rounded-xl p-3 flex items-start gap-2 text-sm font-semibold ${blacklistWarning.level === 'blacklist' ? 'bg-rose-50 border border-rose-300 text-rose-700' : 'bg-amber-50 border border-amber-300 text-amber-700'}`}>
                                    <span className="text-lg leading-none shrink-0">{blacklistWarning.level === 'blacklist' ? '🚫' : '⚠️'}</span>
                                    <div>
                                        <div className="font-black">{blacklistWarning.level === 'blacklist' ? t('blacklistLabel') : t('warningLabel')}</div>
                                        <div className="text-xs font-medium mt-0.5">{blacklistWarning.name} — {blacklistWarning.level === 'blacklist' ? t('blacklistDesc') : t('warningGuestDesc')}</div>
                                    </div>
                                    <button onClick={() => setBlacklistWarning(null)} className="ml-auto shrink-0 opacity-60 hover:opacity-100"><X size={14}/></button>
                                </div>
                            )}
                            {/* Scan + Photo buttons */}
                            <div className="flex gap-2 flex-wrap">
                                <button type="button"
                                    onClick={() => { setScanMode('usb'); setTimeout(() => scanInputRef.current?.focus(), 80); }}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 rounded-lg text-xs font-bold transition-colors">
                                    <ScanLine size={14}/> {t('scanUsb')}
                                </button>
                                <button type="button"
                                    onClick={() => photoInputRef.current?.click()}
                                    disabled={ocrLoading}
                                    className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-bold transition-colors ${
                                        ocrLoading ? 'bg-amber-50 border-amber-200 text-amber-600 cursor-wait'
                                        : formData.passportPhoto ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'}`}>
                                    <Camera size={14}/>
                                    {ocrLoading ? t('recognizing') : formData.passportPhoto ? `✓ ${t('changePhoto')}` : t('photoMrz')}
                                </button>
                                <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange}/>
                            </div>
                            {formData.passportPhoto && (
                                <div className="relative inline-block">
                                    <img src={formData.passportPhoto} alt={t('passport')} className="h-20 rounded-xl border border-slate-200 object-cover shadow-sm"/>
                                    <button type="button" onClick={() => setFormData(p => ({ ...p, passportPhoto: '' }))}
                                        className="absolute -top-2 -right-2 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:text-rose-500 shadow-sm">
                                        <X size={10}/>
                                    </button>
                                </div>
                            )}
                            <div className="relative z-50">
                                <div className="flex items-center justify-between mb-0.5">
                                    <label className="text-xs font-bold uppercase ml-1 text-slate-600">{t('guestName')}</label>
                                    {/[а-яёА-ЯЁ]/.test(formData.fullName) && (
                                        <button
                                            type="button"
                                            onClick={() => handleChange('fullName', cyrToLat(formData.fullName))}
                                            className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-lg transition-colors"
                                            style={{ color: '#0f9688', background: 'rgba(15,150,136,0.08)', border: '1px solid rgba(15,150,136,0.2)' }}
                                            title="Перевести в латиницу">
                                            АБВ → ABC
                                        </button>
                                    )}
                                </div>
                                <SimpleInput
                                    value={formData.fullName}
                                    onChange={val => handleChange('fullName', val)}
                                    placeholder={t('startTypingName')} icon={User} error={errors.fullName}
                                />
                                {showSuggestions && suggestions.length > 0 && (() => {
                                    const dark = document.documentElement.dataset.theme === 'dark';
                                    return (
                                    <div className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-xl overflow-hidden z-50 border"
                                        style={{ background: dark ? '#1e293b' : '#ffffff', borderColor: dark ? '#334155' : '#e2e8f0' }}>
                                        {suggestions.map((c, idx) => (
                                            <button key={c.id} onClick={() => handleSelectClient(c)}
                                                className="w-full text-left px-4 py-3 flex justify-between items-center border-b outline-none"
                                                style={{ borderColor: dark ? '#334155' : '#f1f5f9' }}
                                                onMouseEnter={e => { if (idx !== 0) e.currentTarget.style.background = dark ? '#263045' : '#eff6ff'; }}
                                                onMouseLeave={e => { if (idx !== 0) e.currentTarget.style.background = 'transparent'; }}
                                                onFocus={e =>    { if (idx !== 0) e.currentTarget.style.background = dark ? '#263045' : '#eff6ff'; }}
                                                onBlur={e =>     { if (idx !== 0) e.currentTarget.style.background = 'transparent'; }}
                                                ref={el => { if (el) el.style.background = idx === 0 ? '#2563eb' : 'transparent'; }}>
                                                <div>
                                                    <div className="font-bold text-sm" style={{ color: idx === 0 ? '#ffffff' : (dark ? '#e2e8f0' : '#1e293b') }}>{c.fullName}</div>
                                                    <div className="text-xs" style={{ color: idx === 0 ? '#bfdbfe' : (dark ? '#64748b' : '#94a3b8') }}>{c.passport} · {c.country}</div>
                                                </div>
                                                {COUNTRY_FLAGS[c.country] && <Flag code={COUNTRY_FLAGS[c.country]} size={20}/>}
                                            </button>
                                        ))}
                                    </div>
                                    );
                                })()}
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                                <SimpleInput label={t('passport')} value={formData.passport} onChange={val => handleChange('passport', val)} placeholder="AA 1234567" icon={FileText} error={errors.passport}/>
                                <DateField label={t('birthDate')} value={formData.birthDate} onChange={val => handleChange('birthDate', val)} error={errors.birthDate}/>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                                {formData.country && formData.country !== 'Узбекистан' && (
                                    <DateField label={t('passportIssueDateLabel')} value={formData.passportIssueDate} onChange={val => handleChange('passportIssueDate', val)} error={errors.passportIssueDate}/>
                                )}
                                <SimpleInput label={t('phone')} value={formData.phone} onChange={val => handleChange('phone', val)} placeholder="+998..." icon={Phone}/>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600 uppercase ml-1">{t('country')}</label>
                                <div className="relative">
                                    <select
                                        value={formData.country}
                                        onChange={e => handleChange('country', e.target.value)}
                                        className="w-full bg-white border border-slate-300 rounded-lg py-2.5 pl-3 pr-8 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm appearance-none cursor-pointer">
                                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                        <ChevronDown size={16}/>
                                    </div>
                                </div>
                            </div>

                            {formData.country && formData.country !== 'Узбекистан' && (
                                <DateField
                                    label="Дата прохода КПП"
                                    value={formData.kppDate}
                                    onChange={val => handleChange('kppDate', val)}
                                    error={errors.kppDate}
                                />
                            )}

                            <div className="bg-white p-4 rounded-xl border mt-2" style={{ borderColor: 'rgba(15,150,136,0.18)' }}>
                                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 border-b border-slate-100 pb-2">{t('stayConditions')}</h3>

                                {/* Тариф */}
                                <label className="text-xs font-bold uppercase ml-1 text-slate-600 block mb-1">Тариф</label>
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    <button type="button" onClick={() => selectTariff('standard')}
                                        className={`py-2.5 rounded-xl border text-sm font-bold transition-colors ${formData.tariff === 'standard' ? 'bg-teal-600 text-white border-teal-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                                        Обычный
                                    </button>
                                    <button type="button" onClick={() => selectTariff('package')}
                                        className={`py-2.5 rounded-xl border text-sm font-bold transition-colors flex flex-col items-center leading-tight ${formData.tariff === 'package' ? 'bg-orange-500 text-white border-orange-500 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                                        <span>Пакет · {PACKAGE_PRICE.toLocaleString()}</span>
                                        <span className="text-[10px] font-semibold opacity-80">от {PACKAGE_MIN_DAYS} дн. · невозвратный</span>
                                    </button>
                                </div>
                                {formData.tariff === 'package' && (
                                    <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-300 rounded-xl mb-3">
                                        <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-amber-700 font-semibold leading-snug">
                                            Пакетный тариф <b>невозвратный</b>. Минимум {PACKAGE_MIN_DAYS} дней. При выселении пакет <b>сгорает полностью</b> — возврат не предусмотрен.
                                        </p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 mb-4">
                                    <DateField label={t('checkIn')} value={formData.checkInDate} onChange={val => handleChange('checkInDate', val)}/>
                                    {formData.tariff === 'package' ? (
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold uppercase ml-1 text-slate-600 block">{t('price')}</label>
                                            <div className="w-full bg-orange-50 border border-orange-200 rounded-xl py-2.5 px-3 font-bold text-orange-700 flex items-center justify-between">
                                                <span>{PACKAGE_PRICE.toLocaleString()}</span>
                                                <span className="text-[10px] font-semibold text-orange-500">пакет · сум</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <SimpleInput label={`${t('price')} (от ${MIN_NIGHT_PRICE.toLocaleString()})`} type="number" formatNumber value={formData.pricePerNight} onChange={val => handleChange('pricePerNight', val)}
                                            rightElement={<span className="text-xs font-bold text-slate-400">сум</span>} error={errors.pricePerNight}/>
                                    )}
                                </div>

                                {/* Запрос на понижение цены (цена < 70 000, обычный тариф) */}
                                {formData.tariff === 'standard' && (parseInt(formData.pricePerNight)||0) > 0 && (parseInt(formData.pricePerNight)||0) < MIN_NIGHT_PRICE && (
                                    <div className="mb-4">
                                        {clientWhitelisted ? (
                                            <div className="flex items-start gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-300 rounded-xl">
                                                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5"/>
                                                <p className="text-xs text-emerald-700 font-semibold">Клиент в списке разрешённых на понижение — цену можно ставить ниже 70 000, запрос не нужен.</p>
                                            </div>
                                        ) : priceReqStatus === 'approved' ? (
                                            <div className="flex items-start gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-300 rounded-xl">
                                                <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5"/>
                                                <p className="text-xs text-emerald-700 font-semibold">Цена {priceReqApproved.toLocaleString()} сум одобрена администратором — можно заселять.</p>
                                            </div>
                                        ) : priceReqStatus === 'pending' ? (
                                            <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-300 rounded-xl">
                                                <span className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin shrink-0"/>
                                                <p className="text-xs text-amber-700 font-semibold">Ожидает одобрения в Telegram… Не закрывайте окно.</p>
                                            </div>
                                        ) : (
                                            <div className="px-3 py-2.5 bg-orange-50 border border-orange-300 rounded-xl space-y-2">
                                                <div className="flex items-start gap-2">
                                                    <AlertTriangle size={16} className="text-orange-500 shrink-0 mt-0.5"/>
                                                    <p className="text-xs text-orange-700 font-semibold leading-snug">
                                                        Цена ниже {MIN_NIGHT_PRICE.toLocaleString()} сум — нужно одобрение администратора.
                                                        {priceReqStatus === 'rejected' && <b className="block text-rose-600 mt-1">Предыдущий запрос отклонён.</b>}
                                                    </p>
                                                </div>
                                                <button type="button" onClick={requestPriceApproval} disabled={priceReqSending}
                                                    className="w-full py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold">
                                                    🔻 Запросить понижение цены ({(parseInt(formData.pricePerNight)||0).toLocaleString()})
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="relative">
                                    <SimpleInput label={`${t('quantityDays')}${formData.tariff === 'package' ? ` (от ${PACKAGE_MIN_DAYS})` : ''}`} type="number" value={formData.days} onChange={val => handleChange('days', val)} error={errors.days}/>
                                    <div className="absolute right-2 top-[26px] flex gap-1">
                                        <button onClick={() => handleChange('days', Math.max(1, (parseInt(formData.days)||1)-1))} className="p-1 bg-slate-100 rounded hover:bg-slate-200 text-slate-600"><Minus size={14}/></button>
                                        <button onClick={() => handleChange('days', (parseInt(formData.days)||1)+1)} className="p-1 bg-slate-100 rounded hover:bg-slate-200 text-slate-600"><Plus size={14}/></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Payment */}
                    {step === 3 && (
                        <div className="space-y-6 animate-in slide-in-from-right duration-200">
                            {/* Залог, внесённый по брони до заселения — перенесётся автоматически */}
                            {isFromBooking && !initialClient?.depositMoved && (Number(initialClient?.amountPaid) || 0) > 0 && (
                                <div className="border rounded-xl p-4 flex items-center justify-between" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                                    <div>
                                        <div className="text-sm font-black text-emerald-700">💰 Залог по брони</div>
                                        <div className="text-xs text-emerald-600 mt-0.5">Уже внесён и будет учтён автоматически — здесь вводите только доплату</div>
                                    </div>
                                    <span className="text-lg font-black text-emerald-700 shrink-0 ml-3">{Number(initialClient.amountPaid).toLocaleString()} сум</span>
                                </div>
                            )}
                            {currentUser?.role === 'admin' && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                                    <p className="text-amber-700 font-bold text-sm">{t('adminNoPayment')}</p>
                                    <p className="text-amber-600 text-xs mt-1">{t('adminNoPaymentSub')}</p>
                                </div>
                            )}
                            {/* Balance block — visible for all roles if client has balance */}
                            {clientBalance > 0 && (
                                <div className="border rounded-xl p-4" style={{ background: '#f0fdfa', borderColor: 'rgba(15,150,136,0.25)' }}>
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-sm font-black text-teal-700">💳 Баланс клиента</span>
                                        <span className="text-lg font-black text-teal-700">{clientBalance.toLocaleString()} сум</span>
                                    </div>
                                    {appliedBalance === 0 ? (
                                        <button
                                            onClick={() => setFormData(p => ({ ...p, paidBalance: Math.min(clientBalance, totalPrice), paidCash: '', paidCard: '', paidQR: '' }))}
                                            className="w-full py-2 text-white rounded-xl text-sm font-bold transition-opacity"
                                            style={{ background: 'linear-gradient(135deg,#0f9688,#0d7a6e)' }}
                                            onMouseEnter={e => e.currentTarget.style.opacity='0.9'}
                                            onMouseLeave={e => e.currentTarget.style.opacity='1'}
                                        >
                                            Применить к оплате
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 text-sm font-semibold text-blue-700">✅ Применено {appliedBalance.toLocaleString()} сум</div>
                                            <button
                                                onClick={() => setFormData(p => ({ ...p, paidBalance: 0 }))}
                                                className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
                                            >
                                                Отменить
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                            {currentUser?.role !== 'admin' && (<>
                                <div className="rounded-xl p-6 text-white shadow-lg" style={{ background: '#1a3c40', boxShadow: '0 8px 32px rgba(15,30,32,0.25)' }}>
                                    <div className="flex justify-between items-end mb-4">
                                        <div className="opacity-70 text-sm font-medium uppercase">{t('totalDue')}</div>
                                        <div className="text-3xl font-bold">{displayTotal}</div>
                                    </div>
                                    {appliedBalance > 0 && (
                                        <div className="flex justify-between items-center mb-2 text-emerald-300">
                                            <span className="text-sm opacity-90">💳 Баланс клиента</span>
                                            <span className="font-bold">−{appliedBalance.toLocaleString()} сум</span>
                                        </div>
                                    )}
                                    <div className="h-px bg-white/10 mb-4"/>
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold opacity-90">{t('remaining')}</span>
                                        <span className={`px-3 py-1 rounded-lg font-bold text-sm ${balance > 0 ? 'bg-white/20 text-white' : 'bg-emerald-500 text-white'}`}>
                                            {balance > 0 ? displayBalance : t('paid')}
                                        </span>
                                    </div>
                                </div>
                                {/* Currency toggle */}
                                <div className="flex items-center flex-wrap gap-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase">{t('currencyInput')}</span>
                                    {[['UZS', t('sumCurrency')], ['USD', 'USD']].map(([mode, label]) => (
                                        <button key={mode}
                                            onClick={() => handleModeSwitch(mode)}
                                            className={`px-3 py-1 rounded-lg text-xs font-black transition-colors ${
                                                currencyMode === mode
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}>
                                            {label}
                                        </button>
                                    ))}
                                    {currencyMode === 'USD' && (
                                        <div className="flex items-center gap-1 ml-1">
                                            <span className="text-xs text-slate-400">{t('exchangeRateLabel')}</span>
                                            <input
                                                type="number"
                                                value={manualRate}
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
                                                className="w-24 px-2 py-0.5 text-xs border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            {effectiveRate > 0 && parseInt(manualRate) > 0 && usdRate > 0 && (
                                                <button onClick={() => { setManualRate(''); handleModeSwitch('USD'); }} className="text-[10px] text-slate-400 hover:text-indigo-500 underline">авто</button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="bg-white p-4 rounded-xl border space-y-4" style={{ borderColor: 'rgba(15,150,136,0.18)' }}>
                                    <SimpleInput label={t('cash') + (currencyMode === 'USD' ? ' (USD)' : '')} type="number" formatNumber={currencyMode !== 'USD'}
                                        value={currencyMode === 'USD' ? usdInputs.paidCash : formData.paidCash}
                                        onChange={val => currencyMode === 'USD' ? handleUsdChange('paidCash', val) : handleChange('paidCash', val)} icon={DollarSign}
                                        rightElement={<button onClick={() => handleMagnet('paidCash')} className="p-1 text-teal-500 hover:bg-teal-50 rounded" tabIndex="-1"><Magnet size={18}/></button>}/>
                                    {currencyMode === 'USD' && formData.paidCash && <p className="-mt-3 ml-1 text-[10px] text-slate-400">≈ {parseInt(formData.paidCash).toLocaleString()} сум</p>}
                                    <SimpleInput label={t('card') + (currencyMode === 'USD' ? ' (USD)' : '')} type="number" formatNumber={currencyMode !== 'USD'}
                                        value={currencyMode === 'USD' ? usdInputs.paidCard : formData.paidCard}
                                        onChange={val => currencyMode === 'USD' ? handleUsdChange('paidCard', val) : handleChange('paidCard', val)} icon={CreditCard}
                                        rightElement={<button onClick={() => handleMagnet('paidCard')} className="p-1 text-teal-500 hover:bg-teal-50 rounded" tabIndex="-1"><Magnet size={18}/></button>}/>
                                    {currencyMode === 'USD' && formData.paidCard && <p className="-mt-3 ml-1 text-[10px] text-slate-400">≈ {parseInt(formData.paidCard).toLocaleString()} сум</p>}
                                    <SimpleInput label={t('qrTransfer') + (currencyMode === 'USD' ? ' (USD)' : '')} type="number" formatNumber={currencyMode !== 'USD'}
                                        value={currencyMode === 'USD' ? usdInputs.paidQR : formData.paidQR}
                                        onChange={val => currencyMode === 'USD' ? handleUsdChange('paidQR', val) : handleChange('paidQR', val)} icon={QrCode}
                                        rightElement={<button onClick={() => handleMagnet('paidQR')} className="p-1 text-teal-500 hover:bg-teal-50 rounded" tabIndex="-1"><Magnet size={18}/></button>}/>
                                    {currencyMode === 'USD' && formData.paidQR && <p className="-mt-3 ml-1 text-[10px] text-slate-400">≈ {parseInt(formData.paidQR).toLocaleString()} сум</p>}
                                    <SimpleInput label="Перечисление" type="number" formatNumber
                                        value={formData.paidTransfer}
                                        onChange={val => handleChange('paidTransfer', val)} icon={ArrowRightLeft}
                                        rightElement={<button onClick={() => handleMagnet('paidTransfer')} className="p-1 text-teal-500 hover:bg-teal-50 rounded" tabIndex="-1"><Magnet size={18}/></button>}/>
                                </div>
                            </>)}
                        </div>
                    )}
                </div>

                {/* ── Аренда конфликт ── */}
                {rentalConflict && (
                    <div className="mx-6 mb-4 rounded-2xl overflow-hidden border border-orange-300 shadow-lg">
                        <div className="bg-orange-500 px-4 py-3 flex items-center gap-2">
                            <span className="text-white text-lg">🏢</span>
                            <div>
                                <div className="text-white font-black text-sm">Комната арендована</div>
                                <div className="text-orange-100 text-xs">Заселение в эти даты невозможно</div>
                            </div>
                        </div>
                        <div className="bg-orange-50 px-4 py-3">
                            <p className="text-sm text-orange-800 font-semibold">
                                {rentalConflict.tenantName && <span>Арендатор: <b>{rentalConflict.tenantName}</b> · </span>}
                                Период аренды: <b>{rentalConflict.from}</b> — <b>{rentalConflict.to}</b>
                            </p>
                            <p className="text-xs text-orange-600 mt-1">Измените даты заезда/выезда или выберите другую комнату</p>
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
                                                {alt.price > 0 && <span className="text-emerald-500 font-medium">{alt.price.toLocaleString()} {lang === 'uz' ? "so'm" : 'сум'}</span>}
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

                <div className="px-6 py-4 shrink-0 flex items-center gap-3" style={{ borderTop: '1px solid #f1f5f9', background: '#fff' }}>
                    {step === 2 && (
                        <button onClick={() => handleSubmit('booking')}
                            disabled={isSubmitting || !!rentalConflict}
                            className="mr-auto px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-colors flex items-center gap-2 shadow-sm">
                            {t('booking')}
                        </button>
                    )}
                    {step !== 2 && <div className="mr-auto"/>}

                    {step > initialStep && (
                        <button onClick={() => setStep(step - 1)} className="px-5 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-bold transition-colors">
                            {t('back')}
                        </button>
                    )}
                    {step < 3 ? (
                        <button onClick={() => {
                            if (step === 1 && !formData.bedId) return notify(t('selectBedFirst'), 'error');
                            if (step === 2) {
                                const errs = {};
                                if (!formData.fullName.trim()) errs.fullName = t('fieldRequired');
                                if (!formData.passport.trim()) errs.passport = t('fieldRequired');
                                if (!formData.birthDate) errs.birthDate = t('fieldRequired');
                                if (formData.country && formData.country !== 'Узбекистан') {
                                    if (!formData.passportIssueDate) errs.passportIssueDate = t('fieldRequired');
                                    if (!formData.kppDate) errs.kppDate = t('fieldRequired');
                                }
                                if (formData.tariff === 'package') {
                                    if ((parseInt(formData.days) || 0) < PACKAGE_MIN_DAYS) errs.days = `Минимум ${PACKAGE_MIN_DAYS} дней`;
                                } else if ((parseInt(formData.pricePerNight) || 0) < MIN_NIGHT_PRICE && !priceApproved) {
                                    errs.pricePerNight = `Минимум ${MIN_NIGHT_PRICE.toLocaleString()} сум (или одобрение)`;
                                }
                                if (Object.keys(errs).length > 0) { setErrors(errs); return; }
                                setErrors({});
                            }
                            // При переходе на шаг оплаты — авто-применяем баланс (читаем актуальный clientBalance)
                            if (step === 2) {
                                const passport = formData.passport?.replace(/\s/g, '').toUpperCase();
                                const found = clientsDb.find(c => c.passport && c.passport.replace(/\s/g, '').toUpperCase() === passport);
                                const freshBal = found?.balance || 0;
                                setClientBalance(freshBal);
                                if (freshBal > 0) {
                                    setFormData(p => ({ ...p, paidBalance: freshBal, paidCash: '', paidCard: '', paidQR: '' }));
                                }
                            }
                            setStep(step + 1);
                        }} className="px-8 py-2.5 text-white rounded-xl font-bold transition-opacity flex items-center gap-2"
                            style={{ background: 'linear-gradient(135deg,#0f9688,#0d7a6e)', boxShadow: '0 4px 14px rgba(15,150,136,0.3)' }}
                            onMouseEnter={e => e.currentTarget.style.opacity='0.9'}
                            onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                            {t('next')} <ChevronRight size={18}/>
                        </button>
                    ) : (
                        <>
                            <button type="button" onClick={() => handleSubmit('active')}
                                disabled={isSubmitting || !!rentalConflict}
                                className="px-10 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-opacity flex items-center gap-2"
                                style={{ background: 'linear-gradient(135deg,#0f9688,#0d7a6e)', boxShadow: '0 4px 14px rgba(15,150,136,0.3)' }}
                                onMouseEnter={e => e.currentTarget.style.opacity='0.9'}
                                onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                                {isSubmitting ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full inline-block"/> : <CheckCircle2 size={20}/>} {t('checkin').toUpperCase()}
                            </button>
                            {totalPaid === 0 && totalPrice > 0 && (
                                <button type="button" onClick={() => handleSubmit('active')}
                                    disabled={isSubmitting || !!rentalConflict}
                                    className="ml-1 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-sm transition-colors text-xs flex items-center gap-1 whitespace-nowrap">
                                    <Wallet size={14}/> {t('inDebt')}
                                </button>
                            )}
                        </>
                    )}
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
