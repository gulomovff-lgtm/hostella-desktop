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
/** Входы и выходы: у супера они личные — админ их не видит (решение владельца 2026-09-25). */
export const SESSION_ACTIONS = new Set(['login', 'logout', 'force_logout']);

export const isSuperOnlyAction = (action) => SUPER_ONLY_ACTIONS.has(action);

/** Запись, которую админ не должен видеть: зачёты и входы/выходы самого супера. */
export const hiddenFromAdmin = (e) =>
  isSuperOnlyAction(e?.action) || (e?.userRole === 'super' && SESSION_ACTIONS.has(e?.action));

/** Коллекция, в которую пишется действие (user — кто его совершил). */
export const auditCollectionFor = (action, user = null) =>
  (isSuperOnlyAction(action) || (user?.role === 'super' && SESSION_ACTIONS.has(action))) ? 'auditLogSuper' : 'auditLog';

/**
 * Журнал для роли: супер — оба журнала по времени; админ — только общий и без
 * зачётов; остальным — ничего.
 */
export function visibleAuditFor(role, common = [], superOnly = []) {
  if (role === 'super') {
    return [...common, ...superOnly].sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  }
  if (role === 'admin') return common.filter(e => !hiddenFromAdmin(e));
  return [];
}
