// --- BUILD INFO ---
// Автоматически проставляется Vite из package.json при каждом билде/dev-запуске
export const BUILD_TS = typeof __BUILD_TS__ !== 'undefined' ? __BUILD_TS__ : '0000-0000';

// --- VERSION ---
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
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
  { login: 'fazliddin', pass: '123', name: 'Fazliddin', role: 'cashier', hostelId: 'hostel2', canViewHostel1: true, permissions: { viewManualStay: true } },
  { login: 'olimjon', pass: '123', name: 'Olimjon', role: 'cashier', hostelId: 'hostel2' },
];
