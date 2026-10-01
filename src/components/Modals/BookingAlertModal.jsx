import React from 'react';
import { Globe, Phone, CalendarDays, BedDouble, X, ChevronRight, MessageCircle, PhoneCall } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';

const HOSTELS = { hostel1: 'Хостел №1', hostel2: 'Хостел №2' };

const fmtDate = (iso) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); }
    catch { return iso; }
};

/**
 * Большое окно-напоминание о необработанных бронях с сайта/бота.
 * Закрывается ТОЛЬКО вручную (клик по фону не закрывает) — чтобы кассир
 * не пропустил заявку. Повторно всплывает каждые 6 часов, пока брони висят.
 */
const BookingAlertModal = ({ bookings = [], onAccept, onClose, lang = 'ru' }) => {
    const t = k => TRANSLATIONS[lang]?.[k] || k;
    if (!bookings.length) return null;
    return (
        <div className="fixed inset-0 z-[350] flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '92vh' }}>
                {/* Шапка */}
                <div className="shrink-0 px-6 py-5 flex items-center gap-4" style={{ background: 'linear-gradient(135deg,#1a3c40,#0f9688)' }}>
                    <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center text-3xl shrink-0 animate-pulse">🔔</div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-xl font-black text-white leading-tight">
                            {bookings.length === 1 ? t('bamNewOne') : t('bamPending').replace('{n}', bookings.length)}
                        </h2>
                        <p className="text-sm text-teal-100/80 mt-0.5">{t('bamSubtitle')}</p>
                    </div>
                </div>

                {/* Список броней */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50">
                    {bookings.map(b => (
                        <div key={b.id} className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-4 py-2.5 flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 flex-wrap">
                                {b.channel === 'telegram'
                                    ? <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#229ED9] uppercase bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">✈️ {t('bamTgChat')}</span>
                                    : <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#e88c40] uppercase bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200"><Globe size={10}/> {t('bamWebsite')}</span>}
                                <span className="text-xs font-bold text-slate-500">{HOSTELS[b.hostelId] || b.hostelId}</span>
                                {b.bookingCode && <span className="text-[10px] font-black font-mono text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">{b.bookingCode}</span>}
                                <span className="ml-auto text-[11px] text-slate-400">{b.createdAt ? fmtDate(b.createdAt) : ''}</span>
                            </div>
                            <div className="p-4">
                                <div className="text-lg font-black text-slate-800">{b.fullName || '—'}</div>
                                {/* Телефон — крупно, главное действие кассира */}
                                <div className="mt-2 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                                    <PhoneCall size={18} className="text-emerald-600 shrink-0" />
                                    <span className="text-lg font-black text-emerald-700 tracking-wide select-all">{b.phone || t('bamNoPhone')}</span>
                                    <span className="ml-auto text-[11px] font-bold text-emerald-500 uppercase">{t('bamCallGuest')}</span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                                    <span className="flex items-center gap-1.5 text-slate-600"><CalendarDays size={14} className="text-slate-400" /><b>{fmtDate(b.checkInDate)}</b>{b.days ? t('bamDaysSuffix').replace('{n}', b.days) : ''}</span>
                                    {b.beds > 0 && <span className="flex items-center gap-1.5 text-slate-600"><BedDouble size={14} className="text-slate-400" /><b>{b.beds}</b> {t('bamBeds')}{b.bedType ? ` (${b.bedType === 'upper' ? t('bamUpper') : t('bamLower')})` : ''}</span>}
                                    {(b.seatedCount || 0) > 0 && <span className="font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-xs">{t('bamSeatedOf').replace('{n}', b.seatedCount).replace('{total}', b.beds)}</span>}
                                    {b.totalPrice > 0 && <span className="font-black text-slate-700">{Number(b.totalPrice).toLocaleString()} {t('alSum')}{b.channel === 'telegram' && <span className="ml-1 text-[10px] font-bold text-sky-600">{t('bkNegotiated')}</span>}</span>}
                                    {!b.depositMoved && (Number(b.amountPaid) || 0) > 0 && <span className="font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-xs">{t('bamDeposit').replace('{n}', Number(b.amountPaid).toLocaleString())}</span>}
                                </div>
                                {b.comment && <div className="mt-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5">💬 {b.comment}</div>}
                                {/* Сводка переписки с ботом: что просил дополнительно, как говорить */}
                                {b.chatSummary && (
                                    <div className="mt-2 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2.5">
                                        <div className="flex items-center gap-1.5 text-[11px] font-black text-sky-700 uppercase mb-1">
                                            <MessageCircle size={12} /> {t('bamFromBot')}
                                        </div>
                                        <div className="text-sm text-sky-900 whitespace-pre-line">{b.chatSummary}</div>
                                    </div>
                                )}
                                <button onClick={() => onAccept(b)}
                                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[#1a3c40] hover:bg-[#2a5c60] text-white text-sm font-black transition-all active:scale-[0.98]">
                                    <BedDouble size={15} strokeWidth={2.5} />
                                    {(b.seatedCount || 0) > 0
                                        ? t('bamSeatNext').replace('{n}', (b.seatedCount || 0) + 1).replace('{total}', b.beds)
                                        : t('bamConfirmPick')}
                                    <ChevronRight size={14} strokeWidth={3} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Подвал: закрыть можно только сознательно */}
                <div className="shrink-0 px-5 py-4 bg-white border-t border-slate-200">
                    <button onClick={onClose}
                        className="w-full py-3 rounded-xl border-2 border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                        <X size={15} /> {t('bamCloseRemind')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BookingAlertModal;
