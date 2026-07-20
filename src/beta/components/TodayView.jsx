import React, { useMemo } from 'react';
import {
    Users, BedDouble, TrendingUp, Wallet, Zap, Clock,
    UserPlus, ClipboardCheck, Power, ChevronRight,
} from 'lucide-react';

// Тот же расчёт оплаты, что и в DashboardView
const getTotalPaid = (g) => (typeof g.amountPaid === 'number'
    ? g.amountPaid
    : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0) + (g.paidTransfer || 0)));

const parseDate = (dateInput) => {
    if (!dateInput) return null;
    const date = new Date(dateInput);
    if (typeof dateInput === 'string' && !dateInput.includes('T')) {
        date.setHours(12, 0, 0, 0);
    }
    return date;
};

const getLocalDateString = (dateObj) => {
    if (!dateObj) return '';
    const offset = dateObj.getTimezoneOffset() * 60000;
    return new Date(dateObj.getTime() - offset).toISOString().slice(0, 10);
};

const fmtMoney = (n) => (n || 0).toLocaleString('ru-RU');
const fmtTime = (d) => d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';
const fmtDM = (d) => (d ? new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : '');
const nightsWord = (n) => (n === 1 ? 'ночь' : n < 5 ? 'ночи' : 'ночей');

const overdueLabel = (checkOut, now) => {
    const min = Math.floor((now - checkOut.getTime()) / 60000);
    if (min < 60) return `просрочен на ${min} мин`;
    const h = Math.floor(min / 60);
    if (h < 24) return `просрочен на ${h} ч ${min % 60 > 0 ? `${min % 60} мин` : ''}`.trim();
    return `просрочен на ${Math.floor(h / 24)} дн.`;
};

const STRIPE = {
    rose:   'bg-rose-400',
    amber:  'bg-amber-400',
    indigo: 'bg-indigo-400',
    teal:   'bg-teal-400',
    slate:  'bg-slate-300',
    good:   'bg-emerald-400',
};

// Живая цифра: плавный count-up при изменении значения (reduced-motion → мгновенно)
const useCountUp = (target, dur = 550) => {
    const [v, setV] = React.useState(target);
    const prev = React.useRef(target);
    React.useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { prev.current = target; setV(target); return; }
        const from = prev.current;
        prev.current = target;
        if (from === target) return;
        const t0 = performance.now();
        let raf;
        const step = (t) => {
            const k = Math.min(1, (t - t0) / dur);
            setV(Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3))));
            if (k < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [target, dur]);
    return v;
};

const KpiTile = ({ k, onGoTab }) => {
    const v = useCountUp(k.raw);
    const Icon = k.icon;
    return (
        <button onClick={() => k.tab && onGoTab?.(k.tab)}
            className={`text-left bg-white rounded-2xl border border-slate-200 p-3.5 transition-all ${k.tab ? 'hover:border-slate-300 hover:shadow-sm cursor-pointer' : 'cursor-default'}`}>
            <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${KPI_COLORS[k.color]}`}><Icon size={15} /></span>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{k.label}</span>
            </div>
            <div className="text-xl font-black text-slate-800 tabular-nums">{k.fmt(v)}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{k.sub}</div>
        </button>
    );
};

const KPI_COLORS = {
    indigo:  'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose:    'bg-rose-50 text-rose-600',
    amber:   'bg-amber-50 text-amber-600',
    purple:  'bg-purple-50 text-purple-600',
};

const TodayView = ({
    rooms = [], guests = [], payments = [], expenses = [], shifts = [], clients = [],
    currentUser, currentHostelId = 'all',
    onOpenGuest, onGoTab, onOpenShift, onOpenCheckIn, onPayDebt, onCheckInBooking, onReturnClients, onCheckInBed,
}) => {
    const now = new Date();
    const nowMs = now.getTime();
    const todayStr = getLocalDateString(now);
    const ymd = (d) => (d ? getLocalDateString(new Date(d)) : '');

    const isCashier = currentUser?.role !== 'admin' && currentUser?.role !== 'super';
    const roomById = useMemo(() => Object.fromEntries(rooms.map(r => [r.id, r])), [rooms]);
    const roomNum = (g) => g.roomNumber || roomById[g.roomId]?.number || '—';

    const data = useMemo(() => {
        const relRooms = currentHostelId === 'all' ? rooms : rooms.filter(r => r.hostelId === currentHostelId);
        const relGuests = currentHostelId === 'all' ? guests : guests.filter(g => g.hostelId === currentHostelId);
        const relPayments = currentHostelId === 'all' ? payments : payments.filter(p => p.hostelId === currentHostelId);

        const activeGuests = relGuests.filter(g => g.status === 'active');
        const totalBeds = relRooms.reduce((s, r) => s + parseInt(r.capacity || 0), 0);
        const rentedBeds = relRooms.filter(r => r.rental?.active).reduce((s, r) => s + parseInt(r.capacity || 0), 0);
        const relRoomIds = new Set(relRooms.map(r => r.id));
        const occupiedBeds = activeGuests.filter(g => relRoomIds.has(g.roomId)).length + rentedBeds;
        const occupancyPct = totalBeds ? Math.min(100, Math.round((occupiedBeds / totalBeds) * 100)) : 0;
        const freeBeds = Math.max(0, totalBeds - occupiedBeds);

        const incomeToday = relPayments
            .filter(p => ymd(p.date) === todayStr)
            .reduce((s, p) => s + (parseInt(p.amount) || 0), 0);

        const debtors = relGuests
            .filter(g => g.status !== 'booking')
            .map(g => ({ ...g, debt: (g.totalPrice || 0) - getTotalPaid(g) }))
            .filter(g => g.debt > 0);
        const totalDebt = debtors.reduce((s, g) => s + g.debt, 0);

        // Просроченные выезды (активен, расчётное время прошло)
        const expired = activeGuests
            .map(g => ({ g, co: parseDate(g.checkOutDate) }))
            .filter(x => x.co && now > x.co)
            .sort((a, b) => a.co - b.co);
        const expiredIds = new Set(expired.map(x => x.g.id));

        // Выезжают сегодня с долгом (ещё не просрочены)
        const departingDebt = debtors.filter(g =>
            g.status === 'active' && ymd(g.checkOutDate) === todayStr && !expiredIds.has(g.id));

        // Выезжают сегодня без долга
        const departingOk = activeGuests.filter(g =>
            ymd(g.checkOutDate) === todayStr && !expiredIds.has(g.id) &&
            !departingDebt.some(d => d.id === g.id));

        // Ожидаемые заезды (брони на сегодня)
        const arrivalsExpected = relGuests.filter(g =>
            g.status === 'booking' && ymd(g.checkInDate || g.checkInDateTime) === todayStr);

        // E-mehmon: живут, но не зарегистрированы
        const emehmonPending = activeGuests.filter(g => !g.emehmonReg && !g.emehmonSkip);
        // E-mehmon: выселены, но не выведены
        const emehmonOut = relGuests.filter(g =>
            g.status === 'checked_out' && g.emehmonReg && !g.emehmonOut);

        // ── Очередь «Следующий шаг» ──
        const queue = [];
        expired.forEach(({ g, co }) => {
            const expDebt = (g.totalPrice || 0) - getTotalPaid(g);
            queue.push({
                key: 'exp-' + g.id, color: 'rose',
                title: `Выезд просрочен: ${g.fullName}`,
                why: `Комната ${roomNum(g)} · расчётное время прошло${expDebt > 0 ? ` · долг ${fmtMoney(expDebt)}` : ''}`,
                when: overdueLabel(co, nowMs),
                act: expDebt > 0 && onPayDebt
                    ? { label: 'Принять оплату', fn: () => onPayDebt(g) }
                    : { label: 'Открыть гостя', fn: () => onOpenGuest?.(g) },
                act2: expDebt > 0 && onPayDebt
                    ? { label: 'Открыть', fn: () => onOpenGuest?.(g) }
                    : null,
            });
        });
        departingDebt.forEach(g => queue.push({
            key: 'debt-' + g.id, color: 'amber',
            title: `Долг перед выездом: ${g.fullName} · ${fmtMoney(g.debt)} UZS`,
            why: `Комната ${roomNum(g)} · выезжает сегодня — принять оплату при выезде`,
            when: 'до выезда',
            act: onPayDebt
                ? { label: 'Принять оплату', fn: () => onPayDebt(g) }
                : { label: 'Открыть гостя', fn: () => onOpenGuest?.(g) },
        }));
        if (emehmonPending.length > 0) queue.push({
            key: 'emehmon-in', color: 'amber',
            title: `E-mehmon: ${emehmonPending.length} ${emehmonPending.length === 1 ? 'гость не зарегистрирован' : emehmonPending.length < 5 ? 'гостя не зарегистрированы' : 'гостей не зарегистрированы'}`,
            why: emehmonPending.slice(0, 3).map(g => g.fullName).join(', ') + (emehmonPending.length > 3 ? '…' : ''),
            when: 'штраф при просрочке',
            act: { label: 'К регистрации', fn: () => onGoTab?.('registrations') },
        });
        if (emehmonOut.length > 0) queue.push({
            key: 'emehmon-out', color: 'amber',
            title: `E-mehmon: вывести ${emehmonOut.length} ${emehmonOut.length === 1 ? 'выехавшего' : 'выехавших'}`,
            why: emehmonOut.slice(0, 3).map(g => g.fullName).join(', ') + (emehmonOut.length > 3 ? '…' : ''),
            when: 'гости уже выехали',
            act: { label: 'К выводу', fn: () => onGoTab?.('registrations') },
        });
        arrivalsExpected.forEach(g => queue.push({
            key: 'arr-' + g.id, color: 'indigo',
            title: `Ожидается заезд: ${g.fullName}`,
            why: `${g.source === 'website' ? 'Бронь с сайта' : 'Бронь'}${g.roomNumber ? ` · комната ${g.roomNumber}` : ' · место не назначено'}`,
            when: 'сегодня',
            act: onCheckInBooking
                ? { label: 'Заселить', fn: () => onCheckInBooking(g) }
                : { label: 'Открыть бронь', fn: () => onOpenGuest?.(g) },
            act2: onCheckInBooking ? { label: 'Открыть', fn: () => onOpenGuest?.(g) } : null,
        }));
        departingOk.forEach(g => queue.push({
            key: 'dep-' + g.id, color: 'teal',
            title: `Выезд сегодня: ${g.fullName}`,
            why: `Комната ${roomNum(g)} · оплачено полностью`,
            when: 'к расчётному часу',
            act: { label: 'Открыть гостя', fn: () => onOpenGuest?.(g) },
        }));
        // Простои: место свободно сегодня, но впереди (≤7 дн) есть бронь/заезд — предложить закрыть
        if (onCheckInBed) {
            const soon = nowMs + 7 * 86400000;
            const gapsToday = [];
            relRooms.filter(r => !r.rental?.active).forEach(r => {
                const cap = parseInt(r.capacity || 0);
                for (let b = 1; b <= cap; b++) {
                    const bedGuests = relGuests.filter(g => g.roomId === r.id && String(g.bedId) === String(b));
                    const occupiedToday = bedGuests.some(g => g.status === 'active' &&
                        parseDate(g.checkInDate) <= now && (!g.checkOutDate || parseDate(g.checkOutDate) > now));
                    if (occupiedToday) continue;
                    const next = bedGuests
                        .filter(g => (g.status === 'booking' || g.status === 'active') && parseDate(g.checkInDate) > now)
                        .sort((a, b2) => parseDate(a.checkInDate) - parseDate(b2.checkInDate))[0];
                    if (next && parseDate(next.checkInDate).getTime() <= soon) {
                        const nights = Math.max(1, Math.floor((parseDate(next.checkInDate) - now) / 86400000));
                        gapsToday.push({ room: r, bed: b, nights, nextName: next.fullName, nextDate: next.checkInDate });
                    }
                }
            });
            gapsToday.sort((a, b) => a.nights - b.nights).slice(0, 3).forEach(g => queue.push({
                key: `gap-${g.room.id}-${g.bed}`, color: 'teal',
                title: `Простой: комн. ${g.room.number}, место ${g.bed} свободно ${g.nights} ${nightsWord(g.nights)}`,
                why: `До заезда «${g.nextName}» (${fmtDM(g.nextDate)}) можно заселить на этот срок — место не простаивает`,
                when: 'закрыть простой',
                act: { label: 'Заселить', fn: () => onCheckInBed(g.room, g.bed) },
            }));
        }

        // Загрузка низкая → программа сама предлагает вернуть постоянных клиентов
        if (occupancyPct < 50 && totalBeds > 0 && onReturnClients) {
            const nowMs2 = Date.now();
            const candidates = (clients || []).filter(c =>
                (c.visits || 0) >= 2 && c.clientStatus !== 'blacklist' && c.lastVisit &&
                (nowMs2 - new Date(c.lastVisit).getTime()) / 86400000 >= 30).length;
            if (candidates > 0) queue.push({
                key: 'return-clients', color: 'good',
                title: `Загрузка ${occupancyPct}% — время вернуть постоянных гостей`,
                why: `${candidates} проверенных клиентов давно не были. Список с телефонами — по кнопке.`,
                when: 'подбор программы',
                act: { label: 'Кого позвать', fn: () => onReturnClients() },
            });
        }
        if (isCashier && (now.getHours() > 19 || (now.getHours() === 19 && now.getMinutes() >= 30))) queue.unshift({
            key: 'shift', color: 'rose',
            title: 'Закрыть смену',
            why: `Доход за сегодня ${fmtMoney(incomeToday)} UZS — сверить кассу и передать смену`,
            when: 'конец дня',
            act: { label: 'Закрыть смену', fn: () => onOpenShift?.() },
        });

        // ── Лента дня: всё, что случилось и что предстоит ──
        const relShifts = currentHostelId === 'all' ? shifts : (shifts || []).filter(s => s.hostelId === currentHostelId);
        const relExpenses = currentHostelId === 'all' ? expenses : (expenses || []).filter(e => e.hostelId === currentHostelId);

        const methodLabel = (p) => {
            const parts = [];
            if (+p.cash > 0) parts.push('нал');
            if (+p.card > 0) parts.push('карта');
            if (+p.qr > 0) parts.push('QR');
            if (+p.transfer > 0) parts.push('перечисл.');
            if (+p.balance > 0) parts.push('баланс');
            if (!parts.length && p.method) {
                parts.push({ cash: 'нал', card: 'карта', qr: 'QR', transfer: 'перечисл.', balance: 'баланс', split: 'смешанно' }[p.method] || p.method);
            }
            return parts.join(' + ');
        };

        const events = [];

        // Смены: открытие (и закрытие, если было сегодня)
        relShifts.filter(s => ymd(s.startTime) === todayStr).forEach(s => {
            events.push({ time: new Date(s.startTime), label: `Смена открыта · ${s.staffName || '—'}`, sub: '', dot: 'emerald' });
        });
        relShifts.filter(s => s.endTime && ymd(s.endTime) === todayStr).forEach(s => {
            events.push({ time: new Date(s.endTime), label: `Смена закрыта · ${s.staffName || '—'}`, sub: '', dot: 'slate' });
        });

        // Оплаты (инкассация — отдельной строкой)
        relPayments.filter(p => ymd(p.date) === todayStr).forEach(p => {
            const amt = parseInt(p.amount) || 0;
            if (p.type === 'cash_to_terminal') {
                events.push({ time: new Date(p.date), label: `Инкассация ${fmtMoney(amt)} → терминал`, sub: p.comment || '', dot: 'indigo' });
                return;
            }
            const m = methodLabel(p);
            events.push({
                time: new Date(p.date),
                label: `Оплата ${fmtMoney(amt)}${m ? ` · ${m}` : ''}`,
                sub: [p.guestName, p.roomNumber ? `ком. ${p.roomNumber}` : ''].filter(Boolean).join(' · '),
                dot: 'emerald',
            });
        });

        // Расходы
        relExpenses.filter(e => ymd(e.date) === todayStr).forEach(e => {
            events.push({
                time: new Date(e.date),
                label: `Расход ${fmtMoney(parseInt(e.amount) || 0)} · ${e.category || 'без категории'}`,
                sub: (e.comment || '').startsWith((e.category || '') + ': ') ? e.comment.slice((e.category || '').length + 2) : (e.comment || ''),
                dot: 'rose',
            });
        });

        // Заезды (заселились сегодня)
        activeGuests
            .filter(g => ymd(g.checkInDateTime || g.createdAt || g.checkInDate) === todayStr)
            .forEach(g => {
                const t = g.checkInDateTime || g.createdAt;
                events.push({ time: t ? new Date(t) : now, label: `Заезд · ${g.fullName}`, sub: `комната ${roomNum(g)}, место ${g.bedId ?? '—'}`, dot: 'orange', noTime: !t });
            });

        // Новые брони, созданные сегодня
        relGuests
            .filter(g => g.status === 'booking' && g.createdAt && ymd(g.createdAt) === todayStr)
            .forEach(g => {
                events.push({ time: new Date(g.createdAt), label: `Новая бронь · ${g.fullName}`, sub: g.source === 'website' ? 'с сайта' : 'создана вручную', dot: 'indigo' });
            });

        // Выезды (выселены сегодня)
        relGuests
            .filter(g => g.status === 'checked_out' && ymd(g.checkOutDate) === todayStr)
            .forEach(g => {
                events.push({ time: parseDate(g.checkOutDate) || now, label: `Выезд · ${g.fullName}`, sub: `комната ${roomNum(g)}`, dot: 'slate' });
            });

        events.sort((a, b) => a.time - b.time);
        const pastEvents = events.filter(e => e.time <= now).slice(-20);

        // Будущее: ожидаемые заезды, предстоящие выезды, закрытие смены
        const future = [];
        arrivalsExpected.forEach(g => {
            future.push({ label: `Заезд · ${g.fullName}`, sub: g.roomNumber ? `бронь · комната ${g.roomNumber}` : 'бронь · место не назначено', dot: 'indigo', when: 'ожидается' });
        });
        activeGuests
            .filter(g => ymd(g.checkOutDate) === todayStr && !expiredIds.has(g.id))
            .forEach(g => {
                const co = parseDate(g.checkOutDate);
                future.push({ label: `Выезд · ${g.fullName}`, sub: `комната ${roomNum(g)}`, dot: 'slate', when: co && g.checkOutDate.includes?.('T') ? fmtTime(co) : 'к расч. часу' });
            });
        if (isCashier && now.getHours() < 20) {
            future.push({ label: 'Закрытие смены', sub: 'появится в очереди в 19:30', dot: 'rose', when: '~20:00' });
        }

        return {
            activeCount: activeGuests.length, occupancyPct, occupiedBeds, totalBeds, freeBeds,
            incomeToday, totalDebt, debtorsCount: debtors.length,
            emehmonCount: emehmonPending.length + emehmonOut.length,
            arrivalsCount: arrivalsExpected.length,
            queue, events: pastEvents, future,
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rooms, guests, payments, expenses, shifts, clients, currentHostelId, todayStr]);

    const hour = now.getHours();
    const greeting = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
    const dateLabel = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

    const kpis = [
        { label: 'Гостей сейчас', raw: data.activeCount, fmt: (v) => v, sub: data.arrivalsCount > 0 ? `+${data.arrivalsCount} ожидается` : 'заездов не ожидается', icon: Users, color: 'indigo', tab: 'clients' },
        { label: 'Загрузка', raw: data.occupancyPct, fmt: (v) => `${v}%`, sub: `${data.occupiedBeds} из ${data.totalBeds} мест`, icon: BedDouble, color: data.occupancyPct >= 80 ? 'emerald' : 'amber', tab: 'rooms' },
        { label: 'Доход сегодня', raw: data.incomeToday, fmt: fmtMoney, sub: 'UZS', icon: TrendingUp, color: 'emerald', tab: null },
        { label: 'Долги', raw: data.totalDebt, fmt: fmtMoney, sub: `${data.debtorsCount} должн.`, icon: Wallet, color: data.totalDebt > 0 ? 'rose' : 'purple', tab: 'debts' },
        { label: 'E-mehmon', raw: data.emehmonCount, fmt: (v) => v, sub: data.emehmonCount > 0 ? 'требуют действия' : 'всё отправлено', icon: ClipboardCheck, color: data.emehmonCount > 0 ? 'amber' : 'emerald', tab: 'registrations' },
    ];

    const DOT = { emerald: 'bg-emerald-400', orange: 'bg-orange-400', slate: 'bg-slate-300', rose: 'bg-rose-400', indigo: 'bg-indigo-400' };

    return (
        <div className="max-w-6xl mx-auto">
            {/* Приветствие */}
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-1">
                <h1 className="text-xl md:text-2xl font-black text-slate-800">{greeting}, {(currentUser?.name || '').split(' ')[0]}</h1>
                <span className="text-sm text-slate-400">{dateLabel}</span>
            </div>
            <p className="text-sm text-slate-500 mb-5">Всё, что требует внимания сегодня — собрано ниже.</p>

            {/* KPI — живые цифры */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                {kpis.map(k => <KpiTile key={k.label} k={k} onGoTab={onGoTab} />)}
            </div>

            <div className="grid lg:grid-cols-[7fr_5fr] gap-4 items-start">
                {/* Очередь «Следующий шаг» */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100">
                        <Zap size={15} className="text-orange-500"/>
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">Следующий шаг</span>
                        <span className={`ml-auto text-[11px] font-black px-2.5 py-0.5 rounded-full ${data.queue.length > 0 ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {data.queue.length > 0 ? `${data.queue.length} ${data.queue.length === 1 ? 'задача' : data.queue.length < 5 ? 'задачи' : 'задач'}` : 'всё сделано ✓'}
                        </span>
                    </div>
                    {data.queue.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                            <div className="text-sm text-slate-400">Задач нет — просроченных выездов, долгов и неотправленных регистраций не найдено.</div>
                            <div className="flex justify-center gap-2 mt-4">
                                {isCashier && (
                                    <button onClick={() => onOpenCheckIn?.()}
                                        className="px-3.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold transition-colors">
                                        Заселить гостя
                                    </button>
                                )}
                                <button onClick={() => onGoTab?.('rooms')}
                                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-500 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors">
                                    Открыть комнаты
                                </button>
                            </div>
                        </div>
                    ) : data.queue.slice(0, 10).map(q => (
                        <div key={q.key} className="flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
                            <span className={`w-1 self-stretch rounded-full flex-shrink-0 ${STRIPE[q.color] || STRIPE.slate}`}/>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-slate-800">{q.title}</div>
                                <div className="text-xs text-slate-500 mt-0.5">{q.why}</div>
                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">{q.when}</div>
                            </div>
                            <div className="flex-shrink-0 self-center flex items-center gap-1.5">
                                {q.act2 && (
                                    <button onClick={q.act2.fn}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 border border-slate-200 hover:bg-slate-100 transition-colors">
                                        {q.act2.label}
                                    </button>
                                )}
                                <button onClick={q.act.fn}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors">
                                    {q.act.label}<ChevronRight size={13}/>
                                </button>
                            </div>
                        </div>
                    ))}
                    {data.queue.length > 10 && (
                        <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">и ещё {data.queue.length - 10}…</div>
                    )}
                </div>

                {/* Лента дня */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100">
                        <Clock size={15} className="text-slate-400"/>
                        <span className="text-xs font-black uppercase tracking-wider text-slate-500">Лента дня</span>
                    </div>
                    {data.events.length === 0 && data.future.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-slate-400">Сегодня пока не было событий.</div>
                    ) : (
                        <ul className="py-1.5">
                            {data.events.length === 0 && (
                                <li className="px-4 py-2 text-[12px] text-slate-400">Событий ещё не было.</li>
                            )}
                            {data.events.map((e, i) => (
                                <li key={'p' + i} className="flex items-start gap-3 px-4 py-2">
                                    <span className="w-10 flex-shrink-0 text-[11px] font-bold text-slate-400 tabular-nums pt-0.5">{e.noTime ? '—' : fmtTime(e.time)}</span>
                                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${DOT[e.dot] || 'bg-slate-300'}`}/>
                                    <div className="min-w-0">
                                        <div className="text-[13px] font-semibold text-slate-700 truncate">{e.label}</div>
                                        {e.sub && <div className="text-[11px] text-slate-400 truncate">{e.sub}</div>}
                                    </div>
                                </li>
                            ))}
                            {data.future.length > 0 && (
                                <>
                                    <li className="flex items-center gap-2 px-4 py-1.5" aria-hidden="true">
                                        <span className="w-10 flex-shrink-0 text-[10px] font-black uppercase tracking-wider text-orange-500 tabular-nums">{fmtTime(now)}</span>
                                        <span className="flex-1 border-t-2 border-dashed border-orange-200" />
                                        <span className="text-[10px] font-black uppercase tracking-wider text-orange-500">сейчас</span>
                                    </li>
                                    {data.future.map((e, i) => (
                                        <li key={'f' + i} className="flex items-start gap-3 px-4 py-2 opacity-55">
                                            <span className="w-10 flex-shrink-0 text-[10px] font-bold text-slate-400 pt-0.5 leading-tight">{e.when}</span>
                                            <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${DOT[e.dot] || 'bg-slate-300'}`}/>
                                            <div className="min-w-0">
                                                <div className="text-[13px] font-semibold text-slate-700 truncate">{e.label}</div>
                                                {e.sub && <div className="text-[11px] text-slate-400 truncate">{e.sub}</div>}
                                            </div>
                                        </li>
                                    ))}
                                </>
                            )}
                        </ul>
                    )}
                </div>
            </div>

            {/* Быстрые действия для кассира */}
            {isCashier && (
                <div className="flex flex-wrap gap-2 mt-5">
                    <button onClick={() => onOpenCheckIn?.()}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-sm font-bold transition-colors">
                        <UserPlus size={15}/> Заселить гостя
                    </button>
                    <button onClick={() => onGoTab?.('rooms')}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-300 text-slate-600 text-sm font-bold transition-colors">
                        <BedDouble size={15}/> К комнатам
                    </button>
                    <button onClick={() => onOpenShift?.()}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:border-rose-200 hover:text-rose-500 text-slate-600 text-sm font-bold transition-colors">
                        <Power size={15}/> Смена
                    </button>
                </div>
            )}
        </div>
    );
};

export default TodayView;
