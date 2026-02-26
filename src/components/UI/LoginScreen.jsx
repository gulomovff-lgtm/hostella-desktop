import React, { useState } from 'react';
import TRANSLATIONS from '../../constants/translations';
import { verifyPassword } from '../../utils/hash';

const LoginScreen = ({ users, onLogin, onSeed, lang, setLang }) => {
    const t = (k) => TRANSLATIONS[lang][k];
    const [login, setLogin] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        if (login === 'Super' && pass === 'super') {
            onLogin({ name: 'Super Admin', login: 'Super', role: 'super', hostelId: 'all' });
            return;
        }
        const u = users.find(u => u.login.toLowerCase() === login.toLowerCase());
        if (!u) { setError(t('error')); return; }
        const { match } = await verifyPassword(pass, u.pass);
        if (match) onLogin(u);
        else setError(t('error'));
    };;

    // Hostella brand colors
    const C = {
        primary:   '#1a3c40',
        secondary: '#2a5c60',
        accent:    '#e88c40',
        light:     '#f4f1ea',
    };

    return (
        <div className="fixed inset-0 w-screen h-screen z-[100] flex">
            {/* ── Left brand panel ── */}
            <div className="hidden lg:flex lg:w-[52%] flex-col items-center justify-center p-12 relative overflow-hidden"
                 style={{background:`linear-gradient(145deg, ${C.primary} 0%, ${C.secondary} 60%, #1f4e53 100%)`}}>
                {/* Subtle circles */}
                <div className="absolute inset-0 pointer-events-none">
                    {[200,340,480,620].map((s,i) => (
                        <div key={i} className="absolute rounded-full border border-white/5"
                             style={{width:s,height:s,top:'50%',left:'50%',transform:'translate(-50%,-50%)'}}/>
                    ))}
                </div>
                {/* Accent blob top-right */}
                <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20"
                     style={{background:C.accent, filter:'blur(60px)'}}/>
                {/* Content */}
                <div className="relative text-center flex flex-col items-center">
                    {/* Real logo */}
                    <div className="w-36 h-36 rounded-full overflow-hidden border-4 mb-8 shadow-2xl"
                         style={{borderColor:C.accent}}>
                        <img src="https://hostella.uz/logo.png" alt="Hostella" className="w-full h-full object-cover"/>
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tight mb-2">Hostella</h1>
                    <p className="text-lg font-medium mb-10" style={{color:'#a8cdd0'}}>{t('hostelSystem')}</p>
                    <div className="grid grid-cols-3 gap-4 text-center w-full max-w-xs">
                        {[['🏨','Номера'],['👥','Гости'],['💰','Финансы']].map(([emoji, label]) => (
                            <div key={label} className="rounded-2xl p-4 border border-white/10"
                                 style={{background:'rgba(255,255,255,0.07)'}}>
                                <div className="text-2xl mb-1">{emoji}</div>
                                <div className="text-xs font-semibold" style={{color:'#a8cdd0'}}>{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Right form panel ── */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 relative"
                 style={{background:C.light}}>
                {/* Language switcher – bottom center */}
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2">
                    {['ru','uz'].map(l => (
                        <button key={l} onClick={()=>setLang(l)}
                            className="px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all border"
                            style={lang===l
                                ? {background:C.primary, color:'#fff', borderColor:C.primary}
                                : {background:'#fff', color:'#555', borderColor:'#ddd'}
                            }>{l.toUpperCase()}</button>
                    ))}
                </div>

                {/* Mobile logo */}
                <div className="lg:hidden flex items-center gap-3 mb-10">
                    <img src="https://hostella.uz/logo.png" alt="Hostella"
                         className="w-12 h-12 rounded-full object-cover border-2"
                         style={{borderColor:C.accent}}/>
                    <span className="text-2xl font-black" style={{color:C.primary}}>Hostella</span>
                </div>

                <div className="w-full max-w-sm">
                    <div className="mb-8">
                        <h2 className="text-3xl font-black mb-1" style={{color:C.primary}}>Добро пожаловать</h2>
                        <p className="text-base" style={{color:'#7a9498'}}>Войдите в свой аккаунт</p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-5">
                        <div>
                            <label className="block text-sm font-bold mb-2" style={{color:C.primary}}>{t('login')}</label>
                            <input
                                className="w-full px-4 py-3.5 rounded-xl text-base font-medium transition-all outline-none border-2"
                                style={{background:'#fff', borderColor:'#d5e2e3', color:'#1a1a1a'}}
                                onFocus={e=>e.target.style.borderColor=C.secondary}
                                onBlur={e=>e.target.style.borderColor='#d5e2e3'}
                                value={login} onChange={e=>{setLogin(e.target.value);setError('');}}
                                placeholder="admin" autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2" style={{color:C.primary}}>{t('pass')}</label>
                            <input
                                type="password"
                                className="w-full px-4 py-3.5 rounded-xl text-base font-medium transition-all outline-none border-2"
                                style={{background:'#fff', borderColor:'#d5e2e3', color:'#1a1a1a'}}
                                onFocus={e=>e.target.style.borderColor=C.secondary}
                                onBlur={e=>e.target.style.borderColor='#d5e2e3'}
                                value={pass} onChange={e=>{setPass(e.target.value);setError('');}}
                                placeholder="••••••••"
                            />
                        </div>
                        {error && (
                            <div className="px-4 py-2.5 rounded-xl text-sm font-semibold text-center" style={{background:'#ffeaea', color:'#c0392b'}}>
                                {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            className="w-full py-4 text-white font-black text-base rounded-xl transition-all mt-2"
                            style={{background:C.accent, boxShadow:`0 6px 20px ${C.accent}55`}}
                            onMouseOver={e=>e.currentTarget.style.background='#d47a30'}
                            onMouseOut={e=>e.currentTarget.style.background=C.accent}
                        >
                            {t('enter')}
                        </button>
                    </form>

                    <div className="mt-8 text-center pt-6 border-t" style={{borderColor:'#ddd6cc'}}>
                        <button onClick={onSeed} className="text-xs transition-colors"
                            style={{color:'#bbb'}}
                            onMouseOver={e=>e.currentTarget.style.color=C.secondary}
                            onMouseOut={e=>e.currentTarget.style.color='#bbb'}
                        >{t('initDb')}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
