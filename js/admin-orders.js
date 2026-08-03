/* ============================================================
   المنياوي | صفحة الأوردرات المستقلة
   قائمة الطلبات + تفاصيل + فلترة + بحث + تم التسليم
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
  let lastOrders = [];
  let orderFilter = 'all';
  let orderSearch = '';

  const orderDone = (ref) => doneOrders.includes(ref);

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

  function renderOrders(orders) {
    lastOrders = orders;
    const list = document.getElementById('ordersList');
    const summary = document.getElementById('ordersSummary');
    if (!orders.length) {
      summary.hidden = true;
      list.innerHTML = '<div class="orders-empty">مفيش أوردرات لسه 🍃 أول ما يجي طلب هيظهر هنا</div>';
      return;
    }
    const today = orders.filter(o => isToday(o.date));
    const todayTotal = today.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
    const pending = orders.filter(o => !orderDone(o.ref)).length;
    document.getElementById('osCount').textContent = today.length;
    document.getElementById('osTotal').textContent = `${todayTotal} ج.م`;
    document.getElementById('osPending').textContent = pending;
    summary.hidden = false;
    const filtered = orders.filter(o => {
      if (orderFilter === 'done' && !orderDone(o.ref)) return false;
      if (orderFilter === 'new' && orderDone(o.ref)) return false;
      if (orderSearch) {
        const hay = `${o.name || ''} ${o.phone || ''} ${o.ref || ''}`.toLowerCase();
        if (!hay.includes(orderSearch.toLowerCase())) return false;
      }
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      if (orderDone(a.ref) !== orderDone(b.ref)) return orderDone(a.ref) ? 1 : -1;
      return 0;
    });
    if (!sorted.length) {
      list.innerHTML = '<div class="orders-empty">مفيش نتايج 🍃</div>';
      return;
    }
    list.innerHTML = sorted.map(o => {
      const done = orderDone(o.ref);
      return `
        <div class="order-item order-expand${done ? ' done' : ''}" data-ref="${escHtml(o.ref)}">
          <div class="order-item-top">
            <b>${escHtml(o.ref || '—')} ${done ? '<span class="chip chip-done">تم التسليم</span>' : '<span class="chip chip-new">جديد</span>'}<span class="expand-arrow"><i class="fa-solid fa-chevron-down"></i></span></b>
            <span>${fmtDate(o.date)}</span>
          </div>
          <div class="order-item-line"><i class="fa-solid fa-user"></i> ${escHtml(o.name || '—')}${o.phone ? ' • <span dir="ltr">' + escHtml(o.phone) + '</span>' : ''}</div>
          <div class="order-details" hidden>
            ${o.lines ? `<div class="order-item-lines">${escHtml(o.lines).split('\n').map(l => `<div>${l}</div>`).join('')}</div>` : ''}
            ${o.address ? `<div class="order-item-line"><i class="fa-solid fa-location-dot"></i> ${escHtml(o.address)}</div>` : ''}
            ${o.notes ? `<div class="order-item-line"><i class="fa-solid fa-note-sticky"></i> ${escHtml(o.notes)}</div>` : ''}
            <div class="order-item-bottom">
              <span>التوصيل ${escHtml(o.delivery || '0')} ج.م</span>
              <b>الإجمالي ${escHtml(o.total || '0')} ج.م</b>
            </div>
            <div class="order-detail-actions">
              ${o.phone ? `<a href="https://wa.me/2${String(o.phone).replace(/[^0-9]/g, '')}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm"><i class="fa-brands fa-whatsapp"></i> كلم العميل</a>` : ''}
              <button type="button" class="done-btn" data-ref="${escHtml(o.ref)}">${done ? 'إلغاء تم' : 'تم التسليم ✔'}</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function renderStatus(text, warn) {
    const el = document.getElementById('ordersStatus');
    if (!el) return;
    el.hidden = !text;
    el.textContent = text;
    el.style.color = warn ? '#b45309' : '#64748b';
  }

  let slowHinted = false;

  async function loadOrders(silent) {
    const url = (store.sheetUrl || '').trim();
    const key = (store.orderKey || '').trim() || DEFAULT_ORDER_KEY;
    const list = document.getElementById('ordersList');
    const btn = document.getElementById('ordersRefreshBtn');
    if (!url) { if (!silent) showToast('حط رابط الشيت الأول في "إعدادات الطلبات"', false); return; }

    // 1) عرض آخر نسخة محفوظة فورًا
    const cache = getOrdersCache();
    if (cache && cache.orders.length) {
      renderOrders(cache.orders);
      renderStatus(`آخر تحديث: ${ordersAgeText(cache)}`);
    } else if (!silent) {
      list.innerHTML = '<div class="orders-empty"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل الأوردرات...</div>';
    }
    if (silent && cache && Date.now() - cache.t < 30000) return;

    // 2) التحديث من الشيت في الخلفية مع مهلة زمنية
    btn.disabled = true;
    const start = Date.now();
    const tick = setInterval(() => {
      const el = Date.now() - start;
      if (el > 10000 && !slowHinted) slowHinted = true;
      renderStatus(slowHinted
        ? `بأحدث البيانات من الشيت... ${Math.floor(el / 1000)} ث (كولد ستارت)`
        : `بأحدث البيانات من الشيت... ${Math.floor(el / 1000)} ث`, slowHinted);
    }, 1000);
    try {
      const [orders, doneRes] = await Promise.all([
        fetchOrders(url, key, 25000),
        loadDoneOrders(),
      ]);
      doneOrders = doneRes;
      saveOrdersCache(orders);
      renderOrders(orders);
      renderStatus(`آخر تحديث: ${ordersAgeText(getOrdersCache())}`);
      slowHinted = false;
    } catch (err) {
      if (cache && cache.orders.length) {
        renderOrders(cache.orders);
        renderStatus(`الشيت مش راضٍ يرد حاليًا — معروض آخر نسخة (${ordersAgeText(cache)})`, true);
        showToast('تعذر الاتصال بالشيت — معروض آخر نسخة محفوظة', false);
      } else if (err.message === 'wrong_key') {
        list.innerHTML = '<div class="orders-empty">المفتاح غلط 🔑 تأكد إن "مفتاح قراءة الأوردرات" مطابق لـ ACCESS_KEY في كود الشيت</div>';
      } else {
        list.innerHTML = '<div class="orders-empty">متعرفناش نقرا الشيت ⚠️<br>تأكد إنك عملت خطوة <b>"تحديث الإصدار (v2)"</b> في كود الشيت — التعليمات في <b>google-sheets-apps-script.txt</b></div>';
      }
    } finally {
      clearInterval(tick);
      btn.disabled = false;
    }
  }

  document.getElementById('ordersList').addEventListener('click', async (e) => {
    const doneBtn = e.target.closest('.done-btn');
    if (doneBtn) {
      e.stopPropagation();
      const ref = doneBtn.dataset.ref;
      if (doneOrders.includes(ref)) {
        doneOrders = doneOrders.filter(r => r !== ref);
      } else {
        doneOrders.push(ref);
      }
      const ok = await saveDoneOrders(doneOrders);
      showToast(ok ? (doneOrders.includes(ref) ? 'تمام — اتسجل أنه اتسلم ✅' : 'اتلغى تم') : 'التحديث اتسجل على الجهاز بس (السحابة مش راضية)', ok);
      await loadOrders(true);
      return;
    }
    const item = e.target.closest('.order-expand');
    if (!item) return;
    const details = item.querySelector('.order-details');
    const arrow = item.querySelector('.expand-arrow');
    if (details) {
      details.hidden = !details.hidden;
      if (arrow) arrow.classList.toggle('rotated');
      item.classList.toggle('expanded');
    }
  });

  document.getElementById('ordersRefreshBtn').addEventListener('click', () => loadOrders(false));

  // ---------- إعدادات الطلبات ----------
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
    if (sheet && !/^https:\/\//.test(sheet)) { showToast('رابط الشيت لازم يبدأ بـ https://', false); return; }
    s.sheetUrl = sheet;
    s.orderKey = document.getElementById('osOrderKey').value.trim() || DEFAULT_ORDER_KEY;
    s.telegramToken = document.getElementById('osTgToken').value.trim();
    s.telegramChatId = document.getElementById('osTgChatId').value.trim();
    saveAdminStore(s);
    cloudSave(s);
    showToast('تم حفظ إعدادات الطلبات ✅');
  });

  document.getElementById('osSheetTestBtn').addEventListener('click', async () => {
    const url = document.getElementById('osSheet').value.trim();
    if (!url) { showToast('حط رابط الشيت الأول', false); return; }
    const btn = document.getElementById('osSheetTestBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...';
    const ok = await sendToSheet(url, { ref: 'TEST', name: 'رسالة تجربة', phone: '-', address: '-', notes: 'تجربة من صفحة الأوردرات', delivery: 0, total: 0, lines: '-' });
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-table"></i> تجربة الشيت';
    showToast(ok ? 'وصلت الشيت ✅ افتح الشيت وشوف آخر صف' : 'الإرسال فشل — تأكد من نشر الرابط: Anyone + Execute as Me', ok);
  });

  document.getElementById('osTgTestBtn').addEventListener('click', async () => {
    const token = document.getElementById('osTgToken').value.trim();
    const chatId = document.getElementById('osTgChatId').value.trim();
    if (!token || !chatId) { showToast('اكتب التوكن ومعرف المحادثة الأول', false); return; }
    const btn = document.getElementById('osTgTestBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...';
    const ok = await sendTelegramMessage({ token, chatId }, '✅ رسالة تجربة من صفحة الأوردرات — البوت شغال!');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> رسالة تجربة';
    showToast(ok ? 'اتبعتت الرسالة ✅ افتح تيليجرام وشوف' : 'الإرسال فشل — راجع التوكن ومعرف المحادثة', ok);
  });

  fillOrderSettings();
  if (!panel.hidden) loadOrders(false);

  const filterBar = document.getElementById('ordersFilterBar');
  if (filterBar) {
    filterBar.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      orderFilter = chip.dataset.filter || 'all';
      filterBar.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', c === chip));
      if (lastOrders.length) renderOrders(lastOrders);
    });
  }
  const searchBox = document.getElementById('ordersSearch');
  if (searchBox) {
    searchBox.addEventListener('input', () => {
      orderSearch = searchBox.value.trim();
      if (lastOrders.length) renderOrders(lastOrders);
    });
  }
});
