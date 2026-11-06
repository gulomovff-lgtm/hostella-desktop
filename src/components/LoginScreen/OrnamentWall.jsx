import React, { useEffect, useMemo, useState } from 'react';
import { buildOrnament, pickOrnament, ORN_W, ORN_H } from './ornaments';

/**
 * Левая половина экрана входа: орнамент (случайный из семи при каждом
 * открытии), логотип и подпись. Появление одно и короткое; через PLAY_MS
 * класс play снимается — на экране не остаётся ни одной анимации, и в простое
 * касса ничего не перерисовывает.
 */
const PLAY_MS = 3200;
const LAST_KEY = 'hostella_login_ornament';

export default function OrnamentWall({ logoSrc, motto, className = '' }) {
  // Узор выбирается один раз на открытие экрана; прошлый не повторяем подряд
  const orn = useMemo(() => {
    let prev = '';
    try { prev = localStorage.getItem(LAST_KEY) || ''; } catch { /* приватный режим */ }
    const o = pickOrnament(prev);
    try { localStorage.setItem(LAST_KEY, o.id); } catch { /* приватный режим */ }
    return o;
  }, []);
  const paths = useMemo(() => buildOrnament(orn.id), [orn.id]);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setPlaying(false), PLAY_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`hl-wall reveal-${orn.reveal}${playing ? ' play' : ''} ${className}`} data-ornament={orn.id}>
      <div className="hl-orn">
        <svg viewBox={`0 0 ${ORN_W} ${ORN_H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g className="hl-tiles">
            {paths.tl && <path className="tl" d={paths.tl} />}
            {paths.t && <path className="tl t" d={paths.t} />}
          </g>
          {paths.rings.length > 0 ? paths.rings.map((r, i) => (
            <g key={i} style={{ '--d': `${0.15 + i * 0.17}s` }}>
              {r.k && <path className="ln k" d={r.k} pathLength="1" />}
              {r.ln && <path className="ln" d={r.ln} pathLength="1" />}
              {r.c && <path className="ln c" d={r.c} pathLength="1" />}
            </g>
          )) : (<>
            {paths.k && <path className="ln k" d={paths.k} />}
            {paths.ln && <path className="ln" d={paths.ln} />}
            {paths.c && <path className="ln c" d={paths.c} />}
          </>)}
        </svg>
      </div>
      {/* Шторки появления — HTML-слои, двигаются transform'ом (видеокарта) */}
      {playing && <><div className="hl-cover a" /><div className="hl-cover b" /></>}
      <div className="hl-vignette" />
      <div className="hl-halo" />
      <div className="hl-emblem">
        <img src={logoSrc} alt="Hostella" loading="eager" decoding="async" />
        <div className="hl-sheen" />
        {motto && <div className="hl-motto">{motto}</div>}
      </div>
    </div>
  );
}
