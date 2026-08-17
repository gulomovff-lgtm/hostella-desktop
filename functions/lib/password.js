/**
 * password — хеширование и проверка паролей на сервере.
 *
 * Формат хранения: PBKDF2-SHA256, 210 000 итераций, случайная соль на каждого
 * пользователя. Старый формат (несолёный SHA-256) и совсем древний plaintext
 * принимаются только для входа и сразу апгрейдятся: несолёный SHA-256 перебирается
 * по словарю за минуты, поэтому долго жить он не должен.
 *
 * Только node:crypto — модуль импортируется и в функции, и в тесты.
 */

const crypto = require('crypto');

const ALGO = 'pbkdf2-sha256';
const ITERATIONS = 210000;
const KEY_LEN = 32;
const SALT_LEN = 16;

/** Хеш пароля в текущем формате. */
function hashPassword(password, salt = crypto.randomBytes(SALT_LEN).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password), salt, ITERATIONS, KEY_LEN, 'sha256').toString('hex');
  return { algo: ALGO, iterations: ITERATIONS, salt, hash };
}

/** Сравнение за константное время (одинаковая длина гарантирована hex-кодировкой). */
function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'hex');
  const bb = Buffer.from(String(b), 'hex');
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Строка выглядит как несолёный SHA-256 hex (старый клиентский формат). */
function isLegacySha256(value) {
  return typeof value === 'string' && value.length === 64 && /^[0-9a-f]+$/.test(value);
}

/** Проверка по записи из userSecrets. */
function verifyAgainstSecret(password, secret) {
  if (!secret?.hash || !secret?.salt) return false;
  const iterations = Number(secret.iterations) || ITERATIONS;
  const calc = crypto.pbkdf2Sync(String(password), secret.salt, iterations, KEY_LEN, 'sha256').toString('hex');
  return safeEqualHex(calc, secret.hash);
}

/**
 * Проверка по старому полю users.pass (SHA-256 или plaintext).
 * @returns {boolean}
 */
function verifyLegacy(password, stored) {
  if (!stored) return false;
  if (isLegacySha256(stored)) {
    const sha = crypto.createHash('sha256').update(String(password)).digest('hex');
    return safeEqualHex(sha, stored);
  }
  // plaintext — сравниваем через хеши, чтобы не зависеть от длины
  const a = crypto.createHash('sha256').update(String(password)).digest();
  const b = crypto.createHash('sha256').update(String(stored)).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Единая проверка: сначала современный секрет, затем legacy.
 * @returns {{match: boolean, needsUpgrade: boolean}} needsUpgrade — пароль верный,
 *   но лежит в старом формате: вызывающий обязан перехешировать.
 */
function verifyPassword(password, { secret, legacyPass } = {}) {
  if (!password) return { match: false, needsUpgrade: false };
  if (secret?.hash) return { match: verifyAgainstSecret(password, secret), needsUpgrade: false };
  const match = verifyLegacy(password, legacyPass);
  return { match, needsUpgrade: match };
}

module.exports = {
  ALGO,
  ITERATIONS,
  hashPassword,
  verifyPassword,
  verifyAgainstSecret,
  verifyLegacy,
  isLegacySha256,
  safeEqualHex,
};
