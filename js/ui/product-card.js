/* product-card.js — كارت المنتج المشترك (الرئيسية، والشوب، والمنتجات المشابهة) */
(function (root) {
  'use strict';
  const App = root.App;
  const { h } = App;

  App.productUrl = p => `product.html?slug=${encodeURIComponent(p.slug)}`;

  App.productCard = function (p) {
    const C = App.catalog;
    const onSale = p.salePrice != null && p.salePrice < p.price;
    const inStock = C.inStock(p);
    const range = C.priceRange(p);
    const img = h('img', { alt: App.tx(p.name), loading: 'lazy', decoding: 'async', width: '400', height: '500' });
    App.img.apply(img, p.images[0]);
    let alt = null;
    if (p.images[1]) {
      alt = h('img', { class: 'alt', alt: '', 'aria-hidden': 'true', loading: 'lazy', decoding: 'async', width: '400', height: '500' });
      App.img.apply(alt, p.images[1]);
    }

    const badges = [];
    if (!inStock) badges.push(h('span', { class: 'badge badge-out', text: App.t('product.soldOut') }));
    else if (onSale) badges.push(h('span', { class: 'badge badge-sale', text: range.min === range.max ? `-${App.money.percentOff(range.min + p.price - p.salePrice, range.min)}%` : App.t('product.sale') }));
    if (p.isNew && inStock) badges.push(h('span', { class: 'badge badge-new', text: App.t('product.new') }));

    const colors = (p.colors || []).map(id => C.color(id)).filter(Boolean);
    const shown = colors.slice(0, 4);
    const brand = C.brand(p.brandId);

    return h('article', { class: 'card' }, [
      h('div', { class: 'card-media' }, [img, alt, h('div', { class: 'card-badges' }, badges), App.wishlistButton(p.id)]),
      h('div', { class: 'card-body' }, [
        brand ? h('span', { class: 'card-brand', text: brand.name }) : null,
        h('h3', { class: 'card-title' }, h('a', { href: App.productUrl(p), text: App.tx(p.name) })),
        h('div', { class: 'price' }, [
          h('span', { class: 'now' + (onSale ? ' is-sale' : ''), text: range.min === range.max ? App.money.format(range.min) : App.t('product.from', {price:App.money.format(range.min)}) }),
          onSale && range.min === range.max ? h('span', { class: 'old', text: App.money.format(range.min + p.price - p.salePrice) }) : null
        ]),
        colors.length > 1 ? h('div', { class: 'swatches', 'aria-label': App.t('product.colors', { n: colors.length }) }, [
          ...shown.map(c => h('span', { class: 'swatch', title: App.tx(c.name), style: `background:${c.hex}` })),
          colors.length > shown.length ? h('span', { class: 'more', text: `+${colors.length - shown.length}` }) : null
        ]) : null
      ])
    ]);
  };
})(window);
