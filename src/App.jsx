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
import { logAction } from './utils/auditLog';
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
  const [notification, setNotification] = useState(null);
  const [lang, setLang] = useState('ru');
  const [hasUpdate, setHasUpdate] = useState(false);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(null); // 0-100

  const showNotification = (message, type = 'success') => { 
    setNotification({ message, type }); 
  };
  
  // --- Data from Firebase (via custom hook) ---
  const {
    rooms, guests, expenses, clients, payments,
    usersList, tasks, shifts, tgSettings, auditLog, promos, registrations,
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
    if (!guests.length || !rooms.length || !currentUser) return;

    const runAutoCheckout = async () => {
        const now = new Date();
        const batch = writeBatch(db);
        let updatesCount = 0;

        guests.forEach(guest => {
            // Проверяем только активных
            if (guest.status !== 'active') return;

            // 1. Защита: Если даты нет, пропускаем (чтобы не выселить ошибочно)
            if (!guest.checkOutDate) return;

            // Определяем дату выезда
            let checkOut = new Date(guest.checkOutDate);
            
            // 2. Защита: Если дата некорректна (Invalid Date), пропускаем
            if (isNaN(checkOut.getTime())) return;

            // Если дата без времени (только дата), устанавливаем конец дня (23:59)
            if (typeof guest.checkOutDate === 'string' && !guest.checkOutDate.includes('T')) {
                checkOut.setHours(23, 59, 59, 999);
            }

            // Считаем разницу во времени
            const diffMs = now - checkOut;
            const hoursOverdue = diffMs / (1000 * 60 * 60);

            // ВАЖНО: Логируем для отладки


            // 3. Защита: Если есть непогашенный долг — не выселяем автоматически
            // (менеджер должен выселить вручную после оплаты)
            const paid = getTotalPaid(guest);
            const totalPrice = guest.totalPrice || 0;
            if (paid < totalPrice) return;

            // 4. Защита: Если есть переплата (будущий платеж) на >= 1 сутки, не выселяем
            const balance = paid - totalPrice;
            if (balance > 0 && balance >= (Number(guest.pricePerNight) || 1)) {
                return;
            }

            // ТОЛЬКО выселяем если просрочка больше 24 часов И дата четко в прошлом
            if (hoursOverdue > 24 && checkOut < now) {
                
                // 1. Обновляем статус гостя на выселен (долг остается в totalPrice)
                const guestRef = doc(db, ...PUBLIC_DATA_PATH, 'guests', guest.id);
                batch.update(guestRef, {
                    status: 'checked_out',
                    autoCheckedOut: true, // Метка, что выселила система
                    systemComment: 'Авто-выселение (тайм-аут > 24ч, долг 0)'
                });

                // 2. Освобождаем комнату
                // Находим комнату, чтобы уменьшить occupied
                const room = rooms.find(r => r.id === guest.roomId);
                if (room) {
                    const roomRef = doc(db, ...PUBLIC_DATA_PATH, 'rooms', room.id);
                    // Важно: используем increment(-1), чтобы избежать гонок данных
                    batch.update(roomRef, {
                        occupied: increment(-1)
                    });
                }
                updatesCount++;
            }
        });

        if (updatesCount > 0) {
            try {
                await batch.commit();
                showNotification(`Авто-выселение: ${updatesCount} гостей (просрочка > 24ч)`, 'warning');
            } catch (e) {
                console.error("Auto-checkout error:", e);
            }
        }
    };

    // Запускаем проверку при загрузке и каждые 6 часов (4 раза в сутки)
    runAutoCheckout();
    const interval = setInterval(runAutoCheckout, 6 * 60 * 60 * 1000); 

    return () => clearInterval(interval);
}, [guests, rooms, currentUser]); // Зависимости

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
        setUpdateProgress(0);
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
    sessionStorage.setItem('hostella_user_v4', JSON.stringify(user)); 
    if (user.hostelId && user.hostelId !== 'all') setSelectedHostelFilter(user.hostelId);
    if (user.role === 'cashier') setActiveTab('rooms'); 
    else setActiveTab('dashboard'); 
  };
  
  const handleLogout = () => { 
    setCurrentUser(null); 
    sessionStorage.removeItem('hostella_user_v4'); 
  };
  
  // ? ФУНКЦИЯ ЗАСЕЛЕНИЯ (ИСПРАВЛЕННАЯ)
  const handleCheckInSubmit = async (formData) => {
    try {
      // 1. Определяем ID хостела (если у админа выбран конкретный, или его родной)
      const targetHostelId = (!currentUser.hostelId || currentUser.hostelId === 'all') 
          ? (formData.hostelId || selectedHostelFilter || 'hostel1') 
          : currentUser.hostelId;

      const safeStaffId = currentUser.id || currentUser.login || 'unknown';

      // 2. Подготовка данных гостя
      const newGuest = {
        ...formData,
        hostelId: targetHostelId,
        staffId: safeStaffId, // Привязываем к кассиру
        checkInDate: new Date(formData.checkInDate).toISOString(),
        checkOutDate: new Date(formData.checkOutDate).toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser.login || 'admin',
        // Очищаем паспорт от пробелов для поиска истории
        passportClean: formData.passport ? formData.passport.replace(/\s/g, '').toUpperCase() : ''
      };

      // 3. Сохраняем гостя в ПРАВИЛЬНУЮ базу (добавлен ...PUBLIC_DATA_PATH)
      const docRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'guests'), newGuest);
      const guestId = docRef.id;

      // 4. Если была оплата сразу при заселении — создаем запись в кассе
      const totalPaid = (Number(formData.paidCash) || 0) + (Number(formData.paidCard) || 0) + (Number(formData.paidQR) || 0);
      let checkinPaymentIds = [];
      if (totalPaid > 0) {
         // ИСПРАВЛЕНО: добавлен ...PUBLIC_DATA_PATH
         const payRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'payments'), {
            guestId,
            staffId: safeStaffId,
            guestName: formData.fullName,
            roomId: formData.roomId,
            roomNumber: formData.roomNumber,
            amount: totalPaid,
            cash: Number(formData.paidCash) || 0,
            card: Number(formData.paidCard) || 0,
            qr: Number(formData.paidQR) || 0,
            date: new Date().toISOString(),
            type: 'income',
            category: 'accommodation', // проживание
            comment: formData.fullName,
            hostelId: targetHostelId,
            admin: currentUser.login || 'admin',
            method: Number(formData.paidCash) > 0 ? 'cash' : (Number(formData.paidCard) > 0 ? 'card' : 'qr')
         });
         checkinPaymentIds = [payRef.id];
      }

      // 5. Увеличиваем счетчик занятых мест в комнате
      if (formData.status === 'active') { 
          const room = rooms.find(r => r.id === formData.roomId); 
          if (room) {
              await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', room.id), {
                  occupied: increment(1)
              }); 
          }
      }

      // 6. Если это заселение из заявки с сайта — удаляем исходную бронь
      if (checkInModal.bookingId) {
        try {
          await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', checkInModal.bookingId));
        } catch (e) {

        }
      }

      // 7. Успех
      showNotification(lang === 'ru' ? 'Гость успешно заселен!' : 'Mehmon muvaffaqiyatli joylashtirildi!', 'success');

      // Audit log
      logAction(currentUser, newGuest.status === 'active' ? 'checkin' : 'booking_add', {
        guestName: newGuest.fullName,
        roomNumber: newGuest.roomNumber,
        bedId: newGuest.bedId,
        amount: totalPaid,
      });

      // Telegram — заселение
      if (newGuest.status === 'active') {
        const hostelLabel = targetHostelId === 'hostel1' ? 'Хостел №1' : 'Хостел №2';
        sendTelegramMessage(
          `🏨 <b>Новое заселение</b>\n👤 ${newGuest.fullName}\n🛏 ${hostelLabel} · Ком. ${newGuest.roomNumber || '—'}, место ${newGuest.bedId || '—'}\n📅 ${new Date(newGuest.checkInDate).toLocaleDateString('ru')} → ${new Date(newGuest.checkOutDate).toLocaleDateString('ru')} (${newGuest.days || 1} дн.)\n💰 Оплачено: ${totalPaid.toLocaleString()} сум\n👷 Кассир: ${currentUser.name || currentUser.login}`,
          'checkin'
        );
      }

      // Undo snapshot
      if (newGuest.status === 'active') {
          pushUndo({
              type: 'checkin',
              label: `${newGuest.fullName} — комн. ${newGuest.roomNumber}, место ${newGuest.bedId}`,
              guestId,
              paymentIds: checkinPaymentIds,
              roomId: formData.roomId,
              wasActive: true,
          });
      }

      // Закрываем окно
      setCheckInModal({ open: false, room: null, bedId: null, date: null, client: null, bookingId: null });

    } catch (error) {
      console.error("Error adding guest:", error);
      showNotification('Ошибка при заселении', 'error');
    }
  };

  // ? ВСТАВЬТЕ СЮДА (между функциями)
  const handleRepeatStay = (client) => {
    // Закрываем историю
    setClientHistoryModal({ open: false, client: null });
    
    // Ищем комнату и открываем заселение
    const room = rooms.find(r => r.id === client.roomId);
    setCheckInModal({ 
        open: true, 
        room: room || null, 
        bedId: client.bedId || null, 
        date: null, 
        client: client 
    });
  };
  
  const handleEndShift = async () => {
      if (currentUser && currentUser.id) { 
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', currentUser.id), { 
          lastShiftEnd: new Date().toISOString() 
        }); 
      }
      const myOpenShift = shifts.find(s => s.staffId === currentUser.id && !s.endTime);
      if (myOpenShift) {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'shifts', myOpenShift.id), { 
            endTime: new Date().toISOString() 
          });
      }
      handleLogout();
  };

  const handleTransferToMe = async (shiftId) => {
      if (!currentUser) return;
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, ...PUBLIC_DATA_PATH, 'shifts', shiftId), { 
          endTime: new Date().toISOString() 
        });
        const newShiftRef = doc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'));
        batch.set(newShiftRef, {
            staffId: currentUser.id,
            hostelId: currentUser.hostelId,
            startTime: new Date().toISOString(),
            endTime: null
        });
        await batch.commit();
        showNotification("Смена принята успешно!", "success");
      } catch (e) {
        showNotification("Ошибка передачи смены: " + e.message, "error");
      }
  };

  const handleChangePassword = async (userId, newPassword) => {
      try {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', userId), { 
              pass: newPassword 
          });
          
          const updatedUser = {...currentUser, pass: newPassword};
          setCurrentUser(updatedUser);
          sessionStorage.setItem('hostella_user_v4', JSON.stringify(updatedUser));
          
          showNotification("Пароль успешно изменен!", 'success');
      } catch (e) {
          showNotification("Ошибка изменения пароля: " + e.message, 'error');
      }
  };

  const handleOpenClientHistory = (client) => {
    setClientHistoryModal({ open: true, client });
  };

  // Data subscriptions have been moved to useAppData hook (src/hooks/useAppData.js)

  const seedUsers = async () => { 
    if (usersList.length === DEFAULT_USERS.length && usersList[0].id === undefined) { 
      try { 
        for(const u of DEFAULT_USERS) { 
          await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'users'), u); 
        } 
        showNotification("Database initialized successfully", 'success'); 
      } catch(e) {
        showNotification("Error initializing database: " + e.message, 'error');
      } 
    } 
  };

  const handleAddUser = async (d) => { 
    await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'users'), d); 
  };

  const handleUpdateUser = async (id, d) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', id), d);
      // Если редактируют текущего пользователя — обновляем сессию
      if (currentUser?.id === id) {
        const updatedUser = { ...currentUser, ...d };
        setCurrentUser(updatedUser);
        sessionStorage.setItem('hostella_user_v4', JSON.stringify(updatedUser));
      }
      showNotification('Сотрудник обновлён', 'success');
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

    const handleDeleteUser = async (id) => { 
    if(confirm("Удалить этого сотрудника?")) {
      try {
        await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'users', id));
        showNotification('Сотрудник удалён', 'success');
      } catch (e) {
        showNotification('Ошибка удаления: ' + e.message, 'error');
      }
    }
  };

  const handleSaveTgSettings = async (data) => {
    try {
      await setDoc(doc(db, ...PUBLIC_DATA_PATH, 'settings', 'telegram'), data);
    } catch (e) {
      showNotification('Ошибка сохранения настроек: ' + e.message, 'error');
      throw e;
    }
  };

  const handleTestTgMessage = async ({ text, chatIds }) => {
    let result;
    try {
      result = await sendTelegramMessage(text, null, chatIds, true);
    } catch (e) {
      // Cloud Function error (auth, config, etc.)
      const msg = e?.message || String(e);
      throw new Error(`Ошибка Cloud Function: ${msg}`);
    }
    if (!result) throw new Error('Нет ответа от сервера — попробуйте позже');
    if (result.sent === 0) {
      const detail = result.failed?.[0]?.msg || result.errors?.[0] || 'неизвестная ошибка';
      throw new Error(`Не доставлено: ${detail}`);
    }
    return result;
  };

  // ── Промокоды ─────────────────────────────────────────────────────────
  const handleSavePromo = async (promo) => {
    const existing = promos.find(p => p.id === promo.id);
    if (existing) {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'promos', promo.id), promo);
    } else {
      const { id: _id, ...promoData } = promo;
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'promos'), promoData);
    }
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
              alert("Admin cannot check-in");
          } else {
              setCheckInModal({ open: true, room, bedId, date: null, bookingId: null });
          }
      } 
  }, [canPerformActions, currentUser]);

  const handleRejectBooking = async (booking) => {
    try {
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', booking.id));
      showNotification('Бронь отклонена');
    } catch (e) {
      showNotification('Ошибка', 'error');
    }
  };

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

  const handleUpdateClient = async (id, d) => { 
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', id), d); 
    showNotification("Updated"); 
  };

  const handleImportClients = async (newClients) => {
    if (newClients.length === 0) return;
    try {
        const batch = writeBatch(db);
        let updated = 0; 
        let created = 0;
        
        newClients.forEach(nc => {
            const existing = clients.find(c => 
              (c.passport && nc.passport && c.passport === nc.passport) || 
              (c.fullName === nc.fullName && c.passport === nc.passport)
            );
            
            if (existing) {
                batch.update(doc(db, ...PUBLIC_DATA_PATH, 'clients', existing.id), { 
                  fullName: existing.fullName || nc.fullName, 
                  passport: existing.passport || nc.passport, 
                  birthDate: existing.birthDate || nc.birthDate, 
                  country: existing.country || nc.country 
                });
                updated++;
            } else {
                batch.set(doc(collection(db, ...PUBLIC_DATA_PATH, 'clients')), { 
                  ...nc, 
                  visits: 0, 
                  lastVisit: new Date().toISOString() 
                });
                created++;
            }
        });
        
        await batch.commit(); 
        showNotification(`Success! New: ${created}, Merged: ${updated}`, 'success');
    } catch (e) { 
      console.error(e); 
      showNotification("Import failed", 'error'); 
    }
  };

  const handleDeduplicate = async () => {
    if(!confirm("Start auto deduplication?")) return;
    try {
        const map = {}; 
        const duplicates = [];
        
        clients.forEach(c => { 
          const key = c.passport ? `P:${c.passport}` : `N:${c.fullName}`; 
          if (!map[key]) map[key] = c; 
          else duplicates.push({ original: map[key], duplicate: c }); 
        });
        
        if (duplicates.length === 0) return showNotification("No duplicates found!");
        
        const batch = writeBatch(db);
        duplicates.forEach(({ original, duplicate }) => {
            batch.update(doc(db, ...PUBLIC_DATA_PATH, 'clients', original.id), { 
              visits: (original.visits||0) + (duplicate.visits||0), 
              lastVisit: new Date(original.lastVisit) > new Date(duplicate.lastVisit) ? original.lastVisit : duplicate.lastVisit 
            });
            batch.delete(doc(db, ...PUBLIC_DATA_PATH, 'clients', duplicate.id));
        });
        
        await batch.commit(); 
        showNotification(`Merged ${duplicates.length} duplicates!`, 'success');
    } catch(e) { 
      console.error(e); 
      showNotification("Deduplication failed", 'error'); 
    }
  };

  const handleBulkDeleteClients = async (ids) => {
      try { 
        const batch = writeBatch(db); 
        ids.forEach(id => batch.delete(doc(db, ...PUBLIC_DATA_PATH, 'clients', id))); 
        await batch.commit(); 
        showNotification(`Deleted ${ids.length} clients`, 'success'); 
      } catch (e) { 
        showNotification("Bulk delete failed", 'error'); 
      }
  };
  
  const handleNormalizeCountries = async () => {
      try { 
        const batch = writeBatch(db); 
        let count = 0; 
        
        clients.forEach(c => { 
          const normalized = getNormalizedCountry(c.country); 
          if (normalized !== c.country) { 
            batch.update(doc(db, ...PUBLIC_DATA_PATH, 'clients', c.id), { country: normalized }); 
            count++; 
          } 
        }); 
        
        if (count > 0) { 
          await batch.commit(); 
          showNotification(`Normalized ${count} countries`, 'success'); 
        } else {
          showNotification("All normalized");
        }
      } catch(e) { 
        showNotification("Normalization failed", 'error'); 
      }
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

  const logTransaction = async (guestId, amounts, staffId) => {
      const { cash, card, qr } = amounts;
      const date = new Date().toISOString();
      const items = [];
      const ids   = [];
      
      if(cash > 0) items.push({ guestId, staffId, amount: cash, method: 'cash', date, hostelId: currentUser.hostelId });
      if(card > 0) items.push({ guestId, staffId, amount: card, method: 'card', date, hostelId: currentUser.hostelId });
      if(qr > 0)   items.push({ guestId, staffId, amount: qr,   method: 'qr',   date, hostelId: currentUser.hostelId });
      
      for(const item of items) {
          const ref = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'payments'), item);
          ids.push(ref.id);
      }
      return ids;
  };

  // ── Undo stack helpers ────────────────────────────────────────────────────
  const pushUndo = (item) => {
      setUndoStack(prev => [
          { ...item, id: Date.now(), timestamp: new Date().toISOString() },
          ...prev,
      ].slice(0, 5));
  };

  const handleUndo = async (item) => {
      try {
          const fb = writeBatch(db);
          if (item.type === 'checkin') {
              fb.delete(doc(db, ...PUBLIC_DATA_PATH, 'guests', item.guestId));
              (item.paymentIds || []).forEach(pid =>
                  fb.delete(doc(db, ...PUBLIC_DATA_PATH, 'payments', pid))
              );
              if (item.wasActive && item.roomId) {
                  fb.update(doc(db, ...PUBLIC_DATA_PATH, 'rooms', item.roomId), { occupied: increment(-1) });
              }
          } else if (item.type === 'payment') {
              (item.paymentIds || []).forEach(pid =>
                  fb.delete(doc(db, ...PUBLIC_DATA_PATH, 'payments', pid))
              );
              fb.update(doc(db, ...PUBLIC_DATA_PATH, 'guests', item.guestId), {
                  paidCash:   increment(-item.cash),
                  paidCard:   increment(-item.card),
                  paidQR:     increment(-item.qr),
                  amountPaid: increment(-(item.cash + item.card + item.qr)),
              });
          } else if (item.type === 'extend') {
              fb.update(doc(db, ...PUBLIC_DATA_PATH, 'guests', item.guestId), {
                  days:        item.prevDays,
                  totalPrice:  item.prevTotalPrice,
                  checkOutDate:item.prevCheckOut,
                  status:      item.prevStatus || 'active',
              });
              (item.paymentIds || []).forEach(pid =>
                  fb.delete(doc(db, ...PUBLIC_DATA_PATH, 'payments', pid))
              );
              const rev = (item.payCash || 0) + (item.payCard || 0) + (item.payQR || 0);
              if (rev > 0) {
                  fb.update(doc(db, ...PUBLIC_DATA_PATH, 'guests', item.guestId), {
                      paidCash:   increment(-(item.payCash || 0)),
                      paidCard:   increment(-(item.payCard || 0)),
                      paidQR:     increment(-(item.payQR   || 0)),
                      amountPaid: increment(-rev),
                  });
              }
          } else if (item.type === 'expense') {
              fb.delete(doc(db, ...PUBLIC_DATA_PATH, 'expenses', item.expenseId));
          }
          await fb.commit();
          setUndoStack(prev => prev.filter(u => u.id !== item.id));
          setUndoHistoryOpen(false);
          showNotification('Действие отменено ↩', 'success');
          logAction(currentUser, 'undo', { originalAction: item.type, label: item.label });
      } catch(e) {
          showNotification('Ошибка отмены: ' + e.message, 'error');
      }
  };

  const handleCheckIn = async (data) => {
      setCheckInModal({open:false, room:null, bedId:null, date:null}); 
      try {
          const safeStaffId = currentUser.id || currentUser.login || 'unknown';
          const docRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'guests'), {
            ...data, 
            staffId: safeStaffId
          });
          
          const total = (data.paidCash||0) + (data.paidCard||0) + (data.paidQR||0);
          if (total > 0) await logTransaction(docRef.id, {
            cash:data.paidCash, 
            card:data.paidCard, 
            qr:data.paidQR
          }, safeStaffId);
          
          if (data.status === 'active') { 
            const r = rooms.find(i=>i.id===data.roomId); 
            if(r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), {
              occupied:(r.occupied||0)+1
            }); 
          }
          
          showNotification(data.status==='booking' ? "Booking created" : "Checked In!");
      } catch(e) { 
        showNotification(e.message, 'error'); 
      }
  };
  
  const handleCreateDebt = async (client, amount) => {
      try {
          const safeStaffId = currentUser.id || currentUser.login || 'unknown';
          const debtData = { 
            fullName: client.fullName, 
            passport: client.passport, 
            country: client.country, 
            birthDate: client.birthDate, 
            staffId: safeStaffId, 
            checkInDate: new Date().toISOString(), 
            days: 0, 
            roomId: 'DEBT_ONLY', 
            roomNumber: '-', 
            bedId: '-', 
            pricePerNight: 0, 
            totalPrice: amount, 
            paidCash: 0, 
            paidCard: 0, 
            paidQR: 0, 
            amountPaid: 0, 
            status: 'active', 
            hostelId: currentUser.role === 'admin' ? selectedHostelFilter : currentUser.hostelId 
          };
          
          await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'guests'), debtData);
          // Telegram — новый долг
          sendTelegramMessage(
            `⚠️ <b>Создан долг</b>\n👤 ${client.fullName}\n💰 Сумма: ${amount.toLocaleString()} сум\n👷 Кассир: ${currentUser.name || currentUser.login}`,
            'debtAlert'
          );
          showNotification("Debt created successfully");
      } catch (e) { 
        showNotification("Error creating debt", 'error'); 
      }
  };

  const handleActivateBooking = async (guest) => {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guest.id), {
        status: 'active'
      });
      
      const r = rooms.find(i=>i.id===guest.roomId); 
      if(r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), {
        occupied:(r.occupied||0)+1
      });
      
      setGuestDetailsModal({open:false, guest:null}); 
      showNotification("Activated");
  };

  // ── Регистрации (E-mehmon) ────────────────────────────────────────────────
  const registrationsAlertCount = useMemo(() => {
    const now = Date.now();
    return (registrations || []).filter(r => {
      if (r.status === 'removed') return false;
      const end = new Date((r.endDate || '') + 'T23:59:59').getTime();
      return end <= now; // expired
    }).length;
  }, [registrations]);

  const handleRegistrationSubmit = async (formData) => {
    try {
      const safeStaffId = currentUser.id || currentUser.login || 'unknown';
      const targetHostelId = (!currentUser.hostelId || currentUser.hostelId === 'all')
        ? (selectedHostelFilter || 'hostel1')
        : currentUser.hostelId;
      const regData = {
        ...formData,
        hostelId: targetHostelId,
        staffId: safeStaffId,
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: currentUser.login || 'unknown',
      };
      const docRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'registrations'), regData);
      // Записываем оплату в кассу
      const totalPaid = (formData.paidCash || 0) + (formData.paidCard || 0) + (formData.paidQR || 0);
      if (totalPaid > 0) {
        await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'payments'), {
          registrationId: docRef.id,
          guestId: docRef.id,
          staffId: safeStaffId,
          guestName: formData.fullName,
          amount: totalPaid,
          cash: formData.paidCash || 0,
          card: formData.paidCard || 0,
          qr: formData.paidQR || 0,
          date: new Date().toISOString(),
          type: 'income',
          category: 'registration',
          comment: `E-mehmon: ${formData.fullName} (${formData.startDate} – ${formData.endDate})`,
          hostelId: targetHostelId,
          method: (formData.paidCash || 0) > 0 ? 'cash' : (formData.paidCard || 0) > 0 ? 'card' : 'qr',
        });
      }
      setRegistrationModal(false);
      showNotification(lang === 'ru' ? 'Гость зарегистрирован в E-mehmon!' : 'Mehmon E-mehmon\'da ro\'yxatga olindi!', 'success');
      logAction(currentUser, 'registration_add', { fullName: formData.fullName, passport: formData.passport, days: formData.days });
      sendTelegramMessage(
        `🪪 <b>Регистрация (E-mehmon)</b>\n👤 ${formData.fullName}\n🪪 ${formData.passport} · ${formData.country || ''}\n📅 ${formData.startDate} → ${formData.endDate} (${formData.days} дн.)\n💰 ${totalPaid.toLocaleString()} сум\n👷 ${currentUser.name || currentUser.login}`,
        'registration'
      );
    } catch (e) {
      console.error(e);
      showNotification('Ошибка регистрации: ' + e.message, 'error');
    }
  };

  const handleExtendRegistration = async (reg, extData) => {
    try {
      const safeStaffId = currentUser.id || currentUser.login || 'unknown';
      const newDays = (reg.days || 0) + extData.days;
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'registrations', reg.id), {
        endDate: extData.newEndDate,
        days: newDays,
        status: 'active',
      });
      if (extData.amount > 0) {
        await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'payments'), {
          registrationId: reg.id,
          guestId: reg.id,
          staffId: safeStaffId,
          guestName: reg.fullName,
          amount: extData.amount,
          cash: extData.paidCash || 0,
          card: extData.paidCard || 0,
          qr: extData.paidQR || 0,
          date: new Date().toISOString(),
          type: 'income',
          category: 'registration',
          comment: `E-mehmon продление: ${reg.fullName} (+${extData.days} дн. → ${extData.newEndDate})`,
          hostelId: reg.hostelId,
          method: (extData.paidCash || 0) > 0 ? 'cash' : (extData.paidCard || 0) > 0 ? 'card' : 'qr',
        });
      }
      showNotification(lang === 'ru' ? `Регистрация продлена до ${extData.newEndDate}` : `Ro'yxat ${extData.newEndDate} gacha uzaytirildi`, 'success');
      logAction(currentUser, 'registration_extend', { id: reg.id, fullName: reg.fullName, newEndDate: extData.newEndDate });
    } catch (e) {
      showNotification('Ошибка продления: ' + e.message, 'error');
    }
  };

  const handleRemoveFromEmehmon = async (reg) => {
    if (!window.confirm(lang === 'ru' ? `Подтвердить вывод "${reg.fullName}" из E-mehmon?` : `"${reg.fullName}" ni E-mehmondan chiqarishni tasdiqlaysizmi?`)) return;
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'registrations', reg.id), {
        status: 'removed',
        removedAt: new Date().toISOString(),
        removedBy: currentUser.login || currentUser.id,
      });
      showNotification(lang === 'ru' ? `${reg.fullName} выведен из E-mehmon` : `${reg.fullName} E-mehmondan chiqarildi`, 'success');
      logAction(currentUser, 'registration_remove', { id: reg.id, fullName: reg.fullName });
    } catch (e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

  const handleDeleteRegistration = async (reg) => {
    if (!window.confirm(lang === 'ru' ? `Удалить запись регистрации "${reg.fullName}"?` : `"${reg.fullName}" ro'yxatini o'chirishni tasdiqlaysizmi?`)) return;
    try {
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'registrations', reg.id));
      showNotification(lang === 'ru' ? 'Запись удалена' : 'Yozuv o\'chirildi', 'success');
    } catch (e) {
      showNotification('Ошибка удаления: ' + e.message, 'error');
    }
  };
  // ── Конец регистраций ────────────────────────────────────────────────────

  const handleGuestUpdate = async (id, d) => { 
    if(guestDetailsModal.open) setGuestDetailsModal({open:false, guest:null}); 
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', id), d); 
  };

  const handlePayment = async (guestId, amounts) => {
      try {
          const safeStaffId = currentUser.id || currentUser.login;
          const { cash = 0, card = 0, qr = 0 } = amounts;
          const total = cash + card + qr;
          
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), { 
            paidCash: increment(cash), 
            paidCard: increment(card), 
            paidQR: increment(qr), 
            amountPaid: increment(total) 
          });
          
          const paymentIds = await logTransaction(guestId, amounts, safeStaffId);
          if (total > 0) {
              const g = guests.find(x => x.id === guestId);
              pushUndo({
                  type: 'payment',
                  label: `${total.toLocaleString()} сум — ${g?.fullName || guestId}`,
                  guestId,
                  paymentIds,
                  cash, card, qr,
              });
          }
          // Telegram — оплата
          if (g && total > 0) {
            const hostelLabelPay = (g.hostelId === 'hostel1') ? 'Хостел №1' : 'Хостел №2';
            sendTelegramMessage(
              `💵 <b>Оплата принята</b>\n👤 ${g.fullName}\n🛏 ${hostelLabelPay} · Ком. ${g.roomNumber || '—'}\n💰 ${total.toLocaleString()} сум\n👷 Кассир: ${currentUser.name || currentUser.login}`,
              'paymentAdded'
            );
          }
          setGuestDetailsModal({open:false, guest:null}); 
          showNotification('Оплата принята', 'success');
      } catch(e) { 
        showNotification(e.message, 'error'); 
      }
  };

  const handleExtendGuest = async (guestId, extData) => {
      try {
          const safeStaffId = currentUser.id || currentUser.login;
          const { extendDays, payCash = 0, payCard = 0, payQR = 0,
                  prevDays, prevTotalPrice, prevCheckOut, prevStatus,
                  newDays, newTotalPrice, newCheckOut } = extData;
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), {
              days: newDays,
              totalPrice: newTotalPrice,
              checkOutDate: newCheckOut,
              status: 'active',
          });
          let paymentIds = [];
          const payTotal = payCash + payCard + payQR;
          if (payTotal > 0) {
              await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), {
                  paidCash:   increment(payCash),
                  paidCard:   increment(payCard),
                  paidQR:     increment(payQR),
                  amountPaid: increment(payTotal),
              });
              paymentIds = await logTransaction(guestId, { cash: payCash, card: payCard, qr: payQR }, safeStaffId);
          }
          const g = guests.find(x => x.id === guestId);
          pushUndo({
              type: 'extend',
              label: `+${extendDays} дн. — ${g?.fullName || guestId}`,
              guestId,
              prevDays, prevTotalPrice, prevCheckOut, prevStatus,
              paymentIds,
              payCash, payCard, payQR,
          });
          // Telegram — продление
          if (g) {
            sendTelegramMessage(
              `📅 <b>Продление проживания</b>\n👤 ${g.fullName}\n➕ +${extendDays} дн. → ${new Date(newCheckOut).toLocaleDateString('ru')}\n💵 Доплачено: ${payTotal.toLocaleString()} сум\n👷 Кассир: ${currentUser.name || currentUser.login}`,
              'guestExtended'
            );
          }
          setGuestDetailsModal({ open: false, guest: null });
          showNotification(`Продлено на ${extendDays} дн.`, 'success');
      } catch(e) {
          showNotification('Ошибка продления: ' + e.message, 'error');
      }
  };

  // Super-only hidden payment: reduces debt but does NOT appear in financial reports
  const handleSuperPayment = async (guestId, amount) => {
      try {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), {
              paidCash: increment(amount),
              amountPaid: increment(amount),
              superAdjusted: increment(amount),
          });
          setGuestDetailsModal({open:false, guest:null});
          showNotification('Сумма зачтена');
      } catch(e) {
          showNotification(e.message, 'error');
      }
  };

  const handleBulkExtend = async (guestIds, days) => {
      if (!guestIds?.length || !days) return;
      let count = 0;
      for (const guestId of guestIds) {
          const guest = guests.find(g => g.id === guestId);
          if (!guest || guest.status !== 'active') continue;
          const newDays  = parseInt(guest.days || 1) + days;
          const newTotal = parseInt(guest.pricePerNight || 0) * newDays;
          const co       = new Date(guest.checkOutDate || Date.now());
          co.setDate(co.getDate() + days);
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), {
              days: newDays,
              totalPrice: newTotal,
              checkOutDate: co.toISOString(),
              status: 'active',
          });
          count++;
      }
      if (count > 0) showNotification(`Продлено на ${days} дн. для ${count} гостей`, 'success');
  };

 const handleCheckOut = async (guest, final) => {
    setGuestDetailsModal({open:false, guest:null});

    
    const actualRefund = final.refundAmount || 0;
    
    // ? ИСПРАВЛЕНИЕ: Правильная логика для checkOutDate
    const today = new Date();
    const originalCheckOut = new Date(guest.checkOutDate);
    originalCheckOut.setHours(12, 0, 0, 0);
    today.setHours(12, 0, 0, 0);
    
    // Если сегодня РАНЬШЕ оригинального checkOut - выселяем досрочно (уменьшаем полоску)
    // Если сегодня ПОЗЖЕ или РАВНО - оставляем оригинальную дату (не растягиваем)
    const finalCheckOutDate = today < originalCheckOut 
        ? today.toISOString() 
        : guest.checkOutDate; // ? ОСТАВЛЯЕМ ОРИГИНАЛЬНУЮ ДАТУ
    
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guest.id), {
        totalPrice: final.totalPrice,
        status: 'checked_out', 
        checkOutDate: finalCheckOutDate // ? ИСПОЛЬЗУЕМ ПРАВИЛЬНУЮ ДАТУ
    });
    
    const r = rooms.find(i=>i.id===guest.roomId); 
    if(r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), {
        occupied:Math.max(0, (r.occupied||1)-1)
    });

    // Telegram — выселение
    const hostelLabelCO = guest.hostelId === 'hostel1' ? 'Хостел №1' : 'Хостел №2';
    sendTelegramMessage(
      `🚪 <b>Выселение</b>\n👤 ${guest.fullName}\n🛏 ${hostelLabelCO} · Ком. ${guest.roomNumber || '—'}\n📅 Заехал: ${new Date(guest.checkInDate).toLocaleDateString('ru')}\n💰 Итого: ${(final.totalPrice || 0).toLocaleString()} сум\n👷 Кассир: ${currentUser.name || currentUser.login}`,
      'checkout'
    );

    if (actualRefund > 0) {
        await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
            amount: actualRefund,
            category: 'Возврат',
            comment: `Возврат: ${guest.fullName} (${guest.passport})`,
            date: new Date().toISOString(),
            staffId: currentUser.id || currentUser.login,
            hostelId: currentUser.hostelId || guest.hostelId
        });
        
        sendTelegramMessage(`💸 <b>Возврат средств</b>\n👤 ${guest.fullName}\n💵 Сумма: ${actualRefund.toLocaleString()} сум\n👷 Кассир: ${currentUser.name || currentUser.login}`, 'refund');
    }
};

  const handleSplitGuest = async (orig, splitAfterDays, gapDays) => {
      try {
          const price = parseInt(orig.pricePerNight);
          const firstLegDays = parseInt(splitAfterDays);
          const gap = parseInt(gapDays);
          const totalOriginalDays = parseInt(orig.days);
          const remainingDays = totalOriginalDays - firstLegDays;
          if (remainingDays <= 0) return;
          
          const totalPaid = orig.amountPaid || 0;
          const ratio1 = firstLegDays / totalOriginalDays; 
          const ratio2 = remainingDays / totalOriginalDays;
          const firstLegTotal = firstLegDays * price;
          const stay1 = getStayDetails(orig.checkInDate, firstLegDays);
          
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', orig.id), { 
            days: firstLegDays, 
            totalPrice: firstLegTotal, 
            amountPaid: Math.floor(totalPaid * ratio1), 
            paidCash: Math.floor((orig.paidCash||0) * ratio1), 
            paidCard: Math.floor((orig.paidCard||0) * ratio1), 
            paidQR: Math.floor((orig.paidQR||0) * ratio1), 
            checkOutDate: stay1.end.toISOString() 
          });

          const gapStart = new Date(stay1.end);
          const secondStart = new Date(gapStart); 
          secondStart.setDate(secondStart.getDate() + gap); 
          secondStart.setHours(12, 0, 0, 0);
          const stay2 = getStayDetails(secondStart.toISOString(), remainingDays);
          
          const newGuest = { 
            ...orig, 
            checkInDate: secondStart.toISOString(), 
            checkOutDate: stay2.end.toISOString(), 
            days: remainingDays, 
            pricePerNight: price, 
            totalPrice: remainingDays * price, 
            amountPaid: Math.floor(totalPaid * ratio2), 
            paidCash: Math.floor((orig.paidCash||0) * ratio2), 
            paidCard: Math.floor((orig.paidCard||0) * ratio2), 
            paidQR: Math.floor((orig.paidQR||0) * ratio2), 
            status: 'active', 
            checkInDateTime: null, 
            checkIn: null 
          };
          delete newGuest.id;
          
          await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'guests'), newGuest);
          showNotification("Split successful!");
      } catch (e) { 
        console.error(e); 
        showNotification("Split Error", 'error'); 
      }
  };

  const handleMoveGuest = async (g, rid, rnum, bid) => { 
      try { 
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { 
          roomId: rid, 
          roomNumber: rnum, 
          bedId: bid 
        }); 
        setMoveGuestModal({open: false, guest: null}); 
        setGuestDetailsModal({open: false, guest: null}); 
        showNotification("Moved!"); 
      } catch (e) { 
        showNotification("Error: " + e.message, 'error'); 
      }
  };
  
  const handleDeleteGuest = async (g) => {
      let guestId = typeof g === 'string' ? g : g.id;
      let guestData = typeof g === 'object' ? g : guests.find(guest => guest.id === guestId);
      
      await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId));
      
      if(guestData && guestData.status==='active' && guestData.roomId !== 'DEBT_ONLY') { 
        const r=rooms.find(i=>i.id===guestData.roomId); 
        if(r) await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'rooms', r.id), {
          occupied:Math.max(0,(r.occupied||1)-1)
        }); 
      }
      
      // Telegram — удаление гостя
      if (guestData) {
        const hostelLabelDG = (guestData.hostelId === 'hostel1') ? 'Хостел №1' : 'Хостел №2';
        sendTelegramMessage(
          `🚫 <b>Удалена запись гостя</b>\n👤 ${guestData.fullName || '—'}\n🛏 ${hostelLabelDG} · Ком. ${guestData.roomNumber || '—'}\n📅 ${guestData.checkInDate ? new Date(guestData.checkInDate).toLocaleDateString('ru') : '—'} → ${guestData.checkOutDate ? new Date(guestData.checkOutDate).toLocaleDateString('ru') : '—'}\n👤 Удалил: ${currentUser?.name || currentUser?.login || '—'}`,
          'deleteGuest'
        );
      }
      setGuestDetailsModal({open:false, guest:null}); 
      showNotification("Deleted");
  };

  const handleRescheduleGuest = async (guestId, newCheckIn, newCheckOut) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), {
        checkInDate: newCheckIn,
        checkOutDate: newCheckOut
      });
      showNotification('Даты обновлены ?');
    } catch(e) {
      showNotification('Ошибка: ' + e.message, 'error');
    }
  };

  const handleDeletePayment = async (id, type, record = {}) => { 
    if(!confirm("Удалить запись?")) return; 
    await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, type === 'income' ? 'payments' : 'expenses', id)); 

    // Строим информативное уведомление
    let msg = `🗑 <b>Удалена запись</b>\nТип: ${type === 'income' ? 'Платёж' : record.category === 'Возврат' ? 'Возврат' : 'Расход'}`;
    if (type === 'income') {
      if (record.guestName || record.guest)  msg += `\n👤 Гость: ${record.guestName || record.guest}`;
      if (record.amount)   msg += `\n💵 Сумма: ${Number(record.amount).toLocaleString()} сум`;
      if (record.method)   msg += `\n💳 Метод: ${record.method}`;
      if (record.date)     msg += `\n📅 Дата: ${new Date(record.date).toLocaleString('ru')}`;
    } else {
      if (record.category) msg += `\n📂 Категория: ${record.category}`;
      if (record.amount)   msg += `\n💵 Сумма: ${Number(record.amount).toLocaleString()} сум`;
      if (record.comment)  msg += `\n💬 ${record.comment}`;
      if (record.date)     msg += `\n📅 Дата: ${new Date(record.date).toLocaleString('ru')}`;
    }
    msg += `\n👤 Удалил: ${currentUser?.name || currentUser?.login || '—'}`;

    sendTelegramMessage(msg, 'deleteRecord'); 
    showNotification("Запись удалена"); 
  };

  const handleAddExpense = async (d) => { 
    try {
      const expRef = await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'expenses'), {
        ...d, 
        hostelId: currentUser.role === 'admin' || currentUser.role === 'super'
          ? selectedHostelFilter
          : currentUser.hostelId, 
        staffId: currentUser.id || currentUser.login, 
        date: new Date().toISOString()
      });
      pushUndo({
          type: 'expense',
          label: `${d.category}: ${(+d.amount).toLocaleString()} сум${d.comment ? ' — ' + d.comment : ''}`,
          expenseId: expRef.id,
      });
      setExpenseModal(false);
      showNotification('Расход добавлен', 'success');
      logAction(currentUser, 'expense_add', { amount: d.amount, category: d.category, comment: d.comment });
      // Telegram — расход (не возврат)
      if (d.category !== 'Возврат') {
        const expHostelId = (currentUser.role === 'admin' || currentUser.role === 'super')
          ? selectedHostelFilter
          : currentUser.hostelId;
        const expHostelLabel = expHostelId === 'hostel1' ? 'Хостел №1' : expHostelId === 'hostel2' ? 'Хостел №2' : expHostelId || '—';
        const expRoleLabel = (currentUser.role === 'admin' || currentUser.role === 'super') ? 'Админ' : 'Кассир';
        const tgResult = await sendTelegramMessage(
          `💳 <b>Расход</b>\n🏨 ${expHostelLabel}\n📂 ${d.category}\n💰 ${(+d.amount).toLocaleString()} сум${d.comment ? '\n💬 ' + d.comment : ''}\n👤 ${expRoleLabel}: ${currentUser.name || currentUser.login}`,
          'expenseAdded'
        );
        if (!tgResult || tgResult.sent === 0) {
          console.warn('Telegram expense notification not sent:', tgResult);
        }
      }
    } catch (err) {
      console.error('Ошибка добавления расхода:', err);
      showNotification('Ошибка: ' + (err.message || 'не удалось сохранить'), 'error');
    }
  };

  const handleAddTask = async (task) => { 
    await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'tasks'), task); 
    showNotification("Task Added"); 
  };

  const handleCompleteTask = async (id) => { 
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'tasks', id), { status: 'done' }); 
  };

  const handleUpdateTask = async (id, updates) => { 
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'tasks', id), updates); 
    showNotification("Task Updated"); 
  };

  const handleDeleteTask = async (id) => { 
    await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'tasks', id)); 
    showNotification("Task Deleted"); 
  };
  
  const handleStartShift = async () => {
    if (!currentUser || !currentUser.id) return;
    
    const activeShift = shifts.find(s => s.staffId === currentUser.id && !s.endTime);
    if (activeShift) {
        return;
    }
    
    try {
        await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'), { 
            staffId: currentUser.id, 
            hostelId: currentUser.hostelId, 
            startTime: new Date().toISOString(), 
            endTime: null 
        });
        showNotification("? Смена начата автоматически", 'success');
    } catch (e) {
        console.error('Error starting shift:', e);
    }
  };

  const handleTransferShift = async (currentShiftId, targetUserId) => {
      if(!targetUserId) return;
      const batch = writeBatch(db);
      const shiftRef = doc(db, ...PUBLIC_DATA_PATH, 'shifts', currentShiftId);
      batch.update(shiftRef, { endTime: new Date().toISOString() });
      const targetUser = usersList.find(u => u.id === targetUserId);
      const newShiftRef = doc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'));
      batch.set(newShiftRef, { 
        staffId: targetUserId, 
        hostelId: targetUser ? targetUser.hostelId : currentUser.hostelId, 
        startTime: new Date().toISOString(), 
        endTime: null 
      });
      await batch.commit(); 
      showNotification("Shift Transferred");
  };

  const handleAdminAddShift = async (shiftData) => {
      await addDoc(collection(db, ...PUBLIC_DATA_PATH, 'shifts'), shiftData);
      showNotification("Смена добавлена вручную");
  };

  const handleAdminUpdateShift = async (id, data) => {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'shifts', id), data);
      showNotification("Смена обновлена");
  };

  const handleAdminReduceDays = async (g, rd) => { 
      const newDays = parseInt(g.days) - parseInt(rd); 
      const newTotal = newDays * parseInt(g.pricePerNight); 
      const refundAmount = parseInt(rd) * parseInt(g.pricePerNight);
      
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { 
        days: newDays, 
        totalPrice: newTotal, 
        amountPaid: (g.amountPaid || 0) - refundAmount, 
        paidCash: (g.paidCash || 0) - refundAmount 
      });
      
      const stay = getStayDetails(g.checkInDate, newDays); 
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { 
        checkOutDate: stay.end.toISOString() 
      });
      
      showNotification("Days reduced");
  };

  const handleAdminReduceDaysNoRefund = async (g, rd) => {
      const newDays = parseInt(g.days) - parseInt(rd); 
      const newTotal = newDays * parseInt(g.pricePerNight);
      
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { 
        days: newDays, 
        totalPrice: newTotal 
      });
      
      const stay = getStayDetails(g.checkInDate, newDays); 
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', g.id), { 
        checkOutDate: stay.end.toISOString() 
      });
      
      showNotification("Reduced (No Refund)");
  };

  const handlePayDebt = async (targets, amount, methods = { cash: amount, card: 0, qr: 0 }) => {
    try {
        const safeStaffId = currentUser.id || currentUser.login; 
        let remaining = amount;
        
        for (const target of targets) {
            if (remaining <= 0) break;
            const pay = Math.min(remaining, target.currentDebt); 
            const ratio = pay / amount;
            const cashPay = Math.floor(methods.cash * ratio); 
            const cardPay = Math.floor(methods.card * ratio); 
            const qrPay = Math.floor(methods.qr * ratio);
            
            await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', target.id), { 
                paidCash: increment(cashPay), 
                paidCard: increment(cardPay), 
                paidQR: increment(qrPay), 
                amountPaid: increment(pay) 
            });
            
            await logTransaction(target.id, { cash: cashPay, card: cardPay, qr: qrPay }, safeStaffId); 
            remaining -= pay;
        }
        
        showNotification("Debt Paid!");
    } catch(e) { 
        showNotification("Error paying debt", 'error'); 
    }
};

const handleAdminAdjustDebt = async (guestId, adjustment) => {
    try { 
        await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), { 
            totalPrice: increment(adjustment) 
        }); 
        showNotification("Debt Adjusted"); 
    } catch(e) { 
        showNotification("Error adjusting", 'error'); 
    }
};

const downloadExpensesCSV = () => {
    const t = (k) => TRANSLATIONS[lang][k];
    
    const exportData = filteredExpenses.map(e => {
        const staff = usersList.find(u => u.id === e.staffId || u.login === e.staffId)?.name || 'N/A';
        const hostelName = HOSTELS[e.hostelId]?.name || e.hostelId || '-';
        
        return {
            date: new Date(e.date).toLocaleString(),
            hostel: hostelName,
            category: e.category,
            amount: parseInt(e.amount),
            staff: staff,
            comment: e.comment || '-'
        };
    });
    
    const totalExpenses = exportData.reduce((sum, item) => sum + item.amount, 0);
    
    let table = `
        <html>
        <head>
            <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
            <style>
                body { font-family: Arial, sans-serif; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #000000; padding: 8px; text-align: left; }
                th { background-color: #dc2626; color: #ffffff; font-weight: bold; }
                .amount { text-align: right; color: #991b1b; font-weight: bold; }
                .total-row { background-color: #fee2e2; font-weight: bold; border-top: 3px solid #991b1b; }
                .total-label { text-align: right; font-size: 14px; }
            </style>
        </head>
        <body>
            <h2 style="text-align:center;">Отчет по расходам</h2>
            <p style="text-align:center;">Период: ${new Date().toLocaleDateString()}</p>
            <table>
                <thead>
                    <tr>
                        <th>Дата</th>
                        <th>Хостел</th>
                        <th>Категория</th>
                        <th>Сумма</th>
                        <th>Кассир</th>
                        <th>Комментарий</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    exportData.forEach(row => {
        table += `
            <tr>
                <td>${row.date}</td>
                <td>${row.hostel}</td>
                <td>${row.category}</td>
                <td class="amount">${row.amount.toLocaleString()}</td>
                <td>${row.staff}</td>
                <td>${row.comment}</td>
            </tr>
        `;
    });
    
    table += `
        <tr class="total-row">
            <td colspan="3" class="total-label">ИТОГО РАСХОДОВ:</td>
            <td class="amount">${totalExpenses.toLocaleString()}</td>
            <td colspan="2"></td>
        </tr>
    `;
    
    table += `</tbody></table></body></html>`;
    
    const blob = new Blob([table], { type: 'application/vnd.ms-excel' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Expenses_Report_${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            anyModalOpen={
                checkInModal.open || guestDetailsModal.open || moveGuestModal.open ||
                expenseModal || shiftModal || addRoomModal || editRoomModal.open ||
                clientHistoryModal?.open || groupCheckInModal || roomRentalModal ||
                undoHistoryOpen
            }
            registrationsAlertCount={registrationsAlertCount}
        />

        {notification && (
            <Notification
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification(null)}
            />
        )}

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
                                        alert("Admin cannot check-in");
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
                        lang={lang} 
                        currentUser={currentUser} 
                        onOpenClientHistory={handleOpenClientHistory}
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
                clients={guests} // (или usersList, как у вас названо)
                onClose={() => setCheckInModal({open: false, room: null, bedId: null, date: null, client: null})}
                onSubmit={handleCheckInSubmit}
                notify={showNotification}
                lang={lang}
                currentUser={currentUser}
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

        </div>
    );
};

export default App;
