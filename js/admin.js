/* ============================================================
   المنياوي | منطق لوحة التحكم
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  let store = getAdminStore();

  const loginScreen = document.getElementById('loginScreen');
  const panel = document.getElementById('panel');
  const loginForm = document.getElementById('loginForm');
  const loginPass = document.getElementById('loginPass');
  const loginHint = document.getElementById('loginHint');
  const loginError = document.getElementById('loginError');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');

  const productForm = document.getElementById('productForm');
  const editId = document.getElementById('editId');
  const editIsAdmin = document.getElementById('editIsAdmin');
  const formTitle = document.getElementById('formTitle');
  const formSub = document.getElementById('formSub');
  const pSubmitBtn = document.getElementById('pSubmitBtn');
  const pCancelEdit = document.getElementById('pCancelEdit');
  const adminList = document.getElementById('adminList');
  const adminSearch = document.getElementById('adminSearch');
  const prodCount = document.getElementById('prodCount');

  const EMOJIS = ['🍅','🥒','🥔','🧅','🫑','🌶️','🍆','🥕','🥦','🫘','🫛','🍋','🧄','🍠','🌰','🥬','🌿','🍃','🌱','🍌','🍎','🍏','🍊','🍇','🍐','🍍','🥝','🍑','🥭','🍓','🍉','🍈','🫐'].map(e => (EMOJI_FALLBACKS[e] ? EMOJI_FALLBACKS[e] : e));

  let selectedEmoji = '';
  let pImg = '';
  let listSearch = '';

  // ---------- منتقي الإيموجي ----------
  const picker = document.getElementById('emojiPicker');
  picker.innerHTML = EMOJIS.map(e => `<button type="button" data-emoji="${e}">${e}</button>`).join('');
  picker.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-emoji]');
    if (!btn) return;
    picker.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedEmoji = btn.dataset.emoji;
    document.getElementById('pEmoji').value = selectedEmoji;
  });
  document.getElementById('pEmoji').addEventListener('input', (e) => {
    selectedEmoji = e.target.value;
    picker.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b.dataset.emoji === selectedEmoji));
  });

  // ---------- صورة المنتج من الجهاز (بديل الإيموجي) ----------
  const pImgFile = document.getElementById('pImgFile');
  const pImgPreview = document.getElementById('pImgPreview');
  const pImgPreviewImg = document.getElementById('pImgPreviewImg');
  const pImgClear = document.getElementById('pImgClear');

  function setPImg(dataUrl) {
    pImg = dataUrl || '';
    pImgPreview.hidden = !pImg;
    if (pImg) pImgPreviewImg.src = pImg;
  }

  // إزالة الخلفية البيضاء تلقائيًا (خوارزمية Flood Fill من الحواف)
  function removeWhiteBg(c) {
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const d = imgData.data;
    const HARD = 238, SOFT = 200;
    const isBg = (i) => d[i] >= HARD && d[i + 1] >= HARD && d[i + 2] >= HARD;
    const total = w * h;
    const marked = new Uint8Array(total);
    const stack = [];
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const idx = y * w + x;
      if (!marked[idx] && isBg(idx * 4)) { marked[idx] = 1; stack.push(idx); }
    };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (stack.length) {
      const idx = stack.pop();
      const x = idx % w, y = (idx / w) | 0;
      push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
    }
    let removed = 0;
    for (let i = 0; i < total; i++) if (marked[i]) { d[i * 4 + 3] = 0; removed++; }
    if (removed < total * 0.12) return false; // مفيش خلفية بيضا واضحة
    for (let i = 0; i < total; i++) {
      if (marked[i] || d[i * 4 + 3] === 0) continue;
      const m = Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      if (m >= HARD) continue;
      const x = i % w, y = (i / w) | 0;
      const near = (marked[y * w + x - 1] && x > 0) || (marked[y * w + x + 1] && x < w - 1) ||
                   (marked[(y - 1) * w + x] && y > 0) || (marked[(y + 1) * w + x] && y < h - 1);
      if (near && m >= SOFT) {
        d[i * 4 + 3] = Math.round(255 * (m - SOFT) / (HARD - SOFT));
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return true;
  }

  pImgFile.addEventListener('change', () => {
    const file = pImgFile.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('اختار ملف صورة (png / jpg / webp)', false); pImgFile.value = ''; return; }
    if (file.size > 8 * 1024 * 1024) { showToast('الصورة أكبر من 8 ميجا — اختار صورة أصغر', false); pImgFile.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 480;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * scale));
          c.height = Math.max(1, Math.round(img.height * scale));
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, c.width, c.height);
          const bgRemoved = document.getElementById('pBgRemove').checked && removeWhiteBg(c);
          let url;
          if (bgRemoved) {
            url = c.toDataURL('image/webp', 0.85);
            if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/png');
          } else {
            url = c.toDataURL('image/webp', 0.8);
            if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/jpeg', 0.85);
          }
          setPImg(url);
          showToast(bgRemoved ? 'اتضافت الصورة ✅ اتمسحت الخلفية البيضاء تلقائيًا' : 'اتضافت الصورة ✅ هتظهر في المتجر بعد الحفظ');
        } catch {
          showToast('متعرفناش نعالج الصورة دي — جرب صورة تانية', false);
        }
      };
      img.onerror = () => { showToast('متعرفناش نقرا الصورة — جرب صورة تانية', false); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  pImgClear.addEventListener('click', () => {
    setPImg('');
    pImgFile.value = '';
    showToast('اتحذفت الصورة — هيرجع المنتج للإيموجي');
  });

  // ---------- الدخول ----------
  if (!store.passHash) loginHint.hidden = false;

  const cloudInit = (async () => {
    try {
      const cloud = await cloudLoad();
      if (cloud && typeof cloud.passHash === 'string' && cloud.passHash && cloud.passHash !== store.passHash) {
        store.passHash = cloud.passHash;
        saveAdminStore(store);
        loginHint.hidden = true;
      }
    } catch { }
  })();

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
      openPanel();
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

  async function openPanel() {
    loginScreen.style.display = 'none';
    panel.hidden = false;
    renderAdminList();
    fillSettings();
    await hydrateStoreFromCloud();
    store = getAdminStore();
    fillSettings();
    renderAdminList();
    loadOrders();
    loadMessages();
  }

  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('minyawi_admin_auth');
    panel.hidden = true;
    loginScreen.style.display = 'grid';
    loginError.hidden = true;
    resetForm();
  });

  if (sessionStorage.getItem('minyawi_admin_auth') === '1') openPanel();

  // ---------- عرض قائمة المنتجات ----------
  function itemImg(p) { return p.img ? `<img src="${p.img}" alt="${p.name}">` : p.emoji; }

  function renderAdminList() {
    const all = buildProducts(store);
    prodCount.textContent = all.length;
    const q = listSearch.trim();

    const visible = all.filter(p => !q || p.name.includes(q));
    const deleted = (store.deleted || []).map(id => BASE_PRODUCTS.find(p => p.id === id)).filter(Boolean)
      .filter(p => !q || p.name.includes(q));

    if (!visible.length && !deleted.length) {
      adminList.innerHTML = '<div class="admin-empty"><span>🥕</span>مفيش منتجات للعرض</div>';
      return;
    }

    adminList.innerHTML =
      visible.map(p => `
        <div class="admin-item${p.disabled ? ' is-off' : ''}">
          <div class="admin-item-img" style="--item-bg:${p.bg || '#f0fdf4'}">${itemImg(p)}</div>
          <div class="admin-item-info">
            <h5>${p.name} ${p.adminAdded ? '<span class="tag-admin">أضفتها</span>' : ''}${p.disabled ? '<span class="tag-disabled">⏸ نفذت مؤقتًا</span>' : ''}</h5>
            <small>${CATEGORY_LABELS[p.cat]} • ${p.unit}${p.offer ? ' • عرض 🔥' : ''}${p.badge === 'new' ? ' • جديد ✨' : ''}</small>
            <div class="admin-item-price">${p.price} ج.م${p.oldPrice ? ` <small style="text-decoration:line-through;color:#94a3b8">${p.oldPrice} ج.م</small>` : ''}</div>
          </div>
          <div class="admin-item-actions">
            <button class="icon-btn off" onclick="toggleActive('${p.id}')" title="${p.disabled ? 'إرجاع المنتج للمتجر' : 'تعطيل مؤقت (نفذت الكمية)'}"><i class="fa-solid ${p.disabled ? 'fa-play' : 'fa-circle-pause'}"></i></button>
            <button class="icon-btn edit" onclick="editProduct('${p.id}')" title="تعديل"><i class="fa-solid fa-pen"></i></button>
            <button class="icon-btn del" onclick="deleteProduct('${p.id}')" title="حذف"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </div>`).join('') +
      deleted.map(p => `
        <div class="admin-item" style="opacity:.75">
          <div class="admin-item-img" style="--item-bg:${p.bg || '#f0fdf4'}">${itemImg(p)}</div>
          <div class="admin-item-info">
            <h5>${p.name} <span class="tag-deleted">محذوفة</span></h5>
            <small>${CATEGORY_LABELS[p.cat]} • ${p.unit}</small>
          </div>
          <div class="admin-item-actions">
            <button class="icon-btn restore" onclick="restoreProduct('${p.id}')" title="استعادة"><i class="fa-solid fa-rotate-left"></i></button>
          </div>
        </div>`).join('');
  }

  adminSearch.addEventListener('input', (e) => { listSearch = e.target.value.trim(); renderAdminList(); });

  // ---------- المزامنة مع السحابة بعد كل تغيير ----------
  function pushCloud(silent) {
    cloudSave(store).then(ok => {
      if (!ok && !silent) showToast('اتحفظ على جهازك بس — السحابة مش متاحة دلوقتي', false);
    });
  }

  // ---------- الحفظ (إضافة / تعديل) ----------
  window.editProduct = (id) => {
    const p = buildProducts(store).find(x => x.id === id);
    if (!p) return;
    document.getElementById('pName').value = p.name;
    document.getElementById('pCat').value = p.cat;
    document.getElementById('pUnit').value = p.unit;
    document.getElementById('pPrice').value = p.price;
    document.getElementById('pOldPrice').value = p.oldPrice || '';
    document.getElementById('pBg').value = p.bg || '#dcfce7';
    document.getElementById('pOffer').checked = !!p.offer;
    document.getElementById('pNew').checked = p.badge === 'new';
    document.getElementById('pEmoji').value = p.emoji;
    selectedEmoji = p.emoji;
    picker.querySelectorAll('button').forEach(b => b.classList.toggle('selected', b.dataset.emoji === p.emoji));
    pImgFile.value = '';
    if (p.img) setPImg(p.img); else setPImg('');

    editId.value = id;
    editIsAdmin.value = p.adminAdded ? '1' : '0';
    formTitle.innerHTML = '<i class="fa-solid fa-pen"></i> تعديل: ' + p.name;
    formSub.textContent = 'عدّل البيانات واحفظ.. التغييرات هتظهر فورًا';
    pSubmitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> حفظ التعديلات';
    pCancelEdit.hidden = false;
    document.getElementById('productFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  function resetForm() {
    productForm.reset();
    editId.value = '';
    editIsAdmin.value = '';
    selectedEmoji = '';
    setPImg('');
    pImgFile.value = '';
    picker.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
    formTitle.innerHTML = '<i class="fa-solid fa-plus"></i> إضافة منتج جديد';
    formSub.textContent = 'منتجاتك هتظهر في المتجر فورًا';
    pSubmitBtn.innerHTML = '<i class="fa-solid fa-check"></i> حفظ المنتج';
    pCancelEdit.hidden = true;
  }

  pCancelEdit.addEventListener('click', resetForm);

  productForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('pName').value.trim();
    const cat = document.getElementById('pCat').value;
    const unit = document.getElementById('pUnit').value.trim();
    const price = parseFloat(document.getElementById('pPrice').value);
    const oldPrice = parseFloat(document.getElementById('pOldPrice').value) || 0;
    const emoji = selectedEmoji || '🥬';
    const bg = document.getElementById('pBg').value;
    const offer = document.getElementById('pOffer').checked;
    const isNew = document.getElementById('pNew').checked;

    if (!name || isNaN(price) || price <= 0) { showToast('اكتب اسم المنتج وسعر صحيح', false); return; }

    const data = {
      name, cat, unit, price,
      oldPrice: oldPrice > price ? oldPrice : 0,
      emoji, bg,
      img: pImg,
      offer,
      badge: isNew ? 'new' : '',
    };

    const id = editId.value;

    if (!id) {
      const newId = 'c' + Date.now();
      store.products.push({ id: newId, ...data });
      showToast(`تمت إضافة "${name}" للمتجر ✅`);
    } else if (editIsAdmin.value === '1') {
      const p = store.products.find(x => x.id === id);
      if (p) Object.assign(p, data);
      showToast(`تم تعديل "${name}" ✅`);
    } else {
      store.overrides[id] = { ...(store.overrides[id] || {}), ...data };
      showToast(`تم تعديل "${name}" ✅`);
    }

    try {
      saveAdminStore(store);
    } catch {
      showToast('المساحة ممتلئة في المتصفح! امسح صور أو منتجات قديمة الأول', false);
      return;
    }
    pushCloud();
    resetForm();
    renderAdminList();
  });

  // ---------- الحذف والاستعادة ----------
  window.deleteProduct = (id) => {
    const p = buildProducts(store).find(x => x.id === id);
    if (!p) return;
    if (p.adminAdded) {
      store.products = store.products.filter(x => x.id !== id);
    } else {
      if (!store.deleted.includes(id)) store.deleted.push(id);
    }
    saveAdminStore(store);
    pushCloud();
    renderAdminList();
    showToast(`تم حذف "${p.name}" من المتجر`);
  };

  window.restoreProduct = (id) => {
    store.deleted = store.deleted.filter(x => x !== id);
    saveAdminStore(store);
    cloudSave(store, { restoreIds: [id] }).then(ok => {
      if (!ok) showToast('اتحفظ على جهازك بس — السحابة مش متاحة دلوقتي', false);
    });
    renderAdminList();
    const p = BASE_PRODUCTS.find(x => x.id === id);
    showToast(`تمت استعادة "${p ? p.name : ''}" للمتجر ✅`);
  };

  // ---------- التعطيل المؤقت (نفذت الكمية) ----------
  window.toggleActive = (id) => {
    const p = buildProducts(store).find(x => x.id === id);
    if (!p) return;
    if (store.disabled.includes(id)) {
      store.disabled = store.disabled.filter(x => x !== id);
      saveAdminStore(store);
      cloudSave(store, { restoreIds: [id] }).then(ok => {
        if (!ok) showToast('اتحفظ على جهازك بس — السحابة مش متاحة دلوقتي', false);
      });
      renderAdminList();
      showToast(`تم إرجاع "${p.name}" للمتجر ✅`);
    } else {
      store.disabled.push(id);
      saveAdminStore(store);
      pushCloud();
      renderAdminList();
      showToast(`تم تعطيل "${p.name}" مؤقتًا ⏸`);
    }
  };

  // ---------- الإعدادات ----------
  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const wa = document.getElementById('sWhatsapp').value.trim();
    const ph = document.getElementById('sPhone').value.trim();
    const fee = parseFloat(document.getElementById('sDelivery').value);
    const vid = document.getElementById('sVideo').value.trim();
    const p1 = document.getElementById('sPass1').value;
    const p2 = document.getElementById('sPass2').value;

    if (wa && !/^\+?\d{9,15}$/.test(wa.replace(/\s/g, ''))) { showToast('رقم الواتساب مش صحيح! مثال: 201000000000', false); return; }
    if (isNaN(fee) || fee < 0) { showToast('اكتب رسوم توصيل صحيحة (0 أو أكتر)', false); return; }
    if (vid && !/^https?:\/\//.test(vid)) { showToast('رابط الفيديو لازم يبدأ بـ https://', false); return; }

    let passChanged = false;
    if (p1 || p2) {
      if (p1 !== p2) { showToast('كلمتا المرور مش متطابقين', false); return; }
      if (p1.length < 6) { showToast('كلمة المرور لازم 6 أحرف على الأقل', false); return; }
      try {
        store.passHash = await sha256Hex(p1);
      } catch {
        showToast('حصلت مشكلة في حفظ كلمة المرور.. حاول تاني', false);
        return;
      }
      passChanged = true;
      document.getElementById('sPass1').value = '';
      document.getElementById('sPass2').value = '';
    }

    store.whatsapp = wa;
    store.phone = ph;
    store.deliveryFee = fee || 0;
    store.video = vid;
    store.hours = document.getElementById('sHours').value.trim() || DEFAULT_HOURS;
    saveAdminStore(store);
    pushCloud();
    showToast(passChanged ? 'تم حفظ الإعدادات وتغيير كلمة المرور ✅' : 'تم حفظ الإعدادات ✅');
  });

  // ---------- رفع فيديو من الجهاز ----------
  const videoUploadStatus = document.getElementById('videoUploadStatus');
  const clearVideoBtn = document.getElementById('clearVideoBtn');

  async function refreshVideoStatus() {
    try {
      const blob = await getVideoBlob();
      if (blob) {
        videoUploadStatus.textContent = `✅ فيديو مرفوع من الجهاز (${(blob.size / 1024 / 1024).toFixed(1)} ميجا) — ظاهر في المتجر`;
        videoUploadStatus.style.color = '#16a34a';
      } else {
        videoUploadStatus.textContent = 'مفيش فيديو مرفوع — الافتراضي أو الرابط هو الشغال';
        videoUploadStatus.style.color = '#64748b';
      }
      clearVideoBtn.hidden = !blob;
    } catch {
      videoUploadStatus.textContent = 'متعرفش حالة الفيديو المرفوع';
    }
  }

  document.getElementById('sVideoFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) { showToast('اختار ملف فيديو صح (mp4 مثلًا)', false); return; }
    if (file.size > 100 * 1024 * 1024) { showToast('الفيديو أكبر من 100 ميجا — قلل حجمه', false); return; }
    try {
      await saveVideoBlob(file);
      showToast('اترفع الفيديو ✅ هيظهر في المتجر دلوقتي');
    } catch {
      showToast('حصلت مشكلة في حفظ الفيديو (المساحة أو الحجم)', false);
    }
    refreshVideoStatus();
  });

  clearVideoBtn.addEventListener('click', async () => {
    try {
      await clearVideoBlob();
      showToast('اتحذف الفيديو المرفوع');
    } catch {
      showToast('حصلت مشكلة في الحذف', false);
    }
    refreshVideoStatus();
  });

  refreshVideoStatus();

  // ---------- الأوردرات الأخيرة من الشيت ----------
  function escHtml(t) {
    return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function fmtDate(d) {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return escHtml(d);
    return dt.toLocaleString('ar-EG', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  const isToday = (d) => {
    const dt = new Date(d);
    return !isNaN(dt.getTime()) && dt.toLocaleDateString('en-CA') === new Date().toLocaleDateString('en-CA');
  };
  const isYesterday = (d) => {
    const dt = new Date(d);
    const y = new Date(); y.setDate(y.getDate() - 1);
    return !isNaN(dt.getTime()) && dt.toLocaleDateString('en-CA') === y.toLocaleDateString('en-CA');
  };
  const dayKey = (d) => { const dt = new Date(d); return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-CA'); };

  let doneOrders = [];

  function orderDone(ref) { return doneOrders.includes(ref); }

  function renderChart(orders) {
    const wrap = document.getElementById('chartBars');
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i);
      days.push({ key: d.toLocaleDateString('en-CA'), label: d.toLocaleDateString('ar-EG', { weekday: 'short' }) });
    }
    const perDay = days.map(day => {
      const dayOrders = orders.filter(o => dayKey(o.date) === day.key);
      return { ...day, count: dayOrders.length, total: dayOrders.reduce((s, o) => s + (parseFloat(o.total) || 0), 0) };
    });
    const max = Math.max(1, ...perDay.map(d => d.count));
    wrap.innerHTML = perDay.map(d => `
      <div class="chart-col" title="${d.label}: ${d.count} أوردرات — ${d.total} ج.م">
        <div class="chart-bar-wrap">
          <div class="chart-bar" style="height:${Math.max(4, Math.round((d.count / max) * 100))}%"></div>
        </div>
        <span class="chart-day">${d.label}</span>
      </div>`).join('');
  }

  function renderRecent(orders) {
    const el = document.getElementById('dashRecent');
    const recent = orders.slice(0, 5);
    if (!recent.length) {
      el.innerHTML = '<div class="orders-empty">مفيش أوردرات لسه 🍃 أول ما يجي طلب هيظهر هنا</div>';
      return;
    }
    el.innerHTML = recent.map(o => {
      const done = orderDone(o.ref);
      const ph = fixPhone(o.phone);
      return `
        <div class="order-item${done ? ' done' : ''}">
          <div class="order-item-top">
            <b>${escHtml(o.ref || '—')} ${done ? '<span class="chip chip-done">تم التسليم</span>' : '<span class="chip chip-new">جديد</span>'}</b>
            <span>${fmtDate(o.date)}</span>
          </div>
          <div class="order-item-line"><i class="fa-solid fa-user"></i> ${escHtml(o.name || '—')}${ph ? ' • <span dir="ltr">' + escHtml(ph) + '</span>' : ''}</div>
          <div class="order-item-bottom">
            <span>${o.lines ? escHtml(o.lines).split('\n').slice(0, 2).join(' • ') : ''}</span>
            <b>${escHtml(o.total || '0')} ج.م</b>
          </div>
        </div>`;
    }).join('');
  }

  function setTrend(el, today, yesterday) {
    if (!el) return;
    if (!yesterday) { el.textContent = 'أول يوم ليك 👌'; el.className = 'stat-trend stat-new'; return; }
    const diff = today - yesterday;
    if (diff > 0) { el.textContent = `▲ ${diff} عن إمبارح`; el.className = 'stat-trend stat-up'; }
    else if (diff < 0) { el.textContent = `▼ ${Math.abs(diff)} عن إمبارح`; el.className = 'stat-trend stat-down'; }
    else { el.textContent = 'زي إمبارح'; el.className = 'stat-trend stat-flat'; }
  }

  function fillDashStats() {
    const d = new Date();
    document.getElementById('dashDate').textContent = d.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  function renderDash(orders) {
    const today = orders.filter(o => isToday(o.date));
    const yesterday = orders.filter(o => isYesterday(o.date));
    const todayTotal = today.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
    const yesterdayTotal = yesterday.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
    const pending = orders.filter(o => !orderDone(o.ref)).length;
    const dt = document.getElementById('dashToday'); if (dt) dt.textContent = today.length;
    const dTot = document.getElementById('dashTotal'); if (dTot) dTot.textContent = `${todayTotal} ج.م`;
    const dPen = document.getElementById('dashPending'); if (dPen) dPen.textContent = pending;
    setTrend(document.getElementById('dashTodayT'), today.length, yesterday.length);
    setTrend(document.getElementById('dashTotalT'), todayTotal, yesterdayTotal);
    renderChart(orders);
    renderRecent(orders);
  }

  async function loadOrders() {
    const s = getAdminStore();
    const url = (s.sheetUrl || '').trim();
    const key = (s.orderKey || '').trim() || DEFAULT_ORDER_KEY;

    const cache = getOrdersCache();
    if (cache && cache.orders.length) {
      const [doneRes] = await Promise.all([loadDoneOrders().catch(() => [])]);
      doneOrders = doneRes;
      renderDash(cache.orders);
    }

    try {
      // الأساسي: Firebase (الموقع نفسه) — الشيت احتياطي
      const cloudOrders = await fetchOrdersCloud(100);
      const [doneRes] = await Promise.all([loadDoneOrders().catch(() => [])]);
      doneOrders = doneRes;
      let orders;
      if (cloudOrders && cloudOrders.length) {
        orders = cloudOrders;
      } else if (url) {
        orders = await fetchOrders(url, key, 25000);
      } else {
        orders = cloudOrders || [];
      }
      saveOrdersCache(orders);
      renderDash(orders);
    } catch (err) {
      if (!cache || !cache.orders.length) {
        showToast('متعرفناش نقرا الأوردرات — راجع اتصال الإنترنت', false);
      }
    }
  }

  // ---------- رسائل العملاء ----------
  async function loadMessages() {
    const list = document.getElementById('messagesList');
    const btn = document.getElementById('msgsRefreshBtn');
    if (btn) btn.disabled = true;
    list.innerHTML = '<div class="orders-empty"><i class="fa-solid fa-spinner fa-spin"></i> جاري تحميل الرسايل...</div>';
    const msgs = await listMessages();
    if (btn) btn.disabled = false;
    const dashM = document.getElementById('dashMsgs');
    if (dashM) dashM.textContent = msgs.length;
    if (!msgs.length) {
      list.innerHTML = '<div class="orders-empty">مفيش رسايل لسه 📭 أول ما عميل يبعت من الموقع هتظهر هنا</div>';
      return;
    }
    list.innerHTML = msgs.map(m => `
      <div class="order-item${m.status !== 'new' ? ' done' : ''}">
        <div class="order-item-top">
          <b>${escHtml(m.name || 'بدون اسم')}</b>
          <span>${fmtDate(m.created)}</span>
        </div>
        ${m.phone ? `<div class="order-item-line"><i class="fa-solid fa-phone"></i> <span dir="ltr">${escHtml(m.phone)}</span></div>` : ''}
        <div class="order-item-lines">${escHtml(m.message).split('\n').map(l => `<div>${l}</div>`).join('')}</div>
        <button type="button" class="done-btn" data-msg-id="${escHtml(m.id)}">حذف الرسالة</button>
      </div>`).join('');
  }

  document.getElementById('messagesList').addEventListener('click', async (e) => {
    const btn = e.target.closest('.done-btn');
    if (!btn) return;
    const id = btn.dataset.msgId;
    const ok = await deleteMessage(id);
    showToast(ok ? 'اتحذفت الرسالة 🗑️' : 'متعرفناش نحذفها.. جرب تاني', ok);
    if (ok) loadMessages();
  });

  document.getElementById('msgsRefreshBtn').addEventListener('click', loadMessages);

  // ---------- الداشبورد: تمرير سلس للأقسام ----------
  fillDashStats();
  document.querySelectorAll('.dash-link, #dashOrdersBtn').forEach(el => {
    el.addEventListener('click', (e) => {
      const href = el.dataset.target || el.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // ---------- تعبئة الحقول الحالية ----------
  function fillSettings() {
    if (store.whatsapp) document.getElementById('sWhatsapp').value = store.whatsapp;
    if (store.phone) document.getElementById('sPhone').value = store.phone;
    document.getElementById('sDelivery').value = store.deliveryFee || 25;
    if (store.video) document.getElementById('sVideo').value = store.video;
    if (store.hours) document.getElementById('sHours').value = store.hours;
  }
  fillSettings();
});
