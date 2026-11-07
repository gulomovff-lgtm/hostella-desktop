import { useState, useEffect, useMemo, useCallback, useRef, startTransition } from 'react';
import { noteServerLink } from '../utils/serverLink';
import { visibleAuditFor } from '../utils/auditScope';
import { collection, doc, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { DEFAULT_USERS } from '../constants/config';
import { createLiveList, newestFirst, mergeLists } from '../utils/liveList';
import { historyCutoffIso, windowKeep, LIVE_WINDOW_DAYS, LIVE_GUEST_STATUSES, openContractKeys, chunk, isOldGuest, isOldByDate, isOldShift } from '../utils/historyWindow';
import { startCollectionSync } from '../utils/collectionStore';
import { startClientsSync } from '../utils/clientsStore';

/**
 * Живой список по изменениям снимка (utils/liveList.js): неизменённые документы
 * сохраняют объект, снимок без изменений не перерисовывает App.
 * opts — порядок ({ key, compare }) или { order, extra }. Возвращает отписку.
 */
function listenLive(q, setter, opts = {}, onErr = undefined, onFirst = undefined) {
  const apply = createLiveList(opts.key ? { order: opts } : opts);
  let first = true;
  return onSnapshot(q, (snap) => {
    const next = apply(snap.docChanges().map(c => ({ type: c.type, id: c.doc.id, data: c.doc.data() })));
    if (next) setter(next);
    if (first) { first = false; if (onFirst) onFirst(); }
  }, (err) => {
    if (onErr) onErr(err);
    if (first) { first = false; if (onFirst) onFirst(); }   // ошибка — не держим загрузку
  });
}

/** Несколько запросов (части по 30 для «in») в один список. */
function listenChunks(queries, setter, order) {
  const parts = queries.map(() => []);
  const unsubs = queries.map((q, i) => listenLive(q, (list) => { parts[i] = list; setter(mergeLists(parts, order)); }));
  if (!queries.length) setter([]);
  return () => unsubs.forEach(u => u());
}

const NO_RECORDS = [];

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
export const useAppData = (firebaseUser, currentUser, { wantAudit = false } = {}) => {
  const [rooms,       setRooms      ] = useState([]);
  // Гости, оплаты и расходы — окном (utils/historyWindow): живущие, брони и
  // долговые записи + последние HISTORY_WINDOW_DAYS дней + участники и оплаты
  // открытых договоров. Полная история — по запросу (requestHistory), когда
  // открыт экран, которому она нужна; тогда списки — вся коллекция.
  const [guestsLive,     setGuestsLive    ] = useState([]);
  const [guestsRecent,   setGuestsRecent  ] = useState([]);
  const [guestsContract, setGuestsContract] = useState([]);
  const [guestsAll,      setGuestsAll     ] = useState(null);
  const [paymentsRecent,   setPaymentsRecent  ] = useState([]);
  const [paymentsContract, setPaymentsContract] = useState([]);
  const [paymentsAll,      setPaymentsAll     ] = useState(null);
  const [expensesRecent, setExpensesRecent] = useState([]);
  const [expensesAll,    setExpensesAll   ] = useState(null);
  const [historyWanted,  setHistoryWanted ] = useState(false);
  const [historyReady,   setHistoryReady  ] = useState(false);
  const [clients,     setClients    ] = useState([]);
  const [usersList,   setUsersList  ] = useState([]);
  const [tasks,       setTasks      ] = useState([]);
  const [shiftsRecent,   setShiftsRecent  ] = useState([]);
  const [shiftsOpen,     setShiftsOpen    ] = useState([]);
  const [shiftsAll,      setShiftsAll     ] = useState(null);
  // Окно от фонового потока: записи старше живой подписки, но в пределах окна
  const [guestsWindow,   setGuestsWindow  ] = useState(NO_RECORDS);
  const [paymentsWindow, setPaymentsWindow] = useState(NO_RECORDS);
  const [expensesWindow, setExpensesWindow] = useState(NO_RECORDS);
  const [shiftsWindow,   setShiftsWindow  ] = useState(NO_RECORDS);
  // Граница окна этого входа: по ней отделяем старые записи от живых
  const cutoffRef = useRef(historyCutoffIso());
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
    // Живьём — свежие дни; остальное окно читает фоновый поток (utils/collectionStore)
    const cutoff = historyCutoffIso(new Date(), LIVE_WINDOW_DAYS);
    cutoffRef.current = cutoff;
    const keep = windowKeep(historyCutoffIso());
    const startWindow = (name, order, setter, onReady) => unsubs.push(startCollectionSync({
      name, order, keep: keep[name], revDoc: 'historyRev', revField: name, onReady,
      onList: (list) => startTransition(() => setter(list)),
    }));
    const col = (name) => collection(db, ...PUBLIC_DATA_PATH, name);
    const unsubs = [unsubUsers];
    let cancelled = false;

    const listen = (...args) => unsubs.push(listenLive(...args));
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
        noteServerLink(!snap.metadata.fromCache);
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
    let pending = 7;
    const coreDone = () => { pending -= 1; if (pending === 0 && !cancelled) setIsAllDataReady(true); };
    const phase2 = () => {
      if (cancelled) return;
      listen(query(col('payments'), where('date', '>=', cutoff)), setPaymentsRecent, {}, undefined, coreDone);
      // Клиенты: полный список, но без подписки на всю коллекцию (utils/clientsStore)
      unsubs.push(startClientsSync({ onList: setClients, onReady: coreDone }));
      startWindow('guests', newestFirst('checkInDate'), setGuestsWindow, coreDone);
      startWindow('payments', null, setPaymentsWindow, coreDone);
      startWindow('expenses', newestFirst('date'), setExpensesWindow, coreDone);
      startWindow('shifts', null, setShiftsWindow, coreDone);
      listen(query(col('expenses'), where('date', '>=', cutoff)), setExpensesRecent, newestFirst('date'), undefined, coreDone);
      listen(col('tasks'), setTasks);
      listen(col('promos'), setPromos, {}, () => setPromos([]));
      listen(query(col('sales'), orderBy('date', 'desc'), limit(2000)), setSales, newestFirst('date'), () => setSales([]));
      listen(col('cadastres'), setCadastres, {}, () => setCadastres([]));

      if (isAdmin) {
        listen(query(col('sessions'), orderBy('loginAt', 'desc'), limit(300)), setSessions, newestFirst('loginAt'), () => setSessions([]));
        listen(query(col('stockMoves'), orderBy('date', 'desc'), limit(300)), setStockMoves, newestFirst('date'), () => setStockMoves([]));
        listen(col('recurringExpenses'), setRecurringExpenses, {}, () => setRecurringExpenses([]));
        listen(col('clientVersions'), setClientVersions, newestFirst('lastSeenAt'), () => setClientVersions([]));
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

    // Гости окном: живущие, брони и долговые — всегда; выехавшие — за окно дней
    listen(query(col('guests'), where('status', 'in', LIVE_GUEST_STATUSES)), setGuestsLive, newestFirst('checkInDate'), undefined, startPhase2);
    listen(query(col('guests'), where('checkOutDate', '>=', cutoff)), setGuestsRecent, newestFirst('checkInDate'));
    listenDoc(doc(db, ...PUBLIC_DATA_PATH, 'settings', 'telegram'), setTgSettings, {});
    listenDoc(doc(db, ...PUBLIC_DATA_PATH, 'settings', 'hostelConfig'), setHostelConfig, {});
    // Смены окном: открытые любой давности и начатые за окно дней; все — с полной историей
    listen(query(col('shifts'), where('endTime', '==', null)), setShiftsOpen);
    listen(query(col('shifts'), where('startTime', '>=', cutoff)), setShiftsRecent);
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

  // ── Журнал действий — только пока открыт экран, которому он нужен ────────
  // Журнал пишется на каждое действие любой кассы: живая подписка на 5000
  // записей у админа перерисовывала всё приложение на каждый чих (жалоба
  // 30.10.2026 «админка виснет»). Зачёты и ручные оплаты супера — в auditLogSuper.
  useEffect(() => {
    const isAdmin = role === 'admin' || role === 'super';
    if (!firebaseUser || !userKey || !isAdmin || !wantAudit) return undefined;
    const col = (name) => collection(db, ...PUBLIC_DATA_PATH, name);
    const unsubs = [listenLive(query(col('auditLog'), orderBy('timestamp', 'desc'), limit(AUDIT_LOG_LIMIT)), setAuditLogCommon,
      { order: newestFirst('timestamp'), extra: { _col: 'auditLog' } }, () => setAuditLogCommon([]))];
    if (role === 'super') {
      unsubs.push(listenLive(query(col('auditLogSuper'), orderBy('timestamp', 'desc'), limit(AUDIT_LOG_LIMIT)), setAuditLogSuper,
        { order: newestFirst('timestamp'), extra: { _col: 'auditLogSuper' } }, () => setAuditLogSuper([])));
    }
    return () => { unsubs.forEach(u => u()); setAuditLogCommon([]); setAuditLogSuper([]); };
  }, [firebaseUser, userKey, wantAudit]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Открытые договоры: участники и оплаты любой давности ─────────────────
  // Суммы договора считаются по всей его длине (utils/contractFinancials), а
  // договор аренды виден прямо в «Номерах» — окна дней ему мало.
  const contractKeys = useMemo(() => openContractKeys(manualStayGroups), [manualStayGroups]);
  const contractSig = contractKeys.ids.join('|') + '#' + contractKeys.names.join('|');
  useEffect(() => {
    if (!firebaseUser || !userKey) return undefined;
    const col = (name) => collection(db, ...PUBLIC_DATA_PATH, name);
    const u1 = listenChunks(chunk(contractKeys.ids).map(ids => query(col('payments'), where('contractGroupId', 'in', ids))), setPaymentsContract);
    const u2 = listenChunks(chunk(contractKeys.names).map(names => query(col('guests'), where('fullName', 'in', names))), setGuestsContract);
    return () => { u1(); u2(); };
  }, [firebaseUser, userKey, contractSig]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Полная история — по запросу (экраны отчётов, долгов, истории…) ───────
  // Читается фоновым потоком и лежит на диске, а не живой подпиской (utils/collectionStore):
  // подписка на всю историю разбирала десятки тысяч документов в главном потоке,
  // и окно замирало на первом заходе, а записи потом шли секундами. Свежие записи и так
  // приходят живыми окнами, правки старых — подпиской на изменения.
  useEffect(() => {
    if (!firebaseUser || !userKey || !historyWanted) return undefined;
    let pending = 4;
    let cancelled = false;
    const done = () => { pending -= 1; if (pending === 0 && !cancelled) startTransition(() => setHistoryReady(true)); };
    const start = (name, order, setter) => startCollectionSync({
      name, order, revDoc: 'historyRev', revField: name, onReady: done,
      onList: (list) => startTransition(() => setter(list)),
    });
    const unsubs = [
      start('guests', newestFirst('checkInDate'), setGuestsAll),
      start('payments', null, setPaymentsAll),
      start('expenses', newestFirst('date'), setExpensesAll),
      start('shifts', null, setShiftsAll),
    ];
    return () => {
      cancelled = true;
      unsubs.forEach(u => u());
      setGuestsAll(null); setPaymentsAll(null); setExpensesAll(null); setShiftsAll(null);
      setHistoryReady(false);
    };
  }, [firebaseUser, userKey, historyWanted]);

  // Сменился пользователь — история снова только по запросу
  useEffect(() => { setHistoryWanted(false); }, [userKey]);

  const requestHistory = useCallback(() => setHistoryWanted(true), []);
  // Экраны с историей закрыты — отпускаем полные списки (App, через 3 минуты).
  const releaseHistory = useCallback(() => setHistoryWanted(false), []);

  // Итоговые списки: полная история, когда загружена, иначе окно + договоры.
  const guestsOld = useMemo(() => (historyReady && guestsAll ? guestsAll : guestsWindow).filter(g => isOldGuest(g, cutoffRef.current)), [historyReady, guestsAll, guestsWindow]);
  const paymentsOld = useMemo(() => (historyReady && paymentsAll ? paymentsAll : paymentsWindow).filter(p => isOldByDate(p, cutoffRef.current)), [historyReady, paymentsAll, paymentsWindow]);
  const expensesOld = useMemo(() => (historyReady && expensesAll ? expensesAll : expensesWindow).filter(e => isOldByDate(e, cutoffRef.current)), [historyReady, expensesAll, expensesWindow]);
  const shiftsOld = useMemo(() => (historyReady && shiftsAll ? shiftsAll : shiftsWindow).filter(s => isOldShift(s, cutoffRef.current)), [historyReady, shiftsAll, shiftsWindow]);
  const guests = useMemo(() => mergeLists([guestsLive, guestsRecent, guestsContract, guestsOld], newestFirst('checkInDate')),
    [guestsLive, guestsRecent, guestsContract, guestsOld]);
  const payments = useMemo(() => mergeLists([paymentsRecent, paymentsContract, paymentsOld]),
    [paymentsRecent, paymentsContract, paymentsOld]);
  const expenses = useMemo(() => mergeLists([expensesRecent, expensesOld], newestFirst('date')),
    [expensesRecent, expensesOld]);
  const shifts = useMemo(() => mergeLists([shiftsOpen, shiftsRecent, shiftsOld]),
    [shiftsOpen, shiftsRecent, shiftsOld]);

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
    historyReady,
    requestHistory,
    releaseHistory,
  };
};
