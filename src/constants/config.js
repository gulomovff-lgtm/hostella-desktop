// --- BUILD INFO ---
export const BUILD_TS = '20260317-1900';

// --- VERSION ---
export const APP_VERSION = '0.3.21';
export const MIN_REQUIRED_VERSION = '0.3.0';

// --- SALARY CONFIG ---
export const DAILY_SALARY = 266666;

// --- DEFAULT DATA ---
// SECURITY NOTE (Fix 14): DEFAULT_USERS содержат plaintext-пароли и используются ТОЛЬКО
// как аварийный сид при пустом Firestore. В production Firestore хранит хешированные пароли.
// Никогда не полагайтесь на эти учётные данные в production-среде.
// ? ИЗМЕНЕНИЕ: Добавлен Fazliddin со спецправами (может видеть оба хостела)
export const DEFAULT_USERS = [
  { login: 'admin', pass: 'admin', name: 'Aziz Yuldashev', role: 'admin', hostelId: 'all' },
  { login: 'dilafruz', pass: '123', name: 'Dilafruz', role: 'cashier', hostelId: 'hostel1' },
  { login: 'nargiza', pass: '123', name: 'Nargiza', role: 'cashier', hostelId: 'hostel1' },
  { login: 'fazliddin', pass: '123', name: 'Fazliddin', role: 'cashier', hostelId: 'hostel2', canViewHostel1: true },
  { login: 'olimjon', pass: '123', name: 'Olimjon', role: 'cashier', hostelId: 'hostel2' },
];
