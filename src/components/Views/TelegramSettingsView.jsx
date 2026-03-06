import React, { useState, useEffect, useMemo } from 'react';
import {
    Send, Plus, Trash2, Edit2, Check, X, Eye, EyeOff,
    Bell, BellOff, User, Users, RefreshCw, Copy,
    ChevronDown, ChevronUp, MessageSquare, Settings,
    ToggleLeft, ToggleRight, Sparkles, AlertTriangle,
    Clock, TestTube2, History, BookTemplate, Zap
} from 'lucide-react';

// ─── Notification types catalogue ────────────────────────────────────────────
export const NOTIFICATION_TYPES = {
    // ── Гости ──────────────────────────────────────────────────────────────
    checkin:         { label: 'Заселение гостя',             icon: '🏨', category: 'guests',  color: '#10b981' },
    checkout:        { label: 'Выселение гостя',             icon: '🚪', category: 'guests',  color: '#6366f1' },
    autoCheckout:    { label: 'Авто-выселение',              icon: '⏰', category: 'guests',  color: '#f59e0b' },
    guestExtended:   { label: 'Продление проживания',        icon: '📅', category: 'guests',  color: '#3b82f6' },
    deleteGuest:     { label: 'Удаление записи гостя',       icon: '🚫', category: 'guests',  color: '#ef4444' },
    deleteBooking:   { label: 'Удаление бронирования',         icon: '🗑️', category: 'guests',  color: '#f97316' },
    registration:       { label: 'Регистрация E-mehmon',      icon: '🪪', category: 'guests',  color: '#6366f1' },
    registrationExtend: { label: 'Продление E-mehmon',          icon: '🔄', category: 'guests',  color: '#8b5cf6' },
    registrationRemove: { label: 'Вывод из E-mehmon',            icon: '🔴', category: 'guests',  color: '#94a3b8' },
    // ── Бронирование ───────────────────────────────────────────────────────
    newBooking:      { label: 'Онлайн-бронь (новая)',        icon: '📋', category: 'booking', color: '#8b5cf6' },
    bookingAccepted: { label: 'Бронь принята',               icon: '✅', category: 'booking', color: '#10b981' },
    bookingRejected: { label: 'Бронь отклонена',             icon: '❌', category: 'booking', color: '#ef4444' },
    // ── Финансы ────────────────────────────────────────────────────────────
    paymentAdded:    { label: 'Оплата принята',              icon: '💵', category: 'finance', color: '#10b981' },
    debtAlert:       { label: 'Новая задолженность',         icon: '⚠️', category: 'finance', color: '#ef4444' },
    debtPaid:        { label: 'Долг оплачен',                icon: '💰', category: 'finance', color: '#10b981' },
    refund:          { label: 'Возврат средств гостю',       icon: '💸', category: 'finance', color: '#f59e0b' },
    expenseAdded:    { label: 'Расход добавлен',             icon: '💳', category: 'finance', color: '#f59e0b' },
    deleteRecord:    { label: 'Удаление финансовой записи',  icon: '🗑', category: 'finance', color: '#94a3b8' },
    // ── Персонал ────────────────────────────────────────────────────────────
    shiftStart:      { label: 'Начало смены',                icon: '🟢', category: 'staff',   color: '#10b981' },
    shiftEnd:        { label: 'Закрытие смены',              icon: '🔴', category: 'staff',   color: '#6366f1' },
    // ── Отчёты ──────────────────────────────────────────────────────────────
    dailyReport:     { label: 'Ежедневный отчёт',            icon: '📊', category: 'reports', color: '#3b82f6' },
};

const CATEGORIES = {
    guests:  { label: 'Гости',    icon: '🏨' },
    booking: { label: 'Бронирование', icon: '📋' },
    finance: { label: 'Финансы',  icon: '💰' },
    staff:   { label: 'Персонал', icon: '👥' },
    reports: { label: 'Отчёты',   icon: '📊' },
};

// ─── Default templates ────────────────────────────────────────────────────────
export const DEFAULT_TEMPLATES = {
    checkin:         '🏨 <b>Новое заселение</b>\n👤 {{guestName}}\n🛏 {{hostel}} · Комната {{room}}, место {{bed}}\n📅 {{checkIn}} → {{checkOut}} ({{days}} дн.)\n💰 Оплачено: {{amount}} сум\n👷 Кассир: {{staffName}}',
    checkout:        '🚪 <b>Выселение</b>\n👤 {{guestName}}\n🛏 {{hostel}} · Комната {{room}}\n📅 Заехал: {{checkIn}}\n💰 Итого: {{amount}} сум\n👷 Кассир: {{staffName}}',
    autoCheckout:    '⏰ <b>Авто-выселение</b>\n👤 {{guestName}} — просрочка > 24ч\n🛏 {{hostel}} · Комната {{room}}\n📅 Должен был выехать: {{checkOut}}',
    guestExtended:   '📅 <b>Продление проживания</b>\n👤 {{guestName}}\n➕ +{{extendDays}} дн. → {{checkOut}}\n💵 Доплачено: {{amount}} сум\n👷 Кассир: {{staffName}}',
    deleteGuest:     '🚫 <b>Удалена запись гостя</b>\n👤 {{guestName}}\n🛏 {{hostel}} · Ком. {{room}}\n📅 {{checkIn}} → {{checkOut}}\n👤 Удалил: {{staffName}}',
    deleteBooking:   '🗑️ <b>Удалено бронирование</b>\n👤 {{guestName}}\n🛏 {{hostel}} · Ком. {{room}}\n📅 {{checkIn}} → {{checkOut}}\n👤 Удалил: {{staffName}}',
    registration:       '🪪 <b>Регистрация E-mehmon</b>\n👤 {{guestName}}\n🪪 Паспорт: {{passport}}\n📅 {{checkIn}} → {{checkOut}} ({{days}} дн.)\n💰 {{amount}} сум\n👷 {{staffName}}',
    registrationExtend: '🔄 <b>Продление (E-mehmon)</b>\n👤 {{guestName}}\n🪪 {{passport}}\n📅 +{{extendDays}} дн. → {{checkOut}}\n💰 {{amount}} сум\n👷 {{staffName}}',
    registrationRemove: '🔴 <b>Вывод из E-mehmon</b>\n👤 {{guestName}}\n🪪 {{passport}}\n👷 {{staffName}}',
    newBooking:      '📋 <b>Новая онлайн-бронь</b>\n👤 {{guestName}}\n📅 {{checkIn}} → {{checkOut}}\n🏨 {{hostel}}\n📞 {{phone}}',
    bookingAccepted: '✅ <b>Бронь принята</b>\n👤 {{guestName}}\n📅 {{checkIn}}\n🏨 {{hostel}}',
    bookingRejected: '❌ <b>Бронь отклонена</b>\n👤 {{guestName}}\n📅 {{checkIn}}\n🏨 {{hostel}}',
    paymentAdded:    '💵 <b>Оплата принята</b>\n👤 {{guestName}}\n🛏 {{hostel}} · Ком. {{room}}\n💰 {{amount}} сум\n👷 Кассир: {{staffName}}',
    debtAlert:       '⚠️ <b>Новая задолженность</b>\n👤 {{guestName}}\n💰 Долг: {{debtAmount}} сум\n👷 Кассир: {{staffName}}',
    debtPaid:        '💰 <b>Долг погашен</b>\n👤 {{guestName}}\n✅ Оплачено: {{amount}} сум\n👷 Кассир: {{staffName}}',
    refund:          '💸 <b>Возврат средств</b>\n👤 {{guestName}}\n💵 Сумма: {{amount}} сум\n👷 Кассир: {{staffName}}',
    expenseAdded:    '💳 <b>Расход</b>\n📂 {{category}}\n💰 {{amount}} сум\n👤 Кассир: {{staffName}}\n💬 {{comment}}',
    deleteRecord:    '🗑 <b>Удалена финансовая запись</b>\nТип: {{recordType}}\n👤 {{guestName}}\n💵 {{amount}} сум\n📅 {{checkIn}}\n👤 Удалил: {{staffName}}',
    shiftStart:      '🟢 <b>Смена начата</b>\n👤 {{staffName}}\n🏨 {{hostel}}\n🕐 {{time}}',
    shiftEnd:        '🔴 <b>Смена закрыта</b>\n👤 {{staffName}}\n🏨 {{hostel}}\n💰 Наличные: {{cash}} | Терминал: {{card}} | QR: {{qr}}\n🕐 {{time}}',
    dailyReport:     '📊 <b>Ежедневный отчёт — {{date}}</b>\n🏨 {{hostel}}\n👥 Гостей: {{activeGuests}}\n📈 Выручка: {{revenue}} сум\n💸 Расходы: {{expenses}} сум',
};

// Variables per type
const TEMPLATE_VARS = {
    checkin:         ['guestName','hostel','room','bed','checkIn','checkOut','days','amount','staffName'],
    checkout:        ['guestName','hostel','room','checkIn','amount','staffName'],
    autoCheckout:    ['guestName','hostel','room','checkOut'],
    guestExtended:   ['guestName','extendDays','checkOut','amount','staffName'],
    deleteGuest:     ['guestName','hostel','room','checkIn','checkOut','staffName'],
    deleteBooking:   ['guestName','hostel','room','checkIn','checkOut','staffName'],
    registration:       ['guestName','passport','checkIn','checkOut','days','amount','staffName'],
    registrationExtend: ['guestName','passport','extendDays','checkOut','amount','staffName'],
    registrationRemove: ['guestName','passport','staffName'],
    newBooking:      ['guestName','hostel','checkIn','checkOut','phone'],
    bookingAccepted: ['guestName','hostel','checkIn'],
    bookingRejected: ['guestName','hostel','checkIn'],
    paymentAdded:    ['guestName','hostel','room','amount','staffName'],
    debtAlert:       ['guestName','debtAmount','staffName'],
    debtPaid:        ['guestName','amount','staffName'],
    refund:          ['guestName','amount','staffName'],
    expenseAdded:    ['category','amount','staffName','comment'],
    deleteRecord:    ['recordType','guestName','amount','checkIn','staffName'],
    shiftStart:      ['staffName','hostel','time'],
    shiftEnd:        ['staffName','hostel','cash','card','qr','time'],
    dailyReport:     ['date','hostel','activeGuests','revenue','expenses'],
};

const SAMPLE_DATA = {
    guestName: 'Иванов Иван',
    hostel: 'Хостел №1',
    room: '101',
    bed: '2',
    checkIn: '22.02.2026',
    checkOut: '25.02.2026',
    days: '3',
    amount: '150 000',
    phone: '+998 90 123-45-67',
    debtAmount: '50 000',
    category: 'Хозтовары',
    staffName: 'Дилафруз',
    comment: 'Чистящие средства',
    cash: '200 000',
    card: '100 000',
    qr: '0',
    time: '09:00',
    date: '22.02.2026',
    activeGuests: '12',
    revenue: '850 000',
    expenses: '45 000',
    extendDays: '3',
    recordType: 'Расход',
};

const fillTemplate = (tpl, data) =>
    tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => data[k] ?? `{{${k}}}`);

// Безопасный рендер шаблона для предпросмотра: экранируем весь HTML,
// затем разрешаем только <b> и <i> из тела шаблона.
const escHtml = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const safeRenderTemplate = (tpl, data) => {
    // 1. Экранируем весь HTML в теле шаблона
    const escaped = escHtml(tpl);
    // 2. Заменяем {{key}} на экранированные значения переменных
    const filled = escaped.replace(/\{\{(\w+)\}\}/g, (_, k) =>
        escHtml(String(data[k] ?? `{{${k}}}`)));
    // 3. Восстанавливаем только &lt;b&gt; → <strong> и &lt;i&gt; → <em>
    return filled
        .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/gs, '<strong>$1</strong>')
        .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/gs, '<em>$1</em>');
};

// ─── Input style ──────────────────────────────────────────────────────────────
const inp = "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-sm text-slate-700";
const card = "bg-white rounded-2xl border border-slate-200 shadow-sm";

// ─── Toggle ───────────────────────────────────────────────────────────────────
const Toggle = ({ val, onChange }) => (
    <button onClick={() => onChange(!val)}
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${val ? 'bg-emerald-500' : 'bg-slate-200'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${val ? 'left-5' : 'left-0.5'}`}/>
    </button>
);

// ─── Recipient Modal ──────────────────────────────────────────────────────────
const RecipientModal = ({ recipient, onSave, onClose }) => {
    const [form, setForm] = useState(() => recipient || {
        name: '', telegramId: '', active: true,
        notifications: Object.fromEntries(Object.keys(NOTIFICATION_TYPES).map(k => [k, true]))
    });
    const [err, setErr] = useState('');
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const setNotif = (k, v) => setForm(f => ({ ...f, notifications: { ...f.notifications, [k]: v } }));

    // Detect if user entered a group ID without the required -100 prefix
    const tid = form.telegramId.trim();
    const looksLikeWrongGroupId = tid.startsWith('-') && !tid.startsWith('-100') && /^-\d+$/.test(tid);
    const fixedGroupId = tid.startsWith('-') ? `-100${tid.slice(1)}` : tid;

    const handleSave = () => {
        if (!form.name.trim()) { setErr('Введите имя'); return; }
        if (!form.telegramId.trim()) { setErr('Введите Telegram ID'); return; }
        if (!/^-?\d+$/.test(tid)) { setErr('Telegram ID — только цифры (для групп можно с минусом)'); return; }
        if (form.threadId && !/^\d+$/.test(form.threadId.trim())) { setErr('Thread ID — только цифры'); return; }
        onSave({ ...form, telegramId: tid, name: form.name.trim(), threadId: form.threadId?.trim() || '' });
    };

    const selectAll = (val) =>
        setForm(f => ({ ...f, notifications: Object.fromEntries(Object.keys(NOTIFICATION_TYPES).map(k => [k, val])) }));

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4 pt-4 pb-20 md:pb-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[calc(90vh-4rem)] md:max-h-[90vh] flex flex-col overflow-hidden">
                <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                    <div className="font-black text-lg text-slate-800">
                        {recipient ? 'Редактировать получателя' : '+ Новый получатель'}
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20}/>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-1.5">
                        <div className="font-black text-blue-800 mb-1">📖 Как узнать Telegram ID?</div>
                        <div><b>Личный ID:</b> напишите <code className="bg-blue-100 px-1 rounded">@userinfobot</code> — он пришлёт ваш ID</div>
                        <div><b>ID группы (способ 1):</b> откройте группу на <code className="bg-blue-100 px-1 rounded">web.telegram.org</code> → в адресной строке будет <code className="bg-blue-100 px-1 rounded">.../#-1001234567890</code> — это и есть ID</div>
                        <div><b>ID группы (способ 2):</b> перешлите любое сообщение из группы боту <code className="bg-blue-100 px-1 rounded">@userinfobot</code> — он покажет ID группы</div>
                        <div><b>Thread ID вкладки:</b> перешлите сообщение из темы боту <code className="bg-blue-100 px-1 rounded">@RawDataBot</code> — ищите <code className="bg-blue-100 px-1 rounded">message_thread_id</code></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Имя / Описание</label>
                            <input className={inp} placeholder="Например: Азиз (директор)" value={form.name} onChange={e => set('name', e.target.value)}/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Telegram ID <span className="text-slate-400 normal-case">(личный или группа)</span></label>
                            <input className={inp} placeholder="123456789 или -100123456789" value={form.telegramId} onChange={e => set('telegramId', e.target.value)}/>
                        </div>
                    </div>
                    {/* Предупреждение о неправильном формате группового ID */}
                    {looksLikeWrongGroupId && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5">⚠️</span>
                            <div className="flex-1 text-xs text-amber-800">
                                <div className="font-bold mb-1">Возможно неверный формат ID группы</div>
                                <div>Супергруппы Telegram требуют префикс <code className="bg-amber-100 px-1 rounded font-mono">-100</code>. Ваш ID <code className="bg-amber-100 px-1 rounded font-mono">{tid}</code> скорее всего должен быть <code className="bg-amber-100 px-1 rounded font-mono">{fixedGroupId}</code></div>
                                <button onClick={() => set('telegramId', fixedGroupId)}
                                    className="mt-1.5 px-3 py-1 bg-amber-500 text-white rounded-lg font-bold text-[11px] hover:bg-amber-600 transition-colors">
                                    Исправить автоматически → {fixedGroupId}
                                </button>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Thread ID <span className="text-slate-400 normal-case">(вкладка группы)</span></label>
                            <input className={inp} placeholder="Необязательно" value={form.threadId || ''} onChange={e => set('threadId', e.target.value)}/>
                            <p className="text-[10px] text-slate-400 mt-1">Для форум-групп: ID темы/вкладки куда слать сообщения</p>
                        </div>
                        <div className="flex items-center p-3 bg-slate-50 rounded-xl">
                            <div className="flex-1">
                                <div className="text-sm font-semibold text-slate-700">Активный</div>
                                <div className="text-[10px] text-slate-400">Получает уведомления</div>
                            </div>
                            <Toggle val={form.active} onChange={v => set('active', v)}/>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-black text-slate-500 uppercase">Уведомления</label>
                            <div className="flex gap-2">
                                <button onClick={() => selectAll(true)} className="text-xs text-emerald-600 hover:text-emerald-700 font-bold">Все</button>
                                <span className="text-slate-300">|</span>
                                <button onClick={() => selectAll(false)} className="text-xs text-rose-500 hover:text-rose-600 font-bold">Ни одного</button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {Object.entries(CATEGORIES).map(([catKey, cat]) => {
                                const types = Object.entries(NOTIFICATION_TYPES).filter(([, v]) => v.category === catKey);
                                if (!types.length) return null;
                                return (
                                    <div key={catKey} className="border border-slate-100 rounded-xl overflow-hidden">
                                        <div className="bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-500 uppercase tracking-wide">
                                            {cat.icon} {cat.label}
                                        </div>
                                        <div className="divide-y divide-slate-50">
                                            {types.map(([typeKey, type]) => (
                                                <div key={typeKey} className="flex items-center justify-between px-3 py-2">
                                                    <span className="text-sm text-slate-700">{type.icon} {type.label}</span>
                                                    <Toggle val={form.notifications?.[typeKey] ?? true} onChange={v => setNotif(typeKey, v)}/>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {err && <div className="px-4 py-2 text-sm text-red-500 font-semibold bg-red-50 border-t border-red-100">{err}</div>}
                <div className="p-4 border-t border-slate-100 flex items-center gap-2">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">
                        Отмена
                    </button>
                    <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors">
                        {recipient ? 'Сохранить' : 'Добавить'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Template Editor ──────────────────────────────────────────────────────────
const TemplateEditor = ({ typeKey, template, onSave, onClose }) => {
    const type = NOTIFICATION_TYPES[typeKey];
    const vars = TEMPLATE_VARS[typeKey] || [];
    const [body, setBody] = useState(template || DEFAULT_TEMPLATES[typeKey] || '');
    const [showPreview, setShowPreview] = useState(false);
    const textareaRef = React.useRef();

    const insertVar = (v) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newVal = body.slice(0, start) + `{{${v}}}` + body.slice(end);
        setBody(newVal);
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + v.length + 4; ta.focus(); }, 0);
    };

    const resetToDefault = () => {
        if (DEFAULT_TEMPLATES[typeKey]) setBody(DEFAULT_TEMPLATES[typeKey]);
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                    <div>
                        <div className="font-black text-lg text-slate-800">
                            {type?.icon} Шаблон: {type?.label}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">HTML-форматирование: &lt;b&gt; &lt;i&gt; &lt;code&gt;</div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20}/>
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    {/* Variable chips */}
                    <div>
                        <div className="text-xs font-black text-slate-500 uppercase mb-2">Доступные переменные (клик — вставить)</div>
                        <div className="flex flex-wrap gap-1.5">
                            {vars.map(v => (
                                <button key={v} onClick={() => insertVar(v)}
                                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-mono font-bold transition-colors border border-indigo-100">
                                    {`{{${v}}}`}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Editor / Preview tabs */}
                    <div className="flex rounded-xl overflow-hidden border border-slate-200">
                        <button onClick={() => setShowPreview(false)}
                            className={`flex-1 py-2 text-sm font-bold transition-colors ${!showPreview ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                            ✏️ Редактор
                        </button>
                        <button onClick={() => setShowPreview(true)}
                            className={`flex-1 py-2 text-sm font-bold transition-colors ${showPreview ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>
                            👁 Предпросмотр
                        </button>
                    </div>

                    {!showPreview ? (
                        <textarea ref={textareaRef}
                            className={`${inp} h-52 resize-none font-mono text-xs leading-relaxed`}
                            value={body} onChange={e => setBody(e.target.value)}
                            placeholder="Текст уведомления..."/>
                    ) : (
                        <div className="bg-[#efebe9] rounded-2xl p-4 min-h-[13rem]">
                            <div className="bg-white rounded-xl p-3 shadow-sm inline-block max-w-xs w-full">
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">H</div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-700">Hostella Bot</div>
                                        <div className="text-[10px] text-slate-400">только что</div>
                                    </div>
                                </div>
                                <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed"
                                    dangerouslySetInnerHTML={{
                                        __html: safeRenderTemplate(body, SAMPLE_DATA)
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <button onClick={resetToDefault}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                            <RefreshCw size={13}/> По умолчанию
                        </button>
                        <div className="flex-1"/>
                        <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">
                            Отмена
                        </button>
                        <button onClick={() => onSave(body)}
                            className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors">
                            Сохранить
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Custom type modal ────────────────────────────────────────────────────────
const CustomTypeModal = ({ onSave, onClose }) => {
    const [form, setForm] = useState({ id: '', label: '', icon: '🔔', category: 'guests' });
    const [err, setErr] = useState('');
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = () => {
        const id = form.id.trim().replace(/[^a-zA-Z0-9_]/g, '');
        if (!id) { setErr('Введите уникальный идентификатор'); return; }
        if (NOTIFICATION_TYPES[id]) { setErr('Такой тип уже существует'); return; }
        if (!form.label.trim()) { setErr('Введите название'); return; }
        onSave({ id, label: form.label.trim(), icon: form.icon, category: form.category });
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="font-black text-lg text-slate-800">✨ Новый тип уведомлений</div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                <div className="p-6 space-y-3">
                    <div className="grid grid-cols-5 gap-2">
                        <div className="col-span-1">
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Иконка</label>
                            <input className={inp + ' text-center text-lg'} maxLength={2} value={form.icon} onChange={e => set('icon', e.target.value)}/>
                        </div>
                        <div className="col-span-4">
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Название типа</label>
                            <input className={inp} placeholder="Пример: Новый статус" value={form.label} onChange={e => set('label', e.target.value)}/>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">IDs (латиница, без пробелов)</label>
                        <input className={inp + ' font-mono'} placeholder="myCustomType" value={form.id} onChange={e => set('id', e.target.value)}/>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Категория</label>
                        <select className={inp} value={form.category} onChange={e => set('category', e.target.value)}>
                            {Object.entries(CATEGORIES).map(([k, v]) => (
                                <option key={k} value={k}>{v.icon} {v.label}</option>
                            ))}
                        </select>
                    </div>
                    {err && <div className="text-sm text-red-500 font-semibold">{err}</div>}
                    <div className="flex gap-2 pt-1">
                        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">Отмена</button>
                        <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-colors">Создать</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Main View ────────────────────────────────────────────────────────────────
const TelegramSettingsView = ({ settings, onSaveSettings, onTestMessage, currentUser }) => {
    const [tab, setTab] = useState('recipients');

    // ── Recipients ──
    const [editRecipient, setEditRecipient] = useState(null);
    const [recipientModal, setRecipientModal] = useState(false);
    const [expandedRecipient, setExpandedRecipient] = useState(null);

    // ── Templates ──
    const [editTemplate, setEditTemplate] = useState(null);
    const [showCustomTypeModal, setShowCustomTypeModal] = useState(false);

    // ── Test ──
    const [testType, setTestType] = useState('checkin');
    const [testRecipientId, setTestRecipientId] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [saving, setSaving] = useState(false);

    const recipients = settings?.recipients || [];
    const templates = { ...DEFAULT_TEMPLATES, ...(settings?.templates || {}) };
    const customTypes = settings?.customTypes || {};
    const allTypes = { ...NOTIFICATION_TYPES, ...customTypes };

    // Derived stats
    const activeCount = recipients.filter(r => r.active).length;
    const totalNotifEnabled = recipients.reduce((sum, r) => {
        return sum + Object.values(r.notifications || {}).filter(Boolean).length;
    }, 0);

    // ─────────────── Handlers ────────────────────────────────────────────────
    const saveSettings = async (patch) => {
        setSaving(true);
        try {
            await onSaveSettings({ ...settings, ...patch });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveRecipient = async (data) => {
        const existing = [...recipients];
        const idx = existing.findIndex(r => r.id === data.id);
        if (idx >= 0) existing[idx] = data;
        else existing.push({ ...data, id: Date.now().toString() });
        await saveSettings({ recipients: existing });
        setRecipientModal(false);
        setEditRecipient(null);
    };

    const handleDeleteRecipient = async (id) => {
        if (!confirm('Удалить получателя?')) return;
        await saveSettings({ recipients: recipients.filter(r => r.id !== id) });
    };

    const handleToggleRecipient = async (id, active) => {
        await saveSettings({ recipients: recipients.map(r => r.id === id ? { ...r, active } : r) });
    };

    const handleSaveTemplate = async (typeKey, body) => {
        await saveSettings({ templates: { ...(settings?.templates || {}), [typeKey]: body } });
        setEditTemplate(null);
    };

    const handleResetTemplate = async (typeKey) => {
        if (!confirm('Сбросить шаблон к умолчанию?')) return;
        const tpls = { ...(settings?.templates || {}) };
        delete tpls[typeKey];
        await saveSettings({ templates: tpls });
    };

    const handleToggleType = async (typeKey, active) => {
        const disabledTypes = new Set(settings?.disabledTypes || []);
        if (active) disabledTypes.delete(typeKey); else disabledTypes.add(typeKey);
        await saveSettings({ disabledTypes: [...disabledTypes] });
    };

    const handleAddCustomType = async (data) => {
        await saveSettings({ customTypes: { ...(settings?.customTypes || {}), [data.id]: { label: data.label, icon: data.icon, category: data.category, color: '#6366f1' } } });
        setShowCustomTypeModal(false);
    };

    const handleDeleteCustomType = async (typeKey) => {
        if (!confirm('Удалить тип уведомлений?')) return;
        const ct = { ...(settings?.customTypes || {}) };
        delete ct[typeKey];
        await saveSettings({ customTypes: ct });
    };

    const handleTest = async () => {
        if (!testRecipientId) { setTestResult({ ok: false, msg: 'Выберите получателя' }); return; }
        setIsTesting(true);
        setTestResult(null);
        try {
            const recipient = recipients.find(r => r.id === testRecipientId);
            const body = templates[testType] || DEFAULT_TEMPLATES[testType] || '🔔 Тест';
            const text = `🧪 <b>ТЕСТОВАЯ ЗАПИСЬ</b>\n${fillTemplate(body, { ...SAMPLE_DATA, _test: true })}`;
            await onTestMessage({ text, chatIds: [{ chatId: recipient.telegramId, threadId: recipient.threadId || '' }] });
            setTestResult({ ok: true, msg: `Отправлено на ${recipient.name} (${recipient.telegramId})` });
        } catch (e) {
            setTestResult({ ok: false, msg: e.message || 'Ошибка отправки' });
        } finally {
            setIsTesting(false);
        }
    };

    // ─────────────── Render ──────────────────────────────────────────────────
    const tabList = [
        { id: 'recipients', icon: Users, label: 'Получатели', badge: activeCount },
        { id: 'templates',  icon: MessageSquare, label: 'Шаблоны' },
        { id: 'test',       icon: TestTube2, label: 'Тест' },
    ];

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <span className="text-2xl">📱</span> Telegram уведомления
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {activeCount} активных получателей · {totalNotifEnabled} подписок
                    </p>
                </div>
                {saving && (
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <RefreshCw size={13} className="animate-spin"/>
                        Сохранение...
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-2xl p-1">
                {tabList.map(t => {
                    const Icon = t.icon;
                    return (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-all ${
                                tab === t.id ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'
                            }`}>
                            <Icon size={15}/>
                            {t.label}
                            {t.badge > 0 && (
                                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-black flex items-center justify-center">{t.badge}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── TAB: RECIPIENTS ── */}
            {tab === 'recipients' && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-500">
                            {recipients.length === 0 && 'Нет получателей. Добавьте первого →'}
                        </div>
                        <button onClick={() => { setEditRecipient(null); setRecipientModal(true); }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-sm">
                            <Plus size={16}/> Добавить получателя
                        </button>
                    </div>

                    {recipients.length === 0 ? (
                        <div className={`${card} p-8 text-center`}>
                            <div className="text-5xl mb-3">📭</div>
                            <div className="text-lg font-black text-slate-700 mb-1">Список получателей пуст</div>
                            <div className="text-sm text-slate-400 mb-5">Добавьте Telegram ID пользователей, которым<br/>должны приходить уведомления</div>
                            <button onClick={() => { setEditRecipient(null); setRecipientModal(true); }}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors">
                                <Plus size={16}/> Добавить первого получателя
                            </button>
                            <div className="mt-5 pt-5 border-t border-slate-100">
                                <div className="text-xs text-slate-400 mb-3">Или импортировать предустановленных получателей</div>
                                <button onClick={async () => {
                                    const defaults = [
                                        { id: Date.now().toString(), name: 'Admin 1 (Sherzod)', telegramId: '7029598539', active: true, notifications: Object.fromEntries(Object.keys(allTypes).map(k => [k, true])) },
                                        { id: (Date.now()+1).toString(), name: 'Admin 2 (Farhodjon)', telegramId: '6953132612', active: true, notifications: Object.fromEntries(Object.keys(allTypes).map(k => [k, true])) },
                                        { id: (Date.now()+2).toString(), name: 'Admin 3 (Sardor)', telegramId: '972047654', active: true, notifications: Object.fromEntries(Object.keys(allTypes).map(k => [k, true])) },
                                    ];
                                    await saveSettings({ recipients: defaults });
                                }} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors">
                                    ⬆️ Импортировать 3 предустановленных
                                </button>
                            </div>
                        </div>
                    ) : (
                        recipients.map(r => {
                            const enabledCount = Object.keys(allTypes).filter(k => r.notifications?.[k] !== false).length;
                            const totalCount = Object.keys(allTypes).length;
                            const isExpanded = expandedRecipient === r.id;

                            return (
                                <div key={r.id} className={`${card} overflow-hidden transition-all`}>
                                    <div className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${r.active ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                                                {r.active ? '🟢' : '⚫'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-slate-800">{r.name}</span>
                                                    {!r.active && <span className="text-[10px] font-bold bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">Отключён</span>}
                                                </div>
                                                <div className="text-xs text-slate-400 font-mono mt-0.5">
                                                    ID: {r.telegramId}{r.threadId ? ` · 💬 Вкл. ${r.threadId}` : ''} · {enabledCount}/{totalCount} уведомлений
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <Toggle val={r.active} onChange={v => handleToggleRecipient(r.id, v)}/>
                                                <button onClick={() => setExpandedRecipient(isExpanded ? null : r.id)}
                                                    className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                                                    title="Подписки">
                                                    {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                                </button>
                                                <button onClick={() => { setEditRecipient(r); setRecipientModal(true); }}
                                                    className="p-1.5 text-indigo-400 hover:text-indigo-600 transition-colors" title="Редактировать">
                                                    <Edit2 size={16}/>
                                                </button>
                                                <button onClick={() => handleDeleteRecipient(r.id)}
                                                    className="p-1.5 text-red-400 hover:text-red-600 transition-colors" title="Удалить">
                                                    <Trash2 size={16}/>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="mt-3 flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-400 rounded-full transition-all"
                                                    style={{ width: `${totalCount > 0 ? (enabledCount / totalCount) * 100 : 0}%` }}/>
                                            </div>
                                            <span className="text-xs text-slate-400 font-bold shrink-0">{enabledCount}/{totalCount}</span>
                                        </div>
                                    </div>

                                    {/* Expanded subscriptions */}
                                    {isExpanded && (
                                        <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                                            <div className="space-y-3">
                                                {Object.entries(CATEGORIES).map(([catKey, cat]) => {
                                                    const types = Object.entries(allTypes).filter(([, v]) => v.category === catKey);
                                                    if (!types.length) return null;
                                                    return (
                                                        <div key={catKey}>
                                                            <div className="text-[10px] font-black text-slate-400 uppercase mb-1.5">{cat.icon} {cat.label}</div>
                                                            <div className="grid grid-cols-2 gap-1">
                                                                {types.map(([typeKey, type]) => {
                                                                    const on = r.notifications?.[typeKey] ?? true;
                                                                    return (
                                                                        <div key={typeKey} className="flex items-center gap-2 text-xs text-slate-600">
                                                                            <span className={on ? 'text-emerald-500' : 'text-slate-300'}>●</span>
                                                                            <span className={on ? '' : 'text-slate-400 line-through'}>{type.icon} {type.label}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ── TAB: TEMPLATES ── */}
            {tab === 'templates' && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-400">Нажмите карандаш для редактирования. Изменённые шаблоны помечены ★</div>
                        <button onClick={() => setShowCustomTypeModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors shadow-sm">
                            <Sparkles size={15}/> Новый тип
                        </button>
                    </div>

                    {Object.entries(CATEGORIES).map(([catKey, cat]) => {
                        const types = Object.entries(allTypes).filter(([, v]) => v.category === catKey);
                        if (!types.length) return null;
                        return (
                            <div key={catKey} className={card}>
                                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
                                    <span className="text-base">{cat.icon}</span>
                                    <span className="font-black text-slate-700 text-sm uppercase tracking-wide">{cat.label}</span>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {types.map(([typeKey, type]) => {
                                        const isCustom = !!customTypes[typeKey];
                                        const hasCustomTpl = !!(settings?.templates?.[typeKey]);
                                        const isDisabled = (settings?.disabledTypes || []).includes(typeKey);
                                        const tplPreview = (templates[typeKey] || '').split('\n')[0];

                                        return (
                                            <div key={typeKey} className={`flex items-center gap-3 px-4 py-3 ${isDisabled ? 'opacity-50' : ''}`}>
                                                <span className="text-xl shrink-0">{type.icon}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-slate-700">{type.label}</span>
                                                        {hasCustomTpl && <span className="text-[10px] text-amber-600 font-black">★ изменён</span>}
                                                        {isCustom && <span className="text-[10px] bg-purple-100 text-purple-600 font-black px-1.5 py-0.5 rounded-full">custom</span>}
                                                    </div>
                                                    <div className="text-xs text-slate-400 truncate mt-0.5 font-mono">{tplPreview}</div>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <Toggle val={!isDisabled} onChange={v => handleToggleType(typeKey, v)}/>
                                                    <button onClick={() => setEditTemplate(typeKey)}
                                                        className="p-1.5 text-indigo-400 hover:text-indigo-600 transition-colors" title="Редактировать шаблон">
                                                        <Edit2 size={15}/>
                                                    </button>
                                                    {hasCustomTpl && (
                                                        <button onClick={() => handleResetTemplate(typeKey)}
                                                            className="p-1.5 text-amber-400 hover:text-amber-600 transition-colors" title="Сбросить к умолчанию">
                                                            <RefreshCw size={15}/>
                                                        </button>
                                                    )}
                                                    {isCustom && (
                                                        <button onClick={() => handleDeleteCustomType(typeKey)}
                                                            className="p-1.5 text-red-400 hover:text-red-600 transition-colors" title="Удалить тип">
                                                            <Trash2 size={15}/>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── TAB: TEST ── */}
            {tab === 'test' && (
                <div className="space-y-4">
                    <div className={`${card} p-5 space-y-4`}>
                        <div className="text-sm font-black text-slate-700 flex items-center gap-2">
                            <TestTube2 size={16} className="text-indigo-500"/> Отправить тестовое уведомление
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Тип уведомления</label>
                                <select className={inp} value={testType} onChange={e => setTestType(e.target.value)}>
                                    {Object.entries(allTypes).map(([k, v]) => (
                                        <option key={k} value={k}>{v.icon} {v.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Получатель</label>
                                <select className={inp} value={testRecipientId} onChange={e => setTestRecipientId(e.target.value)}>
                                    <option value="">— выбрать получателя —</option>
                                    {recipients.map(r => (
                                        <option key={r.id} value={r.id}>{r.name} ({r.telegramId})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Preview */}
                        <div>
                            <div className="text-xs font-bold text-slate-500 mb-2 uppercase">Предпросмотр</div>
                            <div className="bg-[#efebe9] rounded-2xl p-4">
                                <div className="bg-white rounded-xl p-3 shadow-sm inline-block max-w-xs w-full">
                                    <pre className="text-sm text-slate-800 whitespace-pre-wrap font-sans leading-relaxed"
                                        dangerouslySetInnerHTML={{
                                            __html: safeRenderTemplate(templates[testType] || DEFAULT_TEMPLATES[testType] || '🔔 Тест', SAMPLE_DATA)
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <button onClick={handleTest} disabled={isTesting || !testRecipientId}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                            {isTesting ? <RefreshCw size={16} className="animate-spin"/> : <Send size={16}/>}
                            {isTesting ? 'Отправка...' : 'Отправить тест'}
                        </button>

                        {testResult && (
                            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold ${
                                testResult.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
                            }`}>
                                {testResult.ok ? <Check size={16}/> : <AlertTriangle size={16}/>}
                                {testResult.msg}
                            </div>
                        )}
                    </div>

                    {/* Info card */}
                    <div className={`${card} p-5`}>
                        <div className="text-sm font-black text-slate-700 mb-3">💡 Как получить Telegram ID</div>
                        <ol className="space-y-2 text-sm text-slate-600">
                            <li className="flex gap-2"><span className="font-black text-indigo-500 shrink-0">1.</span>Откройте Telegram и найдите бота <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs font-mono">@userinfobot</code></li>
                            <li className="flex gap-2"><span className="font-black text-indigo-500 shrink-0">2.</span>Нажмите <strong>/start</strong> — бот пришлёт ваш ID</li>
                            <li className="flex gap-2"><span className="font-black text-indigo-500 shrink-0">3.</span>Скопируйте число (только цифры) и добавьте в список получателей</li>
                            <li className="flex gap-2"><span className="font-black text-indigo-500 shrink-0">4.</span>Убедитесь, что вы написали что-нибудь боту Hostella (иначе он не сможет слать вам сообщения)</li>
                        </ol>
                    </div>
                </div>
            )}

            {/* Modals */}
            {recipientModal && (
                <RecipientModal
                    recipient={editRecipient}
                    onSave={handleSaveRecipient}
                    onClose={() => { setRecipientModal(false); setEditRecipient(null); }}
                />
            )}
            {editTemplate && (
                <TemplateEditor
                    typeKey={editTemplate}
                    template={templates[editTemplate]}
                    onSave={(body) => handleSaveTemplate(editTemplate, body)}
                    onClose={() => setEditTemplate(null)}
                />
            )}
            {showCustomTypeModal && (
                <CustomTypeModal
                    onSave={handleAddCustomType}
                    onClose={() => setShowCustomTypeModal(false)}
                />
            )}
        </div>
    );
};

export default TelegramSettingsView;
