import React, { useState, useMemo, useCallback } from 'react';
import { LogOut, Copy, X, DollarSign, CreditCard, Smartphone, Lock, CheckCircle, AlertTriangle, RotateCcw } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { computeShiftReport, buildShiftTelegramMsg, buildShiftReportText } from '../../utils/shiftReport';

const MODAL_STYLE = `
    @keyframes scm-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes scm-card-in { from { opacity: 0; transform: scale(0.96) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    .scm-backdrop { animation: scm-backdrop-in 0.2s ease forwards; }
    .scm-card { animation: scm-card-in 0.28s cubic-bezier(0.34,1.3,0.64,1) forwards; will-change: transform, opacity; }
`;

const ShiftClosingModal = ({ user, payments = [], expenses = [], onClose, onLogout, notify, onEndShift, lang, sendTelegramMessage }) => {
    const t = useCallback((k) => TRANSLATIONS[lang][k], [lang]);
    const [confirming, setConfirming] = useState(false);
    const isDark = useMemo(() => document.documentElement.dataset.theme === 'dark', []);

    // Расчёт сверки — общий с бетой (utils/shiftReport), логика не менялась
    const report = useMemo(() => computeShiftReport(user, payments, expenses), [user, payments, expenses]);
    const { income, totalRefunds, cashboxExpenses, totalRevenue, cashInHand } = report;

    const handleEndShiftWithNotify = useCallback(() => {
        sendTelegramMessage(buildShiftTelegramMsg(user, report), 'shiftEnd');
        onEndShift();
    }, [user, report, sendTelegramMessage, onEndShift]);

    const copyReport = useCallback(async () => {
        const text = buildShiftReportText(user, report);
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                notify('\u2705 \u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043e!', 'success');
            } else {
                const el = document.createElement('textarea');
                el.value = text;
                el.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
                document.body.appendChild(el);
                el.focus(); el.select();
                try { document.execCommand('copy'); notify('\u2705 \u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043e!', 'success'); }
                catch { notify('\u041e\u0448\u0438\u0431\u043a\u0430 \u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f', 'error'); }
                document.body.removeChild(el);
            }
        } catch { notify('\u041e\u0448\u0438\u0431\u043a\u0430 \u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f', 'error'); }
    }, [user, report, notify]);

    return (
        <>
            <style>{MODAL_STYLE}</style>
            <div className="scm-backdrop fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(15,30,32,0.7)' }}>
                <div className="scm-card" style={{ background: isDark ? '#162a2e' : '#fff', borderRadius: 24, width: '100%', maxWidth: 560, display: 'flex', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.35)', minHeight: 380 }}>

                    {/* == Left dark column == */}
                    <div style={{ width: 190, background: '#1a3c40', display: 'flex', flexDirection: 'column', padding: '30px 22px', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(94,234,212,0.06)', pointerEvents: 'none' }}/>
                        <div style={{ position: 'absolute', bottom: -20, left: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(94,234,212,0.04)', pointerEvents: 'none' }}/>
                        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(94,234,212,0.12)', border: '1px solid rgba(94,234,212,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                            <Lock size={20} color="#5eead4"/>
                        </div>
                        <div style={{ color: 'rgba(158,205,208,0.55)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>{t('shiftClose')}</div>
                        <div style={{ color: '#e2f7f8', fontSize: 16, fontWeight: 800, lineHeight: 1.35, marginBottom: 4 }}>{user.name}</div>
                        <div style={{ color: 'rgba(158,205,208,0.45)', fontSize: 11, marginBottom: 'auto' }}>
                            {new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                        </div>
                        <div style={{ padding: '14px 0 0', borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 28 }}>
                            <div style={{ color: 'rgba(94,234,212,0.45)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 5 }}>{t('cashInHand')}</div>
                            <div style={{ color: '#5eead4', fontSize: 30, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>{cashInHand.toLocaleString()}</div>
                        </div>
                    </div>

                    {/* == Right light column == */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e2f7f8' : '#0f172a' }}>{t('shiftClose')}</div>
                            <button onClick={onClose} style={{ background: isDark ? '#1e3a3e' : '#f8fafc', border: 'none', borderRadius: 8, padding: 7, cursor: 'pointer', color: isDark ? '#9ecdd0' : '#94a3b8', display: 'flex' }}
                                onMouseEnter={e => e.currentTarget.style.background= isDark ? '#2d4e52' : '#e2e8f0'}
                                onMouseLeave={e => e.currentTarget.style.background= isDark ? '#1e3a3e' : '#f8fafc'}>
                                <X size={15}/>
                            </button>
                        </div>

                        <div style={{ padding: '16px 24px', flex: 1, overflowY: 'auto' }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Поступления</div>
                            {[
                                { icon: <DollarSign size={13}/>, label: t('cash'), value: income.cash, color: '#0f9688', bg: isDark ? 'rgba(15,150,136,0.15)' : '#f0fdfa', dot: '#0f9688' },
                                { icon: <CreditCard size={13}/>, label: t('card'), value: income.card, color: isDark ? '#60a5fa' : '#2563eb', bg: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff', dot: isDark ? '#60a5fa' : '#3b82f6' },
                                { icon: <Smartphone size={13}/>, label: t('qr'),   value: income.qr,   color: isDark ? '#a78bfa' : '#7c3aed', bg: isDark ? 'rgba(124,58,237,0.15)' : '#f5f3ff', dot: isDark ? '#a78bfa' : '#7c3aed' },
                            ].map(({ icon, label, value, color, bg, dot }) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 10px', borderRadius: 10, marginBottom: 4, background: bg, border: `1px solid ${dot}22` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color }}>{icon}<span style={{ fontSize: 13, color: isDark ? '#9ecdd0' : '#475569', fontWeight: 500 }}>{label}</span></div>
                                    <span style={{ color: isDark ? '#e2f7f8' : '#0f172a', fontWeight: 700, fontSize: 14 }}>{value.toLocaleString()}</span>
                                </div>
                            ))}

                            {income.transfer > 0 && (Object.entries(income.transferByEntity || {}).length > 0
                                ? Object.entries(income.transferByEntity).map(([entity, amt]) => (
                                    <div key={entity} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 10px', borderRadius: 10, marginBottom: 4, background: isDark ? 'rgba(20,184,166,0.12)' : '#f0fdfa', border: `1px solid ${isDark ? 'rgba(20,184,166,0.2)' : 'rgba(94,234,212,0.3)'}` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 13 }}>🏦</span>
                                            <span style={{ fontSize: 13, color: isDark ? '#9ecdd0' : '#475569', fontWeight: 500 }}>{entity}</span>
                                        </div>
                                        <span style={{ color: isDark ? '#e2f7f8' : '#0f172a', fontWeight: 700, fontSize: 14 }}>{amt.toLocaleString()}</span>
                                    </div>
                                ))
                                : (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 10px', borderRadius: 10, marginBottom: 4, background: isDark ? 'rgba(20,184,166,0.12)' : '#f0fdfa', border: `1px solid ${isDark ? 'rgba(20,184,166,0.2)' : 'rgba(94,234,212,0.3)'}` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontSize: 13 }}>🏦</span>
                                            <span style={{ fontSize: 13, color: isDark ? '#9ecdd0' : '#475569', fontWeight: 500 }}>Перечисление</span>
                                        </div>
                                        <span style={{ color: isDark ? '#e2f7f8' : '#0f172a', fontWeight: 700, fontSize: 14 }}>{income.transfer.toLocaleString()}</span>
                                    </div>
                                )
                            )}

                            {totalRefunds > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 10px', borderRadius: 10, marginBottom: 4, background: isDark ? 'rgba(249,115,22,0.12)' : '#fff7ed', border: `1px solid ${isDark ? 'rgba(249,115,22,0.2)' : 'rgba(253,186,116,0.3)'}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <RotateCcw size={13} color="#f97316"/>
                                        <span style={{ fontSize: 13, color: '#ea580c', fontWeight: 500 }}>{t('refund')}</span>
                                    </div>
                                    <span style={{ color: '#ea580c', fontWeight: 700, fontSize: 14 }}>-{totalRefunds.toLocaleString()}</span>
                                </div>
                            )}

                            {(cashboxExpenses - totalRefunds) > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 10px', borderRadius: 10, marginBottom: 4, background: isDark ? 'rgba(239,68,68,0.12)' : '#fff5f5', border: `1px solid ${isDark ? 'rgba(239,68,68,0.2)' : 'rgba(254,202,202,0.3)'}` }}>
                                <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 500 }}>{t('expense')}</span>
                                <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 14 }}>-{(cashboxExpenses - totalRefunds).toLocaleString()}</span>
                            </div>
                            )}

                            <div style={{ padding: '13px 16px', background: isDark ? 'rgba(15,150,136,0.15)' : 'linear-gradient(135deg,#f0fdfa,#ccfbf1)', borderRadius: 12, marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${isDark ? 'rgba(94,234,212,0.25)' : '#99f6e4'}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <CheckCircle size={14} color="#0f9688"/>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#5eead4' : '#0f766e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('total')}</span>
                                </div>
                                <span style={{ fontSize: 22, fontWeight: 900, color: isDark ? '#e2f7f8' : '#0f172a', letterSpacing: '-0.02em' }}>{totalRevenue.toLocaleString()}</span>
                            </div>
                        </div>

                        {confirming ? (
                            <div style={{ padding: '20px 24px 22px', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9'}`, background: isDark ? 'rgba(217,119,6,0.08)' : '#fffbeb', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                    <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fef3c7', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <AlertTriangle size={16} color="#d97706"/>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#fde68a' : '#92400e', marginBottom: 3 }}>Подтвердите закрытие</div>
                                        <div style={{ fontSize: 12, color: isDark ? '#fbbf24' : '#78350f', lineHeight: 1.5 }}>В кассе остаётся <span style={{ fontWeight: 800, color: '#059669' }}>{cashInHand.toLocaleString()}</span> сум.</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={() => setConfirming(false)} style={{ flex: 1, padding: '11px', background: isDark ? '#1e3a3e' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, borderRadius: 12, color: isDark ? '#9ecdd0' : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Отмена</button>
                                    <button onClick={handleEndShiftWithNotify} style={{ flex: 2, padding: '11px', background: 'linear-gradient(135deg,#dc2626,#b91c1c)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 14px rgba(220,38,38,0.3)' }}
                                        onMouseEnter={e => e.currentTarget.style.opacity='0.9'}
                                        onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                                        <LogOut size={14}/> Да, закрыть смену
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: '12px 24px 20px', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9'}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <button onClick={copyReport} style={{ width: '100%', padding: '10px', background: isDark ? '#1e3a3e' : '#f8fafc', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, borderRadius: 12, color: isDark ? '#9ecdd0' : '#475569', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                                    onMouseEnter={e => e.currentTarget.style.background= isDark ? '#2d4e52' : '#f1f5f9'}
                                    onMouseLeave={e => e.currentTarget.style.background= isDark ? '#1e3a3e' : '#f8fafc'}>
                                    <Copy size={14}/> Копировать отчёт
                                </button>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button onClick={onClose} style={{ flex: 1, padding: '11px', background: isDark ? '#1e3a3e' : '#f8fafc', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, borderRadius: 12, color: isDark ? '#9ecdd0' : '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                                        onMouseEnter={e => e.currentTarget.style.background= isDark ? '#2d4e52' : '#f1f5f9'}
                                        onMouseLeave={e => e.currentTarget.style.background= isDark ? '#1e3a3e' : '#f8fafc'}>
                                        {t('cancel')}
                                    </button>
                                    <button onClick={() => setConfirming(true)} style={{ flex: 2, padding: '11px', background: 'linear-gradient(135deg,#0f9688,#0d7a6e)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 14px rgba(15,150,136,0.35)' }}
                                        onMouseEnter={e => e.currentTarget.style.opacity='0.9'}
                                        onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                                        <LogOut size={14}/> {t('shiftClose')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </>
    );
};

export default ShiftClosingModal;
