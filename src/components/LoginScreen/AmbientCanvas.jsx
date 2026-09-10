import React, { useEffect, useRef } from 'react';

/**
 * Живой фоновый слой экрана входа — мягкое ПЕРЕЛИВАНИЕ цвета.
 *
 * Не свечение: рисуем широкие полупрозрачные пятна обычным наложением
 * (source-over с низкой альфой), а не аддитивным `lighter` — цвет перетекает
 * как шёлк, без ярких ореолов.
 *
 * При смене темы цвета не переключаются рывком, а ПЛАВНО перетекают в новые
 * (интерполяция rgba за ~1.4 с) — вместе с кроссфейдом градиента фона это даёт
 * ощущение единого перелива, а не подмены картинки.
 *
 * Один canvas, рисуем только когда вкладка видима; при prefers-reduced-motion —
 * один статичный кадр.
 */

// rgba(...) → [r,g,b,a]; на непонятной строке отдаём прозрачный, чтобы не падать
const parseRGBA = (s) => {
  const m = String(s || '').match(/rgba?\(([^)]+)\)/);
  if (!m) return [255, 255, 255, 0];
  const p = m[1].split(',').map(x => parseFloat(x.trim()));
  return [p[0] || 0, p[1] || 0, p[2] || 0, p[3] === undefined ? 1 : p[3]];
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const toRGBA = (c, alphaScale = 1) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${(c[3] * alphaScale).toFixed(3)})`;

const AmbientCanvas = ({ colors = [], intensity = 1 }) => {
  const ref = useRef(null);
  const target = useRef([]);   // цвета, к которым перетекаем
  const current = useRef([]);  // цвета прямо сейчас
  const mouse = useRef({ x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 });

  // Смена темы: задаём новую цель, перетекание делает цикл отрисовки
  useEffect(() => {
    const next = (colors.length ? colors : ['rgba(120,150,220,0.4)', 'rgba(80,110,190,0.3)', 'rgba(50,80,150,0.2)'])
      .slice(0, 3).map(parseRGBA);
    target.current = next;
    if (!current.current.length) current.current = next.map(c => [...c]);
  }, [colors.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Опираемся на реальный размер бокса; если раскладка ещё не случилась —
      // подстраховываемся окном, иначе canvas остаётся 1×1 и слой пустой.
      w = canvas.clientWidth || window.innerWidth;
      h = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    // Размер бокса может прийти позже монтирования — следим за ним
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    // Пятна: широкие, мягкие, у каждого своя орбита и период
    const blobs = [
      { i: 0, bx: 0.24, by: 0.74, ax: 0.13, ay: 0.07, sx: 0.000062, sy: 0.000045, r: 0.78, ph: 0.0, br: 0.00011, depth: 0.55 },
      { i: 1, bx: 0.56, by: 0.86, ax: 0.16, ay: 0.06, sx: 0.000048, sy: 0.000036, r: 0.92, ph: 2.1, br: 0.00008, depth: 0.36 },
      { i: 2, bx: 0.82, by: 0.68, ax: 0.11, ay: 0.09, sx: 0.000036, sy: 0.000028, r: 1.05, ph: 4.2, br: 0.00006, depth: 0.20 },
    ];

    let raf = 0, last = performance.now(), t = 0, running = true;

    const draw = (now) => {
      const dt = Math.min(now - last, 50);
      last = now;
      if (!reduced) t += dt;

      // Плавное перетекание цветов к цели (~1.4 с до почти полного совпадения)
      const k = 1 - Math.pow(0.0015, dt / 1400);
      if (target.current.length) {
        if (current.current.length !== target.current.length) current.current = target.current.map(c => [...c]);
        current.current = current.current.map((c, i) => mix(c, target.current[i] || c, k));
      }

      mouse.current.x += (mouse.current.tx - mouse.current.x) * 0.04;
      mouse.current.y += (mouse.current.ty - mouse.current.y) * 0.04;
      const mx = mouse.current.x - 0.5, my = mouse.current.y - 0.5;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over'; // без аддитивного свечения
      const base = Math.max(w, h);

      for (const b of blobs) {
        const col = current.current[b.i] || current.current[0];
        if (!col) continue;
        const px = (b.bx + Math.sin(t * b.sx + b.ph) * b.ax + mx * 0.05 * b.depth) * w;
        const py = (b.by + Math.cos(t * b.sy + b.ph) * b.ay + my * 0.04 * b.depth) * h;
        const r = base * b.r * (1 + Math.sin(t * b.br + b.ph) * 0.10);
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        // Мягкий спад: в центре половина исходной альфы, дальше — в ноль
        g.addColorStop(0.00, toRGBA(col, 0.55 * intensity));
        g.addColorStop(0.42, toRGBA(col, 0.22 * intensity));
        g.addColorStop(0.75, toRGBA(col, 0.06 * intensity));
        g.addColorStop(1.00, toRGBA([col[0], col[1], col[2], 0], 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (running && !reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onMove = (e) => {
      mouse.current.tx = e.clientX / window.innerWidth;
      mouse.current.ty = e.clientY / window.innerHeight;
    };
    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!reduced) { running = true; last = performance.now(); raf = requestAnimationFrame(draw); }
    };
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('visibilitychange', onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [intensity]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 3 }}
    />
  );
};

export default AmbientCanvas;
