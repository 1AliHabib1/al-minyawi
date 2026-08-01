/* ============================================================
   المنياوي | بيانات المنتجات الأساسية
   ============================================================ */

const BASE_PRODUCTS = [
  // ---------- خضار ----------
  { id: 'v1',  name: 'طماطم بلدي',      emoji: '🍅', cat: 'veg',    unit: 'كيلو',   price: 12,  bg: '#fee2e2' },
  { id: 'v2',  name: 'خيار صوبات',       emoji: '🥒', cat: 'veg',    unit: 'كيلو',   price: 14,  oldPrice: 0,  bg: '#dcfce7' },
  { id: 'v3',  name: 'بطاطس',            emoji: '🥔', cat: 'veg',    unit: 'كيلو',   price: 18,  oldPrice: 0,  bg: '#fef3c7' },
  { id: 'v4',  name: 'بصل أبيض',         emoji: '🧅', cat: 'veg',    unit: 'كيلو',   price: 16,  oldPrice: 0,  bg: '#fef9c3' },
  { id: 'v5',  name: 'بصل أحمر',         emoji: '🧅', cat: 'veg',    unit: 'كيلو',   price: 20,  oldPrice: 0,  bg: '#fee2e2', badge: 'new' },
  { id: 'v6',  name: 'فلفل ألوان',       emoji: '🫑', cat: 'veg',    unit: 'كيلو',   price: 35,  bg: '#ffedd5' },
  { id: 'v7',  name: 'فلفل حار',         emoji: '🌶️', cat: 'veg',    unit: 'كيلو',   price: 22,  oldPrice: 0,  bg: '#fee2e2' },
  { id: 'v8',  name: 'كوسة',             emoji: '🥒', cat: 'veg',    unit: 'كيلو',   price: 15,  oldPrice: 0,  bg: '#ecfccb' },
  { id: 'v9',  name: 'باذنجان رومي',     emoji: '🍆', cat: 'veg',    unit: 'كيلو',   price: 16,  oldPrice: 0,  bg: '#f3e8ff' },
  { id: 'v10', name: 'جزر',              emoji: '🥕', cat: 'veg',    unit: 'كيلو',   price: 13,  oldPrice: 0,  bg: '#ffedd5' },
  { id: 'v11', name: 'قرنبيط',           emoji: '🥦', cat: 'veg',    unit: 'واحدة',  price: 25,  oldPrice: 0,  bg: '#fef9c3' },
  { id: 'v12', name: 'بروكلي',           emoji: '🥦', cat: 'veg',    unit: 'واحدة',  price: 30,  oldPrice: 0,  bg: '#dcfce7' },
  { id: 'v13', name: 'فاصوليا خضرا',     emoji: '🫘', cat: 'veg',    unit: 'كيلو',   price: 28,  bg: '#dcfce7' },
  { id: 'v14', name: 'بسلة',             emoji: '🫛', cat: 'veg',    unit: 'كيلو',   price: 32,  oldPrice: 0,  bg: '#dcfce7' },
  { id: 'v15', name: 'ليمون بلدي',       emoji: '🍋', cat: 'veg',    unit: 'كيلو',   price: 26,  oldPrice: 0,  bg: '#fef9c3' },
  { id: 'v16', name: 'ثوم بلدي',         emoji: '🧄', cat: 'veg',    unit: 'كيلو',   price: 55,  bg: '#fef3c7' },
  { id: 'v17', name: 'بطاطا',            emoji: '🍠', cat: 'veg',    unit: 'كيلو',   price: 15,  oldPrice: 0,  bg: '#fce7f3' },
  { id: 'v18', name: 'قلقاس',            emoji: '🌰', cat: 'veg',    unit: 'كيلو',   price: 20,  oldPrice: 0,  bg: '#fef3c7' },
  { id: 'v19', name: 'طماطم شيري',       emoji: '🍅', cat: 'veg',    unit: 'علبة',   price: 30,  oldPrice: 0,  bg: '#fee2e2', badge: 'new' },

  // ---------- خضار ورقية ----------
  { id: 'l1', name: 'خس بلدي',           emoji: '🥬', cat: 'veg',  unit: 'واحدة',  price: 10,  oldPrice: 0,  bg: '#dcfce7' },
  { id: 'l2', name: 'جرجير',             emoji: '🌿', cat: 'veg',  unit: 'حزمة',   price: 5,   oldPrice: 0,  bg: '#dcfce7' },
  { id: 'l3', name: 'سبانخ',             emoji: '🥬', cat: 'veg',  unit: 'حزمة',   price: 8,   oldPrice: 0,  bg: '#dcfce7' },
  { id: 'l4', name: 'بقدونس',            emoji: '🌿', cat: 'veg',  unit: 'حزمة',   price: 4,   oldPrice: 0,  bg: '#dcfce7' },
  { id: 'l5', name: 'كزبرة',             emoji: '🌿', cat: 'veg',  unit: 'حزمة',   price: 4,   oldPrice: 0,  bg: '#dcfce7' },
  { id: 'l6', name: 'شبت',               emoji: '🌿', cat: 'veg',  unit: 'حزمة',   price: 4,   oldPrice: 0,  bg: '#dcfce7' },
  { id: 'l7', name: 'نعناع',             emoji: '🍃', cat: 'veg',  unit: 'حزمة',   price: 5,   oldPrice: 0,  bg: '#ccfbf1' },
  { id: 'l8', name: 'ريحان',             emoji: '🌱', cat: 'veg',  unit: 'حزمة',   price: 6,   oldPrice: 0,  bg: '#ccfbf1', badge: 'new' },
  { id: 'l9', name: 'كرنب',              emoji: '🥬', cat: 'veg',  unit: 'واحدة',  price: 15,  oldPrice: 0,  bg: '#dcfce7' },
  { id: 'l10', name: 'ملوخية طازة',      emoji: '🌿', cat: 'veg',  unit: 'ربطة',   price: 10,  bg: '#dcfce7' },
  { id: 'l11', name: 'كرفس',             emoji: '🥬', cat: 'veg',  unit: 'ربطة',   price: 8,   oldPrice: 0,  bg: '#dcfce7' },
  { id: 'l12', name: 'كرنب أحمر',        emoji: '🥬', cat: 'veg',  unit: 'واحدة',  price: 18,  oldPrice: 0,  bg: '#fce7f3', badge: 'new' },

  // ---------- فاكهة ----------
  { id: 'f1',  name: 'موز بلدي',         emoji: '🍌', cat: 'fruit',  unit: 'كيلو',   price: 28,  oldPrice: 0,  bg: '#fef9c3' },
  { id: 'f2',  name: 'تفاح أحمر',        emoji: '🍎', cat: 'fruit',  unit: 'كيلو',   price: 45,  oldPrice: 0,  bg: '#fee2e2' },
  { id: 'f3',  name: 'تفاح أخضر',        emoji: '🍏', cat: 'fruit',  unit: 'كيلو',   price: 48,  oldPrice: 0,  bg: '#dcfce7' },
  { id: 'f4',  name: 'برتقال بلدي',      emoji: '🍊', cat: 'fruit',  unit: 'كيلو',   price: 15,  bg: '#ffedd5' },
  { id: 'f5',  name: 'يوسفي',            emoji: '🍊', cat: 'fruit',  unit: 'كيلو',   price: 18,  oldPrice: 0,  bg: '#ffedd5' },
  { id: 'f6',  name: 'عنب أسود',         emoji: '🍇', cat: 'fruit',  unit: 'كيلو',   price: 40,  oldPrice: 0,  bg: '#f3e8ff' },
  { id: 'f7',  name: 'عنب بناتي',        emoji: '🍇', cat: 'fruit',  unit: 'كيلو',   price: 35,  oldPrice: 0,  bg: '#f3e8ff' },
  { id: 'f8',  name: 'جوافة',            emoji: '🍐', cat: 'fruit',  unit: 'كيلو',   price: 22,  oldPrice: 0,  bg: '#fef9c3' },
  { id: 'f9',  name: 'كمثرى',            emoji: '🍐', cat: 'fruit',  unit: 'كيلو',   price: 38,  oldPrice: 0,  bg: '#fef9c3', badge: 'new' },
  { id: 'f10', name: 'رمان',             emoji: '🍎', cat: 'fruit',  unit: 'كيلو',   price: 25,  oldPrice: 0,  bg: '#fee2e2' },
  { id: 'f11', name: 'أناناس',           emoji: '🍍', cat: 'fruit',  unit: 'واحدة',  price: 60,  oldPrice: 0,  bg: '#fef9c3' },
  { id: 'f12', name: 'كيوي',             emoji: '🥝', cat: 'fruit',  unit: 'كيلو',   price: 50,  oldPrice: 0,  bg: '#dcfce7' },
  { id: 'f13', name: 'ليمون نوتي',       emoji: '🍋', cat: 'fruit',  unit: 'كيلو',   price: 30,  oldPrice: 0,  bg: '#fef9c3' },
  { id: 'f14', name: 'خوخ',              emoji: '🍑', cat: 'fruit',  unit: 'كيلو',   price: 32,  oldPrice: 0,  bg: '#fee2e2' },

  // ---------- فاكهة الموسم ----------
  { id: 's1', name: 'مانجو عويس',        emoji: '🥭', cat: 'fruit', unit: 'كيلو', price: 55, bg: '#fef3c7' },
  { id: 's2', name: 'مانجو زبدية',       emoji: '🥭', cat: 'fruit', unit: 'كيلو', price: 45, oldPrice: 0,  bg: '#fef3c7' },
  { id: 's3', name: 'فراولة',            emoji: '🍓', cat: 'fruit', unit: 'كيلو', price: 30, bg: '#fee2e2' },
  { id: 's4', name: 'بطيخ',              emoji: '🍉', cat: 'fruit', unit: 'واحدة', price: 80, oldPrice: 0,  bg: '#dcfce7' },
  { id: 's5', name: 'شمام',              emoji: '🍈', cat: 'fruit', unit: 'واحدة', price: 35, oldPrice: 0,  bg: '#fef9c3' },
  { id: 's6', name: 'مشمش',              emoji: '🍑', cat: 'fruit', unit: 'كيلو', price: 40, oldPrice: 0,  bg: '#fee2e2', badge: 'new' },
  { id: 's7', name: 'توت أسود',          emoji: '🫐', cat: 'fruit', unit: 'علبة', price: 25, oldPrice: 0,  bg: '#f3e8ff', badge: 'new' },
  { id: 's8', name: 'تين',               emoji: '🟣', cat: 'fruit', unit: 'كيلو', price: 30, oldPrice: 0,  bg: '#f3e8ff' },
  { id: 's9', name: 'نكتارين',           emoji: '🍑', cat: 'fruit', unit: 'كيلو', price: 42, oldPrice: 0,  bg: '#fee2e2' },
  { id: 's10', name: 'كانتلوب',          emoji: '🍈', cat: 'fruit', unit: 'واحدة', price: 30, oldPrice: 0,  bg: '#fef9c3' },
];

const CATEGORY_LABELS = {
  veg: 'خضار',
  leafy: 'خضار ورقية',
  fruit: 'فاكهة',
  seasonal: 'فاكهة الموسم',
};

const DEFAULT_WHATSAPP = '201030809915';
const DEFAULT_PHONE = '01030809915';
const DEFAULT_TELEGRAM_BOT_TOKEN = '';
const DEFAULT_TELEGRAM_CHAT_ID = '';
