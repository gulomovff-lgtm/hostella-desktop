import React, { useRef } from 'react';

/**
 * stableView — экран, который перерисовывается, только когда поменялись его ДАННЫЕ.
 *
 * ── ЗАЧЕМ ───────────────────────────────────────────────────────────────
 *
 * App перерисовывается целиком на каждое открытие окна, уведомление, снимок
 * базы (в т.ч. чужие действия и фоновая автоматика e-mehmon). Экран за окном
 * пересчитывался заново, хотя его данные не менялись: замер на 4000 гостей —
 * панель 100–140 мс, комнаты и календарь 25–80 мс на КАЖДУЮ такую перерисовку
 * (на слабой кассе — в разы дольше). Отсюда «виснет при открытии окон и вводе
 * чисел» (жалоба владельца 2026-09-25).
 *
 * ── КАК ─────────────────────────────────────────────────────────────────
 *
 * App передаёт экранам стрелочные функции, которые создаются заново при
 * каждой перерисовке, — обычный React.memo их считает «новыми» и не помогает.
 * Здесь каждый обработчик заменяется постоянной обёрткой, которая вызывает
 * САМУЮ СВЕЖУЮ версию функции (через ref) — поэтому устаревших замыканий нет,
 * а сравнение идёт только по данным. Проп, который то функция, то null
 * (например, кнопка только для супера), остаётся честным: null передаётся
 * как null.
 */
export function stableView(Component) {
  const Memo = React.memo(Component);
  function StableView(props) {
    const latest = useRef(props);
    latest.current = props;
    const proxies = useRef({});
    const next = {};
    for (const key of Object.keys(props)) {
      const v = props[key];
      if (typeof v === 'function') {
        if (!proxies.current[key]) proxies.current[key] = (...args) => latest.current[key]?.(...args);
        next[key] = proxies.current[key];
      } else {
        next[key] = v;
      }
    }
    return <Memo {...next} />;
  }
  StableView.displayName = `Stable(${Component.displayName || Component.name || 'View'})`;
  return StableView;
}

export default stableView;
