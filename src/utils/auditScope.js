/**
 * auditScope.js — что из журнала действий видит админ, а что только супер.
 *
 * Решение владельца (2026-09-25): админ смотрит «Историю изменений», но без
 * зачётов сумм — ни старого «зачесть сумму» из карточки гостя, ни ручных
 * оплат супера из отчёта (они по замыслу выглядят как обычные платежи).
 *
 * Такие записи пишутся в отдельную коллекцию auditLogSuper, которую правила
 * базы отдают только суперу, — скрытие держится на сервере, а не на экране.
 * Старые записи зачётов остались в общем журнале; их от админа прячет
 * visibleAuditFor (переносить журнал задним числом не стали: он неизменяем).
 *
 * Без Firebase — покрыто тестами.
 */

export const SUPER_ONLY_ACTIONS = new Set(['super_payment', 'super_payment_add', 'super_payment_edit']);

export const isSuperOnlyAction = (action) => SUPER_ONLY_ACTIONS.has(action);

/** Коллекция, в которую пишется действие. */
export const auditCollectionFor = (action) => (isSuperOnlyAction(action) ? 'auditLogSuper' : 'auditLog');

/**
 * Журнал для роли: супер — оба журнала по времени; админ — только общий и без
 * зачётов; остальным — ничего.
 */
export function visibleAuditFor(role, common = [], superOnly = []) {
  if (role === 'super') {
    return [...common, ...superOnly].sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  }
  if (role === 'admin') return common.filter(e => !isSuperOnlyAction(e?.action));
  return [];
}
