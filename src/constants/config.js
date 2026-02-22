// --- SALARY CONFIG ---
export const DAILY_SALARY = 266666;

// --- DEFAULT DATA ---
// ? ИЗМЕНЕНИЕ: Добавлен Fazliddin со спецправами (может видеть оба хостела)
export const DEFAULT_USERS = [
  { login: 'admin', pass: 'admin', name: 'Aziz Yuldashev', role: 'admin', hostelId: 'all' },
  { login: 'dilafruz', pass: '123', name: 'Dilafruz', role: 'cashier', hostelId: 'hostel1' },
  { login: 'nargiza', pass: '123', name: 'Nargiza', role: 'cashier', hostelId: 'hostel1' },
  { login: 'fazliddin', pass: '123', name: 'Fazliddin', role: 'cashier', hostelId: 'hostel2', canViewHostel1: true },
  { login: 'olimjon', pass: '123', name: 'Olimjon', role: 'cashier', hostelId: 'hostel2' },
];
