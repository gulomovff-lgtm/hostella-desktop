import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';

// Fallback users when Firestore is empty
const DEFAULT_USERS = [
  { login: 'admin',     pass: 'admin', name: 'Aziz Yuldashev', role: 'admin',   hostelId: 'all'     },
  { login: 'dilafruz',  pass: '123',   name: 'Dilafruz',        role: 'cashier', hostelId: 'hostel1' },
  { login: 'nargiza',   pass: '123',   name: 'Nargiza',          role: 'cashier', hostelId: 'hostel1' },
  { login: 'fazliddin', pass: '123',   name: 'Fazliddin',        role: 'cashier', hostelId: 'hostel2', canViewHostel1: true },
  { login: 'olimjon',   pass: '123',   name: 'Olimjon',          role: 'cashier', hostelId: 'hostel2' },
];

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
  const [auditLog,      setAuditLog     ] = useState([]);
  const [promos,        setPromos       ] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [isOnline,       setIsOnline      ] = useState(navigator.onLine);
  const [permissionError, setPermissionError] = useState(false);
  const [isDataReady,    setIsDataReady   ] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;

    // --- Users collection (always subscribed once authenticated) ---
    const usersCol    = collection(db, ...PUBLIC_DATA_PATH, 'users');
    const unsubUsers  = onSnapshot(usersCol, (snap) => {
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsersList(users.length ? users : DEFAULT_USERS);
    });

    // Wait for a logged-in app user before subscribing to the rest
    if (!currentUser) return unsubUsers;

    const roomsCol    = collection(db, ...PUBLIC_DATA_PATH, 'rooms');
    const guestsCol   = collection(db, ...PUBLIC_DATA_PATH, 'guests');
    const expensesCol = collection(db, ...PUBLIC_DATA_PATH, 'expenses');
    const clientsCol  = collection(db, ...PUBLIC_DATA_PATH, 'clients');
    const paymentsCol  = collection(db, ...PUBLIC_DATA_PATH, 'payments');
    const tasksCol     = collection(db, ...PUBLIC_DATA_PATH, 'tasks');
    const shiftsCol    = collection(db, ...PUBLIC_DATA_PATH, 'shifts');
    const tgSettingsDoc = doc(db, ...PUBLIC_DATA_PATH, 'settings', 'telegram');

    const u1 = onSnapshot(
      roomsCol,
      { includeMetadataChanges: true },
      (snap) => {
        setPermissionError(false);
        setRooms(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => parseInt(a.number) - parseInt(b.number))
        );
        setIsOnline(!snap.metadata.fromCache);
        setIsDataReady(true);
      },
      (err) => {
        if (err.code === 'permission-denied') setPermissionError(true);
        setIsOnline(false);
      }
    );

    const u2 = onSnapshot(guestsCol,   (snap) =>
      setGuests(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.checkInDate) - new Date(a.checkInDate)))
    );
    const u3 = onSnapshot(expensesCol, (snap) =>
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.date) - new Date(a.date)))
    );
    const u4 = onSnapshot(clientsCol,  (snap) =>
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName)))
    );
    const u5 = onSnapshot(paymentsCol, (snap) =>
      setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const u6 = onSnapshot(tasksCol,    (snap) =>
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const u7 = onSnapshot(shiftsCol, (snap) =>
      setShifts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const u8 = onSnapshot(tgSettingsDoc, (snap) => {
      setTgSettings(snap.exists() ? snap.data() : {});
    }, () => setTgSettings({}));

    // Promos (admin+super)
    const promosCol = collection(db, ...PUBLIC_DATA_PATH, 'promos');
    const u9 = onSnapshot(promosCol,
      (snap) => setPromos(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => setPromos([])
    );

    // Audit log — latest 500 entries (super only)
    let u10 = () => {};
    if (currentUser.role === 'super') {
      const auditCol = query(
        collection(db, ...PUBLIC_DATA_PATH, 'auditLog'),
        orderBy('timestamp', 'desc'),
        limit(500)
      );
      u10 = onSnapshot(auditCol,
        (snap) => setAuditLog(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        () => setAuditLog([])
      );
    }

    // Registrations (E-mehmon)
    const registrationsCol = collection(db, ...PUBLIC_DATA_PATH, 'registrations');
    const u11 = onSnapshot(
      registrationsCol,
      (snap) => setRegistrations(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      ),
      () => setRegistrations([])
    );

    return () => { unsubUsers(); u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); u10(); u11(); };
  }, [firebaseUser, currentUser]);

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
    promos,
    registrations,
    isOnline,
    permissionError,
    isDataReady,
  };
};
