// Скрипт автозаполнения e-mehmon. Инжектится в дочернее окно через executeJavaScript.
// Заполняет вход (email+пароль) и поля мастера, известные из Hostella.
// Капчу, проверку и «Войти»/«Сохранить» делает человек. Поля, которые e-mehmon ставит сам
// (страна рождения/прибытия, пол, Кпп №, дата заезда Кпп, ФИО), НЕ трогаем.

function buildAutofillScript(guest) {
  const G = JSON.stringify(guest || {});
  return `(function(){
  try {
    var GUEST = ${G};
    var $ = window.jQuery || window.$;

    // Прибытие: если мы УЖЕ были на create-page и теперь ушли с неё (после
    // сохранения нажали OK → /listok, или закрыли) — регистрация завершена,
    // закрываем окно и НЕ возвращаемся на создание.
    try {
      if (GUEST.mode !== 'departure') {
        var _arr = sessionStorage.getItem('hostellaArrivedTarget') === '1';
        var _onCreateNow = (location.pathname || '').indexOf('create-page') !== -1;
        var _onLoginNow = (location.pathname || '').indexOf('login') !== -1;
        if (_arr && !_onCreateNow && !_onLoginNow) {
          document.title = '__HOSTELLA_REG_DONE__';
          try { window.close(); } catch(e){}
          return;
        }
      }
    } catch(e){}

    // После входа — авто-редирект на нужную страницу (прибытие → create-page, убытие → /listok).
    // Редиректим только пока ни разу не достигли целевой страницы (иначе после
    // сохранения возвращало бы на новую регистрацию).
    try {
      var _target = GUEST.path || '/listok/create-page';
      var _p = location.pathname || '';
      var _onTarget = _target === '/listok'
        ? (_p.replace(/\\/+$/, '') === '/listok')
        : (_p.indexOf('create-page') !== -1);
      if (sessionStorage.getItem('hostellaTarget') !== _target) {
        sessionStorage.removeItem('hostellaArrivedTarget');
        sessionStorage.setItem('hostellaTarget', _target);
      }
      if (_onTarget) sessionStorage.setItem('hostellaArrivedTarget', '1');
      if (_p.indexOf('login') === -1 && !_onTarget && !sessionStorage.getItem('hostellaArrivedTarget')) {
        location.href = 'https://emehmon.uz' + _target;
        return;
      }
    } catch(e){}

    function byId(id){ return document.getElementById(id); }
    function isVisible(el){ return !!(el && el.offsetParent !== null); }
    function fire(el){ el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }

    function fillEl(el, val, onlyIfEmpty){
      if (!el || val == null || val === '') return false;
      if (onlyIfEmpty && el.value && el.value.length) return false;
      try { if ($) { $(el).val(val).trigger('input').trigger('change'); } } catch(e){}
      el.value = val; fire(el);
      return true;
    }
    function fillInput(id, val){ return fillEl(byId(id), val); }
    function fillSelectValue(id, val){
      var el = byId(id);
      if (!el || val == null || val === '') return false;
      el.value = String(val);
      try { if ($) { $(el).val(String(val)).trigger('change'); return true; } } catch(e){}
      el.dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    }
    function fillSelectByCode(id, code){
      var el = byId(id);
      if (!el || !code) return false;
      var opt = Array.prototype.filter.call(el.options, function(o){ return o.text.indexOf('('+code+')') !== -1; })[0];
      if (!opt) return false;
      return fillSelectValue(id, opt.value);
    }

    function toast(msg, ok){
      var t = document.createElement('div');
      t.textContent = msg;
      t.style.cssText = 'position:fixed;z-index:1000000;left:50%;transform:translateX(-50%);bottom:74px;max-width:320px;text-align:center;'
        + 'background:'+(ok===false?'#e11d48':'#0f9688')+';color:#fff;padding:10px 14px;border-radius:10px;'
        + 'font:600 13px sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);';
      document.body.appendChild(t);
      setTimeout(function(){ t.remove(); }, 3500);
    }

    // ── Авто-вход (только email+пароль; капчу и кнопку входа жмёт человек) ──
    function fillLogin(){
      if (!GUEST.login && !GUEST.password) return 0;
      // если это мастер листка — не трогаем
      if (byId('passportNumber') || byId('wdays')) return 0;
      var pw = document.querySelector('input[type="password"]');
      if (!pw) return 0;
      var email = document.querySelector('input[type="email"]')
        || document.querySelector('input[name="email"]')
        || document.querySelector('input[name="login"]')
        || document.querySelector('input[name="username"]');
      if (!email) {
        var texts = Array.prototype.filter.call(
          document.querySelectorAll('input[type="text"], input:not([type])'), isVisible);
        email = texts[0];
      }
      var n = 0;
      if (email && fillEl(email, GUEST.login, true)) n++;
      if (fillEl(pw, GUEST.password, true)) n++;
      if (n) toast('Логин подставлен — введите капчу и войдите.');
      return n;
    }

    // ── Мастер листка прибытия ──
    function fillStep1(){
      var n=0;
      if (fillSelectByCode('id_citizen', GUEST.citizenCode)) n++;
      if (fillSelectValue('id_passporttype', GUEST.docType || '1')) n++;
      if (fillInput('datebirth', GUEST.birthDate)) n++;
      if (fillInput('passportNumber', GUEST.passport)) n++;
      return n;
    }
    function fillStep2(){
      // Местные граждане (Узбекистан) — на шаге 2 ничего не заполняем
      if ((GUEST.citizenCode || '') === 'UZB') return 0;
      var n=0;
      if (fillInput('datePassport', GUEST.passportIssueDate)) n++;
      // Страна рождения = страна гостя (как гражданство / страна прибытия)
      if (fillSelectByCode('id_country', GUEST.citizenCode)) n++;
      if (GUEST.passportIssuedBy && fillInput('passportissuedby', GUEST.passportIssuedBy)) n++;
      return n;
    }
    function fillRoom(room){
      var el = byId('propiska');
      if (!el || room == null || room === '') return false;
      var rStr = String(room).trim();
      var rInt = parseInt(rStr, 10);
      var opt = Array.prototype.filter.call(el.options, function(o){
        if (!o.value) return false;
        var t = (o.text || '').replace(/\\s+/g, ' ').trim();
        if (String(o.value) === rStr) return true;
        if (!isNaN(rInt) && parseInt(t, 10) === rInt) return true;
        return t.indexOf(rStr + ' ') === 0 || t.indexOf(rStr + '-') === 0;
      })[0];
      if (!opt) return false;
      return fillSelectValue('propiska', opt.value);
    }
    // Список комнат в e-mehmon подгружается с задержкой — повторяем попытки
    function fillRoomRetry(room, attempts){
      if (fillRoom(room)) return;
      if (attempts > 0) { setTimeout(function(){ fillRoomRetry(room, attempts - 1); }, 800); return; }
      console.warn('[Hostella] комната не найдена в e-mehmon:', String(room), '— проверьте совпадение номеров комнат');
    }
    function fillStep3(){
      var n=0;
      if (fillInput('wdays', GUEST.days)) n++;
      if (GUEST.room) { fillRoomRetry(GUEST.room, 6); n++; }  // Номер/Комната (с повтором — список грузится с задержкой)
      if (fillSelectValue('id_visittype', '5')) n++;  // Тип визита — Другое
      if (fillSelectValue('payed', '2')) n++;         // Статус оплаты — Оплачен полностью
      if (fillInput('amount', '1')) n++;              // Сумма оплаты — всегда 1
      if (fillSelectValue('id_guest', '4')) n++;      // Тип гостя — Другое
      return n;
    }
    function currentStep(){
      if (isVisible(byId('passportNumber')) || isVisible(byId('initialForm'))) return 1;
      if (isVisible(byId('datePassport')) || isVisible(byId('sex'))) return 2;
      if (isVisible(byId('wdays')) || isVisible(byId('additionalInfo'))) return 3;
      return 0;
    }
    function doFill(){
      var s = currentStep(), n = 0;
      if (s===1) n=fillStep1();
      else if (s===2) n=fillStep2();
      else if (s===3) n=fillStep3();
      if (s) toast('Шаг '+s+': заполнено полей — '+n+'. Проверьте и нажмите «Далее».');
      else toast('Откройте создание листка прибытия — мастер не найден.', false);
    }

    // ── Режим убытия: найти и выделить гостя в списке /listok ──
    function findAndSelectGuest(){
      if (!$ || !$.fn || !$.fn.DataTable) return false;
      var table;
      try { table = $('#listok-table').DataTable(); } catch(e){ return false; }
      var norm = function(s){ return (s || '').replace(/\\s/g, '').toUpperCase(); };
      var gp = norm(GUEST.passport), gn = norm(GUEST.guestName);
      var node = null;
      table.rows().every(function(){
        var d = this.data() || {};
        var rp = norm(d.passport_numb || d.passport_full || d.passport);
        var rn = norm(d.guest || d.guestname);
        if ((gp && rp && rp === gp) || (gn && rn && rn === gn)) {
          this.select(); $(this.node()).addClass('selected'); node = this.node();
        }
      });
      if (node) { try { node.scrollIntoView({ block: 'center' }); } catch(e){} return true; }
      return false;
    }
    function findGuestRetry(attempts){
      if (findAndSelectGuest()) { toast('Гость выбран. Нажмите «Выселить» или «Печать».'); return; }
      if (attempts > 0) { setTimeout(function(){ findGuestRetry(attempts - 1); }, 800); return; }
      toast('Гость не найден на странице — выберите строку вручную.', false);
    }
    function setupDeparture(){
      if (byId('__hostella_dep_panel')) { findGuestRetry(6); return; }
      var wrap = document.createElement('div');
      wrap.id = '__hostella_dep_panel';
      wrap.style.cssText = 'position:fixed;z-index:1000000;left:50%;transform:translateX(-50%);bottom:18px;display:flex;gap:8px;';
      function mk(txt, bg){
        var b = document.createElement('button'); b.type = 'button'; b.textContent = txt;
        b.style.cssText = 'background:' + bg + ';color:#fff;border:none;border-radius:10px;padding:12px 16px;font:700 14px sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);';
        return b;
      }
      var bOut = mk('✈️ Выселить', '#e11d48');
      bOut.addEventListener('click', function(){ if (!findAndSelectGuest()) { toast('Гость не выбран — выберите строку.', false); return; } try { $('#checkout').trigger('click'); } catch(e){} });
      var bPrint = mk('🖨 Печать / PDF', '#0f9688');
      bPrint.addEventListener('click', function(){ if (!findAndSelectGuest()) { toast('Гость не выбран — выберите строку.', false); return; } try { $('#custom-print-btn').trigger('click'); } catch(e){} });
      wrap.appendChild(bOut); wrap.appendChild(bPrint);
      document.body.appendChild(wrap);
      findGuestRetry(6);
    }

    if (GUEST.mode === 'departure') {
      setupDeparture();
    } else if (!byId('__hostella_fill_btn')) {
      // Плавающая кнопка для шагов мастера прибытия (idempotent)
      var btn = document.createElement('button');
      btn.id = '__hostella_fill_btn';
      btn.type = 'button';
      btn.textContent = '🏨 Заполнить из Hostella';
      btn.style.cssText = 'position:fixed;z-index:1000000;left:50%;transform:translateX(-50%);bottom:18px;background:#0f9688;color:#fff;'
        + 'border:none;border-radius:10px;padding:12px 16px;font:700 14px sans-serif;cursor:pointer;'
        + 'box-shadow:0 6px 20px rgba(0,0,0,.25);';
      btn.addEventListener('click', doFill);
      document.body.appendChild(btn);
    }

    // Прибытие: авто-закрытие окна после успешного сохранения листка.
    // e-mehmon показывает swal2-success «Muvaffaqiyatli saqlandi» — ловим его и
    // закрываем окно (сигналим main через document.title + пробуем window.close()).
    if (GUEST.mode !== 'departure' && !window.__hostellaRegWatch) {
      window.__hostellaRegWatch = true;
      var _regWatch = setInterval(function(){
        var okIcon = document.querySelector('.swal2-popup .swal2-icon.swal2-success, .swal2-success.swal2-icon-show');
        var ttlEl = document.querySelector('.swal2-popup .swal2-title, .swal2-title');
        var saved = ttlEl && /saqland|сохран|success|muvaffaqiyat/i.test(ttlEl.textContent || '');
        if (okIcon && saved) {
          clearInterval(_regWatch);
          toast('Регистрация сохранена — закрываю окно…');
          // Сразу сигналим main (он закроет окно и поставит галочку), затем пробуем сами.
          try { document.title = '__HOSTELLA_REG_DONE__'; } catch(e){}
          setTimeout(function(){ try { window.close(); } catch(e){} }, 400);
        }
      }, 350);
    }

    // Авто-вход при загрузке (форма может появиться с задержкой)
    fillLogin();
    setTimeout(fillLogin, 900);

    window.__hostellaGuest = GUEST;
  } catch(e){ console.error('[Hostella autofill]', e); }
})();`;
}

// ── Фоновый автомат убытия ──────────────────────────────────────────────────
// Инжектится на /listok и САМ доводит выселение до конца: находит гостя в списке,
// открывает модалку «Chiqish», выставляет TO‘LOV / тип оплаты / галочку печати и
// жмёт «Check-Out». Возвращает Promise со статусом — его дожидается main-процесс.
//   done       — модалка закрылась, выселение прошло
//   submitted  — кнопку нажали, но закрытие модалки не подтвердилось
//   need_login — портал на странице входа (нужны капча/логин)
//   not_found  — гость не найден в списке
//   multiple   — найдено несколько совпадений (авто-выселение небезопасно)
//   no_table / no_modal / no_button / no_checkout_btn / error — сбой автоматизации
function buildDepartureAutoScript(guest) {
  const G = JSON.stringify(guest || {});
  return `(async function(){
  var GUEST = ${G};
  var $ = window.jQuery || window.$;
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  function norm(s){ return (s||'').replace(/\\s/g,'').toUpperCase(); }
  function fire(el){ el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }

  try {
    // 0) страница входа → нужен человек (капча/логин)
    if ((location.pathname||'').indexOf('login') !== -1 || document.querySelector('input[type="password"]')) {
      return { status: 'need_login' };
    }

    // 1) дождаться DataTable списка листков
    function getTable(){ try { return ($ && $.fn && $.fn.DataTable) ? $('#listok-table').DataTable() : null; } catch(e){ return null; } }
    var table = null;
    for (var i=0;i<20 && !table;i++){ table = getTable(); if(!table){ await sleep(400); } }
    if (!table) return { status: 'no_table' };

    // 2) найти и выделить гостя (по паспорту / ФИО)
    function selectGuest(){
      var gp = norm(GUEST.passport), gn = norm(GUEST.guestName), node=null, hits=0;
      table.rows().every(function(){
        var d = this.data() || {};
        var rp = norm(d.passport_numb || d.passport_full || d.passport);
        var rn = norm(d.guest || d.guestname);
        if ((gp && rp && rp===gp) || (gn && rn && rn===gn)) { this.select(); $(this.node()).addClass('selected'); node=this.node(); hits++; }
      });
      return { node: node, hits: hits };
    }
    var sel = null;
    for (var j=0;j<8;j++){ sel = selectGuest(); if (sel.node) break; await sleep(500); }
    if (!sel || !sel.node) return { status: 'not_found' };
    if (sel.hits > 1) return { status: 'multiple' }; // несколько совпадений — не рискуем
    try { sel.node.scrollIntoView({ block: 'center' }); } catch(e){}

    // 3) открыть модалку выселения
    try { $('#checkout').trigger('click'); } catch(e){ return { status: 'no_checkout_btn' }; }

    // 4) дождаться загрузки модалки (контент подгружается AJAX)
    function modalReady(){ return document.querySelector('.confirm input.payment-input') || document.querySelector('input.payment-input'); }
    var ready = false;
    for (var k=0;k<25;k++){ if (modalReady()){ ready = true; break; } await sleep(300); }
    if (!ready) return { status: 'no_modal' };
    await sleep(200);

    // 5) TO‘LOV (сумма) и тип оплаты
    var amount = (GUEST.amount != null && GUEST.amount !== '') ? String(GUEST.amount) : null;
    if (amount) {
      Array.prototype.forEach.call(document.querySelectorAll('input.payment-input'), function(el){
        el.value = amount; try { if ($) $(el).val(amount); } catch(e){} fire(el);
      });
    }
    var payType = (GUEST.payType != null && GUEST.payType !== '') ? String(GUEST.payType) : '1'; // 1 = Boshqa
    Array.prototype.forEach.call(document.querySelectorAll('select.paytp'), function(el){
      el.value = payType; try { if ($) $(el).val(payType).trigger('change'); } catch(e){} fire(el);
    });

    // 6) галочка печати листа убытия (по умолчанию e-mehmon ставит её — снимаем если печать не нужна)
    var pc = document.getElementById('printAll');
    if (pc) { pc.checked = !!GUEST.print; fire(pc); }

    // 7) нажать «Check-Out»
    var btns = Array.prototype.slice.call(document.querySelectorAll('.app-modal-footer .btn-success, .modal-footer .btn-success, .modal-content .btn-success'));
    var btn = btns.filter(function(b){ return /check\\s*-?\\s*out/i.test(b.textContent||''); })[0] || btns[0];
    if (!btn) return { status: 'no_button' };
    btn.click();

    // 8) закрытие модалки = успех
    function modalGone(){ return !document.querySelector('.confirm input.payment-input') && !document.querySelector('.modal.show input.payment-input'); }
    for (var m=0;m<30;m++){ if (modalGone()){ return { status: 'done' }; } await sleep(400); }
    return { status: 'submitted' };
  } catch(e){
    return { status: 'error', message: (e && e.message) || String(e) };
  }
})();`;
}

// ── Проверка: есть ли гость в активном списке /listok ────────────────────────
// /listok содержит ТОЛЬКО активных (после Check-Out гость уходит в /listokout).
// Поэтому: нашёлся → ещё не выселен (present); не нашёлся → уже выселен (absent).
//   present / absent / need_login / no_table / error
function buildDepartureCheckScript(guest) {
  const G = JSON.stringify(guest || {});
  return `(async function(){
  var GUEST = ${G};
  var $ = window.jQuery || window.$;
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  function norm(s){ return (s||'').replace(/\\s/g,'').toUpperCase(); }
  try {
    if ((location.pathname||'').indexOf('login') !== -1 || document.querySelector('input[type="password"]')) {
      return { status: 'need_login' };
    }
    function getTable(){ try { return ($ && $.fn && $.fn.DataTable) ? $('#listok-table').DataTable() : null; } catch(e){ return null; } }
    var table = null;
    for (var i=0;i<20 && !table;i++){ table = getTable(); if(!table){ await sleep(400); } }
    if (!table) return { status: 'no_table' };
    var gp = norm(GUEST.passport), gn = norm(GUEST.guestName), found = false;
    table.rows().every(function(){
      var d = this.data() || {};
      var rp = norm(d.passport_numb || d.passport_full || d.passport);
      var rn = norm(d.guest || d.guestname);
      if ((gp && rp && rp===gp) || (gn && rn && rn===gn)) { found = true; }
    });
    return { status: found ? 'present' : 'absent' };
  } catch(e){ return { status:'error', message:(e&&e.message)||String(e) }; }
})();`;
}

// ── Получить весь активный список /listok (для фоновой синхронизации статусов) ─
// Возвращает { status:'ok', rows:[{passport,name}] } по всем строкам текущего
// аккаунта. /listok — только активные (зарегистрированные сейчас иностранцы).
function buildListFetchScript() {
  return `(async function(){
  var $ = window.jQuery || window.$;
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  function norm(s){ return (s||'').replace(/\\s/g,'').toUpperCase(); }
  try {
    if ((location.pathname||'').indexOf('login') !== -1 || document.querySelector('input[type="password"]')) {
      return { status: 'need_login' };
    }
    function getTable(){ try { return ($ && $.fn && $.fn.DataTable) ? $('#listok-table').DataTable() : null; } catch(e){ return null; } }
    var table = null;
    for (var i=0;i<20 && !table;i++){ table = getTable(); if(!table){ await sleep(400); } }
    if (!table) return { status: 'no_table' };
    try { table.page.len(-1).draw(false); } catch(e){} // показать все строки (клиентская пагинация)
    await sleep(300);
    function dec(s){ return String(s||'').replace(/&#039;|&#39;/g, "'").replace(/&amp;/g, '&'); }
    var rows = [];
    table.rows().every(function(){
      var d = this.data() || {};
      rows.push({
        passport: norm(d.passport_numb || d.passport_full || d.passport),
        name: norm(d.guest || d.guestname),
        displayName: dec(d.guest || d.guestname || ''),
        room: d.room || '',
        days: d.wdays || '',
        country: dec(d.ctzn || ''),
        checkIn: d.check_in || d.dt || '',
        regNumb: d.reg_numb || ''
      });
    });
    return { status: 'ok', rows: rows };
  } catch(e){ return { status:'error', message:(e&&e.message)||String(e) }; }
})();`;
}

// ── Массовое выселение: выделить все совпавшие строки и выселить разом ─────────
// e-mehmon поддерживает множественный Check-Out (модалка Chiqish с несколькими
// строками). Принимает { list:[{passport,name}], amount, payType, print }.
//   done / submitted / not_found / no_modal / no_button / need_login / error
function buildDepartureBulkScript(payload) {
  const P = JSON.stringify(payload || {});
  return `(async function(){
  var DATA = ${P};
  var LIST = DATA.list || [];
  var $ = window.jQuery || window.$;
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  function norm(s){ return (s||'').replace(/\\s/g,'').toUpperCase(); }
  function fire(el){ el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }
  try {
    if ((location.pathname||'').indexOf('login') !== -1 || document.querySelector('input[type="password"]')) {
      return { status: 'need_login' };
    }
    function getTable(){ try { return ($ && $.fn && $.fn.DataTable) ? $('#listok-table').DataTable() : null; } catch(e){ return null; } }
    var table = null;
    for (var i=0;i<20 && !table;i++){ table = getTable(); if(!table){ await sleep(400); } }
    if (!table) return { status: 'no_table' };
    try { table.page.len(-1).draw(false); } catch(e){}
    await sleep(300);
    var targets = LIST.map(function(g){ return { p: norm(g.passport), n: norm(g.name) }; });
    var selected = 0;
    table.rows().every(function(){
      var d = this.data() || {};
      var rp = norm(d.passport_numb || d.passport_full || d.passport);
      var rn = norm(d.guest || d.guestname);
      var hit = targets.some(function(t){ return (t.p && rp && t.p===rp) || (t.n && rn && t.n===rn); });
      if (hit) {
        try { this.select(); } catch(e){}
        $(this.node()).addClass('selected');
        var cb = this.node().querySelector('input.row-select');
        if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change',{bubbles:true})); }
        selected++;
      }
    });
    if (!selected) return { status: 'not_found', selected: 0, requested: LIST.length };
    try { $('#checkout').trigger('click'); } catch(e){ return { status: 'no_checkout_btn', selected: selected }; }
    function modalReady(){ return document.querySelector('.confirm input.payment-input') || document.querySelector('input.payment-input'); }
    var ready = false;
    for (var k=0;k<25;k++){ if (modalReady()){ ready = true; break; } await sleep(300); }
    if (!ready) return { status: 'no_modal', selected: selected };
    await sleep(200);
    var amount = (DATA.amount != null && DATA.amount !== '') ? String(DATA.amount) : '1';
    Array.prototype.forEach.call(document.querySelectorAll('input.payment-input'), function(el){ el.value = amount; try { if ($) $(el).val(amount); } catch(e){} fire(el); });
    var payType = (DATA.payType != null && DATA.payType !== '') ? String(DATA.payType) : '1';
    Array.prototype.forEach.call(document.querySelectorAll('select.paytp'), function(el){ el.value = payType; try { if ($) $(el).val(payType).trigger('change'); } catch(e){} fire(el); });
    var pc = document.getElementById('printAll');
    if (pc) { pc.checked = !!DATA.print; fire(pc); }
    var btns = Array.prototype.slice.call(document.querySelectorAll('.app-modal-footer .btn-success, .modal-footer .btn-success, .modal-content .btn-success'));
    var btn = btns.filter(function(b){ return /check\\s*-?\\s*out/i.test(b.textContent||''); })[0] || btns[0];
    if (!btn) return { status: 'no_button', selected: selected };
    btn.click();
    function modalGone(){ return !document.querySelector('.confirm input.payment-input') && !document.querySelector('.modal.show input.payment-input'); }
    for (var m=0;m<40;m++){ if (modalGone()){ return { status: 'done', selected: selected, requested: LIST.length }; } await sleep(400); }
    return { status: 'submitted', selected: selected, requested: LIST.length };
  } catch(e){ return { status: 'error', message: (e && e.message) || String(e) }; }
})();`;
}

module.exports = { buildAutofillScript, buildDepartureAutoScript, buildDepartureCheckScript, buildListFetchScript, buildDepartureBulkScript };
