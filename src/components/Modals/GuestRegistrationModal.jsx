import React, { useState, useRef } from 'react';
import {
    X, User, Phone, FileText, Calendar, Wallet, CreditCard, QrCode,
    CheckCircle2, ChevronDown, ScanLine
} from 'lucide-react';
import { COUNTRIES } from '../../constants/countries';
import TRANSLATIONS from '../../constants/translations';

// --- MRZ Parser (simplified) ---
const parseMRZ = (raw) => {
    const lines = raw.replace(/\r/g, '\n').split('\n').map(l => l.trim()).filter(l => l.length >= 20);
    if (!lines.length) return null;
    const line1 = lines.find(l => /^P</i.test(l)) || lines[0] || '';
    const line2 = lines.find(l => l !== line1 && /^[A-Z0-9]{9}/.test(l)) || lines[1] || '';
    let fullName = '';
    if (line1.length >= 10) {
        const section = line1.slice(5, 44).replace(/</g, ' ').trim().replace(/\s{2,}/, '  ');
        const parts = section.split(/  +/);
        const surname = (parts[0] || '').replace(/ /g, '');
        const first = (parts.slice(1).join(' ') || '').trim();
        fullName = [surname, first].filter(Boolean).join(' ');
    }
    const passport = line2 ? line2.slice(0, 9).replace(/</g, '').trim() : '';
    const natCode = line2 ? line2.slice(10, 13) : '';
    const bdRaw = line2 ? line2.slice(13, 19) : '';
    let birthDate = '';
    if (bdRaw.length === 6 && /^\d+$/.test(bdRaw)) {
        const yy = parseInt(bdRaw.slice(0, 2));
        const year = yy > 30 ? 1900 + yy : 2000 + yy;
        birthDate = `${year}-${bdRaw.slice(2, 4)}-${bdRaw.slice(4, 6)}`;
    }
    const NAT = {
        UZB: 'Узбекистан', RUS: 'Россия', KAZ: 'Казахстан', KGZ: 'Кыргызстан',
        TJK: 'Таджикистан', TKM: 'Туркмения', UKR: 'Украина', BLR: 'Белоруссия',
        GBR: 'Великобритания', USA: 'США', DEU: 'Германия', FRA: 'Франция',
        CHN: 'Китай', IND: 'Индия', TUR: 'Турция', ARE: 'ОАЭ',
        AZE: 'Азербайджан', ARM: 'Армения', GEO: 'Грузия', MNG: 'Монголия',
    };
    const country = NAT[natCode] || '';
    return { fullName, passport, birthDate, country };
};

// ─── Main Component ────────────────────────────────────────────────────────────
const GuestRegistrationModal = ({ onClose, onSubmit, lang, currentUser, notify }) => {
    const t = (k) => TRANSLATIONS[lang]?.[k] || k;

    const today = new Date();
    const todayStr = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 10);

    const [form, setForm] = useState({
        fullName: '',
        passport: '',
        birthDate: '',
        country: 'Узбекистан',
        phone: '',
        startDate: todayStr,
        days: '30',
        paidCash: '',
        paidCard: '',
        paidQR: '',
        note: '',
    });

    const [mrzOpen, setMrzOpen] = useState(false);
    const [mrzText, setMrzText] = useState('');
    const mrzRef = useRef(null);

    const endDate = (() => {
        try {
            const d = new Date(form.startDate + 'T12:00:00');
            d.setDate(d.getDate() + parseInt(form.days || 0));
            return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                .toISOString().slice(0, 10);
        } catch { return ''; }
    })();

    const daysRemaining = (() => {
        if (!endDate) return null;
        const ms = new Date(endDate + 'T23:59:59') - Date.now();
        return Math.ceil(ms / 86400000);
    })();

    const totalPaid = (Number(form.paidCash) || 0) + (Number(form.paidCard) || 0) + (Number(form.paidQR) || 0);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleParseMRZ = () => {
        const parsed = parseMRZ(mrzText);
        if (!parsed) { notify('Не удалось распознать MRZ', 'error'); return; }
        setForm(f => ({
            ...f,
            fullName: parsed.fullName || f.fullName,
            passport: parsed.passport || f.passport,
            birthDate: parsed.birthDate || f.birthDate,
            country: parsed.country || f.country,
        }));
        setMrzOpen(false);
        setMrzText('');
        notify('Данные из MRZ заполнены', 'success');
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.fullName.trim()) {
            notify(lang === 'ru' ? 'Заполните ФИО' : 'FIO ni to\'ldiring', 'error');
            return;
        }
        if (!form.passport.trim()) {
            notify(lang === 'ru' ? 'Заполните номер паспорта' : 'Pasport raqamini to\'ldiring', 'error');
            return;
        }
        if (!endDate) {
            notify(lang === 'ru' ? 'Укажите дату начала и количество дней' : 'Boshlanish sanasi va kunlarni ko\'rsating', 'error');
            return;
        }
        onSubmit({
            ...form,
            endDate,
            days: parseInt(form.days) || 30,
            paidCash: Number(form.paidCash) || 0,
            paidCard: Number(form.paidCard) || 0,
            paidQR: Number(form.paidQR) || 0,
            amount: totalPaid,
        });
    };

    const inp = "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700";
    const lbl = "block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wide ml-0.5";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col" style={{ maxHeight: '95vh' }}>

                {/* ═══ Header ═══ */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
                    <div>
                        <h2 className="font-black text-lg text-slate-800 flex items-center gap-2">
                            🪪 {lang === 'ru' ? 'Регистрация гостя' : 'Mehmonni ro\'yxatga olish'}
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {lang === 'ru' ? 'E-mehmon / Учёт оплаты за регистрацию' : 'E-mehmon / Ro\'yxatga olish to\'lovi'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* ═══ Body ═══ */}
                <div className="overflow-y-auto flex-1 p-5 space-y-4">

                    {/* MRZ Scan */}
                    <button
                        type="button"
                        onClick={() => setMrzOpen(o => !o)}
                        className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 text-sm font-semibold text-indigo-700 transition-colors"
                    >
                        <span className="flex items-center gap-2"><ScanLine size={16} /> Сканировать MRZ паспорт</span>
                        <ChevronDown size={16} className={`transition-transform ${mrzOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {mrzOpen && (
                        <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-200 space-y-2">
                            <textarea
                                ref={mrzRef}
                                autoFocus
                                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
                                rows={4}
                                placeholder={"P<UZBJOHNSON<<JAMES<<<<<<<<<<<<<<<<<<<<<<<\nAB12345678UZB9001011M2512310<<<<<<<<<<<4"}
                                value={mrzText}
                                onChange={e => setMrzText(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={handleParseMRZ}
                                className="w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
                            >
                                Распознать
                            </button>
                        </div>
                    )}

                    {/* ── Данные гостя ── */}
                    <div className="space-y-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            {lang === 'ru' ? 'Данные гостя' : 'Mehmon ma\'lumotlari'}
                        </p>
                        <div>
                            <label className={lbl}>ФИО *</label>
                            <input
                                className={inp}
                                value={form.fullName}
                                onChange={e => set('fullName', e.target.value.toUpperCase())}
                                placeholder="ИВАНОВ ИВАН ИВАНОВИЧ"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={lbl}>{t('passport')} *</label>
                                <input
                                    className={inp}
                                    value={form.passport}
                                    onChange={e => set('passport', e.target.value.toUpperCase().replace(/\s/g, ''))}
                                    placeholder="AB1234567"
                                />
                            </div>
                            <div>
                                <label className={lbl}>{t('birthDate')}</label>
                                <input
                                    type="date"
                                    className={inp}
                                    value={form.birthDate}
                                    onChange={e => set('birthDate', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className={lbl}>{t('country')}</label>
                                <select
                                    className={inp}
                                    value={form.country}
                                    onChange={e => set('country', e.target.value)}
                                >
                                    {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={lbl}>{t('phone')}</label>
                                <input
                                    className={inp}
                                    value={form.phone}
                                    onChange={e => set('phone', e.target.value)}
                                    placeholder="+998 90 000 00 00"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Период регистрации ── */}
                    <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100 space-y-3">
                        <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide">
                            {lang === 'ru' ? 'Период регистрации (E-mehmon)' : 'Ro\'yxatga olish muddati (E-mehmon)'}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className={lbl.replace('slate-400', 'indigo-500')}>
                                    {lang === 'ru' ? 'С даты' : 'Boshlanish'}
                                </label>
                                <input
                                    type="date"
                                    className={inp}
                                    value={form.startDate}
                                    onChange={e => set('startDate', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className={lbl.replace('slate-400', 'indigo-500')}>
                                    {lang === 'ru' ? 'Дней' : 'Kun'}
                                </label>
                                <input
                                    type="number"
                                    className={inp}
                                    value={form.days}
                                    onChange={e => set('days', e.target.value)}
                                    min="1"
                                    max="365"
                                />
                            </div>
                            <div>
                                <label className={lbl.replace('slate-400', 'indigo-500')}>
                                    {lang === 'ru' ? 'До даты' : 'Tugash'}
                                </label>
                                <div className={`px-3 py-2 rounded-xl text-sm font-bold border ${
                                    daysRemaining !== null && daysRemaining < 0
                                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                                        : daysRemaining !== null && daysRemaining <= 3
                                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                }`}>
                                    {endDate || '—'}
                                </div>
                            </div>
                        </div>
                        {daysRemaining !== null && (
                            <p className="text-xs font-semibold text-indigo-600">
                                {daysRemaining > 0
                                    ? `📅 Осталось: ${daysRemaining} дн.`
                                    : daysRemaining === 0
                                    ? '⚠️ Последний день регистрации'
                                    : `❌ Истекло ${Math.abs(daysRemaining)} дн. назад`
                                }
                            </p>
                        )}
                    </div>

                    {/* ── Оплата ── */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            {lang === 'ru' ? 'Оплата в кассу' : 'Kassa to\'lovi'}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className={`${lbl} flex items-center gap-1`}>
                                    <Wallet size={10} /> {t('cash')}
                                </label>
                                <input
                                    type="number"
                                    className={inp}
                                    value={form.paidCash}
                                    onChange={e => set('paidCash', e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className={`${lbl} flex items-center gap-1`}>
                                    <CreditCard size={10} /> {t('card')}
                                </label>
                                <input
                                    type="number"
                                    className={inp}
                                    value={form.paidCard}
                                    onChange={e => set('paidCard', e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className={`${lbl} flex items-center gap-1`}>
                                    <QrCode size={10} /> {t('qr')}
                                </label>
                                <input
                                    type="number"
                                    className={inp}
                                    value={form.paidQR}
                                    onChange={e => set('paidQR', e.target.value)}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-slate-200">
                            <span className="text-xs text-slate-500 font-semibold">
                                {lang === 'ru' ? 'Итого оплачено:' : 'Jami to\'langan:'}
                            </span>
                            <span className="text-lg font-black text-emerald-600">
                                {totalPaid.toLocaleString()} <span className="text-sm font-semibold">сум</span>
                            </span>
                        </div>
                    </div>

                    {/* ── Примечание ── */}
                    <div>
                        <label className={lbl}>{t('note')}</label>
                        <input
                            className={inp}
                            value={form.note}
                            onChange={e => set('note', e.target.value)}
                            placeholder={lang === 'ru' ? 'Необязательно...' : 'Ixtiyoriy...'}
                        />
                    </div>
                </div>

                {/* ═══ Footer ═══ */}
                <div className="p-5 border-t border-slate-100 flex gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-colors"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="flex-1 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <CheckCircle2 size={16} />
                        {lang === 'ru' ? 'Зарегистрировать' : 'Ro\'yxatga olish'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GuestRegistrationModal;
