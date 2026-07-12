import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet, DollarSign, CreditCard, QrCode, ArrowRightLeft } from 'lucide-react';

const getLocalDateString = (d) => {
    const off = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - off).toISOString().slice(0, 10);
};

const fmtMoney = (n) => (n || 0).toLocaleString('ru-RU');
const fmtTime = (dt) => {
    const d = new Date(dt);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Разбор оплаты по методам — та же логика, что в DashboardView
const methodOf = (p, key, legacy) =>
    (p[key] !== undefined ? parseInt(p[key]) || 0 : p.method === legacy ? parseInt(p.amount) || 0 : 0);

const MoneyBeta = ({ payments = [], expenses = [], onOpenExpense, onOpenShift }) => {
    const todayStr = getLocalDateString(new Date());
    const ymd = (d) => (d ? getLocalDateString(new Date(d)) : '');

    const data = useMemo(() => {
        const payToday = payments.filter(p => ymd(p.date) === todayStr);
        const expToday = expenses.filter(e => ymd(e.date) === todayStr);

        const incomeToday = payToday.reduce((s, p) => s + (parseInt(p.amount) || 0), 0);
        const expenseToday = expToday.reduce((s, e) => s + (parseInt(e.amount) || 0), 0);

        const byCash = payToday.reduce((s, p) => s + methodOf(p, 'cash', 'cash'), 0);
        const byCard = payToday.reduce((s, p) => s + methodOf(p, 'card', 'card'), 0);
        const byQR = payToday.reduce((s, p) => s + methodOf(p, 'qr', 'qr'), 0);
        const byTransfer = payToday.reduce((s, p) => s + methodOf(p, 'transfer', 'transfer'), 0);

        // Последние события дня (оплаты + расходы) по времени
        const feed = [
            ...payToday.map(p => ({ t: p.date, kind: 'pay', label: p.guestName || 'Оплата', amount: parseInt(p.amount) || 0 })),
            ...expToday.map(e => ({ t: e.date, kind: 'exp', label: e.description || e.category || 'Расход', amount: parseInt(e.amount) || 0 })),
        ].sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 12);

        // 7 дней: доход/расход по дням + сравнение недель (инкассацию не считаем доходом)
        const realPay = payments.filter(p => p.type !== 'cash_to_terminal');
        const days7 = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(Date.now() - i * 86400000);
            const ds = getLocalDateString(d);
            days7.push({
                ds, day: d.getDate(), isToday: ds === todayStr,
                inc: realPay.filter(p => ymd(p.date) === ds).reduce((s, p) => s + (parseInt(p.amount) || 0), 0),
                exp: expenses.filter(e => ymd(e.date) === ds).reduce((s, e) => s + (parseInt(e.amount) || 0), 0),
            });
        }
        const sumRange = (from, to) => { // дней назад: [from, to)
            let s = 0;
            for (let i = from; i < to; i++) {
                const ds = getLocalDateString(new Date(Date.now() - i * 86400000));
                s += realPay.filter(p => ymd(p.date) === ds).reduce((x, p) => x + (parseInt(p.amount) || 0), 0);
            }
            return s;
        };
        const week = sumRange(0, 7);
        const prevWeek = sumRange(7, 14);
        const weekDelta = prevWeek > 0 ? Math.round(((week - prevWeek) / prevWeek) * 100) : null;

        return { incomeToday, expenseToday, byCash, byCard, byQR, byTransfer, feed, payCount: payToday.length, expCount: expToday.length, days7, week, weekDelta };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [payments, expenses, todayStr]);

    const methods = [
        { label: 'Наличные', value: data.byCash, icon: DollarSign, color: 'bg-emerald-400' },
        { label: 'Карта', value: data.byCard, icon: CreditCard, color: 'bg-indigo-400' },
        { label: 'QR / Click', value: data.byQR, icon: QrCode, color: 'bg-purple-400' },
        { label: 'Перечисление', value: data.byTransfer, icon: ArrowRightLeft, color: 'bg-sky-400' },
    ];
    const maxMethod = Math.max(1, ...methods.map(m => m.value));

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-1">
                <h1 className="text-xl md:text-2xl font-black text-slate-800">Деньги</h1>
                <span className="text-sm text-slate-400">касса за сегодня — то, что спросят при закрытии смены</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 mb-5">
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><TrendingUp size={15} /></span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Доход сегодня</span>
                    </div>
                    <div className="text-xl font-black text-slate-800 tabular-nums">{fmtMoney(data.incomeToday)}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{data.payCount} оплат · UZS</div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center"><TrendingDown size={15} /></span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Расходы сегодня</span>
                    </div>
                    <div className="text-xl font-black text-slate-800 tabular-nums">{fmtMoney(data.expenseToday)}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{data.expCount} записей</div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Wallet size={15} /></span>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Сверка: в кассе</span>
                    </div>
                    <div className="text-xl font-black text-slate-800 tabular-nums">{fmtMoney(data.incomeToday - data.expenseToday)}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">доход − расходы за день</div>
                </div>
            </div>

            {/* Неделя: доход/расход по дням */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-4">
                <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Последние 7 дней</span>
                    <span className="text-[11px] text-slate-400">
                        неделя: <b className="text-slate-700 tabular-nums">{fmtMoney(data.week)}</b>
                        {data.weekDelta !== null && (
                            <span className={`ml-2 font-black ${data.weekDelta >= 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
                                {data.weekDelta >= 0 ? '↑' : '↓'} {Math.abs(data.weekDelta)}% к прошлой
                            </span>
                        )}
                    </span>
                </div>
                {(() => {
                    const max = Math.max(1, ...data.days7.flatMap(d => [d.inc, d.exp]));
                    return (
                        <div className="flex items-end gap-2" style={{ height: 88 }}>
                            {data.days7.map(d => (
                                <div key={d.ds} className="flex-1 flex flex-col items-center gap-1 min-w-0"
                                    title={`${d.ds} · доход ${fmtMoney(d.inc)} · расход ${fmtMoney(d.exp)}`}>
                                    <div className="w-full flex items-end justify-center gap-[3px]" style={{ height: 72 }}>
                                        <div className={`w-[38%] rounded-t-md transition-all duration-300 ${d.isToday ? 'bg-emerald-500' : 'bg-emerald-300'}`}
                                            style={{ height: d.inc > 0 ? Math.max(4, (d.inc / max) * 72) : 2 }} />
                                        <div className="w-[38%] rounded-t-md bg-rose-300 transition-all duration-300"
                                            style={{ height: d.exp > 0 ? Math.max(4, (d.exp / max) * 72) : 2 }} />
                                    </div>
                                    <span className={`text-[9px] tabular-nums leading-none ${d.isToday ? 'text-orange-500 font-black' : 'text-slate-300 font-bold'}`}>{d.day}</span>
                                </div>
                            ))}
                        </div>
                    );
                })()}
            </div>

            <div className="grid lg:grid-cols-2 gap-4 items-start">
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 text-xs font-black uppercase tracking-wider text-slate-500">По способам оплаты</div>
                    {methods.map(m => {
                        const Icon = m.icon;
                        return (
                            <div key={m.label} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-slate-50 transition-colors">
                                <Icon size={14} className="text-slate-400 flex-shrink-0" />
                                <span className="w-28 text-xs font-bold text-slate-500 flex-shrink-0">{m.label}</span>
                                <span className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                    <span className={`block h-full rounded-full transition-all duration-300 ${m.color}`} style={{ width: `${Math.round((m.value / maxMethod) * 100)}%` }} />
                                </span>
                                <span className="w-24 text-right text-[12.5px] font-bold text-slate-700 tabular-nums flex-shrink-0">{fmtMoney(m.value)}</span>
                            </div>
                        );
                    })}
                    <div className="px-4 py-3 bg-slate-50 flex items-center gap-3">
                        <button onClick={() => onOpenExpense?.()}
                            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors">
                            Записать расход
                        </button>
                        <button onClick={() => onOpenShift?.()}
                            className="px-4 py-2 rounded-lg bg-white border border-slate-200 hover:border-rose-200 hover:text-rose-500 text-slate-500 text-xs font-bold transition-colors">
                            Закрыть смену
                        </button>
                        <span className="text-[11px] text-slate-400">Обе операции пишут в общую базу — как из основного приложения.</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 text-xs font-black uppercase tracking-wider text-slate-500">Движения за сегодня</div>
                    {data.feed.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-slate-400">Сегодня движений пока нет.</div>
                    ) : data.feed.map((f, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-b-0 hover:bg-slate-50 transition-colors">
                            <span className="w-10 text-[11px] font-bold text-slate-400 tabular-nums flex-shrink-0">{fmtTime(f.t)}</span>
                            <span className="flex-1 text-[13px] font-semibold text-slate-700 truncate">{f.label}</span>
                            <span className={`text-[12.5px] font-black tabular-nums flex-shrink-0 ${f.kind === 'pay' ? 'text-emerald-600' : 'text-rose-500'}`}>
                                {f.kind === 'pay' ? '+' : '−'}{fmtMoney(f.amount)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MoneyBeta;
