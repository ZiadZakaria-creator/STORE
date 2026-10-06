(function(root){
  'use strict';
  const App=root.App,{h}=App,F=App.form;
  let draft={governorate:new URLSearchParams(location.search).get('gov')||''},draftOwner,reviewing=false,generation=0;
  async function render(){
    if(reviewing)return;
    const uid=App.auth.user?.uid||null;
    if(draftOwner!==undefined&&draftOwner!==uid)draft={};draftOwner=uid;
    const token=++generation,main=App.$('#main');document.title=App.t('checkout.title')+' — '+App.storeName();main.textContent='';
    const body=h('div',{class:'container section'},[App.breadcrumb([{href:'cart.html',text:App.t('nav.cart')},{text:App.t('checkout.title')}]),h('h1',{class:'page-title',text:App.t('checkout.title')})]);main.append(body);
    if(!App.cart.count){body.append(App.emptyProducts('cart.empty'));return;}
    if(!draft.name&&App.auth.user){draft.name=App.auth.user.name;draft.phone=App.auth.user.phone;draft.email=App.auth.user.email;}
    const alert=h('div',{class:'alert',role:'alert'}),form=h('form',{class:'form checkout-form',novalidate:true},alert);
    const saved=h('div');form.append(saved);
    const labels={name:'address.recipient',phone:'address.phone',email:'auth.email',governorate:'address.governorate',city:'address.city',area:'address.area',street:'address.street',building:'address.building',floor:'address.floor',apartment:'address.apartment',notes:'address.notes'};
    labels.phone='auth.phone';
    const grid=h('div',{class:'form-grid'});
    for(const name of Object.keys(labels)){
      const options=name==='governorate'?App.governorates.map(g=>({value:g.id,label:App.governorateName(g.id)})):null;
      const f=F.field({name,label:App.t(labels[name]),value:draft[name]||'',required:!['email','floor','apartment','notes'].includes(name),type:name==='governorate'?'select':name==='notes'?'textarea':name==='email'?'email':name==='phone'?'tel':'text',placeholder:options?App.t('address.chooseGov'):null,options:options||[],maxlength:name==='notes'?300:name==='email'?254:120,autocomplete:name==='name'?'name':name==='phone'?'tel':name==='email'?'email':null});
      if(options)f.querySelectorAll('option').forEach(op=>{if(op.value)op.disabled=!App.settings.shipping?.governorates?.[op.value]?.enabled;});
      grid.append(f);
    }
    form.append(grid);
    const review=h('button',{type:'submit',class:'btn btn-primary',text:App.t('checkout.review')});
    form.append(review,h('p',{class:'muted',text:App.t('checkout.notice')}));
    const summary=h('aside',{class:'cart-summary'},[h('h2',{text:App.t('cart.summary')}),App.couponForm()]);
    const totals=h('div'),result=h('section',{class:'checkout-review','aria-live':'polite'});summary.append(totals);body.append(h('div',{class:'cart-layout'},[form,summary]),result);
    let summaryGeneration=0;
    async function updateTotals(){const n=++summaryGeneration;try{const quote=await App.cart.quote({governorate:form.elements.governorate.value});if(token===generation&&n===summaryGeneration){totals.textContent='';totals.append(App.orderSummary(quote));}}catch(e){if(token===generation){totals.textContent=App.t('common.error');}}}
    form.addEventListener('input',()=>{draft=F.values(form);result.textContent='';});
    form.elements.governorate.addEventListener('change',()=>{draft=F.values(form);updateTotals();});
    updateTotals();
    if(uid)(async()=>{try{
      const addresses=await App.addresses.list(uid);if(token!==generation)return;
      if(addresses.length){
        const choose=h('select',{class:'input','aria-label':App.t('checkout.savedAddress')},[h('option',{value:'',text:App.t('checkout.manualAddress')}),...addresses.map(a=>h('option',{value:a.id,text:(a.label?a.label+' — ':'')+App.addresses.format(a)}))]);
        choose.addEventListener('change',()=>{const address=addresses.find(a=>a.id===choose.value);if(!address)return;for(const name of App.addresses.FIELDS)if(form.elements[name])form.elements[name].value=address[name]||'';draft=F.values(form);result.textContent='';updateTotals();});
        saved.append(h('label',{class:'field'},[h('span',{text:App.t('checkout.savedAddress')}),choose]));
      }
    }catch(e){if(token===generation)saved.append(h('p',{class:'field-error',text:App.t('checkout.addressError')}));}})();
    form.addEventListener('submit',async event=>{
      event.preventDefault();draft=F.values(form);const address=App.addresses.clean(draft),errors=App.addresses.validate(address);
      if(draft.email&&!App.validate.email(draft.email))errors.email=App.t('auth.err.email');
      if(!App.settings.shipping?.governorates?.[address.governorate]?.enabled)errors.governorate=App.t('checkout.noShipping');
      if(!F.setErrors(form,errors))return;
      reviewing=true;F.busy(review,true);alert.textContent='';result.textContent='';
      const controls=[...body.querySelectorAll('input,select,textarea,button')].map(node=>({node,disabled:node.disabled}));controls.forEach(({node})=>{node.disabled=true;});
      try{
        const q=await App.cart.quote({governorate:address.governorate,refresh:true});
        if(!q.valid)throw new Error(q.couponError||(!q.shipping.available?App.t('checkout.noShipping'):App.t('cart.fixItems')));
        totals.textContent='';totals.append(App.orderSummary(q));
        result.append(h('h2',{text:App.t('checkout.reviewTitle')}),h('p',{text:address.name+' — '+address.phone}),h('p',{text:App.addresses.format(address)}),
          ...['floor','apartment','notes','email'].filter(k=>draft[k]).map(k=>h('p',{text:App.t(labels[k])+': '+draft[k]})),
          h('div',{class:'review-items'},q.lines.map(l=>h('p',{text:App.tx(l.product.name)+' · '+(App.tx(App.catalog.color(l.variant.color)?.name)||l.variant.color)+' / '+(App.catalog.size(l.variant.size)?.label||l.variant.size)+' × '+l.qty+' — '+App.money.format(l.total)}))),
          App.orderSummary(q),h('p',{class:'alert alert-info',text:App.t('checkout.notice')}));
        result.scrollIntoView({behavior:'smooth',block:'start'});
      }catch(e){alert.className='alert alert-error';alert.textContent=e.message||App.t('common.error');}
      finally{controls.forEach(({node,disabled})=>{node.disabled=disabled;});reviewing=false;F.busy(review,false);}
    });
  }
  let refreshed=false;
  App.page(async()=>{if(!refreshed){refreshed=true;try{await Promise.all([App.catalog.refresh(),App.loadSettings(true)]);}catch(e){App.toast(App.t('common.error'));}}return render();});App.on('cart',()=>{if(App.$('.checkout-form'))render();});
})(window);
