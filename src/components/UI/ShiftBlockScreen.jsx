import React, { useState, useEffect, useRef } from 'react';
import TRANSLATIONS from '../../constants/translations';

const HOSTEL_NAMES = { hostel1: 'Хостел №1', hostel2: 'Хостел №2' };

const ANIM_CSS = `
@keyframes sbLockIn{0%{transform:translate(-50%,-50%) scale(0) rotate(-200deg);opacity:0}100%{transform:translate(-50%,-50%) scale(1) rotate(0deg);opacity:1}}
@keyframes sbLockShake{0%,100%{transform:translate(-50%,-50%) rotate(0)}15%{transform:translate(calc(-50% - 12px),-50%) rotate(-4deg)}30%{transform:translate(calc(-50% + 12px),-50%) rotate(4deg)}45%{transform:translate(calc(-50% - 8px),-50%) rotate(-2.5deg)}60%{transform:translate(calc(-50% + 8px),-50%) rotate(2.5deg)}75%{transform:translate(calc(-50% - 4px),-50%)}90%{transform:translate(calc(-50% + 4px),-50%)}}
@keyframes sbLockOut{0%{transform:translate(-50%,-50%) scale(1);opacity:1;filter:blur(0px)}40%{transform:translate(-50%,-50%) scale(1.12);opacity:.9;filter:blur(0px)}100%{transform:translate(-50%,-50%) scale(0.08);opacity:0;filter:blur(14px)}}
@keyframes sbCardIn{0%{transform:translate(-50%,-50%) scale(0.05);opacity:0;filter:blur(8px)}60%{transform:translate(-50%,-50%) scale(1.03);opacity:1;filter:blur(0px)}100%{transform:translate(-50%,-50%) scale(1);opacity:1;filter:blur(0px)}}
@keyframes sbGlow{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.12)}}
@keyframes sbRing{0%{transform:translate(-50%,-50%) scale(0.2);opacity:.8}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}
@keyframes sbSpark{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--sbTx),var(--sbTy)) scale(0);opacity:0}}
@keyframes sbTopBar{0%{background-position:0%}100%{background-position:200%}}
@keyframes sbArrow{0%,100%{transform:translateX(0)}50%{transform:translateX(5px)}}
@keyframes sbBg{0%,100%{opacity:.7}50%{opacity:1}}
`;

const ShiftBlockScreen = ({ activeShift, activeUser, currentUser, onLogout, onSwitchHostel, myOtherActiveShiftHostelId, lang = 'ru' }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] ?? k;

    const [elapsed, setElapsed] = useState('');
    useEffect(() => {
        const calc = () => {
            const ms = Date.now() - new Date(activeShift.startTime).getTime();
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            setElapsed(h > 0 ? `${h}ч ${m}м` : `${m}м`);
        };
        calc();
        const id = setInterval(calc, 60000);
        return () => clearInterval(id);
    }, [activeShift.startTime]);

    const startStr = new Date(activeShift.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date(activeShift.startTime).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });

    // ── Animation state ──────────────────────────────────────────────
    const [lockPhase, setLockPhase]       = useState('hidden');   // hidden|entering|idle|shaking|exiting
    const [cardPhase, setCardPhase]       = useState('hidden');   // hidden|entering|visible
    const [armAngle, setArmAngle]         = useState(55);
    const [isRed, setIsRed]               = useState(false);
    const [statusVisible, setStatusVisible] = useState(false);
    const [statusText, setStatusText]     = useState('Проверка доступа...');
    const [revealed, setRevealed]         = useState(new Set());
    const [sparks, setSparks]             = useState([]);
    const [rings, setRings]               = useState([]);

    const lockRef  = useRef(null);
    const rafRef   = useRef(null);
    const timers   = useRef([]);

    useEffect(() => {
        const styleEl = document.createElement('style');
        styleEl.textContent = ANIM_CSS;
        document.head.appendChild(styleEl);

        const af = (ms, fn) => { const id = setTimeout(fn, ms); timers.current.push(id); };

        af(100,  () => setLockPhase('entering'));
        af(850,  () => setLockPhase('idle'));
        af(1000, () => setStatusVisible(true));

        af(1800, () => {
            const from = 55, to = 0, dur = 480, startT = performance.now();
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            const frame = (now) => {
                const p = Math.min(1, (now - startT) / dur);
                const ease = p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2;
                setArmAngle(from + (to - from) * ease);
                if (p < 1) { rafRef.current = requestAnimationFrame(frame); }
                else { rafRef.current = null; setArmAngle(0); }
            };
            rafRef.current = requestAnimationFrame(frame);
        });

        af(2300, () => { setIsRed(true); setStatusText('Доступ запрещён!'); });

        af(2600, () => {
            if (lockRef.current) {
                const rect = lockRef.current.getBoundingClientRect();
                const cx = rect.left + rect.width / 2;
                const cy = rect.top  + rect.height / 2 - 20;
                const cols = ['#ef4444', '#f97316', '#fbbf24', '#fb7185'];
                setSparks(Array.from({ length: 18 }, (_, i) => {
                    const ang  = (Math.PI * 2 / 18) * i + (Math.random() - .5) * 0.4;
                    const dist = 30 + Math.random() * 55;
                    return { id: i, tx: Math.cos(ang) * dist, ty: Math.sin(ang) * dist,
                             d: .35 + Math.random() * .4, x: cx, y: cy, color: cols[i % 4] };
                }));
            }
            setRings([{ id: 0, delay: 0 }, { id: 1, delay: 120 }, { id: 2, delay: 240 }]);
            setLockPhase('shaking');
        });

        af(3200, () => setLockPhase('idle'));
        af(3300, () => { setStatusVisible(false); setLockPhase('exiting'); });
        af(3800, () => setCardPhase('entering'));
        af(4300, () => setCardPhase('visible'));

        const seqKeys   = ['ci','badge','ct','cs','r1','r2','r3','r4','bs','bo'];
        const seqDelays = [ 60, 110, 160, 200, 250, 300, 350, 400, 460, 510];
        seqKeys.forEach((key, i) => af(3800 + seqDelays[i], () => setRevealed(p => new Set([...p, key]))));

        return () => {
            timers.current.forEach(clearTimeout);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            styleEl.remove();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Colour scheme ────────────────────────────────────────────────
    const clr = isRed
        ? { shackle: 'rgba(239,68,68,.9)', body: 'rgba(239,68,68,.6)', fill: 'rgba(239,68,68,.45)',
            glow: 'drop-shadow(0 0 28px rgba(239,68,68,.75))', glowBg: 'radial-gradient(circle,rgba(239,68,68,.28),transparent 70%)', status: 'rgba(239,68,68,.85)' }
        : { shackle: 'rgba(94,234,212,.9)', body: 'rgba(94,234,212,.6)', fill: 'rgba(94,234,212,.45)',
            glow: 'drop-shadow(0 0 22px rgba(94,234,212,.5))', glowBg: 'radial-gradient(circle,rgba(94,234,212,.22),transparent 70%)', status: 'rgba(94,234,212,.7)' };

    // ── Phase → inline style ─────────────────────────────────────────
    const LOCK_STYLE = {
        hidden:   { transform: 'translate(-50%,-50%) scale(0) rotate(-200deg)', opacity: 0 },
        entering: { animation: 'sbLockIn .75s cubic-bezier(0.34,1.56,0.64,1) forwards', opacity: 0 },
        idle:     { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        shaking:  { animation: 'sbLockShake .55s ease-in-out forwards' },
        exiting:  { animation: 'sbLockOut .55s cubic-bezier(0.4,0,0.2,1) forwards' },
    };
    const CARD_STYLE = {
        hidden:   { transform: 'translate(-50%,-50%) scale(0.05)', opacity: 0, pointerEvents: 'none' },
        entering: { animation: 'sbCardIn .45s cubic-bezier(0.34,1.56,0.64,1) forwards', opacity: 0 },
        visible:  { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
    };

    const rv = (key) => revealed.has(key);

    const slideUp  = (key) => ({ opacity: rv(key) ? 1 : 0, transform: rv(key) ? 'translateY(0)' : 'translateY(10px)', transition: 'opacity .3s ease, transform .3s ease' });
    const slideX   = (key, dx = -10) => ({ opacity: rv(key) ? 1 : 0, transform: rv(key) ? 'translateX(0)' : `translateX(${dx}px)`, transition: 'opacity .3s ease, transform .3s ease' });
    const fadeDown = (key) => ({ opacity: rv(key) ? 1 : 0, transform: rv(key) ? 'translateY(0)' : 'translateY(-8px)', transition: 'opacity .3s ease, transform .3s ease' });

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: isRed ? '#0f0202' : '#010d0b', overflow: 'hidden', transition: 'background 0.6s ease' }}>

            {/* Background blobs */}
            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', animation: 'sbBg 7s ease-in-out infinite',
                opacity: isRed ? 0 : 1, transition: 'opacity 0.6s ease',
                background: 'radial-gradient(ellipse 70% 50% at 25% 25%,rgba(94,234,212,.09),transparent),radial-gradient(ellipse 60% 50% at 75% 75%,rgba(52,211,153,.07),transparent)' }}/>

            {/* Red danger overlay */}
            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none',
                opacity: isRed ? 1 : 0, transition: 'opacity 0.6s ease',
                background: 'radial-gradient(ellipse 80% 60% at 50% 40%,rgba(239,68,68,.18),transparent),radial-gradient(ellipse 60% 50% at 20% 80%,rgba(185,28,28,.12),transparent)' }}/>

            {/* Sparks */}
            {sparks.map(s => (
                <div key={s.id} style={{ position: 'fixed', pointerEvents: 'none', borderRadius: '50%', width: 7, height: 7,
                    left: s.x, top: s.y, background: s.color,
                    '--sbTx': s.tx + 'px', '--sbTy': s.ty + 'px',
                    animation: `sbSpark ${s.d}s ease-out forwards` }}/>
            ))}

            <div style={{ position: 'relative', width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

                {/* ── LOCK ── */}
                <div ref={lockRef} style={{ position: 'absolute', top: '50%', left: '50%',
                    width: 200, height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    ...LOCK_STYLE[lockPhase] }}>

                    {/* Glow blob */}
                    <div style={{ position: 'absolute', inset: -40, borderRadius: '50%', background: clr.glowBg,
                        animation: 'sbGlow 2.5s ease-in-out infinite', pointerEvents: 'none', transition: 'background .45s' }}/>

                    {/* SVG padlock */}
                    <svg viewBox="0 0 100 110" style={{ width: 170, height: 170, filter: clr.glow, overflow: 'visible', transition: 'filter .45s ease' }}>
                        <rect x="16" y="51" width="68" height="48" rx="9" fill="rgba(18,6,40,.9)"/>
                        <path d="M 28,53 L 28,33 Q 28,11 50,11 Q 72,11 72,33"
                            stroke={clr.shackle} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round"
                            style={{ transition: 'stroke .45s ease' }}/>
                        <line x1="72" y1="33" x2="72" y2="53"
                            stroke={clr.shackle} strokeWidth="9" strokeLinecap="round"
                            transform={`rotate(${armAngle}, 72, 33)`}
                            style={{ transition: 'stroke .45s ease' }}/>
                        <rect x="15" y="50" width="70" height="50" rx="10"
                            fill="none" stroke={clr.body} strokeWidth="2" style={{ transition: 'stroke .45s ease' }}/>
                        <circle cx="50" cy="72" r="7" fill={clr.fill} style={{ transition: 'fill .45s ease' }}/>
                        <path d="M 46.5,72 L 46.5,84 Q 46.5,86.5 50,86.5 Q 53.5,86.5 53.5,84 L 53.5,72"
                            fill={clr.fill} style={{ transition: 'fill .45s ease' }}/>
                    </svg>

                    {/* Status text */}
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.13em', textTransform: 'uppercase',
                        color: clr.status, marginTop: 16, opacity: statusVisible ? 1 : 0, transition: 'opacity .35s, color .4s' }}>
                        {statusText}
                    </div>

                    {/* Ring pulses */}
                    {rings.map(ring => (
                        <div key={ring.id} style={{ position: 'absolute', top: '50%', left: '50%',
                            borderRadius: '50%', width: 160, height: 160,
                            border: '2px solid rgba(239,68,68,.5)', pointerEvents: 'none',
                            animation: `sbRing .65s ease-out ${ring.delay}ms forwards` }}/>
                    ))}
                </div>

                {/* ── INFO CARD ── */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', width: 310,
                    background: 'rgba(2,18,15,.96)',
                    border: `1.5px solid ${isRed ? 'rgba(239,68,68,.55)' : 'rgba(94,234,212,.35)'}`,
                    borderRadius: 20, overflow: 'hidden',
                    boxShadow: isRed
                        ? '0 0 0 1px rgba(239,68,68,.12),0 0 60px rgba(239,68,68,.18),0 40px 80px rgba(0,0,0,.65)'
                        : '0 0 0 1px rgba(94,234,212,.07),0 0 60px rgba(94,234,212,.10),0 40px 80px rgba(0,0,0,.65)',
                    transition: 'border-color 0.5s ease, box-shadow 0.5s ease',
                    ...CARD_STYLE[cardPhase] }}>

                    {/* Animated top bar */}
                    <div style={{ height: 4, background: 'linear-gradient(90deg,#134e4a,#5eead4,#99f6e4,#5eead4,#134e4a)',
                        backgroundSize: '200%', animation: 'sbTopBar 3s linear infinite' }}/>

                    <div style={{ padding: '20px 20px 12px' }}>

                        {/* Lock icon */}
                        <div style={{ width: 50, height: 50, borderRadius: 13, fontSize: 22,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(239,68,68,.12)', border: '1.5px solid rgba(239,68,68,.35)', marginBottom: 12,
                            opacity: rv('ci') ? 1 : 0,
                            transform: rv('ci') ? 'scale(1) rotate(0deg)' : 'scale(0) rotate(-200deg)',
                            transition: 'opacity .4s ease, transform .5s cubic-bezier(0.34,1.56,0.64,1)' }}>🔒</div>

                        {/* Badge */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 10px', borderRadius: 999, marginBottom: 10,
                            fontSize: 9.5, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase',
                            background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#fca5a5',
                            ...fadeDown('badge') }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444',
                                animation: 'sbGlow .9s infinite', display: 'inline-block' }}/>
                            ДОСТУП ЗАБЛОКИРОВАН
                        </div>

                        {/* Title */}
                        <div style={{ fontSize: 21, fontWeight: 900, color: '#fca5a5', marginBottom: 4, letterSpacing: '-.02em', ...slideX('ct') }}>
                            Смена занята
                        </div>

                        {/* Subtitle */}
                        <div style={{ fontSize: 11, color: '#7f1d1d', lineHeight: 1.65, marginBottom: 12, ...slideX('cs') }}>
                            В {HOSTEL_NAMES[activeShift.hostelId] || activeShift.hostelId} уже работает другой кассир.<br/>
                            Ваш вход запрещён до завершения смены.
                        </div>

                        <div style={{ height: 1, background: 'rgba(239,68,68,.1)', marginBottom: 10 }}/>

                        {/* Info rows */}
                        {[
                            { key: 'r1', label: 'Кассир',       value: activeUser?.name || t('cashier2') },
                            { key: 'r2', label: 'Хостел',       value: HOSTEL_NAMES[activeShift.hostelId] || activeShift.hostelId },
                            { key: 'r3', label: 'Начало смены', value: `${startStr} · ${dateStr}` },
                            { key: 'r4', label: 'Статус',       value: `● Активна${elapsed ? ` (${elapsed})` : ''}`, green: true },
                        ].map(({ key, label, value, green }) => (
                            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '8px 12px', borderRadius: 9, marginBottom: 6,
                                background: 'rgba(239,68,68,.04)', border: '1px solid rgba(239,68,68,.09)',
                                ...slideX(key, -14) }}>
                                <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: '#7f1d1d' }}>{label}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: green ? '#6ee7b7' : '#fca5a5' }}>{value}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ padding: '0 20px 18px' }}>
                        {/* Switch hostel button */}
                        {myOtherActiveShiftHostelId && onSwitchHostel && (
                            <button onClick={() => onSwitchHostel(myOtherActiveShiftHostelId)}
                                style={{ width: '100%', padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    fontSize: 12.5, fontWeight: 800, borderRadius: 11,
                                    background: 'rgba(94,234,212,.08)', border: '1.5px solid rgba(94,234,212,.4)', color: '#99f6e4',
                                    ...slideUp('bs') }}>
                                <span>→ Перейти в {HOSTEL_NAMES[myOtherActiveShiftHostelId] || myOtherActiveShiftHostelId}</span>
                                <span style={{ animation: 'sbArrow 1s ease-in-out infinite' }}>↗</span>
                            </button>
                        )}

                        {/* Logout */}
                        <button onClick={onLogout}
                            style={{ width: '100%', padding: 11, borderRadius: 11, cursor: 'pointer',
                                fontSize: 12.5, fontWeight: 800, border: 'none',
                                background: 'linear-gradient(135deg,#0f766e,#14b8a6)', color: '#fff',
                                ...slideUp('bo') }}>
                            🚪 {t('logout2')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShiftBlockScreen;
