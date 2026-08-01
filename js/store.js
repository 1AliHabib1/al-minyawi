/* ============================================================
   المنياوي | التخزين المحلي (بيانات المسؤول والمنتجات المضافة)
   ============================================================ */

const ADMIN_KEY = 'minyawi_admin_v1';
const DEFAULT_PASSWORD = 'minyawi123';

function defaultStore() {
  return { products: [], deleted: [], disabled: [], overrides: {}, whatsapp: '', phone: '', deliveryFee: 0, video: '', passHash: '' };
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
