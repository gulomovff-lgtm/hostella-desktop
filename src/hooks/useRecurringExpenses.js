/**
 * useRecurringExpenses — ежемесячные автоматические расходы.
 *
 * Шаблон хранится в: PUBLIC_DATA_PATH / recurringExpenses
 * Поля:
 *   name           : string   — отображаемое название
 *   category       : string   — категория (как в ExpenseModal)
 *   amount         : number   — сумма
 *   comment        : string   — дополнительный комментарий
 *   dayOfMonth     : number   — число месяца 1-28
 *   hostelId       : string   — 'hostel1' | 'hostel2' | 'all'
 *   active         : boolean
 *   lastFiredMonth : string   — 'YYYY-MM' последнего авто-начисления
 *   createdAt      : string
 *
 * Авто-начисление: при каждом запуске приложения проверяем —
 * если сегодняшнее число >= dayOfMonth И этот месяц ещё не отмечен
 * в lastFiredMonth → добавляем расход в коллекцию expenses.
 */
import { useEffect, useCallback, useRef } from 'react';
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { HOSTELS } from '../utils/helpers';

const recurringCol = () => collection(db, ...PUBLIC_DATA_PATH, 'recurringExpenses');
const expensesCol  = () => collection(db, ...PUBLIC_DATA_PATH, 'expenses');

export const useRecurringExpenses = ({
  currentUser,
  selectedHostelFilter,
  recurringExpenses = [],
  showNotification,
}) => {

  // Сессионный замок: предотвращает двойное начисление при нескольких срабатываниях useEffect
  const firedInSession = useRef(new Set());

  /* ── Авто-начисление при старте ────────────────────────────────────── */
  useEffect(() => {
    if (!recurringExpenses.length || !currentUser) return;

    const today = new Date();
    const curMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    (async () => {
      for (const tmpl of recurringExpenses) {
        if (!tmpl.active) continue;
        if (tmpl.lastFiredMonth === curMonthKey) continue;
        if (today.getDate() < (tmpl.dayOfMonth || 1)) continue;

        // Проверяем сессионный замок СИНХРОННО до любого await
        const sessionKey = `${tmpl.id}:${curMonthKey}`;
        if (firedInSession.current.has(sessionKey)) continue;
        firedInSession.current.add(sessionKey); // блокируем сразу

        // Определяем хостелы для начисления
        const targetHostels =
          tmpl.hostelId === 'all' || !tmpl.hostelId
            ? Object.keys(HOSTELS)
            : [tmpl.hostelId];

        let fired = false;
        for (const hid of targetHostels) {
          try {
            await addDoc(expensesCol(), {
              category:    tmpl.category,
              amount:      Number(tmpl.amount),
              comment:     `[Авто] ${tmpl.name}${tmpl.comment ? ' — ' + tmpl.comment : ''}`,
              date:        today.toISOString(),
              hostelId:    hid,
              staffId:     'auto',
              recurringId: tmpl.id,
            });
            fired = true;
          } catch (e) {
            console.error('[recurring] fire error', e);
          }
        }

        // Если ни одного расхода не добавилось — снимаем замок для повтора
        if (!fired) {
          firedInSession.current.delete(sessionKey);
          continue;
        }

        // Отмечаем месяц как начисленный
        try {
          await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'recurringExpenses', tmpl.id), {
            lastFiredMonth: curMonthKey,
          });
        } catch (e) {
          console.error('[recurring] update lastFiredMonth', e);
        }
      }
    })();
    // Запускаем только при изменении списка шаблонов или смене пользователя
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurringExpenses.map(t => `${t.id}:${t.lastFiredMonth}:${t.active}`).join(','), currentUser?.id]);

  /* ── CRUD ──────────────────────────────────────────────────────────── */

  const addRecurring = useCallback(async (tmpl) => {
    try {
      await addDoc(recurringCol(), {
        ...tmpl,
        amount:        Number(tmpl.amount),
        dayOfMonth:    Number(tmpl.dayOfMonth) || 1,
        active:        true,
        lastFiredMonth: null,
        createdAt:     new Date().toISOString(),
      });
      showNotification?.('Шаблон добавлен', 'success');
    } catch (e) {
      console.error(e);
      showNotification?.('Ошибка', 'error');
    }
  }, [showNotification]);

  const updateRecurring = useCallback(async (id, patch) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'recurringExpenses', id), patch);
    } catch (e) {
      showNotification?.('Ошибка', 'error');
    }
  }, [showNotification]);

  const deleteRecurring = useCallback(async (id) => {
    if (!window.confirm('Удалить шаблон повторяющегося расхода?')) return;
    await deleteDoc(doc(db, ...PUBLIC_DATA_PATH, 'recurringExpenses', id));
    showNotification?.('Шаблон удалён', 'success');
  }, [showNotification]);

  const toggleActive = useCallback(async (id, current) => {
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'recurringExpenses', id), {
      active: !current,
    });
  }, []);

  /** Принудительно внести расход прямо сейчас */
  const fireNow = useCallback(async (tmpl) => {
    const hostelId = selectedHostelFilter && selectedHostelFilter !== 'all'
      ? selectedHostelFilter
      : tmpl.hostelId && tmpl.hostelId !== 'all'
        ? tmpl.hostelId
        : Object.keys(HOSTELS)[0];
    try {
      await addDoc(expensesCol(), {
        category:    tmpl.category,
        amount:      Number(tmpl.amount),
        comment:     `[Авто] ${tmpl.name}${tmpl.comment ? ' — ' + tmpl.comment : ''}`,
        date:        new Date().toISOString(),
        hostelId,
        staffId:     currentUser?.id || currentUser?.login || 'manual',
        recurringId: tmpl.id,
      });
      showNotification?.(`Расход "${tmpl.name}" внесён`, 'success');
    } catch (e) {
      console.error(e);
      showNotification?.('Ошибка', 'error');
    }
  }, [currentUser, selectedHostelFilter, showNotification]);

  return { addRecurring, updateRecurring, deleteRecurring, toggleActive, fireNow };
};
