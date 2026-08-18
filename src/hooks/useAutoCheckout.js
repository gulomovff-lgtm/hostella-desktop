import { useEffect, useRef } from 'react';
import { doc, writeBatch, increment } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { logAction, logSystemError } from '../utils/auditLog';

/**
 * useAutoCheckout — автоматическое выселение просроченных гостей.
 *
 * Запись «висит» в системе, если кассир забыл выселить гостя: место числится
 * занятым, гость продолжает попадать в напоминания и отчёты. Раз в полчаса
 * проверяем и закрываем такие записи — но только когда уверены, что это не
 * живой гость (см. гейты ниже).
 *
 * Данные читаются через refs: иначе таймер пересоздавался бы при каждом
 * изменении Firestore и проверка не наступала бы никогда.
 *
 * @param {object[]} guests, rooms, payments — живые данные
 * @param {object}   hostelConfig — настройки филиалов (час выезда, включение)
 * @param {object|null} currentUser — без входа автоматика не работает
 * @param {boolean}  isDataReady — ждём полной загрузки данных
 * @param {function} showNotification — тост о результате
 */
export function useAutoCheckout({ guests, rooms, payments, hostelConfig, currentUser, isDataReady, showNotification }) {
// ─── Авто-выселение просроченных гостей ──────────────────────────────────
//
// Алгоритм безопасного авто-выселения:
//
//  GATE 1 — только active-гости с валидным checkOutDate
//  GATE 2 — вычисляем «эффективную дату выезда»:
//             • ISO-строки сохранённые как midnight UTC (new Date(date).toISOString()
//               из <input type="date">) трактуются как дата без времени.
//             • date-only (YYYY-MM-DD) и midnight-UTC → используем checkOutHour хостела
//             • ISO с ненулевым временем → берём как есть
//             • если есть bonusCheckOutDate и он позже — используем его (та же логика)
//  GATE 3 — льготный период зависит от состояния кровати:
//             • 24 ч — если кровать свободна (никто новый не заехал)
//             • 4 ч  — если тот же bed уже занят другим активным гостем
//  GATE 4 — гость не имеет последнего платежа за последние 12 ч
//            (защита: оплата = продление, должны были уже сдвинуть checkOutDate)
//  GATE 5 — не выселяем «младшего» гостя если на кровати есть «старший» активный
//            (защита от гонки при двух записях на одной кровати)
//  DECREMENT — счётчик occupied уменьшается ТОЛЬКО если на кровати нет
//              другого активного гостя (не задваиваем -1)
//  LOGGING — каждое авто-выселение пишется в auditLog
//

// Refs для live-данных: таймер не перезапускается при каждом изменении данных
const autoCheckoutGuestsRef   = useRef(guests);
const autoCheckoutRoomsRef    = useRef(rooms);
const autoCheckoutPaymentsRef = useRef(payments);
const autoCheckoutConfigRef   = useRef(hostelConfig);
useEffect(() => { autoCheckoutGuestsRef.current   = guests;      }, [guests]);
useEffect(() => { autoCheckoutRoomsRef.current    = rooms;       }, [rooms]);
useEffect(() => { autoCheckoutPaymentsRef.current = payments;    }, [payments]);
useEffect(() => { autoCheckoutConfigRef.current   = hostelConfig; }, [hostelConfig]);

useEffect(() => {
  if (!currentUser) return;
  if (!isDataReady) return; // ждём, пока все данные загружены

  // Эффективная дата выезда с учётом бонусного дня и настроек хостела
  const getEffectiveCo = (guest) => {
    const cfg = autoCheckoutConfigRef.current;
    const guestHostelId = guest.hostelId || 'hostel1';
    const coHour = cfg?.[guestHostelId]?.checkOutHour ?? 12;

    // Парсит строку даты: midnight-UTC ISO или date-only → используем coHour локально;
    // ISO с конкретным ненулевым временем → берём как есть
    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      if (typeof dateStr === 'string' && dateStr.includes('T')) {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        // Дата сохранена как midnight UTC (через new Date(dateStr).toISOString() из input[type=date])
        // → трактуем как date-only с часом выезда хостела
        if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
          return new Date(`${dateStr.slice(0, 10)}T${String(coHour).padStart(2, '0')}:00:00`);
        }
        return d;
      }
      // date-only: YYYY-MM-DD
      return new Date(`${String(dateStr).slice(0, 10)}T${String(coHour).padStart(2, '0')}:00:00`);
    };

    const base = parseDate(guest.checkOutDate);
    if (!base || isNaN(base.getTime())) return null;

    if (guest.bonusCheckOutDate) {
      const bonus = parseDate(guest.bonusCheckOutDate);
      if (bonus && !isNaN(bonus.getTime()) && bonus > base) return bonus;
    }
    return base;
  };

  const runAutoCheckout = async () => {
    const guests   = autoCheckoutGuestsRef.current;
    const rooms    = autoCheckoutRoomsRef.current;
    const payments = autoCheckoutPaymentsRef.current;
    if (!guests.length || !rooms.length) return;
    const now = new Date();
    // Льготные периоды:
    const shortGraceMs = 4  * 60 * 60 * 1000; // 4ч  — кровать занята новым гостем
    const longGraceMs  = 24 * 60 * 60 * 1000; // 24ч — кровать свободна
    // Защита от «недавней оплаты» — 12 часов
    const payGuardMs = 12 * 60 * 60 * 1000;

    const batch = writeBatch(db);
    let count = 0;
    const evicted = [];

    for (const guest of guests) {
      // GATE 1
      if (guest.status !== 'active') continue;
      if (!guest.checkOutDate) continue;

      // GATE 1.5 — per-hostel auto-checkout enabled check
      const guestHostelId = guest.hostelId || 'hostel1';
      if (autoCheckoutConfigRef.current?.[guestHostelId]?.autoCheckoutEnabled === false) continue;

      // GATE 2 — effective checkout time
      const effectiveCo = getEffectiveCo(guest);
      if (!effectiveCo) continue;

      // GATE 3 — льготный период: 24ч если кровать свободна, 4ч если занята
      const bedOccupiedByAny = guests.some(g2 =>
        g2.id !== guest.id &&
        g2.status === 'active' &&
        g2.roomId === guest.roomId &&
        String(g2.bedId) === String(guest.bedId)
      );
      const graceForGuest = bedOccupiedByAny ? shortGraceMs : longGraceMs;
      const msOverdue = now.getTime() - effectiveCo.getTime();
      if (msOverdue < graceForGuest) continue;

      // GATE 4 — недавняя оплата (по payments или по lastPaymentAt на госте)
      const lastPay = guest.lastPaymentAt
        ? new Date(guest.lastPaymentAt).getTime()
        : 0;
      if (now.getTime() - lastPay < payGuardMs) continue;
      // Дополнительная проверка по массиву payments (если есть guestId)
      const recentPaid = payments.some(p => {
        if ((p.guestId || p.bookingId) !== guest.id) return false;
        const pts = new Date(p.date || p.timestamp || 0).getTime();
        return now.getTime() - pts < payGuardMs;
      });
      if (recentPaid) continue;

      // GATE 5 — на той же кровати нет «более старшего» активного гостя
      // (исключаем ложные срабатывания при гонке двух записей)
      const isJuniorOnBed = guests.some(g2 =>
        g2.id !== guest.id &&
        g2.status === 'active' &&
        g2.roomId === guest.roomId &&
        String(g2.bedId) === String(guest.bedId) &&
        new Date(g2.checkInDate || g2.checkInDateTime || 0) <
          new Date(guest.checkInDate || guest.checkInDateTime || 0)
      );
      if (isJuniorOnBed) continue; // есть более ранний активный гость — не трогаем

      // ✅ Все гейты пройдены → выселяем
      const guestRef = doc(db, ...PUBLIC_DATA_PATH, 'guests', guest.id);
      batch.update(guestRef, {
        status:        'checked_out',
        autoCheckedOut: true,
        autoCheckedOutAt: now.toISOString(),
        systemComment: `Авто-выселение: просрочка ${Math.round(msOverdue / 3600000)}ч`,
      });

      // Уменьшаем occupied только если на кровати нет другого активного гостя
      const anotherActive = guests.some(g2 =>
        g2.id !== guest.id &&
        g2.status === 'active' &&
        g2.roomId === guest.roomId &&
        String(g2.bedId) === String(guest.bedId)
      );
      if (!anotherActive) {
        const room = rooms.find(r => r.id === guest.roomId);
        if (room) {
          batch.update(doc(db, ...PUBLIC_DATA_PATH, 'rooms', room.id), {
            occupied: increment(-1),
          });
        }
      }

      evicted.push({ id: guest.id, name: guest.fullName || guest.name || guest.id });
      count++;
    }

    if (count > 0) {
      try {
        await batch.commit();
        showNotification(`🏁 Авто-выселение: ${count} гост${count === 1 ? 'ь' : 'ей'}`, 'warning');
        // Логируем в auditLog одной записью
        logAction(
          { id: 'system', name: 'System', role: 'system', hostelId: null },
          'auto_checkout',
          { count, guests: evicted.map(e => e.name) },
        );
      } catch (e) {
        console.error('[auto-checkout] batch error:', e);
        logSystemError('auto_checkout', e, { count });
      }
    }
  };

  // ⏱ Первая проверка через 2 мин после загрузки — данные успевают устояться
  const initial = setTimeout(runAutoCheckout, 2 * 60 * 1000);
  // Повторная проверка каждые 30 минут
  const interval = setInterval(runAutoCheckout, 30 * 60 * 1000);

  return () => {
    clearTimeout(initial);
    clearInterval(interval);
  };
// Намеренно НЕ включаем guests/rooms/payments в deps — они читаются через refs,
// чтобы таймер не сбрасывался при каждом изменении Firestore-данных.
// Refs обновляются через отдельные useEffect выше.
}, [currentUser, isDataReady]); // eslint-disable-line react-hooks/exhaustive-deps
}
