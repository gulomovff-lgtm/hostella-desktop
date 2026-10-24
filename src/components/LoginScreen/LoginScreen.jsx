import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import TRANSLATIONS from '../../constants/translations';
import { APP_VERSION } from '../../constants/config';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { functions, auth, db, PUBLIC_DATA_PATH } from '../../firebase';
import { findBlockingShift, blockingOwnerName } from '../../utils/shiftOccupancy';
import { X, Minus, Maximize2, Eye, EyeOff, Home, ChevronRight, LogOut } from 'lucide-react';
import OrnamentWall from './OrnamentWall';
import './LoginScreen.css';

/*
 * Экран входа (24.10.2026): слева стена-орнамент — один из семи восточных
 * узоров, случайный при каждом открытии (OrnamentWall, ornaments.js), справа
 * спокойная форма. Цвета — программы. Появление разовое; прежний фон (холст с
 * переливами, волны, облака, мерцающие звёзды) крутился бесконечно и в простое
 * грузил до двух ядер процессора.
 *
 * Логика входа не менялась: пароль проверяет сервер (authenticateUser), вход по
 * кастом-токену с правами, занятость смены — до входа в программу, выбор
 * хостела — только у кассира с несколькими хостелами, после пароля.
 */

/* --- Темы суток: ими по-прежнему пользуется окно выбора хостела (HostelPickerScreen) --- */
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

// Служебный супер-аккаунт (bootstrap). Логин фиксирован, пароль — по SHA-256-хешу.
// Логины и пароли на клиенте больше не сверяются — этим занимается Cloud Function
// authenticateUser (включая служебный супер-аккаунт).

export const getAutoThemeId = (h) => {
    if (h >= 5  && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'day';
    if (h >= 17 && h < 22) return 'evening';
    return 'night';
};


const LOADING_TEXT_KEYS = [
    'loginLoadPass',
    'loginLoadGuests',
    'loginLoadRooms',
    'loginLoadDb',
    'loginLoadPayments',
    'loginLoadData',
    'loginAlmostReady',
];


const GREET = {
    ru: { morning: ['Доброе', 'утро'], day: ['Добрый', 'день'], evening: ['Добрый', 'вечер'], night: ['Доброй', 'ночи'],
          lead: 'Войдите, чтобы открыть смену. Хостел определится по вашему логину.', locale: 'ru-RU' },
    uz: { morning: ['Xayrli', 'tong'], day: ['Xayrli', 'kun'], evening: ['Xayrli', 'kech'], night: ['Xayrli', 'tun'],
          lead: 'Smenani ochish uchun kiring. Hostel loginingiz bo‘yicha aniqlanadi.', locale: 'uz-UZ' },
};
const dayPart = (h) => h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'day' : h < 23 ? 'evening' : 'night';

const LoginScreen = ({ users, onLogin, lang = 'ru', setLang, hostelNames = {}, checkHostelShift, hasUpdate = false, updateDownloaded = false, updateProgress = null }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;
    const [login, setLogin]         = useState('');
    const [pass, setPass]           = useState('');
    const [error, setError]         = useState('');
    const [now, setNow]             = useState(() => new Date());
    // submitPhase: 'idle' | 'morphing' | 'loading' | 'success' | 'hostel-pick' | 'collapsing' | 'zooming'
    const [submitPhase, setSubmitPhase] = useState('idle');
    const [pendingUser, setPendingUser] = useState(null);
    const [showPass, setShowPass] = useState(false);
    const [capsOn, setCapsOn] = useState(false);
    const loginInputRef = useRef(null);
    const [loadingTextIdx, setLoadingTextIdx] = useState(0);
    const [hostelError, setHostelError] = useState(null); // { hostelId, occupiedBy }

    // Бейдж версии — он же индикатор обновления
    const verClass = updateDownloaded ? 'ready' : hasUpdate ? 'load' : '';
    const verSuffix = updateDownloaded ? ' ↑' : hasUpdate ? (updateProgress != null ? ` ${updateProgress}%` : ' ↓') : '';
    const updateTip = updateDownloaded ? t('tbUpdateReady') : (hasUpdate ? t('tbUpdateLoading') : '');

    // Открытые смены, снятые разово во время входа (до логина смены не подписаны)
    const openShiftsRef = useRef([]);

    // Тексты загрузки идут один раз и останавливаются на последнем
    useEffect(() => {
        if (submitPhase !== 'loading') return;
        setLoadingTextIdx(0);
        const id = setInterval(() => setLoadingTextIdx(i => {
            if (i >= LOADING_TEXT_KEYS.length - 1) { clearInterval(id); return i; }
            return i + 1;
        }), 700);
        return () => clearInterval(id);
    }, [submitPhase]);

    // Часы приветствия — раз в минуту (а не перерисовка всего экрана)
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => clearInterval(id);
    }, []);

    const isSubmitting = submitPhase !== 'idle';
    const isLoading    = ['morphing', 'loading'].includes(submitPhase);
    const isSuccess    = ['success', 'hostel-pick', 'collapsing', 'zooming'].includes(submitPhase);
    const leaving      = ['collapsing', 'zooming'].includes(submitPhase);
    const loadingPct   = isSuccess ? 100 : isLoading ? Math.round(((loadingTextIdx + 1) / LOADING_TEXT_KEYS.length) * 90) : 0;

    const g = GREET[lang] || GREET.ru;
    const [g1, g2] = g[dayPart(now.getHours())];
    const dateLine = useMemo(() => {
        let d;
        try { d = now.toLocaleDateString(g.locale, { weekday: 'long', day: 'numeric', month: 'long' }); }
        catch { d = now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }); }
        return d + ' · ' + now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }, [now, g.locale]);

    const checkCaps = (e) => { if (e.getModifierState) setCapsOn(e.getModifierState('CapsLock')); };

    // Разовый снимок открытых смен. Сбой не рвёт вход: занятость всё равно
    // перепроверяется в приложении, когда смены подпишутся.
    const fetchOpenShifts = async () => {
        try {
            const snap = await getDocs(query(
                collection(db, ...PUBLIC_DATA_PATH, 'shifts'),
                where('endTime', '==', null),
            ));
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.warn('[login] не удалось проверить занятость смены:', e?.message);
            return [];
        }
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        if (submitPhase !== 'idle') return;
        setError('');
        // Сбрасываем прогресс ДО начала анимации: иначе повторная попытка входа
        // стартовала с процента прошлой (полоса прыгала с 90% обратно на 13%).
        setLoadingTextIdx(0);
        setSubmitPhase('morphing');

        await new Promise(r => setTimeout(r, 420));
        setSubmitPhase('loading');

        try {
            // Пароль проверяет Cloud Function: на устройстве его сверять нельзя —
            // это давало бесконечные попытки подбора и требовало хранить хеши там,
            // где их может прочитать любой клиент.
            const authPromise = (async () => {
                const authenticate = httpsCallable(functions, 'authenticateUser');
                const res = await authenticate({ login: login.trim(), password: pass });
                const user = res?.data?.user;
                if (!user) throw new Error('wrongpass');
                // Переход с анонимного входа на реальную аутентификацию: входим по
                // кастомному токену с claims (role/hostelId). Правила базы требуют
                // эти claims, поэтому без токена работать НЕЛЬЗЯ: раньше ошибка
                // проглатывалась, кассир заходил на анонимной сессии и упирался в
                // «Нет доступа к данным». Лучше честно не пустить и дать повторить.
                const customToken = res?.data?.customToken;
                if (!customToken) throw new Error('noclaims');
                try { await signInWithCustomToken(auth, customToken); }
                catch (e) {
                    console.error('[auth] custom-token sign-in failed:', e?.message);
                    throw new Error('noclaims');
                }

                // Занятость смены проверяем ЗДЕСЬ, пока идут загрузочные надписи.
                // Раньше проверка работала по состоянию shifts, которое до входа
                // пустое: кассир проходил внутрь, дожидался полной загрузки и только
                // потом видел блокировку. Теперь снимаем открытые смены разово сами
                // (уже с правами — после входа по кастом-токену).
                if (user.role === 'cashier') {
                    openShiftsRef.current = await fetchOpenShifts();
                    const multiHostel = (user.allowedHostels || []).length > 1;
                    if (!multiHostel) {
                        const blocking = findBlockingShift(openShiftsRef.current, users, {
                            hostelId: user.hostelId, userId: user.id, userLogin: user.login,
                        });
                        if (blocking) {
                            const err = new Error('shiftbusy');
                            err.occupiedBy = blockingOwnerName(blocking, users, t('shaOtherCashier'));
                            throw err;
                        }
                    }
                }
                return user;
            })();

            // Ждём ответ сервера, но не меньше двух текстов (1.4 c), чтобы анимация
            // не мигала. Досиживать весь список больше не заставляем: вход шёл
            // фиксированные ~5 секунд даже когда сервер отвечал сразу.
            const minDelay = new Promise(r => setTimeout(r, 2 * 700));
            const [user] = await Promise.all([authPromise, minDelay]);
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
        } catch (e) {
            setSubmitPhase('idle');
            // Сервер сам объясняет блокировку («попробуйте через N мин») и отсутствие
            // настроенного супер-пароля — такие сообщения показываем как есть.
            const serverSaid = (e?.code === 'functions/resource-exhausted' || e?.code === 'functions/failed-precondition')
                ? e?.message : '';
            // Сбой связи или ошибка сервера — это НЕ «неверный пароль»: иначе кассир
            // будет вслепую перебирать пароли, пока проблема совсем в другом.
            const isFailure = e?.code === 'functions/internal' || e?.code === 'functions/unavailable'
                || e?.code === 'functions/deadline-exceeded' || e?.code === 'functions/not-found';
            // Логин с паролем прошёл, но права (claims) выдать не удалось. Пускать
            // нельзя — в базе всё равно ничего не откроется. Говорим прямо, что дело
            // не в пароле, иначе кассир начнёт его перебирать.
            if (e?.message === 'noclaims') { setError(t('loginNoClaims')); return; }
            // Смена в хостеле занята — пароль тут ни при чём, говорим прямо и сразу,
            // не пуская кассира внутрь ждать полной загрузки.
            if (e?.message === 'shiftbusy') { setError(t('loginShiftBusy').replace('{name}', e.occupiedBy || '')); return; }
            setError(serverSaid || (isFailure ? t('loginServerUnavailable') : t('error')));
        }
    };

    const handleHostelSelect = useCallback((hostelId) => {
        // Проверяем занятость смены в этом хостеле
        // Смотрим на смены, снятые при входе (в приложении они до логина не подписаны),
        // и лишь затем — на состояние приложения как запасной вариант.
        const blocking = findBlockingShift(openShiftsRef.current, users, {
            hostelId, userId: pendingUser?.id, userLogin: pendingUser?.login,
        });
        const occupied = blocking
            ? blockingOwnerName(blocking, users, t('shaOtherCashier'))
            : (checkHostelShift ? checkHostelShift(hostelId, pendingUser?.id, pendingUser?.login) : null);
        if (occupied) {
            setHostelError({ hostelId, occupiedBy: occupied });
            return; // без анимации
        }
        setHostelError(null);
        const finalUser = { ...pendingUser, selectedHostel: hostelId };
        setSubmitPhase('collapsing');
        setTimeout(() => {
            setSubmitPhase('zooming');
            setTimeout(() => onLogin?.(finalUser), 1200);
        }, 600);
    }, [pendingUser, onLogin, checkHostelShift, users, t]);

    const motto = <>MEHMONXONA <i>·</i> HOSTEL <i>·</i> ХОСТЕЛ</>;

    return (
        <div className={`hl-root tg-fullscreen${leaving ? ' leaving' : ''}`}>
            <OrnamentWall logoSrc={`${import.meta.env.BASE_URL}Logo.png`} motto={motto} />

            <section className="hl-side">
                <div className="hl-top">
                    <div className="hl-brand">HOSTELL<span>A</span></div>
                    <div className="hl-tools">
                        <div className="hl-lang" role="group" aria-label="Язык / Til">
                            {['ru', 'uz'].map(l => (
                                <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang?.(l)}>{l.toUpperCase()}</button>
                            ))}
                        </div>
                        <span className={`hl-ver ${verClass}`} title={updateTip}>v{APP_VERSION}{verSuffix}</span>
                        {window.electronAPI && (
                            <div className="hl-win">
                                <button type="button" aria-label="Свернуть" onClick={() => window.electronAPI.minimize()}><Minus size={14} /></button>
                                <button type="button" aria-label="Развернуть" onClick={async () => { const m = await window.electronAPI.isMaximized(); m ? window.electronAPI.restore() : window.electronAPI.maximize(); }}><Maximize2 size={13} /></button>
                                <button type="button" className="close" aria-label="Закрыть" onClick={() => window.electronAPI.close()}><X size={14} /></button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="hl-form-wrap">
                    {submitPhase === 'hostel-pick' ? (
                        /* ── Выбор хостела: только у кассира с несколькими хостелами ── */
                        <>
                            <div className="hl-greet">
                                <div className="hl-date">{t('loginMultipleHostels')}</div>
                                <h1>{t('loginSelectHostel')}</h1>
                            </div>
                            <div className="hl-hostels">
                                {(pendingUser?.allowedHostels || []).map(hid => (
                                    <button key={hid} type="button" className="hl-hostel" onClick={() => { setHostelError(null); handleHostelSelect(hid); }}>
                                        <span className="ic"><Home size={18} /></span>
                                        <span><b>{hostelNames[hid] || hid}</b><small>{t('loginClickToEnter')}</small></span>
                                        <ChevronRight size={18} style={{ marginLeft: 'auto', color: 'var(--hl-ink-2)' }} />
                                    </button>
                                ))}
                                {hostelError && (
                                    <div className="hl-error" role="alert">
                                        {t('loginShiftOpen')}. {hostelNames[hostelError.hostelId] || hostelError.hostelId}: {t('loginNowWorking')} <b>{hostelError.occupiedBy}</b>
                                    </div>
                                )}
                                <button type="button" className="hl-back" onClick={() => { setSubmitPhase('idle'); setHostelError(null); }}>
                                    <LogOut size={14} style={{ verticalAlign: '-2px', marginRight: 6 }} />{t('logout')}
                                </button>
                            </div>
                        </>
                    ) : (
                        /* ── Вход ── */
                        <>
                            <div className="hl-greet">
                                <div className="hl-date">{dateLine}</div>
                                <h1>{g1} <em>{g2}</em></h1>
                                <p>{g.lead}</p>
                            </div>
                            <form className="hl-form" onSubmit={handleAuth} noValidate>
                                <div className="hl-field">
                                    <label htmlFor="hl-login">{t('login')}</label>
                                    <div className="hl-input">
                                        <input id="hl-login" ref={loginInputRef} type="text" name="username" value={login}
                                            onChange={e => { setLogin(e.target.value); setError(''); }}
                                            disabled={isSubmitting} autoComplete="username" autoCapitalize="off" spellCheck={false} autoFocus
                                            placeholder={t('loginPlaceholderLogin')} />
                                    </div>
                                </div>
                                <div className="hl-field">
                                    <label htmlFor="hl-pass"><span>{t('pass')}</span>{capsOn && <span className="hl-caps">Caps Lock</span>}</label>
                                    <div className="hl-input pw">
                                        <input id="hl-pass" type={showPass ? 'text' : 'password'} name="password" value={pass}
                                            onChange={e => { setPass(e.target.value); setError(''); }}
                                            onKeyDown={checkCaps} onKeyUp={checkCaps} onBlur={() => setCapsOn(false)}
                                            disabled={isSubmitting} autoComplete="current-password" placeholder={t('loginPlaceholderPass')} />
                                        <button type="button" className="hl-eye" tabIndex={-1} onClick={() => setShowPass(s => !s)}
                                            aria-label={showPass ? 'Скрыть пароль' : 'Показать пароль'}>
                                            {showPass ? <EyeOff size={19} /> : <Eye size={19} />}
                                        </button>
                                    </div>
                                </div>

                                {error && <div className="hl-error" role="alert">{error}</div>}

                                {(isLoading || isSuccess) && (
                                    <div className="hl-progress" aria-live="polite">
                                        <div className="hl-progress-head"><span>{t('loginProgressData')}</span><b>{loadingPct}%</b></div>
                                        <div className="hl-progress-bar"><i style={{ width: loadingPct + '%' }} /></div>
                                        <div className="hl-progress-step">{t(LOADING_TEXT_KEYS[loadingTextIdx])}</div>
                                    </div>
                                )}

                                <button type="submit" className={`hl-go${isSuccess ? ' ok' : ''}`} disabled={isSubmitting}>
                                    {isLoading ? (<><span className="hl-spin" />{t('loginPleaseWait')}</>)
                                        : isSuccess ? '✓'
                                        : (<>{t('enter')}<kbd>Enter</kbd></>)}
                                </button>
                            </form>
                        </>
                    )}
                </div>

                <div className="hl-foot"><span>HOSTELLA · {t('hostelSystem')}</span></div>
            </section>
        </div>
    );
};

export default LoginScreen;
