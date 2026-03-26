import React, { useState, useEffect, useMemo } from 'react';
import TRANSLATIONS from '../../constants/translations';
import { verifyPassword } from '../../utils/hash';
import { X, Minus, Maximize2 } from 'lucide-react';

/* ─── Themes ─── */
export const THEMES = {
    morning: {
        id: 'morning',
        greeting: { ru: 'Доброе утро',  uz: 'Xayrli tong'  },
        sub:      { ru: 'Начнём продуктивный день!', uz: 'Samarali kun boshlaylik!' },
        emoji: '🌅',
        /* тёмно-синее ночное небо сверху → тёплый оранжевый горизонт снизу */
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
        /* глубокий малиново-красный закат — радикально отличается от утра */
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

const LoginScreen = ({ users, onLogin, onSeed, lang, setLang, themeId, setThemeId }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [login, setLogin]       = useState('');
    const [pass, setPass]         = useState('');
    const [error, setError]       = useState('');
    const [hour, setHour]         = useState(() => new Date().getHours());
    const [themeKey, setThemeKey] = useState(0);
    const [greetKey, setGreetKey] = useState(0);
    const [stars, setStars]       = useState([]);
    const [clouds, setClouds]      = useState([]);

    const theme = useMemo(() => {
        const id = themeId === 'auto' ? getAutoThemeId(hour) : themeId;
        return THEMES[id];
    }, [themeId, hour]);

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

    /* manual theme switch → re-trigger bg fade */
    useEffect(() => { setThemeKey(k => k + 1); }, [themeId]);

    /* generate stars as React state
     * Двухуровневое мерцание: внешний div хранит базовую opacity и НИКОГДА не анимируется,
     * внутренний div анимирует opacity 1→0 — результат: итоговая яркость = baseOp × animated */
    useEffect(() => {
        if (!theme.starCount) { setStars([]); return; }
        setStars(Array.from({ length: theme.starCount }, (_, i) => ({
            id: i,
            size: Math.random() < 0.12 ? 4 : Math.random() < 0.38 ? 2.5 : 1.5,
            op:   (Math.random() * 0.4 + 0.6) * theme.starOpacityMax,
            dur:  2.5 + Math.random() * 5,
            del:  Math.random() * 9,
            left: Math.random() * 100,
            top:  Math.random() * 85,
        })));
    }, [theme.id]);

    /* generate clouds */
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
        if (login === 'Super' && pass === 'super') {
            onLogin({ name:'Super Admin', login:'Super', role:'super', hostelId:'all' }); return;
        }
        const u = users.find(u => u.login.toLowerCase() === login.toLowerCase());
        if (!u) { setError(t('error')); return; }
        const { match } = await verifyPassword(pass, u.pass);
        if (match) onLogin(u); else setError(t('error'));
    };

    /* pill-button style helper */
    const pill = (active) => active
        ? { background: 'rgba(255,255,255,0.18)', color: '#fff' }
        : { background: 'transparent', color: 'rgba(255,255,255,0.38)' };

    return (
        <>
        <style>{`
            @keyframes starTwinkle {
                /* Внешний div держит базовую opacity — внутренний migерцает 1→0.04 */
                0%, 100% { opacity: 1; }
                50%       { opacity: 0.04; }
            }
            /* Overhead glint: фон-градиент двигается через буквы (background-clip:text) */
            @keyframes glintText {
                0%, 30%   { background-position: 100% center; } /* пауза — блик за левым краем */
                58%       { background-position:   0% center; } /* блик вышел за правый край */
                59%, 100% { background-position: 100% center; } /* мгновенный сброс, пауза */
            }
            @keyframes cloudDrift {
                from { transform: translateX(115vw); }
                to   { transform: translateX(-140vw); }
            }
            @keyframes bgFade        { from{opacity:0} to{opacity:1} }
            @keyframes fadeSlideRight { from{opacity:0;transform:translateX(22px)} to{opacity:1;transform:none} }
            @keyframes fadeSlideUp    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
            @keyframes greetIn        { from{opacity:0;transform:translateY(-7px)} to{opacity:1;transform:none} }
            /* ocean waves – all translateX 0 → -50%, seamless 2-period paths */
            @keyframes waveA { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
            @keyframes waveB { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
            @keyframes waveC { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }

            .v7-bg    { animation: bgFade .9s ease both; }
            .v7-form  { animation: fadeSlideRight .6s .1s ease both; }
            .v7-brand { animation: fadeSlideUp .7s ease both; }
            .v7-greet { animation: greetIn .4s ease both; }
            /* блик ВНУТРИ букв: gradient clip на текст, анимируем background-position */
            .v7-glint-text {
                background-size: 350% 100%;
                -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
                animation: glintText 11s ease-in-out infinite;
            }
            /* front fastest, back slowest */
            .v7-wave-a { animation: waveA 11s linear infinite; }
            .v7-wave-b { animation: waveB 18s linear infinite; }
            .v7-wave-c { animation: waveC 28s linear infinite; }
            /* top-bar pill container */
            .top-pill {
                display:flex; align-items:center; gap:2px; border-radius:999px; padding:4px;
                background:rgba(0,0,0,0.28); backdrop-filter:blur(16px);
                border:1px solid rgba(255,255,255,0.09);
            }
            .top-pill-btn {
                display:flex; align-items:center; gap:4px;
                padding:5px 10px; border-radius:999px;
                font-size:12px; font-weight:600;
                transition: background .18s, color .18s;
                border: none; cursor: pointer; background:transparent;
            }
        `}</style>

        <div key={themeKey} className="v7-bg fixed inset-0 w-screen h-screen z-[100] flex flex-col overflow-hidden"
             style={{background: theme.bg}}>

            {/* Clouds — атмосферные облака на фоне */}
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

            {/* Night: луна — position:fixed чтобы overflow:hidden не обрезал */}
            {theme.id === 'night' && (
                <div style={{
                    position:'fixed', right:'7%', top:'6%',
                    width:320, height:320,
                    background:'radial-gradient(circle at center, rgba(255,252,238,0.94) 0%, rgba(245,250,255,0.75) 9%, rgba(220,235,255,0.4) 20%, rgba(190,215,255,0.16) 33%, rgba(160,196,255,0.06) 46%, transparent 62%)',
                    zIndex:3, pointerEvents:'none',
                }}/>
            )}

            {/* Morning: рассвет — атмосфера + диск солнца наполовину за горизонтом */}
            {theme.id === 'morning' && (<>
                {/* Тёплый атмосферный слой */}
                <div style={{
                    position:'fixed', bottom:0, left:0, right:0, height:'55%',
                    background:'linear-gradient(to top, rgba(185,78,10,0.20) 0%, rgba(165,52,8,0.07) 42%, transparent 100%)',
                    zIndex:3, pointerEvents:'none',
                }}/>
                {/* Широкий солнечный ореол — разлив на горизонте */}
                <div style={{
                    position:'fixed', bottom:'-40px', left:'50%', transform:'translateX(-50%)',
                    width:1300, height:560,
                    background:'radial-gradient(ellipse 46% 60% at 50% 100%, rgba(255,195,48,0.50) 0%, rgba(248,128,16,0.30) 18%, rgba(220,72,10,0.14) 40%, rgba(185,42,8,0.05) 60%, transparent 78%)',
                    zIndex:4, pointerEvents:'none',
                }}/>
                {/* Диск солнца: центр на нижнем крае дисплея — видна ровно половина */}
                <div style={{
                    position:'fixed', bottom:'-240px', left:'50%', transform:'translateX(-50%)',
                    width:520, height:520,
                    background:'radial-gradient(circle at center, rgba(255,250,200,0.99) 0%, rgba(255,230,80,0.96) 9%, rgba(255,185,30,0.78) 21%, rgba(248,130,14,0.48) 36%, rgba(225,78,10,0.20) 54%, transparent 72%)',
                    zIndex:6, pointerEvents:'none',
                }}/>
            </>)}

            {/* Evening: солнце в правом нижнем углу — центр в углу, виден верхний-левый квадрант */}
            {theme.id === 'evening' && (<>
                {/* Угловое атмосферное свечение */}
                <div style={{
                    position:'fixed', bottom:0, right:0,
                    width:700, height:420,
                    background:'radial-gradient(ellipse at 100% 100%, rgba(205,65,16,0.35) 0%, rgba(172,32,12,0.15) 28%, transparent 62%)',
                    zIndex:4, pointerEvents:'none',
                }}/>
                {/* Диск: центр точно в углу (bottom:0, right:0), виден верхний-левый квадрант */}
                <div style={{
                    position:'fixed', bottom:'-260px', right:'-260px',
                    width:520, height:520,
                    background:'radial-gradient(circle at center, rgba(255,210,70,0.98) 0%, rgba(252,155,22,0.86) 11%, rgba(232,88,14,0.60) 24%, rgba(205,45,10,0.28) 40%, rgba(175,22,8,0.10) 56%, transparent 72%)',
                    zIndex:5, pointerEvents:'none',
                }}/>
            </>)}

            {/* Stars — React state, двухуровневое мерцание */}
            {stars.map(st => (
                <div key={st.id} style={{
                    position:'absolute',
                    left:`${st.left}%`, top:`${st.top}%`,
                    width:`${st.size}px`, height:`${st.size}px`,
                    opacity: st.op,
                    pointerEvents:'none',
                    zIndex: 50,
                }}>
                    <div style={{
                        width:'100%', height:'100%',
                        borderRadius:'50%', background:'#fff',
                        animation:`starTwinkle ${st.dur}s ${st.del}s ease-in-out infinite`,
                    }}/>
                </div>
            ))}

            {/* ═══ TOP BAR ═══ */}
            <div className="relative z-50 flex items-center justify-between px-4 pt-3 pb-1 flex-shrink-0 gap-3">

                {/* LEFT — theme switcher */}
                <div className="top-pill">
                    {THEME_OPTIONS.map(opt => (
                        <button key={opt.id} onClick={() => setThemeId(opt.id)}
                            title={opt.label} className="top-pill-btn"
                            style={pill(themeId === opt.id)}>
                            <span>{opt.emoji}</span>
                            <span className="hidden sm:inline">{opt.label}</span>
                        </button>
                    ))}
                </div>

                {/* RIGHT — lang + version + electron */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* language */}
                    <div className="top-pill">
                        {['ru','uz'].map(l => (
                            <button key={l} onClick={() => setLang(l)}
                                className="top-pill-btn" style={pill(lang === l)}>
                                {l.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {/* version */}
                    <span className="text-xs font-bold select-none px-2.5 py-1.5 rounded-full"
                          style={{background:'rgba(0,0,0,0.22)', color:'rgba(255,255,255,0.28)',
                                  border:'1px solid rgba(255,255,255,0.07)'}}>
                        v0.3.22
                    </span>

                    {/* electron window controls */}
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

            {/* ═══ MAIN CONTENT — единая карточка ═══ */}
            <div className="flex-1 flex items-center justify-center min-h-0 px-8 py-4 relative z-10">
                <div className="v7-form w-full max-w-4xl rounded-3xl flex"
                     style={{
                         background: theme.formBg,
                         backdropFilter: 'blur(24px)',
                         WebkitBackdropFilter: 'blur(24px)',
                         border: `1px solid ${theme.formBorder}`,
                         boxShadow: '0 24px 70px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)',
                     }}>

                    {/* LEFT — лого */}
                    <div className="flex-1 flex flex-col items-center justify-center p-10">
                        <div className="v7-brand flex flex-col items-center text-center">
                            <div className="mb-6">
                                <img src="https://hostella.uz/logo.png" alt="Hostella"
                                     className="w-36 h-36 rounded-full object-cover"
                                     style={{
                                         filter: `drop-shadow(0 0 24px ${theme.logoGlow})
                                                  drop-shadow(0 0 64px ${theme.logoGlow.replace(/[\d.]+\)$/, '0.22)')})
                                                  drop-shadow(0 8px 28px rgba(0,0,0,0.55))`,
                                     }}/>
                            </div>
                            {/* Hostella: блик движется ЧЕРЕЗ буквы; overlay убран */}
                            <h1 className="v7-glint-text text-5xl font-black tracking-tight mb-2"
                                style={{backgroundImage: `linear-gradient(105deg, ${theme.greetColor} 22%, ${theme.greetColor} 43%, rgba(255,255,255,0.92) 50%, ${theme.greetColor} 57%, ${theme.greetColor} 78%)`}}>
                                Hostella
                            </h1>
                            <p className="text-sm font-medium" style={{color: theme.taglineColor}}>
                                {t('hostelSystem')}
                            </p>
                        </div>
                    </div>

                    {/* РАЗДЕЛИТЕЛЬ */}
                    <div style={{width:'1px', background: theme.formBorder, margin:'2.5rem 0', flexShrink:0}}/>

                    {/* RIGHT — форма */}
                    <div className="flex-1 flex flex-col justify-center p-10">
                        <div>

                            {/* Greeting — билингвальный */}
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
                                        className="w-full px-4 py-3 rounded-xl text-base font-medium outline-none border transition-all"
                                        style={{background:'rgba(255,255,255,0.08)', borderColor:'rgba(255,255,255,0.12)', color:'#fff'}}
                                        onFocus={e=>{e.target.style.borderColor='rgba(255,255,255,0.38)';e.target.style.background='rgba(255,255,255,0.13)';}}
                                        onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,0.12)';e.target.style.background='rgba(255,255,255,0.08)';}}
                                        value={login}
                                        onChange={e=>{setLogin(e.target.value);setError('');}}
                                        placeholder="admin" autoFocus/>
                                </div>

                                <div className="mb-5">
                                    <label className="block text-xs font-bold mb-2 uppercase tracking-wider"
                                           style={{color:'rgba(255,255,255,0.38)'}}>
                                        {t('pass')}
                                    </label>
                                    <input type="password"
                                        className="w-full px-4 py-3 rounded-xl text-base font-medium outline-none border transition-all"
                                        style={{background:'rgba(255,255,255,0.08)', borderColor:'rgba(255,255,255,0.12)', color:'#fff'}}
                                        onFocus={e=>{e.target.style.borderColor='rgba(255,255,255,0.38)';e.target.style.background='rgba(255,255,255,0.13)';}}
                                        onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,0.12)';e.target.style.background='rgba(255,255,255,0.08)';}}
                                        value={pass}
                                        onChange={e=>{setPass(e.target.value);setError('');}}
                                        placeholder="••••••••"/>
                                </div>

                                {error && (
                                    <div className="px-4 py-2.5 rounded-xl text-sm font-semibold text-center mb-4"
                                         style={{background:'rgba(255,80,60,0.15)', color:'#ff9090',
                                                 border:'1px solid rgba(255,80,60,0.25)',
                                                 animation:'fadeSlideUp .3s ease both'}}>
                                        {error}
                                    </div>
                                )}

                                <button type="submit"
                                    className="w-full py-3.5 text-white font-black text-base rounded-xl transition-all"
                                    style={{background: theme.accentBtn,
                                            boxShadow:'0 4px 20px rgba(0,0,0,0.35)',
                                            letterSpacing:'.3px'}}
                                    onMouseOver={e=>{e.currentTarget.style.filter='brightness(1.15)';e.currentTarget.style.transform='translateY(-1px)';}}
                                    onMouseOut={e=>{e.currentTarget.style.filter='';e.currentTarget.style.transform='';}}>
                                    {t('enter')}
                                </button>
                            </form>

                            <div className="mt-5 pt-4 text-center border-t"
                                 style={{borderColor:'rgba(255,255,255,0.07)'}}>
                                <button onClick={onSeed}
                                    className="text-xs transition-colors"
                                    style={{color:'rgba(255,255,255,0.2)'}}
                                    onMouseOver={e=>e.currentTarget.style.color='rgba(255,255,255,0.5)'}
                                    onMouseOut={e=>e.currentTarget.style.color='rgba(255,255,255,0.2)'}>
                                    {t('initDb')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/**
              * OCEAN WAVES
              * Three stroke-only sinusoidal paths, each SVG is 200% wide with two full periods
              * (viewBox 0..2880). Animation translateX(0→-50%) shifts one full period, seamlessly looping.
              * No fill, no closing-to-bottom — just wave lines on the sea surface.
              */}
            <div className="relative z-10 flex-shrink-0 overflow-hidden" style={{height:72}}>

                {/* Back wave — smallest amplitude, slowest, least opaque */}
                <svg className="v7-wave-c" viewBox="0 0 2880 72" fill="none" preserveAspectRatio="none"
                     style={{position:'absolute', bottom:16, width:'200%', height:'80%'}}>
                    <path stroke={theme.waveColor3} strokeWidth="1.2" strokeLinecap="round" opacity="0.55"
                          d="M0,22 C240,10 480,10 720,22 C960,34 1200,34 1440,22 C1680,10 1920,10 2160,22 C2400,34 2640,34 2880,22"/>
                </svg>

                {/* Mid wave — medium, opposite phase */}
                <svg className="v7-wave-b" viewBox="0 0 2880 72" fill="none" preserveAspectRatio="none"
                     style={{position:'absolute', bottom:6, width:'200%', height:'90%'}}>
                    <path stroke={theme.waveColor2} strokeWidth="1.8" strokeLinecap="round" opacity="0.72"
                          d="M0,40 C240,56 480,56 720,40 C960,24 1200,24 1440,40 C1680,56 1920,56 2160,40 C2400,24 2640,24 2880,40"/>
                </svg>

                {/* Front wave — tallest amplitude, fastest, most opaque */}
                <svg className="v7-wave-a" viewBox="0 0 2880 72" fill="none" preserveAspectRatio="none"
                     style={{position:'absolute', bottom:0, width:'200%', height:'100%'}}>
                    <path stroke={theme.waveColor1} strokeWidth="2.5" strokeLinecap="round"
                          d="M0,50 C240,28 480,28 720,50 C960,66 1200,66 1440,50 C1680,28 1920,28 2160,50 C2400,66 2640,66 2880,50"/>
                </svg>

            </div>
        </div>
        </>
    );
};

export default LoginScreen;
