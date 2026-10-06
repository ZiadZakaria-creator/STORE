(function(root){
  'use strict';
  const App=root.App,{h}=App;
  App.cartAction=async(button,action)=>{button.disabled=true;try{await action();}catch(e){App.toast(e.message||App.t('common.error'));}finally{button.disabled=false;}};
  App.cartItems=(compact=false)=>{
    const lines=App.cart.lines();
    if(!lines.length)return App.emptyProducts('cart.empty');
    return h('div',{class:'cart-items'},lines.map(line=>{
      const p=line.product,v=line.variant,image=h('img',{alt:p?App.tx(p.name):'',width:100,height:125,loading:'lazy'});if(p)App.img.apply(image,p.images[0]);
      const quantity=h('input',{class:'input cart-quantity',type:'number',min:1,max:Math.min(App.cart.MAX_QTY,line.available),step:1,value:line.qty,'aria-label':App.t('cart.quantity')});
      const row=h('article',{class:'cart-line','data-cart-sku':line.sku},[
        p?h('a',{href:App.productUrl(p),class:'cart-image'},image):null,
        h('div',{class:'cart-line-info'},[
          p?h('a',{href:App.productUrl(p),class:'cart-title',text:App.tx(p.name)}):h('strong',{text:App.t('cart.unavailable')}),
          v?h('p',{class:'muted',text:[App.tx(App.catalog.color(v.color)?.name)||v.color,App.catalog.size(v.size)?.label||v.size].join(' / ')}):null,
          h('p',{text:App.money.format(line.unitPrice)}),
          line.issue?h('p',{class:'field-error',role:'alert',text:App.t(line.issue)}):null,
          h('div',{class:'cart-line-actions'},[
            !compact?quantity:h('span',{text:App.t('cart.quantity')+': '+line.qty}),
            h('button',{type:'button',class:'text-link',text:App.t('cart.remove'),onclick:e=>App.cartAction(e.currentTarget,()=>App.cart.remove(line.productId,line.sku))})
          ])
        ]),!compact?h('strong',{class:'cart-line-total',text:App.money.format(line.total)}):null
      ]);
      quantity.addEventListener('change',()=>App.cartAction(quantity,async()=>{try{await App.cart.setQuantity(line.productId,line.sku,Number(quantity.value));}catch(e){quantity.value=line.qty;throw e;}}));
      return row;
    }));
  };
  App.orderSummary=q=>{
    const row=(key,value)=>h('div',{class:'total-row'},[h('span',{text:App.t(key)}),h('strong',{text:value})]);
    return h('div',{class:'order-summary'},[
      row('cart.subtotal',App.money.format(q.subtotal)),
      q.productDiscount?row('cart.productSaving',App.money.format(q.productDiscount)):null,
      q.coupon.discount?row('cart.couponDiscount','− '+App.money.format(q.coupon.discount)):null,
      row('cart.shipping',q.shipping.available?App.money.format(q.shipping.price):App.t('cart.shippingPending')),
      q.shipping.eta?h('p',{class:'muted',text:App.t('cart.eta',q.shipping.eta)}):null,
      h('div',{class:'grand-total'},row('cart.total',q.total==null?'—':App.money.format(q.total))),
      q.couponError?h('p',{class:'field-error',role:'alert',text:q.couponError}):null
    ]);
  };
  App.couponForm=()=>{
    const input=h('input',{class:'input',name:'coupon',maxlength:40,value:App.cart.state.couponCode,placeholder:App.t('coupon.code'),'aria-label':App.t('coupon.code'),autocapitalize:'characters'});
    const apply=h('button',{class:'btn btn-outline',type:'submit',text:App.t('coupon.apply')});
    const error=h('p',{class:'field-error',role:'alert'});
    const form=h('form',{class:'coupon-form'},[input,apply,App.cart.state.couponCode?h('button',{type:'button',class:'text-link',text:App.t('coupon.remove'),onclick:e=>App.cartAction(e.currentTarget,()=>App.cart.setCoupon(''))}):null,error]);
    form.addEventListener('submit',async e=>{e.preventDefault();apply.disabled=true;error.textContent='';try{const subtotal=App.cart.lines().reduce((n,l)=>n+l.total,0);await App.coupons.check(input.value,{subtotal});await App.cart.setCoupon(input.value);}catch(e){error.textContent=e.message||App.t('common.error');}finally{apply.disabled=false;}});
    return form;
  };
  App.paintCart=()=>{App.$$('[data-count="cart"]').forEach(el=>{const n=App.cart.count;el.textContent=String(n);el.dataset.n=String(n);});};
  App.on('cart',()=>{App.paintCart();const body=App.$('#cart-drawer .drawer-body');if(body)App.fillCartDrawer(body);});
  App.fillCartDrawer=body=>{body.textContent='';body.append(App.cartItems(true));if(App.cart.count)body.append(h('a',{class:'btn btn-primary',href:'cart.html',text:App.t('cart.view')}));};
})(window);
