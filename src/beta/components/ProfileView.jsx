import React, { useMemo } from 'react';
import {
    Clock, Wallet, UserPlus, TrendingUp, Sun, Moon, Lock, LogOut,
    ExternalLink, Power, ShieldCheck, Users, BedDouble, CalendarDays,
} from 'lucide-react';

const fmtMoney = (n) => (n || 0).toLocaleString('ru-RU');
const getLocalDateString = (d) => {
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 10);
};
const durLabel = (ms) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
};

const ROLE_LABEL = { super: 'Супер-админ', admin: 'Администратор', cashier: 'Кассир' };

const Kpi = ({ icon: Icon, tone, label, value, sub }) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center gap-2 mb-1.5">
            <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${tone}`}><Icon size={15} /></span>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
        </div>
        <div className="text-xl font-black text-slate-800 tabular-nums">{value}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
);

const ProfileView = ({
    currentUser, hostels = {}, shifts = [], payments = [], expenses = [], guests = [], usersList = [], rooms = [],
    theme, setTheme,
    onChangePassword, onOpenShift, onLogout, inMainApp,
}) => {
    const me = currentUser || {};
    const isCashier = me.role !== 'admin' && me.role !== 'super';
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const monthPrefix = todayStr.slice(0, 7);
    const ymd = (d) => (d ? getLocalDateString(new Date(d)) : '');

    const mine = useMemo(() => {
        const isMine = (sid) => sid === me.id || (me.login && sid === me.login);
        const myPay = (payments || []).filter(p => isMine(p.staffId) && p.type !== 'cash_to_terminal');
        const myExp = (expenses || []).filter(e => isMine(e.staffId));
        const myShifts = (shifts || [])
            .filter(s => isMine(s.staffId) || (me.login && s.staffLogin === me.login))
            .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        const active = myShifts.find(s => !s.endTime) || null;

        const payToday = myPay.filter(p => ymd(p.date) === todayStr);
        const payMonth = myPay.filter(p => ymd(p.date).slice(0, 7) === monthPrefix);
        const expToday = myExp.filter(e => ymd(e.date) === todayStr);
        const checkinsToday = (guests || []).filter(g => isMine(g.staffId) && ymd(g.createdAt) === todayStr && g.status !== 'booking').length;

        const monthShifts = myShifts.filter(s => (s.startTime || '').slice(0, 7) === monthPrefix);
        const monthHours = monthShifts.reduce((sum, s) => {
            const end = s.endTime ? new Date(s.endTime) : now;
            return sum + Math.max(0, end - new Date(s.startTime));
        }, 0);

        // Прошлый месяц — для сравнения
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthPrefix = getLocalDateString(prevMonthDate).slice(0, 7);
        const prevMonthSum = myPay
            .filter(p => ymd(p.date).slice(0, 7) === prevMonthPrefix)
            .reduce((s, p) => s + (parseInt(p.amount) || 0), 0);

        // Принято по дням — последние 14 дней
        const days14 = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 86400000);
            const ds = getLocalDateString(d);
            days14.push({
                ds,
                day: d.getDate(),
                sum: myPay.filter(p => ymd(p.date) === ds).reduce((s, p) => s + (parseInt(p.amount) || 0), 0),
            });
        }

        // Принято за каждую из последних смен
        const recent = myShifts.slice(0, 5).map(s => {
            const st = new Date(s.startTime).getTime();
            const en = s.endTime ? new Date(s.endTime).getTime() : Date.now();
            const taken = myPay
                .filter(p => { const t = new Date(p.date).getTime(); return t >= st && t <= en; })
                .reduce((sum, p) => sum + (parseInt(p.amount) || 0), 0);
            return { ...s, taken, durMs: en - st };
        });

        return {
            active,
            todaySum: payToday.reduce((s, p) => s + (parseInt(p.amount) || 0), 0),
            todayCount: payToday.length,
            expTodaySum: expToday.reduce((s, e) => s + (parseInt(e.amount) || 0), 0),
            expTodayCount: expToday.length,
            checkinsToday,
            monthSum: payMonth.reduce((s, p) => s + (parseInt(p.amount) || 0), 0),
            monthShiftCount: monthShifts.length,
            monthHours,
            prevMonthSum,
            days14,
            recent,
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payments, expenses, shifts, guests, me.id, me.login, todayStr]);

    const team = useMemo(() => ({
        staff: (usersList || []).filter(u => u.role === 'cashier').length,
        openShifts: (shifts || []).filter(s => !s.endTime && usersList.some(u => u.id === s.staffId)).length,
        rooms: (rooms || []).length,
        beds: (rooms || []).reduce((s, r) => s + parseInt(r.capacity || 0), 0),
    }), [usersList, shifts, rooms]);

    const hostelName = me.hostelId === 'all' ? 'Все хостелы' : (hostels[me.hostelId]?.name || me.hostelId || '—');

    return (
        <div className="max-w-4xl mx-auto">
            {/* ── Шапка профиля ── */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 mb-5"
                style={{ background: 'linear-gradient(135deg, var(--nav-bg) 0%, #14494f 100%)' }}>
                <div className="flex flex-wrap items-center gap-4 p-5 md:p-6">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white"
                            style={{ background: 'linear-gradient(140deg,#e88c40,#c86a20)' }}>
                            {(me.name || '?')[0].toUpperCase()}
                        </div>
                        {mine.active && (
                            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-400 border-[3px] flex items-center justify-center"
                                style={{ borderColor: '#14494f' }} title="Смена открыта" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-lg font-black text-white truncate">{me.name || me.login}</div>
                        <div className="text-xs font-bold mt-0.5" style={{ color: '#9ecdd0' }}>
                            {ROLE_LABEL[me.role] || me.role} · {hostelName}
                        </div>
                        {isCashier && (
                            <div className="text-[11px] mt-1.5 font-semibold" style={{ color: mine.active ? '#6ee7b7' : 'rgba(158,205,208,0.6)' }}>
                                {mine.active
                                    ? `Смена открыта в ${new Date(mine.active.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} · уже ${durLabel(now - new Date(mine.active.startTime))}`
                                    : 'Смена не открыта'}
                            </div>
                        )}
                    </div>
                    {isCashier && mine.active && (
                        <button onClick={() => onOpenShift?.()}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-white bg-rose-500/90 hover:bg-rose-500 transition-colors">
                            <Power size={14} /> Закрыть смену
                        </button>
                    )}
                </div>
            </div>

            {/* ── Личная статистика ── */}
            {isCashier ? (
                <>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Моя смена сегодня</div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                        <Kpi icon={TrendingUp} tone="bg-emerald-50 text-emerald-600" label="Принято"
                            value={fmtMoney(mine.todaySum)} sub={`${mine.todayCount} оплат`} />
                        <Kpi icon={UserPlus} tone="bg-teal-50 text-teal-600" label="Заселено"
                            value={mine.checkinsToday} sub="гостей за сегодня" />
                        <Kpi icon={Wallet} tone="bg-rose-50 text-rose-600" label="Расходы"
                            value={fmtMoney(mine.expTodaySum)} sub={`${mine.expTodayCount} записей`} />
                        <Kpi icon={Clock} tone="bg-indigo-50 text-indigo-600" label="В смене"
                            value={mine.active ? durLabel(now - new Date(mine.active.startTime)) : '—'} sub={mine.active ? 'и идёт' : 'не открыта'} />
                    </div>

                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Мой месяц</div>
                    <div className="grid grid-cols-3 gap-3 mb-5">
                        <Kpi icon={CalendarDays} tone="bg-indigo-50 text-indigo-600" label="Смен" value={mine.monthShiftCount} sub={`${Math.round(mine.monthHours / 3600000)} часов`} />
                        <Kpi icon={TrendingUp} tone="bg-emerald-50 text-emerald-600" label="Принято за месяц" value={fmtMoney(mine.monthSum)}
                            sub={mine.prevMonthSum > 0
                                ? <>пред. {fmtMoney(mine.prevMonthSum)} · <span className={mine.monthSum >= mine.prevMonthSum ? 'text-emerald-500 font-bold' : 'text-rose-400 font-bold'}>
                                    {mine.monthSum >= mine.prevMonthSum ? '+' : ''}{Math.round(((mine.monthSum - mine.prevMonthSum) / mine.prevMonthSum) * 100)}%</span></>
                                : 'UZS'} />
                        <Kpi icon={ShieldCheck} tone="bg-amber-50 text-amber-600" label="Средняя смена"
                            value={mine.monthShiftCount ? fmtMoney(Math.round(mine.monthSum / mine.monthShiftCount)) : '—'} sub="сум за смену" />
                    </div>

                    {/* Принято по дням — последние 14 дней */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-5">
                        <div className="flex items-baseline justify-between mb-3">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-500">Принято по дням</span>
                            <span className="text-[10px] text-slate-400">последние 14 дней</span>
                        </div>
                        {(() => {
                            const max = Math.max(1, ...mine.days14.map(d => d.sum));
                            return (
                                <div className="flex items-end gap-1" style={{ height: 72 }}>
                                    {mine.days14.map((d, i) => {
                                        const isToday = i === mine.days14.length - 1;
                                        const h = d.sum > 0 ? Math.max(4, Math.round((d.sum / max) * 64)) : 2;
                                        return (
                                            <div key={d.ds} className="flex-1 flex flex-col items-center gap-1 min-w-0"
                                                title={`${d.ds}: ${fmtMoney(d.sum)} сум`}>
                                                <div className={`w-full rounded-t-md transition-all duration-300 ${
                                                    isToday ? 'bg-orange-500' : d.sum > 0 ? 'bg-orange-200' : 'bg-slate-100'}`}
                                                    style={{ height: h }} />
                                                <span className={`text-[8.5px] tabular-nums leading-none ${isToday ? 'text-orange-500 font-black' : 'text-slate-300 font-bold'}`}>{d.day}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>

                    {mine.recent.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-5">
                            <div className="px-4 py-3 border-b border-slate-100 text-xs font-black uppercase tracking-wider text-slate-500">Последние смены</div>
                            {mine.recent.map(s => (
                                <div key={s.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-b-0 hover:bg-slate-50 transition-colors">
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.endTime ? 'bg-slate-300' : 'bg-emerald-400'}`} />
                                    <span className="w-24 text-[12.5px] font-bold text-slate-700 tabular-nums flex-shrink-0">
                                        {new Date(s.startTime).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                                    </span>
                                    <span className="flex-1 text-[12px] text-slate-400">{s.endTime ? durLabel(s.durMs) : 'идёт сейчас'}</span>
                                    <span className="text-[12.5px] font-black text-emerald-600 tabular-nums">+{fmtMoney(s.taken)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">Под управлением</div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                        <Kpi icon={Users} tone="bg-indigo-50 text-indigo-600" label="Кассиров" value={team.staff} sub="в команде" />
                        <Kpi icon={Clock} tone="bg-emerald-50 text-emerald-600" label="Смен открыто" value={team.openShifts} sub="прямо сейчас" />
                        <Kpi icon={BedDouble} tone="bg-teal-50 text-teal-600" label="Комнат" value={team.rooms} sub={`${team.beds} мест`} />
                        <Kpi icon={ShieldCheck} tone="bg-amber-50 text-amber-600" label="Роль" value={ROLE_LABEL[me.role] || '—'} sub="полный доступ" />
                    </div>
                </>
            )}

            {/* ── Настройки и безопасность ── */}
            <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 text-xs font-black uppercase tracking-wider text-slate-500">Оформление</div>
                    <div className="p-4">
                        <div className="text-[11px] font-bold text-slate-400 mb-2">Тема</div>
                        <div className="flex gap-2 mb-4">
                            {[{ id: 'green', Icon: Sun, label: 'Светлая' }, { id: 'dark', Icon: Moon, label: 'Тёмная' }].map(t => (
                                <button key={t.id} onClick={() => setTheme?.(t.id)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                                        theme === t.id
                                            ? 'bg-orange-500 text-white border-orange-500'
                                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                                    <t.Icon size={13} /> {t.label}
                                </button>
                            ))}
                        </div>
                        <div className="text-[11px] font-bold text-slate-400 mb-2">Язык</div>
                        <div className="flex gap-2">
                            <button className="flex-1 py-2 rounded-xl text-xs font-bold bg-orange-500 text-white border border-orange-500">Русский</button>
                            <button disabled title="Скоро в бете"
                                className="flex-1 py-2 rounded-xl text-xs font-bold bg-white text-slate-300 border border-slate-200 cursor-not-allowed">
                                O'zbekcha · скоро
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 text-xs font-black uppercase tracking-wider text-slate-500">Безопасность и выход</div>
                    <div className="p-4 flex flex-col gap-2">
                        <button onClick={() => onChangePassword?.()}
                            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors">
                            <Lock size={14} className="text-slate-400" /> Сменить пароль
                        </button>
                        <button onClick={() => { window.location.href = '/'; }}
                            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors">
                            <ExternalLink size={14} className="text-slate-400" /> Открыть основное приложение
                        </button>
                        <button onClick={() => onLogout?.()}
                            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-500 border border-rose-100 hover:bg-rose-50 transition-colors">
                            <LogOut size={14} /> Выйти из беты
                        </button>
                        <p className="text-[10.5px] text-slate-400 mt-1 leading-relaxed">
                            Пароль общий с основным приложением. Закрытие смены разлогинит вас на всех устройствах — так задумано.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileView;
