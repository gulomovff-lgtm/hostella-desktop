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
  writeBatch,
  deleteField,
  arrayUnion
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
  getKppDayNumber,
  getRegistrationWindow,
  Flag
} from './utils/helpers';
import { sendTelegramMessage } from './utils/telegram';
import { checkAndMarkAlert } from './utils/alertsLog';
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
  Minus,
  ArrowUp
} from 'lucide-react';

// --- Вынесенные компоненты ---
import LoginScreen from './components/LoginScreen/LoginScreen';
import HostelPickerScreen from './components/UI/HostelPickerScreen';
import Button from './components/UI/Button';
import Notification from './components/UI/Notification';
import ConfirmDialog from './components/UI/ConfirmDialog';
import ShiftBlockScreen from './components/UI/ShiftBlockScreen';
import TopBar from './components/Layout/TopBar';
import Navigation from './components/Layout/Navigation';
import MobileNavigation from './components/Layout/MobileNavigation';
import GlobalSearch from './components/Search/GlobalSearch';
import ChangePasswordModal from './components/Modals/ChangePasswordModal';
import ClientEditModal from './components/Modals/ClientEditModal';
import CreateDebtModal from './components/Modals/CreateDebtModal';
// --- Views ---
import DashboardView from './components/Views/DashboardView';
import EmehmonPendingBanner from './components/UI/EmehmonPendingBanner';
import EmehmonDepartureModal from './components/Modals/EmehmonDepartureModal';
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
import SessionsView from './components/Views/SessionsView';
import ClientVersionsView from './components/Views/ClientVersionsView';
import PricePermissionsView from './components/Views/PricePermissionsView';
import PromoCodesView from './components/Views/PromoCodesView';
import ReferralView from './components/Views/ReferralView';
import AnalyticsView from './components/Views/AnalyticsView';
import ManualStayView from './components/Views/ManualStayView';
import GuestHistoryView from './components/Views/GuestHistoryView';
import { logAction, logSystemError } from './utils/auditLog';
import { reportClientVersion } from './utils/clientTelemetry';
import { loadAppConfig, getConfig } from './utils/appConfig';
import * as XLSX from 'xlsx';
import { createSession, closeSession, heartbeatSession, closeAbandonedSessions, getLoginAt, LOGIN_AT_KEY } from './utils/session';
import { openEmehmonArrival, openEmehmonDeparture, checkEmehmonActive, fetchEmehmonRegistered, departEmehmonBackground, departEmehmonBulk, autoRegisterArrival } from './utils/emehmon';
import { minNightPrice } from './utils/pricing';
import { useGuestActions }        from './hooks/useGuestActions';
import { loadFromElectron, getQueue, clearQueue } from './utils/offlineQueue';
import { useClientActions }       from './hooks/useClientActions';
import { useShiftActions }        from './hooks/useShiftActions';
import { useRegistrationActions } from './hooks/useRegistrationActions';
import { useCadastreActions }     from './hooks/useCadastreActions';
import { useCadastreAlerts }      from './hooks/useCadastreAlerts';
import { useExpenseActions }      from './hooks/useExpenseActions';
import { useRecurringExpenses }   from './hooks/useRecurringExpenses';
import { useNavPrefs }            from './hooks/useNavPrefs';
import CheckInModal from './components/Modals/CheckInModal';
import ClientHistoryModal from './components/Modals/ClientHistoryModal';
import GuestRegistrationModal from './components/Modals/GuestRegistrationModal';
import RegistrationsView from './components/Views/RegistrationsView';
import CadastreView     from './components/Views/CadastreView';
import ExpenseModal from './components/Modals/ExpenseModal';
import ReportsView from './components/Views/ReportsView';
import GuestDetailsModal from './components/Modals/GuestDetailsModal';
import MoveGuestModal from './components/Modals/MoveGuestModal';
import RoomFormModal from './components/Modals/RoomFormModal';
import ShiftClosingModal from './components/Modals/ShiftClosingModal';
import BookingsView from './components/Views/BookingsView';
import GroupCheckInModal from './components/Modals/GroupCheckInModal';
import RoomRentalModal from './components/Modals/RoomRentalModal';
import RentalExtendModal from './components/Modals/RentalExtendModal';
import RentalPayModal from './components/Modals/RentalPayModal';
import TemplateEditorModal from './components/Modals/TemplateEditorModal';
import GroupReceiptModal from './components/Modals/GroupReceiptModal';
import HostelSettingsView from './components/Views/HostelSettingsView';
import OnboardingTour, { LS_KEY as ONBOARDING_KEY } from './components/UI/OnboardingTour';
import UndoHistoryModal from './components/Modals/UndoHistoryModal';
import TRANSLATIONS from './constants/translations';
import { COUNTRY_MAP, COUNTRIES, COUNTRY_FLAGS } from './constants/countries';
import { DAILY_SALARY, DEFAULT_USERS, APP_VERSION, MIN_REQUIRED_VERSION } from './constants/config';

// --- STYLES ---
const inputClass = "w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm shadow-sm font-medium text-slate-700 no-spinner";
const labelClass = "block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide ml-1";

// Constants outside component to avoid recreation on every render
const SEEN_BOOKINGS_KEY = 'hostella_seen_booking_ids';



// Firebase config, db, auth, functions, PUBLIC_DATA_PATH – imported from './firebase'









// --- UI COMPONENTS ---












// --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ (Вставить перед const App) ---

// ─── Утилиты версий ────────────────────────────────────────────────────────
const parseVer = (v = '') => v.replace(/[^\d.]/g, '').split('.').map(n => parseInt(n) || 0);
const versionLt = (a, b) => {
  const [a0, a1, a2] = parseVer(a);
  const [b0, b1, b2] = parseVer(b);
  if (a0 !== b0) return a0 < b0;
  if (a1 !== b1) return a1 < b1;
  return a2 < b2;
};

// ─── Экран устаревшей версии ──────────────────────────────────────────────
function OutdatedVersionScreen({ currentVersion, minVersion, latestVersion, downloadUrl }) {
  const C = { primary: '#1a3c40', accent: '#e88c40' };
  const url = downloadUrl || 'https://github.com/gulomovff-lgtm/hostella-desktop/releases';
  return (
    <div className="fixed inset-0 flex items-center justify-center z-[200]"
         style={{ background: 'linear-gradient(135deg, #1a3c40 0%, #2a5c60 100%)' }}>
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center mx-4">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-black mb-2" style={{ color: C.primary }}>
          Версия устарела
        </h1>
        <p className="text-slate-500 mb-1 text-sm">
          Ваша версия&nbsp;
          <span className="font-bold text-rose-500">v{currentVersion}</span>
          &nbsp;больше не поддерживается.
        </p>
        <p className="text-slate-500 mb-4 text-sm">
          Минимально требуемая:&nbsp;
          <span className="font-bold" style={{ color: C.primary }}>v{minVersion}</span>
        </p>
        {latestVersion && (
          <p className="text-slate-400 text-xs mb-6">
            Доступна актуальная версия:&nbsp;<strong>v{latestVersion}</strong>
          </p>
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-8 py-3.5 rounded-xl font-bold text-white text-base transition-all hover:opacity-90 active:scale-95"
          style={{ background: C.accent, boxShadow: `0 6px 20px ${C.accent}55` }}
        >
          ⬇️ Скачать актуальную версию
        </a>
        <p className="mt-4 text-xs text-slate-400">
          После установки перезапустите приложение
        </p>
      </div>
    </div>
  );
}






// ? ГЛАВНЫЙ КОМПОНЕНТ APP
function App() {
  // ── Dev preview: вычисляем ДО хуков, но не делаем ранний return — иначе нарушение Rules of Hooks
  const isPreview = new URLSearchParams(window.location.search).get('preview') === 'login-new';

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
  const [hostelPickerPending, setHostelPickerPending] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [roomFilter, setRoomFilter] = useState('all');
  const [selectedHostelFilter, setSelectedHostelFilter] = useState('hostel1');
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState(null);
  const [confirmEndRental, setConfirmEndRental] = useState(null);
  const [lang, setLang] = useState(() => getConfig().defaultLang || 'ru');
  const [loginThemeId, setLoginThemeId] = useState(
    () => localStorage.getItem('hostella_login_theme') || 'auto'
  );
  const handleSetLoginTheme = (id) => {
    setLoginThemeId(id);
    localStorage.setItem('hostella_login_theme', id);
  };
  const [appTheme, setAppTheme] = useState(() => {
    const saved = localStorage.getItem('hostella_app_theme') || getConfig().defaultTheme || 'green';
    const valid  = saved === 'dark' ? 'dark' : 'green'; // сброс старых тем
    if (valid === 'dark') document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    return valid;
  });
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(null); // 0-100
  const [versionBlocked, setVersionBlocked]       = useState(false);
  const [remoteVersionInfo, setRemoteVersionInfo] = useState(null);

  const showNotification = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev.slice(-2), { id, message, type }]);
  }, []);

  // ─── Тема навигации ────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('hostella_app_theme', appTheme);
    if (appTheme === 'green') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = appTheme;
  }, [appTheme]);

  // ─── Проверка минимальной версии при старте ───────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const res  = await fetch(`/version.json?_t=${Date.now()}`);
        if (!res.ok) return;
        const data = await res.json();
        setRemoteVersionInfo(data);
        const minVer = data.minVersion || MIN_REQUIRED_VERSION;
        if (versionLt(APP_VERSION, minVer)) {
          setVersionBlocked(true);
          logSystemError('version_check', `App ${APP_VERSION} < required ${minVer}`, {
            appVersion: APP_VERSION, minVersion: minVer,
          });
        }
      } catch (e) {
        // Сетевая ошибка — не блокируем приложение, просто предупреждаем
        console.warn('[version] check failed:', e.message);
      }
    };
    check();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Телеметрия версии клиента ────────────────────────────────────────────
  // Пишем версию запущенного клиента в Firestore при входе и раз в 30 мин,
  // чтобы видеть удалённо, кто на какой версии и когда последний раз заходил.
  useEffect(() => {
    if (!currentUser?.login) return;
    reportClientVersion(currentUser);
    const id = setInterval(() => reportClientVersion(currentUser), 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [currentUser?.login, currentUser?.hostelId, currentUser?.role]);

  // ─── Глобальное логирование системных ошибок JS ───────────────────────────
  useEffect(() => {
    const onError = (e) => {
      // Игнорируем ошибки сторонних скриптов (cross-origin)
      if (!e.filename || e.message === 'Script error.') return;
      logSystemError('window.onerror', e.error || new Error(e.message), {
        filename: e.filename, lineno: e.lineno, colno: e.colno,
      });
    };
    const onUnhandled = (e) => {
      const reason = e.reason;
      if (!reason) return;
      logSystemError('unhandledrejection', reason, {});
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandled);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandled);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Data from Firebase (via custom hook) ---
  const {
    rooms, guests, expenses, clients, payments,
    usersList, tasks, shifts, tgSettings, auditLog, promos, registrations,
    recurringExpenses, hostelConfig, sessions, cadastres, cadastreRegs,
    manualStayGroups,
    priceWhitelist,
    clientVersions,
    isOnline, permissionError, isDataReady,
  } = useAppData(firebaseUser, currentUser);

  const [checkInModal, setCheckInModal] = useState({ open: false, room: null, bedId: null, date: null, client: null, bookingId: null }); 
  const [groupCheckInModal,  setGroupCheckInModal ] = useState(false);
  const [roomRentalModal,    setRoomRentalModal   ] = useState(false);
  const [rentalEditModal,    setRentalEditModal   ] = useState(null); // room object or null
  const [rentalExtendModal,  setRentalExtendModal ] = useState(null); // room object or null
  const [rentalPayModal,     setRentalPayModal    ] = useState(null); // room object or null
  const [templateEditorModal, setTemplateEditorModal] = useState(false);
  const [groupReceiptOpen, setGroupReceiptOpen] = useState(false);
  const [registrationModal,  setRegistrationModal ] = useState(false);
  const [showOnboarding,     setShowOnboarding    ] = useState(() => localStorage.getItem(ONBOARDING_KEY) !== 'done');
  const [undoStack,         setUndoStack         ] = useState(() => {
    try {
      const saved = localStorage.getItem('hostella_undo_v1');
      if (!saved) return [];
      const now = Date.now();
      return JSON.parse(saved).filter(i => (now - new Date(i.timestamp).getTime()) < 30 * 60 * 1000);
    } catch { return []; }
  });
  const [undoHistoryOpen,   setUndoHistoryOpen   ] = useState(false);

  // Persist undo stack across logouts/refreshes (30 min window)
  useEffect(() => {
    try { localStorage.setItem('hostella_undo_v1', JSON.stringify(undoStack)); } catch {}
  }, [undoStack]);

  // Purge expired undo items every 30 seconds
  useEffect(() => {
    const EXPIRY = 30 * 60 * 1000;
    const id = setInterval(() => {
      const now = Date.now();
      setUndoStack(prev => {
        const fresh = prev.filter(i => (now - new Date(i.timestamp).getTime()) < EXPIRY);
        return fresh.length === prev.length ? prev : fresh;
      });
    }, 30_000);
    return () => clearInterval(id);
  }, []);
  const [guestDetailsModal, setGuestDetailsModal] = useState({ open: false, guest: null });
  const [emehmonReminder, setEmehmonReminder] = useState(null);
  const [emehmonDepart, setEmehmonDepart] = useState(null); // гость для фонового выселения
  const [emehmonChecking, setEmehmonChecking] = useState(null); // id гостя на проверке «Готово»
  const [emehmonArrivalPrompt, setEmehmonArrivalPrompt] = useState(null); // предложение оформить прибытие
  const [emehmonSyncing, setEmehmonSyncing] = useState(false); // идёт фоновая синхронизация статусов
  const [emehmonList, setEmehmonList] = useState([]); // последний снимок /listok (для «нет в системе»)
  const [emehmonDepartingIds, setEmehmonDepartingIds] = useState(() => new Set()); // id гостей в процессе вывода (лоадер)
  const emehmonSyncBusy = useRef(false);
  const [moveGuestModal, setMoveGuestModal] = useState({ open: false, guest: null });
  const [expenseModal, setExpenseModal] = useState(false);
  const [expenseModalCategory, setExpenseModalCategory] = useState('');
  const contentScrollRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [expenseCatFilter, setExpenseCatFilter] = useState('Все');
  const [expSearch, setExpSearch] = useState('');
  const [shiftModal, setShiftModal] = useState(false);
  const [addRoomModal, setAddRoomModal] = useState(false);
  const [editRoomModal, setEditRoomModal] = useState({ open: false, room: null });
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [clientHistoryModal, setClientHistoryModal] = useState({ open: false, client: null });

  // ─── Авто-выселение просроченных гостей ──────────────────────────────────
  //
  // Алгоритм безопасного авто-выселения:
  //
  //  GATE 1 — только active-гости с валидным checkOutDate
  //  GATE 2 — вычисляем «эффективную дату выезда»:
  //             • ISO-строки сохранённые как midnight UTC (new Date(date).toISOString()
  //               из <input type="date">) трактуются как дата без времени.
  //             • date-only (YYYY-MM-DD) и midnight-UTC → используем checkOutHour хостела
  //             • ISO с ненулевым временем → берём как есть
  //             • если есть bonusCheckOutDate и он позже — используем его (та же логика)
  //  GATE 3 — льготный период зависит от состояния кровати:
  //             • 24 ч — если кровать свободна (никто новый не заехал)
  //             • 4 ч  — если тот же bed уже занят другим активным гостем
  //  GATE 4 — гость не имеет последнего платежа за последние 12 ч
  //            (защита: оплата = продление, должны были уже сдвинуть checkOutDate)
  //  GATE 5 — не выселяем «младшего» гостя если на кровати есть «старший» активный
  //            (защита от гонки при двух записях на одной кровати)
  //  DECREMENT — счётчик occupied уменьшается ТОЛЬКО если на кровати нет
  //              другого активного гостя (не задваиваем -1)
  //  LOGGING — каждое авто-выселение пишется в auditLog
  //

  // Refs для live-данных: таймер не перезапускается при каждом изменении данных
  const autoCheckoutGuestsRef   = useRef(guests);
  const autoCheckoutRoomsRef    = useRef(rooms);
  const autoCheckoutPaymentsRef = useRef(payments);
  const autoCheckoutConfigRef   = useRef(hostelConfig);
  useEffect(() => { autoCheckoutGuestsRef.current   = guests;      }, [guests]);
  useEffect(() => { autoCheckoutRoomsRef.current    = rooms;       }, [rooms]);
  useEffect(() => { autoCheckoutPaymentsRef.current = payments;    }, [payments]);
  useEffect(() => { autoCheckoutConfigRef.current   = hostelConfig; }, [hostelConfig]);

  useEffect(() => {
    if (!currentUser) return;
    if (!isDataReady) return; // ждём, пока все данные загружены

    // Эффективная дата выезда с учётом бонусного дня и настроек хостела
    const getEffectiveCo = (guest) => {
      const cfg = autoCheckoutConfigRef.current;
      const guestHostelId = guest.hostelId || 'hostel1';
      const coHour = cfg?.[guestHostelId]?.checkOutHour ?? 12;

      // Парсит строку даты: midnight-UTC ISO или date-only → используем coHour локально;
      // ISO с конкретным ненулевым временем → берём как есть
      const parseDate = (dateStr) => {
        if (!dateStr) return null;
        if (typeof dateStr === 'string' && dateStr.includes('T')) {
          const d = new Date(dateStr);
          if (isNaN(d.getTime())) return null;
          // Дата сохранена как midnight UTC (через new Date(dateStr).toISOString() из input[type=date])
          // → трактуем как date-only с часом выезда хостела
          if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
            return new Date(`${dateStr.slice(0, 10)}T${String(coHour).padStart(2, '0')}:00:00`);
          }
          return d;
        }
        // date-only: YYYY-MM-DD
        return new Date(`${String(dateStr).slice(0, 10)}T${String(coHour).padStart(2, '0')}:00:00`);
      };

      const base = parseDate(guest.checkOutDate);
      if (!base || isNaN(base.getTime())) return null;

      if (guest.bonusCheckOutDate) {
        const bonus = parseDate(guest.bonusCheckOutDate);
        if (bonus && !isNaN(bonus.getTime()) && bonus > base) return bonus;
      }
      return base;
    };

    const runAutoCheckout = async () => {
      const guests   = autoCheckoutGuestsRef.current;
      const rooms    = autoCheckoutRoomsRef.current;
      const payments = autoCheckoutPaymentsRef.current;
      if (!guests.length || !rooms.length) return;
      const now = new Date();
      // Льготные периоды:
      const shortGraceMs = 4  * 60 * 60 * 1000; // 4ч  — кровать занята новым гостем
      const longGraceMs  = 24 * 60 * 60 * 1000; // 24ч — кровать свободна
      // Защита от «недавней оплаты» — 12 часов
      const payGuardMs = 12 * 60 * 60 * 1000;

      const batch = writeBatch(db);
      let count = 0;
      const evicted = [];

      for (const guest of guests) {
        // GATE 1
        if (guest.status !== 'active') continue;
        if (!guest.checkOutDate) continue;

        // GATE 1.5 — per-hostel auto-checkout enabled check
        const guestHostelId = guest.hostelId || 'hostel1';
        if (autoCheckoutConfigRef.current?.[guestHostelId]?.autoCheckoutEnabled === false) continue;

        // GATE 2 — effective checkout time
        const effectiveCo = getEffectiveCo(guest);
        if (!effectiveCo) continue;

        // GATE 3 — льготный период: 24ч если кровать свободна, 4ч если занята
        const bedOccupiedByAny = guests.some(g2 =>
          g2.id !== guest.id &&
          g2.status === 'active' &&
          g2.roomId === guest.roomId &&
          String(g2.bedId) === String(guest.bedId)
        );
        const graceForGuest = bedOccupiedByAny ? shortGraceMs : longGraceMs;
        const msOverdue = now.getTime() - effectiveCo.getTime();
        if (msOverdue < graceForGuest) continue;

        // GATE 4 — недавняя оплата (по payments или по lastPaymentAt на госте)
        const lastPay = guest.lastPaymentAt
          ? new Date(guest.lastPaymentAt).getTime()
          : 0;
        if (now.getTime() - lastPay < payGuardMs) continue;
        // Дополнительная проверка по массиву payments (если есть guestId)
        const recentPaid = payments.some(p => {
          if ((p.guestId || p.bookingId) !== guest.id) return false;
          const pts = new Date(p.date || p.timestamp || 0).getTime();
          return now.getTime() - pts < payGuardMs;
        });
        if (recentPaid) continue;

        // GATE 5 — на той же кровати нет «более старшего» активного гостя
        // (исключаем ложные срабатывания при гонке двух записей)
        const isJuniorOnBed = guests.some(g2 =>
          g2.id !== guest.id &&
          g2.status === 'active' &&
          g2.roomId === guest.roomId &&
          String(g2.bedId) === String(guest.bedId) &&
          new Date(g2.checkInDate || g2.checkInDateTime || 0) <
            new Date(guest.checkInDate || guest.checkInDateTime || 0)
        );
        if (isJuniorOnBed) continue; // есть более ранний активный гость — не трогаем

        // ✅ Все гейты пройдены → выселяем
        const guestRef = doc(db, ...PUBLIC_DATA_PATH, 'guests', guest.id);
        batch.update(guestRef, {
          status:        'checked_out',
          autoCheckedOut: true,
          autoCheckedOutAt: now.toISOString(),
          systemComment: `Авто-выселение: просрочка ${Math.round(msOverdue / 3600000)}ч`,
        });

        // Уменьшаем occupied только если на кровати нет другого активного гостя
        const anotherActive = guests.some(g2 =>
          g2.id !== guest.id &&
          g2.status === 'active' &&
          g2.roomId === guest.roomId &&
          String(g2.bedId) === String(guest.bedId)
        );
        if (!anotherActive) {
          const room = rooms.find(r => r.id === guest.roomId);
          if (room) {
            batch.update(doc(db, ...PUBLIC_DATA_PATH, 'rooms', room.id), {
              occupied: increment(-1),
            });
          }
        }

        evicted.push({ id: guest.id, name: guest.fullName || guest.name || guest.id });
        count++;
      }

      if (count > 0) {
        try {
          await batch.commit();
          showNotification(`🏁 Авто-выселение: ${count} гост${count === 1 ? 'ь' : 'ей'}`, 'warning');
          // Логируем в auditLog одной записью
          logAction(
            { id: 'system', name: 'System', role: 'system', hostelId: null },
            'auto_checkout',
            { count, guests: evicted.map(e => e.name) },
          );
        } catch (e) {
          console.error('[auto-checkout] batch error:', e);
          logSystemError('auto_checkout', e, { count });
        }
      }
    };

    // ⏱ Первая проверка через 2 мин после загрузки — данные успевают устояться
    const initial = setTimeout(runAutoCheckout, 2 * 60 * 1000);
    // Повторная проверка каждые 30 минут
    const interval = setInterval(runAutoCheckout, 30 * 60 * 1000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  // Намеренно НЕ включаем guests/rooms/payments в deps — они читаются через refs,
  // чтобы таймер не сбрасывался при каждом изменении Firestore-данных.
  // Refs обновляются через отдельные useEffect выше.
  }, [currentUser, isDataReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Авто-синхронизация клиентов из гостей по расписанию ───────────────────
  const autoSyncGuestsRef = useRef(guests);
  useEffect(() => { autoSyncGuestsRef.current = guests; }, [guests]);

  useEffect(() => {
    if (!isDataReady || !hostelConfig) return;
    const FREQ_MS = { daily: 24 * 60 * 60 * 1000, weekly: 7 * 24 * 60 * 60 * 1000, monthly: 30 * 24 * 60 * 60 * 1000 };
    const checkAndSync = () => {
      ['hostel1', 'hostel2'].forEach(hostelKey => {
        const cfg = hostelConfig?.[hostelKey]?.autoSync;
        if (!cfg?.enabled) return;
        const freq = FREQ_MS[cfg.frequency] || FREQ_MS.daily;
        const lastSync = parseInt(localStorage.getItem(`autoSync_${hostelKey}`) || '0');
        if (Date.now() - lastSync < freq) return;
        const hostelGuests = autoSyncGuestsRef.current.filter(g => (g.hostelId || 'hostel1') === hostelKey);
        if (!hostelGuests.length) return;
        localStorage.setItem(`autoSync_${hostelKey}`, Date.now().toString());
        handleSyncClientsFromGuests(hostelGuests);
      });
    };
    const initial = setTimeout(checkAndSync, 5 * 60 * 1000);
    const interval = setInterval(checkAndSync, 60 * 60 * 1000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, [hostelConfig, isDataReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Оффлайн очередь: загрузка файла Electron при старте, сохранение при закрытии ───
  useEffect(() => {
    loadFromElectron();
    const handleBeforeUnload = () => {
      const q = getQueue();
      if (q.length > 0 && window.electronAPI?.savePendingPayments) {
        window.electronAPI.savePendingPayments(q);
      }
      // Закрываем сессию при закрытии вкладки/приложения
      closeSession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // ─── Очередь: флаш при восстановлении сети ───
  useEffect(() => {
    if (!isOnline) return;
    const q = getQueue();
    if (!q.length) return;

    // 1. Отправляем отложенные Telegram-уведомления (Cloud Functions недоступны оффлайн)
    const telegramEntries = q.filter(e => e._type === 'telegram');
    if (telegramEntries.length > 0) {
      telegramEntries.forEach(e => {
        sendTelegramMessage(e.text, e.notifType).catch(() => {});
      });
    }

    // 2. Firestore (persistentLocalCache) уже синхронизовал платежи/расходы автоматически.
    //    Очищаем всю очередь и удаляем Electron-файл.
    const paymentCount = q.filter(e => e._type !== 'telegram').length;
    const parts = [];
    if (paymentCount > 0) parts.push(`${paymentCount} оплат`);
    if (telegramEntries.length > 0) parts.push(`${telegramEntries.length} уведомлений`);
    showNotification(`📶 Синхронизировано: ${parts.join(', ')}`, 'success');
    clearQueue();
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Хелпер: найти пользователя по staffId/staffLogin (устойчив к смене document ID)
  const findUserByShift = useCallback((s) => {
    return usersList.find(u => u.id === s.staffId || (s.staffLogin && u.login === s.staffLogin));
  }, [usersList]);

  const activeShiftInMyHostel = useMemo(() => {
      if (!currentUser || currentUser.role === 'admin' || currentUser.role === 'super') return null;
      // Для мульти-хостел кассиров используем selectedHostelFilter (выбранный хостел),
      // а не currentUser.hostelId (который может быть просто первым хосетлом).
      const effectiveHostel = (currentUser.allowedHostels?.length > 1)
          ? selectedHostelFilter
          : currentUser.hostelId;
      return shifts.find(s =>
          s.hostelId === effectiveHostel &&
          !s.endTime &&
          s.staffId !== currentUser.id &&
          (s.staffLogin ? s.staffLogin !== currentUser.login : true) &&
          // Игнорируем «призрачные» смены удалённых пользователей —
          // иначе удаление кассира блокирует вход всем остальным.
          usersList.some(u => u.id === s.staffId || (s.staffLogin && u.login === s.staffLogin))
      );
  }, [shifts, currentUser, usersList, selectedHostelFilter]);

  const activeUserForBlock = useMemo(() => {
      if (!activeShiftInMyHostel) return null;
      return usersList.find(u => u.id === activeShiftInMyHostel.staffId || (activeShiftInMyHostel.staffLogin && u.login === activeShiftInMyHostel.staffLogin));
  }, [activeShiftInMyHostel, usersList]);

  // Есть ли у самого кассира активная смена в ДРУГОМ хостеле (не в том, куда его не пускают)
  const myOtherActiveShiftHostelId = useMemo(() => {
      if (!activeShiftInMyHostel || !currentUser) return null;
      const blockedHostel = activeShiftInMyHostel.hostelId;
      const mine = shifts.find(s =>
          !s.endTime &&
          s.hostelId !== blockedHostel &&
          (s.staffId === currentUser.id || (s.staffLogin && s.staffLogin === currentUser.login))
      );
      return mine?.hostelId ?? null;
  }, [activeShiftInMyHostel, shifts, currentUser]);

  useEffect(() => {
    const handleEsc = (event) => {
        if (event.key === 'Escape') {
            setCheckInModal(m => m.open ? {open: false, room: null, bedId: null, date: null} : m);
            setGuestDetailsModal(m => m.open ? {open: false, guest: null} : m);
            setMoveGuestModal(m => m.open ? {open: false, guest: null} : m);
            setExpenseModal(false);
            setShiftModal(false);
            setAddRoomModal(false);
            setEditRoomModal(m => m.open ? {open: false, room: null} : m);
            setClientHistoryModal(m => m.open ? {open: false, client: null} : m);
        }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

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

  // Загружаем глобальный конфиг приложения (настройки без кода)
  useEffect(() => {
    loadAppConfig().then(cfg => {
      try { if (cfg?.appName) document.title = cfg.appName; } catch { /* ignore */ }
      try { if (cfg?.brandColor) document.documentElement.style.setProperty('--brand', cfg.brandColor); } catch { /* ignore */ }
    });
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
        // Если loginAt отсутствует (напр., Electron перезапустился, старый формат данных),
        // устанавливаем текущее время — это предотвращает ложное срабатывание force-logout
        // (любой прошлый forceLogoutAfter будет <= loginAtNow → не сработает)
        if (!sessionStorage.getItem(LOGIN_AT_KEY)) {
          sessionStorage.setItem(LOGIN_AT_KEY, new Date().toISOString());
        }
        if (u.hostelId && u.hostelId !== 'all') setSelectedHostelFilter(u.hostelId);
        if (u.role === 'cashier') setActiveTab('rooms');
    }

    // Закрываем сессию при закрытии вкладки/Electron-окна (best-effort)
    const handlePageHide = () => closeSession();
    window.addEventListener('pagehide', handlePageHide);
    
    return () => {
      unsubAuth();
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  // Автосинхронизация сессии: синхронизируем currentUser со свежими данными из Firestore.
  // Срабатывает при изменении id (смена document ID), роли или прав — защита от подмены
  // данных через sessionStorage (DevTools).
  useEffect(() => {
    if (!currentUser || !usersList.length) return;
    const fresh = usersList.find(u => u.login === currentUser.login);
    if (!fresh) return;
    const roleChanged        = fresh.role        !== currentUser.role;
    const idChanged          = fresh.id          !== currentUser.id;
    const permissionsChanged = JSON.stringify(fresh.permissions || {}) !== JSON.stringify(currentUser.permissions || {});
    if (idChanged || roleChanged || permissionsChanged) {
      // Сохраняем hostelId из сессии (кассир выбрал хостел при входе)
      const merged = { ...fresh, hostelId: currentUser.hostelId };
      const { pass: _p, ...sessionUser } = merged;
      setCurrentUser(merged);
      sessionStorage.setItem('hostella_user_v4', JSON.stringify(sessionUser));
    }
  }, [usersList]); // eslint-disable-line react-hooks/exhaustive-deps

  // Сброс флага при смене пользователя (логин/логаут)
  useEffect(() => {
    autoShiftStartedRef.current = false;
    // БАГ-1 FIX: сбрасываем forceLogout-флаг при каждой смене currentUser.id
    // Без этого: если предыдущий юзер был force-разлогинен (ref=true),
    // следующий юзер на том же устройстве НИКОГДА не получит force-logout.
    forceLogoutTriggeredRef.current = false;
  }, [currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Сброс флага когда мультихостел кассир выбрал хостел — чтобы авто-старт сработал
  useEffect(() => {
    if (!hostelPickerPending && currentUser?.role === 'cashier') {
      autoShiftStartedRef.current = false;
    }
  }, [hostelPickerPending]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'cashier') return;
    if (shifts.length === 0) return;
    // Не запускаем автостарт пока кассир не выбрал хостел (мультихостел)
    if (hostelPickerPending) return;
    // Не запускаем автостарт повторно — только один раз за сессию
    if (autoShiftStartedRef.current) return;

    const myActiveShift = shifts.find(s => s.staffId === currentUser.id && !s.endTime);

    if (myActiveShift) {
      // Смена уже есть — помечаем, больше не трогаем
      autoShiftStartedRef.current = true;
      return;
    }

    const effectiveHostel = (currentUser.allowedHostels?.length > 1)
      ? selectedHostelFilter
      : currentUser.hostelId;

    const otherActiveShift = shifts.find(s =>
      s.hostelId === effectiveHostel &&
      !s.endTime &&
      s.staffId !== currentUser.id &&
      // Не учитываем смены удалённых пользователей при авто-старте
      usersList.some(u => u.id === s.staffId)
    );

    if (!otherActiveShift) {
      autoShiftStartedRef.current = true;
      handleStartShift(effectiveHostel);
    }
  }, [currentUser, shifts, hostelPickerPending]); // eslint-disable-line react-hooks/exhaustive-deps

  // Хартбит: обновляем lastSeen каждые 30с, чтобы сжигать сессию как активную
  useEffect(() => {
    if (!currentUser) return;
    const timer = setInterval(() => heartbeatSession(), 30_000);
    return () => clearInterval(timer);
  }, [currentUser]);

  // Авто-закрытие "зависших" сессий (active:true, но без хартбита > 15 мин).
  // closeSession() при закрытии вкладки/выключении ноута часто не долетает до Firestore,
  // поэтому подчищаем по lastSeen. Список сессий есть только у admin/super — они и чистят.
  // Снапшот сессий обновляется при каждом хартбите (в т.ч. своём), давая авто-перепроверку.
  useEffect(() => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'super') return;
    if (!sessions.length) return;
    closeAbandonedSessions(sessions);
  }, [sessions, currentUser]);

  // Ref-флаг: предотвращает повторный тригер force-logout при множественных
  // обновлениях usersList (Firestore может прислать несколько патчей подряд)
  const forceLogoutTriggeredRef = useRef(false);

  // Ref-флаг: автостарт смены срабатывает только один раз за сессию.
  // Без него: при закрытии смены Firestore обновляет shifts, useEffect видит
  // «нет активной смены» и тут же создаёт новую — пока setCurrentUser(null)
  // ещё не успел обновить state (race condition).
  const autoShiftStartedRef = useRef(false);

  // ─── Force-logout: умный автовыход ───────────────────────────────────────
  // Алгоритм:
  //   1. Игнорируем, если уже сработал (один раз за сессию, по ref)
  //   2. Ищем forceLogoutAfter в собственном user-doc текущего пользователя
  //   3. forceLogoutAfter должен быть СТРОГО ПОЗЖЕ момента нашего логина
  //   4. Буфер 5 с: если флаг выставлен почти одновременно с логином —
  //      вероятна гонка (новый кассир вошёл пока закрывалась старая смена)
  //   5. Флаги старше 8 часов считаются устаревшими и игнорируются
  //   6. Admins и super-admin никогда не выселяются этим механизмом,
  //      даже если в их документе появился forceLogoutAfter
  //      (исключение: явный «выгнать» от super-admin через SessionsView)
  useEffect(() => {
    if (!currentUser?.id) return;
    // Admins/super работают без смен — force-logout для них не применяется
    // (SessionsView всё равно может выгнать через прямое обращение к этому эффекту,
    //  но только если явно задан forceLogoutAfter)
    if (currentUser.role === 'super') return; // super нельзя выгнать вообще

    if (forceLogoutTriggeredRef.current) return; // уже обработали

    // Если loginAt не установлен (Electron restart, старый формат) — используем текущее время.
    // forceLogoutAfter из прошлого будет <= nowMs → не сработает, что безопасно.
    const loginAt = getLoginAt() || new Date().toISOString();
    if (!loginAt) return;

    // Ищем документ по login (стабильный), а не по id — защита от смены Firestore document ID
    const myDoc = usersList.find(u => u.login === currentUser.login && u.role !== 'super')
                ?? usersList.find(u => u.id === currentUser.id);
    if (!myDoc?.forceLogoutAfter) return;

    const forceAtMs = new Date(myDoc.forceLogoutAfter).getTime();
    const loginAtMs = new Date(loginAt).getTime();
    const nowMs     = Date.now();

    // Условие 1: флаг должен быть выставлен ПОСЛЕ начала нашей сессии
    if (forceAtMs <= loginAtMs) return;

    // Условие 2: минимальный буфер 5 с между логином и флагом
    // (защита от гонки: закрытие смены и новый логин почти одновременно)
    if (forceAtMs - loginAtMs < 5_000) return;

    // Условие 3: флаг не устарел — не старше 8 часов
    if (nowMs - forceAtMs > 8 * 60 * 60 * 1_000) return;

    // ✅ Все условия выполнены — инициируем выход
    forceLogoutTriggeredRef.current = true;

    const reason = (myDoc.lastShiftEnd && myDoc.lastShiftEnd === myDoc.forceLogoutAfter)
      ? 'shift_closed'
      : 'admin_revoke';

    showNotification(
      reason === 'shift_closed'
        ? 'Смена закрыта. Выполняется автоматический выход...'
        : 'Сессия завершена администратором. Выполняется выход...',
      'warning',
    );
    logAction(currentUser, 'force_logout', {
      reason,
      forceAt: myDoc.forceLogoutAfter,
      loginAt,
    });

    const tid = setTimeout(() => handleLogout(), 2_000);
    return () => clearTimeout(tid);
  }, [usersList]); // eslint-disable-line react-hooks/exhaustive-deps

  // БАГ-4 FIX: авто-logout когда документ юзера удалён из Firestore.
  // Если кассир/admin залогинен, но его doc исчез из usersList (команда удалила) —
  // выходим автоматически. Проверяем только когда usersList загружен (> 0).
  useEffect(() => {
    if (!currentUser || currentUser.role === 'super') return;
    if (usersList.length === 0) return; // ещё не загружен
    const myDoc = usersList.find(u => u.login === currentUser.login);
    if (!myDoc) {
      showNotification('Ваш аккаунт был удалён. Выполняется выход...', 'warning');
      setTimeout(() => handleLogout(), 1_500);
    }
  }, [usersList]); // eslint-disable-line react-hooks/exhaustive-deps

  // Проверка занятости смены в хостеле (для LoginScreen)
  const checkHostelShift = useCallback((hostelId, userId, userLogin) => {
    const activeShift = shifts.find(s =>
      s.hostelId === hostelId &&
      !s.endTime &&
      s.staffId !== userId &&
      (userLogin ? s.staffLogin !== userLogin : true) &&
      usersList.some(u => u.id === s.staffId || (s.staffLogin && u.login === s.staffLogin))
    );
    if (!activeShift) return null;
    const owner = usersList.find(u => u.id === activeShift.staffId || (activeShift.staffLogin && u.login === activeShift.staffLogin));
    return owner?.name || activeShift.staffLogin || 'другой сотрудник';
  }, [shifts, usersList]);

  const handleKppConfirm = useCallback(async (guestId) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), {
        kppRegistered: true,
        kppRegisteredAt: new Date().toISOString(),
      });
      logAction(currentUser, 'kpp_confirm', { guestId });
      showNotification('КПП регистрация подтверждена', 'success');
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  }, [currentUser]);

  const handleKppReset = useCallback(async (guestId, newKppDate) => {
    try {
      const updates = {
        kppRegistered: false,
        kppRegisteredAt: deleteField(),
      };
      if (newKppDate) updates.kppDate = newKppDate;
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), updates);
      logAction(currentUser, 'kpp_reset', { guestId, newKppDate });
      showNotification('Отсчёт КПП сброшен', 'success');
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  }, [currentUser]);

  // e-mehmon: отметки «зарегистрирован/выведен» на госте
  const handleEmehmonFlag = useCallback(async (guestId, updates) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), updates);
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // e-mehmon: открыть подтверждение фонового выселения. Если Electron недоступен
  // (веб) — фолбэк на старое окно. Иначе показываем модалку EmehmonDepartureModal.
  const handleEmehmonDepart = useCallback((guestOrList) => {
    if (!guestOrList) return;
    const arr = Array.isArray(guestOrList) ? guestOrList.filter(Boolean) : [guestOrList];
    if (!arr.length) return;
    setEmehmonReminder(null); // закрываем напоминание, чтобы не перекрывало модалку выселения
    if (window.electronAPI?.emehmonDeparture) {
      setEmehmonDepart(arr);
    } else {
      openEmehmonDeparture(arr[0]);
      showNotification('Открываю e-mehmon — «Выселить» или «Печать»', 'info');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Итог фонового выселения: помечаем «выведен», чистим лоадеры, обновляем список.
  const handleDepartOutcome = useCallback((res, list) => {
    const ids = (list || []).filter(g => g && g.id).map(g => g.id);
    setEmehmonDepartingIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
    const status = res?.status;
    if (status === 'done' || status === 'submitted') {
      const now = new Date().toISOString();
      ids.forEach(id => handleEmehmonFlag(id, { emehmonOut: true, emehmonOutAt: now }));
      const n = res?.selected != null ? res.selected : (list || []).length;
      showNotification(`Выселено из e-mehmon: ${n} ✓`, 'success');
      setEmehmonReminder(null);
      // Сверка с e-mehmon: подтянуть свежий /listok, подтвердить вывод по факту
      // (на случай если «submitted» — Check-Out прошёл, но закрытие не подтвердилось).
      setTimeout(() => { if (emehmonSyncRef.current) emehmonSyncRef.current(false); }, 1500);
    } else if (status === 'need_login') {
      showNotification('Войдите в e-mehmon (окно открыто), затем повторите выселение.', 'info');
    } else if (status === 'multiple') {
      showNotification('Несколько совпадений в e-mehmon — завершите вручную в открытом окне.', 'warning');
    } else if (status === 'not_found') {
      showNotification('Гость(и) не найдены в e-mehmon — завершите вручную в открытом окне.', 'error');
    } else {
      showNotification('Не удалось выселить автоматически — завершите вручную в открытом окне.', 'error');
    }
  }, [handleEmehmonFlag]); // eslint-disable-line react-hooks/exhaustive-deps

  // Подтверждение из модалки: закрываем её сразу, выселяем в фоне, кнопки —
  // в загрузку (departingIds); по завершении гость уходит из всех плашек/вкладок.
  const handleEmehmonDepartConfirm = useCallback((opts) => {
    const list = emehmonDepart || [];
    if (!list.length) return;
    setEmehmonDepart(null); // окно уходит в фон сразу
    const ids = list.filter(g => g && g.id).map(g => g.id);
    setEmehmonDepartingIds(prev => new Set([...prev, ...ids]));
    showNotification(`Выселяю в e-mehmon (${list.length}) в фоне…`, 'info');
    (async () => {
      const res = list.length > 1
        ? await departEmehmonBulk(list, opts)
        : await departEmehmonBackground(list[0], opts);
      handleDepartOutcome(res, list);
    })();
  }, [emehmonDepart, handleDepartOutcome]); // eslint-disable-line react-hooks/exhaustive-deps

  // «Готово»/«Уже выведен»: нельзя просто убрать плашку — сверяемся с e-mehmon.
  // absent (нет в активном /listok) → ставим отметку; present (ещё активен) →
  // отметку не даём, открываем окно выселения, чтобы не отмечали «просто так».
  const handleEmehmonDone = useCallback(async (guest) => {
    if (!guest) return;
    if (!window.electronAPI?.emehmonCheck) {
      handleEmehmonFlag(guest.id, { emehmonOut: true, emehmonOutAt: new Date().toISOString() });
      setEmehmonReminder(null);
      return;
    }
    setEmehmonChecking(guest.id);
    showNotification('Проверяю в e-mehmon…', 'info');
    const res = await checkEmehmonActive(guest);
    setEmehmonChecking(null);
    const status = res?.status;
    if (status === 'absent') {
      handleEmehmonFlag(guest.id, { emehmonOut: true, emehmonOutAt: new Date().toISOString() });
      showNotification('Подтверждено: гость выселен в e-mehmon ✓', 'success');
      setEmehmonReminder(null);
    } else if (status === 'present') {
      showNotification('Гость ещё активен в e-mehmon — сначала выселите', 'warning');
      setEmehmonReminder(null);
      setEmehmonDepart([guest]);
    } else if (status === 'need_login') {
      showNotification('Войдите в e-mehmon (окно открыто), затем повторите.', 'info');
    } else {
      showNotification('Не удалось проверить e-mehmon — выселите вручную.', 'error');
      setEmehmonReminder(null);
      setEmehmonDepart([guest]);
    }
  }, [handleEmehmonFlag]); // eslint-disable-line react-hooks/exhaustive-deps

  // Фоновая синхронизация статусов регистрации: тянем /listok текущего филиала и
  // авто-ставим «Зарегистрирован» совпавшим активным иностранцам. НЕ снимаем —
  // поэтому ложноотрицательные (другой филиал/аккаунт) безвредны.
  const runEmehmonSync = useCallback(async (manual = false) => {
    if (!window.electronAPI?.emehmonList) {
      if (manual) showNotification('Доступно только в десктоп-приложении', 'info');
      return;
    }
    if (emehmonSyncBusy.current) return;
    emehmonSyncBusy.current = true;
    if (manual) { setEmehmonSyncing(true); showNotification('Проверяю e-mehmon…', 'info'); }
    try {
      const hostelId = (currentUser.hostelId && currentUser.hostelId !== 'all')
        ? currentUser.hostelId
        : (selectedHostelFilter && selectedHostelFilter !== 'all' ? selectedHostelFilter : 'hostel1');
      const res = await fetchEmehmonRegistered(hostelId);
      if (res?.status === 'ok') {
        setEmehmonList(res.rows || []);
        const norm = s => (s || '').replace(/\s/g, '').toUpperCase();
        const pSet = new Set((res.rows || []).map(r => r.passport).filter(Boolean));
        const nSet = new Set((res.rows || []).map(r => r.name).filter(Boolean));
        // e-mehmon регистрирует всех гостей (в т.ч. граждан Узбекистана) — фильтр
        // по гражданству НЕ применяем, сопоставляем по паспорту/ФИО.
        const toMark = (guests || []).filter(g =>
          g.status === 'active' && !g.emehmonReg &&
          (pSet.has(norm(g.passport)) || nSet.has(norm(g.fullName))));
        const now = new Date().toISOString();
        for (const g of toMark) {
          try {
            await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id),
              { emehmonReg: true, emehmonRegAt: now, emehmonRegAuto: true });
          } catch (_) { /* пропускаем */ }
        }
        // Авто-подтверждение вывода: выселенный гость, зарегистрированный в e-mehmon,
        // которого в /listok уже НЕТ → выведен. Только для своего филиала (g.hostelId
        // === hostelId), чтобы чужой аккаунт не дал ложного «выведен».
        const toMarkOut = (guests || []).filter(g =>
          g.status === 'checked_out' && g.emehmonReg && !g.emehmonOut && g.hostelId === hostelId &&
          !((g.passport && pSet.has(norm(g.passport))) || (g.fullName && nSet.has(norm(g.fullName)))));
        for (const g of toMarkOut) {
          try {
            await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id),
              { emehmonOut: true, emehmonOutAt: now, emehmonOutAuto: true });
          } catch (_) { /* пропускаем */ }
        }
        // ── АВТО-ВЫВОД ПО ИСТЕЧЕНИИ СРОКА ────────────────────────────────────
        // Регистрации (журнал), у которых срок вышел, а статус ещё active:
        //  • есть в /listok → выселяем в фоне одной операцией → помечаем removed;
        //  • нет в /listok → уже выведен → просто помечаем removed.
        const expiredActive = (registrations || []).filter(r =>
          r.status === 'active' && r.hostelId === hostelId && r.endDate &&
          new Date(r.endDate + 'T23:59:59').getTime() < Date.now());
        if (expiredActive.length > 0) {
          const inListok = expiredActive.filter(r =>
            (r.passport && pSet.has(norm(r.passport))) || (r.fullName && nSet.has(norm(r.fullName))));
          const absent = expiredActive.filter(r => !inListok.includes(r));
          const markRemoved = async (r, by) => {
            try {
              await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'registrations', r.id),
                { status: 'removed', removedAt: new Date().toISOString(), removedBy: by });
            } catch (_) { /* пропускаем */ }
          };
          for (const r of absent) await markRemoved(r, 'auto_expiry_absent');
          if (inListok.length > 0 && window.electronAPI?.emehmonDepartureBulk) {
            const dep = await departEmehmonBulk(
              inListok.map(r => ({ fullName: r.fullName, passport: r.passport, hostelId })),
              { hostelId });
            if (dep?.status === 'done' || dep?.status === 'submitted') {
              for (const r of inListok) await markRemoved(r, 'auto_expiry');
              showNotification(`⏰ Срок истёк — авто-выведено из e-mehmon: ${inListok.length}`, 'success');
            } else if (manual) {
              showNotification('Авто-вывод истёкших не удался — выведите вручную.', 'warning');
            }
          } else if (absent.length > 0 && manual) {
            showNotification(`Истёкшие регистрации закрыты: ${absent.length} (уже выведены из e-mehmon)`, 'info');
          }
        }

        // ── АВТО-ДОБОР «ЗАБЫТЫХ» МЕСТНЫХ ────────────────────────────────────
        // Активные граждане Узбекистана с оплатой, без e-mehmon/кадастра и без
        // прежней ошибки — регистрируем сами, ТИХО (окно не показываем).
        // Ошибка госбазы → пометка «ошибка в паспортных данных» на госте,
        // повторов не делаем, пока данные не исправят (пометка снимается при
        // редактировании паспорта/ДР). До 3 гостей за цикл (цикл каждые 5 мин).
        if (window.electronAPI?.emehmonArrivalAuto) {
          const paidOf = (g) => (typeof g.amountPaid === 'number' ? g.amountPaid : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0)));
          const inCad = (g) => (cadastreRegs || []).some(r =>
            r.status !== 'removed' &&
            (r.guestId === g.id || (r.passport && g.passport && norm(r.passport) === norm(g.passport))));
          const candidates = (guests || []).filter(g =>
            g.status === 'active' && g.country === 'Узбекистан' &&
            !g.emehmonReg && !g.emehmonSkip && !g.emehmonRegError &&
            g.hostelId === hostelId && paidOf(g) > 0 &&
            !(pSet.has(norm(g.passport)) || nSet.has(norm(g.fullName))) &&
            !inCad(g) && !emehmonAutoBusy.current.has(g.id)
          ).slice(0, 3);
          for (const g of candidates) {
            emehmonAutoBusy.current.add(g.id);
            try {
              const reg = await autoRegisterArrival(g, { silent: true });
              const st = reg?.status;
              if (st === 'done') {
                await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id),
                  { emehmonReg: true, emehmonRegAt: new Date().toISOString(), emehmonRegAuto: true, emehmonRegError: deleteField() });
                showNotification(`${g.fullName} — зарегистрирован в e-mehmon (авто) ✓`, 'success');
              } else if (st === 'not_found') {
                await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id),
                  { emehmonRegError: 'Ошибка в паспортных данных — нужно исправить', emehmonRegErrorAt: new Date().toISOString() });
                showNotification(`⚠️ ${g.fullName}: не найден в госбазе — проверьте паспорт и дату рождения`, 'warning');
              } else if (st === 'no_room') {
                await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id),
                  { emehmonRegError: 'Комната не совпала с e-mehmon — проверьте номер', emehmonRegErrorAt: new Date().toISOString() });
              } else if (st === 'need_login') {
                break; // без входа продолжать нет смысла — попробуем в следующем цикле
              }
              // прочие сбои (таймаут/сеть) — без пометки, повтор в следующем цикле
            } catch (_) { /* пропускаем */ } finally {
              emehmonAutoBusy.current.delete(g.id);
            }
          }
        }
        if (manual) showNotification(`Синхронизация e-mehmon: отмечено ${toMark.length}, выведено ${toMarkOut.length}`, 'success');
      } else if (res?.status === 'need_login') {
        if (manual) showNotification('Войдите в e-mehmon (окно открыто), затем повторите.', 'info');
      } else {
        if (manual) showNotification('Не удалось получить список e-mehmon.', 'error');
      }
    } finally {
      emehmonSyncBusy.current = false;
      if (manual) setEmehmonSyncing(false);
    }
  }, [guests, registrations, cadastreRegs, currentUser, selectedHostelFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Стабильный планировщик: старт через 8с после входа + каждые 6 часов.
  const emehmonSyncRef = useRef(runEmehmonSync);
  useEffect(() => { emehmonSyncRef.current = runEmehmonSync; }, [runEmehmonSync]);
  useEffect(() => {
    if (!window.electronAPI?.emehmonList || !currentUser) return;
    const t = setTimeout(() => emehmonSyncRef.current(false), 8000);
    const iv = setInterval(() => emehmonSyncRef.current(false), 5 * 60 * 1000); // каждые 5 минут
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [currentUser]);

  // Полная авто-регистрация прибытия (граждане Узбекистана) в фоне.
  const emehmonAutoBusy = useRef(new Set()); // guestId в процессе — защита от дубля листка
  const handleEmehmonAutoArrival = useCallback(async (guest) => {
    if (!guest || !window.electronAPI?.emehmonArrivalAuto) return;
    if (guest.id && emehmonAutoBusy.current.has(guest.id)) return; // уже регистрируется
    if (guest.id) emehmonAutoBusy.current.add(guest.id);
    showNotification(`Регистрирую ${guest.fullName} в e-mehmon (авто)…`, 'info');
    const res = await autoRegisterArrival(guest);
    if (guest.id) emehmonAutoBusy.current.delete(guest.id);
    const st = res?.status;
    if (st === 'done') {
      handleEmehmonFlag(guest.id, { emehmonReg: true, emehmonRegAt: new Date().toISOString(), emehmonRegAuto: true, emehmonRegError: deleteField() });
      showNotification(`${guest.fullName} — зарегистрирован в e-mehmon ✓`, 'success');
    } else if (st === 'need_login') {
      showNotification('Войдите в e-mehmon (окно открыто) — затем регистрация продолжится.', 'info');
    } else if (st === 'not_found') {
      showNotification(`${guest.fullName}: нет в госбазе — завершите регистрацию вручную (окно открыто).`, 'warning');
    } else if (st === 'no_room') {
      showNotification(`${guest.fullName}: комната не совпала с e-mehmon — завершите вручную (окно открыто).`, 'warning');
    } else if (st === 'no_electron') {
      /* веб — пропускаем */
    } else {
      showNotification(`${guest.fullName}: авто-регистрация не завершена — проверьте окно e-mehmon.`, 'error');
    }
  }, [handleEmehmonFlag]); // eslint-disable-line react-hooks/exhaustive-deps

  // Успешная регистрация прибытия в e-mehmon → авто-галочка «Зарегистрирован».
  const guestsRef = useRef(guests);
  useEffect(() => { guestsRef.current = guests; }, [guests]);
  const emehmonRegHooked = useRef(false);
  useEffect(() => {
    if (emehmonRegHooked.current || !window.electronAPI?.onEmehmonRegistered) return;
    emehmonRegHooked.current = true;
    window.electronAPI.onEmehmonRegistered((data) => {
      const norm = s => (s || '').replace(/\s/g, '').toUpperCase();
      let id = data?.guestId;
      if (!id && data?.passport) {
        const g = (guestsRef.current || []).find(x =>
          x.passport && norm(x.passport) === norm(data.passport) && x.status === 'active');
        id = g?.id;
      }
      if (id) {
        handleEmehmonFlag(id, { emehmonReg: true, emehmonRegAt: new Date().toISOString(), emehmonRegAuto: true });
        showNotification('Гость зарегистрирован в e-mehmon ✓', 'success');
      }
    });
  }, [handleEmehmonFlag]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = (user) => {
    const defEntry = DEFAULT_USERS.find(d => d.login === user.login);
    const enrichedUser = (defEntry?.canViewHostel1 && !user.canViewHostel1)
      ? { ...user, canViewHostel1: true }
      : user;
    setCurrentUser(enrichedUser); 
    const { pass: _p, ...sessionUser } = enrichedUser;
    sessionStorage.setItem('hostella_user_v4', JSON.stringify(sessionUser)); 

    // Новый LoginScreen сам обрабатывает выбор хостела внутри карточки → selectedHostel уже задан
    if (enrichedUser.role === 'cashier' && (enrichedUser.allowedHostels || []).length > 1 && enrichedUser.selectedHostel) {
      const hostelId = enrichedUser.selectedHostel;
      const updated = { ...enrichedUser, hostelId };
      setCurrentUser(updated);
      setSelectedHostelFilter(hostelId);
      const { pass: _p2, ...sessionUser2 } = updated;
      sessionStorage.setItem('hostella_user_v4', JSON.stringify(sessionUser2));
      setActiveTab('rooms');
      createSession(updated);
      logAction(updated, 'login', { device: navigator.platform, role: updated.role, selectedHostel: hostelId });
      return;
    }

    // Кассир с несколькими хостелами без выбора → показываем экран выбора хостела (fallback)
    if (enrichedUser.role === 'cashier' && (enrichedUser.allowedHostels || []).length > 1) {
      setHostelPickerPending(true);
      return; // сессия и лог — после выбора хостела
    }

    if (enrichedUser.hostelId && enrichedUser.hostelId !== 'all') setSelectedHostelFilter(enrichedUser.hostelId);
    if (enrichedUser.role === 'cashier') setActiveTab('rooms'); 
    else setActiveTab('dashboard'); 
    // Создаем запись сессии и логируем вход
    createSession(enrichedUser);
    logAction(enrichedUser, 'login', { device: navigator.platform, role: enrichedUser.role });
  };
  
  const handleLogout = () => {
    if (currentUser) {
      logAction(currentUser, 'logout', {});
      closeSession(); // async, не блокируем UX
    }
    setCurrentUser(null); 
    setHostelPickerPending(false);
    sessionStorage.removeItem('hostella_user_v4'); 
  };

  const handleHostelPick = (hostelId) => {
    const updated = { ...currentUser, hostelId };
    setCurrentUser(updated);
    setSelectedHostelFilter(hostelId);
    const { pass: _p, ...sessionUser } = updated;
    sessionStorage.setItem('hostella_user_v4', JSON.stringify(sessionUser));
    setHostelPickerPending(false);
    setActiveTab('rooms');
    createSession(updated);
    logAction(updated, 'login', { device: navigator.platform, role: updated.role, selectedHostel: hostelId });
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
    handleRejectBooking, handleTrimDays,
  } = useGuestActions({
    currentUser, rooms, guests, clients,
    cadastreRegs,
    selectedHostelFilter, lang,
    checkInModal, setCheckInModal,
    setGuestDetailsModal, setMoveGuestModal,
    setUndoStack, setUndoHistoryOpen,
    showNotification, isOnline,
    setEmehmonReminder,
    setEmehmonArrivalPrompt,
    onEmehmonDepart: handleEmehmonDepart,
    onEmehmonAutoArrival: handleEmehmonAutoArrival,
  });

  const {
    handleUpdateClient, handleImportClients, handleDeduplicate,
    handleBulkDeleteClients, handleNormalizeCountries, handleSyncClientsFromGuests,
    handleTopUpBalance, handleAddClient, handleAdjustBalance,
  } = useClientActions({ currentUser, clients, showNotification, setUndoStack });

  const {
    handleStartShift, handleEndShift,
    handleTransferShift, handleTransferToMe,
    handleAdminAddShift, handleAdminUpdateShift, handleAdminDeleteShift,
    handleAddUser, handleUpdateUser, handleDeleteUser: deleteUserById,
    handleChangePassword,
  } = useShiftActions({
    currentUser, setCurrentUser,
    usersList, shifts, payments,
    showNotification, onLogout: handleLogout,
  });

  const {
    handleRegistrationSubmit, handleExtendRegistration,
    handleRemoveFromEmehmon, handleDeleteRegistration,
  } = useRegistrationActions({
    currentUser, selectedHostelFilter, lang,
    setRegistrationModal, showNotification, guests,
  });

  const {
    handleAddCadastre, handleUpdateCadastre, handleDeleteCadastre,
    handleAddCadastreReg, handleExtendCadastreReg, handleUpdateCadastreReg,
    handleRemoveCadastreReg, handleDeleteCadastreReg,
    handleAddRegToExpenses, handleAddAllToExpenses,
  } = useCadastreActions({
    currentUser, selectedHostelFilter, showNotification, tgSettings, isOnline,
    setUndoStack,
  });

  const { handleAddExpense, handleDeletePayment, downloadExpensesCSV, handleCashToTerminal, handleEditExpenseCategory, handleUpdateExpense } = useExpenseActions({
    currentUser, selectedHostelFilter,
    expenses, usersList, lang,
    setExpenseModal, setUndoStack,
    showNotification, isOnline,
  });

  const { addRecurring, updateRecurring, deleteRecurring, toggleActive: toggleRecurringActive, fireNow: fireRecurringNow, getRecurringAdvances } = useRecurringExpenses({
    currentUser, selectedHostelFilter,
    recurringExpenses, expenses, showNotification,
  });

  // Уведомления об истекающих кадастр-регистрациях
  useCadastreAlerts({ cadastreRegs, clients, tgSettings, isOnline });

  // 🔔 Уведомление Telegram в день дедлайна и на следующий день (срок зависит от гражданства)
  useEffect(() => {
    if (!isOnline || !guests?.length || !currentUser) return;
    const disabledTypes = new Set(tgSettings?.disabledTypes || []);
    if (disabledTypes.has('kppAlert')) return;
    const today = new Date().toISOString().slice(0, 10);
    guests.forEach(g => {
      if (g.status !== 'active') return;
      if (!g.kppDate || !g.country || g.country === 'Узбекистан') return;
      if (g.kppRegistered) return;
      // День прибытия = 1. Срок без регистрации зависит от гражданства (дедлайн = regWindow).
      // Шлём КАЖДЫЙ день начиная с дня дедлайна, пока не зарегистрируют (kppRegistered).
      // Раньше слали только 2 дня — пропустил их (приложение закрыто) и гость терялся.
      // Дубли исключены: ключ alertsLog уникален на гостя+день (kpp_id_dayN_дата).
      const regWindow = getRegistrationWindow(g.country);
      const days = getKppDayNumber(g.kppDate);
      if (days < regWindow) return;
      const key = `kpp_${g.id}_day${days}_${today}`;
      const hostelName = g.hostelId === 'hostel2' ? 'Хостел №2' : 'Хостел №1';
      const room = rooms.find(r => r.id === g.roomId);
      const fmt = (d) => d ? new Date(d).toLocaleDateString('ru-RU') : '—';
      const msg = [
        `📍 <b>Нужна регистрация!</b>`,
        `👤 ${g.fullName}`,
        `🪪 ${g.passport || '—'}`,
        `🎂 Д/р: ${fmt(g.birthDate)}`,
        `📋 Паспорт выдан: ${fmt(g.passportIssueDate)}`,
        `🌐 ${g.country}`,
        `📅 Дата КПП: ${fmt(g.kppDate)}`,
        `⏰ Прошло <b>${days} дн.</b> из ${regWindow} — требуется регистрация`,
        `🏨 ${hostelName} · Комната ${room?.number || g.roomNumber || '?'}, место ${g.bedId}`,
      ].join('\n');
      // checkAndMarkAlert атомарно проверяет Firestore: один раз на все устройства
      checkAndMarkAlert(key).then(shouldFire => {
        if (shouldFire) sendTelegramMessage(msg, 'kppAlert');
      });
    });
  }, [guests, isOnline, tgSettings]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const allowed = currentUser.allowedHostels || [];
    if (currentUser.canViewHostel1 || allowed.length > 1) {
        return items.filter(i => i.hostelId === selectedHostelFilter);
    }
    const target = currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId;
    return items.filter(i => i.hostelId === target);
  };
  
  const filteredUsersForReports = useMemo(() => {
     if (!currentUser) return [];
     const targetHostel = currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId;
     if (currentUser.role === 'super') return usersList; 
     return usersList.filter(u =>
       u.hostelId === targetHostel ||
       (u.allowedHostels || []).includes(targetHostel) ||
       u.role === 'super' || u.hostelId === 'all'
     );
  }, [usersList, currentUser, selectedHostelFilter]);

  const filteredPayments = useMemo(() => {
    if (!currentUser) return [];
    const targetHostel = currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId;
    if (currentUser.role === 'super') return payments;
    return payments.filter(p => {
        // Приоритет: hostelId сохранённый в платеже — зафиксирован в момент транзакции,
        // не меняется при переводе кассира в другой хостел.
        if (p.hostelId) return p.hostelId === targetHostel;
        // Фолбэк для старых платежей без hostelId
        const staff = usersList.find(u => u.id === p.staffId || u.login === p.staffId);
        return staff && (staff.hostelId === targetHostel || staff.hostelId === 'all');
    });
  }, [payments, usersList, currentUser, selectedHostelFilter]);

  const filteredRooms = useMemo(() => filterByHostel(rooms), [rooms, currentUser, selectedHostelFilter]);
  const filteredGuests = useMemo(() => filterByHostel(guests), [guests, currentUser, selectedHostelFilter]);

  const handleExportGuests = useCallback(() => {
    const active = filteredGuests.filter(g => g.status === 'active');
    if (!active.length) { showNotification('Нет проживающих гостей', 'error'); return; }
    const rows = active.map(g => ({
      'ФИО': g.fullName || '',
      'Паспорт': g.passport || '',
      'Дата выдачи паспорта': g.passportIssueDate || '',
      'Дата рождения': g.birthDate || '',
      'Страна': g.country || '',
      'Телефон': g.phone || '',
      'Комната': g.roomNumber || g.roomId || '',
      'Место': g.bedId || '',
      'Дата заезда': g.checkInDate || '',
      'Дата выезда': g.checkOutDate || '',
      'Дата КПП': g.kppDate || '',
      'КПП подтверждено': g.kppRegistered ? 'Да' : '',
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Гости');
    XLSX.writeFile(wb, `Гости_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [filteredGuests]);

  const filteredExpenses = useMemo(() => filterByHostel(expenses), [expenses, currentUser, selectedHostelFilter]);
  const filteredTasks = useMemo(() => filterByHostel(tasks), [tasks, currentUser, selectedHostelFilter]);
  const filteredRegistrations = useMemo(() => filterByHostel(registrations || []), [registrations, currentUser, selectedHostelFilter]);
  const filteredCadastres     = useMemo(() => filterByHostel(cadastres || []),     [cadastres,     currentUser, selectedHostelFilter]);
  const filteredCadastreRegs  = useMemo(() => filterByHostel(cadastreRegs || []),  [cadastreRegs,  currentUser, selectedHostelFilter]);

  const pendingTasksCount = useMemo(() => {
    return filteredTasks.filter(t => t.status !== 'done').length;
  }, [filteredTasks]);

  // Регистрации E-mehmon с истёкшим сроком
  const registrationsAlertCount = useMemo(() => {
    const now = Date.now();
    return filteredRegistrations.filter(r => {
      if (r.status === 'removed') return false;
      const end = new Date((r.endDate || '') + 'T23:59:59').getTime();
      return end <= now;
    }).length;
  }, [filteredRegistrations]);

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
  // Храним уже замеченные ID в localStorage, чтобы не слать Telegram при Ctrl+R
  // (SEEN_BOOKINGS_KEY объявлен выше за пределами компонента)
  const bookingsInitialized = useRef(false);
  useEffect(() => {
    if (!currentUser) return;
    // Пока гости не загружены (пустой массив в начале) — ничего не делаем
    if (!bookingsInitialized.current && pendingBookingsCount === 0) return;

    const seenIds = new Set(JSON.parse(localStorage.getItem(SEEN_BOOKINGS_KEY) || '[]'));
    const newOnes = websiteBookings.filter(b => b.id && !seenIds.has(b.id));

    if (!bookingsInitialized.current) {
      // Первая загрузка данных — просто запоминаем текущие ID, не шлём Telegram
      bookingsInitialized.current = true;
    } else if (newOnes.length > 0) {
      // Только всплывающее уведомление в приложении. В Telegram уведомляет
      // Cloud Function createWebBooking (один раз на сервере при создании брони),
      // поэтому клиент НЕ шлёт — иначе дубли с каждого онлайн-устройства.
      showNotification(`🔔 Новая заявка с сайта! (всего: ${pendingBookingsCount})`, 'success');
    }

    // Сохраняем актуальные ID (только pending-брони, чтобы сет не раздувался)
    localStorage.setItem(SEEN_BOOKINGS_KEY, JSON.stringify(websiteBookings.map(b => b.id)));
  }, [pendingBookingsCount]);

  // ⏰ Ежедневное напоминание в Telegram о необработанных бронях
  useEffect(() => {
    if (!currentUser) return;
    const REMINDER_KEY = 'hostella_booking_reminder_ts';
    const lastSent = parseInt(localStorage.getItem(REMINDER_KEY) || '0');
    if (Date.now() - lastSent <= 24 * 60 * 60 * 1000) return; // не чаще 1 раза в сутки

    // Откладываем на 5 сек — даём Firebase загрузить данные прежде чем решать слать ли
    const timer = setTimeout(() => {
      if (pendingBookingsCount > 0 && isOnline) {
        const list = websiteBookings.slice(0, 5).map(b =>
          `• ${b.fullName || '—'} — ${b.hostelId === 'hostel1' ? 'Хостел №1' : 'Хостел №2'}, заезд ${b.checkInDate ? new Date(b.checkInDate).toLocaleDateString('ru-RU') : '?'}`
        ).join('\n');
        sendTelegramMessage(`🔔 <b>Необработанные брони с сайта: ${pendingBookingsCount}</b>\n${list}`, 'newBooking');
      }
      // Всегда обновляем метку, чтобы при следующем входе не отправлять снова
      localStorage.setItem(REMINDER_KEY, String(Date.now()));
    }, 5000);
    return () => clearTimeout(timer);
  }, [currentUser?.id]);

  const availableHostelsForUser = useMemo(() => {
    if (!currentUser) return []; 
    
    if (currentUser.role === 'admin' || currentUser.role === 'super') {
      return Object.keys(HOSTELS);
    }
    // allowedHostels — основной механизм. canViewHostel1 — устаревший fallback
    const allowed = currentUser.allowedHostels || [];
    if (allowed.length > 1) return allowed;
    if (currentUser.canViewHostel1) return ['hostel1', 'hostel2'];
    return [];
  }, [currentUser]);

  const [navPrefs, saveNavPrefs] = useNavPrefs(currentUser?.id, currentUser?.role);
  const navPos = navPrefs?.position ?? 'left';

  const canPerformActions = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin' || currentUser.role === 'super') return true;
    // Кассир с несколькими хостелами — может селить в любом из своих
    const allowed = currentUser.allowedHostels || [currentUser.hostelId];
    const isAllowedHostel = allowed.includes(selectedHostelFilter);
    // Устаревший canViewHostel1 — режим только чтения для чужого хостела
    if (currentUser.canViewHostel1 && !isAllowedHostel && selectedHostelFilter !== currentUser.hostelId) return false;
    if (!isAllowedHostel && !currentUser.canViewHostel1) return false;
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
      if (room?.rental?.active) {
          showNotification('Комната сдана в аренду — заселение недоступно', 'error');
          return;
      }
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

  const handleCloneRoom = async (r) => { showNotification('Функция клонирования недоступна', 'error'); };
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
  const handleDeleteRoom = async (r) => {
    if (currentUser?.role !== 'super') {
      showNotification('Удаление комнат доступно только супер-администратору', 'error');
      return;
    }
    const hasGuests = guests.some(g => g.roomId === r.id && g.status === 'active');
    if (hasGuests) {
      showNotification('Нельзя удалить комнату — в ней есть активные гости', 'error');
      return;
    }
    try {
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id));
      showNotification(`Комната №${r.number} удалена`, 'success');
      logAction(currentUser, 'room_delete', { roomId: r.id, number: r.number });
    } catch (e) {
      showNotification('Ошибка удаления: ' + e.message, 'error');
    }
  };

  // Записываем оплату аренды в кассу (коллекция payments) — иначе она не попадает в смену/отчёты
  const logRentalPayments = async (room, { cash = 0, card = 0, qr = 0 } = {}, tenantName = '') => {
    const date = new Date().toISOString();
    const hostelId = room?.hostelId || currentUser?.hostelId || null;
    const staffId = currentUser?.id || currentUser?.login || '';
    const comment = `Аренда №${room?.number || ''}${tenantName ? ' · ' + tenantName : ''}`;
    const mk = (amount, method) => ({ staffId, amount: Number(amount) || 0, method, date, hostelId, comment, rentalRoomId: room?.id || null });
    const items = [];
    if (Number(cash) > 0) items.push(mk(cash, 'cash'));
    if (Number(card) > 0) items.push(mk(card, 'card'));
    if (Number(qr)   > 0) items.push(mk(qr,   'qr'));
    const ids = [];
    for (const it of items) {
      try { const ref = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'payments'), it); ids.push(ref.id); }
      catch (e) { console.error('[rental payment]', e.message); }
    }
    return ids;
  };

  // Снимок состояния комнаты для отмены действий с арендой
  const rentalUndoSnapshot = (room) => ({
    roomId: room?.id,
    prevRental: room?.rental || null,
    prevRentalHistory: room?.rentalHistory ?? null,
  });

  const handleRentRoom = async (roomId, rentalData) => {
    try {
      const room = filteredRooms.find(r => r.id === roomId);
      const snap = rentalUndoSnapshot(room);
      const updates = { rental: rentalData };
      if (room?.rental?.active && room.rental.tenantName) {
        updates.rentalHistory = arrayUnion({ ...room.rental, closedAt: new Date().toISOString() });
      }
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', roomId), updates);
      // Засчитываем оплату аренды в кассу/смену
      const paymentIds = await logRentalPayments(room, { cash: rentalData.paidCash, card: rentalData.paidCard, qr: rentalData.paidQR }, rentalData.tenantName);
      pushUndo({ type: 'rental', ...snap, paymentIds, label: `Сдача в аренду · Комната №${room?.number || ''}` });
      showNotification(`Комната №${room?.number || ''} сдана в аренду`, 'success');
      logAction(currentUser, 'room_rental', { roomId, tenantName: rentalData.tenantName });
      setRoomRentalModal(false);
    } catch (e) {
      showNotification(e.message, 'error');
    }
  };

  const handleEndRental = (room) => {
    setConfirmEndRental(room);
  };

  const handleConfirmEndRental = async () => {
    const room = confirmEndRental;
    if (!room) return;
    setConfirmEndRental(null);
    try {
      const snap = rentalUndoSnapshot(room);
      const updates = { rental: { active: false } };
      if (room.rental?.tenantName) {
        updates.rentalHistory = arrayUnion({ ...room.rental, closedAt: new Date().toISOString(), active: false });
      }
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', room.id), updates);
      pushUndo({ type: 'rental', ...snap, paymentIds: [], label: `Выселение · Комната №${room.number} · ${room.rental?.tenantName || ''}` });
      showNotification(`Аренда комнаты №${room.number} завершена`, 'success');
      logAction(currentUser, 'room_rental_end', { roomId: room.id, roomNumber: room.number });
    } catch (e) {
      showNotification(e.message, 'error');
    }
  };

  const handleEditRental = (room) => {
    setRentalEditModal({ room, initialTab: 'info' });
  };

  const handleExtendRental = (room) => {
    setRentalExtendModal(room);
  };

  const handleConfirmExtendRental = async (roomId, { extDays, paidCash, paidCard, paidQR, newCheckOut, newDays, newTotal }) => {
    try {
      const room = filteredRooms.find(r => r.id === roomId);
      const rental = room?.rental;
      const snap = rentalUndoSnapshot(room);
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', roomId), {
        rental: {
          ...rental,
          days:        newDays,
          totalAmount: newTotal,
          checkOutStr: newCheckOut,
          checkOutDate: new Date(newCheckOut + 'T12:00:00').toISOString(),
          paidCash:    (rental?.paidCash  || 0) + paidCash,
          paidCard:    (rental?.paidCard  || 0) + paidCard,
          paidQR:      (rental?.paidQR    || 0) + paidQR,
          updatedAt:   new Date().toISOString(),
        },
      });
      // Доплата за продление — в кассу/смену
      const paymentIds = await logRentalPayments(room, { cash: paidCash, card: paidCard, qr: paidQR }, rental?.tenantName);
      pushUndo({ type: 'rental', ...snap, paymentIds, label: extDays > 0 ? `Продление +${extDays} дн. · Комната №${room?.number || ''}` : `Оплата при выселении · Комната №${room?.number || ''}` });
      showNotification(extDays > 0 ? `Продлено на ${extDays} дн. → ${newCheckOut}` : 'Оплата принята', 'success');
      logAction(currentUser, 'room_rental_extend', { roomId, extDays, newCheckOut });
      setRentalExtendModal(null);
    } catch (e) {
      showNotification(e.message, 'error');
    }
  };

  const handleUpdateRental = async (roomId, rentalData) => {
    try {
      const room = filteredRooms.find(r => r.id === roomId);
      const old = room?.rental || {};
      const snap = rentalUndoSnapshot(room);
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', roomId), { rental: rentalData });
      // Доплата при редактировании — в кассу разницу (если оплат стало больше)
      const dCash = Math.max(0, (Number(rentalData.paidCash) || 0) - (Number(old.paidCash) || 0));
      const dCard = Math.max(0, (Number(rentalData.paidCard) || 0) - (Number(old.paidCard) || 0));
      const dQR   = Math.max(0, (Number(rentalData.paidQR)   || 0) - (Number(old.paidQR)   || 0));
      const paymentIds = (dCash + dCard + dQR > 0) ? await logRentalPayments(room, { cash: dCash, card: dCard, qr: dQR }, rentalData.tenantName) : [];
      pushUndo({ type: 'rental', ...snap, paymentIds, label: `\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0430\u0440\u0435\u043D\u0434\u044B \u00B7 \u041A\u043E\u043C\u043D\u0430\u0442\u0430 \u2116${room?.number || ''}` });
      showNotification(`\u0410\u0440\u0435\u043D\u0434\u0430 \u043A\u043E\u043C\u043D\u0430\u0442\u044B \u2116${room?.number || ''} \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0430`, 'success');
      logAction(currentUser, 'room_rental_update', { roomId, tenantName: rentalData.tenantName });
      setRentalEditModal(null);
    } catch (e) {
      showNotification(e.message, 'error');
    }
  };

  // \u041E\u043F\u043B\u0430\u0442\u0430 \u0437\u0430\u0434\u043E\u043B\u0436\u0435\u043D\u043D\u043E\u0441\u0442\u0438 \u043F\u043E \u0430\u0440\u0435\u043D\u0434\u0435 \u0438\u0437 \u00AB\u041E\u0431\u0449\u0435\u0439 \u0431\u0430\u0437\u044B\u00BB (\u0414\u043E\u043B\u0433\u0438)
  const handlePayRentalDebt = async (room, { cash = 0, card = 0, qr = 0 } = {}) => {
    if (!room?.id) return;
    const c = Number(cash) || 0, k = Number(card) || 0, q = Number(qr) || 0;
    if (c + k + q <= 0) return;
    try {
      const snap = rentalUndoSnapshot(room);
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', room.id), {
        'rental.paidCash': increment(c),
        'rental.paidCard': increment(k),
        'rental.paidQR':   increment(q),
        'rental.updatedAt': new Date().toISOString(),
      });
      const paymentIds = await logRentalPayments(room, { cash: c, card: k, qr: q }, room.rental?.tenantName);
      pushUndo({ type: 'rental', ...snap, paymentIds, label: `Оплата аренды · Комната №${room.number || ''}` });
      logAction(currentUser, 'room_rental_pay_debt', { roomId: room.id, roomNumber: room.number, amount: c + k + q });
      showNotification(`\u2705 \u041E\u043F\u043B\u0430\u0442\u0430 \u0430\u0440\u0435\u043D\u0434\u044B \u2116${room.number || ''}: ${(c + k + q).toLocaleString()} \u0441\u0443\u043C`, 'success');
    } catch (e) {
      showNotification(e.message, 'error');
    }
  };

  // Запрос на понижение цены: создаём заявку + шлём в Telegram с кнопками одобрения
  const handleRequestPriceReduction = async (guest, requestedPrice) => {
    const price = parseInt(requestedPrice) || 0;
    if (!guest?.id || price <= 0) { showNotification('Укажите корректную цену', 'error'); return; }
    try {
      const chatIds = getConfig().priceApprovalChatIds || [];
      if (!chatIds.length) { showNotification('Не задан Telegram ID для одобрения', 'error'); return; }
      const payload = {
        guestName: guest.fullName || '',
        roomNumber: guest.roomNumber || '',
        hostelId: guest.hostelId || currentUser?.hostelId || '',
        cashierName: currentUser?.name || currentUser?.login || '',
        currentPrice: parseInt(guest.pricePerNight) || 0,
        requestedPrice: price,
      };
      const ref = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'priceRequests'), {
        guestId: guest.id,
        passport: guest.passport || '',
        cashierId: currentUser?.id || currentUser?.login || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
        ...payload,
      });
      await httpsCallable(functions, 'sendPriceRequest')({ requestId: ref.id, chatIds, ...payload });
      logAction(currentUser, 'price_request', { guestId: guest.id, requestedPrice: price });
      showNotification('🔻 Запрос на понижение отправлен на одобрение', 'success');
    } catch (e) {
      showNotification('Ошибка запроса: ' + (e?.message || e), 'error');
    }
  };

  // Запрос на понижение цены ДО заселения (гостя ещё нет) — возвращает id заявки для отслеживания
  const handleCheckinPriceRequest = async ({ guestName, passport, roomNumber, hostelId, requestedPrice }) => {
    const price = parseInt(requestedPrice) || 0;
    if (price <= 0) { showNotification('Укажите корректную цену', 'error'); return null; }
    const chatIds = getConfig().priceApprovalChatIds || [];
    if (!chatIds.length) { showNotification('Не задан Telegram ID для одобрения', 'error'); return null; }
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
      showNotification('🔻 Запрос отправлен на одобрение', 'success');
      return ref.id;
    } catch (e) {
      showNotification('Ошибка запроса: ' + (e?.message || e), 'error');
      return null;
    }
  };

  // Перевод существующего гостя на стандартный тариф (минимум по комнате) без перезаселения
  const handleUpgradeToStandardTariff = async (guest, price) => {
    if (!guest?.id) return;
    const days = parseInt(guest.days) || 0;
    const newPrice = parseInt(price) || minNightPrice(guest.hostelId, guest.roomNumber, guest.checkInDate ? new Date(guest.checkInDate) : new Date());
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guest.id), {
        pricePerNight: newPrice,
        totalPrice: newPrice * days,
        tariff: 'standard',
        nonRefundable: false,
      });
      logAction(currentUser, 'tariff_upgrade_std', { guestId: guest.id, days, price: newPrice });
      showNotification(`✅ Гость переведён на тариф ${newPrice.toLocaleString()}`, 'success');
    } catch (e) {
      showNotification(e.message, 'error');
    }
  };

  // Ручное добавление клиента в список разрешённых на понижение цены (админ)
  const handleGrantPriceReduction = async (client, price) => {
    const key = (client?.passport || '').replace(/\s/g, '').toUpperCase();
    if (!key) { showNotification('У клиента нет паспорта — нельзя добавить', 'error'); return; }
    try {
      await setDoc(doc(db, ...PUBLIC_DATA_PATH, 'priceWhitelist', key), {
        passport: client.passport || '',
        name: client.fullName || '',
        price: parseInt(price) || 0,
        addedBy: currentUser?.name || currentUser?.login || '',
        addedAt: new Date().toISOString(),
        source: 'manual',
      }, { merge: true });
      logAction(currentUser, 'price_whitelist_add', { passport: key, price: parseInt(price) || 0 });
      showNotification('✅ Добавлен в список разрешённых на понижение', 'success');
    } catch (e) { showNotification(e.message, 'error'); }
  };

  const handleRevokePriceReduction = async (entry) => {
    const key = entry?.id || (entry?.passport || '').replace(/\s/g, '').toUpperCase();
    if (!key) return;
    try {
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'priceWhitelist', key));
      logAction(currentUser, 'price_whitelist_remove', { passport: key });
      showNotification('Удалён из списка', 'success');
    } catch (e) { showNotification(e.message, 'error'); }
  };

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

if (versionBlocked) return (
    <OutdatedVersionScreen
        currentVersion={APP_VERSION}
        minVersion={remoteVersionInfo?.minVersion || MIN_REQUIRED_VERSION}
        latestVersion={remoteVersionInfo?.version}
        downloadUrl={remoteVersionInfo?.downloadUrl}
    />
);

// ── Dev preview: показываем ПОСЛЕ хуков ──────────────────────────────────
  if (isPreview) {
    return <LoginScreen users={[]} onLogin={() => {}} lang="ru" setLang={() => {}} themeId="auto" setThemeId={() => {}} />;
  }

if (!currentUser) return (
    <LoginScreen 
        users={usersList} 
        onLogin={handleLogin} 
        onSeed={seedUsers}
        lang={lang} 
        setLang={setLang}
        themeId={loginThemeId}
        setThemeId={handleSetLoginTheme}
        hostelNames={Object.fromEntries(Object.entries(HOSTELS).map(([k,v]) => [k, v.name]))}
        checkHostelShift={checkHostelShift}
    />
);

if (hostelPickerPending) return (
    <HostelPickerScreen
        user={currentUser}
        onPick={handleHostelPick}
        onLogout={handleLogout}
        lang={lang}
        themeId={loginThemeId}
    />
);

if (activeShiftInMyHostel) {
    return (
        <ShiftBlockScreen 
            activeShift={activeShiftInMyHostel} 
            activeUser={activeUserForBlock} 
            currentUser={currentUser} 
            onLogout={handleLogout}
            onSwitchHostel={handleHostelPick}
            myOtherActiveShiftHostelId={myOtherActiveShiftHostelId}
            lang={lang}
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

        {/* Баннер офлайн */}
        {!isOnline && (
          <div className="flex items-center justify-between px-4 py-2 bg-amber-600 text-white text-sm z-50">
            <span>📵 <strong>Нет подключения к интернету.</strong> Данные сохраняются локально и синхронизируются при восстановлении связи. Telegram-уведомления будут отправлены автоматически.</span>
          </div>
        )}

        {/* Баннер обновления */}
        {updateDownloaded && (
          <div className="flex items-center justify-between px-4 py-2 bg-green-600 text-white text-sm z-50">
            <span>✅ Обновление загружено. Перезапустить приложение для установки.</span>
            <button onClick={() => window.electronAPI?.installUpdate()} className="ml-4 px-3 py-1 bg-white text-green-700 rounded font-semibold text-xs hover:bg-green-50">Перезапустить</button>
          </div>
        )}
        {hasUpdate && !updateDownloaded && updateProgress !== null && (
          <div className="px-4 py-1.5 bg-blue-600 text-white text-xs z-50">
            ⏬ Загрузка обновления... {updateProgress}%
            <div className="mt-0.5 h-1 bg-blue-400 rounded overflow-hidden"><div className="h-full bg-white transition-all" style={{width: `${updateProgress}%`}} /></div>
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
            setLang={setLang}
            appTheme={appTheme}
            setAppTheme={setAppTheme}
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
            onOpenGroupReceipt={() => setGroupReceiptOpen(true)}
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
        <div className={`flex flex-1 overflow-hidden ${
            navPos === 'right'  ? 'flex-row-reverse' :
            navPos === 'top'    ? 'flex-col' :
            navPos === 'bottom' ? 'flex-col-reverse' :
            'flex-row'
        }`}>

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
                onOpenGroupReceipt={() => setGroupReceiptOpen(true)}
                onLogout={handleLogout}
                setLang={setLang}
                onOpenChangePassword={() => setIsChangePasswordModalOpen(true)}
                registrationsAlertCount={registrationsAlertCount}
                appTheme={appTheme}
                setAppTheme={setAppTheme}
                navPrefs={navPrefs}
                onNavPrefs={saveNavPrefs}
            />

            <main className="flex-1 flex flex-col overflow-hidden relative">
                <EmehmonPendingBanner
                    guests={filteredGuests}
                    onDepart={(g) => handleEmehmonDepart(g)}
                    onDone={(g) => handleEmehmonDone(g)}
                    checkingId={emehmonChecking}
                    departingIds={emehmonDepartingIds}
                    onOpen={(g) => setGuestDetailsModal({ open: true, guest: g })}
                />
                <div ref={contentScrollRef}
                    onScroll={(e) => setShowScrollTop(e.currentTarget.scrollTop > 400)}
                    className={`app-content-scroll flex-1 overflow-y-auto overflow-x-hidden ${
                    activeTab === 'rooms'
                        ? 'py-3 md:py-6 pt-2 pb-32 md:pb-6'
                        : 'p-3 md:p-6 pt-2 pb-32 md:pb-6'
                }`}>
                {activeTab === 'dashboard' && (currentUser.role === 'admin' || currentUser.role === 'super' || currentUser.permissions?.viewStats === true) && (
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
                        registrations={filteredRegistrations}
                        onOpenGuest={(g) => setGuestDetailsModal({ open: true, guest: g })}
                        onMarkEmehmonOut={(id) => handleEmehmonFlag(id, { emehmonOut: true, emehmonOutAt: new Date().toISOString() })}
                    />
                )}

                {activeTab === 'rooms' && (
                    <RoomsView
                        filteredRooms={filteredRooms}
                        guestsByRoom={guestsByRoom}
                        currentUser={currentUser}
                        onBedClick={(room, bedId, guest, isGhost) => handleBedClick(room, bedId, guest, isGhost)}
                        onAddExtraGuest={(room) => handleBedClick(room, 'extra', null, false)}
                        onEditRoom={(room) => setEditRoomModal({ open: true, room })}
                        onCloneRoom={(room) => handleCloneRoom(room)}
                        onDeleteRoom={(room) => handleDeleteRoom(room)}
                        onAddRoom={() => setAddRoomModal(true)}
                        onKppConfirm={handleKppConfirm}
                        onKppReset={handleKppReset}
                        onEndRental={handleEndRental}
                        onEditRental={handleEditRental}
                        onExtendRental={handleExtendRental}
                        onPayRental={(room) => setRentalPayModal(room)}
                        onOpenGroupReceipt={() => setGroupReceiptOpen(true)}
                        lang={lang}
                        cadastreRegs={filteredCadastreRegs}
                        contractGroups={manualStayGroups}
                        payments={filteredPayments}
                        allGuests={filteredGuests}
                    />
                )}
                
                {activeTab === 'calendar' && (
                    <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
                        <CalendarView
                            rooms={filteredRooms}
                            guests={filteredGuests}
                            clients={clients}
                            payments={filteredPayments}
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
                            onRentalClick={(room) => setRentalEditModal({ room, initialTab: 'info' })}
                            onPayRental={(room) => setRentalPayModal(room)}
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
                        onCashToTerminal={handleCashToTerminal}
                        selectedHostelFilter={selectedHostelFilter}
                        hostels={HOSTELS}
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
        onOpenGuest={(guest) => setGuestDetailsModal({ open: true, guest })}
        rooms={filteredRooms}
        onPayRentalDebt={handlePayRentalDebt}
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
                        users={filteredUsersForReports}
                        allUsers={usersList}
                        currentUser={currentUser} 
                        onStartShift={handleStartShift} 
                        onEndShift={handleEndShift} 
                        onTransferShift={handleTransferShift} 
                        lang={lang} 
                        hostelId={currentUser.role === 'super' ? 'all' : selectedHostelFilter} 
                        onAdminAddShift={handleAdminAddShift}
                        onAdminUpdateShift={handleAdminUpdateShift}
                        onAdminDeleteShift={handleAdminDeleteShift}
                        payments={filteredPayments}
                        expenses={filteredExpenses}
                        onPaySalary={(d) => handleAddExpense({ category: 'Зарплата', amount: d.amount, targetStaffId: d.staffId, comment: d.comment })}
                    />
                )}

                {activeTab === 'clients' && currentUser.permissions?.viewClients !== false && (
                    <ClientsView 
                        clients={clients} 
                        onUpdateClient={handleUpdateClient}
                        onAddClient={handleAddClient}
                        onImportClients={handleImportClients} 
                        onDeduplicate={handleDeduplicate} 
                        onBulkDelete={handleBulkDeleteClients} 
                        onNormalizeCountries={handleNormalizeCountries}
                        onSyncFromGuests={() => handleSyncClientsFromGuests(currentUser.role === 'super' ? guests : filteredGuests)}
                        lang={lang} 
                        currentUser={currentUser} 
                        onOpenClientHistory={handleOpenClientHistory}
                        activePassports={new Set(filteredGuests.filter(g => g.status === 'active' && g.passport).map(g => g.passport))}
                        onAdjustBalance={handleAdjustBalance}
                    />
                )}

                {activeTab === 'registrations' && (
                    <RegistrationsView
                        registrations={filteredRegistrations}
                        guests={filteredGuests}
                        cadastreRegs={filteredCadastreRegs}
                        emehmonList={emehmonList}
                        emehmonDepartingIds={emehmonDepartingIds}
                        emehmonHostelId={(currentUser.hostelId && currentUser.hostelId !== 'all') ? currentUser.hostelId : (selectedHostelFilter && selectedHostelFilter !== 'all' ? selectedHostelFilter : 'hostel1')}
                        currentUser={currentUser}
                        lang={lang}
                        users={usersList}
                        onOpenRegister={() => setRegistrationModal(true)}
                        onRemove={handleRemoveFromEmehmon}
                        onExtend={handleExtendRegistration}
                        onDelete={handleDeleteRegistration}
                        onSyncEmehmon={() => runEmehmonSync(true)}
                        emehmonSyncing={emehmonSyncing}
                        onRegisterEmehmon={(g) => { openEmehmonArrival(g); showNotification('Открываю e-mehmon — нажмите «Заполнить из Hostella»', 'info'); }}
                        onDepartEmehmon={handleEmehmonDepart}
                    />
                )}

                {activeTab === 'cadastre' && (
                    <CadastreView
                        cadastreRegs={currentUser.role === 'admin' || currentUser.role === 'super' ? (cadastreRegs || []) : filteredCadastreRegs}
                        cadastres={currentUser.role === 'admin' || currentUser.role === 'super' ? (cadastres || []) : filteredCadastres}
                        clients={clients}
                        guests={guests}
                        rooms={rooms}
                        currentUser={currentUser}
                        selectedHostelFilter={selectedHostelFilter}
                        onAddReg={handleAddCadastreReg}
                        onExtendReg={handleExtendCadastreReg}
                        onUpdateReg={handleUpdateCadastreReg}
                        onRemoveReg={handleRemoveCadastreReg}
                        onDeleteReg={handleDeleteCadastreReg}
                        onAddToExpenses={handleAddRegToExpenses}
                        onAddAllToExpenses={handleAddAllToExpenses}
                        onAddCadastre={handleAddCadastre}
                        onUpdateCadastre={handleUpdateCadastre}
                        onDeleteCadastre={handleDeleteCadastre}
                    />
                )}
                
                {activeTab === 'staff' && currentUser.role === 'admin' && (
                    <StaffView
                        users={usersList}
                        onAdd={handleAddUser}
                        onDelete={handleDeleteUser}
                        onUpdate={handleUpdateUser}
                        currentUser={currentUser}
                        lang={lang}
                    />
                )}

                {activeTab === 'pricePerms' && (currentUser.role === 'admin' || currentUser.role === 'super') && (
                    <PricePermissionsView
                        whitelist={priceWhitelist}
                        clients={clients}
                        guests={guests}
                        onGrant={handleGrantPriceReduction}
                        onRevoke={handleRevokePriceReduction}
                        lang={lang}
                    />
                )}
                
                {activeTab === 'expenses' && (
                    (currentUser.role === 'admin' || currentUser.role === 'super')
                        ? currentUser.permissions?.viewExpenses !== false
                        : currentUser.permissions?.viewExpenses === true
                ) && (
                    <ExpensesView
                        lang={lang}
                        filteredExpenses={filteredExpenses}
                        expenseCatFilter={expenseCatFilter}
                        setExpenseCatFilter={setExpenseCatFilter}
                        expSearch={expSearch}
                        setExpSearch={setExpSearch}
                        usersList={usersList}
                        onDownloadCSV={downloadExpensesCSV}
                        onAddExpense={(cat) => { setExpenseModalCategory(cat || ''); setExpenseModal(true); }}
                        onEditExpenseCategory={handleEditExpenseCategory}
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
                        onUpdateExpense={handleUpdateExpense}
                        selectedHostelFilter={selectedHostelFilter}
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
                    <AuditLogView auditLog={auditLog} currentUser={currentUser} />
                )}

                {activeTab === 'sessions' && currentUser.role === 'super' && (
                    <SessionsView sessions={sessions} users={usersList} />
                )}

                {activeTab === 'versions' && (currentUser.role === 'admin' || currentUser.role === 'super') && (
                    <ClientVersionsView clientVersions={clientVersions} />
                )}

                {activeTab === 'guesthistory' && (currentUser.role === 'admin' || currentUser.role === 'super') && (
                    <GuestHistoryView
                        guests={guests}
                        payments={payments}
                        shifts={shifts}
                        users={usersList}
                        currentUser={currentUser}
                        auditLog={auditLog}
                    />
                )}

                {activeTab === 'manualstay' && (
                    <ManualStayView
                        guests={guests}
                        rooms={filteredRooms}
                        currentUser={currentUser}
                        payments={filteredPayments}
                        hostelFilter={selectedHostelFilter}
                    />
                )}

                {activeTab === 'analytics' && (currentUser.role === 'admin' || currentUser.role === 'super') && (
                    <AnalyticsView
                        payments={filteredPayments}
                        expenses={filteredExpenses}
                        guests={filteredGuests}
                        rooms={filteredRooms}
                        users={usersList}
                        currentUser={currentUser}
                        lang={lang}
                    />
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

            {/* Кнопка «Наверх» — появляется при прокрутке вниз */}
            {showScrollTop && (
                <button
                    onClick={() => contentScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                    title="Наверх"
                    className="fixed z-40 right-4 w-11 h-11 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                    style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)', background: 'var(--nav-bg)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }}
                >
                    <ArrowUp size={20} />
                </button>
            )}
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
                checkInHour={currentCheckInHour}
                checkOutHour={currentCheckOutHour}
            />
        )}

        {roomRentalModal && (
            <RoomRentalModal
                allRooms={filteredRooms}
                guests={guests}
                onClose={() => setRoomRentalModal(false)}
                onRent={handleRentRoom}
                notify={showNotification}
                lang={lang}
                currentUser={currentUser}
            />
        )}

        {rentalEditModal && (
            <RoomRentalModal
                allRooms={filteredRooms}
                guests={guests}
                mode="edit"
                initialRoom={rentalEditModal.room}
                initialTab={rentalEditModal.initialTab}
                onClose={() => setRentalEditModal(null)}
                onUpdate={handleUpdateRental}
                notify={showNotification}
                lang={lang}
                currentUser={currentUser}
            />
        )}

        {rentalExtendModal && (
            <RentalExtendModal
                room={rentalExtendModal}
                onClose={() => setRentalExtendModal(null)}
                onExtend={handleConfirmExtendRental}
                onEndRental={handleEndRental}
                notify={showNotification}
                currentUser={currentUser}
                guests={guests}
            />
        )}

        {rentalPayModal && (
            <RentalPayModal
                room={rentalPayModal}
                onClose={() => setRentalPayModal(null)}
                onSubmit={handlePayRentalDebt}
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
                onCheckinPriceRequest={handleCheckinPriceRequest}
                priceWhitelist={priceWhitelist}
                notify={showNotification}
                lang={lang}
                currentUser={currentUser}
                checkInHour={currentCheckInHour}
                checkOutHour={currentCheckOutHour}
            />
        )}
        
        {guestDetailsModal.open && (() => {
            // Берём живые данные гостя из Firebase-массива (kppRegistered обновляется сразу)
            const liveGuest = guests.find(g => g.id === guestDetailsModal.guest?.id) || guestDetailsModal.guest;
            return (
            <GuestDetailsModal 
                guest={liveGuest} 
                room={filteredRooms.find(r => r.id === guestDetailsModal.guest.roomId)} 
                currentUser={currentUser}
                clients={clients}
                guests={filteredGuests}
                initialView={guestDetailsModal.initialView || 'dashboard'}
                onClose={() => setGuestDetailsModal({open: false, guest: null})} 
                onUpdate={handleGuestUpdate} 
                onPayment={handlePayment} 
                onSuperPayment={handleSuperPayment}
                onCheckOut={handleCheckOut}
                onEmehmonDepart={handleEmehmonDepart}
                emehmonDepartingIds={emehmonDepartingIds}
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
                onTrimDays={handleTrimDays}
                isOnline={isOnline}
                onTopUpBalance={handleTopUpBalance}
                cadastreRegs={cadastreRegs || []}
                onKppConfirm={handleKppConfirm}
                onKppReset={handleKppReset}
                onPriceRequest={handleRequestPriceReduction}
                onUpgradeTariff={handleUpgradeToStandardTariff}
                priceWhitelist={priceWhitelist}
                onOpenHistory={() => {
                    const g = guestDetailsModal.guest;
                    const norm = s => (s || '').replace(/\s/g, '').toUpperCase();
                    const clientRecord = clients.find(c =>
                        (c.passport && g.passport && norm(c.passport) === norm(g.passport)) ||
                        (g.fullName && norm(c.fullName) === norm(g.fullName))
                    );
                    if (clientRecord) {
                        setGuestDetailsModal({ open: false, guest: null });
                        setClientHistoryModal({ open: true, client: clientRecord });
                    } else {
                        showNotification('Карточка клиента не найдена. Сначала синхронизируйте клиентов.', 'warning');
                    }
                }}
            />
            );
        })()}
        
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
        
        {expenseModal && (canPerformActions || currentUser?.login === 'fazliddin') && (
            <ExpenseModal
                key={expenseModalCategory}
                onClose={() => { setExpenseModal(false); setExpenseModalCategory(''); }}
                onSubmit={handleAddExpense}
                lang={lang}
                currentUser={currentUser}
                initialCategory={expenseModalCategory}
                usersList={usersList}
                selectedHostelFilter={selectedHostelFilter}
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
        
        {shiftModal && currentUser?.role !== 'admin' && currentUser?.role !== 'super' && (
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
            {clientHistoryModal.open && (() => {
                const norm = s => (s || '').replace(/\s/g, '').toUpperCase();
                const orig = clientHistoryModal.client;
                // Каноническая запись клиента (база): по id → по паспорту → по имени.
                // Нужна, чтобы при правке через карточку обновлялась ОСНОВА, а не создавался дубликат.
                const resolvedClient =
                    clients.find(c => orig?.id && c.id === orig.id) ||
                    (orig?.passport ? clients.find(c => c.passport && norm(c.passport) === norm(orig.passport)) : null) ||
                    (orig?.fullName ? clients.find(c => norm(c.fullName) === norm(orig.fullName)) : null) ||
                    orig;
                return (
                <ClientHistoryModal
                    client={resolvedClient}
                    guests={guests}
                    users={usersList}
                    rooms={rooms}
                    currentUser={currentUser}
                    onClose={() => setClientHistoryModal({open: false, client: null})}
                    onRepeatStay={handleRepeatStay}
                    onCheckOut={handleCheckOut}
                    onActivateBooking={handleActivateBooking}
                    onDeleteGuest={handleDeleteGuest}
                    onTopUpBalance={handleTopUpBalance}
                    onAdjustBalance={handleAdjustBalance}
                    onEditClient={(form) => {
                        const { id: _omit, ...data } = form || {};
                        const found =
                            clients.find(c => resolvedClient?.id && c.id === resolvedClient.id) ||
                            (data.passport ? clients.find(c => c.passport && norm(c.passport) === norm(data.passport)) : null) ||
                            (data.fullName ? clients.find(c => norm(c.fullName) === norm(data.fullName)) : null);
                        if (found) handleUpdateClient(found.id, data);
                        else handleAddClient(data);
                    }}
                    lang={lang}
                />
                );
            })()}

            {/* e-mehmon: напоминание вывести при выселении */}
            {emehmonReminder && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
                        <div className="h-1.5 bg-amber-400 w-full" />
                        <div className="p-6 space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-xl">🛫</div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-base">Не забудьте вывести из e-mehmon</h3>
                                    <p className="text-sm text-slate-500 mt-1"><b>{emehmonReminder.fullName}</b> выселен{emehmonReminder.roomNumber ? ` (ком. ${emehmonReminder.roomNumber})` : ''}. Оформите убытие в e-mehmon, затем отметьте.</p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                {window.electronAPI?.openEmehmon && (
                                    <button onClick={() => handleEmehmonDepart(emehmonReminder)}
                                        className="w-full py-2.5 rounded-xl bg-rose-500 text-white font-bold text-sm hover:bg-rose-600">✈️ Вывести в e-mehmon</button>
                                )}
                                <button onClick={() => handleEmehmonDone(emehmonReminder)} disabled={emehmonChecking === emehmonReminder.id}
                                    className="w-full py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 disabled:opacity-50">{emehmonChecking === emehmonReminder.id ? 'Проверка в e-mehmon…' : '✓ Уже выведен'}</button>
                                <button onClick={() => setEmehmonReminder(null)}
                                    className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50">Позже (останется в списке)</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {emehmonDepart && emehmonDepart.length > 0 && (
                <EmehmonDepartureModal
                    guests={emehmonDepart}
                    onClose={() => setEmehmonDepart(null)}
                    onConfirm={handleEmehmonDepartConfirm}
                />
            )}

            {emehmonArrivalPrompt && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
                        <div className="h-1.5 bg-indigo-500 w-full" />
                        <div className="p-6 space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 text-xl">🌐</div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-base">Оформить регистрацию в e-mehmon?</h3>
                                    <p className="text-sm text-slate-500 mt-1"><b>{emehmonArrivalPrompt.fullName}</b>{emehmonArrivalPrompt.roomNumber ? ` · ком. ${emehmonArrivalPrompt.roomNumber}` : ''}{emehmonArrivalPrompt.country ? ` · ${emehmonArrivalPrompt.country}` : ''}</p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button onClick={() => { openEmehmonArrival(emehmonArrivalPrompt); showNotification('Открываю e-mehmon — нажмите «Заполнить из Hostella»', 'info'); setEmehmonArrivalPrompt(null); }}
                                    className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700">🌐 Оформить сейчас</button>
                                <button onClick={() => { handleEmehmonFlag(emehmonArrivalPrompt.id, { emehmonSkip: true, emehmonSkipAt: new Date().toISOString() }); showNotification('Регистрация пропущена для этого гостя', 'info'); setEmehmonArrivalPrompt(null); }}
                                    className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200">Пропустить (без регистрации)</button>
                                <button onClick={() => setEmehmonArrivalPrompt(null)}
                                    className="w-full py-2 rounded-xl border border-slate-200 text-slate-400 font-bold text-xs hover:bg-slate-50">Позже</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Лист в бухгалтерию (доступен всем, включая кассиров) */}
            <GroupReceiptModal
                open={groupReceiptOpen}
                onClose={() => setGroupReceiptOpen(false)}
                defaultHostelId={(currentUser.role === 'admin' || currentUser.role === 'super')
                    ? (selectedHostelFilter && selectedHostelFilter !== 'all' ? selectedHostelFilter : 'hostel1')
                    : (currentUser.hostelId || 'hostel1')}
                activeGuests={(filteredGuests || []).filter(g => g.status === 'active')}
            />

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
            {undoStack.length > 0 && (
                <button
                    onClick={() => setUndoHistoryOpen(true)}
                    className="fixed bottom-20 right-4 md:bottom-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white rounded-full shadow-lg shadow-amber-500/40 hover:shadow-xl hover:shadow-amber-500/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 font-black text-sm transition-all duration-200"
                    style={{ WebkitAppRegion: 'no-drag', ...(navPos === 'bottom' ? { bottom: 72 } : {}) }}
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

            <ConfirmDialog
                open={!!confirmEndRental}
                title="Выселить арендатора?"
                message={confirmEndRental ? `Комната №${confirmEndRental.number} · ${confirmEndRental.rental?.tenantName || ''}` : ''}
                confirmText="Выселить"
                onConfirm={handleConfirmEndRental}
                onCancel={() => setConfirmEndRental(null)}
                danger
                lang={lang}
            />

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