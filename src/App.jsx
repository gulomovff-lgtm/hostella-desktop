import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  increment,
  writeBatch
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions, PUBLIC_DATA_PATH } from './firebase';
import { useAppData } from './hooks/useAppData';
import useNow from './hooks/useNow';
import {
  getTimeLeftLabel,
  HOSTELS,
  getTotalPaid,
  pluralize,
  getLocalDateString,
  getLocalDatetimeString,
  getStayDetails,
  checkCollision,
  calculateSalary,
  exportToExcel,
  printDocument,
  printDebts,
  printReport,
  getNormalizedCountry,
  Flag
} from './utils/helpers';
import { sendTelegramMessage } from './utils/telegram';
import { hashPassword } from './utils/hash';

import { 
  LayoutDashboard, 
  BedDouble, 
  Users, 
  LogOut, 
  Plus, 
  Wallet,
  Edit,
  Building2,
  Calendar,
  CalendarIcon,
  User,
  Lock,
  CheckCircle2,
  MapPin,
  FileText,
  PlusCircle,
  Power,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertCircle,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Ban,
  Copy,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Download,
  XCircle,
  UserCog,
  Loader2,
  Split, 
  ArrowLeftRight,
  ArrowRight,
  Check,
  Printer, 
  Clock,   
  Coins,    
  Magnet, 
  Wrench,
  CalendarDays,
  X,
  Smartphone, 
  Wifi,
  WifiOff,
  Globe,
  History,
  Scissors,
  Upload,
  FileSpreadsheet,
  Merge,
  Square,
  CheckSquare,
  ScanLine,
  Timer,
  Home,
  UserPlus,
  DollarSign,
  CreditCard,
  QrCode,
  Activity,    // < ДОБАВЛЕНО (для ChartsSection и CalendarView)
  BarChart3,   // < ДОБАВЛЕНО (для ChartsSection)
  TrendingUp,
  TrendingDown,
  Phone,
  Minus
} from 'lucide-react';

// --- Вынесенные компоненты ---
import ActionBtn from './components/UI/ActionBtn';
import StatButton from './components/UI/StatButton';
import LoginScreen from './components/UI/LoginScreen';
import Button from './components/UI/Button';
import Card from './components/UI/Card';
import NavItem from './components/UI/NavItem';
import Notification from './components/UI/Notification';
import ShiftBlockScreen from './components/UI/ShiftBlockScreen';
import StepIndicator from './components/UI/StepIndicator';
import SimpleInput from './components/UI/SimpleInput';
import SimpleSelect from './components/UI/SimpleSelect';
import TopBar from './components/Layout/TopBar';
import Navigation from './components/Layout/Navigation';
import MobileNavigation from './components/Layout/MobileNavigation';
import GlobalSearch from './components/Search/GlobalSearch';
import ChangePasswordModal from './components/Modals/ChangePasswordModal';
import ClientEditModal from './components/Modals/ClientEditModal';
import CreateDebtModal from './components/Modals/CreateDebtModal';
// --- Views ---
import DashboardView from './components/Views/DashboardView';
import StaffView from './components/Views/StaffView';
import TaskManager from './components/Views/TasksView';
import DebtsView from './components/Views/DebtsView';
import ExpensesView from './components/Views/ExpensesView';
import RoomsView from './components/Views/RoomsView';
import CalendarView from './components/Views/CalendarView';
import ClientsView from './components/Views/ClientsView';
import ShiftsView from './components/Views/ShiftsView';
import TelegramSettingsView from './components/Views/TelegramSettingsView';
import AuditLogView from './components/Views/AuditLogView';
import PromoCodesView from './components/Views/PromoCodesView';
import ReferralView from './components/Views/ReferralView';
import { logAction } from './utils/auditLog';
import { useGuestActions }        from './hooks/useGuestActions';
import { useClientActions }       from './hooks/useClientActions';
import { useShiftActions }        from './hooks/useShiftActions';
import { useRegistrationActions } from './hooks/useRegistrationActions';
import { useExpenseActions }      from './hooks/useExpenseActions';
import { useRecurringExpenses }   from './hooks/useRecurringExpenses';
import CheckInModal from './components/Modals/CheckInModal';
import ClientHistoryModal from './components/Modals/ClientHistoryModal';
import GuestRegistrationModal from './components/Modals/GuestRegistrationModal';
import RegistrationsView from './components/Views/RegistrationsView';
import ExpenseModal from './components/Modals/ExpenseModal';
import ReportsView from './components/Views/ReportsView';
import GuestDetailsModal from './components/Modals/GuestDetailsModal';
import MoveGuestModal from './components/Modals/MoveGuestModal';
import RoomFormModal from './components/Modals/RoomFormModal';
import ShiftClosingModal from './components/Modals/ShiftClosingModal';
import BookingsView from './components/Views/BookingsView';
import GroupCheckInModal from './components/Modals/GroupCheckInModal';
import RoomRentalModal from './components/Modals/RoomRentalModal';
import TemplateEditorModal from './components/Modals/TemplateEditorModal';
import HostelSettingsView from './components/Views/HostelSettingsView';
import OnboardingTour, { LS_KEY as ONBOARDING_KEY } from './components/UI/OnboardingTour';
import UndoHistoryModal from './components/Modals/UndoHistoryModal';
import TRANSLATIONS from './constants/translations';
import { COUNTRY_MAP, COUNTRIES, COUNTRY_FLAGS } from './constants/countries';
import { DAILY_SALARY, DEFAULT_USERS } from './constants/config';

// --- STYLES ---
const inputClass = "w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm shadow-sm font-medium text-slate-700 no-spinner";
const labelClass = "block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide ml-1";



// Firebase config, db, auth, functions, PUBLIC_DATA_PATH – imported from './firebase'









// --- UI COMPONENTS ---












// --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ (Вставить перед const App) ---






// ? ГЛАВНЫЙ КОМПОНЕНТ APP
function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            setIsSearchOpen(prev => !prev);
        }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);
  // Prevent mouse wheel from changing number input values
  useEffect(() => {
    const prevent = () => {
      if (document.activeElement?.type === 'number') document.activeElement.blur();
    };
    document.addEventListener('wheel', prevent, { passive: true });
    return () => document.removeEventListener('wheel', prevent);
  }, []);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [roomFilter, setRoomFilter] = useState('all');
  const [selectedHostelFilter, setSelectedHostelFilter] = useState('hostel1');
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);
  const [lang, setLang] = useState('ru');
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(null); // 0-100

  const showNotification = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev.slice(-2), { id, message, type }]);
  };
  
  // --- Data from Firebase (via custom hook) ---
  const {
    rooms, guests, expenses, clients, payments,
    usersList, tasks, shifts, tgSettings, auditLog, promos, registrations,
    recurringExpenses, hostelConfig,
    isOnline, permissionError, isDataReady,
  } = useAppData(firebaseUser, currentUser);

  const [checkInModal, setCheckInModal] = useState({ open: false, room: null, bedId: null, date: null, client: null, bookingId: null }); 
  const [groupCheckInModal,  setGroupCheckInModal ] = useState(false);
  const [roomRentalModal,    setRoomRentalModal   ] = useState(false);
  const [templateEditorModal, setTemplateEditorModal] = useState(false);
  const [registrationModal,  setRegistrationModal ] = useState(false);
  const [showOnboarding,     setShowOnboarding    ] = useState(() => localStorage.getItem(ONBOARDING_KEY) !== 'done');
  const [undoStack,         setUndoStack         ] = useState([]);
  const [undoHistoryOpen,   setUndoHistoryOpen   ] = useState(false);
  const [guestDetailsModal, setGuestDetailsModal] = useState({ open: false, guest: null });
  const [moveGuestModal, setMoveGuestModal] = useState({ open: false, guest: null });
  const [expenseModal, setExpenseModal] = useState(false);
  const [expenseCatFilter, setExpenseCatFilter] = useState('Все');
  const [expSearch, setExpSearch] = useState('');
  const [shiftModal, setShiftModal] = useState(false);
  const [addRoomModal, setAddRoomModal] = useState(false);
  const [editRoomModal, setEditRoomModal] = useState({ open: false, room: null });
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [clientHistoryModal, setClientHistoryModal] = useState({ open: false, client: null });
  useEffect(() => {
    if (!guests.length || !currentUser) return;

    const runAutoCheckout = async () => {
        const now = new Date();
        // Порог: просрочка > 24 часов
        const threshold24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const batch = writeBatch(db);
        let count = 0;

        guests.forEach(guest => {
            if (guest.status !== 'active') return;
            if (!guest.checkOutDate) return;

            let checkOut = new Date(guest.checkOutDate);
            if (isNaN(checkOut.getTime())) return;
            if (typeof guest.checkOutDate === 'string' && !guest.checkOutDate.includes('T')) {
                checkOut.setHours(23, 59, 59, 999);
            }

            // Правило 1: время вышло больше 24 часов назад
            const expiredOver24h = checkOut < threshold24h;

            // Правило 2: на том же месте появился другой активный гость (заново заселён, не продлён)
            const hasNewerGuest = guests.some(g2 =>
                g2.id !== guest.id &&
                g2.status === 'active' &&
                g2.roomId === guest.roomId &&
                String(g2.bedId) === String(guest.bedId) &&
                new Date(g2.checkInDate || g2.checkInDateTime || 0) > new Date(guest.checkInDate || guest.checkInDateTime || 0)
            );

            if (!expiredOver24h && !hasNewerGuest) return;

            const guestRef = doc(db, ...PUBLIC_DATA_PATH, 'guests', guest.id);
            batch.update(guestRef, {
                status: 'checked_out',
                autoCheckedOut: true,
                systemComment: hasNewerGuest
                    ? 'Авто-выселение (новый гость заселён на место)'
                    : 'Авто-выселение (просрочка > 24ч)',
            });

            const room = rooms.find(r => r.id === guest.roomId);
            if (room) {
                batch.update(doc(db, ...PUBLIC_DATA_PATH, 'rooms', room.id), {
                    occupied: increment(-1),
                });
            }
            count++;
        });

        if (count > 0) {
            try {
                await batch.commit();
                showNotification(`Авто-выселение: ${count} гостей`, 'warning');
            } catch (e) {
                console.error('Auto-checkout error:', e);
            }
        }
    };

    // Проверка при загрузке и каждые 30 минут
    runAutoCheckout();
    const interval = setInterval(runAutoCheckout, 30 * 60 * 1000);

    return () => clearInterval(interval);
}, [guests, rooms, currentUser]);

  const activeShiftInMyHostel = useMemo(() => {
      if (!currentUser || currentUser.role === 'admin' || currentUser.role === 'super') return null;
      return shifts.find(s => 
          s.hostelId === currentUser.hostelId && 
          !s.endTime && 
          s.staffId !== currentUser.id 
      );
  }, [shifts, currentUser]);

  const activeUserForBlock = useMemo(() => {
      if (!activeShiftInMyHostel) return null;
      return usersList.find(u => u.id === activeShiftInMyHostel.staffId);
  }, [activeShiftInMyHostel, usersList]);

  useEffect(() => {
    const handleEsc = (event) => {
        if (event.key === 'Escape') {
            if (checkInModal.open) setCheckInModal({open: false, room: null, bedId: null, date: null});
            if (guestDetailsModal.open) setGuestDetailsModal({open: false, guest: null});
            if (moveGuestModal.open) setMoveGuestModal({open: false, guest: null});
            if (expenseModal) setExpenseModal(false);
            if (shiftModal) setShiftModal(false);
            if (addRoomModal) setAddRoomModal(false);
            if (editRoomModal.open) setEditRoomModal({open: false, room: null});
            if (clientHistoryModal.open) setClientHistoryModal({open: false, client: null});
        }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [checkInModal, guestDetailsModal, moveGuestModal, expenseModal, shiftModal, addRoomModal, editRoomModal, clientHistoryModal]);

  // Авто-обновление через electron-updater (IPC)
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return; // в браузере не работаем

    if (api.onUpdateAvailable) {
      api.onUpdateAvailable((info) => {
        setHasUpdate(true);
        setUpdateProgress(prev => (prev !== null && prev > 0) ? prev : 0);
      });
    }
    if (api.onUpdateProgress) {
      api.onUpdateProgress((p) => {
        setUpdateProgress(Math.round(p.percent || 0));
      });
    }
    if (api.onUpdateDownloaded) {
      api.onUpdateDownloaded(() => {
        setUpdateProgress(null);
        setUpdateDownloaded(true);
      });
    }
    if (api.onUpdateError) {
      api.onUpdateError((msg) => {
        setHasUpdate(false);
        setUpdateProgress(null);
      });
    }
  }, []);

  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error(err));
    const unsubAuth = onAuthStateChanged(auth, (user) => { 
      setFirebaseUser(user); 
      setIsLoadingAuth(false); 
    });
    
    // ? ИСПРАВЛЕНИЕ: Восстановление пользователя и выбор правильного хостела
    const savedUser = sessionStorage.getItem('hostella_user_v4');
    if (savedUser) {
        const u = JSON.parse(savedUser);
        setCurrentUser(u);
        if (u.hostelId && u.hostelId !== 'all') setSelectedHostelFilter(u.hostelId);
        if (u.role === 'cashier') setActiveTab('rooms');
    }
    
    return () => {
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'cashier') return;
    if (shifts.length === 0) return;
    
    const myActiveShift = shifts.find(s => s.staffId === currentUser.id && !s.endTime);
    
    if (!myActiveShift) {
      const otherActiveShift = shifts.find(s => 
        s.hostelId === currentUser.hostelId && 
        !s.endTime && 
        s.staffId !== currentUser.id
      );
      
      if (!otherActiveShift) {

        handleStartShift();
      }
    }
  }, [currentUser, shifts]);

  const handleLogin = (user) => { 
    setCurrentUser(user); 
    const { pass: _p, ...sessionUser } = user;
    sessionStorage.setItem('hostella_user_v4', JSON.stringify(sessionUser)); 
    if (user.hostelId && user.hostelId !== 'all') setSelectedHostelFilter(user.hostelId);
    if (user.role === 'cashier') setActiveTab('rooms'); 
    else setActiveTab('dashboard'); 
  };
  
  const handleLogout = () => { 
    setCurrentUser(null); 
    sessionStorage.removeItem('hostella_user_v4'); 
  };
  
  // ? ФУНКЦИЯ ЗАСЕЛЕНИЯ (ИСПРАВЛЕННАЯ)
  // ─── Action hooks ────────────────────────────────────────────────────────

  const {
    handleUndo, pushUndo,
    handleCheckInSubmit, handleCheckIn,
    handleCheckOut, handlePayment, handleExtendGuest,
    handleSuperPayment, handleBulkExtend,
    handleCreateDebt, handleActivateBooking,
    handleSplitGuest, handleMoveGuest, handleDeleteGuest,
    handleRescheduleGuest, handleGuestUpdate,
    handleAdminReduceDays, handleAdminReduceDaysNoRefund,
    handlePayDebt, handleAdminAdjustDebt,
    handleRejectBooking,
  } = useGuestActions({
    currentUser, rooms, guests, clients,
    selectedHostelFilter, lang,
    checkInModal, setCheckInModal,
    setGuestDetailsModal, setMoveGuestModal,
    setUndoStack, setUndoHistoryOpen,
    showNotification,
  });

  const {
    handleUpdateClient, handleImportClients, handleDeduplicate,
    handleBulkDeleteClients, handleNormalizeCountries, handleSyncClientsFromGuests,
  } = useClientActions({ currentUser, clients, showNotification });

  const {
    handleStartShift, handleEndShift,
    handleTransferShift, handleTransferToMe,
    handleAdminAddShift, handleAdminUpdateShift,
    handleAddUser, handleUpdateUser, handleDeleteUser: deleteUserById,
    handleChangePassword,
  } = useShiftActions({
    currentUser, setCurrentUser,
    usersList, shifts,
    showNotification, onLogout: handleLogout,
  });

  const {
    handleRegistrationSubmit, handleExtendRegistration,
    handleRemoveFromEmehmon, handleDeleteRegistration,
  } = useRegistrationActions({
    currentUser, selectedHostelFilter, lang,
    setRegistrationModal, showNotification,
  });

  const { handleAddExpense, handleDeletePayment, downloadExpensesCSV } = useExpenseActions({
    currentUser, selectedHostelFilter,
    expenses, usersList, lang,
    setExpenseModal, setUndoStack,
    showNotification,
  });

  const { addRecurring, updateRecurring, deleteRecurring, toggleActive: toggleRecurringActive, fireNow: fireRecurringNow, getRecurringAdvances } = useRecurringExpenses({
    currentUser, selectedHostelFilter,
    recurringExpenses, expenses, showNotification,
  });

  const handleAddAdvance = async ({ staffExpense, amount }) => {
    try {
      const hostelId = staffExpense.hostelId || selectedHostelFilter || currentUser.hostelId;
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
        category: 'Аванс',
        amount: Number(amount),
        comment: `Аванс${staffExpense.comment ? ': ' + staffExpense.comment : ''}`,
        hostelId,
        staffId: staffExpense.staffId || currentUser.id || currentUser.login,
        date: new Date().toISOString(),
        linkedSalaryId: staffExpense.id,
      });
      showNotification('Аванс зафиксирован', 'success');
    } catch (err) {
      console.error('Ошибка аванса:', err);
      showNotification('Ошибка: ' + (err.message || 'не удалось сохранить'), 'error');
    }
  };

  const handleAddRecurringAdvance = async ({ template, amount }) => {
    try {
      const hostelId =
        template.hostelId && template.hostelId !== 'all'
          ? template.hostelId
          : selectedHostelFilter && selectedHostelFilter !== 'all'
            ? selectedHostelFilter
            : currentUser.hostelId || 'hostel1';
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
        category: 'Аванс',
        amount: Number(amount),
        comment: `Аванс: ${template.name}`,
        hostelId,
        staffId: currentUser.id || currentUser.login,
        date: new Date().toISOString(),
        recurringId: template.id,
      });
      showNotification(`Аванс выдан: ${Number(amount).toLocaleString()} сум`, 'success');
    } catch (err) {
      console.error('Ошибка аванса:', err);
      showNotification('Ошибка: ' + (err.message || 'не удалось сохранить'), 'error');
    }
  };

  // ─── UI-only handlers (remain in App) ────────────────────────────────────

  const handleRepeatStay = (client) => {
    setClientHistoryModal({ open: false, client: null });
    const room = rooms.find(r => r.id === client.roomId);
    setCheckInModal({ open: true, room: room || null, bedId: client.bedId || null, date: null, client });
  };

  const handleOpenClientHistory = (client) => setClientHistoryModal({ open: true, client });

  const handleDeleteUser       = (id) => setConfirmDeleteUser(id);
  const handleConfirmDeleteUser = async () => {
    if (!confirmDeleteUser) return;
    await deleteUserById(confirmDeleteUser);
    setConfirmDeleteUser(null);
  };

  // ─── Settings ────────────────────────────────────────────────────────────

  const seedUsers = async () => {
    if (usersList.length === DEFAULT_USERS.length && usersList[0].id === undefined) {
      try {
        for (const u of DEFAULT_USERS) await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'users'), u);
        showNotification('Database initialized successfully', 'success');
      } catch (e) { showNotification('Error initializing database: ' + e.message, 'error'); }
    }
  };

  const handleSaveTgSettings = async (data) => {
    try { await setDoc(doc(db, ...PUBLIC_DATA_PATH, 'settings', 'telegram'), data); }
    catch (e) { showNotification('Ошибка сохранения настроек: ' + e.message, 'error'); throw e; }
  };

  const handleTestTgMessage = async ({ text, chatIds }) => {
    let result;
    try { result = await sendTelegramMessage(text, null, chatIds, true); }
    catch (e) { throw new Error(`Ошибка Cloud Function: ${e?.message || String(e)}`); }
    if (!result) throw new Error('Нет ответа от сервера — попробуйте позже');
    if (result.sent === 0) {
      const detail = result.failed?.[0]?.msg || result.errors?.[0] || 'неизвестная ошибка';
      throw new Error(`Не доставлено: ${detail}`);
    }
    return result;
  };

  // ─── Promos ───────────────────────────────────────────────────────────────

  const handleSavePromo = async (promo) => {
    const existing = promos.find(p => p.id === promo.id);
    if (existing) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'promos', promo.id), promo);
    else { const { id: _id, ...d } = promo; await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'promos'), d); }
    logAction(currentUser, 'promo_create', { code: promo.code, discount: promo.discount, type: promo.type });
    showNotification('Промокод сохранён', 'success');
  };

  const handleDeletePromo = async (promoId) => {
    const promo = promos.find(p => p.id === promoId);
    await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'promos', promoId));
    logAction(currentUser, 'promo_delete', { code: promo?.code });
    showNotification('Промокод удалён', 'success');
  };

const filterByHostel = (items) => {
    if (!currentUser) return [];
    if (currentUser.role === 'super') return items;
    
    if (currentUser.canViewHostel1) {
        return items.filter(i => i.hostelId === selectedHostelFilter);
    }
    
    const target = currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId;
    return items.filter(i => i.hostelId === target);
  };
  
  const filteredUsersForReports = useMemo(() => {
     if (!currentUser) return []; // ? ПРОВЕРКА
     const targetHostel = currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId;
     if (currentUser.role === 'super') return usersList; 
     return usersList.filter(u => u.hostelId === targetHostel || u.role === 'super' || u.hostelId === 'all');
  }, [usersList, currentUser, selectedHostelFilter]);

  const filteredPayments = useMemo(() => {
    if (!currentUser) return []; // ? ПРОВЕРКА
    const targetHostel = currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId;
    if (currentUser.role === 'super') return payments;
    return payments.filter(p => {
        const staff = usersList.find(u => u.id === p.staffId || u.login === p.staffId);
        return staff && (staff.hostelId === targetHostel || staff.hostelId === 'all');
    });
  }, [payments, usersList, currentUser, selectedHostelFilter]);

  const filteredRooms = useMemo(() => filterByHostel(rooms), [rooms, currentUser, selectedHostelFilter]);
  const filteredGuests = useMemo(() => filterByHostel(guests), [guests, currentUser, selectedHostelFilter]);
  const filteredExpenses = useMemo(() => filterByHostel(expenses), [expenses, currentUser, selectedHostelFilter]);
  const filteredTasks = useMemo(() => filterByHostel(tasks), [tasks, currentUser, selectedHostelFilter]);

  const pendingTasksCount = useMemo(() => {
    return filteredTasks.filter(t => t.status !== 'done').length;
  }, [filteredTasks]);

  // Регистрации E-mehmon с истёкшим сроком
  const registrationsAlertCount = useMemo(() => {
    const now = Date.now();
    return (registrations || []).filter(r => {
      if (r.status === 'removed') return false;
      const end = new Date((r.endDate || '') + 'T23:59:59').getTime();
      return end <= now;
    }).length;
  }, [registrations]);

  // Бронирования с сайта (все гости, не фильтруем по хостелу — админ видит все)
  const websiteBookings = useMemo(() => {
    if (!currentUser) return [];
    const all = guests.filter(g => g.status === 'booking' && g.source === 'website');
    if (currentUser.role === 'super') return all;
    if (currentUser.role === 'admin') return all.filter(g => g.hostelId === selectedHostelFilter);
    return all.filter(g => g.hostelId === currentUser.hostelId);
  }, [guests, currentUser, selectedHostelFilter]);

  const pendingBookingsCount = websiteBookings.length;

  // 🔔 Уведомление при появлении новой брони с сайта
  const prevBookingsCountRef = useRef(null);
  useEffect(() => {
    if (prevBookingsCountRef.current === null) {
      // первый рендер — просто запоминаем
      prevBookingsCountRef.current = pendingBookingsCount;
      return;
    }
    if (pendingBookingsCount > prevBookingsCountRef.current) {
      showNotification(`🔔 Новая заявка с сайта! (всего: ${pendingBookingsCount})`, 'success');
    }
    prevBookingsCountRef.current = pendingBookingsCount;
  }, [pendingBookingsCount]);

  // ⏰ Ежедневное напоминание в Telegram о необработанных бронях
  useEffect(() => {
    if (!currentUser) return;
    const REMINDER_KEY = 'hostella_booking_reminder_ts';
    const sendReminder = () => {
      if (pendingBookingsCount > 0) {
        const list = websiteBookings.slice(0, 5).map(b =>
          `• ${b.fullName || '—'} — ${b.hostelId === 'hostel1' ? 'Хостел №1' : 'Хостел №2'}, заезд ${b.checkInDate ? new Date(b.checkInDate).toLocaleDateString('ru-RU') : '?'}`
        ).join('\n');
        sendTelegramMessage(`🔔 <b>Необработанные брони с сайта: ${pendingBookingsCount}</b>\n${list}`, 'newBooking');
        localStorage.setItem(REMINDER_KEY, String(Date.now()));
      }
    };
    // Отправляем при входе, если прошло > 12 часов с последнего напоминания
    const lastSent = parseInt(localStorage.getItem(REMINDER_KEY) || '0');
    if (Date.now() - lastSent > 12 * 60 * 60 * 1000) sendReminder();
    const id = setInterval(sendReminder, 24 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [currentUser?.id]);

  const availableHostelsForUser = useMemo(() => {
    if (!currentUser) return []; 
    
    if (currentUser.role === 'admin' || currentUser.role === 'super') {
      return Object.keys(HOSTELS);
    }
    
    if (currentUser.canViewHostel1) {
      return ['hostel1', 'hostel2'];
    }
    
    return [];
  }, [currentUser]);

  const canPerformActions = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin' || currentUser.role === 'super') return true;
    const hostelId = selectedHostelFilter || currentUser.hostelId;
    if (hostelId === 'hostel1' && currentUser.permissions?.canPayInHostel1 === false) return false;
    if (hostelId === 'hostel2' && currentUser.permissions?.canPayInHostel2 === false) return false;
    return true;
  }, [currentUser, selectedHostelFilter]);

  // Оптимизация для вкладки Номера (группировка гостей)
  const guestsByRoom = useMemo(() => {
      const map = {};
      filteredGuests.forEach(g => {
          if (!map[g.roomId]) map[g.roomId] = [];
          map[g.roomId].push(g);
      });
      return map;
  }, [filteredGuests]);

  // Стабильная функция клика по койке
  const handleBedClick = useCallback((room, bedId, guest, isGhost) => {
      if (guest) {
          setGuestDetailsModal({ open: true, guest, initialView: isGhost === 'extend' ? 'extend' : 'dashboard' });
      } else { 
          if(!canPerformActions) {
              showNotification("Режим просмотра", 'error');
          } else if(currentUser.role === 'admin' || currentUser.role === 'super') {
              showNotification('Администратор не может выполнять заселение', 'error');
          } else {
              setCheckInModal({ open: true, room, bedId, date: null, bookingId: null });
          }
      } 
  }, [canPerformActions, currentUser]);

  const handleAcceptBooking = (booking) => {
    // Открываем CheckInModal с предзаполненными данными гостя
    if (!canPerformActions && currentUser.role !== 'admin') {
      showNotification('Нет прав для заселения', 'error');
      return;
    }
    setCheckInModal({
      open: true,
      room: null,
      bedId: null,
      date: booking.checkInDate || null,
      bookingId: booking.id,
      client: booking,
    });
  };

  const handleCreateRoom = async (d) => { 
    setAddRoomModal(false); 
    await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'rooms'), {
      ...d, 
      hostelId: currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId, 
      occupied: 0
    }); 
  };

  const handleCloneRoom = async (r) => { };
  const handleEditRoom = async (d) => {
    if (!editRoomModal.room?.id) return;
    const { id } = editRoomModal.room;
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', id), {
      number:      d.number,
      capacity:    d.capacity,
      prices:      d.prices,
      bookingName: d.bookingName || '',
    });
    setEditRoomModal({ open: false, room: null });
  };
  const handleDeleteRoom = async (r) => { };

  const handleAddTask = async (task) => { 
    await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'tasks'), task); 
    showNotification("Task Added"); 
  };

  const handleCompleteTask = async (id) => { 
    const task = tasks.find(t => t.id === id);
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'tasks', id), { status: 'done' });
    // Если задача повторяющаяся — автоматически создаём следующую
    if (task && task.recurringType && task.recurringType !== 'none' && task.deadline) {
      const nextDeadline = new Date(task.deadline);
      if (task.recurringType === 'daily') nextDeadline.setDate(nextDeadline.getDate() + 1);
      else if (task.recurringType === 'weekly') nextDeadline.setDate(nextDeadline.getDate() + 7);
      const { id: _id, ...taskWithoutId } = task;
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'tasks'), {
        ...taskWithoutId,
        status: 'pending',
        deadline: nextDeadline.toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      });
    }
  };

  const handleUpdateTask = async (id, updates) => { 
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'tasks', id), updates); 
    showNotification("Task Updated"); 
  };

  const handleDeleteTask = async (id) => { 
    await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'tasks', id)); 
    showNotification("Task Deleted"); 
  };
if (isLoadingAuth) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={40}/>
    </div>
);

if (!currentUser) return (
    <LoginScreen 
        users={usersList} 
        onLogin={handleLogin} 
        onSeed={seedUsers} 
        lang={lang} 
        setLang={setLang} 
    />
);

if (activeShiftInMyHostel) {
    return (
        <ShiftBlockScreen 
            activeShift={activeShiftInMyHostel} 
            activeUser={activeUserForBlock} 
            currentUser={currentUser} 
            onLogout={handleLogout} 
            onTransferToMe={handleTransferToMe} 
        />
    );
}

const activeUserDoc = usersList.find(u => u.id === currentUser?.id) || currentUser;
const currentHostelInfo = HOSTELS[currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId] || HOSTELS['hostel1'];
const currentHostelKey = currentUser.role === 'admin' ? selectedHostelFilter : (currentUser.hostelId || 'hostel1');
const currentCheckInHour = hostelConfig?.[currentHostelKey]?.checkInHour ?? 14;
const currentCheckOutHour = hostelConfig?.[currentHostelKey]?.checkOutHour ?? 12;
const t = (k) => TRANSLATIONS[lang][k];

return (
    <div className="app-root w-full font-sans flex flex-col overflow-hidden text-slate-800 bg-[#f0f2f5]" style={{height:'100dvh', paddingTop:'env(safe-area-inset-top, 0px)' }}>

        {/* Баннер обновления */}
        {updateDownloaded && (
          <div className="flex items-center justify-between px-4 py-2 bg-green-600 text-white text-sm z-50">
            <span>✅ Обновление загружено. Перезапустить приложение для установки.</span>
            <button onClick={() => window.electronAPI?.installUpdate()} className="ml-4 px-3 py-1 bg-white text-green-700 rounded font-semibold text-xs hover:bg-green-50">Перезапустить</button>
          </div>
        )}


        <TopBar
            isOnline={isOnline}
            lang={lang}
            onOpenSearch={() => setIsSearchOpen(true)}
            selectedHostelFilter={selectedHostelFilter}
            hostels={HOSTELS}
            availableHostels={availableHostelsForUser}
            setSelectedHostelFilter={setSelectedHostelFilter}
        />

        <MobileNavigation
            currentUser={currentUser}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            pendingTasksCount={pendingTasksCount}
            pendingBookingsCount={pendingBookingsCount}
            lang={lang}
            selectedHostelFilter={selectedHostelFilter}
            hostels={HOSTELS}
            availableHostels={availableHostelsForUser}
            setSelectedHostelFilter={setSelectedHostelFilter}
            onLogout={handleLogout}
            canPerformActions={canPerformActions}
            onOpenCheckIn={() => setCheckInModal({ open: true, room: null, bedId: null, date: null, bookingId: null })}
            onOpenGroupCheckIn={() => setGroupCheckInModal(true)}
            onOpenRoomRental={() => setRoomRentalModal(true)}
            onOpenShiftClosing={() => setShiftModal(true)}
            onOpenExpense={() => setExpenseModal(true)}
            anyModalOpen={
                checkInModal.open || guestDetailsModal.open || moveGuestModal.open ||
                expenseModal || shiftModal || addRoomModal || editRoomModal.open ||
                clientHistoryModal?.open || groupCheckInModal || roomRentalModal ||
                undoHistoryOpen
            }
            registrationsAlertCount={registrationsAlertCount}
        />

        <div className="fixed top-12 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
            {notifications.map(n => (
                <Notification key={n.id} message={n.message} type={n.type}
                    onClose={() => setNotifications(prev => prev.filter(x => x.id !== n.id))} />
            ))}
        </div>

        {/* Below top nav: sidebar + content */}
        <div className="flex flex-1 overflow-hidden">

            <Navigation
                currentUser={currentUser}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                pendingTasksCount={pendingTasksCount}
                pendingBookingsCount={pendingBookingsCount}
                lang={lang}
                canPerformActions={canPerformActions}
                onOpenExpense={() => setExpenseModal(true)}
                onOpenCheckIn={() => setCheckInModal({ open: true, room: null, bedId: null, date: null, bookingId: null })}
                onOpenShift={() => { if (currentUser?.role !== 'admin' && currentUser?.role !== 'super') setShiftModal(true); }}
                onOpenGroupCheckIn={() => setGroupCheckInModal(true)}
                onOpenRoomRental={() => setRoomRentalModal(true)}
                onLogout={handleLogout}
                setLang={setLang}
                onOpenChangePassword={() => setIsChangePasswordModalOpen(true)}
                registrationsAlertCount={registrationsAlertCount}
            />

            <main className="flex-1 flex flex-col overflow-hidden relative">
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-6 pt-2 pb-32 md:pb-6">
                {activeTab === 'dashboard' && currentUser.role === 'admin' && (
                    <DashboardView
                        rooms={filteredRooms}
                        guests={filteredGuests}
                        payments={filteredPayments}
                        expenses={filteredExpenses}
                        lang={lang}
                        currentHostelId={selectedHostelFilter}
                        users={usersList}
                        onBulkExtend={handleBulkExtend}
                        clients={clients}
                        onGuestClick={(client) => handleOpenClientHistory(client)}
                    />
                )}

                {activeTab === 'rooms' && (
                    <RoomsView
                        filteredRooms={filteredRooms}
                        guestsByRoom={guestsByRoom}
                        currentUser={currentUser}
                        onBedClick={(room, bedId, guest, isGhost) => handleBedClick(room, bedId, guest, isGhost)}
                        onEditRoom={(room) => setEditRoomModal({ open: true, room })}
                        onCloneRoom={(room) => handleCloneRoom(room)}
                        onDeleteRoom={(room) => handleDeleteRoom(room)}
                        onAddRoom={() => setAddRoomModal(true)}
                        lang={lang}
                    />
                )}
                
                {activeTab === 'calendar' && (
                    <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
                        <CalendarView 
                            rooms={filteredRooms} 
                            guests={filteredGuests} 
                            onSlotClick={(room, bedId, guest, dateISO) => { 
                                if (guest) setGuestDetailsModal({ open: true, guest }); 
                                else { 
                                    if(!canPerformActions) {
                                        showNotification("Режим просмотра", 'error');
                                    } else if(currentUser.role === 'admin' || currentUser.role === 'super') {
                                        showNotification('Администратор не может выполнять заселение', 'error');
                                    } else {
                                        setCheckInModal({ open: true, room, bedId, date: dateISO, bookingId: null });
                                    }
                                } 
                            }} 
                            lang={lang} 
                            currentUser={currentUser} 
                            onDeleteGuest={handleDeleteGuest}
                            onRescheduleGuest={handleRescheduleGuest}
                        />
                    </div>
                )}
                
                {activeTab === 'bookings' && currentUser.permissions?.viewBookings !== false && (
                    <BookingsView
                        bookings={websiteBookings}
                        onAccept={handleAcceptBooking}
                        onReject={handleRejectBooking}
                        currentUser={currentUser}
                        lang={lang}
                        rooms={rooms}
                    />
                )}

                {activeTab === 'reports' && (
                    (currentUser.role === 'admin' || currentUser.role === 'super')
                        ? currentUser.permissions?.viewReports !== false
                        : currentUser.permissions?.viewReports === true
                ) && (
                    <ReportsView 
                        payments={filteredPayments} 
                        expenses={filteredExpenses} 
                        users={filteredUsersForReports} 
                        guests={filteredGuests} 
                        currentUser={currentUser} 
                        onDeletePayment={handleDeletePayment} 
                        lang={lang} 
                    />
                )}
                
                {activeTab === 'debts' && currentUser.permissions?.viewDebts !== false && (
    <DebtsView 
        guests={filteredGuests} 
        users={usersList} 
        lang={lang} 
        onPayDebt={handlePayDebt} 
        currentUser={currentUser} 
        onAdminAdjustDebt={handleAdminAdjustDebt} 
        clients={clients} 
        onCreateDebt={handleCreateDebt}
        
        // ?? ДОБАВЛЕНО: Функция открытия карточки гостя
        onOpenGuest={(guest) => setSelectedGuest(guest)} 
    />
)}

                
                {activeTab === 'tasks' && (
                    <TaskManager 
                        tasks={filteredTasks} 
                        users={usersList} 
                        currentUser={currentUser} 
                        onAddTask={handleAddTask} 
                        onCompleteTask={handleCompleteTask} 
                        onUpdateTask={handleUpdateTask} 
                        onDeleteTask={handleDeleteTask} 
                        lang={lang} 
                        selectedHostelFilter={selectedHostelFilter} 
                    />
                )}

                {activeTab === 'shifts' && (
                    <ShiftsView 
                        shifts={shifts} 
                        users={usersList} 
                        currentUser={currentUser} 
                        onStartShift={handleStartShift} 
                        onEndShift={handleEndShift} 
                        onTransferShift={handleTransferShift} 
                        lang={lang} 
                        hostelId={currentUser.hostelId} 
                        onAdminAddShift={handleAdminAddShift} 
                        onAdminUpdateShift={handleAdminUpdateShift}
                        payments={payments}
                    />
                )}

                {activeTab === 'clients' && currentUser.permissions?.viewClients !== false && (
                    <ClientsView 
                        clients={clients} 
                        onUpdateClient={handleUpdateClient} 
                        onImportClients={handleImportClients} 
                        onDeduplicate={handleDeduplicate} 
                        onBulkDelete={handleBulkDeleteClients} 
                        onNormalizeCountries={handleNormalizeCountries}
                        onSyncFromGuests={() => handleSyncClientsFromGuests(currentUser.role === 'super' ? guests : filteredGuests)}
                        lang={lang} 
                        currentUser={currentUser} 
                        onOpenClientHistory={handleOpenClientHistory}
                        activePassports={new Set(filteredGuests.filter(g => g.status === 'active' && g.passport).map(g => g.passport))}
                    />
                )}

                {activeTab === 'registrations' && (
                    <RegistrationsView
                        registrations={registrations}
                        currentUser={currentUser}
                        lang={lang}
                        users={usersList}
                        onOpenRegister={() => setRegistrationModal(true)}
                        onRemove={handleRemoveFromEmehmon}
                        onExtend={handleExtendRegistration}
                        onDelete={handleDeleteRegistration}
                    />
                )}
                
                {activeTab === 'staff' && currentUser.role === 'admin' && (
                    <StaffView 
                        users={usersList} 
                        onAdd={handleAddUser} 
                        onDelete={handleDeleteUser}
                        onUpdate={handleUpdateUser}
                        lang={lang} 
                    />
                )}
                
                {activeTab === 'expenses' && (
                    (currentUser.role === 'admin' || currentUser.role === 'super')
                        ? currentUser.permissions?.viewExpenses !== false
                        : currentUser.permissions?.viewExpenses === true
                ) && (
                    <ExpensesView
                        filteredExpenses={filteredExpenses}
                        expenseCatFilter={expenseCatFilter}
                        setExpenseCatFilter={setExpenseCatFilter}
                        expSearch={expSearch}
                        setExpSearch={setExpSearch}
                        usersList={usersList}
                        onDownloadCSV={downloadExpensesCSV}
                        onAddExpense={() => setExpenseModal(true)}
                        onDeleteExpense={(id, rec) => handleDeletePayment(id, 'expense', rec)}
                        recurringExpenses={recurringExpenses.filter(t =>
                            !t.hostelId || t.hostelId === 'all' ||
                            t.hostelId === selectedHostelFilter
                        )}
                        currentUser={currentUser}
                        onAddRecurring={addRecurring}
                        onUpdateRecurring={updateRecurring}
                        onDeleteRecurring={deleteRecurring}
                        onToggleActive={toggleRecurringActive}
                        onFireNow={fireRecurringNow}
                        onAddAdvance={handleAddAdvance}
                        onAddRecurringAdvance={handleAddRecurringAdvance}
                        recurringAdvances={getRecurringAdvances()}
                    />
                )}

                {activeTab === 'telegram' && (currentUser.role === 'admin' || currentUser.role === 'super') && (
                    <TelegramSettingsView
                        settings={tgSettings}
                        onSaveSettings={handleSaveTgSettings}
                        onTestMessage={handleTestTgMessage}
                        currentUser={currentUser}
                    />
                )}

                {activeTab === 'promos' && (currentUser.role === 'admin' || currentUser.role === 'super') && (
                    <PromoCodesView
                        promos={promos}
                        onSave={handleSavePromo}
                        onDelete={handleDeletePromo}
                        currentUser={currentUser}
                    />
                )}

                {activeTab === 'auditlog' && currentUser.role === 'super' && (
                    <AuditLogView auditLog={auditLog} />
                )}

                {activeTab === 'hostelconfig' && (currentUser.role === 'admin' || currentUser.role === 'super') && (
                    <HostelSettingsView
                        currentUser={currentUser}
                        guests={guests}
                        rooms={rooms}
                        payments={payments}
                        expenses={filteredExpenses}
                        users={usersList}
                        tasks={tasks}
                        shifts={shifts}
                        lang={lang}
                        notify={showNotification}
                        onOpenTemplateEditor={() => setTemplateEditorModal(true)}
                    />
                )}

                {activeTab === 'referrals' && (
                    <div className="-m-3 md:-m-6 -mt-2 min-h-full">
                        <ReferralView
                            clients={clients}
                            guests={guests}
                            hostelId={selectedHostelFilter}
                            showNotification={showNotification}
                            currentUser={currentUser}
                        />
                    </div>
                )}
            </div>
        </main>
        </div>{/* end flex flex-1 overflow-hidden (sidebar+content) */}

        {/* Модальные окна */}
        {registrationModal && (
            <GuestRegistrationModal
                onClose={() => setRegistrationModal(false)}
                onSubmit={handleRegistrationSubmit}
                lang={lang}
                currentUser={currentUser}
                notify={showNotification}
            />
        )}

        {groupCheckInModal && (
            <GroupCheckInModal
                allRooms={filteredRooms}
                guests={guests}
                onClose={() => setGroupCheckInModal(false)}
                onSubmitOne={handleCheckInSubmit}
                notify={showNotification}
                lang={lang}
                currentUser={currentUser}
            />
        )}

        {roomRentalModal && (
            <RoomRentalModal
                allRooms={filteredRooms}
                guests={guests}
                onClose={() => setRoomRentalModal(false)}
                onSubmitOne={handleCheckInSubmit}
                notify={showNotification}
                lang={lang}
                currentUser={currentUser}
            />
        )}

        {templateEditorModal && (
            <TemplateEditorModal
                onClose={() => setTemplateEditorModal(false)}
                notify={showNotification}
                lang={lang}
            />
        )}

        {showOnboarding && (
            <OnboardingTour
                onComplete={() => setShowOnboarding(false)}
                lang={lang}
            />
        )}

        {checkInModal.open && (
            <CheckInModal 
                initialRoom={checkInModal.room}
                preSelectedBedId={checkInModal.bedId}
                initialDate={checkInModal.date}
                initialClient={checkInModal.client}
                allRooms={filteredRooms}
                guests={guests}
                clients={guests}
                clientsDb={clients}
                onClose={() => setCheckInModal({open: false, room: null, bedId: null, date: null, client: null})}
                onSubmit={handleCheckInSubmit}
                notify={showNotification}
                lang={lang}
                currentUser={currentUser}
                checkInHour={currentCheckInHour}
                checkOutHour={currentCheckOutHour}
            />
        )}
        
        {guestDetailsModal.open && (
            <GuestDetailsModal 
                guest={guestDetailsModal.guest} 
                room={filteredRooms.find(r => r.id === guestDetailsModal.guest.roomId)} 
                currentUser={currentUser}
                clients={clients}
                initialView={guestDetailsModal.initialView || 'dashboard'}
                onClose={() => setGuestDetailsModal({open: false, guest: null})} 
                onUpdate={handleGuestUpdate} 
                onPayment={handlePayment} 
                onSuperPayment={handleSuperPayment}
                onCheckOut={handleCheckOut} 
                onSplit={handleSplitGuest} 
                onOpenMove={() => setMoveGuestModal({ open: true, guest: guestDetailsModal.guest })} 
                onDelete={handleDeleteGuest} 
                notify={showNotification} 
                onReduceDays={handleAdminReduceDays} 
                onActivateBooking={handleActivateBooking} 
                onReduceDaysNoRefund={handleAdminReduceDaysNoRefund} 
                hostelInfo={currentHostelInfo} 
                lang={lang}
                onExtend={handleExtendGuest}
            />
        )}
        
        {moveGuestModal.open && (
            <MoveGuestModal 
                guest={moveGuestModal.guest} 
                allRooms={filteredRooms} 
                guests={filteredGuests} 
                onClose={() => setMoveGuestModal({open: false, guest: null})} 
                onMove={handleMoveGuest} 
                notify={showNotification} 
                lang={lang} 
            />
        )}
        
        {expenseModal && canPerformActions && (
            <ExpenseModal 
                onClose={() => setExpenseModal(false)} 
                onSubmit={handleAddExpense} 
                lang={lang}
                currentUser={currentUser}
            />
        )}
        
        {addRoomModal && (
            <RoomFormModal 
                title="Add Room" 
                onClose={() => setAddRoomModal(false)} 
                onSubmit={handleCreateRoom} 
                lang={lang} 
            />
        )}
        
        {editRoomModal.open && (
            <RoomFormModal 
                title="Edit Room" 
                initialData={editRoomModal.room} 
                onClose={() => setEditRoomModal({open: false, room: null})} 
                onSubmit={handleEditRoom} 
                lang={lang} 
            />
        )}
        
        {shiftModal && (
            <ShiftClosingModal 
                user={activeUserDoc} 
                payments={payments} 
                expenses={filteredExpenses} 
                onClose={() => setShiftModal(false)} 
                onEndShift={handleEndShift} 
                onLogout={handleLogout} 
                notify={showNotification} 
                lang={lang} 
                sendTelegramMessage={sendTelegramMessage}
            />
        )}
        
        {isChangePasswordModalOpen && (
            <ChangePasswordModal 
                currentUser={currentUser}
                users={usersList}
                onClose={() => setIsChangePasswordModalOpen(false)}
                onChangePassword={handleChangePassword}
                lang={lang}
            />
        )}
        
        {/* --- МОДАЛКА ИСТОРИИ КЛИЕНТА (Оставляем как было) --- */}
            {clientHistoryModal.open && (
                <ClientHistoryModal 
                    client={clientHistoryModal.client}
                    guests={guests}
                    users={usersList}
                    rooms={rooms}
                    currentUser={currentUser}
                    onClose={() => setClientHistoryModal({open: false, client: null})}
                    onRepeatStay={handleRepeatStay}
                    onCheckOut={handleCheckOut}
                    onActivateBooking={handleActivateBooking}
                    onDeleteGuest={handleDeleteGuest}
                    lang={lang}
                />
            )}

            {/* Компонент глобального поиска */}
            <GlobalSearch 
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                guests={guests}
                rooms={rooms}
                lang={lang}
                onSelectGuest={(guest) => {
                    setClientHistoryModal({ open: true, client: guest });
                }}
                onSelectRoom={(room) => {
                    setCheckInModal({ open: true, room: room, bedId: null, date: null });
                }}
            />

            {/* Floating undo button — visible to cashiers with pending undo items */}
            {currentUser?.role === 'cashier' && undoStack.length > 0 && (
                <button
                    onClick={() => setUndoHistoryOpen(true)}
                    className="fixed bottom-20 right-4 md:bottom-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg font-black text-sm transition-all"
                    style={{ WebkitAppRegion: 'no-drag' }}
                >
                    <span className="text-base">↩</span>
                    Отменить
                    <span className="bg-white/25 text-white text-xs font-black w-5 h-5 rounded-full flex items-center justify-center">
                        {undoStack.length}
                    </span>
                </button>
            )}

            {/* Undo history modal */}
            {undoHistoryOpen && (
                <UndoHistoryModal
                    undoStack={undoStack}
                    onClose={() => setUndoHistoryOpen(false)}
                    onUndo={handleUndo}
                />
            )}

            {/* Confirm delete user modal */}
            {confirmDeleteUser && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
                        <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">🗑️</span>
                        </div>
                        <h3 className="font-black text-slate-800 text-lg mb-2">Удалить сотрудника?</h3>
                        <p className="text-sm text-slate-500 mb-6">Это действие нельзя отменить.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDeleteUser(null)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                                Отмена
                            </button>
                            <button onClick={handleConfirmDeleteUser}
                                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold transition-colors">
                                Удалить
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default App;