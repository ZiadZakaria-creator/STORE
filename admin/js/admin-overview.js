/* admin-overview.js — نظرة عامة. نسخة المرحلة 2: أرقام حقيقية من البيانات الموجودة بس.
   المبيعات والرسوم البيانية في المرحلة 9. */
(function (root) {
  'use strict';
  const App = root.App;
  const { h } = App;

  App.admin.route({
    id: 'overview', label: 'نظرة عامة', icon: App.adminIcons.overview, perm: 'dashboard.view',
    async render(el) {
      const [products, users, admins] = await Promise.all([
        App.db.list('products'),
        App.can('customers.read') ? App.db.list('users') : Promise.resolve(null),
        App.can('staff.manage') ? App.db.list('admins') : Promise.resolve(null)
      ]);
      const threshold = (App.settings.inventory && App.settings.inventory.lowStockThreshold) || 5;
      const variants = products.flatMap(p => p.variants || []);
      const low = variants.filter(v => (v.stock - (v.reserved || 0)) > 0 && (v.stock - (v.reserved || 0)) <= threshold).length;
      const out = variants.filter(v => (v.stock - (v.reserved || 0)) <= 0).length;
      const kpi = (label, value) => h('div', { class: 'kpi' }, [h('span', { text: label }), h('strong', { text: value == null ? '—' : String(value) })]);
      el.append(
        h('div', { class: 'kpis' }, [
          kpi('المنتجات', products.length),
          kpi('العملاء', users ? users.filter(u => !String(u.id).startsWith('demo_admin_')).length : null),
          kpi(`تركيبات مخزونها قليل (≤${threshold})`, low),
          kpi('تركيبات نفدت', out)
        ]),
        App.ui.box('أهلاً ' + (App.auth.admin.name || ''), h('p', { class: 'muted', text: 'المبيعات والطلبات والرسوم البيانية هتظهر هنا بعد مرحلة الطلبات. الأرقام اللي فوق محسوبة من البيانات الحقيقية الموجودة دلوقتي.' })),
        admins ? App.ui.box('فريق العمل', h('p', { text: `${admins.filter(a => a.active).length} أدمن نشط` })) : null
      );
    }
  });
})(window);
