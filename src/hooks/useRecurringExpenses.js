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

// Глобальный замок на уровне модуля — не сбрасывается при StrictMode двойном монтировании
const _globalFired = new Set();

export const useRecurringExpenses = ({
  currentUser,
  selectedHostelFilter,
  recurringExpenses = [],
  expenses = [],
  showNotification,
}) => {

  /** Сумма уже выданных авансов по шаблону за конкретный месяц ('YYYY-MM') */
  const getAdvancesSum = useCallback((tmplId, monthKey) => {
    return expenses
      .filter(e =>
        e.recurringId === tmplId &&
        e.category === 'Аванс' &&
        e.date?.startsWith(monthKey)
      )
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }, [expenses]);

  /** Карта { tmplId → sumAdvances } для текущего месяца — для UI */
  const getRecurringAdvances = useCallback(() => {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const map = {};
    for (const tmpl of recurringExpenses) {
      const s = getAdvancesSum(tmpl.id, key);
      if (s > 0) map[tmpl.id] = s;
    }
    return map;
  }, [recurringExpenses, getAdvancesSum]);

  // Сессионный замок: резервный, на случай сброса модуля
  const firedInSession = useRef(new Set());
  // Ref на текущие расходы — используем в эффекте без добавления в зависимости
  const expensesRef = useRef(expenses);
  useEffect(() => { expensesRef.current = expenses; }, [expenses]);

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

        // Проверяем ОБА замка сразу, ДО любого await
        const sessionKey = `${tmpl.id}:${curMonthKey}`;
        if (_globalFired.has(sessionKey)) continue;
        if (firedInSession.current.has(sessionKey)) continue;
        _globalFired.add(sessionKey);       // глобальный замок
        firedInSession.current.add(sessionKey); // локальный замок

        // Персистентная проверка по snapshot расходов (через ref — без re-рендера)
        const alreadyExists = expensesRef.current.some(e =>
          e.recurringId === tmpl.id &&
          typeof e.date === 'string' &&
          e.date.startsWith(curMonthKey)
        );
        if (alreadyExists) {
          // lastFiredMonth устарел — синхронизируем без начисления
          updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'recurringExpenses', tmpl.id), {
            lastFiredMonth: curMonthKey,
          }).catch(() => {});
          continue;
        }

        // Определяем хостелы для начисления
        const targetHostels =
          tmpl.hostelId === 'all' || !tmpl.hostelId
            ? Object.keys(HOSTELS)
            : [tmpl.hostelId];

        // Вычитаем аванс (только для Зарплаты)
        const advSum = tmpl.category === 'Зарплата'
          ? getAdvancesSum(tmpl.id, curMonthKey)
          : 0;
        const netAmount = Math.max(0, Number(tmpl.amount) - advSum);

        let fired = false;
        for (const hid of targetHostels) {
          try {
            await addDoc(expensesCol(), {
              category:    tmpl.category,
              amount:      netAmount,
              comment:     `[Авто] ${tmpl.name}${advSum > 0 ? ` (аванс −${advSum.toLocaleString()})` : ''}${tmpl.comment ? ' — ' + tmpl.comment : ''}`,
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
          _globalFired.delete(sessionKey);      // снимаем глобальный замок
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
    // Запускаем при изменении шаблонов, пользователя, или загрузке расходов с recurringId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    recurringExpenses.map(t => `${t.id}:${t.lastFiredMonth}:${t.active}`).join(','),
    currentUser?.id,
    // НЕ включаем expenses в зависимости — используем expensesRef чтобы
    // избежать повторного запуска после того как сами же добавили расход
  ]);

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
      const today = new Date();
      const curMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const advSum = tmpl.category === 'Зарплата' ? getAdvancesSum(tmpl.id, curMonthKey) : 0;
      const netAmount = Math.max(0, Number(tmpl.amount) - advSum);
      await addDoc(expensesCol(), {
        category:    tmpl.category,
        amount:      netAmount,
        comment:     `[Авто] ${tmpl.name}${advSum > 0 ? ` (аванс −${advSum.toLocaleString()})` : ''}${tmpl.comment ? ' — ' + tmpl.comment : ''}`,
        date:        today.toISOString(),
        hostelId,
        staffId:     currentUser?.id || currentUser?.login || 'manual',
        recurringId: tmpl.id,
      });
      showNotification?.(`Расход "${tmpl.name}" внесён${advSum > 0 ? ` (−${advSum.toLocaleString()} аванс)` : ''}`, 'success');
    } catch (e) {
      console.error(e);
      showNotification?.('Ошибка', 'error');
    }
  }, [currentUser, selectedHostelFilter, showNotification, getAdvancesSum]);

  return { addRecurring, updateRecurring, deleteRecurring, toggleActive, fireNow, getRecurringAdvances };
};
