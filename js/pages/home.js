/* home.js — الصفحة الرئيسية (الرئيسية والأقسام ورفوف المنتجات) */
(function (root) {
  'use strict';
  const App = root.App;
  const { h } = App;

  function deliveryList() {
    const s = App.settings.shipping;
    if (!s || !s.governorates) return '';
    return Object.entries(s.governorates)
      .filter(([, g]) => g.enabled)
      .map(([id]) => App.governorateName(id))
      .join('، ');
  }

  function hero() {
    const picks = App.catalog.products.filter(p => p.featured).slice(0, 3);
    const art = h('div', { class: 'hero-art', 'aria-hidden': 'true' }, picks.map((p, i) => {
      const img = h('img', { alt: '', width: '400', height: '500', loading: i ? 'lazy' : 'eager', fetchpriority: i ? null : 'high' });
      App.img.apply(img, p.images[0]);
      return img;
    }));
    const list = deliveryList();
    return h('section', { class: 'hero' }, h('div', { class: 'container hero-grid' }, [
      h('div', null, [
        h('span', { class: 'hero-kicker', text: App.t('home.hero.kicker') }),
        h('h1', { text: App.t('home.hero.title') }),
        h('p', { text: App.t('home.hero.text') }),
        h('div', { class: 'hero-actions' }, [
          h('a', { class: 'btn btn-light', href: 'shop.html', text: App.t('home.hero.cta') }),
          list ? h('span', { class: 'hero-delivery', text: App.t('home.hero.delivery', { list }) }) : null
        ])
      ]),
      picks.length ? art : null
    ]));
  }

  function categories() {
    const tops = App.catalog.topCategories();
    if (!tops.length) return null;
    return h('section', { class: 'section container' }, [
      h('div', { class: 'section-head' }, h('h2', { class: 'section-title', text: App.t('home.categories') })),
      h('div', { class: 'cat-grid' }, tops.map(c => {
        // صورة القسم: صورته لو موجودة، أو صورة أول منتج فيه
        const first = App.catalog.products.find(p => p.categoryId === c.id && p.images && p.images.length);
        const ref = c.image || (first && first.images[0]);
        const href = `shop.html?cat=${encodeURIComponent(c.slug)}`;
        // قسم من غير صورة ولا منتجات: اسمه بس (من غير صورة مضللة)
        if (!ref) return h('a', { class: 'cat-tile no-img', href }, h('span', { text: App.tx(c.name) }));
        const img = h('img', { alt: '', loading: 'lazy', width: '400', height: '500' });
        App.img.apply(img, ref);
        return h('a', { class: 'cat-tile', href }, [img, h('span', { text: App.tx(c.name) })]);
      }))
    ]);
  }

  function newArrivals() {
    const list = App.catalog.byNewest(App.catalog.products).slice(0, 8);
    if (!list.length) return null;
    return h('section', { class: 'section container' }, [
      h('div', { class: 'section-head' }, [
        h('h2', { class: 'section-title', text: App.t('home.new') }),
        h('a', { class: 'link-arrow', href: 'shop.html?sort=newest', text: App.t('home.viewAll') })
      ]),
      h('div', { class: 'product-grid' }, list.map(App.productCard))
    ]);
  }

  App.page(function () {
    const main = App.$('#main');
    main.textContent = '';
    main.append(...[hero(), categories(), newArrivals(), App.productShelf('home.featured', App.catalog.query({featured:true}).slice(0,8), 'shop.html?featured=1'), App.productShelf('home.sale', App.catalog.query({sale:true}).slice(0,8), 'shop.html?sale=1')].filter(Boolean));
  });
})(window);
