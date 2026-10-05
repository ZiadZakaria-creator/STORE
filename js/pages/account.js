/* account.js — الدخول/التسجيل/نسيت الباسورد، وبعد الدخول: البروفايل، والعناوين، والطلبات، والباسورد */
(function (root) {
  'use strict';
  const App = root.App;
  const { h } = App;
  const F = App.form;

  let authView = 'login';        // login | register | forgot (قبل الدخول)
  const TABS = ['profile', 'addresses', 'orders', 'security'];
  const tabFromHash = () => (TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'profile');

  /* ============ قبل الدخول ============ */
  function googleBtn(alertBox) {
    const btn = h('button', { type: 'button', class: 'btn btn-google btn-block', text: App.t('auth.google') });
    btn.addEventListener('click', async () => {
      alertBox.className = 'alert'; alertBox.textContent = '';
      F.busy(btn, true);
      try { await App.auth.loginGoogle(); }
      catch (e) { alertBox.className = 'alert alert-error'; alertBox.textContent = App.authErrorText(e); }
      finally { F.busy(btn, false); }
    });
    return btn;
  }

  function loginForm() {
    const alertBox = h('div', { class: 'alert', role: 'alert' });
    const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit', text: App.t('auth.submitLogin') });
    const form = h('form', { class: 'form', novalidate: true }, [
      alertBox,
      F.field({ name: 'email', label: App.t('auth.email'), type: 'email', required: true, autocomplete: 'email', dir: 'ltr' }),
      F.field({ name: 'password', label: App.t('auth.password'), type: 'password', required: true, autocomplete: 'current-password', dir: 'ltr' }),
      h('button', { type: 'button', class: 'text-link', style: 'justify-self:start', text: App.t('auth.forgot'), onclick: () => { authView = 'forgot'; render(); } }),
      btn,
      h('div', { class: 'divider', text: App.t('auth.or') }),
      googleBtn(alertBox)
    ]);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const v = F.values(form);
      const errs = {};
      if (!App.validate.email(v.email)) errs.email = App.t('auth.err.email');
      if (!v.password) errs.password = App.t('auth.err.required');
      if (!F.setErrors(form, errs)) return;
      F.submit(form, btn, () => App.auth.login(v.email, v.password));
    });
    return form;
  }

  function registerForm() {
    const alertBox = h('div', { class: 'alert', role: 'alert' });
    const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit', text: App.t('auth.submitRegister') });
    const form = h('form', { class: 'form', novalidate: true }, [
      alertBox,
      F.field({ name: 'name', label: App.t('auth.name'), required: true, autocomplete: 'name', maxlength: 80 }),
      F.field({ name: 'email', label: App.t('auth.email'), type: 'email', required: true, autocomplete: 'email', dir: 'ltr' }),
      F.field({ name: 'phone', label: App.t('auth.phone'), type: 'tel', required: true, autocomplete: 'tel', dir: 'ltr', inputmode: 'tel', hint: '01012345678' }),
      F.field({ name: 'password', label: App.t('auth.password'), type: 'password', required: true, autocomplete: 'new-password', dir: 'ltr', hint: App.t('auth.passwordHint'), minlength: 8 }),
      btn,
      h('div', { class: 'divider', text: App.t('auth.or') }),
      googleBtn(alertBox)
    ]);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const v = F.values(form);
      const errs = {};
      if (!App.validate.length(v.name, 2, 80)) errs.name = App.t('auth.err.name');
      if (!App.validate.email(v.email)) errs.email = App.t('auth.err.email');
      if (!App.validate.phoneEG(v.phone)) errs.phone = App.t('auth.err.phone');
      if (String(v.password).length < 8) errs.password = App.t('auth.err.weak');
      if (!F.setErrors(form, errs)) return;
      F.submit(form, btn, () => App.auth.register(v));
    });
    return form;
  }

  function forgotForm() {
    const alertBox = h('div', { class: 'alert', role: 'status' });
    const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit', text: App.t('auth.forgotSend') });
    const form = h('form', { class: 'form', novalidate: true }, [
      h('h2', { class: 'section-title', text: App.t('auth.forgotTitle') }),
      h('p', { class: 'muted', text: App.t('auth.forgotText') }),
      alertBox,
      F.field({ name: 'email', label: App.t('auth.email'), type: 'email', required: true, autocomplete: 'email', dir: 'ltr' }),
      btn,
      h('button', { type: 'button', class: 'text-link', text: App.t('auth.backToLogin'), onclick: () => { authView = 'login'; render(); } })
    ]);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const v = F.values(form);
      if (!F.setErrors(form, App.validate.email(v.email) ? {} : { email: App.t('auth.err.email' ) })) return;
      const res = await F.submit(form, btn, () => App.auth.resetPassword(v.email));
      if (res) {
        alertBox.className = 'alert alert-success';
        // نفس الرسالة سواء الإيميل موجود أو لأ، علشان محدش يعرف مين عنده حساب
        alertBox.textContent = App.t('auth.forgotSent') + (res.demo ? ' ' + App.t('auth.forgotDemo') : '');
      }
    });
    return form;
  }

  function signedOut() {
    if (authView === 'forgot') return h('div', { class: 'panel auth-panel' }, forgotForm());
    const tab = (id, key) => h('button', { class: 'tab', role: 'tab', 'aria-selected': String(authView === id), text: App.t(key), onclick: () => { authView = id; render(); } });
    return h('div', { class: 'panel auth-panel' }, [
      h('div', { class: 'tabs', role: 'tablist' }, [tab('login', 'auth.login'), tab('register', 'auth.register')]),
      authView === 'register' ? registerForm() : loginForm()
    ]);
  }

  /* ============ رقم الموبايل (مرة واحدة بعد Google) ============ */
  function phonePrompt() {
    const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit', text: App.t('auth.save') });
    const form = h('form', { class: 'form', novalidate: true }, [
      h('h2', { class: 'section-title', text: App.t('auth.phoneTitle') }),
      h('p', { class: 'muted', text: App.t('auth.phoneText') }),
      h('div', { class: 'alert', role: 'alert' }),
      F.field({ name: 'phone', label: App.t('auth.phone'), type: 'tel', required: true, autocomplete: 'tel', dir: 'ltr', inputmode: 'tel', hint: '01012345678' }),
      btn
    ]);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const v = F.values(form);
      if (!F.setErrors(form, App.validate.phoneEG(v.phone) ? {} : { phone: App.t('auth.err.phone') })) return;
      F.submit(form, btn, () => App.auth.updateProfile({ phone: v.phone }));
    });
    return h('div', { class: 'panel auth-panel' }, form);
  }

  /* ============ بعد الدخول ============ */
  function profileTab() {
    const u = App.auth.user;
    const btn = h('button', { class: 'btn btn-primary', type: 'submit', text: App.t('auth.save') });
    const form = h('form', { class: 'form', novalidate: true }, [
      h('div', { class: 'alert', role: 'alert' }),
      h('div', { class: 'form-grid' }, [
        F.field({ name: 'name', label: App.t('auth.name'), required: true, value: u.name, autocomplete: 'name', maxlength: 80 }),
        F.field({ name: 'phone', label: App.t('auth.phone'), type: 'tel', required: true, value: u.phone, dir: 'ltr', autocomplete: 'tel', inputmode: 'tel' }),
        h('label', { class: 'field full' }, [h('span', { text: App.t('auth.email') }), h('input', { class: 'input', value: u.email, disabled: true, dir: 'ltr' })])
      ]),
      h('div', null, btn)
    ]);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const v = F.values(form);
      const errs = {};
      if (!App.validate.length(v.name, 2, 80)) errs.name = App.t('auth.err.name');
      if (!App.validate.phoneEG(v.phone)) errs.phone = App.t('auth.err.phone');
      if (!F.setErrors(form, errs)) return;
      const ok = await F.submit(form, btn, () => App.auth.updateProfile(v).then(() => true));
      if (ok) App.toast(App.t('auth.saved'));
    });
    return form;
  }

  function addressForm(uid, existing, onDone) {
    const a = existing || { name: App.auth.user.name, phone: App.auth.user.phone };
    const btn = h('button', { class: 'btn btn-primary', type: 'submit', text: App.t('auth.save') });
    const govs = App.governorates.map(g => ({ value: g.id, label: App.tx(g) }));
    const sfx = existing ? '-' + existing.id : '-new';
    const f = o => F.field(Object.assign({ idSuffix: sfx, value: a[o.name] }, o));
    const form = h('form', { class: 'form panel', novalidate: true }, [
      h('div', { class: 'alert', role: 'alert' }),
      h('div', { class: 'form-grid' }, [
        f({ name: 'label', label: App.t('address.label'), maxlength: 40, full: true }),
        f({ name: 'name', label: App.t('address.recipient'), required: true, autocomplete: 'name' }),
        f({ name: 'phone', label: App.t('auth.phone'), type: 'tel', required: true, dir: 'ltr', autocomplete: 'tel', inputmode: 'tel' }),
        f({ name: 'governorate', label: App.t('address.governorate'), type: 'select', required: true, options: govs, placeholder: App.t('address.chooseGov') }),
        f({ name: 'city', label: App.t('address.city'), required: true, autocomplete: 'address-level2' }),
        f({ name: 'area', label: App.t('address.area'), required: true, autocomplete: 'address-level3' }),
        f({ name: 'street', label: App.t('address.street'), required: true, autocomplete: 'address-line1' }),
        f({ name: 'building', label: App.t('address.building'), required: true }),
        f({ name: 'floor', label: App.t('address.floor') }),
        f({ name: 'apartment', label: App.t('address.apartment') }),
        f({ name: 'notes', label: App.t('address.notes'), type: 'textarea', full: true, maxlength: 300 })
      ]),
      h('div', { style: 'display:flex;gap:8px' }, [btn, h('button', { type: 'button', class: 'btn btn-outline', text: App.t('address.cancel'), onclick: () => onDone(false) })])
    ]);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const v = App.addresses.clean(F.values(form));
      if (!F.setErrors(form, App.addresses.validate(v))) return;
      const id = await F.submit(form, btn, () => App.addresses.save(uid, v, existing && existing.id));
      if (id) onDone(true);
    });
    return form;
  }

  function addressesTab() {
    const uid = App.auth.user.uid;
    const box = h('div', { class: 'form' });
    async function load(editing) {
      const list = await App.addresses.list(uid);
      box.textContent = '';
      if (editing === 'new') { box.append(addressForm(uid, null, () => load())); return; }
      const add = h('button', { class: 'btn btn-outline', text: '+ ' + App.t('address.add'), onclick: () => load('new') });
      if (list.length >= App.addresses.MAX) { add.disabled = true; add.title = App.t('address.max', { n: App.addresses.MAX }); }
      if (!list.length) box.append(h('p', { class: 'muted', text: App.t('address.empty') }));
      list.forEach(a => {
        if (editing === a.id) { box.append(addressForm(uid, a, () => load())); return; }
        box.append(h('div', { class: 'address-card' + (a.isDefault ? ' is-default' : '') }, [
          h('div', null, [
            h('strong', { text: a.label || a.name }),
            a.isDefault ? h('span', { class: 'badge badge-new', style: 'margin-inline-start:8px', text: App.t('address.default') }) : null,
            h('p', { class: 'muted', text: App.addresses.format(a) }),
            h('p', { class: 'muted', dir: 'ltr', style: 'text-align:start', text: a.phone })
          ]),
          h('div', { class: 'address-actions' }, [
            h('button', { class: 'text-link', text: App.t('address.edit'), onclick: () => load(a.id) }),
            a.isDefault ? null : h('button', { class: 'text-link', text: App.t('address.makeDefault'), onclick: async () => { await App.addresses.setDefault(uid, a.id); load(); } }),
            h('button', { class: 'text-link', text: App.t('address.delete'), onclick: async () => {
              if (!root.confirm(App.t('address.confirmDelete'))) return;
              await App.addresses.remove(uid, a.id); load();
            } })
          ])
        ]));
      });
      box.append(h('div', null, add));
    }
    load();
    return box;
  }

  function ordersTab() {
    const box = h('div', null, h('div', { class: 'skeleton', style: 'height:120px' }));
    App.db.list('orders', { where: [['uid', '==', App.auth.user.uid]], orderBy: ['createdAt', 'desc'], limit: 50 })
      .then(list => {
        box.textContent = '';
        if (!list.length) {
          box.append(h('div', { class: 'empty' }, [h('p', { text: App.t('account.noOrders') }), h('a', { class: 'btn btn-primary', href: 'shop.html', text: App.t('account.startShopping') })]));
          return;
        }
        // تفاصيل الطلبات والتتبع في المرحلة 6 و 8
        list.forEach(o => box.append(h('div', { class: 'address-card' }, [
          h('strong', { text: o.number }),
          h('span', { text: App.money.format(o.totals && o.totals.total) })
        ])));
      })
      .catch(e => { console.error(e); box.textContent = App.t('common.error'); });
    return box;
  }

  function securityTab() {
    if (App.auth.user.provider === 'google') return h('p', { class: 'alert', text: App.t('account.googleNoPassword') });
    const btn = h('button', { class: 'btn btn-primary', type: 'submit', text: App.t('account.changePassword') });
    const form = h('form', { class: 'form', novalidate: true, style: 'max-width:420px' }, [
      h('div', { class: 'alert', role: 'alert' }),
      F.field({ name: 'current', label: App.t('account.currentPassword'), type: 'password', required: true, autocomplete: 'current-password', dir: 'ltr' }),
      F.field({ name: 'next', label: App.t('account.newPassword'), type: 'password', required: true, autocomplete: 'new-password', dir: 'ltr', hint: App.t('auth.passwordHint') }),
      h('div', null, btn)
    ]);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const v = F.values(form);
      const errs = {};
      if (!v.current) errs.current = App.t('auth.err.required');
      if (String(v.next).length < 8) errs.next = App.t('auth.err.weak');
      if (!F.setErrors(form, errs)) return;
      const ok = await F.submit(form, btn, () => App.auth.changePassword(v.current, v.next).then(() => true));
      if (ok) { form.reset(); App.toast(App.t('account.passwordChanged')); }
    });
    return form;
  }

  function signedIn() {
    const u = App.auth.user;
    const active = tabFromHash();
    const views = { profile: profileTab, addresses: addressesTab, orders: ordersTab, security: securityTab };
    const keys = { profile: 'account.profile', addresses: 'account.addresses', orders: 'account.orders', security: 'account.security' };
    return h('div', null, [
      h('div', { class: 'account-head' }, [
        h('div', null, [
          h('h1', { class: 'section-title', text: App.t('auth.welcome', { name: u.name || u.email }) }),
          h('p', { class: 'muted', dir: 'ltr', style: 'text-align:start', text: u.email })
        ]),
        h('div', { class: 'account-head-actions' }, [
          h('a', { class: 'btn btn-outline', href: 'wishlist.html', text: App.t('account.wishlist') }),
          h('button', { class: 'btn btn-outline', text: App.t('auth.logout'), onclick: () => App.auth.logout() })
        ])
      ]),
      h('div', { class: 'tabs', role: 'tablist' }, TABS.map(id => h('a', { class: 'tab', role: 'tab', href: '#' + id, 'aria-selected': String(id === active), text: App.t(keys[id]) }))),
      h('div', { role: 'tabpanel' }, views[active]())
    ]);
  }

  function render() {
    const main = App.$('#main');
    main.textContent = '';
    let view;
    if (!App.auth.user) view = signedOut();
    else if (App.auth.needsPhone()) view = phonePrompt();
    else view = signedIn();
    main.append(h('div', { class: 'container section account' }, view));
  }

  root.addEventListener('hashchange', () => { if (App.auth.user) render(); });
  App.page(render);
})(window);
