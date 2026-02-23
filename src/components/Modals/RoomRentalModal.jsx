import React, { useState, useMemo, useEffect } from 'react';
import { X, Building2, BedDouble, DollarSign, CreditCard, QrCode, Magnet, User, Calendar } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

const inputClass = "w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-sm font-medium text-slate-800 transition-all";
const labelClass = "text-xs font-bold uppercase text-slate-500 mb-1.5 block tracking-wide";

const RoomRentalModal = ({ allRooms = [], guests = [], onClose, onSubmitOne, notify, lang, currentUser }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;

    const today = new Date().toISOString().split('T')[0];

    const [roomId,      setRoomId      ] = useState(allRooms[0]?.id || '');
    const [checkInDate, setCheckInDate ] = useState(today);
    const [days,        setDays        ] = useState(1);
    const [fullName,    setFullName    ] = useState('');
    const [passport,    setPassport    ] = useState('');
    const [phone,       setPhone       ] = useState('');
    const [country,     setCountry     ] = useState('Узбекистан');
    const [comment,     setComment     ] = useState('');
    const [paidCash,    setPaidCash    ] = useState('');
    const [paidCard,    setPaidCard    ] = useState('');
    const [paidQR,      setPaidQR      ] = useState('');
    const [manualPrice, setManualPrice ] = useState(''); // ручная цена за место/ночь
    const [submitting,  setSubmitting  ] = useState(false);

    const room = allRooms.find(r => r.id === roomId);
    const roomPrice = parseInt(room?.price) || 0;
    const capacity  = parseInt(room?.capacity) || 0;

    // ESC to close
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    // Free beds count
    const freeBeds = useMemo(() => {
        if (!room) return [];
        const now = new Date();
        const occupied = new Set(
            guests
                .filter(g => g.roomId === roomId && g.status === 'active')
                .filter(g => !g.checkOutDate || now < new Date(g.checkOutDate))
                .map(g => String(g.bedId))
        );
        return Array.from({ length: capacity }, (_, i) => {
            const id = String(i + 1);
            return { id, occupied: occupied.has(id) };
        });
    }, [room, guests, roomId, capacity]);

    const freeCount       = freeBeds.filter(b => !b.occupied).length;
    const pricePerBed     = (parseInt(manualPrice) > 0 ? parseInt(manualPrice) : parseInt(room?.price)) || 0;
    const totalPriceAll   = pricePerBed * capacity * (parseInt(days) || 1);
    const totalPaid       = (parseInt(paidCash) || 0) + (parseInt(paidCard) || 0) + (parseInt(paidQR) || 0);

    const applyMagnet = (field) => {
        const others = (field !== 'paidCash' ? (parseInt(paidCash) || 0) : 0)
                     + (field !== 'paidCard' ? (parseInt(paidCard) || 0) : 0)
                     + (field !== 'paidQR'   ? (parseInt(paidQR)   || 0) : 0);
        const rem = Math.max(0, totalPriceAll - others);
        if (field === 'paidCash') setPaidCash(String(rem));
        if (field === 'paidCard') setPaidCard(String(rem));
        if (field === 'paidQR')   setPaidQR(String(rem));
    };

    const handleSubmit = async () => {
        if (!fullName.trim()) { notify?.('Введите ФИО', 'error'); return; }
        if (freeCount !== capacity) {
            notify?.(`В комнате ${capacity - freeCount} занятых мест. Сначала выселите гостей.`, 'error');
            return;
        }
        setSubmitting(true);
        try {
            const checkIn = new Date(checkInDate);
            checkIn.setHours(14, 0, 0, 0);
            const checkOut = new Date(checkIn);
            checkOut.setDate(checkOut.getDate() + (parseInt(days) || 1));
            checkOut.setHours(12, 0, 0, 0);

            const perBedPaid = totalPaid > 0 ? Math.floor(totalPaid / capacity) : 0;
            const perBedCash = parseInt(paidCash) > 0 ? Math.floor(parseInt(paidCash) / capacity) : 0;
            const perBedCard = parseInt(paidCard) > 0 ? Math.floor(parseInt(paidCard) / capacity) : 0;
            const perBedQR   = parseInt(paidQR)   > 0 ? Math.floor(parseInt(paidQR)   / capacity) : 0;

            const allFree = freeBeds.filter(b => !b.occupied);
            for (const bed of allFree) {
                await onSubmitOne({
                    roomId:    room.id,
                    roomNumber: room.number,
                    bedId:     bed.id,
                    fullName:  fullName.toUpperCase(),
                    passport,
                    phone,
                    country,
                    birthDate: '',
                    passportIssueDate: '',
                    checkInDate:  checkIn.toISOString(),
                    checkOutDate: checkOut.toISOString(),
                    days,
                    pricePerNight: pricePerBed,
                    totalPrice:    pricePerBed * (parseInt(days) || 1),
                    amountPaid:    perBedPaid,
                    paidCash:      perBedCash,
                    paidCard:      perBedCard,
                    paidQR:        perBedQR,
                    status:        'active',
                    comment:       comment ? `[АРЕНДА КОМНАТЫ] ${comment}` : '[АРЕНДА КОМНАТЫ]',
                });
            }
            notify?.(`Комната №${room.number} сдана (${capacity} мест)`, 'success');
            onClose();
        } catch (e) {
            notify?.('Ошибка: ' + e.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const guestHostelId = currentUser?.hostelId;
    const canPay = currentUser?.role !== 'admin'
        && !(guestHostelId === 'hostel1' && currentUser?.permissions?.canPayInHostel1 === false)
        && !(guestHostelId === 'hostel2' && currentUser?.permissions?.canPayInHostel2 === false);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-teal-600 to-emerald-600 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center"><Building2 size={18} className="text-white"/></div>
                        <div>
                            <div className="font-black text-white text-base">Сдать комнату целиком</div>
                            <div className="text-teal-100 text-xs">Все места одному клиенту</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full text-white">
                        <X size={16}/>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {/* Room + dates */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className={labelClass}>Комната</label>
                            <select className={inputClass} value={roomId} onChange={e => setRoomId(e.target.value)}>
                                {allRooms.map(r => <option key={r.id} value={r.id}>№{r.number} — {r.capacity} мест</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Заезд</label>
                            <input type="date" className={inputClass} value={checkInDate} onChange={e => setCheckInDate(e.target.value)}/>
                        </div>
                        <div>
                            <label className={labelClass}>Дней</label>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setDays(d => Math.max(1, d - 1))} className="w-8 h-10 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-600 text-sm">−</button>
                                <input type="number" className={`${inputClass} text-center`} value={days} onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 1))}/>
                                <button onClick={() => setDays(d => d + 1)} className="w-8 h-10 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold text-slate-600 text-sm">+</button>
                            </div>
                        </div>
                    </div>

                    {/* Ручная цена */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelClass}>Цена за место/ночь (не обязательно)</label>
                            <div className="relative">
                                <input type="number" className={`${inputClass} pr-14`}
                                    placeholder={String(parseInt(room?.price) || 0)}
                                    value={manualPrice}
                                    onChange={e => setManualPrice(e.target.value)}/>
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">сум</span>
                            </div>
                        </div>
                        {pricePerBed > 0 && (
                            <div className="flex items-end pb-0.5">
                                <span className="text-xs text-slate-500">
                                    {pricePerBed.toLocaleString()} × {capacity} мест × {days} дн. = <strong className="text-teal-700">{totalPriceAll.toLocaleString()} сум</strong>
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Status panel */}
                    {room && (
                        <div className={`rounded-xl p-4 border-2 ${freeCount === capacity ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-sm">Комната №{room.number}</span>
                                <span className={`text-xs font-black px-2 py-1 rounded-full ${freeCount === capacity ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'}`}>
                                    {freeCount}/{capacity} свободно
                                </span>
                            </div>
                            <div className="flex gap-1.5 flex-wrap">
                                {freeBeds.map(b => (
                                    <div key={b.id} className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${b.occupied ? 'bg-rose-200 text-rose-700' : 'bg-emerald-200 text-emerald-800'}`}>
                                        {b.id}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-3 flex items-center justify-between text-sm font-bold text-slate-700">
                                <span>Итого за все места × {days} дн.</span>
                                <span className="text-teal-700 text-lg">{totalPriceAll.toLocaleString()} сум</span>
                            </div>
                            {freeCount !== capacity && (
                                <div className="mt-2 text-amber-700 text-xs font-semibold">
                                    ⚠ {capacity - freeCount} мест занято. Аренда доступна только когда все места свободны.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Guest info */}
                    <div className="space-y-3">
                        <div>
                            <label className={labelClass}>ФИО клиента *</label>
                            <div className="relative">
                                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input className={`${inputClass} pl-8`} placeholder="ИВАНОВ ИВАН ИВАНОВИЧ"
                                    value={fullName} onChange={e => setFullName(e.target.value.toUpperCase())}/>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelClass}>Паспорт</label>
                                <input className={inputClass} placeholder="AB1234567" value={passport} onChange={e => setPassport(e.target.value.toUpperCase())}/>
                            </div>
                            <div>
                                <label className={labelClass}>Телефон</label>
                                <input className={inputClass} placeholder="+998 90 000-00-00" value={phone} onChange={e => setPhone(e.target.value)}/>
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Комментарий</label>
                            <input className={inputClass} placeholder="Корпоратив, мероприятие..." value={comment} onChange={e => setComment(e.target.value)}/>
                        </div>
                    </div>

                    {/* Payment */}
                    {canPay && (
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold uppercase text-slate-500">Оплата</span>
                                <span className={`text-xs font-bold ${totalPaid >= totalPriceAll ? 'text-emerald-600' : 'text-rose-500'}`}>
                                    {totalPaid >= totalPriceAll ? '✓ Оплачено' : `Остаток: ${(totalPriceAll - totalPaid).toLocaleString()}`}
                                </span>
                            </div>
                            {[['paidCash', setPaidCash, paidCash, DollarSign, 'Нал.'],
                              ['paidCard', setPaidCard, paidCard, CreditCard, 'Карта'],
                              ['paidQR',   setPaidQR,   paidQR,   QrCode,     'QR']].map(([field, setter, val, Icon, lbl]) => (
                                <div key={field} className="relative">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1 block">{lbl}</label>
                                    <div className="relative">
                                        <Icon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                        <input type="number" className={`${inputClass} pl-8 pr-8`} value={val} onChange={e => setter(e.target.value)}/>
                                        <button onClick={() => applyMagnet(field)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-teal-400 hover:text-teal-600">
                                            <Magnet size={14}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-white shrink-0 flex items-center justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2.5 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors text-sm">Отмена</button>
                    <button onClick={handleSubmit} disabled={!fullName.trim() || submitting || freeCount !== capacity}
                        className="flex items-center gap-2 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-black shadow transition-colors disabled:opacity-50 text-sm">
                        <Building2 size={16}/>
                        {submitting ? 'Оформление...' : `Сдать комнату №${room?.number || ''}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RoomRentalModal;
