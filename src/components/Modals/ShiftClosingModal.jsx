import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { LogOut, Copy, X, DollarSign, CreditCard, Smartphone, Lock, CheckCircle, AlertTriangle, RotateCcw, ArrowRightLeft, ChevronLeft } from 'lucide-react';
import TRANSLATIONS from '../../constants/translations';
import { computeShiftReport, buildShiftTelegramMsg, buildShiftReportText } from '../../utils/shiftReport';

const MODAL_STYLE = `
    @keyframes scm-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes scm-card-in { from { opacity: 0; transform: scale(0.96) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    @keyframes scm-sheet-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
    .scm-backdrop { animation: scm-backdrop-in 0.2s ease forwards; }
    .scm-card { animation: scm-card-in 0.28s cubic-bezier(0.34,1.3,0.64,1) forwards; will-change: transform, opacity; }
    .scm-sheet { animation: scm-sheet-in 0.26s cubic-bezier(0.32,0.72,0,1) forwards; will-change: transform; }
`;

/** Телефон — вертикальная раскладка (шторка снизу). Планшет и десктоп — две колонки. */
const useIsPhone = () => {
    const q = '(max-width: 639px)';
    const [isPhone, setIsPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
    useEffect(() => {
        const mq = window.matchMedia(q);
        const onChange = (e) => setIsPhone(e.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);
    return isPhone;
};

const ShiftClosingModal = ({
    user, payments = [], expenses = [], onClose, onLogout, notify, onEndShift, lang, sendTelegramMessage,
    myShift = null, cashiersForTransfer = [], onTransferShift,
    opening = null, openingFrom = null,
}) => {
    const t = useCallback((k) => TRANSLATIONS[lang][k], [lang]);
    const [confirming, setConfirming] = useState(false);
    // Передача смены: null — обычный режим, иначе id выбранного напарника ('' — ещё не выбран)
    const [transferTo, setTransferTo] = useState(null);
    const isDark = useMemo(() => document.documentElement.dataset.theme === 'dark', []);
    const isPhone = useIsPhone();

    const canTransfer = !!(myShift && onTransferShift && cashiersForTransfer.length > 0);
    // Напарник в хостеле один — выбирать не из чего, подставляем сразу
    const openTransfer = () => setTransferTo(cashiersForTransfer.length === 1 ? cashiersForTransfer[0].id : '');
    const transferTarget = cashiersForTransfer.find(u => u.id === transferTo) || null;

    // Расчёт сверки — общий с бетой (utils/shiftReport).
    // opening — итоги смены, принятой от напарника: сутки не закончены, касса не
    // сдавалась, поэтому суммы складываются и сдаётся один общий отчёт за сутки.
    const report = useMemo(() => computeShiftReport(user, payments, expenses, opening),
        [user, payments, expenses, opening]);
    const { income, totalRefunds, cashboxExpenses, totalRevenue, cashInHand } = report;
    const otherExpenses = cashboxExpenses - totalRefunds;

    const handleEndShiftWithNotify = useCallback(() => {
        sendTelegramMessage(buildShiftTelegramMsg(user, report, lang), 'shiftEnd');
        onEndShift();
    }, [user, report, sendTelegramMessage, onEndShift, lang]);

    const copyReport = useCallback(async () => {
        const text = buildShiftReportText(user, report, lang);
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                notify(t('scmCopied'), 'success');
            } else {
                const el = document.createElement('textarea');
                el.value = text;
                el.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
                document.body.appendChild(el);
                el.focus(); el.select();
                try { document.execCommand('copy'); notify(t('scmCopied'), 'success'); }
                catch { notify(t('copyError'), 'error'); }
                document.body.removeChild(el);
            }
        } catch { notify(t('copyError'), 'error'); }
    }, [user, report, notify, t, lang]);

    const dateStr = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const money = (n) => (n || 0).toLocaleString('ru-RU');

    // ── Строка суммы ────────────────────────────────────────────────────────
    const Row = ({ icon, label, value, color, bg, border, sign = '' }) => (
        <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
            padding: isPhone ? '11px 12px' : '9px 10px', borderRadius: 10, marginBottom: 4,
            background: bg, border: `1px solid ${border}`,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, color }}>
                {icon}
                <span style={{ fontSize: 13, color: color || (isDark ? '#9ecdd0' : '#475569'), fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            <span style={{ color: color || (isDark ? '#e2f7f8' : '#0f172a'), fontWeight: 700, fontSize: isPhone ? 15 : 14, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {sign}{money(value)}
            </span>
        </div>
    );

    const incomeRows = [
        { key: 'cash', icon: <DollarSign size={13}/>, label: t('cash'), value: income.cash, color: '#0f9688', bg: isDark ? 'rgba(15,150,136,0.15)' : '#f0fdfa', border: '#0f968822' },
        { key: 'card', icon: <CreditCard size={13}/>, label: t('card'), value: income.card, color: isDark ? '#60a5fa' : '#2563eb', bg: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff', border: isDark ? '#60a5fa22' : '#3b82f622' },
        { key: 'qr',   icon: <Smartphone size={13}/>, label: t('qr'),   value: income.qr,   color: isDark ? '#a78bfa' : '#7c3aed', bg: isDark ? 'rgba(124,58,237,0.15)' : '#f5f3ff', border: isDark ? '#a78bfa22' : '#7c3aed22' },
    ];

    const transferEntries = Object.entries(income.transferByEntity || {});
    const transferStyle = {
        color: isDark ? '#5eead4' : '#0f766e',
        bg: isDark ? 'rgba(20,184,166,0.12)' : '#f0fdfa',
        border: isDark ? 'rgba(20,184,166,0.2)' : 'rgba(94,234,212,0.3)',
    };

    const sectionLabel = (text) => (
        <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '2px 0 8px' }}>{text}</div>
    );

    // ── Сверка (общая для обеих раскладок) ──────────────────────────────────
    const summary = (
        <>
            {sectionLabel(t('scmReceipts'))}
            {incomeRows.map(r => <Row key={r.key} {...r} />)}

            {income.transfer > 0 && (transferEntries.length > 0
                ? transferEntries.map(([entity, amt]) => (
                    <Row key={entity} icon={<span style={{ fontSize: 13 }}>🏦</span>} label={entity} value={amt} {...transferStyle} />
                ))
                : <Row icon={<span style={{ fontSize: 13 }}>🏦</span>} label={t('scmBankTransfer')} value={income.transfer} {...transferStyle} />
            )}

            {(totalRefunds > 0 || otherExpenses > 0) && sectionLabel(t('scmDeductions'))}
            {totalRefunds > 0 && (
                <Row icon={<RotateCcw size={13} color="#f97316"/>} label={t('refund')} value={totalRefunds} sign="−"
                    color="#ea580c" bg={isDark ? 'rgba(249,115,22,0.12)' : '#fff7ed'} border={isDark ? 'rgba(249,115,22,0.2)' : 'rgba(253,186,116,0.3)'} />
            )}
            {otherExpenses > 0 && (
                <Row icon={<LogOut size={13} color="#ef4444"/>} label={t('expense')} value={otherExpenses} sign="−"
                    color="#ef4444" bg={isDark ? 'rgba(239,68,68,0.12)' : '#fff5f5'} border={isDark ? 'rgba(239,68,68,0.2)' : 'rgba(254,202,202,0.3)'} />
            )}

            <div style={{
                padding: isPhone ? '14px 16px' : '13px 16px', borderRadius: 12, marginTop: 10,
                background: isDark ? 'rgba(15,150,136,0.15)' : 'linear-gradient(135deg,#f0fdfa,#ccfbf1)',
                border: `1px solid ${isDark ? 'rgba(94,234,212,0.25)' : '#99f6e4'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle size={14} color="#0f9688"/>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#5eead4' : '#0f766e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('total')}</span>
                </div>
                <span style={{ fontSize: isPhone ? 20 : 22, fontWeight: 900, color: isDark ? '#e2f7f8' : '#0f172a', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                    {money(totalRevenue)}
                </span>
            </div>
        </>
    );

    // ── Кнопки ──────────────────────────────────────────────────────────────
    const ghostBtn = {
        background: isDark ? '#1e3a3e' : '#f8fafc',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
        borderRadius: 12, color: isDark ? '#9ecdd0' : '#64748b',
        fontWeight: 600, fontSize: 13, cursor: 'pointer',
        padding: isPhone ? '13px' : '11px',
    };

    // ── Передача смены напарнику ────────────────────────────────────────────
    const transferPanel = (
        <div style={{
            padding: isPhone ? '14px 16px 18px' : '16px 24px 22px',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9'}`,
            background: isDark ? 'rgba(99,102,241,0.08)' : '#eef2ff',
            display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setTransferTo(null)} aria-label={t('back')}
                    style={{ background: 'transparent', border: 'none', padding: 2, cursor: 'pointer', color: isDark ? '#a5b4fc' : '#4f46e5', display: 'flex' }}>
                    <ChevronLeft size={18}/>
                </button>
                <div style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#c7d2fe' : '#3730a3' }}>{t('scmTransferShift')}</div>
            </div>

            {!transferTarget ? (
                <>
                    <div style={{ fontSize: 12, color: isDark ? '#a5b4fc' : '#4338ca', lineHeight: 1.5 }}>{t('scmWhoContinues')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                        {cashiersForTransfer.map(u => (
                            <button key={u.id} onClick={() => setTransferTo(u.id)}
                                style={{ padding: isPhone ? '13px 14px' : '11px 14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                                    background: isDark ? '#1e3a3e' : '#fff', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#c7d2fe'}`,
                                    color: isDark ? '#e2f7f8' : '#0f172a', fontWeight: 700, fontSize: 13 }}>
                                {u.name || u.login}
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                <>
                    <div style={{ fontSize: 12.5, color: isDark ? '#c7d2fe' : '#3730a3', lineHeight: 1.55 }}>
                        {t('scmContinuePre')}<b>{transferTarget.name || transferTarget.login}</b>{t('scmContinueMid')}<b>50/50</b>{t('scmContinueMid2')}<b>{money(cashInHand)}</b>{t('scmContinuePost')}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setTransferTo(cashiersForTransfer.length === 1 ? null : '')}
                            style={{ ...ghostBtn, flex: 1, background: isDark ? '#1e3a3e' : '#fff' }}>{t('back')}</button>
                        <button onClick={() => onTransferShift(myShift.id, transferTarget.id, {
                            cash: income.cash, card: income.card, qr: income.qr,
                            transfer: income.transfer, transferByEntity: income.transferByEntity,
                            refunds: totalRefunds, expenses: cashboxExpenses,
                        })}
                            style={{ flex: 2, padding: isPhone ? '13px' : '11px', background: 'linear-gradient(135deg,#4f46e5,#4338ca)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 14px rgba(79,70,229,0.35)' }}>
                            <ArrowRightLeft size={14}/> {t('scmTransfer5050')}
                        </button>
                    </div>
                </>
            )}
        </div>
    );

    const footer = transferTo !== null ? transferPanel : confirming ? (
        <div style={{
            padding: isPhone ? '16px 16px 18px' : '20px 24px 22px',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9'}`,
            background: isDark ? 'rgba(217,119,6,0.08)' : '#fffbeb',
            display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0,
        }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fef3c7', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AlertTriangle size={16} color="#d97706"/>
                </div>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#fde68a' : '#92400e', marginBottom: 3 }}>{t('scmConfirmClose')}</div>
                    <div style={{ fontSize: 12, color: isDark ? '#fbbf24' : '#78350f', lineHeight: 1.5 }}>
                        {t('scmCashRemainsPre')}<span style={{ fontWeight: 800, color: '#059669' }}>{money(cashInHand)}</span>{t('scmCashRemainsPost')}
                    </div>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirming(false)} style={{ ...ghostBtn, flex: 1, background: isDark ? '#1e3a3e' : '#fff' }}>{t('cancel')}</button>
                <button onClick={handleEndShiftWithNotify}
                    style={{ flex: 2, padding: isPhone ? '13px' : '11px', background: 'linear-gradient(135deg,#dc2626,#b91c1c)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 14px rgba(220,38,38,0.3)' }}>
                    <LogOut size={14}/> {t('scmYesClose')}
                </button>
            </div>
        </div>
    ) : (
        <div style={{
            padding: isPhone ? '12px 16px 16px' : '12px 24px 20px',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9'}`,
            display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0,
        }}>
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={copyReport} style={{ ...ghostBtn, flex: 1, color: isDark ? '#9ecdd0' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: isPhone ? '12px' : '10px' }}>
                    <Copy size={14}/> {t('reportSingular')}
                </button>
                {canTransfer && (
                    <button onClick={openTransfer}
                        title={t('scmTransferHint')}
                        style={{ ...ghostBtn, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: isPhone ? '12px' : '10px',
                            background: isDark ? 'rgba(99,102,241,0.15)' : '#eef2ff', border: `1px solid ${isDark ? 'rgba(129,140,248,0.3)' : '#c7d2fe'}`, color: isDark ? '#c7d2fe' : '#4338ca' }}>
                        <ArrowRightLeft size={14}/> {t('scmTransfer')}
                    </button>
                )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} style={{ ...ghostBtn, flex: 1 }}>{t('cancel')}</button>
                <button onClick={() => setConfirming(true)}
                    style={{ flex: 2, padding: isPhone ? '13px' : '11px', background: 'linear-gradient(135deg,#0f9688,#0d7a6e)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 4px 14px rgba(15,150,136,0.35)' }}>
                    <LogOut size={14}/> {t('shiftClose')}
                </button>
            </div>
        </div>
    );

    const closeBtn = (
        <button onClick={onClose} aria-label={t('cancel')}
            style={{ background: isPhone ? 'rgba(255,255,255,0.1)' : (isDark ? '#1e3a3e' : '#f8fafc'), border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', color: isPhone ? '#9ecdd0' : (isDark ? '#9ecdd0' : '#94a3b8'), display: 'flex', flexShrink: 0 }}>
            <X size={16}/>
        </button>
    );

    // ── Телефон: шторка снизу ───────────────────────────────────────────────
    if (isPhone) {
        return (
            <>
                <style>{MODAL_STYLE}</style>
                <div className="scm-backdrop fixed inset-0 z-[200] flex items-end justify-center" style={{ background: 'rgba(15,30,32,0.7)' }}>
                    <div className="scm-sheet" role="dialog" aria-modal="true" aria-label={t('shiftClose')}
                        style={{
                            background: isDark ? '#162a2e' : '#fff',
                            borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '92dvh',
                            display: 'flex', flexDirection: 'column', overflow: 'hidden',
                            boxShadow: '0 -12px 40px rgba(0,0,0,0.35)',
                            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                        }}>

                        {/* Шапка: кассир, дата и касса — одним блоком, без узкой колонки */}
                        <div style={{ background: 'linear-gradient(135deg,#1a3c40 0%,#14494f 100%)', padding: '14px 16px 16px', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 13, background: 'rgba(94,234,212,0.12)', border: '1px solid rgba(94,234,212,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Lock size={18} color="#5eead4"/>
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ color: 'rgba(158,205,208,0.55)', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('shiftClose')}</div>
                                    <div style={{ color: '#e2f7f8', fontSize: 16, fontWeight: 800, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                                    <div style={{ color: 'rgba(158,205,208,0.45)', fontSize: 11 }}>
                                        {dateStr}{openingFrom ? ` · ${t('scmAcceptedFrom').replace('{name}', openingFrom)}` : ''}
                                    </div>
                                </div>
                                {closeBtn}
                            </div>
                            <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 14, background: 'rgba(94,234,212,0.1)', border: '1px solid rgba(94,234,212,0.2)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                                <span style={{ color: 'rgba(94,234,212,0.7)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('cashInHand')}</span>
                                <span style={{ color: '#5eead4', fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{money(cashInHand)}</span>
                            </div>
                        </div>

                        {/* Сверка — единственная прокручиваемая область */}
                        <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1, minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
                            {summary}
                        </div>

                        {footer}
                    </div>
                </div>
            </>
        );
    }

    // ── Планшет и десктоп: две колонки, как раньше ──────────────────────────
    return (
        <>
            <style>{MODAL_STYLE}</style>
            <div className="scm-backdrop fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: 'rgba(15,30,32,0.7)' }}>
                <div className="scm-card" role="dialog" aria-modal="true" aria-label={t('shiftClose')}
                    style={{ background: isDark ? '#162a2e' : '#fff', borderRadius: 24, width: '100%', maxWidth: 560, display: 'flex', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.35)', minHeight: 380, maxHeight: '92dvh' }}>

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
                            {dateStr}{openingFrom ? <><br/>{t('scmAcceptedFrom').replace('{name}', openingFrom)}</> : null}
                        </div>
                        <div style={{ padding: '14px 0 0', borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 28 }}>
                            <div style={{ color: 'rgba(94,234,212,0.45)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 5 }}>{t('cashInHand')}</div>
                            <div style={{ color: '#5eead4', fontSize: 30, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{money(cashInHand)}</div>
                        </div>
                    </div>

                    {/* == Right light column == */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#f1f5f9'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#e2f7f8' : '#0f172a' }}>{t('shiftClose')}</div>
                            {closeBtn}
                        </div>

                        <div style={{ padding: '16px 24px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
                            {summary}
                        </div>

                        {footer}
                    </div>

                </div>
            </div>
        </>
    );
};

export default ShiftClosingModal;
