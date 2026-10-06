(function (root) {
  'use strict';
  const App = root.App, { h } = App;
  function paint(button) {
    const selected = App.wishlist.has(button.dataset.wish);
    button.setAttribute('aria-pressed', String(selected));
    button.setAttribute('aria-label', App.t(selected ? 'wish.remove' : 'wish.add'));
    button.title = App.t(selected ? 'wish.remove' : 'wish.add');
  }
  App.wishlistButton = id => {
    const button = h('button', {type:'button',class:'icon-btn wish-button','data-wish':id,html:App.icons.heart});
    paint(button);
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const selected = await App.wishlist.set(id,!App.wishlist.has(id));
        App.toast(App.t(selected ? 'wish.added' : 'wish.removed'));
      } catch (e) { App.toast(e.message || App.t('common.error')); }
      finally { button.disabled = false; paint(button); }
    });
    return button;
  };
  App.paintWishlist = () => {
    App.$$('[data-wish]').forEach(paint);
    App.$$('[data-count="wishlist"]').forEach(el => { const n=App.wishlist.ids.length; el.textContent=String(n);el.dataset.n=String(n); });
  };
  App.on('wishlist', App.paintWishlist);
  App.breadcrumb = rows => h('nav',{class:'breadcrumbs','aria-label':App.t('common.breadcrumb')},[
    h('a',{href:'index.html',text:App.t('nav.home')}),
    ...rows.map(row => row.href ? h('a',{href:row.href,text:row.text}) : h('span',{'aria-current':'page',text:row.text}))
  ]);
  App.productShelf = (key, rows, href) => !rows.length ? null : h('section',{class:'section container'},[
    h('div',{class:'section-head'},[h('h2',{class:'section-title',text:App.t(key)}),href?h('a',{class:'link-arrow',href,text:App.t('home.viewAll')}):null]),
    h('div',{class:'product-grid'},rows.map(App.productCard))
  ]);
  App.emptyProducts = (key, reset = 'shop.html') => h('div',{class:'empty'},[
    h('p',{text:App.t(key)}),h('a',{class:'btn btn-outline',href:reset,text:App.t('nav.shop')})
  ]);
})(window);
