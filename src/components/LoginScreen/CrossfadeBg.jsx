import React, { useState, useRef, useEffect } from 'react';

/**
 * Плавная смена градиента фона: новый слой ПРОЯВЛЯЕТСЯ поверх старого,
 * старый убирается только когда новый уже непрозрачен — цвета перетекают.
 *
 * Проявление сделано CSS-анимацией, а не переходом opacity по состоянию:
 * анимация стартует сама в момент появления элемента, ей не нужен второй кадр.
 * Вариант с requestAnimationFrame ломался в dev-режиме React (эффекты
 * вызываются дважды, cleanup отменял кадр — слой навсегда оставался прозрачным).
 *
 * При prefers-reduced-motion смена мгновенная.
 */
const CrossfadeBg = ({ background, duration = 1400, className = '', style, children }) => {
  const idRef = useRef(0);
  const [layers, setLayers] = useState(() => [{ id: 0, bg: background }]);
  const prev = useRef(background);

  useEffect(() => {
    if (background === prev.current) return;
    prev.current = background;
    const id = ++idRef.current;
    setLayers(ls => [...ls, { id, bg: background }]);
    // Старые слои убираем, когда новый полностью проявился
    const t = setTimeout(
      () => setLayers(ls => (ls.length > 1 ? ls.filter(l => l.id === id) : ls)),
      duration + 120);
    return () => clearTimeout(t);
  }, [background, duration]);

  return (
    <div className={className} style={style}>
      <style>{`
        @keyframes v7BgIn { from { opacity: 0 } to { opacity: 1 } }
        @media (prefers-reduced-motion: reduce) {
          .v7-xfade-layer { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
      {layers.map((l, i) => (
        <div
          key={l.id}
          aria-hidden="true"
          className="v7-xfade-layer"
          style={{
            position: 'absolute', inset: 0,
            background: l.bg,
            zIndex: i,
            // Первый слой уже на месте; каждый следующий проявляется поверх.
            // `both` удерживает конечное состояние — слой не мигнёт после анимации.
            animation: i === 0 ? 'none' : `v7BgIn ${duration}ms cubic-bezier(.4,0,.2,1) both`,
            willChange: i === 0 ? 'auto' : 'opacity',
          }}
        />
      ))}
      {children}
    </div>
  );
};

export default CrossfadeBg;
