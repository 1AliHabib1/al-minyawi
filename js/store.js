/* ============================================================
   المنياوي | التخزين المحلي (بيانات المسؤول والمنتجات المضافة)
   ============================================================ */

const ADMIN_KEY = 'minyawi_admin_v1';
const DEFAULT_PASSWORD = 'minyawi123';

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
    token: (store.telegramToken || '').trim() || DEFAULT_TELEGRAM_BOT_TOKEN,
    chatId: (store.telegramChatId || '').trim() || DEFAULT_TELEGRAM_CHAT_ID,
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
    const res = await fetch(`${fbBase()}/imgs?pageSize=5000`);
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
    const res = await fetch(`${fbBase()}/state/store`);
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

async function cloudSave(store) {
  if (!DEFAULT_FIREBASE_PROJECT) return false;
  try {
    const clean = JSON.parse(JSON.stringify(store));
    const del = new Set(clean.deleted || []);
    const imgs = {};
    (clean.products || []).forEach(p => { if (!del.has(p.id) && p.img) { imgs[p.id] = p.img; delete p.img; } });
    Object.keys(clean.overrides || {}).forEach(id => {
      if (del.has(id)) { delete clean.overrides[id]; return; }
      const o = clean.overrides[id];
      if (o && o.img) { imgs[id] = o.img; delete o.img; }
    });
    const res = await fetch(`${fbBase()}/state/store?updateMask.fieldPaths=store`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { store: { stringValue: JSON.stringify(clean) } } }),
    });
    if (!res.ok) return false;
    await Promise.all(Object.entries(imgs).map(([id, img]) =>
      fetch(`${fbBase()}/imgs/${id}?updateMask.fieldPaths=img`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { img: { stringValue: img } } }),
      }).catch(() => {})));
    const prev = await cloudLoadImgs();
    if (prev) {
      const stale = Object.keys(prev).filter(id => !imgs[id]);
      await Promise.all(stale.map(id =>
        fetch(`${fbBase()}/imgs/${id}`, { method: 'DELETE' }).catch(() => {})));
    }
    return true;
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
