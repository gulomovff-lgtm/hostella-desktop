import React, { useState, useEffect, useMemo } from 'react';
import { LogOut } from 'lucide-react';
import { THEMES, getAutoThemeId } from './LoginScreen';

const HOSTEL_OPTIONS = [
    { id: 'hostel1', label: 'Хостел №1', emoji: '🏨', accent: '#7c3aed', glow: 'rgba(124,58,237,0.45)' },
    { id: 'hostel2', label: 'Хостел №2', emoji: '🏩', accent: '#0284c7', glow: 'rgba(2,132,199,0.45)' },
];

const HostelPickerScreen = ({ user, onPick, onLogout, lang, themeId = 'auto' }) => {
    const allowedIds = user?.allowedHostels || ['hostel1', 'hostel2'];
    const options    = HOSTEL_OPTIONS.filter(h => allowedIds.includes(h.id));
    const [stars, setStars] = useState([]);
    const [clouds, setClouds] = useState([]);
    const [hour] = useState(() => new Date().getHours());

    const theme = useMemo(() => {
        const id = themeId === 'auto' ? getAutoThemeId(hour) : themeId;
        return THEMES[id] || THEMES.night;
    }, [themeId, hour]);

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

    return (
        <>
        <style>{`
            @keyframes hpStarTwinkle { 0%,100%{opacity:1} 50%{opacity:0.04} }
            @keyframes hpCloudDrift { from{transform:translateX(115vw)} to{transform:translateX(-140vw)} }
            @keyframes hpGlintText {
                0%, 30%   { background-position: 100% center; }
                58%       { background-position:   0% center; }
                59%, 100% { background-position: 100% center; }
            }
            @keyframes hpFadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }
            @keyframes hpWaveA { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
            @keyframes hpWaveB { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
            @keyframes hpWaveC { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
            @keyframes hpBgFade { from{opacity:0} to{opacity:1} }

            .hp-form     { animation: hpFadeUp .6s .1s ease both; }
            .hp-wave-a   { animation: hpWaveA 11s linear infinite; }
            .hp-wave-b   { animation: hpWaveB 18s linear infinite; }
            .hp-wave-c   { animation: hpWaveC 28s linear infinite; }
            .hp-glint-text {
                background-size: 350% 100%;
                -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
                animation: hpGlintText 11s ease-in-out infinite;
            }
            .hp-card { transition: transform .18s, box-shadow .18s, background .18s, border-color .18s; }
            .hp-card:hover  { transform: translateY(-3px); }
            .hp-card:active { transform: scale(.97); }
        `}</style>

        <div className="fixed inset-0 w-screen h-screen z-[100] flex flex-col overflow-hidden"
             style={{ background: theme.bg, animation:'hpBgFade .9s ease both' }}>

            {/* Облака */}
            {clouds.map(cl => (
                <div key={cl.id} style={{
                    position:'absolute', top:`${cl.top}%`,
                    width:`${cl.width}px`, height:`${Math.round(cl.width * 0.38)}px`,
                    opacity: cl.opacity, zIndex:4, pointerEvents:'none',
                    animation:`hpCloudDrift ${cl.duration}s ${cl.delay}s linear infinite`,
                }}>
                    <svg viewBox="0 0 200 80" width="100%" height="100%">
                        <ellipse cx="100" cy="66" rx="90" ry="22" fill={theme.cloudColor}/>
                        <ellipse cx="72"  cy="52" rx="38" ry="30" fill={theme.cloudColor}/>
                        <ellipse cx="122" cy="44" rx="50" ry="34" fill={theme.cloudColor}/>
                        <ellipse cx="158" cy="57" rx="34" ry="25" fill={theme.cloudColor}/>
                    </svg>
                </div>
            ))}

            {/* Ночь: луна */}
            {theme.id === 'night' && (
                <div style={{
                    position:'fixed', right:'7%', top:'6%', width:260, height:260,
                    background:'radial-gradient(circle at center, rgba(255,252,238,0.92) 0%, rgba(240,248,255,0.70) 10%, rgba(210,232,255,0.36) 22%, rgba(180,210,255,0.14) 36%, transparent 60%)',
                    zIndex:3, pointerEvents:'none',
                }}/>
            )}

            {/* Утро: солнце снизу-по-центру */}
            {theme.id === 'morning' && (<>
                <div style={{
                    position:'fixed', bottom:0, left:0, right:0, height:'55%',
                    background:'linear-gradient(to top, rgba(185,78,10,0.20) 0%, transparent 100%)',
                    zIndex:3, pointerEvents:'none',
                }}/>
                <div style={{
                    position:'fixed', bottom:'-40px', left:'50%', transform:'translateX(-50%)',
                    width:1300, height:560,
                    background:'radial-gradient(ellipse 46% 60% at 50% 100%, rgba(255,195,48,0.50) 0%, rgba(248,128,16,0.30) 18%, rgba(220,72,10,0.14) 40%, transparent 78%)',
                    zIndex:4, pointerEvents:'none',
                }}/>
                <div style={{
                    position:'fixed', bottom:'-240px', left:'50%', transform:'translateX(-50%)',
                    width:520, height:520,
                    background:'radial-gradient(circle at center, rgba(255,250,200,0.99) 0%, rgba(255,230,80,0.96) 9%, rgba(255,185,30,0.78) 21%, rgba(248,130,14,0.48) 36%, rgba(225,78,10,0.20) 54%, transparent 72%)',
                    zIndex:6, pointerEvents:'none',
                }}/>
            </>)}

            {/* Вечер: закат в правом нижнем углу */}
            {theme.id === 'evening' && (<>
                <div style={{
                    position:'fixed', bottom:0, right:0, width:700, height:420,
                    background:'radial-gradient(ellipse at 100% 100%, rgba(205,65,16,0.35) 0%, rgba(172,32,12,0.15) 28%, transparent 62%)',
                    zIndex:4, pointerEvents:'none',
                }}/>
                <div style={{
                    position:'fixed', bottom:'-260px', right:'-260px', width:520, height:520,
                    background:'radial-gradient(circle at center, rgba(255,210,70,0.98) 0%, rgba(252,155,22,0.86) 11%, rgba(232,88,14,0.60) 24%, rgba(205,45,10,0.28) 40%, transparent 72%)',
                    zIndex:5, pointerEvents:'none',
                }}/>
            </>)}

            {/* Stars */}
            {stars.map(st => (
                <div key={st.id} style={{
                    position:'absolute', left:`${st.left}%`, top:`${st.top}%`,
                    width:`${st.size}px`, height:`${st.size}px`,
                    opacity: st.op, pointerEvents:'none', zIndex: 5,
                }}>
                    <div style={{
                        width:'100%', height:'100%', borderRadius:'50%', background:'#fff',
                        animation:`hpStarTwinkle ${st.dur}s ${st.del}s ease-in-out infinite`,
                    }}/>
                </div>
            ))}

            {/* Main — единая карточка */}
            <div className="flex-1 flex items-center justify-center min-h-0 px-8 py-4 relative z-10">
                <div className="hp-form w-full max-w-4xl rounded-3xl flex"
                     style={{
                         background: theme.formBg,
                         backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)',
                         border: `1px solid ${theme.formBorder}`,
                         boxShadow:'0 24px 70px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07)',
                     }}>

                    {/* LEFT — лого */}
                    <div className="flex-1 flex flex-col items-center justify-center p-10">
                        <div className="flex flex-col items-center text-center">
                            <div className="mb-6">
                                <img src="https://hostella.uz/logo.png" alt="Hostella"
                                     className="w-36 h-36 rounded-full object-cover"
                                     style={{
                                         filter: `drop-shadow(0 0 24px ${theme.logoGlow})
                                                  drop-shadow(0 0 64px ${theme.logoGlow.replace(/[\d.]+\)$/, '0.22)')})
                                                  drop-shadow(0 8px 28px rgba(0,0,0,0.55))`,
                                     }}/>
                            </div>
                            <h1 className="hp-glint-text text-5xl font-black tracking-tight mb-2"
                                style={{backgroundImage: `linear-gradient(105deg, ${theme.greetColor} 22%, ${theme.greetColor} 43%, rgba(255,255,255,0.92) 50%, ${theme.greetColor} 57%, ${theme.greetColor} 78%)`}}>
                                Hostella
                            </h1>
                            <p className="text-sm font-medium" style={{ color: theme.taglineColor }}>
                                Система управления хостелом
                            </p>
                        </div>
                    </div>

                    {/* РАЗДЕЛИТЕЛЬ */}
                    <div style={{width:'1px', background: theme.formBorder, margin:'2.5rem 0', flexShrink:0}}/>

                    {/* RIGHT — карточки */}
                    <div className="flex-1 flex flex-col justify-center p-10">
                        <div>
                            <div className="mb-6">
                                <p className="text-sm mb-1" style={{ color: theme.subColor }}>
                                    Привет, <strong style={{color: theme.greetColor}}>{user?.name}</strong>!
                                </p>
                                <h2 className="text-2xl font-black leading-tight" style={{ color: theme.greetColor }}>
                                    Выберите хостел
                                </h2>
                            </div>

                            <div className="space-y-3">
                                {options.map(h => (
                                    <button key={h.id} onClick={() => onPick(h.id)}
                                        className="hp-card w-full p-4 rounded-2xl text-left flex items-center gap-4"
                                        style={{ background:'rgba(255,255,255,0.07)', border:`1px solid ${theme.formBorder}` }}
                                        onMouseOver={e=>{
                                            e.currentTarget.style.background=`${h.glow.replace('0.45','0.12')}`;
                                            e.currentTarget.style.borderColor=h.accent;
                                            e.currentTarget.style.boxShadow=`0 0 0 1px ${h.accent}`;
                                        }}
                                        onMouseOut={e=>{
                                            e.currentTarget.style.background='rgba(255,255,255,0.07)';
                                            e.currentTarget.style.borderColor=theme.formBorder;
                                            e.currentTarget.style.boxShadow='none';
                                        }}>
                                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                                             style={{ background:`${h.glow.replace('0.45','0.25')}`, border:`1px solid ${h.glow}` }}>
                                            {h.emoji}
                                        </div>
                                        <div>
                                            <p className="font-black text-lg" style={{color: theme.greetColor}}>{h.label}</p>
                                            <p className="text-xs mt-0.5" style={{color: theme.subColor}}>Начать работу →</p>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="mt-6 pt-4 text-center border-t" style={{borderColor: theme.formBorder}}>
                                <button onClick={onLogout}
                                    className="text-xs flex items-center gap-1.5 mx-auto"
                                    style={{color:'rgba(255,255,255,0.2)', transition:'color .18s'}}
                                    onMouseOver={e=>e.currentTarget.style.color='rgba(255,255,255,0.55)'}
                                    onMouseOut={e=>e.currentTarget.style.color='rgba(255,255,255,0.2)'}>
                                    <LogOut size={11}/> Выйти из аккаунта
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Waves */}
            <div className="relative z-10 flex-shrink-0 overflow-hidden" style={{height:72}}>
                <svg className="hp-wave-c" viewBox="0 0 2880 72" fill="none" preserveAspectRatio="none"
                     style={{position:'absolute',bottom:16,width:'200%',height:'80%'}}>
                    <path stroke={theme.waveColor3} strokeWidth="1.2" strokeLinecap="round" opacity="0.55"
                          d="M0,22 C240,10 480,10 720,22 C960,34 1200,34 1440,22 C1680,10 1920,10 2160,22 C2400,34 2640,34 2880,22"/>
                </svg>
                <svg className="hp-wave-b" viewBox="0 0 2880 72" fill="none" preserveAspectRatio="none"
                     style={{position:'absolute',bottom:6,width:'200%',height:'90%'}}>
                    <path stroke={theme.waveColor2} strokeWidth="1.8" strokeLinecap="round" opacity="0.72"
                          d="M0,40 C240,56 480,56 720,40 C960,24 1200,24 1440,40 C1680,56 1920,56 2160,40 C2400,24 2640,24 2880,40"/>
                </svg>
                <svg className="hp-wave-a" viewBox="0 0 2880 72" fill="none" preserveAspectRatio="none"
                     style={{position:'absolute',bottom:0,width:'200%',height:'100%'}}>
                    <path stroke={theme.waveColor1} strokeWidth="2.5" strokeLinecap="round"
                          d="M0,50 C240,28 480,28 720,50 C960,66 1200,66 1440,50 C1680,28 1920,28 2160,50 C2400,66 2640,66 2880,50"/>
                </svg>
            </div>
        </div>
        </>
    );
};

export default HostelPickerScreen;
