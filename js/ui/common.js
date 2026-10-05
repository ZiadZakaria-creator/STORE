/* common.js — الأجزاء المشتركة في كل صفحات المتجر: الهيدر، والقائمة، والفوتر، والـ toast، والثيم، واللغة. */
(function (root) {
  'use strict';
  const App = root.App;
  const { h, icons } = App;

  /* ---------- Toast ---------- */
  App.toast = (msg, ms = 2600) => {
    let box = App.$('.toasts');
    if (!box) { box = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
    const t = h('div', { class: 'toast', text: msg });
    box.append(t);
    setTimeout(() => t.remove(), ms);
  };

  /* ---------- الثيم ---------- */
  App.theme = {
    current() {
      const set = document.documentElement.getAttribute('data-theme');
      if (set) return set;
      return root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },
    toggle() {
      const next = App.theme.current() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      App.store.set('theme', next);
      App.emit('theme', next);
    }
  };

  /* ---------- Drawer ---------- */
  function drawer(id, titleKey, body) {
    const overlay = h('div', { class: 'overlay', 'data-for': id });
    const panel = h('aside', { class: 'drawer', id, 'aria-hidden': 'true', tabindex: '-1', role: 'dialog', 'aria-modal': 'true' }, [
      h('div', { class: 'drawer-head' }, [
        h('strong', { 'data-i18n': titleKey, text: App.t(titleKey) }),
        h('button', { class: 'icon-btn', 'data-i18n-aria': 'nav.close', 'aria-label': App.t('nav.close'), html: icons.close, onclick: () => close() })
      ]),
      h('div', { class: 'drawer-body' }, body)
    ]);
    let lastFocus = null;
    function open() {
      lastFocus = document.activeElement;
      overlay.classList.add('open'); panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      panel.focus();
    }
    function close() {
      overlay.classList.remove('open'); panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
    }
    overlay.addEventListener('click', close);
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    document.body.append(overlay, panel);
    return { open, close, panel };
  }

  /* ---------- روابط الأقسام ---------- */
  const catHref = c => `shop.html?cat=${encodeURIComponent(c.slug)}`;

  function buildMenu() {
    const C = App.catalog;
    const items = [h('li', null, h('a', { href: 'shop.html', 'data-i18n': 'nav.shop', text: App.t('nav.shop') }))];
    C.topCategories().forEach(top => {
      items.push(h('li', null, h('a', { href: catHref(top), text: App.tx(top.name) })));
      const subs = C.children(top.id);
      if (subs.length) items.push(h('li', { class: 'sub' }, h('ul', null, subs.map(s => h('li', null, h('a', { href: catHref(s), text: App.tx(s.name) }))))));
    });
    items.push(h('li', null, h('a', { href: 'track.html', 'data-i18n': 'nav.track', text: App.t('nav.track') })));
    const prefs = h('div', { class: 'menu-prefs' }, [
      h('button', { class: 'btn btn-outline', text: App.t('nav.lang'), lang: App.i18n.lang === 'ar' ? 'en' : 'ar', onclick: () => App.i18n.toggle() }),
      h('button', { class: 'btn btn-outline', text: App.t('nav.theme'), onclick: () => App.theme.toggle() })
    ]);
    return [h('ul', { class: 'menu-list' }, items), prefs];
  }

  /* ---------- الهيدر ---------- */
  function renderHeader() {
    const mount = App.$('#site-header');
    if (!mount) return;
    mount.className = 'site-header';
    mount.textContent = '';

    const strip = App.config.isDemo
      ? h('div', { class: 'demo-strip', 'data-i18n': 'demo.note', text: App.t('demo.note') })
      : null;

    const nav = h('nav', { class: 'main-nav', 'aria-label': 'main' },
      App.catalog.topCategories().map(c => h('a', { href: catHref(c), text: App.tx(c.name) })));

    const search = h('form', { class: 'header-search', role: 'search', action: 'shop.html' }, [
      h('span', { html: icons.search }),
      h('input', { type: 'search', name: 'q', 'data-i18n-placeholder': 'nav.search', placeholder: App.t('nav.search'), 'aria-label': App.t('nav.search') })
    ]);

    const menuBtn = h('button', { class: 'icon-btn only-mobile', 'aria-label': App.t('nav.menu'), 'data-i18n-aria': 'nav.menu', html: icons.menu });
    const themeBtn = h('button', { class: 'icon-btn only-desktop', 'aria-label': App.t('nav.theme'), 'data-i18n-aria': 'nav.theme', html: App.theme.current() === 'dark' ? icons.sun : icons.moon });
    const langBtn = h('button', { class: 'icon-btn lang-btn only-desktop', 'data-i18n': 'nav.lang', text: App.t('nav.lang'), lang: App.i18n.lang === 'ar' ? 'en' : 'ar' });

    const name = App.storeName();
    const logo = h('a', { class: 'logo', href: 'index.html', text: name });

    mount.append(...[strip, h('div', { class: 'container header-row' }, [
      menuBtn, logo, nav,
      h('div', { class: 'header-actions' }, [
        search,
        langBtn,
        themeBtn,
        h('a', { class: 'icon-btn', href: 'account.html', 'aria-label': App.t('nav.account'), 'data-i18n-aria': 'nav.account', html: icons.user }),
        h('a', { class: 'icon-btn', href: 'wishlist.html', 'aria-label': App.t('nav.wishlist'), 'data-i18n-aria': 'nav.wishlist', html: icons.heart + '<span class="count" data-count="wishlist"></span>' }),
        h('a', { class: 'icon-btn', href: 'cart.html', 'aria-label': App.t('nav.cart'), 'data-i18n-aria': 'nav.cart', html: icons.bag + '<span class="count" data-count="cart"></span>' })
      ])
    ]), h('form', { class: 'mobile-search', role: 'search', action: 'shop.html' },
      h('input', { type: 'search', name: 'q', 'data-i18n-placeholder': 'nav.search', placeholder: App.t('nav.search'), 'aria-label': App.t('nav.search') }))
    ].filter(Boolean));

    const menu = drawer('menu-drawer', 'nav.menu', buildMenu());
    menuBtn.addEventListener('click', menu.open);
    themeBtn.addEventListener('click', () => { App.theme.toggle(); themeBtn.innerHTML = App.theme.current() === 'dark' ? icons.sun : icons.moon; });
    langBtn.addEventListener('click', () => App.i18n.toggle());
  }

  /* ---------- الفوتر ---------- */
  function renderFooter() {
    const mount = App.$('#site-footer');
    if (!mount) return;
    mount.className = 'site-footer';
    mount.textContent = '';
    const g = App.settings.general;
    const contact = [];
    if (g.whatsapp) contact.push(h('a', { href: `https://wa.me/${g.whatsapp}`, rel: 'noopener', target: '_blank', 'data-i18n': 'footer.whatsapp', text: App.t('footer.whatsapp') }));
    if (g.email) contact.push(h('a', { href: `mailto:${g.email}`, text: g.email }));
    contact.push(h('a', { href: 'track.html', 'data-i18n': 'nav.track', text: App.t('nav.track') }));

    mount.append(h('div', { class: 'container' }, [
      h('div', { class: 'footer-grid' }, [
        h('div', null, [
          h('a', { class: 'logo', href: 'index.html', text: App.storeName() }),
          App.tx(g.tagline) ? h('p', { class: 'muted', text: App.tx(g.tagline), style: 'margin-top:8px' }) : null
        ]),
        h('div', null, [
          h('h3', { 'data-i18n': 'nav.shop', text: App.t('nav.shop') }),
          ...App.catalog.topCategories().map(c => h('a', { href: catHref(c), text: App.tx(c.name) }))
        ]),
        h('div', null, [
          h('h3', { 'data-i18n': 'footer.contact', text: App.t('footer.contact') }),
          ...contact,
          h('a', { href: 'policies.html', 'data-i18n': 'footer.policies', text: App.t('footer.policies') })
        ])
      ]),
      h('div', { class: 'footer-bottom' }, [
        h('span', { text: `© ${new Date().getFullYear()} ${App.storeName()} — ${App.t('footer.rights')}` }),
        App.config.isDemo ? h('span', { class: 'badge badge-demo', 'data-i18n': 'demo.badge', text: App.t('demo.badge') }) : null
      ])
    ]));
  }

  App.renderChrome = function () {
    App.$$('.overlay, .drawer').forEach(n => n.remove());
    renderHeader();
    renderFooter();
    document.title = document.title.replace(/\{store\}/g, App.storeName());
  };

  /* بداية كل صفحة: الإعدادات + الكتالوج + الهيدر/الفوتر، وبعدها دالة الصفحة نفسها */
  App.page = function (init) {
    App.ready(async () => {
      try {
        await App.db.init();
        await Promise.all([App.loadSettings(), App.catalog.load(), App.auth.init()]);
      } catch (e) {
        console.error(e);
        App.toast(App.t('common.error'));
      }
      App.renderChrome();
      App.i18n.apply();
      if (init) await init();
      // تغيير اللغة/البيانات بيعيد رسم الصفحة
      const rerender = () => { App.renderChrome(); App.i18n.apply(); if (init) init(); };
      App.on('lang', rerender);
      App.on('catalog', rerender);
      App.on('settings', rerender);
      App.on('auth', rerender);
    });
  };

  /* Service worker */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !location.pathname.includes('/admin/')) {
    root.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})(window);
