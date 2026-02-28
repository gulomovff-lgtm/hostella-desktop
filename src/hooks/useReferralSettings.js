/**
 * useReferralSettings — настройки бонусной программы, хранятся в Firestore:
 *   PUBLIC_DATA_PATH / settings / referralProgram
 *
 * Структура документа:
 * {
 *   programName      : string   — отображаемое название
 *   programActive    : boolean  — программа включена/выключена
 *   minStayDays      : number   — мин. дней проживания для подтверждения (def: 10)
 *   maxBonusDays     : number   — макс. бонусных дней на одного гостя (def: 30)
 *   bonusExpiryDays  : number   — срок действия бонусов, 0 = бессрочно
 *   resetAfterCycle  : boolean  — сбрасывать счётчик после прохождения всех тиров
 *   tiers            : [ { id, label, bonusDays } ]  — порядок тиров (по очереди)
 *   customRules      : [ { id, text } ]               — пользовательские правила
 * }
 */

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, PUBLIC_DATA_PATH } from '../firebase';

/* ── Настройки по умолчанию ─────────────────────────────────────────────── */
export const DEFAULT_REFERRAL_SETTINGS = {
  programName:     'Бонусная программа',
  programActive:   true,
  minStayDays:     10,
  maxBonusDays:    30,
  bonusExpiryDays: 0,
  resetAfterCycle: true,
  tiers: [
    { id: 'tier_1', label: '1-й реферал', bonusDays: 1 },
    { id: 'tier_2', label: '2-й реферал', bonusDays: 2 },
  ],
  customRules: [
    { id: 'rule_1', text: 'Гость приглашает знакомого — тот должен пожить минимум 10 дней' },
    { id: 'rule_2', text: 'После подтверждения реферер получает бонусные дни по текущему тиру' },
    { id: 'rule_3', text: 'Бонусные дни вычитаются из стоимости следующего проживания' },
    { id: 'rule_4', text: 'Приглашённый гость тоже может приглашать других — бонусы начисляются ему' },
  ],
};

const SETTINGS_DOC = (hostelId) => {
  const docId = hostelId && hostelId !== 'all' ? `referralProgram_${hostelId}` : 'referralProgram';
  return doc(db, ...PUBLIC_DATA_PATH, 'settings', docId);
};

/* ── Генератор ID ────────────────────────────────────────────────────────── */
const uid = () => `id_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

/* ── Хук ─────────────────────────────────────────────────────────────────── */
export const useReferralSettings = (showNotification, hostelId) => {
  const [settings, setSettings] = useState(DEFAULT_REFERRAL_SETTINGS);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  /* Загружаем из Firestore при монтировании или смене хостела */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const snap = await getDoc(SETTINGS_DOC(hostelId));
        if (!cancelled) {
          if (snap.exists()) {
            setSettings({ ...DEFAULT_REFERRAL_SETTINGS, ...snap.data() });
          } else {
            // Первый запуск — записываем дефолты
            await setDoc(SETTINGS_DOC(hostelId), DEFAULT_REFERRAL_SETTINGS);
            setSettings(DEFAULT_REFERRAL_SETTINGS);
          }
        }
      } catch (e) {
        console.error('referralSettings load error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [hostelId]);

  /* Сохранить весь объект настроек */
  const saveSettings = useCallback(async (next) => {
    setSaving(true);
    try {
      await setDoc(SETTINGS_DOC(hostelId), next);
      setSettings(next);
      showNotification?.('Настройки сохранены', 'success');
    } catch (e) {
      console.error(e);
      showNotification?.('Ошибка сохранения', 'error');
    } finally {
      setSaving(false);
    }
  }, [showNotification, hostelId]);

  /* ── Тиры ───────────────────────────────────────────────────────────────── */

  const addTier = useCallback(() => {
    const next = {
      ...settings,
      tiers: [
        ...settings.tiers,
        { id: uid(), label: `${settings.tiers.length + 1}-й реферал`, bonusDays: 1 },
      ],
    };
    setSettings(next);
    return next;
  }, [settings]);

  const updateTier = useCallback((id, changes) => {
    const next = {
      ...settings,
      tiers: settings.tiers.map(t => t.id === id ? { ...t, ...changes } : t),
    };
    setSettings(next);
    return next;
  }, [settings]);

  const removeTier = useCallback((id) => {
    if (settings.tiers.length <= 1) return settings;
    const next = {
      ...settings,
      tiers: settings.tiers.filter(t => t.id !== id),
    };
    setSettings(next);
    return next;
  }, [settings]);

  const moveTier = useCallback((id, dir) => {
    const idx = settings.tiers.findIndex(t => t.id === id);
    if (idx < 0) return settings;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= settings.tiers.length) return settings;
    const arr = [...settings.tiers];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    const next = { ...settings, tiers: arr };
    setSettings(next);
    return next;
  }, [settings]);

  /* ── Пользовательские правила ─────────────────────────────────────────── */

  const addRule = useCallback(() => {
    const next = {
      ...settings,
      customRules: [...settings.customRules, { id: uid(), text: '' }],
    };
    setSettings(next);
    return next;
  }, [settings]);

  const updateRule = useCallback((id, text) => {
    const next = {
      ...settings,
      customRules: settings.customRules.map(r => r.id === id ? { ...r, text } : r),
    };
    setSettings(next);
    return next;
  }, [settings]);

  const removeRule = useCallback((id) => {
    const next = {
      ...settings,
      customRules: settings.customRules.filter(r => r.id !== id),
    };
    setSettings(next);
    return next;
  }, [settings]);

  /* ── Изменить простое поле ────────────────────────────────────────────── */
  const patchSettings = useCallback((patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    return next;
  }, [settings]);

  return {
    settings,
    loading,
    saving,
    saveSettings,
    patchSettings,
    addTier,
    updateTier,
    removeTier,
    moveTier,
    addRule,
    updateRule,
    removeRule,
  };
};
