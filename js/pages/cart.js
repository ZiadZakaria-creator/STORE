(function(root){
  'use strict';
  const App=root.App,{h}=App;
  let governorate='',generation=0;
  async function render(){
    const token=++generation,main=App.$('#main');document.title=App.t('nav.cart')+' — '+App.storeName();
    main.textContent='';
    const body=h('div',{class:'container section'},[App.breadcrumb([{text:App.t('nav.cart')}]),h('h1',{class:'page-title',text:App.t('nav.cart')})]);main.append(body);
    if(!App.cart.count){body.append(App.emptyProducts('cart.empty'));return;}
    const select=h('select',{class:'input',name:'governorate','aria-label':App.t('address.governorate')},[h('option',{value:'',text:App.t('address.chooseGov')}),...App.governorates.map(g=>h('option',{value:g.id,text:App.governorateName(g.id),disabled:!App.settings.shipping?.governorates?.[g.id]?.enabled}))]);select.value=governorate;
    select.addEventListener('change',()=>{governorate=select.value;render();});
    const summary=h('aside',{class:'cart-summary'},[h('h2',{text:App.t('cart.summary')}),App.couponForm(),select]);
    body.append(h('div',{class:'cart-layout'},[App.cartItems(),summary]));
    try{
      const q=await App.cart.quote({governorate});if(token!==generation)return;
      summary.append(App.orderSummary(q),h('p',{class:'muted',text:App.t('cart.notReserved')}));
      if(q.lines.every(l=>!l.issue)&&!q.couponError)summary.append(h('a',{class:'btn btn-primary',href:'checkout.html'+(governorate?'?gov='+encodeURIComponent(governorate):''),text:App.t('cart.checkout')}));
      else summary.append(h('p',{class:'field-error',text:App.t('cart.fixItems')}));
    }catch(e){if(token===generation)summary.append(h('p',{class:'field-error',text:App.t('common.error')}));}
  }
  let refreshed=false;
  App.page(async()=>{if(!refreshed){refreshed=true;try{await Promise.all([App.catalog.refresh(),App.loadSettings(true)]);}catch(e){App.toast(App.t('common.error'));}}return render();});App.on('cart',()=>{if(App.$('#main .cart-layout')||App.$('#main .empty'))render();});
})(window);
