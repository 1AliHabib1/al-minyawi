/* ============================================================
   المينياوي | منطق الموقع
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // ---------- البيانات من المخزن (منتجات المسؤول المضافة) ----------
  const adminStore = getAdminStore();
  const PRODUCTS = buildProducts(adminStore);
  const WHATSAPP_NUMBER = getWhatsapp(adminStore);

  // ---------- عناصر عامة ----------
  const productsGrid = document.getElementById('productsGrid');
  const offersGrid = document.getElementById('offersGrid');
  const noResults = document.getElementById('noResults');
  const searchInput = document.getElementById('searchInput');
  const filters = document.getElementById('filters');
  const cartCount = document.getElementById('cartCount');
  const cartDrawer = document.getElementById('cartDrawer');
  const cartOverlay = document.getElementById('cartOverlay');
  const cartBody = document.getElementById('cartBody');
  const cartFooter = document.getElementById('cartFooter');
  const cartTotal = document.getElementById('cartTotal');
  const checkoutModal = document.getElementById('checkoutModal');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const toTop = document.getElementById('toTop');
  const header = document.getElementById('header');
  const nav = document.getElementById('nav');

  let currentCat = 'all';
  let searchTerm = '';
  let cart = loadCart();

  // ---------- العربة ----------
  function loadCart() {
    try { return JSON.parse(localStorage.getItem('minyawi_cart')) || {}; }
    catch { return {}; }
  }
  function saveCart() {
    localStorage.setItem('minyawi_cart', JSON.stringify(cart));
    updateCartUI();
  }
  function cartCountTotal() {
    return Object.values(cart).reduce((s, q) => s + q, 0);
  }
  function cartSum() {
    return Object.entries(cart).reduce((s, [id, q]) => {
      const p = PRODUCTS.find(x => x.id === id);
      return s + (p ? p.price * q : 0);
    }, 0);
  }

  // ---------- عرض المنتجات ----------
  function renderProducts() {
    const list = PRODUCTS.filter(p => {
      const okCat = currentCat === 'all' || p.cat === currentCat;
      const okSearch = !searchTerm || p.name.includes(searchTerm);
      return okCat && okSearch;
    });

    noResults.hidden = list.length > 0;

    productsGrid.innerHTML = list.map((p, i) => `
      <article class="product-card reveal visible" style="animation-delay:${Math.min(i * 40, 400)}ms; --img-bg:${p.bg}">
        ${p.offer ? '<span class="product-badge">🔥 عرض خاص</span>' : ''}
        ${p.badge === 'new' ? '<span class="product-badge new">✨ جديد</span>' : ''}
        <div class="product-img">${p.emoji}</div>
        <div class="product-cat">${CATEGORY_LABELS[p.cat]}</div>
        <h3 class="product-name">${p.name}</h3>
        <div class="product-unit">${p.unit} ${p.unit === 'حزمة' || p.unit === 'ربطة' ? 'بمزاجك' : ''}</div>
        <div class="product-price-row">
          <div class="product-price">
            ${p.oldPrice ? `<span class="price-old">${p.oldPrice} ج.م</span>` : ''}
            <span class="price-now">${p.price} ج.م</span>
          </div>
          ${cart[p.id] ? `
            <div class="product-qty">
              <button class="qty-btn" onclick="changeQty('${p.id}', -1)">−</button>
              <span class="qty-val">${cart[p.id]}</span>
              <button class="qty-btn" onclick="changeQty('${p.id}', 1)">+</button>
            </div>` : `
            <button class="add-btn" onclick="addToCart('${p.id}')" aria-label="إضافة للعربة"><i class="fa-solid fa-plus"></i></button>`}
        </div>
      </article>`).join('') || '';
  }

  // ---------- عرض العروض ----------
  function renderOffers() {
    const offers = PRODUCTS.filter(p => p.offer);
    offersGrid.innerHTML = offers.map((p, i) => {
      const pct = Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100);
      return `
      <div class="offer-card reveal visible" style="animation-delay:${i * 60}ms; --img-bg:${p.bg}">
        <div class="offer-img">${p.emoji}</div>
        <div class="offer-info">
          <h3>${p.name} <small style="color:#94a3b8;font-weight:700">(${p.unit})</small></h3>
          <div><span class="offer-old">${p.oldPrice} ج.م</span><span class="offer-new">${p.price} ج.م</span></div>
          <span class="offer-pct">وفّر ${pct}%</span>
        </div>
        <button class="add-btn" onclick="addToCart('${p.id}')" aria-label="إضافة للعربة" style="flex-shrink:0"><i class="fa-solid fa-plus"></i></button>
      </div>`;
    }).join('');
  }

  // ---------- إضافة وتعديل العربة ----------
  window.addToCart = (id) => {
    const p = PRODUCTS.find(x => x.id === id);
    cart[id] = (cart[id] || 0) + 1;
    saveCart();
    showToast(`ضيفنا ${p.name} للعربة 🛒`);
    cartCount.classList.remove('bump');
    void cartCount.offsetWidth;
    cartCount.classList.add('bump');
  };

  window.changeQty = (id, d) => {
    const p = PRODUCTS.find(x => x.id === id);
    const next = (cart[id] || 0) + d;
    if (next <= 0) {
      delete cart[id];
      showToast(`شيلنا ${p.name} من العربة`);
    } else {
      cart[id] = next;
    }
    saveCart();
  };

  window.removeFromCart = (id) => {
    const p = PRODUCTS.find(x => x.id === id);
    delete cart[id];
    saveCart();
    showToast(`شيلنا ${p.name} من العربة`);
  };

  // ---------- تحديث واجهة العربة ----------
  function updateCartUI() {
    const count = cartCountTotal();
    cartCount.textContent = count;

    if (count === 0) {
      cartBody.innerHTML = `
        <div class="cart-empty">
          <span>🧺</span>
          <h4>العربة فاضية!</h4>
          <p>دوّر على منتجاتك المفضلة وضيفها هنا</p>
          <button class="btn btn-primary" onclick="closeCart();document.getElementById('products').scrollIntoView()">تصفح المنتجات</button>
        </div>`;
      cartFooter.style.display = 'none';
      return;
    }

    cartFooter.style.display = 'block';

    cartBody.innerHTML = Object.entries(cart).map(([id, qty]) => {
      const p = PRODUCTS.find(x => x.id === id);
      if (!p) return '';
      return `
        <div class="cart-item" style="--img-bg:${p.bg}">
          <div class="cart-item-img">${p.emoji}</div>
          <div class="cart-item-info">
            <h5>${p.name}</h5>
            <small>${p.unit}</small>
            <div class="cart-item-price">${p.price * qty} ج.م</div>
          </div>
          <div class="cart-item-actions">
            <div class="product-qty">
              <button class="qty-btn" onclick="changeQty('${id}', -1)">−</button>
              <span class="qty-val">${qty}</span>
              <button class="qty-btn" onclick="changeQty('${id}', 1)">+</button>
            </div>
            <button class="cart-remove" onclick="removeFromCart('${id}')"><i class="fa-solid fa-trash-can"></i> حذف</button>
          </div>
        </div>`;
    }).join('');

    const total = cartSum();
    cartTotal.textContent = total + ' ج.م';
  }

  // ---------- فتح/غلق العربة ----------
  window.openCart = () => { cartDrawer.classList.add('open'); cartOverlay.classList.add('show'); document.body.style.overflow = 'hidden'; };
  window.closeCart = () => { cartDrawer.classList.remove('open'); cartOverlay.classList.remove('show'); document.body.style.overflow = ''; };

  document.getElementById('cartBtn').addEventListener('click', openCart);
  document.getElementById('closeCart').addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', closeCart);

  // ---------- التأكيد والطلب ----------
  document.getElementById('checkoutBtn').addEventListener('click', () => {
    if (cartCountTotal() === 0) { showToast('العربة فاضية! ضيف منتجات الأول'); return; }
    checkoutModal.classList.add('show');
    document.body.style.overflow = 'hidden';
  });
  document.getElementById('closeModal').addEventListener('click', () => {
    checkoutModal.classList.remove('show');
    document.body.style.overflow = '';
  });
  checkoutModal.addEventListener('click', (e) => {
    if (e.target === checkoutModal) {
      checkoutModal.classList.remove('show');
      document.body.style.overflow = '';
    }
  });

  document.getElementById('checkoutForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('cName').value.trim();
    const phone = document.getElementById('cPhone').value.trim();
    const city = document.getElementById('cCity').value.trim();
    const address = document.getElementById('cAddress').value.trim();
    const notes = document.getElementById('cNotes').value.trim();

    const lines = Object.entries(cart).map(([id, qty]) => {
      const p = PRODUCTS.find(x => x.id === id);
      return `• ${p.name} (${p.unit}) × ${qty} = ${p.price * qty} ج.م`;
    });
    const total = cartSum();

    const msg =
      `🍅 *طلب جديد من المينياوي* 🍅\n\n` +
      `👤 الاسم: ${name}\n` +
      `📱 التليفون: ${phone}\n` +
      `📍 المدينة: ${city}\n` +
      `🏠 العنوان: ${address}\n` +
      (notes ? `📝 ملاحظات: ${notes}\n` : '') +
      `\n🛒 *تفاصيل الطلب:*\n${lines.join('\n')}\n\n` +
      `💰 *الإجمالي: ${total} ج.م*\n\n` +
      `شكرًا لاختيارك المينياوي!`;

    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank');

    cart = {};
    saveCart();
    checkoutModal.classList.remove('show');
    document.body.style.overflow = '';
    showToast('تم إرسال طلبك! هنكلمك خلال دقايق ✅');
  });

  // ---------- التوست ----------
  let toastTimer;
  function showToast(msg) {
    toastMsg.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  // ---------- البحث والفلترة ----------
  searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value.trim();
    renderProducts();
  });

  filters.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    filters.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentCat = chip.dataset.cat;
    renderProducts();
  });

  // ---------- روابط أقسام الفوتر ----------
  document.querySelectorAll('[data-cat-link]').forEach(a => {
    a.addEventListener('click', () => {
      const cat = a.dataset.catLink;
      filters.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      filters.querySelector(`.chip[data-cat="${cat}"]`).classList.add('active');
      currentCat = cat;
      searchTerm = '';
      searchInput.value = '';
      renderProducts();
    });
  });

  // ---------- الهيدر والتنقل ----------
  document.getElementById('menuBtn').addEventListener('click', () => nav.classList.add('open'));
  document.getElementById('navClose').addEventListener('click', () => nav.classList.remove('open'));
  nav.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => nav.classList.remove('open')));

  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 40);
    toTop.classList.toggle('show', window.scrollY > 500);

    let current = 'home';
    document.querySelectorAll('section[id]').forEach(sec => {
      if (window.scrollY >= sec.offsetTop - 160) current = sec.id;
    });
    nav.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + current));
  });

  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // ---------- ظهور العناصر عند التمرير ----------
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('visible'); revealObs.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.feature-card, .how-step, .contact-inner, .offer-card').forEach(el => {
    if (!el.classList.contains('visible')) { el.classList.add('reveal'); revealObs.observe(el); }
  });

  // ---------- إغلاق المودال بزر Escape ----------
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeCart(); checkoutModal.classList.remove('show'); document.body.style.overflow = ''; }
  });

  // ---------- فورم التواصل ----------
  document.getElementById('contactForm').addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('تم إرسال رسالتك! هنرد عليك في أقرب وقت 💬');
    e.target.reset();
  });

  // ---------- رقم التليفون المعروض ----------
  if (adminStore.phone) {
    const shown = formatPhone(adminStore.phone);
    document.querySelectorAll('.site-phone').forEach(el => { el.textContent = shown; });
    document.querySelectorAll('a[href^="tel:"]').forEach(a => { a.href = 'tel:' + shown; });
  }

  // ---------- تشغيل ----------
  renderProducts();
  renderOffers();
  updateCartUI();
});
