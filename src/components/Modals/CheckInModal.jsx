import React, { useState, useMemo, useEffect } from 'react';
import { BedDouble, User, FileText, Phone, DollarSign, CreditCard, QrCode, Magnet, X, ChevronRight, CheckCircle2, Wallet, Minus, Plus, ChevronDown, RefreshCw } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { useExchangeRate } from '../../hooks/useExchangeRate';

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
const CheckInModal = ({ initialRoom, preSelectedBedId, initialDate, initialClient, allRooms = [], guests = [], clients = [], onClose, onSubmit, notify, lang, currentUser }) => {
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
        status: 'active'
    });

    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [errors, setErrors] = useState({});
    const [currencyMode, setCurrencyMode] = useState('UZS'); // 'UZS' | 'USD'

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
    };

    const handleRoomSelect = (roomId) => {
        const room = allRooms.find(r => r.id === roomId);
        if (room) {
            const price = getRoomPrice(room, '');
            setFormData(prev => ({ ...prev, roomId: room.id, roomNumber: room.number, pricePerNight: price, bedId: '' }));
        }
    };

    const handleSubmit = (status) => {
        if (!formData.fullName || !formData.roomId || !formData.bedId) return notify(t('fillAllFields'), 'error');
        const checkIn = new Date(formData.checkInDate);
        checkIn.setHours(14, 0, 0, 0);
        const checkOut = new Date(checkIn);
        checkOut.setDate(checkOut.getDate() + (parseInt(formData.days) || 1));
        checkOut.setHours(12, 0, 0, 0);
        onSubmit({
            ...formData,
            status,
            checkInDate: checkIn.toISOString(),
            checkOutDate: checkOut.toISOString(),
            totalPrice,
            amountPaid: totalPaid
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-800/50 backdrop-blur-none p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">

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

                            <div className="grid grid-cols-2 gap-4">
                                <SimpleInput label="Паспорт" value={formData.passport} onChange={val => handleChange('passport', val)} placeholder="AA 1234567" icon={FileText} error={errors.passport}/>
                                <SimpleInput label="Дата рождения" type="date" value={formData.birthDate} onChange={val => handleChange('birthDate', val)} error={errors.birthDate}/>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <SimpleInput label="Дата выдачи паспорта" type="date" value={formData.passportIssueDate} onChange={val => handleChange('passportIssueDate', val)}/>
                                <SimpleInput label="Телефон" value={formData.phone} onChange={val => handleChange('phone', val)} placeholder="+998..." icon={Phone}/>
                            </div>

                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm mt-2">
                                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 border-b border-slate-100 pb-2">Условия проживания</h3>
                                <div className="grid grid-cols-2 gap-4 mb-4">
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
                            className="mr-auto px-5 py-2.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-white font-bold transition-colors flex items-center gap-2 shadow-sm">
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
                                className="px-10 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2">
                                <CheckCircle2 size={20}/> ЗАСЕЛИТЬ
                            </button>
                            {totalPaid === 0 && totalPrice > 0 && (
                                <button onClick={() => handleSubmit('active')}
                                    className="ml-1 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-bold shadow-sm transition-colors text-xs flex items-center gap-1 whitespace-nowrap">
                                    <Wallet size={14}/> В долг
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CheckInModal;
