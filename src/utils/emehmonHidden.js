/**
 * emehmonHidden.js — чистые правила «скрытой» регистрации e-mehmon (без базы,
 * чтобы проверялись тестом). Запись и подписка — utils/emehmonIgnore.js.
 */
const norm = (s) => String(s || '').replace(/\s/g, '').toUpperCase();

/** Ключ строки портала: паспорт надёжнее, имя — только когда паспорта нет. */
export const ignoreKey = (r) => (r?.passport ? norm(r.passport) : (r?.fullName || r?.name) ? 'N:' + norm(r.fullName || r.name) : '');

/**
 * Скрыт ли человек в этом филиале. С 2026-11-09 (решение владельца) скрыть
 * можно любую регистрацию, не только «нет в программе», и скрытого автомат
 * не выводит из портала НИКОГДА: ни при выселении, ни сверкой, ни по сроку.
 * Сверяем и по паспорту, и по имени: у скрытой без паспорта строки ключ — имя.
 */
export const isEmehmonHidden = (data, hostelId, r) => {
  const here = data?.[hostelId || 'hostel1'];
  if (!here || !r) return false;
  const p = r.passport ? norm(r.passport) : '';
  const n = (r.fullName || r.name) ? 'N:' + norm(r.fullName || r.name) : '';
  return !!((p && here[p]) || (n && here[n]));
};
