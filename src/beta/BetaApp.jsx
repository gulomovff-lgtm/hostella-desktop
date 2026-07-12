import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions, PUBLIC_DATA_PATH } from '../firebase';
import { logAction } from '../utils/auditLog';
import { Construction } from 'lucide-react';
import { useAppData } from '../hooks/useAppData';
import { useExpenseActions } from '../hooks/useExpenseActions';
import { useGuestActions } from '../hooks/useGuestActions';
import { useShiftActions } from '../hooks/useShiftActions';
import { sendTelegramMessage } from '../utils/telegram';
import { verifyPassword, hashPassword } from '../utils/hash';
import { loadAppConfig, getConfigValue } from '../utils/appConfig';
import { HOSTELS, getTotalPaid } from '../utils/helpers';
import ExpenseModal from '../components/Modals/ExpenseModal';
import CheckInModal from '../components/Modals/CheckInModal';
import ShiftClosingModal from '../components/Modals/ShiftClosingModal';
import ChangePasswordModal from '../components/Modals/ChangePasswordModal';

import SmartNav from './components/SmartNav';
import TodayView from './components/TodayView';
import TopBarBeta from './components/TopBarBeta';
import CommandPalette from './components/CommandPalette';
import RoomsBeta from './components/RoomsBeta';
import GuestsBeta from './components/GuestsBeta';
import MoneyBeta from './components/MoneyBeta';
import GuestCardModal from './components/GuestCardModal';
import PayDebtModal from './components/PayDebtModal';
import ProfileView from './components/ProfileView';
import MobileNavBeta from './components/MobileNavBeta';

const SESSION_KEY = 'hostella_beta_user_v1';
const THEME_KEY = 'hostella_beta_theme';

// Служебный супер-аккаунт — та же проверка, что и в основном LoginScreen
const SUPER_LOGIN = 'Super';
const DEFAULT_SUPER_HASH = '73d1b1b1bc1dabfb97f216d897b7968e44b06457920f00f2dc6c1ed3be25ad4c';

// Глобальный стиль беты: курсор, видимый фокус для клавиатуры, reduced-motion
const BetaStyles = () => (
    <style>{`
        .beta-root button:not(:disabled){cursor:pointer}
        .beta-root button:focus-visible,.beta-root input:focus-visible,.beta-root textarea:focus-visible,.beta-root a:focus-visible{
            outline:2px solid #e88c40;outline-offset:2px;border-radius:8px}
        @media (prefers-reduced-motion: reduce){
            .beta-root *,.beta-root *::before,.beta-root *::after{transition:none!important;animation:none!important}}
    `}</style>
);

// Названия разделов, которые в бете пока не реализованы
const STUB_LABELS = {
    tasks: 'Задачи', dashboard: 'Статистика', calendar: 'Календарь', bookings: 'Брони',
    cadastre: 'Кадастр', clients: 'Клиенты', debts: 'Долги', registrations: 'E-mehmon',
    guesthistory: 'История гостей', manualstay: 'Ручной учёт', referrals: 'Бонусы',
    expenses: 'Расходы', reports: 'Отчёты', analytics: 'Аналитика',
    staff: 'Персонал', pricePerms: 'Понижение цены', shifts: 'Смены', telegram: 'Telegram',
    promos: 'Промокоды', hostelconfig: 'Настройки хостела', versions: 'Версии клиентов',
    auditlog: 'Аудит', sessions: 'Сессии',
};

// ─── Экран логина беты ────────────────────────────────────────────────────────
const BetaLogin = ({ users, onLogin, usersReady }) => {
    const [login, setLogin] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (busy) return;
        setError('');
        setBusy(true);
        try {
            let user;
            if (login === SUPER_LOGIN) {
                const superHash = getConfigValue('superPassHash') || DEFAULT_SUPER_HASH;
                const inputHash = await hashPassword(pass);
                if (inputHash !== superHash) throw new Error('wrongpass');
                user = { name: 'Super Admin', login: SUPER_LOGIN, role: 'super', hostelId: 'all' };
            } else {
                const u = (users || []).find(u => u.login?.toLowerCase() === login.toLowerCase());
                if (!u) throw new Error('notfound');
                const { match } = await verifyPassword(pass, u.pass);
                if (!match) throw new Error('wrongpass');
                user = u;
            }
            onLogin(user);
        } catch (err) {
            setError(err.message === 'notfound' ? 'Пользователь не найден' : 'Неверный пароль');
            setBusy(false);
        }
    };

    return (
        <div className="beta-root min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--nav-bg)' }}>
            <BetaStyles />
            <form onSubmit={submit} className="w-full max-w-sm">
                <div className="flex items-center justify-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl overflow-hidden">
                        <img src="https://hostella.uz/logo.png" alt="H" className="w-full h-full object-cover" />
                    </div>
                    <div className="text-2xl font-black text-white tracking-tight">Hostella</div>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md"
                        style={{ background: 'rgba(232,140,64,0.2)', color: '#f5b574', border: '1px solid rgba(232,140,64,0.4)' }}>
                        Beta
                    </span>
                </div>
                <p className="text-center text-xs mb-8" style={{ color: 'var(--nav-muted)' }}>
                    Новый интерфейс · та же база, те же логины. Основное приложение продолжает работать как раньше.
                </p>
                <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <label className="block text-[11px] font-black uppercase tracking-wider mb-1.5" style={{ color: 'var(--nav-muted)' }}>Логин</label>
                    <input value={login} onChange={e => setLogin(e.target.value)} autoFocus autoComplete="username"
                        className="w-full mb-4 px-3.5 py-2.5 rounded-xl text-sm text-white outline-none"
                        style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.14)' }} />
                    <label className="block text-[11px] font-black uppercase tracking-wider mb-1.5" style={{ color: 'var(--nav-muted)' }}>Пароль</label>
                    <input type="password" value={pass} onChange={e => setPass(e.target.value)} autoComplete="current-password"
                        className="w-full mb-4 px-3.5 py-2.5 rounded-xl text-sm text-white outline-none"
                        style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.14)' }} />
                    {error && <div className="text-xs font-bold mb-3" style={{ color: '#fca5a5' }}>{error}</div>}
                    <button type="submit" disabled={busy || !usersReady}
                        className="w-full py-2.5 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50"
                        style={{ background: 'linear-gradient(140deg,#e88c40,#c86a20)' }}>
                        {busy ? 'Проверяю…' : usersReady ? 'Войти' : 'Загрузка…'}
                    </button>
                </div>
            </form>
        </div>
    );
};

// ─── Приложение ───────────────────────────────────────────────────────────────
const BetaApp = () => {
    const [firebaseUser, setFirebaseUser] = useState(null);
    const [authReady, setAuthReady] = useState(false);
    const [currentUser, setCurrentUser] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
    });
    const [activeTab, setActiveTab] = useState('today');
    const [hostelFilter, setHostelFilter] = useState(() => {
        try {
            const u = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
            return u?.hostelId && u.hostelId !== 'all' ? u.hostelId : 'all';
        } catch { return 'all'; }
    });
    const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'green');
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [guestCard, setGuestCard] = useState(null);
    const [toast, setToast] = useState(null);
    const [expenseModal, setExpenseModal] = useState(false);
    const [payModal, setPayModal] = useState(null); // гость, по которому принимаем оплату
    const [checkInModal, setCheckInModal] = useState({ open: false, room: null, bedId: null, date: null, client: null, bookingId: null });
    const [shiftModal, setShiftModal] = useState(false);
    const [changePassOpen, setChangePassOpen] = useState(false);
    const [undoStack, setUndoStack] = useState([]); // родные хуки кладут сюда отменяемые действия

    useEffect(() => {
        loadAppConfig().catch(() => {});
        signInAnonymously(auth).catch(err => console.error(err));
        return onAuthStateChanged(auth, (u) => { setFirebaseUser(u); setAuthReady(true); });
    }, []);

    useEffect(() => {
        localStorage.setItem(THEME_KEY, theme);
        if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
        else delete document.documentElement.dataset.theme;
    }, [theme]);

    const data = useAppData(firebaseUser, currentUser);
    const { rooms, guests, payments, expenses, clients, usersList, tasks, shifts, registrations, cadastreRegs, priceWhitelist, hostelConfig, isOnline } = data;

    // Как в основном приложении: аккаунт удалили — выходим
    useEffect(() => {
        if (!currentUser || currentUser.role === 'super') return;
        if (!usersList.length) return;
        if (!usersList.find(u => u.login === currentUser.login)) handleLogout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [usersList]);

    const handleLogin = (user) => {
        const { pass: _p, ...sessionUser } = user;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
        setCurrentUser(sessionUser);
        setHostelFilter(user.hostelId && user.hostelId !== 'all' ? user.hostelId : 'all');
        setActiveTab('today');
    };

    const handleLogout = () => {
        sessionStorage.removeItem(SESSION_KEY);
        setCurrentUser(null);
    };

    const showToast = useCallback((msg, type = 'info') => {
        setToast({ msg, type });
        window.clearTimeout(showToast._t);
        showToast._t = window.setTimeout(() => setToast(null), 3200);
    }, []);

    const inMainApp = useCallback((what) => {
        showToast(`${what} — пока в основном приложении. Перенесём в бету следующим шагом.`);
    }, [showToast]);

    // ── Запись расхода: тот же хук, что и в основном приложении ──
    const { handleAddExpense } = useExpenseActions({
        currentUser: currentUser || {},
        selectedHostelFilter: hostelFilter,
        expenses, usersList, lang: 'ru',
        setExpenseModal, setUndoStack,
        showNotification: showToast,
        isOnline,
    });

    const openExpense = useCallback(() => {
        // Основное приложение не пишет расходы с hostelId='all' — требуем выбрать хостел
        if ((currentUser?.role === 'admin' || currentUser?.role === 'super') && hostelFilter === 'all') {
            showToast('Сначала выберите хостел в верхней панели — расход привязывается к конкретному хостелу.', 'warning');
            return;
        }
        setExpenseModal(true);
    }, [currentUser, hostelFilter, showToast]);

    // ── Приём оплаты: тот же handlePayment, что и в основном приложении.
    // Ненужные бете сеттеры — заглушки; закрытие карточки гостя пробрасываем.
    const noop = () => {};
    const { handlePayment, handleCheckInSubmit, handleUndo } = useGuestActions({
        currentUser: currentUser || {},
        rooms, guests, clients, cadastreRegs,
        selectedHostelFilter: hostelFilter, lang: 'ru',
        checkInModal, setCheckInModal,
        setGuestDetailsModal: (v) => { if (!v?.open) setGuestCard(null); },
        setMoveGuestModal: noop,
        setUndoStack, setUndoHistoryOpen: noop,
        showNotification: showToast, isOnline,
        setEmehmonReminder: noop, setEmehmonArrivalPrompt: noop,
    });

    const guestDebt = useCallback((g) =>
        (g && g.status !== 'booking') ? Math.max(0, (g.totalPrice || 0) - getTotalPaid(g)) : 0, []);

    const openPayDebt = useCallback((g) => setPayModal(g), []);

    // ── Отмена последнего действия (родной handleUndo) ──
    const undoTop = undoStack[0] || null;
    const [undoBusy, setUndoBusy] = useState(false);
    useEffect(() => {
        // чип отмены живёт 60 секунд, потом убираем сам элемент из стека
        if (!undoTop) return;
        const t = setTimeout(() => {
            setUndoStack(prev => prev.filter(x => x.id !== undoTop.id));
        }, 60000);
        return () => clearTimeout(t);
    }, [undoTop?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const runUndo = useCallback(async () => {
        if (!undoTop || undoBusy) return;
        setUndoBusy(true);
        try {
            await handleUndo(undoTop);
            setUndoStack(prev => prev.filter(x => x.id !== undoTop.id));
            showToast('Отменено: ' + (undoTop.label || ''), 'success');
        } catch (e) {
            showToast('Не удалось отменить: ' + (e.message || ''), 'error');
        } finally {
            setUndoBusy(false);
        }
    }, [undoTop, undoBusy, handleUndo, showToast]);

    // ── Заселение: как в основном — только кассир ──
    const openCheckIn = useCallback((payload = {}) => {
        if (currentUser?.role === 'admin' || currentUser?.role === 'super') {
            showToast('Администратор не может выполнять заселение', 'error');
            return;
        }
        setCheckInModal({ open: true, room: null, bedId: null, date: null, client: null, bookingId: null, ...payload });
    }, [currentUser, showToast]);

    const openCheckInBooking = useCallback((booking) => {
        openCheckIn({ date: booking.checkInDate || null, bookingId: booking.id, client: booking });
    }, [openCheckIn]);

    // ── Закрытие смены: тот же handleEndShift, что и в основном приложении ──
    const { handleEndShift, handleChangePassword } = useShiftActions({
        currentUser: currentUser || {}, setCurrentUser,
        usersList, shifts, payments,
        showNotification: showToast,
        onLogout: handleLogout,
    });

    const openShift = useCallback(() => {
        if (currentUser?.role === 'admin' || currentUser?.role === 'super') {
            showToast('Смены закрывает кассир — у администратора смен нет.', 'warning');
            return;
        }
        setShiftModal(true);
    }, [currentUser, showToast]);

    // Запрос на понижение цены до заселения — копия handleCheckinPriceRequest из App.jsx
    const handleCheckinPriceRequest = async ({ guestName, passport, roomNumber, hostelId, requestedPrice }) => {
        const price = parseInt(requestedPrice) || 0;
        if (price <= 0) { showToast('Укажите корректную цену', 'error'); return null; }
        const chatIds = getConfigValue('priceApprovalChatIds') || [];
        if (!chatIds.length) { showToast('Не задан Telegram ID для одобрения', 'error'); return null; }
        try {
            const payload = {
                guestName: guestName || '',
                roomNumber: roomNumber || '',
                hostelId: hostelId || currentUser?.hostelId || '',
                cashierName: currentUser?.name || currentUser?.login || '',
                currentPrice: 0,
                requestedPrice: price,
            };
            const ref = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'priceRequests'), {
                type: 'checkin',
                guestId: null,
                passport: passport || '',
                cashierId: currentUser?.id || currentUser?.login || '',
                status: 'pending',
                createdAt: new Date().toISOString(),
                ...payload,
            });
            await httpsCallable(functions, 'sendPriceRequest')({ requestId: ref.id, chatIds, ...payload });
            logAction(currentUser, 'price_request_checkin', { passport, requestedPrice: price });
            showToast('🔻 Запрос отправлен на одобрение', 'success');
            return ref.id;
        } catch (e) {
            showToast('Ошибка запроса: ' + (e.message || ''), 'error');
            return null;
        }
    };

    // ── Фильтр по хостелу ──
    const byHostel = useCallback((arr) => (
        hostelFilter === 'all' ? arr : (arr || []).filter(x => x.hostelId === hostelFilter)
    ), [hostelFilter]);

    const fGuests = useMemo(() => byHostel(guests), [guests, byHostel]);
    const fRooms = useMemo(() => byHostel(rooms), [rooms, byHostel]);
    const fPayments = useMemo(() => byHostel(payments), [payments, byHostel]);
    const fExpenses = useMemo(() => byHostel(expenses), [expenses, byHostel]);
    const fRegistrations = useMemo(() => byHostel(registrations), [registrations, byHostel]);

    const availableHostels = useMemo(() => {
        if (!currentUser) return [];
        if (currentUser.hostelId === 'all' || currentUser.role === 'super' || currentUser.role === 'admin') {
            return ['all', ...Object.keys(HOSTELS)];
        }
        const list = currentUser.allowedHostels?.length ? currentUser.allowedHostels : [currentUser.hostelId];
        return list.filter(Boolean);
    }, [currentUser]);

    // ── Бейджи (как в основном приложении) ──
    const pendingBookingsCount = useMemo(() =>
        (guests || []).filter(g => g.status === 'booking' && g.source === 'website').length, [guests]);
    const pendingTasksCount = useMemo(() =>
        byHostel(tasks).filter(t => t.status !== 'done').length, [tasks, byHostel]);
    const registrationsAlertCount = useMemo(() => {
        const now = Date.now();
        return fRegistrations.filter(r => {
            if (r.status === 'removed') return false;
            return new Date((r.endDate || '') + 'T23:59:59').getTime() <= now;
        }).length;
    }, [fRegistrations]);

    // ── Ctrl+K ──
    useEffect(() => {
        const h = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setPaletteOpen(o => !o);
            }
            if (e.key === 'Escape') { setPaletteOpen(false); setGuestCard(null); }
        };
        document.addEventListener('keydown', h);
        return () => document.removeEventListener('keydown', h);
    }, []);

    if (!authReady) {
        return <div className="min-h-screen flex items-center justify-center text-sm" style={{ background: 'var(--nav-bg)', color: 'var(--nav-muted)' }}>Загрузка…</div>;
    }
    if (!currentUser) {
        return <BetaLogin users={usersList} onLogin={handleLogin} usersReady={usersList.length > 0} />;
    }

    const isCashierUser = currentUser.role !== 'admin' && currentUser.role !== 'super';
    const hostelKey = isCashierUser
        ? (currentUser.hostelId || 'hostel1')
        : (hostelFilter !== 'all' ? hostelFilter : 'hostel1');
    const currentCheckInHour = hostelConfig?.[hostelKey]?.checkInHour ?? 14;
    const currentCheckOutHour = hostelConfig?.[hostelKey]?.checkOutHour ?? 12;

    const myShiftActive = !!(shifts || []).find(s =>
        !s.endTime && (s.staffId === currentUser.id || (s.staffLogin && s.staffLogin === currentUser.login)));

    const screenProps = {
        rooms: fRooms, guests: fGuests, payments: fPayments, expenses: fExpenses, shifts,
        currentUser, currentHostelId: hostelFilter,
        onOpenGuest: setGuestCard, onGoTab: setActiveTab,
        onOpenShift: openShift,
        onOpenCheckIn: () => openCheckIn(),
        onOpenExpense: openExpense,
        onPayDebt: openPayDebt,
        onCheckInBooking: openCheckInBooking,
        onCheckInBed: isCashierUser ? (room, bedId) => openCheckIn({ room, bedId }) : null,
        inMainApp,
    };

    const known = ['today', 'rooms', 'clients', 'expenses', 'profile'];

    return (
        <div className="beta-root h-screen flex flex-col overflow-hidden" style={{ background: theme === 'dark' ? '#0b1416' : '#f1f5f9' }}>
            <BetaStyles />
            <TopBarBeta
                isOnline={isOnline}
                currentUser={currentUser}
                hostels={HOSTELS}
                availableHostels={availableHostels}
                hostelFilter={hostelFilter}
                setHostelFilter={setHostelFilter}
                theme={theme}
                setTheme={setTheme}
                onOpenSearch={() => setPaletteOpen(true)}
            />
            <div className="flex flex-1 overflow-hidden">
                <SmartNav
                    currentUser={currentUser}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    lang="ru"
                    pendingTasksCount={pendingTasksCount}
                    pendingBookingsCount={pendingBookingsCount}
                    registrationsAlertCount={registrationsAlertCount}
                    canPerformActions={true}
                    onOpenExpense={openExpense}
                    onOpenCheckIn={() => openCheckIn()}
                    onOpenShift={openShift}
                    onOpenProfile={() => setActiveTab('profile')}
                    shiftActive={myShiftActive}
                    hostelName={currentUser.hostelId === 'all' ? 'Все хостелы' : (HOSTELS[currentUser.hostelId]?.name || '')}
                />
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
                    {activeTab === 'today' && <TodayView {...screenProps} />}
                    {activeTab === 'rooms' && <RoomsBeta {...screenProps} />}
                    {activeTab === 'clients' && <GuestsBeta {...screenProps} registrationsAlertCount={registrationsAlertCount} />}
                    {activeTab === 'expenses' && <MoneyBeta {...screenProps} />}
                    {activeTab === 'profile' && (
                        <ProfileView
                            currentUser={currentUser}
                            hostels={HOSTELS}
                            shifts={shifts}
                            payments={payments}
                            expenses={expenses}
                            guests={guests}
                            usersList={usersList}
                            rooms={rooms}
                            theme={theme}
                            setTheme={setTheme}
                            onChangePassword={() => setChangePassOpen(true)}
                            onOpenShift={openShift}
                            onLogout={handleLogout}
                            inMainApp={inMainApp}
                        />
                    )}
                    {!known.includes(activeTab) && (
                        <div className="max-w-xl mx-auto mt-16 text-center">
                            <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center">
                                <Construction size={26} strokeWidth={2} />
                            </div>
                            <div className="text-lg font-black text-slate-700">«{STUB_LABELS[activeTab] || activeTab}» — пока в основном приложении</div>
                            <p className="text-sm text-slate-500 mt-2">
                                Бета переносит разделы по одному, не трогая рабочую систему.
                                Этот экран уже есть в классическом интерфейсе.
                            </p>
                            <button onClick={() => { window.location.href = '/'; }}
                                className="mt-5 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                                style={{ background: 'linear-gradient(140deg,#e88c40,#c86a20)' }}>
                                Открыть основное приложение
                            </button>
                        </div>
                    )}
                </main>
            </div>

            <MobileNavBeta
                currentUser={currentUser}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onOpenCheckIn={() => openCheckIn()}
                badge={registrationsAlertCount + pendingBookingsCount}
            />

            {paletteOpen && (
                <CommandPalette
                    guests={fGuests}
                    payments={fPayments}
                    currentUser={currentUser}
                    onClose={() => setPaletteOpen(false)}
                    onGoTab={(t) => { setActiveTab(t); setPaletteOpen(false); }}
                    onOpenGuest={(g) => { setGuestCard(g); setPaletteOpen(false); }}
                    onOpenExpense={() => { setPaletteOpen(false); openExpense(); }}
                    onOpenCheckIn={() => { setPaletteOpen(false); openCheckIn(); }}
                    inMainApp={(w) => { setPaletteOpen(false); inMainApp(w); }}
                />
            )}

            {checkInModal.open && (
                <CheckInModal
                    initialRoom={checkInModal.room}
                    preSelectedBedId={checkInModal.bedId}
                    initialDate={checkInModal.date}
                    initialClient={checkInModal.client}
                    allRooms={fRooms}
                    guests={guests}
                    clients={guests}
                    clientsDb={clients}
                    onClose={() => setCheckInModal({ open: false, room: null, bedId: null, date: null, client: null, bookingId: null })}
                    onSubmit={handleCheckInSubmit}
                    onCheckinPriceRequest={handleCheckinPriceRequest}
                    priceWhitelist={priceWhitelist}
                    notify={showToast}
                    lang="ru"
                    currentUser={currentUser}
                    checkInHour={currentCheckInHour}
                    checkOutHour={currentCheckOutHour}
                />
            )}

            {changePassOpen && (
                <ChangePasswordModal
                    currentUser={currentUser}
                    users={usersList}
                    onClose={() => setChangePassOpen(false)}
                    onChangePassword={handleChangePassword}
                    lang="ru"
                />
            )}

            {shiftModal && (
                <ShiftClosingModal
                    user={usersList.find(u => u.id === currentUser.id) || currentUser}
                    payments={payments}
                    expenses={fExpenses}
                    onClose={() => setShiftModal(false)}
                    onEndShift={handleEndShift}
                    onLogout={handleLogout}
                    notify={showToast}
                    lang="ru"
                    sendTelegramMessage={sendTelegramMessage}
                />
            )}

            {expenseModal && (
                <ExpenseModal
                    onClose={() => setExpenseModal(false)}
                    onSubmit={handleAddExpense}
                    lang="ru"
                    currentUser={currentUser}
                    usersList={usersList}
                    selectedHostelFilter={hostelFilter}
                />
            )}

            {guestCard && (
                <GuestCardModal guest={guestCard} rooms={rooms} payments={payments}
                    onClose={() => setGuestCard(null)} inMainApp={inMainApp}
                    onPayDebt={openPayDebt} />
            )}

            {payModal && (
                <PayDebtModal
                    guest={payModal}
                    debt={guestDebt(payModal)}
                    onSubmit={(amounts) => handlePayment(payModal.id, amounts)}
                    onClose={() => setPayModal(null)}
                />
            )}

            {undoTop && (
                <div className="fixed bottom-6 right-5 z-[190] flex items-center gap-1 rounded-xl shadow-2xl overflow-hidden"
                    style={{ background: '#1a3c40', border: '1px solid rgba(255,255,255,0.15)' }}>
                    <button onClick={runUndo} disabled={undoBusy}
                        className="flex items-center gap-2 pl-4 pr-3 py-2.5 text-xs font-bold text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                        title={undoTop.label}>
                        <span aria-hidden="true">↩</span>
                        <span className="max-w-[200px] truncate">{undoBusy ? 'Отменяю…' : `Отменить: ${undoTop.label || 'действие'}`}</span>
                    </button>
                    <button onClick={() => setUndoStack(prev => prev.filter(x => x.id !== undoTop.id))}
                        aria-label="Скрыть"
                        className="px-2.5 py-2.5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors text-xs font-bold">
                        ✕
                    </button>
                </div>
            )}

            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl text-sm font-bold text-white shadow-2xl"
                    style={{
                        background: toast.type === 'success' ? '#0f766e' : toast.type === 'error' ? '#b91c1c' : toast.type === 'warning' ? '#b45309' : '#1a3c40',
                        border: '1px solid rgba(255,255,255,0.15)', maxWidth: '90vw',
                    }}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
};

export default BetaApp;
