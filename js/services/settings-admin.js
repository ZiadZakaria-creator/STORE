(function (root) {
  'use strict';
  const App = root.App;
  App.saveStoreSettings = async function (input) {
    App.catalogAdmin.requireAdmin('settings.write');
    const ar = String(input.storeName?.ar || '').trim(), en = String(input.storeName?.en || '').trim();
    if (!ar || ar.length > 80 || en.length > 80) throw new Error('اكتب اسم المتجر، بحد أقصى ٨٠ حرف.');
    const raw = String(input.whatsapp || '').trim();
    const phone = raw ? App.validate.normalizePhoneEG(raw) : '';
    if (phone && !App.validate.phoneEG(phone)) throw new Error('رقم الواتساب لازم يكون موبايل مصري صحيح.');
    const n = App.catalogAdmin.number;
    const threshold = n(input.lowStockThreshold, true);
    if (threshold > 1000000) throw new Error('حد المخزون غير صحيح.');
    const free = input.freeShippingOver === '' || input.freeShippingOver == null ? null : n(input.freeShippingOver);
    const basis = input.freeShippingBasis || 'afterCoupon';
    if (!['afterCoupon','beforeCoupon'].includes(basis)) throw new Error('اختار طريقة حساب حد الشحن المجاني.');
    const min = n(input.etaMin, true), max = n(input.etaMax, true);
    if (min < 1 || max < min || max > 60) throw new Error('راجع أقل وأكبر عدد أيام للتوصيل.');
    const governorates = {};
    for (const g of App.governorates) {
      const row = input.governorates?.[g.id] || {};
      const price = row.enabled ? n(row.price) : (row.price === '' || row.price == null ? 0 : n(row.price));
      if (price > 100000) throw new Error('سعر الشحن غير صحيح.');
      governorates[g.id] = {enabled: !!row.enabled, price};
    }
    await App.db.tx(async t => {
      const general = await t.get('settings','general');
      const shipping = await t.get('settings','shipping');
      const inventory = await t.get('settings','inventory');
      for (const [key, previous] of [['general',general],['shipping',shipping],['inventory',inventory]]) {
        if ((previous?.revision || 0) !== (input.revisions?.[key] || 0)) throw new Error('الإعدادات اتغيرت في نافذة تانية؛ حدّث الصفحة قبل الحفظ.');
      }
      const clean = value => { const out = {...value}; delete out.id; return out; };
      const after = {
        general: {...App.config.defaults.general,...clean(general),storeName:{ar,en},whatsapp:phone ? '20'+phone.slice(1) : '',revision:(general?.revision||0)+1},
        shipping: {...clean(shipping),governorates,othersEnabled:false,othersPrice:0,freeShippingOver:free,freeShippingBasis:basis,etaDays:{min,max},revision:(shipping?.revision||0)+1},
        inventory: {...clean(inventory),lowStockThreshold:threshold,revision:(inventory?.revision||0)+1}
      };
      Object.entries(after).forEach(([id,data])=>t.set('settings',id,data));
      await App.audit.log({action:'settings.save',entity:'settings',entityId:'store',before:{general,shipping,inventory},after},t);
    });
    await App.loadSettings(true);
  };
})(typeof window !== 'undefined' ? window : globalThis);
