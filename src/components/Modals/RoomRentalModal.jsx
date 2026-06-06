import React, { useState, useMemo, useEffect } from 'react';
import {
    X, Building2, DollarSign, CreditCard, QrCode, Magnet,
    User, BedDouble, CheckCircle2, AlertTriangle,
    CalendarDays, RefreshCw, Receipt, Plus, Minus, ChevronRight, Clock, FileText, Link2,
} from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { fmtSum, parseSum } from '../../utils/helpers';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../../firebase';

const STYLE = `
@keyframes pos-in {
  from { opacity:0; transform:translateY(24px) scale(0.97); }
  to   { opacity:1; transform:translateY(0)    scale(1);    }
}
.pos-modal { animation: pos-in 0.2s cubic-bezier(0.22,1,0.36,1) both; }

.receipt-divider {
  border: none;
  border-top: 2px dashed #e2e8f0;
  margin: 0;
}
.pos-input {
  width:100%;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.pos-input:focus {
  border-color: #0f9688;
  box-shadow: 0 0 0 3px rgba(15,150,136,0.12);
}
.pos-label { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; }
`;

// --- POS Section header ---
const Section = ({ icon: Icon, title, right }) => (
    <div className="flex items-center justify-between py-2 pos-label text-slate-500">
        <span className="flex items-center gap-1.5">
            {Icon && <Icon size={11} />}
            {title}
        </span>
        {right && <span>{right}</span>}
    </div>
);

// --- Payment row ---
const PayRow = ({ icon: Icon, label, value, onChange, onMagnet, accent }) => (
    <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>
            <Icon size={13} className="text-white" />
        </div>
        <span className="w-12 text-[11px] font-bold text-slate-500 shrink-0">{label}</span>
        <div className="relative flex-1">
            <input type="text" inputMode="numeric" className="pos-input pr-9 text-right" placeholder="0"
                value={fmtSum(value)} onChange={e => onChange(parseSum(e.target.value))} />
            <button onClick={onMagnet} title="Заполнить остаток"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-teal-500 transition-colors">
                <Magnet size={13} />
            </button>
        </div>
        {parseInt(value) > 0 && (
            <span className="text-[11px] font-black text-teal-600 w-6 shrink-0">✓</span>
        )}
    </div>
);

// --- Main component ---
const RoomRentalModal = ({
    allRooms = [],
    guests   = [],
    onClose,
    onRent,
    onUpdate,
    mode         = 'new',
    initialRoom  = null,
    initialTab   = 'info',
    notify,
    lang         = 'ru',
    currentUser,
}) => {
    const t     = (k) => TRANSLATIONS[lang]?.[k] || k;
    const today = new Date().toISOString().split('T')[0];
    const isEdit = mode === 'edit';

    const existingRental = isEdit ? initialRoom?.rental : null;

    const availableRooms = useMemo(() =>
        isEdit
            ? [initialRoom]
            : allRooms.filter(r => !r.rental?.active),
    [allRooms, isEdit, initialRoom]);

    const defaultRoomId = isEdit
        ? (initialRoom?.id || '')
        : (availableRooms[0]?.id || '');

    const [roomId,      setRoomId     ] = useState(defaultRoomId);
    const [tab,         setTab        ] = useState(initialTab);
    const [checkInDate, setCheckInDate] = useState(
        existingRental?.checkInDate
            ? new Date(existingRental.checkInDate).toISOString().split('T')[0]
            : today
    );
    const [days,        setDays       ] = useState(existingRental?.days || 1);
    const [fullName,    setFullName   ] = useState(existingRental?.tenantName || '');
    const [passport,    setPassport   ] = useState(existingRental?.passport   || '');
    const [phone,       setPhone      ] = useState(existingRental?.phone      || '');
    const [comment,     setComment    ] = useState(existingRental?.comment    || '');
    const [manualPrice, setManualPrice] = useState(
        existingRental?.pricePerDay ? String(existingRental.pricePerDay) : ''
    );
    const [paidCash,      setPaidCash    ] = useState(existingRental?.paidCash   > 0 ? String(existingRental.paidCash)  : '');
    const [paidCard,      setPaidCard    ] = useState(existingRental?.paidCard   > 0 ? String(existingRental.paidCard)  : '');
    const [paidQR,        setPaidQR      ] = useState(existingRental?.paidQR     > 0 ? String(existingRental.paidQR)    : '');
    const [contractNote,      setContractNote     ] = useState(existingRental?.contractNote      || '');
    const [contractGroupId,   setContractGroupId  ] = useState(existingRental?.contractGroupId   || '');
    const [contractGroupName, setContractGroupName] = useState(existingRental?.contractGroupName || '');
    const [useContract,       setUseContract      ] = useState(!!(existingRental?.contractGroupId || existingRental?.contractNote));
    const [submitting,        setSubmitting        ] = useState(false);
    const [contractsList,     setContractsList     ] = useState([]);

    const canEditFull = currentUser?.role === 'admin' || currentUser?.role === 'super' || currentUser?.login === 'fazliddin';

    useEffect(() => {
        const hostelId = currentUser?.hostelId || '';
        const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';
        const colRef = collection(db, ...PUBLIC_DATA_PATH, 'manualStayGroups');
        const unsub = onSnapshot(colRef, (snap) => {
            setContractsList(
                snap.docs.map(d => ({ id: d.id, ...d.data() }))
                    .filter(g => isAdmin || !g.hostelId || g.hostelId === hostelId)
                    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
            );
        });
        return unsub;
    }, []);

    useEffect(() => {
        const h = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);

    const room = allRooms.find(r => r.id === roomId) || initialRoom;

    const activeGuestsCount = useMemo(() => {
        if (!room || isEdit) return 0;
        const now = new Date();
        return guests.filter(g =>
            g.roomId === roomId && g.status === 'active' &&
            (!g.checkOutDate || now < new Date(g.checkOutDate))
        ).length;
    }, [guests, roomId, room, isEdit]);

    const checkOutStr = useMemo(() => {
        try {
            const d = new Date(checkInDate + 'T14:00:00');
            d.setDate(d.getDate() + Math.max(1, parseInt(days) || 1));
            d.setHours(12, 0, 0, 0);
            return d.toISOString().split('T')[0];
        } catch { return ''; }
    }, [checkInDate, days]);

    const pricePerDay = parseInt(manualPrice) > 0 ? parseInt(manualPrice) : (parseInt(room?.price) || 0);
    const daysNum     = Math.max(1, parseInt(days) || 1);
    const totalAmount = pricePerDay * daysNum;
    const totalPaid   = (parseInt(paidCash) || 0) + (parseInt(paidCard) || 0) + (parseInt(paidQR) || 0);
    const debt        = Math.max(0, totalAmount - totalPaid);
    const canSubmit   = fullName.trim() && roomId && activeGuestsCount === 0;

    const applyMagnet = (field) => {
        const others = (field !== 'paidCash' ? (parseInt(paidCash) || 0) : 0)
                     + (field !== 'paidCard' ? (parseInt(paidCard) || 0) : 0)
                     + (field !== 'paidQR'   ? (parseInt(paidQR)   || 0) : 0);
        const rem = Math.max(0, totalAmount - others);
        if (field === 'paidCash') setPaidCash(String(rem));
        if (field === 'paidCard') setPaidCard(String(rem));
        if (field === 'paidQR')   setPaidQR(String(rem));
    };

    const buildRentalData = (extraCash = 0) => {
        const checkIn  = new Date(checkInDate + 'T14:00:00');
        const checkOut = new Date(checkOutStr  + 'T12:00:00');
        const rentalData = {
            active:       true,
            tenantName:   fullName.toUpperCase(),
            passport:     passport.toUpperCase(),
            phone,
            checkInDate:  checkIn.toISOString(),
            checkOutDate: checkOut.toISOString(),
            checkOutStr,
            days:         daysNum,
            pricePerDay,
            totalAmount,
            paidCash:     (parseInt(paidCash)  || 0) + (extraCash || 0),
            paidCard:     parseInt(paidCard)  || 0,
            paidQR:       parseInt(paidQR)    || 0,
            comment:           comment.trim(),
            contractNote:      contractNote.trim(),
            contractGroupId:   contractGroupId   || '',
            contractGroupName: contractGroupName || '',
            staffId:      currentUser?.id   || currentUser?.login || '',
            staffName:    currentUser?.name || currentUser?.login || '',
            createdAt:    existingRental?.createdAt || new Date().toISOString(),
        };

        if (isEdit) {
            rentalData.updatedAt = new Date().toISOString();
        }

        return rentalData;
    };

    // payMode: 'debt' (оставить долг) | 'paid' (дозаполнить остаток наличными → без долга)
    const handleSubmit = async (payMode = 'debt') => {
        if (!fullName.trim()) { notify?.('Введите ФИО арендатора', 'error'); return; }
        if (!isEdit && activeGuestsCount > 0) {
            notify?.(`В комнате ${activeGuestsCount} активных гостей — сначала выселите`, 'error');
            return;
        }
        setSubmitting(true);
        try {
            const extraCash = (!isEdit && payMode === 'paid' && debt > 0) ? debt : 0;
            const data = buildRentalData(extraCash);
            if (isEdit) {
                await onUpdate?.(roomId, data);
            } else {
                await onRent?.(roomId, data);
            }
        } catch (e) {
            notify?.('Ошибка: ' + e.message, 'error');
            setSubmitting(false);
        }
    };

    // Шаги мастера (для новой аренды)
    const STEP_ORDER = ['info', 'dates', 'pay'];
    const stepIdx = STEP_ORDER.indexOf(tab);
    const canNextFromInfo = fullName.trim() && roomId && activeGuestsCount === 0;

    const rentalHistory = (initialRoom?.rentalHistory || []).slice().reverse();
    const tabs = !isEdit
        ? [
            { id: 'info',  label: 'Арендатор', icon: User },
            { id: 'dates', label: 'Период',    icon: CalendarDays },
            { id: 'pay',   label: 'Оплата',    icon: Receipt },
        ]
        : canEditFull
        ? [
            { id: 'info',    label: 'Арендатор', icon: User },
            { id: 'dates',   label: 'Период',    icon: CalendarDays },
            { id: 'pay',     label: 'Оплата',    icon: Receipt },
            { id: 'history', label: 'История',   icon: Clock },
        ]
        : [
            { id: 'info',    label: 'Арендатор', icon: User },
            { id: 'history', label: 'История',   icon: Clock },
        ];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3">
            <style>{STYLE}</style>
            <div className="pos-modal w-full max-w-md flex flex-col max-h-[95vh] overflow-hidden rounded-2xl shadow-2xl"
                style={{ background: '#1a3c40' }}>

                {/* POS HEADER */}
                <div className="shrink-0 px-5 pt-5 pb-4 relative overflow-hidden">
                    {/* Декоративные круги */}
                    <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full pointer-events-none" style={{ background: 'rgba(94,234,212,0.06)' }}/>
                    <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full pointer-events-none" style={{ background: 'rgba(94,234,212,0.04)' }}/>
                    <div className="relative z-10 flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                style={{ background: 'linear-gradient(135deg,#0f9688,#0d7a6e)' }}>
                                <Receipt size={15} className="text-white" />
                            </div>
                            <div>
                                <div className="text-white font-black text-sm leading-tight">
                                    {isEdit ? 'Редактировать аренду' : 'Аренда комнаты'}
                                </div>
                                <div className="text-slate-500 text-[10px]">
                                    {isEdit
                                        ? `Комната №${room?.number} · ${existingRental?.tenantName || ''}`
                                        : 'Вся комната — один арендатор'
                                    }
                                </div>
                            </div>
                        </div>
                        <button onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-slate-400 hover:text-white transition-colors">
                            <X size={15} />
                        </button>
                    </div>

                    {/* LED display */}
                    <div className="relative z-10 rounded-xl px-4 py-3 flex items-end justify-between"
                        style={{ background: '#0e2428', border: '1px solid rgba(94,234,212,0.1)' }}>
                        <div>
                            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600 mb-0.5">
                                Итого к оплате
                            </div>
                            <div className="font-mono font-black leading-none" style={{
                                fontSize: '26px',
                                color: totalAmount > 0 ? '#5eead4' : '#374151',
                                textShadow: totalAmount > 0 ? '0 0 12px rgba(94,234,212,0.4)' : 'none',
                            }}>
                                {totalAmount > 0 ? totalAmount.toLocaleString() : '0'}
                                <span className="ml-1.5" style={{ color: 'rgba(94,234,212,0.45)', fontSize: '11px' }}>СУМ</span>
                            </div>
                            {pricePerDay > 0 && (
                                <div className="text-[10px] text-slate-600 mt-0.5 font-mono">
                                    {pricePerDay.toLocaleString()} × {daysNum} дн.
                                </div>
                            )}
                        </div>
                        <div className="text-right">
                            {debt > 0 && (
                                <div>
                                    <div className="text-[9px] font-bold uppercase tracking-widest text-slate-600">Долг</div>
                                    <div className="font-mono font-black text-rose-400 text-lg leading-tight">
                                        {debt.toLocaleString()}
                                    </div>
                                </div>
                            )}
                            {debt === 0 && totalPaid > 0 && (
                                <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                                    <CheckCircle2 size={14} /> Оплачено
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tab row */}
                    <div className="relative z-10 flex gap-1 mt-3">
                        {tabs.map(tb => (
                            <button key={tb.id}
                                onClick={() => setTab(tb.id)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all ${
                                    tab === tb.id
                                        ? 'text-white'
                                        : 'bg-white/6 text-slate-500 hover:text-slate-300 hover:bg-white/10'
                                }`}
                                style={tab === tb.id ? { background: '#0f9688' } : {}}>
                                <tb.icon size={11} />
                                {tb.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto bg-white">

                    {/* TAB: АРЕНДАТОР */}
                    {tab === 'info' && (
                        <div className="px-5 py-4 space-y-3">
                            {!isEdit && (
                                <>
                                    <Section icon={Building2} title="Комната" />
                                    <select className="pos-input" value={roomId} onChange={e => setRoomId(e.target.value)}
                                        disabled={availableRooms.length === 0}>
                                        {availableRooms.length === 0
                                            ? <option>Нет свободных комнат</option>
                                            : availableRooms.map(r => (
                                                <option key={r.id} value={r.id}>
                                                    №{r.number} · {r.capacity} мест{r.price ? ` · ${parseInt(r.price).toLocaleString()} сум/дн.` : ''}
                                                </option>
                                            ))
                                        }
                                    </select>
                                    {activeGuestsCount > 0 && (
                                        <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl">
                                            <AlertTriangle size={14} className="text-rose-500 shrink-0" />
                                            <p className="text-xs text-rose-600 font-semibold">
                                                {activeGuestsCount} гостей — сначала выселите
                                            </p>
                                        </div>
                                    )}
                                    <hr className="receipt-divider" />
                                </>
                            )}

                            <Section icon={User} title="Данные арендатора" />
                            <div>
                                <label className="pos-label text-slate-400 mb-1 block">ФИО *</label>
                                <input className="pos-input" placeholder="ИВАНОВ ИВАН ИВАНОВИЧ"
                                    value={fullName} onChange={e => setFullName(e.target.value.toUpperCase())} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="pos-label text-slate-400 mb-1 block">Паспорт</label>
                                    <input className="pos-input" placeholder="AA1234567"
                                        value={passport} onChange={e => setPassport(e.target.value.toUpperCase())} />
                                </div>
                                <div>
                                    <label className="pos-label text-slate-400 mb-1 block">Телефон</label>
                                    <input className="pos-input" placeholder="+998 90 000-00-00"
                                        value={phone} onChange={e => setPhone(e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="pos-label text-slate-400 mb-1 block">Комментарий</label>
                                <input className="pos-input" placeholder="Корпоратив, группа..."
                                    value={comment} onChange={e => setComment(e.target.value)} />
                            </div>
                            <hr className="receipt-divider" />
                            <label className="flex items-center justify-between gap-2 cursor-pointer select-none py-1">
                                <span className="flex items-center gap-1.5 pos-label text-slate-500">
                                    <Link2 size={11} /> Привязать к договору
                                </span>
                                <button type="button" role="switch" aria-checked={useContract}
                                    onClick={() => {
                                        const v = !useContract;
                                        setUseContract(v);
                                        if (!v) { setContractGroupId(''); setContractGroupName(''); setContractNote(''); }
                                    }}
                                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${useContract ? 'bg-teal-500' : 'bg-slate-300'}`}>
                                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${useContract ? 'left-[22px]' : 'left-0.5'}`} />
                                </button>
                            </label>
                            {useContract && (
                                <>
                                    <div>
                                        <label className="pos-label text-slate-400 mb-1 block">Договор</label>
                                        <select className="pos-input"
                                            value={contractGroupId}
                                            onChange={e => {
                                                const sel = contractsList.find(c => c.id === e.target.value);
                                                setContractGroupId(e.target.value);
                                                setContractGroupName(sel?.name || '');
                                            }}>
                                            <option value="">— Выберите договор —</option>
                                            {contractsList.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="pos-label text-slate-400 mb-1 block">Заметка по договору (опц.)</label>
                                        <input className="pos-input" placeholder="Доп. инфо, номер доп. соглашения..."
                                            value={contractNote} onChange={e => setContractNote(e.target.value)} />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* TAB: ПЕРИОД */}
                    {tab === 'dates' && (
                        <div className="px-5 py-4 space-y-3">
                            <Section icon={CalendarDays} title="Период аренды" />

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="pos-label text-slate-400 mb-1 block">Дата заезда</label>
                                    <input type="date" className="pos-input"
                                        value={checkInDate} onChange={e => setCheckInDate(e.target.value)} />
                                </div>
                                <div>
                                    <label className="pos-label text-slate-400 mb-1 block">Дата выезда</label>
                                    <input type="date" className="pos-input" readOnly
                                        value={checkOutStr}
                                        style={{ background: '#f1f5f9', cursor: 'default' }} />
                                </div>
                            </div>

                            <div>
                                <label className="pos-label text-slate-400 mb-1 block">Количество дней</label>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setDays(d => Math.max(1, d - 1))}
                                        className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600 shrink-0 transition-colors">
                                        <Minus size={14} />
                                    </button>
                                    <input type="number" className="pos-input text-center font-mono font-black text-lg"
                                        value={days} onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 1))} />
                                    <button onClick={() => setDays(d => d + 1)}
                                        className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-slate-600 shrink-0 transition-colors">
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="pos-label text-slate-400 mb-1 block">Цена за сутки</label>
                                <div className="relative">
                                    <input type="text" inputMode="numeric" className="pos-input pr-12"
                                        placeholder={String(parseInt(room?.price) || 0)}
                                        value={fmtSum(manualPrice)} onChange={e => setManualPrice(parseSum(e.target.value))} />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">сум</span>
                                </div>
                            </div>

                            {pricePerDay > 0 && (
                                <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-center justify-between">
                                    <div>
                                        <div className="text-[9px] font-bold uppercase text-teal-600 mb-0.5">Итого</div>
                                        <div className="font-mono font-black text-teal-700 text-lg leading-none">
                                            {totalAmount.toLocaleString()}
                                            <span className="text-xs ml-1 font-semibold">сум</span>
                                        </div>
                                    </div>
                                    <div className="text-right text-[10px] text-teal-600">
                                        {pricePerDay.toLocaleString()} × {daysNum} дн.
                                    </div>
                                </div>
                            )}

                            {room && (
                                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                                    {Array.from({ length: Math.min(parseInt(room.capacity) || 0, 12) }).map((_, i) => (
                                        <div key={i} className="w-7 h-9 rounded-lg bg-teal-50 border border-teal-200 flex flex-col items-center justify-center gap-0.5">
                                            <BedDouble size={11} className="text-teal-500" />
                                            <span className="text-[8px] font-bold text-teal-500">{i + 1}</span>
                                        </div>
                                    ))}
                                    <span className="text-[11px] text-slate-400 font-semibold ml-1">{room.capacity} мест</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: ОПЛАТА */}
                    {tab === 'pay' && (
                        <div className="px-5 py-4 space-y-3">
                            <Section icon={Receipt} title="Оплата"
                                right={debt === 0 && totalPaid > 0
                                    ? <span className="text-[10px] font-bold text-emerald-600">✓ Полная оплата</span>
                                    : debt > 0
                                        ? <span className="text-[10px] font-bold text-rose-500">Долг: {debt.toLocaleString()}</span>
                                        : null
                                }
                            />

                            <PayRow icon={DollarSign} label="Нал." value={paidCash}
                                onChange={setPaidCash} onMagnet={() => applyMagnet('paidCash')}
                                accent="bg-emerald-500" />
                            <PayRow icon={CreditCard} label="Карта" value={paidCard}
                                onChange={setPaidCard} onMagnet={() => applyMagnet('paidCard')}
                                accent="bg-blue-500" />
                            <PayRow icon={QrCode} label="QR" value={paidQR}
                                onChange={setPaidQR} onMagnet={() => applyMagnet('paidQR')}
                                accent="bg-violet-500" />

                            <hr className="receipt-divider" />

                            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                                {parseInt(paidCash) > 0 && (
                                    <div className="flex justify-between text-[12px]">
                                        <span className="text-slate-500">Нал.</span>
                                        <span className="font-bold font-mono text-slate-700">{parseInt(paidCash).toLocaleString()}</span>
                                    </div>
                                )}
                                {parseInt(paidCard) > 0 && (
                                    <div className="flex justify-between text-[12px]">
                                        <span className="text-slate-500">Карта</span>
                                        <span className="font-bold font-mono text-slate-700">{parseInt(paidCard).toLocaleString()}</span>
                                    </div>
                                )}
                                {parseInt(paidQR) > 0 && (
                                    <div className="flex justify-between text-[12px]">
                                        <span className="text-slate-500">QR</span>
                                        <span className="font-bold font-mono text-slate-700">{parseInt(paidQR).toLocaleString()}</span>
                                    </div>
                                )}
                                {totalPaid > 0 && (
                                    <div className="flex justify-between text-[12px] pt-1 border-t border-slate-200">
                                        <span className="font-bold text-slate-700">Внесено</span>
                                        <span className="font-black font-mono text-slate-900">{totalPaid.toLocaleString()}</span>
                                    </div>
                                )}
                                {debt > 0 && (
                                    <div className="flex justify-between text-[12px]">
                                        <span className="font-bold text-rose-500">Остаток</span>
                                        <span className="font-black font-mono text-rose-500">{debt.toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB: ИСТОРИЯ */}
                    {tab === 'history' && (
                        <div className="px-5 py-4 space-y-3">
                            <Section icon={Clock} title="История аренд" right={<span className="text-[10px] text-slate-400">{rentalHistory.length} записей</span>} />
                            {rentalHistory.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-xs">История пуста</div>
                            ) : rentalHistory.map((h, i) => {
                                const ciStr = h.checkInDate ? new Date(h.checkInDate).toLocaleDateString('ru', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '—';
                                const coStr = h.checkOutDate ? new Date(h.checkOutDate).toLocaleDateString('ru', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '—';
                                const closedStr = h.closedAt ? new Date(h.closedAt).toLocaleDateString('ru', { day:'2-digit', month:'2-digit', year:'2-digit' }) : null;
                                const paid = (h.paidCash||0)+(h.paidCard||0)+(h.paidQR||0);
                                return (
                                    <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                                        <div className="px-3 py-2 flex items-center justify-between bg-white border-b border-slate-100">
                                            <span className="font-black text-slate-700 text-xs">{h.tenantName || '—'}</span>
                                            {closedStr && <span className="text-[9px] text-slate-400 font-semibold">закрыта {closedStr}</span>}
                                        </div>
                                        <div className="px-3 py-2 space-y-1">
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-slate-400">Период</span>
                                                <span className="font-bold text-slate-700">{ciStr} — {coStr} ({h.days || '?'} дн.)</span>
                                            </div>
                                            {h.pricePerDay > 0 && (
                                                <div className="flex justify-between text-[11px]">
                                                    <span className="text-slate-400">Сумма</span>
                                                    <span className="font-bold font-mono text-teal-700">{(h.totalAmount || 0).toLocaleString()} сум</span>
                                                </div>
                                            )}
                                            {paid > 0 && (
                                                <div className="flex justify-between text-[11px]">
                                                    <span className="text-slate-400">Оплачено</span>
                                                    <span className="font-bold font-mono text-emerald-600">{paid.toLocaleString()} сум</span>
                                                </div>
                                            )}
                                            {h.contractNote && (
                                                <div className="flex items-start gap-1 text-[11px] pt-1 border-t border-slate-100">
                                                    <FileText size={10} className="text-slate-400 mt-0.5 shrink-0"/>
                                                    <span className="text-slate-600">{h.contractNote}</span>
                                                </div>
                                            )}
                                            {h.comment && (
                                                <div className="text-[10px] text-slate-400 italic">{h.comment}</div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* POS FOOTER */}
                <div className="shrink-0 px-4 py-3 flex items-center gap-2"
                    style={{ background: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {isEdit ? (
                        <>
                            <button onClick={onClose}
                                className="px-4 py-2.5 text-slate-500 hover:text-slate-300 font-bold rounded-xl transition-colors text-sm">Отмена</button>
                            {tab !== 'history' && (
                                <button onClick={() => handleSubmit('debt')} disabled={!canSubmit || submitting}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 text-white rounded-xl font-black text-sm transition-all active:scale-98 disabled:opacity-40"
                                    style={{ background: canSubmit && !submitting ? 'linear-gradient(135deg,#0f9688,#0d7a6e)' : '#374151' }}>
                                    <RefreshCw size={15} /> {submitting ? 'Сохранение...' : 'Сохранить изменения'}
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Назад / Отмена */}
                            <button
                                onClick={() => { if (stepIdx > 0) setTab(STEP_ORDER[stepIdx - 1]); else onClose(); }}
                                className="px-4 py-2.5 text-slate-500 hover:text-slate-300 font-bold rounded-xl transition-colors text-sm">
                                {stepIdx > 0 ? 'Назад' : 'Отмена'}
                            </button>

                            {tab !== 'pay' ? (
                                /* Далее */
                                <button
                                    onClick={() => setTab(STEP_ORDER[stepIdx + 1])}
                                    disabled={tab === 'info' && !canNextFromInfo}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 text-white rounded-xl font-black text-sm transition-all active:scale-98 disabled:opacity-40"
                                    style={{ background: (tab === 'info' && !canNextFromInfo) ? '#374151' : 'linear-gradient(135deg,#0f9688,#0d7a6e)' }}>
                                    Далее <ChevronRight size={15} />
                                </button>
                            ) : (
                                /* Финал: в долг / с оплатой */
                                <>
                                    <button onClick={() => handleSubmit('debt')} disabled={!canSubmit || submitting}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl font-black text-sm transition-all active:scale-98 disabled:opacity-40"
                                        style={{ background: 'rgba(245,158,11,0.18)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.4)' }}>
                                        В долг{debt > 0 ? ` · ${debt.toLocaleString()}` : ''}
                                    </button>
                                    <button onClick={() => handleSubmit('paid')} disabled={!canSubmit || submitting}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-3 text-white rounded-xl font-black text-sm transition-all active:scale-98 disabled:opacity-40"
                                        style={{ background: canSubmit && !submitting ? 'linear-gradient(135deg,#0f9688,#0d7a6e)' : '#374151' }}>
                                        <CheckCircle2 size={15} /> С оплатой
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RoomRentalModal;
