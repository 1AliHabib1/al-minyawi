/* ============================================================
   المنياوي | التخزين المحلي (بيانات المسؤول والمنتجات المضافة)
   ============================================================ */

const ADMIN_KEY = 'minyawi_admin_v1';
const DEFAULT_PASSWORD = 'minyawi123';

/* ---------- التوست (مشترك: اللوحة + صفحة الأوردرات) ---------- */
let _toastTimer;
function showToast(msg, ok = true) {
  const t = document.getElementById('toast');
  const m = document.getElementById('toastMsg');
  if (!t || !m) return;
  m.textContent = msg;
  t.querySelector('i').className = ok ? 'fa-solid fa-check' : 'fa-solid fa-triangle-exclamation';
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function defaultStore() {
  return { products: [], deleted: [], disabled: [], overrides: {}, whatsapp: '', phone: '', deliveryFee: 0, video: '', telegramToken: '', telegramChatId: '', sheetUrl: DEFAULT_SHEET_URL, orderKey: DEFAULT_ORDER_KEY, hours: DEFAULT_HOURS, passHash: '' };
}

function getAdminStore() {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (!raw) return defaultStore();
    const s = JSON.parse(raw);
    return {
      products: Array.isArray(s.products) ? s.products : [],
      deleted: Array.isArray(s.deleted) ? s.deleted : [],
      disabled: Array.isArray(s.disabled) ? s.disabled : [],
      overrides: s.overrides && typeof s.overrides === 'object' ? s.overrides : {},
      whatsapp: typeof s.whatsapp === 'string' ? s.whatsapp : '',
      phone: typeof s.phone === 'string' ? s.phone : '',
      deliveryFee: typeof s.deliveryFee === 'number' && s.deliveryFee >= 0 ? s.deliveryFee : 0,
      video: typeof s.video === 'string' ? s.video : '',
      telegramToken: typeof s.telegramToken === 'string' ? s.telegramToken : '',
      telegramChatId: typeof s.telegramChatId === 'string' ? s.telegramChatId : '',
      sheetUrl: (typeof s.sheetUrl === 'string' ? s.sheetUrl : '').trim() || DEFAULT_SHEET_URL,
      orderKey: (typeof s.orderKey === 'string' ? s.orderKey : '').trim() || DEFAULT_ORDER_KEY,
      hours: (typeof s.hours === 'string' && s.hours) ? s.hours : DEFAULT_HOURS,
      passHash: typeof s.passHash === 'string' ? s.passHash : '',
    };
  } catch {
    return defaultStore();
  }
}

function saveAdminStore(s) {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(s));
}

function buildProducts(store) {
  const deleted = store.deleted || [];
  const dis = store.disabled || [];
  const ov = store.overrides || {};
  const base = BASE_PRODUCTS
    .filter(p => !deleted.includes(p.id))
    .map(p => ({ ...(ov[p.id] ? { ...p, ...ov[p.id] } : p), disabled: dis.includes(p.id) }));
  const added = (store.products || []).map(p => ({ ...p, adminAdded: true, disabled: dis.includes(p.id) }));
  return [...base, ...added];
}

function getWhatsapp(store) {
  const num = (store.whatsapp || '').replace(/[^0-9]/g, '');
  return num || DEFAULT_WHATSAPP;
}

function getTelegramConfig(store) {
  return {
    token: (store.telegramToken || '').trim(),
    chatId: (store.telegramChatId || '').trim(),
  };
}

function telegramReady(tg) {
  return !!(tg && tg.token && tg.chatId);
}

function fetchWithTimeout(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

/* ============================================================
   تحميل الأوردرات بسرعة وموثوقية:
   - مهلة زمنية على كل طلب (مفيش انتظار للفشل)
   - نسخة محفوظة آخر مرة → تظهر فورًا، والتحديث في الخلفية
   ============================================================ */

const ORDERS_CACHE_KEY = 'minyawi_orders_cache_v1';

function getOrdersCache() {
  try {
    const raw = localStorage.getItem(ORDERS_CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (c && Array.isArray(c.orders) && typeof c.t === 'number') return c;
  } catch { }
  return null;
}

function saveOrdersCache(orders) {
  try { localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify({ t: Date.now(), orders })); } catch { }
}

function ordersAgeText(cache) {
  if (!cache) return '';
  const mins = Math.floor((Date.now() - cache.t) / 60000);
  if (mins < 1) return 'من ثانية';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  return `منذ ${Math.floor(mins / 60)} ساعة`;
}

async function fetchOrders(url, key, ms) {
  const res = await fetchWithTimeout(`${url}?k=${encodeURIComponent(key)}`, { cache: 'no-store' }, ms || 25000);
  if (!res.ok) throw new Error('http');
  const data = await res.json();
  if (!data || data.ok !== true) throw new Error(data && data.error === 'wrong_key' ? 'wrong_key' : 'bad');
  return data.orders || [];
}

async function sendTelegramMessage(tg, text) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const start = Date.now();
    const ok = await fetchWithTimeout(`https://api.telegram.org/bot${tg.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tg.chatId, text, disable_web_page_preview: true }),
    }, 10000).then(r => r.ok).catch(() => false);
    if (ok) return true;
    if (attempt === 0 && Date.now() - start >= 3000) break;
    await new Promise(r => setTimeout(r, 1500));
  }
  return false;
}

/* ============================================================
   إرسال الأوردرات إلى Google Sheets (عبر Google Apps Script)
   ============================================================ */

function sendToSheet(url, data) {
  if (!url) return Promise.resolve(false);
  const body = new URLSearchParams();
  Object.entries(data || {}).forEach(([k, v]) => body.append(k, v === undefined || v === null ? '' : String(v)));
  return fetchWithTimeout(url, { method: 'POST', body }, 10000).then(r => r.ok).catch(() => false);
}

/* ============================================================
   السحابة (Firebase Firestore) — مزامنة المنتجات والإعدادات
   ============================================================ */

function fbBase() {
  return `https://firestore.googleapis.com/v1/projects/${DEFAULT_FIREBASE_PROJECT}/databases/(default)/documents`;
}

async function cloudLoadImgs() {
  try {
    const res = await fetchWithTimeout(`${fbBase()}/imgs?pageSize=5000`, {}, 10000);
    if (!res.ok) return null;
    const list = await res.json();
    const out = {};
    (list.documents || []).forEach(d => {
      const id = d.name.split('/').pop();
      if (d.fields && d.fields.img && d.fields.img.stringValue) out[id] = d.fields.img.stringValue;
    });
    return out;
  } catch { return null; }
}

async function cloudLoad() {
  if (!DEFAULT_FIREBASE_PROJECT) return null;
  try {
    const res = await fetchWithTimeout(`${fbBase()}/state/store`, {}, 12000);
    if (!res.ok) return null;
    const doc = await res.json();
    const store = JSON.parse(doc.fields.store.stringValue || 'null');
    if (!store || typeof store !== 'object') return null;
    const imgs = await cloudLoadImgs();
    if (imgs) {
      (store.products || []).forEach(p => { if (imgs[p.id]) p.img = imgs[p.id]; });
      Object.keys(store.overrides || {}).forEach(id => {
        const o = store.overrides[id];
        if (o && o.img) { o.img = imgs[id]; } else if (o && imgs[id]) { o.img = imgs[id]; }
      });
    }
    return store;
  } catch { return null; }
}

// دمج بيانات السحابة في النسخة المحلية — القيم غير الفارغة من السحابة بس هي اللي تربح،
// عشان جهاز جديد (ذاكرته فاضية) لا يمسح نسخة محلية سليمة
async function hydrateStoreFromCloud() {
  try {
    const cloud = await cloudLoad();
    if (!cloud || typeof cloud !== 'object') return false;
    const s = getAdminStore();
    if (Array.isArray(cloud.products) && cloud.products.length) s.products = cloud.products;
    if (cloud.overrides && typeof cloud.overrides === 'object' && Object.keys(cloud.overrides).length) s.overrides = cloud.overrides;
    if (Array.isArray(cloud.deleted) && cloud.deleted.length) s.deleted = cloud.deleted;
    if (Array.isArray(cloud.disabled) && cloud.disabled.length) s.disabled = cloud.disabled;
    if (cloud.whatsapp) s.whatsapp = cloud.whatsapp;
    if (cloud.phone) s.phone = cloud.phone;
    if (typeof cloud.deliveryFee === 'number' && cloud.deliveryFee > 0) s.deliveryFee = cloud.deliveryFee;
    if (cloud.video) s.video = cloud.video;
    if (cloud.sheetUrl && cloud.sheetUrl !== DEFAULT_SHEET_URL) s.sheetUrl = cloud.sheetUrl;
    if (cloud.orderKey && cloud.orderKey !== DEFAULT_ORDER_KEY) s.orderKey = cloud.orderKey;
    if (cloud.hours && cloud.hours !== DEFAULT_HOURS) s.hours = cloud.hours;
    if (cloud.telegramToken) s.telegramToken = cloud.telegramToken;
    if (cloud.telegramChatId) s.telegramChatId = cloud.telegramChatId;
    if (cloud.passHash) s.passHash = cloud.passHash;
    saveAdminStore(s);
    // إصلاح ذاتي: الجهاز ده ليه تيليجرام شغال والسحابة فاضية (حصل مسح قبل كده)
    // → ندفع إعدادات الجهاز للسحابة عشان الأجهزة التانية (الموبايل) تشتغل بيها
    const local = getAdminStore();
    if (local.telegramToken && local.telegramChatId && !(cloud.telegramToken && cloud.telegramChatId)) {
      cloudSave(local).catch(() => {});
    }
    return true;
  } catch { return false; }
}

async function cloudSave(store, opts = {}) {
  if (!DEFAULT_FIREBASE_PROJECT) return false;
  try {
    const clean = JSON.parse(JSON.stringify(store));
    // ===== حماية من المسح: جهاز جديد ذاكرته فاضية لا يمسح بيانات السحابة =====
    const existing = await cloudLoad();
    if (existing && typeof existing === 'object') {
      if (!Array.isArray(clean.products) || !clean.products.length) clean.products = Array.isArray(existing.products) ? existing.products : [];
      clean.overrides = { ...(existing.overrides || {}), ...(clean.overrides || {}) };
      // دمج + استرجاع صريح: المنتجات اللي اترجعت (أو اترجّعت للتشغيل) تنتشر للسحابة فعليًا
      const restoreIds = opts.restoreIds || [];
      clean.deleted = [...new Set([...(existing.deleted || []), ...(clean.deleted || [])])].filter(x => !restoreIds.includes(x));
      clean.disabled = [...new Set([...(existing.disabled || []), ...(clean.disabled || [])])].filter(x => !restoreIds.includes(x));
      if (!clean.whatsapp) clean.whatsapp = existing.whatsapp || '';
      if (!clean.phone) clean.phone = existing.phone || '';
      if (!clean.deliveryFee && existing.deliveryFee) clean.deliveryFee = existing.deliveryFee;
      if (!clean.video) clean.video = existing.video || '';
      if (!clean.telegramToken) clean.telegramToken = existing.telegramToken || '';
      if (!clean.telegramChatId) clean.telegramChatId = existing.telegramChatId || '';
      if (!clean.passHash) clean.passHash = existing.passHash || '';
      if ((!clean.hours || clean.hours === DEFAULT_HOURS) && existing.hours && existing.hours !== DEFAULT_HOURS) clean.hours = existing.hours;
      if ((!clean.sheetUrl || clean.sheetUrl === DEFAULT_SHEET_URL) && existing.sheetUrl && existing.sheetUrl !== DEFAULT_SHEET_URL) clean.sheetUrl = existing.sheetUrl;
      if ((!clean.orderKey || clean.orderKey === DEFAULT_ORDER_KEY) && existing.orderKey && existing.orderKey !== DEFAULT_ORDER_KEY) clean.orderKey = existing.orderKey;
    }
    const del = new Set(clean.deleted || []);
    const imgs = {};
    (clean.products || []).forEach(p => { if (!del.has(p.id) && p.img) { imgs[p.id] = p.img; delete p.img; } });
    Object.keys(clean.overrides || {}).forEach(id => {
      if (del.has(id)) { delete clean.overrides[id]; return; }
      const o = clean.overrides[id];
      if (o && o.img) { imgs[id] = o.img; delete o.img; }
    });
    const res = await fetchWithTimeout(`${fbBase()}/state/store?updateMask.fieldPaths=store`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { store: { stringValue: JSON.stringify(clean) } } }),
    }, 15000);
    if (!res.ok) return false;
    await Promise.all(Object.entries(imgs).map(([id, img]) =>
      fetchWithTimeout(`${fbBase()}/imgs/${id}?updateMask.fieldPaths=img`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { img: { stringValue: img } } }),
      }, 10000).catch(() => {})));
    const prev = await cloudLoadImgs();
    if (prev) {
      const stale = Object.keys(prev).filter(id => !imgs[id]);
      await Promise.all(stale.map(id =>
        fetch(`${fbBase()}/imgs/${id}`, { method: 'DELETE' }).catch(() => {})));
    }
    return true;
  } catch { return false; }
}

async function loadDoneOrders() {
  if (!DEFAULT_FIREBASE_PROJECT) return [];
  try {
    const res = await fetchWithTimeout(`${fbBase()}/state/doneOrders`, {}, 10000);
    if (!res.ok) return [];
    const doc = await res.json();
    const arr = JSON.parse((doc.fields && doc.fields.data && doc.fields.data.stringValue) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

async function saveDoneOrders(refs) {
  if (!DEFAULT_FIREBASE_PROJECT) return false;
  try {
    const res = await fetchWithTimeout(`${fbBase()}/state/doneOrders?updateMask.fieldPaths=data`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { data: { stringValue: JSON.stringify(refs) } } }),
    }, 15000);
    return res.ok;
  } catch { return false; }
}

async function loadPreparingOrders() {
  if (!DEFAULT_FIREBASE_PROJECT) return [];
  try {
    const res = await fetchWithTimeout(`${fbBase()}/state/preparingOrders`, {}, 10000);
    if (!res.ok) return [];
    const doc = await res.json();
    const arr = JSON.parse((doc.fields && doc.fields.data && doc.fields.data.stringValue) || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

async function savePreparingOrders(refs) {
  if (!DEFAULT_FIREBASE_PROJECT) return false;
  try {
    const res = await fetchWithTimeout(`${fbBase()}/state/preparingOrders?updateMask.fieldPaths=data`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { data: { stringValue: JSON.stringify(refs) } } }),
    }, 15000);
    return res.ok;
  } catch { return false; }
}

/* ============================================================
   الأوردرات في Firebase — المصدر الأساسي (الموقع نفسه)
   ============================================================ */

function fixPhone(p) {
  const digits = String(p || '').replace(/[^0-9]/g, '');
  return /^1\d{9}$/.test(digits) ? '0' + digits : String(p || '');
}

async function saveOrderToCloud(order) {
  if (!DEFAULT_FIREBASE_PROJECT) return false;
  try {
    const t = parseInt(order.t, 10) || Date.now();
    const res = await fetchWithTimeout(`${fbBase()}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: {
        ref: { stringValue: String(order.ref || '') },
        name: { stringValue: String(order.name || '') },
        phone: { stringValue: fixPhone(order.phone) },
        address: { stringValue: String(order.address || '') },
        notes: { stringValue: String(order.notes || '') },
        lines: { stringValue: String(order.lines || '') },
        delivery: { stringValue: String(order.delivery || '') },
        total: { stringValue: String(order.total || '') },
        t: { integerValue: t },
        date: { timestampValue: new Date(t).toISOString() },
      } }),
    }, 10000);
    return res.ok;
  } catch { return false; }
}

// null = فشل الاتصال، [] = مفيش أوردرات (بعد الترحيل)
async function fetchOrdersCloud(limit = 100) {
  if (!DEFAULT_FIREBASE_PROJECT) return null;
  try {
    const res = await fetchWithTimeout(`${fbBase()}/orders?pageSize=${limit}&orderBy=${encodeURIComponent('t desc')}`, {}, 12000);
    if (!res.ok) return null;
    const data = await res.json();
    const out = [];
    (data.documents || []).forEach(d => {
      const f = d.fields || {};
      const s = (k) => (f[k] && f[k].stringValue) || '';
      out.push({
        ref: s('ref'),
        name: s('name'),
        phone: fixPhone(s('phone')),
        address: s('address'),
        notes: s('notes'),
        lines: s('lines'),
        delivery: s('delivery'),
        total: s('total'),
        date: (f.date && f.date.timestampValue) || (f.t && f.t.integerValue ? new Date(parseInt(f.t.integerValue, 10)).toISOString() : ''),
      });
    });
    return out;
  } catch { return null; }
}

// ترحيل الأوردرات القديمة من الشيت لـ Firebase (مرة واحدة)
async function migrateSheetOrders(url, key, onProgress) {
  try {
    const orders = await fetchOrders(url, key, 25000);
    const existing = await fetchOrdersCloud(5000);
    const known = new Set((existing || []).map(o => o.ref));
    let ok = 0, fail = 0, skip = 0;
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      if (known.has(o.ref)) { skip++; if (onProgress) onProgress(i + 1, orders.length); continue; }
      const t = Date.parse(o.date);
      const good = await saveOrderToCloud({ ...o, t: isNaN(t) ? Date.now() : t, date: o.date || new Date().toISOString() });
      if (good) ok++; else fail++;
      if (onProgress) onProgress(i + 1, orders.length);
    }
    return { ok, fail, skip, total: orders.length };
  } catch (e) {
    return { error: e && e.message ? e.message : 'fail' };
  }
}

async function saveContactMessage({ name, phone, message }) {
  if (!DEFAULT_FIREBASE_PROJECT) return false;
  try {
    const res = await fetch(`${fbBase()}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: {
        name: { stringValue: String(name || '') },
        phone: { stringValue: String(phone || '') },
        message: { stringValue: String(message || '') },
        status: { stringValue: 'new' },
        created: { timestampValue: new Date().toISOString() },
      } }),
    });
    return res.ok;
  } catch { return false; }
}

async function listMessages() {
  if (!DEFAULT_FIREBASE_PROJECT) return [];
  try {
    const res = await fetchWithTimeout(`${fbBase()}/messages?pageSize=200&orderBy=created%20desc`, {}, 10000);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.documents || []).map(d => {
      const f = d.fields || {};
      return {
        id: (d.name || '').split('/').pop(),
        name: (f.name && f.name.stringValue) || '',
        phone: (f.phone && f.phone.stringValue) || '',
        message: (f.message && f.message.stringValue) || '',
        status: (f.status && f.status.stringValue) || 'new',
        created: (f.created && f.created.timestampValue) || '',
      };
    });
  } catch { return []; }
}

async function deleteMessage(id) {
  if (!DEFAULT_FIREBASE_PROJECT) return false;
  try {
    const res = await fetchWithTimeout(`${fbBase()}/messages/${encodeURIComponent(id)}`, { method: 'DELETE' }, 10000);
    return res.ok || res.status === 404;
  } catch { return false; }
}

async function sha256Hex(text) {
  if (crypto && crypto.subtle) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    } catch { }
  }
  let h1 = 5381, h2 = 52711;
  const t = 'المنياوي#' + text;
  for (let i = 0; i < t.length; i++) {
    h1 = (h1 * 33) ^ t.charCodeAt(i);
    h2 = (h2 * 31) ^ t.charCodeAt(i);
  }
  return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}

function formatPhone(phone) {
  const n = (phone || '').replace(/[^0-9]/g, '');
  if (n.length === 11 && n.startsWith('01')) return '0' + n.slice(1);
  return phone || '';
}

/* ============================================================
   تخزين فيديو المحل المرفوع (IndexedDB — داخل الجهاز نفسه)
   ============================================================ */

const VIDEO_DB = 'minyawi_video';
const VIDEO_STORE = 'files';
const VIDEO_KEY = 'shop_video';

function openVideoDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VIDEO_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(VIDEO_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function saveVideoBlob(blob) {
  return openVideoDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE, 'readwrite');
    tx.objectStore(VIDEO_STORE).put(blob, VIDEO_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}

function getVideoBlob() {
  return openVideoDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE, 'readonly');
    const req = tx.objectStore(VIDEO_STORE).get(VIDEO_KEY);
    req.onsuccess = () => { db.close(); resolve(req.result || null); };
    req.onerror = () => { db.close(); reject(req.error); };
  }));
}

function clearVideoBlob() {
  return openVideoDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEO_STORE, 'readwrite');
    tx.objectStore(VIDEO_STORE).delete(VIDEO_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}
