/* admin-staff.js — الموظفين (admins/{uid}) والأدوار (roles/{id}) — صلاحية staff.manage */
(function (root) {
  'use strict';
  const App = root.App;
  const { h } = App;
  const F = App.form;

  const roleName = (roles, id) => { const r = roles.find(x => x.id === id); return r ? App.tx(r.name) : id; };
  const isSelf = uid => App.auth.admin && App.auth.admin.uid === uid;

  /* ---------- إضافة أدمن: بإيميل حساب موجود ---------- */
  function addAdminModal(roles, onDone) {
    const form = h('form', { class: 'form', novalidate: true }, [
      h('p', { class: 'muted', text: 'الشخص لازم يكون عامل حساب في المتجر الأول (من صفحة حسابي)، وبعدها تضيفه هنا بنفس الإيميل.' }),
      h('div', { class: 'alert', role: 'alert' }),
      F.field({ name: 'email', label: 'إيميل الحساب', type: 'email', required: true, dir: 'ltr' }),
      F.field({ name: 'role', label: 'الدور', type: 'select', required: true, options: roles.map(r => ({ value: r.id, label: App.tx(r.name) })) })
    ]);
    App.ui.modal('إضافة أدمن', form, [
      { label: 'إلغاء' },
      { label: 'إضافة', primary: true, async onClick() {
        const v = F.values(form);
        const alertBox = App.$('.alert', form);
        if (!App.validate.email(v.email)) { F.setErrors(form, { email: 'الإيميل مش صحيح' }); return false; }
        const users = await App.db.list('users', { where: [['email', '==', v.email.toLowerCase()]], limit: 1 });
        if (!users.length) { alertBox.className = 'alert alert-error'; alertBox.textContent = 'مفيش حساب بالإيميل ده.'; return false; }
        const u = users[0];
        const existing = await App.db.get('admins', u.id);
        if (existing) { alertBox.className = 'alert alert-error'; alertBox.textContent = 'الحساب ده أدمن بالفعل.'; return false; }
        const doc = { name: u.name || '', email: u.email, role: v.role, active: true, createdAt: App.db.now() };
        await App.db.set('admins', u.id, doc);
        await App.audit.log({ action: 'admin.added', entity: 'admins', entityId: u.id, after: { email: u.email, role: v.role }, summary: `أضاف ${u.email} بدور ${roleName(roles, v.role)}` });
        App.toast('اتضاف');
        onDone();
      } }
    ]);
  }

  /* ---------- تعديل/إنشاء دور ---------- */
  function roleModal(role, onDone) {
    const locked = role && role.id === 'super_admin';
    const perms = new Set((role && role.permissions) || []);
    const form = h('form', { class: 'form', novalidate: true }, [
      h('div', { class: 'alert', role: 'alert' }),
      h('div', { class: 'form-grid' }, [
        F.field({ name: 'nameAr', label: 'الاسم بالعربي', required: true, value: role ? role.name.ar : '' }),
        F.field({ name: 'nameEn', label: 'الاسم بالإنجليزي', required: true, value: role ? role.name.en : '', dir: 'ltr' }),
        role ? null : F.field({ name: 'id', label: 'كود الدور (إنجليزي)', required: true, dir: 'ltr', hint: 'مثال: warehouse_staff' })
      ]),
      locked ? h('p', { class: 'alert', text: 'المدير العام عنده كل الصلاحيات، ومينفعش تتغير.' }) :
        h('div', { class: 'perm-grid' }, App.PERMISSIONS.map(([id, label]) =>
          h('label', { class: 'check' }, [h('input', { type: 'checkbox', name: 'perm', value: id, checked: perms.has(id) || perms.has('all') }), label])))
    ]);
    App.ui.modal(role ? 'تعديل الدور' : 'دور جديد', form, [
      { label: 'إلغاء' },
      { label: 'حفظ', primary: true, async onClick() {
        const v = F.values(form);
        const errs = {};
        if (!App.validate.length(v.nameAr, 2, 40)) errs.nameAr = 'مطلوب';
        if (!App.validate.length(v.nameEn, 2, 40)) errs.nameEn = 'مطلوب';
        if (!role && !/^[a-z][a-z0-9_]{2,30}$/.test(v.id || '')) errs.id = 'حروف إنجليزي صغيرة وأرقام و _ بس';
        if (!F.setErrors(form, errs)) return false;
        const id = role ? role.id : v.id;
        if (!role && await App.db.get('roles', id)) { F.setErrors(form, { id: 'الكود ده موجود' }); return false; }
        const permissions = locked ? ['all'] : App.$$('input[name="perm"]:checked', form).map(i => i.value);
        const after = { name: { ar: v.nameAr, en: v.nameEn }, permissions };
        await App.db.set('roles', id, after);
        await App.audit.log({ action: role ? 'role.updated' : 'role.created', entity: 'roles', entityId: id,
          before: role ? { name: role.name, permissions: role.permissions } : null, after, summary: `${role ? 'عدّل' : 'أنشأ'} دور ${v.nameAr}` });
        App.toast('اتحفظ');
        onDone();
      } }
    ]);
  }

  App.admin.route({
    id: 'staff', label: 'الموظفين والأدوار', icon: App.adminIcons.staff, perm: 'staff.manage',
    async render(el) {
      const [admins, roles] = await Promise.all([App.db.list('admins'), App.db.list('roles')]);
      const reload = () => App.admin.go('staff') || root.dispatchEvent(new HashChangeEvent('hashchange'));

      const roleSelect = a => {
        const s = h('select', { class: 'input', 'aria-label': 'الدور', disabled: isSelf(a.id) }, roles.map(r => h('option', { value: r.id, text: App.tx(r.name), selected: r.id === a.role })));
        s.addEventListener('change', async () => {
          const before = a.role;
          await App.db.update('admins', a.id, { role: s.value, updatedAt: App.db.now() });
          await App.audit.log({ action: 'admin.role_changed', entity: 'admins', entityId: a.id, before: { role: before }, after: { role: s.value },
            summary: `غيّر دور ${a.email} من ${roleName(roles, before)} لـ ${roleName(roles, s.value)}` });
          a.role = s.value;
          App.toast('اتغير الدور');
        });
        return s;
      };

      const toggleBtn = a => h('button', { class: 'btn btn-sm btn-outline', disabled: isSelf(a.id), text: a.active ? 'إيقاف' : 'تفعيل', async onclick() {
        if (a.active && !(await App.ui.confirm(`إيقاف ${a.email}؟ مش هيقدر يدخل اللوحة.`, 'إيقاف'))) return;
        await App.db.update('admins', a.id, { active: !a.active, updatedAt: App.db.now() });
        await App.audit.log({ action: a.active ? 'admin.deactivated' : 'admin.activated', entity: 'admins', entityId: a.id,
          before: { active: a.active }, after: { active: !a.active }, summary: `${a.active ? 'أوقف' : 'فعّل'} ${a.email}` });
        reload();
      } });

      const removeBtn = a => h('button', { class: 'btn btn-sm btn-outline', disabled: isSelf(a.id), text: 'حذف', async onclick() {
        if (!(await App.ui.confirm(`حذف ${a.email} من الأدمنز؟ حسابه كعميل هيفضل موجود.`, 'حذف'))) return;
        await App.db.remove('admins', a.id);
        await App.audit.log({ action: 'admin.removed', entity: 'admins', entityId: a.id, before: { email: a.email, role: a.role }, summary: `شال ${a.email} من الأدمنز` });
        reload();
      } });

      el.append(
        App.ui.box('الأدمنز', App.ui.table({
          rows: admins,
          empty: 'مفيش أدمنز',
          columns: [
            { label: 'الاسم', render: a => a.name || '—' },
            { label: 'الإيميل', render: a => h('span', { dir: 'ltr', text: a.email }) },
            { label: 'الدور', render: roleSelect },
            { label: 'الحالة', render: a => App.ui.chip(a.active ? 'نشط' : 'موقوف', a.active ? 'ok' : 'off') },
            { label: '', render: a => isSelf(a.id) ? App.ui.chip('إنت') : h('div', { class: 'row-actions' }, [toggleBtn(a), removeBtn(a)]) }
          ]
        }), [h('button', { class: 'btn btn-sm btn-primary', text: '+ إضافة أدمن', onclick: () => addAdminModal(roles, reload) })]),

        App.ui.box('الأدوار والصلاحيات', App.ui.table({
          rows: roles,
          columns: [
            { label: 'الدور', render: r => App.tx(r.name) },
            { label: 'الصلاحيات', wrap: true, render: r => r.permissions.includes('all') ? 'كل الصلاحيات' :
              r.permissions.map(p => (App.PERMISSIONS.find(x => x[0] === p) || [p, p])[1]).join('، ') },
            { label: 'عدد الأدمنز', render: r => admins.filter(a => a.role === r.id).length },
            { label: '', render: r => h('div', { class: 'row-actions' }, [
              h('button', { class: 'btn btn-sm btn-outline', text: 'تعديل', onclick: () => roleModal(r, reload) }),
              r.id === 'super_admin' ? null : h('button', { class: 'btn btn-sm btn-outline', text: 'حذف', async onclick() {
                if (admins.some(a => a.role === r.id)) { App.toast('فيه أدمنز على الدور ده، غيّر دورهم الأول'); return; }
                if (!(await App.ui.confirm(`حذف دور ${App.tx(r.name)}؟`, 'حذف'))) return;
                await App.db.remove('roles', r.id);
                await App.audit.log({ action: 'role.deleted', entity: 'roles', entityId: r.id, before: { name: r.name, permissions: r.permissions }, summary: `مسح دور ${App.tx(r.name)}` });
                reload();
              } })
            ]) }
          ]
        }), [h('button', { class: 'btn btn-sm btn-primary', text: '+ دور جديد', onclick: () => roleModal(null, reload) })])
      );
    }
  });
})(window);
