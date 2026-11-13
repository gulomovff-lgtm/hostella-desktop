// Сайт кадастра (reg.emehmon.uz, «Listovka») — регистрация иностранца по дому-
// кадастру без рук (решение владельца 13.11.2026).
//
//  • Вход: reg.emehmon.uz/auth/oneid → OneID (id.egov.uz) → вкладка «ERI» →
//    ключ ЭЦП по номеру сертификата → «Kirish». Пароль ключа E-IMZO спрашивает
//    СВОИМ окном (не страница) — его печатает typeEimzoPassword, и только если
//    впереди окно процесса E-IMZO.
//  • Листок: 5 шагов формы /listovka (гость → данные + кадастр + дни →
//    цель/тип «Other» → дети пусто → «Saqlash»). Сумма — из итога 5-го шага.
//  • Оплата: окно оплаты (действует 24 часа) — карта, срок, телефон заполняем,
//    «Оплатить» жмём; код из SMS вводит кассир сам.
//
// Скрипты страницы — строки для executeJavaScript; данные гостя внутрь
// попадают только через JSON.stringify.

const KADASTR_ORIGIN = 'https://reg.emehmon.uz';

// Хосты окна кадастра: сам сайт и вход OneID. Остальное окно не открывает.
// Цепочка входа (проверено 13.11.2026): reg.emehmon.uz/auth/oneid →
// sso.egov.uz/sso/oauth/Authorization.do → id.egov.uz → обратно на
// http://reg.emehmon.uz/user/autosocialize/egov (сайт сам переводит на https).
// Без sso.egov.uz и http-возврата окно оставалось на /login («не удалось
// войти ключом ЭЦП»).
const isKadastrUrl = (url) => {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    if (u.protocol === 'http:') return h === 'reg.emehmon.uz' && u.pathname.indexOf('/user/autosocialize/') === 0;
    if (u.protocol !== 'https:') return false;
    return h === 'reg.emehmon.uz' || h === 'id.egov.uz' || h === 'sso.egov.uz';
  } catch { return false; }
};

// Ссылка оплаты из ответа сайта — только /listovka/payTS/<id> на своём сайте.
const safePayUrl = (url) => {
  try {
    const u = new URL(String(url || ''), KADASTR_ORIGIN);
    if (u.origin !== KADASTR_ORIGIN) return '';
    return /^\/listovka\/payTS\/[A-Za-z0-9_-]+$/.test(u.pathname) ? u.toString() : '';
  } catch { return ''; }
};

const COMMON = `
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  async function waitFor(fn, tries, gap){ for (var i=0;i<tries;i++){ var v=null; try { v=fn(); } catch(e){} if (v) return v; await sleep(gap); } return null; }
  function vis(el){ if (!el) return false; var r=el.getBoundingClientRect(); var s=getComputedStyle(el); return r.width>0 && r.height>0 && s.visibility!=='hidden' && s.display!=='none'; }
  function txt(el){ return String((el && (el.innerText||el.textContent))||'').replace(/\\s+/g,' ').trim(); }
`;

// ─── Вход через OneID ────────────────────────────────────────────────────────
// Работает на id.egov.uz. Возвращает:
//   clicked — ключ выбран, «Kirish» нажат (дальше окно пароля E-IMZO);
//   no_eimzo — страница не видит E-IMZO; no_key — нужного ключа нет в списке.
function buildOneIdLoginScript(opts) {
  const O = JSON.stringify({ cert: String((opts && opts.cert) || '').trim() });
  return `(async function(){
  ${COMMON}
  var O = ${O};
  if (location.hostname.indexOf('id.egov.uz') === -1) return { status:'not_oneid', url: location.href };
  function buttons(){ return Array.prototype.slice.call(document.querySelectorAll('button,[role=tab],a')).filter(vis); }
  var tab = await waitFor(function(){ return buttons().filter(function(b){ return /^(ERI|ЭЦП|EDS|E-IMZO)$/i.test(txt(b)); })[0]; }, 40, 250);
  if (!tab) return { status:'no_tab' };
  tab.click();
  await sleep(1200);
  // E-IMZO не запущен — страница пишет об этом вместо списка ключей
  var bodyTxt = function(){ return txt(document.body); };
  var hasKey = function(){ return O.cert && bodyTxt().indexOf(O.cert) !== -1; };
  var ok = await waitFor(function(){ return hasKey() || /E-IMZO modul|E-IMZO модул|E-IMZO module/i.test(bodyTxt()); }, 40, 250);
  if (!hasKey()) {
    // Ключ не первый — раскрываем список и выбираем по номеру сертификата
    var opener = document.querySelector('[role=combobox],[aria-haspopup=listbox],.MuiSelect-select,.MuiSelect-root');
    if (opener && vis(opener)) {
      opener.dispatchEvent(new MouseEvent('mousedown', { bubbles:true }));
      try { opener.click(); } catch(e){}
      var opt = await waitFor(function(){
        return Array.prototype.slice.call(document.querySelectorAll('[role=option],li')).filter(function(li){ return vis(li) && txt(li).indexOf(O.cert) !== -1; })[0];
      }, 20, 250);
      if (opt) { opt.click(); await sleep(600); }
    }
  }
  if (!hasKey()) {
    if (/E-IMZO modul|E-IMZO модул|E-IMZO module/i.test(bodyTxt())) return { status:'no_eimzo' };
    return { status:'no_key', page: bodyTxt().slice(0, 300) };
  }
  // Выбран ли нужный ключ, а не просто упомянут в раскрытом списке
  var shown = Array.prototype.slice.call(document.querySelectorAll('[role=combobox],.MuiSelect-select,[aria-haspopup=listbox]')).filter(vis).map(txt).join(' ');
  if (shown && shown.indexOf(O.cert) === -1) return { status:'no_key', page: shown.slice(0, 200) };
  var go = buttons().filter(function(b){ return /^(Kirish|Войти|Login|Кириш)$/i.test(txt(b)) && !b.disabled; }).pop();
  if (!go) return { status:'no_button' };
  go.click();
  return { status:'clicked' };
})()`;
}

// ─── Листок прибытия ─────────────────────────────────────────────────────────
// data: { iso3, birth (dd/mm/yyyy), passport, pspDate (dd/mm/yyyy), issuedBy,
//         days, cadMatch, dryRun }
// Ответ: saved {amount, payUrl, message} | ready {amount} (dryRun) |
//   need_login | not_found | no_citizen | no_cadastre | no_psp_date |
//   days_limit {max} | housing_blocked | compliance_danger | portal_error | error
function buildListovkaScript(data) {
  const D = JSON.stringify(data || {});
  return `(async function(){
  ${COMMON}
  var D = ${D};
  var $ = window.jQuery;
  if (location.hostname !== 'reg.emehmon.uz' || (location.pathname||'').indexOf('/listovka') !== 0 || !$) return { status:'need_login', url: location.href };
  function alertText(){
    var a = Array.prototype.slice.call(document.querySelectorAll('.jconfirm-box,.swal2-popup,.iziToast,.toast')).filter(vis).map(txt).join(' | ');
    return a.slice(0, 300);
  }
  function closeAlerts(){ Array.prototype.slice.call(document.querySelectorAll('.jconfirm-closeIcon,.swal2-confirm')).filter(vis).forEach(function(b){ try { b.click(); } catch(e){} }); }
  function setSel(id, pick){
    var el = document.getElementById(id); if (!el) return false;
    var o = Array.prototype.slice.call(el.options).filter(pick)[0];
    if (!o) return false;
    $(el).val(o.value).trigger('change');
    return o;
  }
  function setVal(id, v){ var el = document.getElementById(id); if (!el) return false; $(el).val(v).trigger('input').trigger('change'); el.dispatchEvent(new Event('blur')); return true; }
  function active(tab){ var p = document.getElementById(tab); return p && p.classList.contains('active'); }

  // Форма нового листка (тот же путь, что кнопка «+»)
  if (!document.getElementById('listovkaFormAjax')) {
    if (typeof window.openNewListokForm === 'function') window.openNewListokForm();
    else if (typeof window.NewRecord === 'function') window.NewRecord();
  }
  var form = await waitFor(function(){ return document.getElementById('listovkaFormAjax'); }, 60, 250);
  if (!form) return { status:'no_form', message: alertText() };

  // Шаг 1: гражданство, дата рождения, паспорт → поиск в погранбазе
  var ctzReady = await waitFor(function(){ var s=document.getElementById('id_citizen'); return s && s.options.length > 10; }, 60, 250);
  if (!ctzReady) return { status:'no_form', message:'citizens' };
  var ctz = setSel('id_citizen', function(o){ return o.value && o.text.trim().toUpperCase().indexOf(String(D.iso3||'').toUpperCase() + ' -') === 0; });
  if (!ctz) return { status:'no_citizen' };
  setVal('dtBirth', D.birth);
  setVal('pspNumb', D.passport);
  await sleep(200);
  var b1 = document.getElementById('gotab1'); if (b1) b1.click();
  var r1 = await waitFor(function(){
    if (document.getElementById('hash') && document.getElementById('hash').value) return 'ok';
    var a = alertText(); if (/topilmadi|rad etildi|not found|не найден/i.test(a)) return 'nf';
    return null;
  }, 160, 250);
  if (r1 !== 'ok') { var m1 = alertText(); closeAlerts(); return { status: r1 === 'nf' ? 'not_found' : 'portal_error', message: m1 }; }
  await waitFor(function(){ return active('tab01'); }, 20, 250);

  // Шаг 2: кадастр (нужный — по площади), документ, дни
  var cadReady = await waitFor(function(){ var s=document.getElementById('id_cad'); return s && s.options.length > 1; }, 40, 250);
  if (!cadReady) return { status:'no_cadastre' };
  var cad = setSel('id_cad', function(o){ return o.value && D.cadMatch && o.text.indexOf(D.cadMatch) !== -1; });
  if (!cad) return { status:'no_cadastre', options: Array.prototype.slice.call(document.getElementById('id_cad').options).map(function(o){ return o.text.trim(); }).filter(Boolean).slice(0,5) };
  if (!D.pspDate) return { status:'no_psp_date' };
  setVal('pspDate', D.pspDate);
  setVal('pspIssuedBy', String(D.issuedBy || ctz.text.split(' - ').slice(1).join(' - ') || '').toUpperCase().replace(/[^A-Z0-9 -]/g,' ').replace(/\\s+/g,' ').trim());
  var wd = document.getElementById('wdays');
  var maxDays = wd ? parseInt(wd.getAttribute('max') || '0', 10) : 0;
  // Дата въезда (погранбаза) — по ней сайт считает 30 дней кадастра
  var border = String((document.getElementById('kppDate') || {}).value || '').trim();
  var days = D.days;
  if (wd && wd.hasAttribute('max') && maxDays < 1) return { status:'days_limit', max: 0, border: border };
  // Сайт разрешает меньше — оформляем сколько можно (fitMax), конец в Hostella поправит программа
  if (maxDays && days > maxDays) {
    if (!D.fitMax) return { status:'days_limit', max: maxDays, border: border };
    days = maxDays;
  }
  setVal('wdays', String(days));
  // Норма площади: ответ сайта приходит отдельным запросом
  await waitFor(function(){ var b=document.getElementById('housingNormBox'); return b && !/tekshirilmoqda|Kadastrni tanlang/i.test(txt(b)); }, 40, 250);
  if (window.HN_STATE && window.HN_STATE.blocking) return { status:'housing_blocked', message: String(window.HN_STATE.message||'').slice(0,300) };
  var b2 = document.getElementById('gotab2'); if (b2) b2.click();
  if (!(await waitFor(function(){ return active('tab02'); }, 20, 250))) {
    var bad = Array.prototype.slice.call(document.querySelectorAll('#tab01 .is-invalid')).map(function(e){ return e.id || e.name; }).join(',');
    return { status:'portal_error', step:2, message: (alertText() + ' ' + bad).trim() };
  }

  // Шаг 3: цель приезда и тип гостя — «Other»
  await waitFor(function(){ var a=document.getElementById('id_visittype'), b=document.getElementById('id_guest'); return a && b && a.options.length > 2 && b.options.length > 2; }, 40, 250);
  var other = function(o){ return /^other$/i.test(o.text.trim()) || /boshqa|другое/i.test(o.text); };
  if (!setSel('id_visittype', other) || !setSel('id_guest', other)) return { status:'portal_error', step:3, message:'other' };
  var b3 = document.getElementById('gotab3'); if (b3) b3.click();
  if (!(await waitFor(function(){ return active('tab03'); }, 20, 250))) return { status:'portal_error', step:3, message: alertText() };

  // Шаг 4: дети — пусто. Шаг 5: итог с суммой
  if (typeof window.goToGuestInfoTab === 'function') window.goToGuestInfoTab({ preventDefault: function(){} });
  else { var b4 = document.querySelector('#tab03 .btn-next'); if (b4) b4.click(); }
  var totalEl = await waitFor(function(){ var e=document.querySelector('#guestInfoSummary .gi-summary-cell-value-total'); return e && !e.classList.contains('is-pending') ? e : null; }, 80, 250);
  var amount = totalEl ? parseInt(txt(totalEl).replace(/[^0-9]/g,''), 10) || 0 : 0;
  await waitFor(function(){ return document.querySelector('#guestInfoCompliance .gi-compliance') || null; }, 40, 250);
  var danger = document.querySelector('#guestInfoCompliance .gi-compliance.level-danger');
  if (danger) return { status:'compliance_danger', amount: amount, message: txt(danger).slice(0, 300) };
  if (window.HN_STATE && window.HN_STATE.blocking) return { status:'housing_blocked', message: String(window.HN_STATE.message||'').slice(0,300) };
  if (D.dryRun) return { status:'ready', amount: amount, wdays: days, max: maxDays, border: border };

  // Сохранить. Ответ сайта ловим, подменив его обработчик (вызывается по имени)
  window.__hostellaKad = null;
  var origResp = window.showResponse, origErr = window.showError;
  window.showResponse = function(d){ window.__hostellaKad = { ok:true, d:d }; return origResp && origResp.apply(this, arguments); };
  window.showError = function(d){ window.__hostellaKad = { ok:false, d:d }; return origErr && origErr.apply(this, arguments); };
  $('#listovkaFormAjax').submit();
  var res = await waitFor(function(){ return window.__hostellaKad; }, 160, 250);
  if (!res) return { status:'submit_unconfirmed', amount: amount, message: alertText() };
  var d = res.d || {};
  var plain = function(h){ var div=document.createElement('div'); div.innerHTML=String(h||''); return txt(div).slice(0,300); };
  if (res.ok && d.status === 'success') return { status:'saved', amount: amount, wdays: days, max: maxDays, border: border, payUrl: String(d.link||''), message: plain(d.message) };
  return { status:'portal_error', amount: amount, message: plain((d.message||'') + ' ' + (d.errors||'')) };
})()`;
}

// ─── Оплата турсбора ─────────────────────────────────────────────────────────
// Ждём окно оплаты, вписываем карту и жмём «Оплатить». Ответ:
//   otp {phoneMask} — сайт прислал SMS, код вводит кассир;
//   card_error {message} | no_pay_form
function buildPayFillScript(card) {
  const C = JSON.stringify(card || {});
  return `(async function(){
  ${COMMON}
  var C = ${C};
  var $ = window.jQuery;
  var num = await waitFor(function(){ var e=document.getElementById('cardNumber'); return vis(e) ? e : null; }, 80, 250);
  if (!num || !$) return { status:'no_pay_form' };
  var amountEl = document.querySelector('.pm-amount-value');
  var amount = amountEl ? parseInt(txt(amountEl).replace(/[^0-9]/g,''), 10) || 0 : 0;
  $('#cardNumber').val(String(C.number||'')).trigger('input');
  $('#card_mm').val(String(C.mm||'')).trigger('input');
  $('#card_yy').val(String(C.yy||'')).trigger('input');
  $('#phoneNumber').val(String(C.phone||'')).trigger('input');
  await sleep(300);
  var btn = document.getElementById('add_card'); if (!btn) return { status:'no_pay_form' };
  btn.click();
  var r = await waitFor(function(){
    var cd = document.getElementById('confirmData'); if (vis(cd)) return 'otp';
    var e = Array.prototype.slice.call(document.querySelectorAll('.swal2-popup,.iziToast')).filter(vis).map(txt).join(' ');
    return e ? 'err:' + e : null;
  }, 120, 250);
  if (r === 'otp') {
    var f = document.querySelector('#otpInputs input'); if (f) f.focus();
    return { status:'otp', amount: amount, phoneMask: txt(document.getElementById('confirmPhone')) };
  }
  return { status:'card_error', amount: amount, message: String(r||'').replace(/^err:/,'').slice(0,300) };
})()`;
}

// ─── Список листков (сверка с Hostella) ──────────────────────────────────────
// Тот же запрос, что таблица /listovka (DataTables, по дате регистрации,
// новые сверху). Строка: { id, encId, name, passport, dt 'dd.mm.yyyy HH:MM',
// wdays, paid, payUrl }.
function buildListFetchScript(opts) {
  const O = JSON.stringify({ length: Math.min(500, Math.max(25, Number(opts && opts.length) || 250)) });
  return `(async function(){
  var O = ${O};
  if (location.hostname !== 'reg.emehmon.uz' || (location.pathname||'').indexOf('/listovka') !== 0) return { status:'need_login' };
  var cols = ['', 'tb_listok.id', 'guest', 'tb_listok.dtbirth', 'tb_listok.id_citizen', 'psp', 'tb_listok.created_at', 'tb_listok.wdays', 'tb_listok.isMobile', 'adm', 'tb_listok.paystatus'];
  var data = ['', 'id', 'guest', 'datebirth', 'ctz', 'psp', 'dt', 'wdays', 'isMobile', 'adm', 'paystatus'];
  var q = new URLSearchParams();
  q.set('draw', '1'); q.set('start', '0'); q.set('length', String(O.length));
  q.set('order[0][column]', '6'); q.set('order[0][dir]', 'desc');
  q.set('search[value]', ''); q.set('search[regex]', 'false');
  for (var i = 0; i < cols.length; i++) {
    q.set('columns['+i+'][data]', data[i]); q.set('columns['+i+'][name]', cols[i]);
    q.set('columns['+i+'][searchable]', i === 0 ? 'false' : 'true'); q.set('columns['+i+'][orderable]', i === 0 ? 'false' : 'true');
    q.set('columns['+i+'][search][value]', ''); q.set('columns['+i+'][search][regex]', 'false');
  }
  var r;
  try {
    r = await fetch('/listovka/jsdatalive?' + q.toString(), { credentials:'same-origin', headers: { 'X-Requested-With':'XMLHttpRequest', 'Accept':'application/json' } });
  } catch (e) { return { status:'error', message: String(e && e.message || e) }; }
  if (!r.ok) return { status: r.status === 401 || r.status === 419 ? 'need_login' : 'error', message: 'HTTP ' + r.status };
  var j; try { j = await r.json(); } catch (e) { return { status:'need_login', message:'not_json' }; }
  function plain(h){ var d = document.createElement('div'); d.innerHTML = String(h == null ? '' : h); return (d.textContent || '').replace(/\\s+/g,' ').trim(); }
  function attr(h, re){ var m = String(h||'').match(re); return m ? m[1] : ''; }
  var rows = (j.data || []).map(function(x){
    var payHtml = String(x.paystatus || '');
    return {
      id: plain(x.id),
      encId: attr(x.id, /data-id="([^"]+)"/),
      name: plain(x.guest),
      passport: plain(x.psp).replace(/\\s/g,'').toUpperCase(),
      dt: plain(x.dt),
      wdays: parseInt(plain(x.wdays), 10) || 0,
      paid: !/payTS/.test(payHtml) && /langan|paid|оплач/i.test(plain(payHtml)),
      payUrl: (attr(payHtml, /href="([^"]*payTS[^"]*)"/) || ''),
    };
  });
  return { status:'ok', total: j.recordsTotal || rows.length, rows: rows };
})()`;
}

// Успех оплаты: окно сайта «Tranzaksiya muvaffaqiyatli yakunlandi!»
const PAY_DONE_CHECK = "(function(){try{var t=document.querySelector('.swal2-popup .swal2-title');return !!(t&&/muvaffaqiyatli|успешно|success/i.test(t.textContent||'')&&document.querySelector('.swal2-icon-success, .swal2-success'));}catch(e){return false;}})()";

// ─── Пароль ключа в окно E-IMZO ──────────────────────────────────────────────
// E-IMZO (Java) открывает своё окно «введите пароль». Ищем видимое окно
// процесса из папки E-IMZO, выводим вперёд и печатаем пароль — только если
// впереди именно оно (проверяем перед вводом). Пароль идёт в PowerShell через
// stdin: в командной строке процесса его не видно.
const EIMZO_PS = `
$ErrorActionPreference = 'Stop'
$pw = [Console]::In.ReadLine()
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System; using System.Runtime.InteropServices; using System.Text;
public class HWin {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
}
'@
function EimzoPids { @(Get-Process | Where-Object { try { $_.Path -like '*\\E-IMZO\\*' } catch { $false } } | ForEach-Object { [uint32]$_.Id }) }
function FindWin($pids) {
  $found = New-Object System.Collections.ArrayList
  [HWin]::EnumWindows({ param($h, $l)
    if ([HWin]::IsWindowVisible($h)) {
      $p = [uint32]0; [void][HWin]::GetWindowThreadProcessId($h, [ref]$p)
      if ($pids -contains $p) {
        $sb = New-Object System.Text.StringBuilder 256; [void][HWin]::GetWindowText($h, $sb, 256)
        if ($sb.Length -gt 0) { [void]$found.Add(@{ h = $h; t = $sb.ToString() }) }
      }
    }
    return $true }, [IntPtr]::Zero) | Out-Null
  $pref = $found | Where-Object { $_.t -match '(?i)parol|пароль|password|kalit|ключ' } | Select-Object -First 1
  if ($pref) { return $pref.h }
  if ($found.Count -gt 0) { return $found[0].h }
  return [IntPtr]::Zero
}
function Esc($s) { ($s.ToCharArray() | ForEach-Object { if ('+^%~(){}[]'.Contains([string]$_)) { '{' + $_ + '}' } else { [string]$_ } }) -join '' }
$deadline = (Get-Date).AddSeconds([int]$env:HOSTELLA_EIMZO_WAIT)
while ((Get-Date) -lt $deadline) {
  $pids = EimzoPids
  if ($pids.Count -gt 0) {
    $h = FindWin $pids
    if ($h -ne [IntPtr]::Zero) {
      [void][HWin]::ShowWindow($h, 9)
      [System.Windows.Forms.SendKeys]::SendWait('%')
      [void][HWin]::SetForegroundWindow($h)
      Start-Sleep -Milliseconds 400
      $fg = [HWin]::GetForegroundWindow(); $fp = [uint32]0; [void][HWin]::GetWindowThreadProcessId($fg, [ref]$fp)
      if ($pids -contains $fp) {
        [System.Windows.Forms.SendKeys]::SendWait((Esc $pw))
        Start-Sleep -Milliseconds 150
        $fg2 = [HWin]::GetForegroundWindow(); $fp2 = [uint32]0; [void][HWin]::GetWindowThreadProcessId($fg2, [ref]$fp2)
        if ($pids -contains $fp2) { [System.Windows.Forms.SendKeys]::SendWait('{ENTER}'); Write-Output 'typed'; exit 0 }
        Write-Output 'focus_lost'; exit 0
      }
    }
  }
  Start-Sleep -Milliseconds 500
}
Write-Output 'no_window'
`;

// scriptDir — папка, куда положить сам скрипт (в нём нет секретов); пароль
// уходит одной строкой в stdin и читается [Console]::In.ReadLine().
function typeEimzoPassword(password, { waitSec = 60, log, scriptDir } = {}) {
  const { spawn } = require('child_process');
  const fs = require('fs');
  const path = require('path');
  return new Promise((resolve) => {
    if (!password) { resolve('no_password'); return; }
    let file;
    try {
      file = path.join(scriptDir || require('os').tmpdir(), 'hostella-eimzo.ps1');
      fs.writeFileSync(file, '﻿' + EIMZO_PS, 'utf8');
    } catch (e) { resolve('script_failed'); return; }
    let out = '';
    let ps;
    try {
      ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], {
        windowsHide: true,
        env: { ...process.env, HOSTELLA_EIMZO_WAIT: String(waitSec) },
      });
    } catch (e) { resolve('spawn_failed'); return; }
    const timer = setTimeout(() => { try { ps.kill(); } catch (_) {} resolve('timeout'); }, (waitSec + 20) * 1000);
    ps.on('error', () => { clearTimeout(timer); resolve('spawn_failed'); });
    ps.stdout.on('data', (d) => { out += String(d); });
    ps.stderr.on('data', (d) => { if (log) log.warn('[kadastr] eimzo ps:', String(d).slice(0, 200)); });
    ps.on('close', () => { clearTimeout(timer); resolve((out.trim().split(/\r?\n/).pop() || 'no_output').trim()); });
    ps.stdin.write(String(password) + '\n');
    ps.stdin.end();
  });
}

module.exports = {
  KADASTR_ORIGIN, isKadastrUrl, safePayUrl,
  buildOneIdLoginScript, buildListovkaScript, buildPayFillScript, buildListFetchScript, PAY_DONE_CHECK,
  typeEimzoPassword, EIMZO_PS,
};
