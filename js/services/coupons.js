(function(root){
  'use strict';
  const App=root.App,fail=key=>{throw new Error(App.t(key));};
  const normalize=value=>String(value||'').trim().toUpperCase();
  const date=value=>value==null||value===''?null:Date.parse(value);
  App.coupons={normalize,
    async check(input,{subtotal,now=Date.now()}={}){
      const code=normalize(input),uid=App.auth.user?.uid;
      if(!/^[A-Z0-9_-]{2,40}$/.test(code))fail('coupon.invalid');
      const coupon=await App.db.get('coupons',code);
      if(!coupon||!coupon.active)fail('coupon.invalid');
      const start=date(coupon.startsAt),end=date(coupon.expiresAt);
      if(start!==null&&(!Number.isFinite(start)||now<start))fail('coupon.notStarted');
      if(end!==null&&(!Number.isFinite(end)||now>=end))fail('coupon.expired');
      if(!Number.isFinite(subtotal)||subtotal<=0)fail('cart.empty');
      if(!Number.isFinite(coupon.value)||coupon.value<=0||!['percent','fixed'].includes(coupon.type)||coupon.type==='percent'&&coupon.value>100)fail('coupon.invalid');
      if(coupon.minOrder!=null&&(!Number.isFinite(coupon.minOrder)||coupon.minOrder<0))fail('coupon.invalid');
      if(subtotal<(coupon.minOrder||0))throw new Error(App.t('coupon.minimum',{amount:App.money.format(coupon.minOrder)}));
      if(coupon.usageLimit!=null){if(!Number.isInteger(coupon.usageLimit)||coupon.usageLimit<0||!Number.isInteger(coupon.usedCount)||coupon.usedCount<0)fail('coupon.invalid');if(coupon.usedCount>=coupon.usageLimit)fail('coupon.exhausted');}
      if(coupon.allowedUids?.length){if(!uid)fail('coupon.login');if(!coupon.allowedUids.includes(uid))fail('coupon.ineligible');}
      if(coupon.perCustomerLimit!=null){
        if(!Number.isInteger(coupon.perCustomerLimit)||coupon.perCustomerLimit<1)fail('coupon.invalid');
        if(!uid)fail('coupon.login');
        const usage=await App.db.get('users/'+uid+'/couponUsage',code);
        if((usage?.count||0)>=coupon.perCustomerLimit)fail('coupon.exhausted');
      }
      let discount=coupon.type==='percent'?subtotal*coupon.value/100:coupon.value;
      if(coupon.maxDiscount!=null){if(!Number.isFinite(coupon.maxDiscount)||coupon.maxDiscount<0)fail('coupon.invalid');discount=Math.min(discount,coupon.maxDiscount);}
      return {code,discount:App.money.round(Math.min(subtotal,discount))};
    }
  };
})(typeof window!=='undefined'?window:globalThis);
