/**
 * useReferralSystem — бонусная программа, привязанная к коллекции clients.
 *
 * Каждый клиент в Firestore может иметь поля:
 *   referredBy       : string|null  — id клиента-реферера
 *   referralsMade    : number        — счётчик подтверждённых рефералов (сбрасывается после 2)
 *   bonusDays        : number        — доступные бонусные дни
 *   totalBonusEarned : number        — всего заработано за всё время
 *   totalBonusUsed   : number        — всего использовано
 *   referralConfirmed: boolean       — пребывание 10+ дней подтверждено
 *
 * Дерево строится динамически из плоского списка clients по полю referredBy.
 */
import { useCallback } from 'react';
import {
  collection, doc, addDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';
import { DEFAULT_REFERRAL_SETTINGS } from './useReferralSettings';

/* ── Строим дерево из плоского массива ─────────────────────────────────────── */
export const buildReferralTree = (clients, hostelId) => {
  // Фильтруем по хостелу:
  // - клиенты без hostelId (null/undefined) считаются принадлежащими hostel2 (legacy)
  // - hostel1 показывает только явно помеченных hostel1-клиентов
  // - hostel2 показывает hostel2-клиентов + старых (null hostelId)
  // - 'all' / без фильтра — всех
  const pool = clients.filter(c => {
    if (!hostelId || hostelId === 'all') return true;
    if (hostelId === 'hostel2') return !c.hostelId || c.hostelId === 'hostel2';
    return c.hostelId === hostelId;
  });

  // Виртуальный корень — «Хостел»
  const root = {
    id: 'root',
    name: 'Хостел',
    referredBy: null,
    referralsMade: 0,
    bonusDays: 0,
    totalBonusEarned: 0,
    totalBonusUsed: 0,
    referralConfirmed: true,
    isVirtual: true,
    children: [],
  };

  // Создаём map id → node (копии, чтобы не мутировать оригиналы)
  const map = { root };
  pool.forEach(c => {
    map[c.id] = { ...c, children: [] };
  });

  // Привязываем детей к родителям
  pool.forEach(c => {
    const parentId = c.referredBy || null;
    if (parentId && map[parentId]) {
      map[parentId].children.push(map[c.id]);
    } else if (c.referredBy) {
      // Реферер не в текущем хостеле или удалён — вешаем к корню
      root.children.push(map[c.id]);
    }
    // Клиенты без referredBy — не показываем в дереве (они не в бонусной программе)
  });

  // Корень показываем только если есть прямые «рефералы» хостела
  // + клиенты у которых referredBy = 'root'
  pool.filter(c => c.referredBy === 'root').forEach(c => {
    if (!root.children.find(ch => ch.id === c.id)) {
      root.children.push(map[c.id]);
    }
  });

  return [root];
};

/* ── Плоский список всех клиентов в программе ─────────────────────────────── */
export const getReferralParticipants = (clients) =>
  clients.filter(c => c.referredBy != null);

/* ── Хук ───────────────────────────────────────────────────────────────────── */
export const useReferralSystem = ({ clients = [], guests = [], hostelId, showNotification, settings }) => {
  const cfg = { ...DEFAULT_REFERRAL_SETTINGS, ...(settings || {}) };

  const clientsRef = collection(db, ...PUBLIC_DATA_PATH, 'clients');

  /* Добавить нового клиента в бонусную программу */
  const addReferralClient = useCallback(async (name, referredById) => {
    try {
      const docRef = await addDoc(clientsRef, {
        fullName: name.trim().toUpperCase(),
        referredBy: referredById || 'root',
        referralsMade: 0,
        bonusDays: 0,
        totalBonusEarned: 0,
        totalBonusUsed: 0,
        referralConfirmed: false,
        hostelId: hostelId || null,
        visits: 0,
        createdAt: new Date().toISOString(),
      });
      showNotification?.(`Гость "${name}" добавлен в бонусную программу`, 'success');
      return docRef.id;
    } catch (e) {
      console.error(e);
      showNotification?.('Ошибка при добавлении гостя', 'error');
    }
  }, [hostelId, showNotification]);

  /* Привязать существующего клиента к программе (указать реферера) */
  const linkExistingClient = useCallback(async (clientId, referredById) => {
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', clientId), {
        referredBy: referredById || 'root',
        referralsMade: 0,
        bonusDays: 0,
        totalBonusEarned: 0,
        totalBonusUsed: 0,
        referralConfirmed: false,
        // Присваиваем хостел, чтобы клиент попал в нужную базу
        ...(hostelId ? { hostelId } : {}),
      });
      showNotification?.('Гость добавлен в бонусную программу', 'success');
    } catch (e) {
      console.error(e);
      showNotification?.('Ошибка', 'error');
    }
  }, [hostelId, showNotification]);

  /* Подтвердить пребывание (мин. дней — из настроек) → начислить бонус рефереру */
  const confirmTenDayStay = useCallback(async (clientId) => {
    const guest = clients.find(c => c.id === clientId);
    if (!guest) return;
    if (guest.referralConfirmed) {
      showNotification?.('Уже подтверждено', 'info');
      return;
    }

    const referrerId = guest.referredBy;
    const referrer = referrerId && referrerId !== 'root'
      ? clients.find(c => c.id === referrerId)
      : null;

    // Помечаем гостя подтверждённым
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', clientId), {
      referralConfirmed: true,
      confirmedAt: new Date().toISOString(),
    });

    // Начисляем бонус рефереру (динамические тиры из настроек)
    if (referrer) {
      const tiers = cfg.tiers?.length ? cfg.tiers : DEFAULT_REFERRAL_SETTINGS.tiers;
      const madeCount = referrer.referralsMade || 0;
      const tierIdx = madeCount % tiers.length;
      const tier = tiers[tierIdx];
      const bonusToAdd = tier?.bonusDays ?? 1;
      const newMade = madeCount + 1;
      const reset = cfg.resetAfterCycle && newMade >= tiers.length;
      const capBonus = cfg.maxBonusDays > 0
        ? Math.min(bonusToAdd, cfg.maxBonusDays - (referrer.bonusDays || 0))
        : bonusToAdd;
      const actualBonus = Math.max(0, capBonus);
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', referrer.id), {
        referralsMade: reset ? 0 : newMade,
        bonusDays: (referrer.bonusDays || 0) + actualBonus,
        totalBonusEarned: (referrer.totalBonusEarned || 0) + actualBonus,
      });
      const dayLabel = actualBonus === 1 ? 'день' : 'дня';
      const cap = actualBonus < bonusToAdd ? ' (достигнут лимит)' : '';
      showNotification?.(`+${actualBonus} бонусн. ${dayLabel} начислено «${referrer.fullName}»${cap}`, 'success');
    } else {
      showNotification?.('Подтверждено ✓', 'success');
    }
  }, [clients, showNotification, cfg]);

  /* Списать бонусные дни */
  const redeemBonusDays = useCallback(async (clientId, days) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const toUse = Math.min(parseInt(days, 10) || 1, client.bonusDays || 0);
    if (toUse <= 0) return;
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', clientId), {
      bonusDays: (client.bonusDays || 0) - toUse,
      totalBonusUsed: (client.totalBonusUsed || 0) + toUse,
    });
    showNotification?.(`${toUse} бонусн. ${toUse === 1 ? 'день' : 'дня'} списано`, 'success');
  }, [clients, showNotification]);

  /* Начислить бонусные дни вручную */
  const addBonusDays = useCallback(async (clientId, days) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const toAdd = parseInt(days, 10) || 1;
    if (toAdd <= 0) return;
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', clientId), {
      bonusDays: (client.bonusDays || 0) + toAdd,
      totalBonusEarned: (client.totalBonusEarned || 0) + toAdd,
    });
    showNotification?.(`+${toAdd} бонусн. ${toAdd === 1 ? 'день' : 'дней'} начислено`, 'success');
  }, [clients, showNotification]);

  /* Обнулить бонусы */
  const resetBonuses = useCallback(async (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const used = (client.totalBonusUsed || 0) + (client.bonusDays || 0);
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', clientId), {
      bonusDays: 0,
      totalBonusUsed: used,
    });
    showNotification?.('Бонусы обнулены', 'success');
  }, [clients, showNotification]);

  /* Продление проживания на бонусные дни — добавляет bonusCheckOutDate к существующему гостю */
  const extendStayWithBonus = useCallback(async (clientId, guestId, numDays) => {
    const client = clients.find(c => c.id === clientId);
    const guest  = guests.find(g => g.id === guestId);
    if (!client || !guest) {
      showNotification?.('Гость или клиент не найден', 'error');
      return;
    }
    const daysNum   = parseInt(numDays, 10) || 1;
    const available = client.bonusDays || 0;
    if (daysNum > available) {
      showNotification?.(`Недостаточно бонусных дней (есть ${available})`, 'error');
      return;
    }
    // Старт бонуса — от уже имеющегося bonusCheckOutDate или от checkOutDate
    const baseDate   = new Date(guest.bonusCheckOutDate || guest.checkOutDate);
    const newBonusCo = new Date(baseDate);
    newBonusCo.setDate(newBonusCo.getDate() + daysNum);
    try {
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'guests', guestId), {
        bonusCheckOutDate: newBonusCo.toISOString(),
        bonusDaysAdded: (guest.bonusDaysAdded || 0) + daysNum,
        clientId: clientId,
      });
      await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', clientId), {
        bonusDays: available - daysNum,
        totalBonusUsed: (client.totalBonusUsed || 0) + daysNum,
      });
      showNotification?.(`+${daysNum} бонусных дн. продлено гостю «${guest.fullName}»`, 'success');
    } catch (e) {
      console.error(e);
      showNotification?.('Ошибка продления', 'error');
    }
  }, [clients, guests, showNotification]);

  /* Убрать клиента из программы (очистить реферальные поля) */
  const removeFromProgram = useCallback(async (clientId) => {
    await updateDoc(doc(db, ...PUBLIC_DATA_PATH, 'clients', clientId), {
      referredBy: null,
      referralsMade: 0,
      bonusDays: 0,
      totalBonusEarned: 0,
      totalBonusUsed: 0,
      referralConfirmed: false,
    });
    showNotification?.('Гость удалён из бонусной программы', 'success');
  }, [showNotification]);

  /* Хелпер фильтрации по хостелу (hostel2 = старые legacy-клиенты) */
  const filterByHostel = useCallback((list) => {
    if (!hostelId || hostelId === 'all') return list;
    if (hostelId === 'hostel2') return list.filter(c => !c.hostelId || c.hostelId === 'hostel2');
    return list.filter(c => c.hostelId === hostelId);
  }, [hostelId]);

  /* Список всех участников для select-списка */
  const getParticipantList = useCallback(() => {
    const participants = filterByHostel(clients).filter(c => c.referredBy != null || c.id === 'root');
    const root = { id: 'root', name: 'Хостел' };
    const list = [root, ...participants.map(c => ({ id: c.id, name: c.fullName || c.name || c.id }))];
    const seen = new Set();
    return list.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
  }, [clients, filterByHostel]);

  /* Все клиенты для поиска «Из базы» — без фильтра хостела,
     чтобы hostel1 тоже мог найти legacy-клиентов (hostelId: null).
     При привязке клиент получит hostelId текущего хостела. */
  const getNonParticipants = useCallback(() =>
    clients.filter(c => c.referredBy == null),
  [clients]);

  /* Сводная статистика */
  const getStats = useCallback(() => {
    const all = filterByHostel(clients).filter(c => c.referredBy != null);
    return {
      totalGuests:      all.length,
      confirmedGuests:  all.filter(c => c.referralConfirmed).length,
      pendingGuests:    all.filter(c => !c.referralConfirmed).length,
      totalBonusEarned: all.reduce((s, c) => s + (c.totalBonusEarned || 0), 0),
      totalBonusUsed:   all.reduce((s, c) => s + (c.totalBonusUsed || 0), 0),
      totalBonusPending:all.reduce((s, c) => s + (c.bonusDays || 0), 0),
    };
  }, [clients, filterByHostel]);

  /* Само дерево */
  const nodes = buildReferralTree(clients, hostelId);

  return {
    nodes,
    addReferralClient,
    linkExistingClient,
    confirmTenDayStay,
    redeemBonusDays,
    addBonusDays,
    resetBonuses,
    extendStayWithBonus,
    removeFromProgram,
    getParticipantList,
    getNonParticipants,
    getStats,
  };
};
