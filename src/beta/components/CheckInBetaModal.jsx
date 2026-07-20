import React, { useState, useMemo, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../../firebase';
import {
    X, BedDouble, User, CalendarDays, Wallet, Minus, Plus, AlertTriangle,
    DollarSign, CreditCard, QrCode, ArrowRightLeft, Coins, ExternalLink, ShieldAlert,
} from 'lucide-react';
import { COUNTRIES } from '../../constants/countries';
import { configuredNightPrice, minNightPrice, packageNightPrice, packageMinDays } from '../../utils/pricing';

/**
 * Заселение в стиле беты. Запись — через РОДНОЙ handleCheckInSubmit (onSubmit):
 * payload идентичен основной форме (поля, ISO-даты, ранний заезд, тарифы).
 * Проверки сохранены: занятость мест с учётом будущих броней, чёрный список,
 * минимальная цена с запросом одобрения, пакетный тариф от N дней.
 * Доп. место и нестандартные случаи — в основном приложении.
 */
const fmtMoney = (n) => (n || 0).toLocaleString('ru-RU');
const toInt = (v) => { const n = parseInt(String(v).replace(/[^\d]/g, ''), 10); return Number.isFinite(n) ? n : 0; };
const todayISO = () => new Date().toISOString().split('T')[0];
const norm = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, ' ').trim();

const PAY_METHODS = [
    { key: 'paidCash', label: 'Наличные', icon: DollarSign, cls: 'text-emerald-600', bg: 'bg-emerald-50' },
    { key: 'paidCard', label: 'Карта', icon: CreditCard, cls: 'text-indigo-600', bg: 'bg-indigo-50' },
    { key: 'paidQR', label: 'QR / Click', icon: QrCode, cls: 'text-purple-600', bg: 'bg-purple-50' },
    { key: 'paidTransfer', label: 'Перечисл.', icon: ArrowRightLeft, cls: 'text-sky-600', bg: 'bg-sky-50' },
];

// Детерминированный цвет аватара по имени (единый визуальный язык беты)
const AV = ['#e88c40', '#14b8a6', '#6366f1', '#f43f5e', '#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981'];
const avatarColor = (s) => AV[[...(s || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];
const initials = (s) => (s || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

const Section = ({ icon: Icon, title, children, right, i = 0 }) => (
    <div className="beta-rise rounded-xl border border-slate-200 overflow-hidden" style={{ animationDelay: `${Math.min(i * 55, 300)}ms` }}>
        <div className="flex items-center gap-2 px-3.5 py-2 border-b border-slate-100 bg-slate-50/60">
            <Icon size={13} className="text-slate-400" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{title}</span>
            {right && <span className="ml-auto">{right}</span>}
        </div>
        <div className="p-3.5">{children}</div>
    </div>
);

// Доп. место сверх вместимости (bedId='extra' — как в основной форме)
const ExtraChip = ({ selected, onClick }) => (
    <button onClick={onClick} title="Доп. гость сверх вместимости комнаты"
        className={`min-w-[52px] px-2 py-1.5 rounded-lg text-[11px] font-black border transition-all ${
            selected ? 'bg-purple-500 text-white border-purple-500' : 'bg-purple-50 text-purple-600 border-purple-200 hover:border-purple-400'}`}>
        +доп
    </button>
);

const Inp = (props) => (
    <input {...props}
        className={`w-full rounded-lg border border-slate-200 focus:border-orange-300 px-3 py-2 text-[13px] text-slate-700 outline-none transition-colors ${props.className || ''}`} />
);

const CheckInBetaModal = ({
    initialRoom, preSelectedBedId, initialDate, initialClient,
    allRooms = [], guests = [], clientsDb = [],
    hostelId, checkInHour = 14, checkOutHour = 12,
    onClose, onSubmit, onCheckinPriceRequest, notify, inMainApp,
}) => {
    const [f, setF] = useState(() => ({
        roomId: initialRoom?.id || '',
        bedId: preSelectedBedId ? String(preSelectedBedId) : '',
        fullName: initialClient?.fullName || '',
        passport: initialClient?.passport || '',
        passportIssueDate: initialClient?.passportIssueDate || '',
        country: initialClient?.country || 'Узбекистан',
        kppDate: initialClient?.kppDate || '',
        birthDate: initialClient?.birthDate || '',
        phone: initialClient?.phone || '',
        checkInDate: initialDate ? String(initialDate).split('T')[0] : todayISO(),
        days: 1,
        tariff: 'standard',
        pricePerNight: '',
        paidCash: '', paidCard: '', paidQR: '', paidTransfer: '', paidBalance: 0,
    }));
    const [showSuggest, setShowSuggest] = useState(false);
    const [busy, setBusy] = useState(false);
    // Запрос понижения цены (одобрение в Telegram) — как в основной форме
    const [priceReq, setPriceReq] = useState({ id: null, status: 'idle', price: 0 });

    const set = (patch) => setF(prev => ({ ...prev, ...patch }));

    const rooms = useMemo(() => allRooms.filter(r => !r.rental?.active), [allRooms]);
    const room = rooms.find(r => r.id === f.roomId) || null;

    // Цены по родному конфигу
    const cfgPrice = room ? configuredNightPrice(hostelId, room.number) : null;
    const MIN_PRICE = room ? minNightPrice(hostelId, room.number) : 0;
    const PKG_PRICE = room ? packageNightPrice(hostelId, room.number) : 0;
    const PKG_MIN_DAYS = packageMinDays();

    // Дефолтная цена при выборе комнаты
    useEffect(() => {
        if (!room) return;
        const def = f.tariff === 'package' ? PKG_PRICE : (cfgPrice || parseInt(room.price) || MIN_PRICE);
        set({ pricePerNight: String(def || '') });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [f.roomId, f.tariff]);

    // Занятость мест: как в основной форме — занято сейчас + окно до ближайшей будущей брони
    const beds = useMemo(() => {
        if (!room) return [];
        const now = new Date();
        const checkIn = f.checkInDate ? new Date(f.checkInDate + 'T00:00:00') : now;
        const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
        const occupiedIds = guests
            .filter(g => g.roomId === room.id && g.status === 'active' && new Date(g.checkInDate) <= endOfToday)
            .filter(g => { const out = new Date(g.checkOutDate); return !g.checkOutDate || now < out; })
            .map(g => String(g.bedId));
        return Array.from({ length: parseInt(room.capacity) || 0 }, (_, i) => {
            const id = String(i + 1);
            const nextConflict = guests
                .filter(g => g.roomId === room.id && String(g.bedId) === id &&
                    (g.status === 'booking' || g.status === 'active') && new Date(g.checkInDate) > checkIn)
                .sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate))[0];
            const maxFreeDays = nextConflict
                ? Math.max(0, Math.floor((new Date(nextConflict.checkInDate) - checkIn) / 86400000))
                : null;
            return { id, occupied: occupiedIds.includes(id), maxFreeDays, nextName: nextConflict?.fullName || null };
        });
    }, [room, guests, f.checkInDate]);

    const selBed = beds.find(b => b.id === f.bedId) || null;

    // Клиент из базы: автоподсказки + чёрный список + бонусный баланс
    const suggestions = useMemo(() => {
        const q = norm(f.fullName);
        if (q.length < 2) return [];
        return clientsDb
            .filter(c => norm(c.fullName).includes(q) || (c.passport && norm(c.passport).includes(q)))
            .slice(0, 5);
    }, [f.fullName, clientsDb]);

    const dbClient = useMemo(() => {
        const p = (f.passport || '').replace(/\s/g, '').toUpperCase();
        return clientsDb.find(c =>
            (p && c.passport && c.passport.replace(/\s/g, '').toUpperCase() === p) ||
            (!p && c.fullName && norm(c.fullName) === norm(f.fullName))) || null;
    }, [clientsDb, f.passport, f.fullName]);

    const blacklist = dbClient?.clientStatus === 'blacklist' ? 'blacklist'
        : dbClient?.clientStatus === 'warning' ? 'warning' : null;
    const bonusBalance = Math.max(0, parseInt(dbClient?.balance) || 0);

    const pickClient = (c) => {
        set({
            fullName: c.fullName || '', passport: c.passport || '', country: c.country || f.country,
            phone: c.phone || '', birthDate: c.birthDate || '', passportIssueDate: c.passportIssueDate || '',
        });
        setShowSuggest(false);
    };

    // Итоги
    const days = Math.max(1, toInt(f.days));
    const price = toInt(f.pricePerNight);
    const totalPrice = days * price;
    const totalPaid = toInt(f.paidCash) + toInt(f.paidCard) + toInt(f.paidQR) + toInt(f.paidTransfer) + toInt(f.paidBalance);
    const debt = Math.max(0, totalPrice - totalPaid);

    const checkOutPreview = useMemo(() => {
        const d = new Date(f.checkInDate + 'T00:00:00');
        if (isNaN(d)) return '';
        d.setDate(d.getDate() + days);
        return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) + ` к ${checkOutHour}:00`;
    }, [f.checkInDate, days, checkOutHour]);

    const priceBelowMin = f.tariff === 'standard' && price > 0 && price < MIN_PRICE;
    const priceApproved = priceReq.status === 'approved' && priceReq.price === price;

    // Подписка на статус заявки о понижении (родная коллекция priceRequests)
    useEffect(() => {
        if (!priceReq.id) return;
        return onSnapshot(doc(db, ...PUBLIC_DATA_PATH, 'priceRequests', priceReq.id), (snap) => {
            const st = snap.data()?.status;
            if (st === 'approved' || st === 'rejected') setPriceReq(prev => ({ ...prev, status: st }));
        });
    }, [priceReq.id]);

    const requestPrice = async () => {
        const id = await onCheckinPriceRequest?.({
            guestName: f.fullName, passport: f.passport, roomNumber: room?.number,
            hostelId, requestedPrice: price,
        });
        if (id) setPriceReq({ id, status: 'pending', price });
    };

    const validate = () => {
        if (!f.fullName.trim()) return 'Укажите имя гостя';
        if (!f.roomId || !f.bedId) return 'Выберите комнату и место';
        if (selBed?.occupied) return `Место ${f.bedId} уже занято`;
        if (selBed && selBed.maxFreeDays !== null && days > selBed.maxFreeDays)
            return `Место свободно только ${selBed.maxFreeDays} дн. — дальше бронь (${selBed.nextName || 'гость'})`;
        if (isNaN(new Date(f.checkInDate).getTime())) return 'Укажите корректную дату заезда';
        if (f.tariff === 'package' && days < PKG_MIN_DAYS) return `Пакетный тариф: минимум ${PKG_MIN_DAYS} дней`;
        if (priceBelowMin && !priceApproved) return `Цена ниже ${fmtMoney(MIN_PRICE)} — нужно одобрение администратора`;
        if (price <= 0) return 'Укажите цену за ночь';
        return null;
    };

    const submit = async (status) => {
        if (busy) return;
        const err = validate();
        if (err) { notify?.(err, 'error'); return; }
        if (blacklist === 'blacklist' && !window.confirm(`${dbClient?.fullName} в чёрном списке. Всё равно заселить?`)) return;
        setBusy(true);
        try {
            // Даты — точно как в основной форме (расчётные часы + фикс раннего заезда)
            const checkIn = new Date(f.checkInDate);
            checkIn.setHours(checkInHour, 0, 0, 0);
            const checkOut = new Date(checkIn);
            checkOut.setDate(checkOut.getDate() + days);
            checkOut.setHours(checkOutHour, 0, 0, 0);
            const nowTs = new Date();
            if (status === 'active' && checkIn > nowTs && checkIn.toDateString() === nowTs.toDateString()) {
                checkIn.setTime(nowTs.getTime());
            }
            await onSubmit({
                ...f,
                roomNumber: room?.number || '',
                days,
                pricePerNight: price,
                paidCash: toInt(f.paidCash), paidCard: toInt(f.paidCard),
                paidQR: toInt(f.paidQR), paidTransfer: toInt(f.paidTransfer),
                paidBalance: toInt(f.paidBalance),
                status,
                checkInDate: checkIn.toISOString(),
                checkOutDate: checkOut.toISOString(),
                totalPrice,
                amountPaid: totalPaid,
                nonRefundable: f.tariff === 'package',
                priceReductionAllowed: !!priceApproved,
                approvedPrice: priceApproved ? price : 0,
            });
        } catch (e) {
            notify?.('Ошибка заселения: ' + (e?.message || e), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[170] flex items-center justify-center px-4 beta-fade"
            style={{ background: 'rgba(8,18,20,0.55)', backdropFilter: 'blur(2px)' }}
            onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
            <div role="dialog" aria-modal="true" aria-label="Заселение"
                className="beta-pop w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 max-h-[94vh] flex flex-col">

                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-shrink-0">
                    {f.fullName.trim()
                        ? <span className="w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-black text-white flex-shrink-0" style={{ background: avatarColor(f.fullName) }}>{initials(f.fullName)}</span>
                        : <span className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0"><BedDouble size={17} /></span>}
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-black text-slate-800 truncate">{f.fullName.trim() || 'Заселение'}</div>
                        <div className="text-[11px] text-slate-400 truncate">
                            {room ? `Комната ${room.number}${f.bedId === 'extra' ? ' · доп. место' : f.bedId ? ` · место ${f.bedId}` : ''}` : 'выберите место'}
                        </div>
                    </div>
                    <button onClick={() => inMainApp?.('Доп. место, KPP и нестандартные случаи')}
                        className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10.5px] font-bold text-slate-400 border border-slate-200 hover:border-slate-300 transition-colors">
                        <ExternalLink size={11} /> Сложный случай
                    </button>
                    <button onClick={onClose} disabled={busy} aria-label="Закрыть"
                        className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="overflow-y-auto px-5 py-4 flex flex-col gap-3.5">

                    {/* Место */}
                    <Section icon={BedDouble} title="Место" i={0}>
                        <div className="flex gap-2 mb-2.5">
                            <select value={f.roomId} onChange={e => set({ roomId: e.target.value, bedId: '' })}
                                className="flex-1 rounded-lg border border-slate-200 focus:border-orange-300 px-3 py-2 text-[13px] text-slate-700 outline-none bg-white">
                                <option value="">Комната…</option>
                                {rooms.map(r => <option key={r.id} value={r.id}>Комната {r.number}{r.gender ? ` · ${r.gender}` : ''}</option>)}
                            </select>
                        </div>
                        {room && (
                            <div className="flex flex-wrap gap-1.5">
                                <ExtraChip selected={f.bedId === 'extra'} onClick={() => set({ bedId: 'extra' })} />
                                {beds.map(b => {
                                    const sel = f.bedId === b.id;
                                    const limited = !b.occupied && b.maxFreeDays !== null;
                                    return (
                                        <button key={b.id} disabled={b.occupied}
                                            onClick={() => set({ bedId: b.id })}
                                            title={b.occupied ? 'занято' : limited ? `свободно ${b.maxFreeDays} дн., дальше бронь: ${b.nextName}` : 'свободно'}
                                            className={`min-w-[52px] px-2 py-1.5 rounded-lg text-[11px] font-black border transition-all ${
                                                b.occupied ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed'
                                                : sel ? 'bg-teal-500 text-white border-teal-500'
                                                : limited ? 'bg-amber-50 text-amber-600 border-amber-200 hover:border-amber-400'
                                                : 'bg-white text-teal-600 border-teal-200 hover:border-teal-400'}`}>
                                            {b.id}{limited ? ` · ${b.maxFreeDays}д` : ''}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        {selBed && selBed.maxFreeDays !== null && (
                            <div className="mt-2 text-[11px] text-amber-600 font-semibold">
                                Место свободно {selBed.maxFreeDays} дн. — {selBed.maxFreeDays > 0 ? `потом заезжает ${selBed.nextName}` : `сегодня бронь: ${selBed.nextName}`}
                            </div>
                        )}
                    </Section>

                    {/* Гость */}
                    <Section icon={User} title="Гость" i={1}>
                        <div className="relative">
                            <Inp placeholder="ФИО — начните вводить, база подскажет" value={f.fullName}
                                onChange={e => { set({ fullName: e.target.value }); setShowSuggest(true); }}
                                onFocus={() => setShowSuggest(true)} />
                            {showSuggest && suggestions.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-10 overflow-hidden">
                                    {suggestions.map(c => (
                                        <button key={c.id} onClick={() => pickClient(c)}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-orange-50 transition-colors border-b border-slate-50 last:border-b-0">
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[12.5px] font-bold text-slate-700 truncate">{c.fullName}</span>
                                                <span className="block text-[10.5px] text-slate-400 truncate">
                                                    {[c.passport, c.visits ? `${c.visits} визитов` : '', (parseInt(c.balance) || 0) > 0 ? `бонус ${fmtMoney(parseInt(c.balance))}` : ''].filter(Boolean).join(' · ')}
                                                </span>
                                            </span>
                                            {c.clientStatus === 'blacklist' && <ShieldAlert size={13} className="text-rose-500 flex-shrink-0" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                                <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 ml-1">Паспорт</span>
                                <Inp placeholder="AB1234567" value={f.passport} onChange={e => set({ passport: e.target.value })} />
                            </div>
                            <div>
                                <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 ml-1">Телефон</span>
                                <Inp placeholder="+998 …" value={f.phone} onChange={e => set({ phone: e.target.value })} />
                            </div>
                            <div>
                                <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 ml-1">Гражданство</span>
                                <Inp list="beta-countries" value={f.country} onChange={e => set({ country: e.target.value })} />
                                <datalist id="beta-countries">{COUNTRIES.map(c => <option key={c} value={c} />)}</datalist>
                            </div>
                            <div>
                                <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 ml-1">Дата рождения</span>
                                <Inp type="date" value={f.birthDate} onChange={e => set({ birthDate: e.target.value })} />
                            </div>
                            <div>
                                <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 ml-1">Паспорт выдан</span>
                                <Inp type="date" value={f.passportIssueDate} onChange={e => set({ passportIssueDate: e.target.value })} />
                            </div>
                            <div>
                                <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 ml-1">Дата КПП (иностранцы)</span>
                                <Inp type="date" value={f.kppDate} onChange={e => set({ kppDate: e.target.value })} />
                            </div>
                        </div>
                        {blacklist && (
                            <div className={`mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold ${
                                blacklist === 'blacklist' ? 'bg-rose-50 border border-rose-200 text-rose-600' : 'bg-amber-50 border border-amber-200 text-amber-700'}`}>
                                <ShieldAlert size={14} className="flex-shrink-0 mt-0.5" />
                                {blacklist === 'blacklist'
                                    ? `${dbClient.fullName} — в чёрном списке! Заселение потребует подтверждения.`
                                    : `${dbClient.fullName} — есть пометка «внимание» в базе клиентов.`}
                            </div>
                        )}
                    </Section>

                    {/* Даты и цена */}
                    <Section icon={CalendarDays} title="Даты и цена" i={2}
                        right={<span className="text-[10px] text-slate-400 normal-case font-semibold">выезд {checkOutPreview}</span>}>
                        <div className="flex flex-wrap items-center gap-2">
                            <Inp type="date" className="!w-auto" value={f.checkInDate} onChange={e => set({ checkInDate: e.target.value })} />
                            <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden">
                                <button onClick={() => set({ days: Math.max(1, days - 1) })} className="px-2.5 py-2 text-slate-400 hover:bg-slate-50"><Minus size={13} /></button>
                                <span className="px-2 text-[13px] font-black text-slate-700 tabular-nums min-w-[64px] text-center">{days} {days === 1 ? 'ночь' : days < 5 ? 'ночи' : 'ночей'}</span>
                                <button onClick={() => set({ days: days + 1 })} className="px-2.5 py-2 text-slate-400 hover:bg-slate-50"><Plus size={13} /></button>
                            </div>
                            <div className={`flex items-center gap-1 rounded-lg border px-3 py-2 ${priceBelowMin && !priceApproved ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200'}`}>
                                <input inputMode="numeric" value={f.pricePerNight} onChange={e => { set({ pricePerNight: e.target.value }); }}
                                    className="w-20 text-[13px] font-black tabular-nums text-slate-800 outline-none bg-transparent" />
                                <span className="text-[10px] font-bold text-slate-400">сум/ночь</span>
                            </div>
                        </div>
                        <label className={`flex items-center gap-2 mt-2.5 ${room ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
                            <input type="checkbox" disabled={!room} checked={f.tariff === 'package'}
                                onChange={e => set({ tariff: e.target.checked ? 'package' : 'standard' })}
                                className="accent-orange-500" />
                            <span className="text-[12px] font-semibold text-slate-600">
                                Пакетный тариф{room ? ` · ${fmtMoney(PKG_PRICE)}/ночь` : ''} · от {PKG_MIN_DAYS} дней, невозвратный
                            </span>
                        </label>
                        {priceBelowMin && (
                            <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                                <div className="flex items-center gap-2 text-[12px] font-semibold text-amber-700">
                                    <AlertTriangle size={13} className="flex-shrink-0" />
                                    Цена ниже минимума {fmtMoney(MIN_PRICE)} — нужно одобрение администратора.
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    {priceApproved ? (
                                        <span className="text-[12px] font-black text-emerald-600">Одобрено ✓ — можно заселять</span>
                                    ) : priceReq.status === 'pending' && priceReq.price === price ? (
                                        <span className="text-[12px] font-bold text-amber-600 animate-pulse">Ждём ответа в Telegram…</span>
                                    ) : priceReq.status === 'rejected' && priceReq.price === price ? (
                                        <span className="text-[12px] font-black text-rose-500">Отклонено — поднимите цену</span>
                                    ) : (
                                        <button onClick={requestPrice}
                                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black transition-colors">
                                            Запросить одобрение {fmtMoney(price)}
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </Section>

                    {/* Оплата */}
                    <Section icon={Wallet} title="Оплата сейчас" i={3}
                        right={<span className="text-[11px] font-black text-slate-700 tabular-nums normal-case">итого {fmtMoney(totalPrice)}</span>}>
                        <div className="grid grid-cols-2 gap-2">
                            {PAY_METHODS.map(({ key, label, icon: Icon, cls, bg }) => (
                                <label key={key} className={`block rounded-lg border p-2 transition-colors ${
                                    toInt(f[key]) > 0 ? 'border-orange-300 bg-orange-50/40' : 'border-slate-200'}`}>
                                    <span className="flex items-center gap-1.5 text-[9.5px] font-black uppercase tracking-wider text-slate-400 mb-0.5">
                                        <span className={`w-4 h-4 rounded flex items-center justify-center ${bg}`}><Icon size={9} className={cls} /></span>
                                        {label}
                                    </span>
                                    <input inputMode="numeric" value={f[key]} placeholder="0"
                                        onChange={e => set({ [key]: e.target.value })}
                                        className="w-full text-[14px] font-black tabular-nums text-slate-800 bg-transparent outline-none" />
                                </label>
                            ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2.5">
                            <button onClick={() => set({ paidCash: String(totalPrice), paidCard: '', paidQR: '', paidTransfer: '', paidBalance: 0 })}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors">
                                Всё налом · {fmtMoney(totalPrice)}
                            </button>
                            {bonusBalance > 0 && (
                                <button onClick={() => set({ paidBalance: Math.min(bonusBalance, Math.max(0, totalPrice - toInt(f.paidCash) - toInt(f.paidCard) - toInt(f.paidQR) - toInt(f.paidTransfer))) })}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors">
                                    <Coins size={11} /> Бонусы: {fmtMoney(bonusBalance)}
                                </button>
                            )}
                            {toInt(f.paidBalance) > 0 && (
                                <span className="text-[11px] font-bold text-amber-600">− {fmtMoney(toInt(f.paidBalance))} бонусами</span>
                            )}
                            <span className={`ml-auto text-[12px] font-black tabular-nums ${debt > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                {debt > 0 ? `в долг ${fmtMoney(debt)}` : totalPaid > 0 ? 'оплачено полностью ✓' : ''}
                            </span>
                        </div>
                        {totalPrice > 0 && (
                            <div className="mt-2.5 h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-300 ${debt > 0 ? 'bg-rose-400' : 'bg-emerald-400'}`}
                                    style={{ width: `${Math.min(100, Math.round((totalPaid / totalPrice) * 100))}%` }} />
                            </div>
                        )}
                    </Section>
                </div>

                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex gap-2 flex-shrink-0">
                    <button onClick={() => submit('booking')} disabled={busy}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-indigo-600 border border-indigo-200 bg-white hover:bg-indigo-50 transition-colors disabled:opacity-40">
                        Создать бронь
                    </button>
                    <button onClick={() => submit('active')} disabled={busy}
                        className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-40 transition-colors">
                        {busy ? 'Заселяю…' : `Заселить${totalPaid > 0 ? ` · оплачено ${fmtMoney(totalPaid)}` : debt > 0 ? ' · в долг' : ''}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckInBetaModal;
