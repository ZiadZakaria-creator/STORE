/* admin.js — هيكل اللوحة: الدخول، والصلاحيات، والـ sidebar، والراوتر (#/section/param).
   كل قسم بيسجل نفسه بـ App.admin.route({...}) من ملفه. */
(function (root) {
  'use strict';
  const App = root.App;
  const { h, icons } = App;
  const F = App.form;

  const ICON = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  App.adminIcons = {
    overview: ICON('<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>'),
    staff: ICON('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.6 3 5.2"/>'),
    audit: ICON('<path d="M8 3h8l4 4v14H4V3h4z"/><path d="M8 11h8M8 15h8M8 7h4"/>'),
    setup: ICON('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3.5"/>')
  };

  const routes = [];
  let current = null;

  App.admin = {
    /* route({ id, label, icon, perm, badge: async () => number, render: async (el, param) }) */
    route(r) { routes.push(r); },
    go(path) { location.hash = '#/' + path; },
    refreshBadges
  };

  /* ---------- شاشة الدخول ---------- */
  function gate(message) {
    const alertBox = h('div', { class: message ? 'alert alert-error' : 'alert', role: 'alert', text: message || '' });
    const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit', text: 'دخول' });
    const form = h('form', { class: 'form', novalidate: true }, [
      alertBox,
      F.field({ name: 'email', label: 'الإيميل', type: 'email', required: true, autocomplete: 'username', dir: 'ltr' }),
      F.field({ name: 'password', label: 'الباسورد', type: 'password', required: true, autocomplete: 'current-password', dir: 'ltr' }),
      btn
    ]);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const v = F.values(form);
      F.submit(form, btn, () => App.auth.login(v.email, v.password)).then(boot);
    });
    const google = h('button', { class: 'btn btn-google btn-block', type: 'button', text: 'الدخول بحساب Google' });
    google.addEventListener('click', async () => {
      F.busy(google, true);
      try { await App.auth.loginGoogle(); await boot(); }
      catch (e) { alertBox.className = 'alert alert-error'; alertBox.textContent = App.authErrorText(e); }
      finally { F.busy(google, false); }
    });

    let demo = null;
    if (App.config.isDemo) {
      // الوضع التجريبي: دخول بدور معين علشان تجرب الصلاحيات، من غير باسورد
      demo = h('div', { class: 'demo-roles' }, [
        h('div', { class: 'divider', text: 'وضع تجريبي: ادخل بدور' }),
        ...App.demoData.roles.map(r => h('button', { class: 'btn btn-outline btn-block', type: 'button', 'data-role': r.id, text: App.tx(r.name),
          onclick: async () => { await App.auth.demoAdmin(r.id); boot(); } }))
      ]);
    }

    const signedInNotAdmin = App.auth.user && !App.auth.admin;
    document.body.textContent = '';
    document.body.append(h('main', { class: 'gate' }, h('div', { class: 'panel' }, [
      h('h1', { text: 'لوحة التحكم' }),
      h('span', { class: 'status-pill' + (App.config.isDemo ? ' demo' : ''), style: 'justify-self:start', text: App.config.isDemo ? 'وضع تجريبي' : 'النظام متصل' }),
      signedInNotAdmin
        ? h('div', { class: 'form' }, [
          h('p', { class: 'alert alert-error', text: `الحساب ${App.auth.user.email} مش عنده صلاحية دخول اللوحة.` }),
          h('button', { class: 'btn btn-outline', text: 'تسجيل خروج', onclick: async () => { await App.auth.logout(); boot(); } })
        ])
        : h('div', { class: 'form' }, [form, h('div', { class: 'divider', text: 'أو' }), google]),
      signedInNotAdmin ? null : demo
    ])));
  }

  /* ---------- الهيكل ---------- */
  function shell() {
    const a = App.auth.admin;
    const allowed = routes.filter(r => !r.perm || App.can(r.perm));
    const overlay = h('div', { class: 'overlay' });
    const sidebar = h('aside', { class: 'sidebar', 'aria-label': 'القائمة' }, [
      h('div', { class: 'sidebar-brand' }, [App.storeName(), h('small', { text: 'لوحة التحكم' })]),
      h('nav', { class: 'side-nav' }, allowed.map(r => h('a', { href: '#/' + r.id, 'data-route': r.id, html: r.icon + `<span>${App.esc(r.label)}</span><span class="nav-badge" data-badge="${r.id}"></span>` }))),
      h('div', { class: 'sidebar-foot' }, [
        h('strong', { text: a.name || a.email }),
        h('span', { text: App.tx(a.roleName) }),
        h('div', { style: 'margin-top:8px;display:flex;gap:12px' }, [
          h('a', { href: '../index.html', target: '_blank', rel: 'noopener', text: 'فتح المتجر' }),
          h('button', { class: 'text-link', style: 'color:inherit', text: 'خروج', onclick: async () => { await App.auth.logout(); boot(); } })
        ])
      ])
    ]);
    const burger = h('button', { class: 'icon-btn burger', 'aria-label': 'القائمة', html: icons.menu });
    const title = h('h1', { id: 'section-title' });
    const content = h('div', { class: 'admin-content', id: 'admin-content' });
    const toggle = open => { sidebar.classList.toggle('open', open); overlay.classList.toggle('open', open); };
    burger.addEventListener('click', () => toggle(true));
    overlay.addEventListener('click', () => toggle(false));
    sidebar.addEventListener('click', e => { if (e.target.closest('a[data-route]')) toggle(false); });

    const themeBtn = h('button', { class: 'icon-btn', 'aria-label': 'تغيير المظهر', html: App.theme.current() === 'dark' ? icons.sun : icons.moon });
    themeBtn.addEventListener('click', () => { App.theme.toggle(); themeBtn.innerHTML = App.theme.current() === 'dark' ? icons.sun : icons.moon; });

    document.body.textContent = '';
    document.body.append(h('div', { class: 'admin' }, [
      sidebar, overlay,
      h('div', { class: 'admin-main' }, [
        h('header', { class: 'topbar' }, [
          burger, title, h('span', { class: 'spacer' }),
          h('span', { class: 'status-pill' + (App.config.isDemo ? ' demo' : ''), text: App.config.isDemo ? 'وضع تجريبي' : 'النظام متصل' }),
          themeBtn
        ]),
        h('main', { id: 'main' }, content)
      ])
    ]));
    return allowed;
  }

  async function refreshBadges() {
    for (const r of routes) {
      if (!r.badge || (r.perm && !App.can(r.perm))) continue;
      const el = App.$(`[data-badge="${r.id}"]`);
      if (!el) continue;
      try { const n = await r.badge(); el.textContent = n ? String(n) : ''; } catch (e) { /* ignore */ }
    }
  }

  async function navigate(allowed) {
    const [id, ...rest] = location.hash.replace(/^#\/?/, '').split('/');
    const route = allowed.find(r => r.id === id) || allowed[0];
    if (!route) return;
    if (route.id !== id) { history.replaceState(null, '', '#/' + route.id); }
    current = route;
    App.$$('.side-nav a').forEach(a => a.setAttribute('aria-current', a.dataset.route === route.id ? 'page' : 'false'));
    App.$('#section-title').textContent = route.label;
    document.title = `${route.label} — لوحة التحكم`;
    const el = App.$('#admin-content');
    el.textContent = '';
    el.append(h('div', { class: 'skeleton', style: 'height:160px' }));
    try {
      const box = h('div', { style: 'display:grid;gap:24px' });
      await route.render(box, rest.join('/'));
      if (current === route) { el.textContent = ''; el.append(box); }
    } catch (e) {
      console.error(e);
      el.textContent = '';
      el.append(h('div', { class: 'alert alert-error', text: 'حصلت مشكلة في تحميل القسم: ' + (e.message || e) }));
    }
  }

  let hashHandler = null;
  async function boot() {
    // اللوحة عربي دايماً
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    await App.db.init();
    await Promise.all([App.loadSettings(), App.auth.init()]);
    if (!App.auth.user) return gate();
    await App.auth.loadAdmin();
    if (!App.auth.admin) return gate();
    const allowed = shell();
    if (hashHandler) root.removeEventListener('hashchange', hashHandler);
    hashHandler = () => navigate(allowed);
    root.addEventListener('hashchange', hashHandler);
    await navigate(allowed);
    refreshBadges();
  }

  App.ready(() => { boot().catch(e => { console.error(e); document.body.textContent = 'حصلت مشكلة: ' + e.message; }); });
})(window);
