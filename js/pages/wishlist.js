(function (root) {
  'use strict';
  const App=root.App,{h}=App;
  function render() {
    const main=App.$('#main');main.textContent='';document.title=App.t('nav.wishlist')+' — '+App.storeName();
    const ids=App.wishlist.ids;
    main.append(h('div',{class:'container section'},[
      App.breadcrumb([{text:App.t('nav.wishlist')}]),h('h1',{class:'page-title',text:App.t('nav.wishlist')}),
      h('p',{class:'wishlist-note',text:App.t(App.auth.user?'wish.member':'wish.guest')}),
      !App.auth.user?h('a',{class:'text-link',href:'account.html',text:App.t('auth.login')}):null,
      ids.length?h('div',{class:'product-grid wishlist-grid'},ids.map(id=>{
        const p=App.catalog.product(id);
        return p?App.productCard(p):h('article',{class:'unavailable-card'},[h('p',{text:App.t('wish.unavailable')}),App.wishlistButton(id)]);
      })):App.emptyProducts('wish.empty')
    ]));
  }
  App.page(render);
  App.on('wishlist',()=>{if(App.$('#main .wishlist-note'))render();});
})(window);
