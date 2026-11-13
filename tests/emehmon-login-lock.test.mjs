// Окно портала на странице входа кассир закрыть не может, пока не войдёт;
// после входа окно прячется/закрывается само (решение владельца 13.11.2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8');

test('все окна портала проходят через замок входа', () => {
  const harden = src.slice(src.indexOf('const hardenEmehmonWindow'), src.indexOf('const hardenEmehmonWindow') + 200);
  assert.match(harden, /lockUntilLogin\(win\)/);
});

test('на странице входа крестик выключен и закрытие отменяется', () => {
  assert.match(src, /win\.setClosable\(false\)/);
  assert.match(src, /if \(win\.isVisible\(\) && isPortalLogin\(win\)\) \{\s*e\.preventDefault\(\)/);
  assert.match(src, /Введите цифры с картинки/);
});

test('замок не держит программу при выходе', () => {
  assert.match(src, /app\.on\('before-quit', \(\) => \{ appQuitting = true; \}\)/);
  assert.match(src, /mainWindow\.on\('close', \(\) => \{ appQuitting = true; \}\)/);
  assert.match(src, /if \(appQuitting \|\| !mainWindow \|\| mainWindow\.isDestroyed\(\)\) return;/);
});

test('после входа: фоновое окно прячется, окно «Вход» закрывается, ручное остаётся', () => {
  assert.match(src, /after === 'close'/);
  assert.match(src, /after === 'hide'/);
  assert.match(src, /=== 'login' \? 'close' : 'keep'/);
});

test('страница входа определяется по пути /login', () => {
  const m = src.match(/const isPortalLogin = \(win\) => \{\s*try \{ return (\/.*?\/i)\.test/);
  assert.ok(m);
  const re = eval(m[1]);
  assert.ok(re.test('/login'));
  assert.ok(re.test('/login/'));
  assert.ok(!re.test('/listok'));
  assert.ok(!re.test('/loginx'));
});
