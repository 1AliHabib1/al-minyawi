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

  async function loadOrders() {
    const url = (store.sheetUrl || '').trim();
    const key = (store.orderKey || '').trim() || DEFAULT_ORDER_KEY;
    const list = document.getElementById('ordersList');
    const btn = document.getElementById('ordersRefreshBtn');
    if (!url) { showToast('حط رابط الشيت الأول في الإعدادات', false); return; }
    btn.disabled = true;
    list.innerHTML = '<div class="orders-empty"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل الأوردرات...</div>';
    try {
      const [res, doneRes] = await Promise.all([
        fetch(`${url}?k=${encodeURIComponent(key)}`, { cache: 'no-store' }),
        loadDoneOrders(),
      ]);
      doneOrders = doneRes;
      if (!res.ok) throw new Error('http');
      const data = await res.json();
      if (!data || data.ok !== true) throw new Error(data && data.error === 'wrong_key' ? 'wrong_key' : 'bad');
      const orders = data.orders || [];
      if (!orders.length) {
        document.getElementById('ordersSummary').hidden = true;
        list.innerHTML = '<div class="orders-empty">مفيش أوردرات لسه 🍃 أول ما يجي طلب هيظهر هنا</div>';
      } else {
        renderOrders(orders);
      }
    } catch (err) {
      if (err.message === 'wrong_key') {
        list.innerHTML = '<div class="orders-empty">المفتاح غلط 🔑 تأكد إن "مفتاح قراءة الأوردرات" مطابق لـ ACCESS_KEY في كود الشيت</div>';
      } else {
        list.innerHTML = '<div class="orders-empty">متعرفناش نقرا الشيت ⚠️<br>تأكد إنك عملت خطوة <b>"تحديث الإصدار (v2)"</b> في كود الشيت — التعليمات في <b>google-sheets-apps-script.txt</b></div>';
      }
    } finally {
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
      await loadOrders();
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

  document.getElementById('ordersRefreshBtn').addEventListener('click', loadOrders);

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
