/* ============================================================
   المنياوي | منطق الموقع
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // ---------- البيانات من المخزن (منتجات المسؤول المضافة) ----------
  const adminStore = getAdminStore();
  let PRODUCTS = buildProducts(adminStore);
  let WHATSAPP_NUMBER = getWhatsapp(adminStore);

  // ---------- شكل المنتج: صورة مرفوعة أو إيموجي ----------
  const visual = p => p.img ? `<img src="${p.img}" alt="${p.name}">` : p.emoji;

  // ---------- استبدال الإيموجي الغير مدعومة على الجهاز (مربعات ويندوز) ----------
  function applyEmojiFallbacks(list) {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      function supported(ch) {
        ctx.clearRect(0, 0, 64, 64);
        ctx.font = '48px "Segoe UI Emoji", "Noto Color Emoji", serif';
        ctx.fillText(ch, 4, 52);
        const d = ctx.getImageData(0, 0, 64, 64).data;
        let px = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) px++;
        return px / 4096 > 0.18;
      }
      list.forEach(p => {
        if (EMOJI_FALLBACKS[p.emoji] && !supported(p.emoji)) p.emoji = EMOJI_FALLBACKS[p.emoji];
      });
    } catch (e) { }
  }
  applyEmojiFallbacks(PRODUCTS);

  // ---------- السحابة: جلب أحدث المنتجات والإعدادات ----------
  (async function syncCloud() {
    const cloud = await cloudLoad();
    if (!cloud) return;
    if (Array.isArray(cloud.products) && cloud.products.length) adminStore.products = cloud.products;
    if (cloud.overrides && typeof cloud.overrides === 'object' && Object.keys(cloud.overrides).length) adminStore.overrides = cloud.overrides;
    if (Array.isArray(cloud.deleted) && cloud.deleted.length) adminStore.deleted = cloud.deleted;
    if (Array.isArray(cloud.disabled) && cloud.disabled.length) adminStore.disabled = cloud.disabled;
    if (typeof cloud.whatsapp === 'string' && cloud.whatsapp) adminStore.whatsapp = cloud.whatsapp;
    if (typeof cloud.phone === 'string' && cloud.phone) adminStore.phone = cloud.phone;
    if (typeof cloud.deliveryFee === 'number' && cloud.deliveryFee > 0) adminStore.deliveryFee = cloud.deliveryFee;
    if (typeof cloud.video === 'string' && cloud.video) adminStore.video = cloud.video;
    if (typeof cloud.hours === 'string' && cloud.hours && cloud.hours !== DEFAULT_HOURS) adminStore.hours = cloud.hours;
    if (typeof cloud.sheetUrl === 'string' && cloud.sheetUrl && cloud.sheetUrl !== DEFAULT_SHEET_URL) adminStore.sheetUrl = cloud.sheetUrl;
    if (typeof cloud.telegramToken === 'string' && cloud.telegramToken) adminStore.telegramToken = cloud.telegramToken;
    if (typeof cloud.telegramChatId === 'string' && cloud.telegramChatId) adminStore.telegramChatId = cloud.telegramChatId;
    saveAdminStore(adminStore);
    PRODUCTS = buildProducts(adminStore);
    applyEmojiFallbacks(PRODUCTS);
    WHATSAPP_NUMBER = getWhatsapp(adminStore);
    DELIVERY_FEE = adminStore.deliveryFee > 0 ? adminStore.deliveryFee : 25;
    renderProducts();
    renderOffers();
    updateCartUI();
    applyPhone();
    setupVideo();
    applyHours();
  })();

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
  const pickQty = {};
  let DELIVERY_FEE = adminStore.deliveryFee > 0 ? adminStore.deliveryFee : 25;
  const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  // ---------- فيديو المحل (مرفوع من الجهاز ← رابط الإعدادات ← الافتراضي) ----------
  async function setupVideo() {
    const wrap = document.querySelector('#about-video .video-wrap');
    if (!wrap) return;
    try {
      const blob = await getVideoBlob();
      if (blob) {
        const vurl = URL.createObjectURL(blob);
        wrap.innerHTML = `<video controls playsinline preload="none" poster="assets/video-poster.svg"><source src="${vurl}" type="${blob.type || 'video/mp4'}">متصفحك مش بيدعم عرض الفيديو.. شوفنا على فيسبوك 😉</video>`;
        return;
      }
    } catch (e) { }
    const url = (adminStore.video || '').trim();
    if (!url) return;
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
    if (yt) {
      wrap.innerHTML = `<iframe src="https://www.youtube.com/embed/${yt[1]}?rel=0" title="فيديو المحل" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    } else {
      wrap.innerHTML = `<video controls playsinline preload="none" poster="assets/video-poster.svg"><source src="${url}" type="video/mp4">متصفحك مش بيدعم عرض الفيديو.. شوفنا على فيسبوك 😉</video>`;
    }
  }
  setupVideo();

  // ---------- العربة ----------
  function loadCart() {
    try {
      const c = JSON.parse(localStorage.getItem('minyawi_cart')) || {};
      const dis = new Set(PRODUCTS.filter(p => p.disabled).map(p => p.id));
      Object.keys(c).forEach(id => { if (dis.has(id)) delete c[id]; });
      return c;
    } catch { return {}; }
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
      return okCat && okSearch && !p.disabled;
    });

    noResults.hidden = list.length > 0;

    productsGrid.innerHTML = list.map((p, i) => `
      <article class="product-card reveal visible" data-id="${p.id}" style="animation-delay:${Math.min(i * 40, 400)}ms; --img-bg:${p.bg}">
        ${p.offer ? '<span class="product-badge">🔥 عرض خاص</span>' : ''}
        ${p.badge === 'new' ? '<span class="product-badge new">✨ جديد</span>' : ''}
        <span class="added-chip" hidden>✓ اتضافت لعربتك</span>
        <div class="product-img">${visual(p)}</div>
        <div class="product-cat">${CATEGORY_LABELS[p.cat]}</div>
        <h3 class="product-name">${p.name}</h3>
        <div class="product-unit">${p.unit} ${p.unit === 'حزمة' || p.unit === 'ربطة' ? 'بمزاجك' : ''}</div>
        ${p.unit === 'كيلو' ? `
        <div class="fraction-chips">
          <button class="frac-chip" onclick="stepPick('${p.id}', 0.25, true)">¼ ربع كيلو</button>
          <button class="frac-chip" onclick="stepPick('${p.id}', 0.5, true)">½ نص كيلو</button>
          <button class="frac-chip" onclick="stepPick('${p.id}', 1, true)">1 كيلو</button>
        </div>
        <div class="qty-tip">✍️ اقدر أكتب الكمية بنفسي (مثال: كيلو ونص)</div>` : ''}
        <div class="product-price-row">
          <div class="product-price">
            ${p.oldPrice ? `<span class="price-old">${p.oldPrice} ج.م</span>` : ''}
            <span class="price-now">${p.price} ج.م</span>
          </div>
          <div class="card-actions">
            <div class="product-qty">
              <button class="qty-btn" onclick="stepPick('${p.id}', -1)" aria-label="تقليل">−</button>
              <input type="text" class="qty-input" value="${formatQty(pickQty[p.id] || 1)}" inputmode="decimal" aria-label="الكمية" />
              <button class="qty-btn" onclick="stepPick('${p.id}', 1)" aria-label="زيادة">+</button>
            </div>
            <button class="add-btn" onclick="addToCart('${p.id}')" aria-label="إضافة للعربة"><i class="fa-solid fa-basket-shopping"></i></button>
          </div>
        </div>
      </article>`).join('') || '';
  }

  // ---------- عرض العروض ----------
  function renderOffers() {
    const offers = PRODUCTS.filter(p => p.offer && !p.disabled);
    document.getElementById('offers').style.display = offers.length ? '' : 'none';
    document.querySelector('.nav-link[href="#offers"]').style.display = offers.length ? '' : 'none';
    offersGrid.innerHTML = offers.map((p, i) => {
      const pct = Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100);
      return `
      <div class="offer-card reveal visible" style="animation-delay:${i * 60}ms; --img-bg:${p.bg}">
        <div class="offer-img">${visual(p)}</div>
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
  function formatQty(q) {
    if (q === 0.25) return '¼';
    if (q === 0.5) return '½';
    if (q === 0.75) return '¾';
    return String(q);
  }

  function formatQtyText(q, unit) {
    if (unit === 'كيلو') {
      if (q === 1) return 'كيلو';
      if (q === 0.25) return 'ربع كيلو';
      if (q === 0.5) return 'نص كيلو';
      if (q === 0.75) return '3 أرباع كيلو';
      if (q % 1 === 0.5) return `${Math.floor(q)} كيلو ونص`;
      return `${q} كيلو`;
    }
    return `${q} ${unit}`;
  }

  function parseQtyText(t) {
    let s = String(t).trim();
    if (!s) return null;
    const ar = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
    s = s.replace(/[٠-٩]/g, d => ar[d]);
    s = s.replace(/[،٫,]/g, '.');

    const hadKilo = /كيلو/.test(s);
    const kiloIdx = s.indexOf('كيلو');
    const fracIdx = s.search(/ربع|نص|نصف|أرباع|أربع/);
    const fracPos = s.search(/\d+\s*\/\s*\d+/);
    const fracAfterKilo = kiloIdx !== -1 && fracIdx !== -1 && fracIdx > kiloIdx;
    const kwa = /كيلو\s*و/.test(s);
    s = s.replace(/كيلوين/g, ' 2 ');
    s = s.replace(/كيلوا?/g, ' ');

    let extra = 0;
    if (/ونصف|ونص|و نصف/.test(s)) extra += 0.5;
    if (/وربع|و ربع/.test(s)) extra += 0.25;
    if (/وأرباع|و أرباع|وأربع|و أربع|و ثلاثة أرباع|وثلاثة أرباع|وثلاثة|و ثلاثة|و تلاتة|وتلاتة/.test(s)) extra += 0.75;
    s = s.replace(/ونصف|ونص|وربع|وأرباع|وأربع|و نصف|و ربع|و أرباع|و أربع|و ثلاثة أرباع|وثلاثة أرباع|وثلاثة|و ثلاثة|و تلاتة|وتلاتة/gi, ' ');

    const frac = s.match(/(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)/);
    let q = NaN;
    if (frac) {
      const whole = frac[1] ? parseInt(frac[1], 10) : 0;
      const den = parseInt(frac[3], 10);
      q = den ? whole + parseInt(frac[2], 10) / den : NaN;
      if (kwa) q += 1;
      else if (hadKilo && fracPos !== -1 && fracPos > kiloIdx && q < 1) q += 1;
    } else {
      const m = s.match(/-?\d+(?:[.,]\d+)?/);
      q = m ? parseFloat(m[0].replace(',', '.')) : NaN;
      if (q === 3 && /أرباع|أربع/.test(s)) q = 0.75;
    }
    if (isNaN(q)) {
      let fracVal = 0;
      if (s.includes('أرباع')) fracVal = 0.75;
      else if (s.includes('ربع') && !s.includes('أربعة')) fracVal = 0.25;
      else if (s.includes('نصف') || s.includes('نص')) fracVal = 0.5;
      let base = wordNumber(s);
      if (base === null) {
        if (fracVal !== 0 && fracAfterKilo) base = 1;
        else if (fracVal !== 0 && hadKilo && fracIdx !== -1) base = 0;
        else if (hadKilo) base = 1;
        else base = 0;
      } else if (fracVal === 0.75 && /تلاتة|ثلاثة/.test(s)) {
        base = 0;
      }
      if (fracVal === 0 && base === 0) return null;
      q = base + fracVal;
    }
    const r = Math.round((q + extra) * 4) / 4;
    return r > 0 ? r : null;
  }

  function wordNumber(s) {
    if (s.includes('عشرة')) return 10;
    if (s.includes('تسعة')) return 9;
    if (s.includes('تمانية') || s.includes('ثمانية')) return 8;
    if (s.includes('سبعة')) return 7;
    if (s.includes('ستة')) return 6;
    if (s.includes('خمسة')) return 5;
    if (s.includes('أربعة') || s.includes('اربعة')) return 4;
    if (s.includes('تلاتة') || s.includes('ثلاثة')) return 3;
    if (s.includes('اتنين') || s.includes('اثنين') || s.includes('اثنان')) return 2;
    if (s.includes('واحد') || s.includes('وحدة') || s.includes('احدي')) return 1;
    return null;
  }

  window.stepPick = (id, d, set) => {
    const p = PRODUCTS.find(x => x.id === id);
    const isKilo = p && p.unit === 'كيلو';
    const min = isKilo ? 0.25 : 1;
    const cur = pickQty[id] || 1;
    const step = isKilo ? 0.5 : 1;
    const val = set ? d : Math.max(min, Math.round((cur + d * step) * 4) / 4);
    pickQty[id] = val;
    const el = document.querySelector(`.product-card[data-id="${id}"] .qty-input`);
    if (el) el.value = formatQty(val);
  };

  // ---------- كتابة الكمية باليد ----------
  productsGrid.addEventListener('change', (e) => {
    const input = e.target.closest('.qty-input');
    if (!input) return;
    const card = input.closest('.product-card');
    const id = card ? card.dataset.id : '';
    const p = PRODUCTS.find(x => x.id === id);
    const val = parseQtyText(input.value);
    if (val === null || !p) {
      input.value = formatQty(pickQty[id] || 1);
      return;
    }
    pickQty[id] = p.unit === 'كيلو' ? Math.max(0.25, val) : Math.max(1, Math.round(val));
    input.value = formatQty(pickQty[id]);
  });
  productsGrid.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('qty-input')) {
      e.preventDefault();
      e.target.blur();
    }
  });

  window.addToCart = (id) => {
    const p = PRODUCTS.find(x => x.id === id);
    if (!p || p.disabled) return;
    const qty = pickQty[id] || 1;
    cart[id] = Math.round(((cart[id] || 0) + qty) * 4) / 4;
    pickQty[id] = 1;
    const el = document.querySelector(`.product-card[data-id="${id}"] .qty-input`);
    if (el) el.value = formatQty(1);
    saveCart();
    showToast(`تمت الإضافة ✅ ${formatQtyText(qty, p.unit)} ${p.name} في عربتك`);
    const chip = document.querySelector(`.product-card[data-id="${id}"] .added-chip`);
    if (chip) {
      chip.hidden = false;
      clearTimeout(chip._t);
      chip._t = setTimeout(() => { chip.hidden = true; }, 1600);
    }
    const btn = document.querySelector(`.product-card[data-id="${id}"] .add-btn`);
    if (btn) {
      btn.classList.add('added');
      const old = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-check"></i>';
      setTimeout(() => { btn.classList.remove('added'); btn.innerHTML = old; }, 1300);
    }
    cartCount.classList.remove('bump');
    void cartCount.offsetWidth;
    cartCount.classList.add('bump');
  };

  window.changeQty = (id, d) => {
    const p = PRODUCTS.find(x => x.id === id);
    const isKilo = p && p.unit === 'كيلو';
    const min = isKilo ? 0.25 : 1;
    const step = isKilo ? 0.5 : 1;
    const next = Math.round(((cart[id] || 0) + d * step) * 4) / 4;
    if (next < min) {
      delete cart[id];
      showToast(`شيلنا ${p.name} من العربة`, false);
    } else {
      cart[id] = next;
    }
    saveCart();
  };

  window.removeFromCart = (id) => {
    const p = PRODUCTS.find(x => x.id === id);
    delete cart[id];
    saveCart();
    showToast(`شيلنا ${p.name} من العربة`, false);
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
          <div class="cart-item-img">${visual(p)}</div>
          <div class="cart-item-info">
            <h5>${p.name}</h5>
            <small>${formatQtyText(qty, p.unit)}</small>
            <div class="cart-item-price">${p.price * qty} ج.م</div>
          </div>
          <div class="cart-item-actions">
            <div class="product-qty">
              <button class="qty-btn" onclick="changeQty('${id}', -1)">−</button>
              <span class="qty-val">${formatQty(qty)}</span>
              <button class="qty-btn" onclick="changeQty('${id}', 1)">+</button>
            </div>
            <button class="cart-remove" onclick="removeFromCart('${id}')"><i class="fa-solid fa-trash-can"></i> حذف</button>
          </div>
        </div>`;
    }).join('');

    const total = cartSum() + DELIVERY_FEE;
    cartTotal.textContent = total + ' ج.م';
    const dEl = document.querySelector('.cart-delivery strong');
    if (dEl) dEl.textContent = DELIVERY_FEE + ' ج.م';
  }

  // ---------- فتح/غلق العربة ----------
  window.openCart = () => { cartDrawer.classList.add('open'); cartOverlay.classList.add('show'); document.body.style.overflow = 'hidden'; };
  window.closeCart = () => { cartDrawer.classList.remove('open'); cartOverlay.classList.remove('show'); document.body.style.overflow = ''; };

  document.getElementById('cartBtn').addEventListener('click', openCart);
  document.getElementById('closeCart').addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', closeCart);
  document.getElementById('cartClear').addEventListener('click', () => {
    cart = {};
    saveCart();
    showToast('اتفضت العربة 🧹');
  });

  // ---------- التأكيد والطلب ----------
  function buildCartLines() {
    return Object.entries(cart).map(([id, qty]) => {
      const p = PRODUCTS.find(x => x.id === id);
      return `• ${p.name} × ${formatQtyText(qty, p.unit)} = ${p.price * qty} ج.م`;
    });
  }

  // ---------- شاشة النجاح (شبكة أمان لو الواتساب فتح فاضي) ----------
  const modalInner = document.querySelector('#checkoutModal .modal');
  const originalModalHTML = modalInner.innerHTML;
  let lastOrderMsg = '';
  let lastWaUrl = '';
  let lastWaWebUrl = '';

  window.closeCheckoutSuccess = () => closeCheckoutModal();
  window.copyOrder = async () => {
    if (!lastOrderMsg) return;
    try {
      await navigator.clipboard.writeText(lastOrderMsg);
      showToast('اتنسخ الطلب ✅ الصقه في الواتساب');
    } catch {
      const ta = document.getElementById('orderMsg');
      if (ta) { ta.focus(); ta.select(); document.execCommand('copy'); showToast('اتنسخ الطلب ✅ الصقه في الواتساب'); }
    }
  };
  window.reopenWa = () => { if (lastWaUrl) window.open(lastWaUrl, '_blank'); };
  window.reopenWaWeb = () => { if (lastWaWebUrl) window.open(lastWaWebUrl, '_blank'); };

  function restoreCheckoutModal() {
    if (modalInner.innerHTML !== originalModalHTML) {
      modalInner.innerHTML = originalModalHTML;
      bindCheckoutModal();
    }
  }
  function closeCheckoutModal() {
    checkoutModal.classList.remove('show');
    document.body.style.overflow = '';
    restoreCheckoutModal();
  }

  function buildWaUrl(msg) {
    return `https://api.whatsapp.com/send/?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(msg)}`;
  }
  function buildWaWebUrl(msg) {
    return `https://web.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(msg)}`;
  }

  function openWhatsapp(msg, note) {
    const url = buildWaUrl(msg);
    const win = window.open(url, '_blank');
    if (!win) window.location.href = url;
    if (note) showToast(note);
  }
  window.buildWaUrl = buildWaUrl;

  function bindCheckoutModal() {
    document.getElementById('closeModal').addEventListener('click', closeCheckoutModal);
    document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('cName').value.trim();
      const phone = document.getElementById('cPhone').value.trim();
      const address = document.getElementById('cAddress').value.trim();
      const notes = document.getElementById('cNotes').value.trim();

      const honey = (document.getElementById('cHoney') || {}).value || '';
      if (honey) { closeCheckoutModal(); showToast('تم استلام طلبك ✅'); return; }

      const phoneDigits = phone.replace(/[\s\-()]/g, '');
      if (!/^\+?\d{8,15}$/.test(phoneDigits)) { showToast('اكتب رقم تليفون صحيح — مثال: 01000000000', false); return; }

      const lastOrderAt = parseInt(localStorage.getItem('minyawi_last_order') || '0', 10);
      if (Date.now() - lastOrderAt < 45000) { showToast('استنى دقيقة بين كل طلب 😉', false); return; }
      localStorage.setItem('minyawi_last_order', String(Date.now()));

      const lines = buildCartLines();
      const total = cartSum() + DELIVERY_FEE;
      const orderNo = (parseInt(localStorage.getItem('minyawi_order_count') || '0', 10) || 0) + 1;
      localStorage.setItem('minyawi_order_count', String(orderNo));
      let deviceCode = localStorage.getItem('minyawi_device_code');
      if (!deviceCode) {
        deviceCode = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + Math.floor(Math.random() * 10);
        localStorage.setItem('minyawi_device_code', deviceCode);
      }
      const orderRef = '#' + orderNo + '-' + deviceCode;

      const msg =
        `🧾 *رقم الطلب: ${orderRef}*\n` +
        `🍅 *طلب جديد من المنياوي* 🍅\n\n` +
        `👤 الاسم: ${name}\n` +
        `📱 التليفون: ${phone}\n` +
        `🏠 العنوان: ${address}\n` +
        (notes ? `📝 ملاحظات: ${notes}\n` : '') +
        `\n🛒 *تفاصيل الطلب:*\n${lines.join('\n')}\n` +
        `\n🛵 *التوصيل: ${DELIVERY_FEE} ج.م*\n` +
        `💰 *الإجمالي: ${total} ج.م*`;

      lastOrderMsg = msg;
      lastWaUrl = buildWaUrl(msg);
      lastWaWebUrl = buildWaWebUrl(msg);

      // تسجيل الطلب في Firebase (المصدر الأساسي) + نسخة احتياطية في الشيت
      // الاتنين في الخلفية — مش بيأخروا التيليجرام/الواتساب أو شاشة النجاح
      saveOrderToCloud({
        ref: orderRef,
        name, phone, address, notes,
        lines: lines.join('\n'),
        delivery: DELIVERY_FEE,
        total,
      });
      if (adminStore.sheetUrl) {
        sendToSheet(adminStore.sheetUrl, {
          k: (adminStore.orderKey || '').trim() || DEFAULT_ORDER_KEY,
          ref: orderRef,
          name, phone, address, notes,
          lines: lines.join('\n'),
          delivery: DELIVERY_FEE,
          total,
        });
      }

      cart = {};
      saveCart();

      modalInner.innerHTML = `
        <button class="close-btn modal-close" onclick="closeCheckoutSuccess()" aria-label="إغلاق"><i class="fa-solid fa-xmark"></i></button>
        <div class="modal-head">
          <span class="modal-emoji">📨</span>
          <h3>طلبك اتجهز!</h3>
          <p id="orderStatus">جاري إرسال الطلب للمحل...</p>
        </div>
        <div class="order-no">🧾 رقم طلبك: <strong>${orderRef}</strong></div>
        <textarea id="orderMsg" class="order-msg" readonly>${msg}</textarea>
        <button type="button" class="btn btn-primary btn-block" onclick="copyOrder()"><i class="fa-solid fa-copy"></i> نسخ تفاصيل الطلب</button>
        <button type="button" class="btn btn-ghost btn-block" onclick="closeCheckoutSuccess()"><i class="fa-solid fa-circle-check"></i> تمام</button>
        <button type="button" class="btn btn-ghost btn-block" onclick="reopenWa()"><i class="fa-brands fa-whatsapp"></i> فتح واتساب</button>`;
      navigator.clipboard.writeText(msg).catch(() => {});
      showToast(`وصل طلبك رقم ${orderRef} — بنرسله للمحل ⏳`);

      const tg = getTelegramConfig(adminStore);
      (async () => {
        let ok = false;
        if (telegramReady(tg)) ok = await sendTelegramMessage(tg, msg);
        const status = document.getElementById('orderStatus');
        if (ok) {
          if (status) status.textContent = 'وصل طلبك للمحل ✅ وهنكلمك في أسرع وقت 🤝';
          showToast(`وصل طلبك رقم ${orderRef} للمحل ✅`);
        } else {
          if (status) status.textContent = telegramReady(tg)
            ? 'التيليجرام مش مستجيب — ابعت الرسالة على الواتساب 📲'
            : 'التيليجرام غير مفعّل في إعدادات المتجر — ابعت الرسالة على الواتساب 📲';
          showToast('خطوة أخيرة: افتح الواتساب واضغط إرسال لتأكيد طلبك 📲', false);
          try { window.open(lastWaUrl, '_blank'); } catch { }
        }
      })();
    });
  }
  bindCheckoutModal();

  // ---------- أزرار التأكيد (حسب طريقة الاستقبال) ----------
  (function setupOrderButtons() {
    const tg = getTelegramConfig(adminStore);
    const viaTg = telegramReady(tg);
    const checkoutBtn = document.getElementById('checkoutBtn');
    const sendOrderBtn = document.getElementById('sendOrderBtn');
    if (viaTg) {
      if (checkoutBtn) checkoutBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> تأكيد الطلب وإرساله للمحل';
      if (sendOrderBtn) sendOrderBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> إرسال الطلب للمحل';
    }
  })();

  document.getElementById('checkoutBtn').addEventListener('click', () => {
    if (cartCountTotal() === 0) { showToast('العربة فاضية! ضيف منتجات الأول', false); return; }
    closeCart();
    checkoutModal.classList.add('show');
    document.body.style.overflow = 'hidden';
  });
  checkoutModal.addEventListener('click', (e) => {
    if (e.target === checkoutModal) closeCheckoutModal();
  });

  // ---------- الوصول السري للوحة التحكم ----------
  // دوس على اللوجو 5 مرات ورا بعض (خلال 3 ثواني) أو Ctrl+Shift+A
  let logoCount = 0;
  let logoResetTimer;
  document.querySelectorAll('.logo').forEach(logo => {
    logo.addEventListener('click', () => {
      logoCount++;
      clearTimeout(logoResetTimer);
      logoResetTimer = setTimeout(() => { logoCount = 0; }, 3000);
      if (logoCount >= 5) {
        logoCount = 0;
        location.href = 'admin.html';
      }
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      location.href = 'admin.html';
    }
  });

  // ---------- التوست ----------
  let toastTimer;
  function showToast(msg, success = true) {
    toastMsg.textContent = msg;
    toast.classList.toggle('success', success);
    toast.querySelector('i').className = success ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation';
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
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
  const menuBtn = document.getElementById('menuBtn');
  const navClose = document.getElementById('navClose');
  const navOverlay = document.getElementById('navOverlay');
  function closeNav() {
    nav.classList.remove('open');
    navOverlay.classList.remove('show');
    document.body.style.overflow = '';
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  menuBtn.addEventListener('click', () => {
    nav.classList.add('open');
    navOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
    menuBtn.setAttribute('aria-expanded', 'true');
    navClose.focus();
  });
  navClose.addEventListener('click', closeNav);
  navOverlay.addEventListener('click', closeNav);
  nav.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', closeNav));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 768) closeNav(); });

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
    if (e.key === 'Escape') { closeCart(); closeCheckoutModal(); }
  });

  // ---------- فورم التواصل ----------
  document.getElementById('contactForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const honey = document.getElementById('cfHoney');
    if (honey && honey.value) { document.getElementById('cfMsg').value = ''; return; }
    const name = document.getElementById('cfName').value.trim();
    const phone = document.getElementById('cfPhone').value.trim();
    const msg = document.getElementById('cfMsg').value.trim();
    if (!/^\+?\d{8,15}$/.test(phone.replace(/[\s\-()]/g, ''))) { showToast('اكتب رقم تليفون صحيح', false); return; }
    if (!name || !msg) { showToast('اكتب اسمك ورسالتك الأول', false); return; }
    const last = parseInt(localStorage.getItem('minyawi_last_msg') || '0', 10);
    if (Date.now() - last < 30000) { showToast('استنى شوية بين الرسايل', false); return; }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    const ok = await saveContactMessage({ name, phone, message: msg });
    btn.disabled = false;
    if (ok) {
      localStorage.setItem('minyawi_last_msg', String(Date.now()));
      e.target.reset();
      showToast('وصلت رسالتك — هنرد عليك في أقرب وقت ✅');
    } else {
      showToast('متعرفناش نرسل الرسالة.. جرب تاني أو كلمنا على واتساب', false);
    }
  });

  // ---------- رقم التليفون والواتساب المعروضان ----------
  // يُستخدم الرقم الافتراضي من الكود لو مفيش إعداد محفوظ على هذا الجهاز
  function applyPhone() {
    const shown = formatPhone(adminStore.phone || DEFAULT_PHONE);
    document.querySelectorAll('.site-phone').forEach(el => { el.textContent = shown; });
    document.querySelectorAll('a[href^="tel:"]').forEach(a => { a.href = 'tel:' + shown; });
    document.querySelectorAll('a[href^="https://wa.me/"]').forEach(a => { a.href = `https://wa.me/${WHATSAPP_NUMBER}`; });
  }
  applyPhone();

  // ---------- ساعات العمل في الشريط العلوي ----------
  function applyHours() {
    const el = document.getElementById('topHours');
    if (el && adminStore.hours) el.textContent = adminStore.hours;
    const navEl = document.getElementById('navHours');
    if (navEl && adminStore.hours) navEl.textContent = adminStore.hours;
  }
  applyHours();

  // ---------- تشغيل ----------
  renderProducts();
  renderOffers();
  updateCartUI();
});
