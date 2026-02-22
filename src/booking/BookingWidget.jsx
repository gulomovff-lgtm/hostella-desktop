import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { ChevronLeft, ChevronRight, Check, X, Loader2, CalendarDays, Phone, User, Globe, BedDouble } from 'lucide-react';

// ─── Firebase (shared config) ────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyAoVj92dmnl5gBB7zYul0iG2Ekp5cbmkp0',
  authDomain: 'hostella-app-a1e07.firebaseapp.com',
  projectId: 'hostella-app-a1e07',
  storageBucket: 'hostella-app-a1e07.firebasestorage.app',
  messagingSenderId: '826787873496',
  appId: '1:826787873496:web:51a0c6e42631a28919cdad',
};
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db   = getFirestore(app, 'hostella'); // named database — same as main app
const auth = getAuth(app);
const PATH = ['artifacts', 'hostella-multi-v4', 'public', 'data'];

// ─── Constants ───────────────────────────────────────────────────────────────
const HOSTELS = {
  hostel1: { name: 'Хостел №1', address: 'ул. Ниёзбек Йули, 43' },
  hostel2: { name: 'Хостел №2', address: '6-й пр. Ниёзбек Йули, 39' },
};

const COUNTRIES = [
  'Узбекистан','Россия','Казахстан','Кыргызстан','Таджикистан','Туркменистан',
  'Беларусь','Украина','Германия','Франция','США','Великобритания','Китай',
  'Индия','Турция','ОАЭ','Южная Корея','Япония','Италия','Испания','Польша',
  'Азербайджан','Армения','Грузия','Израиль','Пакистан','Афганистан', 'Другая',
];

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                   'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const WDAYS_RU  = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

// ─── Utilities ────────────────────────────────────────────────────────────────
const toISO = (d) => {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
};
// Handle Firebase Timestamp objects, plain strings, and JS Dates
const parseLocal = (s) => {
  if (!s) return null;
  // Firebase Timestamp object: { seconds, nanoseconds } or .toDate()
  if (typeof s === 'object' && s !== null) {
    if (typeof s.toDate === 'function') return s.toDate();
    if (typeof s.seconds === 'number') return new Date(s.seconds * 1000);
    if (s instanceof Date) return s;
  }
  // Plain ISO string
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  if (!String(s).includes('T')) d.setHours(12, 0, 0, 0);
  return d;
};
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

// ─── BookingWidget ────────────────────────────────────────────────────────────
export default function BookingWidget({ hostelParam }) {
  const [hostelId, setHostelId]       = useState(hostelParam || 'hostel1');
  const [rooms, setRooms]             = useState([]);
  const [guests, setGuests]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadError, setLoadError]     = useState(false);

  const [promos, setPromos]           = useState([]);
  const [promoCode, setPromoCode]     = useState('');
  const [promoApplied, setPromoApplied] = useState(null); // promo object or null
  const [promoError, setPromoError]   = useState('');

  const [viewYear, setViewYear]       = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth]     = useState(() => new Date().getMonth());

  const [selectedDate, setSelectedDate] = useState(null);   // ISO string
  const [step, setStep]               = useState('calendar'); // 'calendar' | 'form' | 'success'

  const [form, setForm] = useState({ fullName: '', phone: '', country: 'Узбекистан', days: '1' });
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState('');

  // ── Load data once (not per hostel — filter in memory) ────────────────────
  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    // Sign in anonymously first (Firestore rules require auth)
    signInAnonymously(auth)
      .then(() => Promise.all([
        getDocs(collection(db, ...PATH, 'rooms')),
        getDocs(collection(db, ...PATH, 'guests')),
        getDocs(collection(db, ...PATH, 'promos')),
      ]))
      .then(([rSnap, gSnap, pSnap]) => {
        setRooms(rSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setGuests(gSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(g => g.status !== 'checked_out')
        );
        setPromos(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }).catch((err) => {
        console.error('[Hostella widget] Firebase error:', err);
        setLoadError(true);
      }).finally(() => setLoading(false));
  }, []); // load once

  // ── Availability map: ISO → { total, occupied } ───────────────────────────
  const availability = useMemo(() => {
    const hostelRooms = rooms.filter(r => r.hostelId === hostelId);
    // Support 'capacity', 'beds', 'totalBeds' field names
    const totalBeds   = hostelRooms.reduce((s, r) =>
      s + (parseInt(r.capacity ?? r.beds ?? r.totalBeds ?? r.numberOfBeds) || 0), 0);
    if (!totalBeds) return {};

    const map = {};
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // build 90-day window
    for (let i = 0; i < 120; i++) {
      const d = addDays(today, i);
      map[toISO(d)] = { total: totalBeds, occupied: 0 };
    }

    guests.forEach(g => {
      if (!hostelRooms.find(r => r.id === g.roomId)) return;
      if (g.status === 'checked_out') return;
      const ci = parseLocal(g.checkInDate || g.checkInDateTime);
      const co = parseLocal(g.checkOutDate);
      if (!ci || !co) return;
      let cur = new Date(ci); cur.setHours(0, 0, 0, 0);
      const end = new Date(co); end.setHours(0, 0, 0, 0);
      while (cur < end) {
        const k = toISO(cur);
        if (map[k]) map[k].occupied++;
        cur = addDays(cur, 1);
      }
    });
    return map;
  }, [rooms, guests, hostelId]);

  // ── Calendar grid ──────────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const last  = new Date(viewYear, viewMonth + 1, 0);
    // Monday-first: 0=Mon … 6=Sun
    const startPad = (first.getDay() + 6) % 7;
    const days = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) days.push(new Date(viewYear, viewMonth, d));
    return days;
  }, [viewYear, viewMonth]);

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };

  const today = toISO(new Date());

  const dayInfo = useCallback((date) => {
    if (!date) return null;
    const iso  = toISO(date);
    const past = iso < today;
    const av   = availability[iso];
    // Date not in availability map (past, or rooms have no capacity data)
    if (!av) return { iso, past, free: 0, total: 0, pct: 0, status: past ? 'past' : 'unknown' };
    const free = Math.max(0, av.total - av.occupied);
    const pct  = av.total ? Math.round((av.occupied / av.total) * 100) : 0;
    const status = past ? 'past' : free === 0 ? 'full' : pct >= 75 ? 'tight' : pct >= 40 ? 'moderate' : 'free';
    return { iso, past, free, total: av.total, pct, status };
  }, [availability, today]);

  const statusStyle = (status) => {
    switch (status) {
      case 'past':     return 'bg-slate-100 text-slate-300 cursor-not-allowed';
      case 'full':     return 'bg-rose-100 text-rose-300 cursor-not-allowed line-through';
      case 'tight':    return 'bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer';
      case 'moderate': return 'bg-teal-50 text-teal-700 hover:bg-teal-100 cursor-pointer';
      case 'free':     return 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer';
      case 'unknown':  return 'bg-slate-50 text-slate-500 hover:bg-slate-100 cursor-pointer';
      default:         return 'bg-slate-50 text-slate-400 cursor-pointer';
    }
  };

  const applyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) { setPromoError('Введите промокод'); return; }
    const p = promos.find(pr => pr.code === code && pr.active !== false);
    if (!p) { setPromoError('Промокод не найден или недействителен'); return; }
    if (p.expiresAt && new Date(p.expiresAt) < new Date()) { setPromoError('Этот промокод истёк'); return; }
    if (p.maxUses && (p.usedCount || 0) >= p.maxUses) { setPromoError('Лимит использования исчерпан'); return; }
    setPromoApplied(p);
    setPromoError('');
  };

  const handleDayClick = (date) => {
    const info = dayInfo(date);
    if (!info || info.past || info.status === 'full') return;
    setSelectedDate(info.iso);
    setStep('form');
  };

  // ── Submit booking ─────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) { setError('Введите ФИО'); return; }
    if (!form.phone.trim())    { setError('Введите телефон'); return; }
    const days = parseInt(form.days);
    if (!days || days < 1 || days > 365) { setError('Укажите количество дней'); return; }

    setSubmitting(true); setError('');

    const ci = selectedDate;
    const coDate = addDays(parseLocal(ci), days);
    const co = toISO(coDate);

    const bookingData = {
      fullName:     form.fullName.trim(),
      phone:        form.phone.trim(),
      country:      form.country,
      days,
      checkInDate:  ci,
      checkOutDate: co,
      hostelId,
      status:       'booking',
      source:       'website',
      totalPrice:   0,
      paidCash:     0,
      paidCard:     0,
      paidQR:       0,
      roomId:       null,
      bedId:        null,
      roomNumber:   null,
      passport:     '',
      promoCode:    promoApplied?.code || '',
      promoDiscount: promoApplied ? promoApplied.discount : 0,
      promoType:    promoApplied?.type || '',
      createdAt:    new Date().toISOString(),
    };

    // Helper: convert JS object → Firestore REST "fields" format
    const toRestFields = (obj) => {
      const fields = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined) fields[k] = { nullValue: null };
        else if (typeof v === 'boolean')   fields[k] = { booleanValue: v };
        else if (typeof v === 'number')    fields[k] = { integerValue: String(v) };
        else                              fields[k] = { stringValue: String(v) };
      }
      return fields;
    };

    const PROJECT    = 'hostella-app-a1e07';
    const DB_NAME    = 'hostella'; // named database — not (default)
    const COL_PATH   = PATH.join('/') + '/guests';
    const REST_URL   = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DB_NAME}/documents/${COL_PATH}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    try {
      // ── Step 1: anonymous auth ───────────────────────────────────────────
      if (!auth.currentUser) {
        try {
          await Promise.race([
            signInAnonymously(auth),
            new Promise((_, rej) => setTimeout(() => rej(new Error('auth-timeout')), 10000)),
          ]);
        } catch (authErr) {
          console.error('[widget] auth:', authErr.code, authErr.message);
          if (authErr.message === 'auth-timeout') {
            setError('Сервер авторизации не отвечает. Попробуйте позже.');
          } else if (authErr.code === 'auth/admin-restricted-operation') {
            setError('Анонимный вход отключён на сервере. Позвоните: +998 33 710 88 80');
          } else {
            setError(`Ошибка входа (${authErr.code ?? authErr.message})`);
          }
          setSubmitting(false);
          return;
        }
      }

      // ── Step 2: get ID token ─────────────────────────────────────────────
      let idToken;
      try {
        idToken = await auth.currentUser.getIdToken();
      } catch (tokErr) {
        console.error('[widget] getIdToken:', tokErr);
        setError('Не удалось получить токен авторизации. Попробуйте позже.');
        setSubmitting(false);
        return;
      }

      // ── Step 3: write via REST API (immediate HTTP response, no hanging) ──
      let resp;
      try {
        resp = await fetch(REST_URL, {
          method:  'POST',
          signal:  controller.signal,
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({ fields: toRestFields(bookingData) }),
        });
      } catch (fetchErr) {
        console.error('[widget] fetch:', fetchErr);
        if (fetchErr.name === 'AbortError') {
          setError('Сервер не отвечает (тайм-аут). Позвоните: +998 33 710 88 80');
        } else {
          setError('Нет интернет-соединения. Проверьте сеть и попробуйте ещё раз.');
        }
        setSubmitting(false);
        return;
      } finally {
        clearTimeout(timer);
      }

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        console.error('[widget] REST error:', resp.status, body);
        if (resp.status === 403) {
          setError('Доступ запрещён правилами базы. Позвоните: +998 33 710 88 80');
        } else if (resp.status === 404) {
          setError('База данных не найдена (404). Позвоните: +998 33 710 88 80');
        } else {
          setError(`Ошибка сервера (${resp.status}). Позвоните: +998 33 710 88 80`);
        }
        setSubmitting(false);
        return;
      }

      // Increment promo usedCount if promo was applied
      if (promoApplied?.id) {
        try {
          await updateDoc(doc(db, ...PATH, 'promos', promoApplied.id), {
            usedCount: increment(1),
          });
        } catch (_) { /* silent */ }
      }

      setStep('success');
    } catch (err) {
      clearTimeout(timer);
      console.error('[widget] unexpected:', err);
      setError(`Неожиданная ошибка: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep('calendar');
    setSelectedDate(null);
    setForm({ fullName: '', phone: '', country: 'Узбекистан', days: '1' });
    setError('');
    setPromoCode('');
    setPromoApplied(null);
    setPromoError('');
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a3c40] to-[#0f2426] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Logo / Header */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl overflow-hidden">
            <img src="https://hostella.uz/logo.png" alt="H" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="text-white font-black text-xl tracking-tight">Hostella</div>
            <div className="text-[#9ecdd0] text-xs font-medium">Онлайн бронирование</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Hostel tabs */}
          <div className="flex border-b border-slate-100">
            {Object.entries(HOSTELS).map(([id, h]) => (
              <button key={id} onClick={() => { setHostelId(id); reset(); }}
                className={`flex-1 py-3 text-sm font-bold transition-all ${
                  hostelId === id
                    ? 'text-[#1a3c40] border-b-2 border-[#e88c40] bg-orange-50/50'
                    : 'text-slate-400 hover:text-slate-600'
                }`}>
                {h.name}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="animate-spin text-[#1a3c40]" size={32} />
              <span className="text-sm text-slate-400 font-medium">Загружаем данные...</span>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-16 px-8 gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center">
                <X size={28} className="text-rose-400" />
              </div>
              <p className="text-sm text-slate-500 font-medium">Не удалось загрузить данные.<br/>Проверьте соединение и обновите страницу.</p>
              <button onClick={() => window.location.reload()}
                className="px-5 py-2 rounded-xl bg-[#1a3c40] text-white text-sm font-bold hover:bg-[#2a5c60] transition-colors">
                Обновить
              </button>
            </div>
          ) : step === 'success' ? (
            // ── Success ──────────────────────────────────────────────────────
            <div className="flex flex-col items-center text-center py-12 px-8 gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check size={32} className="text-emerald-600" strokeWidth={3} />
              </div>
              <h2 className="text-xl font-black text-slate-800">Заявка принята!</h2>
              <p className="text-sm text-slate-500 max-w-xs">
                Мы свяжемся с вами для подтверждения бронирования.
                Приготовьте документы при заезде.
              </p>
              <div className="bg-slate-50 rounded-2xl w-full p-4 text-left space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Хостел</span><span className="font-bold text-slate-700">{HOSTELS[hostelId].name}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Дата заезда</span><span className="font-bold text-slate-700">{new Date(selectedDate).toLocaleDateString('ru', { day:'numeric', month:'long' })}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Количество дней</span><span className="font-bold text-slate-700">{form.days} дн.</span></div>
              </div>
              <button onClick={reset}
                className="mt-2 px-6 py-2.5 rounded-xl bg-[#1a3c40] text-white text-sm font-bold hover:bg-[#2a5c60] transition-colors">
                Новая заявка
              </button>
            </div>
          ) : step === 'form' ? (
            // ── Booking form ──────────────────────────────────────────────────
            <div className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <button onClick={() => { setStep('calendar'); setError(''); }}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                  <ChevronLeft size={18} />
                </button>
                <div>
                  <div className="font-black text-slate-800 text-base">Оформление брони</div>
                  <div className="text-xs text-slate-400 font-medium flex items-center gap-1">
                    <CalendarDays size={11} />
                    Заезд {new Date(selectedDate).toLocaleDateString('ru', { day:'numeric', month:'long', year:'numeric' })}
                    · {HOSTELS[hostelId].name}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* ФИО */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">ФИО <span className="text-rose-400">*</span></label>
                  <div className="relative">
                    <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={form.fullName} onChange={e => setForm(f => ({...f, fullName: e.target.value}))}
                      placeholder="Иванов Иван Иванович"
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1a3c40] focus:border-transparent transition-all" />
                  </div>
                </div>

                {/* Телефон */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Телефон <span className="text-rose-400">*</span></label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="tel" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                      placeholder="+998 90 000-00-00"
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1a3c40] focus:border-transparent transition-all" />
                  </div>
                </div>

                {/* Страна */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Страна</label>
                  <div className="relative">
                    <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select value={form.country} onChange={e => setForm(f => ({...f, country: e.target.value}))}
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c40] focus:border-transparent transition-all appearance-none">
                      {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* Дней */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Количество дней <span className="text-rose-400">*</span></label>
                  <div className="relative">
                    <BedDouble size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="number" min="1" max="365" value={form.days} onChange={e => setForm(f => ({...f, days: e.target.value}))}
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a3c40] focus:border-transparent transition-all" />
                  </div>
                  {form.days >= 1 && selectedDate && (
                    <div className="mt-1.5 text-xs text-slate-400 font-medium pl-1">
                      Выезд: {addDays(parseLocal(selectedDate), parseInt(form.days)||1).toLocaleDateString('ru', { day:'numeric', month:'long' })}
                    </div>
                  )}
                </div>

                {/* Промокод */}
                {promos.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Промокод (необязательно)</label>
                    {promoApplied ? (
                      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                        <Check size={14} className="text-emerald-600 shrink-0"/>
                        <span className="text-sm font-bold text-emerald-700">
                          {promoApplied.code} — скидка {promoApplied.type === 'percent' ? `${promoApplied.discount}%` : `${promoApplied.discount?.toLocaleString()} сум`}
                        </span>
                        <button type="button" onClick={() => { setPromoApplied(null); setPromoCode(''); }}
                          className="ml-auto text-emerald-500 hover:text-emerald-700">
                          <X size={14}/>
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text" value={promoCode}
                          onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(''); }}
                          placeholder="Введите промокод"
                          className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-black tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-[#1a3c40] focus:border-transparent transition-all"/>
                        <button type="button" onClick={applyPromo}
                          className="px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-700 transition-colors">
                          Применить
                        </button>
                      </div>
                    )}
                    {promoError && <p className="text-xs text-rose-500 font-medium mt-1 pl-1">{promoError}</p>}
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                    <X size={14} /> {error}
                  </div>
                )}

                <button type="submit" disabled={submitting}
                  className="w-full py-3.5 rounded-xl bg-[#e88c40] hover:bg-[#d47c30] disabled:opacity-60
                             text-white font-black text-sm tracking-wide transition-all active:scale-[0.98]
                             shadow-[0_6px_20px_-4px_rgba(232,140,64,0.6)] flex items-center justify-center gap-2">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />}
                  {submitting ? 'Отправляем...' : 'Подтвердить бронь'}
                </button>
              </form>
            </div>
          ) : (
            // ── Calendar ──────────────────────────────────────────────────────
            <div className="p-5">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
                  <ChevronLeft size={18} />
                </button>
                <div className="font-black text-slate-800 text-base capitalize">
                  {MONTHS_RU[viewMonth]} {viewYear}
                </div>
                <button onClick={nextMonth}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Weekday labels */}
              <div className="grid grid-cols-7 mb-2">
                {WDAYS_RU.map(d => (
                  <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase py-1">{d}</div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((date, i) => {
                  if (!date) return <div key={`emp-${i}`} />;
                  const info = dayInfo(date);
                  const isSelected = info?.iso === selectedDate;
                  const isToday    = info?.iso === today;
                  return (
                    <button key={info.iso}
                      onClick={() => handleDayClick(date)}
                    disabled={info.past || info.status === 'full'}
                      className={`relative flex flex-col items-center justify-center rounded-xl aspect-square text-sm font-bold transition-all
                        ${isSelected ? '!bg-[#1a3c40] !text-white ring-2 ring-[#e88c40] ring-offset-1' : statusStyle(info.status)}
                        ${isToday && !isSelected ? 'ring-2 ring-[#1a3c40] ring-offset-1' : ''}`}>
                      <span className="text-sm leading-none font-black">{date.getDate()}</span>
                      {!info.past && info.status !== 'full' && info.total > 0 && (
                        <span className={`text-[8px] font-bold leading-none mt-0.5 ${isSelected ? 'text-white/70' : 'opacity-60'}`}>
                          {info.free}м
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                {[
                  { cls: 'bg-emerald-100', label: 'Много мест' },
                  { cls: 'bg-teal-100',   label: 'Есть места' },
                  { cls: 'bg-amber-100',  label: 'Мало мест' },
                  { cls: 'bg-rose-100',   label: 'Занято' },
                ].map(({ cls, label }) => (
                  <div key={label} className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <span className={`w-3 h-3 rounded ${cls} inline-block`} />
                    {label}
                  </div>
                ))}
              </div>

              {/* Hostel info */}
              <div className="mt-5 bg-slate-50 rounded-2xl p-4 text-sm text-slate-500">
                <div className="font-bold text-slate-700 mb-0.5">{HOSTELS[hostelId].name}</div>
                <div className="text-xs">{HOSTELS[hostelId].address}</div>
              </div>

              <p className="text-center text-[11px] text-slate-400 mt-3 font-medium">
                Выберите дату заезда
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-white/30 mt-4 font-medium">
          © Hostella — hostella.uz
        </p>
      </div>
    </div>
  );
}
