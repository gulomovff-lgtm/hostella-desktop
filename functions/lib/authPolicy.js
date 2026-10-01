/**
 * authPolicy — политика защиты входа от перебора паролей.
 *
 * Чистый модуль без firebase и без обращения к часам: всё состояние и «сейчас»
 * приходят аргументами. Так политику можно покрыть тестами и переиспользовать
 * для любых проверок пароля (вход кассира, пароль админ-статистики).
 *
 * Модель: на каждый ключ (логин, IP) держим счётчик неудач в окне WINDOW_MS.
 * Порог превышен — ключ блокируется на срок из LOCK_STEPS, счётчик продолжает
 * расти, поэтому упорный перебор упирается во всё более длинные паузы.
 * Успешный вход обнуляет счётчик.
 */

/** Окно, за которое копятся неудачные попытки. */
const WINDOW_MS = 30 * 60 * 1000;

/** Пороги: с какого числа неудач и на сколько блокируем. */
const LOCK_STEPS = [
  { fails: 20, lockMs: 60 * 60 * 1000 }, // 20 неудач → час
  { fails: 10, lockMs: 15 * 60 * 1000 }, // 10 неудач → 15 минут
  { fails: 5,  lockMs: 60 * 1000 },      // 5 неудач  → минута
];

/** Пустое состояние счётчика. */
const emptyState = () => ({ fails: 0, firstFailAt: 0, lockedUntil: 0 });

/** Нормализует то, что пришло из Firestore (или undefined). */
const readState = (state) => ({
  fails: Number(state?.fails) || 0,
  firstFailAt: Number(state?.firstFailAt) || 0,
  lockedUntil: Number(state?.lockedUntil) || 0,
});

/**
 * Можно ли сейчас пробовать пароль по этому ключу.
 * @returns {{allowed: boolean, retryAfterSec: number, state: object}}
 *   state — состояние с уже истёкшим окном/блокировкой (готово к записи).
 */
function checkAttempt(state, now) {
  const s = readState(state);

  if (s.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((s.lockedUntil - now) / 1000), state: s };
  }
  // Блокировка истекла или окно закончилось — счётчик начинается заново
  if (s.lockedUntil > 0 || (s.firstFailAt && now - s.firstFailAt > WINDOW_MS)) {
    return { allowed: true, retryAfterSec: 0, state: emptyState() };
  }
  return { allowed: true, retryAfterSec: 0, state: s };
}

/**
 * Учесть неудачную попытку.
 * @returns {{state: object, locked: boolean, retryAfterSec: number}}
 */
function registerFailure(state, now) {
  const s = checkAttempt(state, now).state;
  const fails = s.fails + 1;
  const firstFailAt = s.firstFailAt || now;

  const step = LOCK_STEPS.find(x => fails >= x.fails);
  const lockedUntil = step ? now + step.lockMs : 0;

  return {
    state: { fails, firstFailAt, lockedUntil },
    locked: !!step,
    retryAfterSec: step ? Math.ceil(step.lockMs / 1000) : 0,
  };
}

/** Успешный вход — счётчик обнуляется. */
function registerSuccess() {
  return emptyState();
}

/** Человеческий текст для кассира: «попробуйте через 15 мин». */
function lockMessage(retryAfterSec) {
  if (retryAfterSec >= 60) {
    const min = Math.ceil(retryAfterSec / 60);
    return `Слишком много попыток входа. Попробуйте через ${min} мин.`;
  }
  return `Слишком много попыток входа. Попробуйте через ${Math.max(1, retryAfterSec)} с.`;
}

module.exports = {
  WINDOW_MS,
  LOCK_STEPS,
  checkAttempt,
  registerFailure,
  registerSuccess,
  lockMessage,
};
