/**
 * auditActions.js — справочник действий журнала: значок, ключ словаря, цвет,
 * группа. Общий для «Истории изменений» и ленты кассира.
 */

// ── Action metadata — только те, что реально логируются в коде ───────────────
// label/group хранят КЛЮЧИ словаря; человекочитаемый текст резолвится через t() при рендере
export const ACTION_META = {
    // Гости
    checkin:              { icon: '🏨', label: 'alCheckin',              color: 'emerald', group: 'alGrpGuests' },
    checkout:             { icon: '🚪', label: 'alCheckoutManual',        color: 'blue',    group: 'alGrpGuests' },
    auto_checkout:        { icon: '🏁', label: 'alAutoCheckout',          color: 'amber',   group: 'alGrpGuests' },
    undo:                 { icon: '↩️', label: 'alUndo',                  color: 'indigo',  group: 'alGrpGuests' },
    trim_days:            { icon: '✂️', label: 'alTrimDays',              color: 'orange',  group: 'alGrpGuests' },
    price_change:         { icon: '💱', label: 'alPriceChange',           color: 'amber',   group: 'alGrpGuests' },
    // Гости (с 0.15.27 — для ленты кассира)
    extend:               { icon: '📅', label: 'alExtend',                color: 'indigo',  group: 'alGrpGuests' },
    extend_bulk:          { icon: '📆', label: 'alExtendBulk',            color: 'indigo',  group: 'alGrpGuests' },
    move:                 { icon: '🔀', label: 'alMove',                  color: 'blue',    group: 'alGrpGuests' },
    booking_activate:     { icon: '🛎️', label: 'alBookingActivate',       color: 'emerald', group: 'alGrpBookings' },
    reduce_days:          { icon: '➖', label: 'alReduceDays',            color: 'orange',  group: 'alGrpGuests' },
    kpp_confirm:          { icon: '🛂', label: 'alKppConfirm',            color: 'purple',  group: 'alGrpEmehmon' },
    kpp_reset:            { icon: '🛂', label: 'alKppReset',              color: 'slate',   group: 'alGrpEmehmon' },
    payment:              { icon: '💵', label: 'alPayment',               color: 'green',   group: 'alGrpFinance' },
    debt_pay:             { icon: '💰', label: 'alDebtPay',               color: 'emerald', group: 'alGrpFinance' },
    debt_adjust:          { icon: '⚖️', label: 'alDebtAdjust',            color: 'amber',   group: 'alGrpFinance' },
    balance_topup:        { icon: '👛', label: 'alBalanceTopup',          color: 'green',   group: 'alGrpFinance' },
    shop_sale:            { icon: '🛍️', label: 'alShopSale',              color: 'green',   group: 'alGrpFinance' },
    shop_cancel:          { icon: '↩️', label: 'alShopCancel',            color: 'rose',    group: 'alGrpFinance' },
    shop_stock_in:        { icon: '📦', label: 'alShopStockIn',           color: 'blue',    group: 'alGrpFinance' },
    shop_stock_adjust:    { icon: '🧮', label: 'alShopStockAdjust',       color: 'slate',   group: 'alGrpFinance' },
    // Брони
    booking_add:          { icon: '📋', label: 'alBookingAdd',            color: 'purple',  group: 'alGrpBookings' },
    booking_accept:       { icon: '✅', label: 'alBookingAccept',          color: 'emerald', group: 'alGrpBookings' },
    booking_reject:       { icon: '❌', label: 'alBookingReject',          color: 'rose',    group: 'alGrpBookings' },
    // Финансы
    expense_add:          { icon: '💳', label: 'alExpenseAdd',            color: 'amber',   group: 'alGrpFinance' },
    payment_add:          { icon: '💵', label: 'alPaymentAdd',            color: 'green',   group: 'alGrpFinance' },
    debt_add:             { icon: '💸', label: 'alDebtAdd',               color: 'rose',    group: 'alGrpFinance' },
    debt_paid:            { icon: '💰', label: 'alDebtPaid',              color: 'emerald', group: 'alGrpFinance' },
    super_payment:        { icon: '🛡️', label: 'alSuperPayment',          color: 'purple',  group: 'alGrpFinance' },
    super_payment_add:    { icon: '➕', label: 'alSuperPaymentAdd',       color: 'purple',  group: 'alGrpFinance' },
    super_payment_edit:   { icon: '✏️', label: 'alSuperPaymentEdit',      color: 'purple',  group: 'alGrpFinance' },
    guest_paid_fix:       { icon: '🩹', label: 'alGuestPaidFix',           color: 'indigo',  group: 'alGrpFinance' },
    contract_writeoff:    { icon: '✂️', label: 'alContractWriteoff',       color: 'purple',  group: 'alGrpFinance' },
    contract_writeoff_undo:{ icon: '↩️', label: 'alContractWriteoffUndo',   color: 'slate',   group: 'alGrpFinance' },
    // Промокоды
    promo_create:         { icon: '🏷️', label: 'alPromoCreate',          color: 'orange',  group: 'alGrpPromo' },
    promo_delete:         { icon: '🗑️', label: 'alPromoDelete',          color: 'rose',    group: 'alGrpPromo' },
    promo_used:           { icon: '✂️', label: 'alPromoUsed',             color: 'purple',  group: 'alGrpPromo' },
    // Сессии / Вход
    login:                { icon: '🔑', label: 'alLogin',                color: 'blue',    group: 'alGrpSessions' },
    logout:               { icon: '👋', label: 'alLogout',               color: 'slate',   group: 'alGrpSessions' },
    force_logout:         { icon: '🔒', label: 'alForceLogout',          color: 'rose',    group: 'alGrpSessions' },
    session_revoked:      { icon: '🚫', label: 'alSessionRevoked',       color: 'orange',  group: 'alGrpSessions' },
    // E-mehmon
    registration_add:     { icon: '🪪', label: 'alRegistrationAdd',      color: 'purple',  group: 'alGrpEmehmon' },
    registration_extend:  { icon: '🔄', label: 'alRegistrationExtend',   color: 'indigo',  group: 'alGrpEmehmon' },
    registration_remove:  { icon: '🔴', label: 'alRegistrationRemove',   color: 'slate',   group: 'alGrpEmehmon' },
    // Клиенты
    sync_clients:         { icon: '🔄', label: 'alSyncClients',          color: 'blue',    group: 'alGrpClients' },
    // Система
    auto_shift_start:     { icon: '🟢', label: 'alAutoShiftStart',        color: 'emerald', group: 'alGrpSystem' },
    shift_transfer:       { icon: '🤝', label: 'alShiftTransfer',         color: 'indigo',  group: 'alGrpShifts' },
    shift_split:          { icon: '½',  label: 'alShiftSplit',            color: 'indigo',  group: 'alGrpShifts' },
    shift_unsplit:        { icon: '↩️', label: 'alShiftUnsplit',          color: 'slate',   group: 'alGrpShifts' },
    error:                { icon: '⚠️', label: 'alError',                color: 'rose',    group: 'alGrpSystem' },
    system_error:         { icon: '🚨', label: 'alSystemError',          color: 'rose',    group: 'alGrpSystem' },
    version_check:        { icon: '🔄', label: 'alVersionCheck',          color: 'blue',    group: 'alGrpSystem' },
};

export const COLOR_MAP = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    blue:    'bg-blue-50 text-blue-700 border-blue-200',
    indigo:  'bg-indigo-50 text-indigo-700 border-indigo-200',
    purple:  'bg-purple-50 text-purple-700 border-purple-200',
    rose:    'bg-rose-50 text-rose-700 border-rose-200',
    amber:   'bg-amber-50 text-amber-700 border-amber-200',
    orange:  'bg-orange-50 text-orange-700 border-orange-200',
    green:   'bg-green-50 text-green-700 border-green-200',
    slate:   'bg-slate-100 text-slate-600 border-slate-200',
};
