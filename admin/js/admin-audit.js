/* admin-audit.js — سجل العمليات (قراءة بس) — صلاحية audit.read */
(function (root) {
  'use strict';
  const App = root.App;
  const { h } = App;
  const PAGE = 50;

  const ENTITIES = [['', 'الكل'], ['admins', 'الأدمنز'], ['roles', 'الأدوار'], ['orders', 'الطلبات'], ['products', 'المنتجات'],
    ['categories', 'الأقسام'], ['coupons', 'الكوبونات'], ['settings', 'الإعدادات']];

  const short = v => {
    if (v == null) return '—';
    const s = JSON.stringify(v);
    return s.length > 80 ? s.slice(0, 77) + '…' : s;
  };

  App.admin.route({
    id: 'audit', label: 'سجل العمليات', icon: App.adminIcons.audit, perm: 'audit.read',
    async render(el) {
      let entity = '';
      let last = null;
      const rows = [];
      const holder = h('div');
      const more = h('button', { class: 'btn btn-sm btn-outline', text: 'تحميل المزيد', hidden: true });

      async function load(reset) {
        if (reset) { rows.length = 0; last = null; }
        const q = { orderBy: ['at', 'desc'], limit: PAGE };
        if (entity) q.where = [['entity', '==', entity]];
        if (last) q.after = [last];
        const page = await App.db.list('auditLogs', q);
        rows.push(...page);
        last = page.length ? page[page.length - 1].at : last;
        more.hidden = page.length < PAGE;
        holder.textContent = '';
        holder.append(App.ui.table({
          rows, empty: 'لسه مفيش عمليات متسجلة',
          columns: [
            { label: 'الوقت', render: r => App.ui.date(r.at) },
            { label: 'الأدمن', render: r => r.byName || r.by },
            { label: 'العملية', wrap: true, render: r => r.summary || r.action },
            { label: 'النوع', render: r => (ENTITIES.find(e => e[0] === r.entity) || [r.entity, r.entity])[1] },
            { label: 'قبل', render: r => h('code', { dir: 'ltr', text: short(r.before) }) },
            { label: 'بعد', render: r => h('code', { dir: 'ltr', text: short(r.after) }) }
          ]
        }));
      }

      const filter = h('select', { class: 'input', 'aria-label': 'النوع' }, ENTITIES.map(([v, l]) => h('option', { value: v, text: l })));
      filter.addEventListener('change', () => { entity = filter.value; load(true); });
      more.addEventListener('click', () => load(false));
      await load(true);
      el.append(App.ui.box('آخر العمليات', [holder, h('div', { style: 'margin-top:12px' }, more)], [filter]));
    }
  });
})(window);
