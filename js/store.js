/* ============================================================
   المنياوي | التخزين المحلي (بيانات المسؤول والمنتجات المضافة)
   ============================================================ */

const ADMIN_KEY = 'minyawi_admin_v1';
const DEFAULT_PASSWORD = 'minyawi123';

function defaultStore() {
  return { products: [], deleted: [], overrides: {}, whatsapp: '', phone: '', passHash: '' };
}

function getAdminStore() {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (!raw) return defaultStore();
    const s = JSON.parse(raw);
    return {
      products: Array.isArray(s.products) ? s.products : [],
      deleted: Array.isArray(s.deleted) ? s.deleted : [],
      overrides: s.overrides && typeof s.overrides === 'object' ? s.overrides : {},
      whatsapp: typeof s.whatsapp === 'string' ? s.whatsapp : '',
      phone: typeof s.phone === 'string' ? s.phone : '',
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
  const ov = store.overrides || {};
  const base = BASE_PRODUCTS
    .filter(p => !deleted.includes(p.id))
    .map(p => (ov[p.id] ? { ...p, ...ov[p.id] } : p));
  const added = (store.products || []).map(p => ({ ...p, adminAdded: true }));
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
