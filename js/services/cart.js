(function (root) {
  'use strict';
  const App=root.App,MAX_LINES=20,MAX_QTY=9999;
  const blank=()=>({items:[],couponCode:''});
  const key=uid=>'cart:'+(uid?'user:'+uid:'guest');
  let state=blank(),owner,queue=Promise.resolve();
  const fail=k=>{throw new Error(App.t(k));};
  const copy=()=>App.clone(state);
  const enqueue=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
  const encode=items=>items.map(v=>[v.productId,v.sku,v.qty].join(':'));
  const decode=v=>{if(typeof v!=='string')return v;const [productId,sku,quantity]=v.split(':');return {productId,sku,qty:Number(quantity)};};
  const clean=data=>({items:(Array.isArray(data?.items)?data.items:[]).map(decode).filter(v=>v&&typeof v==='object').filter(v=>typeof v.productId==='string'&&v.productId.length<=100&&typeof v.sku==='string'&&v.sku.length<=90&&Number.isInteger(v.qty)&&v.qty>0&&v.qty<=MAX_QTY).slice(0,MAX_LINES).map(v=>({productId:v.productId,sku:v.sku,qty:v.qty})),couponCode:typeof data?.couponCode==='string'?data.couponCode.slice(0,40):''});
  const publish=()=>App.emit('cart',copy());
  function saveLocal(uid,data){if(!App.store.set(key(uid),data))fail('cart.storage');}
  async function sync() {
    const uid=App.auth.user?.uid||null;
    if(owner===uid)return;
    state=blank();owner=undefined;publish();
    const guest=clean(App.store.get(key(null),blank()));
    if(!uid){state=guest;owner=null;publish();return;}
    const merged=await App.db.tx(async t=>{
      const current=await t.get('carts',uid),next=clean(current);
      for(const item of guest.items){
        const found=next.items.find(v=>v.productId===item.productId&&v.sku===item.sku);
        if(found)found.qty=Math.min(MAX_QTY,found.qty+item.qty);
        else{if(next.items.length>=MAX_LINES)fail('cart.limit');next.items.push(item);}
      }
      if(!next.couponCode)next.couponCode=guest.couponCode;
      if(guest.items.length||guest.couponCode)t.set('carts',uid,{...next,items:encode(next.items),revision:(current?.revision||0)+1,updatedAt:App.db.now()});
      return next;
    });
    if((App.auth.user?.uid||null)!==uid)return;
    state=merged;owner=uid;App.store.set(key(uid),state);App.store.remove(key(null));publish();
  }
  function mutate(change) {
    const requestedUid=App.auth.user?.uid||null;
    return enqueue(async()=>{
      await sync();const uid=App.auth.user?.uid||null;
      if(uid!==requestedUid)fail('cart.accountChanged');
      let next;
      if(uid)next=await App.db.tx(async t=>{
        const current=await t.get('carts',uid),draft=clean(current);change(draft);
        t.set('carts',uid,{...draft,items:encode(draft.items),revision:(current?.revision||0)+1,updatedAt:App.db.now()});return draft;
      });
      else{next=clean(App.store.get(key(null),blank()));change(next);saveLocal(null,next);}
      if((App.auth.user?.uid||null)===uid){state=next;App.store.set(key(uid),next);publish();}
      return copy();
    });
  }
  function available(productId,sku,qty){
    const p=App.catalog.product(productId),v=p?.variants.find(v=>v.sku===sku);
    if(!p||!v)fail('cart.unavailable');
    if(!Number.isInteger(qty)||qty<1||qty>MAX_QTY)fail('cart.quantityError');
    if(qty>App.catalog.available(v))fail('cart.stockError');
  }
  App.cart={
    MAX_LINES,MAX_QTY,get state(){return copy();},get count(){return state.items.reduce((n,v)=>n+v.qty,0);},
    async init(){await App.auth.init();return enqueue(sync);},
    add(productId,sku,qty=1){return mutate(d=>{
      const row=d.items.find(v=>v.productId===productId&&v.sku===sku),next=(row?.qty||0)+Number(qty);available(productId,sku,next);
      if(row)row.qty=next;else{if(d.items.length>=MAX_LINES)fail('cart.limit');d.items.push({productId,sku,qty:next});}
    });},
    setQuantity(productId,sku,qty){return mutate(d=>{available(productId,sku,Number(qty));const row=d.items.find(v=>v.productId===productId&&v.sku===sku);if(!row)fail('cart.unavailable');row.qty=Number(qty);});},
    remove(productId,sku){return mutate(d=>{d.items=d.items.filter(v=>v.productId!==productId||v.sku!==sku);});},
    clear(){return mutate(d=>{d.items=[];d.couponCode='';});},
    setCoupon(code){return mutate(d=>{d.couponCode=App.coupons.normalize(code);});},
    lines(data=state){return data.items.map(item=>{
      const product=App.catalog.product(item.productId),variant=product?.variants.find(v=>v.sku===item.sku);
      const stock=variant?App.catalog.available(variant):0;
      const issue=!product||!variant?'cart.unavailable':item.qty>stock?'cart.stockError':null;
      const price=variant?App.catalog.price(product,variant):0;
      return {...item,product,variant,available:stock,issue,unitPrice:price,total:App.money.round(price*item.qty),originalTotal:App.money.round((variant?product.price+Number(variant.priceDelta||0):0)*item.qty)};
    });},
    async quote({governorate='',refresh=false}={}){
      if(refresh){await Promise.all([App.catalog.refresh(),App.loadSettings(true)]);await enqueue(async()=>{owner=undefined;await sync();});}
      const lines=App.cart.lines(),subtotal=App.money.round(lines.reduce((n,l)=>n+l.total,0));
      const productDiscount=App.money.round(lines.reduce((n,l)=>n+l.originalTotal-l.total,0));
      let coupon={discount:0,code:null},couponError='';
      if(state.couponCode)try{coupon=await App.coupons.check(state.couponCode,{subtotal});}catch(e){couponError=e.message;}
      const afterCoupon=App.money.round(Math.max(0,subtotal-coupon.discount));
      const shipping=App.shipping.quote({governorate,subtotal,afterCoupon});
      return {lines,subtotal,productDiscount,coupon,couponError,shipping,total:shipping.available?App.money.round(afterCoupon+shipping.price):null,valid:lines.length>0&&lines.every(l=>!l.issue)&&!couponError&&shipping.available};
    }
  };
  App.on('auth',()=>{state=blank();owner=undefined;publish();App.cart.init().catch(()=>App.toast?.(App.t('cart.syncError')));});
  if(root.addEventListener)root.addEventListener('storage',event=>{if(event.key==='cs:'+key(App.auth.user?.uid||null)){owner=undefined;App.cart.init().catch(()=>App.toast?.(App.t('cart.syncError')));}});
})(typeof window!=='undefined'?window:globalThis);
