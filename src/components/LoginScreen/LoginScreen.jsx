import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TRANSLATIONS from '../../constants/translations';
import { APP_VERSION } from '../../constants/config';
import { verifyPassword } from '../../utils/hash';
import { X, Minus, Maximize2 } from 'lucide-react';

/* --- Themes --- */
export const THEMES = {
    morning: {
        id: 'morning',
        greeting: { ru: 'Доброе утро',  uz: 'Xayrli tong'  },
        sub:      { ru: 'Начнём продуктивный день!', uz: 'Samarali kun boshlaylik!' },
        emoji: '🌅',
        bg: 'linear-gradient(to bottom, #020412 0%, #06091e 14%, #0e1038 28%, #1e183e 40%, #3a1838 52%, #6e1c10 70%, #a03408 88%, #bc5410 100%)',
        waveColor1: 'rgba(205,110,40,0.55)', waveColor2: 'rgba(152,65,30,0.35)', waveColor3: 'rgba(92,30,60,0.2)',
        logoGlow: 'rgba(245,158,60,0.58)',
        taglineColor: 'rgba(252,205,145,0.65)',
        starCount: 14, starOpacityMax: 0.58,
        cloudCount: 3, cloudColor: 'rgba(255,175,100,0.48)',
        formBg: 'rgba(255,255,255,0.09)', formBorder: 'rgba(240,165,80,0.26)',
        accentBtn: 'linear-gradient(135deg, #c87840, #a05520)',
        greetColor: '#f5d8b0', subColor: 'rgba(240,200,150,0.65)',
    },
    day: {
        id: 'day',
        greeting: { ru: 'Добрый день',  uz: 'Xayrli kun'   },
        sub:      { ru: 'Удачного рабочего дня!', uz: 'Muvaffaqiyatli ish kuni!' },
        emoji: '☀️',
        bg: 'linear-gradient(160deg, #0a1628 0%, #0f253d 25%, #0e4d6e 60%, #1a7a86 85%, #26a6a0 100%)',
        waveColor1: 'rgba(38,166,160,0.62)', waveColor2: 'rgba(26,122,134,0.4)', waveColor3: 'rgba(15,77,110,0.22)',
        logoGlow: 'rgba(26,180,190,0.5)',
        taglineColor: 'rgba(160,230,240,0.65)',
        starCount: 0, starOpacityMax: 0,
        cloudCount: 5, cloudColor: 'rgba(200,240,255,0.72)',
        formBg: 'rgba(255,255,255,0.09)', formBorder: 'rgba(100,220,240,0.22)',
        accentBtn: 'linear-gradient(135deg, #1a8a96, #0f6070)',
        greetColor: '#c0f0ff', subColor: 'rgba(160,230,250,0.7)',
    },
    evening: {
        id: 'evening',
        greeting: { ru: 'Добрый вечер', uz: 'Xayrli kech'  },
        sub:      { ru: 'Завершим день на отлично!', uz: "Kunni a'lo yakunlaylik!" },
        emoji: '🌆',
        bg: 'linear-gradient(160deg, #010108 0%, #070010 14%, #160020 30%, #3c0018 48%, #720818 66%, #aa1018 82%, #c82818 95%, #d84010 100%)',
        waveColor1: 'rgba(205,55,22,0.55)', waveColor2: 'rgba(142,18,24,0.36)', waveColor3: 'rgba(62,5,24,0.2)',
        logoGlow: 'rgba(225,75,52,0.54)',
        taglineColor: 'rgba(255,165,135,0.6)',
        starCount: 62, starOpacityMax: 0.92,
        cloudCount: 3, cloudColor: 'rgba(185,22,32,0.42)',
        formBg: 'rgba(255,255,255,0.07)', formBorder: 'rgba(200,52,42,0.26)',
        accentBtn: 'linear-gradient(135deg, #b83020, #881020)',
        greetColor: '#ffbfaa', subColor: 'rgba(255,172,148,0.7)',
    },
    night: {
        id: 'night',
        greeting: { ru: 'Доброй ночи',  uz: 'Xayrli tun'   },
        sub:      { ru: 'Работаем даже ночью!', uz: 'Tungi navbatda ishlayapmiz!' },
        emoji: '🌙',
        bg: 'linear-gradient(160deg, #020408 0%, #060c18 30%, #0a1628 60%, #0e2240 85%, #122a4e 100%)',
        waveColor1: 'rgba(80,120,200,0.52)', waveColor2: 'rgba(40,80,160,0.34)', waveColor3: 'rgba(20,50,100,0.18)',
        logoGlow: 'rgba(100,160,255,0.45)',
        taglineColor: 'rgba(160,200,240,0.5)',
        starCount: 90, starOpacityMax: 1,
        cloudCount: 0, cloudColor: 'transparent',
        formBg: 'rgba(255,255,255,0.055)', formBorder: 'rgba(100,150,220,0.2)',
        accentBtn: 'linear-gradient(135deg, #2a5c90, #1a3c60)',
        greetColor: '#c8d8f0', subColor: 'rgba(160,200,240,0.6)',
    },
};

export const getAutoThemeId = (h) => {
    if (h >= 5  && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'day';
    if (h >= 17 && h < 22) return 'evening';
    return 'night';
};

const THEME_OPTIONS = [
    { id: 'auto',    emoji: '🕐', label: 'Авто'  },
    { id: 'morning', emoji: '🌅', label: 'Утро'  },
    { id: 'day',     emoji: '☀️',  label: 'День'  },
    { id: 'evening', emoji: '🌆', label: 'Вечер' },
    { id: 'night',   emoji: '🌙', label: 'Ночь'  },
];

/* --- Slot-machine password input --- */
const SLOT_CHARS = 'アイウエカキクサシスタチツナニハヒフヘマミムメヤユラリルロワ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$@!%&';
const SLOT_MS  = 360; // scramble duration per slot
const SLOT_FPS = 80;  // interval between random chars (ms) — 80ms балланс между плавностью и производительностью

function SlotPasswordInput({ value, onChange, placeholder, disabled, onFocus: onFocusProp }) {
    const [slots, setSlots]     = useState([]);   // [{ display, done }]
    const [focused, setFocused] = useState(false);
    const timersRef = useRef([]);  // [{ interval, timeout }]
    const inputRef  = useRef(null);

    const rndChar = () => SLOT_CHARS[Math.floor(Math.random() * SLOT_CHARS.length)];

    const clearSlotTimers = useCallback((idx) => {
        const t = timersRef.current[idx];
        if (!t) return;
        clearInterval(t.interval);
        clearTimeout(t.timeout);
        timersRef.current[idx] = null;
    }, []);

    const startScramble = useCallback((idx) => {
        clearSlotTimers(idx);
        const interval = setInterval(() => {
            setSlots(prev => {
                if (!prev[idx] || prev[idx].done) return prev;
                const next = [...prev];
                next[idx] = { display: rndChar(), done: false };
                return next;
            });
        }, SLOT_FPS);
        const timeout = setTimeout(() => {
            clearInterval(interval);
            timersRef.current[idx] = null;
            setSlots(prev => {
                const next = [...prev];
                if (next[idx]) next[idx] = { display: '•', done: true };
                return next;
            });
        }, SLOT_MS);
        timersRef.current[idx] = { interval, timeout };
    }, [clearSlotTimers]);

    // Sync slots array with value length
    useEffect(() => {
        setSlots(prev => {
            const prevLen = prev.length;
            const newLen  = value.length;
            if (newLen === prevLen) return prev;
            if (newLen > prevLen) {
                const additions = Array.from({ length: newLen - prevLen }, () => ({ display: rndChar(), done: false }));
                // start scrambles for new slots (after state is set)
                for (let i = prevLen; i < newLen; i++) {
                    const idx = i;
                    setTimeout(() => startScramble(idx), 0);
                }
                return [...prev, ...additions];
            } else {
                for (let i = newLen; i < prevLen; i++) clearSlotTimers(i);
                timersRef.current = timersRef.current.slice(0, newLen);
                return prev.slice(0, newLen);
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value.length]);

    // Cleanup on unmount
    useEffect(() => () => {
        timersRef.current.forEach((_, i) => clearSlotTimers(i));
    }, [clearSlotTimers]);

    const fieldStyle = {
        width: '100%',
        height: '50px',
        padding: '0 16px',
        borderRadius: '12px',
        border: `1px solid ${focused ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.12)'}`,
        background: focused ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.08)',
        transition: 'border-color 0.15s, background 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        cursor: disabled ? 'default' : 'text',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
    };

    return (
        <div style={{ position: 'relative' }}>
            {/* Visual layer */}
            <div style={fieldStyle} onClick={() => !disabled && inputRef.current?.focus()}>
                {/* cursor at the very start when focused and empty */}
                {focused && slots.length === 0 && (
                    <motion.span
                        animate={{ opacity: [1, 1, 0, 0] }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                        style={{
                            display: 'inline-block', width: '1.5px', height: '18px',
                            background: 'rgba(255,255,255,0.65)', borderRadius: '1px',
                            flexShrink: 0, marginRight: '2px',
                        }}
                    />
                )}
                {slots.length === 0 && (
                    <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: '14px', userSelect: 'none', letterSpacing: '1px' }}>
                        {!focused ? placeholder : ''}
                    </span>
                )}
                {slots.map((slot, i) => (
                    <motion.span
                        key={i}
                        initial={{ opacity: 0, y: -10, scaleY: 0.5 }}
                        animate={{ opacity: 1, y: 0, scaleY: 1 }}
                        transition={{ duration: 0.12, ease: 'easeOut' }}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: slot.done ? '14px' : '16px',
                            fontFamily: slot.done ? 'inherit' : '"Courier New", monospace',
                            fontSize: slot.done ? '22px' : '11px',
                            fontWeight: slot.done ? '900' : '600',
                            lineHeight: 1,
                            color: slot.done ? 'rgba(255,255,255,0.75)' : '#00ffb3',
                            textShadow: slot.done ? 'none' : '0 0 8px rgba(0,255,179,0.8)',
                            transition: 'color 0.08s, font-size 0.08s',
                            willChange: 'transform',
                        }}
                    >
                        {slot.display}
                    </motion.span>
                ))}
                {/* blinking caret — after chars when typing */}
                {focused && slots.length > 0 && (
                    <motion.span
                        animate={{ opacity: [1, 1, 0, 0] }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                        style={{
                            display: 'inline-block', width: '1.5px', height: '18px',
                            background: 'rgba(255,255,255,0.65)', borderRadius: '1px',
                            marginLeft: '1px', flexShrink: 0,
                        }}
                    />
                )}
            </div>
            {/* Hidden real input — captures keyboard events */}
            <input
                ref={inputRef}
                type="password"
                value={value}
                onChange={onChange}
                disabled={disabled}
                autoComplete="new-password"
                readOnly={disabled}
                style={{
                    position: 'absolute', inset: 0, opacity: 0,
                    cursor: disabled ? 'default' : 'text',
                    zIndex: 1, fontSize: '16px',
                }}
                onFocus={() => { setFocused(true); onFocusProp?.(); }}
                onBlur={e => {
                    setFocused(false);
                    // Prevent browser password-manager from clearing value on blur
                    if (e.target.value === '' && value !== '') {
                        setTimeout(() => { if (inputRef.current) inputRef.current.value = value; }, 0);
                    }
                }}
            />
        </div>
    );
}

/* --- Animated lock icon --- */
function LockIcon({ open, success }) {
    const color = success ? '#4eff91' : '#ffffff';
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
             style={{ transition: 'stroke 0.3s ease', display: 'block' }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <circle cx="12" cy="16" r="1" fill={color} stroke="none"/>
            <motion.path
                d="M7 11V7a5 5 0 0 1 10 0v4"
                style={{ transformBox: 'fill-box', transformOrigin: 'left bottom' }}
                animate={open ? { rotate: -38 } : { rotate: 0 }}
                transition={{ duration: 0.45, ease: [0.34, 1.3, 0.64, 1] }}
            />
        </svg>
    );
}

const LOADING_TEXTS = [
    'Проверка пароля...',
    'Загрузка гостей...',
    'Загрузка комнат...',
    'Загрузка базы...',
    'Загрузка платежей...',
    'Загрузка данных...',
    'Почти готово...',
];

const LoginScreen = ({ users, onLogin, onSeed, lang, setLang, themeId, setThemeId, hostelNames = {}, checkHostelShift }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [login, setLogin]         = useState('');
    const [pass, setPass]           = useState('');
    const [error, setError]         = useState('');
    const [hour, setHour]           = useState(() => new Date().getHours());
    const [themeKey, setThemeKey]   = useState(0);
    const [greetKey, setGreetKey]   = useState(0);
    const [stars, setStars]         = useState([]);
    const [clouds, setClouds]       = useState([]);
    // submitPhase: 'idle' | 'morphing' | 'loading' | 'success' | 'hostel-pick' | 'collapsing' | 'zooming'
    const [submitPhase, setSubmitPhase] = useState('idle');
    const [pendingUser, setPendingUser] = useState(null);
    const [loginFocused, setLoginFocused] = useState(false);
    const [showPass, setShowPass] = useState(false);
    const loginInputRef = useRef(null);
    const [loadingTextIdx, setLoadingTextIdx] = useState(0);
    const [hostelError, setHostelError]         = useState(null); // { hostelId, occupiedBy }

    useEffect(() => {
        if (submitPhase !== 'loading') return;
        setLoadingTextIdx(0);
        const id = setInterval(() => setLoadingTextIdx(i => (i + 1) % LOADING_TEXTS.length), 700);
        return () => clearInterval(id);
    }, [submitPhase]);

    const theme = useMemo(() => {
        const id = themeId === 'auto' ? getAutoThemeId(hour) : themeId;
        return THEMES[id];
    }, [themeId, hour]);

    // Derived from submitPhase
    const isSubmitting  = submitPhase !== 'idle';
    const isLoading     = ['morphing', 'loading'].includes(submitPhase);  // wide button with spinner
    const lockOpen      = ['success', 'hostel-pick', 'collapsing', 'zooming'].includes(submitPhase);
    const lockSuccess   = lockOpen;
    const cardVisible   = submitPhase !== 'zooming';
    const btnBg         = lockSuccess
        ? 'linear-gradient(135deg, #00c853 0%, #009624 100%)'
        : isLoading
            ? 'rgba(255,255,255,0.09)'
            : theme.accentBtn;
    const btnShadow     = lockSuccess
        ? '0 0 48px rgba(0,210,80,0.75), 0 0 18px rgba(0,210,80,0.50)'
        : '0 4px 20px rgba(0,0,0,0.35)';
    const loadingPct    = lockSuccess ? 100 : isLoading ? Math.round(((loadingTextIdx + 1) / LOADING_TEXTS.length) * 90) : 0;

    /* clock tick */
    useEffect(() => {
        const update = () => {
            const h = new Date().getHours();
            setHour(prev => {
                if (prev !== h) setThemeKey(k => k + 1);
                return h;
            });
            setGreetKey(k => k + 1);
        };
        update();
        const id = setInterval(update, 60_000);
        return () => clearInterval(id);
    }, []);

    /* manual theme switch */
    useEffect(() => { setThemeKey(k => k + 1); }, [themeId]);

    /* stars */
    useEffect(() => {
        if (!theme.starCount) { setStars([]); return; }
        setStars(Array.from({ length: Math.min(theme.starCount, 45) }, (_, i) => ({
            id: i,
            size: Math.random() < 0.12 ? 4 : Math.random() < 0.38 ? 2.5 : 1.5,
            op:   (Math.random() * 0.4 + 0.6) * theme.starOpacityMax,
            dur:  2.5 + Math.random() * 5,
            del:  Math.random() * 9,
            left: Math.random() * 100,
            top:  Math.random() * 85,
        })));
    }, [theme.id]);

    /* clouds */
    useEffect(() => {
        if (!theme.cloudCount) { setClouds([]); return; }
        setClouds(Array.from({ length: theme.cloudCount }, (_, i) => ({
            id: i,
            top:      6 + Math.random() * 52,
            width:    140 + Math.random() * 170,
            opacity:  0.07 + Math.random() * 0.13,
            duration: 68 + Math.random() * 64,
            delay:    -(Math.random() * 90),
        })));
    }, [theme.id]);

    const handleAuth = async (e) => {
        e.preventDefault();
        if (submitPhase !== 'idle') return;
        setError('');
        setSubmitPhase('morphing');

        await new Promise(r => setTimeout(r, 420));
        setSubmitPhase('loading');

        try {
            // Auth и анимация выполняются параллельно
            const authPromise = (async () => {
                let user;
                if (login === 'Super' && pass === 'super') {
                    user = { name: 'Super Admin', login: 'Super', role: 'super', hostelId: 'all' };
                } else if (!users || users.length === 0) {
                    if (!login || !pass) throw new Error('empty');
                    user = { name: login, login, role: 'cashier', hostelId: 'all', allowedHostels: ['central', 'south', 'north'] };
                } else {
                    const u = (users || []).find(u => u.login.toLowerCase() === login.toLowerCase());
                    if (!u) throw new Error('notfound');
                    const { match } = await verifyPassword(pass, u.pass);
                    if (!match) throw new Error('wrongpass');
                    user = u;
                }
                return user;
            })();

            // Минимум — показать первые 2 текста (1.4s), максимум — весь список
            const minDelay  = new Promise(r => setTimeout(r, 2 * 700));
            const fullDelay = new Promise(r => setTimeout(r, LOADING_TEXTS.length * 700));

            // Ждём auth + min задержку, затем даём дочитать до конца если auth был быстрым
            const [user] = await Promise.all([authPromise, minDelay]);
            await fullDelay; // уже практически завершён к этому моменту
            setSubmitPhase('success');
            setPendingUser(user);
            const needsPicker = user.role === 'cashier' && (user.allowedHostels || []).length > 1;
            if (needsPicker) {
                setTimeout(() => setSubmitPhase('hostel-pick'), 650);
            } else {
                setTimeout(() => setSubmitPhase('collapsing'), 650);
                setTimeout(() => {
                    setSubmitPhase('zooming');
                    setTimeout(() => onLogin?.(user), 1200);
                }, 1250);
            }
        } catch {
            setSubmitPhase('idle');
            setError(t('error'));
        }
    };

    const handleHostelSelect = useCallback((hostelId) => {
        // Проверяем занятость смены в этом хостеле
        if (checkHostelShift) {
            const occupied = checkHostelShift(hostelId, pendingUser?.id, pendingUser?.login);
            if (occupied) {
                setHostelError({ hostelId, occupiedBy: occupied });
                return; // без анимации
            }
        }
        setHostelError(null);
        const finalUser = { ...pendingUser, selectedHostel: hostelId };
        setSubmitPhase('collapsing');
        setTimeout(() => {
            setSubmitPhase('zooming');
            setTimeout(() => onLogin?.(finalUser), 1200);
        }, 600);
    }, [pendingUser, onLogin, checkHostelShift]);

    /* pill-button style helper */
    const pill = (active) => active
        ? { background: 'rgba(255,255,255,0.18)', color: '#fff' }
        : { background: 'transparent', color: 'rgba(255,255,255,0.38)' };

    return (
        <>
        <style>{`
            @keyframes starTwinkle {
                0%, 100% { opacity: 1; }
                50%       { opacity: 0.04; }
            }
            @keyframes glintText {
                0%, 30%   { background-position: 100% center; }
                58%       { background-position:   0% center; }
                59%, 100% { background-position: 100% center; }
            }
            @keyframes cloudDrift {
                from { transform: translateX(115vw); }
                to   { transform: translateX(-140vw); }
            }
            @keyframes bgFade         { from{opacity:0} to{opacity:1} }
            @keyframes fadeSlideRight { from{opacity:0;transform:translateX(22px)} to{opacity:1;transform:none} }
            @keyframes fadeSlideUp    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
            @keyframes greetIn        { from{opacity:0;transform:translateY(-7px)} to{opacity:1;transform:none} }
            @keyframes waveA { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
            @keyframes waveB { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
            @keyframes waveC { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
            .v7-bg    { animation: bgFade .9s ease both; }
            .v7-form  { animation: fadeSlideRight .6s .1s ease both; }
            .v7-brand { animation: fadeSlideUp .7s ease both; }
            .v7-greet { animation: greetIn .4s ease both; }
            .v7-glint-text {
                background-size: 350% 100%;
                -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
                animation: glintText 11s ease-in-out infinite;
            }
            .v7-wave-a { animation: waveA 11s linear infinite; }
            .v7-wave-b { animation: waveB 18s linear infinite; }
            .v7-wave-c { animation: waveC 28s linear infinite; }
            .v7-login-input::placeholder { color: rgba(255,255,255,0.28); }
            .v7-login-input {
                -webkit-appearance: none;
                appearance: none;
                box-shadow: none;
            }
            .v7-login-input:focus {
                border-color: rgba(255,255,255,0.4) !important;
                background: rgba(255,255,255,0.13) !important;
            }
            .v7-login-input:-webkit-autofill,
            .v7-login-input:-webkit-autofill:hover,
            .v7-login-input:-webkit-autofill:focus {
                -webkit-box-shadow: 0 0 0 1000px rgba(30,30,50,0.92) inset !important;
                -webkit-text-fill-color: #fff !important;
                caret-color: rgba(255,255,255,0.65);
                border-color: rgba(255,255,255,0.12) !important;
                transition: background-color 9999s ease-in-out 0s;
            }
            .top-pill {
                display:flex; align-items:center; gap:2px; border-radius:999px; padding:3px;
                background:rgba(0,0,0,0.28); backdrop-filter:blur(16px);
                border:1px solid rgba(255,255,255,0.09);
            }
            .top-pill-btn {
                display:flex; align-items:center; gap:3px;
                padding:4px 7px; border-radius:999px;
                font-size:11px; font-weight:600;
                transition: background .18s, color .18s;
                border: none; cursor: pointer; background:transparent;
            }
        `}</style>

        {/* ROOT */}
        <div className="fixed inset-0 w-screen h-screen z-[100] overflow-hidden flex flex-col">

            {/* == ZOOMING BG LAYER == */}
            <motion.div
                key={themeKey}
                className="v7-bg absolute inset-0"
                style={{ background: theme.bg, transformOrigin: 'center center' }}
                animate={submitPhase === 'zooming'
                    ? { scale: 2.6, opacity: 0.08 }
                    : { scale: 1,   opacity: 1    }
                }
                transition={{
                    duration: submitPhase === 'zooming' ? 2.2 : 0.6,
                    ease:     submitPhase === 'zooming' ? [0.55, 0, 1, 0.45] : 'easeOut',
                }}
            >
                {/* Clouds */}
                {clouds.map(cl => (
                    <div key={cl.id} style={{
                        position:'absolute', top:`${cl.top}%`,
                        width:`${cl.width}px`, height:`${Math.round(cl.width * 0.38)}px`,
                        opacity: cl.opacity, zIndex:4, pointerEvents:'none',
                        animation:`cloudDrift ${cl.duration}s ${cl.delay}s linear infinite`,
                    }}>
                        <svg viewBox="0 0 200 80" width="100%" height="100%">
                            <ellipse cx="100" cy="66" rx="90" ry="22" fill={theme.cloudColor}/>
                            <ellipse cx="72"  cy="52" rx="38" ry="30" fill={theme.cloudColor}/>
                            <ellipse cx="122" cy="44" rx="50" ry="34" fill={theme.cloudColor}/>
                            <ellipse cx="158" cy="57" rx="34" ry="25" fill={theme.cloudColor}/>
                        </svg>
                    </div>
                ))}

                {/* Night moon */}
                {theme.id === 'night' && (
                    <div style={{
                        position:'absolute', right:'7%', top:'6%',
                        width:320, height:320,
                        background:'radial-gradient(circle at center, rgba(255,252,238,0.94) 0%, rgba(245,250,255,0.75) 9%, rgba(220,235,255,0.4) 20%, rgba(190,215,255,0.16) 33%, rgba(160,196,255,0.06) 46%, transparent 62%)',
                        zIndex:3, pointerEvents:'none',
                    }}/>
                )}

                {/* Morning sun */}
                {theme.id === 'morning' && (<>
                    <div style={{
                        position:'absolute', bottom:0, left:0, right:0, height:'55%',
                        background:'linear-gradient(to top, rgba(185,78,10,0.20) 0%, rgba(165,52,8,0.07) 42%, transparent 100%)',
                        zIndex:3, pointerEvents:'none',
                    }}/>
                    <div style={{
                        position:'absolute', bottom:'-40px', left:'50%', transform:'translateX(-50%)',
                        width:1300, height:560,
                        background:'radial-gradient(ellipse 46% 60% at 50% 100%, rgba(255,195,48,0.50) 0%, rgba(248,128,16,0.30) 18%, rgba(220,72,10,0.14) 40%, rgba(185,42,8,0.05) 60%, transparent 78%)',
                        zIndex:4, pointerEvents:'none',
                    }}/>
                    <div style={{
                        position:'absolute', bottom:'-240px', left:'50%', transform:'translateX(-50%)',
                        width:520, height:520,
                        background:'radial-gradient(circle at center, rgba(255,250,200,0.99) 0%, rgba(255,230,80,0.96) 9%, rgba(255,185,30,0.78) 21%, rgba(248,130,14,0.48) 36%, rgba(225,78,10,0.20) 54%, transparent 72%)',
                        zIndex:6, pointerEvents:'none',
                    }}/>
                </>)}

                {/* Evening sun */}
                {theme.id === 'evening' && (<>
                    <div style={{
                        position:'absolute', bottom:0, right:0,
                        width:700, height:420,
                        background:'radial-gradient(ellipse at 100% 100%, rgba(205,65,16,0.35) 0%, rgba(172,32,12,0.15) 28%, transparent 62%)',
                        zIndex:4, pointerEvents:'none',
                    }}/>
                    <div style={{
                        position:'absolute', bottom:'-260px', right:'-260px',
                        width:520, height:520,
                        background:'radial-gradient(circle at center, rgba(255,210,70,0.98) 0%, rgba(252,155,22,0.86) 11%, rgba(232,88,14,0.60) 24%, rgba(205,45,10,0.28) 40%, rgba(175,22,8,0.10) 56%, transparent 72%)',
                        zIndex:5, pointerEvents:'none',
                    }}/>
                </>)}

                {/* Stars */}
                {stars.map(st => (
                    <div key={st.id} style={{
                        position:'absolute',
                        left:`${st.left}%`, top:`${st.top}%`,
                        width:`${st.size}px`, height:`${st.size}px`,
                        opacity: st.op, pointerEvents:'none', zIndex:50,
                    }}>
                        <div style={{
                            width:'100%', height:'100%',
                            borderRadius:'50%', background:'#fff',
                            animation:`starTwinkle ${st.dur}s ${st.del}s ease-in-out infinite`,
                        }}/>
                    </div>
                ))}
            </motion.div>

            {/* == UI LAYER == */}
            <div className="relative flex flex-col h-full" style={{ zIndex: 10 }}>

                {/* TOP BAR */}
                <div className="hidden sm:flex relative z-50 items-center justify-between px-2 sm:px-4 pt-2 sm:pt-3 pb-1 flex-shrink-0 gap-2 sm:gap-3">
                    {/* Тема суток — показана на sm+ */}
                    <div className="hidden sm:flex top-pill">
                        {THEME_OPTIONS.map(opt => (
                            <button key={opt.id} onClick={() => setThemeId(opt.id)}
                                title={opt.label} className="top-pill-btn"
                                style={pill(themeId === opt.id)}>
                                <span>{opt.emoji}</span>
                                <span className="hidden sm:inline">{opt.label}</span>
                            </button>
                        ))}
                    </div>
                    {/* На мобильном — заглушка чтобы версия была по центру/справа */}
                    <div className="sm:hidden" />
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        {/* Язык — скрыт на мобильном */}
                        <div className="hidden sm:flex top-pill">
                            {['ru','uz'].map(l => (
                                <button key={l} onClick={() => setLang(l)}
                                    className="top-pill-btn" style={pill(lang === l)}>
                                    {l.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        <span className="hidden sm:inline-block text-xs font-bold select-none px-2.5 py-1.5 rounded-full"
                              style={{background:'rgba(0,0,0,0.22)', color:'rgba(255,255,255,0.28)',
                                      border:'1px solid rgba(255,255,255,0.07)'}}>
                            v{APP_VERSION}
                        </span>
                        {window.electronAPI && (
                            <div className="flex gap-1 ml-0.5">
                                {[
                                    { icon:<Minus size={11}/>,     fn:()=>window.electronAPI.minimize(),                                                                                       ho:'#f0a030' },
                                    { icon:<Maximize2 size={11}/>, fn:async()=>{const m=await window.electronAPI.isMaximized();m?window.electronAPI.restore():window.electronAPI.maximize();}, ho:'#27ae60' },
                                    { icon:<X size={11}/>,         fn:()=>window.electronAPI.close(),                                                                                          ho:'#e74c3c' },
                                ].map(({icon,fn,ho},i) => (
                                    <button key={i} onClick={fn}
                                        className="w-7 h-7 flex items-center justify-center rounded-full transition-all"
                                        style={{background:'rgba(0,0,0,0.22)', color:'rgba(255,255,255,0.4)'}}
                                        onMouseOver={e=>{e.currentTarget.style.background=ho;e.currentTarget.style.color='#fff';}}
                                        onMouseOut={e=>{e.currentTarget.style.background='rgba(0,0,0,0.22)';e.currentTarget.style.color='rgba(255,255,255,0.4)';}}>
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* MAIN CONTENT */}
                <div className="flex-1 flex items-center justify-center min-h-0 px-8 py-4">
                    <AnimatePresence>
                        {cardVisible && (
                            <motion.div
                                key="glass-card"
                                className="v7-form w-full max-w-4xl rounded-3xl flex flex-col md:flex-row"
                                style={{
                                    background: theme.formBg,
                                    backdropFilter: 'blur(24px)',
                                    WebkitBackdropFilter: 'blur(24px)',
                                    border: `1px solid ${theme.formBorder}`,
                                    boxShadow: '0 24px 70px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)',
                                    transformOrigin: 'center center',
                                }}
                                animate={submitPhase === 'collapsing'
                                    ? { scale: 0, opacity: 0 }
                                    : { scale: 1, opacity: 1 }
                                }
                                transition={submitPhase === 'collapsing'
                                    ? { duration: 0.48, ease: [0.55, 0, 1, 0.45] }
                                    : { duration: 0.01 }
                                }
                            >
                                {/* LEFT - logo */}
                                <div className="hidden md:flex flex-1 flex-col items-center justify-center p-10">
                                    <div className="v7-brand flex flex-col items-center text-center">
                                        <div className="mb-6">
                                            <img src={`${import.meta.env.BASE_URL}Logo.png`} alt="Hostella"
                                                 loading="eager" decoding="async"
                                                 className="w-36 h-36 rounded-full object-cover"
                                                 style={{
                                                     filter: `drop-shadow(0 0 24px ${theme.logoGlow})
                                                              drop-shadow(0 0 64px ${theme.logoGlow.replace(/[\d.]+\)$/, '0.22)')})
                                                              drop-shadow(0 8px 28px rgba(0,0,0,0.55))`,
                                                 }}/>
                                        </div>
                                        <h1 className="v7-glint-text text-5xl font-black tracking-tight mb-2"
                                            style={{backgroundImage: `linear-gradient(105deg, ${theme.greetColor} 22%, ${theme.greetColor} 43%, rgba(255,255,255,0.92) 50%, ${theme.greetColor} 57%, ${theme.greetColor} 78%)`}}>
                                            Hostella
                                        </h1>
                                        <p className="text-sm font-medium" style={{color: theme.taglineColor}}>
                                            {t('hostelSystem')}
                                        </p>
                                    </div>
                                </div>

                                {/* DIVIDER */}
                                <div className="hidden md:block" style={{width:'1px', background: theme.formBorder, margin:'2.5rem 0', flexShrink:0}}/>

                                {/* RIGHT - form / hostel picker */}
                                <div className="flex-1 flex flex-col justify-center p-10">
                                  <AnimatePresence mode="wait">
                                  {submitPhase === 'hostel-pick' ? (
                                    /* ── Hostel picker ── */
                                    <motion.div
                                      key="hostel-picker"
                                      initial={{ opacity: 0, y: 28 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -24 }}
                                      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                                    >
                                      {/* Lock success badge */}
                                      <div className="flex flex-col items-center mb-8">
                                        <motion.div
                                          initial={{ scale: 0.5, opacity: 0 }}
                                          animate={{ scale: 1, opacity: 1 }}
                                          transition={{ duration: 0.45, ease: [0.34, 1.3, 0.64, 1] }}
                                          style={{
                                            width: 52, height: 52, borderRadius: '50%',
                                            background: 'linear-gradient(135deg, #00c853 0%, #009624 100%)',
                                            boxShadow: '0 0 32px rgba(0,210,80,0.6)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            marginBottom: '1rem',
                                          }}
                                        >
                                          <LockIcon open success />
                                        </motion.div>
                                        <h2 className="text-xl font-black" style={{ color: '#fff', letterSpacing: '-0.3px' }}>
                                          Выберите хостел
                                        </h2>
                                        <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.38)' }}>
                                          Несколько объектов доступны для вашего аккаунта
                                        </p>
                                      </div>

                                      {/* Hostel list */}
                                      <div className="flex flex-col gap-3">
                                        {(pendingUser?.allowedHostels || []).map((hid, idx) => {
                                          const hname = hostelNames[hid] || hid;

                                          return (
                                            <motion.button
                                              key={hid}
                                              type="button"
                                              initial={{ opacity: 0, x: 32 }}
                                              animate={{ opacity: 1, x: 0 }}
                                              transition={{ duration: 0.32, delay: idx * 0.09, ease: [0.22, 1, 0.36, 1] }}
                                              whileHover={{ scale: 1.03, x: 4 }}
                                              whileTap={{ scale: 0.97 }}
                                              onClick={() => { setHostelError(null); handleHostelSelect(hid); }}
                                              style={{
                                                background: 'rgba(255,255,255,0.07)',
                                                border: '1px solid rgba(255,255,255,0.13)',
                                                borderRadius: '14px',
                                                padding: '14px 18px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '14px',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                transition: 'background .2s, border-color .2s, box-shadow .2s',
                                              }}
                                              onMouseEnter={e => {
                                                e.currentTarget.style.background = 'rgba(0,200,90,0.12)';
                                                e.currentTarget.style.borderColor = 'rgba(0,200,90,0.4)';
                                                e.currentTarget.style.boxShadow = '0 0 18px rgba(0,210,80,0.25)';
                                              }}
                                              onMouseLeave={e => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)';
                                                e.currentTarget.style.boxShadow = 'none';
                                              }}
                                            >
                                              {/* Icon */}
                                              <div style={{
                                                width: 38, height: 38, borderRadius: '10px', flexShrink: 0,
                                                background: 'linear-gradient(135deg, rgba(0,200,90,0.25) 0%, rgba(0,150,70,0.15) 100%)',
                                                border: '1px solid rgba(0,200,90,0.25)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                              }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                                     stroke="rgba(0,220,100,0.9)" strokeWidth="2"
                                                     strokeLinecap="round" strokeLinejoin="round">
                                                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                                  <polyline points="9 22 9 12 15 12 15 22"/>
                                                </svg>
                                              </div>
                                              {/* Label */}
                                              <div>
                                                <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px', lineHeight: 1.3 }}>
                                                  {hname}
                                                </div>
                                                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '2px' }}>
                                                  Нажмите для входа
                                                </div>
                                              </div>
                                              {/* Arrow */}
                                              <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.25)' }}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                                     stroke="currentColor" strokeWidth="2.5"
                                                     strokeLinecap="round" strokeLinejoin="round">
                                                  <polyline points="9 18 15 12 9 6"/>
                                                </svg>
                                              </div>
                                            </motion.button>
                                          );
                                        })}
                                      </div>

                                      {/* Ошибка — смена занята */}
                                      <AnimatePresence>
                                        {hostelError && (
                                          <motion.div
                                            key="hostel-error"
                                            initial={{ opacity: 0, y: -8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                            transition={{ duration: 0.25 }}
                                            style={{
                                              marginTop: '14px',
                                              padding: '12px 14px',
                                              background: 'rgba(255,80,60,0.12)',
                                              border: '1px solid rgba(255,80,60,0.3)',
                                              borderRadius: '12px',
                                              display: 'flex', alignItems: 'flex-start', gap: '10px',
                                            }}
                                          >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                                 stroke="#ff9090" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                                 style={{ flexShrink: 0, marginTop: '1px' }}>
                                              <circle cx="12" cy="12" r="10"/>
                                              <line x1="12" y1="8" x2="12" y2="12"/>
                                              <line x1="12" y1="16" x2="12.01" y2="16"/>
                                            </svg>
                                            <div>
                                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#ff9090', marginBottom: '2px' }}>
                                                Смена уже открыта
                                              </div>
                                              <div style={{ fontSize: '12px', color: 'rgba(255,150,140,0.7)', lineHeight: 1.4 }}>
                                                {hostelNames[hostelError.hostelId] || hostelError.hostelId}: сейчас работает <strong style={{ color: '#ffb0a8' }}>{hostelError.occupiedBy}</strong>
                                              </div>
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>

                                      {/* Кнопка выхода */}
                                      <button
                                        type="button"
                                        onClick={() => { setSubmitPhase('idle'); setHostelError(null); }}
                                        style={{
                                          marginTop: '20px', width: '100%', height: '40px',
                                          background: 'transparent',
                                          border: '1px solid rgba(255,255,255,0.1)',
                                          borderRadius: '10px', cursor: 'pointer',
                                          color: 'rgba(255,255,255,0.35)',
                                          fontSize: '13px', fontWeight: 600,
                                          fontFamily: 'inherit',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                                          transition: 'background .2s, color .2s, border-color .2s',
                                        }}
                                        onMouseEnter={e => {
                                          e.currentTarget.style.background = 'rgba(255,80,60,0.1)';
                                          e.currentTarget.style.borderColor = 'rgba(255,80,60,0.35)';
                                          e.currentTarget.style.color = '#ff9090';
                                        }}
                                        onMouseLeave={e => {
                                          e.currentTarget.style.background = 'transparent';
                                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                          e.currentTarget.style.color = 'rgba(255,255,255,0.35)';
                                        }}
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                                             stroke="currentColor" strokeWidth="2.5"
                                             strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                                          <polyline points="16 17 21 12 16 7"/>
                                          <line x1="21" y1="12" x2="9" y2="12"/>
                                        </svg>
                                        Выйти
                                      </button>
                                    </motion.div>
                                  ) : (
                                    /* ── Login form ── */
                                    <motion.div
                                      key="login-form"
                                      initial={false}
                                      exit={{ opacity: 0, y: -24 }}
                                      transition={{ duration: 0.28 }}
                                    >
                                    <div key={greetKey} className="v7-greet mb-7">
                                            <div className="flex items-center gap-2.5 mb-1">
                                                <span className="text-3xl leading-none">{theme.emoji}</span>
                                                <h2 className="text-2xl font-black leading-tight"
                                                    style={{color: theme.greetColor}}>
                                                    {theme.greeting[lang] ?? theme.greeting.ru}
                                                </h2>
                                            </div>
                                            <p className="text-sm pl-1" style={{color: theme.subColor}}>
                                                {theme.sub[lang] ?? theme.sub.ru}
                                            </p>
                                        </div>

                                        <form onSubmit={handleAuth}>
                                            <div className="mb-4">
                                                <label className="block text-xs font-bold mb-2 uppercase tracking-wider"
                                                       style={{color:'rgba(255,255,255,0.38)'}}>
                                                    {t('login')}
                                                </label>
                                                <input
                                                    ref={loginInputRef}
                                                    type="text"
                                                    name="username"
                                                    value={login}
                                                    onChange={e => { setLogin(e.target.value); setError(''); }}
                                                    disabled={isSubmitting}
                                                    autoComplete="username"
                                                    autoFocus
                                                    placeholder="Введите логин"
                                                    className="v7-login-input"
                                                    style={{ width: '100%', height: '50px', padding: '0 16px', boxSizing: 'border-box', borderRadius: '12px',
                                                        border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.08)',
                                                        color: '#fff', fontSize: '15px', fontWeight: 500, outline: 'none', transition: 'border-color 0.15s, background 0.15s' }}
                                                />
                                            </div>

                                            <div className="mb-5">
                                                <label className="block text-xs font-bold mb-2 uppercase tracking-wider"
                                                       style={{color:'rgba(255,255,255,0.38)'}}>
                                                    {t('pass')}
                                                </label>
                                                <div style={{ position: 'relative' }}>
                                                    <input
                                                        type={showPass ? 'text' : 'password'}
                                                        name="password"
                                                        value={pass}
                                                        onChange={e => { setPass(e.target.value); setError(''); }}
                                                        onFocus={() => setError('')}
                                                        disabled={isSubmitting}
                                                        autoComplete="current-password"
                                                        placeholder="Введите пароль"
                                                        className="v7-login-input"
                                                        style={{ width: '100%', height: '50px', padding: '0 46px 0 16px', boxSizing: 'border-box', borderRadius: '12px',
                                                            border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.08)',
                                                            color: '#fff', fontSize: '15px', fontWeight: 500, outline: 'none', transition: 'border-color 0.15s, background 0.15s' }}
                                                    />
                                                    <button type="button" tabIndex={-1} onClick={() => setShowPass(s => !s)}
                                                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '34px', height: '34px',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer',
                                                            color: 'rgba(255,255,255,0.5)', fontSize: '17px', borderRadius: '8px' }}>
                                                        {showPass ? '🙈' : '👁'}
                                                    </button>
                                                </div>
                                            </div>

                                            {error && (
                                                <div className="px-4 py-2.5 rounded-xl text-sm font-semibold text-center mb-4"
                                                     style={{background:'rgba(255,80,60,0.15)', color:'#ff9090',
                                                             border:'1px solid rgba(255,80,60,0.25)',
                                                             animation:'fadeSlideUp .3s ease both'}}>
                                                    {error}
                                                </div>
                                            )}

                                            {/* Animated submit button */}
                                            <div>
                                                {/* ── Вариант 5: прогресс-блок над кнопкой ── */}
                                                <AnimatePresence>
                                                    {isLoading && (
                                                        <motion.div
                                                            key="progress-v5"
                                                            initial={{ opacity: 0, y: -8 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -8 }}
                                                            transition={{ duration: 0.3 }}
                                                            style={{ marginBottom: '12px' }}
                                                        >
                                                            {/* Заголовок + процент */}
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                                                                <span style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Загрузка данных</span>
                                                                <motion.span
                                                                    animate={{ opacity: 1 }}
                                                                    style={{ fontSize: '20px', fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}
                                                                >
                                                                    {loadingPct}%
                                                                </motion.span>
                                                            </div>
                                                            {/* Текущий шаг */}
                                                            <AnimatePresence mode="wait">
                                                                <motion.div
                                                                    key={loadingTextIdx}
                                                                    initial={{ opacity: 0, y: 4 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    exit={{ opacity: 0, y: -4 }}
                                                                    transition={{ duration: 0.2 }}
                                                                    style={{ fontSize: '12px', color: 'rgba(255,255,255,0.28)', marginBottom: '8px' }}
                                                                >
                                                                    {LOADING_TEXTS[loadingTextIdx]}
                                                                </motion.div>
                                                            </AnimatePresence>
                                                            {/* Полоска прогресса */}
                                                            <div style={{ height: '5px', background: 'rgba(255,255,255,0.07)', borderRadius: '5px', overflow: 'hidden' }}>
                                                                <motion.div
                                                                    animate={{ width: loadingPct + '%' }}
                                                                    transition={{ duration: 0.55, ease: 'easeOut' }}
                                                                    style={{ height: '100%', borderRadius: '5px', background: 'linear-gradient(90deg,#6366f1,#38bdf8)' }}
                                                                />
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>

                                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                    <motion.button
                                                        type="submit"
                                                        whileHover={!isSubmitting ? { scale: 1.025, filter: 'brightness(1.15)', y: -1 } : {}}
                                                        whileTap={!isSubmitting ? { scale: 0.975 } : {}}
                                                        animate={{
                                                            width:        lockSuccess ? '54px'  : '100%',
                                                            height:       lockSuccess ? '54px'  : '52px',
                                                            borderRadius: lockSuccess ? '50%'   : '12px',
                                                            background:   btnBg,
                                                            boxShadow:    btnShadow,
                                                            padding:      lockSuccess ? '0px'   : '0 13px',
                                                            borderColor:  isLoading ? 'rgba(255,255,255,0.15)' : 'transparent',
                                                        }}
                                                        transition={{ duration: 0.42, ease: [0.34, 1.12, 0.64, 1] }}
                                                        style={{
                                                            border:         isLoading ? '1px solid rgba(255,255,255,0.12)' : 'none',
                                                            cursor:         isSubmitting ? 'default' : 'pointer',
                                                            color:          '#ffffff',
                                                            fontFamily:     'inherit',
                                                            display:        'flex',
                                                            alignItems:     'center',
                                                            justifyContent: 'center',
                                                            overflow:       'hidden',
                                                            minWidth:       0,
                                                            letterSpacing:  '.3px',
                                                        }}
                                                    >
                                                        <AnimatePresence mode="wait">
                                                            {submitPhase === 'idle' && (
                                                                <motion.span
                                                                    key="btn-text"
                                                                    initial={{ opacity: 1 }}
                                                                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                                                                    style={{ fontSize: '15px', fontWeight: '800', whiteSpace: 'nowrap' }}
                                                                >
                                                                    {t('enter')}
                                                                </motion.span>
                                                            )}
                                                            {isLoading && (
                                                                <motion.div
                                                                    key="btn-loading"
                                                                    initial={{ opacity: 0 }}
                                                                    animate={{ opacity: 1 }}
                                                                    exit={{ opacity: 0 }}
                                                                    transition={{ duration: 0.2 }}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                                                                >
                                                                    <motion.span
                                                                        animate={{ rotate: 360 }}
                                                                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                                                                        style={{
                                                                            display: 'block', width: 18, height: 18, flexShrink: 0,
                                                                            borderRadius: '50%',
                                                                            border: '2px solid rgba(255,255,255,0.18)',
                                                                            borderTopColor: 'rgba(255,255,255,0.85)',
                                                                        }}
                                                                    />
                                                                    <span style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.65)' }}>
                                                                        Пожалуйста подождите...
                                                                    </span>
                                                                </motion.div>
                                                            )}
                                                            {lockSuccess && (
                                                                <motion.div
                                                                    key="btn-lock"
                                                                    initial={{ opacity: 0, scale: 0.4 }}
                                                                    animate={{ opacity: 1, scale: 1 }}
                                                                    transition={{ duration: 0.28, delay: 0.18 }}
                                                                >
                                                                    <LockIcon open={lockOpen} success={lockSuccess} />
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </motion.button>
                                                </div>
                                            </div>
                                        </form>


                                    </motion.div>
                                  )}
                                  </AnimatePresence>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>



                {/* OCEAN WAVES */}
                {/* MOBILE BOTTOM BAR — тема суток + язык, только на мобильном */}
                <div className="sm:hidden relative z-20 flex items-center justify-between px-5 pb-2 pt-1 flex-shrink-0">
                    <div className="top-pill">
                        {THEME_OPTIONS.map(opt => (
                            <button key={opt.id} onClick={() => setThemeId(opt.id)}
                                title={opt.label} className="top-pill-btn"
                                style={pill(themeId === opt.id)}>
                                <span>{opt.emoji}</span>
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="top-pill">
                            {['ru','uz'].map(l => (
                                <button key={l} onClick={() => setLang(l)}
                                    className="top-pill-btn" style={pill(lang === l)}>
                                    {l.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        <span className="text-xs font-bold select-none px-2 py-1 rounded-full"
                              style={{background:'rgba(0,0,0,0.22)', color:'rgba(255,255,255,0.28)',
                                      border:'1px solid rgba(255,255,255,0.07)'}}>
                            v{APP_VERSION}
                        </span>
                    </div>
                </div>

                <div className="relative z-10 flex-shrink-0 overflow-hidden" style={{height:72}}>
                    <svg className="v7-wave-c" viewBox="0 0 2880 72" fill="none" preserveAspectRatio="none"
                         style={{position:'absolute', bottom:16, width:'200%', height:'80%'}}>
                        <path stroke={theme.waveColor3} strokeWidth="1.2" strokeLinecap="round" opacity="0.55"
                              d="M0,22 C240,10 480,10 720,22 C960,34 1200,34 1440,22 C1680,10 1920,10 2160,22 C2400,34 2640,34 2880,22"/>
                    </svg>
                    <svg className="v7-wave-b" viewBox="0 0 2880 72" fill="none" preserveAspectRatio="none"
                         style={{position:'absolute', bottom:6, width:'200%', height:'90%'}}>
                        <path stroke={theme.waveColor2} strokeWidth="1.8" strokeLinecap="round" opacity="0.72"
                              d="M0,40 C240,56 480,56 720,40 C960,24 1200,24 1440,40 C1680,56 1920,56 2160,40 C2400,24 2640,24 2880,40"/>
                    </svg>
                    <svg className="v7-wave-a" viewBox="0 0 2880 72" fill="none" preserveAspectRatio="none"
                         style={{position:'absolute', bottom:0, width:'200%', height:'100%'}}>
                        <path stroke={theme.waveColor1} strokeWidth="2.5" strokeLinecap="round"
                              d="M0,50 C240,28 480,28 720,50 C960,66 1200,66 1440,50 C1680,28 1920,28 2160,50 C2400,66 2640,66 2880,50"/>
                    </svg>
                </div>
            </div>
        </div>
        </>
    );
};

export default LoginScreen;