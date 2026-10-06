/* catalog.js — بيحمّل الأقسام والمنتجات والألوان والمقاسات والماركات مرة واحدة ويحفظهم.
   الفلترة والبحث والترتيب بيحصلوا في المتصفح على النسخة المحفوظة. */
(function (root) {
  'use strict';
  const App = root.App;
  const CACHE = 'cache:catalog';
  const COLLECTIONS = ['categories', 'products', 'colors', 'sizes', 'brands'];

  const C = App.catalog = { categories: [], products: [], colors: [], sizes: [], brands: [], loadedAt: 0 };

  function setData(data) {
    COLLECTIONS.forEach(k => { C[k] = data[k] || []; });
    C.categories.sort((a, b) => a.order - b.order);
    C.colors.sort((a, b) => a.order - b.order);
    C.sizes.sort((a, b) => a.order - b.order);
  }

  const cached = App.store.get(CACHE);
  if (cached) { setData(cached.data); C.loadedAt = cached.at; }

  async function fetchAll() {
    const results = await Promise.all(COLLECTIONS.map(c => App.db.list(c)));
    const data = {};
    COLLECTIONS.forEach((c, i) => { data[c] = results[i]; });
    // إخفاء القسم يشمل الفروع والمنتجات التابعة له.
    const byId = new Map(data.categories.map(c => [c.id,c]));
    const visible = id => {
      const seen = new Set();
      while (id) {
        const category = byId.get(id);
        if (!category || category.hidden || seen.has(id)) return false;
        seen.add(id); id = category.parentId;
      }
      return true;
    };
    data.products = data.products.filter(p => !p.hidden && visible(p.categoryId) && visible(p.subcategoryId));
    data.categories = data.categories.filter(c => visible(c.id));
    setData(data);
    C.loadedAt = Date.now();
    App.store.set(CACHE, { at: C.loadedAt, data });
    App.emit('catalog', C);
    return C;
  }

  C.load = async function () {
    const fresh = C.loadedAt && Date.now() - C.loadedAt < App.config.catalogCacheMs;
    if (fresh) return C;
    if (C.loadedAt) { fetchAll().catch(e => console.warn('catalog refresh', e)); return C; }
    return fetchAll();
  };
  C.refresh = fetchAll;

  /* ---------- أدوات القراءة ---------- */
  C.topCategories = () => C.categories.filter(c => !c.parentId);
  C.children = id => C.categories.filter(c => c.parentId === id);
  C.category = id => C.categories.find(c => c.id === id);
  C.color = id => C.colors.find(c => c.id === id);
  C.size = id => C.sizes.find(s => s.id === id);
  C.brand = id => C.brands.find(b => b.id === id);
  C.product = idOrSlug => C.products.find(p => p.id === idOrSlug || p.slug === idOrSlug);

  /* المتاح من variant = المخزون − المحجوز */
  C.available = v => Math.max(0, (Number(v.stock) || 0) - (Number(v.reserved) || 0));
  C.totalAvailable = p => (p.variants || []).reduce((s, v) => s + C.available(v), 0);
  C.inStock = p => C.totalAvailable(p) > 0;

  C.byNewest = list => list.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
})(typeof window !== 'undefined' ? window : globalThis);
