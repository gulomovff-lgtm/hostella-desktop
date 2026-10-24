/**
 * Орнаменты фона экрана входа: семь восточных узоров в одной стилистике.
 * При каждом открытии экрана выбирается случайный (pickOrnament).
 *
 * Производительность (жалоба 24.10.2026: прежний фон грузил ~2 ядра в простое,
 * «Сюзане» в макете зависал на маске):
 *  • весь узор — 5 путей SVG (линии трёх видов и плитки двух видов), а не сотни
 *    элементов; у «Гириха» линии разбиты на 8 колец волны — 8 путей;
 *  • появление — только transform/opacity у HTML-слоёв (шторки, масштаб): это
 *    считает видеокарта, сам узор не перерисовывается; маски SVG не используются;
 *  • после появления анимации снимаются — экран полностью неподвижен.
 *
 * Без React и DOM — покрыто тестами (tests/login-ornaments.test.mjs).
 */

export const ORN_W = 1200;
export const ORN_H = 900;
export const ORN_CX = 600;
export const ORN_CY = 410;

/** Как появляется узор (классы в LoginScreen.css). */
export const ORNAMENTS = [
  { id: 'girih',   reveal: 'draw'   },  // линии рисуются волной от логотипа
  { id: 'khatam',  reveal: 'down'   },  // шторка уходит вниз
  { id: 'rosette', reveal: 'zoom'   },  // узор подлетает с поворотом
  { id: 'arches',  reveal: 'up'     },  // шторка уходит вверх
  { id: 'bannai',  reveal: 'diag'   },  // шторка уходит по диагонали
  { id: 'flower',  reveal: 'split'  },  // шторки расходятся в стороны
  { id: 'suzani',  reveal: 'pulse'  },  // проявляется ступенями
];

/** Случайный узор, по возможности не тот, что был в прошлый раз. */
export function pickOrnament(prevId = '', rnd = Math.random) {
  const pool = ORNAMENTS.filter(o => o.id !== prevId);
  const list = pool.length ? pool : ORNAMENTS;
  return list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];
}

const f = (n) => (Math.round(n * 10) / 10).toString();
const dist = (x, y) => Math.hypot(x - ORN_CX, y - ORN_CY) / Math.hypot(ORN_W / 2, ORN_H / 2);
const starPath = (x, y, r, n = 8, k = 0.62) => {
  const p = [];
  for (let i = 0; i < n * 2; i++) {
    const a = Math.PI / n * i - Math.PI / 2, rr = i % 2 ? r * k : r;
    p.push(f(x + Math.cos(a) * rr) + ' ' + f(y + Math.sin(a) * rr));
  }
  return 'M' + p.join(' L') + 'Z';
};
const circ = (x, y, r) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
const poly = (x, y, r, n, rot = -Math.PI / 2) => 'M' + Array.from({ length: n }, (_, i) => {
  const a = rot + i * 2 * Math.PI / n; return f(x + Math.cos(a) * r) + ' ' + f(y + Math.sin(a) * r);
}).join(' L') + 'Z';
const square = (x, y, q) => `M${f(x - q)} ${f(y - q)}H${f(x + q)}V${f(y + q)}H${f(x - q)}Z`;

const BUILDERS = {
  /* Гирих: восьмиконечные звёзды, сцепленные квадратами; линии — по кольцам волны */
  girih(s) {
    const S = 96, r = S * 0.46, q = ((S / 2) * Math.SQRT2 - r) / Math.SQRT2;
    let k = 0;
    for (let y = -S / 2; y <= ORN_H + S; y += S) for (let x = -S / 2; x <= ORN_W + S; x += S) {
      const ring = Math.min(7, Math.floor(dist(x, y) * 8));
      const hx = x + S / 2, hy = y + S / 2;
      (k++ % 3 ? s.t : s.tl).push(square(hx, hy, q));
      s.rings[ring].k.push(`${square(hx, hy, q)}M${f(x + r)} ${f(y)}H${f(x + S - r)}M${f(x)} ${f(y + r)}V${f(y + S - r)}`);
      ((Math.round(x / S) + Math.round(y / S)) % 2 ? s.rings[ring].c : s.rings[ring].ln).push(starPath(x, y, r));
    }
  },
  /* Хатам: шестиконечные звёзды в шестиугольниках */
  khatam(s) {
    const R = 54, w = R * Math.sqrt(3), h = R * 1.5;
    let row = 0;
    for (let y = -h; y <= ORN_H + h; y += h, row++) for (let x = -w + (row % 2) * w / 2; x <= ORN_W + w; x += w) {
      s.k.push(poly(x, y, R, 6, Math.PI / 6));
      (row % 2 ? s.c : s.ln).push(poly(x, y, R * 0.72, 3) + poly(x, y, R * 0.72, 3, Math.PI / 2));
      ((row + Math.round(x / w)) % 3 ? s.t : s.tl).push(poly(x, y, R * 0.36, 6, Math.PI / 6));
    }
  },
  /* Розетта: двенадцатилучевые звёзды в кругах */
  rosette(s) {
    const S = 120, r = S * 0.44;
    let k = 0;
    for (let y = -S / 2; y <= ORN_H + S; y += S) for (let x = -S / 2; x <= ORN_W + S; x += S) {
      s.k.push(circ(x, y, r) + circ(x, y, r * 0.32) + `M${f(x + r)} ${f(y)}H${f(x + S - r)}M${f(x)} ${f(y + r)}V${f(y + S - r)}`);
      (k % 2 ? s.c : s.ln).push(starPath(x, y, r * 0.92, 12, 0.7));
      (k++ % 3 ? s.t : s.tl).push(poly(x + S / 2, y + S / 2, S * 0.14, 4));
    }
  },
  /* Арки: стрельчатые арки галереи */
  arches(s) {
    const S = 84, Hh = 110, rr = S * 0.62;
    let row = 0;
    for (let y = 0; y <= ORN_H + Hh; y += Hh * 0.62, row++) for (let x = -S + (row % 2) * S / 2; x <= ORN_W + S; x += S) {
      const ys = y + Hh * 0.45, yt = y + 8;
      (row % 2 ? s.c : s.ln).push(`M${f(x)} ${f(y + Hh)}V${f(ys)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x + S / 2)} ${f(yt)}A${f(rr)} ${f(rr)} 0 0 1 ${f(x + S)} ${f(ys)}V${f(y + Hh)}`);
      const r2 = rr * 0.55;
      s.k.push(`M${f(x + S * 0.3)} ${f(y + Hh)}V${f(ys + 14)}A${f(r2)} ${f(r2)} 0 0 1 ${f(x + S / 2)} ${f(yt + 26)}A${f(r2)} ${f(r2)} 0 0 1 ${f(x + S * 0.7)} ${f(ys + 14)}V${f(y + Hh)}`);
      ((row + Math.round(x / S)) % 3 ? s.t : s.tl).push(poly(x + S / 2, yt + 6, 7, 4));
    }
  },
  /* Бенаи: кирпичный меандр — ключи-спирали */
  bannai(s) {
    const S = 72, u = S / 6;
    let k = 0;
    for (let y = 0; y <= ORN_H + S; y += S) for (let x = 0; x <= ORN_W + S; x += S) {
      const flip = (Math.round(x / S) + Math.round(y / S)) % 2;
      (flip ? s.c : s.ln).push(flip
        ? `M${x} ${y}H${x + S}V${y + S}H${x + u}V${y + u * 2}H${x + S - u * 2}V${y + S - u * 2}H${x + u * 3}V${y + u * 3}`
        : `M${x + S} ${y + S}H${x}V${y}H${x + S - u}V${y + S - u * 2}H${x + u * 2}V${y + u * 2}H${x + S - u * 3}V${y + S - u * 3}`);
      (k++ % 3 ? s.t : s.tl).push(square(x + S / 2, y + S / 2, u * 0.45));
    }
  },
  /* Цветок жизни: пересекающиеся круги */
  flower(s) {
    const R = 58, w = R, h = R * Math.sqrt(3) / 2;
    let row = 0;
    for (let y = -R; y <= ORN_H + R; y += h, row++) for (let x = -R + (row % 2) * w / 2; x <= ORN_W + R; x += w) {
      ((row + Math.round(x / w)) % 2 ? s.c : s.k).push(circ(x, y, R));
      ((row + Math.round(x / w)) % 3 ? s.t : s.tl).push(circ(x, y, 5));
    }
  },
  /* Сюзане: медальоны с лепестками. Облегчён: реже сетка и меньше лепестков —
     в макете 10 лепестков на частой сетке давали ~700 кругов и подвисание. */
  suzani(s) {
    const S = 200;
    let row = 0;
    for (let y = 0; y <= ORN_H + S; y += S * 0.8, row++) for (let x = (row % 2) * S / 2; x <= ORN_W + S; x += S) {
      const r = S * 0.34;
      s.k.push(circ(x, y, r) + circ(x, y, r * 0.62));
      let petals = '';
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; petals += circ(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82, r * 0.2); }
      (row % 2 ? s.c : s.ln).push(petals);
      s.ln.push(starPath(x, y, r * 0.5, 8, 0.5));
      (row % 3 ? s.t : s.tl).push(circ(x, y, r * 0.2));
    }
  },
};

/**
 * Пути узора: { ln, c, k, tl, t } — строки d для SVG; у «Гириха» ещё rings —
 * восемь колец волны [{ ln, c, k }], которые рисуются по очереди.
 */
export function buildOrnament(id) {
  const s = { ln: [], c: [], k: [], tl: [], t: [], rings: Array.from({ length: 8 }, () => ({ ln: [], c: [], k: [] })) };
  (BUILDERS[id] || BUILDERS.girih)(s);
  const j = (a) => a.join('');
  return {
    ln: j(s.ln), c: j(s.c), k: j(s.k), tl: j(s.tl), t: j(s.t),
    rings: id === 'girih' ? s.rings.map(r => ({ ln: j(r.ln), c: j(r.c), k: j(r.k) })) : [],
  };
}
