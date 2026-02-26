/**
 * AppContext — централизованный контекст для глобального UI-состояния.
 * Предоставляет: currentUser, lang, selectedHostelFilter, showNotification.
 * Серверные данные (rooms, guests, ...) остаются в useAppData.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = sessionStorage.getItem('hostella_user_v4');
    return saved ? JSON.parse(saved) : null;
  });
  const [lang, setLang] = useState('ru');
  const [selectedHostelFilter, setSelectedHostelFilter] = useState('hostel1');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [notifications, setNotifications] = useState([]);

  const showNotification = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev.slice(-2), { id, message, type }]);
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const login = useCallback((user) => {
    setCurrentUser(user);
    const { pass: _p, ...sessionUser } = user;
    sessionStorage.setItem('hostella_user_v4', JSON.stringify(sessionUser));
    if (user.hostelId && user.hostelId !== 'all') setSelectedHostelFilter(user.hostelId);
    setActiveTab(user.role === 'cashier' ? 'rooms' : 'dashboard');
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    sessionStorage.removeItem('hostella_user_v4');
  }, []);

  return (
    <AppContext.Provider value={{
      currentUser, setCurrentUser,
      lang, setLang,
      selectedHostelFilter, setSelectedHostelFilter,
      activeTab, setActiveTab,
      notifications, showNotification, dismissNotification,
      login, logout,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside <AppProvider>');
  return ctx;
}
