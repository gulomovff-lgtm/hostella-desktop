import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BedDouble, User, FileText, Phone, DollarSign, CreditCard, QrCode, Magnet, X, ChevronRight, CheckCircle2, Wallet, Minus, Plus, ChevronDown, RefreshCw, ScanLine, Camera } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { useExchangeRate } from '../../hooks/useExchangeRate';
import { COUNTRIES } from '../../constants/countries';

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
    const lower = parseInt(room.prices?.lower) || parseInt(room.price) || 0;
    const upper = parseInt(room.prices?.upper);
    if (!upper || upper === lower) return lower;
    const cap    = parseInt(room.capacity) || 1;
    const bedNum = parseInt(bedId);
    if (!bedNum) return lower;
    return bedNum > Math.ceil(cap / 2) ? upper : lower;
};

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

// --- Sub-components ---
const StepIndicator = ({ step, total }) => (
    <div className="flex gap-2 mb-6">
        {Array.from({ length: total }).map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${i + 1 <= step ? 'bg-blue-600' : 'bg-slate-200'}`}/>
        ))}
    </div>
);

const SimpleInput = ({ label, value, onChange, type = "text", placeholder, icon: Icon, rightElement, error }) => (
    <div className="space-y-1">
        {label && <label className={`text-xs font-bold uppercase ml-1 ${error ? 'text-rose-500' : 'text-slate-600'}`}>{label}{error && ' *'}</label>}
        <div className="relative group">
            {Icon && <div className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${error ? 'text-rose-400' : 'text-slate-400 group-focus-within:text-blue-600'}`}><Icon size={18}/></div>}
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={`w-full bg-white border rounded-lg py-2.5 ${Icon ? 'pl-10' : 'pl-3'} ${rightElement ? 'pr-10' : 'pr-3'} font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${error ? 'border-rose-400 ring-2 ring-rose-200 bg-rose-50 focus:ring-rose-300 focus:border-rose-500' : 'border-slate-300 focus:ring-blue-500/20 focus:border-blue-600'}`}
            />
            {rightElement && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</div>}
        </div>
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

// --- Main Component ---
const CheckInModal = ({ initialRoom, preSelectedBedId, initialDate, initialClient, allRooms = [], guests = [], clients = [], clientsDb = [], onClose, onSubmit, notify, lang, currentUser, checkInHour = 14, checkOutHour = 12 }) => {
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
        birthDate: initialClient?.birthDate || '',
        phone: initialClient?.phone || '',

        checkInDate: initialDate ? initialDate.split('T')[0] : new Date().toISOString().split('T')[0],
        days: 1,

        paidCash: '',
        paidCard: '',
        paidQR: '',
        passportPhoto: '',
        status: 'active'
    });

    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [errors, setErrors] = useState({});
    const [blacklistWarning, setBlacklistWarning] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currencyMode, setCurrencyMode] = useState('UZS'); // 'UZS' | 'USD'

    // --- Scan + Photo ---
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
        try {
            const { createWorker } = await import('tesseract.js');
            const worker = await createWorker('eng', 1, {
                logger: () => {},
                errorHandler: () => {},
            });
            await worker.setParameters({
                tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
                tessedit_pageseg_mode: '6',
            });
            const { data: { text } } = await worker.recognize(file);
            await worker.terminate();
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
            setOcrLoading(false);
        }
    };

    const { rates } = useExchangeRate();
    const usdRate = rates?.USD?.rate || 0;

    const totalPrice = (parseInt(formData.days) || 0) * (parseInt(formData.pricePerNight) || 0);
    const totalPaid = (parseInt(formData.paidCash) || 0) + (parseInt(formData.paidCard) || 0) + (parseInt(formData.paidQR) || 0);
    const balance = totalPrice - totalPaid;

    // Конвертация для USD-режима
    const toDisplay = (uzs) => currencyMode === 'USD' && usdRate > 0 ? (uzs / usdRate).toFixed(2) : String(uzs || '');
    const fromDisplay = (val) => {
        if (currencyMode === 'USD' && usdRate > 0) return String(Math.round((parseFloat(val) || 0) * usdRate));
        return val;
    };
    const displayTotal = currencyMode === 'USD' && usdRate > 0 ? `${(totalPrice / usdRate).toFixed(2)} USD` : `${totalPrice.toLocaleString()} сум`;
    const displayBalance = currencyMode === 'USD' && usdRate > 0 ? `${(balance / usdRate).toFixed(2)} USD` : `${balance.toLocaleString()} сум`;

    const availableBeds = useMemo(() => {
        if (!formData.roomId) return [];
        const room = allRooms.find(r => r.id === formData.roomId);
        if (!room) return [];
        const now = new Date();
        const occupiedIds = guests
            .filter(g => g.roomId === formData.roomId && g.status === 'active')
            .filter(g => { const out = new Date(g.checkOutDate); return !g.checkOutDate || now < out; })
            .map(g => String(g.bedId));
        return Array.from({ length: room.capacity || 0 }, (_, i) => ({
            id: String(i + 1),
            isOccupied: occupiedIds.includes(String(i + 1))
        }));
    }, [formData.roomId, guests, allRooms]);

    const handleChange = (field, value) => {
        const processed = (field === 'fullName' || field === 'passport') ? value.toUpperCase() : value;
        setFormData(prev => ({ ...prev, [field]: processed }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
        if (field === 'fullName') {
            if (processed.length > 1) {
                const term = processed.toLowerCase();
                const seen = new Set();
                const matches = clients.filter(c => {
                    if (seen.has(c.passport)) return false;
                    const hit = (c.fullName && c.fullName.toLowerCase().includes(term)) || (c.passport && c.passport.toLowerCase().includes(term));
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
        if (field !== 'paidCash') others += (parseInt(formData.paidCash) || 0);
        if (field !== 'paidCard') others += (parseInt(formData.paidCard) || 0);
        if (field !== 'paidQR')   others += (parseInt(formData.paidQR)   || 0);
        const remainder = Math.max(0, totalPrice - others);
        handleChange(field, String(remainder));
    };

    const handleSelectClient = (client) => {
        setFormData(prev => ({
            ...prev,
            fullName: client.fullName,
            passport: client.passport || '',
            passportIssueDate: client.passportIssueDate || '',
            phone: client.phone || '',
            birthDate: client.birthDate || '',
            country: client.country || 'Узбекистан'
        }));
        setShowSuggestions(false);
        // Check blacklist/warning in clients database
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

    const handleSubmit = async (status) => {
        if (isSubmitting) return;
        if (!formData.fullName || !formData.roomId || !formData.bedId) return notify(t('fillAllFields'), 'error');
        if (blacklistWarning?.level === 'blacklist') {
            if (!window.confirm(`⚠️ Гость в чёрном списке. Заселить всё равно?`)) return;
        }
        setIsSubmitting(true);
        try {
            const checkIn = new Date(formData.checkInDate);
            checkIn.setHours(checkInHour, 0, 0, 0);
            const checkOut = new Date(checkIn);
            checkOut.setDate(checkOut.getDate() + (parseInt(formData.days) || 1));
            checkOut.setHours(checkOutHour, 0, 0, 0);
            await onSubmit({
                ...formData,
                status,
                checkInDate: checkIn.toISOString(),
                checkOutDate: checkOut.toISOString(),
                totalPrice,
                amountPaid: totalPaid
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-800/50 backdrop-blur-none p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] relative">

                <div className="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">{t('checkin')}</h2>
                        <p className="text-slate-500 text-xs mt-0.5 font-medium">
                            {formData.roomNumber ? `Комната ${formData.roomNumber}` : 'Новое заселение'}
                            {formData.bedId && ` • Место ${formData.bedId}`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <X size={20}/>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50">
                    <StepIndicator step={step} total={3}/>

                    {/* Step 1: Choose room/bed */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right duration-200">
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase">Выбор места</h3>
                                <div className="mb-4">
                                    <SimpleSelect
                                        label="Комната"
                                        value={formData.roomId}
                                        onChange={handleRoomSelect}
                                        options={allRooms.map(r => {
                                            const lower = parseInt(r.prices?.lower) || parseInt(r.price) || 0;
                                            const upper = parseInt(r.prices?.upper);
                                            const priceStr = upper && upper !== lower
                                                ? `↓${lower.toLocaleString()} / ↑${upper.toLocaleString()} сум`
                                                : `${lower.toLocaleString()} сум`;
                                            return { value: r.id, label: `№${r.number} · ${r.capacity} мест · ${priceStr}` };
                                        })}
                                    />
                                </div>
                                {formData.roomId && (() => {
                                    const _room = allRooms.find(r => r.id === formData.roomId);
                                    if (!_room) return null;
                                    const _cap  = parseInt(_room.capacity) || 1;
                                    const _mid  = Math.ceil(_cap / 2);
                                    const _pLow = parseInt(_room.prices?.lower) || parseInt(_room.price) || 0;
                                    const _pUp  = parseInt(_room.prices?.upper);
                                    const _hasTiers = _pUp && _pUp !== _pLow && _cap > 1;
                                    const lowerBeds = availableBeds.filter(b => parseInt(b.id) <= _mid);
                                    const upperBeds = availableBeds.filter(b => parseInt(b.id) >  _mid);
                                    const BedBtn = ({ bed }) => (
                                        <button
                                            onClick={() => {
                                                if (!bed.isOccupied) {
                                                    const price = getRoomPrice(_room, bed.id);
                                                    setFormData(prev => ({ ...prev, bedId: bed.id, pricePerNight: price }));
                                                }
                                            }}
                                            disabled={bed.isOccupied}
                                            title={bed.isOccupied ? 'Занято' : `Место ${bed.id}`}
                                            className={`w-14 h-14 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-0.5 transition-all border-2
                                                ${formData.bedId === bed.id
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105'
                                                    : bed.isOccupied
                                                        ? 'bg-slate-100 text-slate-300 cursor-not-allowed border-slate-200'
                                                        : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600'
                                                }`}>
                                            <BedDouble size={15}/>
                                            <span>{bed.id}</span>
                                        </button>
                                    );
                                    return (
                                        <div className="space-y-3 mt-1">
                                            {upperBeds.length > 0 && (
                                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">↑ Верхний ярус</span>
                                                        {_hasTiers && (
                                                            <span className="text-[10px] font-bold text-violet-600 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-md">
                                                                {_pUp.toLocaleString()} сум/ночь
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
                                                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">↓ Нижний ярус</span>
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
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Guest data */}
                    {step === 2 && (
                        <div className="space-y-5 animate-in slide-in-from-right duration-200">
                            {/* Blacklist / Warning banner */}
                            {blacklistWarning && (
                                <div className={`rounded-xl p-3 flex items-start gap-2 text-sm font-semibold ${blacklistWarning.level === 'blacklist' ? 'bg-rose-50 border border-rose-300 text-rose-700' : 'bg-amber-50 border border-amber-300 text-amber-700'}`}>
                                    <span className="text-lg leading-none shrink-0">{blacklistWarning.level === 'blacklist' ? '🚫' : '⚠️'}</span>
                                    <div>
                                        <div className="font-black">{blacklistWarning.level === 'blacklist' ? 'ЧЁРНЫЙ СПИСОК' : 'ПРЕДУПРЕЖДЕНИЕ'}</div>
                                        <div className="text-xs font-medium mt-0.5">{blacklistWarning.name} — {blacklistWarning.level === 'blacklist' ? 'заселение запрещено. Подтвердите вручную.' : 'будьте осторожны с этим гостем.'}</div>
                                    </div>
                                    <button onClick={() => setBlacklistWarning(null)} className="ml-auto shrink-0 opacity-60 hover:opacity-100"><X size={14}/></button>
                                </div>
                            )}
                            {/* Scan + Photo buttons */}
                            <div className="flex gap-2 flex-wrap">
                                <button type="button"
                                    onClick={() => { setScanMode('usb'); setTimeout(() => scanInputRef.current?.focus(), 80); }}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg text-xs font-bold transition-colors">
                                    <ScanLine size={14}/> Скан (USB)
                                </button>
                                <button type="button"
                                    onClick={() => photoInputRef.current?.click()}
                                    disabled={ocrLoading}
                                    className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-bold transition-colors ${
                                        ocrLoading ? 'bg-amber-50 border-amber-200 text-amber-600 cursor-wait'
                                        : formData.passportPhoto ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'}`}>
                                    <Camera size={14}/>
                                    {ocrLoading ? 'Распознаю...' : formData.passportPhoto ? '✓ Сменить фото' : 'Фото → MRZ'}
                                </button>
                                <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange}/>
                            </div>
                            {formData.passportPhoto && (
                                <div className="relative inline-block">
                                    <img src={formData.passportPhoto} alt="Паспорт" className="h-20 rounded-xl border border-slate-200 object-cover shadow-sm"/>
                                    <button type="button" onClick={() => setFormData(p => ({ ...p, passportPhoto: '' }))}
                                        className="absolute -top-2 -right-2 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-500 hover:text-rose-500 shadow-sm">
                                        <X size={10}/>
                                    </button>
                                </div>
                            )}
                            <div className="relative z-50">
                                <SimpleInput
                                    label="ФИО Гостя" value={formData.fullName}
                                    onChange={val => handleChange('fullName', val)}
                                    placeholder="Начните вводить имя..." icon={User} error={errors.fullName}
                                />
                                {showSuggestions && suggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden z-50">
                                        {suggestions.map(c => (
                                            <button key={c.id} onClick={() => handleSelectClient(c)}
                                                className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-100 flex justify-between items-center group">
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">{c.fullName}</div>
                                                    <div className="text-xs text-slate-400">{c.passport} · {c.country}</div>
                                                </div>
                                                {COUNTRY_FLAGS[c.country] && <Flag code={COUNTRY_FLAGS[c.country]} size={20}/>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                                <SimpleInput label="Паспорт" value={formData.passport} onChange={val => handleChange('passport', val)} placeholder="AA 1234567" icon={FileText} error={errors.passport}/>
                                <SimpleInput label="Дата рождения" type="date" value={formData.birthDate} onChange={val => handleChange('birthDate', val)} error={errors.birthDate}/>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                                <SimpleInput label="Дата выдачи паспорта" type="date" value={formData.passportIssueDate} onChange={val => handleChange('passportIssueDate', val)}/>
                                <SimpleInput label="Телефон" value={formData.phone} onChange={val => handleChange('phone', val)} placeholder="+998..." icon={Phone}/>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-600 uppercase ml-1">Страна</label>
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

                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm mt-2">
                                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 border-b border-slate-100 pb-2">Условия проживания</h3>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 mb-4">
                                    <SimpleInput label="Дата заезда" type="date" value={formData.checkInDate} onChange={val => handleChange('checkInDate', val)}/>
                                    <SimpleInput label="Цена за ночь" type="number" value={formData.pricePerNight} onChange={val => handleChange('pricePerNight', val)}
                                        rightElement={<span className="text-xs font-bold text-slate-400">сум</span>} error={errors.pricePerNight}/>
                                </div>
                                <div className="relative">
                                    <SimpleInput label="Количество дней" type="number" value={formData.days} onChange={val => handleChange('days', val)}/>
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
                            {currentUser?.role === 'admin' && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                                    <p className="text-amber-700 font-bold text-sm">Оплата недоступна для администратора</p>
                                    <p className="text-amber-600 text-xs mt-1">Гость будет заселён без оплаты. Принять оплату может кассир.</p>
                                </div>
                            )}
                            {currentUser?.role !== 'admin' && (<>
                                <div className="bg-slate-800 rounded-xl p-6 text-white shadow-lg">
                                    <div className="flex justify-between items-end mb-4">
                                        <div className="opacity-70 text-sm font-medium uppercase">К оплате</div>
                                        <div className="text-3xl font-bold">{displayTotal}</div>
                                    </div>
                                    <div className="h-px bg-white/10 mb-4"/>
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold opacity-90">Остаток</span>
                                        <span className={`px-3 py-1 rounded-lg font-bold text-sm ${balance > 0 ? 'bg-white/20 text-white' : 'bg-emerald-500 text-white'}`}>
                                            {balance > 0 ? displayBalance : 'Оплачено'}
                                        </span>
                                    </div>
                                </div>
                                {/* Currency toggle */}
                                {usdRate > 0 && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-400 uppercase">Валюта ввода:</span>
                                        {[['UZS', 'СУМ'], ['USD', 'USD']].map(([mode, label]) => (
                                            <button key={mode}
                                                onClick={() => setCurrencyMode(mode)}
                                                className={`px-3 py-1 rounded-lg text-xs font-black transition-colors ${
                                                    currencyMode === mode
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                }`}>
                                                {label}
                                            </button>
                                        ))}
                                        {currencyMode === 'USD' && (
                                            <span className="text-xs text-slate-400 ml-1">Курс: {Math.round(usdRate).toLocaleString()} сум</span>
                                        )}
                                    </div>
                                )}
                                <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-4">
                                    <SimpleInput label={`Наличные${currencyMode === 'USD' ? ' (USD)' : ''}`} type="number"
                                        value={currencyMode === 'USD' && usdRate > 0 ? String((parseInt(formData.paidCash)||0) > 0 ? ((parseInt(formData.paidCash)||0)/usdRate).toFixed(2) : '') : formData.paidCash}
                                        onChange={val => handleChange('paidCash', fromDisplay(val))} icon={DollarSign}
                                        rightElement={<button onClick={() => handleMagnet('paidCash')} className="p-1 text-blue-500 hover:bg-blue-50 rounded" tabIndex="-1"><Magnet size={18}/></button>}/>
                                    {currencyMode === 'USD' && formData.paidCash && <p className="-mt-3 ml-1 text-[10px] text-slate-400">≈ {parseInt(formData.paidCash).toLocaleString()} сум</p>}
                                    <SimpleInput label={`Карта${currencyMode === 'USD' ? ' (USD)' : ''}`} type="number"
                                        value={currencyMode === 'USD' && usdRate > 0 ? String((parseInt(formData.paidCard)||0) > 0 ? ((parseInt(formData.paidCard)||0)/usdRate).toFixed(2) : '') : formData.paidCard}
                                        onChange={val => handleChange('paidCard', fromDisplay(val))} icon={CreditCard}
                                        rightElement={<button onClick={() => handleMagnet('paidCard')} className="p-1 text-blue-500 hover:bg-blue-50 rounded" tabIndex="-1"><Magnet size={18}/></button>}/>
                                    {currencyMode === 'USD' && formData.paidCard && <p className="-mt-3 ml-1 text-[10px] text-slate-400">≈ {parseInt(formData.paidCard).toLocaleString()} сум</p>}
                                    <SimpleInput label={`QR / Перевод${currencyMode === 'USD' ? ' (USD)' : ''}`} type="number"
                                        value={currencyMode === 'USD' && usdRate > 0 ? String((parseInt(formData.paidQR)||0) > 0 ? ((parseInt(formData.paidQR)||0)/usdRate).toFixed(2) : '') : formData.paidQR}
                                        onChange={val => handleChange('paidQR', fromDisplay(val))} icon={QrCode}
                                        rightElement={<button onClick={() => handleMagnet('paidQR')} className="p-1 text-blue-500 hover:bg-blue-50 rounded" tabIndex="-1"><Magnet size={18}/></button>}/>
                                    {currencyMode === 'USD' && formData.paidQR && <p className="-mt-3 ml-1 text-[10px] text-slate-400">≈ {parseInt(formData.paidQR).toLocaleString()} сум</p>}
                                </div>
                            </>)}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-200 bg-white shrink-0 flex items-center gap-3">
                    {step === 2 && (
                        <button onClick={() => handleSubmit('booking')}
                            disabled={isSubmitting}
                            className="mr-auto px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-colors flex items-center gap-2 shadow-sm">
                            Бронь
                        </button>
                    )}
                    {step !== 2 && <div className="mr-auto"/>}

                    {step > initialStep && (
                        <button onClick={() => setStep(step - 1)} className="px-5 py-2.5 rounded-lg text-slate-600 hover:bg-slate-100 font-bold transition-colors">
                            Назад
                        </button>
                    )}
                    {step < 3 ? (
                        <button onClick={() => {
                            if (step === 1 && !formData.bedId) return notify("Выберите место!", 'error');
                            if (step === 2) {
                                const errs = {};
                                if (!formData.fullName.trim()) errs.fullName = 'Обязательное поле';
                                if (!formData.passport.trim()) errs.passport = 'Обязательное поле';
                                if (!formData.birthDate) errs.birthDate = 'Обязательное поле';
                                if (!(parseInt(formData.pricePerNight) > 0)) errs.pricePerNight = 'Укажите цену';
                                if (Object.keys(errs).length > 0) { setErrors(errs); return; }
                                setErrors({});
                            }
                            setStep(step + 1);
                        }} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2">
                            Далее <ChevronRight size={18}/>
                        </button>
                    ) : (
                        <>
                            <button onClick={() => handleSubmit('active')}
                                disabled={isSubmitting}
                                className="px-10 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2">
                                {isSubmitting ? <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full inline-block"/> : <CheckCircle2 size={20}/>} ЗАСЕЛИТЬ
                            </button>
                            {totalPaid === 0 && totalPrice > 0 && (
                                <button onClick={() => handleSubmit('active')}
                                    disabled={isSubmitting}
                                    className="ml-1 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-sm transition-colors text-xs flex items-center gap-1 whitespace-nowrap">
                                    <Wallet size={14}/> В долг
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
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{background:'#eff6ff'}}>
                            <ScanLine size={32} className="text-blue-500 animate-pulse"/>
                        </div>
                        <h3 className="font-black text-slate-800 mb-1 text-base">Приложите паспорт</h3>
                        <p className="text-xs text-slate-400 mb-5">Ожидаем данные от сканера...</p>
                        <div className="flex justify-center gap-1 mb-5">
                            {[0,1,2,3,4].map(i => (
                                <div key={i} className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:`${i*100}ms`}}/>
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
                            Отмена
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
                        <h3 className="font-black text-slate-800 mb-1 text-base">Читаю паспорт...</h3>
                        <p className="text-xs text-slate-400 mb-5">Распознаю текст MRZ из фото</p>
                        <div className="flex justify-center gap-1">
                            {[0,1,2,3,4].map(i => (
                                <div key={i} className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{animationDelay:`${i*100}ms`}}/>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CheckInModal;
