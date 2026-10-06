(function(root){
  'use strict';
  const App=root.App,{h}=App,F=App.form,U=App.ui;
  App.admin.route({id:'settings',label:'إعدادات المتجر والشحن',icon:App.adminIcons.setup,perm:'settings.write',async render(el){
    await App.loadSettings(true);
    const {general,shipping={},inventory={}}=App.settings;
    const error=h('div',{class:'alert',role:'alert'});
    const form=h('form',{class:'form',novalidate:true},[error,U.box('بيانات المتجر',h('div',{class:'form-grid'},[
      F.field({name:'storeNameAr',label:'اسم المتجر بالعربي',value:general.storeName.ar,required:true,maxlength:80}),
      F.field({name:'storeNameEn',label:'اسم المتجر بالإنجليزي',value:general.storeName.en,maxlength:80}),
      F.field({name:'whatsapp',label:'رقم الواتساب',type:'tel',value:general.whatsapp,dir:'ltr',hint:'رقم مصري 010… أو +2010…؛ سيبه فاضي لإخفاء الواتساب'}),
      F.field({name:'lowStockThreshold',label:'حد المخزون القليل',type:'number',value:inventory.lowStockThreshold??5})
    ]))]);
    const shippingRows=App.governorates.map(g=>{
      const row=shipping.governorates?.[g.id]||{};
      const check=U.check('enabled_'+g.id,g.ar,!!row.enabled);
      const price=F.field({name:'price_'+g.id,label:'سعر الشحن — '+g.ar,type:'number',value:row.price??'',hint:'بالجنيه'});
      const input=price.querySelector('input');input.disabled=!row.enabled;
      check.querySelector('input').addEventListener('change',e=>{input.disabled=!e.target.checked;});
      return h('div',{class:'shipping-row'},[check,price]);
    });
    form.append(U.box('الشحن حسب المحافظة',h('div',{class:'form'},[
      h('p',{class:'muted',text:'المحافظة المقفولة مش متاحة للتوصيل. فعّل بس المناطق اللي بتوصلها فعلًا وحدد السعر.'}),
      h('div',{class:'form-grid'},[
        F.field({name:'freeShippingOver',label:'شحن مجاني من إجمالي',type:'number',value:shipping.freeShippingOver,hint:'سيبه فاضي لإلغاء الشحن المجاني؛ صفر يعني مجاني دائمًا للمناطق المفعّلة'}),
        F.field({name:'etaMin',label:'أقل مدة توصيل بالأيام',type:'number',value:shipping.etaDays?.min??2}),
        F.field({name:'etaMax',label:'أكبر مدة توصيل بالأيام',type:'number',value:shipping.etaDays?.max??5})
      ]),h('div',{class:'shipping-grid'},shippingRows)
    ])));
    const save=h('button',{type:'submit',class:'btn btn-primary',text:'حفظ الإعدادات'});form.append(save);
    form.addEventListener('submit',e=>{e.preventDefault();U.action(save,async()=>{
      const v=F.values(form),governorates={};
      App.governorates.forEach(g=>{governorates[g.id]={enabled:form.elements['enabled_'+g.id].checked,price:form.elements['price_'+g.id].value};});
      await App.saveStoreSettings({storeName:{ar:v.storeNameAr,en:v.storeNameEn},whatsapp:v.whatsapp,lowStockThreshold:v.lowStockThreshold,freeShippingOver:v.freeShippingOver,etaMin:v.etaMin,etaMax:v.etaMax,governorates,revisions:{general:general.revision||0,shipping:shipping.revision||0,inventory:inventory.revision||0}});
      App.toast('الإعدادات اتحفظت');el.textContent='';await this.render(el);
    },error);});
    el.append(form);
  }});
})(window);
