import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Check, X, Loader2, CalendarDays, Phone, User, Globe, BedDouble } from 'lucide-react';

// Виджет больше НЕ использует Firebase SDK и анонимный вход: занятость берётся из
// публичной функции getPublicAvailability (без PII), бронь создаётся функцией
// createWebBooking (серверная валидация). Прямого доступа к Firestore нет.

// ─── Constants ───────────────────────────────────────────────────────────────
// address strings are real postal addresses → data, not translated.
const HOSTELS = {
  hostel1: { address: 'ул. Ниёзбек Йули, 43' },
  hostel2: { address: '6-й пр. Ниёзбек Йули, 39' },
};

// Canonical country VALUES — submitted/stored as-is (backend createWebBooking
// expects these exact strings). Never translate these.
const COUNTRIES = [
  'Узбекистан','Россия','Казахстан','Кыргызстан','Таджикистан','Туркменистан',
  'Беларусь','Украина','Германия','Франция','США','Великобритания','Китай',
  'Индия','Турция','ОАЭ','Южная Корея','Япония','Италия','Испания','Польша',
  'Азербайджан','Армения','Грузия','Израиль','Пакистан','Афганистан', 'Другая',
];

// Display-only labels aligned by index with COUNTRIES. The <option> VALUE stays
// canonical; only the visible TEXT switches language.
const COUNTRY_LABELS = {
  ru: [
    'Узбекистан','Россия','Казахстан','Кыргызстан','Таджикистан','Туркменистан',
    'Беларусь','Украина','Германия','Франция','США','Великобритания','Китай',
    'Индия','Турция','ОАЭ','Южная Корея','Япония','Италия','Испания','Польша',
    'Азербайджан','Армения','Грузия','Израиль','Пакистан','Афганистан','Другая',
  ],
  uz: [
    'Oʻzbekiston','Rossiya','Qozogʻiston','Qirgʻiziston','Tojikiston','Turkmaniston',
    'Belarus','Ukraina','Germaniya','Fransiya','AQSH','Buyuk Britaniya','Xitoy',
    'Hindiston','Turkiya','BAA','Janubiy Koreya','Yaponiya','Italiya','Ispaniya','Polsha',
    'Ozarbayjon','Armaniston','Gruziya','Isroil','Pokiston','Afgʻoniston','Boshqa',
  ],
};

const MONTHS = {
  ru: ['Январь','Февраль','Март','Апрель','Май','Июнь',
       'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
  uz: ['Yanvar','Fevral','Mart','Aprel','May','Iyun',
       'Iyul','Avgust','Sentyabr','Oktyabr','Noyabr','Dekabr'],
};
const WDAYS = {
  ru: ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'],
  uz: ['Du','Se','Ch','Pa','Ju','Sh','Ya'],
};

// ─── Self-contained string map (widget-local; do NOT import shared TRANSLATIONS,
//     it would bloat this public booking chunk). Identical key sets in ru/uz. ──
const STR = {
  ru: {
    onlineBooking:    'Онлайн бронирование',
    hostel1:          'Хостел №1',
    hostel2:          'Хостел №2',
    loading:          'Загружаем данные...',
    loadErr1:         'Не удалось загрузить данные.',
    loadErr2:         'Проверьте соединение и обновите страницу.',
    refresh:          'Обновить',
    successTitle:     'Заявка принята!',
    successText:      'Мы свяжемся с вами для подтверждения бронирования. Приготовьте документы при заезде.',
    hostelLabel:      'Хостел',
    checkInDateLabel: 'Дата заезда',
    daysCountLabel:   'Количество дней',
    daysShort:        '{n} дн.',
    newBooking:       'Новая заявка',
    bookingFormTitle: 'Оформление брони',
    checkInShort:     'Заезд',
    fullNameLabel:    'ФИО',
    fullNamePlaceholder: 'Иванов Иван Иванович',
    phoneLabel:       'Телефон',
    countryLabel:     'Страна',
    checkOutLabel:    'Выезд',
    promoLabel:       'Промокод (необязательно)',
    discountLabel:    'скидка',
    currency:         'сум',
    enterPromo:       'Введите промокод',
    apply:            'Применить',
    promoNotFound:    'Промокод не найден или недействителен',
    promoExpired:     'Этот промокод истёк',
    promoLimit:       'Лимит использования исчерпан',
    errFullName:      'Введите ФИО',
    errPhone:         'Введите телефон',
    errDays:          'Укажите количество дней',
    errTimeout:       'Сервер не отвечает (тайм-аут). Позвоните: +998 33 710 88 80',
    errNoInternet:    'Нет интернет-соединения. Проверьте сеть и попробуйте ещё раз.',
    err429:           'Слишком много заявок подряд. Попробуйте через несколько минут.',
    errServer:        'Ошибка сервера ({status}). Позвоните: +998 33 710 88 80',
    errUnexpected:    'Неожиданная ошибка: {msg}',
    submitting:       'Отправляем...',
    submitConfirm:    'Подтвердить бронь',
    legFree:          'Много мест',
    legModerate:      'Есть места',
    legTight:         'Мало мест',
    legFull:          'Занято',
    chooseDate:       'Выберите дату заезда',
    bedsShort:        'м',
  },
  uz: {
    onlineBooking:    'Onlayn bron qilish',
    hostel1:          'Xostel №1',
    hostel2:          'Xostel №2',
    loading:          'Maʼlumotlar yuklanmoqda...',
    loadErr1:         'Maʼlumotlarni yuklab boʻlmadi.',
    loadErr2:         'Ulanishni tekshiring va sahifani yangilang.',
    refresh:          'Yangilash',
    successTitle:     'Ariza qabul qilindi!',
    successText:      'Bronni tasdiqlash uchun siz bilan bogʻlanamiz. Kelganda hujjatlarni tayyorlab qoʻying.',
    hostelLabel:      'Xostel',
    checkInDateLabel: 'Kelish sanasi',
    daysCountLabel:   'Kunlar soni',
    daysShort:        '{n} kun',
    newBooking:       'Yangi ariza',
    bookingFormTitle: 'Bronni rasmiylashtirish',
    checkInShort:     'Kelish',
    fullNameLabel:    'F.I.Sh.',
    fullNamePlaceholder: 'Aliyev Ali Alievich',
    phoneLabel:       'Telefon',
    countryLabel:     'Davlat',
    checkOutLabel:    'Chiqish',
    promoLabel:       'Promokod (majburiy emas)',
    discountLabel:    'chegirma',
    currency:         'soʻm',
    enterPromo:       'Promokodni kiriting',
    apply:            'Qoʻllash',
    promoNotFound:    'Promokod topilmadi yoki yaroqsiz',
    promoExpired:     'Bu promokod muddati tugagan',
    promoLimit:       'Foydalanish limiti tugagan',
    errFullName:      'F.I.Sh. ni kiriting',
    errPhone:         'Telefon raqamini kiriting',
    errDays:          'Kunlar sonini kiriting',
    errTimeout:       'Server javob bermayapti (taym-aut). Qoʻngʻiroq qiling: +998 33 710 88 80',
    errNoInternet:    'Internet ulanishi yoʻq. Tarmoqni tekshiring va qayta urinib koʻring.',
    err429:           'Juda koʻp ariza yuborildi. Bir necha daqiqadan soʻng urinib koʻring.',
    errServer:        'Server xatosi ({status}). Qoʻngʻiroq qiling: +998 33 710 88 80',
    errUnexpected:    'Kutilmagan xato: {msg}',
    submitting:       'Yuborilmoqda...',
    submitConfirm:    'Bronni tasdiqlash',
    legFree:          'Koʻp joy',
    legModerate:      'Joy bor',
    legTight:         'Kam joy',
    legFull:          'Band',
    chooseDate:       'Kelish sanasini tanlang',
    bedsShort:        'j',
  },
};

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
  // Guest-facing language (RU default). localStorage can throw → guard it.
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('hostella_booking_lang') || 'ru'; } catch { return 'ru'; }
  });
  useEffect(() => {
    try { localStorage.setItem('hostella_booking_lang', lang); } catch {}
  }, [lang]);
  const t = k => (STR[lang]?.[k] ?? k);
  // Localized date: numeric day/year kept, month name from MONTHS[lang].
  const fmtDate = (dateObj, withYear = false) => {
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const day = dateObj.getDate();
    const mon = MONTHS[lang][dateObj.getMonth()];
    return withYear ? `${day} ${mon} ${dateObj.getFullYear()}` : `${day} ${mon}`;
  };

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
    // Данные календаря берём из публичной функции getPublicAvailability БЕЗ PII.
    // Раньше виджет читал всю коллекцию guests напрямую (паспорта/имена/телефоны
    // уходили в браузер любого посетителя, C6). Анонимный вход тут больше не нужен —
    // он остаётся только для отправки брони.
    const FN_URL = 'https://us-central1-hostella-app-a1e07.cloudfunctions.net/getPublicAvailability';
    fetch(FN_URL)
      .then(r => r.json())
      .then(d => {
        if (!d || !d.ok) throw new Error('load-failed');
        setRooms(d.rooms || []);
        setGuests(d.stays || []);     // только интервалы проживания (roomId + даты), без PII
        setPromos(d.promos || []);
      }).catch((err) => {
        console.error('[Hostella widget] availability error:', err);
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
    if (!code) { setPromoError(t('enterPromo')); return; }
    const p = promos.find(pr => pr.code === code && pr.active !== false);
    if (!p) { setPromoError(t('promoNotFound')); return; }
    if (p.expiresAt && new Date(p.expiresAt) < new Date()) { setPromoError(t('promoExpired')); return; }
    if (p.maxUses && (p.usedCount || 0) >= p.maxUses) { setPromoError(t('promoLimit')); return; }
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
    if (!form.fullName.trim()) { setError(t('errFullName')); return; }
    if (!form.phone.trim())    { setError(t('errPhone')); return; }
    const days = parseInt(form.days);
    if (!days || days < 1 || days > 365) { setError(t('errDays')); return; }

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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    try {
      // Бронь создаёт ВАЛИДИРУЮЩАЯ серверная функция createWebBooking (rate-limit,
      // клампинг полей, экранирование, уведомление кассиру). Клиент больше НЕ пишет
      // guests напрямую и не требует анонимного входа — это убирает форж брони,
      // поле-инъекцию и отравление доступности через прямую запись.
      const FN_URL = 'https://us-central1-hostella-app-a1e07.cloudfunctions.net/createWebBooking';
      let resp;
      try {
        resp = await fetch(FN_URL, {
          method:  'POST',
          signal:  controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: bookingData.fullName,
            phone:    bookingData.phone,
            hostelId: bookingData.hostelId,
            checkIn:  bookingData.checkInDate,
            checkOut: bookingData.checkOutDate,
            nights:   bookingData.days,
            comment:  [form.country ? `Страна: ${form.country}` : '',
                       promoApplied?.code ? `Промокод: ${promoApplied.code}` : '']
                      .filter(Boolean).join(' · '),
          }),
        });
      } catch (fetchErr) {
        console.error('[widget] fetch:', fetchErr);
        if (fetchErr.name === 'AbortError') {
          setError(t('errTimeout'));
        } else {
          setError(t('errNoInternet'));
        }
        setSubmitting(false);
        return;
      } finally {
        clearTimeout(timer);
      }

      const result = await resp.json().catch(() => ({}));
      if (!resp.ok || !result.ok) {
        console.error('[widget] createWebBooking error:', resp.status, result);
        if (resp.status === 429) {
          setError(t('err429'));
        } else {
          setError(t('errServer').replace('{status}', resp.status));
        }
        setSubmitting(false);
        return;
      }

      setStep('success');
    } catch (err) {
      clearTimeout(timer);
      console.error('[widget] unexpected:', err);
      setError(t('errUnexpected').replace('{msg}', err.message));
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
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl overflow-hidden">
            <img src="https://hostella.uz/logo.png" alt="H" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="text-white font-black text-xl tracking-tight">Hostella</div>
            <div className="text-[#9ecdd0] text-xs font-medium">{t('onlineBooking')}</div>
          </div>
          {/* Guest-facing RU/UZ language toggle */}
          <div className="ml-auto flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
            {['ru', 'uz'].map(lng => (
              <button key={lng} type="button" onClick={() => setLang(lng)}
                className={`px-2.5 py-1 rounded-md text-xs font-black uppercase transition-all ${
                  lang === lng
                    ? 'bg-white text-[#1a3c40]'
                    : 'text-white/60 hover:text-white'
                }`}>
                {lng}
              </button>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Hostel tabs */}
          <div className="flex border-b border-slate-100">
            {Object.keys(HOSTELS).map((id) => (
              <button key={id} onClick={() => { setHostelId(id); reset(); }}
                className={`flex-1 py-3 text-sm font-bold transition-all ${
                  hostelId === id
                    ? 'text-[#1a3c40] border-b-2 border-[#e88c40] bg-orange-50/50'
                    : 'text-slate-400 hover:text-slate-600'
                }`}>
                {t(id)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="animate-spin text-[#1a3c40]" size={32} />
              <span className="text-sm text-slate-400 font-medium">{t('loading')}</span>
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-16 px-8 gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center">
                <X size={28} className="text-rose-400" />
              </div>
              <p className="text-sm text-slate-500 font-medium">{t('loadErr1')}<br/>{t('loadErr2')}</p>
              <button onClick={() => window.location.reload()}
                className="px-5 py-2 rounded-xl bg-[#1a3c40] text-white text-sm font-bold hover:bg-[#2a5c60] transition-colors">
                {t('refresh')}
              </button>
            </div>
          ) : step === 'success' ? (
            // ── Success ──────────────────────────────────────────────────────
            <div className="flex flex-col items-center text-center py-12 px-8 gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <Check size={32} className="text-emerald-600" strokeWidth={3} />
              </div>
              <h2 className="text-xl font-black text-slate-800">{t('successTitle')}</h2>
              <p className="text-sm text-slate-500 max-w-xs">
                {t('successText')}
              </p>
              <div className="bg-slate-50 rounded-2xl w-full p-4 text-left space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">{t('hostelLabel')}</span><span className="font-bold text-slate-700">{t(hostelId)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('checkInDateLabel')}</span><span className="font-bold text-slate-700">{fmtDate(new Date(selectedDate))}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">{t('daysCountLabel')}</span><span className="font-bold text-slate-700">{t('daysShort').replace('{n}', form.days)}</span></div>
              </div>
              <button onClick={reset}
                className="mt-2 px-6 py-2.5 rounded-xl bg-[#1a3c40] text-white text-sm font-bold hover:bg-[#2a5c60] transition-colors">
                {t('newBooking')}
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
                  <div className="font-black text-slate-800 text-base">{t('bookingFormTitle')}</div>
                  <div className="text-xs text-slate-400 font-medium flex items-center gap-1">
                    <CalendarDays size={11} />
                    {t('checkInShort')} {fmtDate(new Date(selectedDate), true)}
                    · {t(hostelId)}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* ФИО */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t('fullNameLabel')} <span className="text-rose-400">*</span></label>
                  <div className="relative">
                    <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={form.fullName} onChange={e => setForm(f => ({...f, fullName: e.target.value}))}
                      placeholder={t('fullNamePlaceholder')}
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1a3c40] focus:border-transparent transition-all" />
                  </div>
                </div>

                {/* Телефон */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t('phoneLabel')} <span className="text-rose-400">*</span></label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="tel" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                      placeholder="+998 90 000-00-00"
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1a3c40] focus:border-transparent transition-all" />
                  </div>
                </div>

                {/* Страна */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t('countryLabel')}</label>
                  <div className="relative">
                    <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select value={form.country} onChange={e => setForm(f => ({...f, country: e.target.value}))}
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3c40] focus:border-transparent transition-all appearance-none">
                      {/* value stays canonical; only the visible label switches language */}
                      {COUNTRIES.map((c, i) => <option key={c} value={c}>{(COUNTRY_LABELS[lang] || COUNTRY_LABELS.ru)[i]}</option>)}
                    </select>
                  </div>
                </div>

                {/* Дней */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t('daysCountLabel')} <span className="text-rose-400">*</span></label>
                  <div className="relative">
                    <BedDouble size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="number" min="1" max="365" value={form.days} onChange={e => setForm(f => ({...f, days: e.target.value}))}
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a3c40] focus:border-transparent transition-all" />
                  </div>
                  {form.days >= 1 && selectedDate && (
                    <div className="mt-1.5 text-xs text-slate-400 font-medium pl-1">
                      {t('checkOutLabel')}: {fmtDate(addDays(parseLocal(selectedDate), parseInt(form.days)||1))}
                    </div>
                  )}
                </div>

                {/* Промокод */}
                {promos.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">{t('promoLabel')}</label>
                    {promoApplied ? (
                      <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                        <Check size={14} className="text-emerald-600 shrink-0"/>
                        <span className="text-sm font-bold text-emerald-700">
                          {promoApplied.code} — {t('discountLabel')} {promoApplied.type === 'percent' ? `${promoApplied.discount}%` : `${promoApplied.discount?.toLocaleString()} ${t('currency')}`}
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
                          placeholder={t('enterPromo')}
                          className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-black tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-[#1a3c40] focus:border-transparent transition-all"/>
                        <button type="button" onClick={applyPromo}
                          className="px-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-700 transition-colors">
                          {t('apply')}
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
                  {submitting ? t('submitting') : t('submitConfirm')}
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
                  {MONTHS[lang][viewMonth]} {viewYear}
                </div>
                <button onClick={nextMonth}
                  className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Weekday labels */}
              <div className="grid grid-cols-7 mb-2">
                {WDAYS[lang].map((d, i) => (
                  <div key={i} className="text-center text-[10px] font-black text-slate-400 uppercase py-1">{d}</div>
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
                          {info.free}{t('bedsShort')}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                {[
                  { cls: 'bg-emerald-100', label: t('legFree') },
                  { cls: 'bg-teal-100',   label: t('legModerate') },
                  { cls: 'bg-amber-100',  label: t('legTight') },
                  { cls: 'bg-rose-100',   label: t('legFull') },
                ].map(({ cls, label }) => (
                  <div key={label} className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                    <span className={`w-3 h-3 rounded ${cls} inline-block`} />
                    {label}
                  </div>
                ))}
              </div>

              {/* Hostel info */}
              <div className="mt-5 bg-slate-50 rounded-2xl p-4 text-sm text-slate-500">
                <div className="font-bold text-slate-700 mb-0.5">{t(hostelId)}</div>
                <div className="text-xs">{HOSTELS[hostelId].address}</div>
              </div>

              <p className="text-center text-[11px] text-slate-400 mt-3 font-medium">
                {t('chooseDate')}
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
