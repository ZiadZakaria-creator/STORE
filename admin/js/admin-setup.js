/* admin-setup.js — تجهيز المتجر أول مرة على Firebase: الأدوار، والأقسام، والألوان، والمقاسات، والإعدادات.
   بيضيف الناقص بس، ومبيكتبش فوق أي حاجة موجودة. مفيش منتجات ولا أسعار هنا. */
(function (root) {
  'use strict';
  const App = root.App;
  const { h } = App;

  const D = () => App.demoData;
  const withTimes = o => Object.assign({}, o, { createdAt: App.db.now(), updatedAt: App.db.now() });

  /* كل مجموعة: اسمها، والـ collection، والمستندات اللي هتتضاف */
  function plan() {
    return [
      { key: 'roles', label: 'الأدوار والصلاحيات', path: 'roles',
        docs: D().roles.map(({ id, name, permissions }) => ({ id, data: { name, permissions } })) },
      { key: 'categories', label: 'الأقسام والأقسام الفرعية', path: 'categories',
        docs: D().categories.map(({ id, createdAt, updatedAt, image, ...rest }) => ({ id, data: withTimes(Object.assign(rest, { image: '' })) })) },
      { key: 'colors', label: 'الألوان', path: 'colors', docs: D().colors.map(({ id, ...rest }) => ({ id, data: rest })) },
      { key: 'sizes', label: 'المقاسات', path: 'sizes', docs: D().sizes.map(({ id, ...rest }) => ({ id, data: rest })) },
      { key: 'settings', label: 'الإعدادات الأساسية', path: 'settings', docs: [
        { id: 'general', data: Object.assign({}, App.config.defaults.general) },
        // الشحن مقفول لكل المحافظات لحد ما تحط الأسعار من اللوحة
        { id: 'shipping', data: { governorates: {}, othersEnabled: false, othersPrice: 0, freeShippingOver: null, etaDays: { min: 2, max: 5 } } },
        { id: 'inventory', data: { lowStockThreshold: 5 } }
      ] }
    ];
  }

  async function status() {
    const out = [];
    for (const g of plan()) {
      const existing = await App.db.list(g.path).catch(() => []);
      const ids = new Set(existing.map(d => d.id));
      out.push(Object.assign({}, g, { existing: existing.length, missing: g.docs.filter(d => !ids.has(d.id)) }));
    }
    return out;
  }

  App.admin.route({
    id: 'setup', label: 'تجهيز المتجر', icon: App.adminIcons.setup, perm: 'staff.manage',
    async badge() { return (await status()).filter(g => g.missing.length).length; },
    async render(el) {
      const groups = await status();
      const missingTotal = groups.reduce((s, g) => s + g.missing.length, 0);
      const btn = h('button', { class: 'btn btn-primary', text: 'جهّز البيانات الناقصة', disabled: !missingTotal });
      const log = h('div', { class: 'alert', role: 'status' });

      btn.addEventListener('click', async () => {
        App.form.busy(btn, true);
        try {
          for (const g of groups) {
            for (const d of g.missing) await App.db.set(g.path, d.id, d.data);
            if (g.missing.length) {
              await App.audit.log({ action: 'setup.seeded', entity: g.path, entityId: g.key, after: { count: g.missing.length },
                summary: `جهّز ${g.label} (${g.missing.length})` });
            }
          }
          App.toast('اتجهز');
          if (App.catalog) App.store.remove('cache:catalog');
          App.store.remove('cache:settings');
          App.admin.refreshBadges();
          root.dispatchEvent(new HashChangeEvent('hashchange'));
        } catch (e) {
          console.error(e);
          log.className = 'alert alert-error';
          log.textContent = 'فشل التجهيز: ' + (e.message || e);
          App.form.busy(btn, false);
        }
      });

      el.append(App.ui.box('البيانات الأساسية', [
        h('p', { class: 'muted', style: 'margin-bottom:12px', text: App.config.isDemo
          ? 'إنت في الوضع التجريبي، والبيانات دي موجودة بالفعل. الصفحة دي بتفرق لما Firebase يشتغل.'
          : 'أول مرة بعد ربط Firebase: الزرار ده بيضيف الأدوار والأقسام والألوان والمقاسات والإعدادات الأساسية. بيضيف الناقص بس، ومش هيغيّر أي حاجة إنت عدّلتها.' }),
        App.ui.table({
          rows: groups,
          columns: [
            { label: 'البيانات', render: g => g.label },
            { label: 'موجود', render: g => g.existing },
            { label: 'ناقص', render: g => g.missing.length },
            { label: 'الحالة', render: g => App.ui.chip(g.missing.length ? 'ناقص' : 'جاهز', g.missing.length ? 'off' : 'ok') }
          ]
        }),
        h('div', { style: 'margin-top:16px;display:grid;gap:12px;justify-items:start' }, [btn, log]),
        h('p', { class: 'muted', style: 'margin-top:12px;font-size:.85rem', text: 'ملحوظة: مفيش منتجات ولا أسعار شحن بتتضاف هنا. المنتجات بتتضاف من قسم المنتجات، وأسعار الشحن من الإعدادات، وكل المحافظات بتبدأ مقفولة.' })
      ]));
    }
  });
})(window);
