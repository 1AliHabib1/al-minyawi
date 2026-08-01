/* ============================================================
   المنياوي | منطق لوحة التحكم
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const store = getAdminStore();

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

  const EMOJIS = ['🍅','🥒','🥔','🧅','🫑','🌶️','🍆','🥕','🥦','🫘','🫛','🍋','🧄','🍠','🌰','🥬','🌿','🍃','🌱','🍌','🍎','🍏','🍊','🍇','🍐','🍍','🥝','🍑','🥭','🍓','🍉','🍈','🫐'];

  let selectedEmoji = '';
  let listSearch = '';

  // ---------- التوست ----------
  let toastTimer;
  function showToast(msg, ok = true) {
    toastMsg.textContent = msg;
    toast.querySelector('i').className = ok ? 'fa-solid fa-check' : 'fa-solid fa-triangle-exclamation';
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

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

  // ---------- الدخول ----------
  if (!store.passHash) loginHint.hidden = false;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const expected = store.passHash || await sha256Hex(DEFAULT_PASSWORD);
    const hash = await sha256Hex(loginPass.value);
    if (hash === expected) {
      sessionStorage.setItem('minyawi_admin_auth', '1');
      loginError.hidden = true;
      loginPass.value = '';
      openPanel();
    } else {
      loginError.hidden = false;
      loginPass.value = '';
    }
  });

  function openPanel() {
    loginScreen.style.display = 'none';
    panel.hidden = false;
    renderAdminList();
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
          <div class="admin-item-img" style="--item-bg:${p.bg || '#f0fdf4'}">${p.emoji}</div>
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
          <div class="admin-item-img" style="--item-bg:${p.bg || '#f0fdf4'}">${p.emoji}</div>
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

    saveAdminStore(store);
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
    renderAdminList();
    showToast(`تم حذف "${p.name}" من المتجر`);
  };

  window.restoreProduct = (id) => {
    store.deleted = store.deleted.filter(x => x !== id);
    saveAdminStore(store);
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
      renderAdminList();
      showToast(`تم إرجاع "${p.name}" للمتجر ✅`);
    } else {
      store.disabled.push(id);
      saveAdminStore(store);
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
    saveAdminStore(store);
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

  // ---------- تعبئة الحقول الحالية ----------
  if (store.whatsapp) document.getElementById('sWhatsapp').value = store.whatsapp;
  if (store.phone) document.getElementById('sPhone').value = store.phone;
  document.getElementById('sDelivery').value = store.deliveryFee || 25;
  if (store.video) document.getElementById('sVideo').value = store.video;
});
