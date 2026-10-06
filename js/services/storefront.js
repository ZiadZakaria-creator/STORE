/* منطق عرض الكتالوج: الفلاتر كلها بتتطبق على نفس التركيبة. */
(function (root) {
  'use strict';
  const App = root.App, C = App.catalog;
  const normalize = value => String(value || '').normalize('NFKD').replace(/[\u064B-\u065F\u0670\u0300-\u036f]/g, '').replace(/[أإآ]/g, 'ا').toLowerCase().trim();
  C.price = (p, v) => App.money.round((p.salePrice != null && p.salePrice < p.price ? p.salePrice : p.price) + Number(v?.priceDelta || 0));
  C.priceRange = p => {
    const values = (p.variants?.length ? p.variants : [null]).map(v => C.price(p, v));
    return { min: Math.min(...values), max: Math.max(...values) };
  };
  C.categoryPath = id => {
    const path = [], seen = new Set();
    let category = C.category(id);
    while (category && !seen.has(category.id)) { path.unshift(category); seen.add(category.id); category = C.category(category.parentId); }
    return path;
  };
  C.inCategory = (p, id) => [p.categoryId, p.subcategoryId].filter(Boolean).some(c => C.categoryPath(c).some(row => row.id === id));
  const time = value => {
    if (typeof value === 'string') return Date.parse(value) || 0;
    return value?.seconds ? value.seconds * 1000 : 0;
  };
  C.byNewest = list => list.slice().sort((a, b) => time(b.createdAt) - time(a.createdAt) || String(a.id).localeCompare(String(b.id)));
  C.query = (filters = {}, source = C.products) => {
    const q = normalize(filters.q), category = filters.cat && C.categories.find(c => c.id === filters.cat || c.slug === filters.cat);
    const bound = value => value == null || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0 ? null : Number(value);
    const min = bound(filters.min), max = bound(filters.max);
    let rows = source.filter(p => {
      if (p.hidden || (filters.cat && (!category || !C.inCategory(p, category.id)))) return false;
      if (filters.brand && p.brandId !== filters.brand) return false;
      if (filters.sale && !(p.salePrice != null && p.salePrice < p.price)) return false;
      if (filters.featured && !p.featured) return false;
      if (q && !q.split(/\s+/).every(term => normalize([p.name?.ar,p.name?.en,p.sku,p.description?.ar,p.description?.en,C.brand(p.brandId)?.name].join(' ')).includes(term))) return false;
      return (p.variants || []).some(v => (!filters.color || v.color === filters.color)
        && (!filters.size || v.size === filters.size)
        && (!filters.stock || C.available(v) > 0)
        && (min == null || C.price(p,v) >= min) && (max == null || C.price(p,v) <= max));
    });
    if (filters.sort === 'price-asc' || filters.sort === 'price-desc') rows.sort((a,b) => (C.priceRange(a).min - C.priceRange(b).min) * (filters.sort === 'price-desc' ? -1 : 1) || String(a.id).localeCompare(String(b.id)));
    else if (filters.sort === 'name') rows.sort((a,b) => App.tx(a.name).localeCompare(App.tx(b.name), App.i18n.lang));
    else rows = C.byNewest(rows);
    return rows;
  };
  C.paginate = (rows, page = 1, size = 12) => {
    size = Math.max(1, Math.min(100, Math.floor(Number(size)) || 12));
    const pages = Math.max(1, Math.ceil(rows.length / size));
    page = Math.max(1, Math.min(pages, Math.floor(Number(page)) || 1));
    return { items: rows.slice((page-1)*size, page*size), page, pages, total: rows.length };
  };
})(typeof window !== 'undefined' ? window : globalThis);
