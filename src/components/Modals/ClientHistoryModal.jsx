import React, { useMemo, useState } from 'react';
import {
    ShieldCheck, ShieldAlert, DollarSign, CreditCard, QrCode, FileText, Calendar, Phone,
    MapPin, Wallet, History, LogOut, CheckCircle2, Trash2, X, Plus, Banknote, ArrowRightLeft, Pencil
} from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import ClientEditModal from './ClientEditModal';

const getTotalPaid = (g) => (typeof g.amountPaid === 'number' ? g.amountPaid : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0)));

// ─── Top-up modal ─────────────────────────────────────────────────────────────
const METHODS = [
    { id: 'cash',     label: 'Наличные',  icon: Banknote,   color: 'emerald' },
    { id: 'terminal', label: 'Терминал',   icon: CreditCard, color: 'sky' },
    { id: 'qr',       label: 'QR / Перевод', icon: QrCode,     color: 'violet' },
];

const TopUpModal = ({ client, currentUser, onClose, onTopUp, onDeduct, mode = 'add' }) => {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('cash');
    const isSuper = currentUser?.role === 'super';
    const deduct = mode === 'deduct';
    const bal = client.balance || 0;
    const amt = parseInt(amount) || 0;
    const tooMuch = deduct && amt > bal;

    const handleSubmit = () => {
        if (!amt || amt <= 0) return;
        if (deduct) {
            onDeduct?.(client.id, Math.min(amt, bal));   // не уводим баланс в минус
        } else {
            onTopUp?.(client.id, amt, method, isSuper);   // супер → без кассы
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <div>
                        <div className="font-black text-slate-800">{deduct ? 'Списание с баланса' : 'Пополнение баланса'}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{client.fullName}</div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400"><X size={18}/></button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Current balance */}
                    <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${deduct ? 'bg-rose-50' : 'bg-blue-50'}`}>
                        <span className={`text-sm font-bold ${deduct ? 'text-rose-600' : 'text-blue-600'}`}>💳 Текущий баланс</span>
                        <span className={`text-lg font-black ${deduct ? 'text-rose-700' : 'text-blue-700'}`}>{bal.toLocaleString()} сум</span>
                    </div>

                    {/* Method — только при пополнении */}
                    {!deduct && (
                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase mb-2">Метод оплаты</div>
                            <div className="grid grid-cols-3 gap-2">
                                {METHODS.map(m => {
                                    const Icon = m.icon;
                                    const active = method === m.id;
                                    return (
                                        <button key={m.id} onClick={() => setMethod(m.id)}
                                            className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 font-bold text-xs transition-all ${
                                                active
                                                    ? `border-${m.color}-400 bg-${m.color}-50 text-${m.color}-700`
                                                    : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300'
                                            }`}>
                                            <Icon size={20}/>
                                            {m.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Amount */}
                    <div>
                        <div className="text-xs font-bold text-slate-400 uppercase mb-2">{deduct ? 'Сумма списания' : 'Сумма пополнения'}</div>
                        <input
                            type="number"
                            placeholder="0"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            autoFocus
                            className={`w-full px-4 py-3 text-xl font-black text-center rounded-xl border-2 border-slate-200 focus:outline-none bg-slate-50 ${deduct ? 'focus:border-rose-400' : 'focus:border-blue-400'}`}
                        />
                        {tooMuch && <div className="text-[11px] text-amber-600 font-semibold mt-1 text-center">Будет списано не больше текущего баланса ({bal.toLocaleString()})</div>}
                    </div>

                    {isSuper && !deduct && (
                        <div className="text-[11px] text-violet-600 font-semibold bg-violet-50 rounded-lg px-3 py-2 text-center">Пополнение супером не отражается в кассе</div>
                    )}

                    {/* Buttons */}
                    <div className="flex gap-3 pt-1">
                        <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50">Отмена</button>
                        <button
                            onClick={handleSubmit}
                            disabled={!amt || amt <= 0 || (deduct && bal <= 0)}
                            className={`flex-1 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed ${deduct ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                            {deduct ? '−' : '+'}{amt ? amt.toLocaleString() : 0} сум
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ClientHistoryModal = ({ client, guests, users, rooms, currentUser, onClose, onRepeatStay, onCheckOut, onActivateBooking, onDeleteGuest, onTopUpBalance, onAdjustBalance, onEditClient, lang }) => {
    if (!client) return null;
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';
    // Админ и Fazliddin могут только СПИСЫВАТЬ с баланса (не пополнять)
    const subtractOnly = currentUser?.role === 'admin' || currentUser?.login === 'fazliddin';
    const [topUpOpen, setTopUpOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);

    const handleTopUp = (id, amt, method, skipCashbox) => {
        onTopUpBalance?.(id, amt, method, skipCashbox);
    };
    const handleDeduct = (id, amt) => {
        if (onAdjustBalance) onAdjustBalance(id, -Math.abs(amt));
    };

    const history = useMemo(() => {
        const normP = p => (p || '').replace(/\s/g, '').toUpperCase();
        const normN = n => (n || '').trim().toLowerCase();
        return guests.filter(g =>
            (g.passport && client.passport && normP(g.passport) === normP(client.passport)) ||
            (g.fullName && normN(g.fullName) === normN(client.fullName))
        ).sort((a, b) => new Date(b.checkInDate) - new Date(a.checkInDate));
    }, [client, guests]);

    const stats = useMemo(() => history.reduce((acc, s) => {
        const paid = getTotalPaid(s);
        acc.totalSpent += paid;
        acc.totalDebt  += Math.max(0, (s.totalPrice||0) - paid);
        acc.nights     += parseInt(s.days) || 0;
        acc.stays      += 1;
        return acc;
    }, { totalSpent:0, totalDebt:0, nights:0, stays:0 }), [history]);

    const avgCheck  = stats.stays > 0 ? Math.round(stats.totalSpent / stats.stays) : 0;
    const trustGood = stats.totalDebt === 0;
    const initials  = client.fullName?.split(' ').map(w=>w[0]).slice(0,2).join('') || '?';
    const fmt = d => { try { return new Date(d).toLocaleDateString('ru',{day:'2-digit',month:'2-digit',year:'2-digit'}); } catch{ return '—'; }};
    const fmtFull = d => { try { return new Date(d).toLocaleDateString('ru',{day:'2-digit',month:'long',year:'numeric'}); } catch{ return '—'; }};

    const latestStay    = history[0] || client;
    const phone         = latestStay.phone         || client.phone         || '—';
    const passport      = latestStay.passport      || client.passport      || '—';
    const birthDate     = latestStay.birthDate     || client.birthDate;
    const passportIssue = latestStay.passportIssueDate || client.passportIssueDate;
    const country       = latestStay.country       || client.country       || '—';

    return (
        <>
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 pb-[84px] sm:pb-4 animate-in fade-in duration-150">
            <div className="relative bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row" style={{height:'88vh', maxHeight:'calc(100dvh - 100px)'}}>

                {/* Always-visible close (mobile) */}
                <button onClick={onClose} className="md:hidden absolute top-3 right-3 z-20 w-9 h-9 flex items-center justify-center bg-white/95 border border-slate-200 rounded-full text-slate-500 shadow-md active:scale-95">
                    <X size={18}/>
                </button>

                {/* LEFT: Profile */}
                <div className="w-full md:w-72 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col shrink-0">
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shrink-0 ${trustGood ? 'bg-indigo-500' : 'bg-rose-500'}`}>
                                {initials}
                            </div>
                            <div className="min-w-0">
                                <h2 className="font-black text-slate-800 text-lg leading-tight break-words">{client.fullName}</h2>
                                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full mt-1 ${trustGood ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {trustGood ? <><ShieldCheck size={11}/> Надёжный</> : <><ShieldAlert size={11}/> Должник</>}
                                </span>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                            <div className="text-xs font-bold text-slate-400 uppercase">Личные данные</div>
                            {[
                                [FileText,  'Паспорт',       passport],
                                [Calendar,  'Дата рождения', birthDate  ? fmtFull(birthDate)  : '—'],
                                [FileText,  'Дата выдачи',   passportIssue ? fmtFull(passportIssue) : '—'],
                                [Phone,     'Телефон',       phone],
                                [MapPin,    'Страна',        country],
                            ].map(([Icon, label, val]) => (
                                <div key={label} className="flex items-start gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5"><Icon size={13} className="text-slate-500"/></div>
                                    <div className="min-w-0">
                                        <div className="text-[11px] text-slate-400 leading-none">{label}</div>
                                        <div className="font-semibold text-slate-700 text-sm break-words mt-0.5">{val}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
                            <div className="text-xs font-bold text-slate-400 uppercase">Аналитика</div>
                            {[
                                ['Визитов',    stats.stays,                       'text-slate-700'],
                                ['Ночей',      stats.nights,                      'text-slate-700'],
                                ['Потрачено',  stats.totalSpent.toLocaleString(), 'text-indigo-600'],
                                ['Средний чек',avgCheck.toLocaleString(),         'text-indigo-600'],
                                ['Долг',       stats.totalDebt > 0 ? stats.totalDebt.toLocaleString() : '0', stats.totalDebt > 0 ? 'text-rose-600 font-black' : 'text-emerald-600'],
                            ].map(([l, v, cl]) => (
                                <div key={l} className="flex justify-between text-sm">
                                    <span className="text-slate-400">{l}</span>
                                    <span className={`font-bold ${cl}`}>{v}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="shrink-0 p-4 border-t border-slate-200 bg-slate-50 space-y-2">
                        {/* Balance block */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-blue-600 uppercase">💳 Баланс счёта</span>
                                <span className="text-base font-black text-blue-700">{(client.balance || 0).toLocaleString()} сум</span>
                            </div>
                            <button onClick={() => setTopUpOpen(true)}
                                className={`w-full mt-2 py-1.5 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors ${subtractOnly ? 'text-rose-700 bg-rose-100 hover:bg-rose-200' : 'text-blue-700 bg-blue-100 hover:bg-blue-200'}`}>
                                {subtractOnly ? <><Trash2 size={12}/> Списать с баланса</> : <><Plus size={12}/> Пополнить</>}
                            </button>
                        </div>
                        {isAdmin && onEditClient && (
                            <button onClick={() => setEditOpen(true)}
                                className="w-full py-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors">
                                <Pencil size={14}/> Изменить данные
                            </button>
                        )}
                        <button onClick={() => { onRepeatStay(client); onClose(); }}
                            className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 flex items-center justify-center gap-2">
                            <History size={15}/> Повторить заезд
                        </button>
                        <button onClick={onClose}
                            className="w-full py-3 bg-white text-slate-500 border border-slate-200 rounded-xl font-bold text-sm hover:bg-slate-50">
                            Закрыть
                        </button>
                    </div>
                </div>

                {/* RIGHT: History */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                        <span className="font-black text-slate-800">История проживания</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">{history.length} визит.</span>
                            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400"><X size={18}/></button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                        {history.length === 0 ? (
                            <div className="text-center text-slate-400 py-16 text-sm">Нет данных о проживании</div>
                        ) : history.map((stay, i) => {
                            const paid   = getTotalPaid(stay);
                            const debt   = (stay.totalPrice||0) - paid;
                            const active = stay.status === 'active';
                            const booking= stay.status === 'booking';
                            const isDebt = stay.status === 'debt';
                            const canAct = isAdmin && (active || booking);

                            return (
                                <div key={stay.id||i} className={`bg-white rounded-xl border p-4 ${
                                    active  ? 'border-indigo-300 ring-2 ring-indigo-100' :
                                    booking ? 'border-amber-300 ring-2 ring-amber-50' :
                                    isDebt  ? 'border-rose-200 ring-1 ring-rose-50' :
                                              'border-slate-200'
                                }`}>
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div>
                                            <div className="font-black text-slate-800 text-base leading-tight">
                                                {isDebt ? 'Доп. оплата / Долг' : `Комната ${stay.roomNumber} · Место ${stay.bedId}`}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-0.5">
                                                {fmtFull(stay.checkInDate)} → {fmtFull(stay.checkOutDate)}
                                            </div>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap shrink-0 ${
                                            active  ? 'bg-indigo-100 text-indigo-700' :
                                            booking ? 'bg-amber-100 text-amber-700' :
                                            isDebt  ? 'bg-rose-100 text-rose-700' :
                                            debt>0  ? 'bg-rose-100 text-rose-700' :
                                                      'bg-slate-100 text-slate-500'
                                        }`}>
                                            {active ? 'Живёт' : booking ? 'Бронь' : isDebt ? (debt > 0 ? 'Долг' : 'Оплачен') : debt > 0 ? 'Долг' : 'Выселен'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                        {[['Дней', stay.days],['Тариф', parseInt(stay.pricePerNight||0).toLocaleString()],['Итого', (stay.totalPrice||0).toLocaleString()]].map(([l,v])=>(
                                            <div key={l} className="bg-slate-50 rounded-lg p-2 text-center">
                                                <div className="text-[10px] text-slate-400">{l}</div>
                                                <div className="font-black text-slate-700 text-sm">{v}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-3 flex-wrap text-xs mb-3">
                                        {stay.paidCash > 0     && <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-semibold"><DollarSign size={11}/> {(+stay.paidCash).toLocaleString()}</span>}
                                        {stay.paidCard > 0     && <span className="flex items-center gap-1 bg-sky-50 text-sky-700 px-2 py-1 rounded-lg font-semibold"><CreditCard size={11}/> {(+stay.paidCard).toLocaleString()}</span>}
                                        {stay.paidQR > 0       && <span className="flex items-center gap-1 bg-violet-50 text-violet-700 px-2 py-1 rounded-lg font-semibold"><QrCode size={11}/> {(+stay.paidQR).toLocaleString()}</span>}
                                        {stay.paidTransfer > 0 && <span className="flex items-center gap-1 bg-orange-50 text-orange-700 px-2 py-1 rounded-lg font-semibold"><ArrowRightLeft size={11}/> {(+stay.paidTransfer).toLocaleString()}</span>}
                                        <span className={`ml-auto font-black ${debt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                            {debt > 0 ? `Долг: ${debt.toLocaleString()}` : `✓ Оплачено`}
                                        </span>
                                    </div>

                                    {canAct && (
                                        <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                                            {active && (
                                                <button
                                                    onClick={() => { if (window.confirm(`Выселить ${stay.fullName} из комнаты ${stay.roomNumber}?`)) { onCheckOut(stay, { totalPrice: stay.totalPrice || 0, refundAmount: 0 }); onClose(); } }}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-bold border border-amber-200 transition-colors">
                                                    <LogOut size={13}/> Выселить
                                                </button>
                                            )}
                                            {booking && (
                                                <button
                                                    onClick={() => { if (window.confirm(`Активировать заезд ${stay.fullName}?`)) { onActivateBooking(stay); onClose(); } }}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-200 transition-colors">
                                                    <CheckCircle2 size={13}/> Заселить
                                                </button>
                                            )}
                                            <button
                                                onClick={() => { if (window.confirm(`Удалить запись о проживании ${stay.fullName}?`)) onDeleteGuest(stay); }}
                                                className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-bold border border-rose-200 transition-colors ml-auto">
                                                <Trash2 size={13}/> Удалить запись
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>

        {topUpOpen && (
            <TopUpModal
                client={client}
                currentUser={currentUser}
                mode={subtractOnly ? 'deduct' : 'add'}
                onClose={() => setTopUpOpen(false)}
                onTopUp={handleTopUp}
                onDeduct={handleDeduct}
            />
        )}

        {editOpen && (
            <ClientEditModal
                client={client}
                lang={lang}
                onClose={() => setEditOpen(false)}
                onSave={(form) => { onEditClient?.(form); setEditOpen(false); }}
            />
        )}
        </>
    );
};

export default ClientHistoryModal;
