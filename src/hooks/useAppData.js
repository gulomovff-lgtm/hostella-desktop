import { useState, useEffect, useMemo } from 'react';
import { visibleAuditFor } from '../utils/auditScope';
import { collection, doc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { DEFAULT_USERS } from '../constants/config';
import { createLiveList, newestFirst, alphabetical } from '../utils/liveList';

// Сколько последних записей журнала держим в памяти (только супер).
// Журнал растёт бесконечно, поэтому грузим окно, а не всю историю.
const AUDIT_LOG_LIMIT = 5000;

/**
 * Custom hook that subscribes to all Firestore collections and returns live data.
 *
 * @param {object|null} firebaseUser  – Firebase Auth user (from onAuthStateChanged)
 * @param {object|null} currentUser   – App-level logged-in user (role, hostelId, etc.)
 * @returns {{
 *   rooms: array, guests: array, expenses: array, clients: array,
 *   payments: array, usersList: array, tasks: array, shifts: array,
 *   isOnline: boolean, permissionError: boolean, isDataReady: boolean
 * }}
 */
export const useAppData = (firebaseUser, currentUser) => {
  const [rooms,       setRooms      ] = useState([]);
  const [guests,      setGuests     ] = useState([]);
  const [expenses,    setExpenses   ] = useState([]);
  const [clients,     setClients    ] = useState([]);
  const [payments,    setPayments   ] = useState([]);
  const [usersList,   setUsersList  ] = useState([]);
  const [tasks,       setTasks      ] = useState([]);
  const [shifts,         setShifts        ] = useState([]);
  const [tgSettings,    setTgSettings   ] = useState(null);
  const [auditLogCommon, setAuditLogCommon] = useState([]);
  const [catalog,        setCatalog       ] = useState([]);
  const [sales,          setSales         ] = useState([]);
  const [stockMoves,     setStockMoves    ] = useState([]);
  const [auditLogSuper,  setAuditLogSuper ] = useState([]);
  const [promos,        setPromos       ] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [recurringExpenses, setRecurringExpenses] = useState([]);
  const [hostelConfig,   setHostelConfig  ] = useState(null);
  const [sessions,       setSessions      ] = useState([]);
  const [cadastres,      setCadastres     ] = useState([]);
  const [cadastreRegs,   setCadastreRegs  ] = useState([]);
  const [manualStayGroups, setManualStayGroups] = useState([]);
  const [priceWhitelist, setPriceWhitelist] = useState([]);
  const [clientVersions, setClientVersions] = useState([]);
  const [isOnline,       setIsOnline      ] = useState(navigator.onLine);
  const [permissionError, setPermissionError] = useState(false);
  const [isDataReady,    setIsDataReady   ] = useState(false);
  // Всё основное загружено (гости, оплаты, клиенты, расходы) — для автоматики с деньгами
  const [isAllDataReady, setIsAllDataReady] = useState(false);

  // Fix 13: добавляем слушатели online/offline — snapshot от rooms даёт задержку при старте (fromCache = true)
  useEffect(() => {
    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Ключ пользователя: эффект читает только наличие, роль и id. Раньше в
  // зависимостях стоял сам объект currentUser — вход кассира нескольких
  // филиалов (два setCurrentUser подряд), выбор филиала, смена пароля
  // ({...currentUser}) рвали и заново открывали ВСЕ ~25 подписок.
  const userKey = currentUser ? `${currentUser.id || currentUser.login || ''}|${currentUser.role || ''}` : '';
  const role = currentUser?.role || '';

  useEffect(() => {
    if (!firebaseUser) return;

    // --- Users collection (always subscribed once authenticated) ---
    const usersCol    = collection(db, ...PUBLIC_DATA_PATH, 'users');
    const unsubUsers  = onSnapshot(usersCol, (snap) => {
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsersList(users.length ? users : DEFAULT_USERS);
    });

    // Wait for a logged-in app user before subscribing to the rest
    if (!userKey) return unsubUsers;

    const isAdmin = role === 'admin' || role === 'super';
    const col = (name) => collection(db, ...PUBLIC_DATA_PATH, name);
    const unsubs = [unsubUsers];
    let cancelled = false;

    // Живой список по изменениям снимка (utils/liveList.js): неизменённые
    // документы сохраняют объект, снимок без изменений не перерисовывает App.
    const listen = (q, setter, opts = {}, onErr = undefined, onFirst = undefined) => {
      const apply = createLiveList(opts.key ? { order: opts } : opts);   // порядок или { order, extra }
      let first = true;
      unsubs.push(onSnapshot(q, (snap) => {
        const next = apply(snap.docChanges().map(c => ({ type: c.type, id: c.doc.id, data: c.doc.data() })));
        if (next) setter(next);
        if (first) { first = false; if (onFirst) onFirst(); }
      }, (err) => {
        if (onErr) onErr(err);
        if (first) { first = false; if (onFirst) onFirst(); }   // ошибка — не держим загрузку
      }));
    };
    const listenDoc = (ref, setter, fallback) => {
      unsubs.push(onSnapshot(ref, (snap) => setter(snap.exists() ? snap.data() : fallback), () => setter(fallback)));
    };

    // ── Очередь 1: то, без чего нельзя работать — комнаты, гости, настройки ──
    let roomsSeen = false;
    unsubs.push(onSnapshot(
      col('rooms'),
      { includeMetadataChanges: true },
      (snap) => {
        setPermissionError(false);
        if (!snap.metadata.fromCache) setIsOnline(true);
        // Метаданные (fromCache/pending) меняются часто: массив комнат
        // пересобираем только при настоящих изменениях документов.
        if (snap.docChanges().length || !roomsSeen) {
          roomsSeen = true;
          setRooms(snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => parseInt(a.number) - parseInt(b.number)));
        }
        setIsDataReady(true);
      },
      (err) => {
        if (err.code === 'permission-denied') setPermissionError(true);
        setIsOnline(false);
      }
    ));

    // ── Очередь 2: история и справочники — после первой отрисовки ──────────
    // Оплаты, клиенты и расходы — самые большие коллекции. Автоматика, которой
    // нужны деньги (авто-выселение, пересчёт цен, синхронизация клиентов),
    // ждёт isAllDataReady, а не появления комнат.
    let pending = 3;
    const coreDone = () => { pending -= 1; if (pending === 0 && !cancelled) setIsAllDataReady(true); };
    const phase2 = () => {
      if (cancelled) return;
      listen(col('payments'), setPayments, {}, undefined, coreDone);
      listen(col('clients'), setClients, alphabetical('fullName'), undefined, coreDone);
      listen(col('expenses'), setExpenses, newestFirst('date'), undefined, coreDone);
      listen(col('tasks'), setTasks);
      listen(col('promos'), setPromos, {}, () => setPromos([]));
      listen(query(col('sales'), orderBy('date', 'desc'), limit(2000)), setSales, newestFirst('date'), () => setSales([]));
      listen(col('cadastres'), setCadastres, {}, () => setCadastres([]));

      if (isAdmin) {
        listen(query(col('sessions'), orderBy('loginAt', 'desc'), limit(300)), setSessions, newestFirst('loginAt'), () => setSessions([]));
        // Журнал — последние записи: он пишется на каждое действие и растёт
        // бесконечно; зачёты и ручные оплаты супера — в auditLogSuper.
        listen(query(col('auditLog'), orderBy('timestamp', 'desc'), limit(AUDIT_LOG_LIMIT)), setAuditLogCommon,
          { order: newestFirst('timestamp'), extra: { _col: 'auditLog' } }, () => setAuditLogCommon([]));
        listen(query(col('stockMoves'), orderBy('date', 'desc'), limit(300)), setStockMoves, newestFirst('date'), () => setStockMoves([]));
        listen(col('recurringExpenses'), setRecurringExpenses, {}, () => setRecurringExpenses([]));
        listen(col('clientVersions'), setClientVersions, newestFirst('lastSeenAt'), () => setClientVersions([]));
      }
      if (role === 'super') {
        listen(query(col('auditLogSuper'), orderBy('timestamp', 'desc'), limit(AUDIT_LOG_LIMIT)), setAuditLogSuper,
          { order: newestFirst('timestamp'), extra: { _col: 'auditLogSuper' } }, () => setAuditLogSuper([]));
      }
    };
    let phase2Started = false;
    let phase2Timer = null;
    const startPhase2 = () => {
      if (phase2Started) return;
      phase2Started = true;
      clearTimeout(phase2Timer);
      // Дать экрану отрисоваться с комнатами и гостями, потом — история
      if (typeof window !== 'undefined' && window.requestIdleCallback) window.requestIdleCallback(phase2, { timeout: 800 });
      else setTimeout(phase2, 50);
    };
    phase2Timer = setTimeout(startPhase2, 2500);   // гости задержались — не ждём дольше

    listen(col('guests'), setGuests, newestFirst('checkInDate'), undefined, startPhase2);
    listenDoc(doc(db, ...PUBLIC_DATA_PATH, 'settings', 'telegram'), setTgSettings, {});
    listenDoc(doc(db, ...PUBLIC_DATA_PATH, 'settings', 'hostelConfig'), setHostelConfig, {});
    listen(col('shifts'), setShifts);
    listen(col('registrations'), setRegistrations, newestFirst('createdAt'), () => setRegistrations([]));
    listen(col('cadastreRegistrations'), setCadastreRegs, newestFirst('createdAt'), (err) => {
      console.error('[cadastreRegs] onSnapshot error:', err.code, err.message);
      // Не очищаем массив при ошибке — лучше показать старые данные
    });
    listen(col('manualStayGroups'), setManualStayGroups, {}, () => setManualStayGroups([]));
    listen(col('priceWhitelist'), setPriceWhitelist, {}, () => setPriceWhitelist([]));
    listen(col('catalog'), setCatalog, {}, () => setCatalog([]));

    return () => {
      cancelled = true;
      clearTimeout(phase2Timer);
      unsubs.forEach(u => u());
      setIsAllDataReady(false);
    };
  }, [firebaseUser, userKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Журнал для роли: супер — оба по времени, админ — общий без зачётов.
  const auditLog = useMemo(
    () => visibleAuditFor(currentUser?.role, auditLogCommon, auditLogSuper),
    [currentUser?.role, auditLogCommon, auditLogSuper]);

  return {
    rooms,
    guests,
    expenses,
    clients,
    payments,
    usersList,
    tasks,
    shifts,
    tgSettings,
    auditLog,
    catalog,
    sales,
    stockMoves,
    promos,
    registrations,
    recurringExpenses,
    hostelConfig,
    sessions,
    cadastres,
    cadastreRegs,
    manualStayGroups,
    priceWhitelist,
    clientVersions,
    isOnline,
    permissionError,
    isDataReady,
    isAllDataReady,
  };
};
