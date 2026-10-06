/* إدارة الكتالوج: الكتابات المتزامنة بتراجع إصدار مشترك قبل الحفظ. */
(function (root) {
  'use strict';
  const App = root.App;
  const collections = ['products', 'categories', 'brands', 'colors', 'sizes'];
  const fail = message => { throw new Error(message); };
  const text = (value, max = 120) => String(value || '').trim().slice(0, max);
  const number = (value, integer = false) => {
    if (value === '' || value == null || !Number.isFinite(Number(value)) || Number(value) < 0 || (integer && !Number.isInteger(Number(value)))) fail('اكتب رقم صحيح غير سالب.');
    return Number(value);
  };
  const plain = row => { const out = App.clone(row); delete out.id; return out; };
  const requireAdmin = perm => {
    if (App.auth.admin?.role !== 'super_admin' || !App.can(perm)) fail('العملية دي للمدير العام بس.');
  };
  async function load() {
    const rows = await Promise.all(collections.map(c => App.db.list(c)));
    return Object.fromEntries(collections.map((c, i) => [c, rows[i]]));
  }
  async function change(perm, build) {
    requireAdmin(perm);
    for (let attempt = 0; attempt < 4; attempt++) {
      const state = await App.db.get('catalogControl', 'main');
      const data = await load();
      const operation = build(data);
      try {
        await App.db.tx(async t => {
          const current = await t.get('catalogControl', 'main');
          if ((current?.revision || 0) !== (state?.revision || 0)) fail('CATALOG_RETRY');
          t.set('catalogControl', 'main', { revision: (current?.revision || 0) + 1, updatedAt: App.db.now() });
          for (const w of operation.writes) {
            if (w.remove) t.remove(w.collection, w.id);
            else t.set(w.collection, w.id, w.data);
          }
          for (const log of operation.movements || []) t.set('inventoryLogs', App.randomId(), { ...log, by: App.auth.user.uid, at: App.db.now() });
          await App.audit.log(operation.audit, t);
        });
        await App.catalog.refresh();
        App.emit('inventory');
        return operation.result;
      } catch (e) { if (e.message !== 'CATALOG_RETRY' || attempt === 3) throw e; }
    }
  }
  function checkRevision(old, expected) {
    if (old && (old.revision || 0) !== (expected || 0)) fail('البيانات اتغيرت في نافذة تانية. افتح التعديل من جديد.');
  }
  function normalizeProduct(input, old, data) {
    const p = { ...old, ...App.clone(input) };
    delete p.id;
    p.name = { ar: text(input.name?.ar), en: text(input.name?.en) };
    if (!p.name.ar) fail('اسم المنتج بالعربي مطلوب.');
    p.slug = text(input.slug, 80); p.sku = text(input.sku, 60).toUpperCase();
    if (!App.validate.slug(p.slug) || !/^[A-Z0-9_-]{2,60}$/.test(p.sku)) fail('اكتب رابط إنجليزي وكود منتج صحيح.');
    p.description = { ar: text(input.description?.ar, 4000), en: text(input.description?.en, 4000) };
    const category = data.categories.find(c => c.id === p.categoryId);
    const sub = p.subcategoryId && data.categories.find(c => c.id === p.subcategoryId);
    if (!category || (p.subcategoryId && (!sub || sub.parentId !== category.id))) fail('اختار قسم وقسم فرعي تابع ليه.');
    if (p.brandId && !data.brands.some(b => b.id === p.brandId)) fail('الماركة مش موجودة.');
    p.brandId = p.brandId || ''; p.subcategoryId = p.subcategoryId || '';
    p.price = number(input.price); p.salePrice = input.salePrice === '' || input.salePrice == null ? null : number(input.salePrice);
    if (p.price <= 0 || p.price > 1000000 || p.salePrice !== null && (p.salePrice <= 0 || p.salePrice >= p.price)) fail('سعر المنتج لازم يكون موجب، وسعر العرض أقل منه.');
    p.lowStockThreshold = input.lowStockThreshold === '' || input.lowStockThreshold == null ? null : number(input.lowStockThreshold, true);
    p.images = Array.isArray(input.images) ? input.images.filter(Boolean) : [];
    if (!p.images.length || p.images.length > 8 || p.images.some(r => !/^(fs:[A-Za-z0-9_-]+|ph:[a-z]+:[A-Za-z0-9_-]+|https:\/\/[^\s]+)$/.test(r))) fail('ضيف من صورة واحدة لحد ٨ صور صحيحة.');
    if (!Array.isArray(input.variants) || !input.variants.length || input.variants.length > 100) fail('ضيف من تركيبة واحدة لحد ١٠٠ تركيبة.');
    const seen = new Set(), combinations = new Set();
    p.variants = input.variants.map(v => {
      const sku = text(v.sku, 90).toUpperCase(), combination = `${v.color}/${v.size}`;
      if (!/^[A-Z0-9_-]{2,90}$/.test(sku) || seen.has(sku) || combinations.has(combination)) fail('كود التركيبة أو اللون والمقاس مكرر أو غير صحيح.');
      seen.add(sku); combinations.add(combination);
      if (!data.colors.some(c => c.id === v.color) || !data.sizes.some(s => s.id === v.size)) fail('لون أو مقاس مش موجود.');
      const previous = old?.variants?.find(x => x.sku === sku);
      if (previous && (previous.color !== v.color || previous.size !== v.size)) fail('متغيرش لون أو مقاس كود موجود؛ ضيف تركيبة بكود جديد.');
      const stock = number(v.stock, true), reserved = previous?.reserved || 0, sold = previous?.sold || 0;
      const priceDelta = Number(v.priceDelta || 0);
      if (stock < reserved || stock > 1000000) fail('المخزون ما ينفعش يقل عن المحجوز أو يتعدى مليون قطعة.');
      if (!Number.isFinite(priceDelta) || Math.min(p.price, p.salePrice ?? p.price) + priceDelta <= 0) fail('فرق سعر التركيبة غير صحيح.');
      return { sku, color: v.color, size: v.size, stock, reserved, sold, priceDelta };
    });
    for (const v of old?.variants || []) if (!seen.has(v.sku) && (v.reserved || v.sold)) fail('مينفعش تمسح تركيبة ليها حجز أو مبيعات.');
    for (const other of data.products) if (other.id !== input.id) {
      if (other.slug === p.slug || other.sku === p.sku || (other.variants || []).some(v => seen.has(v.sku))) fail('الرابط أو الكود مستخدم في منتج تاني.');
    }
    p.colors = [...new Set(p.variants.map(v => v.color))]; p.sizes = [...new Set(p.variants.map(v => v.size))];
    p.hidden = !!input.hidden; p.featured = !!input.featured; p.isNew = !!input.isNew;
    p.ratingAvg = old?.ratingAvg || 0; p.ratingCount = old?.ratingCount || 0; p.soldCount = old?.soldCount || 0;
    p.tags = old?.tags || []; p.colorImages = old?.colorImages || {}; p.seo = old?.seo || { title: '', description: '' };
    p.createdAt = old?.createdAt || App.nowISO(); p.updatedAt = App.nowISO(); p.revision = (old?.revision || 0) + 1;
    return p;
  }
  const audit = (action, entity, entityId, before, after) => ({ action, entity, entityId, before: before || null, after: after || null });
  const movements = (id, before, after, reason) => {
    const previous = before?.variants || [], next = after?.variants || [];
    return [...new Set([...previous, ...next].map(v => v.sku))].map(sku => ({
      productId: id, sku,
      delta: { stock: (next.find(v => v.sku === sku)?.stock || 0) - (previous.find(v => v.sku === sku)?.stock || 0), reserved: 0, sold: 0 },
      reason, orderId: null
    })).filter(m => m.delta.stock !== 0);
  };
  function prepareImport(inputs, data) {
    if (!Array.isArray(inputs) || !inputs.length || inputs.length > 50 || inputs.reduce((n,p)=>n+(p.variants?.length||0),0)>150) fail('الحد الأقصى ٥٠ منتج و١٥٠ تركيبة في كل استيراد.');
    const staged = {...data, products:[...data.products]}, entries=[], errors=[], ids=new Set();
    for (const input of inputs) {
      try {
        if (input.id && ids.has(input.id)) fail('نفس معرف المنتج مكرر.');
        if (input.id) ids.add(input.id);
        const old = data.products.find(p=>p.id===input.id);
        if (input.id && !old) fail('المنتج مش موجود. صدّر أحدث نسخة.');
        checkRevision(old,input.revision);
        const incoming=App.clone(input); delete incoming.row;
        // الصفوف الغائبة لا تحذف تركيبات موجودة.
        incoming.variants=[...(input.variants||[]),...(old?.variants||[]).filter(v=>!input.variants.some(x=>String(x.sku).toUpperCase()===v.sku))];
        const p=normalizeProduct(incoming,old,staged), id=old?.id||App.randomId();
        entries.push({id,old,product:p,row:input.row});
        staged.products=staged.products.filter(p=>p.id!==id);staged.products.push({...p,id});
      } catch(e) { errors.push(`الصف ${input.row||'?'}: ${e.message}`); }
    }
    if(errors.length)fail(errors.join('\n'));
    return entries;
  }
  App.catalogAdmin = {
    load, number, requireAdmin,
    async previewImport(inputs) {
      requireAdmin('products.write');
      return prepareImport(inputs,await load()).map(e=>({id:e.id,name:e.product.name.ar,sku:e.product.sku,updated:!!e.old,variants:e.product.variants.length,stock:e.product.variants.reduce((n,v)=>n+v.stock,0)}));
    },
    importProducts(inputs) {
      return change('products.write',data=>{
        const entries=prepareImport(inputs,data);
        return {
          writes:entries.map(e=>({collection:'products',id:e.id,data:e.product})),
          movements:entries.flatMap(e=>movements(e.id,e.old,e.product,'products.import')),
          audit:audit('products.import','products','sheet',null,{ids:entries.map(e=>e.id),created:entries.filter(e=>!e.old).length,updated:entries.filter(e=>e.old).length}),
          result:entries.length
        };
      });
    },
    async seedMissing(collection, id, record) {
      requireAdmin('products.write');
      const added = await App.db.tx(async t => {
        const control = await t.get('catalogControl', 'main');
        const existing = await t.get(collection, id);
        if (existing) return false;
        t.set('catalogControl', 'main', {revision:(control?.revision||0)+1,updatedAt:App.db.now()});
        t.set(collection,id,record);
        return true;
      });
      return added;
    },
    addDemoCatalog(groups) {
      return change('products.write', data => {
        const writes = [];
        for (const collection of ['brands','products']) for (const row of groups[collection]) {
          if (data[collection].some(d => d.id === row.id)) continue;
          if (collection === 'products' && data.products.some(p => p.slug === row.data.slug || p.sku === row.data.sku || p.variants.some(v => row.data.variants.some(x => x.sku === v.sku)))) fail('كود من البيانات التجريبية مستخدم في منتج حقيقي.');
          writes.push({collection,id:row.id,data:row.data});
        }
        return {writes,audit:audit('demo.added','products','demo',null,{count:writes.length}),result:writes.length};
      });
    },
    removeDemoCatalog() {
      return change('products.write', data => {
        const products = data.products.filter(p => p.demo === true);
        if (products.some(p => p.soldCount || p.variants.some(v => v.reserved || v.sold))) fail('في منتجات تجريبية ليها حجوزات أو مبيعات؛ اخفيها بدل الحذف.');
        const keep = data.products.filter(p => p.demo !== true);
        const brands = data.brands.filter(b => b.demo === true && !keep.some(p => p.brandId === b.id));
        const writes = [...products.map(p=>({collection:'products',id:p.id,remove:true})),...brands.map(b=>({collection:'brands',id:b.id,remove:true}))];
        return {writes,movements:products.flatMap(p=>movements(p.id,p,null,'demo.remove')),audit:audit('demo.removed','products','demo',{count:writes.length},null),result:writes.length};
      });
    },
    saveProduct(input) {
      const id = input.id || App.randomId();
      return change('products.write', data => {
        const old = data.products.find(p => p.id === input.id);
        if (input.id && !old) fail('المنتج مش موجود.');
        checkRevision(old, input.revision);
        const p = normalizeProduct(input, old, data);
        return { writes: [{ collection: 'products', id, data: p }], movements: movements(id, old, p, old ? 'product.edit' : 'product.create'), audit: audit(old ? 'product.edit' : 'product.create', 'products', id, old, p), result: id };
      });
    },
    async duplicateProduct(id) {
      const old = await App.db.get('products', id);
      if (!old) fail('المنتج مش موجود.');
      const suffix = App.randomId(5).toUpperCase();
      return this.saveProduct({ ...old, id: undefined, revision: 0, demo: false,
        name: { ar: old.name.ar + ' — نسخة', en: old.name.en + ' — copy' },
        slug: old.slug.slice(0, 70) + '-' + suffix.toLowerCase(), sku: old.sku.slice(0, 50) + '-' + suffix,
        hidden: true, variants: old.variants.map(v => ({ ...v, sku: v.sku.slice(0, 80) + '-' + suffix, stock: 0, reserved: 0, sold: 0 })) });
    },
    removeProduct(id) {
      return change('products.write', data => {
        const old = data.products.find(p => p.id === id);
        if (!old) fail('المنتج مش موجود.');
        if (old.variants.some(v => v.reserved || v.sold) || old.soldCount) fail('المنتج ليه حجوزات أو مبيعات؛ اخفيه بدل الحذف.');
        return { writes: [{ collection: 'products', id, remove: true }], movements: movements(id, old, null, 'product.delete'), audit: audit('product.delete', 'products', id, old), result: id };
      });
    },
    setStock(id, sku, stock, reason, expected) {
      return change('inventory.write', data => {
        const old = data.products.find(p => p.id === id);
        if (!old) fail('المنتج مش موجود.');
        const v = old.variants.find(v => v.sku === sku);
        if (!v || v.stock !== expected) fail('المخزون اتغير؛ حدّث الصفحة وجرب تاني.');
        stock = number(stock, true);
        if (stock < (v.reserved || 0) || stock > 1000000) fail('المخزون ما ينفعش يقل عن المحجوز.');
        reason = text(reason, 200); if (reason.length < 3) fail('اكتب سبب تعديل المخزون.');
        const p = { ...plain(old), variants: old.variants.map(x => x.sku === sku ? { ...x, stock } : x), revision: (old.revision || 0) + 1, updatedAt: App.nowISO() };
        return { writes: [{ collection: 'products', id, data: p }], movements: movements(id, old, p, reason), audit: audit('inventory.adjust', 'products', id, { sku, stock: v.stock }, { sku, stock, reason }) };
      });
    },
    saveMeta(collection, input) {
      if (!['categories', 'brands', 'colors', 'sizes'].includes(collection)) fail('قسم غير مسموح.');
      const id = input.id || App.randomId();
      return change('categories.write', data => {
        const old = data[collection].find(x => x.id === id);
        checkRevision(old, input.revision);
        const record = { ...plain(old || {}), order: number(input.order ?? old?.order ?? data[collection].length, true), revision: (old?.revision || 0) + 1 };
        if (collection === 'sizes') {
          record.label = text(input.label, 30); record.group = input.group;
          if (!record.label || !['apparel','shoes','kids','one'].includes(record.group)) fail('اكتب المقاس والمجموعة.');
          if (data.sizes.some(s => s.id !== id && s.label === record.label && s.group === record.group)) fail('المقاس موجود بالفعل.');
        } else if (collection === 'brands') {
          record.name = text(input.name); record.slug = text(input.slug, 80); record.logo = old?.logo || '';
          if (!record.name || !App.validate.slug(record.slug)) fail('اكتب اسم الماركة ورابط صحيح.');
        } else {
          record.name = { ar: text(input.name?.ar), en: text(input.name?.en) };
          if (!record.name.ar) fail('الاسم بالعربي مطلوب.');
          if (collection === 'colors') { record.hex = input.hex; if (!/^#[0-9a-f]{6}$/i.test(record.hex)) fail('اختار لون صحيح.'); }
          else {
            record.slug = text(input.slug, 80); record.parentId = input.parentId || null; record.hidden = !!input.hidden;
            if (!App.validate.slug(record.slug)) fail('اكتب رابط إنجليزي صحيح.');
            let parent = record.parentId; const visited = new Set([id]);
            while (parent) { if (visited.has(parent)) fail('القسم ما ينفعش يبقى تابع لنفسه.'); visited.add(parent); const c = data.categories.find(c => c.id === parent); if (!c) fail('القسم الأب مش موجود.'); parent = c.parentId; }
            if (old && old.parentId !== record.parentId && data.products.some(p => p.subcategoryId === id)) fail('في منتجات بتستخدم القسم الفرعي؛ غيّر أقسامها الأول.');
            record.image = old?.image || ''; record.seo = old?.seo || {title:'',description:''}; record.createdAt = old?.createdAt || App.nowISO(); record.updatedAt = App.nowISO();
          }
        }
        if (record.slug && data[collection].some(x => x.id !== id && x.slug === record.slug)) fail('الرابط مستخدم بالفعل.');
        return { writes: [{collection, id, data: record}], audit: audit('catalog.save', collection, id, old, record), result: id };
      });
    },
    removeMeta(collection, id) {
      if (!['categories','brands','colors','sizes'].includes(collection)) fail('قسم غير مسموح.');
      return change('categories.write', data => {
        const old = data[collection].find(x => x.id === id); if (!old) fail('العنصر مش موجود.');
        if (collection === 'categories' && data.categories.some(c => c.parentId === id)) fail('القسم فيه أقسام فرعية.');
        if (data.products.some(p => collection === 'categories' ? p.categoryId === id || p.subcategoryId === id : collection === 'brands' ? p.brandId === id : p.variants.some(v => v[collection === 'colors' ? 'color' : 'size'] === id))) fail('العنصر مستخدم في منتجات؛ عدّلها الأول أو اخفي القسم.');
        return {writes:[{collection,id,remove:true}],audit:audit('catalog.delete',collection,id,old)};
      });
    },
    reorderCategories(ids) {
      return change('categories.write', data => {
        const rows = ids.map(id => data.categories.find(c => c.id === id));
        if (!rows.length || rows.some(r => !r || r.parentId !== rows[0].parentId) || new Set(ids).size !== ids.length) fail('الترتيب لازم يكون لأقسام تحت نفس الأب.');
        return {writes:rows.map((r, i) => ({collection:'categories',id:r.id,data:{...plain(r),order:i,revision:(r.revision||0)+1,updatedAt:App.nowISO()}})),audit:audit('categories.reorder','categories',rows[0].parentId || 'root',null,ids)};
      });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
