(function(root){
  'use strict';
  const App=root.App;
  App.shipping={quote({governorate,subtotal,afterCoupon=subtotal},settings=App.settings.shipping){
    const unavailable={available:false,price:null,freeShipping:false,eta:null};
    if(!App.governorates.some(g=>g.id===governorate))return unavailable;
    const option=settings?.governorates?.[governorate];
    if(!option?.enabled||!Number.isFinite(option.price)||option.price<0)return unavailable;
    const threshold=settings.freeShippingOver,basis=settings.freeShippingBasis==='beforeCoupon'?subtotal:afterCoupon;
    const freeShipping=Number.isFinite(threshold)&&threshold>=0&&Number.isFinite(basis)&&basis>=threshold;
    const eta=settings.etaDays;
    return {available:true,price:freeShipping?0:App.money.round(option.price),freeShipping,eta:eta&&Number.isInteger(eta.min)&&Number.isInteger(eta.max)&&eta.min>0&&eta.max>=eta.min?{min:eta.min,max:eta.max}:null};
  }};
})(typeof window!=='undefined'?window:globalThis);
