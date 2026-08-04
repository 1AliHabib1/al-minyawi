/* ============================================================
   المنياوي | مطبخ الأوردرات
   لوحة كانبان: جديد → قيد التجهيز → اتسلم
   + تنبيه صوتي وإشعار متصفح عند وصول طلب جديد (كل 15 ثانية)
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const store = getAdminStore();
  const loginScreen = document.getElementById('loginScreen');
  const panel = document.getElementById('panel');
  const loginForm = document.getElementById('loginForm');
  const loginPass = document.getElementById('loginPass');
  const loginError = document.getElementById('loginError');

  const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (d) => {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d || '—');
    return dt.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' }) + ' ' + dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  };
  const isToday = (d) => {
    const dt = new Date(d);
    return !isNaN(dt.getTime()) && dt.toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA');
  };

  let doneOrders = [];
  let preparingOrders = [];
  let lastOrders = [];
  let orderSearch = '';
  const expandedRefs = new Set();
  let freshRefs = new Set();
  let knownRefs = new Set();
  let glowT;

  const orderStatus = (ref) => doneOrders.includes(ref) ? 'done' : preparingOrders.includes(ref) ? 'preparing' : 'new';
  const waNum = (p) => {
    const d = String(fixPhone(p)).replace(/[^0-9]/g, '');
    if (!d) return '';
    if (d.startsWith('0')) return '20' + d.slice(1);
    return d.startsWith('2') ? d : '2' + d;
  };

  const cloudInit = (async () => {
    try {
      const cloud = await cloudLoad();
      if (cloud && typeof cloud.passHash === 'string' && cloud.passHash && cloud.passHash !== store.passHash) {
        store.passHash = cloud.passHash;
      }
    } catch { }
  })();

  if (sessionStorage.getItem('minyawi_admin_auth') === '1') {
    loginScreen.style.display = 'none';
    panel.hidden = false;
    loadOrders();
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await cloudInit;
    let fails = parseInt(localStorage.getItem('minyawi_login_fails') || '0', 10);
    const lockUntil = parseInt(localStorage.getItem('minyawi_login_lock') || '0', 10);
    if (Date.now() < lockUntil) {
      loginError.hidden = false;
      loginError.textContent = 'محاولات كتير فاشلة — استنى دقيقتين وجرب تاني';
      return;
    }
    const expected = store.passHash || await sha256Hex(DEFAULT_PASSWORD);
    const hash = await sha256Hex(loginPass.value);
    if (hash === expected) {
      localStorage.removeItem('minyawi_login_fails');
      localStorage.removeItem('minyawi_login_lock');
      sessionStorage.setItem('minyawi_admin_auth', '1');
      loginError.hidden = true;
      loginPass.value = '';
      loginScreen.style.display = 'none';
      panel.hidden = false;
      loadOrders();
    } else {
      fails++;
      if (fails >= 5) {
        localStorage.setItem('minyawi_login_lock', String(Date.now() + 120000));
        localStorage.setItem('minyawi_login_fails', '0');
        loginError.textContent = 'محاولات كتير فاشلة — استنى دقيقتين وجرب تاني';
      } else {
        localStorage.setItem('minyawi_login_fails', String(fails));
        loginError.textContent = `كلمة المرور غلط! (بقي فاضل ${5 - fails} محاولات)`;
      }
      loginError.hidden = false;
      loginPass.value = '';
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('minyawi_admin_auth');
    location.reload();
  });

  function renderStatus(text, warn) {
    const el = document.getElementById('ordersStatus');
    if (!el) return;
    el.hidden = !text;
    el.textContent = text;
    el.style.color = warn ? '#b45309' : '#64748b';
  }

  function renderOrders(orders) {
    lastOrders = orders;
    const cols = { new: [], preparing: [], done: [] };
    orders.forEach(o => cols[orderStatus(o.ref)].push(o));
    const summary = document.getElementById('ordersSummary');
    if (!summary) return;
    const today = orders.filter(o => isToday(o.date));
    const todayTotal = today.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
    const pending = orders.filter(o => orderStatus(o.ref) !== 'done').length;
    document.getElementById('osCount').textContent = today.length;
    document.getElementById('osTotal').textContent = `${todayTotal} ج.م`;
    document.getElementById('osPending').textContent = pending;
    summary.hidden = !orders.length;
    const q = orderSearch.toLowerCase();
    const match = (o) => !q || `${o.name || ''} ${o.phone || ''} ${o.ref || ''}`.toLowerCase().includes(q);

    [['new', 'فاضي 🍃'], ['preparing', 'فاضي 🍃'], ['done', 'فاضي 🍃']].forEach(([id, emptyText]) => {
      const list = cols[id].filter(match);
      document.getElementById('colCount-' + id).textContent = cols[id].length;
      document.getElementById('col-' + id).innerHTML = list.length
        ? list.map(o => cardHtml(o)).join('')
        : `<div class="kanban-empty">${cols[id].length ? 'ولا طلب مطابق 🍃' : emptyText}</div>`;
    });
  }

  function cardHtml(o) {
    const st = orderStatus(o.ref);
    const done = st === 'done';
    const open = expandedRefs.has(o.ref);
    const glow = freshRefs.has(o.ref);
    const actions = st === 'new'
      ? `<button type="button" class="chip-act prep" data-act="preparing" data-ref="${escHtml(o.ref)}"><i class="fa-solid fa-utensils"></i> قيد التجهيز</button><button type="button" class="chip-act done" data-act="done" data-ref="${escHtml(o.ref)}"><i class="fa-solid fa-circle-check"></i> اتسلم</button>`
      : st === 'preparing'
        ? `<button type="button" class="chip-act back" data-act="new" data-ref="${escHtml(o.ref)}"><i class="fa-solid fa-rotate-left"></i> رجع جديد</button><button type="button" class="chip-act done" data-act="done" data-ref="${escHtml(o.ref)}"><i class="fa-solid fa-circle-check"></i> تم التسليم</button>`
        : `<button type="button" class="chip-act back" data-act="new" data-ref="${escHtml(o.ref)}"><i class="fa-solid fa-rotate-left"></i> رجع جديد</button>`;
    const stChip = done ? '<span class="chip chip-done">اتسلم</span>'
      : st === 'preparing' ? '<span class="chip chip-prep">قيد التجهيز</span>'
      : '<span class="chip chip-new">جديد</span>';
    return `
      <div class="order-item order-expand accent-${st}${done ? ' done' : ''}${glow ? ' is-new' : ''}" data-ref="${escHtml(o.ref)}">
        <div class="order-item-top">
          <b>${escHtml(o.ref || '—')} ${stChip}<span class="expand-arrow"><i class="fa-solid fa-chevron-down"></i></span></b>
          <span>${fmtDate(o.date)}</span>
        </div>
        <div class="order-item-line"><i class="fa-solid fa-user"></i> ${escHtml(o.name || '—')}${o.phone ? ' • <span dir="ltr">' + escHtml(fixPhone(o.phone)) + '</span>' : ''}</div>
        <div class="order-details"${open ? '' : ' hidden'}>
          ${o.lines ? `<div class="order-item-lines">${escHtml(o.lines).split('\n').map(l => `<div>${l}</div>`).join('')}</div>` : ''}
          ${o.address ? `<div class="order-item-line"><i class="fa-solid fa-location-dot"></i> ${escHtml(o.address)}</div>` : ''}
          ${o.notes ? `<div class="order-item-line"><i class="fa-solid fa-note-sticky"></i> ${escHtml(o.notes)}</div>` : ''}
          <div class="order-item-bottom">
            <span>التوصيل ${escHtml(o.delivery || '0')} ج.م</span>
            <b>الإجمالي ${escHtml(o.total || '0')} ج.م</b>
          </div>
          <div class="order-detail-actions">
            ${o.phone ? `<a href="https://wa.me/${escHtml(waNum(o.phone))}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm wa-link"><i class="fa-brands fa-whatsapp"></i> كلم العميل</a>` : ''}
            <div class="act-row">${actions}</div>
          </div>
        </div>
      </div>`;
  }

  /* ============ الجلب من Firebase (الأساسي) + الشيت (احتياطي) ============ */
  async function fetchFresh() {
    const s = getAdminStore();
    const url = (s.sheetUrl || '').trim();
    const key = (s.orderKey || '').trim() || DEFAULT_ORDER_KEY;
    const [cloudOrders, doneRes, prepRes] = await Promise.all([
      fetchOrdersCloud(100).catch(() => null),
      loadDoneOrders().catch(() => []),
      loadPreparingOrders().catch(() => []),
    ]);
    doneOrders = doneRes;
    preparingOrders = prepRes;
    let orders;
    if (cloudOrders && cloudOrders.length) {
      orders = cloudOrders;
    } else if (url) {
      orders = await fetchOrders(url, key, 25000).catch(() => []);
      if (orders.length && cloudOrders === null) {
        showToast('مفيش أوردرات في Firebase — متصل على الشيت');
      }
    } else {
      orders = cloudOrders || [];
    }
    saveOrdersCache(orders);
    return orders;
  }

  function markGlow(fresh) {
    freshRefs = new Set(fresh);
    clearTimeout(glowT);
    glowT = setTimeout(() => { freshRefs.clear(); if (lastOrders.length) renderOrders(lastOrders); }, 25000);
  }

  function beep() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const t = ctx.currentTime;
      [[880, 0], [1318.5, 0.18]].forEach(([f, off]) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, t + off);
        g.gain.exponentialRampToValueAtTime(0.28, t + off + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.4);
        o.start(t + off); o.stop(t + off + 0.45);
      });
    } catch { }
  }

  function alertNew(fresh, orders) {
    beep();
    if (navigator.vibrate) { try { navigator.vibrate(300); } catch { } }
    fresh.forEach(ref => {
      const o = orders.find(x => x.ref === ref);
      const body = o ? `${o.name || ''} • ${o.total || ''} ج.م` : '';
      try {
        if (window.Notification && Notification.permission === 'granted') {
          new Notification(`طلب جديد ${ref} 🧾`, { body });
        }
      } catch { }
    });
    showToast('🔔 طلب جديد واصل — روح للمطبخ!');
  }

  function detectNew(orders) {
    const refs = new Set(orders.map(o => (o.ref || '').trim()).filter(Boolean));
    if (knownRefs.size) {
      const fresh = [...refs].filter(r => !knownRefs.has(r));
      if (fresh.length) {
        markGlow(fresh);
        alertNew(fresh, orders);
      }
    }
    knownRefs = refs;
  }
  /* ============ التحميل + الأحداث ============ */
  async function loadOrders(manual) {
    renderStatus(manual ? 'بيتحمل الأوردرات...' : '', false);
    const statusEl = document.getElementById('ordersStatus');
    const btn = document.getElementById('ordersRefreshBtn');
    if (btn) btn.disabled = true;
    try {
      const orders = await fetchFresh();
      if (!orders) {
        renderStatus('مفيش رابط شيت — افتح الإعدادات وحط رابط Google Sheets', true);
        return;
      }
      const cached = getOrdersCache();
      const use = (cached && cached.length >= orders.length) ? cached : orders;
      detectNew(orders);
      renderOrders(use);
      renderStatus(`${use.length} أوردر ${isToday(use[0]?.date) ? '• ' + fmtDate(use[0].date) : ''}`, false);
      if (use.length && use[0].date && !isToday(use[0].date)) {
        renderStatus('الأحدث مش النهاردة — شغال في بيانات قديمة؟', true);
      }
    } catch (err) {
      console.error(err);
      renderStatus('حصل غلط في الجلب — جرب تاني', true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function setStatus(ref, to) {
    const from = orderStatus(ref);
    if (to === 'done') {
      doneOrders = doneOrders.filter(x => x !== ref);
      if (!doneOrders.includes(ref)) doneOrders.push(ref);
      preparingOrders = preparingOrders.filter(x => x !== ref);
    } else if (to === 'preparing') {
      preparingOrders = preparingOrders.filter(x => x !== ref);
      if (!preparingOrders.includes(ref)) preparingOrders.push(ref);
      doneOrders = doneOrders.filter(x => x !== ref);
    } else {
      preparingOrders = preparingOrders.filter(x => x !== ref);
      doneOrders = doneOrders.filter(x => x !== ref);
    }
    if (lastOrders.length) renderOrders(lastOrders);
    try {
      await Promise.all([saveDoneOrders(doneOrders), savePreparingOrders(preparingOrders)]);
      renderStatus(`${ref} — ${to === 'done' ? 'اتسلم ✔' : to === 'preparing' ? 'بقى قيد التجهيز 👨‍🍳' : 'رجع جديد 🔄'}`, false);
    } catch (err) {
      console.error(err);
      renderStatus('الحركة اتسجلت محليًا، لكن الحفظ في السحابة فشل — جرب تاني', true);
      try { await Promise.all([saveDoneOrders(doneOrders), savePreparingOrders(preparingOrders)]); } catch { }
    }
  }

  document.getElementById('panel').addEventListener('click', async (e) => {
    const item = e.target.closest('.order-item');
    if (item) {
      const ref = item.dataset.ref;
      const btn = e.target.closest('.chip-act');
      if (btn) {
        e.stopPropagation();
        btn.disabled = true;
        await setStatus(ref, btn.dataset.act);
        btn.disabled = false;
        return;
      }
      if (!e.target.closest('.order-detail-actions')) {
        const details = item.querySelector('.order-details');
        const arrow = item.querySelector('.expand-arrow');
        const wasOpen = !details.hidden;
        if (wasOpen) { expandedRefs.delete(ref); } else { expandedRefs.add(ref); }
        details.hidden = wasOpen;
        arrow.classList.toggle('up', !wasOpen);
      }
    }
  });

  const searchInput = document.getElementById('ordersSearch');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      orderSearch = searchInput.value.trim();
      if (lastOrders.length) renderOrders(lastOrders);
    });
  }

  /* ============ التنبيهات (صوت + إشعار متصفح) ============ */
  const notifBtn = document.getElementById('notifBtn');
  const notifLabel = document.getElementById('notifLabel');
  function refreshNotifBtn() {
    if (!notifBtn) return;
    const granted = !!(window.Notification && Notification.permission === 'granted');
    notifBtn.classList.toggle('is-on', granted);
    notifBtn.innerHTML = granted
      ? '<i class="fa-solid fa-bell"></i><span class="notif-dot"></span>'
      : '<i class="fa-regular fa-bell"></i>';
    if (notifLabel) notifLabel.textContent = granted ? 'التنبيهات مفعّلة' : 'شغّل التنبيهات';
    notifBtn.disabled = !!(window.Notification && Notification.permission === 'denied');
    notifBtn.title = granted ? 'التنبيهات مفعّلة — صوت + إشعار عند وصول طلب' : 'فعل التنبيهات — صوت + إشعار عند وصول طلب';
  }
  if (notifBtn) {
    notifBtn.addEventListener('click', async () => {
      if (!window.Notification) { showToast('المتصفح ده مش بيدعم إشعارات'); return; }
      const p = await Notification.requestPermission();
      refreshNotifBtn();
      if (p === 'granted') {
        showToast('التنبيهات شغالة — هينبهك صوت + إشعار مع كل طلب جديد 🔔');
        new Notification('التنبيهات مفعّلة ✅', { body: 'هنيّناك صوت + إشعار عند وصول طلب جديد' });
      } else {
        showToast('السماح اترفض — ممكن يفعل من إعدادات الموقع');
      }
    });
    refreshNotifBtn();
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    const msgEl = t.querySelector('#toastMsg');
    t.hidden = false;
    if (msgEl) msgEl.textContent = msg; else t.textContent = msg;
    clearTimeout(t._tm);
    t._tm = setTimeout(() => { t.hidden = true; }, 4000);
  }

  /* ============ إعدادات الطلبات (الشيت + تيليجرام) ============ */
  function fillOrderSettings() {
    const s = getAdminStore();
    document.getElementById('osSheet').value = s.sheetUrl || '';
    document.getElementById('osOrderKey').value = s.orderKey || DEFAULT_ORDER_KEY;
    document.getElementById('osTgToken').value = s.telegramToken || '';
    document.getElementById('osTgChatId').value = s.telegramChatId || '';
  }

  document.getElementById('osSaveBtn').addEventListener('click', () => {
    const s = getAdminStore();
    const sheet = document.getElementById('osSheet').value.trim();
    if (sheet && !/^https:\/\//.test(sheet)) { showToast('رابط الشيت لازم يبدأ بـ https://'); return; }
    s.sheetUrl = sheet;
    s.orderKey = document.getElementById('osOrderKey').value.trim() || DEFAULT_ORDER_KEY;
    s.telegramToken = document.getElementById('osTgToken').value.trim();
    s.telegramChatId = document.getElementById('osTgChatId').value.trim();
    saveAdminStore(s);
    cloudSave(s);
    showToast('تم حفظ إعدادات الطلبات ✅');
  });

  document.getElementById('osMigrateBtn').addEventListener('click', async () => {
    const s = getAdminStore();
    const url = (s.sheetUrl || '').trim();
    if (!url) { showToast('حط رابط الشيت الأول'); return; }
    const btn = document.getElementById('osMigrateBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> بنقل...';
    const key = (s.orderKey || '').trim() || DEFAULT_ORDER_KEY;
    const res = await migrateSheetOrders(url, key, (done, total) => {
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> بنقل... ${done}/${total}`;
    });
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> نقل الأوردرات من الشيت لـ Firebase';
    if (res.error) {
      showToast('الترحيل فشل — تأكد من رابط الشيت والمفتاح');
    } else {
      showToast(`تم نقل ${res.ok} طلب لـ Firebase ✅${res.skip ? ` (${res.skip} كانوا موجودين)` : ''}`);
    }
    loadOrders(true);
  });

  document.getElementById('osSheetTestBtn').addEventListener('click', async () => {    const url = document.getElementById('osSheet').value.trim();
    if (!url) { showToast('حط رابط الشيت الأول'); return; }
    const btn = document.getElementById('osSheetTestBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...';
    const ok = await sendToSheet(url, { ref: 'TEST', name: 'رسالة تجربة', phone: '-', address: '-', notes: 'تجربة من صفحة الأوردرات', delivery: 0, total: 0, lines: '-' });
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-table"></i> تجربة الشيت';
    showToast(ok ? 'وصلت الشيت ✅ افتح الشيت وشوف آخر صف' : 'الإرسال فشل — تأكد من نشر الرابط: Anyone + Execute as Me');
  });

  document.getElementById('osTgTestBtn').addEventListener('click', async () => {
    const token = document.getElementById('osTgToken').value.trim();
    const chatId = document.getElementById('osTgChatId').value.trim();
    if (!token || !chatId) { showToast('اكتب التوكن ومعرف المحادثة الأول'); return; }
    const btn = document.getElementById('osTgTestBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...';
    const ok = await sendTelegramMessage({ token, chatId }, '✅ رسالة تجربة من صفحة الأوردرات — البوت شغال!');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> رسالة تجربة';
    showToast(ok ? 'اتبعتت الرسالة ✅ افتح تيليجرام وشوف' : 'الإرسال فشل — راجع التوكن ومعرف المحادثة');
  });

  fillOrderSettings();
  document.getElementById('ordersRefreshBtn').addEventListener('click', () => loadOrders(true));

  /* ============ التحديث التلقائي كل 15 ثانية ============ */
  setInterval(() => { if (!panel.hidden) loadOrders(false); }, 15000);
});
