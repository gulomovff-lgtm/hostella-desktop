import React, { useMemo } from 'react';
import {
    ShieldCheck, ShieldAlert, DollarSign, CreditCard, QrCode, FileText, Calendar, Phone,
    MapPin, Wallet, History, LogOut, CheckCircle2, Trash2, X
} from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

const getTotalPaid = (g) => (typeof g.amountPaid === 'number' ? g.amountPaid : ((g.paidCash || 0) + (g.paidCard || 0) + (g.paidQR || 0)));

const ClientHistoryModal = ({ client, guests, users, rooms, currentUser, onClose, onRepeatStay, onCheckOut, onActivateBooking, onDeleteGuest, lang }) => {
    if (!client) return null;
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super';

    const history = useMemo(() =>
        guests.filter(g =>
            (g.passport && client.passport && g.passport === client.passport) ||
            (g.fullName && g.fullName.toLowerCase() === client.fullName.toLowerCase())
        ).sort((a, b) => new Date(b.checkInDate) - new Date(a.checkInDate)),
    [client, guests]);

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row" style={{height:'88vh'}}>

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
                                        {stay.paidCash > 0  && <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-semibold"><DollarSign size={11}/> {(+stay.paidCash).toLocaleString()}</span>}
                                        {stay.paidCard > 0  && <span className="flex items-center gap-1 bg-sky-50 text-sky-700 px-2 py-1 rounded-lg font-semibold"><CreditCard size={11}/> {(+stay.paidCard).toLocaleString()}</span>}
                                        {stay.paidQR > 0    && <span className="flex items-center gap-1 bg-violet-50 text-violet-700 px-2 py-1 rounded-lg font-semibold"><QrCode size={11}/> {(+stay.paidQR).toLocaleString()}</span>}
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
    );
};

export default ClientHistoryModal;
