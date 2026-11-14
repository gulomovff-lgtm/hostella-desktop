// Заставка установки и обновления Hostella (13.11.2026): своё окно вместо
// серого окна NSIS. Сторож: файлы попадают в сборку, установщик и программа
// её запускают, тихая установка обновления остаётся тихой.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const mainSrc = readFileSync(new URL('../electron/main.js', import.meta.url), 'utf8');
const nsh = readFileSync(new URL('../assets/installer.nsh', import.meta.url), 'utf8');
const ps = readFileSync(new URL('../assets/hostella-splash.ps1', import.meta.url), 'utf8');

test('файлы заставки едут в сборку', () => {
  assert.ok(existsSync(new URL('../assets/splash-logo.png', import.meta.url)));
  const er = JSON.stringify(pkg.build.extraResources || []);
  assert.match(er, /hostella-splash\.ps1/);
  assert.match(er, /splash-logo\.png/);
  assert.equal(pkg.build.directories.buildResources, 'assets', 'installer.nsh берётся из папки ресурсов сборки');
});

test('установщик показывает заставку только при обычной установке', () => {
  assert.match(nsh, /!macro customInit/);
  assert.match(nsh, /\$\{IfNot\} \$\{Silent\}/);
  assert.match(nsh, /-Mode install -WatchPid \$0/);
});

test('обновление: заставка перед тихой установкой и при выходе с готовым обновлением', () => {
  assert.match(mainSrc, /showUpdateSplash\('update'\);\s*\n\s*\/\/ Даем рендереру/);
  assert.match(mainSrc, /autoUpdater\.quitAndInstall\(true, true\)/, 'установка по-прежнему тихая');
  assert.match(mainSrc, /if \(isUpdateDownloaded && !isInstallingUpdate\) showUpdateSplash\('update-quit'\)/);
});

test('скрипт заставки — UTF-8 с BOM (иначе PowerShell 5 ломает русский текст)', () => {
  const raw = readFileSync(new URL('../assets/hostella-splash.ps1', import.meta.url));
  assert.deepEqual([...raw.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.match(ps, /Image\.FromStream/, 'логотип читается в память — временная папка установщика не блокируется');
});
