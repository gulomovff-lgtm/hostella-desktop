/**
 * Хеширование паролей на сервере: PBKDF2, соли, приём и апгрейд старых форматов.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pw = require('../functions/lib/password.js');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

test('пароль проверяется своим же хешем', () => {
  const secret = pw.hashPassword('kassa-2026');
  assert.equal(pw.verifyAgainstSecret('kassa-2026', secret), true);
  assert.equal(pw.verifyAgainstSecret('kassa-2025', secret), false);
});

test('соль у каждого своя — одинаковые пароли дают разные хеши', () => {
  const a = pw.hashPassword('one-and-the-same');
  const b = pw.hashPassword('one-and-the-same');
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
  assert.equal(pw.verifyAgainstSecret('one-and-the-same', a), true);
  assert.equal(pw.verifyAgainstSecret('one-and-the-same', b), true);
});

test('хеш не хранит пароль в открытом виде', () => {
  const secret = pw.hashPassword('otkrytyj-parol');
  assert.ok(!JSON.stringify(secret).includes('otkrytyj-parol'));
  assert.equal(secret.iterations >= 210000, true, 'итераций должно быть много — иначе перебор дешёвый');
});

test('старый несолёный SHA-256 принимается и помечается на апгрейд', () => {
  const legacy = sha256('staryj');
  const res = pw.verifyPassword('staryj', { legacyPass: legacy });
  assert.equal(res.match, true);
  assert.equal(res.needsUpgrade, true, 'после входа секрет обязан переехать в PBKDF2');
});

test('легаси plaintext тоже принимается и требует апгрейда', () => {
  const res = pw.verifyPassword('12345', { legacyPass: '12345' });
  assert.equal(res.match, true);
  assert.equal(res.needsUpgrade, true);
});

test('современный секрет имеет приоритет над легаси-полем', () => {
  const secret = pw.hashPassword('novyj');
  const res = pw.verifyPassword('staryj', { secret, legacyPass: sha256('staryj') });
  assert.equal(res.match, false, 'после переезда старый пароль работать не должен');
});

test('пустой пароль не проходит никогда', () => {
  assert.equal(pw.verifyPassword('', { legacyPass: sha256('') }).match, false);
  assert.equal(pw.verifyPassword('x', {}).match, false);
});

test('дефолтный супер-хеш — это sha256("super"), поэтому он и запрещён на сервере', () => {
  assert.equal(sha256('super'), '73d1b1b1bc1dabfb97f216d897b7968e44b06457920f00f2dc6c1ed3be25ad4c');
});
