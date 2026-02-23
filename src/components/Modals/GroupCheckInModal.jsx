import React, { useState, useMemo, useEffect } from 'react';
import { X, Users, Plus, Trash2, DollarSign, CreditCard, QrCode, Magnet } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

// price helper (mirrors CheckInModal)
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

const EMPTY_GUEST = {
    fullName: '',
    passport: '',
    country: 'Узбекистан',
    bedId: '',
    paidCash: '',
    paidCard: '',
    paidQR: '',
};

const inputClass = "w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium text-slate-800 transition-all";

// ─── Main ─────────────────────────────────────────────────────────────────────
const GroupCheckInModal = ({ allRooms = [], guests = [], onClose, onSubmitOne, notify, lang, currentUser }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;

    const today = new Date().toISOString().split('T')[0];

    const [selectedRoomId, setSelectedRoomId] = useState(allRooms[0]?.id || '');
    const [checkInDate, setCheckInDate]         = useState(today);
    const [days, setDays]                       = useState(1);
    const [commonPrice, setCommonPrice]         = useState(''); // единая цена для всех
    const [guestList, setGuestList]             = useState([{ ...EMPTY_GUEST, id: Date.now() }]);
    const [submitting, setSubmitting]           = useState(false);

    const room = allRooms.find(r => r.id === selectedRoomId);

    // ESC to close
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const freeBeds = useMemo(() => {
        if (!room) return [];
        const now = new Date();
        const occupied = new Set(
            guests
                .filter(g => g.roomId === selectedRoomId && g.status === 'active')
                .filter(g => !g.checkOutDate || now < new Date(g.checkOutDate))
                .map(g => String(g.bedId))
        );
        // Also count beds already staged in guestList
        const staged = new Set(guestList.filter(g => g.bedId).map(g => String(g.bedId)));
        return Array.from({ length: room.capacity || 0 }, (_, i) => {
            const id = String(i + 1);
            return { id, occupied: occupied.has(id), staged: staged.has(id) };
        });
    }, [room, guests, selectedRoomId, guestList]);

    const addGuest = () => {
        if (guestList.length >= (room?.capacity || 1)) {
            notify?.('Нет свободных мест', 'error');
            return;
        }
        setGuestList(prev => [...prev, { ...EMPTY_GUEST, id: Date.now() }]);
    };

    const removeGuest = (id) => {
        setGuestList(prev => prev.filter(g => g.id !== id));
    };

    const updateGuest = (id, field, value) => {
        setGuestList(prev => prev.map(g => {
            if (g.id !== id) return g;
            const processed = (field === 'fullName' || field === 'passport') ? value.toUpperCase() : value;
            // When bed changes, auto-fill price
            if (field === 'bedId') {
                return { ...g, bedId: value };
            }
            return { ...g, [field]: processed };
        }));
    };

    // если задана единая цена – используем её, иначе ценовой тариф
    const priceForGuest = (g) => { const m = parseInt(commonPrice); return m > 0 ? m : getRoomPrice(room, g.bedId); };
    const totalForGuest = (g) => priceForGuest(g) * (parseInt(days) || 1);
    const paidForGuest  = (g) => (parseInt(g.paidCash) || 0) + (parseInt(g.paidCard) || 0) + (parseInt(g.paidQR) || 0);

    const applyMagnet = (guestId, field) => {
        const g = guestList.find(x => x.id === guestId);
        if (!g) return;
        const total  = totalForGuest(g);
        const others = (field !== 'paidCash' ? (parseInt(g.paidCash) || 0) : 0)
                     + (field !== 'paidCard' ? (parseInt(g.paidCard) || 0) : 0)
                     + (field !== 'paidQR'   ? (parseInt(g.paidQR)   || 0) : 0);
        updateGuest(guestId, field, String(Math.max(0, total - others)));
    };

    const handleSubmit = async () => {
        const invalid = guestList.find(g => !g.fullName.trim() || !g.bedId);
        if (invalid) {
            notify?.('Заполните ФИО и выберите место для каждого гостя', 'error');
            return;
        }
        // Check duplicate beds
        const beds = guestList.map(g => g.bedId);
        if (new Set(beds).size !== beds.length) {
            notify?.('Два гостя не могут занимать одно место', 'error');
            return;
        }
        setSubmitting(true);
        try {
            for (const g of guestList) {
                const checkIn = new Date(checkInDate);
                checkIn.setHours(14, 0, 0, 0);
                const checkOut = new Date(checkIn);
                checkOut.setDate(checkOut.getDate() + (parseInt(days) || 1));
                checkOut.setHours(12, 0, 0, 0);
                const price  = priceForGuest(g);
                const total  = price * (parseInt(days) || 1);
                const paid   = paidForGuest(g);
                await onSubmitOne({
                    roomId:     room.id,
                    roomNumber: room.number,
                    bedId:      g.bedId,
                    fullName:   g.fullName,
                    passport:   g.passport,
                    country:    g.country,
                    phone:      '',
                    birthDate:  '',
                    passportIssueDate: '',
                    checkInDate:  checkIn.toISOString(),
                    checkOutDate: checkOut.toISOString(),
                    days,
                    pricePerNight: price,
                    totalPrice: total,
                    amountPaid: paid,
                    paidCash: parseInt(g.paidCash) || 0,
                    paidCard: parseInt(g.paidCard) || 0,
                    paidQR:   parseInt(g.paidQR)   || 0,
                    status: 'active',
                });
            }
            notify?.(`Заселено ${guestList.length} гостей`, 'success');
            onClose();
        } catch (e) {
            notify?.('Ошибка: ' + e.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const canSubmit = !submitting && guestList.every(g => g.fullName.trim() && g.bedId);
    const grandTotal = guestList.reduce((s, g) => s + totalForGuest(g), 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center"><Users size={18} className="text-white"/></div>
                        <div>
                            <div className="font-black text-white text-base">Групповое заселение</div>
                            <div className="text-indigo-200 text-xs">{guestList.length} гостей • {grandTotal > 0 ? grandTotal.toLocaleString() + ' сум' : 'итого'}</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors">
                        <X size={16}/>
                    </button>
                </div>

                {/* Common settings */}
                <div className="px-6 pt-5 pb-4 border-b border-slate-100 bg-slate-50 shrink-0">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1.5 block">Комната</label>
                            <select className={inputClass} value={selectedRoomId} onChange={e => setSelectedRoomId(e.target.value)}>
                                {allRooms.map(r => <option key={r.id} value={r.id}>№{r.number} — {r.capacity} мест</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1.5 block">Дата заезда</label>
                            <input type="date" className={inputClass} value={checkInDate} onChange={e => setCheckInDate(e.target.value)}/>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1.5 block">Дней</label>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setDays(d => Math.max(1, d - 1))} className="w-8 h-9 bg-slate-200 hover:bg-slate-300 rounded-lg font-bold text-slate-600 flex items-center justify-center text-sm">−</button>
                                <input type="number" className={`${inputClass} text-center`} value={days} onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 1))}/>
                                <button onClick={() => setDays(d => d + 1)} className="w-8 h-9 bg-slate-200 hover:bg-slate-300 rounded-lg font-bold text-slate-600 flex items-center justify-center text-sm">+</button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1.5 block">Цена/ночь для всех</label>
                            <div className="relative">
                                <input type="number" className={`${inputClass} pr-12`}
                                    placeholder={room ? String(parseInt(room.price) || 0) : '0'}
                                    value={commonPrice}
                                    onChange={e => setCommonPrice(e.target.value)}/>
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">сум</span>
                            </div>
                        </div>
                    </div>
                    {/* Free beds map */}
                    {room && (
                        <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-400">Места:</span>
                            {freeBeds.map(b => (
                                <span key={b.id} className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${
                                    b.occupied ? 'bg-rose-100 text-rose-500 border-rose-200' :
                                    b.staged   ? 'bg-indigo-100 text-indigo-600 border-indigo-200' :
                                    'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                    {b.id} {b.occupied ? '🔒' : b.staged ? '✎' : '✓'}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Guest list */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {guestList.map((g, idx) => {
                        const price  = priceForGuest(g);
                        const total  = price * (parseInt(days) || 1);
                        const paid   = paidForGuest(g);
                        const debt   = Math.max(0, total - paid);
                        const hostelId = currentUser?.hostelId;
                        const canPay = currentUser?.role !== 'admin'
                            && !(hostelId === 'hostel1' && currentUser?.permissions?.canPayInHostel1 === false)
                            && !(hostelId === 'hostel2' && currentUser?.permissions?.canPayInHostel2 === false);
                        return (
                            <div key={g.id} className="bg-white rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-black">{idx + 1}</div>
                                        <span className="text-sm font-bold text-slate-700">{g.fullName || `Гость ${idx + 1}`}</span>
                                        {g.bedId && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">Место {g.bedId}</span>}
                                        {total > 0 && <span className="text-xs text-slate-400 font-semibold">{total.toLocaleString()} сум</span>}
                                        {debt > 0 && <span className="text-xs text-rose-600 font-bold">долг: {debt.toLocaleString()}</span>}
                                    </div>
                                    {guestList.length > 1 && (
                                        <button onClick={() => removeGuest(g.id)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={15}/></button>
                                    )}
                                </div>
                                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {/* Место */}
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Место *</label>
                                        <select className={inputClass} value={g.bedId}
                                            onChange={e => updateGuest(g.id, 'bedId', e.target.value)}>
                                            <option value="">— выбрать —</option>
                                            {freeBeds.filter(b => !b.occupied && (!b.staged || b.id === g.bedId)).map(b => (
                                                <option key={b.id} value={b.id}>Место {b.id}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {/* ФИО */}
                                    <div className="md:col-span-2">
                                        <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">ФИО *</label>
                                        <input className={inputClass} placeholder="ИВАНОВ ИВАН ИВАНОВИЧ" value={g.fullName}
                                            onChange={e => updateGuest(g.id, 'fullName', e.target.value)}/>
                                    </div>
                                    {/* Страна */}
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Страна</label>
                                        <input className={inputClass} placeholder="Узбекистан" value={g.country}
                                            onChange={e => updateGuest(g.id, 'country', e.target.value)}/>
                                    </div>
                                    {/* Паспорт */}
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">Паспорт</label>
                                        <input className={inputClass} placeholder="AB1234567" value={g.passport}
                                            onChange={e => updateGuest(g.id, 'passport', e.target.value)}/>
                                    </div>
                                    {/* Оплата */}
                                    {canPay && (
                                        <>
                                            {[['paidCash', DollarSign, 'Нал.'], ['paidCard', CreditCard, 'Карта'], ['paidQR', QrCode, 'QR']].map(([field, Icon, lbl]) => (
                                                <div key={field}>
                                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">{lbl}</label>
                                                    <div className="relative">
                                                        <Icon size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                                                        <input type="number" className={`${inputClass} pl-7 pr-7`} value={g[field]}
                                                            onChange={e => updateGuest(g.id, field, e.target.value)}/>
                                                        <button onClick={() => applyMagnet(g.id, field)}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-600">
                                                            <Magnet size={12}/>
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-white shrink-0 flex items-center justify-between gap-3">
                    <button onClick={addGuest} disabled={guestList.length >= (room?.capacity || 1)}
                        className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-indigo-300 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors disabled:opacity-40">
                        <Plus size={16}/>
                        Добавить гостя
                    </button>
                    <div className="flex items-center gap-3">                        {grandTotal > 0 && (
                            <span className="text-sm font-bold text-slate-600 hidden md:block">Итого: {grandTotal.toLocaleString()} сум</span>
                        )}                        <button onClick={onClose} className="px-4 py-2.5 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors text-sm">
                            Отмена
                        </button>
                        <button onClick={handleSubmit} disabled={!canSubmit}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow transition-colors disabled:opacity-50 text-sm">
                            <Users size={16}/>
                            {submitting ? 'Заселение...' : `Заселить ${guestList.length} гостей`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GroupCheckInModal;
